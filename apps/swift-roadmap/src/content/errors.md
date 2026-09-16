# Error handling

Swift has no exceptions in the C++ or Java sense. A function that can fail says so in its type with `throws`, every call to it is marked `try`, and the compiler refuses to let you forget. The errors themselves are ordinary values — usually an enum — so you can pattern match on them exactly the way you match any other enum.

That design has a nice consequence: reading a function signature tells you whether it can fail, and reading a call site tells you where failure can happen. Nothing throws invisibly.

## Errors are values

Any type can be an error as long as it conforms to the `Error` protocol, which has no requirements at all. In practice an enum is the right shape: one case per thing that can go wrong, with associated values carrying the details.

```swift
enum ConfigError: Error, Equatable {
    case missingKey(String)
    case notANumber(key: String, value: String)
    case outOfRange(key: String, value: Int)
}
```

Adding `Equatable` is not required, but it makes errors easy to compare in tests, and enums with `Equatable` payloads get it synthesised for free.

## Throwing

A function that can fail is marked `throws` before its return arrow, and fails by `throw`ing a value. Calling it requires `try`, and a `try` inside a function that is not itself `throws` is an error — the failure has to go somewhere.

```swift
func requireKey(_ key: String, in config: [String: String]) throws -> String {
    guard let value = config[key] else { throw ConfigError.missingKey(key) }
    return value
}
```

`guard ... else { throw }` is the standard shape. The happy path stays unindented and every failure exits early.

Propagation is automatic: if `port(in:)` calls `requireKey` with `try` and is itself `throws`, an error thrown deeper down passes straight through it to its own caller, unwinding as it goes.

## Catching

`do { } catch { }` runs a block and handles what it throws. Inside a `catch` block without a pattern, the error is bound to a constant named `error`. With a pattern, you match cases the same way you would in a `switch`, and the compiler still wants a final catch-all because a function can in principle throw anything.

```swift
do {
    let raw = try requireKey("port", in: [:])
    print(raw)
} catch ConfigError.missingKey(let key) {
    print("no \(key)")
} catch {
    print("something else: \(error)")
}
```

You can also write `catch let e as ConfigError` to catch a whole error type at once and then `switch` over it.

## try? and try!

`try?` turns a throwing call into an optional: the value on success, `nil` on failure, error discarded. It is the right tool when you genuinely do not care *why* something failed.

```swift
let port = try? requireKey("port", in: ["port": "8080"])   // Optional("8080")
```

`try!` promises the call cannot fail and crashes the program if it does. Keep it for constants you wrote yourself a line earlier, and nowhere else.

## defer

`defer` schedules a block to run when the current scope exits — by returning, by breaking, or by throwing. It is how you guarantee cleanup happens on every path, including the ones you forgot about.

```swift
func work() throws {
    print("open")
    defer { print("close") }
    throw ConfigError.missingKey("x")   // "close" still prints
}
```

Deferred blocks run in reverse order of declaration, innermost scope first.

## Result

`Result<Success, Failure>` is an enum with a `.success` and a `.failure` case. Use it when a failure has to be *stored* rather than thrown right now: one entry per row of input, a value handed to a callback later, a batch where you want every outcome instead of only the first problem.

```swift
let outcomes = configs.map { config in Result { try port(in: config) } }
let ports = outcomes.compactMap { try? $0.get() }
```

`Result { try ... }` runs a throwing closure and captures the outcome as `Result<Int, any Error>`, `get()` turns a `Result` back into a throwing call, and `map` / `mapError` transform either side without unwrapping.

