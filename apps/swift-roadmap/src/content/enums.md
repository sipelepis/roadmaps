# Enums & pattern matching

A Swift enum is not a list of named integers. It is a type that is exactly one of a fixed set of cases, each of which can carry its own data. Together with `switch`, which the compiler checks for exhaustiveness, that turns "this value is one of these shapes" from a comment into something the type system enforces.

## Declaring an enum

```swift
enum Direction {
    case north
    case east
    case south
    case west
}

let heading = Direction.north
```

Once the type is known, the prefix can be dropped: `let heading: Direction = .north`, or `move(to: .east)`. Cases can also be written on one line, `case north, east, south, west`.

An enum with no associated values gets `Equatable` and `Hashable` for free, so it works with `==`, in a `Set`, and as a dictionary key.

## Raw values

Cases can be backed by a value of a single type, usually `String` or `Int`:

```swift
enum Direction: String {
    case north = "N"
    case east = "E"
    case south = "S"
    case west = "W"
}

Direction.south.rawValue        // "S"
Direction(rawValue: "E")        // Optional(Direction.east)
Direction(rawValue: "X")        // nil
```

`rawValue` always works. Going the other way is a *failable* initializer, `init?(rawValue:)`, because the text might not name a case — which is exactly what you want when the value came from a file or a network response. For a `String` raw type the values default to the case names; for `Int` they count up from 0.

Raw values are for converting to and from the outside world. They are not a place to store per-instance data — that is what associated values are for.

## CaseIterable

Add the `CaseIterable` protocol and the compiler generates `allCases`, an array of every case in declaration order:

```swift
enum Direction: String, CaseIterable { /* ... */ }

Direction.allCases.count                    // 4
Direction.allCases.map(\.rawValue)          // ["N", "E", "S", "W"]
```

Only enums without associated values can be `CaseIterable`, because otherwise there would be infinitely many cases.

## Associated values

Each case can carry different data, with optional labels:

```swift
enum Shape {
    case circle(radius: Double)
    case rectangle(width: Double, height: Double)
    case point
}

let shapes: [Shape] = [.circle(radius: 2), .rectangle(width: 3, height: 4), .point]
```

This is the feature that makes Swift enums worth learning. `Optional` is one — `case some(Wrapped)` and `case none` — and so is `Result`. A value of type `Shape` is one case at a time; there is no way to read the radius of a rectangle, because the compiler will not let you get at it without first checking which case you have.

## Pattern matching with switch

`switch` over an enum must cover every case, or it does not compile. Bindings pull the associated values out:

```swift
func area(of shape: Shape) -> Double {
    switch shape {
    case .circle(let radius):
        return Double.pi * radius * radius
    case .rectangle(let width, let height):
        return width * height
    case .point:
        return 0
    }
}
```

`case .circle(let radius)` is shorthand for `case let .circle(radius)`; both bind the payload to a new constant. Labels can be ignored, so `.rectangle(let w, let h)` matches by position. A case you do not care about the payload of can be written bare: `case .circle:`.

Exhaustiveness is the payoff. Add a case to the enum a year later and every switch that forgot about it becomes a compiler error rather than a silent `default` branch. Use `default` sparingly for that reason.

## where clauses and combined cases

A `case` can carry a condition, and several patterns can share one body:

```swift
switch shape {
case .rectangle(let w, let h) where w == h:
    print("square of side \(w)")
case .rectangle(let w, let h):
    print("rectangle \(w) by \(h)")
case .circle(let r) where r <= 0, .point:
    print("nothing to draw")
case .circle:
    print("circle")
}
```

Cases are tried top to bottom, so the narrower pattern goes first. Patterns also work on numbers and ranges (`case 0`, `case 1..<10`), on strings, and on tuples — `switch (a, b)` with `case (0, _)` — which is how a lot of Swift branching gets written.

## if case and guard case

When only one case interests you, a whole `switch` is too much. `if case` matches a single pattern, and `guard case` does the same with an early exit:

```swift
if case .circle(let radius) = shape {
    print("radius \(radius)")
}

func radius(of shape: Shape) -> Double? {
    guard case .circle(let r) = shape else { return nil }
    return r
}
```

For an enum with no payload, plain `==` reads better: `if shape == .point`.

## Methods and properties on enums

An enum is a full type: it can have methods, computed properties, initializers and extensions. It cannot have *stored* properties — the associated values are its storage:

```swift
enum Direction: String, CaseIterable {
    case north = "N", east = "E", south = "S", west = "W"

    var opposite: Direction {
        switch self {
        case .north: return .south
        case .south: return .north
        case .east: return .west
        case .west: return .east
        }
    }
}
```

A method that changes which case `self` is must be `mutating`, exactly as on a struct, and assigns to `self`: `mutating func reverse() { self = opposite }`.

## Indirect enums

A case cannot directly contain a value of its own enum type, because the size would be infinite. `indirect` puts that payload behind a reference, which makes recursive data structures — trees, linked lists, expressions — possible:

```swift
indirect enum Expr {
    case value(Int)
    case add(Expr, Expr)
    case multiply(Expr, Expr)
}

func evaluate(_ e: Expr) -> Int {
    switch e {
    case .value(let n): return n
    case .add(let a, let b): return evaluate(a) + evaluate(b)
    case .multiply(let a, let b): return evaluate(a) * evaluate(b)
    }
}
```

`indirect` can go on the whole enum, as above, or on a single `case`. The recursion in `evaluate` mirrors the recursion in the type, which is what makes these functions so short.

```swift playground
enum Direction: String, CaseIterable {
    case north = "N"
    case east = "E"
    case south = "S"
    case west = "W"

    var opposite: Direction {
        switch self {
        case .north: return .south
        case .south: return .north
        case .east: return .west
        case .west: return .east
        }
    }
}

for d in Direction.allCases {
    print("\(d) (\(d.rawValue)) <-> \(d.opposite)")
}
print("from text:", Direction(rawValue: "S") as Any, Direction(rawValue: "X") as Any)

enum Shape {
    case circle(radius: Double)
    case rectangle(width: Double, height: Double)
    case point

    var area: Double {
        switch self {
        case .circle(let r): return Double.pi * r * r
        case .rectangle(let w, let h): return w * h
        case .point: return 0
        }
    }
}

let shapes: [Shape] = [.circle(radius: 1), .rectangle(width: 3, height: 3), .point]
print(shapes.map { $0.area })

for s in shapes {
    switch s {
    case .rectangle(let w, let h) where w == h: print("square of side \(w)")
    case .rectangle(let w, let h): print("rectangle \(w) by \(h)")
    case .circle(let r) where r < 2: print("small circle")
    case .circle: print("circle")
    case .point: print("a point")
    }
}

if case .circle(let r) = shapes[0] { print("the first shape has radius \(r)") }

indirect enum Expr {
    case value(Int)
    case add(Expr, Expr)
    case multiply(Expr, Expr)
}

func evaluate(_ e: Expr) -> Int {
    switch e {
    case .value(let n): return n
    case .add(let a, let b): return evaluate(a) + evaluate(b)
    case .multiply(let a, let b): return evaluate(a) * evaluate(b)
    }
}
print("(1 + 2) * 10 =", evaluate(.multiply(.add(.value(1), .value(2)), .value(10))))

// Try: add `case triangle(base: Double, height: Double)` to Shape and follow the compiler errors.
```

## Exercises

### 1. Compass

`Direction` has four cases with `String` raw values `"N"`, `"E"`, `"S"`, `"W"`, declared in that order, and conforms to `CaseIterable`.

- `opposite` is the direction facing the other way.
- `turnedRight` is a 90 degree clockwise turn: north becomes east, east becomes south, and so on.
- `turns(to:)` returns how many right turns it takes to get from `self` to another direction, a number from 0 to 3.

```swift starter
enum Direction: String, CaseIterable {
    case north = "N"
    case east = "E"
    case south = "S"
    case west = "W"

    var opposite: Direction {
        return self
    }

    var turnedRight: Direction {
        return self
    }

    func turns(to other: Direction) -> Int {
        return 0
    }
}
```

