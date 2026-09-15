# Borrowing & references

A reference lets you use a value without taking ownership of it. The borrow checker enforces one rule, many readers or a single writer, and that rule rules out dangling pointers and data races at compile time.

## Shared references: `&T`

Passing a `String` to a function moves it. Passing `&s` lends it instead:

```rust
fn count_chars(s: &String) -> usize {
    s.len()
}

let name = String::from("Ada");
let n = count_chars(&name); // lend `name`
println!("{name} has {n} bytes"); // still ours
```

`&name` creates a reference, a pointer that is guaranteed to point at a live `String`. The function *borrows* the value and gives nothing back, because it never owned it. When the reference goes out of scope, nothing is dropped.

Through a shared reference you can only read:

```rust
fn shout(s: &String) {
    s.push('!');
}
// error[E0596]: cannot borrow `*s` as mutable, as it is behind a `&` reference
```

## Mutable references: `&mut T`

To let a function change a value it doesn't own, lend it mutably. Both sides have to say so:

```rust
fn shout(s: &mut String) {
    s.push('!');
}

let mut greeting = String::from("hi");
shout(&mut greeting);
println!("{greeting}"); // hi!
```

The variable must be declared `mut`, and the call site must write `&mut`. Reading a Rust call, you can tell which arguments might change.

For values like numbers, use `*` to reach through the reference to the value itself:

```rust
fn bump(counter: &mut u32) {
    *counter += 1;
}

let mut hits = 0;
bump(&mut hits);
bump(&mut hits);
```

Method calls and comparisons dereference automatically, which is why `s.len()` and `s.push('!')` above need no `*`.

## The rule: many readers or one writer

At any moment, a value can have either any number of `&` references, or exactly one `&mut` reference. Never both.

```rust
let mut s = String::from("x");
let a = &mut s;
let b = &mut s;
a.push('1');
// error[E0499]: cannot borrow `s` as mutable more than once at a time
```

```rust
let mut v = vec![1, 2, 3];
let first = &v[0];
v.push(4);
println!("{first}");
// error[E0502]: cannot borrow `v` as mutable because it is also borrowed as immutable
```

The second example is the important one. `push` may need a bigger buffer, so it can move every element to a new heap allocation and free the old one. `first` would then point at freed memory. In C++ that's undefined behavior and in Java it's a `ConcurrentModificationException` at runtime. In Rust it doesn't compile.

The same rule is why you can't modify a collection while looping over it:

```rust
let mut v = vec![1, 2, 3];
for x in &v {
    v.push(*x);
}
// error[E0502]: cannot borrow `v` as mutable because it is also borrowed as immutable
```

`for x in &v` borrows each element; `for x in &mut v` borrows each one mutably, so you can write `*x *= 2`.

## Borrows end at their last use

A borrow lasts until the last place the reference is used, not until the end of the block. Reordering is often all a fix needs:

```rust
let mut v = vec![1, 2, 3];
let first = &v[0];
println!("{first}"); // last use of `first`: the borrow ends here
v.push(4);           // fine
```

## No dangling references

A reference can never outlive the value it points to:

```rust
let r;
{
    let x = 5;
    r = &x;
}
println!("{r}");
// error[E0597]: `x` does not live long enough
```

The same goes for returning a reference to a local variable, which would be freed when the function returns:

```rust
fn make() -> &String {
    let s = String::from("temp");
    &s
}
// error[E0106]: missing lifetime specifier
```

The fix is to return the owned `String` itself. The Lifetimes module explains what the error's suggestion means.

## You can't move out of a borrow

A borrower may look, not take. Trying to move a `String` out of a `Vec` you only borrowed fails:

```rust
fn first(words: &Vec<String>) -> String {
    words[0]
}
// error[E0507]: cannot move out of index of `Vec<String>`
```

Return `words[0].clone()` if you need an owned copy, or return a reference instead.

## Copying and reborrowing references

`&T` is `Copy`: a shared reference can be duplicated freely. `&mut T` is not, because two copies would be two writers. Passing a `&mut` to a function doesn't use it up, though. The compiler inserts a *reborrow*, a temporary `&mut *r` that ends when the call returns:

