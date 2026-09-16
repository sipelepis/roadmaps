# Optionals

In Swift a value that might be missing has a different type from one that cannot be. `String` always holds text; `String?` holds text or `nil`, and the compiler will not let you use it as text until you have dealt with the `nil` case. That one rule is why Swift code rarely crashes on a null.

## A missing value has its own type

Write `?` after a type and you get the optional version of it. It is a separate type, not a flag on the old one, so an `Int?` cannot be added to an `Int` and a `String?` cannot be printed as text without unwrapping.

```swift
var middleName: String? = "Quinn"
middleName = nil            // fine: nil is a legal value of String?

var age: Int = 30
// age = nil                // error: 'nil' cannot be assigned to type 'Int'

let maybe: Int? = 5
// let sum = maybe + 1      // error: value of optional type 'Int?' must be unwrapped
```

An optional declared with `var` and no value starts as `nil`. Comparing against `nil` with `==` and `!=` always works, and so does comparing two optionals of the same `Equatable` type.

## Unwrapping with `if let`

`if let` runs its body only when the optional has a value, and gives that value a plain non-optional name inside.

```swift
let input: String? = "Ada"

if let name = input {
    print("Hello, \(name)!")     // `name` is a String, not a String?
} else {
    print("Hello, stranger!")
}
```

Reusing the same name is idiomatic and has its own shorthand: `if let input { … }` declares a non-optional `input` that shadows the optional one inside the body. One `if` can unwrap several optionals at once, separated by commas, and can mix in ordinary conditions: `if let a = first, let b = second, a != b { … }`.

## `guard let` and early exit

`guard let` unwraps for the *rest* of the scope instead of for a block. Its `else` branch must leave the scope — `return`, `break`, `continue`, or trap — so after the `guard` the name is available and definitely not `nil`.

```swift
func initial(of name: String?) -> String {
    guard let name, let first = name.first else { return "?" }
    return String(first).uppercased()
}
```

The difference from `if let` is where the happy path lives. `guard` handles the failures at the top and leaves the body unindented, which is why Swift code checks its inputs in a row of `guard`s and then gets on with the work.

## Nil-coalescing `??`

`a ?? b` is the value of `a` when it has one, and `b` otherwise. The result is non-optional, so it is the shortest way to supply a default.

```swift
let nickname: String? = nil
let display = nickname ?? "anonymous"   // String, "anonymous"

let settings: Int? = nil
let fallback: Int? = 30
let timeout = settings ?? fallback ?? 60   // chains right to left
```

The right-hand side is only evaluated when it is needed, so `?? expensiveDefault()` costs nothing when the optional has a value.

## Optional chaining

Writing `?` after an optional before a call or a property runs it only if the value is there, and gives back an optional result.

```swift
let text: String? = "swift"
let shouted = text?.uppercased()        // String?, "SWIFT"
let length = text?.count ?? 0           // Int, 5

let missing: String? = nil
print(missing?.uppercased() as Any)     // nil, and nothing was called
```

Chaining composes: `a?.b?.c` is `nil` as soon as any link is `nil`. A chained call that returns `Bool?` compares nicely against a literal, as in `if text?.isEmpty == true`, which is `false` both when the text is missing and when it has content.

Chaining itself flattens, so `settings?["port"]` on a `[String: Int]?` is an `Int?` and not an `Int??`. What does *not* flatten is `map` with a closure that returns an optional, which is exactly the case `flatMap` exists for:

```swift
let text: String? = "42"
text.map { Int($0) }        // Optional(Optional(42)) — an Int??
text.flatMap { Int($0) }    // Optional(42) — an Int?
```

A stray `Optional(Optional(...))` in an error message or a `print` is the symptom. `flatMap` collapses it; so does `?? nil` when the outer layer is the one you want gone. The other place it turns up is the first element of an array of optionals: `[Int?]().first` is an `Int??`, because "no first element" and "a first element that is nil" are different answers.

## Force unwrap, and when it is honest

`value!` asserts the optional is not `nil` and crashes the program if it is. It is right only where the surrounding code guarantees the value, and even then a `guard` with a clear message ages better.

```swift
let known: Int? = 5
print(known! + 1)           // 6

let unknown: Int? = nil
// print(unknown! + 1)      // Fatal error: Unexpectedly found nil while unwrapping an Optional value
```

Implicitly unwrapped optionals, written `String!`, are the same promise made at the type level. They exist for two-phase initialisation on Apple platforms and are worth recognising rather than writing.

## Failable conversions

Many standard-library conversions can fail, and they say so by returning an optional. `Int(someString)` is the one you will meet first.

```swift
Int("42")        // Optional(42)
Int("-7")        // Optional(-7)
Int("3.5")       // nil, that's a Double's text
Int(" 7")        // nil, no surrounding whitespace allowed
Int("")          // nil
Int("ff", radix: 16)   // Optional(255)
```

