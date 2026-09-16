# Generics

Generics let you write one piece of code that works for many types without giving up type safety. `Array` is generic, `Optional` is generic, `Dictionary` is generic — almost everything you have used so far already is. Writing your own is the same idea: name a placeholder type, use it in the signature, and let the compiler fill it in at each call site.

The payoff is that the compiler still knows the real type. `Stack<Int>.pop()` gives you an `Int?`, not an `Any?` you have to cast, and a mistake is a compile error rather than a crash.

## A function for any type

A type parameter goes in angle brackets after the function name and can then be used anywhere a type can. The caller never writes it: it is inferred from the arguments.

```swift
func pair<T>(_ a: T, _ b: T) -> [T] { [a, b] }

pair(1, 2)          // [Int]
pair("a", "b")      // [String]
// pair(1, "a")     // error: both arguments have to be the same T
```

With no constraints, `T` could be anything, so the body can only do things every type can do: store it, pass it along, put it in an array. It cannot compare two `T`s or print one meaningfully.

## Constraints

A constraint says what the placeholder must be able to do, which unlocks the operations you need. Write it after a colon, or in a `where` clause when it gets long.

```swift
func largest<T: Comparable>(_ items: [T]) -> T? {
    items.reduce(nil) { best, item in
        guard let best else { return item }
        return item > best ? item : best
    }
}

func tally<T>(_ items: [T]) -> [T: Int] where T: Hashable {
    items.reduce(into: [:]) { counts, item in counts[item, default: 0] += 1 }
}
```

`T: Comparable` makes `>` available. `T: Hashable` makes `T` usable as a dictionary key. The constraint is a promise both ways: the body may rely on it, and the compiler checks every caller keeps it.

## Generic types

Structs, classes and enums take type parameters too. The parameter is in scope for the whole declaration, including its extensions.

```swift
struct Pair<A, B> {
    let first: A
    let second: B
    func swapped() -> Pair<B, A> { Pair<B, A>(first: second, second: first) }
}

let p = Pair(first: 1, second: "one")   // Pair<Int, String>
```

A constrained extension can add members to only some versions of the type, exactly the way it does for `Array`:

```swift
extension Pair where A == B, A: Equatable {
    var isMatched: Bool { first == second }
}
```

## Associated types

A protocol cannot take angle-bracket parameters. Instead it declares an `associatedtype`: a placeholder that each conforming type fills in, usually by inference from the methods it implements.

```swift
protocol Container {
    associatedtype Item
    var count: Int { get }
    func item(at index: Int) -> Item
}

struct Bag: Container {
    let contents: [String]
    var count: Int { contents.count }
    func item(at index: Int) -> String { contents[index] }   // Item == String
}
```

A generic function reaches the associated type through the type parameter: `C.Item` inside `func describe<C: Container>(_ c: C)`. This is exactly how `Element` works on `Sequence`.

## some and any

A protocol with an associated type cannot be used as a plain type — Swift needs to know *which* `Item`. Two keywords resolve that.

`some Container` means "one specific type that conforms, chosen by the implementation, fixed at compile time". It is an opaque type: the caller knows the protocol, not the concrete type, and there is no runtime cost.

`any Container` means "some conforming value, boxed, decided at runtime". It is an existential: different elements of `[any Shape]` can be different types, at the cost of a level of indirection and the loss of the associated type.

```swift
protocol Shape { var area: Double { get } }

func total(_ shapes: [any Shape]) -> Double {   // a mixed array needs `any`
    shapes.reduce(0) { $0 + $1.area }
}
```

Reach for `some` by default and `any` when you genuinely need a heterogeneous collection.

