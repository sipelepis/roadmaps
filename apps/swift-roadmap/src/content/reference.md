# Reference

A lookup page, not a step on the roadmap. It explains how the tests in this app work, and lists the standard-library and Foundation calls the exercises lean on, with a one-line sample for each. Read the module articles for the ideas; come here when an exercise uses a call you have not met.

Every sample below was compiled and run by the same `swiftc` the exercises use, and the results are what it printed.

## How the tests work

Every exercise has two editors. The left one holds your code. The right one holds the tests, and you do not edit it. Both are compiled together into a single file, so a name you declare on the left is visible on the right — and a name that clashes with one of the tests' own helpers is a compile error.

A test is a top-level function whose name starts with `test` and that takes no arguments:

```swift
/// doubles a number
func testDoubles() {
    expect(double(3), 6)
}
```

The `///` comment directly above a test is its label in the results panel. Without one, the label is made from the function name: `testNoLabel` shows as "no label".

### expect

Two functions are injected around your code. You never declare them.

- `expect<T: Equatable>(_ got: T, _ want: T)` — fails unless the two are equal. **`got` comes first**: in `expect(double(3), 7)` the result panel says `expected: 7`, `actual: 6`. Reading the arguments the other way round is the single most common source of confusion here.
- `expect(_ condition: Bool, _ message: String = "expected true")` — fails with that message when the condition is false. Use it when there is no value to compare, as in `expect(out.hasPrefix("Hello, "), "should start with 'Hello, '")`.

A test collects every failure it hits but reports only the **first** one, so fix them top down.

### async and throwing tests

A test may be `async`, `throws`, or both — the runner awaits every one of them:

```swift
/// counts a handful of calls
func testBasics() async {
    let t = Tally()
    await t.record("a")
    expect(await t.count(of: "a"), 1)
}
```

An error that escapes a `throws` test fails it with `threw <error>`.

### Traps end the run

A trap is not a failed assertion, it is the process dying. Force-unwrapping a `nil`, subscripting past the end of an array, a backwards range like `3...1`, integer overflow, `removeLast()` on an empty array — any of these stops everything.

The test that was running is blamed, with the message and the line it happened on (`tests line 30: Fatal error: Index out of range`), and every test after it reports `did not run`. So one trap can make four tests look broken when only one is.

### Other things worth knowing

- `import Foundation` is added for you in exercises, so `Data`, `JSONDecoder`, `replacingOccurrences` and the math functions are all available. The **playground** blocks in the articles get no such import — write it yourself there if you need it.
- Anything a test `print`s appears under that test's result, which is the quickest way to see what your code actually returned.
- The tests may declare their own helpers (`func caught(_:)`, `func close(_:_:)`) and their own types. Those are part of the specification; read them.

## Numbers

| call | what it does |
| --- | --- |
| `abs(_:)` | magnitude, same type back. `abs(-3)` is `3`, `abs(-2.5)` is `2.5`. |
| `max(_:_:)` / `min(_:_:)` | the larger or smaller of two `Comparable`s. `max(2, 9)` is `9`. |
| `Int.quotientAndRemainder(dividingBy:)` | both halves of a division as a labelled tuple. `17.quotientAndRemainder(dividingBy: 5)` is `(quotient: 3, remainder: 2)`; `(-7).quotientAndRemainder(dividingBy: 2)` is `(quotient: -3, remainder: -1)`. |
| `Int.isMultiple(of:)` | divisibility without a remainder test. `9.isMultiple(of: 3)` is `true`. |
| `Int(_:radix:)` | parse in another base, optional result. `Int("ff", radix: 16)` is `Optional(255)`. |
| `Double.rounded()` | nearest, halves away from zero. `(2.5).rounded()` is `3.0`. |
| `Double.pi` | `3.141592653589793`. |
| `Double.squareRoot()` | square root. `(2.0).squareRoot()` is `1.4142135623730951`. It is stdlib, but it still needs `import Foundation` here: without it the program fails to link. |
| `pow(_:_:)` | Foundation's power. `pow(2.0, 10.0)` is `1024.0`. |
| `Int.max` / `Int.min` | the bounds. `Int.max` is `9223372036854775807`, and `Int.max + 1` traps rather than wrapping. |
| `stride(from:to:by:)` | a sequence with a step, excluding the end. `Array(stride(from: 0, to: 10, by: 3))` is `[0, 3, 6, 9]`. |
| `stride(from:through:by:)` | the same, including the end. `Array(stride(from: 10, through: 0, by: -5))` is `[10, 5, 0]`. |

