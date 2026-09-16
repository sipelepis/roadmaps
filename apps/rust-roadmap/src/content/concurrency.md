# Threads & channels

Rust's ownership rules extend to threads: the checks that stop a dangling reference also stop a data race, at compile time. You get real OS threads, scoped threads that can borrow local data, channels for passing messages, and `Mutex` and atomics for shared state.

## Spawning and joining

```rust
use std::thread;

let handle = thread::spawn(|| (1..=10).sum::<u32>());
let total = handle.join().unwrap();     // waits for the thread
println!("{total}");                     // 55
```

`thread::spawn` runs a closure on a new OS thread and returns a `JoinHandle<T>`, where `T` is whatever the closure returns. `join()` blocks until the thread finishes and gives back `Result<T, _>`: `Err` if the thread panicked. `Result` is an enum like `Option`, with variants `Ok(value)` and `Err(error)`, and `.unwrap()` takes the value out of an `Ok` or panics on an `Err`. Here an `Err` means another thread crashed, so passing the panic on is the right call. When `main` returns the process exits and any unfinished threads die with it, so join the ones whose work you need.

## `move` closures

```rust
use std::thread;

let names = vec!["ada", "alan"];
let handle = thread::spawn(|| {
    println!("{names:?}");   // error[E0373]: closure may outlive the current function, but it borrows `names`
});
handle.join().unwrap();
```

The new thread might run longer than the function that spawned it, so it can't borrow that function's locals. `spawn` requires the closure to be `'static`: it must own everything it uses. Add `move` and `names` moves into the thread. If you still need it afterwards, clone it first, or share it with `Arc` (below).

## Scoped threads can borrow

```rust
use std::thread;

let mut data = vec![1, 2, 3, 4, 5, 6];
let (left, right) = data.split_at_mut(3);
thread::scope(|s| {
    s.spawn(|| left.iter_mut().for_each(|x| *x *= 10));
    s.spawn(|| right.iter_mut().for_each(|x| *x += 1));
});                                      // every thread spawned in the scope is joined here
println!("{data:?}");                    // [10, 20, 30, 5, 6, 7]
```

`thread::scope` guarantees that its threads finish before it returns, so they may borrow locals, even mutably. The borrowing rules still hold across threads: two threads each get a `&mut` to a different half, which is fine, but two threads mutating the same `Vec` would not compile. For "split the work, wait for all of it", this is the tool.

## Channels

```rust
use std::sync::mpsc;
use std::thread;

let (tx, rx) = mpsc::channel();
for id in 0..3 {
    let tx = tx.clone();
    thread::spawn(move || {
        tx.send(format!("worker {id} done")).unwrap();
    });
}
drop(tx);                                // otherwise the loop below never ends
for msg in rx {
    println!("{msg}");                   // arrives in whatever order the workers finish
}
```

`mpsc` means multiple producers, single consumer. `send` moves the value into the channel, so the sending thread can't touch it afterwards; ownership travels with the message. Receiving (`for msg in rx`, or `rx.recv()`) blocks until a message arrives, and the loop ends once every `Sender` has been dropped. Go closes channels explicitly; Rust closes them when the last sender goes away. Forgetting to drop the original `tx` is the classic hang: the receiver waits forever for a sender that will never send.

## Shared state: `Arc<Mutex<T>>`

```rust
use std::sync::{Arc, Mutex};
use std::thread;

let counter = Arc::new(Mutex::new(0));
let mut handles = Vec::new();
for _ in 0..8 {
    let counter = Arc::clone(&counter);
    handles.push(thread::spawn(move || {
        for _ in 0..1000 {
            *counter.lock().unwrap() += 1;
        }
    }));
}
for h in handles {
    h.join().unwrap();
}
println!("{}", *counter.lock().unwrap());   // 8000
```

- `Arc` is `Rc` with an atomic counter, so it can be shared across threads.
- `Mutex<T>` holds the data *inside* the lock. `lock()` returns a guard that dereferences to `T` and unlocks when it's dropped. In Go or Java the mutex sits next to the data and nothing stops you forgetting it; here the lock is the only way in.
- `lock()` returns a `Result` because if a thread panics while holding the lock, the mutex is *poisoned*. `unwrap()` is the usual response.

Try the same with `Rc` and the compiler stops you:

```rust
use std::rc::Rc;
use std::thread;

let rc = Rc::new(5);
thread::spawn(move || println!("{rc}"));   // error[E0277]: `Rc<i32>` cannot be sent between threads safely
```

## `Send` and `Sync`

Two marker traits the compiler implements automatically for types built from safe parts:

- `Send`: a value can be moved to another thread. Nearly everything is. `Rc` isn't, because two threads bumping its plain counter could corrupt it.
- `Sync`: a `&T` can be shared between threads. `RefCell` and `Cell` aren't, because they mutate without synchronization. `Mutex<T>` is, which is how it makes shared mutation safe.

