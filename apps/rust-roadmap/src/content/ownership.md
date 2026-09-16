# Ownership

Every value in Rust has exactly one owner, and the value is freed when its owner goes out of scope. Assigning or passing a value that owns heap memory *moves* it, which is how Rust manages memory with neither a garbage collector nor manual `free`.

## Stack and heap

Values whose size is known at compile time, such as an `i32`, a `bool` or a `[u8; 4]`, live directly on the stack, inside the function's frame. Values that can grow, such as a `String` or a `Vec`, keep a small fixed-size header on the stack (a pointer, a length and a capacity) and their contents in a buffer on the heap.

```rust
let n = 5;                      // 4 bytes on the stack
let s = String::from("hello");  // header on the stack, "hello" on the heap
let v = vec![1, 2, 3];          // same idea: a Vec is a growable array
```

`vec![...]` creates a `Vec`, a growable list, and `Vec::new()` an empty one. A handful of its methods show up long before the Vec & HashMap module covers it properly:

```rust
let mut v = vec![1, 2, 3];
v.push(4);        // appends: [1, 2, 3, 4]
v.len();          // 4
v.is_empty();     // false
v.pop();          // Some(4), and v is [1, 2, 3] again
v.last();         // Some(&3)
v[0];             // 1, and panics if the index is past the end
```

`pop` returns an `Option`, because the Vec might be empty; that type is the subject of a later module. `push` and `pop` together make a `Vec` a stack.

Someone has to free that heap buffer. Python and JavaScript use a garbage collector, C makes you call `free` yourself. Rust ties it to scope.

## The rules

1. Each value has one owner, a variable (or a field, or an element of a collection).
2. There is only one owner at a time.
3. When the owner goes out of scope, the value is dropped and its memory freed.

```rust
{
    let s = String::from("scoped");
    println!("{s}");
} // s goes out of scope: the String is dropped, its heap buffer freed
```

Dropping is deterministic. It happens at the closing brace, every time, which is also how Rust closes files and releases locks without a `finally` or `with` block. You can drop early with `drop(value)`.

## Moves

In Python, `b = a` makes two names point at one list. In Rust, assigning a `String` *moves* ownership to the new variable, and the old one can't be used any more:

```rust
let a = String::from("hi");
let b = a;
println!("{a}");
// error[E0382]: borrow of moved value: `a`
```

```text
error[E0382]: borrow of moved value: `a`
 --> src/main.rs:4:16
  |
2 |     let a = String::from("hi");
  |         - move occurs because `a` has type `String`, which does not implement the `Copy` trait
3 |     let b = a;
  |             - value moved here
4 |     println!("{a}");
  |                ^ value borrowed here after move
  |
help: consider cloning the value if the performance cost is acceptable
  |
3 |     let b = a.clone();
  |              ++++++++
```

Why not just let both variables share the buffer? Because then both would try to free it when they go out of scope, a double free. Rust copies the stack header and treats `a` as uninitialized, so exactly one owner is left. Nothing is copied on the heap, which makes a move cheap.

## Copy types

Integers, floats, `bool`, `char`, and tuples and arrays made only of those, are `Copy`. They live entirely on the stack, so assigning them just duplicates the bits and both variables stay usable:

```rust
let x = 5;
let y = x;
println!("{x} {y}"); // fine: i32 is Copy
```

A type is either `Copy` or it moves. Anything that owns heap memory, like `String` and `Vec`, moves.

## Clone

When you really want two independent copies of heap data, ask for one with `.clone()`:

```rust
let a = String::from("hi");
let b = a.clone(); // allocates a second buffer
println!("{a} {b}");
```

Cloning is explicit on purpose. In Rust, an expensive copy is always visible in the code as a `.clone()` call.

That visibility is also a warning sign. A `.clone()` added to make the borrow checker stop complaining usually means the ownership isn't decided yet: something is being read after it was given away, or a function is taking a value it only needed to borrow. Clone when you genuinely want a second copy. When you're cloning to quiet an error, read the error first, and reach for the fixes in the next module instead.

