# ARC & value semantics

Swift has no garbage collector and no manual `free`. Class instances are managed by Automatic Reference Counting: the compiler inserts retains and releases, and an object is destroyed the moment the last reference to it goes away. That makes deallocation deterministic — you can watch it happen — and it leaves exactly one thing for you to get right: cycles.

Structs, enums and the standard library collections are a different story. They are value types: assigning one copies it, so there is no sharing to manage in the first place. Understanding which of the two you are holding explains most surprising Swift behaviour.

## Values copy, references share

A `struct` is copied on assignment and on every function call. A `class` instance is not: both names refer to the same object, and a change through one is visible through the other.

```swift
struct SPoint { var x = 0 }
final class CPoint { var x = 0 }

var s1 = SPoint(); var s2 = s1; s2.x = 9    // s1.x is still 0
let c1 = CPoint(); let c2 = c1; c2.x = 9    // c1.x is now 9
```

Note that `let c1` still allows `c1.x = 9`: the constant is the *reference*, not the object. On a struct, `let` really does freeze the value.

## ARC counts references

Every class instance keeps a count of the strong references pointing at it. When the count reaches zero the instance is deinitialised immediately, and `deinit` runs. Nothing is deferred to a later collection pass.

```swift
final class Resource {
    let name: String
    init(name: String) { self.name = name; print("open \(name)") }
    deinit { print("close \(name)") }
}

do {
    let r = Resource(name: "db")   // open db
    _ = r
}                                  // close db, right here
```

A handy way to observe this in tests is a static counter bumped in `init` and dropped in `deinit`. Swift 6 requires mutable globals to declare their concurrency safety, so these read `nonisolated(unsafe) static var live = 0` — a promise you are not touching it from two threads at once.

## Strong reference cycles

If two objects hold strong references to each other, neither count ever reaches zero and neither is ever freed. Nothing crashes; the memory simply never comes back.

```swift
final class Parent { var child: Child? }
final class Child { var parent: Parent? }   // both strong: a leak
```

The fix is never to remove the link, but to make one direction not count. Ownership is a decision you make: the parent owns the child, so the child's link back is the one that gives up its claim.

## weak

`weak var` does not retain the object, and it is automatically set to `nil` when the object goes away. It must therefore be a `var` and an `Optional`.

```swift
final class Child {
    weak var parent: Parent?   // no retain, becomes nil when the parent dies
}
```

This is the right tool whenever the referenced object may legitimately outlive or predecease you — a parent link, a delegate, an observer's subject.

## unowned

`unowned` also does not retain, but it does not become `nil` either. Use it when the reference is guaranteed never to outlive what it points at, which lets it be a non-optional `let` and read without unwrapping.

```swift
final class Card {
    unowned let holder: Customer   // a card cannot exist without its holder
    init(holder: Customer) { self.holder = holder }
}
```

The guarantee is yours to keep: reading an `unowned` reference after its target has been freed traps at runtime. When you are not certain, `weak` is the safe choice.

## Capture lists

A closure captures the values it mentions, strongly by default. If an object stores a closure that mentions that same object, you have a cycle — or, even without a cycle, a stored closure can keep an object alive long after you meant to release it.

A capture list at the top of the closure changes that:

```swift
button.onTap = { [weak self] in
    guard let self else { return }
    self.refresh()
}
```

`[weak self]` makes `self` an optional inside the closure, and `guard let self else { return }` is the idiom for "do nothing if it has gone". `[unowned self]` is the non-optional version with the same caveat as above.

Only *escaping* closures — ones stored for later — can create this problem. A closure passed to `map` or `forEach` runs and is gone, so a `[weak self]` there is noise.

Two details trip people up. `guard let self else { return }` does not merely unwrap: it takes a strong reference for the rest of the closure body, so `self` cannot vanish halfway through. And the capture list is decided when the closure is *created*, not when it runs — writing `[weak self]` after the closure has already been stored somewhere changes nothing about the copy that is stored.