`thread::spawn` requires its closure to be `Send + 'static`. You'll rarely write these traits yourself; you'll meet them in error messages, and that's the point. A data race in Rust is a compile error, not a heisenbug. What the compiler can't catch is logic: deadlocks, and check-then-act bugs across two separate `lock()` calls.

## Atomics and friends

```rust
use std::sync::atomic::{AtomicUsize, Ordering};

static HITS: AtomicUsize = AtomicUsize::new(0);
HITS.fetch_add(1, Ordering::Relaxed);
println!("{}", HITS.load(Ordering::Relaxed));
```

For a single counter or flag, an atomic is cheaper than a `Mutex`. `Ordering::Relaxed` is fine for counters; `SeqCst` is the safe default when other memory depends on the value. Also worth knowing: `RwLock` for data that's read far more than written, and `OnceLock` for initialize-once values. `async`/`await` with a runtime like Tokio is a separate model, built for thousands of concurrent network tasks rather than CPU work.

```rust playground
use std::collections::HashMap;
use std::sync::mpsc;
use std::thread;

fn main() {
    let docs = vec![
        "the cat sat on the mat",
        "the dog ate the cat food",
        "a bird sat on the dog",
    ];

    // One thread per document counts its words and sends the result back.
    let (tx, rx) = mpsc::channel();
    thread::scope(|s| {
        for (i, doc) in docs.iter().enumerate() {
            let tx = tx.clone();
            s.spawn(move || {
                let mut counts: HashMap<&str, usize> = HashMap::new();
                for word in doc.split_whitespace() {
                    *counts.entry(word).or_insert(0) += 1;
                }
                tx.send((i, counts)).unwrap();
            });
        }
    });
    drop(tx);

    // Merge on the main thread.
    let mut total: HashMap<&str, usize> = HashMap::new();
    for (i, counts) in rx {
        println!("doc {i}: {} distinct words", counts.len());
        for (word, n) in counts {
            *total.entry(word).or_insert(0) += n;
        }
    }
    let mut top: Vec<_> = total.into_iter().collect();
    top.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
    println!("top 3: {:?}", &top[..3]);
}

// Try: delete `drop(tx);`. Why does the program now hang instead of finishing?
```

## Exercises

### 1. Spawn and join

`spawn_squares(n)` spawns one thread for each `i` in `0..n`; each thread returns `i * i`. Keep the `JoinHandle`s in a `Vec`, then join them in order and collect the results. Each closure needs `move` to own its `i`.

```rust starter
use std::thread;

pub fn spawn_squares(n: u64) -> Vec<u64> {
    todo!()
}
```

```rust test
/// squares in order
#[test]
fn squares() {
    assert_eq!(spawn_squares(5), vec![0, 1, 4, 9, 16]);
    assert_eq!(spawn_squares(1), vec![0]);
    assert_eq!(spawn_squares(3), vec![0, 1, 4]);
}

/// many threads, still in order
#[test]
fn many() {
    let expected: Vec<u64> = (0..100).map(|i| i * i).collect();
    assert_eq!(spawn_squares(100), expected);
}

/// zero threads, empty result
#[test]
fn none() {
    assert!(spawn_squares(0).is_empty());
}
```

