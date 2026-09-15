# Functions

A Rust function signature spells out every parameter type and the return type, and the body is an expression whose last value is returned. This module covers signatures, the difference between statements and expressions, implicit return, and the unit type `()`.

## Signatures

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    println!("{}", add(2, 3));
}
```

Parameter types are mandatory, and so is the return type if there is one. The compiler infers types inside a body but never across a function boundary. That's deliberate: the signature is the contract, and a change inside one function can't silently change the types another function sees.

A few things you might expect are missing:

- **No default or keyword arguments.** Write a second function, or pass a struct of options.
- **No overloading.** Each name has exactly one signature.
- **No variadic functions.** Macros like `println!` fill that gap.

Functions can be declared in any order; `main` can call a function defined below it.

## Statements and expressions

A *statement* performs an action and produces no value. `let x = 5;` is a statement, and so is any expression followed by a semicolon. An *expression* evaluates to a value: `5`, `a + b`, a function call, a block, an `if`.

```rust
let x = (let y = 6);
// error: expected expression, found `let` statement
```

That's why `let a = b = 5` doesn't work in Rust either: assignment isn't an expression that yields the assigned value.

## Implicit return

The last expression in a function body is its return value, if it has no semicolon. The `return` keyword exists for leaving early:

```rust
fn abs(x: i32) -> i32 {
    if x < 0 {
        return -x;
    }
    x
}
```

The classic mistake is a stray semicolon, which turns the final expression into a statement:

```rust
fn plus_one(x: i32) -> i32 {
    x + 1;
}
// error[E0308]: mismatched types
```

```text
error[E0308]: mismatched types
 --> src/main.rs:1:24
  |
1 | fn plus_one(x: i32) -> i32 {
  |    --------            ^^^ expected `i32`, found `()`
  |    |
  |    implicitly returns `()` as its body has no tail or `return` expression
2 |     x + 1;
  |          - help: remove this semicolon to return this value
```

The error names the type `()` and the help line tells you exactly which character to delete.

## Branching and recursion

The `abs` example above uses `if`. The Control flow module covers it in full, but the basics are enough for this module. The condition must be a `bool`, it needs no parentheses, and the braces are required. `if` / `else` is an expression too, so it can be a function's last expression, as long as every branch has the same type:

```rust
fn sign(x: i32) -> i32 {
    if x > 0 {
        1
    } else if x < 0 {
        -1
    } else {
        0
    }
}
```

A function can call itself. Each call gets its own parameters, and there must be a case that returns without calling again, or the calls never end:

```rust
fn factorial(n: u64) -> u64 {
    if n == 0 { 1 } else { n * factorial(n - 1) }
}
```

## The unit type

`()` is the type with exactly one value, also written `()`. A function with no `->` returns it, the same way a Python function without `return` returns `None` or a TypeScript function returns `void`:

```rust
fn log(message: &str) {
    println!("[log] {message}");
}

let nothing: () = log("hi");
```

Unlike `None`, you can't forget to check `()`, because there is nothing to check. It just marks "no meaningful value".

## Returning several values

Return a tuple and destructure it at the call site:

```rust
fn min_max(a: i32, b: i32) -> (i32, i32) {
    if a < b { (a, b) } else { (b, a) }
}

let (low, high) = min_max(9, 4);
```

## Parameters are bindings too

Parameters follow the same rules as `let`. They are immutable unless marked `mut`, and marking one `mut` only affects the function's local copy:

```rust
fn countdown(mut n: u32) {
    while n > 0 {
        println!("{n}");
        n -= 1;
    }
}
```

Numbers are copied when passed, so the caller's variable never changes. For bigger values the story is ownership, which is the next module.

## Functions as values

A function's name is a value of a function pointer type, written `fn(i32) -> i32`. You can pass it to other functions:

```rust
fn double(x: i32) -> i32 {
    x * 2
}

fn apply_twice(f: fn(i32) -> i32, x: i32) -> i32 {
    f(f(x))
}

let eight = apply_twice(double, 2);
```

Closures, the Rust version of lambdas and arrow functions, come in the Closures & iterators module.

## Functions that never return

`panic!("message")` crashes the current thread with a message. `todo!()` and `unimplemented!()` are panics with a stock message, which is why exercise starters can use them in a function that promises an `i32`: their type is `!`, "never", which fits anywhere.

```rust playground
/// Documentation comments start with three slashes.
fn celsius_to_fahrenheit(c: f64) -> f64 {
    c * 9.0 / 5.0 + 32.0
}

// `&'static str` is the type of a string literal. The Lifetimes module explains the `'static`.
fn describe(temp_c: f64) -> &'static str {
    if temp_c < 0.0 {
        return "freezing";
    }
    if temp_c < 20.0 { "cool" } else { "warm" }
}

