# Protocols

A protocol is a list of requirements — properties, methods, initializers — that a type can promise to meet. It describes what something can do without saying anything about what it is, so a struct, a class and an enum can all satisfy the same protocol. Swift leans on this hard: sorting, printing, looping and equality are all protocols, which is why your own types can join in.

## Declaring a protocol

A protocol body looks like a type body with the implementations removed:

```swift
protocol Shape {
    var name: String { get }
    func area() -> Double
    func describe() -> String
}
```

Naming convention: a protocol describing what something *is* gets a noun (`Shape`, `Collection`), and one describing a capability usually ends in `-able` or `-ible` (`Equatable`, `Comparable`, `CustomStringConvertible`).

## Conforming

A type conforms by listing the protocol after its name and providing everything the protocol asks for:

```swift
struct Rect: Shape {
    var width: Double
    var height: Double

    var name: String { width == height ? "square" : "rectangle" }
    func area() -> Double { width * height }
    func describe() -> String { "\(name) \(width) by \(height)" }
}
```

If anything is missing the compiler says so and offers to stub it in. Structs, classes and enums conform the same way, and a type can conform to as many protocols as it likes. Conformance can also be added later, in an extension, including to types you did not write.

## Property requirements

A property requirement is always declared `var`, and says whether it needs to be readable or readable and writable:

```swift
protocol Account {
    var owner: String { get }
    var balance: Int { get set }
}
```

`{ get }` is the weaker requirement, so it can be satisfied by a `let`, a `var`, or a computed property with only a getter. `{ get set }` needs something assignable: a `var` stored property or a computed property with both. `static var` works the same way for a requirement on the type itself.

## Mutating requirements

A method that would change a struct's own properties must be declared `mutating` in the protocol:

```swift
protocol Resettable {
    mutating func reset()
}
```

A struct or enum then implements it as `mutating func reset()`. A class implements it as a plain `func reset()` — classes never need `mutating`. Leaving `mutating` out of the protocol would make the requirement impossible for value types to satisfy honestly, so put it in whenever a value type might want to conform.

## Default implementations

An extension on the protocol can supply an implementation that every conforming type gets for free:

```swift
extension Shape {
    func describe() -> String { "\(name) of area \(area())" }
}
```

Now a type only has to write `describe()` if it wants something different. This is how a protocol can be small to conform to and still offer a lot: `Comparable` requires only `<`, and the extension gives you `>`, `<=` and `>=`.

## Requirement or just an extension?

There is a trap here worth knowing before it bites. A method declared **in the protocol** and defaulted in an extension is dispatched dynamically — a value of type `any Shape` calls the conforming type's version. A method that appears **only in the extension** is not a requirement, so the call is resolved statically from the declared type:

```swift
protocol Greeter { }
extension Greeter { func hello() -> String { "hi" } }

struct Loud: Greeter { func hello() -> String { "HI!" } }

Loud().hello()                      // "HI!"
(Loud() as any Greeter).hello()     // "hi" — the extension's version
```

The rule: if conforming types are supposed to be able to override it, declare it in the protocol as well as defaulting it in the extension.

## Protocols as types

A protocol can be used as a type, written `any Shape`. That is an *existential*: a box holding some value that conforms, with the concrete type erased:

```swift
let shapes: [any Shape] = [Rect(width: 3, height: 3), Circle(radius: 1)]
let total = shapes.reduce(0) { $0 + $1.area() }
```

Through the box you can call anything the protocol declares and nothing else. The `any` keyword is required so that this cost — a box, and a dynamic call — is visible at the point where you pay it. The alternative, generics with `some Shape` and type parameters, keeps the concrete type and comes later in the roadmap.

`is` and `as?` recover a concrete type when you really need it: `if let r = shape as? Rect { ... }`.

## Protocol composition and inheritance

Two protocols can be required at once with `&`, and a protocol can build on others:

