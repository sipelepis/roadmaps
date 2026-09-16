# Generics & bounds

Generics let one function or type work over many types, and trait bounds say what those types must be able to do. The compiler checks the body against the bounds once, then generates a specialized copy for each concrete type you use, so generic code runs as fast as hand-written code.

## Generic functions

A type parameter goes in angle brackets. Without a bound, the body can do almost nothing with a `T`:

```rust
fn largest<T>(items: &[T]) -> &T {
    let mut best = &items[0];
    for x in items {
        if x > best {       // error[E0369]: binary operation `>` cannot be applied to type `&T`
            best = x;
        }
    }
    best
}
```

The compiler doesn't know that `T` can be compared, because nothing said so. Add a bound:

```rust
fn largest<T: PartialOrd>(items: &[T]) -> &T {
    let mut best = &items[0];
    for x in items {
        if x > best {
            best = x;
        }
    }
    best
}

println!("{}", largest(&[3, 9, 2]));        // 9
println!("{}", largest(&['a', 'z', 'q']));  // z
```

This is closer to TypeScript's `<T extends Comparable>` than to Python's duck typing or C++ templates: the body may only use what the bounds promise, and the check happens when the function is defined, not when someone calls it with the wrong type.

## Bound syntax

```rust
use std::fmt::{Debug, Display};

fn show<T: Display>(x: T) -> String { format!("<{x}>") }

fn show_too(x: impl Display) -> String { format!("<{x}>") }   // same thing, shorter

fn report<T, U>(label: T, value: U) -> String
where
    T: Display + Clone,
    U: Debug,
{
    format!("{label}: {value:?}")
}
```

`+` combines bounds. A `where` clause moves them out of the signature once it gets crowded; it means exactly the same thing.

## Generic structs and conditional methods

```rust
struct Pair<T> {
    a: T,
    b: T,
}

impl<T> Pair<T> {                        // for every T
    fn new(a: T, b: T) -> Self { Pair { a, b } }
    fn swap(self) -> Pair<T> { Pair { a: self.b, b: self.a } }
}

impl<T: PartialOrd> Pair<T> {            // only when T can be compared
    fn larger(&self) -> &T {
        if self.a >= self.b { &self.a } else { &self.b }
    }
}

let p = Pair::new(3, 7);
println!("{}", p.larger());              // 7
```

`impl<T>` declares the parameter before using it in `Pair<T>`. The second block adds `larger` only for types that support `>=`. Calling it on a `Pair` of some type without `PartialOrd` fails with `error[E0599]: the method larger exists for struct Pair<..>, but its trait bounds were not satisfied`.

`Option<T>`, `Result<T, E>`, `Vec<T>` and `HashMap<K, V>` are nothing more than generic enums and structs written this way.

## Monomorphization

The compiler turns each use into a concrete copy: `largest::<i32>` and `largest::<char>` are two separate functions in the binary. Calls are direct and can be inlined, so generics cost nothing at runtime. The price is compile time and binary size.

`dyn Trait` from the Traits module is the other trade: one copy of the code, and a vtable lookup per call. Default to generics; use `dyn` when you need values of different types in one collection or want smaller code.

When inference can't work out a type parameter, name it with the *turbofish* `::<>`: `"5".parse::<i32>()`, `Vec::<u8>::new()`.

## Blanket impls

An `impl` can itself be generic, covering every type that meets a bound:

```rust
use std::fmt::Display;

trait Shout {
    fn shout(&self) -> String;
}

impl<T: Display> Shout for T {
    fn shout(&self) -> String {
        self.to_string().to_uppercase()
    }
}

println!("{}", "hello".shout());   // HELLO
println!("{}", 42.shout());        // 42
```

The standard library does this constantly. `impl<T: Display> ToString for T` is the reason every `Display` type has `.to_string()`.

## Associated types

Some traits have a type slot the implementor fills in:

```rust
trait Container {
    type Item;
    fn get(&self, i: usize) -> Option<&Self::Item>;
    fn first(&self) -> Option<&Self::Item> {
        self.get(0)
    }
}

struct Shelf { books: Vec<String> }

impl Container for Shelf {
    type Item = String;
    fn get(&self, i: usize) -> Option<&String> {
        self.books.get(i)
    }
}
```

Compare a generic trait like `From<T>`. `String` implements `From<&str>`, `From<char>` and more: many impls per type. An associated type allows exactly one: a `Shelf` holds one kind of item. `Iterator` works this way (`type Item`), and you constrain it with `I: Iterator<Item = i32>`. You'll implement it in the next module.

Numbers can be parameters too: `fn sum<const N: usize>(xs: [i32; N]) -> i32` accepts arrays of any fixed length.

```rust playground
use std::fmt::Display;

struct Stack<T> {
    items: Vec<T>,
}

impl<T> Stack<T> {
    fn new() -> Self { Stack { items: Vec::new() } }
    fn push(&mut self, x: T) { self.items.push(x); }
    fn pop(&mut self) -> Option<T> { self.items.pop() }
    fn peek(&self) -> Option<&T> { self.items.last() }
}

impl<T: Display> Stack<T> {
    fn render(&self) -> String {
        let mut out = String::from("[");
        for (i, x) in self.items.iter().enumerate() {
            if i > 0 { out.push_str(", "); }
            out.push_str(&x.to_string());
        }
        out + "]"
    }
}

fn largest<T: PartialOrd>(items: &[T]) -> Option<&T> {
    let mut best = items.first()?;
    for x in items {
        if x > best { best = x; }
    }
    Some(best)
}

fn main() {
    let mut s = Stack::new();
    s.push(1);
    s.push(2);
    s.push(3);
    println!("{} peek={:?}", s.render(), s.peek());
    let top = s.pop();
    println!("popped {top:?}, left {}", s.render());

    let mut words: Stack<&str> = Stack::new();
    words.push("generic");
    println!("{}", words.render());

    println!("{:?} {:?} {:?}", largest(&[4, 8, 1]), largest(&["b", "a"]), largest::<f64>(&[]));
}

// Try: make a Stack<Vec<i32>> and call render(). Read the error, then use {:?} and a Debug bound instead.
```

## Exercises

### 1. Largest

`largest(items)` returns a reference to the largest item, or `None` for an empty slice. On ties, return the first. The starter has no bound on `T`, so the body you write won't compile until you add the right one.

```rust starter
pub fn largest<T>(items: &[T]) -> Option<&T> {
    todo!()
}
```

```rust test
/// works on numbers, chars and strings
#[test]
fn many_types() {
    assert_eq!(largest(&[3, 9, 2]), Some(&9));
    assert_eq!(largest(&['a', 'z', 'q']), Some(&'z'));
    let words = vec!["pear".to_string(), "zucchini".to_string(), "apple".to_string()];
    assert_eq!(largest(&words).map(|s| s.as_str()), Some("zucchini"));
}

/// finds it first, last, alone, or below zero
#[test]
fn any_position() {
    assert_eq!(largest(&[9, 3, 2]), Some(&9));
    assert_eq!(largest(&[1, 2, 3]), Some(&3));
    assert_eq!(largest(&[7]), Some(&7));
    assert_eq!(largest(&[-5, -2, -9]), Some(&-2));
    assert_eq!(largest(&[0.5, 2.5, 1.0]), Some(&2.5));
}

/// none for an empty slice
#[test]
fn empty() {
    let empty: [i32; 0] = [];
    assert_eq!(largest(&empty), None);
    let no_words: Vec<String> = Vec::new();
    assert_eq!(largest(&no_words), None);
}

/// returns the first of equal items
#[test]
fn first_on_ties() {
    let items = [(1, 'a'), (1, 'a')];
    assert!(std::ptr::eq(largest(&items).unwrap(), &items[0]));
    let items = [0, 5, 5, 3];
    assert!(std::ptr::eq(largest(&items).unwrap(), &items[1]));
}
```

