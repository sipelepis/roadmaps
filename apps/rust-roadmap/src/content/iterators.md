# Closures & iterators

Closures are anonymous functions that capture variables from where they're defined. Iterators are lazy sequences you transform with chains of small closures; they replace most hand-written loops and compile down to the same machine code.

## Closures

```rust
let add_one = |x: i32| x + 1;
let add = |a, b| a + b;                     // types inferred from the first call
println!("{} {}", add_one(1), add(2, 3));

let greeting = String::from("hi");
let greet = |name: &str| format!("{greeting}, {name}");
println!("{}", greet("ada"));               // hi, ada
```

Parameters go between the pipes, and the body is one expression or a `{ ... }` block. A regular `fn` can't see local variables; a closure can, which is the point. Inferred types are fixed after the first use, so calling `add(1.0, 2.0)` after `add(2, 3)` is `error[E0308]: mismatched types`.

## How closures capture

The compiler picks the least powerful capture the body needs:

```rust
let name = String::from("ada");
let print = || println!("{name}");          // borrows &name
print();

let mut count = 0;
let mut inc = || count += 1;                // borrows &mut count
inc();
inc();
println!("{count}");                        // 2, the mutable borrow has ended

let owned = String::from("mine");
let take = move || owned.len();             // moves owned into the closure
println!("{}", take());
// println!("{owned}");                     // error[E0382]: borrow of moved value: `owned`
```

A closure that holds `&mut count` follows the usual borrowing rules: you can't read `count` while `inc` might still be called. `move` forces everything to be captured by value. You need it when the closure outlives the variables it uses, as when you return a closure or hand it to a thread.

## `Fn`, `FnMut`, `FnOnce`

Each closure implements one or more of these traits, depending on what it does with its captures:

- `Fn`: only reads them. Can be called any number of times.
- `FnMut`: mutates them. Can be called repeatedly, but needs a `mut` binding and exclusive access.
- `FnOnce`: consumes them, for example by returning a captured `String`. Can be called once.

Every `Fn` is also an `FnMut`, and every `FnMut` an `FnOnce`. When you take a closure as a parameter, ask for the least you need, and callers get the most freedom:

```rust
fn apply_twice<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 { f(f(x)) }

fn repeat<F: FnMut()>(mut f: F, n: usize) {
    for _ in 0..n { f(); }
}

fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n                          // without move, n would be a dangling borrow
}

let mut total = 0;
repeat(|| total += 2, 3);
println!("{} {} {}", apply_twice(|x| x * 10, 1), total, make_adder(5)(1));   // 100 6 6
```

Named functions work anywhere a closure does: `apply_twice(double, 3)` with `fn double(x: i32) -> i32`.

## The `Iterator` trait

```rust
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    // ...and about 75 provided methods built on next()
}
```

That's the whole protocol, like Python's `__next__` with `None` instead of `StopIteration`. `for x in thing` calls `into_iter()` and then `next()` until it gets `None`. Collections give you three kinds:

- `v.iter()` yields `&T`
- `v.iter_mut()` yields `&mut T`
- `v.into_iter()` yields `T` and consumes `v`

## Adapters are lazy

```rust
let v = vec![1, 2, 3, 4, 5, 6];
let evens_squared: Vec<i32> = v.iter().filter(|x| *x % 2 == 0).map(|x| x * x).collect();
println!("{evens_squared:?}");              // [4, 16, 36]
```

`filter` and `map` build a new iterator and do no work. Nothing runs until a consumer like `collect`, `sum` or a `for` loop pulls items through. A chain you forget to consume gets a warning: `unused Map that must be used: iterators are lazy and do nothing unless consumed`.

`filter` passes each item by reference so it can't consume it. Over `v.iter()` the item is already `&i32`, so the closure gets `&&i32`; `*x` or a pattern like `|&&x|` peels it.

```rust
let names = ["ada", "alan", "grace"];
let ages = [36, 41, 85];

for (i, name) in names.iter().enumerate() { println!("{i}: {name}"); }
let total = ages.iter().fold(0, |acc, a| acc + a);                          // 162
let oldest = names.iter().zip(ages).max_by_key(|&(_, age)| age);           // Some((&"grace", 85))
let small: Vec<i32> = [1, 2, 3, 10, 1].into_iter().take_while(|&x| x < 5).collect();  // [1, 2, 3]
let words: Vec<&str> = ["a b", "c"].iter().flat_map(|s| s.split(' ')).collect();       // ["a", "b", "c"]
let sum: i32 = (1..=10).filter(|n| n % 3 == 0).sum();                                  // 18
```

The usual adapters: `map`, `filter`, `filter_map`, `enumerate`, `zip`, `chain`, `rev`, `skip`, `take`, `take_while`, `flat_map`, `peekable`. The usual consumers: `collect`, `sum`, `count`, `min`/`max`, `max_by_key`, `fold`, `any`, `all`, `find`, `position`.