```swift playground
enum ConfigError: Error, Equatable {
    case missingKey(String)
    case notANumber(key: String, value: String)
}

func requireKey(_ key: String, in config: [String: String]) throws -> String {
    guard let value = config[key] else { throw ConfigError.missingKey(key) }
    return value
}

func port(in config: [String: String]) throws -> Int {
    let raw = try requireKey("port", in: config)
    guard let n = Int(raw) else { throw ConfigError.notANumber(key: "port", value: raw) }
    return n
}

let configs: [[String: String]] = [
    ["port": "8080"],
    ["port": "http"],
    ["host": "localhost"],
]

for config in configs {
    do {
        print("port = \(try port(in: config))")
    } catch ConfigError.missingKey(let key) {
        print("missing \(key)")
    } catch ConfigError.notANumber(let key, let value) {
        print("\(key) is not a number: \(value)")
    }
}

// try? when the reason does not matter
print("optional:", (try? port(in: ["port": "99"])) as Any)

// Result keeps every outcome instead of stopping at the first
let outcomes = configs.map { config in Result { try port(in: config) } }
print("successes:", outcomes.compactMap { try? $0.get() })

// defer runs on the way out, whichever way you leave
func trace() {
    defer { print("third") }
    defer { print("second") }
    print("first")
}
trace()
```

## Exercises

### 1. Validate a username

`validate(_:)` checks a username and returns it lowercased, or throws. The rules are checked in this order, so the first one that fails is the one reported:

1. an empty name throws `.empty`
2. more than 12 characters throws `.tooLong(count)` with the actual count
3. any character that is not a letter or a digit throws `.badCharacter(c)` with the **first** offending character

Everything else returns the name with `lowercased()` applied. The rules run against the original name, not the lowercased one.

```swift starter
enum ValidationError: Error, Equatable {
    case empty
    case tooLong(Int)
    case badCharacter(Character)
}

func validate(_ name: String) throws -> String {
    return ""
}
```

```swift test
func caught(_ body: () throws -> String) -> ValidationError? {
    do { _ = try body(); return nil } catch let e as ValidationError { return e } catch { return nil }
}

/// accepts good names, lowercased
func testAccepts() {
    expect(try? validate("Ada"), "ada")
    expect(try? validate("user42"), "user42")
    expect(try? validate("TwelveChars1"), "twelvechars1")
    expect(caught { try validate("Ada") }, nil)
}

/// empty is rejected
func testEmpty() {
    expect(caught { try validate("") }, ValidationError.empty)
}

/// too long carries the real count
func testTooLong() {
    expect(caught { try validate("thirteenchars") }, ValidationError.tooLong(13))
    expect(caught { try validate(String(repeating: "a", count: 20)) }, ValidationError.tooLong(20))
    expect(caught { try validate(String(repeating: "a", count: 12)) }, nil)
}

/// the first bad character is reported
func testBadCharacter() {
    expect(caught { try validate("ada lovelace") }, ValidationError.badCharacter(" "))
    expect(caught { try validate("a-b_c") }, ValidationError.badCharacter("-"))
    expect(caught { try validate("ok!") }, ValidationError.badCharacter("!"))
}

/// the rules are checked in order
func testOrder() {
    expect(caught { try validate("way too long!!!") }, ValidationError.tooLong(15))
    expect(caught { try validate("!") }, ValidationError.badCharacter("!"))
}
```

