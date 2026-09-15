# Structs & methods

A struct groups named fields into a new type, and an `impl` block attaches functions and methods to it. Whether a method takes `&self`, `&mut self` or `self` is ownership applied to your own types.

## Defining and creating

```rust
struct User {
    name: String,
    email: String,
    active: bool,
    logins: u32,
}

let mut user = User {
    name: String::from("Ada"),
    email: String::from("ada@example.com"),
    active: true,
    logins: 0,
};
user.logins += 1;
```

Every field must be given a value; there are no implicit `undefined` or `None` fields. Mutability belongs to the binding, so the whole struct is mutable or none of it is.

Two shorthands help. If a variable has the same name as a field, write it once. And `..other` fills the remaining fields from another instance:

```rust
struct User {
    name: String,
    email: String,
    active: bool,
}

let name = String::from("Grace");
let email = String::from("grace@example.com");
let grace = User { name, email, active: true };
let copy = User { email: String::from("g@example.com"), ..grace };
println!("{}", grace.name);
// error[E0382]: borrow of moved value: `grace.name`
```

That error is ownership again: `..grace` moved `grace.name` into `copy`. Fields that are `Copy`, like `active`, are copied instead.

A struct owns its fields, which is why they're `String` rather than `&str` here. Storing references in a struct is possible, but needs the lifetime annotations from a later module.

## Tuple structs and unit structs

A tuple struct has fields without names. The common use is a *newtype*, a distinct type that wraps a single value:

```rust
struct Meters(f64);
struct Seconds(f64);

let distance = Meters(100.0);
let time = Seconds(9.58);
let speed = distance.0 / time.0;
```

`Meters` and `Seconds` both hold an `f64`, but you can't pass one where the other is expected. That's a cheap way to make unit mix-ups a compile error. A struct with no fields at all, `struct Marker;`, is a unit struct, useful later with traits.

## Methods

Methods live in an `impl` block. Their first parameter says how they use the instance:

```rust
struct Counter {
    count: u32,
}

impl Counter {
    // Associated function: no self. Called as Counter::new().
    fn new() -> Self {
        Self { count: 0 }
    }

    // &self: reads the counter.
    fn get(&self) -> u32 {
        self.count
    }

    // &mut self: changes it. Needs a mutable binding at the call site.
    fn increment(&mut self) {
        self.count += 1;
    }

    // self: takes ownership and consumes the counter.
    fn finish(self) -> u32 {
        self.count
    }
}

let mut c = Counter::new();
c.increment();
c.increment();
println!("{}", c.get());
let total = c.finish();
```

`Self` is an alias for the type the `impl` is for. `&self` *borrows* the instance: the method gets a reference it can read through, and the caller keeps ownership. `&mut self` borrows it mutably, so the method can change fields in place. The Borrowing module covers references in depth; for methods, the compiler adds the `&` or `&mut` at the call site for you, so `c.increment()` means `Counter::increment(&mut c)`.

Rust has no constructors. `new` is just a naming convention for an associated function that returns `Self`, and a type can have as many as it needs, such as `Counter::starting_at(10)`.

A method that takes `self` by value uses up the instance, the same way passing a `String` to a function does:

```rust
struct Counter {
    count: u32,
}

impl Counter {
    fn finish(self) -> u32 {
        self.count
    }
}

let c = Counter { count: 3 };
let total = c.finish();
println!("{}", c.count);
// error[E0382]: borrow of moved value: `c`
```

That's how an API says "after this call, the old value is gone": converting a builder into the finished object, or closing a connection.

## Deriving common behavior

A new struct can't do much by default. It can't be printed, compared or copied:

```rust
struct Point {
    x: i32,
    y: i32,
}

let p = Point { x: 1, y: 2 };
println!("{:?}", p);
// error[E0277]: `Point` doesn't implement `Debug`
```

The `#[derive]` attribute generates the standard implementations for you:

```rust
#[derive(Debug, Clone, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}

let a = Point { x: 1, y: 2 };
let b = a.clone();
println!("{a:?} {}", a == b); // Point { x: 1, y: 2 } true
println!("{a:#?}");            // pretty-printed over several lines
```

- `Debug` enables `{:?}`, and `assert_eq!` needs it to print a failure.
- `Clone` enables `.clone()`, as long as every field is `Clone`.
- `PartialEq` enables `==` and `!=`, comparing field by field.
- `Copy` (together with `Clone`) makes the type copy instead of move, which is only allowed when every field is `Copy`.
- `Default` gives `Point::default()` with every field at its default: zero, `false`, an empty string.

These are traits, Rust's version of interfaces. The Traits module shows how to implement them by hand.