#### Uses
- [Generics & bounds › Generic functions](#/generics/generic-functions)
- [Enums & match › Option: an enum instead of null](#/enums/option-an-enum-instead-of-null)
- [Reference › Option](#/reference/option)
- [Reference › Strings and &str](#/reference/strings-and-str)

#### Hints
- The bound you need is the one that makes `>` compile: `PartialOrd`.
- Handle the empty slice first: if `items.len()` is 0, return `None`. After that, `&items[0]` is a safe starting point, as in the article.
- Replace the best only on `>`, not `>=`, so ties keep the first. Wrap the answer in `Some`.

#### Tips
- The result is a reference into `items`, not a copy, so this works even for types that can't be cloned. That's why the signature says `Option<&T>` and not `Option<T>`.
- `>` and not `>=` is the whole of "ties keep the first". The last test uses `std::ptr::eq` to check *which* equal item came back, so equal values aren't enough to pass it.
- `PartialOrd` rather than `Ord` is what lets the test pass `f64`s. The price is that a slice containing `NaN` would give a meaningless answer rather than refusing to compile.

#### Docs
- [Rust book: Generic data types in function definitions](https://doc.rust-lang.org/book/ch10-01-syntax.html#in-function-definitions)

### 2. Conditional methods

Finish `Pair<T>`. `new` and `swap` must work for any `T`. `larger` (ties return `a`) needs `PartialOrd`, and `show`, which formats as `(a, b)`, needs `Display`. Split the `impl` into blocks with the right bounds.

```rust starter
pub struct Pair<T> {
    pub a: T,
    pub b: T,
}

impl<T> Pair<T> {
    pub fn new(a: T, b: T) -> Self {
        todo!()
    }

    pub fn swap(self) -> Pair<T> {
        todo!()
    }

    pub fn larger(&self) -> &T {
        todo!()
    }

    pub fn show(&self) -> String {
        todo!()
    }
}
```

```rust test
struct Opaque(u8);

/// swap works for any type
#[test]
fn swaps_anything() {
    let p = Pair::new(Opaque(1), Opaque(2)).swap();
    assert_eq!((p.a.0, p.b.0), (2, 1));
    let p = Pair::new(Opaque(7), Opaque(8)).swap().swap();
    assert_eq!((p.a.0, p.b.0), (7, 8));
}

/// larger compares
#[test]
fn larger() {
    assert_eq!(*Pair::new(3, 9).larger(), 9);
    assert_eq!(*Pair::new(9, 3).larger(), 9);
    assert_eq!(*Pair::new(1.5, -2.0).larger(), 1.5);
    assert_eq!(Pair::new("b".to_string(), "a".to_string()).larger(), "b");
}

/// larger returns a on a tie
#[test]
fn larger_tie() {
    let p = Pair::new(5, 5);
    assert!(std::ptr::eq(p.larger(), &p.a));
    let p = Pair::new("same", "same");
    assert!(std::ptr::eq(p.larger(), &p.a));
}

/// show formats with Display
#[test]
fn shows() {
    assert_eq!(Pair::new('x', 'y').show(), "(x, y)");
    assert_eq!(Pair::new(1, 2).swap().show(), "(2, 1)");
    assert_eq!(Pair::new("hi", "there").show(), "(hi, there)");
}
```

#### Uses
- [Generics & bounds › Generic structs and conditional methods](#/generics/generic-structs-and-conditional-methods)
- [Generics & bounds › Bound syntax](#/generics/bound-syntax)

#### Hints
- Keep `new` and `swap` in `impl<T>`. Move `larger` into an `impl<T: PartialOrd> Pair<T>` block and `show` into one bounded by `Display` (`use std::fmt::Display;`).
- `larger` returns a reference, `&self.a` or `&self.b`, with `>=` so a tie picks `a`.
- `show` is a `format!` of `self.a` and `self.b`.

#### Tips
- A method in a bounded block doesn't exist for other types. `Pair<Opaque>` can still `swap`, and calling `show` on it is a compile error, not a runtime one.
- Putting all four methods in one `impl<T: PartialOrd + Display> Pair<T>` also compiles, and then `Opaque` loses `new` and `swap` and the first test stops building. Bounds belong on the smallest block that needs them.
- `swap` takes `self` by value, which is what lets it move the two fields into a new pair without cloning either. `&self` would force `T: Clone`.

#### Docs
- [Rust book: Using trait bounds to conditionally implement methods](https://doc.rust-lang.org/book/ch10-02-traits.html#using-trait-bounds-to-conditionally-implement-methods)

### 3. A blanket impl

Make every `Debug` type `Describe`-able: `describe` returns its `{:?}` form in angle brackets, so `5.describe()` is `"<5>"`. Then write `describe_all`, which describes each item and joins them with a space. Both need a bound you'll have to add.

To join, collect the descriptions in a `Vec<String>` and call `.join(" ")` on it: that returns one `String` with a space between each pair of pieces.

```rust starter
pub trait Describe {
    fn describe(&self) -> String;
}

impl<T> Describe for T {
    fn describe(&self) -> String {
        todo!()
    }
}

pub fn describe_all<T>(items: &[T]) -> String {
    todo!()
}
```

```rust test
/// numbers, strings and vectors
#[test]
fn describes() {
    assert_eq!(5.describe(), "<5>");
    assert_eq!("hi".describe(), "<\"hi\">");
    assert_eq!(vec![1, 2].describe(), "<[1, 2]>");
    assert_eq!(Some('x').describe(), "<Some('x')>");
}

/// your own Debug types get it too
#[test]
fn custom_types() {
    #[derive(Debug)]
    struct Point { x: i32 }
    assert_eq!(Point { x: 1 }.describe(), "<Point { x: 1 }>");
    assert_eq!(Point { x: -30 }.describe(), "<Point { x: -30 }>");
}

/// joins with spaces
#[test]
fn joins() {
    assert_eq!(describe_all(&[1, 2, 3]), "<1> <2> <3>");
    assert_eq!(describe_all(&["a", "b"]), "<\"a\"> <\"b\">");
    assert_eq!(describe_all(&[Some(1), None]), "<Some(1)> <None>");
    assert_eq!(describe_all(&[4.5]), "<4.5>");
    assert_eq!(describe_all::<u8>(&[]), "");
}
```

#### Uses
- [Generics & bounds › Blanket impls](#/generics/blanket-impls)
- [Generics & bounds › Bound syntax](#/generics/bound-syntax)
- [Ownership › Moves in loops](#/ownership/moves-in-loops)
- [Reference › Strings and &str](#/reference/strings-and-str)

#### Hints
- The blanket impl needs `T: Debug` (from `std::fmt::Debug`) so that `{:?}` works on `self`.
- `describe_all` needs a bound that lets it call `item.describe()`: your own trait, `Describe`.
- Push each description into a `Vec::new()`, then `join` it. An empty slice gives an empty `Vec`, which joins to `""`.

#### Tips
- `T: Debug` would also work for `describe_all`, but `T: Describe` says exactly what the function uses.
- `"hi".describe()` is `"<\"hi\">"`, with the quotes, because `{:?}` on a `&str` shows it the way you'd type it. `{}` would print `hi` bare. That difference is the whole reason both traits exist.
- One blanket impl and you're done: `5`, `Vec<i32>`, `Option<char>` and a struct declared inside a test function all get `describe` without another line of code. That's how `ToString` reaches every `Display` type.
- The orphan rule still applies. This works because `Describe` is your trait; you couldn't write `impl<T: Debug> Display for T`.

#### Docs
- [Rust book: Using trait bounds to conditionally implement methods](https://doc.rust-lang.org/book/ch10-02-traits.html#using-trait-bounds-to-conditionally-implement-methods)
- [std: slice::join](https://doc.rust-lang.org/std/primitive.slice.html#method.join)

### 4. Merge two sorted slices

`merge_sorted(a, b)` takes two slices that are each sorted and returns one sorted `Vec` with every element from both. Walk both with two indexes; don't concatenate and sort. When elements compare equal, take the one from `a` first. You need two bounds: one to compare, one to copy elements out of borrowed slices. Put them in a `where` clause.

```rust starter
pub fn merge_sorted<T>(a: &[T], b: &[T]) -> Vec<T> {
    todo!()
}
```

```rust test
use std::cmp::Ordering;

/// merges numbers
#[test]
fn numbers() {
    assert_eq!(merge_sorted(&[1, 4, 9], &[2, 3, 10, 11]), vec![1, 2, 3, 4, 9, 10, 11]);
    assert_eq!(merge_sorted(&[], &[5, 6]), vec![5, 6]);
    assert_eq!(merge_sorted::<i32>(&[], &[]), Vec::<i32>::new());
}

/// keeps the rest of whichever slice is left over
#[test]
fn tails() {
    assert_eq!(merge_sorted(&[5, 6, 7], &[1]), vec![1, 5, 6, 7]);
    assert_eq!(merge_sorted(&[1, 2], &[]), vec![1, 2]);
    assert_eq!(merge_sorted(&[1, 1, 2], &[1, 3]), vec![1, 1, 1, 2, 3]);
}

/// merges strings
#[test]
fn strings() {
    assert_eq!(merge_sorted(&["ant", "cat"], &["bee", "dog"]), vec!["ant", "bee", "cat", "dog"]);
    let a = vec!["pear".to_string()];
    let b = vec!["apple".to_string(), "zoo".to_string()];
    assert_eq!(merge_sorted(&a, &b), vec!["apple", "pear", "zoo"]);
}

#[derive(Debug, Clone, PartialEq)]
struct Item(u32, &'static str);

impl PartialOrd for Item {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.0.partial_cmp(&other.0)
    }
}

/// equal elements from a come first
#[test]
fn stable() {
    let a = [Item(1, "a"), Item(2, "a")];
    let b = [Item(1, "b"), Item(2, "b")];
    assert_eq!(merge_sorted(&a, &b), vec![Item(1, "a"), Item(1, "b"), Item(2, "a"), Item(2, "b")]);
    let a = [Item(2, "a"), Item(3, "a")];
    let b = [Item(1, "b"), Item(3, "b")];
    assert_eq!(merge_sorted(&a, &b), vec![Item(1, "b"), Item(2, "a"), Item(3, "a"), Item(3, "b")]);
}
```

#### Uses
- [Generics & bounds › Bound syntax](#/generics/bound-syntax)
- [Control flow › `while`](#/control-flow/while)
- [Ownership › Clone](#/ownership/clone)

#### Hints
- The bounds are `PartialOrd` to compare and `Clone` to copy elements out of the borrowed slices.
- Keep an index into each slice. While both have items left, push a clone of the smaller one (`<=` takes `a` on ties) and advance that index.
- When one slice runs out, the other still has a sorted tail. A second loop pushes the rest of it.

#### Tips
- Taking `a` on ties is what makes the merge *stable*: equal items keep their original order, which merge sort relies on.
- `Clone` is in the bounds because the slices are borrowed. You can't move a `T` out of a `&[T]`, so every element that goes into the result has to be cloned out.
- Use `<=` for the comparison, not `<`. With `<`, an equal pair takes `b` first and the `stable` test fails with everything else still correct, which is a hard bug to see.
- Two tail loops, or one that pushes whatever is left of each slice, are both fine. What doesn't work is forgetting them: the merge stops as soon as one side runs out.

#### Docs
- [Rust book: Clearer trait bounds with `where` clauses](https://doc.rust-lang.org/book/ch10-02-traits.html#clearer-trait-bounds-with-where-clauses)
