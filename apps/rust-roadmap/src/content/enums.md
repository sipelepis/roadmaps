# Enums & match

A Rust enum is a type whose value is exactly one of several variants, and each variant can carry its own data. `match` makes you handle every variant, so enums replace null, sentinel values, and many of the class hierarchies you'd write in other languages.

## Simple enums

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Direction {
    North,
    East,
    South,
    West,
}

let heading = Direction::North;
```

Variants are namespaced under the enum: `Direction::North`, not a bare `North`. So far this looks like a TypeScript string union or a Python `Enum`.

## Variants with data

Each variant can hold different data, either named fields or positional ones:

```rust
enum Shape {
    Circle { radius: f64 },
    Rect { width: f64, height: f64 },
    Point,
}

enum Message {
    Move(i32, i32),
    Write(String),
    Quit,
}

let s = Shape::Circle { radius: 2.0 };
let m = Message::Write(String::from("hi"));
```

This is TypeScript's discriminated union (`{ kind: "circle", radius } | { kind: "rect", ... }`) built into the language. A `Shape` value is one of the three shapes and only has the fields that make sense for it. You can't read a `radius` off a `Rect` by mistake.

## `match`

`match` compares a value against patterns, top to bottom, and runs the first arm that fits. Patterns can pull the data out of a variant:

```rust
enum Shape {
    Circle { radius: f64 },
    Rect { width: f64, height: f64 },
    Point,
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius } => 3.14159 * radius * radius,
        Shape::Rect { width, height } => width * height,
        Shape::Point => 0.0,
    }
}
```

`match` is an expression, so every arm must produce the same type. And it must be *exhaustive*. Leave out a variant and the program doesn't compile:

```rust
enum Shape {
    Circle { radius: f64 },
    Rect { width: f64, height: f64 },
    Point,
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius } => 3.14159 * radius * radius,
        Shape::Rect { width, height } => width * height,
    }
}
// error[E0004]: non-exhaustive patterns: `&Shape::Point` not covered
```

That's the payoff of enums. Add a variant later and the compiler lists every `match` that needs updating. An `if`/`else if` chain on a string tag can't do that.

`_` matches anything and ignores it, as a catch-all last arm. Use it sparingly with your own enums, since it also silences the error when a new variant appears.

Enums get `impl` blocks just like structs, so `area` would usually be a method: `fn area(&self) -> f64 { match self { ... } }`.

## Option: an enum instead of null

Rust has no `null`. A value that might be missing has type `Option<T>`, an ordinary enum from the standard library:

```rust
enum Option<T> {
    None,
    Some(T),
}
```

`<T>` means it works with any type; the Generics module explains how. `Some` and `None` are available everywhere without a prefix.

```rust
let found: Option<i32> = Some(5);
let missing: Option<i32> = None;
let total = found + 1;
// error[E0369]: cannot add `{integer}` to `Option<i32>`
```

You can't use an `Option<i32>` as an `i32`. You have to `match` it (or use one of the helpers covered in the Option & Result module) and say what happens in the `None` case. The compiler won't let you forget. `Vec`'s `pop()` is a typical source: it returns `Option<T>` because the Vec might be empty.

## Patterns

Patterns do far more than name variants:

```rust
fn describe(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1 | 2 | 3 => "a few",              // alternatives
        4..=9 => "several",                // inclusive range
        x if x < 0 => "negative",          // a guard: an extra condition
        _ => "lots",
    }
}

fn quadrant(point: (i32, i32)) -> &'static str {
    match point {
        (0, 0) => "origin",
        (x, 0) if x > 0 => "positive x axis", // destructure a tuple, then guard
        (_, 0) => "negative x axis",
        _ => "elsewhere",
    }
}
```

`&'static str` is the type of a string literal; the Lifetimes module explains the `'static`. A guard doesn't count toward exhaustiveness, so the compiler still insists on a final arm that covers everything the guards might have missed.

## `if let` and `let else`

When you care about one variant only, a full `match` is noisy. `if let` runs a block if the pattern matches:

```rust
let maybe_name: Option<&str> = Some("Ada");
if let Some(name) = maybe_name {
    println!("hello, {name}");
} else {
    println!("nobody here");
}
```

`let else` is the reverse: bind the variable if the pattern matches, otherwise leave the function (or loop). It keeps the happy path unindented:

```rust
fn last_or_zero(mut values: Vec<i32>) -> i32 {
    let Some(last) = values.pop() else {
        return 0; // must diverge: return, break, continue or panic
    };
    last
}
```

## `matches!`

`matches!(value, pattern)` is a `match` that returns `true` or `false`, handy in conditions:

```rust
let c = 'e';
let is_vowel = matches!(c, 'a' | 'e' | 'i' | 'o' | 'u');
let is_digit = matches!(c, '0'..='9');
```

```rust playground
#[derive(Debug)]
enum Command {
    Deposit(u32),
    Withdraw(u32),
    Rename(String),
    Close,
}