```rust
fn add_one(v: &mut Vec<i32>) {
    v.push(1);
}

let mut v = Vec::new();
let r = &mut v;
add_one(r); // reborrows *r for the duration of the call
add_one(r); // so r is still usable
println!("{}", r.len());
```

## The borrow checker as a teacher

When the borrow checker refuses your code, it's usually pointing at a real design question: who owns this data, and who is allowed to change it while others look at it? The common fixes, roughly in order of preference:

1. Shorten a borrow: finish reading before you start writing.
2. Borrow instead of taking ownership, or take ownership instead of borrowing.
3. Collect the changes first, apply them afterwards.
4. Clone, when the data is small or the copy is what you meant anyway.

```rust playground
fn total(values: &Vec<i32>) -> i32 {
    let mut sum = 0;
    for v in values {
        sum += *v;
    }
    sum
}

fn double_all(values: &mut Vec<i32>) {
    for v in values {
        *v *= 2;
    }
}

fn main() {
    let mut scores = vec![3, 5, 8];
    println!("total before: {}", total(&scores));

    double_all(&mut scores);
    println!("after doubling: {scores:?}, total {}", total(&scores));

    let biggest = &scores[2];
    println!("biggest: {biggest}");
    scores.push(100); // fine: `biggest` is no longer used
    println!("{scores:?}");

    // Try: move the `println!("biggest: ...")` line below the push.
}
```

## Exercises

### 1. Largest value

Return the largest value in a non-empty Vec without taking ownership of it. `for v in values` over a `&Vec<i32>` gives you `&i32` items; `*v` reads the number.

```rust starter
pub fn largest(values: &Vec<i32>) -> i32 {
    todo!()
}
```

```rust test
/// finds the largest
#[test]
fn finds_largest() {
    let v = vec![3, 9, 2];
    assert_eq!(largest(&v), 9);
    assert_eq!(v.len(), 3); // still usable after the call
}

/// works with negatives
#[test]
fn negatives() {
    assert_eq!(largest(&vec![-5, -2, -9]), -2);
}

/// a single element
#[test]
fn single() {
    assert_eq!(largest(&vec![7]), 7);
}
```

