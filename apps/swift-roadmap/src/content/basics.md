# Variables & types

Swift names values in two ways, `let` for something that never changes and `var` for something that does, and infers almost every type so you rarely write one. What it will not do is convert numbers for you: an `Int` and a `Double` do not mix until you say so.

## `let` and `var`

`let` binds a name to a value once. `var` binds a name you can reassign later.

```swift
let launched = 2014
var downloads = 0
downloads += 1
// launched = 2015   // error: cannot assign to value: 'launched' is a 'let' constant
```

A `let` is not a compile-time constant. It can be initialised from anything, a function call included; it just cannot change afterwards. Reach for `let` first and let the compiler tell you when you need `var` — it also warns about a `var` that is never mutated.

## The types you will use

`Int` is a signed integer, 64-bit on every platform this roadmap runs on. `Double` is a 64-bit floating-point number and the default for decimal literals; `Float` is the 32-bit one and is rare. `Bool` is `true` or `false` and nothing else. `String` is text, `Character` is one character of it.

```swift
let big = 1_000_000      // underscores are spacing, not syntax
let mask = 0b1010        // binary
let color = 0xFF_00_FF   // hex
let sci = 1.5e3          // 1500.0, a Double
let limit = Int.max      // 9223372036854775807
```

Integer overflow is not silent in Swift. `Int.max + 1` traps and stops the program rather than wrapping around to a negative number.

## Type inference and annotations

The type of a variable comes from the value it is initialised with, so `let n = 5` is an `Int` and `let x = 5.0` is a `Double`. Write an annotation when the literal alone gives you the wrong type, or when there is no value yet to infer from.

```swift
let ratio: Double = 5    // a Double holding 5.0, not an Int
let name: String         // declared now, assigned once before first use
name = "Ada"
```

Annotations go after the name: `identifier: Type`. You will see the same shape in function parameters and in struct properties later.

## Numbers never convert themselves

Most languages quietly widen an `Int` to a `Double` in mixed arithmetic. Swift does not, because the quiet conversions are also the ones that lose data.

```swift
let count = 7
let price = 1.5
// let total = count * price   // error: binary operator '*' cannot be applied to 'Int' and 'Double'
let total = Double(count) * price   // 10.5
```

`Double(anInt)` and `Int(aDouble)` are ordinary initialisers. Going the other way truncates toward zero rather than rounding: `Int(2.9)` is `2` and `Int(-2.9)` is `-2`. When you want rounding, ask for it: `(2.9).rounded()` is `3.0`.

## Integer division and remainder

`/` between two `Int`s is integer division, and it truncates toward zero. `%` is the remainder, and it takes the sign of the left operand.

```swift
7 / 2      // 3, not 3.5
7 % 2      // 1
-7 / 2     // -3
-7 % 2     // -1
```

This pairing is how you split one number into parts: `total / 60` is whole minutes and `total % 60` is the seconds left over. When you wanted the fraction, convert before dividing: `Double(7) / Double(2)` is `3.5`.

## Booleans and operators

Comparisons (`==`, `!=`, `<`, `<=`, `>`, `>=`) produce a `Bool`, and `Bool`s combine with `&&`, `||` and `!`. There is no truthiness in Swift: only a `Bool` can be a condition, so `if count` is an error where `if count > 0` is fine.

```swift
let year = 2024
let leapish = year % 4 == 0 && year % 100 != 0
let shout = !leapish
```

`&&` and `||` short-circuit: the right side is only evaluated if it can still change the answer. The ternary operator `condition ? a : b` is the expression form of an `if`, and is the tidiest way to pick between two values inside a larger expression:

```swift
let count = 1
let label = "\(count) item\(count == 1 ? "" : "s")"   // "1 item"
```

## Tuples

A tuple groups a fixed number of values of possibly different types. Give the elements names and they read like a tiny record, without declaring a type for them.

```swift
let size = (width: 1920, height: 1080)
size.width            // 1920
let (w, h) = size     // decompose into two constants
let (_, only) = size  // _ discards the part you don't want
```

Tuples are the lightweight way to return more than one value from a function. They are deliberately limited: a tuple cannot conform to a protocol, so it is not `Equatable` and cannot be stored in a `Set` or used as a dictionary key. `==` does work between two small tuples, but in the exercises here the tests compare the fields one by one.

```swift playground
let language = "Swift"
var year = 2014
year += 12

let count = 7
let days = 2.0
print("\(count) items over \(days) days = \(Double(count) / days) per day")

print("7 / 2 =", 7 / 2, "remainder", 7 % 2)
print("-7 / 2 =", -7 / 2, "remainder", -7 % 2)

let size = (width: 1920, height: 1080)
let pixels = size.width * size.height
let wide = size.width > size.height && pixels > 1_000_000
print("\(language) \(year): \(size.width)x\(size.height) is \(pixels) pixels, wide: \(wide)")

let items = 1
print("\(items) item\(items == 1 ? "" : "s") in the cart")

// Try: change `days` to `2` and read the error the compiler gives you.
```