fn main() {
    let commands = vec![
        Command::Deposit(100),
        Command::Withdraw(30),
        Command::Withdraw(500),
        Command::Rename(String::from("savings")),
        Command::Close,
    ];

    let mut balance = 0;
    let mut name = String::from("checking");
    for cmd in commands {
        match cmd {
            Command::Deposit(amount) => balance += amount,
            Command::Withdraw(amount) if amount <= balance => balance -= amount,
            Command::Withdraw(amount) => println!("refused: {amount} > {balance}"),
            Command::Rename(new_name) => name = new_name,
            Command::Close => {
                println!("closing {name} with {balance}");
                break;
            }
        }
    }

    let last: Option<u32> = if balance > 0 { Some(balance) } else { None };
    if let Some(b) = last {
        println!("final balance {b}");
    }

    // Try: add a `Freeze` variant to Command and read the error from the match.
}
```

## Exercises

### 1. Compass

Implement `turn_right` (North to East, East to South, and so on) and `opposite` for `Direction`. Both take `self` by value, which is fine because the enum derives `Copy`.

```rust starter
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Direction {
    North,
    East,
    South,
    West,
}

impl Direction {
    pub fn turn_right(self) -> Direction {
        todo!()
    }

    pub fn opposite(self) -> Direction {
        todo!()
    }
}
```

```rust test
/// turning right goes clockwise
#[test]
fn turn_right() {
    assert_eq!(Direction::North.turn_right(), Direction::East);
    assert_eq!(Direction::West.turn_right(), Direction::North);
}

/// four right turns come back around
#[test]
fn full_circle() {
    let d = Direction::South;
    assert_eq!(d.turn_right().turn_right().turn_right().turn_right(), d);
}

/// opposite directions
#[test]
fn opposite() {
    assert_eq!(Direction::North.opposite(), Direction::South);
    assert_eq!(Direction::East.opposite(), Direction::West);
}
```

#### Uses
- [Enums & match › `match`](#/enums/match)
- [Enums & match › Simple enums](#/enums/simple-enums)
- [Structs & methods › Methods](#/structs/methods)

#### Hints
- Write `match self` with one arm per direction. Each arm gives the direction you end up facing.
- `opposite` is two right turns, so it can reuse `turn_right`. A second `match` works too.

#### Tips
- Don't add a `_` arm here. Without it, adding a variant later (say, `NorthEast`) makes the compiler point at both methods.

#### Docs
- [Book: The `match` control flow construct](https://doc.rust-lang.org/book/ch06-02-match.html)
- [Rust by Example: Enums](https://doc.rust-lang.org/rust-by-example/custom_types/enum.html)

### 2. Shape areas

Implement `area` and `name` for `Shape`. A triangle's area is `base * height / 2`. `std::f64::consts::PI` is π. When an arm doesn't need a variant's fields, `..` skips them all: `Shape::Circle { .. }` matches any circle.

```rust starter
pub enum Shape {
    Circle { radius: f64 },
    Rect { width: f64, height: f64 },
    Triangle { base: f64, height: f64 },
}

impl Shape {
    pub fn area(&self) -> f64 {
        todo!()
    }

    pub fn name(&self) -> &'static str {
        todo!()
    }
}
```

```rust test
/// area of each shape
#[test]
fn areas() {
    assert_eq!(Shape::Circle { radius: 1.0 }.area(), std::f64::consts::PI);
    assert_eq!(Shape::Rect { width: 2.0, height: 3.0 }.area(), 6.0);
    assert_eq!(Shape::Triangle { base: 4.0, height: 5.0 }.area(), 10.0);
}

/// each shape knows its name
#[test]
fn names() {
    assert_eq!(Shape::Circle { radius: 1.0 }.name(), "circle");
    assert_eq!(Shape::Rect { width: 1.0, height: 1.0 }.name(), "rectangle");
    assert_eq!(Shape::Triangle { base: 1.0, height: 1.0 }.name(), "triangle");
}
```

#### Uses
- [Enums & match › `match`](#/enums/match)
- [Enums & match › Variants with data](#/enums/variants-with-data)
- [Enums & match › Patterns](#/enums/patterns)

#### Hints
- Both methods are a `match self` with one arm per shape.
- In `area`, a pattern like `Shape::Rect { width, height }` pulls the fields out as variables you can multiply. The `area` function in the `match` section has the same shape.
- The field is an `f64`, so divide the triangle by `2.0`, not `2`.

#### Tips
- Since `self` is borrowed, the fields you pull out are references to `f64`s. Arithmetic like `width * height` works on them directly.

#### Docs
- [Book: Patterns that bind to values](https://doc.rust-lang.org/book/ch06-02-match.html#patterns-that-bind-to-values)
- [Book: Ignoring remaining parts of a value with `..`](https://doc.rust-lang.org/book/ch19-03-pattern-syntax.html#ignoring-remaining-parts-of-a-value-with-)

### 3. Where is the point?

Describe a point with one `match` on the tuple, using tuple patterns and guards. Check in this order and return the first that applies:

- `"origin"` for `(0, 0)`
- `"x axis"` when `y` is 0, `"y axis"` when `x` is 0
- `"diagonal"` when `x == y` or `x == -y`
- otherwise `"quadrant 1"` to `"quadrant 4"`: 1 is `x > 0, y > 0`, 2 is `x < 0, y > 0`, 3 is both negative, 4 is `x > 0, y < 0`

```rust starter
pub fn describe(point: (i32, i32)) -> &'static str {
    "origin"
}
```

```rust test
/// origin and axes
#[test]
fn axes() {
    assert_eq!(describe((0, 0)), "origin");
    assert_eq!(describe((5, 0)), "x axis");
    assert_eq!(describe((0, -3)), "y axis");
}

