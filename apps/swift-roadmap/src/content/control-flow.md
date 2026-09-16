# Control flow

Swift's `if`, `for` and `while` look like every other C-family language, with two differences worth knowing on day one: a condition must be an actual `Bool`, and `switch` is exhaustive, does not fall through, and matches far more than single values.

## `if` and `else`

Parentheses around the condition are optional and usually left out. Braces are not optional, even for a single statement.

```swift
let temperature = 31

if temperature > 30 {
    print("hot")
} else if temperature > 15 {
    print("mild")
} else {
    print("cold")
}
```

The condition has to be a `Bool`. Swift has no truthiness, so an `Int`, a `String` or a nil check never stands in for one: `if name` is an error, `if !name.isEmpty` is what you meant.

## `switch` is exhaustive

A `switch` must handle every possible value, which for an `Int` means you need a `default`. In exchange, cases do not fall through — no `break` at the end of each one — and a case can list several patterns separated by commas.

```swift
let code = 3

switch code {
case 0:
    print("ok")
case 1, 2:
    print("retry")
default:
    print("unknown code \(code)")
}
```

An empty case body is a compile error, so a case that deliberately does nothing says `break`. If you really want the next case's body to run as well, the keyword is `fallthrough`, and you have to ask for it.

## Matching ranges, tuples and `where`

Patterns are the real reason to use `switch`. A case can be a range, a tuple of patterns, or a pattern with an extra condition attached by `where`. Binding with `let` inside a case captures the matched value.

```swift
let point = (2, 0)

switch point {
case (0, 0):
    print("origin")
case (let x, 0):
    print("on the x axis at \(x)")
case (0, _):
    print("on the y axis")
case (let x, let y) where x == y:
    print("on the diagonal")
default:
    print("somewhere else")
}
```

Ranges cover the numeric cases that would otherwise be a stack of `else if`s: `case 0..<60:` is every score below 60, and `case 90...100:` includes both ends. `..<` excludes its upper bound, `...` includes it. Cases are tried top to bottom, so put the specific ones first.

## `if` and `switch` as expressions

Since Swift 5.9 an `if` or a `switch` can produce a value directly, as long as every branch yields one. It saves declaring a `var` and assigning into it from each branch.

```swift
let score = 84
let letter = switch score {
case 90...100: "A"
case 80..<90: "B"
default: "F"
}
```

The same works for `if`: `let label = if count == 1 { "item" } else { "items" }`.

## `for` and ranges

`for … in` walks anything sequenceable, and the most common thing to walk is a range.

```swift
for i in 1...3 { print(i) }          // 1, 2, 3
for i in 0..<3 { print(i) }          // 0, 1, 2
for _ in 0..<3 { print("again") }    // the value isn't needed
for i in stride(from: 10, to: 0, by: -2) { print(i) }   // 10, 8, 6, 4, 2
```

`1...3` is a value of its own, a `ClosedRange<Int>`, and you can pass one around like any other value. A range written backwards, like `3...1`, traps at runtime; count down with `(1...3).reversed()` or `stride`.

Being a value, a range answers questions about itself, which is what makes it useful as a function parameter:

```swift
let allowed = 0...10
allowed.lowerBound        // 0
allowed.upperBound        // 10
allowed.contains(10)      // true — `...` includes its upper bound
allowed.count             // 11
(0..<10).upperBound       // 10, but `contains(10)` is false
```

`ClosedRange<Int>` (from `...`) and `Range<Int>` (from `..<`) are two different types. A function that takes one will not accept the other, so pick the one whose end behaviour you mean.

A `for` can carry a `where` clause, which skips the passes that do not match:

```swift
for n in 1...20 where n % 7 == 0 { print(n) }   // 7, 14
```

## `while` and `repeat`

Use `while` when the number of passes is not known in advance, and `repeat … while` when the body must run at least once.

```swift
var n = 27
var steps = 0
while n != 1 {
    n = n % 2 == 0 ? n / 2 : 3 * n + 1
    steps += 1
}

repeat {
    steps -= 1
} while steps > 100
```

