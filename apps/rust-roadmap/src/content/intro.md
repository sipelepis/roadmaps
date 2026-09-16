# What is Rust?

Rust is a compiled language that gives you C-level control over memory without a garbage collector, and moves whole classes of bugs from runtime to compile time. You pay for that with a stricter compiler, so this module starts with the tools and with how to read what the compiler tells you.

## What it's for

Rust compiles ahead of time to a native binary. There is no virtual machine, no interpreter and no garbage collector. Memory is freed at a point the compiler works out for you, when the value's owner goes out of scope. The Ownership module explains how.

That makes Rust a fit wherever Go, C++ or C would be: command-line tools, network services, databases, game engines, WebAssembly, embedded devices, and native extensions for Python or Node. Coming from TypeScript or Python, the big differences are:

- Every value has one static type, checked before the program runs. Most of the time the compiler infers it.
- There is no `null` and no exceptions. Absence and failure are ordinary values you have to handle.
- Mutation and sharing are tracked. You can't accidentally mutate something another part of the program is reading.

## Cargo

Cargo is the build tool, package manager and test runner in one. You rarely call the compiler (`rustc`) yourself.

```sh
cargo new hello        # creates hello/Cargo.toml and hello/src/main.rs
cd hello
cargo run              # compile in debug mode and run
cargo check            # type-check only, much faster than a full build
cargo test             # compile and run the tests
cargo build --release  # optimized binary in target/release/
cargo fmt              # format the code
cargo clippy           # lint for common mistakes
```

`Cargo.toml` is the manifest, the equivalent of `package.json` or `pyproject.toml`:

```toml
[package]
name = "hello"
version = "0.1.0"
edition = "2024"

[dependencies]
```

The `edition` pins which version of the language syntax the crate uses. Crates on different editions still work together.

## `fn main` and macros

```rust
fn main() {
    let name = "Ferris";
    println!("Hello, {name}!");
}
```

A binary starts at `fn main`. Statements end with `;`, blocks use braces, and names are `snake_case`.

`println!` has a `!` because it is a macro, not a function. Macros expand into code at compile time, which is how `println!` accepts any number of arguments and checks the format string against them before the program runs:

```rust
let x = 3;
println!("{} and {}", x);
// error: 2 positional arguments in format string, but there is 1 argument
```

The formatting mini-language is shared by `println!`, `print!` (no newline), `eprintln!` (to stderr) and `format!` (returns a `String` instead of printing):

```rust
let item = "tea";
let price = 3.5;
println!("{item}: {price}");           // tea: 3.5    (names captured from scope)
println!("{} costs {:.2}", item, price); // tea costs 3.50
println!("[{:>6}] [{:<6}]", item, item); // [   tea] [tea   ]
println!("{:?}", (1, "two"));           // (1, "two")  {:?} is the debug format
let label = format!("{item}!");         // a String, nothing printed
```

`{}` uses a type's user-facing *Display* format, `{:?}` its developer-facing *Debug* format. Not every type has a Display format, but almost all have a Debug one.

## Reading compiler errors

You will see a lot of errors from `rustc`. They are the most useful documentation you'll get, and they are written to be read top to bottom:

```rust
fn main() {
    let count: i32 = "5";
    // error[E0308]: mismatched types
}
```

```text
error[E0308]: mismatched types
 --> src/main.rs:2:22
  |
2 |     let count: i32 = "5";
  |                ---   ^^^ expected `i32`, found `&str`
  |                |
  |                expected due to this
```

Read it in this order:

1. The first line says what went wrong, with a code like `E0308`. `rustc --explain E0308` prints a long explanation with examples.
2. The arrow gives the file, line and column.
3. The labels under the code point at the exact tokens involved, and often at the line that *caused* the expectation.
4. Lines starting with `help:` often contain the fix, sometimes as a ready-made diff.

Fix the first error first. Later errors are often a consequence of it.

## How the exercises work

Each exercise gives you a function signature and a set of tests. Your code is compiled as a library (no `fn main`), and the tests call your functions:

```rust
pub fn double(x: i32) -> i32 {
    x * 2
}
```

`pub` makes the function visible to the tests. The types after the parameter names and after `->` are required. The last expression in the body, written without a semicolon, is the return value. The Functions module goes into detail.

Starters use `todo!()` as a placeholder body. It compiles, then panics when called, so the tests fail until you replace it. You'll also see two string types: `&str` for text you only read, such as a literal like `"hi"`, and `String` for text you own and can grow. `format!` returns a `String`, and `.to_string()` turns almost anything into one: `"Fizz".to_string()`, `7.to_string()`. The Strings module explains the difference.

The tests themselves are ordinary Rust, and they look like this:

```rust
pub fn double(x: i32) -> i32 {
    x * 2
}

#[cfg(test)]
mod tests {
    use super::*;

    /// doubles a number
    #[test]
    fn doubles() {
        assert_eq!(double(21), 42);
        assert!(double(2) > 0);
    }
}
```

Four things worth knowing before the first exercise:

- `#[test]` marks a function as one test, and the `///` comment above it is the label you see in the results.
- `assert_eq!(a, b)` panics unless the two are equal. Here the left side is your value and the right side is what's expected, so a failure reports them as *actual* and *expected*. `assert!(cond)` is the same for a plain `bool`.
- A panic ends that test at once. The first failing assert is the only one you'll hear about, so fix that one first; later asserts in the same test never ran.
- `println!` inside a test isn't lost. Its output is shown with the failure, which is the quickest way to see what your code actually produced.