## Ownership and functions

Passing a value to a function works exactly like assignment: it moves (or copies, for `Copy` types).

```rust
fn consume(s: String) {
    println!("consumed {s}");
} // s is dropped here

fn main() {
    let name = String::from("Ada");
    consume(name);
    println!("{name}");
    // error[E0382]: borrow of moved value: `name`
}
```

Returning a value moves it out to the caller, so a function can take ownership, change the value, and hand it back:

```rust
fn add_exclamation(mut s: String) -> String {
    s.push('!');
    s
}

let greeting = add_exclamation(String::from("hello"));
```

Threading every value in and back out like that gets tedious. The next module, Borrowing, lets a function use a value without taking it.

## Moves in loops

A value can be moved only once, and the compiler knows a loop body runs more than once:

```rust
fn consume(s: String) {}

let s = String::from("once");
for _ in 0..3 {
    consume(s);
}
// error[E0382]: use of moved value: `s`   (value moved here, in previous iteration of loop)
```

Iterating over a `Vec` with `for item in v` moves each element out of it, one per pass, and uses up `v`. That's fine when you're done with the Vec, and the right way to transfer its elements somewhere else without cloning them:

```rust
let words = vec![String::from("a"), String::from("b")];
let mut kept = Vec::new();
for w in words {
    kept.push(w); // each String moves from `words` into `kept`
}
// `words` is gone now; `kept` owns both Strings
```

```rust playground
fn shout(mut s: String) -> String {
    s.push_str("!!!");
    s
}

fn main() {
    let original = String::from("hello");
    let copy = original.clone();
    let loud = shout(original); // `original` moves into shout
    println!("{copy} became {loud}");

    let n = 42;
    let m = n; // i32 is Copy, both stay usable
    println!("{n} {m}");

    let names = vec![String::from("Ada"), String::from("Grace")];
    let mut greetings = Vec::new();
    for name in names {
        greetings.push(shout(name));
    }
    println!("{greetings:?}");

    // Try: print `original` after the call to shout and read the error.
}
```

## Exercises

### 1. Take it and give it back

Take ownership of `s`, append an exclamation mark, and return it. `s.push(c)` appends a `char`, and mutating it requires the parameter to be declared `mut s: String`.

```rust starter
pub fn exclaim(s: String) -> String {
    todo!()
}
```

```rust test
/// appends an exclamation mark
#[test]
fn appends() {
    let s = String::from("hello");
    assert_eq!(exclaim(s), "hello!");
    assert_eq!(exclaim(String::from("Rust is fun")), "Rust is fun!");
}

/// adds exactly one mark
#[test]
fn exactly_one() {
    assert_eq!(exclaim(String::from("wow!")), "wow!!");
    assert_eq!(exclaim(String::from("héllo")), "héllo!");
}

/// works on an empty string
#[test]
fn empty() {
    assert_eq!(exclaim(String::new()), "!");
    assert_eq!(exclaim(String::from(" ")), " !");
}
```

