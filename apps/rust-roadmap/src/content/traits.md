# Traits

A trait is a named set of methods a type can implement, like an interface in TypeScript or Go. Unlike either, implementations are explicit and can be added to a type after the fact, and most of the standard library's behavior (printing, comparing, copying, iterating) is exposed through traits.

## Defining and implementing

```rust
trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> String {
        "shape".to_string()          // default method, used unless overridden
    }
}

struct Circle { r: f64 }
struct Square { side: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 { 3.14159 * self.r * self.r }
    fn name(&self) -> String { "circle".to_string() }
}

impl Shape for Square {
    fn area(&self) -> f64 { self.side * self.side }   // keeps the default name()
}
```

Go interfaces are satisfied implicitly: any type with the right methods fits. TypeScript is structural too. Rust is nominal: a type implements `Shape` only if there's an `impl Shape for ...` block. Leave out a required method and you get `error[E0046]: not all trait items implemented, missing: area`.

To call a trait method, the trait must be in scope. That's why you'll sometimes see `use std::fmt::Write;` just to call `write!` on a `String`.

## Deriving the standard traits

```rust
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
struct Version { major: u32, minor: u32 }
```

| Trait | Gives you | Derived version |
|---|---|---|
| `Debug` | `{:?}` formatting | struct name and all fields |
| `Clone` | `.clone()` | clones every field |
| `PartialEq`, `Eq` | `==`, `!=` | all fields equal |
| `PartialOrd`, `Ord` | `<`, `.sort()`, `.max()` | compares fields in declaration order; enums by variant order |
| `Hash` | use as a `HashMap` key | hashes every field |
| `Default` | `Version::default()` | every field's default (0, `""`, empty) |

A derive only works if every field implements the trait too. `Eq` says equality is reflexive, which `f64` can't promise (`NaN != NaN`), so structs with floats stop at `PartialEq` and `PartialOrd`.

## Implementing them by hand

Derive when the obvious behavior is right. Write the impl when it isn't. `Display` is never derived because there's no obvious user-facing format:

```rust
use std::fmt;

struct Money { cents: i64 }

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "${}.{:02}", self.cents / 100, self.cents % 100)
    }
}

let price = Money { cents: 1999 };
println!("{price}");                 // $19.99
let s = price.to_string();           // any Display type gets to_string()
```

A custom ordering implements `Ord` and has `PartialOrd` delegate to it, so the two can't disagree:

```rust
use std::cmp::Ordering;

#[derive(PartialEq, Eq)]
struct Player { name: String, score: u32 }

impl Ord for Player {
    fn cmp(&self, other: &Self) -> Ordering {
        other.score.cmp(&self.score)                // highest score first
            .then_with(|| self.name.cmp(&other.name))
    }
}
impl PartialOrd for Player {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> { Some(self.cmp(other)) }
}
```

`a.cmp(&b)` returns `Ordering::Less`, `Equal` or `Greater`. Swapping `self` and `other` reverses the order; `then_with` breaks ties.

## Traits as parameters: `impl Trait` and `dyn Trait`

```rust
trait Shape { fn area(&self) -> f64; }
struct Square(f64);
impl Shape for Square { fn area(&self) -> f64 { self.0 * self.0 } }

fn print_area(s: &impl Shape) {            // one copy compiled per concrete type
    println!("{}", s.area());
}

fn total(shapes: &[Box<dyn Shape>]) -> f64 {   // one copy, runtime dispatch
    let mut sum = 0.0;
    for s in shapes { sum += s.area(); }
    sum
}

print_area(&Square(2.0));
let shapes: Vec<Box<dyn Shape>> = vec![Box::new(Square(1.0)), Box::new(Square(3.0))];
println!("{}", total(&shapes));
```

`impl Shape` in an argument means "some single type that implements `Shape`, chosen by the caller". The compiler generates a specialized copy for each type used: static dispatch, no overhead.

`dyn Shape` means "any type implementing `Shape`, decided at runtime". Values of different types have different sizes, so a `dyn Shape` always sits behind a pointer (`&dyn Shape` or `Box<dyn Shape>`, a heap pointer covered in the Box, Rc & RefCell module). Calls go through a vtable, like virtual methods in other languages. You need it for mixed collections, like the `Vec` above, which a `Vec<impl Shape>` couldn't hold.

`impl Trait` also works in return position: `fn make() -> impl Shape` hides the concrete type but still returns exactly one.

Not every trait can be used as `dyn`. A trait whose methods return `Self` or have generic parameters isn't *dyn compatible*; `Clone` is the usual example.

## The orphan rule

You may write `impl Trait for Type` only if your crate defines the trait or the type:

```rust
use std::fmt;
impl fmt::Display for Vec<i32> {    // error[E0117]: only traits defined in the current crate can be implemented for types defined outside of the crate
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { write!(f, "...") }
}
```

Otherwise two crates could both implement `Display for Vec<i32>` and the compiler couldn't pick. The workaround is a *newtype*: `struct Scores(Vec<i32>);` is your type, so you can implement anything for it. Your own traits, on the other hand, can be implemented for `i32`, `String` or anything else.

