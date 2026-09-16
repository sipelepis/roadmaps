# Functions

A Swift function declares two names for every parameter — one the caller writes and one the body uses — which is why call sites read like sentences. On top of that sit default values, variadic parameters, `inout` parameters, tuple returns, and function types, so that most of what other languages need objects or overloads for is just a parameter list.

## Two names for every parameter

`func name(label parameter: Type) -> ReturnType`. The label is what the caller writes, the parameter name is what the body uses. Write only one name and it plays both roles; write `_` as the label and the caller writes nothing.

```swift
func move(from start: Int, to end: Int) -> Int { end - start }
move(from: 2, to: 10)      // 8

func double(_ n: Int) -> Int { n * 2 }
double(21)                 // no label at all

func repeatMessage(message: String) { print(message) }
repeatMessage(message: "hi")   // one name, used at both ends
```

Labels are part of the function's identity: `move(from:to:)` is how you refer to that function in documentation and in an error message. A function that returns nothing omits the `->` clause entirely; its return type is `Void`, written `()`.

## Default values

Give a parameter a default and the caller can leave it out. Parameters with defaults can go anywhere in the list, though putting them last keeps call sites tidy.

```swift
func join(_ parts: String, separator: String = ", ", trailing: Bool = false) -> String {
    trailing ? parts + separator : parts
}

join("a")                            // uses both defaults
join("a", separator: " | ")          // overrides one
join("a", trailing: true)            // skips the one in between
```

Defaults replace most of the overloads you would write in Java or C#: one function with sensible defaults instead of four that forward to each other.

## Returning a tuple

When a function has two answers, return them as a named tuple rather than inventing a type or writing to a parameter.

```swift
func minMax(_ a: Int, _ b: Int, _ c: Int) -> (min: Int, max: Int) {
    let lo = Swift.min(a, Swift.min(b, c))
    let hi = Swift.max(a, Swift.max(b, c))
    return (lo, hi)
}

let range = minMax(3, 1, 2)
print(range.min, range.max)        // 1 3
let (lowest, _) = minMax(3, 1, 2)  // or decompose it
```

The labels come from the return type, so the `return` statement itself can just list the values in order.

## `inout` parameters

Parameters are constants inside the function, and a `struct` value such as an `Int` or a `String` is copied when passed. To let a function change the caller's variable, mark the parameter `inout` and pass the argument with `&`.

```swift
func bump(_ value: inout Int, by amount: Int = 1) {
    value += amount
}

var score = 10
bump(&score)            // score is 11
bump(&score, by: 5)     // score is 16
```

The `&` at the call site is the point: you can see that the variable is about to change. An `inout` argument has to be a `var`; a `let` will not compile.

## Variadic parameters

A parameter written `Type...` accepts any number of arguments, and arrives in the body as an array.

```swift
func total(_ numbers: Int...) -> Int {
    var sum = 0
    for n in numbers { sum += n }
    return sum
}

total()            // 0
total(1, 2, 3)     // 6
```

`print` is variadic, which is why `print(a, b, c)` works. A function may have more than one variadic parameter, but every one after the first needs a label so the compiler can tell where the list ends.

## Overloading

Several functions can share a name as long as their parameter types, labels or return type differ. Swift picks the one that fits the call.

```swift
func describe(_ n: Int) -> String { "the number \(n)" }
func describe(_ s: String) -> String { "the text \(s)" }
func describe(_ n: Int, style: Bool) -> String { style ? "#\(n)" : "\(n)" }
```

Overload where the functions really do the same thing to different types. When they only differ in an option, a default parameter is clearer.

## Recursion and nested functions

A function can call itself, and can declare helper functions inside itself that are invisible outside.

```swift
func factorial(_ n: Int) -> Int {
    n <= 1 ? 1 : n * factorial(n - 1)
}

func digitsCount(of number: Int) -> Int {
    func count(_ n: Int) -> Int { n < 10 ? 1 : 1 + count(n / 10) }
    return count(abs(number))
}
```

Every recursion needs a base case that stops it. Swift has no tail-call guarantee, so a recursion thousands of levels deep will overflow the stack; a loop is the safe choice for those.

## Functions are values

A function has a type, written `(ParameterTypes) -> ReturnType`, and a value of that type can be stored in a variable or passed to another function.

