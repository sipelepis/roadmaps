# Variables & types

Variables are immutable unless you say otherwise, every value has one static type, and numbers never convert themselves. This module covers `let`, `mut`, shadowing, the scalar types, tuples, arrays, `as` casts and constants.

## `let` and `mut`

```rust
let x = 5;
x = 6;
// error[E0384]: cannot assign twice to immutable variable `x`
```

Bindings are immutable by default. Add `mut` when a value really needs to change:

```rust
let mut count = 0;
count += 1;
```

This is the reverse of JavaScript's `let`/`const` or Python, where everything is reassignable. The payoff is that when you read `let total = ...`, you know `total` never changes further down.

## Types and inference

The compiler infers types from how values are used. You annotate when it can't tell, or when you want a type other than the default:

```rust
let a = 42;          // i32, the default integer type
let b = 2.5;         // f64, the default float type
let c: u8 = 200;     // annotated
let d = 1_000_000u64; // suffix on the literal; underscores are just separators
let e = 0xff;        // hex; also 0o77 and 0b1010
```

The scalar types:

| Type | Meaning |
|------|---------|
| `i8` `i16` `i32` `i64` `i128` | signed integers of that many bits |
| `u8` `u16` `u32` `u64` `u128` | unsigned integers |
| `isize` `usize` | pointer-sized; `usize` is the type of lengths and indexes |
| `f32` `f64` | floating point |
| `bool` | `true` or `false` |
| `char` | one Unicode scalar value, 4 bytes, written `'a'` or `'🦀'` |

`'a'` is a `char`; `"a"` is a string. They are different types.

## Shadowing

A new `let` with the same name creates a new variable that hides the old one. Unlike `mut`, it can change the type:

```rust
let input = "42";
let input = input.len(); // new variable, now a usize
let input = input * 2;   // another one
```

This is idiomatic for step-by-step transformations where the old value is no longer needed. With `mut`, the type is fixed:

```rust
let mut spaces = "   ";
spaces = spaces.len();
// error[E0308]: mismatched types
```

## No implicit conversions

Rust never converts between numeric types behind your back, not even from a smaller integer to a bigger one:

```rust
let small: i32 = 10;
let big: i64 = small;
// error[E0308]: mismatched types
let total = small + 0.5;
// error[E0277]: cannot add `{float}` to `i32`
```

Use `as` to convert explicitly. It never fails, so you need to know what it does at the edges:

```rust
let a = 10_i32 as i64;       // 10, widening is always exact
let b = 3.99_f64 as i32;     // 3, floats truncate toward zero
let c = 300_i32 as u8;       // 44, integers keep the low bits (300 - 256)
let d = -1_i32 as u32;       // 4294967295
let e = 1e10_f64 as i32;     // 2147483647, float to int saturates
let f = 'A' as u32;          // 65
```

When you want a conversion that can't lose information, `i64::from(x)` compiles only for the lossless ones.

## Integer overflow

Integer arithmetic that goes out of range is a bug, and Rust treats it as one. In a debug build, it panics:

```rust
fn next(x: u8) -> u8 {
    x + 1
}

let y = next(255); // panics at runtime: attempt to add with overflow
```

If the compiler can see the overflow, it refuses to build at all:

```rust
let z: u8 = 255 + 1;
// error: this arithmetic operation will overflow
```

Release builds skip the check and wrap around, so never rely on either behavior. When overflow is expected, say what you want:

```rust
let x: u8 = 250;
x.wrapping_add(10);    // 4, wraps around
x.saturating_add(10);  // 255, clamps at the maximum
x.overflowing_add(10); // (4, true), the wrapped value and whether it overflowed
x.checked_add(10);     // None, "no value"; the Option module covers this
```

Numbers have methods like these, plus constants such as `i32::MAX` and `u8::MIN`. Integer division truncates toward zero: `7 / 2` is `3` and `-7 / 2` is `-3`.

## Operators

The arithmetic, comparison and logical operators are the ones you know from other languages. Both sides must have the same type:

```rust
let a = 17;
let b = 5;
let quotient = a / b;           // 3: integer division drops the remainder
let remainder = a % b;          // 2: what's left over
let same = a == b;              // false; also !=, <, <=, > and >=
let both = a > 0 && b > 0;      // true: "and"
let either = a > 20 || b > 20;  // false: "or"
let neither = !either;          // true: "not"
```

