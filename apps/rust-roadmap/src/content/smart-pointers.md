# Box, Rc & RefCell

Ownership gives every value one owner and checks every borrow at compile time. Smart pointers cover the shapes that rule doesn't fit: `Box` for heap values whose size isn't known up front, `Rc` for values with several owners, and `RefCell` for mutation through a shared reference, checked at runtime instead.

## `Box<T>`: one owner, on the heap

```rust
let b = Box::new(5);            // the i32 lives on the heap
println!("{}", *b + 1);         // * dereferences
let s = Box::new(String::from("hi"));
println!("{}", s.len());        // method calls see through the box
```

A `Box` owns its value and frees it when the `Box` is dropped, like C++'s `unique_ptr`. For a plain number there's no reason to box it. There are three real uses:

- **Recursive types**, below.
- **Trait objects**: `Box<dyn Shape>` from the Traits module, where each value may have a different size.
- **Cheap moves of big values**: moving a `Box` copies one pointer, not the data.

## Recursive types need indirection

```rust
enum List {
    Cons(i32, List),            // error[E0072]: recursive type `List` has infinite size
    Nil,
}
```

Rust lays out enums inline, so the size of `List` would include a `List`, which includes a `List`... A `Box` is always one pointer wide, which breaks the loop:

```rust
enum List {
    Cons(i32, Box<List>),
    Nil,
}

fn sum(list: &List) -> i32 {
    match list {
        List::Cons(n, rest) => n + sum(rest),
        List::Nil => 0,
    }
}

let list = List::Cons(1, Box::new(List::Cons(2, Box::new(List::Nil))));
println!("{}", sum(&list));     // 3
```

Trees and expression ASTs are built the same way. Note that `sum(rest)` passes a `&Box<List>` where `&List` is expected; the compiler dereferences automatically (*deref coercion*).

## `Rc<T>`: shared ownership

```rust
use std::rc::Rc;

let a = Rc::new(String::from("shared"));
let b = Rc::clone(&a);          // bumps a counter; no copy of the string
println!("{b} {}", Rc::strong_count(&a));   // shared 2
drop(b);
println!("{}", Rc::strong_count(&a));       // 1
```

`Rc` (reference counted) is how objects work in Python or Swift: several owners, and the value is freed when the last one goes away. `Rc::clone(&a)` is the conventional spelling, so readers can tell it's a cheap pointer copy and not a deep `.clone()`.

An `Rc` only hands out shared references. If two owners could both mutate, you'd have exactly the aliasing that borrowing forbids, so `a.push_str("!")` fails with `error[E0596]: cannot borrow data in an Rc as mutable`. `Rc` is also single-threaded; the threads module uses `Arc`.

## `RefCell<T>`: borrow rules at runtime

```rust
use std::cell::RefCell;

let log = RefCell::new(Vec::new());
log.borrow_mut().push("first");     // mutate through a shared reference
log.borrow_mut().push("second");
println!("{:?}", log.borrow());     // ["first", "second"]
```

`borrow()` gives a guard that acts like `&T`; `borrow_mut()` gives one that acts like `&mut T`. The rules are the same as always, many readers or one writer, but they're checked when the code runs. Break them and it panics instead of failing to compile:

```rust
use std::cell::RefCell;
let cell = RefCell::new(5);
let reader = cell.borrow();
let writer = cell.borrow_mut();     // compiles, then panics: RefCell already borrowed
```

This is *interior mutability*: a method takes `&self` and still changes state inside. It's how caches, counters and test doubles work. For `Copy` values, `Cell<T>` is simpler: `get()` and `set()` with no guards and no panics.

## `Rc<RefCell<T>>`: shared and mutable

```rust
use std::cell::RefCell;
use std::rc::Rc;

struct Account { balance: i64 }

let shared = Rc::new(RefCell::new(Account { balance: 100 }));
let alice = Rc::clone(&shared);
let bob = Rc::clone(&shared);
alice.borrow_mut().balance -= 30;
bob.borrow_mut().balance += 5;
println!("{}", shared.borrow().balance);   // 75
```

This is as close as Rust gets to a JavaScript object that anyone holding a reference can change. The cost is a counter, a runtime borrow flag, and panics instead of compile errors. Reach for it when the ownership really is shared, like nodes in a graph, and not just to quiet the borrow checker.

## `Weak<T>`: breaking cycles

Reference counting can't free a cycle: if A holds an `Rc` to B and B holds one to A, neither count reaches zero and both leak. A `Weak` pointer doesn't keep its target alive. `upgrade()` gives `Some(Rc)` if the value still exists and `None` if it's gone.

The usual shape is a tree: parents own their children with `Rc`, and children point back with `Weak`.