```swift
func double(_ n: Int) -> Int { n * 2 }

let operation: (Int) -> Int = double
operation(5)                        // 10

func applyTwice(_ transform: (Int) -> Int, to value: Int) -> Int {
    transform(transform(value))
}
applyTwice(double, to: 3)           // 12
```

Referring to a function by name gives you the value; writing `double(3)` calls it. When several overloads share the name you disambiguate with the labels, as in `describe(_:style:)`. The Closures module picks this up and lets you write the function inline instead of declaring it first.

```swift playground
func label(_ text: String, width: Int = 12, fill: String = ".") -> String {
    var out = text
    while out.count < width { out += fill }
    return out
}

func minMax(_ numbers: Int...) -> (min: Int, max: Int) {
    var lo = numbers[0], hi = numbers[0]
    for n in numbers {
        if n < lo { lo = n }
        if n > hi { hi = n }
    }
    return (lo, hi)
}

func bump(_ value: inout Int, by amount: Int = 1) { value += amount }

func applyTwice(_ transform: (Int) -> Int, to value: Int) -> Int {
    transform(transform(value))
}

func square(_ n: Int) -> Int { n * n }

let bounds = minMax(3, 9, 1, 7)
print(label("min") + "\(bounds.min)")
print(label("max") + "\(bounds.max)")

var score = 10
bump(&score)
bump(&score, by: 5)
print(label("score", width: 8, fill: " ") + "\(score)")

print(label("3 squared twice", width: 20) + "\(applyTwice(square, to: 3))")

// Try: call minMax() with no arguments and see where it goes wrong.
```

## Exercises

### 1. Repeat with defaults

`repeated(_:times:separator:)` returns the text repeated, joined by the separator. It repeats twice by default and separates with a single space by default, so `repeated("ha")` is `"ha ha"`. Repeating zero times gives an empty string, and the separator only ever goes *between* copies.

```swift starter
func repeated(_ text: String, times: Int = 2, separator: String = " ") -> String {
    return text
}
```

```swift test
/// uses both defaults
func testDefaults() {
    expect(repeated("ha"), "ha ha")
    expect(repeated("x"), "x x")
}

/// a different count
func testTimes() {
    expect(repeated("x", times: 3), "x x x")
    expect(repeated("na", times: 4), "na na na na")
    expect(repeated("solo", times: 1), "solo")
}

/// a different separator
func testSeparator() {
    expect(repeated("na", times: 4, separator: "-"), "na-na-na-na")
    expect(repeated("a", times: 3, separator: ""), "aaa")
    expect(repeated("hey", separator: ", "), "hey, hey")
}

/// nothing to repeat
func testZero() {
    expect(repeated("x", times: 0), "")
    expect(repeated("x", times: 0, separator: "-"), "")
    expect(repeated("", times: 3, separator: ","), ",,")
}
```