#### Uses
- [Error handling › Errors are values](#/errors/errors-are-values)
- [Error handling › Throwing](#/errors/throwing)
- [Reference › String and Character](#/reference/string-and-character)

#### Hints
- Three `guard ... else { throw ... }` statements in order, then `return name.lowercased()`.
- `name.count` is the character count. `name.isEmpty` is the empty check.
- `c.isLetter || c.isNumber` tests one character; `name.first(where:)` finds the first one that fails it.

#### Tips
- Because the checks run in order, a 15-character name with a `!` in it reports the length, not the character. Writing the guards in the order the description lists gets that for free.
- `name.first(where: { !($0.isLetter || $0.isNumber) })` hands you the offending `Character?` directly, which is exactly what `.badCharacter` carries.
- The rules run against the original name; `lowercased()` applies only to the value you return. Checking a case-folded copy would report a different character.

#### Docs
- [Error handling](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/errorhandling/)
- [Character properties](https://developer.apple.com/documentation/swift/character)

### 2. Parse them all, or none

`parseInts(_:)` converts every string in the list to an `Int`. If any of them is not a whole number it throws `.notANumber` naming the index and the offending text, and nothing is returned. An empty list gives an empty array. Leading or trailing spaces are not allowed — `Int` already refuses them.

```swift starter
enum ParseError: Error, Equatable {
    case notANumber(index: Int, text: String)
}

func parseInts(_ inputs: [String]) throws -> [Int] {
    return []
}
```

```swift test
func failure(_ body: () throws -> [Int]) -> ParseError? {
    do { _ = try body(); return nil } catch let e as ParseError { return e } catch { return nil }
}

/// converts a whole list
func testConverts() {
    expect(try? parseInts(["1", "2", "3"]), [1, 2, 3])
    expect(try? parseInts(["42"]), [42])
    expect(try? parseInts([]), [])
}

/// signs and zero survive
func testSigns() {
    expect(try? parseInts(["-4", "0", "+3"]), [-4, 0, 3])
    expect(try? parseInts(["-0"]), [0])
}

/// the first bad entry stops everything
func testThrows() {
    expect(failure { try parseInts(["1", "two", "3"]) }, ParseError.notANumber(index: 1, text: "two"))
    expect(failure { try parseInts(["x", "y"]) }, ParseError.notANumber(index: 0, text: "x"))
    expect(try? parseInts(["1", "two"]), nil)
}

/// near misses are still failures
func testNearMisses() {
    expect(failure { try parseInts([""]) }, ParseError.notANumber(index: 0, text: ""))
    expect(failure { try parseInts(["1.5"]) }, ParseError.notANumber(index: 0, text: "1.5"))
    expect(failure { try parseInts([" 7"]) }, ParseError.notANumber(index: 0, text: " 7"))
}
```

#### Uses
- [Error handling › Throwing](#/errors/throwing)
- [Error handling › try? and try!](#/errors/try-and-try)
- [Collections › Iterating](#/collections/iterating)
- [Collections › Adding and removing](#/collections/adding-and-removing)

#### Hints
- `Int("12")` is `Optional(12)` and `Int("twelve")` is `nil`, which is the whole conversion.
- `for (i, text) in inputs.enumerated()` gives you the index the error needs.
- Build the result with `var out: [Int] = []` and `out.append(n)`, or use `try inputs.enumerated().map { ... }` — `map` is allowed to rethrow.

#### Tips
- Throwing from inside a `map` closure works because `map` is declared `rethrows`: it throws only if the closure you gave it does.
- `enumerated()` yields `(offset, element)` pairs, which is where the index in the error comes from. Looping `0..<inputs.count` and subscripting works too and adds one more place to be off by one.

#### Docs
- [Int(_: String)](https://developer.apple.com/documentation/swift/int/init(_:)-6ilhe)

### 3. Skip what does not parse

`strictInt` is written for you: it reads a number that may use `_` as a digit separator, and throws otherwise. Write `sumValid(_:)`, which adds up every input `strictInt` accepts and silently ignores the rest. An empty list, or one where nothing parses, sums to `0`.

```swift starter
enum NumberError: Error {
    case notANumber(String)
}

func strictInt(_ text: String) throws -> Int {
    let digits = text.replacingOccurrences(of: "_", with: "")
    guard !text.isEmpty, let n = Int(digits) else { throw NumberError.notANumber(text) }
    return n
}

func sumValid(_ inputs: [String]) -> Int {
    return 0
}
```

```swift test
/// adds the numbers it can read
func testSums() {
    expect(sumValid(["1", "2", "3"]), 6)
    expect(sumValid(["10", "32"]), 42)
}

/// separators are part of the number
func testSeparators() {
    expect(sumValid(["1_000", "2_5"]), 1025)
    expect(sumValid(["1_000_000"]), 1_000_000)
}

/// bad entries are skipped, not fatal
func testSkips() {
    expect(sumValid(["1", "one", "2", ""]), 3)
    expect(sumValid(["nope", "never"]), 0)
    expect(sumValid([]), 0)
}

/// negatives count too
func testNegatives() {
    expect(sumValid(["-5", "5"]), 0)
    expect(sumValid(["-5", "x", "-5"]), -10)
}
```

#### Uses
- [Error handling › try? and try!](#/errors/try-and-try)
- [Error handling › Throwing](#/errors/throwing)
- [Reference › String and Character](#/reference/string-and-character)

#### Hints
- `try? strictInt(text)` is an `Int?` — `nil` for the entries you want to drop.
- `inputs.compactMap { try? strictInt($0) }` keeps only the successes; `.reduce(0, +)` adds them.
- A plain loop works too: `if let n = try? strictInt(text) { total += n }`.

#### Tips
- `sumValid` is not `throws`, so `try?` is what lets it call a throwing function at all. `try` alone would not compile here.
- Read the given `strictInt` before assuming: `""` is rejected by its explicit `!text.isEmpty` guard, not merely because `Int("")` is `nil`.

#### Docs
- [compactMap](https://developer.apple.com/documentation/swift/sequence/compactmap(_:))

### 4. Always close the journal

`handle(_:_:)` writes to a journal around some work. It must append `"open"` before doing anything, then append `"close"` on the way out — on **every** path, including the one that throws. An empty input throws `.emptyInput`; otherwise it returns the number of characters.

```swift starter
enum HandleError: Error, Equatable {
    case emptyInput
}

final class Journal {
    private(set) var entries: [String] = []
    func add(_ entry: String) { entries.append(entry) }
}

func handle(_ input: String, _ journal: Journal) throws -> Int {
    journal.add("open")
    journal.add("close")
    return 0
}
```

```swift test
/// returns the length and logs both entries
func testSuccess() {
    let j = Journal()
    expect(try? handle("abc", j), 3)
    expect(j.entries, ["open", "close"])

    let k = Journal()
    expect(try? handle("a longer one", k), 12)
    expect(k.entries, ["open", "close"])
}

/// empty input throws
func testThrows() {
    let j = Journal()
    do {
        _ = try handle("", j)
        expect(false, "should have thrown")
    } catch let e as HandleError {
        expect(e, HandleError.emptyInput)
    } catch {
        expect(false, "wrong error type: \(error)")
    }
}

/// the journal is closed even when it throws
func testClosesOnThrow() {
    let j = Journal()
    _ = try? handle("", j)
    expect(j.entries, ["open", "close"])
    _ = try? handle("", j)
    expect(j.entries, ["open", "close", "open", "close"])
}

/// one journal records every call in order
func testAccumulates() {
    let j = Journal()
    _ = try? handle("ab", j)
    _ = try? handle("", j)
    _ = try? handle("c", j)
    expect(j.entries.count, 6)
    expect(j.entries.filter { $0 == "close" }.count, 3)
}
```

#### Uses
- [Error handling › defer](#/errors/defer)
- [Error handling › Throwing](#/errors/throwing)

#### Hints
- `journal.add("open")` first, then `defer { journal.add("close") }` on the very next line.
- After the `defer`, `guard !input.isEmpty else { throw HandleError.emptyInput }`.
- `input.count` is the character count to return.

#### Tips
- The `defer` has to come *after* the `"open"` and *before* the `guard`. A `defer` registered later than the `throw` never runs, because the scope has already left.
- `Journal` is a `final class`, so the object the test holds and the one your function writes to are the same. A struct would have been copied in and every entry lost.

#### Docs
- [Specifying cleanup actions](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/errorhandling/#Specifying-Cleanup-Actions)