Comparisons produce a `bool`. `&&` and `||` short-circuit: the right side is only evaluated when it can still change the answer. The compound forms `+=`, `-=`, `*=`, `/=` and `%=` update a `mut` variable in place.

## Tuples and arrays

A tuple groups a fixed number of values of possibly different types. Read fields with `.0`, `.1`, or destructure:

```rust
let pair: (i32, char) = (7, 'x');
let n = pair.0;
let (num, letter) = pair;
let unit = (); // the empty tuple, "unit": the value of things that produce no value
```

An array has a fixed length that is part of its type, and every element has the same type:

```rust
let primes: [u32; 5] = [2, 3, 5, 7, 11];
let zeros = [0; 3]; // [0, 0, 0]
let first = primes[0];
let count = primes.len();
```

Indexing past the end panics at runtime instead of reading garbage memory, and there are no negative indexes. When you need a list that grows, you'll use `Vec`, which comes in a later module.

## Constants

```rust
const SECONDS_PER_HOUR: u32 = 60 * 60;
```

`const` needs an explicit type, is written in `SCREAMING_SNAKE_CASE`, and is evaluated at compile time. It can live outside any function. Use it for values that are fixed when the program is written; use `let` for everything computed at runtime.

```rust playground
const FREEZING_F: f64 = 32.0;

fn main() {
    let celsius = [-40.0, 0.0, 37.0, 100.0];
    let count = celsius.len();
    println!("{count} readings, first is {}", celsius[0]);

    let hot = celsius[3] * 9.0 / 5.0 + FREEZING_F;
    println!("{}C is {}F", celsius[3], hot);

    let level: u8 = 250;
    println!("wrapping:    {}", level.wrapping_add(10));
    println!("saturating:  {}", level.saturating_add(10));
    println!("overflowing: {:?}", level.overflowing_add(10));

    let (whole, fraction) = (7 / 2, 7.0 / 2.0);
    println!("7 / 2 = {whole}, 7.0 / 2.0 = {fraction}");
    println!("{} {} {}", 3.99_f64 as i32, 300_i32 as u8, 'A' as u32);

    // Try: replace `level.wrapping_add(10)` with `level + 10` and see what the compiler says.
}
```

## Exercises

### 1. Average of three

Return the average of three `i32` values as an `f64`.

Watch the edges: adding three large `i32`s can overflow before you ever divide. Convert first.

```rust starter
pub fn average(a: i32, b: i32, c: i32) -> f64 {
    todo!()
}
```

```rust test
/// averages small numbers
#[test]
fn small_numbers() {
    assert_eq!(average(1, 2, 3), 2.0);
    assert_eq!(average(1, 2, 4), 7.0 / 3.0);
}

/// handles negatives
#[test]
fn negatives() {
    assert_eq!(average(-3, 0, 3), 0.0);
}

/// does not overflow near i32::MAX
#[test]
fn no_overflow() {
    assert_eq!(average(i32::MAX, i32::MAX, i32::MAX), i32::MAX as f64);
}
```