```swift test
/// raw values and allCases
func testRawValues() {
    expect(Direction.north.rawValue, "N")
    expect(Direction.west.rawValue, "W")
    expect(Direction.allCases.count, 4)
    expect(Direction.allCases.map(\.rawValue), ["N", "E", "S", "W"])
    expect(Direction(rawValue: "S"), Direction.south)
    expect(Direction(rawValue: "X"), nil)
    expect(Direction(rawValue: "n"), nil)
}

/// every direction has an opposite, and it is symmetric
func testOpposite() {
    expect(Direction.north.opposite, Direction.south)
    expect(Direction.south.opposite, Direction.north)
    expect(Direction.east.opposite, Direction.west)
    expect(Direction.west.opposite, Direction.east)
    for d in Direction.allCases {
        expect(d.opposite.opposite, d)
        expect(d.opposite != d, "\(d) should not be its own opposite")
    }
}

/// turning right goes round the compass
func testTurnedRight() {
    expect(Direction.north.turnedRight, Direction.east)
    expect(Direction.east.turnedRight, Direction.south)
    expect(Direction.south.turnedRight, Direction.west)
    expect(Direction.west.turnedRight, Direction.north)
    for d in Direction.allCases {
        expect(d.turnedRight.turnedRight, d.opposite)
        expect(d.turnedRight.turnedRight.turnedRight.turnedRight, d)
    }
}

/// counting the right turns between two directions
func testTurnsTo() {
    expect(Direction.north.turns(to: .north), 0)
    expect(Direction.north.turns(to: .east), 1)
    expect(Direction.north.turns(to: .south), 2)
    expect(Direction.north.turns(to: .west), 3)
    expect(Direction.west.turns(to: .north), 1)
    expect(Direction.south.turns(to: .east), 3)
    for a in Direction.allCases {
        for b in Direction.allCases {
            var d = a
            for _ in 0..<a.turns(to: b) { d = d.turnedRight }
            expect(d, b)
        }
    }
}
```