#### Uses
- [Ownership › Ownership and functions](#/ownership/ownership-and-functions)
- [Functions › Parameters are bindings too](#/functions/parameters-are-bindings-too)

#### Hints
- Change the signature to `mut s: String`. The caller doesn't see this: it gave the `String` away.
- Push the `'!'`, then leave `s` as the last expression to hand it back.

#### Tips
- `'!'` in single quotes is a `char`, which is what `push` takes. For a string, use `push_str("!")`.
- `mut` on a parameter is invisible to the caller. It isn't part of the signature: it only says this function may change its own copy, which it owns outright.
- `s.push('!')` returns `()`, so it can't be the last expression. Push on one line, then name `s` on the next.

#### Docs
- [Book: Return values and scope](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#return-values-and-scope)
- [std: `String::push`](https://doc.rust-lang.org/std/string/struct.String.html#method.push)

### 2. Name and shout

Return the name together with an uppercase copy of it, as `(name, NAME)`. `name.to_uppercase()` creates a new `String` without consuming `name`.

The obvious one-liner `(name, name.to_uppercase())` doesn't compile. Tuple fields are evaluated left to right, so `name` is moved into the tuple before `to_uppercase` gets to read it (`error[E0382]: borrow of moved value`). Fix the order.

```rust starter
pub fn with_upper(name: String) -> (String, String) {
    todo!()
}
```

```rust test
/// returns the name and its uppercase version
#[test]
fn pair() {
    let (name, upper) = with_upper(String::from("Ada"));
    assert_eq!(name, "Ada");
    assert_eq!(upper, "ADA");
    let (name, upper) = with_upper(String::from("ferris"));
    assert_eq!(name, "ferris");
    assert_eq!(upper, "FERRIS");
}

/// keeps the name exactly as given
#[test]
fn keeps_name() {
    let (name, upper) = with_upper(String::from("grace Hopper"));
    assert_eq!(name, "grace Hopper");
    assert_eq!(upper, "GRACE HOPPER");
    let (name, upper) = with_upper(String::from("r2-d2"));
    assert_eq!(name, "r2-d2");
    assert_eq!(upper, "R2-D2");
}

/// uppercases non-ASCII letters too
#[test]
fn non_ascii() {
    let (name, upper) = with_upper(String::from("Zoë"));
    assert_eq!(name, "Zoë");
    assert_eq!(upper, "ZOË");
    let (name, upper) = with_upper(String::from("élodie"));
    assert_eq!(name, "élodie");
    assert_eq!(upper, "ÉLODIE");
}
```

#### Uses
- [Ownership › Moves](#/ownership/moves)
- [Ownership › Ownership and functions](#/ownership/ownership-and-functions)
- [Reference › Strings and &str](#/reference/strings-and-str)

#### Hints
- Do the reading before the moving: compute the uppercase copy first and store it in its own variable.
- Then build the tuple from `name` and that variable. Nothing reads `name` after it moves.

#### Tips
- Calling a method like `to_uppercase` only reads `name`; it doesn't move it. The move happens when `name` itself is placed in the tuple.
- Reordering two lines is the cheapest fix for a move error, and it's the first thing to try. `name.clone()` also compiles, and allocates a whole second string to avoid writing the lines the other way round.
- `to_uppercase` returns a `String`, not a `&str`, because uppercasing can change the length: `ß` becomes `SS`. That's why it has to allocate rather than hand back a view.

#### Docs
- [std: `str::to_uppercase`](https://doc.rust-lang.org/std/primitive.str.html#method.to_uppercase)
- [Book: Ownership and functions](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#ownership-and-functions)

### 3. Sort into two piles

Move every word into one of two new Vecs: words with at least `min` bytes go into the first, shorter ones into the second. Keep the original order within each pile and don't clone anything. `word.len()` gives the length in bytes.

```rust starter
pub fn split_by_length(words: Vec<String>, min: usize) -> (Vec<String>, Vec<String>) {
    todo!()
}
```

```rust test
fn strings(words: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for w in words {
        out.push(w.to_string());
    }
    out
}

/// splits by length, preserving order
#[test]
fn splits() {
    let (long, short) = split_by_length(strings(&["tree", "a", "house", "on", "hill"]), 4);
    assert_eq!(long, strings(&["tree", "house", "hill"]));
    assert_eq!(short, strings(&["a", "on"]));
}

/// a word of exactly `min` bytes is long
#[test]
fn boundary() {
    let (long, short) = split_by_length(strings(&["abc", "ab", "abcd", "a"]), 3);
    assert_eq!(long, strings(&["abc", "abcd"]));
    assert_eq!(short, strings(&["ab", "a"]));
}

/// counts bytes, not characters
#[test]
fn bytes() {
    let (long, short) = split_by_length(strings(&["über", "hi", "naïve", "tree"]), 5);
    assert_eq!(long, strings(&["über", "naïve"]));
    assert_eq!(short, strings(&["hi", "tree"]));
}

/// everything can land in one pile
#[test]
fn one_pile() {
    let (long, short) = split_by_length(strings(&["a", "bb"]), 0);
    assert_eq!(long, strings(&["a", "bb"]));
    assert_eq!(short.len(), 0);
    let (long, short) = split_by_length(strings(&["a", "bb"]), 9);
    assert_eq!(long.len(), 0);
    assert_eq!(short, strings(&["a", "bb"]));
}

/// empty input gives two empty piles
#[test]
fn empty() {
    let (long, short) = split_by_length(Vec::new(), 3);
    assert_eq!(long.len() + short.len(), 0);
}
```

#### Uses
- [Ownership › Moves in loops](#/ownership/moves-in-loops)
- [Ownership › Stack and heap](#/ownership/stack-and-heap)
- [Control flow › `if` needs a `bool`](#/control-flow/if-needs-a-bool)

#### Hints
- Start with two empty piles, `let mut long = Vec::new();` and one for the short words.
- `for word in words` hands you each `String` by value, so you can push it straight into a pile.
- Decide with `if word.len() >= min`, then return `(long, short)`.

#### Tips
- You never write the piles' element type. The compiler works out `Vec<String>` from what you push and from the return type.
- `for word in words` uses `words` up, one `String` at a time, and that's exactly what "don't clone anything" means here. Each word is moved into a pile, not copied.
- `word.len()` counts bytes, so `"über"` is five and `"tree"` is four. The `bytes` test depends on that; counting characters would need `word.chars().count()`.

#### Docs
- [std: `Vec::push`](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.push)
- [Book: Ownership and functions](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#ownership-and-functions)

### 4. Repeat each word

Return a new Vec where every word appears `times` times in a row: `["a", "b"]` with `times = 2` becomes `["a", "a", "b", "b"]`.

You own each word only once, so all but one of the copies have to be clones. Moving the same word inside an inner loop fails with `value moved here, in previous iteration of loop`.

```rust starter
pub fn repeat_each(words: Vec<String>, times: usize) -> Vec<String> {
    words
}
```

```rust test
fn strings(words: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for w in words {
        out.push(w.to_string());
    }
    out
}

/// repeats each word in place
#[test]
fn repeats() {
    assert_eq!(repeat_each(strings(&["a", "b"]), 2), strings(&["a", "a", "b", "b"]));
    assert_eq!(
        repeat_each(strings(&["x", "y", "x"]), 3),
        strings(&["x", "x", "x", "y", "y", "y", "x", "x", "x"])
    );
}

/// once returns the same words
#[test]
fn once() {
    assert_eq!(repeat_each(strings(&["x", "y"]), 1), strings(&["x", "y"]));
    assert_eq!(repeat_each(strings(&["only"]), 1), strings(&["only"]));
}

/// zero times, or no words, returns nothing
#[test]
fn zero() {
    assert_eq!(repeat_each(strings(&["x", "y"]), 0), Vec::<String>::new());
    assert_eq!(repeat_each(Vec::new(), 4), Vec::<String>::new());
}
```

#### Uses
- [Ownership › Clone](#/ownership/clone)
- [Ownership › Moves in loops](#/ownership/moves-in-loops)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- Build a new `let mut out = Vec::new();`. An outer `for word in words` takes each word; an inner loop adds its copies.
- Inside the inner loop, push `word.clone()`. The loop can't push `word` itself, because the next pass would need it again.
- To save one clone, push clones `times - 1` times and then push `word` itself after the inner loop. Skip the word entirely when `times` is 0.

#### Tips
- Cloning all `times` copies and letting the original drop also passes. It just allocates one extra `String` per word.
- This is the case where `.clone()` is the right answer, not a dodge: you genuinely need `times` separate strings, and only one of them can be the original.
- `times = 0` is the trap in the save-one-clone version. `times - 1` on a `usize` underflows and panics, so handle zero before you subtract.

#### Docs
- [Book: Variables and data interacting with clone](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#variables-and-data-interacting-with-clone)
- [std: `Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html)