```swift
func show(_ item: any Shape & CustomStringConvertible) {
    print(item.description, item.area())
}

protocol NamedShape: Shape {
    var label: String { get }
}
```

A protocol composition is an ad-hoc requirement made at the point of use, which is usually better than inventing a new protocol that exists only to combine two others.

## Protocols in the standard library

Conforming to the standard protocols is how a type joins the language's own machinery:

- `Equatable` gives you `==`, `!=`, `contains`, `firstIndex(of:)`. For a struct or enum whose parts are all `Equatable`, declaring the conformance is enough — Swift writes `==` for you.
- `Comparable` requires only `static func < (lhs:rhs:)` and unlocks `<`, `>`, `sorted()`, `min()`, `max()`, and ranges.
- `Hashable` lets a value be a `Set` member or a dictionary key, and is also synthesized.
- `CustomStringConvertible` requires `var description: String` and is what `print` and `"\(value)"` use.
- `CaseIterable`, which you have already met on enums, is one of these too.

```swift
struct Version: Comparable, CustomStringConvertible {
    let major: Int
    let minor: Int

    var description: String { "\(major).\(minor)" }

    static func < (a: Version, b: Version) -> Bool {
        (a.major, a.minor) < (b.major, b.minor)
    }
}
```

That is nine or ten lines for a type that sorts, compares, prints and deduplicates like a built-in one.

```swift playground
protocol Shape {
    var name: String { get }
    func area() -> Double
    func describe() -> String
}

extension Shape {
    func describe() -> String { "\(name) of area \(area())" }
}

struct Rect: Shape {
    var width: Double
    var height: Double
    var name: String { width == height ? "square" : "rectangle" }
    func area() -> Double { width * height }
}

struct Circle: Shape {
    var radius: Double
    let name = "circle"
    func area() -> Double { Double.pi * radius * radius }
    func describe() -> String { "circle of radius \(radius)" }
}

let shapes: [any Shape] = [Rect(width: 3, height: 3), Circle(radius: 1), Rect(width: 2, height: 5)]
for s in shapes { print(s.describe()) }
print("total area:", shapes.reduce(0) { $0 + $1.area() })
print("rectangles:", shapes.filter { $0 is Rect }.count)

struct Version: Comparable, CustomStringConvertible {
    let major: Int
    let minor: Int
    var description: String { "\(major).\(minor)" }
    static func < (a: Version, b: Version) -> Bool { (a.major, a.minor) < (b.major, b.minor) }
}

let versions = [Version(major: 1, minor: 10), Version(major: 1, minor: 2), Version(major: 2, minor: 0)]
print(versions.sorted().map(\.description))
print("newest \(versions.max()!), 1.2 < 1.10? \(versions[1] < versions[0])")

protocol Resettable {
    mutating func reset()
}

struct Basket: Resettable {
    var items: [String] = ["apple", "pear"]
    mutating func reset() { items.removeAll() }
}

var basket = Basket()
basket.reset()
print("after reset: \(basket.items)")

// Try: delete `func describe()` from the protocol and see which line's output changes.
```

## Exercises

### 1. A shape protocol

Define `Shape` with a read-only `name` property and an `area()` method, then conform three types to it and write two functions over a list of shapes.

- `Rect(width:height:)` has `name` `"square"` when its sides are equal and `"rectangle"` otherwise.
- `Circle(radius:)` has `name` `"circle"` and area `Double.pi * r * r`.
- `Point()` has `name` `"point"` and area 0.
- `totalArea(_:)` sums the areas, and is 0 for an empty list.
- `nameOfLargest(_:)` gives the `name` of the shape with the greatest area, or `nil` for an empty list. On a tie the earlier shape wins.