#### Uses
- [Borrowing & references › Shared references: `&T`](#/borrowing/shared-references-t)
- [Borrowing & references › The rule: many readers or one writer](#/borrowing/the-rule-many-readers-or-one-writer)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- Keep the best value so far in a `let mut`. The Vec is never empty, so `values[0]` is a safe place to start.
- Loop with `for v in values`. When `*v` is bigger than the best so far, replace it.

#### Tips
- Starting from `0` instead of the first element looks fine until every value is negative. The second test checks that.

#### Docs
- [Book: References and borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
- [Book: Iterating over the values in a vector](https://doc.rust-lang.org/book/ch08-01-vectors.html#iterating-over-the-values-in-a-vector)

### 2. Double in place

Double every value in the Vec, changing it in place. Nothing is returned: the caller sees the change through the `&mut` reference.

```rust starter
pub fn double_all(values: &mut Vec<i32>) {
    todo!()
}
```

```rust test
/// doubles each value
#[test]
fn doubles() {
    let mut v = vec![1, -2, 3];
    double_all(&mut v);
    assert_eq!(v, vec![2, -4, 6]);
}

/// empty stays empty
#[test]
fn empty() {
    let mut v: Vec<i32> = Vec::new();
    double_all(&mut v);
    assert_eq!(v, Vec::<i32>::new());
}
```

#### Uses
- [Borrowing & references › Mutable references: `&mut T`](#/borrowing/mutable-references-mut-t)
- [Borrowing & references › The rule: many readers or one writer](#/borrowing/the-rule-many-readers-or-one-writer)

#### Hints
- Looping over a `&mut Vec<i32>` with `for v in values` gives you a `&mut i32` for each element.
- Write through the reference with `*v *= 2`.

#### Tips
- There's nothing to return. The Vec was changed where it lives, so the caller already has the result.

#### Docs
- [Book: Mutable references](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#mutable-references)
- [Book: Iterating over the values in a vector](https://doc.rust-lang.org/book/ch08-01-vectors.html#iterating-over-the-values-in-a-vector)

### 3. Tally the votes

Count `"yes"` and `"no"` votes into the two counters the caller passes in. Ignore any other value. Update the counters with `*yes += 1`. A `&String` can be compared with a literal directly: `v == "yes"`.

```rust starter
pub fn tally(votes: &Vec<String>, yes: &mut u32, no: &mut u32) {
    todo!()
}
```

```rust test
fn votes(list: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for v in list {
        out.push(v.to_string());
    }
    out
}

/// counts yes and no
#[test]
fn counts() {
    let (mut yes, mut no) = (0, 0);
    tally(&votes(&["yes", "no", "yes", "maybe"]), &mut yes, &mut no);
    assert_eq!((yes, no), (2, 1));
}

/// adds to existing counts
#[test]
fn accumulates() {
    let (mut yes, mut no) = (10, 20);
    tally(&votes(&["no", "no"]), &mut yes, &mut no);
    assert_eq!((yes, no), (10, 22));
}
```

#### Uses
- [Borrowing & references › Mutable references: `&mut T`](#/borrowing/mutable-references-mut-t)
- [Borrowing & references › Shared references: `&T`](#/borrowing/shared-references-t)
- [Control flow › `if` needs a `bool`](#/control-flow/if-needs-a-bool)

#### Hints
- Loop over the votes with `for v in votes`. Each `v` is a `&String` you can only read, which is all you need.
- Use `if v == "yes"` and `else if v == "no"`. With no final `else`, other values fall through untouched.

#### Tips
- `yes += 1` without the `*` fails: it tries to add to the reference, not to the counter it points at.

#### Docs
- [Book: Mutable references](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#mutable-references)

### 4. Move the evens

Move every even number from `from` into `to`, keeping the order of both. Afterwards `from` holds only the odd numbers.

You can't push to or remove from `from` while you loop over it; that's the rule from this module. Loop over it, sort each value into `to` or a new local Vec, then replace `from`'s contents: `*from = kept;`.

To loop without using `from` up, write `for x in from.iter()`, which lends you each element as a `&i32`. A plain `for x in from` moves the `&mut` reference into the loop (a `&mut` isn't `Copy`), and then the `*from = kept;` line can't use it any more.

```rust starter
pub fn move_evens(from: &mut Vec<i32>, to: &mut Vec<i32>) {
    for x in from.clone() {
        if x % 2 == 0 {
            to.push(x);
        }
    }
}
```

```rust test
/// splits evens and odds
#[test]
fn splits() {
    let mut from = vec![1, 2, 3, 4, 6, 7];
    let mut to = Vec::new();
    move_evens(&mut from, &mut to);
    assert_eq!(from, vec![1, 3, 7]);
    assert_eq!(to, vec![2, 4, 6]);
}

/// appends after what `to` already holds
#[test]
fn appends() {
    let mut from = vec![8, 9];
    let mut to = vec![0];
    move_evens(&mut from, &mut to);
    assert_eq!(to, vec![0, 8]);
    assert_eq!(from, vec![9]);
}
```

#### Uses
- [Borrowing & references › The rule: many readers or one writer](#/borrowing/the-rule-many-readers-or-one-writer)
- [Borrowing & references › Copying and reborrowing references](#/borrowing/copying-and-reborrowing-references)
- [Borrowing & references › The borrow checker as a teacher](#/borrowing/the-borrow-checker-as-a-teacher)

#### Hints
- Before the loop, make an empty `let mut kept = Vec::new();` for the odd numbers.
- In `for x in from.iter()`, `x` is a `&i32`. Push `*x` into `to` when it's even, into `kept` otherwise.
- After the loop, `*from = kept;` replaces the whole Vec behind the reference. The loop's borrow has ended by then.

#### Tips
- This is fix number 3 from the list above: collect the changes first, apply them afterwards. The starter's `from.clone()` also dodges the conflict, but copies the whole Vec to do it.

#### Docs
- [std: slice `iter`](https://doc.rust-lang.org/std/primitive.slice.html#method.iter)
- [Book: Iterating over the values in a vector](https://doc.rust-lang.org/book/ch08-01-vectors.html#iterating-over-the-values-in-a-vector)