#### Uses
- [Functions › Default values](#/functions/default-values)
- [Functions › Two names for every parameter](#/functions/two-names-for-every-parameter)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- Build the answer in a `var out = ""` and loop `for i in 0..<times`.
- Add the separator before every copy except the first: `if i > 0 { out += separator }`.
- The `times: 0` case falls out of the loop never running, as long as you start from an empty string.

#### Tips
- `String(repeating: "ab", count: 3)` exists for the no-separator case. It is the right tool when there is nothing to put between the copies.
- `repeated("", times: 3, separator: ",")` is `",,"` — three empty copies and two separators. If you get `",,,"` you are adding the separator after every copy instead of before every copy but the first.

#### Docs
- [Default parameter values](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#Default-Parameter-Values)

### 2. Quotient and remainder

`divide(_:by:)` returns both results of an integer division as a named tuple. The divisor is never zero. Swift truncates toward zero and the remainder takes the sign of the dividend, so `divide(-7, by: 2)` is `(-3, -1)`, and `quotient * divisor + remainder` always gives back the dividend.

```swift starter
func divide(_ dividend: Int, by divisor: Int) -> (quotient: Int, remainder: Int) {
    return (0, 0)
}
```

```swift test
/// divides evenly and unevenly
func testBasic() {
    let a = divide(7, by: 2)
    expect(a.quotient, 3)
    expect(a.remainder, 1)
    let b = divide(10, by: 5)
    expect(b.quotient, 2)
    expect(b.remainder, 0)
}

/// negative dividends truncate toward zero
func testNegativeDividend() {
    let a = divide(-7, by: 2)
    expect(a.quotient, -3)
    expect(a.remainder, -1)
    let b = divide(-9, by: 3)
    expect(b.quotient, -3)
    expect(b.remainder, 0)
}

/// negative divisors
func testNegativeDivisor() {
    let a = divide(7, by: -2)
    expect(a.quotient, -3)
    expect(a.remainder, 1)
    let b = divide(-7, by: -2)
    expect(b.quotient, 3)
    expect(b.remainder, -1)
}

/// the parts always rebuild the dividend
func testInvariant() {
    for (n, d) in [(17, 5), (-17, 5), (17, -5), (0, 7), (3, 11)] {
        let r = divide(n, by: d)
        expect(r.quotient * d + r.remainder, n)
    }
}
```

#### Uses
- [Functions › Returning a tuple](#/functions/returning-a-tuple)
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)
- [Reference › Numbers](#/reference/numbers)

#### Hints
- `/` and `%` already behave exactly as described; you are packaging them, not reimplementing them.
- Return them in one expression: `(dividend / divisor, dividend % divisor)`.

#### Tips
- `17.quotientAndRemainder(dividingBy: 5)` in the standard library returns the same pair. Knowing the operators agree with it is the point of the last test.
- The last test is the real specification: `q * d + r == n` for every combination of signs. That identity is what "truncates toward zero" means, written out.

#### Docs
- [Functions with multiple return values](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#Functions-with-Multiple-Return-Values)

### 3. Clamp in place

`clamp(_:to:)` pulls a variable into a range: below the lower bound it becomes the lower bound, above the upper bound it becomes the upper bound. It changes the caller's variable through an `inout` parameter and returns `true` only when it actually changed it. A value already inside the range, including one sitting exactly on a bound, is left alone.

```swift starter
func clamp(_ value: inout Int, to range: ClosedRange<Int>) -> Bool {
    return false
}
```

```swift test
/// pulls values inside the range
func testClamps() {
    var high = 15
    expect(clamp(&high, to: 0...10), true)
    expect(high, 10)
    var low = -3
    expect(clamp(&low, to: 0...10), true)
    expect(low, 0)
}

/// leaves values that are already inside
func testInside() {
    var mid = 5
    expect(clamp(&mid, to: 0...10), false)
    expect(mid, 5)
    var other = 7
    expect(clamp(&other, to: -100...100), false)
    expect(other, 7)
}

/// the bounds themselves are inside
func testBounds() {
    var lower = 0
    expect(clamp(&lower, to: 0...10), false)
    expect(lower, 0)
    var upper = 10
    expect(clamp(&upper, to: 0...10), false)
    expect(upper, 10)
}

/// a range of one value
func testSingleValue() {
    var big = 9
    expect(clamp(&big, to: 5...5), true)
    expect(big, 5)
    var exact = 5
    expect(clamp(&exact, to: 5...5), false)
    expect(exact, 5)
}

/// negative ranges
func testNegativeRange() {
    var n = 0
    expect(clamp(&n, to: -10 ... -2), true)
    expect(n, -2)
    var m = -20
    expect(clamp(&m, to: -10 ... -2), true)
    expect(m, -10)
}
```

#### Uses
- [Functions › `inout` parameters](#/functions/inout-parameters)
- [Control flow › `if` and `else`](#/control-flow/if-and-else)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- A `ClosedRange` gives you `range.lowerBound` and `range.upperBound`.
- Two `if`s: below the lower bound, assign it and return `true`; above the upper bound, the same. Otherwise return `false`.
- `range.contains(value)` is another way to write the "already inside" test.

#### Tips
- Inside the function `value` behaves like a normal `var`; the copy is written back to the caller's variable when the function returns.
- A value already sitting on a bound returns `false`. Nothing changed, so nothing was clamped — `clamp(&lower, to: 0...10)` with `lower` at 0 is not a clamp.
- `range.lowerBound`, `range.upperBound` and `range.contains(value)` all come from a range being an ordinary value you can ask questions of.

#### Docs
- [In-out parameters](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#In-Out-Parameters)

### 4. Greatest common divisor

`gcd(_:_:)` returns the largest number that divides both arguments, using Euclid's algorithm: the gcd of `a` and `b` is the gcd of `b` and `a % b`, until the second number is zero. Signs do not matter, so `gcd(-12, 18)` is 6, and `gcd(0, 0)` is 0.

```swift starter
func gcd(_ a: Int, _ b: Int) -> Int {
    return 1
}
```

```swift test
/// common divisors
func testCommon() {
    expect(gcd(12, 18), 6)
    expect(gcd(18, 12), 6)
    expect(gcd(270, 192), 6)
    expect(gcd(48, 18), 6)
}

/// coprime numbers share only 1
func testCoprime() {
    expect(gcd(7, 13), 1)
    expect(gcd(9, 28), 1)
    expect(gcd(1, 999), 1)
}

/// zero divides into anything
func testZero() {
    expect(gcd(0, 5), 5)
    expect(gcd(5, 0), 5)
    expect(gcd(0, 0), 0)
}

/// signs are ignored
func testSigns() {
    expect(gcd(-12, 18), 6)
    expect(gcd(12, -18), 6)
    expect(gcd(-12, -18), 6)
    expect(gcd(-7, 0), 7)
}
```

#### Uses
- [Functions › Recursion and nested functions](#/functions/recursion-and-nested-functions)
- [Control flow › `if` and `else`](#/control-flow/if-and-else)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)
- [Reference › Numbers](#/reference/numbers)

#### Hints
- The base case is `b == 0`, where the answer is `a`.
- Otherwise `return gcd(b, a % b)`. The second argument shrinks every call, so it always reaches zero.
- Handle the signs once at the top with `abs`, or let a nested function do the recursion on the absolute values.

#### Tips
- The same algorithm as a loop: `while b != 0 { (a, b) = (b, a % b) }`. Tuple assignment swaps both at once, with no temporary variable.
- `gcd(0, 0)` is 0 with no special handling: `b` is already zero, so the base case returns `a`, which is also zero.

#### Docs
- [Recursion in the Swift book](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#Function-Types)

### 5. Count what matches

`count(in:where:)` walks a closed range and counts the numbers for which the function it is handed returns `true`. The function is an ordinary parameter of type `(Int) -> Bool`, so the caller passes a function by name.

```swift starter
func count(in range: ClosedRange<Int>, where matches: (Int) -> Bool) -> Int {
    return 0
}
```

```swift test
func isEven(_ n: Int) -> Bool { n % 2 == 0 }
func isNegative(_ n: Int) -> Bool { n < 0 }
func always(_ n: Int) -> Bool { true }
func never(_ n: Int) -> Bool { false }

/// counts matches in a range
func testCounts() {
    expect(count(in: 1...10, where: isEven), 5)
    expect(count(in: 1...9, where: isEven), 4)
    expect(count(in: -3...3, where: isNegative), 3)
}

/// ranges that include one value
func testSingleValue() {
    expect(count(in: 4...4, where: isEven), 1)
    expect(count(in: 5...5, where: isEven), 0)
}

/// all or nothing
func testAllOrNothing() {
    expect(count(in: 1...100, where: always), 100)
    expect(count(in: 1...100, where: never), 0)
    expect(count(in: -5...5, where: always), 11)
}

/// the range's bounds are both counted
func testBoundsIncluded() {
    expect(count(in: 2...8, where: isEven), 4)
    expect(count(in: -4 ... -2, where: isEven), 2)
}
```

#### Uses
- [Functions › Functions are values](#/functions/functions-are-values)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- `for n in range` iterates a `ClosedRange<Int>` just like a range written inline.
- Call the parameter like any other function: `if matches(n) { total += 1 }`.
- `matches` is the name inside the body; `where` is only the label the caller writes.

#### Tips
- A function that takes another function is the whole idea behind `map`, `filter` and `sorted(by:)`. Later modules pass those an inline closure instead of a named function, but the parameter type is the same.
- `where` is the label the caller writes and `matches` is the name the body uses. This is the smallest example of why Swift gives every parameter two names.

#### Docs
- [Function types as parameter types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#Function-Types-as-Parameter-Types)