```rust
use std::cell::RefCell;
use std::rc::{Rc, Weak};

struct Node {
    name: String,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}

let root = Rc::new(Node { name: "root".into(), parent: RefCell::new(Weak::new()), children: RefCell::new(vec![]) });
let leaf = Rc::new(Node { name: "leaf".into(), parent: RefCell::new(Weak::new()), children: RefCell::new(vec![]) });
*leaf.parent.borrow_mut() = Rc::downgrade(&root);
root.children.borrow_mut().push(Rc::clone(&leaf));

let parent_name = leaf.parent.borrow().upgrade().map(|p| p.name.clone());
println!("{parent_name:?} strong={} weak={}", Rc::strong_count(&root), Rc::weak_count(&root));
// Some("root") strong=1 weak=1
```

## `Drop`

```rust
struct Noisy(&'static str);

impl Drop for Noisy {
    fn drop(&mut self) {
        println!("drop {}", self.0);
    }
}

{
    let _a = Noisy("a");
    let _b = Noisy("b");
}   // prints "drop b", then "drop a": reverse order of declaration
```

`Drop` runs when the owner goes out of scope. Files, sockets and lock guards close themselves this way, which is why Rust needs no `finally`, `with` or `defer`. To drop something early, call `drop(x)`; calling `x.drop()` yourself is `error[E0040]: explicit use of destructor method`.

```rust playground
use std::cell::RefCell;
use std::rc::{Rc, Weak};

struct Node {
    name: String,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}

impl Drop for Node {
    fn drop(&mut self) {
        println!("dropping {}", self.name);
    }
}

fn node(name: &str) -> Rc<Node> {
    Rc::new(Node {
        name: name.to_string(),
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(Vec::new()),
    })
}

fn adopt(parent: &Rc<Node>, child: &Rc<Node>) {
    *child.parent.borrow_mut() = Rc::downgrade(parent);
    parent.children.borrow_mut().push(Rc::clone(child));
}

fn main() {
    let leaf = node("leaf");
    {
        let root = node("root");
        adopt(&root, &leaf);
        let parent_name = leaf.parent.borrow().upgrade().map(|p| p.name.clone());
        println!("leaf's parent: {parent_name:?}");
        println!("root strong={} weak={}", Rc::strong_count(&root), Rc::weak_count(&root));
        println!("leaf strong={}", Rc::strong_count(&leaf));
    }
    println!("after the block, leaf's parent: {:?}", leaf.parent.borrow().upgrade().map(|p| p.name.clone()));
    println!("leaf strong={}", Rc::strong_count(&leaf));
}

// Try: make `parent` an Rc<Node> instead of a Weak. Which "dropping" lines disappear, and why?
```

## Exercises

### 1. An expression tree

`Expr` is a recursive enum, so its children are boxed. Write `eval`, which computes the value of an expression. Match on `e`; for boxed children, `eval(left)` works directly thanks to deref coercion.

```rust starter
pub enum Expr {
    Num(i64),
    Neg(Box<Expr>),
    Add(Box<Expr>, Box<Expr>),
    Mul(Box<Expr>, Box<Expr>),
}

pub fn eval(e: &Expr) -> i64 {
    todo!()
}
```

```rust test
fn num(n: i64) -> Box<Expr> {
    Box::new(Expr::Num(n))
}

/// numbers evaluate to themselves
#[test]
fn numbers() {
    assert_eq!(eval(&Expr::Num(7)), 7);
    assert_eq!(eval(&Expr::Neg(num(7))), -7);
}

/// (1 + 2) * -3
#[test]
fn nested() {
    let e = Expr::Mul(Box::new(Expr::Add(num(1), num(2))), Box::new(Expr::Neg(num(3))));
    assert_eq!(eval(&e), -9);
}

/// deep trees
#[test]
fn deep() {
    let mut e = Expr::Num(0);
    for i in 1..=100 {
        e = Expr::Add(Box::new(e), num(i));
    }
    assert_eq!(eval(&e), 5050);
}
```

