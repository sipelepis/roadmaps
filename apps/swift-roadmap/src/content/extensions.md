# Extensions

An extension adds behaviour to a type that already exists — one you wrote, one from the standard library, or one from a package you cannot edit. There is no subclassing involved and no wrapper type: the methods you add are called exactly like the ones that shipped with the type.

Extensions are also how most Swift code is organised. Rather than one enormous type declaration, you write a small type and then a series of focused extensions: one per protocol it conforms to, one per group of related helpers.

## What an extension adds

An extension can add computed properties, instance and type methods, initializers, subscripts, nested types, and protocol conformances. It cannot add a stored property, and it cannot override something the type already has — an extension only ever adds.

```swift
extension Int {
    var squared: Int { self * self }
    func clamped(to range: ClosedRange<Int>) -> Int {
        min(max(self, range.lowerBound), range.upperBound)
    }
}

3.squared            // 9
15.clamped(to: 0...10)   // 10
```

Inside an extension, `self` is the value, exactly as it is inside the original type.

## Extending types from the standard library

The type does not have to be yours. `Int`, `String`, `Array` and every protocol in the standard library can be extended, which is how you get vocabulary that fits your problem instead of adapting your problem to the vocabulary that exists.

```swift
extension String {
    var isBlank: Bool { allSatisfy { $0.isWhitespace } }
}

"   ".isBlank   // true
```

A method that changes a value type has to say `mutating`, just as it would in the original declaration.

## Adding initializers

An extension can add a convenience initializer — including a failable one — which is the clean way to build a type from some other representation without adding a free function.

```swift
extension Int {
    init?(binary text: String) {
        guard let n = Int(text, radix: 2) else { return nil }
        self = n
    }
}

Int(binary: "1011")   // Optional(11)
```

For a struct, adding an initializer in an extension rather than in the declaration keeps the memberwise initializer the compiler generates for you.

## Conformance in an extension

Conformance is usually declared in its own extension, which keeps each protocol's requirements together and lets the reader see at a glance what a type does.

```swift
struct Point { let x: Int, y: Int }

extension Point: CustomStringConvertible {
    var description: String { "(\(x), \(y))" }
}
```

## Protocol extensions

An extension on a *protocol* gives every conforming type a default implementation. This is what makes Swift protocol-oriented rather than merely interface-oriented: the protocol carries behaviour, not only requirements.

```swift
protocol Named {
    var first: String { get }
    var last: String { get }
    var full: String { get }
}

extension Named {
    var full: String { "\(first) \(last)" }
}
```

Any type that conforms now gets `full` for free, and a type that defines its own `full` uses that instead. A default only applies where the conformer is silent.

## Constrained extensions

`where` restricts an extension to the cases where the added code makes sense. The members only exist when the constraint holds, so the compiler stops a meaningless call before it runs.

```swift
extension Array where Element: Numeric {
    var total: Element { reduce(.zero, +) }
}

[1, 2, 3].total    // 6
// ["a"].total     // does not compile: String is not Numeric
```

The same `where` works on protocol extensions (`extension Collection where Element: Equatable`) and is how the standard library gives `Array` a different set of abilities depending on what it holds.

```swift playground
extension Int {
    var squared: Int { self * self }
    var isEven: Bool { self % 2 == 0 }

    init?(binary text: String) {
        guard let n = Int(text, radix: 2) else { return nil }
        self = n
    }
}

extension String {
    var isBlank: Bool { allSatisfy { $0.isWhitespace } }
    func repeated(_ times: Int) -> String { String(repeating: self, count: max(0, times)) }
}

print((1...6).map(\.squared))
print((1...6).filter(\.isEven))
print(Int(binary: "1011") as Any, Int(binary: "nope") as Any)
print("  ".isBlank, "x".isBlank)
print("ab".repeated(3))

// A protocol extension hands every conformer a default.
protocol Named {
    var first: String { get }
    var last: String { get }
    var full: String { get }
}

extension Named {
    var full: String { "\(first) \(last)" }
}

struct Person: Named { let first: String, last: String }
struct Monarch: Named {
    let first: String, last: String
    var full: String { "\(first) of \(last)" }   // silences the default
}

print(Person(first: "Ada", last: "Lovelace").full)
print(Monarch(first: "Elizabeth", last: "England").full)

// A constrained extension only exists where the constraint holds.
extension Array where Element: Numeric {
    var total: Element { reduce(.zero, +) }
}

print([1, 2, 3].total, [0.5, 0.25].total)
```

## Exercises

### 1. Digits of an Int

Extend `Int` with two members. `digits` is the base-10 digits of the number's absolute value, most significant first: `123` gives `[1, 2, 3]`, `-45` gives `[4, 5]`, and `0` gives `[0]`. `isPalindrome` is `true` when those digits read the same in both directions, but a negative number is never a palindrome.

