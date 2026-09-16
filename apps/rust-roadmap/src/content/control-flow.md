# Control flow

In Rust, `if` and loops are expressions: they produce values you can assign. This module covers `if` as an expression, `loop` with `break` values, `while`, `for` over ranges, and labeled loops.

## `if` needs a `bool`

```rust
let n = 7;
if n % 2 == 0 {
    println!("even");
} else if n % 3 == 0 {
    println!("divisible by three");
} else {
    println!("something else");
}
```

No parentheses around the condition, and braces are always required. The condition must be a `bool`. There is no truthiness: `0`, `""` and empty collections are not false.

```rust
let items = 3;
if items {
    println!("have items");
}
// error[E0308]: mismatched types (expected `bool`, found integer)
```

Write the comparison you mean: `if items > 0`.

## `if` is an expression

Every block `{ ... }` evaluates to its last expression, so `if` does too. That replaces the ternary operator:

```rust
let n = 7;
let parity = if n % 2 == 0 { "even" } else { "odd" };
```

Both branches must produce the same type, because `parity` can only have one:

```rust
let n = 7;
let x = if n > 5 { 1 } else { "small" };
// error[E0308]: `if` and `else` have incompatible types
```

An `if` without `else` produces `()`, so it can only be used where no value is expected. Any block works as an expression, which is handy for scoping temporary variables:

```rust
let area = {
    let width = 3;
    let height = 4;
    width * height // no semicolon: this is the block's value
};
```

## `loop`

`loop` repeats forever until you `break`. Unlike other loops, `break` can carry a value out of it:

```rust
let mut n = 27;
let mut steps = 0;
let result = loop {
    if n == 1 {
        break steps;
    }
    n = if n % 2 == 0 { n / 2 } else { 3 * n + 1 };
    steps += 1;
};
println!("{result} steps");
```

Use `loop` when the exit condition is found in the middle of the body, such as retrying an operation until it succeeds.

## `while`

```rust
let mut countdown = 3;
while countdown > 0 {
    println!("{countdown}...");
    countdown -= 1;
}
```

There is no `do ... while`; write `loop` with a `break` at the end instead.

## `for` and ranges

`for` walks over anything iterable. Ranges are the most common:

```rust
for i in 0..5 {}              // 0, 1, 2, 3, 4   (end excluded)
for i in 0..=5 {}             // 0 through 5     (end included)
for i in (0..5).rev() {}      // 4, 3, 2, 1, 0
for i in (0..10).step_by(3) {} // 0, 3, 6, 9
```

There is no C-style `for (i = 0; i < n; i++)`. Arrays are iterable directly, and you rarely need an index:

```rust
let scores = [90, 72, 85];
let mut total = 0;
for s in scores {
    total += s;
}
```

The loop variable is a fresh immutable binding on every pass. Anything you accumulate must be a `let mut` declared outside the loop.

`continue` skips to the next iteration, `break` leaves the loop. A `for` or `while` loop can't `break` with a value, because it might end without ever reaching the `break`; only `loop` can.

## Labels

`break` and `continue` apply to the innermost loop. To reach an outer one, label it with a name that starts with a quote:

```rust
'rows: for row in 0..5 {
    for col in 0..5 {
        if row * col == 6 {
            println!("found at ({row}, {col})");
            break 'rows;
        }
        if col > row {
            continue 'rows;
        }
    }
}
```

`match`, Rust's other branching construct, needs enums to show what it can do. It has its own module.

```rust playground
fn main() {
    for n in 1..=15 {
        let label = if n % 15 == 0 {
            "FizzBuzz".to_string()
        } else if n % 3 == 0 {
            "Fizz".to_string()
        } else if n % 5 == 0 {
            "Buzz".to_string()
        } else {
            n.to_string()
        };
        print!("{label} ");
    }
    println!();

    let mut guess = 1u64;
    let target = 1000;
    let doublings = loop {
        if guess >= target {
            break guess.trailing_zeros();
        }
        guess *= 2;
    };
    println!("doubled {doublings} times to reach {guess}");

    // Try: make the FizzBuzz loop count down from 15 to 1 with .rev().
}
```

## Exercises

### 1. FizzBuzz

Return `"Fizz"` for multiples of 3, `"Buzz"` for multiples of 5, `"FizzBuzz"` for multiples of both, and the number itself otherwise. `n.to_string()` turns a number into a `String`, and `"Fizz".to_string()` turns a literal into one, so every branch has the same type.

```rust starter
pub fn fizzbuzz(n: u32) -> String {
    todo!()
}
```

