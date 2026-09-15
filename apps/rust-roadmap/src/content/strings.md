# Strings & slices

Rust has two main string types: `String`, an owned and growable UTF-8 buffer, and `&str`, a borrowed view into UTF-8 text owned by something else. Slices generalize the idea: `&[T]` is a borrowed view into part of an array or a `Vec`.

## `String` and `&str`

```rust
let literal: &str = "hello";              // baked into the binary, borrowed
let owned: String = String::from("hello"); // on the heap, ours
let also_owned = "hello".to_string();
let view: &str = &owned;                   // borrow a String as a &str
```

A `String` is a `Vec` of bytes that is guaranteed to be valid UTF-8: it owns its buffer and can grow. A `&str` is a pointer and a length into some UTF-8 bytes it doesn't own, whether that's a literal, a `String`, or part of one.

The rule of thumb for function parameters: take `&str` when you only read the text. A `&String` converts to `&str` automatically, so a `&str` parameter accepts both:

```rust
fn shout(s: &str) -> String {
    s.to_uppercase()
}

let owned = String::from("hi");
shout("literal");
shout(&owned);
```

Return a `String` when you create new text. Store `String` in structs, so the struct owns its data.

## Building strings

```rust
let mut s = String::new();
s.push_str("hello");
s.push(' ');
s += "world";

let a = String::from("tic");
let b = String::from("tac");
let joined = a + "-" + &b;               // `a` is moved into the result
let formatted = format!("{b}-{b}-toe");  // borrows only
```

`+` takes ownership of the left side and appends to its buffer, which is why `a` can't be used afterwards. `format!` is usually clearer.

## UTF-8 and why you can't index

`len()` counts bytes, not characters:

```rust
let word = "héllo";
println!("{}", word.len());           // 6: é takes two bytes
println!("{}", word.chars().count()); // 5
```

And you can't index a string by position:

```rust
let word = "héllo";
let c = word[1];
// error[E0277]: the type `str` cannot be indexed by `{integer}`
```

JavaScript and Python let you write `s[1]`, but "the character at position 1" is ambiguous. Is it byte 1, the second Unicode code point, or the second visible character (`"é"` can be one code point or two)? Each answer has a different cost. Rust makes you say which you mean:

```rust
let word = "héllo";
for c in word.chars() {}            // Unicode scalar values: 'h', 'é', 'l', 'l', 'o'
for b in word.bytes() {}            // raw u8 bytes: 104, 195, 169, ...
for (i, c) in word.char_indices() {} // each char with its byte offset
let second = word.chars().nth(1);   // Some('é'), walks from the start
```

`char` has the usual classification methods: `is_alphabetic()`, `is_ascii_digit()`, `is_whitespace()`, `to_ascii_uppercase()`, `to_digit(10)`.

## Slicing by byte range

`&s[start..end]` takes a `&str` of the bytes in that range, without copying:

```rust
let s = "hello world";
let hello = &s[0..5];
let world = &s[6..];
```

The range is in bytes, and both ends must fall on a character boundary. Cutting through the middle of a multi-byte character panics:

```rust
let s = "héllo";
let broken = &s[0..2]; // panics: byte index 2 is not a char boundary
```

Use offsets you got from the string itself, from `find`, `char_indices` or `len`, and slicing is safe.

## Slices of arrays and Vecs

The same idea works for any sequence. `&[T]` is a borrowed view of some elements, written with the same range syntax:

```rust
let v = vec![10, 20, 30, 40];
let middle: &[i32] = &v[1..3];  // [20, 30]
let all: &[i32] = &v;           // a &Vec<i32> converts to &[i32]
let arr = [1, 2, 3];
let part = &arr[..2];           // arrays slice too
```

Just as with `&str` over `&String`, prefer `&[T]` parameters over `&Vec<T>`: they accept Vecs, arrays and sub-slices. `&mut [T]` lets a function change elements in place, though not add or remove any:

```rust
fn zero_out(values: &mut [i32]) {
    for v in values {
        *v = 0;
    }
}

let mut v = vec![1, 2, 3, 4];
zero_out(&mut v[2..]);
println!("{v:?}"); // [1, 2, 0, 0]
```

Slices have `len()`, `is_empty()`, `contains(&x)`, `iter()`, `sort()` (on `&mut`), `split_at(i)`, and `first()` and `last()`, which return an `Option` because the slice might be empty. The Option & Result module covers those.