A `[weak self]` closure that is never run again is not a leak by itself, but it does keep the closure's other captures alive. If a stored closure is meant to be temporary, drop it from wherever it is stored as well.

## Copy-on-write

`Array`, `String`, `Dictionary` and `Set` are structs, but they do not really copy their storage on every assignment; that would be ruinous. They share the buffer until someone writes to it, and only then does the writer take its own copy. The behaviour is pure value semantics, and the cost is paid only when it has to be.

You can build the same thing. `isKnownUniquelyReferenced(&ref)` reports whether a class reference is the only strong reference to its object, which is exactly the question "is it safe to write in place?".

```swift
struct Buffer {
    private var storage: Storage
    mutating func append(_ n: Int) {
        if !isKnownUniquelyReferenced(&storage) { storage = storage.copy() }
        storage.items.append(n)
    }
}
```

The check has to be on a `var` you can pass as `inout`, and it has to happen inside a `mutating` method, before the write.

```swift playground
struct SPoint { var x = 0 }
final class CPoint { var x = 0 }

var s1 = SPoint(); var s2 = s1; s2.x = 9
let c1 = CPoint(); let c2 = c1; c2.x = 9
print("struct:", s1.x, s2.x, "| class:", c1.x, c2.x)

final class Resource {
    nonisolated(unsafe) static var live = 0
    let name: String
    init(name: String) { self.name = name; Resource.live += 1 }
    deinit { Resource.live -= 1 }
}

do {
    let a = Resource(name: "a")
    let b = a                       // same object, count 2
    print("inside:", Resource.live, a.name, b.name)
}
print("after:", Resource.live)      // 0 — freed the instant the scope ended

final class Node {
    let name: String
    var children: [Node] = []
    weak var parent: Node?          // strong here would leak the whole tree
    init(_ name: String) { self.name = name }
    func add(_ child: Node) { children.append(child); child.parent = self }
}

func orphan() -> Node {
    let root = Node("root")
    let leaf = Node("leaf")
    root.add(leaf)
    return leaf                     // root dies here
}
print("orphan's parent:", orphan().parent?.name as Any)

final class Storage { var items: [Int]; init(_ items: [Int]) { self.items = items } }

struct Buffer {
    nonisolated(unsafe) static var copies = 0
    private var storage: Storage
    init(_ items: [Int] = []) { storage = Storage(items) }
    var items: [Int] { storage.items }
    mutating func append(_ n: Int) {
        if !isKnownUniquelyReferenced(&storage) {
            storage = Storage(storage.items)
            Buffer.copies += 1
        }
        storage.items.append(n)
    }
}

var first = Buffer([1, 2])
first.append(3)                     // sole owner, writes in place
var second = first                  // shares the buffer, copies nothing yet
second.append(9)                    // now it has to copy
second.append(10)                   // sole owner again
print(first.items, second.items, "copies:", Buffer.copies)
```

## Exercises

### 1. A tree that frees itself

`Node` builds a tree: `add` puts a child in `children` and points the child back at its parent. As written, parent and child hold each other strongly and nothing is ever deallocated. Change the back link so a whole tree is freed when its root goes out of scope, and so a child whose parent has already gone reports `nil` for `parent`.

```swift starter
final class Node {
    nonisolated(unsafe) static var live = 0

    let name: String
    var children: [Node] = []
    var parent: Node?

    init(_ name: String) { self.name = name; Node.live += 1 }
    deinit { Node.live -= 1 }

    func add(_ child: Node) {
        children.append(child)
        child.parent = self
    }
}
```