Operators are traits too: `+` is `std::ops::Add`, `==` is `PartialEq`, `[]` is `Index`. Implement them for your types and the operators work.

```rust playground
use std::fmt;

trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> String {
        "shape".to_string()
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Rect { w: f64, h: f64 }

#[derive(Debug, Clone, PartialEq)]
struct Circle { r: f64 }

impl Shape for Rect {
    fn area(&self) -> f64 { self.w * self.h }
    fn name(&self) -> String { format!("{}x{} rect", self.w, self.h) }
}

impl Shape for Circle {
    fn area(&self) -> f64 { std::f64::consts::PI * self.r * self.r }
}

impl fmt::Display for Circle {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "circle(r={})", self.r)
    }
}

fn main() {
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Rect { w: 2.0, h: 3.0 }),
        Box::new(Circle { r: 1.0 }),
    ];
    for s in &shapes {
        println!("{:<12} area {:.2}", s.name(), s.area());
    }

    let c = Circle { r: 2.0 };
    println!("{c} and {c:?}, equal to a clone: {}", c == c.clone());
}

// Try: override name() for Circle, or remove `PartialEq` from Circle's derive and read the error.
```

## Exercises

### 1. Display a point

Implement `Display` for `Point` so it prints as `(x, y)`. `write!(f, "...", ...)` works like `format!` but writes into the formatter.

```rust starter
use std::fmt;

pub struct Point {
    pub x: i32,
    pub y: i32,
}

impl fmt::Display for Point {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        todo!()
    }
}
```

```rust test
/// formats with {}
#[test]
fn formats() {
    assert_eq!(format!("{}", Point { x: 1, y: -2 }), "(1, -2)");
}

/// to_string comes for free
#[test]
fn to_string_works() {
    assert_eq!(Point { x: 0, y: 0 }.to_string(), "(0, 0)");
}
```