fn stats(a: f64, b: f64, c: f64) -> (f64, f64) {
    let mean = (a + b + c) / 3.0;
    let spread = a.max(b).max(c) - a.min(b).min(c);
    (mean, spread)
}

fn main() {
    for c in [-5.0, 12.0, 30.0] {
        println!("{c}C = {}F, {}", celsius_to_fahrenheit(c), describe(c));
    }

    let (mean, spread) = stats(-5.0, 12.0, 30.0);
    println!("mean {mean:.1}, spread {spread}");

    // Try: add a semicolon after `c * 9.0 / 5.0 + 32.0` and read the error.
}
```

## Exercises

### 1. Leap years

A year is a leap year if it's divisible by 4, except years divisible by 100, which are leap years only if they are also divisible by 400. Write it as a single expression.

```rust starter
pub fn is_leap_year(year: u32) -> bool {
    todo!()
}
```

```rust test
/// ordinary years
#[test]
fn ordinary() {
    assert_eq!(is_leap_year(2023), false);
    assert_eq!(is_leap_year(2024), true);
}

/// centuries are not leap years
#[test]
fn century() {
    assert_eq!(is_leap_year(1900), false);
    assert_eq!(is_leap_year(2100), false);
}

/// every 400 years they are
#[test]
fn four_hundred() {
    assert_eq!(is_leap_year(2000), true);
}
```

#### Uses
- [Variables & types › Operators](#/basics/operators)
- [Functions › Implicit return](#/functions/implicit-return)

#### Hints
- You need three checks: divisible by 4, by 100, and by 400. Each is a `year % n` comparison.
- Rephrase the rule: divisible by 4, *and* either not divisible by 100 *or* divisible by 400.
- Join the checks with `&&` and `||`, and put parentheses around the "either ... or" part. The whole thing is the body, with no semicolon.

#### Tips
- `&&` binds tighter than `||`, so `a && b || c` means `(a && b) || c`. Parentheses make the intent obvious either way.

#### Docs
- [Reference: Lazy boolean operators](https://doc.rust-lang.org/reference/expressions/operator-expr.html#lazy-boolean-operators)
- [Book: Functions with return values](https://doc.rust-lang.org/book/ch03-03-how-functions-work.html#functions-with-return-values)

### 2. Greatest common divisor

Return the greatest common divisor of two numbers using Euclid's algorithm: `gcd(a, 0)` is `a`, and otherwise `gcd(a, b)` is `gcd(b, a % b)`.

```rust starter
pub fn gcd(a: u64, b: u64) -> u64 {
    todo!()
}
```

```rust test
/// common divisors
#[test]
fn common() {
    assert_eq!(gcd(12, 18), 6);
    assert_eq!(gcd(18, 12), 6);
}

/// coprime numbers
#[test]
fn coprime() {
    assert_eq!(gcd(17, 5), 1);
}