```swift test
func orphan() -> Node {
    let root = Node("root")
    let leaf = Node("leaf")
    root.add(leaf)
    return leaf
}

/// a tree is freed when the root goes away
func testFreesTree() {
    Node.live = 0
    do {
        let root = Node("root")
        for name in ["a", "b", "c"] { root.add(Node(name)) }
        expect(Node.live, 4)
    }
    expect(Node.live, 0)
}

/// a deeper tree too
func testFreesDeepTree() {
    Node.live = 0
    do {
        let root = Node("root")
        var tip = root
        for i in 0..<5 {
            let next = Node("n\(i)")
            tip.add(next)
            tip = next
        }
        expect(Node.live, 6)
    }
    expect(Node.live, 0)
}

/// children still know their parent while it is alive
func testParentLinkWorks() {
    Node.live = 0
    do {
        let root = Node("root")
        root.add(Node("a"))
        root.add(Node("b"))
        expect(root.children.count, 2)
        expect(root.children[0].parent?.name, "root")
        expect(root.children[1].parent?.name, "root")
    }
    expect(Node.live, 0)
}

/// a surviving child loses its parent link
func testOrphan() {
    Node.live = 0
    let leaf = orphan()
    expect(leaf.name, "leaf")
    expect(leaf.parent == nil, "the parent is gone, so parent should be nil")
    expect(Node.live, 1)
}
```

