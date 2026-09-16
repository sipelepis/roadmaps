# Properties

A property is a value attached to a type. Some are stored — an actual box of memory per instance — and some are computed fresh every time you read them, from a getter you write. From the outside they look identical, which is the point: you can turn a stored property into a computed one without changing a single call site.

## Stored properties

A stored property is a `var` or `let` declared in the body of a struct or class. A `var` can be changed, a `let` is fixed once the initializer finishes, and either can have a default value:

```swift
struct Book {
    let isbn: String
    var title: String
    var pages = 0
}
```

A struct's `let` property cannot be reassigned even through a `var` instance. On a class, `let` fixes the property for the life of the object.

## Computed properties

A computed property stores nothing. It has a getter that runs on every read, and optionally a setter:

```swift
struct Rect {
    var width: Double
    var height: Double

    var area: Double {
        get { width * height }
        set { height = newValue / width }
    }
}

var r = Rect(width: 4, height: 5)
r.area          // 20
r.area = 40     // height becomes 10
```

Inside the setter, `newValue` is the value being assigned. You can rename it — `set(newArea)` — but `newValue` is the convention. A computed property is a method wearing different clothes; use one when the thing reads like a value (`area`, `isEmpty`, `count`) and is cheap to work out.

Only `var` can be computed. A computed property on a struct is never `mutating`; its setter is implicitly mutating because it writes to `self`.

## Read-only computed properties

A getter-only property drops the `get` keyword and its braces:

```swift
struct Rect {
    var width: Double
    var height: Double

    var perimeter: Double { 2 * (width + height) }
    var isSquare: Bool { width == height }
}
```

This is the most common kind of property in Swift after plain stored ones — a derived value that can never drift out of sync with what it is derived from.

## Property observers

`willSet` and `didSet` run code around every assignment to a stored property. `willSet` sees `newValue` before the change; `didSet` sees `oldValue` after it:

```swift
struct Thermostat {
    var target = 20 {
        willSet { print("going from \(target) to \(newValue)") }
        didSet {
            target = min(30, max(5, target))
            if target != oldValue { log.append(target) }
        }
    }
    var log: [Int] = []
}
```

Two rules matter. Observers do **not** run when the initializer sets the property, only on later assignments. And assigning to the property from inside its own `didSet` does not trigger the observers again, which is what makes the clamp above terminate.

An assignment always fires the observers, even when the new value equals the old one.

## Lazy stored properties

A `lazy var` is stored, but its initial value is not worked out until the first time the property is read:

```swift
struct Catalogue {
    var names: [String]
    lazy var sorted: [String] = names.sorted()
}
```

Two consequences to keep in mind. The initializer can refer to `self`, which a normal stored property's default value cannot. And because reading it may write to it, reading a `lazy var` needs a mutable instance: `let c = Catalogue(...)` followed by `c.sorted` does not compile.

Use it for work that is expensive and often skipped. A lazy property is computed at most once and then cached, so if the data it was built from changes afterwards, the cached value is stale — that is the trade you are making.

## Type properties

A property on the type itself, shared by every instance, is marked `static`:

```swift
struct Report {
    static let passMark = 50

    var scores: [Int]
    var passes: Int { scores.filter { $0 >= Report.passMark }.count }
}

Report.passMark     // 50
```

`static let` constants and `static func` helpers are the everyday use. A mutable `static var` is global mutable state, and Swift's concurrency checking will ask you to prove it is safe — with `nonisolated(unsafe)`, or by moving it inside an actor. On a class, `class var` is a type property a subclass may override; `static` is one it may not.

## Property wrappers

When several properties need the same behaviour around get and set, that behaviour can be factored into a type. A property wrapper is a struct with a `wrappedValue` property and the `@propertyWrapper` attribute:

```swift
@propertyWrapper
struct NonNegative {
    private var value = 0
    var wrappedValue: Int {
        get { value }
        set { value = max(0, newValue) }
    }
    init(wrappedValue: Int) { self.value = max(0, wrappedValue) }
}

struct Basket {
    @NonNegative var apples = 3
}
```

`@NonNegative var apples = 3` compiles to a hidden stored property of type `NonNegative`, initialized with `NonNegative(wrappedValue: 3)`, and every read and write of `apples` goes through `wrappedValue`. Extra arguments in the attribute — `@Clamped(0...10) var x = 5` — become extra parameters on that `init`.