```swift playground
func pair<T>(_ a: T, _ b: T) -> [T] { [a, b] }
print(pair(1, 2), pair("a", "b"))

func tally<T: Hashable>(_ items: [T]) -> [T: Int] {
    items.reduce(into: [:]) { counts, item in counts[item, default: 0] += 1 }
}
print(tally(["a", "b", "a"]).sorted { $0.key < $1.key })

struct Stack<Element> {
    private var storage: [Element] = []
    var count: Int { storage.count }
    mutating func push(_ item: Element) { storage.append(item) }
    mutating func pop() -> Element? { storage.popLast() }
}

var s = Stack<Int>()
for n in 1...3 { s.push(n) }
var copy = s              // a struct, so this is an independent copy
print(s.pop() as Any, s.count, copy.count)

protocol Container {
    associatedtype Item
    var count: Int { get }
    func item(at index: Int) -> Item
}

struct Countdown: Container {
    let from: Int
    var count: Int { max(0, from) }
    func item(at index: Int) -> Int { from - index }
}

func allItems<C: Container>(_ container: C) -> [C.Item] {
    (0..<container.count).map(container.item(at:))
}
print(allItems(Countdown(from: 5)))

protocol Shape { var area: Double { get } }
struct Square: Shape { let side: Double; var area: Double { side * side } }
struct Rect: Shape { let w: Double, h: Double; var area: Double { w * h } }

let shapes: [any Shape] = [Square(side: 2), Rect(w: 3, h: 4)]
print(shapes.reduce(0) { $0 + $1.area })
```

## Exercises

### 1. Chunked

`chunked(_:size:)` splits a list into runs of at most `size`, keeping the original order. The final chunk is short when the count does not divide evenly. A `size` of zero or less has no sensible answer, so return an empty array; an empty input also gives an empty array. It works for any element type.

```swift starter
func chunked<T>(_ items: [T], size: Int) -> [[T]] {
    return []
}
```

```swift test
/// splits evenly
func testEven() {
    expect(chunked([1, 2, 3, 4], size: 2), [[1, 2], [3, 4]])
    expect(chunked([1, 2, 3, 4, 5, 6], size: 3), [[1, 2, 3], [4, 5, 6]])
    expect(chunked([1, 2, 3], size: 1), [[1], [2], [3]])
}

/// the last chunk can be short
func testRemainder() {
    expect(chunked([1, 2, 3, 4, 5], size: 2), [[1, 2], [3, 4], [5]])
    expect(chunked([1, 2, 3], size: 5), [[1, 2, 3]])
}

/// any element type
func testStrings() {
    expect(chunked(["a", "b", "c"], size: 2), [["a", "b"], ["c"]])
    expect(chunked([true, false, true], size: 2), [[true, false], [true]])
}

/// empty input and useless sizes
func testEdges() {
    expect(chunked([Int](), size: 3), [])
    expect(chunked([1, 2, 3], size: 0), [])
    expect(chunked([1, 2, 3], size: -1), [])
}
```

