# Vec & HashMap

`Vec<T>` is Rust's growable array and `HashMap<K, V>` its dictionary. They work like the lists and maps you know, except that the borrow checker also watches them: you can't hold a reference into a collection while you change it.

## `Vec<T>`

```rust
let mut v: Vec<i32> = Vec::new();
v.push(1);
v.push(2);
let w = vec![10, 20, 30];      // macro for a literal
println!("{} {} {:?}", v.len(), w[0], v.pop());   // 2 10 Some(2)
```

A `Vec` is three words on the stack (pointer, length, capacity) and a buffer on the heap. When the buffer is full, `push` allocates a bigger one (roughly double), copies the elements over and frees the old one. If you know the size up front, `Vec::with_capacity(n)` skips the regrowth.

Every element has the same type. For a mix, use an enum with one variant per kind.

## Indexing vs `get`

```rust
let v = vec![1, 2, 3];
let a = v[1];              // 2
let b = v.get(1);          // Some(&2)
let c = v.get(99);         // None
// let d = v[99];          // compiles, then panics: index out of bounds
```

`v[i]` panics on a bad index, the same way a failed assertion would. Use it when a bad index is a bug. Use `get` when the index comes from outside and "not there" is a normal case. Indexes are always `usize`, so an `i32` counter needs `as usize`.

## No references across a push

```rust
let mut v = vec![1, 2, 3];
let first = &v[0];
v.push(4);                 // error[E0502]: cannot borrow `v` as mutable because it is also borrowed as immutable
println!("{first}");
```

In Python this runs fine. In Rust it can't: `push` may move the buffer to a new allocation, and `first` would point at freed memory. The borrowing rules you already know (many readers or one writer) catch it at compile time. The fix is usually to copy the value out (`let first = v[0];`) or to finish using the reference before you mutate.

## Three ways to loop

```rust
let mut v = vec![1, 2, 3];
for x in &v { println!("{x}"); }         // x: &i32, v is borrowed
for x in &mut v { *x *= 10; }            // x: &mut i32, change in place
for x in v { println!("{x}"); }          // x: i32, v is moved and gone
// println!("{v:?}");                     // error[E0382]: borrow of moved value: `v`
```

`for x in v` consumes the vector. That's what you want when you're done with it or are moving `String`s out; otherwise loop over `&v`. `&v` and `&mut v` are shorthand for `v.iter()` and `v.iter_mut()`.

Handy methods: `sort`, `sort_by_key`, `dedup`, `retain(|x| ...)`, `contains`, `extend`, `insert`/`remove` (shift everything, O(n)), `swap_remove` (O(1), changes the order). `retain` takes a closure: `|x| *x > 0` is a small inline function, covered properly in the iterators module.

## `HashMap<K, V>`

```rust
use std::collections::HashMap;

let mut ages: HashMap<String, u32> = HashMap::new();
ages.insert("ada".to_string(), 36);
ages.insert("alan".to_string(), 41);

let a = ages.get("ada");            // Some(&36), a &str works for String keys
let n = ages["alan"];               // 41, panics if missing
ages.remove("alan");
for (name, age) in &ages {          // arbitrary order
    println!("{name}: {age}");
}
```

`insert` takes ownership of the key and value: after `ages.insert(name, 36)`, `name` has moved into the map. Iteration order is unspecified and changes between runs, so never let output depend on it.

## The entry API

Counting and grouping are where maps earn their keep. Checking `contains_key`, then inserting, then updating costs several lookups and fights the borrow checker. `entry` does it in one:

```rust
use std::collections::HashMap;
let mut counts: HashMap<&str, u32> = HashMap::new();
for word in "a b a c a".split_whitespace() {
    *counts.entry(word).or_insert(0) += 1;
}

let mut by_len: HashMap<usize, Vec<&str>> = HashMap::new();
for word in ["hi", "yo", "hey"] {
    by_len.entry(word.len()).or_default().push(word);
}
```

`entry(key)` finds the slot once. `or_insert(v)` fills it if empty and returns `&mut V` either way; `or_default()` does the same with `V::default()` (0, empty `Vec`, empty `String`). The `*` writes through that mutable reference.

## Sets and ordered maps