#### Uses
- [Threads & channels › Spawning and joining](#/concurrency/spawning-and-joining)
- [Threads & channels › `move` closures](#/concurrency/move-closures)
- [Threads & channels › Shared state: `Arc<Mutex<T>>`](#/concurrency/shared-state-arcmutext)

#### Hints
- First loop, over `0..n`: spawn a `move` closure that returns `i * i`, and push its handle into a `Vec`.
- Second loop, over the handles in order: `join()` each one, `unwrap()` it, and push the value into the output `Vec`.

#### Tips
- Spawn everything before joining anything. Joining inside the first loop would wait for each thread before starting the next, and they'd run one at a time.
- Threads finish in whatever order they like, but joining the handles in order gives an ordered result. The order comes from how you collect, never from when the work happened.
- `move` is needed even though `i` is a `u64` and `Copy`. `spawn` requires the closure to own everything it touches, so the copy has to happen at spawn time rather than at call time.
- `join()` gives a `Result`, and the `Err` is a panic that happened over there. `unwrap` re-raises it here, which is usually right: a worker that crashed shouldn't look like a worker that returned nothing.

#### Docs
- [Rust book: Waiting for all threads to finish](https://doc.rust-lang.org/book/ch16-01-threads.html#waiting-for-all-threads-to-finish-using-join-handles)

### 2. Parallel sum with scoped threads

`parallel_sum(data, parts)` splits `data` into `parts` roughly equal chunks, sums each chunk on its own thread and adds up the results. Use `thread::scope` so the threads can borrow `data`. `data.chunks(size)` splits a slice; with `size = data.len().div_ceil(parts).max(1)` you get at most `parts` chunks and never a zero size (which `chunks` would reject). `parts` is always at least 1.

```rust starter
use std::thread;

pub fn parallel_sum(data: &[u64], parts: usize) -> u64 {
    todo!()
}
```

```rust test
/// matches the sequential sum
#[test]
fn sums() {
    let data: Vec<u64> = (1..=1000).collect();
    assert_eq!(parallel_sum(&data, 4), 500_500);
    assert_eq!(parallel_sum(&data, 7), 500_500);
    assert_eq!(parallel_sum(&data, 1), 500_500);
}

/// chunks that don't divide evenly
#[test]
fn uneven() {
    let data: Vec<u64> = (1..=10).collect();
    assert_eq!(parallel_sum(&data, 3), 55);
    assert_eq!(parallel_sum(&data, 4), 55);
    assert_eq!(parallel_sum(&[5, 6, 7], 3), 18);
}

/// more parts than items, or no items
#[test]
fn edge_cases() {
    assert_eq!(parallel_sum(&[1, 2, 3], 10), 6);
    assert_eq!(parallel_sum(&[42], 5), 42);
    assert_eq!(parallel_sum(&[], 3), 0);
    assert_eq!(parallel_sum(&[], 1), 0);
}
```

#### Uses
- [Threads & channels › Scoped threads can borrow](#/concurrency/scoped-threads-can-borrow)
- [Threads & channels › Spawning and joining](#/concurrency/spawning-and-joining)
- [Closures & iterators › Adapters are lazy](#/iterators/adapters-are-lazy)
- [Vec & HashMap › Reading and cutting a slice](#/collections/reading-and-cutting-a-slice)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- Work out `size` first, then do the rest inside `thread::scope(|s| { ... })`. `thread::scope` returns whatever its closure returns, so the closure can end with the total.
- For each `chunk` in `data.chunks(size)`, `s.spawn` a `move` closure that sums it, and keep the handles in a `Vec`.
- Still inside the scope, join every handle and add up the results.

#### Tips
- `move` here copies the `chunk` reference into the thread, not the numbers. The thread may borrow `data`, but not the loop variable, which ends with each iteration.
- `thread::spawn` could not do this at all: it needs `'static`, and `data` is a local. `thread::scope` is what makes borrowing safe, by guaranteeing every thread is joined before the scope returns.
- `.max(1)` isn't decoration. An empty `data` makes `size` zero, and `chunks(0)` panics, so the `edge_cases` test would fail on a panic rather than a wrong number.
- Fewer, bigger chunks beat one thread per element. Each thread costs far more to start than a handful of additions saves, which is why `parts` is a parameter rather than `data.len()`.

#### Docs
- [std: thread::scope](https://doc.rust-lang.org/std/thread/fn.scope.html)
- [std: slice::chunks](https://doc.rust-lang.org/std/primitive.slice.html#method.chunks)

### 3. A two-stage pipeline

`pipeline(nums)` passes numbers through two threads connected by channels:

1. Stage one owns `nums` and sends each number doubled into channel A.
2. Stage two receives from A and forwards only the values greater than 10 into channel B.
3. The calling thread collects everything from B into a `Vec`, in order.

Move each `Sender` into the thread that uses it. When a thread finishes, its sender drops, which closes the channel and ends the next stage's loop. If a sender stays alive somewhere, the receiving loop waits forever and the run times out.

```rust starter
use std::sync::mpsc;
use std::thread;

pub fn pipeline(nums: Vec<i32>) -> Vec<i32> {
    todo!()
}
```

```rust test
/// doubles, then filters
#[test]
fn doubles_and_filters() {
    assert_eq!(pipeline(vec![1, 5, 6, 20, -3, 8]), vec![12, 40, 16]);
    assert_eq!(pipeline(vec![100, 3]), vec![200]);
}

/// exactly 10 is not greater than 10
#[test]
fn boundary() {
    assert!(pipeline(vec![5]).is_empty());
    assert_eq!(pipeline(vec![5, 6]), vec![12]);
    assert!(pipeline(vec![1, 2, 3, -50]).is_empty());
}

/// keeps order across many values
#[test]
fn many() {
    let nums: Vec<i32> = (0..1000).collect();
    let expected: Vec<i32> = (6..1000).map(|n| n * 2).collect();
    assert_eq!(pipeline(nums), expected);
}

/// empty in, empty out
#[test]
fn empty() {
    assert!(pipeline(vec![]).is_empty());
}
```

#### Uses
- [Threads & channels › Channels](#/concurrency/channels)
- [Threads & channels › `move` closures](#/concurrency/move-closures)

#### Hints
- Create both channels up front, each with `mpsc::channel()`, which returns a `(sender, receiver)` pair.
- Stage one is a `thread::spawn(move || ...)` that sends `n * 2` for each `n` in `nums`. Stage two loops over the receiver of A and sends the big values on B's sender.
- On the calling thread, loop over B's receiver and push into a `Vec`. The loop ends by itself once stage two finishes and drops its sender.

#### Tips
- A channel keeps the order of messages from one sender, which is why the output comes out in input order across three threads.
- The hang is the failure mode to recognize. If a `Sender` is still alive anywhere — kept in a variable, cloned and not dropped — the receiving loop waits forever and the run times out with no error.
- `move` into each thread is what drops the senders at the right time: the closure owns its sender, and the sender dies when the thread's work is done.
- Nothing here needs a lock. Ownership travels with each message, so only one thread can touch a value at a time by construction. That's the argument for channels over shared state.

#### Docs
- [Rust book: Using message passing to transfer data between threads](https://doc.rust-lang.org/book/ch16-02-message-passing.html)

### 4. Shared counts behind a mutex

`count_words(texts)` counts words across all texts, one thread per text, every thread updating a single `Arc<Mutex<HashMap<String, usize>>>`. Words are separated by any whitespace. After joining the threads, take the map out: `Arc::try_unwrap(counts)` succeeds once only one `Arc` is left, and `Mutex::into_inner` unwraps the lock. (Locking and cloning the map works too.)

```rust starter
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;

pub fn count_words(texts: Vec<String>) -> HashMap<String, usize> {
    todo!()
}
```

```rust test
fn texts(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

/// counts across every text
#[test]
fn counts() {
    let counts = count_words(texts(&["a b a", "b c", "a"]));
    assert_eq!(counts["a"], 3);
    assert_eq!(counts["b"], 2);
    assert_eq!(counts["c"], 1);
    assert_eq!(counts.len(), 3);
    let counts = count_words(texts(&["x\ty\n  x", "y"]));
    assert_eq!(counts["x"], 2);
    assert_eq!(counts["y"], 2);
    assert_eq!(counts.len(), 2);
}

/// many threads, no lost updates
#[test]
fn many_threads() {
    let many = vec!["tick tock tick".to_string(); 100];
    let counts = count_words(many);
    assert_eq!(counts["tick"], 200);
    assert_eq!(counts["tock"], 100);
    let mut mixed = Vec::new();
    for i in 0..50 {
        mixed.push(format!("word{i} shared"));
    }
    let counts = count_words(mixed);
    assert_eq!(counts["shared"], 50);
    assert_eq!(counts["word0"], 1);
    assert_eq!(counts["word49"], 1);
    assert_eq!(counts.len(), 51);
}

/// no texts, no counts
#[test]
fn empty() {
    assert!(count_words(vec![]).is_empty());
    assert!(count_words(texts(&["", "   "])).is_empty());
}
```

#### Uses
- [Threads & channels › Shared state: `Arc<Mutex<T>>`](#/concurrency/shared-state-arcmutext)
- [Vec & HashMap › The entry API](#/collections/the-entry-api)
- [Strings & slices › Everyday string methods](#/strings/everyday-string-methods)
- [Reference › Threads and channels](#/reference/threads-and-channels)

#### Hints
- Same shape as the article's counter: one `Arc::new(Mutex::new(HashMap::new()))`, an `Arc::clone` moved into each thread, and a `Vec` of handles to join.
- Inside a thread, loop over `text.split_whitespace()` and update the map through `lock().unwrap()` with the entry API.
- After joining, `Arc::try_unwrap` and then `into_inner` get the map out. Both return a `Result`, so `unwrap` each.

#### Tips
- Locking once per word is simple but makes threads queue. Counting into a local `HashMap` and merging it under one lock at the end scales better.
- `Arc::try_unwrap` fails if any clone is still alive, so every thread has to be joined first. A handle you forgot to join keeps its `Arc`, and the `unwrap` panics instead of hanging.
- Swap `Arc` for `Rc` and it stops compiling, with `Rc<...> cannot be sent between threads safely`. That error is the `Send` marker doing its job, not an inconvenience to work around.
- `*map.entry(word.to_string()).or_insert(0) += 1` holds the lock for the whole statement. Locking once and then counting a whole text inside that guard is both faster and simpler than locking per word.

#### Docs
- [Rust book: Sharing a `Mutex<T>` between multiple threads](https://doc.rust-lang.org/book/ch16-03-shared-state.html#sharing-a-mutext-between-multiple-threads)
- [std: Arc::try_unwrap](https://doc.rust-lang.org/std/sync/struct.Arc.html#method.try_unwrap)