```swift starter
protocol Shape {
    var name: String { get }
    func area() -> Double
}

struct Rect: Shape {
    var width: Double
    var height: Double
    var name: String { "rectangle" }
    func area() -> Double { 0 }
}

struct Circle: Shape {
    var radius: Double
    var name: String { "circle" }
    func area() -> Double { 0 }
}

struct Point: Shape {
    var name: String { "point" }
    func area() -> Double { 0 }
}

func totalArea(_ shapes: [any Shape]) -> Double {
    return 0
}

func nameOfLargest(_ shapes: [any Shape]) -> String? {
    return nil
}
```

```swift test
/// each type reports its own area
func testAreas() {
    expect(Rect(width: 3, height: 4).area(), 12)
    expect(Rect(width: 2.5, height: 2).area(), 5)
    expect(Circle(radius: 1).area(), Double.pi)
    expect(Circle(radius: 2).area(), Double.pi * 4)
    expect(Point().area(), 0)
}

/// names, with squares picked out
func testNames() {
    expect(Rect(width: 4, height: 5).name, "rectangle")
    expect(Rect(width: 4, height: 4).name, "square")
    expect(Rect(width: 0, height: 0).name, "square")
    expect(Circle(radius: 9).name, "circle")
    expect(Point().name, "point")
}

/// a mixed list can be totalled through the protocol
func testTotalArea() {
    expect(totalArea([]), 0)
    expect(totalArea([Point(), Point()]), 0)
    expect(totalArea([Rect(width: 2, height: 3), Rect(width: 1, height: 1)]), 7)
    expect(totalArea([Circle(radius: 1), Point(), Rect(width: 10, height: 1)]), Double.pi + 10)
}

/// the largest shape by area
func testNameOfLargest() {
    expect(nameOfLargest([]), nil)
    expect(nameOfLargest([Point()]), "point")
    expect(nameOfLargest([Rect(width: 1, height: 1), Circle(radius: 10)]), "circle")
    expect(nameOfLargest([Circle(radius: 1), Rect(width: 9, height: 9)]), "square")
    expect(nameOfLargest([Point(), Rect(width: 1, height: 2), Rect(width: 3, height: 3)]), "square")
}

/// ties go to the earlier shape
func testLargestTies() {
    expect(nameOfLargest([Rect(width: 2, height: 2), Rect(width: 1, height: 4)]), "square")
    expect(nameOfLargest([Rect(width: 1, height: 4), Rect(width: 2, height: 2)]), "rectangle")
    expect(nameOfLargest([Point(), Point()]), "point")
}
```