```rust playground
#[derive(Debug, Clone, PartialEq)]
struct Rect {
    width: u32,
    height: u32,
}

impl Rect {
    fn square(size: u32) -> Self {
        Self { width: size, height: size }
    }

    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn scale(&mut self, factor: u32) {
        self.width *= factor;
        self.height *= factor;
    }

    fn can_hold(&self, other: &Rect) -> bool {
        self.width > other.width && self.height > other.height
    }
}

fn main() {
    let mut r = Rect { width: 3, height: 4 };
    let sq = Rect::square(2);
    println!("{r:?} has area {}", r.area());
    println!("can hold {sq:?}? {}", r.can_hold(&sq));

    r.scale(10);
    println!("scaled: {r:?}");
    println!("same as a clone? {}", r == r.clone());

    // Try: remove Debug from the derive list and read the error.
}
```

## Exercises

### 1. Rectangles

Implement three methods on `Rect`: `area`, `is_square`, and `can_hold`, which is true when `other` fits strictly inside `self` in both directions (no rotating). `other` is borrowed as a `&Rect`, just like `&self`, and you read its fields the same way: `other.width`.

```rust starter
pub struct Rect {
    pub width: u32,
    pub height: u32,
}

impl Rect {
    pub fn area(&self) -> u32 {
        todo!()
    }

    pub fn is_square(&self) -> bool {
        todo!()
    }

    pub fn can_hold(&self, other: &Rect) -> bool {
        todo!()
    }
}
```

```rust test
/// area is width times height
#[test]
fn area() {
    assert_eq!(Rect { width: 3, height: 4 }.area(), 12);
}

/// detects squares
#[test]
fn square() {
    assert_eq!(Rect { width: 5, height: 5 }.is_square(), true);
    assert_eq!(Rect { width: 5, height: 6 }.is_square(), false);
}

/// can_hold needs room in both directions
#[test]
fn holds() {
    let big = Rect { width: 10, height: 8 };
    assert_eq!(big.can_hold(&Rect { width: 2, height: 2 }), true);
    assert_eq!(big.can_hold(&Rect { width: 2, height: 9 }), false);
    assert_eq!(big.can_hold(&Rect { width: 10, height: 1 }), false);
}
```