#### Uses
- [Box, Rc & RefCell › Recursive types need indirection](#/smart-pointers/recursive-types-need-indirection)
- [Box, Rc & RefCell › `Box<T>`: one owner, on the heap](#/smart-pointers/boxt-one-owner-on-the-heap)
- [Enums & match › `match`](#/enums/match)

#### Hints
- One arm per variant. Matching on `e`, a `&Expr`, binds references: `n` is a `&i64`, and the children are `&Box<Expr>`.
- `Num(n)` evaluates to `*n`. The other arms call `eval` on their children and combine the results with `-`, `+` or `*`.

#### Tips
- The deep test nests 100 levels, which recursion handles fine. A tree thousands of levels deep could overflow the stack and would need a loop with an explicit stack instead.

#### Docs
- [Rust book: Enabling recursive types with boxes](https://doc.rust-lang.org/book/ch15-01-box.html#enabling-recursive-types-with-boxes)

### 2. A linked stack

Implement a stack as a singly linked list of boxed nodes. `push` puts a new node at the head, `pop` removes the head and returns its value, `peek` borrows the head's value.

You can't move `self.head` out of `&mut self`, because that would leave the field empty. `self.head.take()` moves the `Option` out and leaves `None` behind, which is the trick for both `push` and `pop`. For `peek`, `self.head.as_ref()` turns `&Option<Box<Node<T>>>` into `Option<&Box<Node<T>>>`.

```rust starter
struct Node<T> {
    value: T,
    next: Option<Box<Node<T>>>,
}

pub struct Stack<T> {
    head: Option<Box<Node<T>>>,
    len: usize,
}

impl<T> Stack<T> {
    pub fn new() -> Self {
        Stack { head: None, len: 0 }
    }

    pub fn push(&mut self, value: T) {
        todo!()
    }

    pub fn pop(&mut self) -> Option<T> {
        todo!()
    }

    pub fn peek(&self) -> Option<&T> {
        todo!()
    }

    pub fn len(&self) -> usize {
        self.len
    }
}
```

```rust test
/// last in, first out
#[test]
fn lifo() {
    let mut s = Stack::new();
    s.push(1);
    s.push(2);
    s.push(3);
    assert_eq!(s.pop(), Some(3));
    assert_eq!(s.pop(), Some(2));
    assert_eq!(s.pop(), Some(1));
    assert_eq!(s.pop(), None);
}

/// peek and len
#[test]
fn peek_and_len() {
    let mut s = Stack::new();
    assert_eq!(s.peek(), None);
    s.push("a".to_string());
    s.push("b".to_string());
    assert_eq!(s.peek().map(|v| v.as_str()), Some("b"));
    assert_eq!(s.len(), 2);
    s.pop();
    assert_eq!(s.len(), 1);
}
```

#### Uses
- [Box, Rc & RefCell › Recursive types need indirection](#/smart-pointers/recursive-types-need-indirection)
- [Enums & match › `if let` and `let else`](#/enums/if-let-and-let-else)
- [Enums & match › `match`](#/enums/match)
- [Generics & bounds › Generic structs and conditional methods](#/generics/generic-structs-and-conditional-methods)

#### Hints
- `push`: the old head becomes the new node's `next`. Take it with `self.head.take()`, then set `self.head` to `Some(Box::new(Node { ... }))` and bump `len`.
- `pop`: use `let ... else` on `self.head.take()` to get the node or return `None`. The node's `next` becomes the new head, and its `value` is what you return.
- `peek`: `match self.head.as_ref()`. On `Some(node)` return `Some(&node.value)`; on `None`, `None`.

#### Tips
- You can move fields one by one out of a `Box` you own: after `take`, both `node.next` and `node.value` move out fine. That's special to `Box`; other smart pointers don't allow it.

#### Docs
- [std: Option::take](https://doc.rust-lang.org/std/option/enum.Option.html#method.take)
- [std: Option::as_ref](https://doc.rust-lang.org/std/option/enum.Option.html#method.as_ref)

### 3. A shared log

Several `Logger`s write to one shared list of lines. `new(prefix)` starts a fresh list; `child(prefix)` makes a logger with its own prefix that shares its parent's list. `log(msg)` appends `"<prefix>: <msg>"`. It takes `&self`, not `&mut self`, so the list must be behind a `RefCell`. `lines()` returns a copy of all lines so far, and `sharers()` is how many loggers share the list (`Rc::strong_count`).

```rust starter
use std::cell::RefCell;
use std::rc::Rc;

pub struct Logger {
    prefix: String,
    lines: Rc<RefCell<Vec<String>>>,
}

impl Logger {
    pub fn new(prefix: &str) -> Logger {
        todo!()
    }

    pub fn child(&self, prefix: &str) -> Logger {
        todo!()
    }

    pub fn log(&self, msg: &str) {
        todo!()
    }

    pub fn lines(&self) -> Vec<String> {
        todo!()
    }

    pub fn sharers(&self) -> usize {
        todo!()
    }
}
```

```rust test
/// children write to the same list
#[test]
fn shared_lines() {
    let app = Logger::new("app");
    let db = app.child("db");
    app.log("start");
    db.log("connect");
    app.log("ready");
    assert_eq!(app.lines(), vec!["app: start", "db: connect", "app: ready"]);
    assert_eq!(db.lines(), app.lines());
}

/// separate roots don't share
#[test]
fn separate_roots() {
    let a = Logger::new("a");
    let b = Logger::new("b");
    a.log("x");
    assert!(b.lines().is_empty());
}

/// counts the loggers sharing a list
#[test]
fn sharers() {
    let app = Logger::new("app");
    assert_eq!(app.sharers(), 1);
    let db = app.child("db");
    let cache = db.child("cache");
    assert_eq!(app.sharers(), 3);
    drop(db);
    drop(cache);
    assert_eq!(app.sharers(), 1);
}
```

#### Uses
- [Box, Rc & RefCell › `Rc<RefCell<T>>`: shared and mutable](#/smart-pointers/rcrefcellt-shared-and-mutable)
- [Box, Rc & RefCell › `Rc<T>`: shared ownership](#/smart-pointers/rct-shared-ownership)
- [Box, Rc & RefCell › `RefCell<T>`: borrow rules at runtime](#/smart-pointers/refcellt-borrow-rules-at-runtime)

#### Hints
- `new` wraps an empty `Vec` twice: first in a `RefCell`, then in an `Rc`. `child` builds a `Logger` whose `lines` is `Rc::clone(&self.lines)`.
- `log` pushes a `format!`ted line through `self.lines.borrow_mut()`.
- `lines` clones the `Vec` behind `self.lines.borrow()`. `sharers` asks `Rc::strong_count` about `self.lines`.

#### Tips
- Each `borrow_mut()` guard lives only until the end of its statement, so loggers taking turns never trip the runtime check.

#### Docs
- [Rust book: Allowing multiple owners of mutable data](https://doc.rust-lang.org/book/ch15-05-interior-mutability.html#allowing-multiple-owners-of-mutable-data-with-rct-and-refcellt)

### 4. A tree with parent pointers

Children are owned by their parent (`Rc`), and each child points back with a `Weak`, so the tree has no cycle of strong references. Write `add_child`, which creates a child, links it both ways and returns it, and `path`, which walks up the parent links and returns the names from the root down, joined with `/`.

`Rc::downgrade(&rc)` makes a `Weak`; `weak.upgrade()` gives back `Option<Rc<Node>>`.

```rust starter
use std::cell::RefCell;
use std::rc::{Rc, Weak};

pub struct Node {
    pub name: String,
    pub parent: RefCell<Weak<Node>>,
    pub children: RefCell<Vec<Rc<Node>>>,
}

impl Node {
    pub fn new(name: &str) -> Rc<Node> {
        Rc::new(Node {
            name: name.to_string(),
            parent: RefCell::new(Weak::new()),
            children: RefCell::new(Vec::new()),
        })
    }
}

pub fn add_child(parent: &Rc<Node>, name: &str) -> Rc<Node> {
    todo!()
}

pub fn path(node: &Rc<Node>) -> String {
    todo!()
}
```

```rust test
use std::rc::Rc;

/// builds paths from the root
#[test]
fn paths() {
    let root = Node::new("root");
    let usr = add_child(&root, "usr");
    let bin = add_child(&usr, "bin");
    assert_eq!(path(&bin), "root/usr/bin");
    assert_eq!(path(&root), "root");
}

/// parents own children, children don't own parents
#[test]
fn counts() {
    let root = Node::new("root");
    let a = add_child(&root, "a");
    add_child(&root, "b");
    assert_eq!(root.children.borrow().len(), 2);
    assert_eq!(Rc::strong_count(&root), 1);
    assert_eq!(Rc::weak_count(&root), 2);
    assert_eq!(Rc::strong_count(&a), 2);
}

/// a dropped parent disappears
#[test]
fn dropped_parent() {
    let root = Node::new("root");
    let usr = add_child(&root, "usr");
    drop(root);
    assert!(usr.parent.borrow().upgrade().is_none());
    assert_eq!(path(&usr), "usr");
}
```

#### Uses
- [Box, Rc & RefCell › `Weak<T>`: breaking cycles](#/smart-pointers/weakt-breaking-cycles)
- [Enums & match › `if let` and `let else`](#/enums/if-let-and-let-else)
- [Control flow › `loop`](#/control-flow/loop)

#### Hints
- `add_child` is the playground's `adopt`, plus creating the child with `Node::new(name)` first and returning it at the end.
- For `path`, start with a clone of the node's own name, and a `current` variable holding `node.parent.borrow().upgrade()`.
- In a `loop`, `let Some(p) = current else { break };`. Put `p.name` in front of the path with `format!`, then move `current` up to `p`'s parent.

#### Tips
- `upgrade()` returning `None` is how you recognize the root, and also why a dropped parent simply vanishes from the path instead of dangling.

#### Docs
- [Rust book: Creating a tree data structure](https://doc.rust-lang.org/book/ch15-06-reference-cycles.html#creating-a-tree-data-structure-a-node-with-child-nodes)
- [std: Weak::upgrade](https://doc.rust-lang.org/std/rc/struct.Weak.html#method.upgrade)