#### Uses
- [Protocols › Declaring a protocol](#/protocols/declaring-a-protocol)
- [Protocols › Conforming](#/protocols/conforming)
- [Protocols › Protocols as types](#/protocols/protocols-as-types)

#### Hints
- `Rect.name` is a computed property: `width == height ? "square" : "rectangle"`.
- `Point` stores nothing, so `Point()` works with no initializer of its own.
- `totalArea` is `shapes.reduce(0) { $0 + $1.area() }` — through `any Shape` you can still call `area()`, because the protocol declares it.
- For `nameOfLargest`, a loop keeping the best so far with a strict `>` leaves the earlier shape in place on a tie.

#### Tips
- Nothing in `totalArea` knows about `Rect` or `Circle`. Adding a fourth shape does not change it.
- `Point` stores nothing, so `Point()` compiles with no initializer written. An empty struct is a perfectly ordinary type.

#### Docs
- [Protocols](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/)

### 2. Default implementations

`Describable` requires a `name` and a `describe()`, and its extension supplies a default `describe()` of `"a <name>"`. Conforming types get it for free unless they say otherwise.

- `Dog` and `Tree` use the default, so `Dog().describe()` is `"a dog"`.
- `Robot` overrides it with `"BEEP, I AM <name>"`.
- `allDescriptions(_:)` maps a list of `any Describable` to their descriptions, in order.

Because `describe()` is declared in the protocol as well as defaulted in the extension, the override is used even through `any Describable`.

```swift starter
protocol Describable {
    var name: String { get }
    func describe() -> String
}

extension Describable {
    func describe() -> String {
        return name
    }
}

struct Dog: Describable {
    var name: String { "dog" }
}

struct Tree: Describable {
    var name: String { "tree" }
}

struct Robot: Describable {
    var name: String { "robot" }
}

func allDescriptions(_ items: [any Describable]) -> [String] {
    return []
}
```

```swift test
/// the default implementation
func testDefault() {
    expect(Dog().describe(), "a dog")
    expect(Tree().describe(), "a tree")
    expect(Dog().name, "dog")
    expect(Tree().name, "tree")
}

/// a type can replace the default
func testOverride() {
    expect(Robot().describe(), "BEEP, I AM robot")
    expect(Robot().name, "robot")
}

/// the override survives the trip through the protocol type
func testThroughExistential() {
    let items: [any Describable] = [Dog(), Robot(), Tree()]
    expect(items.map { $0.describe() }, ["a dog", "BEEP, I AM robot", "a tree"])
    let one: any Describable = Robot()
    expect(one.describe(), "BEEP, I AM robot")
}

/// allDescriptions keeps the order it was given
func testAllDescriptions() {
    expect(allDescriptions([]), [])
    expect(allDescriptions([Dog()]), ["a dog"])
    expect(allDescriptions([Robot(), Dog()]), ["BEEP, I AM robot", "a dog"])
    expect(allDescriptions([Tree(), Tree(), Robot()]), ["a tree", "a tree", "BEEP, I AM robot"])
}
```

#### Uses
- [Protocols › Default implementations](#/protocols/default-implementations)
- [Protocols › Requirement or just an extension?](#/protocols/requirement-or-just-an-extension)
- [Protocols › Protocols as types](#/protocols/protocols-as-types)

#### Hints
- The default belongs in `extension Describable`, and is `"a \(name)"`.
- `Dog` and `Tree` then need nothing but `name`.
- `Robot` writes its own `func describe() -> String`, which shadows the default.
- `allDescriptions` is `items.map { $0.describe() }`.

#### Tips
- Try deleting `func describe() -> String` from the protocol body once the tests pass. Only the existential test breaks, which is the whole difference between a requirement and an extension method.
- The default goes in `extension Describable`, not in the protocol body. A protocol body holds requirements; implementations live in the extension.

#### Docs
- [Protocol extensions](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/#Protocol-Extensions)

### 3. Making a type Comparable

`Version` holds `major`, `minor` and `patch`, in that order, so its free initializer is `Version(major:minor:patch:)`. Conform it to `Comparable` and `CustomStringConvertible`.

- Ordering compares `major` first, then `minor`, then `patch`, so 1.10.0 is newer than 1.9.9.
- `description` is `"1.2.3"`.
- Equality is the one Swift synthesises: two versions are equal when all three numbers match.
- `newest(_:)` returns the largest version of a list, or `nil` when the list is empty.

Conforming to `Comparable` means `<`, `>`, `<=`, `>=`, `sorted()`, `min()` and `max()` all start working.

```swift starter
struct Version: Comparable, CustomStringConvertible {
    let major: Int
    let minor: Int
    let patch: Int

    var description: String {
        return "version"
    }

    static func < (a: Version, b: Version) -> Bool {
        return false
    }
}

func newest(_ versions: [Version]) -> Version? {
    return versions.first
}
```

```swift test
/// description is dotted
func testDescription() {
    expect(Version(major: 1, minor: 2, patch: 3).description, "1.2.3")
    expect(Version(major: 0, minor: 0, patch: 0).description, "0.0.0")
    expect("\(Version(major: 10, minor: 0, patch: 42))", "10.0.42")
}

/// ordering runs major, then minor, then patch
func testOrdering() {
    expect(Version(major: 1, minor: 0, patch: 0) < Version(major: 2, minor: 0, patch: 0), "1.0.0 < 2.0.0")
    expect(Version(major: 1, minor: 9, patch: 9) < Version(major: 1, minor: 10, patch: 0), "1.9.9 < 1.10.0")
    expect(Version(major: 1, minor: 2, patch: 3) < Version(major: 1, minor: 2, patch: 4), "1.2.3 < 1.2.4")
    expect(Version(major: 2, minor: 0, patch: 0) < Version(major: 1, minor: 99, patch: 99), false)
    expect(Version(major: 1, minor: 2, patch: 3) < Version(major: 1, minor: 2, patch: 3), false)
}

/// equality and the derived operators
func testEqualityAndDerived() {
    let a = Version(major: 1, minor: 2, patch: 3)
    expect(a, Version(major: 1, minor: 2, patch: 3))
    expect(a != Version(major: 1, minor: 2, patch: 4), "different patch is different")
    expect(a <= Version(major: 1, minor: 2, patch: 3), "<= is derived from <")
    expect(a >= Version(major: 1, minor: 2, patch: 3), ">= is derived from <")
    expect(a > Version(major: 1, minor: 2, patch: 2), "> is derived from <")
}

/// sorting a list
func testSorting() {
    let versions = [
        Version(major: 1, minor: 10, patch: 0),
        Version(major: 1, minor: 2, patch: 0),
        Version(major: 2, minor: 0, patch: 1),
        Version(major: 1, minor: 2, patch: 5),
    ]
    expect(versions.sorted().map(\.description), ["1.2.0", "1.2.5", "1.10.0", "2.0.1"])
    expect(versions.min()?.description, "1.2.0")
    expect(versions.max()?.description, "2.0.1")
}

/// newest, including the empty list
func testNewest() {
    expect(newest([]), nil)
    expect(newest([Version(major: 0, minor: 0, patch: 1)])?.description, "0.0.1")
    let versions = [
        Version(major: 1, minor: 2, patch: 0),
        Version(major: 1, minor: 20, patch: 0),
        Version(major: 1, minor: 3, patch: 0),
    ]
    expect(newest(versions)?.description, "1.20.0")
}
```

#### Uses
- [Protocols › Protocols in the standard library](#/protocols/protocols-in-the-standard-library)
- [Protocols › Conforming](#/protocols/conforming)
- [Properties › Read-only computed properties](#/properties/read-only-computed-properties)

#### Hints
- `description` is string interpolation: `"\(major).\(minor).\(patch)"`.
- Comparing three fields at once is one tuple comparison: `(a.major, a.minor, a.patch) < (b.major, b.minor, b.patch)`.
- `newest` is `versions.max()`, which exists only because the type is `Comparable`.

#### Tips
- `Comparable` requires just `<`. Everything else — `>`, `<=`, `sorted()`, `min()`, `max()`, ranges — comes from the standard library's extension on the protocol.
- `1.9.9 < 1.10.0` is the test that catches a string comparison: as text `"1.10.0"` sorts before `"1.9.9"`. Compare the numbers, in a tuple.

#### Docs
- [Comparable](https://developer.apple.com/documentation/swift/comparable)
- [CustomStringConvertible](https://developer.apple.com/documentation/swift/customstringconvertible)

### 4. A list of validators

`Validator` describes one rule about a string: a `message` explaining what went wrong, and `isValid(_:)`.

Conform three of them:

- `NotEmpty()` — invalid when the string has no characters. Message: `"must not be empty"`.
- `MinLength(3)` — invalid when the string is shorter than the given length. Message: `"must be at least 3 characters"`, with the actual number.
- `NoSpaces()` — invalid when the string contains a space. Message: `"must not contain spaces"`.

Then two functions over a list of rules, both of which check the rules in the order given:

- `firstFailure(for:using:)` returns the message of the first failing rule, or `nil` when everything passes. An empty rule list passes.
- `allFailures(for:using:)` returns the messages of every failing rule, in order.

```swift starter
protocol Validator {
    var message: String { get }
    func isValid(_ input: String) -> Bool
}

struct NotEmpty: Validator {
    var message: String { "must not be empty" }
    func isValid(_ input: String) -> Bool { true }
}

struct MinLength: Validator {
    let length: Int
    init(_ length: Int) { self.length = length }
    var message: String { "must be at least 3 characters" }
    func isValid(_ input: String) -> Bool { true }
}

struct NoSpaces: Validator {
    var message: String { "must not contain spaces" }
    func isValid(_ input: String) -> Bool { true }
}

func firstFailure(for input: String, using validators: [any Validator]) -> String? {
    return nil
}

func allFailures(for input: String, using validators: [any Validator]) -> [String] {
    return []
}
```

```swift test
/// each rule judges a string on its own
func testRules() {
    expect(NotEmpty().isValid(""), false)
    expect(NotEmpty().isValid("a"), true)
    expect(NotEmpty().isValid(" "), true)
    expect(MinLength(3).isValid("ab"), false)
    expect(MinLength(3).isValid("abc"), true)
    expect(MinLength(0).isValid(""), true)
    expect(NoSpaces().isValid("a b"), false)
    expect(NoSpaces().isValid(" ab"), false)
    expect(NoSpaces().isValid("ab"), true)
}

/// the messages, including the length one
func testMessages() {
    expect(NotEmpty().message, "must not be empty")
    expect(NoSpaces().message, "must not contain spaces")
    expect(MinLength(3).message, "must be at least 3 characters")
    expect(MinLength(8).message, "must be at least 8 characters")
    expect(MinLength(0).message, "must be at least 0 characters")
}

/// the first failing rule wins
func testFirstFailure() {
    let rules: [any Validator] = [NotEmpty(), MinLength(3), NoSpaces()]
    expect(firstFailure(for: "", using: rules), "must not be empty")
    expect(firstFailure(for: "ab", using: rules), "must be at least 3 characters")
    expect(firstFailure(for: "a b c", using: rules), "must not contain spaces")
    expect(firstFailure(for: "abcdef", using: rules), nil)
}

/// order of the rules decides which failure is reported
func testRuleOrder() {
    let reversed: [any Validator] = [NoSpaces(), MinLength(3), NotEmpty()]
    expect(firstFailure(for: " ", using: reversed), "must not contain spaces")
    expect(firstFailure(for: "ab", using: reversed), "must be at least 3 characters")
    expect(firstFailure(for: "", using: []), nil)
    expect(firstFailure(for: "", using: [NoSpaces()]), nil)
}

/// every failure, in order
func testAllFailures() {
    let rules: [any Validator] = [NotEmpty(), MinLength(3), NoSpaces()]
    expect(allFailures(for: "", using: rules), ["must not be empty", "must be at least 3 characters"])
    expect(allFailures(for: "a b", using: rules), ["must not contain spaces"])
    expect(allFailures(for: "ok fine", using: rules), ["must not contain spaces"])
    expect(allFailures(for: "abcdef", using: rules), [])
    expect(allFailures(for: "", using: []), [])
}
```

#### Uses
- [Protocols › Property requirements](#/protocols/property-requirements)
- [Reference › String and Character](#/reference/string-and-character)
- [Protocols › Protocols as types](#/protocols/protocols-as-types)
- [Protocols › Conforming](#/protocols/conforming)

#### Hints
- `MinLength` stores its length, so its `message` interpolates it: `"must be at least \(length) characters"`.
- `input.contains(" ")` answers `NoSpaces`, and `input.count >= length` answers `MinLength`.
- `firstFailure` is `validators.first { !$0.isValid(input) }?.message`.
- `allFailures` is a `filter` followed by a `map`, or one `compactMap`.

#### Tips
- Every rule is an independent little type, and the list of rules is data. Adding a rule means adding a struct, never editing the two functions.
- `firstFailure(for: "", using: [])` is `nil`: an empty rule list passes everything, and `first { ... }` on an empty array gives that with no special case.

#### Docs
- [Protocols as types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/#Protocols-as-Types)