This is the whole "parse, don't validate" story in one call: there is no separate `isNumeric` check that could drift out of step with the parse, because the parse itself hands you either a number or nothing.

## Matching optionals in a `switch`

An optional is really an enum with two cases, `some(value)` and `none`, so `switch` can match it directly.

```swift
let reading: Int? = 42

switch reading {
case nil:
    print("no reading")
case let value? where value > 100:
    print("too high: \(value)")
case let value?:
    print("reading \(value)")
}
```

`case let value?` is shorthand for `case .some(let value)`, and `nil` matches `.none`. The Enums module comes back to this once optionals stop looking like magic.

```swift playground
let inputs: [String?] = ["42", "abc", nil, "-7"]

for input in inputs {
    if let input, let parsed = Int(input) {
        print("\(input) -> \(parsed)")
    } else {
        print("\(input ?? "<nil>") -> no number")
    }
}

func initial(of name: String?) -> String {
    guard let name, let first = name.first else { return "?" }
    return String(first).uppercased()
}

print(initial(of: "ada"), initial(of: nil), initial(of: ""))

let nickname: String? = nil
print("welcome, \(nickname ?? "anonymous")")

let text: String? = "swift"
print(text?.uppercased() ?? "nothing", text?.count ?? 0)

// Try: replace `parsed ?? 0` with `parsed!` and watch the run stop at the first nil.
```

## Exercises

### 1. Parse or zero

`number(in:)` returns the whole number the text spells, or 0 when it does not spell one. Anything `Int` cannot parse counts as not a number: letters, a decimal point, surrounding spaces, an empty string, or a value too large for an `Int`.

```swift starter
func number(in text: String) -> Int {
    return 0
}
```

```swift test
/// reads plain numbers
func testNumbers() {
    expect(number(in: "42"), 42)
    expect(number(in: "0"), 0)
    expect(number(in: "1000000"), 1_000_000)
}

/// reads negative numbers
func testNegative() {
    expect(number(in: "-7"), -7)
    expect(number(in: "-0"), 0)
}

/// anything unparseable is zero
func testUnparseable() {
    expect(number(in: "abc"), 0)
    expect(number(in: ""), 0)
    expect(number(in: "12abc"), 0)
    expect(number(in: "3.5"), 0)
}

/// spaces and oversized numbers are not numbers
func testEdges() {
    expect(number(in: " 7"), 0)
    expect(number(in: "7 "), 0)
    expect(number(in: "9223372036854775808"), 0)
}
```

