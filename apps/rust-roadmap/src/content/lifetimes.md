# Lifetimes

A lifetime is the stretch of code during which a reference is valid. The compiler tracks one for every borrow and infers almost all of them; you write lifetime annotations only when a function returns a reference or a struct stores one and the compiler can't tell which input it comes from.

## Why they exist

```rust
let r;
{
    let s = String::from("hi");
    r = &s;             // error[E0597]: `s` does not live long enough
}
println!("{r}");
```

In a garbage-collected language, `r` would keep the string alive. Rust has no garbage collector: `s` is freed at the closing brace, so `r` would point at freed memory. The borrow checker sees that the reference outlives the value and refuses.

Inside one function it can see everything. Across function boundaries it only looks at signatures, and that's where lifetimes come in.

## When a signature needs help

```rust
fn longest(a: &str, b: &str) -> &str {      // error[E0106]: missing lifetime specifier
    if a.len() >= b.len() { a } else { b }
}
```

The result borrows from `a` or `b`, and a caller can't know which. So it can't know how long the result stays valid. You say it in the signature:

```rust
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() { a } else { b }
}
```

Read it as: "for some lifetime `'a` during which both inputs are valid, the result is valid too." `'a` is a generic parameter, like `T`, and the compiler picks the overlap at each call site. Annotations never change how long anything lives. They describe relationships, and the compiler checks every caller against them:

```rust
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() { a } else { b }
}

let a = String::from("a long string");
let result;
{
    let b = String::from("xyz");
    result = longest(&a, &b);   // error[E0597]: `b` does not live long enough
}
println!("{result}");
```

At runtime `result` would be `a`, which is still alive. The compiler doesn't run your code. The signature says the result may borrow from `b`, and `b` is gone by the `println!`.

## Tie only what's related

If the result comes from only one input, say so, and the other input is free to be short-lived:

```rust
fn after<'a>(text: &'a str, marker: &str) -> Option<&'a str> {
    let i = text.find(marker)?;
    Some(&text[i + marker.len()..])
}

let text = String::from("key=value");
let value = after(&text, &String::from("="));   // the marker String is dropped right away
println!("{value:?}");                           // Some("value")
```

## Elision: when you can leave them out

Most functions with references need no annotations, because the compiler applies three rules:

1. Each reference parameter gets its own lifetime.
2. If there's exactly one input lifetime, every output reference gets it.
3. If one of the parameters is `&self` or `&mut self`, every output reference gets its lifetime.

`fn first_word(s: &str) -> &str` is covered by rule 2. `longest` has two inputs and no `self`, so none of the rules apply and you have to annotate. The `'_` placeholder says "a lifetime goes here, the usual rules apply": `fn words(text: &str) -> Words<'_>`.

## Structs that hold references

A struct that stores a reference needs a lifetime parameter, and can't outlive what it borrows:

```rust
struct Excerpt<'a> {
    text: &'a str,
}

impl<'a> Excerpt<'a> {
    fn first_word(&self) -> &'a str {
        self.text.split_whitespace().next().unwrap_or("")
    }
}

let novel = String::from("Call me Ishmael. Some years ago...");
let word;
{
    let e = Excerpt { text: &novel };
    word = e.first_word();      // borrows from novel, not from e
}
println!("{word}");
```

Notice the return type `&'a str`. With plain `&str`, rule 3 would tie the result to `&self`, the short borrow of the `Excerpt`, and `word` couldn't outlive `e`. Writing `'a` says the word points into the original text.

Borrowing structs are good for short-lived views: parsers, tokenizers, iterators over someone else's data. For data that sticks around, own it with `String` and `Vec`. If you're fighting lifetimes on a struct, owning the data is usually the fix.

## `'static`

`&'static str` is a reference valid for the whole program; string literals are baked into the binary, so they qualify. A `T: 'static` bound is different: it means `T` holds no borrowed references that could expire, so owned types like `String` satisfy it. `thread::spawn` requires it, which you'll meet in the threads module. Don't add `'static` to make an error go away; the fix is almost always to own the data.

## Common errors

```rust
fn greeting(name: &str) -> &str {
    let s = format!("hello {name}");
    &s                  // error[E0515]: cannot return reference to local variable `s`
}
```

`s` is dropped when the function returns. No annotation can fix this, because it's a real dangling pointer. Return the `String` itself.

```rust
let s: &str = String::from("temp").as_str();    // error[E0716]: temporary value dropped while borrowed
println!("{s}");
```

The `String` is a temporary that dies at the end of the statement. Bind it to a variable first.