## `collect` builds whatever you ask for

```rust
use std::collections::{HashMap, HashSet};

let v: Vec<i32> = (1..=3).collect();
let s: String = ['h', 'i'].iter().collect();
let lengths: HashMap<&str, usize> = ["a", "bb"].iter().map(|w| (*w, w.len())).collect();
let letters: HashSet<char> = "hello".chars().collect();
let parsed: Result<Vec<i32>, _> = ["1", "2", "x"].iter().map(|s| s.parse::<i32>()).collect();
println!("{parsed:?}");                     // Err(ParseIntError { kind: InvalidDigit })
```

The type annotation picks the collection. Collecting `Result`s into `Result<Vec<_>, _>` stops at the first `Err` and returns it, which is the idiomatic way to parse a whole list. `sum` also needs to know its output type, hence `let sum: i32`.

## Implementing `Iterator`

Write `next` and you get every adapter for free:

```rust
struct Countdown(u32);

impl Iterator for Countdown {
    type Item = u32;
    fn next(&mut self) -> Option<u32> {
        if self.0 == 0 {
            return None;
        }
        self.0 -= 1;
        Some(self.0 + 1)
    }
}

let v: Vec<u32> = Countdown(3).collect();                    // [3, 2, 1]
let even_sum: u32 = Countdown(4).filter(|n| n % 2 == 0).sum();   // 6
```

Where Python keeps generator state in a suspended function, a Rust iterator keeps it in struct fields. Iterators can be infinite; `take`, `take_while` or `find` end them.

These chains are zero-cost: the compiler inlines the closures and produces the same loop you'd write by hand, often with bounds checks removed. Use whichever reads better.

```rust playground
use std::collections::HashMap;

fn main() {
    let text = "the quick brown fox jumps over the lazy dog the end";

    let long_words: Vec<&str> = text.split_whitespace().filter(|w| w.len() > 4).collect();
    println!("long: {long_words:?}");

    let mut counts: HashMap<&str, usize> = HashMap::new();
    text.split_whitespace().for_each(|w| *counts.entry(w).or_insert(0) += 1);
    let (top, n) = counts.iter().max_by_key(|&(_, n)| *n).unwrap();
    println!("most common: {top} x{n}");

    let capitalized: Vec<String> = text
        .split_whitespace()
        .take(4)
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().chain(chars).collect(),
                None => String::new(),
            }
        })
        .collect();
    println!("{}", capitalized.join(" "));

    let mut seen = 0;
    let firsts: String = text.split_whitespace().filter_map(|w| w.chars().next()).inspect(|_| seen += 1).collect();
    println!("{firsts} ({seen} words)");
}

// Try: find the position of the first word longer than 4 letters with .position().
```

## Exercises

### 1. Squares of evens

`squares_of_evens(values)` returns the squares of the even numbers, in order. Write it as one chain: `iter`, `filter`, `map`, `collect`.

```rust starter
pub fn squares_of_evens(values: &[i32]) -> Vec<i32> {
    todo!()
}
```

```rust test
/// keeps evens and squares them
#[test]
fn squares() {
    assert_eq!(squares_of_evens(&[1, 2, 3, 4, 5, 6]), vec![4, 16, 36]);
    assert_eq!(squares_of_evens(&[-2, 0, 7]), vec![4, 0]);
    assert_eq!(squares_of_evens(&[8]), vec![64]);
}

/// keeps the input order and drops negative odd numbers
#[test]
fn order_and_negatives() {
    assert_eq!(squares_of_evens(&[6, 2, 4]), vec![36, 4, 16]);
    assert_eq!(squares_of_evens(&[-3, -4, 5, -1]), vec![16]);
}

/// empty when nothing is even
#[test]
fn none() {
    assert!(squares_of_evens(&[1, 3, 5]).is_empty());
    assert!(squares_of_evens(&[-7]).is_empty());
    assert!(squares_of_evens(&[]).is_empty());
}
```