/// both diagonals
#[test]
fn diagonals() {
    assert_eq!(describe((4, 4)), "diagonal");
    assert_eq!(describe((-2, 2)), "diagonal");
}

/// the four quadrants
#[test]
fn quadrants() {
    assert_eq!(describe((1, 5)), "quadrant 1");
    assert_eq!(describe((-1, 5)), "quadrant 2");
    assert_eq!(describe((-1, -5)), "quadrant 3");
    assert_eq!(describe((1, -5)), "quadrant 4");
}
```

#### Uses
- [Enums & match › Patterns](#/enums/patterns)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- Write the arms in the order of the list. `match` takes the first arm that fits, so the order does the work.
- `(0, 0)`, `(_, 0)` and `(0, _)` handle the origin and the axes with no guard at all.
- For the rest, bind both values and add a guard: `(x, y) if x == y || x == -y => ...`. The last quadrant can be a plain `_` arm.

#### Tips
- Guards don't count toward exhaustiveness. Even if your four quadrant guards cover everything, the compiler still wants an unguarded last arm.

#### Docs
- [Book: Extra conditionals with match guards](https://doc.rust-lang.org/book/ch19-03-pattern-syntax.html#extra-conditionals-with-match-guards)
- [Rust by Example: Guards](https://doc.rust-lang.org/rust-by-example/flow_control/match/guard.html)

### 4. Stack machine

Run a list of commands on a stack of numbers and return the final stack, bottom first:

- `Push(n)` pushes `n`.
- `Pop` removes the top value, and does nothing on an empty stack.
- `Add` and `Mul` pop the top two values and push their sum or product. With fewer than two values on the stack, they do nothing and leave it unchanged.
- `Dup` pushes a copy of the top value, and does nothing on an empty stack.

`stack.pop()` returns an `Option<i64>`: `Some(top)`, or `None` when the stack is empty. `if let` and `let else` are made for this. To look at the top without removing it, pop it and push it back.

```rust starter
pub enum Command {
    Push(i64),
    Pop,
    Add,
    Mul,
    Dup,
}

pub fn run(program: Vec<Command>) -> Vec<i64> {
    let mut stack = Vec::new();
    for command in program {
        if let Command::Push(n) = command {
            stack.push(n);
        }
    }
    stack
}
```

```rust test
use Command::*;

/// pushes values
#[test]
fn push() {
    assert_eq!(run(vec![Push(1), Push(2)]), vec![1, 2]);
}

/// adds and multiplies
#[test]
fn arithmetic() {
    assert_eq!(run(vec![Push(2), Push(3), Add, Push(4), Mul]), vec![20]);
}

/// dup and pop
#[test]
fn dup_pop() {
    assert_eq!(run(vec![Push(7), Dup, Dup, Pop]), vec![7, 7]);
}

/// too few values leave the stack alone
#[test]
fn underflow() {
    assert_eq!(run(vec![Pop, Dup, Add]), Vec::<i64>::new());
    assert_eq!(run(vec![Push(5), Add, Mul]), vec![5]);
}
```

#### Uses
- [Enums & match › Option: an enum instead of null](#/enums/option-an-enum-instead-of-null)
- [Enums & match › `if let` and `let else`](#/enums/if-let-and-let-else)
- [Enums & match › `match`](#/enums/match)

#### Hints
- Replace the `if let` in the loop with a `match command` that has an arm for every command.
- `Dup`: `if let Some(top) = stack.pop()`, then push `top` twice. `Pop` just calls `stack.pop();` and ignores what comes back.
- `Add` and `Mul`: if `stack.len() < 2`, `continue` to the next command. Otherwise pop twice with `let Some(b) = stack.pop() else { continue };` and push the result.

#### Tips
- The arm `Command::Pop => stack.pop(),` doesn't compile: it produces an `Option` while the other arms produce `()`. Wrap it in braces with a semicolon, `{ stack.pop(); }`.

#### Docs
- [Book: Concise control flow with `if let` and `let...else`](https://doc.rust-lang.org/book/ch06-03-if-let.html)
- [std: `Vec::pop`](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.pop)