A range is an ordinary value with its own members: `(1...4).lowerBound` is `1`, `(1..<4).upperBound` is `4`, `(1...4).contains(4)` is `true`, and `(1...4).count` is `4`.

Docs: [Numbers and basic values](https://developer.apple.com/documentation/swift/numbers-and-basic-values), [Arithmetic operators](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/basicoperators/#Arithmetic-Operators)

## String and Character

Counting and searching:

```swift
"héllo".count              // 5 — Characters, not bytes
"👋".utf8.count            // 4
"Swift Roadmap".hasPrefix("Swift")   // true
"Swift Roadmap".hasSuffix("map")     // true
"Swift Roadmap".contains("Road")     // true
"Swift".lowercased()       // "swift"
"Swift".uppercased()       // "SWIFT"
```

Splitting and joining. `split` returns `Substring`s and drops empty pieces unless you say otherwise:

```swift
"a,b,,c".split(separator: ",")                              // ["a", "b", "c"]
"a,b,,c".split(separator: ",", omittingEmptySubsequences: false)  // ["a", "b", "", "c"]
"a  b".split(whereSeparator: \.isWhitespace)                // ["a", "b"]
["a", "b"].joined(separator: "-")                           // "a-b"
```

Taking parts. These take counts, not indices, and never trap:

```swift
"swift".prefix(2)          // "sw"
"swift".dropFirst(2)       // "ift"
String("abc".reversed())   // "cba"
String(repeating: "ab", count: 3)   // "ababab"
String([Character("h"), Character("i")])   // "hi"
```

Indices, for when you really need a position. `firstIndex(of:)` gives a `String.Index?`, and the two halves either side of it are slices:

```swift
let s = "a=b"
let i = s.firstIndex(of: "=")!
String(s[..<i])                        // "a"
String(s[s.index(after: i)...])        // "b"
s[s.index(s.startIndex, offsetBy: 2)]  // "b" — a Character
```

`Character` answers questions about itself. Note that `lowercased()` and `uppercased()` on a `Character` return a **`String`**, because a case change can change the length:

```swift
Character("7").isNumber          // true
Character("7").wholeNumberValue  // Optional(7)
Character("É").lowercased()      // "é" — a String
Character("ß").uppercased()      // "SS" — one Character in, two out
```

From Foundation, available in every exercise:

```swift
"1_000".replacingOccurrences(of: "_", with: "")   // "1000"
"  hi  ".trimmingCharacters(in: .whitespaces)     // "hi"
String(format: "%02d", 5)                         // "05"
Data("hi".utf8)                                   // 2 bytes, what JSONDecoder wants
String(decoding: Data("hi".utf8), as: UTF8.self)  // "hi"
```

Docs: [String](https://developer.apple.com/documentation/swift/string), [Character](https://developer.apple.com/documentation/swift/character), [Strings and characters](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/stringsandcharacters/)

## Array, Set and Dictionary

`Array` — ordered, indexed from zero, and subscripting out of range traps:

```swift
var a = [10, 20, 30]
a.append(40)               // [10, 20, 30, 40]
a.insert(5, at: 0)         // [5, 10, 20, 30, 40]
a.remove(at: 1)            // returns 10, the array closes the gap
a.removeFirst()            // returns the first element; traps when empty
a.popLast()                // Optional(40); nil when empty, never traps
a.first                    // Optional(5); nil when empty
Array([1, 2, 3, 4][1..<3])  // [2, 3] — slicing gives an ArraySlice
[Int](repeating: 0, count: 3)   // [0, 0, 0]
[1, 2, 3].contains(2)      // true
```

`Set` — unordered, each member once, constant-time membership. `insert` reports whether it did anything, which is the trick behind order-preserving deduplication:

```swift
var seen: Set<Int> = []
seen.insert(1).inserted    // true
seen.insert(1).inserted    // false — already there
Set([1, 2]).union([2, 3]).sorted()            // [1, 2, 3]
Set([1, 2, 3]).intersection([2, 3, 4]).sorted()  // [2, 3]
Set([1, 2, 3]).subtracting([2]).sorted()      // [1, 3]
```

`Dictionary` — a plain lookup gives an optional; the `default:` subscript reads, modifies and writes back in one step:

```swift
var counts: [String: Int] = [:]
counts["a", default: 0] += 1
counts["a", default: 0] += 1     // ["a": 2]
counts["zz"]                     // nil
["b": 1, "a": 2].keys.sorted()   // ["a", "b"]
["a": 1, "b": 2].values.reduce(0, +)   // 3
Dictionary(grouping: ["ant", "ape", "bee"], by: { $0.first! })
// ["a": ["ant", "ape"], "b": ["bee"]]
```

A `Set` and a `Dictionary` have no order at all, and the order they iterate in can differ between runs. Sort before you compare or print.

Docs: [Collection types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/collectiontypes/), [Array](https://developer.apple.com/documentation/swift/array), [Dictionary](https://developer.apple.com/documentation/swift/dictionary), [Set](https://developer.apple.com/documentation/swift/set)

## Sequence and Collection methods

These are defined on `Sequence` and `Collection`, so they work on arrays, sets, dictionaries, ranges and a string's characters alike. All of them return something new and leave the original alone.

Transforming:

```swift
let words = ["swift", "go", "rust"]
words.map { $0.count }        // [5, 2, 4]
words.map(\.count)            // the same, as a key path
words.filter { $0.count > 3 } // ["swift", "rust"]
[1, 2, 3, 4].reduce(0, +)     // 10
[1, 2, 3, 4].reduce(0) { $0 + $1 }   // the same, written out
["a", "b", "a"].reduce(into: [String: Int]()) { $0[$1, default: 0] += 1 }
// ["a": 2, "b": 1], in some order
["1", "two", "3"].compactMap { Int($0) }   // [1, 3] — drops the nils
[[1, 2], [3]].flatMap { $0 }               // [1, 2, 3] — flattens one level
```

`reduce` takes a starting value and a closure over `(running, next)`. The starting value is the answer for an empty collection, which is why `reduce(0, +)` on `[]` is `0` and `reduce(1, *)` is `1`.

Ordering and pairing:

```swift
words.sorted()                        // ["go", "rust", "swift"]
words.sorted { $0.count < $1.count }  // shortest first
words.sorted { ($0.count, $0) < ($1.count, $1) }   // with a tie-break
Array([1, 2, 3].reversed())           // [3, 2, 1]
Array(["a", "b"].enumerated())        // [(0, "a"), (1, "b")]
Array(zip([1, 2, 3], ["a", "b"]))     // [(1, "a"), (2, "b")] — stops at the shorter
```

Finding. Anything that might not find an answer returns an optional:

```swift
words.first { $0.hasPrefix("r") }   // Optional("rust")
words.firstIndex(of: "go")          // Optional(1)
words.firstIndex { $0.count == 4 }  // Optional(2)
words.contains { $0.count > 4 }     // true
words.allSatisfy { !$0.isEmpty }    // true — and true for an empty collection
[3, 1, 2].min()                     // Optional(1)
words.max { $0.count < $1.count }   // Optional("swift")
```

Taking parts. Asking for more than there is is not an error:

```swift
Array(words.prefix(2))     // ["swift", "go"]
Array(words.prefix(99))    // ["swift", "go", "rust"]
Array(words.dropLast())    // ["swift", "go"]
words.joined(separator: ", ")   // "swift, go, rust"
```

Docs: [Sequence](https://developer.apple.com/documentation/swift/sequence), [Collection](https://developer.apple.com/documentation/swift/collection)

## Optional

```swift
let maybe: Int? = nil
maybe ?? 0                          // 0 — the fallback, non-optional
("swift" as String?)?.uppercased()  // Optional("SWIFT")
(nil as String?)?.uppercased()      // nil, and nothing was called
(5 as Int?).map { $0 * 2 }          // Optional(10) — transform what is there
(0 as Int?).flatMap { $0 > 0 ? $0 : nil }   // nil — turn an unwanted value into nil
Int("42")                           // Optional(42)
Int("3.5")                          // nil
```

`if let name = value { }` unwraps for a block, `guard let name = value else { return }` unwraps for the rest of the scope, and both have the shorthand `if let value` / `guard let value` when the name stays the same. `value!` asserts it is there and traps when it is not.

A dictionary lookup inside an optional chain gives you a nested optional, `Int??`. `??` flattens one level, which is usually what you want.

Docs: [Optionals](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/optionals/), [Optional](https://developer.apple.com/documentation/swift/optional)

## Result and error handling

```swift
enum MyError: Error, Equatable { case bad(String) }

func risky(_ ok: Bool) throws -> Int {
    guard ok else { throw MyError.bad("no") }
    return 1
}
```

Calling it:

```swift
try? risky(true)    // Optional(1)
try? risky(false)   // nil — the error is discarded
try! risky(true)    // 1, and traps if it throws

do {
    _ = try risky(false)
} catch MyError.bad(let why) {
    print(why)                  // "no"
} catch {
    print("something else: \(error)")
}
```

A `do` must handle every error, so a bare `catch` at the end is usually required. Inside a bare `catch`, the error is bound to `error` for you.

`defer` runs on the way out of the scope, whichever way you leave it — return, break or throw. Deferred blocks run in reverse order of declaration:

```swift
func work() throws {
    print("open")
    defer { print("close") }      // prints even when the next line throws
    throw MyError.bad("x")
}
```

`Result<Success, Failure>` stores an outcome instead of raising it now:

```swift
let r = Result { try risky(true) }     // Result<Int, any Error>
try? r.get()                           // Optional(1)
try? r.map { $0 * 10 }.get()           // Optional(10)

switch Result({ try risky(false) }) {
case .success(let v): print(v)
case .failure(let e): print(e)         // bad("no")
}
```

`map`, `filter`, `compactMap` and friends are declared `rethrows`, which means they throw only if the closure you gave them does. That is why `try items.map { try parse($0) }` compiles.

Docs: [Error handling](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/errorhandling/), [Result](https://developer.apple.com/documentation/swift/result)

## Codable and JSON

`JSONEncoder` and `JSONDecoder` both speak `Data`, so the two conversions you write constantly are `Data(text.utf8)` and `String(decoding: data, as: UTF8.self)`.

```swift
struct User: Codable, Equatable {
    let id: Int
    let fullName: String
    enum CodingKeys: String, CodingKey { case id, fullName = "full_name" }
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
String(decoding: try encoder.encode(User(id: 1, fullName: "Ada")), as: UTF8.self)
// {"full_name":"Ada","id":1}

try JSONDecoder().decode(User.self, from: Data(#"{"id": 2, "full_name": "Grace"}"#.utf8))
// User(id: 2, fullName: "Grace")
```

Key order in JSON is not defined, and `JSONEncoder` promises none unless you ask for `.sortedKeys`. Never compare encoded JSON against a string literal without it.

Declaring `CodingKeys` replaces the synthesised one, so **every** property you want encoded has to appear as a case, not only the renamed ones. For a feed that is snake_case throughout, `decoder.keyDecodingStrategy = .convertFromSnakeCase` does the whole job without an enum.

A missing key is an error for a non-optional property. `decodeIfPresent` gives `nil` for an absent key and for a `null`, but still throws when the key is present with the wrong type:

```swift
init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    host = try c.decodeIfPresent(String.self, forKey: .host) ?? "localhost"
}
```

Failures arrive as `DecodingError`:

```swift
do {
    _ = try JSONDecoder().decode(User.self, from: Data(#"{"id": 1}"#.utf8))
} catch DecodingError.keyNotFound(let key, let context) {
    print(key.stringValue, context.codingPath.map(\.stringValue))   // full_name []
}
```

The four cases are `.keyNotFound(key, context)`, `.typeMismatch(type, context)`, `.valueNotFound(type, context)` and `.dataCorrupted(context)` — the last one covers both invalid JSON and an enum raw value that matches no case. Every `context` carries a `codingPath` naming the chain of keys down to the problem.

Docs: [Encoding and decoding custom types](https://developer.apple.com/documentation/foundation/archives-and-serialization/encoding-and-decoding-custom-types), [DecodingError](https://developer.apple.com/documentation/swift/decodingerror)

## Concurrency

`async` marks a function that may suspend, `await` marks each point where it does. Two `await`s in a row are sequential — overlapping takes `async let` or a group.

```swift
func slow(_ n: Int) async -> Int {
    try? await Task.sleep(for: .milliseconds(30))
    return n * 2
}

await slow(3)        // 6
```

`Task { }` starts work from anywhere; `task.value` awaits its result and `task.cancel()` asks it to stop. Cancellation is cooperative — nothing is killed, `Task.isCancelled` is a flag and the suspending calls throw `CancellationError`, which is why `try?` around a sleep is so common:

```swift
let t = Task { await slow(5) }
await t.value        // 10
```

`async let` starts a fixed number of children immediately and waits at the first `await` on the name:

```swift
async let a = slow(1)
async let b = slow(2)
"\(await a) \(await b)"   // "2 4", and both ran at the same time
```

A task group is for when the number of children depends on the input. `for await` yields results **as they finish**, so carry the index and write into a pre-sized array to get input order back:

```swift
func doubles(_ ns: [Int]) async -> [Int] {
    await withTaskGroup(of: (Int, Int).self) { group in
        for (i, n) in ns.enumerated() { group.addTask { (i, await slow(n)) } }
        var out = [Int](repeating: 0, count: ns.count)
        for await (i, v) in group { out[i] = v }
        return out
    }
}
await doubles([1, 2, 3])   // [2, 4, 6]
```

`withThrowingTaskGroup` is the throwing version: collect with `for try await`, and the first child to throw cancels the rest and sends its error out of the group.

An `actor` is a reference type that serialises access to its own state. From outside every access is `await`; inside, its own methods see the state directly with no `await` at all:

```swift
actor Counter {
    private var n = 0
    func bump() { n += 1 }
    func value() -> Int { n }
}
// 200 concurrent bumps land as 200 — a final class would lose updates
```

Actors are *reentrant*: a method that suspends at an `await` lets another task in, so anything you checked before a suspension may have changed after it. Keep a check and the update it guards in one method with nothing awaited between them.

`ContinuousClock.now` and `ContinuousClock.now - start` are what the timing tests measure with, and durations are written `.milliseconds(150)` or `.seconds(1)`.

`Sendable` marks a type that is safe to hand to another concurrent context. Value types made of `Sendable` parts get it automatically and actors always have it; a class with mutable state does not. For a global that is genuinely only touched from one place, `nonisolated(unsafe) static var live = 0` is the escape hatch the memory exercises use.

Docs: [Concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/), [withTaskGroup](https://developer.apple.com/documentation/swift/withtaskgroup(of:returning:isolation:body:)), [Actor](https://developer.apple.com/documentation/swift/actor)

## What is not available

Your code runs as a single Linux command-line program, compiled by a real `swiftc` on Compiler Explorer. That means:

- **No SwiftUI and no UIKit.** They are Apple-platform frameworks and do not exist on Linux. Nothing here draws anything.
- **No XCTest.** A single file on Linux cannot use it, which is why this app injects its own `expect` instead. `@Test`, `XCTAssertEqual` and friends will not compile.
- **No file system or network.** Every exercise takes its input as an argument and returns a value. The "fetches" in the concurrency module are `Task.sleep` wearing a costume.
- **One file.** Your code and the tests are concatenated, so you cannot have two declarations with the same name across the two editors.
- **The standard library and Foundation, in full.** `Data`, `JSONEncoder`, `String(format:)`, `trimmingCharacters(in:)`, `pow` and the rest are all there, and exercises get `import Foundation` for free. Playground blocks in the articles do not — add the import yourself if a sample needs it.