#### Uses
- [Generics › A function for any type](#/generics/a-function-for-any-type)

#### Hints
- Guard the bad sizes first: `guard size > 0 else { return [] }`.
- `stride(from: 0, to: items.count, by: size)` gives you each chunk's starting index.
- `Array(items[start ..< min(start + size, items.count)])` is one chunk; slicing gives an `ArraySlice`, so wrap it in `Array`.

#### Tips
- No constraint is needed here. The body only moves elements around, and every type can do that.
- `items[start ..< min(start + size, items.count)]` is where the short final chunk comes from. Without the `min` the last slice runs past the end and traps.

#### Docs
- [stride(from:to:by:)](https://developer.apple.com/documentation/swift/stride(from:to:by:)-8ivxc)
- [Generic functions](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/generics/#Generic-Functions)

### 2. A stack of anything

Finish `Stack<Element>`. `push` adds to the top, `pop` removes and returns the top or `nil` when empty, `peek` returns the top without removing it, and `all` lists the contents from bottom to top. `Stack` is a struct, so assigning one to a new variable makes an independent copy.

```swift starter
struct Stack<Element> {
    private var storage: [Element] = []

    var count: Int { 0 }
    var isEmpty: Bool { true }
    var all: [Element] { [] }

    mutating func push(_ item: Element) {
    }

    mutating func pop() -> Element? {
        return nil
    }

    func peek() -> Element? {
        return nil
    }
}
```

```swift test
/// push then read back, bottom to top
func testPush() {
    var s = Stack<Int>()
    expect(s.isEmpty, true)
    s.push(1)
    s.push(2)
    s.push(3)
    expect(s.all, [1, 2, 3])
    expect(s.count, 3)
    expect(s.isEmpty, false)
}

/// pop takes the most recent first
func testPop() {
    var s = Stack<String>()
    s.push("a")
    s.push("b")
    expect(s.pop(), "b")
    expect(s.pop(), "a")
    expect(s.pop(), nil)
    expect(s.count, 0)
    expect(s.isEmpty, true)
}

/// peek looks without removing
func testPeek() {
    var s = Stack<Int>()
    expect(s.peek(), nil)
    s.push(7)
    expect(s.peek(), 7)
    expect(s.peek(), 7)
    expect(s.count, 1)
    s.push(8)
    expect(s.peek(), 8)
}

/// a copy is independent
func testValueSemantics() {
    var a = Stack<Int>()
    a.push(1)
    var b = a
    b.push(2)
    expect(a.all, [1])
    expect(b.all, [1, 2])
    _ = b.pop()
    expect(a.all, [1])
    expect(b.all, [1])
}
```

#### Uses
- [Generics › Generic types](#/generics/generic-types)
- [Generics › A function for any type](#/generics/a-function-for-any-type)

#### Hints
- Every member is one line over `storage`: `storage.count`, `storage.isEmpty`, `storage`, `storage.append(item)`.
- `storage.popLast()` already returns `Element?` and does nothing when the array is empty.
- `peek` is `storage.last`. It is not `mutating`, because it changes nothing.

#### Tips
- The value-semantics test needs no work from you. `storage` is an `Array`, which is itself a value type, so copying a `Stack` copies its contents.
- `popLast()` already returns `Element?` and does nothing on an empty array, so `pop()` needs no emptiness check of its own.

#### Docs
- [Generic types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/generics/#Generic-Types)

### 3. Reading any Container

`Container` has an `associatedtype Item`. Write two free functions over it: `allItems` returns every item in index order, and `lastItem` returns the item at the final index, or `nil` when the container is empty. Both must work for any conforming type, whatever its `Item` is.

```swift starter
protocol Container {
    associatedtype Item
    var count: Int { get }
    func item(at index: Int) -> Item
}

struct Bag: Container {
    let contents: [String]
    var count: Int { contents.count }
    func item(at index: Int) -> String { contents[index] }
}

struct Countdown: Container {
    let from: Int
    var count: Int { max(0, from) }
    func item(at index: Int) -> Int { from - index }
}

func allItems<C: Container>(_ container: C) -> [C.Item] {
    return []
}

func lastItem<C: Container>(_ container: C) -> C.Item? {
    return nil
}
```

```swift test
/// reads a container of strings
func testBag() {
    expect(allItems(Bag(contents: ["a", "b", "c"])), ["a", "b", "c"])
    expect(allItems(Bag(contents: ["only"])), ["only"])
}

/// reads a container of ints, computed on demand
func testCountdown() {
    expect(allItems(Countdown(from: 3)), [3, 2, 1])
    expect(allItems(Countdown(from: 1)), [1])
}

/// empty containers give empty results
func testEmpty() {
    expect(allItems(Bag(contents: [])), [])
    expect(allItems(Countdown(from: 0)), [])
    expect(lastItem(Bag(contents: [])), nil)
    expect(lastItem(Countdown(from: 0)), nil)
}

/// the last item comes from the final index
func testLast() {
    expect(lastItem(Bag(contents: ["a", "b", "c"])), "c")
    expect(lastItem(Bag(contents: ["x"])), "x")
    expect(lastItem(Countdown(from: 4)), 1)
    expect(lastItem(Countdown(from: 1)), 1)
}
```

#### Uses
- [Generics › Associated types](#/generics/associated-types)
- [Generics › Constraints](#/generics/constraints)

#### Hints
- The indices are `0 ..< container.count`, so `(0 ..< container.count).map { container.item(at: $0) }` is the whole of `allItems`.
- `lastItem` must check for empty first: index `count - 1` is `-1` for an empty container, and `Bag` would crash on it.
- Both return types are written in terms of `C.Item`; you never name `String` or `Int` anywhere.

#### Tips
- `Countdown` never stores its items. A `Container` only promises a count and a way to get an item, so a computed sequence conforms just as well as an array.
- `C.Item` is how you name an associated type from outside. You never write `String` or `Int`, which is what lets one function serve both containers.

#### Docs
- [Associated types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/generics/#Associated-Types)

### 4. A mixed bag of shapes

`totalArea` adds up the areas of a list of shapes that may be of different concrete types, and `largestName` returns the `name` of the shape with the biggest area — the first one when several tie, and `nil` for an empty list.

```swift starter
protocol Shape {
    var name: String { get }
    var area: Double { get }
}

struct Rect: Shape {
    let width: Double, height: Double
    var name: String { "rect" }
    var area: Double { width * height }
}

struct Square: Shape {
    let side: Double
    var name: String { "square" }
    var area: Double { side * side }
}

struct Triangle: Shape {
    let base: Double, height: Double
    var name: String { "triangle" }
    var area: Double { base * height / 2 }
}

func totalArea(_ shapes: [any Shape]) -> Double {
    return 0
}

func largestName(_ shapes: [any Shape]) -> String? {
    return nil
}
```

```swift test
/// adds areas across different types
func testTotal() {
    expect(totalArea([Rect(width: 2, height: 3), Square(side: 4)]), 22)
    expect(totalArea([Triangle(base: 4, height: 5)]), 10)
    expect(totalArea([Square(side: 1), Square(side: 2), Square(side: 3)]), 14)
}

/// an empty list totals zero
func testEmptyTotal() {
    expect(totalArea([]), 0)
    expect(largestName([]), nil)
}

/// the biggest area wins
func testLargest() {
    expect(largestName([Rect(width: 2, height: 3), Square(side: 4)]), "square")
    expect(largestName([Square(side: 4), Rect(width: 2, height: 3)]), "square")
    expect(largestName([Triangle(base: 10, height: 10), Square(side: 4)]), "triangle")
}

/// ties keep the first shape
func testTies() {
    expect(largestName([Square(side: 2), Rect(width: 2, height: 2)]), "square")
    expect(largestName([Rect(width: 2, height: 2), Square(side: 2)]), "rect")
    expect(largestName([Square(side: 3)]), "square")
}
```

#### Uses
- [Generics › some and any](#/generics/some-and-any)
- [Generics › Constraints](#/generics/constraints)

#### Hints
- `shapes.reduce(0) { $0 + $1.area }` is the total; every element answers `.area` whatever it really is.
- For the largest, a plain loop that keeps the best so far is clearest: replace it only when `shape.area > best.area`, which leaves ties alone.
- `max(by:)` also works, but check which of two equal elements it keeps before relying on it for the tie rule.

#### Tips
- `[any Shape]` is what allows one array to hold a `Rect`, a `Square` and a `Triangle`. A plain `[Shape]` means the same thing — `any` is just written out — but `[some Shape]` would force every element to be the same type.
- Through the box you can call only what the protocol declares. `area` works because it is a requirement; a `Rect`'s `width` is invisible without an `as?` cast.

#### Docs
- [Existential types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/#Protocols-as-Types)
- [Opaque types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/opaquetypes/)