Exercises point at the articles that teach what they need, under **Uses**. When one leans on a standard-library method no article has covered yet, that link goes to the [Reference](#/reference) instead: a lookup page of the macros and methods used here, each with a one-line description, a tiny example and a link to the official docs.

```rust playground
fn main() {
    let language = "Rust";
    let year = 2015;
    let ferris = '🦀';

    println!("Hello from {language} {ferris}");
    println!("Version 1.0 shipped in {}.", year);
    println!("{:>10}|{:<10}|", "right", "left");
    println!("{:.3}", 2.0_f64.sqrt());
    println!("{:?}", ("a tuple", 42, true));

    let summary = format!("{language} is {} years old", 2026 - year);
    println!("{summary}");

    // Try: replace the `{}` in the second println! with `{year}`, then delete `year` from the arguments.
}
```

## Exercises

### 1. Hello, name

Return a greeting like `"Hello, Ada!"` for the given name. `format!` builds a `String` using the same syntax as `println!`.

```rust starter
pub fn greet(name: &str) -> String {
    todo!()
}
```

```rust test
/// greets by name
#[test]
fn greets_by_name() {
    assert_eq!(greet("Ada"), "Hello, Ada!");
    assert_eq!(greet("Ferris"), "Hello, Ferris!");
}

/// keeps the name exactly as given
#[test]
fn keeps_the_name() {
    assert_eq!(greet("grace hopper"), "Hello, grace hopper!");
    assert_eq!(greet("R2-D2"), "Hello, R2-D2!");
}

/// works for any name
#[test]
fn works_for_any_name() {
    assert_eq!(greet("Zoë"), "Hello, Zoë!");
    assert_eq!(greet("Linus"), "Hello, Linus!");
}
```

#### Uses
- [What is Rust? › `fn main` and macros](#/intro/fn-main-and-macros)
- [What is Rust? › How the exercises work](#/intro/how-the-exercises-work)
- [Reference › How the tests work](#/reference/how-the-tests-work)
- [Reference › Macros](#/reference/macros)

#### Hints
- You don't print anything here. You build a `String` and return it, and `format!` does exactly that.
- Put `name` straight into the format string with `{name}`, then make that `format!(...)` call the last line of the body, with no semicolon.

#### Tips
- Delete the `todo!()` when you write the body. Leaving it in front of your code panics before your code runs.
- `println!` prints and gives back nothing; `format!` prints nothing and gives back a `String`. Ending the body with a `println!` is the most common way to fail this exercise.
- `{name}` only captures a plain variable that's in scope. Anything else, like `{name.len()}`, has to go in as an argument: `format!("{}", name.len())`.

#### Docs
- [std: `format!`](https://doc.rust-lang.org/std/macro.format.html)
- [Rust by Example: Formatted print](https://doc.rust-lang.org/rust-by-example/hello/print.html)

### 2. Receipt line

Format one line of a receipt: the item name left-aligned in a column 10 characters wide, followed by the price right-aligned in a column 8 characters wide. The price is given in cents and shown as dollars with two decimals, like `$3.50`.

`cents / 100` gives the whole dollars and `cents % 100` the leftover cents, both as integers. `{:02}` pads a number with zeros to two digits. You can build the price with one `format!` and then pad that `String` with another.

```rust starter
pub fn receipt_line(item: &str, cents: u32) -> String {
    todo!()
}
```

```rust test
/// pads the item and right-aligns the price
#[test]
fn pads_columns() {
    assert_eq!(receipt_line("Coffee", 350), "Coffee       $3.50");
    assert_eq!(receipt_line("Toothpaste", 99), "Toothpaste   $0.99");
}

/// shows leading zeros in the cents
#[test]
fn zero_pads_cents() {
    assert_eq!(receipt_line("Gum", 105), "Gum          $1.05");
    assert_eq!(receipt_line("Mint", 7), "Mint         $0.07");
    assert_eq!(receipt_line("Tea", 500), "Tea          $5.00");
    assert_eq!(receipt_line("Free", 0), "Free         $0.00");
}

/// handles wide prices
#[test]
fn wide_price() {
    assert_eq!(receipt_line("Laptop", 129999), "Laptop    $1299.99");
    assert_eq!(receipt_line("TV", 99999), "TV         $999.99");
}

/// counts characters, not bytes
#[test]
fn counts_characters() {
    assert_eq!(receipt_line("Crème", 250), "Crème        $2.50");
    assert_eq!(receipt_line("Café", 1250), "Café        $12.50");
}
```

#### Uses
- [What is Rust? › `fn main` and macros](#/intro/fn-main-and-macros)
- [What is Rust? › How the exercises work](#/intro/how-the-exercises-work)
- [Reference › Macros](#/reference/macros)

#### Hints
- Do it in two steps: first build the price text like `$3.50`, then lay out the item and that price in their columns.
- The price is `format!("${}.{:02}", ...)` with the dollars and the leftover cents as the two arguments.
- For the columns, `{:<10}` left-aligns in 10 characters and `{:>8}` right-aligns in 8. They work on a `String` argument too.

#### Tips
- Money is usually kept in whole cents, as here. Floats can't store most decimal fractions exactly: `0.1 + 0.2` is not `0.3`.
- Width in a format string counts characters, not bytes, which is why `"Crème"` lines up with `"Coffee"` even though it takes six bytes. The last test checks exactly that.
- Padding never truncates. `{:<10}` on a name longer than ten characters prints all of it and pushes the rest of the line along, which is why `"Toothpaste"` still works.

#### Docs
- [std::fmt: Width](https://doc.rust-lang.org/std/fmt/index.html#width)
- [std::fmt: Fill / Alignment](https://doc.rust-lang.org/std/fmt/index.html#fillalignment)