```rust playground
struct Tokens<'a> {
    rest: &'a str,
}

impl<'a> Iterator for Tokens<'a> {
    type Item = &'a str;

    fn next(&mut self) -> Option<&'a str> {
        let s = self.rest.trim_start();
        if s.is_empty() {
            return None;
        }
        let end = s.find(|c: char| c.is_whitespace()).unwrap_or(s.len());
        let (token, rest) = s.split_at(end);
        self.rest = rest;
        Some(token)
    }
}

fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() { a } else { b }
}

fn main() {
    let source = String::from("let answer = forty + two");
    let tokens: Vec<&str> = Tokens { rest: &source }.collect();
    println!("{tokens:?}");

    let mut best = "";
    for t in &tokens {
        best = longest(best, t);
    }
    println!("longest token: {best}");
}

// Try: move `let source = ...` into a block that ends before the println!s and read the error.
```

## Slicing `&str`

The exercises below return pieces of their input. These are the `&str` tools they need. Each one returns a slice of the same text, never a copy, so the result borrows from the original:

```rust
let t = "Call me Ishmael. Some years ago";
t.len();                        // 31: the length in bytes
t.find('.');                    // Some(15): byte index of the first '.', or None
&t[..16];                       // "Call me Ishmael.": bytes 0 up to, not including, 16
&t[17..];                       // "Some years ago": byte 17 to the end
t.split_at(4);                  // ("Call", " me Ishmael. Some years ago")
t.find(char::is_whitespace);    // Some(4): find also accepts a test for each char
t.split_whitespace().next();    // Some("Call"): the first word, or None
"  hi".trim_start();            // "hi": leading whitespace skipped
"".is_empty();                  // true
```

Indexes are byte offsets. The ones `find` returns always land on a character boundary, so slicing with them is safe; a made-up index can cut a multi-byte character in half, and that panics.

`find` and `next` return an `Option`. `match` it to supply a fallback, or use `unwrap_or`, which does the same in one call: `t.find('.').unwrap_or(t.len())` is the index of the first `.`, or the length if there is none.

A `&String` converts to `&str` automatically wherever a `&str` is expected, so a function returning `&str` can hand back a reference to a `String` it borrowed.

## Exercises

### 1. Longest

Fill in `longest`: return whichever string is longer, and `a` on a tie. The signature already says the result borrows from both inputs.

```rust starter
pub fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    todo!()
}
```

```rust test
/// returns the longer string
#[test]
fn longer() {
    assert_eq!(longest("hello", "hi"), "hello");
    assert_eq!(longest("a", "abc"), "abc");
    assert_eq!(longest("abcd", "abc"), "abcd");
}

/// an empty string loses to any other
#[test]
fn empty() {
    assert_eq!(longest("", "x"), "x");
    assert_eq!(longest("x", ""), "x");
}

/// ties go to the first
#[test]
fn ties() {
    let a = String::from("one");
    let b = String::from("two");
    assert!(std::ptr::eq(longest(&a, &b), a.as_str()));
    let c = String::from("hello");
    let d = String::from("world");
    assert!(std::ptr::eq(longest(&d, &c), d.as_str()));
}
```