## Everyday string methods

```rust
let line = "  name: Ada Lovelace  ";
line.trim();                         // "name: Ada Lovelace"
line.contains("Ada");                // true
line.trim().starts_with("name");     // true
line.replace("Ada", "Augusta");      // a new String
line.to_lowercase();                 // a new String
"a,b,,c".split(',');                 // "a", "b", "", "c"
"one two  three".split_whitespace(); // "one", "two", "three"
"x\ny".lines();                      // "x", "y"
"ab".repeat(3);                      // "ababab"
```

Methods that return a piece of the original, like `trim` and `split`, return `&str` slices borrowing from it; methods that build new text return a `String`. `split` and friends return iterators, which a `for` loop consumes directly.

```rust playground
fn first_word(s: &str) -> &str {
    for (i, c) in s.char_indices() {
        if c == ' ' {
            return &s[..i];
        }
    }
    s
}

fn main() {
    let owned = String::from("Grüße aus Köln");
    println!("{} bytes, {} chars", owned.len(), owned.chars().count());
    println!("first word: {}", first_word(&owned));
    println!("first word of a literal: {}", first_word("hello there"));

    for word in owned.split_whitespace() {
        let upper = word.to_uppercase();
        println!("{word:>6} -> {upper}");
    }

    let numbers = [4, 8, 15, 16, 23, 42];
    let tail = &numbers[3..];
    println!("tail {tail:?} has {} items", tail.len());

    // Try: print `&owned[0..3]` and read the panic message.
}
```

## Exercises

### 1. Count vowels

Count the vowels `a e i o u`, in either case. Accented letters don't count. `"aeiouAEIOU".contains(c)` checks whether a `char` is one of them.

```rust starter
pub fn count_vowels(s: &str) -> usize {
    todo!()
}
```

```rust test
/// counts vowels in either case
#[test]
fn counts() {
    assert_eq!(count_vowels("Hello World"), 3);
    assert_eq!(count_vowels("AEIOU aeiou"), 10);
}

/// ignores accented letters
#[test]
fn accented() {
    assert_eq!(count_vowels("héllo wörld"), 1);
}

/// empty string has none
#[test]
fn empty() {
    assert_eq!(count_vowels(""), 0);
}
```