#### Uses
- [Structs & methods › Methods](#/structs/methods)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- Inside a method, the instance's fields are `self.width` and `self.height`.
- `is_square` is one comparison. `can_hold` is two comparisons joined with `&&`.

#### Tips
- "Strictly inside" means `>`, not `>=`. The last test has a rectangle of exactly the same width.

#### Docs
- [Book: Method syntax](https://doc.rust-lang.org/book/ch05-03-method-syntax.html)
- [Book: Methods with more parameters](https://doc.rust-lang.org/book/ch05-03-method-syntax.html#methods-with-more-parameters)

### 2. Bank account

Write an `Account` with a constructor and three methods. Amounts are in cents. `withdraw` returns `false` and leaves the balance alone if there isn't enough money. Notice which methods take `&self` and which take `&mut self`. `owner.to_string()` turns the borrowed `&str` into the `String` the struct stores.

```rust starter
pub struct Account {
    pub owner: String,
    balance: u64,
}

impl Account {
    pub fn new(owner: &str) -> Self {
        todo!()
    }

    pub fn balance(&self) -> u64 {
        todo!()
    }

    pub fn deposit(&mut self, cents: u64) {
        todo!()
    }

    pub fn withdraw(&mut self, cents: u64) -> bool {
        todo!()
    }
}
```

```rust test
/// a new account is empty
#[test]
fn new_account() {
    let acct = Account::new("Ada");
    assert_eq!(acct.owner, "Ada");
    assert_eq!(acct.balance(), 0);
}

/// deposits add up
#[test]
fn deposits() {
    let mut acct = Account::new("Ada");
    acct.deposit(500);
    acct.deposit(250);
    assert_eq!(acct.balance(), 750);
}

/// withdrawals check the balance
#[test]
fn withdrawals() {
    let mut acct = Account::new("Ada");
    acct.deposit(100);
    assert_eq!(acct.withdraw(30), true);
    assert_eq!(acct.withdraw(100), false);
    assert_eq!(acct.balance(), 70);
}
```

#### Uses
- [Structs & methods › Methods](#/structs/methods)
- [Structs & methods › Defining and creating](#/structs/defining-and-creating)
- [Functions › Implicit return](#/functions/implicit-return)

#### Hints
- `new` builds the struct with `Self { ... }`: the owner as a `String`, and a balance of 0.
- `deposit` is one line with `+=` on `self.balance`.
- In `withdraw`, check first: if `cents` is more than the balance, `return false` early. Otherwise subtract and end with `true`.

#### Tips
- Check before you subtract. A `u64` can't go below zero, so taking out too much would panic instead of returning `false`.

#### Docs
- [Book: Associated functions](https://doc.rust-lang.org/book/ch05-03-method-syntax.html#associated-functions)
- [Book: Method syntax](https://doc.rust-lang.org/book/ch05-03-method-syntax.html)

### 3. Temperature newtypes

`Celsius` and `Fahrenheit` are tuple structs wrapping an `f64`, so the two can't be mixed up. Implement the conversion method on each. The formula is `f = c * 9 / 5 + 32`. Read the wrapped value with `.0`.

```rust starter
pub struct Celsius(pub f64);
pub struct Fahrenheit(pub f64);

impl Celsius {
    pub fn to_fahrenheit(&self) -> Fahrenheit {
        todo!()
    }
}

impl Fahrenheit {
    pub fn to_celsius(&self) -> Celsius {
        todo!()
    }
}
```

```rust test
/// Celsius to Fahrenheit
#[test]
fn c_to_f() {
    assert_eq!(Celsius(100.0).to_fahrenheit().0, 212.0);
    assert_eq!(Celsius(-40.0).to_fahrenheit().0, -40.0);
}

/// Fahrenheit to Celsius
#[test]
fn f_to_c() {
    assert_eq!(Fahrenheit(32.0).to_celsius().0, 0.0);
    assert_eq!(Fahrenheit(212.0).to_celsius().0, 100.0);
}
```

#### Uses
- [Structs & methods › Tuple structs and unit structs](#/structs/tuple-structs-and-unit-structs)
- [Variables & types › No implicit conversions](#/basics/no-implicit-conversions)

#### Hints
- Build the result by calling the type like a function: `Fahrenheit(...)` with the converted number inside.
- The field is an `f64`, so write the constants as floats: `9.0`, `5.0`, `32.0`.
- Going back, undo the steps in reverse order: `c = (f - 32) * 5 / 9`.

#### Tips
- Both methods take `&self`, so the original temperature stays usable after converting it.

#### Docs
- [Book: Creating different types with tuple structs](https://doc.rust-lang.org/book/ch05-01-defining-structs.html#creating-different-types-with-tuple-structs)

### 4. Request builder

Build a `Request` step by step. `Request::get(url)` starts a `GET` request with no headers. `method` and `header` take `self` by value, change it, and return it, so calls chain: `Request::get("/").method("POST").header("Accept", "text/html")`.

Each method takes ownership of the request and hands it back, so no copies are made along the way. To change the request inside such a method, declare the parameter `mut self`, just like `mut s: String` for an ordinary parameter. `.to_string()` turns a `&str` into an owned `String` for storing in the struct, and `headers.push((key, value))` adds a pair to the Vec.

```rust starter
#[derive(Debug, Clone, PartialEq)]
pub struct Request {
    pub url: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
}

impl Request {
    pub fn get(url: &str) -> Self {
        todo!()
    }

    pub fn method(self, method: &str) -> Self {
        self
    }

    pub fn header(self, key: &str, value: &str) -> Self {
        self
    }
}
```

```rust test
/// get starts a GET request
#[test]
fn starts_as_get() {
    let r = Request::get("/home");
    assert_eq!(r.url, "/home");
    assert_eq!(r.method, "GET");
    assert_eq!(r.headers.len(), 0);
}

/// methods chain
#[test]
fn chains() {
    let r = Request::get("/api").method("POST").header("Accept", "json").header("X-Id", "7");
    let expected = Request {
        url: "/api".to_string(),
        method: "POST".to_string(),
        headers: vec![
            ("Accept".to_string(), "json".to_string()),
            ("X-Id".to_string(), "7".to_string()),
        ],
    };
    assert_eq!(r, expected);
}
```

#### Uses
- [Structs & methods › Methods](#/structs/methods)
- [Ownership › Ownership and functions](#/ownership/ownership-and-functions)
- [Functions › Parameters are bindings too](#/functions/parameters-are-bindings-too)

#### Hints
- `get` builds a `Self { ... }` with the url, the method `"GET"`, and an empty `Vec::new()` for the headers. Every text field needs `.to_string()`.
- In `method` and `header`, change the signature to `mut self`, update the field, and end with `self` to hand the request back.
- `header` pushes one tuple: `self.headers.push((key.to_string(), value.to_string()))`.

#### Tips
- The struct update syntax is another way to write `method`: `Self { method: method.to_string(), ..self }` builds a new request from the old one's other fields.

#### Docs
- [Book: Method syntax](https://doc.rust-lang.org/book/ch05-03-method-syntax.html)
- [Rust by Example: Methods](https://doc.rust-lang.org/rust-by-example/fn/methods.html)