```rust test
/// plain numbers
#[test]
fn numbers() {
    assert_eq!(fizzbuzz(1), "1");
    assert_eq!(fizzbuzz(7), "7");
    assert_eq!(fizzbuzz(98), "98");
}

/// Fizz and Buzz
#[test]
fn fizz_and_buzz() {
    assert_eq!(fizzbuzz(3), "Fizz");
    assert_eq!(fizzbuzz(9), "Fizz");
    assert_eq!(fizzbuzz(5), "Buzz");
    assert_eq!(fizzbuzz(10), "Buzz");
}

/// FizzBuzz for multiples of 15
#[test]
fn fizzbuzz_both() {
    assert_eq!(fizzbuzz(15), "FizzBuzz");
    assert_eq!(fizzbuzz(30), "FizzBuzz");
    assert_eq!(fizzbuzz(45), "FizzBuzz");
}
```

#### Uses
- [Control flow › `if` is an expression](#/control-flow/if-is-an-expression)
- [Variables & types › Operators](#/basics/operators)
- [What is Rust? › How the exercises work](#/intro/how-the-exercises-work)

#### Hints
- "Divisible by 3" is `n % 3 == 0`.
- Order the checks so the most specific case comes first. If you test for 3 before testing for both, 15 never reaches the `FizzBuzz` branch.
- Make the whole `if` / `else if` / `else` chain the function's last expression, with a `String` in every branch.

#### Tips
- Divisible by both 3 and 5 is the same as divisible by 15.
- Every branch has to produce the same type, and the return type is `String`. `"Fizz"` on its own is a `&str`, so each literal branch needs `.to_string()` and the number branch needs `n.to_string()`.
- `assert_eq!(fizzbuzz(3), "Fizz")` compares a `String` with a `&str` quite happily. You only need the conversion inside the function, not in the test.

#### Docs
- [Book: `if` expressions](https://doc.rust-lang.org/book/ch03-05-control-flow.html#if-expressions)
- [Book: Using `if` in a `let` statement](https://doc.rust-lang.org/book/ch03-05-control-flow.html#using-if-in-a-let-statement)

### 2. Sum of multiples

Return the sum of every number from 1 up to, but not including, `limit` that is divisible by 3 or by 5.

```rust starter
pub fn sum_of_multiples(limit: u32) -> u32 {
    todo!()
}
```

```rust test
/// below 10: 3 + 5 + 6 + 9
#[test]
fn below_ten() {
    assert_eq!(sum_of_multiples(10), 23);
    assert_eq!(sum_of_multiples(7), 14);
}

/// nothing below 3
#[test]
fn tiny() {
    assert_eq!(sum_of_multiples(0), 0);
    assert_eq!(sum_of_multiples(1), 0);
    assert_eq!(sum_of_multiples(3), 0);
}

/// limit itself is not included
#[test]
fn excludes_limit() {
    assert_eq!(sum_of_multiples(4), 3);
    assert_eq!(sum_of_multiples(5), 3);
    assert_eq!(sum_of_multiples(6), 8);
}

/// multiples of both count once
#[test]
fn counts_once() {
    assert_eq!(sum_of_multiples(16), 60);
    assert_eq!(sum_of_multiples(31), 225);
}

/// below 1000
#[test]
fn below_thousand() {
    assert_eq!(sum_of_multiples(1000), 233168);
}
```

#### Uses
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)
- [Variables & types › Operators](#/basics/operators)
- [Variables & types › `let` and `mut`](#/basics/let-and-mut)

#### Hints
- Keep a running total in a `let mut` declared before the loop, and return it after.
- `1..limit` covers 1 up to but not including `limit`.
- Inside the loop, one `if` with `||` checks "divisible by 3 or by 5".

#### Tips
- A number like 15 is divisible by both, but `||` still adds it once. Two separate `if`s would count it twice, and the `counts_once` test is there for exactly that mistake.
- `1..limit` excludes `limit`, so `sum_of_multiples(5)` is `3`, not `8`. Reach for `..=` only when you mean to include the end.
- The three tiny inputs need no special case. `1..0` and `1..1` are empty ranges that simply don't run the body, so the total stays 0.

#### Docs
- [Book: Looping through a collection with `for`](https://doc.rust-lang.org/book/ch03-05-control-flow.html#looping-through-a-collection-with-for)
- [Rust by Example: for and range](https://doc.rust-lang.org/rust-by-example/flow_control/for.html)

### 3. Collatz steps

Starting from `n`, repeat: halve it if it's even, otherwise replace it with `3 * n + 1`. Return how many steps it takes to reach 1. `n` is at least 1.

```rust starter
pub fn collatz_steps(n: u64) -> u32 {
    todo!()
}
```

```rust test
/// 1 takes no steps
#[test]
fn one() {
    assert_eq!(collatz_steps(1), 0);
}

/// small numbers
#[test]
fn small() {
    assert_eq!(collatz_steps(2), 1);
    assert_eq!(collatz_steps(3), 7);
    assert_eq!(collatz_steps(4), 2);
    assert_eq!(collatz_steps(6), 8);
    assert_eq!(collatz_steps(7), 16);
}

/// long detours
#[test]
fn twenty_seven() {
    assert_eq!(collatz_steps(27), 111);
    assert_eq!(collatz_steps(97), 118);
    assert_eq!(collatz_steps(837_799), 524);
}
```

#### Uses
- [Control flow › `while`](#/control-flow/while)
- [Control flow › `if` is an expression](#/control-flow/if-is-an-expression)
- [Variables & types › Shadowing](#/basics/shadowing)

#### Hints
- The parameter `n` is immutable. Start with `let mut n = n;`, a new mutable variable that shadows it, plus a `let mut` step counter.
- Loop while `n != 1`. Each pass replaces `n` and adds one to the counter.
- `n = if n % 2 == 0 { n / 2 } else { 3 * n + 1 };` does one step in one line.

#### Tips
- `loop` with `break steps` works just as well; the `loop` section of this module computes exactly this sequence.
- `let mut n = n;` is shadowing, not a second variable with a new name. It's the idiomatic way to get a mutable copy of a parameter you were given by value.
- The parameter is a `u64` for a reason. Starting from 837,799 the sequence climbs past 2.7 billion on the way down, which would overflow a `u32` and panic in a debug build.

#### Docs
- [Book: Conditional loops with `while`](https://doc.rust-lang.org/book/ch03-05-control-flow.html#conditional-loops-with-while)
- [Book: Returning values from loops](https://doc.rust-lang.org/book/ch03-05-control-flow.html#returning-values-from-loops)

### 4. Pythagorean triple

Find the triple `(a, b, c)` with `a < b < c`, `a + b + c == sum` and `a * a + b * b == c * c`. Return the one with the smallest `a`, or `(0, 0, 0)` if there is none.

Two nested loops over `a` and `b` are enough, since `c` follows from the sum. A labeled `break` lets you stop both loops as soon as you find it. Keep your ranges small enough that `sum - a - b` can't go below zero: `u32` subtraction that underflows panics.

```rust starter
pub fn triple_with_sum(sum: u32) -> (u32, u32, u32) {
    todo!()
}
```

```rust test
/// the classic 3-4-5
#[test]
fn twelve() {
    assert_eq!(triple_with_sum(12), (3, 4, 5));
    assert_eq!(triple_with_sum(24), (6, 8, 10));
    assert_eq!(triple_with_sum(30), (5, 12, 13));
}

/// a larger one
#[test]
fn thousand() {
    assert_eq!(triple_with_sum(1000), (200, 375, 425));
}

/// smallest a wins when there are several
#[test]
fn several() {
    assert_eq!(triple_with_sum(60), (10, 24, 26));
    assert_eq!(triple_with_sum(120), (20, 48, 52));
}

/// none exists
#[test]
fn none() {
    assert_eq!(triple_with_sum(10), (0, 0, 0));
    assert_eq!(triple_with_sum(0), (0, 0, 0));
    assert_eq!(triple_with_sum(1), (0, 0, 0));
    assert_eq!(triple_with_sum(13), (0, 0, 0));
}
```

#### Uses
- [Control flow › Labels](#/control-flow/labels)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)
- [Variables & types › Tuples and arrays](#/basics/tuples-and-arrays)

#### Hints
- Keep the answer in `let mut found = (0, 0, 0);` before the loops and return `found` after them. That also covers the "none" case.
- Loop `a` over `1..sum` and `b` over `a + 1..sum - a`, so `c = sum - a - b` is always at least 1. Once `c <= b`, larger `b`s can't work: a plain `break` ends the inner loop.
- When `a * a + b * b == c * c`, set `found` and `break` out of the labeled outer loop. The first hit has the smallest `a`.

#### Tips
- A `for` loop can't `break` with a value, which is why the answer goes into a variable declared outside.
- Watch the subtraction. `sum - a - b` on a `u32` panics the moment it would go below zero, so bound the inner range rather than testing the result afterwards.
- `a * a + b * b == c * c` stays in `u32` here, but for a sum near the top of the type it wouldn't. Squaring is the step that overflows first.

#### Docs
- [Book: Loop labels](https://doc.rust-lang.org/book/ch03-05-control-flow.html#loop-labels-to-disambiguate-between-multiple-loops)
- [Rust by Example: Nesting and labels](https://doc.rust-lang.org/rust-by-example/flow_control/loop/nested.html)