The condition is checked before the first pass of a `while` and after the first pass of a `repeat`.

## `break`, `continue` and labels

`continue` skips to the next pass of the innermost loop, `break` leaves it altogether. When the loop you want to affect is not the innermost one, label it and name the label.

```swift
candidates: for n in 2...30 {
    for divisor in 2..<n where n % divisor == 0 {
        continue candidates          // not prime: go to the next n
    }
    print(n, terminator: " ")
}
```

Without the label, `continue` would restart the inner divisor loop and the outer one would carry on to the `print` anyway. `break` inside a `switch` leaves only the `switch`, so a label is the way to break out of a loop from inside one.

```swift playground
func grade(_ score: Int) -> String {
    switch score {
    case 90...100: "A"
    case 80..<90: "B"
    case 70..<80: "C"
    case 0..<70: "F"
    default: "invalid"
    }
}

for score in stride(from: 100, through: 55, by: -15) {
    print("\(score) -> \(grade(score))")
}

var n = 27
var steps = 0
while n != 1 {
    n = n % 2 == 0 ? n / 2 : 3 * n + 1
    steps += 1
}
print("27 reaches 1 in \(steps) steps")

var primes = ""
candidates: for candidate in 2...30 {
    for divisor in 2..<candidate where candidate % divisor == 0 {
        continue candidates
    }
    primes += "\(candidate) "
}
print("primes up to 30: \(primes)")

// Try: add `case 101...:` to the switch, or drop the `default` and read the error.
```

## Exercises

### 1. Letter grade

`grade(_:)` turns a score into a letter with a `switch`: 90 and above is `"A"`, 80 to 89 is `"B"`, 70 to 79 is `"C"`, 60 to 69 is `"D"`, and anything from 0 to 59 is `"F"`. A score outside 0...100 is `"invalid"`.

```swift starter
func grade(_ score: Int) -> String {
    return "F"
}
```

```swift test
/// grades the middle of each band
func testBands() {
    expect(grade(95), "A")
    expect(grade(85), "B")
    expect(grade(75), "C")
    expect(grade(65), "D")
    expect(grade(30), "F")
}

/// the lower edge of a band belongs to it
func testLowerEdges() {
    expect(grade(90), "A")
    expect(grade(80), "B")
    expect(grade(70), "C")
    expect(grade(60), "D")
    expect(grade(0), "F")
}

/// one below an edge drops a letter
func testJustBelow() {
    expect(grade(89), "B")
    expect(grade(79), "C")
    expect(grade(69), "D")
    expect(grade(59), "F")
}

/// out of range scores are invalid
func testInvalid() {
    expect(grade(101), "invalid")
    expect(grade(-1), "invalid")
    expect(grade(1000), "invalid")
    expect(grade(100), "A")
}
```