## Exercises

### 1. Celsius to Fahrenheit

`fahrenheit(fromCelsius:)` converts a temperature using `f = c * 9 / 5 + 32` and returns a `Double`. Do the arithmetic in `Double`: integer division throws away the fraction, so 1°C would come out as 33 instead of 33.8.

```swift starter
func fahrenheit(fromCelsius celsius: Int) -> Double {
    return 0
}
```

```swift test
func close(_ got: Double, _ want: Double) -> Bool { abs(got - want) < 1e-9 }

/// converts the fixed points
func testFixedPoints() {
    expect(close(fahrenheit(fromCelsius: 0), 32), "0C should be 32F, got \(fahrenheit(fromCelsius: 0))")
    expect(close(fahrenheit(fromCelsius: 100), 212), "100C should be 212F, got \(fahrenheit(fromCelsius: 100))")
}

/// keeps the fraction
func testKeepsFraction() {
    expect(close(fahrenheit(fromCelsius: 1), 33.8), "1C should be 33.8F, got \(fahrenheit(fromCelsius: 1))")
    expect(close(fahrenheit(fromCelsius: 37), 98.6), "37C should be 98.6F, got \(fahrenheit(fromCelsius: 37))")
}

/// works below zero
func testBelowZero() {
    expect(close(fahrenheit(fromCelsius: -40), -40), "-40C should be -40F, got \(fahrenheit(fromCelsius: -40))")
    expect(close(fahrenheit(fromCelsius: -1), 30.2), "-1C should be 30.2F, got \(fahrenheit(fromCelsius: -1))")
}
```