#### Uses
- [Strings & slices › UTF-8 and why you can't index](#/strings/utf-8-and-why-you-cant-index)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- Walk the characters with `for c in s.chars()` and keep a `let mut` counter.
- For each `c`, add one when `"aeiouAEIOU".contains(c)` is true.

#### Tips
- `é` and `ö` are `char`s of their own, not `e` or `o` with an accent added, so they never match. In `"héllo wörld"` only the `o` of `héllo` counts.

#### Docs
- [Book: Methods for iterating over strings](https://doc.rust-lang.org/book/ch08-02-strings.html#methods-for-iterating-over-strings)
- [std: `str::contains`](https://doc.rust-lang.org/std/primitive.str.html#method.contains)

### 2. The middle of a slice

Return the slice without its first and last elements. Slices shorter than 2 give an empty slice. Return a view into the input, not a new Vec: `&values[a..b]`.

```rust starter
pub fn middle(values: &[i32]) -> &[i32] {
    values
}
```

```rust test
/// drops both ends
#[test]
fn drops_ends() {
    assert_eq!(middle(&[1, 2, 3, 4]), [2, 3]);
}

/// works on a Vec
#[test]
fn vec() {
    let v = vec![5, 6, 7];
    assert_eq!(middle(&v), [6]);
}

/// short slices give an empty slice
#[test]
fn short() {
    assert_eq!(middle(&[1, 2]).len(), 0);
    assert_eq!(middle(&[1]).len(), 0);
    assert_eq!(middle(&[]).len(), 0);
}
```

#### Uses
- [Strings & slices › Slices of arrays and Vecs](#/strings/slices-of-arrays-and-vecs)
- [Strings & slices › Slicing by byte range](#/strings/slicing-by-byte-range)
- [Functions › Implicit return](#/functions/implicit-return)

#### Hints
- For a slice of length 2 or more, the middle starts at index 1 and stops before index `values.len() - 1`.
- Handle short slices first and `return` early. `&values[0..0]` is an empty slice of the input.
- The early check matters: on an empty slice, `values.len() - 1` would underflow a `usize` and panic.

#### Tips
- `&[]` is an empty slice literal, and works as the early return too.

#### Docs
- [Book: Other slices](https://doc.rust-lang.org/book/ch04-03-slices.html#other-slices)

### 3. Truncate safely

Return the first `max_chars` characters of `s` as a slice of it. If the string is shorter, return all of it. Slicing at a byte offset that isn't a character boundary panics, so find the right byte offset with `char_indices()`.

```rust starter
pub fn truncate(s: &str, max_chars: usize) -> &str {
    &s[..max_chars.min(s.len())]
}
```

```rust test
/// ASCII text
#[test]
fn ascii() {
    assert_eq!(truncate("hello", 3), "hel");
}

/// multi-byte characters
#[test]
fn multibyte() {
    assert_eq!(truncate("héllo", 2), "hé");
    assert_eq!(truncate("日本語", 1), "日");
}

/// shorter strings come back whole
#[test]
fn short() {
    assert_eq!(truncate("hi", 5), "hi");
    assert_eq!(truncate("日本語", 3), "日本語");
}

/// zero characters is empty
#[test]
fn zero() {
    assert_eq!(truncate("abc", 0), "");
}
```

#### Uses
- [Strings & slices › UTF-8 and why you can't index](#/strings/utf-8-and-why-you-cant-index)
- [Strings & slices › Slicing by byte range](#/strings/slicing-by-byte-range)
- [Functions › Implicit return](#/functions/implicit-return)

#### Hints
- `for (i, _) in s.char_indices()` gives the byte offset where each character starts. Count the characters as you go.
- When you've already seen `max_chars` characters, the current offset `i` is exactly where to cut: `return &s[..i];`.
- If the loop finishes without cutting, the string was short enough, so return `s` itself.

#### Tips
- Offsets from `char_indices` always sit on a character boundary, so slicing at them can't panic. That's the point of the exercise.

#### Docs
- [std: `str::char_indices`](https://doc.rust-lang.org/std/primitive.str.html#method.char_indices)
- [Book: Slices](https://doc.rust-lang.org/book/ch04-03-slices.html)

### 4. Capitalize words

Uppercase the first letter of each word, where words are separated by spaces, and keep every space exactly where it was. Other letters stay as they are.

Track whether the previous character was a space. `c.to_uppercase()` returns an iterator of chars, since some letters uppercase to more than one character (`ß` becomes `SS`); loop over it and push each one.

```rust starter
pub fn capitalize_words(s: &str) -> String {
    s.to_string()
}
```

```rust test
/// capitalizes each word
#[test]
fn capitalizes() {
    assert_eq!(capitalize_words("hello wide world"), "Hello Wide World");
}

/// keeps spacing
#[test]
fn spacing() {
    assert_eq!(capitalize_words("  two  spaces "), "  Two  Spaces ");
}

/// leaves other letters alone
#[test]
fn rest_untouched() {
    assert_eq!(capitalize_words("mcDonald iPhone"), "McDonald IPhone");
}

/// handles non-ASCII letters
#[test]
fn unicode() {
    assert_eq!(capitalize_words("élan ßtraße"), "Élan SStraße");
}
```

#### Uses
- [Strings & slices › Building strings](#/strings/building-strings)
- [Strings & slices › UTF-8 and why you can't index](#/strings/utf-8-and-why-you-cant-index)
- [Variables & types › `let` and `mut`](#/basics/let-and-mut)

#### Hints
- Build the result in `let mut out = String::new();` and walk the input with `s.chars()`.
- Keep a `let mut` flag for "the previous character was a space". Start it as `true`, so the very first letter counts as a word start.
- For each `c`: if the flag is set, push every char of `c.to_uppercase()`, otherwise push `c`. Then set the flag to `c == ' '`.

#### Tips
- `c.to_ascii_uppercase()` returns a plain `char`, but it leaves `é` and `ß` alone, so the last test fails with it.

#### Docs
- [std: `char::to_uppercase`](https://doc.rust-lang.org/std/primitive.char.html#method.to_uppercase)
- [Book: Methods for iterating over strings](https://doc.rust-lang.org/book/ch08-02-strings.html#methods-for-iterating-over-strings)