#### Uses
- [Variables & types › No implicit conversions](#/basics/no-implicit-conversions)
- [Variables & types › Integer overflow](#/basics/integer-overflow)

#### Hints
- The result is an `f64`, so do the whole calculation in `f64`. Convert each argument with `as f64` before you add anything.
- Divide by `3.0`, not `3`. An `f64` can't be divided by an integer.

#### Tips
- `f64::from(a)` does the same conversion and only compiles when it can't lose information. Every `i32` fits exactly in an `f64`.

#### Docs
- [Reference: Type cast expressions](https://doc.rust-lang.org/reference/expressions/operator-expr.html#type-cast-expressions)
- [Rust by Example: Casting](https://doc.rust-lang.org/rust-by-example/types/cast.html)

### 2. Hours, minutes, seconds

Split a number of seconds into a tuple `(hours, minutes, seconds)`. Use integer division `/` and remainder `%`.

```rust starter
pub fn hms(total_seconds: u32) -> (u32, u32, u32) {
    todo!()
}
```

```rust test
/// splits seconds into parts
#[test]
fn splits() {
    assert_eq!(hms(3725), (1, 2, 5));
}

/// zero is all zeros
#[test]
fn zero() {
    assert_eq!(hms(0), (0, 0, 0));
}

/// hours are not capped at 24
#[test]
fn many_hours() {
    assert_eq!(hms(90_000), (25, 0, 0));
}
```

#### Uses
- [Variables & types › Operators](#/basics/operators)
- [Variables & types › Tuples and arrays](#/basics/tuples-and-arrays)

#### Hints
- An hour is 3600 seconds, so `total_seconds / 3600` is the hours.
- `total_seconds % 3600` is what's left after taking out the hours. Split that into minutes the same way. The seconds are `total_seconds % 60`.
- Build the result as a tuple, `(hours, minutes, seconds)`, and leave it as the last expression.

#### Docs
- [Book: Numeric operations](https://doc.rust-lang.org/book/ch03-02-data-types.html#numeric-operations)
- [Book: The tuple type](https://doc.rust-lang.org/book/ch03-02-data-types.html#the-tuple-type)

### 3. Three ways to add bytes

Add two `u8` values three ways and return them as a tuple: the wrapped sum, the saturated sum, and whether the true sum overflowed.

```rust starter
pub fn add_bytes(a: u8, b: u8) -> (u8, u8, bool) {
    todo!()
}
```

```rust test
/// no overflow for small values
#[test]
fn fits() {
    assert_eq!(add_bytes(1, 2), (3, 3, false));
}

/// wraps, clamps and reports overflow
#[test]
fn overflows() {
    assert_eq!(add_bytes(200, 100), (44, 255, true));
}

/// 255 + 0 is not an overflow
#[test]
fn edge() {
    assert_eq!(add_bytes(255, 0), (255, 255, false));
}
```

#### Uses
- [Variables & types › Integer overflow](#/basics/integer-overflow)
- [Variables & types › Tuples and arrays](#/basics/tuples-and-arrays)

#### Hints
- Each part of the answer is one of the overflow methods: `wrapping_add`, `saturating_add` and `overflowing_add`.
- `a.overflowing_add(b)` returns a pair `(sum, overflowed)`. You only need its second field, `.1`.

#### Tips
- Plain `a + b` would panic on `200 + 100` in a debug build, which is exactly why these methods exist.

#### Docs
- [std: `u8::wrapping_add`](https://doc.rust-lang.org/std/primitive.u8.html#method.wrapping_add)
- [std: `u8::overflowing_add`](https://doc.rust-lang.org/std/primitive.u8.html#method.overflowing_add)

### 4. Pack a color

A 24-bit color stores red, green and blue in one `u32`, as `0xRRGGBB`. `pack` builds that number from three bytes, and `unpack` splits it back.

You need two bit operators: `x << n` shifts the bits of `x` left by `n` places, and `a | b` combines the bits of two numbers. Shifting a `u8` left by 16 overflows, so cast to `u32` first. Going back, `(c >> 8) as u8` shifts right and keeps the low 8 bits.

```rust starter
pub fn pack(r: u8, g: u8, b: u8) -> u32 {
    todo!()
}

pub fn unpack(color: u32) -> (u8, u8, u8) {
    todo!()
}
```

```rust test
/// packs bytes into 0xRRGGBB
#[test]
fn packs() {
    assert_eq!(pack(0x12, 0x34, 0x56), 0x123456);
    assert_eq!(pack(255, 255, 255), 0xFFFFFF);
    assert_eq!(pack(0, 0, 1), 1);
}

/// unpacks 0xRRGGBB into bytes
#[test]
fn unpacks() {
    assert_eq!(unpack(0x123456), (0x12, 0x34, 0x56));
    assert_eq!(unpack(0xFF8000), (255, 128, 0));
}

/// round-trips
#[test]
fn round_trip() {
    let (r, g, b) = unpack(0xABCDEF);
    assert_eq!(pack(r, g, b), 0xABCDEF);
}
```

#### Uses
- [Variables & types › No implicit conversions](#/basics/no-implicit-conversions)
- [Variables & types › Tuples and arrays](#/basics/tuples-and-arrays)

#### Hints
- In `pack`, red moves up 16 bits, green 8, and blue stays where it is. Cast each byte to `u32` before shifting it.
- Combine the three shifted values with `|`.
- In `unpack`, shift right by 16, 8 and 0, and cast each result `as u8`. The cast throws away everything above the low 8 bits.

#### Tips
- Write the cast in parentheses: `(r as u32) << 16`. Without them, the compiler reads `u32 <<` as the start of a generic type and reports a confusing error.

#### Docs
- [Reference: Arithmetic and logical binary operators](https://doc.rust-lang.org/reference/expressions/operator-expr.html#arithmetic-and-logical-binary-operators)
- [Reference: Type cast expressions](https://doc.rust-lang.org/reference/expressions/operator-expr.html#type-cast-expressions)