#### Uses
- [Variables & types › Numbers never convert themselves](#/basics/numbers-never-convert-themselves)
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)
- [Reference › Numbers](#/reference/numbers)

#### Hints
- `Double(celsius)` makes a `Double` out of the parameter. Everything after that stays a `Double`.
- `Double(celsius) * 9 / 5 + 32` works because once one operand is a `Double`, the literals are inferred as `Double` too.

#### Tips
- The tests compare with a tolerance rather than `==`. Floating-point results that came from different arithmetic rarely match bit for bit, so comparing them exactly is a habit worth not forming.
- `abs` is the standard library's magnitude function and works on any signed number, which is what lets the test's `close` helper be one line.
- Convert at the start, not at the end. `Double(celsius * 9 / 5) + 32` converts too late: the integer division has already thrown the fraction away.

#### Docs
- [Numeric type conversion](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/thebasics/#Numeric-Type-Conversion)

### 2. Split the clock

`clockParts(fromSeconds:)` splits a non-negative number of seconds into whole hours, minutes and seconds, and returns them as a named tuple. 3661 seconds is 1 hour, 1 minute and 1 second.

```swift starter
func clockParts(fromSeconds total: Int) -> (hours: Int, minutes: Int, seconds: Int) {
    return (0, 0, 0)
}
```

```swift test
/// splits a mixed time
func testMixed() {
    let a = clockParts(fromSeconds: 3661)
    expect(a.hours, 1)
    expect(a.minutes, 1)
    expect(a.seconds, 1)
    let b = clockParts(fromSeconds: 7385)
    expect(b.hours, 2)
    expect(b.minutes, 3)
    expect(b.seconds, 5)
}

/// exact boundaries carry nothing over
func testBoundaries() {
    let hour = clockParts(fromSeconds: 3600)
    expect(hour.hours, 1)
    expect(hour.minutes, 0)
    expect(hour.seconds, 0)
    let minute = clockParts(fromSeconds: 60)
    expect(minute.hours, 0)
    expect(minute.minutes, 1)
    expect(minute.seconds, 0)
}

/// zero and small values
func testSmall() {
    let zero = clockParts(fromSeconds: 0)
    expect(zero.hours, 0)
    expect(zero.minutes, 0)
    expect(zero.seconds, 0)
    let short = clockParts(fromSeconds: 59)
    expect(short.hours, 0)
    expect(short.minutes, 0)
    expect(short.seconds, 59)
}

/// minutes and seconds never exceed 59
func testNoOverflow() {
    let long = clockParts(fromSeconds: 86_399)
    expect(long.hours, 23)
    expect(long.minutes, 59)
    expect(long.seconds, 59)
    let day = clockParts(fromSeconds: 90_061)
    expect(day.hours, 25)
    expect(day.minutes, 1)
    expect(day.seconds, 1)
}
```

#### Uses
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)
- [Variables & types › Tuples](#/basics/tuples)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- Hours are `total / 3600`. Whatever is left is `total % 3600`.
- Take the leftover seconds into a `let` of their own, then split that the same way with 60.
- Return `(hours: h, minutes: m, seconds: s)`, or just `(h, m, s)` — the labels come from the return type.

#### Tips
- Hours are deliberately not capped at 24 here, so 90061 seconds is 25 hours. Wrapping around days is a different question from splitting a duration.
- The labels in the return type are what give the tests `a.hours`. A bare `(Int, Int, Int)` would force them to say `a.0`.
- Take the remainder before splitting it further. Dividing the original total by 60 gives you total minutes, not the minutes left over after the hours.

#### Docs
- [Tuples](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/thebasics/#Tuples)

### 3. Leap years

`isLeapYear(_:)` answers the Gregorian rule: a year divisible by 4 is a leap year, except a year divisible by 100, unless it is also divisible by 400. So 2024 and 2000 are leap years and 1900 is not.

```swift starter
func isLeapYear(_ year: Int) -> Bool {
    return false
}
```

```swift test
/// ordinary leap years
func testLeap() {
    expect(isLeapYear(2024), true)
    expect(isLeapYear(1996), true)
    expect(isLeapYear(4), true)
}

/// ordinary common years
func testCommon() {
    expect(isLeapYear(2023), false)
    expect(isLeapYear(2025), false)
    expect(isLeapYear(1), false)
}

/// centuries are not leap years
func testCenturies() {
    expect(isLeapYear(1900), false)
    expect(isLeapYear(2100), false)
    expect(isLeapYear(1700), false)
}

/// unless they divide by 400
func testFourHundreds() {
    expect(isLeapYear(2000), true)
    expect(isLeapYear(1600), true)
    expect(isLeapYear(2400), true)
}
```

#### Uses
- [Variables & types › Booleans and operators](#/basics/booleans-and-operators)
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- "Divisible by 4" is `year % 4 == 0`.
- The whole rule fits in one expression: divisible by 4, and either not divisible by 100 or divisible by 400.
- Watch the grouping. `a && b || c` is `(a && b) || c`, which is not the rule; put the "or" part in its own parentheses.

#### Tips
- A single expression body needs no `return`, so the answer can be one line: `year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)`.
- The four tests are the four clauses of the rule: ordinary, ordinary-not, century, century-that-still-counts. Whichever fails tells you which clause is wrong.

#### Docs
- [Logical operators](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/basicoperators/#Logical-Operators)

### 4. Price tag

`priceTag(cents:)` formats a non-negative whole number of cents as a price string: 1234 becomes `"$12.34"`. The cents part is always two digits, so 5 is `"$0.05"` and 100 is `"$1.00"`.

```swift starter
func priceTag(cents: Int) -> String {
    return "$0.00"
}
```

```swift test
/// formats dollars and cents
func testNormal() {
    expect(priceTag(cents: 1234), "$12.34")
    expect(priceTag(cents: 999), "$9.99")
}

/// pads the cents to two digits
func testPadding() {
    expect(priceTag(cents: 5), "$0.05")
    expect(priceTag(cents: 105), "$1.05")
    expect(priceTag(cents: 1_000_001), "$10000.01")
}

/// whole dollars still show .00
func testWholeDollars() {
    expect(priceTag(cents: 100), "$1.00")
    expect(priceTag(cents: 4200), "$42.00")
}

/// zero
func testZero() {
    expect(priceTag(cents: 0), "$0.00")
    expect(priceTag(cents: 9), "$0.09")
}
```

#### Uses
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)
- [Variables & types › Booleans and operators](#/basics/booleans-and-operators)
- [What is Swift? › Hello, Swift](#/intro/hello-swift)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- Dollars are `cents / 100` and the remainder is `cents % 100`.
- The remainder is a number, so 5 interpolates as `"5"`. Add the leading zero yourself when it is below 10.
- A ternary inside the interpolation keeps it to one line: `"\(rest < 10 ? "0" : "")\(rest)"`.

#### Tips
- Money is usually stored as whole cents exactly like this. A `Double` cannot represent 0.10 exactly, so prices in `Double` drift by fractions of a cent and eventually disagree with the accountants.
- Interpolating `5` gives `"5"`, not `"05"`. Numbers interpolate with no padding at all, which is the entire difficulty of this exercise.
- Foundation's `String(format: "%02d", rest)` pads too, and is worth knowing. Doing it by hand once shows you what it is doing.

#### Docs
- [Arithmetic operators](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/basicoperators/#Arithmetic-Operators)