```swift starter
extension Int {
    var digits: [Int] {
        return []
    }

    var isPalindrome: Bool {
        return false
    }
}
```

```swift test
/// splits a number into digits
func testDigits() {
    expect(123.digits, [1, 2, 3])
    expect(7.digits, [7])
    expect(1_000.digits, [1, 0, 0, 0])
}

/// zero and negatives
func testEdges() {
    expect(0.digits, [0])
    expect((-45).digits, [4, 5])
    expect((-9).digits, [9])
}

/// palindromes read the same both ways
func testPalindrome() {
    expect(121.isPalindrome, true)
    expect(1221.isPalindrome, true)
    expect(7.isPalindrome, true)
    expect(0.isPalindrome, true)
}

/// non-palindromes, including negatives
func testNotPalindrome() {
    expect(123.isPalindrome, false)
    expect(10.isPalindrome, false)
    expect((-121).isPalindrome, false)
    expect((-1).isPalindrome, false)
}
```

#### Uses
- [Extensions › What an extension adds](#/extensions/what-an-extension-adds)
- [Extensions › Extending types from the standard library](#/extensions/extending-types-from-the-standard-library)

#### Hints
- Peel digits off the end with `% 10` and `/ 10` in a loop, then reverse; or go the short way with `String(abs(self)).compactMap { $0.wholeNumberValue }`.
- Zero needs its own answer: a `while n > 0` loop produces nothing for `0`.
- `isPalindrome` is `self >= 0 && digits == digits.reversed()`.

#### Tips
- `digits.reversed()` returns a `ReversedCollection`, not an `Array`, but `==` against an `[Int]` still works because both are collections of `Int`.
- `(-45).digits` needs the brackets. `-45.digits` parses as `-(45.digits)` and does not compile.

#### Docs
- [Extensions](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/extensions/)

### 2. Two String helpers

Extend `String` with `wordCount`, the number of runs of non-whitespace characters (`"a  b"` is 2, `"   "` is 0), and `truncated(to:)`, which returns the string unchanged when it is `n` characters or fewer and otherwise keeps the first `n` characters and appends `"…"`. `n` is never negative.

```swift starter
extension String {
    var wordCount: Int {
        return 0
    }

    func truncated(to n: Int) -> String {
        return self
    }
}
```

```swift test
/// counts words
func testWordCount() {
    expect("hello world".wordCount, 2)
    expect("one".wordCount, 1)
    expect("a b c d".wordCount, 4)
}

/// runs of whitespace do not create empty words
func testWhitespace() {
    expect("a  b".wordCount, 2)
    expect("  padded  ".wordCount, 1)
    expect("".wordCount, 0)
    expect("     ".wordCount, 0)
}

/// short strings are untouched
func testNoTruncation() {
    expect("hello".truncated(to: 10), "hello")
    expect("hello".truncated(to: 5), "hello")
    expect("".truncated(to: 0), "")
}

/// long strings get the first n characters and an ellipsis
func testTruncation() {
    expect("hello world".truncated(to: 5), "hello…")
    expect("abcdef".truncated(to: 1), "a…")
    expect("abc".truncated(to: 0), "…")
}
```

#### Uses
- [Extensions › Extending types from the standard library](#/extensions/extending-types-from-the-standard-library)
- [Extensions › What an extension adds](#/extensions/what-an-extension-adds)

#### Hints
- `split(whereSeparator: \.isWhitespace)` drops empty pieces by default, so its `count` is the word count.
- `count <= n` is the "leave it alone" case; otherwise `String(prefix(n)) + "…"`.
- `prefix(n)` returns a `Substring`, so wrap it in `String(...)` before concatenating.

#### Tips
- `"…"` is one `Character`, not three dots. Copy it from the description rather than typing `...`.
- `truncated(to: 0)` on any non-empty string is `"…"`, and on `""` it is `""`. Testing `count <= n` first is what makes both come out right.

#### Docs
- [split(whereSeparator:)](https://developer.apple.com/documentation/swift/sequence/split(maxsplits:omittingemptysubsequences:whereseparator:))

### 3. A default price format

`Priced` requires `cents` and `display`. Fill in the protocol extension so that every conforming type gets a `display` for free: a dollar sign, the whole dollars, a point, and exactly two digits of cents — `1234` is `"$12.34"`, `5` is `"$0.05"`, `0` is `"$0.00"`. A negative amount puts the sign first: `-5` is `"-$0.05"`. `FreeSample` defines its own `display` and must keep it.

```swift starter
protocol Priced {
    var cents: Int { get }
    var display: String { get }
}

extension Priced {
    var display: String {
        return ""
    }
}

struct Coffee: Priced {
    let cents: Int
}

struct FreeSample: Priced {
    let cents = 0
    var display: String { "free" }
}
```

```swift test
struct Tea: Priced {
    let cents: Int
}

/// formats dollars and cents
func testFormats() {
    expect(Coffee(cents: 1234).display, "$12.34")
    expect(Coffee(cents: 350).display, "$3.50")
    expect(Coffee(cents: 100).display, "$1.00")
}

/// small and zero amounts keep two digits
func testSmall() {
    expect(Coffee(cents: 5).display, "$0.05")
    expect(Coffee(cents: 40).display, "$0.40")
    expect(Coffee(cents: 0).display, "$0.00")
}

/// negatives put the sign in front of the dollar
func testNegative() {
    expect(Coffee(cents: -5).display, "-$0.05")
    expect(Coffee(cents: -1234).display, "-$12.34")
}

/// the default reaches any conforming type
func testOtherTypes() {
    expect(Tea(cents: 275).display, "$2.75")
    expect(Tea(cents: 9).display, "$0.09")
}

/// a type that defines display keeps its own
func testOverride() {
    expect(FreeSample().display, "free")
    expect(Coffee(cents: 0).display, "$0.00")
}
```

#### Uses
- [Extensions › Protocol extensions](#/extensions/protocol-extensions)
- [Extensions › Conformance in an extension](#/extensions/conformance-in-an-extension)

#### Hints
- Work with the magnitude first: `let n = abs(cents)`, then `n / 100` and `n % 100`.
- Pad the cents to two digits with `String(format: "%02d", n % 100)`, or by hand with a leading `"0"` when the remainder is below 10.
- The sign is a prefix: `cents < 0 ? "-" : ""` in front of the whole thing.

#### Tips
- Defaults in a protocol extension are only defaults. Because `display` is also a requirement of the protocol, `FreeSample`'s own version wins wherever the value is used — including through a `Priced` variable.
- Take `abs(cents)` first, then split. Dividing a negative by 100 gives `0` for anything above `-100`, so the dollars and the sign have to be worked out separately.

#### Docs
- [Protocol extensions](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/#Protocol-Extensions)

### 4. Uniqued, where it makes sense

Add `uniqued()` and `count(of:)` to `Array`, but only for arrays whose elements are `Hashable`. `uniqued()` removes later duplicates and keeps the first occurrence of each element in its original position. `count(of:)` returns how many times a value appears.

```swift starter
extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        return []
    }

    func count(of value: Element) -> Int {
        return 0
    }
}
```

```swift test
/// drops duplicates, keeps first-seen order
func testUniqued() {
    expect([1, 2, 1, 3, 2].uniqued(), [1, 2, 3])
    expect([3, 1, 2].uniqued(), [3, 1, 2])
    expect(["b", "a", "b", "b"].uniqued(), ["b", "a"])
}

/// empty and all-the-same
func testUniquedEdges() {
    expect([Int]().uniqued(), [])
    expect([7, 7, 7].uniqued(), [7])
    expect([0, 0, 1, 0].uniqued(), [0, 1])
}

/// counts occurrences
func testCountOf() {
    expect([1, 2, 1, 3, 1].count(of: 1), 3)
    expect([1, 2, 1].count(of: 2), 1)
    expect(["a", "b"].count(of: "a"), 1)
}

/// missing values count zero
func testCountMissing() {
    expect([1, 2, 3].count(of: 9), 0)
    expect([Int]().count(of: 1), 0)
    expect(["a"].count(of: "z"), 0)
}
```

#### Uses
- [Extensions › Constrained extensions](#/extensions/constrained-extensions)
- [Reference › Array, Set and Dictionary](#/reference/array-set-and-dictionary)
- [Extensions › Extending types from the standard library](#/extensions/extending-types-from-the-standard-library)

#### Hints
- Keep a `var seen = Set<Element>()` and append only when `seen.insert(element).inserted` is `true`.
- `Set(self)` alone loses the order, which is exactly what the tests check for.
- `count(of:)` is `filter { $0 == value }.count`, or `reduce(0) { $1 == value ? $0 + 1 : $0 }`.

#### Tips
- The `where Element: Hashable` is what lets you build a `Set` at all. Without it the extension would not compile, and that is the point of a constrained extension: the code exists only where its requirements hold.
- `Set(self)` is one line and wrong: it loses the order the tests check. The set is for membership; the array you build is the result.

#### Docs
- [Set.insert](https://developer.apple.com/documentation/swift/set/insert(_:))
- [Extensions with a generic where clause](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/generics/#Extensions-with-a-Generic-Where-Clause)