#### Uses
- [Control flow › Matching ranges, tuples and `where`](#/control-flow/matching-ranges-tuples-and-where)
- [Control flow › `switch` is exhaustive](#/control-flow/switch-is-exhaustive)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- One case per band: `case 90...100:` then `case 80..<90:` and so on.
- `...` includes its upper bound and `..<` excludes it, which is exactly the difference between 80...89 and 80..<90.
- Every other score is handled by `default`, which is where `"invalid"` belongs.

#### Tips
- Because cases are tried in order, `case 90...:` (a one-sided range) works too once you have already ruled out scores above 100.
- If the ordering feels fiddly, rule the invalid scores out first: `guard (0...100).contains(score) else { return "invalid" }` leaves five clean bands behind it.
- A `switch` used as an expression needs every branch to produce a value, and no `return` in any of them. Mixing the two styles is the usual first compile error here.

#### Docs
- [Switch](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/controlflow/#Switch)
- [Range operators](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/basicoperators/#Range-Operators)

### 2. One FizzBuzz word

`fizzBuzzWord(_:)` returns `"Fizz"` if the number divides by 3, `"Buzz"` if it divides by 5, `"FizzBuzz"` if both, and otherwise the number itself as a string. Zero divides by everything, so it is `"FizzBuzz"`, and negative numbers follow the same rule.

```swift starter
func fizzBuzzWord(_ n: Int) -> String {
    return "Fizz"
}
```

```swift test
/// the three special cases
func testSpecials() {
    expect(fizzBuzzWord(3), "Fizz")
    expect(fizzBuzzWord(5), "Buzz")
    expect(fizzBuzzWord(15), "FizzBuzz")
    expect(fizzBuzzWord(9), "Fizz")
    expect(fizzBuzzWord(20), "Buzz")
}

/// everything else is the number
func testPlainNumbers() {
    expect(fizzBuzzWord(1), "1")
    expect(fizzBuzzWord(7), "7")
    expect(fizzBuzzWord(98), "98")
}

/// zero divides by both
func testZero() {
    expect(fizzBuzzWord(0), "FizzBuzz")
}

/// negatives follow the same rule
func testNegatives() {
    expect(fizzBuzzWord(-9), "Fizz")
    expect(fizzBuzzWord(-10), "Buzz")
    expect(fizzBuzzWord(-30), "FizzBuzz")
    expect(fizzBuzzWord(-7), "-7")
}
```

#### Uses
- [Control flow › Matching ranges, tuples and `where`](#/control-flow/matching-ranges-tuples-and-where)
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- Switch on the pair of remainders: `switch (n % 3, n % 5)`.
- `case (0, 0):` is both, `case (0, _):` is only Fizz, `case (_, 0):` is only Buzz. Order matters.
- The `default` case interpolates the number: `"\(n)"`.

#### Tips
- `-9 % 3` is 0 and `-10 % 5` is 0, so the negatives fall out of the same code. The remainder only takes the sign of the left operand when it isn't zero.
- The `default` branch is one interpolation: `"\(n)"`. `String(n)` works too; the interpolation is what Swift code looks like.

#### Docs
- [Tuple patterns](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/patterns/#Tuple-Pattern)

### 3. Multiples of 3 or 5

`sumOfMultiples(below:)` adds up every positive number below the limit that divides by 3 or by 5, counting each such number once. Below 10 that is 3 + 5 + 6 + 9 = 23. A limit of 1 or less has nothing to add, so the answer is 0.

```swift starter
func sumOfMultiples(below limit: Int) -> Int {
    return 23
}
```

```swift test
/// the classic answers
func testKnown() {
    expect(sumOfMultiples(below: 10), 23)
    expect(sumOfMultiples(below: 16), 60)
    expect(sumOfMultiples(below: 100), 2318)
}

/// the limit itself is excluded
func testExclusive() {
    expect(sumOfMultiples(below: 3), 0)
    expect(sumOfMultiples(below: 4), 3)
    expect(sumOfMultiples(below: 6), 8)
}

/// numbers divisible by both are counted once
func testNoDoubleCount() {
    expect(sumOfMultiples(below: 16), 60)
    expect(sumOfMultiples(below: 31), 225)
}

/// nothing to add
func testEmptyRange() {
    expect(sumOfMultiples(below: 1), 0)
    expect(sumOfMultiples(below: 0), 0)
    expect(sumOfMultiples(below: -5), 0)
}
```

#### Uses
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)
- [Control flow › `break`, `continue` and labels](#/control-flow/break-continue-and-labels)
- [Variables & types › `let` and `var`](#/basics/let-and-var)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- Keep a running `var total = 0` and add to it inside the loop.
- `for n in 1..<limit` already excludes the limit. It is also empty when `limit` is 1 or less, which handles the last test for free.
- Add when `n % 3 == 0 || n % 5 == 0`. One `if` with an `||` counts 15 once; two separate `if`s would count it twice.

#### Tips
- `for n in 1..<limit where n % 3 == 0 || n % 5 == 0` moves the condition into the loop header and leaves a one-line body.
- One `if` with `||` counts 15 once. Two separate `if`s count it twice, and the `below: 16` test exists to catch exactly that.
- A negative limit makes `1..<limit` empty rather than backwards, so it needs no guard. `1...limit` would trap.

#### Docs
- [For-in loops](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/controlflow/#For-In-Loops)

### 4. Collatz steps

`collatzSteps(from:)` counts how many steps a number takes to reach 1: halve it when it is even, otherwise triple it and add one. Starting at 6 the path is 3, 10, 5, 16, 8, 4, 2, 1 — eight steps. Starting at 1 there is nothing to do, so the answer is 0. The argument is always 1 or more.

```swift starter
func collatzSteps(from start: Int) -> Int {
    return 0
}
```

```swift test
/// short paths
func testShort() {
    expect(collatzSteps(from: 2), 1)
    expect(collatzSteps(from: 4), 2)
    expect(collatzSteps(from: 8), 3)
}

/// mixed paths
func testMixed() {
    expect(collatzSteps(from: 6), 8)
    expect(collatzSteps(from: 7), 16)
    expect(collatzSteps(from: 27), 111)
}

/// one is already there
func testOne() {
    expect(collatzSteps(from: 1), 0)
}

/// odd starts climb before they fall
func testOddStarts() {
    expect(collatzSteps(from: 3), 7)
    expect(collatzSteps(from: 9), 19)
}
```

#### Uses
- [Control flow › `while` and `repeat`](#/control-flow/while-and-repeat)
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- You need two `var`s: the current number and the count of steps.
- `while current != 1 { … }` stops by itself when the number arrives, and never runs at all when it started there.
- Inside, `current = current % 2 == 0 ? current / 2 : 3 * current + 1`, then `steps += 1`.

#### Tips
- A `repeat … while` would be wrong here: it always runs the body once, so a start of 1 would report a step it never took.
- 27 takes 111 steps and climbs to 9232 on the way. It is in the tests because a subtly wrong loop still gets 2, 4 and 8 right.

#### Docs
- [While loops](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/controlflow/#While-Loops)

### 5. Count the primes

`primeCount(upTo:)` counts the prime numbers from 2 up to and including the limit. A prime has no divisor other than 1 and itself, so up to 10 there are four: 2, 3, 5 and 7. A limit below 2 gives 0.

```swift starter
func primeCount(upTo limit: Int) -> Int {
    return 4
}
```

```swift test
/// small limits
func testSmall() {
    expect(primeCount(upTo: 10), 4)
    expect(primeCount(upTo: 2), 1)
    expect(primeCount(upTo: 3), 2)
}

/// the limit counts when it is prime
func testInclusive() {
    expect(primeCount(upTo: 7), 4)
    expect(primeCount(upTo: 8), 4)
    expect(primeCount(upTo: 11), 5)
}

/// larger limits
func testLarger() {
    expect(primeCount(upTo: 30), 10)
    expect(primeCount(upTo: 100), 25)
}

/// nothing below two
func testBelowTwo() {
    expect(primeCount(upTo: 1), 0)
    expect(primeCount(upTo: 0), 0)
    expect(primeCount(upTo: -4), 0)
}
```

#### Uses
- [Control flow › `break`, `continue` and labels](#/control-flow/break-continue-and-labels)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)
- [Control flow › `if` and `else`](#/control-flow/if-and-else)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- Guard the empty case first: if `limit < 2` there is nothing to count, and `2...limit` would be a backwards range, which traps.
- Label the outer loop, `candidates: for n in 2...limit`, so the inner divisor loop can skip straight to the next candidate with `continue candidates`.
- A candidate that survives the inner loop is prime, so increment the count after it.

#### Tips
- Testing divisors up to `n - 1` is enough to be correct and plenty fast for these limits. Stopping at `divisor * divisor <= n` is the usual improvement.
- The guard on `limit < 2` is load-bearing, not tidiness: `2...limit` with a smaller limit is a backwards range, and a backwards range traps rather than being empty.
- `continue candidates` skips to the next candidate. A plain `continue` would restart the inner divisor loop, and the count would come out far too high.

#### Docs
- [Labeled statements](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/controlflow/#Labeled-Statements)
