# Modules & crates

Modules organize code inside a crate and decide what the rest of the program can see; crates are the unit of compilation and of sharing. Everything is private by default, and `pub` is how you opt in.

## Packages, crates and modules

Three words with distinct meanings:

- A **package** is what `cargo new` creates: a directory with a `Cargo.toml`.
- A **crate** is one compilation unit, either a *binary* with a `fn main` (`src/main.rs`) or a *library* (`src/lib.rs`). A package can hold one library and any number of binaries.
- A **module** is a named scope inside a crate. Modules nest, forming a tree whose root is the crate itself, called `crate`.

Crates are also what you share. Dependencies go in `Cargo.toml` and come from [crates.io](https://crates.io):

```toml
[dependencies]
rand = "0.9"
serde = { version = "1", features = ["derive"] }
```

`cargo add rand` edits the file for you. The standard library is a crate too, named `std`, which is why its paths look like `std::collections::HashMap`. A few of its items, such as `Vec`, `String`, `Option` and `println!`, are imported into every file automatically. That set is called the *prelude*.

## Declaring modules

`mod` declares a module. Its body can be inline:

```rust
mod geometry {
    pub fn area(width: f64, height: f64) -> f64 {
        width * height
    }
}

fn main() {
    println!("{}", geometry::area(2.0, 3.0));
}
```

Or it can live in its own file. Writing `mod geometry;` with a semicolon tells the compiler to load `src/geometry.rs` (or `src/geometry/mod.rs`). Unlike Python or JavaScript, where every file is automatically a module, a Rust file is only compiled if some `mod` declaration points to it. The module tree is declared in code, and the file layout follows it.

## Privacy

Every item is private to the module it's defined in unless it's marked `pub`:

```rust
mod kitchen {
    pub fn serve() -> String {
        format!("served: {}", secret_sauce())
    }

    fn secret_sauce() -> &'static str {
        "tomato"
    }
}

fn main() {
    println!("{}", kitchen::serve());
    kitchen::secret_sauce();
    // error[E0603]: function `secret_sauce` is private
}
```

Private means "visible in this module and the modules nested inside it". A child can use its parent's private items, but a parent can't see into its children, and siblings can't see each other's private items.

Between private and `pub` there are finer settings: `pub(crate)` is visible anywhere in this crate but not to other crates, and `pub(super)` only to the parent module.

## Paths

Items are named by paths, with `::` as the separator:

- `crate::a::b` is absolute, starting from the crate root.
- `super::b` starts from the parent module, like `..` in a file path.
- `self::b` starts from the current module.
- A bare `a::b` starts from whatever is in scope in the current module.

```rust
const TAX_RATE: f64 = 0.2;

mod shop {
    pub mod pricing {
        pub fn with_tax(price: f64) -> f64 {
            price * (1.0 + crate::TAX_RATE)
        }

        pub fn with_tax_and_fee(price: f64) -> f64 {
            self::with_tax(price) + super::FEE
        }
    }

    const FEE: f64 = 1.5; // private to `shop`, still visible to its child `pricing`
}

fn main() {
    println!("{}", shop::pricing::with_tax_and_fee(10.0));
}
```

## `use`

`use` creates a shortcut to a path, for the rest of the current module:

```rust
use std::collections::HashMap;
use std::fmt::{self, Display};    // several items from one module; `self` is `fmt` itself
use std::io::Result as IoResult; // rename to avoid a clash

let mut ages: HashMap<String, u32> = HashMap::new();
```

The convention is to `use` types, structs and enums by their own name (`HashMap`), but functions through their parent module (`use std::mem;` then `mem::swap(...)`), so a call site shows where a function comes from.

`pub use` re-exports an item: it becomes part of your module's public interface under the new path. Libraries use it to offer short paths (`mylib::Client`) while keeping their internals organized in deeper modules (`mylib::http::client::Client`).

`use some_module::*` imports every public item. It's common in tests and preludes and best avoided elsewhere, because it hides where names come from.

## Visibility of struct fields

Making a struct `pub` does not make its fields public. Each field needs its own `pub`:

```rust
mod bank {
    pub struct Account {
        pub owner: String,
        balance: u64,
    }

    impl Account {
        pub fn open(owner: &str) -> Account {
            Account { owner: owner.to_string(), balance: 0 }
        }

        pub fn balance(&self) -> u64 {
            self.balance
        }
    }
}

fn main() {
    let acct = bank::Account::open("Ada");
    println!("{} has {}", acct.owner, acct.balance());
    let rich = bank::Account { owner: String::from("Eve"), balance: 1_000_000 };
    // error[E0451]: field `balance` of struct `Account` is private
}
```

With one private field, code outside `bank` can no longer build an `Account` with a struct literal, and has to go through `open`. That's how Rust types protect their invariants: whatever `open` and the other methods guarantee about `balance` is guaranteed everywhere. There are no getters and setters by default; you write the ones you want.

Enums work the other way: if the enum is `pub`, all its variants and their fields are public.

## Test modules

You have now seen everything in the wrapper that runs your exercise tests:

```rust
pub fn double(x: i32) -> i32 {
    x * 2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles() {
        assert_eq!(double(21), 42);
    }
}

fn main() {}
```

`#[cfg(test)]` compiles the module only for `cargo test`. `tests` is a child of the crate root, so `use super::*` imports everything from its parent, private items included. Rust unit tests live in the same file as the code they test.

```rust playground
mod inventory {
    pub struct Stock {
        pub name: String,
        count: u32,
    }

    impl Stock {
        pub fn new(name: &str) -> Stock {
            Stock { name: name.to_string(), count: 0 }
        }

        pub fn count(&self) -> u32 {
            self.count
        }

        pub fn restock(&mut self, amount: u32) {
            self.count = helpers::capped(self.count + amount);
        }
    }

    mod helpers {
        pub fn capped(n: u32) -> u32 {
            n.min(crate::MAX_STOCK)
        }
    }
}

const MAX_STOCK: u32 = 100;

use inventory::Stock;

fn main() {
    let mut tea = Stock::new("tea");
    tea.restock(40);
    tea.restock(90);
    println!("{}: {} (capped at {MAX_STOCK})", tea.name, tea.count());

    // Try: call inventory::helpers::capped(500) here and read the error.
}
```

## Exercises

### 1. Nested modules

Fill in the three functions. `cube_volume` and `cube_surface` live in the child module `solids`; reach the parent's `square_area` with `super::square_area` rather than repeating the formula.

```rust starter
pub mod geometry {
    pub fn square_area(side: f64) -> f64 {
        todo!()
    }

    pub mod solids {
        pub fn cube_volume(side: f64) -> f64 {
            todo!()
        }

        pub fn cube_surface(side: f64) -> f64 {
            todo!()
        }
    }
}
```

```rust test
/// area of a square
#[test]
fn square() {
    assert_eq!(geometry::square_area(3.0), 9.0);
    assert_eq!(geometry::square_area(0.5), 0.25);
}

/// volume of a cube
#[test]
fn volume() {
    assert_eq!(geometry::solids::cube_volume(2.0), 8.0);
    assert_eq!(geometry::solids::cube_volume(3.0), 27.0);
}

/// surface of a cube is six faces
#[test]
fn surface() {
    assert_eq!(geometry::solids::cube_surface(2.0), 24.0);
    assert_eq!(geometry::solids::cube_surface(3.0), 54.0);
    assert_eq!(geometry::solids::cube_surface(1.0), 6.0);
}
```

#### Uses
- [Modules & crates › Paths](#/modules/paths)
- [Modules & crates › Declaring modules](#/modules/declaring-modules)

#### Hints
- `square_area` is just `side * side`.
- Inside `solids`, `super::square_area(side)` calls the parent's function. A cube's volume is that times `side`, and its surface is six of them.

#### Tips
- The absolute path `crate::geometry::square_area` works too, but `super::` keeps working if you move both modules somewhere else together.
- Both `pub`s are needed on the nested module: `pub mod solids` makes the module visible, and `pub fn` makes each function visible. Marking only the module gets you `error[E0603]: function is private`.
- A child can see its parent's private items, but not the other way round. That's why `super::square_area` would work even if `square_area` weren't `pub` — it's the tests, outside the module, that need it.

#### Docs
- [Book: Starting relative paths with `super`](https://doc.rust-lang.org/book/ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html#starting-relative-paths-with-super)
- [Rust by Example: `super` and `self`](https://doc.rust-lang.org/rust-by-example/mod/super.html)

### 2. A clock that stays valid

`Clock` stores minutes since midnight in a private field, always below `crate::MINUTES_PER_DAY`. Because the field is private, code outside `clock` (the tests included) can only get a `Clock` from `new` or `add_minutes`, so as long as those two keep the invariant, every `Clock` is valid.

`new` accepts any hours and minutes and wraps around the day: `new(25, 70)` is `02:10`. `display` formats the time as `HH:MM`; `{:02}` pads a number with zeros to two digits, so `format!("{:02}", 5)` is `"05"`.

```rust starter
pub const MINUTES_PER_DAY: u32 = 24 * 60;

pub mod clock {
    #[derive(Debug, PartialEq)]
    pub struct Clock {
        minutes: u32,
    }

    impl Clock {
        pub fn new(hours: u32, minutes: u32) -> Clock {
            Clock { minutes: hours * 60 + minutes }
        }

        pub fn add_minutes(&self, minutes: u32) -> Clock {
            todo!()
        }

        pub fn display(&self) -> String {
            todo!()
        }
    }
}
```

```rust test
use super::clock::Clock;

/// formats as HH:MM
#[test]
fn formats() {
    assert_eq!(Clock::new(9, 5).display(), "09:05");
    assert_eq!(Clock::new(0, 0).display(), "00:00");
    assert_eq!(Clock::new(13, 45).display(), "13:45");
    assert_eq!(Clock::new(23, 59).display(), "23:59");
}

/// wraps hours and minutes around the day
#[test]
fn wraps() {
    assert_eq!(Clock::new(25, 70).display(), "02:10");
    assert_eq!(Clock::new(0, 1500).display(), "01:00");
    assert_eq!(Clock::new(47, 60).display(), "00:00");
    assert_eq!(Clock::new(24, 0), Clock::new(0, 0));
}

/// adding minutes crosses midnight
#[test]
fn adds() {
    assert_eq!(Clock::new(10, 15).add_minutes(0).display(), "10:15");
    assert_eq!(Clock::new(10, 15).add_minutes(50).display(), "11:05");
    assert_eq!(Clock::new(23, 59).add_minutes(2).display(), "00:01");
    assert_eq!(Clock::new(8, 0).add_minutes(3 * 24 * 60 + 30).display(), "08:30");
}

/// the result of add_minutes is wrapped too
#[test]
fn adds_wrapped() {
    assert_eq!(Clock::new(23, 0).add_minutes(60), Clock::new(0, 0));
    assert_eq!(Clock::new(10, 0).add_minutes(24 * 60), Clock::new(10, 0));
}
```

#### Uses
- [Modules & crates › Visibility of struct fields](#/modules/visibility-of-struct-fields)
- [Modules & crates › Paths](#/modules/paths)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- Keeping the invariant is one `%`: the remainder after dividing by `crate::MINUTES_PER_DAY` is always below it. Apply it in `new`.
- `add_minutes` builds a new `Clock` from `self.minutes + minutes`, wrapped the same way.
- `display` needs hours and minutes back: `self.minutes / 60` and `self.minutes % 60`, each formatted with `{:02}`.

#### Tips
- `Clock::new(24, 0) == Clock::new(0, 0)` holds because the derived `PartialEq` compares the stored minutes, and both are 0 once `new` wraps.
- Wrap in `new` and in `add_minutes`, not in `display`. Keeping the invariant where values are *created* means every later method can just trust it; fixing it up at the point of display would let an invalid `Clock` exist in between.
- `hours * 60 + minutes` can overflow a `u32` before you ever take the remainder. The tests stay well inside the range, but in real code you'd reduce the hours first.

#### Docs
- [Book: Making structs and enums public](https://doc.rust-lang.org/book/ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html#making-structs-and-enums-public)
- [std::fmt: Sign/#/0](https://doc.rust-lang.org/std/fmt/index.html#sign0)

### 3. Shopping cart

The crate has two modules: `catalog` defines `Item`, and `cart` imports it with `use super::catalog::Item;`. At the bottom, `pub use` re-exports both types at the crate root, which is why the tests can write `Cart` and `Item` without module paths.

Implement the `Cart` methods. `remove` takes out the first item with that name and reports whether it found one; `self.items.remove(i)` removes the element at index `i`.

The methods only borrow the cart, so `for item in self.items` won't compile: it would move the items out. Loop over the indexes instead, `for i in 0..self.items.len()`, and read each item as `self.items[i]`. `self.items[i].name == name` compares the stored `String` with the `&str` directly.

```rust starter
pub mod catalog {
    #[derive(Debug, Clone, PartialEq)]
    pub struct Item {
        pub name: String,
        pub price_cents: u32,
    }
}

pub mod cart {
    use super::catalog::Item;

    pub struct Cart {
        items: Vec<Item>,
    }

    impl Cart {
        pub fn new() -> Cart {
            Cart { items: Vec::new() }
        }

        pub fn add(&mut self, item: Item) {
            todo!()
        }

        pub fn count(&self) -> usize {
            todo!()
        }

        pub fn total_cents(&self) -> u32 {
            todo!()
        }

        pub fn remove(&mut self, name: &str) -> bool {
            todo!()
        }
    }
}

pub use cart::Cart;
pub use catalog::Item;
```

```rust test
fn item(name: &str, price_cents: u32) -> Item {
    Item { name: name.to_string(), price_cents }
}

/// a new cart is empty
#[test]
fn empty() {
    let cart = Cart::new();
    assert_eq!(cart.count(), 0);
    assert_eq!(cart.total_cents(), 0);
}

/// adds items and totals prices
#[test]
fn totals() {
    let mut cart = Cart::new();
    cart.add(item("tea", 350));
    cart.add(item("scone", 275));
    cart.add(item("tea", 350));
    assert_eq!(cart.count(), 3);
    assert_eq!(cart.total_cents(), 975);
}

/// removes one item by name
#[test]
fn removes() {
    let mut cart = Cart::new();
    cart.add(item("tea", 350));
    cart.add(item("tea", 350));
    assert_eq!(cart.remove("tea"), true);
    assert_eq!(cart.count(), 1);
    assert_eq!(cart.remove("coffee"), false);
    assert_eq!(cart.total_cents(), 350);
    assert_eq!(cart.remove("tea"), true);
    assert_eq!(cart.remove("tea"), false);
    assert_eq!(cart.count(), 0);
}

/// removes the first item with that name, not a later one
#[test]
fn removes_first() {
    let mut cart = Cart::new();
    cart.add(item("tea", 350));
    cart.add(item("scone", 275));
    cart.add(item("tea", 400));
    assert_eq!(cart.remove("tea"), true);
    assert_eq!(cart.count(), 2);
    assert_eq!(cart.total_cents(), 675);
}

/// removing from an empty cart finds nothing
#[test]
fn removes_from_empty() {
    let mut cart = Cart::new();
    assert_eq!(cart.remove("tea"), false);
    assert_eq!(cart.count(), 0);
}
```

#### Uses
- [Modules & crates › `use`](#/modules/use)
- [Modules & crates › Visibility of struct fields](#/modules/visibility-of-struct-fields)
- [Structs & methods › Methods](#/structs/methods)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- `add` and `count` are one line each: `push` onto `self.items`, and its `len()`.
- `total_cents` keeps a `let mut` total and adds `self.items[i].price_cents` for every index.
- `remove` walks the indexes too. On the first match, remove it and `return true` at once; after the loop, return `false`.

#### Tips
- Return right after removing. `remove` shifts every later item down one place, so carrying on with the same indexes would skip an item or run past the end.
- Once you've done Borrowing, `for item in &self.items` is the usual way to read every item without taking it.
- `items` is private, so `total_cents` is the only definition of what a cart costs. Make the field `pub` and every caller can compute its own, slightly different, total.
- `pub use` at the bottom is what lets the tests write `Cart` instead of `cart::Cart`. It's the standard way a library offers short paths at its root while keeping its internals in deeper modules.

#### Docs
- [std: `Vec::remove`](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.remove)
- [Book: Re-exporting names with `pub use`](https://doc.rust-lang.org/book/ch07-04-bringing-paths-into-scope-with-the-use-keyword.html#re-exporting-names-with-pub-use)