```rust
use std::collections::{BTreeMap, HashSet, VecDeque};

let mut seen = HashSet::new();
println!("{}", seen.insert(3));    // true, newly added
println!("{}", seen.insert(3));    // false, already there

let mut scores = BTreeMap::new();
scores.insert("zed", 1);
scores.insert("amy", 2);
println!("{scores:?}");            // {"amy": 2, "zed": 1}, always sorted by key

let mut queue = VecDeque::from([1, 2]);
queue.push_back(3);
println!("{:?}", queue.pop_front());   // Some(1)
```

- `HashSet<T>` is a `HashMap<T, ()>`: membership in O(1), plus `union`, `intersection`, `difference`.
- `BTreeMap` / `BTreeSet` keep keys sorted. Reach for them when output order matters (tests, reports) or you need range queries. Lookups are O(log n).
- `VecDeque` is a ring buffer: cheap push and pop at both ends. Use it for queues; `Vec::remove(0)` is O(n).

Keys for hash collections need `Eq + Hash`; for B-trees, `Ord`. The standard types have them, and your own structs get them with `#[derive(...)]`.

```rust playground
use std::collections::{BTreeMap, HashMap, HashSet};

fn main() {
    let text = "the cat sat on the mat and the cat slept";

    let mut counts: HashMap<&str, usize> = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    println!("the = {}, dog = {:?}", counts["the"], counts.get("dog"));

    // Copy into a BTreeMap to print in a stable order.
    let mut sorted = BTreeMap::new();
    for (word, n) in &counts {
        sorted.insert(*word, *n);
    }
    println!("{sorted:?}");

    let mut first_letters = HashSet::new();
    let mut v = Vec::new();
    for word in text.split_whitespace() {
        let c = word.chars().next().unwrap();
        if first_letters.insert(c) {
            v.push(c);
        }
    }
    v.sort();
    println!("first letters: {v:?}");
}

// Try: group the words by length with `entry(word.len()).or_default().push(word)`.
```

## Exercises

### 1. Cap in place

`cap(values, max)` changes the vector in place so that no element is greater than `max`. Loop with `&mut` and write through the reference.

```rust starter
pub fn cap(values: &mut Vec<i32>, max: i32) {
    todo!()
}
```

```rust test
/// lowers values above max
#[test]
fn caps_large_values() {
    let mut v = vec![1, 50, 7, 99];
    cap(&mut v, 10);
    assert_eq!(v, vec![1, 10, 7, 10]);
}

/// leaves small values and empty vectors alone
#[test]
fn leaves_the_rest() {
    let mut v = vec![-5, 0, 3];
    cap(&mut v, 3);
    assert_eq!(v, vec![-5, 0, 3]);
    let mut empty: Vec<i32> = vec![];
    cap(&mut empty, 1);
    assert!(empty.is_empty());
}
```