#### Uses
- [Traits › Implementing them by hand](#/traits/implementing-them-by-hand)
- [What is Rust? › `fn main` and macros](#/intro/fn-main-and-macros)

#### Hints
- The whole body is one `write!` call, and it's the return value, so no semicolon.
- Give `write!` the same format string you'd give `format!`, with `self.x` and `self.y` as its arguments.

#### Tips
- Implementing `Display` gets you `to_string()` for free, which is why the second test passes with no extra code.

#### Docs
- [std: fmt::Display](https://doc.rust-lang.org/std/fmt/trait.Display.html)
- [Rust by Example: Display](https://doc.rust-lang.org/rust-by-example/hello/print/print_display.html)

### 2. Default methods

`Animal` has two required methods and a default `speak`. Write the default so it returns `"<name> says <sound>"`. Then implement `Animal` for `Dog` (name is its field, sound `"woof"`) and for `Robot`, which keeps the required methods (name `"R2"`, sound `"beep"`) but overrides `speak` to return `"BEEP BOOP"`.

```rust starter
pub trait Animal {
    fn name(&self) -> String;
    fn sound(&self) -> String;
    fn speak(&self) -> String {
        todo!()
    }
}

pub struct Dog {
    pub name: String,
}

pub struct Robot;

impl Animal for Dog {
    fn name(&self) -> String { todo!() }
    fn sound(&self) -> String { todo!() }
}

impl Animal for Robot {
    fn name(&self) -> String { todo!() }
    fn sound(&self) -> String { todo!() }
}
```

```rust test
/// dog uses the default speak
#[test]
fn dog_speaks() {
    let d = Dog { name: "Rex".to_string() };
    assert_eq!(d.sound(), "woof");
    assert_eq!(d.speak(), "Rex says woof");
}

/// robot overrides speak
#[test]
fn robot_overrides() {
    assert_eq!(Robot.name(), "R2");
    assert_eq!(Robot.sound(), "beep");
    assert_eq!(Robot.speak(), "BEEP BOOP");
}

/// works through a trait object
#[test]
fn trait_objects() {
    let zoo: Vec<Box<dyn Animal>> = vec![Box::new(Dog { name: "Fido".to_string() }), Box::new(Robot)];
    let lines: Vec<String> = zoo.iter().map(|a| a.speak()).collect();
    assert_eq!(lines, vec!["Fido says woof", "BEEP BOOP"]);
}
```

#### Uses
- [Traits › Defining and implementing](#/traits/defining-and-implementing)
- [Ownership › Clone](#/ownership/clone)

#### Hints
- A default method can call the trait's other methods: `self.name()` and `self.sound()` work inside `speak`.
- `Dog::name` only has `&self`, so it can't move the `String` field out. Return a clone of it.
- To override, write `speak` inside `impl Animal for Robot`. That replaces the default for `Robot` only.

#### Tips
- Keep required methods small and put shared behavior in defaults: implementors get it for free and can still override it.

#### Docs
- [Rust book: Default implementations](https://doc.rust-lang.org/book/ch10-02-traits.html#default-implementations)

### 3. Custom ordering

Tasks sort by `priority`, highest first, and ties sort by `name` alphabetically. A derived `Ord` would compare `priority` ascending, so implement `cmp` yourself. `PartialOrd` already delegates to it.

```rust starter
use std::cmp::Ordering;

#[derive(Debug, PartialEq, Eq)]
pub struct Task {
    pub priority: u8,
    pub name: String,
}

impl Ord for Task {
    fn cmp(&self, other: &Self) -> Ordering {
        todo!()
    }
}

impl PartialOrd for Task {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
```

```rust test
fn task(priority: u8, name: &str) -> Task {
    Task { priority, name: name.to_string() }
}

/// higher priority sorts first
#[test]
fn priority_first() {
    assert!(task(9, "b") < task(1, "a"));
}

/// ties break by name
#[test]
fn name_breaks_ties() {
    let mut tasks = vec![task(1, "write"), task(5, "deploy"), task(5, "build"), task(3, "test")];
    tasks.sort();
    let names: Vec<&str> = tasks.iter().map(|t| t.name.as_str()).collect();
    assert_eq!(names, vec!["build", "deploy", "test", "write"]);
}

/// min() finds the most urgent
#[test]
fn min_is_most_urgent() {
    let tasks = vec![task(2, "a"), task(7, "z"), task(7, "m")];
    assert_eq!(tasks.into_iter().min().unwrap().name, "m");
}
```

#### Uses
- [Traits › Implementing them by hand](#/traits/implementing-them-by-hand)
- [Traits › Deriving the standard traits](#/traits/deriving-the-standard-traits)

#### Hints
- For "highest first", compare the other way round: start from `other.priority` and compare it with `self.priority`.
- Chain the tie-break with `.then_with(|| ...)`, comparing the names in the normal order.

#### Tips
- `sort`, `min` and `max` all go through your `cmp`, so this one impl sets the order everywhere tasks are compared.

#### Docs
- [std: Ord](https://doc.rust-lang.org/std/cmp/trait.Ord.html)
- [std: Ordering::then_with](https://doc.rust-lang.org/std/cmp/enum.Ordering.html#method.then_with)

### 4. Shapes behind `dyn`

Implement `Shape` for `Rect` (area `w * h`, name `"rect"`) and `Circle` (area `PI * r * r` using `std::f64::consts::PI`, name `"circle"`). Then write `total_area`, summing any mix of shapes, and `largest_name`, the name of the shape with the biggest area (`None` for an empty slice).

```rust starter
pub trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> String;
}

pub struct Rect {
    pub w: f64,
    pub h: f64,
}

pub struct Circle {
    pub r: f64,
}

impl Shape for Rect {
    fn area(&self) -> f64 { todo!() }
    fn name(&self) -> String { todo!() }
}

impl Shape for Circle {
    fn area(&self) -> f64 { todo!() }
    fn name(&self) -> String { todo!() }
}

pub fn total_area(shapes: &[Box<dyn Shape>]) -> f64 {
    todo!()
}

pub fn largest_name(shapes: &[Box<dyn Shape>]) -> Option<String> {
    todo!()
}
```

```rust test
use std::f64::consts::PI;

/// each shape computes its area
#[test]
fn areas() {
    assert_eq!(Rect { w: 2.0, h: 3.0 }.area(), 6.0);
    assert_eq!(Circle { r: 1.0 }.area(), PI);
}

/// sums a mixed collection
#[test]
fn sums_mixed() {
    let shapes: Vec<Box<dyn Shape>> = vec![Box::new(Rect { w: 2.0, h: 3.0 }), Box::new(Circle { r: 2.0 })];
    assert_eq!(total_area(&shapes), 6.0 + 4.0 * PI);
    assert_eq!(total_area(&[]), 0.0);
}

/// finds the largest
#[test]
fn largest() {
    let shapes: Vec<Box<dyn Shape>> = vec![Box::new(Circle { r: 1.0 }), Box::new(Rect { w: 2.0, h: 2.0 })];
    assert_eq!(largest_name(&shapes), Some("rect".to_string()));
    assert_eq!(largest_name(&[]), None);
}
```

#### Uses
- [Traits › Traits as parameters: `impl Trait` and `dyn Trait`](#/traits/traits-as-parameters-impl-trait-and-dyn-trait)
- [Enums & match › Option: an enum instead of null](#/enums/option-an-enum-instead-of-null)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- `total_area` is the article's `total` function: a `let mut sum = 0.0` and a `for` loop over the slice.
- For `largest_name`, keep two variables across the loop: the best area so far, and the best name as an `Option<String>` that starts at `None`.
- Start the best area below any real one (areas are never negative, so `-1.0` works). Whenever a shape beats it, update both.

#### Tips
- `f64` isn't `Ord`, because `NaN` has no place in an order, so you can't `.sort()` floats the way you sort integers. Comparing with `>` by hand, as here, is the usual way round it.

#### Docs
- [Rust book: Using trait objects](https://doc.rust-lang.org/book/ch18-02-trait-objects.html)