#### Uses
- [Enums & pattern matching › Raw values](#/enums/raw-values)
- [Enums & pattern matching › CaseIterable](#/enums/caseiterable)
- [Enums & pattern matching › Methods and properties on enums](#/enums/methods-and-properties-on-enums)
- [Reference › Sequence and Collection methods](#/reference/sequence-and-collection-methods)

#### Hints
- `opposite` and `turnedRight` are each a four-case `switch self`, returning a case.
- `turns(to:)` can turn right in a loop until it reaches `other`, counting as it goes — at most three turns are ever needed.
- Alternatively, `Direction.allCases.firstIndex(of:)` gives each direction a number 0 to 3, and the answer is the difference modulo 4. `(b - a + 4) % 4` keeps it positive.

#### Tips
- Because `Direction` has no associated values, `==` and `!=` work without any extra code.
- `Direction(rawValue: "n")` is `nil`. Raw values match exactly, case included, which is the point of `init?(rawValue:)` being failable.
- `turns(to:)` never exceeds 3, so the turn-until-you-arrive loop has a hard bound and cannot spin.

#### Docs
- [Enumerations](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/enumerations/)
- [CaseIterable](https://developer.apple.com/documentation/swift/caseiterable)

### 2. Shapes with payloads

`Shape` is an enum whose cases carry different data:

```swift
case circle(radius: Double)
case rectangle(width: Double, height: Double)
case point
```

- `area` is a computed property. A circle is `Double.pi * r * r`, a rectangle is width times height, a point is 0. A negative radius or side also gives 0, since it is not a shape that can be drawn.
- `name` is `"circle"`, `"square"` when a rectangle's sides are equal, `"rectangle"` otherwise, and `"point"`.
- `totalArea(_:)` is a free function summing the areas of a list of shapes, and 0 for an empty list.

```swift starter
enum Shape {
    case circle(radius: Double)
    case rectangle(width: Double, height: Double)
    case point

    var area: Double {
        return 0
    }

    var name: String {
        return "shape"
    }
}

func totalArea(_ shapes: [Shape]) -> Double {
    return 0
}
```

```swift test
/// areas of each case
func testArea() {
    expect(Shape.rectangle(width: 3, height: 4).area, 12)
    expect(Shape.rectangle(width: 2.5, height: 2).area, 5)
    expect(Shape.point.area, 0)
    expect(Shape.circle(radius: 1).area, Double.pi)
    expect(Shape.circle(radius: 2).area, Double.pi * 4)
}

/// shapes that cannot be drawn have no area
func testDegenerate() {
    expect(Shape.circle(radius: 0).area, 0)
    expect(Shape.circle(radius: -3).area, 0)
    expect(Shape.rectangle(width: -2, height: 5).area, 0)
    expect(Shape.rectangle(width: 2, height: -5).area, 0)
    expect(Shape.rectangle(width: 0, height: 5).area, 0)
}

/// names, with squares picked out
func testName() {
    expect(Shape.circle(radius: 1).name, "circle")
    expect(Shape.circle(radius: -1).name, "circle")
    expect(Shape.rectangle(width: 4, height: 4).name, "square")
    expect(Shape.rectangle(width: 4, height: 5).name, "rectangle")
    expect(Shape.rectangle(width: 0, height: 0).name, "square")
    expect(Shape.point.name, "point")
}

/// totals over a list
func testTotalArea() {
    expect(totalArea([]), 0)
    expect(totalArea([.point, .point]), 0)
    expect(totalArea([.rectangle(width: 2, height: 3), .rectangle(width: 1, height: 1)]), 7)
    expect(totalArea([.circle(radius: 1), .point, .rectangle(width: 10, height: 1)]), Double.pi + 10)
    expect(totalArea([.rectangle(width: -1, height: 9), .rectangle(width: 2, height: 2)]), 4)
}
```

#### Uses
- [Enums & pattern matching › Associated values](#/enums/associated-values)
- [Enums & pattern matching › Pattern matching with switch](#/enums/pattern-matching-with-switch)
- [Enums & pattern matching › where clauses and combined cases](#/enums/where-clauses-and-combined-cases)
- [Reference › Sequence and Collection methods](#/reference/sequence-and-collection-methods)

#### Hints
- `switch self` and bind the payloads: `case .circle(let r):` then use `r`.
- Guard the degenerate cases inside each branch, or catch them first with a `where` clause: `case .circle(let r) where r <= 0: return 0`.
- `name` wants a `where w == h` case for the square, placed *before* the general rectangle case.
- `totalArea` is `shapes.reduce(0) { $0 + $1.area }`.

#### Tips
- Writing these as computed properties rather than free functions means `shapes.map(\.area)` works, and the switch lives next to the cases it matches.
- Put the `where` case above the general one. Cases are tried top to bottom, so a bare `case .rectangle` first swallows every square.

#### Docs
- [Associated values](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/enumerations/#Associated-Values)

### 3. An event log

`Event` describes what happened in a system:

```swift
case login(user: String)
case logout(user: String)
case error(code: Int, message: String)
case heartbeat
```

Write three functions over it.

- `label(_:)` renders one event: `"login: ada"`, `"logout: ada"`, `"error 404: not found"`, `"heartbeat"`.
- `isSerious(_:)` is true only for an error whose code is 500 or greater.
- `loginNames(_:)` returns the user of every login event, in order, ignoring every other kind of event. Repeated logins by the same user appear more than once.

```swift starter
enum Event {
    case login(user: String)
    case logout(user: String)
    case error(code: Int, message: String)
    case heartbeat
}

func label(_ event: Event) -> String {
    return "heartbeat"
}

func isSerious(_ event: Event) -> Bool {
    return false
}

func loginNames(_ events: [Event]) -> [String] {
    return []
}
```

```swift test
/// each case renders differently
func testLabel() {
    expect(label(.login(user: "ada")), "login: ada")
    expect(label(.logout(user: "alan")), "logout: alan")
    expect(label(.error(code: 404, message: "not found")), "error 404: not found")
    expect(label(.error(code: 500, message: "boom")), "error 500: boom")
    expect(label(.heartbeat), "heartbeat")
    expect(label(.login(user: "")), "login: ")
}

/// only errors from 500 up are serious
func testIsSerious() {
    expect(isSerious(.error(code: 500, message: "x")), true)
    expect(isSerious(.error(code: 503, message: "x")), true)
    expect(isSerious(.error(code: 499, message: "x")), false)
    expect(isSerious(.error(code: 0, message: "x")), false)
    expect(isSerious(.login(user: "ada")), false)
    expect(isSerious(.logout(user: "ada")), false)
    expect(isSerious(.heartbeat), false)
}

/// logins are picked out in order
func testLoginNames() {
    let events: [Event] = [
        .heartbeat,
        .login(user: "ada"),
        .error(code: 404, message: "not found"),
        .login(user: "alan"),
        .logout(user: "ada"),
        .login(user: "ada"),
    ]
    expect(loginNames(events), ["ada", "alan", "ada"])
}

/// nothing to report
func testNoLogins() {
    expect(loginNames([]), [])
    expect(loginNames([.heartbeat, .logout(user: "ada"), .error(code: 1, message: "x")]), [])
    expect(loginNames([.login(user: "solo")]), ["solo"])
}
```

#### Uses
- [Enums & pattern matching › Associated values](#/enums/associated-values)
- [Enums & pattern matching › Pattern matching with switch](#/enums/pattern-matching-with-switch)
- [Enums & pattern matching › if case and guard case](#/enums/if-case-and-guard-case)
- [Reference › Array, Set and Dictionary](#/reference/array-set-and-dictionary)

#### Hints
- `label` is one exhaustive `switch` with string interpolation in each branch.
- `isSerious` only cares about one case, so `if case .error(let code, _) = event { return code >= 500 }` and `return false` is enough — or a `switch` with a `where` clause and a `default`.
- `loginNames` can be a `for` loop with `if case .login(let user) = event { names.append(user) }`, or `events.compactMap { ... }` returning `user` or `nil`.

#### Tips
- Underscore ignores a payload you do not need: `case .error(let code, _)`.
- `if case` is the single-pattern form of `switch`. Reach for it when exactly one case interests you and a `switch` would need a `default` that does nothing.

#### Docs
- [Enumerations: Matching enumeration values](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/enumerations/#Matching-Enumeration-Values-with-a-Switch-Statement)

### 4. An expression tree

`Expr` is a recursive enum, so it needs `indirect`:

```swift
case value(Int)
case add(Expr, Expr)
case multiply(Expr, Expr)
case negate(Expr)
```

- `evaluate(_:)` computes the number the expression stands for.
- `show(_:)` renders it: a value is its digits, `add` is `"(a + b)"`, `multiply` is `"(a * b)"`, and `negate` is a minus sign followed by the rendering of what it wraps, with no extra brackets of its own.
- `depth(_:)` is the height of the tree: a bare value is 1, and every wrapping case is one more than the deepest thing inside it.

```swift starter
indirect enum Expr {
    case value(Int)
    case add(Expr, Expr)
    case multiply(Expr, Expr)
    case negate(Expr)
}

func evaluate(_ e: Expr) -> Int {
    return 0
}

func show(_ e: Expr) -> String {
    return "?"
}

func depth(_ e: Expr) -> Int {
    return 1
}
```

```swift test
/// evaluating leaves and one level
func testEvaluateSimple() {
    expect(evaluate(.value(7)), 7)
    expect(evaluate(.value(-3)), -3)
    expect(evaluate(.add(.value(2), .value(3))), 5)
    expect(evaluate(.multiply(.value(4), .value(5))), 20)
    expect(evaluate(.negate(.value(6))), -6)
    expect(evaluate(.negate(.value(0))), 0)
}

/// evaluating nested expressions
func testEvaluateNested() {
    let e = Expr.multiply(.add(.value(1), .value(2)), .value(10))
    expect(evaluate(e), 30)
    expect(evaluate(.add(.negate(.value(4)), .multiply(.value(2), .value(3)))), 2)
    expect(evaluate(.negate(.negate(.value(9)))), 9)
    expect(evaluate(.add(.add(.value(1), .value(2)), .add(.value(3), .value(4)))), 10)
}

/// rendering
func testShow() {
    expect(show(.value(7)), "7")
    expect(show(.value(-3)), "-3")
    expect(show(.add(.value(1), .value(2))), "(1 + 2)")
    expect(show(.multiply(.value(3), .value(4))), "(3 * 4)")
    expect(show(.negate(.value(5))), "-5")
    expect(show(.negate(.add(.value(1), .value(2)))), "-(1 + 2)")
    expect(show(.multiply(.add(.value(1), .value(2)), .value(10))), "((1 + 2) * 10)")
}

/// depth of the tree
func testDepth() {
    expect(depth(.value(1)), 1)
    expect(depth(.negate(.value(1))), 2)
    expect(depth(.add(.value(1), .value(2))), 2)
    expect(depth(.multiply(.add(.value(1), .value(2)), .value(10))), 3)
    expect(depth(.add(.value(1), .negate(.negate(.value(2))))), 4)
    expect(depth(.add(.negate(.value(1)), .value(2))), 3)
}
```

#### Uses
- [Enums & pattern matching › Indirect enums](#/enums/indirect-enums)
- [Enums & pattern matching › Pattern matching with switch](#/enums/pattern-matching-with-switch)
- [Enums & pattern matching › Associated values](#/enums/associated-values)

#### Hints
- All three functions have the same shape: a `switch` with one branch per case, calling themselves on the sub-expressions.
- `show(.add(a, b))` is `"(\(show(a)) + \(show(b)))"`.
- `depth` of a two-child case is `1 + max(depth(a), depth(b))`.

#### Tips
- The recursion terminates because every case except `.value` strictly shrinks what it passes down, and `.value` calls nothing.
- `show(.negate(...))` adds no brackets of its own, so `-(1 + 2)` gets its brackets from the `add` inside it. Read the expected strings before writing that branch.

#### Docs
- [Recursive enumerations](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/enumerations/#Recursive-Enumerations)