#### Uses
- [Vec & HashMap › Three ways to loop](#/collections/three-ways-to-loop)
- [Borrowing & references › Mutable references: `&mut T`](#/borrowing/mutable-references-mut-t)
- [Control flow › `if` needs a `bool`](#/control-flow/if-needs-a-bool)

#### Hints
- `values` is already a `&mut Vec<i32>`, so `for x in values` hands you each element as a `&mut i32`.
- Read and write through the reference with `*x`: compare `*x` with `max`, and assign `max` to `*x` when it's too big.

#### Tips
- `*x = (*x).min(max);` does the same without an `if`.

#### Docs
- [Rust book: Iterating over the values in a vector](https://doc.rust-lang.org/book/ch08-01-vectors.html#iterating-over-the-values-in-a-vector)

### 2. Word counts

`word_counts(text)` counts each whitespace-separated word, case-insensitively (`word.to_lowercase()` gives a lowercase `String`). Use the entry API.

```rust starter
use std::collections::HashMap;

pub fn word_counts(text: &str) -> HashMap<String, usize> {
    todo!()
}
```

```rust test
/// counts repeated words
#[test]
fn counts_words() {
    let counts = word_counts("the cat and the hat");
    assert_eq!(counts["the"], 2);
    assert_eq!(counts["cat"], 1);
    assert_eq!(counts.len(), 4);
}

/// ignores case
#[test]
fn ignores_case() {
    let counts = word_counts("Go go GO stop");
    assert_eq!(counts.get("go"), Some(&3));
    assert_eq!(counts.get("Go"), None);
}

/// empty text gives an empty map
#[test]
fn empty_text() {
    assert!(word_counts("   ").is_empty());
}
```

#### Uses
- [Vec & HashMap › The entry API](#/collections/the-entry-api)
- [Strings & slices › Everyday string methods](#/strings/everyday-string-methods)

#### Hints
- Start with `HashMap::new()` and loop over `text.split_whitespace()`.
- Use `word.to_lowercase()` as the key. It's an owned `String`, which is what the map's key type asks for.
- `*counts.entry(key).or_insert(0) += 1` counts one word. Return the map as the last expression.

#### Tips
- `split_whitespace` skips runs of spaces, so `"   "` yields no words and blank input needs no special case.

#### Docs
- [Rust book: Updating a value based on the old value](https://doc.rust-lang.org/book/ch08-03-hash-maps.html#updating-a-value-based-on-the-old-value)

### 3. First duplicate

`first_duplicate(values)` returns the first value that appears for a second time, scanning left to right, or `None` if all values are distinct. One pass with a `HashSet`: `insert` returns `false` when the value was already there.

The return type `Option<i32>` means "either `Some(value)` or `None`". Write `return Some(v);` when you find a repeat, and end the function with `None`.

```rust starter
use std::collections::HashSet;

pub fn first_duplicate(values: &[i32]) -> Option<i32> {
    todo!()
}
```

```rust test
/// returns the first value seen twice
#[test]
fn finds_first_repeat() {
    assert_eq!(first_duplicate(&[3, 1, 4, 1, 5, 3]), Some(1));
    assert_eq!(first_duplicate(&[7, 7]), Some(7));
}

/// none when all distinct
#[test]
fn none_when_distinct() {
    assert_eq!(first_duplicate(&[1, 2, 3]), None);
    assert_eq!(first_duplicate(&[]), None);
}
```

#### Uses
- [Vec & HashMap › Sets and ordered maps](#/collections/sets-and-ordered-maps)
- [Borrowing & references › Mutable references: `&mut T`](#/borrowing/mutable-references-mut-t)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- Create an empty `HashSet::new()` before the loop, then walk `values` in order.
- Looping over the slice gives `&i32`s; `*v` is the number itself. If `seen.insert(*v)` returns `false`, you've seen it before.

#### Tips
- A `HashSet` answers "seen it?" in O(1), so this is one pass. Comparing every pair would be O(n²).

#### Docs
- [std: HashSet::insert](https://doc.rust-lang.org/std/collections/struct.HashSet.html#method.insert)

### 4. Group by length

`group_by_len(words)` returns a `BTreeMap` from word length to the words of that length, in their original order. Because it's a `BTreeMap`, the keys come out sorted. Store owned `String`s (`word.to_string()`).

```rust starter
use std::collections::BTreeMap;

pub fn group_by_len(words: &[&str]) -> BTreeMap<usize, Vec<String>> {
    todo!()
}
```

```rust test
/// groups words by length
#[test]
fn groups_words() {
    let groups = group_by_len(&["hi", "hello", "yo", "hey", "world"]);
    assert_eq!(groups[&2], vec!["hi", "yo"]);
    assert_eq!(groups[&3], vec!["hey"]);
    assert_eq!(groups[&5], vec!["hello", "world"]);
}

/// keys come out in ascending order
#[test]
fn sorted_keys() {
    let groups = group_by_len(&["ccc", "a", "bb", "dddd", "e"]);
    let keys: Vec<usize> = groups.keys().copied().collect();
    assert_eq!(keys, vec![1, 2, 3, 4]);
}

/// no words, no groups
#[test]
fn empty_input() {
    assert!(group_by_len(&[]).is_empty());
}
```

#### Uses
- [Vec & HashMap › The entry API](#/collections/the-entry-api)
- [Vec & HashMap › Sets and ordered maps](#/collections/sets-and-ordered-maps)

#### Hints
- It's the entry API's group-by-length example, with `BTreeMap::new()` in place of `HashMap::new()`.
- `groups.entry(word.len()).or_default()` gives you a `&mut Vec<String>` for that length; push `word.to_string()` onto it.

#### Tips
- `or_default()` works because an empty `Vec` is the default for `Vec<String>`. `or_insert(Vec::new())` says the same thing.

#### Docs
- [std: BTreeMap::entry](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html#method.entry)