#### Uses
- [Lifetimes › When a signature needs help](#/lifetimes/when-a-signature-needs-help)
- [Control flow › `if` is an expression](#/control-flow/if-is-an-expression)

#### Hints
- Compare `a.len()` with `b.len()`. Counting bytes is fine here.
- Use `>=` so a tie picks `a`. The whole body is one `if` expression.

#### Tips
- The tie test uses `std::ptr::eq` to check you returned `a` itself, not just equal text. A reference is a pointer, and which one you hand back matters.
- `'a` doesn't make anything live longer. It says the result is valid only as long as *both* inputs are, and the compiler then checks every call site against that promise.
- Both inputs share one `'a` here because the result can come from either. When it can only come from one, tie only that one and the other is free to be short-lived, as the next exercise shows.

#### Docs
- [Rust book: Lifetime annotations in function signatures](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#lifetime-annotations-in-function-signatures)

### 2. Borrow from one input only

`value_for(pairs, key)` returns the value paired with `key`, borrowed from `pairs`. The signature ties the result to `pairs` only, so the key can be a temporary that's gone before the result is used, which the second test relies on.

```rust starter
pub fn value_for<'a>(pairs: &'a [(String, String)], key: &str) -> Option<&'a str> {
    todo!()
}
```

```rust test
fn config() -> Vec<(String, String)> {
    vec![("host".to_string(), "example.com".to_string()), ("port".to_string(), "443".to_string())]
}

/// finds values
#[test]
fn finds() {
    let pairs = config();
    assert_eq!(value_for(&pairs, "port"), Some("443"));
    assert_eq!(value_for(&pairs, "host"), Some("example.com"));
    assert_eq!(value_for(&pairs, "user"), None);
    assert_eq!(value_for(&[], "port"), None);
}

/// only a whole key matches, never part of one or a value
#[test]
fn whole_keys_only() {
    let pairs = config();
    assert_eq!(value_for(&pairs, "hos"), None);
    assert_eq!(value_for(&pairs, "443"), None);
    assert_eq!(value_for(&pairs, ""), None);
}

/// the result outlives a temporary key
#[test]
fn outlives_key() {
    let pairs = config();
    let host;
    {
        let key = String::from("host");
        host = value_for(&pairs, &key);
    }
    assert_eq!(host, Some("example.com"));
}
```

#### Uses
- [Lifetimes › Tie only what's related](#/lifetimes/tie-only-whats-related)
- [Lifetimes › Slicing `&str`](#/lifetimes/slicing-str)
- [Variables & types › Tuples and arrays](#/basics/tuples-and-arrays)

#### Hints
- Loop over `pairs`. Each item is a `&(String, String)`, and `pair.0` and `pair.1` reach its fields.
- `pair.0 == key` compares a `String` with a `&str` just fine. On a match, return `Some` of a reference to `pair.1`; it converts to the `&str` the signature asks for.
- If the loop finishes without a match, the answer is `None`.

#### Tips
- Only `pairs` carries `'a`, so elision gives `key` its own unrelated lifetime. Tie both to `'a` and the third test stops compiling, because the temporary key would have to live as long as the answer.
- A lifetime annotation is documentation the compiler checks. `value_for<'a>(pairs: &'a [...], key: &str)` tells a reader, before they open the body, that the result points into `pairs` and never into `key`.
- `&String` converts to `&str` automatically wherever one is expected, so `Some(&pair.1)` fits the `Option<&'a str>` return type with nothing extra.

#### Docs
- [Rust book: Thinking in terms of lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#thinking-in-terms-of-lifetimes)

### 3. A struct that borrows

`Excerpt::new(text)` keeps the first sentence of `text`: everything up to and including the first `.`, or all of `text` if there's no period. `text()` returns it and `first_word()` returns its first whitespace-separated word (`""` if there is none). Both return `&'a str`, borrowed from the original text rather than from the `Excerpt`, so the results outlive the struct.

```rust starter
pub struct Excerpt<'a> {
    text: &'a str,
}

impl<'a> Excerpt<'a> {
    pub fn new(text: &'a str) -> Excerpt<'a> {
        todo!()
    }

    pub fn text(&self) -> &'a str {
        todo!()
    }

    pub fn first_word(&self) -> &'a str {
        todo!()
    }
}
```

```rust test
/// keeps the first sentence
#[test]
fn first_sentence() {
    let novel = String::from("Call me Ishmael. Some years ago, never mind how long.");
    assert_eq!(Excerpt::new(&novel).text(), "Call me Ishmael.");
    assert_eq!(Excerpt::new("no period here").text(), "no period here");
    assert_eq!(Excerpt::new("a.b.c").text(), "a.");
    assert_eq!(Excerpt::new(". after").text(), ".");
    assert_eq!(Excerpt::new("").text(), "");
}

/// first word, or empty
#[test]
fn first_word() {
    assert_eq!(Excerpt::new("  Hello world.").first_word(), "Hello");
    assert_eq!(Excerpt::new("Wow. Such words").first_word(), "Wow.");
    assert_eq!(Excerpt::new("").first_word(), "");
    assert_eq!(Excerpt::new(" \t ").first_word(), "");
}

/// results outlive the excerpt
#[test]
fn outlives_struct() {
    let novel = String::from("It was a dark and stormy night.");
    let (word, text);
    {
        let e = Excerpt::new(&novel);
        word = e.first_word();
        text = e.text();
    }
    assert_eq!(word, "It");
    assert_eq!(text, "It was a dark and stormy night.");
}
```

#### Uses
- [Lifetimes › Structs that hold references](#/lifetimes/structs-that-hold-references)
- [Lifetimes › Slicing `&str`](#/lifetimes/slicing-str)
- [Enums & match › `match`](#/enums/match)

#### Hints
- In `new`, look for the first `.` with `text.find('.')`. On `Some(i)` the sentence ends at byte `i + 1` (a `.` is one byte); on `None` it's all of `text`.
- `text()` just returns the field. A `&'a str` is `Copy`, so there's nothing to clone.
- `first_word()` takes the first item of `split_whitespace()`, falling back to `""` when there is none.

#### Tips
- The return types say `&'a str`, not `&str`. With plain `&str`, elision ties the results to `&self`, and the last test fails to compile.
- The `Excerpt` stores no text of its own. It's a pointer and a length into somebody else's `String`, which is what makes it free to create and impossible to outlive its source.
- `find('.')` gives a byte index, and `.` is one byte, so `i + 1` is a safe place to cut. That reasoning is worth checking every time: with a multi-byte marker you'd need `i + marker.len()`.
- If a struct full of `&'a` starts to hurt, own the data instead. A `String` field costs one allocation and removes every annotation; borrowing structs earn their keep in parsers and iterators, not everywhere.

#### Docs
- [Rust book: Lifetime annotations in struct definitions](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#lifetime-annotations-in-struct-definitions)
- [std: str::find](https://doc.rust-lang.org/std/primitive.str.html#method.find)

### 4. A borrowing iterator

`words(text)` returns an iterator over the whitespace-separated words of `text`, each a slice of the original. Implement it by hand: keep the unread part in `rest`, and in `next` skip leading whitespace, slice off one word and advance `rest`. (`split_whitespace` would do it for you; the point is to see how `Item = &'a str` makes words outlive the iterator.)

`Iterator` is a standard trait with an associated type `Item` and one required method: each call to `next` returns `Some(item)`, or `None` once there's nothing left. Implement `next` and you get `collect`, `count` and the rest, which the tests use.

```rust starter
pub struct Words<'a> {
    rest: &'a str,
}

pub fn words(text: &str) -> Words<'_> {
    Words { rest: text }
}

impl<'a> Iterator for Words<'a> {
    type Item = &'a str;

    fn next(&mut self) -> Option<&'a str> {
        todo!()
    }
}
```

```rust test
/// splits on any whitespace
#[test]
fn splits() {
    let text = String::from("  the quick  brown\tfox\n");
    let found: Vec<&str> = words(&text).collect();
    assert_eq!(found, vec!["the", "quick", "brown", "fox"]);
}

/// keeps the last word even with nothing after it
#[test]
fn last_word() {
    assert_eq!(words("solo").collect::<Vec<_>>(), vec!["solo"]);
    assert_eq!(words("x\n\ny").collect::<Vec<_>>(), vec!["x", "y"]);
    assert_eq!(words("a b c d e").count(), 5);
}

/// no words in blank text
#[test]
fn blank() {
    assert_eq!(words("").next(), None);
    assert_eq!(words(" \t ").count(), 0);
}

/// words outlive the iterator
#[test]
fn outlives_iterator() {
    let text = String::from("borrowed not copied");
    let first;
    {
        let mut it = words(&text);
        first = it.next();
    }
    assert_eq!(first, Some("borrowed"));
    assert!(std::ptr::eq(first.unwrap().as_ptr(), text.as_ptr()));
}
```

#### Uses
- [Lifetimes › Slicing `&str`](#/lifetimes/slicing-str)
- [Lifetimes › Structs that hold references](#/lifetimes/structs-that-hold-references)
- [Generics & bounds › Associated types](#/generics/associated-types)
- [Reference › Vec and slices](#/reference/vec-and-slices)

#### Hints
- Start with `let s = self.rest.trim_start();`. If `s` is empty, there are no words left: store it back in `self.rest` and return `None`.
- The word ends at the first whitespace character, `s.find(char::is_whitespace)`, or at `s.len()` if there isn't one.
- `s.split_at(end)` gives the word and the rest in one go. Keep the rest in `self.rest` and return `Some(word)`.

#### Tips
- `trim_start` and `split_at` return slices of the same text, so every word still points into the original `String` with lifetime `'a`, which is what the last test checks: the first word's address is the string's own address.
- `type Item = &'a str` is why the words outlive the iterator. Tie `Item` to `&self` instead and `it.next()` couldn't escape the block it was called in.
- Store the trimmed remainder back into `self.rest` even when you return `None`, or a later `next` call walks the same whitespace again. Ending cleanly is part of the contract.
- `words(text: &str) -> Words<'_>` uses the `'_` placeholder: there's one input lifetime, so elision knows which one it is, and `'_` just marks the spot rather than hiding it.

#### Docs
- [std: str::split_at](https://doc.rust-lang.org/std/primitive.str.html#method.split_at)
- [std: Iterator::next](https://doc.rust-lang.org/std/iter/trait.Iterator.html#tymethod.next)