#### Uses
- [ARC & value semantics › Strong reference cycles](#/memory/strong-reference-cycles)
- [ARC & value semantics › weak](#/memory/weak)
- [ARC & value semantics › ARC counts references](#/memory/arc-counts-references)

#### Hints
- One keyword on one line is the whole fix.
- The parent link is the one that should not keep the parent alive: the parent already owns the child through `children`.
- It has to stay a `var` and an `Optional`, because it is set to `nil` for you when the parent is deallocated.

#### Tips
- `unowned` would also break the cycle, but `testOrphan` reads `parent` *after* the parent is gone, which an `unowned` reference is not allowed to survive.
- The counting is done by `deinit`, which ARC runs the instant the last strong reference goes. That is why the test can assert `Node.live == 0` on the line straight after the `do` block.

#### Docs
- [Resolving strong reference cycles](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/#Resolving-Strong-Reference-Cycles-Between-Class-Instances)

### 2. A handler that lets go

`Listener.attach(to:)` registers a closure on an `Emitter`, which stores it for later. The closure captures `self` strongly, so the emitter keeps every listener alive forever. Change the capture so that a listener is deallocated as soon as nothing else holds it, and so that firing the emitter afterwards does nothing instead of counting a fire.

```swift starter
final class Emitter {
    private var handlers: [() -> Void] = []
    func on(_ handler: @escaping () -> Void) { handlers.append(handler) }
    func fire() { for handler in handlers { handler() } }
}

final class Listener {
    nonisolated(unsafe) static var live = 0
    nonisolated(unsafe) static var fires = 0

    let name: String
    init(_ name: String) { self.name = name; Listener.live += 1 }
    deinit { Listener.live -= 1 }

    func attach(to emitter: Emitter) {
        emitter.on {
            Listener.fires += 1
            _ = self.name
        }
    }
}
```

```swift test
/// a listener still in use hears the event
func testLiveListener() {
    Listener.live = 0
    Listener.fires = 0
    let emitter = Emitter()
    let kept = Listener("kept")
    kept.attach(to: emitter)
    emitter.fire()
    expect(Listener.fires, 1)
    emitter.fire()
    expect(Listener.fires, 2)
    expect(Listener.live, 1)
}

/// the emitter does not keep a listener alive
func testReleased() {
    Listener.live = 0
    Listener.fires = 0
    let emitter = Emitter()
    do {
        let temporary = Listener("temporary")
        temporary.attach(to: emitter)
        expect(Listener.live, 1)
    }
    expect(Listener.live, 0)
}

/// firing after the listener has gone does nothing
func testFireAfterRelease() {
    Listener.live = 0
    Listener.fires = 0
    let emitter = Emitter()
    do { Listener("gone").attach(to: emitter) }
    emitter.fire()
    emitter.fire()
    expect(Listener.fires, 0)
    expect(Listener.live, 0)
}

/// live and dead listeners on one emitter
func testMixed() {
    Listener.live = 0
    Listener.fires = 0
    let emitter = Emitter()
    do { Listener("gone").attach(to: emitter) }
    let kept = Listener("kept")
    kept.attach(to: emitter)
    emitter.fire()
    expect(Listener.fires, 1)
    expect(Listener.live, 1)
}
```

#### Uses
- [ARC & value semantics › Capture lists](#/memory/capture-lists)
- [ARC & value semantics › weak](#/memory/weak)
- [ARC & value semantics › ARC counts references](#/memory/arc-counts-references)

#### Hints
- Put a capture list at the very start of the closure: `emitter.on { [weak self] in ... }`.
- Inside, `self` is now an `Optional`. `guard let self else { return }` before counting the fire.
- Only count `Listener.fires` when `self` is still there — that is what `testFireAfterRelease` checks.

#### Tips
- There is no cycle here: the listener does not hold the emitter. A stored escaping closure keeps its captures alive all by itself, which is enough to leak.
- `guard let self else { return }` has to come before `Listener.fires += 1`, or a dead listener still counts its fire.
- The capture list goes at the very start of the closure, before the parameters and before `in`.

#### Docs
- [Strong reference cycles for closures](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/#Strong-Reference-Cycles-for-Closures)

### 3. Copy only when shared

`Buffer` is a value type backed by a class, like `Array` is. Make `append` behave the way copy-on-write does: write straight into the storage when this buffer is its only owner, and take a private copy first when the storage is shared, bumping `Buffer.copies` once per copy. Two buffers must never see each other's writes, and no copy may happen while a buffer is the sole owner.

```swift starter
final class Storage {
    var items: [Int]
    init(_ items: [Int]) { self.items = items }
}

struct Buffer {
    nonisolated(unsafe) static var copies = 0

    private var storage: Storage

    init(_ items: [Int] = []) { storage = Storage(items) }

    var items: [Int] { storage.items }

    mutating func append(_ n: Int) {
        storage.items.append(n)
    }
}
```

```swift test
/// a sole owner writes in place
func testNoCopyWhenUnique() {
    Buffer.copies = 0
    var b = Buffer([1, 2])
    b.append(3)
    b.append(4)
    expect(b.items, [1, 2, 3, 4])
    expect(Buffer.copies, 0)
}

/// copies are independent
func testIndependent() {
    Buffer.copies = 0
    var a = Buffer([1, 2])
    var b = a
    b.append(9)
    expect(a.items, [1, 2])
    expect(b.items, [1, 2, 9])
    a.append(3)
    expect(a.items, [1, 2, 3])
    expect(b.items, [1, 2, 9])
}

/// the copy happens once, when the storage is shared
func testCopiesOnce() {
    Buffer.copies = 0
    var a = Buffer([1])
    var b = a
    b.append(2)
    expect(Buffer.copies, 1)
    b.append(3)
    b.append(4)
    expect(Buffer.copies, 1)
    expect(b.items, [1, 2, 3, 4])
    expect(a.items, [1])
}

/// three-way sharing
func testThreeWay() {
    Buffer.copies = 0
    var a = Buffer([0])
    var b = a
    var c = a
    b.append(1)
    c.append(2)
    a.append(3)
    expect(a.items, [0, 3])
    expect(b.items, [0, 1])
    expect(c.items, [0, 2])
    expect(Buffer.copies, 2)
}
```

#### Uses
- [ARC & value semantics › Copy-on-write](#/memory/copy-on-write)
- [ARC & value semantics › Values copy, references share](#/memory/values-copy-references-share)
- [ARC & value semantics › ARC counts references](#/memory/arc-counts-references)

#### Hints
- `isKnownUniquelyReferenced(&storage)` is `true` when this buffer holds the only strong reference. It needs `&`, so it only works on a stored `var` inside a `mutating` method.
- When it is `false`, replace `storage` with a fresh `Storage(storage.items)` and add one to `Buffer.copies`, then append as normal.
- Do the check *before* the append, not after.

#### Tips
- In `testThreeWay`, only two copies happen. After `b` and `c` have each taken their own storage, `a` is the sole owner of the original and appends in place — which is exactly the saving copy-on-write exists for.
- `isKnownUniquelyReferenced` takes `&storage`, so `storage` has to be a stored `var` and the method has to be `mutating`. A computed property or a `let` will not compile.

#### Docs
- [isKnownUniquelyReferenced](https://developer.apple.com/documentation/swift/isknownuniquelyreferenced(_:))

### 4. A card that cannot outlive its holder

A `Customer` owns at most one `Card`, and a `Card` always belongs to exactly one `Customer`. As written the two hold each other strongly and neither is ever freed. Fix the back link from the card so both objects are deallocated together, while keeping `holder` a non-optional `let` that `summary` can read without unwrapping.

```swift starter
final class Customer {
    nonisolated(unsafe) static var live = 0

    let name: String
    var card: Card?

    init(name: String) { self.name = name; Customer.live += 1 }
    deinit { Customer.live -= 1 }

    func issueCard(number: String) {
        card = Card(number: number, holder: self)
    }
}

final class Card {
    nonisolated(unsafe) static var live = 0

    let number: String
    let holder: Customer

    init(number: String, holder: Customer) { self.number = number; self.holder = holder; Card.live += 1 }
    deinit { Card.live -= 1 }

    var summary: String { "\(number) (\(holder.name))" }
}
```

```swift test
/// the card can read its holder
func testSummary() {
    Customer.live = 0
    Card.live = 0
    do {
        let c = Customer(name: "Ada")
        c.issueCard(number: "4242")
        expect(c.card?.summary, "4242 (Ada)")
        expect(Customer.live, 1)
        expect(Card.live, 1)
    }
    expect(Customer.live, 0)
}

/// both objects are freed together
func testBothFreed() {
    Customer.live = 0
    Card.live = 0
    do {
        let c = Customer(name: "Grace")
        c.issueCard(number: "1111")
    }
    expect(Customer.live, 0)
    expect(Card.live, 0)
}

/// many customers leave nothing behind
func testManyFreed() {
    Customer.live = 0
    Card.live = 0
    do {
        var customers: [Customer] = []
        for i in 0..<10 {
            let c = Customer(name: "c\(i)")
            c.issueCard(number: "\(i)")
            customers.append(c)
        }
        expect(Customer.live, 10)
        expect(Card.live, 10)
    }
    expect(Customer.live, 0)
    expect(Card.live, 0)
}

/// a customer without a card is unaffected
func testNoCard() {
    Customer.live = 0
    Card.live = 0
    do {
        let c = Customer(name: "Alan")
        expect(c.card == nil, "no card was issued")
        expect(Card.live, 0)
    }
    expect(Customer.live, 0)
}
```

#### Uses
- [ARC & value semantics › unowned](#/memory/unowned)
- [ARC & value semantics › Strong reference cycles](#/memory/strong-reference-cycles)
- [ARC & value semantics › weak](#/memory/weak)

#### Hints
- One keyword, on the declaration of `holder`.
- `weak` would not work here: it forces the property to be an optional `var`, and `summary` is written against a non-optional `let`.
- The keyword you want says "this reference does not retain, and I promise the target outlives me".

#### Tips
- The promise is real. If a `Card` somehow survived its `Customer` and something read `holder`, the program would trap. `unowned` is the right choice only when the lifetimes really are nested, as they are here.
- `weak` and `unowned` both break the cycle; only `unowned` lets `holder` stay a non-optional `let`. The test that reads `summary` is what forces the choice.

#### Docs
- [Unowned references](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/#Unowned-References)