#### Uses
- [Optionals › Failable conversions](#/optionals/failable-conversions)
- [Optionals › Nil-coalescing `??`](#/optionals/nil-coalescing)

#### Hints
- `Int(text)` gives you an `Int?`: the number, or `nil` when the text is not one.
- `??` turns that straight into the answer, so the whole body is one expression.

#### Tips
- Nothing here needs an `if`. Reaching for `if Int(text) != nil { return Int(text)! }` parses twice and force-unwraps for no reason.
- `Int("9223372036854775808")` is `nil` rather than a wrapped number: the parse fails when the value will not fit. One more thing you get for free by not writing your own digit check.

#### Docs
- [Int(_: String)](https://developer.apple.com/documentation/swift/int/init(_:)-5uqgs)

### 2. Greet whoever showed up

`greeting(for:)` returns `"Hello, <name>!"` when it is given a name, and `"Hello, stranger!"` when the name is `nil` or an empty string.

```swift starter
func greeting(for name: String?) -> String {
    return "Hello, stranger!"
}
```

```swift test
/// greets a name
func testNamed() {
    expect(greeting(for: "Ada"), "Hello, Ada!")
    expect(greeting(for: "Zoë"), "Hello, Zoë!")
}

/// nil is a stranger
func testNil() {
    expect(greeting(for: nil), "Hello, stranger!")
    let missing: String? = nil
    expect(greeting(for: missing), "Hello, stranger!")
}

/// an empty name is a stranger too
func testEmpty() {
    expect(greeting(for: ""), "Hello, stranger!")
}

/// a name that only looks empty is still a name
func testWhitespaceName() {
    expect(greeting(for: " "), "Hello,  !")
    expect(greeting(for: "0"), "Hello, 0!")
}
```

#### Uses
- [Optionals › Unwrapping with `if let`](#/optionals/unwrapping-with-if-let)
- [Optionals › A missing value has its own type](#/optionals/a-missing-value-has-its-own-type)

#### Hints
- `if let name = name, !name.isEmpty { … }` unwraps and checks emptiness in one condition.
- The shorthand `if let name` reuses the same name, so the body reads as if the optional were never there.
- The `else` branch returns the stranger greeting.

#### Tips
- Optional chaining gets there too: `if name?.isEmpty == false`. It reads oddly at first, but `== false` is precisely "has a value, and that value is not empty".
- `" "` counts as a name and `""` does not. The tests say so explicitly, so resist the urge to trim whitespace on the way in.

#### Docs
- [Optional binding](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/thebasics/#Optional-Binding)

### 3. Settle on a timeout

`timeout(user:config:fallback:)` picks the timeout to use: the user's setting if there is one, otherwise the config's, otherwise the fallback. A setting of zero or less is not a usable timeout, so it is ignored as if it were missing. The fallback is returned as it is, whatever its value.

```swift starter
func timeout(user: Int?, config: Int?, fallback: Int) -> Int {
    return fallback
}
```

```swift test
/// the user's setting wins
func testUserWins() {
    expect(timeout(user: 5, config: 30, fallback: 60), 5)
    expect(timeout(user: 7, config: nil, fallback: 60), 7)
}

/// the config is next
func testConfigNext() {
    expect(timeout(user: nil, config: 30, fallback: 60), 30)
    expect(timeout(user: nil, config: 1, fallback: 60), 1)
}

/// the fallback is last
func testFallback() {
    expect(timeout(user: nil, config: nil, fallback: 60), 60)
    expect(timeout(user: nil, config: nil, fallback: 0), 0)
}

/// zero and negative settings are ignored
func testIgnoresNonPositive() {
    expect(timeout(user: 0, config: 30, fallback: 60), 30)
    expect(timeout(user: -1, config: -2, fallback: 60), 60)
    expect(timeout(user: nil, config: 0, fallback: 9), 9)
    expect(timeout(user: 0, config: 0, fallback: 0), 0)
}
```

#### Uses
- [Optionals › Nil-coalescing `??`](#/optionals/nil-coalescing)
- [Optionals › Unwrapping with `if let`](#/optionals/unwrapping-with-if-let)
- [Control flow › `if` and `else`](#/control-flow/if-and-else)

#### Hints
- Deal with one candidate at a time: `if let user, user > 0 { return user }`, then the same for the config.
- Whatever is left returns `fallback`.
- A plain `user ?? config ?? fallback` is not enough, because it accepts a zero the description says to ignore.

#### Tips
- Turning a value you don't want into `nil` is a common move, and the standard library has a name for it: `user.flatMap { $0 > 0 ? $0 : nil }`. The Collection operations module explains `flatMap` properly.
- The fallback is returned as it is, even when it is 0 or negative. Only the two optional candidates get the "positive or nothing" rule, which is easy to lose if you clamp once at the end.

#### Docs
- [Nil-coalescing operator](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/basicoperators/#Nil-Coalescing-Operator)

### 4. Average of two numbers in text

`average(of:_:)` reads two whole numbers out of text and returns their mean as a `Double`. If either piece of text is not a number, there is no average to report, so the result is `nil`.

```swift starter
func average(of first: String, _ second: String) -> Double? {
    return nil
}
```

```swift test
/// averages two numbers
func testAverages() {
    expect(average(of: "3", "5"), 4.0)
    expect(average(of: "10", "20"), 15.0)
    expect(average(of: "-4", "4"), 0.0)
}

/// halves are not rounded away
func testHalves() {
    expect(average(of: "1", "2"), 1.5)
    expect(average(of: "0", "7"), 3.5)
    expect(average(of: "-1", "-2"), -1.5)
}

/// a bad first argument gives nil
func testFirstBad() {
    expect(average(of: "x", "5"), nil)
    expect(average(of: "", "5"), nil)
}

/// a bad second argument gives nil
func testSecondBad() {
    expect(average(of: "5", "3.5"), nil)
    expect(average(of: "x", "y"), nil)
}
```

#### Uses
- [Optionals › `guard let` and early exit](#/optionals/guard-let-and-early-exit)
- [Optionals › Failable conversions](#/optionals/failable-conversions)
- [Variables & types › Numbers never convert themselves](#/basics/numbers-never-convert-themselves)

#### Hints
- One `guard` can unwrap both: `guard let a = Int(first), let b = Int(second) else { return nil }`.
- After the guard, `a` and `b` are plain `Int`s. Convert before dividing, or `3` and `5` average to 4 by accident and `1` and `2` average to 1.
- `Double(a + b) / 2` keeps the half.

#### Tips
- The return type is `Double?` but `return Double(a + b) / 2` needs no wrapping: Swift promotes a non-optional to the optional it is being returned as.
- One `guard` with two bindings short-circuits: when the first `Int(...)` is `nil` the second is never evaluated. Two separate guards behave identically and read longer.

#### Docs
- [Early exit](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/controlflow/#Early-Exit)