```swift playground
struct Rect {
    var width: Double
    var height: Double

    var area: Double {
        get { width * height }
        set { height = newValue / width }
    }
    var isSquare: Bool { width == height }

    static let unit = Rect(width: 1, height: 1)
}

var r = Rect(width: 4, height: 5)
print("area \(r.area), square? \(r.isSquare)")
r.area = 40
print("after setting area to 40, height is \(r.height)")
print("unit area \(Rect.unit.area)")

struct Thermostat {
    var target = 20 {
        willSet { print("  going from \(target) to \(newValue)") }
        didSet {
            target = min(30, max(5, target))
            if target != oldValue { log.append(target) }
        }
    }
    var log: [Int] = []
}

var t = Thermostat()
t.target = 25
t.target = 99
print("log \(t.log), target \(t.target)")

struct Catalogue {
    var names: [String]
    lazy var sorted: [String] = {
        print("  sorting (once)")
        return names.sorted()
    }()
}

var cat = Catalogue(names: ["pear", "apple"])
cat.names.append("fig")     // still before the first read
print(cat.sorted)
print(cat.sorted)

// Try: read cat.sorted before appending "fig" and see which list you get.
```

## Exercises

### 1. Two views of one temperature

`Temperature` stores one number and offers two more as computed properties.

- `celsius` is the only stored property, so the free initializer is `Temperature(celsius:)`.
- `fahrenheit` is computed both ways: reading it converts from celsius, and assigning it sets celsius. The formulas are `f = c * 9 / 5 + 32` and `c = (f - 32) * 5 / 9`.
- `isFreezing` is read-only and true when celsius is at or below zero.

```swift starter
struct Temperature {
    var celsius: Double

    var fahrenheit: Double {
        get { return celsius }
        set { celsius = newValue }
    }

    var isFreezing: Bool {
        return false
    }
}
```

```swift test
/// reading fahrenheit converts from celsius
func testReadFahrenheit() {
    expect(Temperature(celsius: 0).fahrenheit, 32)
    expect(Temperature(celsius: 100).fahrenheit, 212)
    expect(Temperature(celsius: -40).fahrenheit, -40)
    expect(Temperature(celsius: 25).fahrenheit, 77)
}

/// assigning fahrenheit changes celsius
func testWriteFahrenheit() {
    var t = Temperature(celsius: 0)
    t.fahrenheit = 212
    expect(t.celsius, 100)
    t.fahrenheit = 32
    expect(t.celsius, 0)
    t.fahrenheit = -40
    expect(t.celsius, -40)
    t.fahrenheit = 50
    expect(t.celsius, 10)
}

/// the two directions agree
func testRoundTrip() {
    var t = Temperature(celsius: 0)
    t.fahrenheit = 77
    expect(t.fahrenheit, 77)
    expect(t.celsius, 25)
    t.celsius = -40
    expect(t.fahrenheit, -40)
}

/// freezing is at or below zero celsius
func testIsFreezing() {
    expect(Temperature(celsius: -1).isFreezing, true)
    expect(Temperature(celsius: 0).isFreezing, true)
    expect(Temperature(celsius: 0.5).isFreezing, false)
    expect(Temperature(celsius: 100).isFreezing, false)

    var t = Temperature(celsius: 20)
    expect(t.isFreezing, false)
    t.fahrenheit = 20
    expect(t.isFreezing, true)
}
```