#### Uses
- [Closures & iterators › Adapters are lazy](#/iterators/adapters-are-lazy)
- [Closures & iterators › `collect` builds whatever you ask for](#/iterators/collect-builds-whatever-you-ask-for)

#### Hints
- `values.iter()` yields `&i32`, and `filter` passes each of those by reference again, so its closure sees a `&&i32`.
- Test evenness through the reference with `*x % 2 == 0`. In `map`, `x * x` works on the `&i32` directly.

#### Tips
- The return type already tells `collect` to build a `Vec<i32>`, so the chain needs no annotation.
- Order the chain so the cheap test comes first. `filter` then `map` squares only the evens; `map` then `filter` squares everything and throws half of it away.
- Forgetting `collect` doesn't silently do nothing, it fails to compile — and the warning behind it, "iterators are lazy and do nothing unless consumed", is worth remembering for the times it's only a warning.

#### Docs
- [Rust book: Methods that produce other iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html#methods-that-produce-other-iterators)

### 2. Closures that remember

`make_adder(n)` returns a closure that adds `n` to its argument. `make_counter()` returns a closure that returns 1, then 2, then 3 and so on; each counter keeps its own count. Both closures outlive the function that made them, so they need `move`.

```rust starter
pub fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| todo!()
}

pub fn make_counter() -> impl FnMut() -> u32 {
    || todo!()
}
```

```rust test
/// adds n
#[test]
fn adder() {
    let add5 = make_adder(5);
    assert_eq!(add5(1), 6);
    assert_eq!(add5(-5), 0);
    assert_eq!(make_adder(-1)(10), 9);
    let add100 = make_adder(100);
    assert_eq!(add100(0), 100);
    assert_eq!(add5(0), 5);
}

/// counts up from 1
#[test]
fn counter() {
    let mut c = make_counter();
    assert_eq!(c(), 1);
    assert_eq!(c(), 2);
    assert_eq!(c(), 3);
    for _ in 0..6 {
        c();
    }
    assert_eq!(c(), 10);
}

/// counters are independent
#[test]
fn independent() {
    let mut a = make_counter();
    let mut b = make_counter();
    a();
    a();
    assert_eq!(b(), 1);
    assert_eq!(a(), 3);
}
```

#### Uses
- [Closures & iterators › How closures capture](#/iterators/how-closures-capture)
- [Closures & iterators › `Fn`, `FnMut`, `FnOnce`](#/iterators/fn-fnmut-fnonce)

#### Hints
- `make_adder` is the example from the article: the body only needs `n`.
- The counter needs state that survives between calls: a `let mut count = 0` inside `make_counter`, moved into the closure.
- Make the closure body a block that bumps `count` and then evaluates to it. Changing a captured variable is what makes it `FnMut`.

#### Tips
- Every call to `make_counter` creates a fresh `count`, so counters don't share. That's how closures stand in for small objects.
- The return types are the hint. `impl Fn` promises a closure that only reads its captures; `impl FnMut` promises one that changes them, which is why the counter's caller has to declare `let mut c`.
- Without `move`, the closure would borrow a local that's gone the moment the function returns, and the compiler says so: *closure may outlive the current function*.
- Bump the count first, then evaluate to it, or you'll return 0 the first time. The body is a block: `{ count += 1; count }`.

#### Docs
- [Rust book: Closures](https://doc.rust-lang.org/book/ch13-01-closures.html)

### 3. Collect into anything

Two one-chain functions, no `for` loops:

- `acronym(phrase)`: the first letter of each whitespace-separated word, uppercased, collected into a `String`. `filter_map` with `w.chars().next()` gets first letters; `c.to_ascii_uppercase()` uppercases one.
- `parse_all(items)`: parse every string as an `i32`. Collect into `Result<Vec<i32>, ParseIntError>` so the first failure becomes the result.

`s.parse::<i32>()` turns text into a number. It returns a `Result<i32, ParseIntError>`, an enum like `Option` with two variants: `Ok(n)` when the text is a number, `Err(e)` when it isn't.

```rust starter
use std::num::ParseIntError;

pub fn acronym(phrase: &str) -> String {
    todo!()
}

pub fn parse_all(items: &[&str]) -> Result<Vec<i32>, ParseIntError> {
    todo!()
}
```

```rust test
/// builds acronyms
#[test]
fn acronyms() {
    assert_eq!(acronym("portable network graphics"), "PNG");
    assert_eq!(acronym("  Rust   is fun "), "RIF");
    assert_eq!(acronym("hello"), "H");
    assert_eq!(acronym(""), "");
}

/// any whitespace separates words
#[test]
fn whitespace() {
    assert_eq!(acronym("big\tdata\nlake"), "BDL");
    assert_eq!(acronym(" \t\n "), "");
}

/// parses every item
#[test]
fn parses() {
    assert_eq!(parse_all(&["1", "-2", "30"]), Ok(vec![1, -2, 30]));
    assert_eq!(parse_all(&["0"]), Ok(vec![0]));
    assert_eq!(parse_all(&["2147483647", "-2147483648"]), Ok(vec![i32::MAX, i32::MIN]));
    assert_eq!(parse_all(&[]), Ok(vec![]));
}

/// stops at the first bad item
#[test]
fn first_error() {
    let err = parse_all(&["1", "two", "3"]).unwrap_err();
    assert_eq!(err.to_string(), "invalid digit found in string");
    let err = parse_all(&["4", "", "x"]).unwrap_err();
    assert_eq!(err.to_string(), "cannot parse integer from empty string");
    let err = parse_all(&["2147483648", "x"]).unwrap_err();
    assert_eq!(err.to_string(), "number too large to fit in target type");
}
```

#### Uses
- [Closures & iterators › Adapters are lazy](#/iterators/adapters-are-lazy)
- [Closures & iterators › `collect` builds whatever you ask for](#/iterators/collect-builds-whatever-you-ask-for)
- [Strings & slices › Everyday string methods](#/strings/everyday-string-methods)
- [Reference › Result](#/reference/result)
- [Reference › char](#/reference/char)

#### Hints
- `acronym`: start from `phrase.split_whitespace()`, `filter_map` each word to its first `char`, `map` that to uppercase, `collect`.
- `parse_all`: `items.iter()`, then `map` each item to its parsed `Result`. The return type tells `collect` to stop at the first `Err`.

#### Tips
- `filter_map` is `map` and `filter` in one: the closure returns an `Option`, and the `None`s are dropped.
- `collect` decides what to build from the type it's asked for. Here the return types do that: `String` for one function, `Result<Vec<i32>, _>` for the other, with the same `collect` call.
- Collecting into `Result<Vec<_>, _>` short-circuits: it stops at the first `Err` and returns it, so `["1", "two", "3"]` never parses the `"3"`. Collecting into `Vec<Result<_, _>>` instead keeps every outcome.
- `split_whitespace` already skips blank runs, which is why `" \t\n "` gives `""` with no special case.

#### Docs
- [std: Iterator::collect](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.collect)
- [std: Iterator::filter_map](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.filter_map)

### 4. A Fibonacci iterator

Implement `Iterator` for `Fibonacci` so that `fibonacci()` yields 0, 1, 1, 2, 3, 5, ... as `u64`. Instead of overflowing, the iterator ends: once the next value wouldn't fit in a `u64`, `next` returns `None` (`a.checked_add(b)` returns `None` on overflow). Change the struct's fields to whatever state you need.

```rust starter
pub struct Fibonacci {}

pub fn fibonacci() -> Fibonacci {
    Fibonacci {}
}

impl Iterator for Fibonacci {
    type Item = u64;

    fn next(&mut self) -> Option<u64> {
        todo!()
    }
}
```

```rust test
/// starts 0, 1, 1, 2
#[test]
fn first_ten() {
    let v: Vec<u64> = fibonacci().take(10).collect();
    assert_eq!(v, vec![0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
}

/// adapters work on it
#[test]
fn adapters() {
    assert_eq!(fibonacci().find(|n| *n > 1000), Some(1597));
    assert_eq!(fibonacci().nth(50), Some(12_586_269_025));
    let even_sum: u64 = fibonacci().take_while(|n| *n < 100).filter(|n| n % 2 == 0).sum();
    assert_eq!(even_sum, 44);
}

/// ends instead of overflowing
#[test]
fn ends() {
    assert_eq!(fibonacci().count(), 94);
    assert_eq!(fibonacci().last(), Some(12_200_160_415_121_876_738));
    let tail: Vec<u64> = fibonacci().skip(91).collect();
    assert_eq!(tail, vec![4_660_046_610_375_530_309, 7_540_113_804_746_346_429, 12_200_160_415_121_876_738]);
}
```

#### Uses
- [Closures & iterators › Implementing `Iterator`](#/iterators/implementing-iterator)
- [Variables & types › Integer overflow](#/basics/integer-overflow)
- [Enums & match › `if let` and `let else`](#/enums/if-let-and-let-else)

#### Hints
- Store the next two values to hand out as `Option<u64>` fields, where `None` means "didn't fit". `fibonacci()` starts them at `Some(0)` and `Some(1)`.
- In `next`, `let ... else` gets the first value or returns `None`. Then shift the second value into the first slot.
- The new second value is `out.checked_add(b)` if the old second was `Some(b)`, and `None` if it already was `None`. A `match` covers both.

#### Tips
- The iterator's state lives in struct fields, where a Python generator would keep it in local variables.
- Write `next` and the other ninety-odd methods come free. `take`, `find`, `nth`, `count`, `skip` and `sum` in the tests are all default methods built on your one function.
- Returning `None` once is a promise you should keep: adapters like `take_while` assume an iterator that has ended stays ended. Storing `None` in the state field, rather than recomputing, is what keeps that true.
- `checked_add` is what turns "this would overflow" into an ordinary value you can act on. Plain `+` would panic in a debug build at exactly the 94th item.

#### Docs
- [std: u64::checked_add](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_add)
- [std: Iterator::next](https://doc.rust-lang.org/std/iter/trait.Iterator.html#tymethod.next)