/// zero on either side
#[test]
fn zero() {
    assert_eq!(gcd(7, 0), 7);
    assert_eq!(gcd(0, 7), 7);
}
```

#### Uses
- [Functions › Branching and recursion](#/functions/branching-and-recursion)
- [Functions › Implicit return](#/functions/implicit-return)

#### Hints
- The definition already is the code: one case where `b == 0`, and one where you call `gcd` again.
- Write the body as a single `if b == 0 { ... } else { ... }` expression. The `else` branch returns `gcd(b, a % b)`.

#### Tips
- `a % b` is always smaller than `b`, so the second argument shrinks on every call and the recursion is sure to reach 0.

#### Docs
- [Book: Functions with return values](https://doc.rust-lang.org/book/ch03-03-how-functions-work.html#functions-with-return-values)
- [Rust by Example: Functions](https://doc.rust-lang.org/rust-by-example/fn.html)

### 3. Python's divmod

Rust's `/` and `%` truncate toward zero, so `-7 / 2` is `-3` and `-7 % 2` is `-1`. Python's `divmod` floors instead: `divmod(-7, 2)` is `(-4, 1)`, and the remainder always has the sign of the divisor.

Write `floor_divmod` so it matches Python. One way: start from Rust's `/` and `%`, and when the remainder is not zero and its sign differs from the divisor's, adjust both.

```rust starter
pub fn floor_divmod(a: i32, b: i32) -> (i32, i32) {
    (a / b, a % b)
}
```

```rust test
/// positive operands agree with Rust
#[test]
fn positive() {
    assert_eq!(floor_divmod(7, 2), (3, 1));
    assert_eq!(floor_divmod(6, 3), (2, 0));
}

/// negative dividend floors
#[test]
fn negative_dividend() {
    assert_eq!(floor_divmod(-7, 2), (-4, 1));
}

/// negative divisor floors
#[test]
fn negative_divisor() {
    assert_eq!(floor_divmod(7, -2), (-4, -1));
    assert_eq!(floor_divmod(-7, -2), (3, -1));
}

/// exact division needs no adjustment
#[test]
fn exact() {
    assert_eq!(floor_divmod(-6, 3), (-2, 0));
}
```

#### Uses
- [Variables & types › Operators](#/basics/operators)
- [Functions › Branching and recursion](#/functions/branching-and-recursion)
- [Functions › Returning several values](#/functions/returning-several-values)

#### Hints
- Start with `let (q, r) = (a / b, a % b);` and only change the result when an adjustment is needed.
- "Signs differ" compares two `bool`s: `(r < 0) != (b < 0)`. Combine it with `r != 0` using `&&`.
- When both hold, floor division is one lower and the remainder moves by one divisor: `(q - 1, r + b)`.

#### Tips
- `i32::rem_euclid` looks like the answer, but its remainder is never negative, so it disagrees with Python whenever `b` is negative.

#### Docs
- [Reference: Arithmetic and logical binary operators](https://doc.rust-lang.org/reference/expressions/operator-expr.html#arithmetic-and-logical-binary-operators)
- [std: `i32::rem_euclid`](https://doc.rust-lang.org/std/primitive.i32.html#method.rem_euclid)

### 4. Apply n times

Return the result of applying `f` to `x`, `n` times over. `apply_n(f, 0, x)` is just `x`.

```rust starter
pub fn apply_n(f: fn(i64) -> i64, n: u32, x: i64) -> i64 {
    todo!()
}
```

```rust test
fn double(x: i64) -> i64 {
    x * 2
}

fn dec(x: i64) -> i64 {
    x - 1
}

/// applies f repeatedly
#[test]
fn repeats() {
    assert_eq!(apply_n(double, 10, 1), 1024);
    assert_eq!(apply_n(dec, 3, 0), -3);
}

/// zero times returns x
#[test]
fn zero_times() {
    assert_eq!(apply_n(double, 0, 5), 5);
}
```

#### Uses
- [Functions › Functions as values](#/functions/functions-as-values)
- [Functions › Branching and recursion](#/functions/branching-and-recursion)

#### Hints
- `f` is called like any function: `f(x)`.
- Think recursively: applying `f` `n` times to `x` is the same as applying it `n - 1` times to `f(x)`. When `n == 0`, the answer is `x`.
- The recursive call is `apply_n(f, n - 1, f(x))`.

#### Tips
- Once you've done Control flow, a loop works too: `for _ in 0..n` over a `let mut` copy of `x`.

#### Docs
- [Book: Function pointers](https://doc.rust-lang.org/book/ch20-04-advanced-functions-and-closures.html#function-pointers)