#### Uses
- [Properties › Computed properties](#/properties/computed-properties)
- [Properties › Read-only computed properties](#/properties/read-only-computed-properties)

#### Hints
- In the getter, return the conversion of `celsius`. In the setter, assign the reverse conversion to `celsius` using `newValue`.
- Write `9 / 5` as `9 / 5` on `Double`s, not on `Int`s: `celsius * 9 / 5` keeps everything in `Double`.
- `isFreezing` needs no `get` keyword; a single expression in braces is the whole getter.

#### Tips
- Nothing stores fahrenheit, so the two can never disagree. That is the argument for computed properties over keeping both and updating each.
- The setter's job is the inverse formula. If the read test passes and the round-trip test fails, the setter is applying the forward one.

#### Docs
- [Computed properties](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/properties/#Computed-Properties)

### 2. A gauge that keeps its own log

`Gauge` has a `level` that refuses to leave the range 0 to 100, and remembers what it has been.

- `Gauge()` starts with `level` 0, an empty `history`, and `peak` 0.
- Every assignment to `level` is clamped into `0...100`.
- `history` is the clamped level after each assignment, in order. Creating the gauge is not an assignment, so a fresh gauge has an empty history, and assigning the same value twice records it twice.
- `peak` is the highest clamped level ever assigned, and never goes back down.

```swift starter
struct Gauge {
    var level = 0 {
        didSet {
        }
    }
    var history: [Int] = []
    var peak = 0
}
```

```swift test
/// assignments are clamped into 0...100
func testClamps() {
    var g = Gauge()
    g.level = 50
    expect(g.level, 50)
    g.level = 140
    expect(g.level, 100)
    g.level = -20
    expect(g.level, 0)
    g.level = 100
    expect(g.level, 100)
    g.level = 0
    expect(g.level, 0)
}

/// history records every assignment, after clamping
func testHistory() {
    var g = Gauge()
    expect(g.history, [])
    g.level = 10
    g.level = 200
    g.level = -5
    g.level = -5
    expect(g.history, [10, 100, 0, 0])
}

/// a fresh gauge has recorded nothing
func testFresh() {
    let g = Gauge()
    expect(g.level, 0)
    expect(g.peak, 0)
    expect(g.history, [])
}

/// peak only ever goes up
func testPeak() {
    var g = Gauge()
    g.level = 30
    expect(g.peak, 30)
    g.level = 10
    expect(g.peak, 30)
    g.level = 999
    expect(g.peak, 100)
    g.level = 0
    expect(g.peak, 100)
    expect(g.level, 0)
}

/// a copy keeps its own history
func testCopy() {
    var g = Gauge()
    g.level = 40
    var copy = g
    copy.level = 90
    expect(g.history, [40])
    expect(copy.history, [40, 90])
    expect(g.peak, 40)
    expect(copy.peak, 90)
}
```

#### Uses
- [Properties › Property observers](#/properties/property-observers)
- [Properties › Stored properties](#/properties/stored-properties)
- [Structs & classes › Value semantics: structs are copied](#/structs-classes/value-semantics-structs-are-copied)

#### Hints
- All the work happens in `didSet`: clamp first, then record.
- Clamping is `level = min(100, max(0, level))`. Assigning `level` inside its own `didSet` does not run the observer again, so this does not loop.
- Append the clamped `level` to `history`, and set `peak = max(peak, level)`.

#### Tips
- `didSet` has an `oldValue`, and `willSet` a `newValue`. Here `oldValue` is not needed, because `peak` only cares about the value that just arrived.
- Observers do not run for the value the initializer sets, which is why a fresh `Gauge()` has an empty history. That is a rule of the language, not something to code around.

#### Docs
- [Property observers](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/properties/#Property-Observers)

### 3. Computed, lazy, and static in one type

`Report` wraps a list of scores.

- `rows` is the only stored property, so the initializer is `Report(rows:)`.
- `passMark` is a type property — a `static let` equal to 50. A row passes when it is greater than or equal to it.
- `passCount` and `isEmpty` are read-only computed properties, so they always reflect the current `rows`.
- `total` and `average` are `lazy var`s: each is worked out the first time it is read, from whatever `rows` holds at that moment, and kept afterwards even if `rows` changes. `average` is a `Double`, and is 0 for an empty report.

```swift starter
struct Report {
    var rows: [Int]

    static let passMark = 0

    var passCount: Int {
        return rows.count
    }

    var isEmpty: Bool {
        return false
    }

    lazy var total: Int = 0
    lazy var average: Double = 0
}
```

```swift test
/// the computed properties follow the current rows
func testComputed() {
    var r = Report(rows: [10, 60, 80, 49])
    expect(r.passCount, 2)
    expect(r.isEmpty, false)
    r.rows = []
    expect(r.passCount, 0)
    expect(r.isEmpty, true)
}

/// the pass mark is a type property, and the boundary passes
func testPassMark() {
    expect(Report.passMark, 50)
    expect(Report(rows: [49, 50, 51]).passCount, 2)
    expect(Report(rows: [0, -1]).passCount, 0)
}

/// totals and averages
func testTotals() {
    var r = Report(rows: [10, 20, 30])
    expect(r.total, 60)
    expect(r.average, 20)
    var one = Report(rows: [5])
    expect(one.total, 5)
    expect(one.average, 5)
    var pair = Report(rows: [1, 2])
    expect(pair.average, 1.5)
}

/// an empty report totals zero and averages zero
func testEmpty() {
    var r = Report(rows: [])
    expect(r.total, 0)
    expect(r.average, 0)
    var mixed = Report(rows: [-4, 4])
    expect(mixed.total, 0)
    expect(mixed.average, 0)
}

/// lazy: worked out on the first read, then kept
func testLazy() {
    var r = Report(rows: [1, 2, 3])
    r.rows = [10, 20]
    expect(r.total, 30)
    r.rows = [100, 100, 100]
    expect(r.total, 30)
    expect(r.passCount, 3)

    var a = Report(rows: [1])
    a.rows = [7, 7]
    expect(a.average, 7)
    a.rows = [1000]
    expect(a.average, 7)
}
```

#### Uses
- [Properties › Read-only computed properties](#/properties/read-only-computed-properties)
- [Properties › Lazy stored properties](#/properties/lazy-stored-properties)
- [Properties › Type properties](#/properties/type-properties)
- [Reference › Sequence and Collection methods](#/reference/sequence-and-collection-methods)

#### Hints
- `passCount` is `rows.filter { $0 >= Report.passMark }.count`.
- `total` is `rows.reduce(0, +)`, and a `lazy var` may use `self` in its initial value, which an ordinary default value may not.
- `average` has to avoid dividing by zero: return 0 when `rows` is empty, otherwise `Double(total) / Double(rows.count)`.

#### Tips
- The `lazy` test is the difference that matters: a computed `total` would follow every change to `rows`, a lazy one freezes at the first read.
- Every test that reads a `lazy var` declares its subject `var`, never `let`: reading a lazy property can write to it. If your code looks right but the tests will not compile, that is why.

#### Docs
- [Lazy stored properties](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/properties/#Lazy-Stored-Properties)
- [Type properties](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/properties/#Type-Properties)

### 4. A clamping property wrapper

Finish the `@Clamped` property wrapper so that every property using it stays inside the range given in the attribute. Both paths must clamp: the value written at creation and every later assignment. `Settings` already uses it, and declares `brightness` with an out-of-range default of 99, which must come out as 10.

```swift starter
@propertyWrapper
struct Clamped {
    private var value: Int
    private let range: ClosedRange<Int>

    init(wrappedValue: Int, _ range: ClosedRange<Int>) {
        self.range = range
        self.value = wrappedValue
    }

    var wrappedValue: Int {
        get { value }
        set { value = newValue }
    }
}

struct Settings {
    @Clamped(0...100) var volume: Int = 50
    @Clamped(1...5) var stars: Int = 3
    @Clamped(0...10) var brightness: Int = 99
}
```

```swift test
/// out-of-range defaults are clamped when the value is created
func testDefaults() {
    let s = Settings()
    expect(s.volume, 50)
    expect(s.stars, 3)
    expect(s.brightness, 10)
}

/// assignments are clamped to each property's own range
func testAssignmentClamps() {
    var s = Settings()
    s.volume = 250
    expect(s.volume, 100)
    s.volume = -10
    expect(s.volume, 0)
    s.stars = 250
    expect(s.stars, 5)
    s.stars = 0
    expect(s.stars, 1)
    s.brightness = 40
    expect(s.brightness, 10)
}

/// values inside the range pass through untouched
func testInRange() {
    var s = Settings()
    s.volume = 0
    expect(s.volume, 0)
    s.volume = 100
    expect(s.volume, 100)
    s.volume = 37
    expect(s.volume, 37)
    s.stars = 1
    expect(s.stars, 1)
    s.stars = 5
    expect(s.stars, 5)
}

/// each wrapped property has its own range and its own value
func testIndependent() {
    var s = Settings()
    s.volume = 100
    s.stars = 1
    expect(s.volume, 100)
    expect(s.stars, 1)
    var copy = s
    copy.volume = 0
    expect(s.volume, 100)
    expect(copy.volume, 0)
    expect(copy.stars, 1)
}

/// the wrapper is a type of its own and works on its own
func testWrapperDirectly() {
    var c = Clamped(wrappedValue: 500, 1...9)
    expect(c.wrappedValue, 9)
    c.wrappedValue = -3
    expect(c.wrappedValue, 1)
    c.wrappedValue = 4
    expect(c.wrappedValue, 4)
}
```

#### Uses
- [Properties › Property wrappers](#/properties/property-wrappers)
- [Properties › Computed properties](#/properties/computed-properties)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- `wrappedValue`'s setter is the obvious half: `value = min(range.upperBound, max(range.lowerBound, newValue))`.
- The `init` has to do the same thing to its `wrappedValue` argument, otherwise `brightness` starts at 99.
- `range` must be assigned before you can use it in `init`, so set `self.range` first.

#### Tips
- A `ClosedRange` already knows how to do this: `range.lowerBound`, `range.upperBound`, and `range.contains(newValue)` are all available.
- Write the clamp once and call it from both places. Duplicating the expression in `init` and in the setter is how `brightness` quietly goes back to 99 after a later edit.

#### Docs
- [Property wrappers](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/properties/#Property-Wrappers)
