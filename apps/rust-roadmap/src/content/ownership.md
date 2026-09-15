# Ownership

Every value in Rust has exactly one owner, and the value is freed when its owner goes out of scope. Assigning or passing a value that owns heap memory *moves* it, which is how Rust manages memory with neither a garbage collector nor manual `free`.

## Stack and heap

Values whose size is known at compile time, such as an `i32`, a `bool` or a `[u8; 4]`, live directly on the stack, inside the function's frame. Values that can grow, such as a `String` or a `Vec`, keep a small fixed-size header on the stack (a pointer, a length and a capacity) and their contents in a buffer on the heap.

```rust
let n = 5;                      // 4 bytes on the stack
let s = String::from("hello");  // header on the stack, "hello" on the heap
let v = vec![1, 2, 3];          // same idea: a Vec is a growable array
```

`vec![...]` creates a `Vec`, a growable list. `v.push(4)` appends and `v.len()` counts. The Vec & HashMap module covers it properly; here it's just a handy heap value.

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
}

/// works on an empty string
#[test]
fn empty() {
    assert_eq!(exclaim(String::new()), "!");
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
}
```

#### Uses
- [Ownership › Moves](#/ownership/moves)
- [Ownership › Ownership and functions](#/ownership/ownership-and-functions)

#### Hints
- Do the reading before the moving: compute the uppercase copy first and store it in its own variable.
- Then build the tuple from `name` and that variable. Nothing reads `name` after it moves.

#### Tips
- Calling a method like `to_uppercase` only reads `name`; it doesn't move it. The move happens when `name` itself is placed in the tuple.

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
}

/// once returns the same words
#[test]
fn once() {
    assert_eq!(repeat_each(strings(&["x", "y"]), 1), strings(&["x", "y"]));
}

/// zero times returns nothing
#[test]
fn zero() {
    assert_eq!(repeat_each(strings(&["x", "y"]), 0), Vec::<String>::new());
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

#### Docs
- [Book: Variables and data interacting with clone](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#variables-and-data-interacting-with-clone)
- [std: `Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html)
