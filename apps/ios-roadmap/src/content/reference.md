# Reference

A lookup page, not a step on the roadmap. It covers three things: how the tests in this app work, the standard-library and Foundation calls the exercises lean on, and a glossary of the SwiftUI and Apple-framework APIs that turn up in the build tasks and the articles but cannot be compiled here.

Nothing has to be read in order. Exercises link to the section they need.

Every Swift sample in the first half was compiled and run by the same `swiftc` the exercises use, and the results shown are what it printed. The SwiftUI half was not: no browser can run SwiftUI, so those entries are signatures and one-liners, with a link to Apple's documentation for each.

## How the tests work

Every solvable exercise has two editors. The left one holds your code. The right one holds the tests, and you do not edit it. Both are compiled into a single file, so a name you declare on the left is visible on the right — and a name that clashes with something the tests declare is a compile error.

A test is a top-level function whose name starts with `test` and that takes no arguments:

```swift
/// totals the quantities
func testTotal() {
    expect(badge(.ready([Item(id: 1, name: "Pen", qty: 2)])), "2")
}
```

The `///` comment directly above a test is its label in the results panel. Without one, the label is made from the function name: `testCapped` shows as "capped".

The tests are the specification. They often declare their own helpers and their own fixture types, and those are part of the problem — read them before you write anything.

Build tasks have no tests at all. A screen cannot be compiled here, so those exercises give you a checklist and a reference solution instead, and nothing marks them.

### expect

Two functions are injected around your code. You never declare them.

- `expect<T: Equatable>(_ got: T, _ want: T)` — fails unless the two are equal. **`got` comes first**: in `expect(badge(state), "5")` the panel reports `expected: 5` for the second argument and `actual:` for the first. Reading the arguments the other way round is the most common confusion here.
- `expect(_ condition: Bool, _ message: String = "expected true")` — fails with that message when the condition is false. Use it when there is nothing to compare: `expect(url.absoluteString.hasPrefix("https://"), "should be https")`.

A test collects every failure it hits but reports only the **first**, so fix them top down. Anything a test `print`s appears under that test's result, which is the quickest way to see what your code actually returned.

### async, throws and traps

A test may be `async`, `throws`, or both — the runner awaits every one of them. Most of the concurrency, networking and persistence exercises are checked by `async` tests:

```swift
/// the cache answers from memory the second time
func testCached() async {
    let cache = ThumbnailCache()
    _ = await cache.image(for: "a")
    expect(await cache.loads, 1)
}
```

An error that escapes a `throws` test fails it with `threw <error>`.

A **trap** is not a failed assertion, it is the process dying. Force-unwrapping a `nil`, subscripting past the end of an array, a backwards range like `3...1`, integer overflow, `removeFirst()` on an empty array — any of these stops everything. The test that was running is blamed, with the message and the line (`tests line 30: Fatal error: Index out of range`), and every test after it reports `did not run`. One trap can make four tests look broken when only one is.

## What runs here, and what does not

Your code is compiled by a real `swiftc` into a single Linux command-line program. That sets the boundaries of this app:

- **No SwiftUI, no UIKit, no SwiftData.** They ship with Apple's SDKs and do not exist on Linux. This is why every screen in the roadmap is a build task with a checklist rather than something the browser marks.
- **No XCTest and no Swift Testing.** A single file on Linux cannot use either, which is why this app injects its own `expect`. `@Test`, `#expect` and `XCTAssertEqual` will not compile in the editor, even though the testing module teaches them.
- **No file system and no network.** `URLSession`, `FileManager` and `UserDefaults` are not reachable. Every exercise takes its input as an argument and returns a value; the "fetches" are `Task.sleep` wearing a costume, and a fake `ProductService` stands in for the real one.
- **One file.** Your code and the tests are concatenated, so you cannot declare the same name twice across the two editors.
- **The standard library and Foundation, in full.** `Data`, `JSONDecoder`, `Date`, `URLComponents`, `formatted`, `pow` and the rest are all there. Exercises get `import Foundation` for free; the **playground** blocks in the articles do not, so add it yourself there — even `squareRoot()` and `pow` fail to link without it.
- **Formatting follows the machine's locale.** `(2.50).formatted(.currency(code: "GBP"))` prints `£2.50` here. Tests never compare against a formatted string for that reason, and neither should you.

## Collections

`Array` is ordered and indexed from zero, and subscripting out of range traps.

```swift
var a = [10, 20, 30]
a.append(40)               // [10, 20, 30, 40]
a.insert(5, at: 0)         // [5, 10, 20, 30, 40]
a.remove(at: 1)            // returns 10, the array closes the gap
a.removeFirst()            // returns the first element; traps when empty
a.popLast()                // Optional(40); nil when empty, never traps
a.removeAll { $0 % 2 == 0 }        // keeps what fails the test
a.removeSubrange(1..<3)            // deletes a run in place
[1, 2, 1, 3].lastIndex(of: 1)      // Optional(2)
["a", "b"].firstIndex(of: "b")     // Optional(1)
Array([1, 2, 3, 4][1..<3])         // [2, 3] — slicing gives an ArraySlice
```

`Set` is unordered, holds each member once, and answers membership in constant time. `insert` reports whether it did anything, which is the trick behind order-preserving deduplication. Selection models in the list exercises are sets:

```swift
var seen: Set<Int> = []
seen.insert(1).inserted                          // true
seen.insert(1).inserted                          // false — already there
Set([1, 2]).union([2, 3]).sorted()               // [1, 2, 3]
Set([1, 2, 3]).intersection([2, 3, 4]).sorted()  // [2, 3]
Set([1, 2, 3]).subtracting([2]).sorted()         // [1, 3]
Set([1, 2, 3]).symmetricDifference([3, 4]).sorted()  // [1, 2, 4] — in one or the other, not both
Set([1, 2]).isSubset(of: [1, 2, 3])              // true
selection.removeAll()                            // empties it
```

`Dictionary` lookups give an optional; the `default:` subscript reads, modifies and writes back in one step:

```swift
var counts: [String: Int] = [:]
counts["a", default: 0] += 1
counts["a", default: 0] += 1        // ["a": 2]
["b": 1, "a": 2].keys.sorted()      // ["a", "b"]
["a": 1].mapValues { $0 * 2 }       // ["a": 2]
Dictionary(grouping: ["ant", "ape", "bee"], by: { $0.first! })
// ["a": ["ant", "ape"], "b": ["bee"]]
```

`Dictionary(grouping:by:)` is how a flat list becomes sections. Sets and dictionaries have no order at all, and iterate differently between runs — sort before you compare or display.

The `Sequence` and `Collection` methods work on all of them, plus ranges and a string's characters. Each returns something new and leaves the original alone:

```swift
let words = ["swift", "go", "rust"]
words.map(\.count)                  // [5, 2, 4]
words.filter { $0.count > 3 }       // ["swift", "rust"]
[1, 2, 3, 4].reduce(0, +)           // 10
["a", "b", "a"].reduce(into: [String: Int]()) { $0[$1, default: 0] += 1 }  // ["a": 2, "b": 1]
["1", "two", "3"].compactMap { Int($0) }   // [1, 3] — drops the nils
[[1, 2], [3]].flatMap { $0 }        // [1, 2, 3]
words.sorted()                      // ["go", "rust", "swift"]
words.sorted { $0.count < $1.count }          // shortest first
words.sorted { ($0.count, $0) < ($1.count, $1) }   // with a tie-break
Array(["a", "b"].enumerated())      // [(offset: 0, element: "a"), (offset: 1, element: "b")]
Array(zip([1, 2, 3], ["a", "b"]))   // [(1, "a"), (2, "b")] — stops at the shorter
words.first { $0.hasPrefix("r") }   // Optional("rust")
words.allSatisfy { !$0.isEmpty }    // true — and true for an empty collection
[1, 9, 3].max()                     // Optional(9)
words.max { $0.count < $1.count }   // Optional("swift")
Array(words.prefix(2))              // ["swift", "go"] — asking for 99 is not an error
Array(words.dropFirst())            // ["go", "rust"]
words.joined(separator: ", ")       // "swift, go, rust"
```

`reduce` takes a starting value and a closure over `(running, next)`. The starting value is the answer for an empty collection, which is why `reduce(0, +)` on `[]` is `0`.

An enum marked `CaseIterable` hands you every case in declaration order, and a raw-value enum parses from and back to its raw type:

```swift
enum Status: String, CaseIterable { case draft, live }
Status.allCases.map(\.rawValue)     // ["draft", "live"]
Status(rawValue: "live")            // Optional(Status.live)
Status(rawValue: "nope")            // nil
```

Docs: [Array](https://developer.apple.com/documentation/swift/array), [Set](https://developer.apple.com/documentation/swift/set), [Dictionary](https://developer.apple.com/documentation/swift/dictionary), [Sequence](https://developer.apple.com/documentation/swift/sequence), [CaseIterable](https://developer.apple.com/documentation/swift/caseiterable)

## Strings and text

```swift
"héllo".count                       // 5 — Characters, not bytes
"Swift".lowercased()                // "swift"
"Swift Roadmap".hasPrefix("Swift")  // true
"a,b,,c".split(separator: ",")      // ["a", "b", "c"] — empties dropped, Substrings out
"swift".prefix(2)                   // "sw"
"swift".dropFirst(2)                // "ift"
String("abc".reversed())            // "cba"
String(repeating: "•", count: 3)    // "•••"
```

From Foundation — available in every exercise, and the backbone of the input-masking and formatting work:

```swift
"4242-4242".replacingOccurrences(of: "-", with: "")   // "42424242"
"  hi  ".trimmingCharacters(in: .whitespaces)         // "hi"
String("42a4b".filter(\.isNumber))                    // "424" — strip, don't reject
String(format: "%02d", 5)                             // "05"
Data("hi".utf8)                                       // 2 bytes, what JSONDecoder wants
String(decoding: Data("hi".utf8), as: UTF8.self)      // "hi"
stride(from: 0, to: 8, by: 4).map { $0 }              // [0, 4] — chunk boundaries
```

Docs: [String](https://developer.apple.com/documentation/swift/string), [Strings and characters](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/stringsandcharacters/)

## Optionals, Result and errors

```swift
let maybe: Int? = nil
maybe ?? 0                          // 0 — the fallback, non-optional
(5 as Int?).map { $0 * 2 }          // Optional(10) — transform what is there
Int("42")                           // Optional(42)
```

`if let name = value { }` unwraps for a block, `guard let name = value else { return }` unwraps for the rest of the scope, and `value!` asserts it is there and traps when it is not. A force-unwrap in a view body is a crash report waiting to be filed.

`Result<Success, Failure>` stores an outcome instead of raising it now — which is what a screen wants, because `.failure` is a state it has to draw:

```swift
enum Bad: Error, Equatable { case nope }

let ok: Result<Int, Bad> = .success(3)
try? ok.get()                       // Optional(3)
try? ok.map { $0 * 10 }.get()       // Optional(30)

switch (Result<Int, Bad>.failure(.nope)) {
case .success(let v): print(v)
case .failure(let e): print(e)      // nope
}
```

`do`/`catch` with a typed pattern picks one error out: `catch URLError.cancelled { }`. A `do` must handle every error, so a bare `catch` at the end is usually required, and inside it the error is bound to `error` for you. `defer` runs on the way out of the scope whichever way you leave it.

Docs: [Optional](https://developer.apple.com/documentation/swift/optional), [Result](https://developer.apple.com/documentation/swift/result), [Error handling](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/errorhandling/)

## Codable and JSON

`JSONEncoder` and `JSONDecoder` both speak `Data`, so the two conversions you write constantly are `Data(text.utf8)` and `String(decoding: data, as: UTF8.self)`.

```swift
struct Product: Codable, Equatable {
    let id: Int
    let unitPence: Int
    enum CodingKeys: String, CodingKey { case id, unitPence = "unit_pence" }
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
String(decoding: try encoder.encode(Product(id: 1, unitPence: 250)), as: UTF8.self)
// {"id":1,"unit_pence":250}

try JSONDecoder().decode(Product.self, from: Data(#"{"id":2,"unit_pence":99}"#.utf8))
// Product(id: 2, unitPence: 99)
```

Declaring `CodingKeys` replaces the synthesised one, so **every** property you want encoded has to appear as a case, not only the renamed ones. For a feed that is snake_case throughout, `decoder.keyDecodingStrategy = .convertFromSnakeCase` does the whole job with no enum at all.

A missing key is an error for a non-optional property. `decodeIfPresent` gives `nil` for an absent key and for a `null`, which is how a v1 record is read by v2 code. Failures arrive as `DecodingError`:

```swift
do {
    _ = try JSONDecoder().decode(Product.self, from: Data(#"{"id":1}"#.utf8))
} catch DecodingError.keyNotFound(let key, let context) {
    print(key.stringValue, context.codingPath)   // unit_pence []
}
```

The four cases are `.keyNotFound(key, context)`, `.typeMismatch(type, context)`, `.valueNotFound(type, context)` and `.dataCorrupted(context)` — the last covers both invalid JSON and a raw value that matches no enum case. Every `context` carries a `codingPath` naming the keys down to the problem.

Docs: [Encoding and decoding custom types](https://developer.apple.com/documentation/foundation/archives-and-serialization/encoding-and-decoding-custom-types), [DecodingError](https://developer.apple.com/documentation/swift/decodingerror)

## Dates and formatted values

A `Date` is an instant, not a calendar page. Arithmetic on it is in seconds, and that is all the cache-staleness and session-timeout exercises need:

```swift
let t0 = Date(timeIntervalSince1970: 1_000_000)
let t1 = t0.addingTimeInterval(90)   // 90 seconds later
t1.timeIntervalSince(t0)             // 90.0
t1 > t0                              // true — Date is Comparable
Date.distantPast                     // a sentinel for "never"

let iso = ISO8601DateFormatter()
iso.string(from: t0)                 // "1970-01-12T13:46:40Z"
iso.date(from: "1970-01-12T13:46:40Z")   // Optional(that instant)
```

Never take `Date()` inside code you want to test. Pass the clock in — a `now: Date` parameter or a `() -> Date` — which is exactly what the testing module builds a fake for.

`formatted` is the modern format-style API. It is locale-aware, so the output depends on the machine:

```swift
(2.50).formatted(.currency(code: "GBP"))              // "£2.50" here
(1234.5678).formatted(.number.precision(.fractionLength(2)))   // "1,234.57"
(1234).formatted()                                    // "1,234"
(0.25).formatted(.percent)                            // "25%"
t0.formatted(date: .abbreviated, time: .omitted)      // "12 Jan 1970"
```

Money is held as an `Int` of pence in these exercises and divided only at the edge, because `Double` arithmetic on currency drifts. `RelativeDateTimeFormatter` produces "2 hours ago" strings for timelines; it is Foundation, and like everything else here it reads the user's locale.

Docs: [Date](https://developer.apple.com/documentation/foundation/date), [FormatStyle](https://developer.apple.com/documentation/foundation/formatstyle), [ISO8601DateFormatter](https://developer.apple.com/documentation/foundation/iso8601dateformatter)

## URLs and networking types

`URLComponents` is the safe way to build a request URL: it percent-encodes the query for you, which string concatenation does not.

```swift
var comps = URLComponents(string: "https://example.com/v1")!
comps.path = "/v1/search"
comps.queryItems = [URLQueryItem(name: "q", value: "pens & ink"),
                    URLQueryItem(name: "page", value: "2")]
comps.url!.absoluteString
// https://example.com/v1/search?q=pens%20%26%20ink&page=2

let base = URL(string: "https://example.com/v1")!
base.appending(path: "products").absoluteString   // .../v1/products — no slash arithmetic
URLComponents(string: "https://e.com?a=1&b=2")!.queryItems!.map(\.name)   // ["a", "b"]
```

`URLError` is what `URLSession` throws, and its `code` is the part worth switching on. It is `Equatable`, so tests compare it directly:

```swift
URLError(.notConnectedToInternet).code == .notConnectedToInternet   // true
URLError(.cancelled).code == URLError.Code.cancelled                // true
```

The codes the networking module cares about are `.cancelled` (a task was cancelled — never show this as an error), `.notConnectedToInternet` and `.dataNotAllowed` (offline, worth a retry), and `.timedOut`. An HTTP status is *not* a `URLError`: `URLSession` returns 401 and 500 happily, and reading `(response as? HTTPURLResponse)?.statusCode` is your job.

`URLSession` itself is unavailable in this editor, so the exercises hide it behind a protocol and inject a fake. That is the same seam you want in a real app.

- `URLSession.shared.data(from:)` → `(Data, URLResponse)`, `async throws`. The one call the whole networking module wraps. [docs](https://developer.apple.com/documentation/foundation/urlsession/data(from:delegate:))
- `URLSessionConfiguration.default` — where `timeoutIntervalForRequest` and `waitsForConnectivity` live. [docs](https://developer.apple.com/documentation/foundation/urlsessionconfiguration)
- `HTTPURLResponse.statusCode` — the number `URLError` will not give you. [docs](https://developer.apple.com/documentation/foundation/httpurlresponse)

Docs: [URLComponents](https://developer.apple.com/documentation/foundation/urlcomponents), [URLError](https://developer.apple.com/documentation/foundation/urlerror)

## Concurrency

`async` marks a function that may suspend, `await` marks each point where it does. Two `await`s in a row are sequential; overlapping takes `async let` or a group.

```swift
func slow(_ n: Int) async -> Int {
    try? await Task.sleep(for: .milliseconds(20))
    return n * 2
}
await slow(3)                // 6
```

`Task { }` starts work from anywhere; `task.value` awaits its result and `task.cancel()` asks it to stop. Cancellation is cooperative — nothing is killed. `Task.isCancelled` is a flag and the suspending calls throw `CancellationError`, which is why `try?` around a sleep is so common and why a cancelled load must never be drawn as a failure:

```swift
let t = Task { await slow(5) }
await t.value                // 10
```

`async let` starts a fixed number of children at once and waits at the first `await` on the name:

```swift
async let a = slow(1)
async let b = slow(2)
"\(await a) \(await b)"      // "2 4", and both ran at the same time
```

A task group is for when the number of children depends on the input. `for await` yields results **as they finish**, so carry the index and write into a pre-sized array to get input order back:

```swift
await withTaskGroup(of: (Int, Int).self) { group in
    for (i, n) in [1, 2, 3].enumerated() { group.addTask { (i, await slow(n)) } }
    var out = [Int](repeating: 0, count: 3)
    for await (i, v) in group { out[i] = v }
    return out
}                            // [2, 4, 6]
```

`withThrowingTaskGroup` is the throwing version: collect with `for try await`, and the first child to throw cancels the rest and sends its error out.

An `actor` is a reference type that serialises access to its own state. From outside every access is `await`; inside, its own methods see the state directly:

```swift
actor Counter {
    private var n = 0
    func bump() { n += 1 }
    func value() -> Int { n }
}
// 100 concurrent bumps land as 100 — a plain final class would lose updates
```

Actors are *reentrant*: a method that suspends at an `await` lets another task in, so anything you checked before a suspension may have changed after it. Keep a check and the update it guards in one method with nothing awaited between them — that is the whole bug in the "one request in flight" exercises.

`@MainActor` pins a type or a method to the main thread. Every view model that a screen observes belongs on it, and `await` is how you hop there from a background context. `Sendable` marks a type safe to hand across concurrency domains; value types made of `Sendable` parts get it automatically, actors always have it, and a class with mutable state does not. `@escaping @Sendable` on a closure parameter says it outlives the call and will run somewhere else.

`AsyncStream` turns a callback API into something you can `for await` over, and `ContinuousClock.now` with `.milliseconds(150)` durations is how the timing exercises measure.

Docs: [Concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/), [Task](https://developer.apple.com/documentation/swift/task), [withTaskGroup](https://developer.apple.com/documentation/swift/withtaskgroup(of:returning:isolation:body:)), [Actor](https://developer.apple.com/documentation/swift/actor)

## SwiftUI views and layout

None of the rest of this page compiles in the editor. These are the APIs the build-task solutions use, so you can read a solution without guessing.

A view is a struct conforming to `View` with a `body`. `some View` means "one concrete type I am not going to name"; the type is real and the compiler knows it.

- `VStack(alignment:spacing:content:)` — children top to bottom, `alignment` a horizontal one such as `.leading`. `VStack(alignment: .leading, spacing: 16) { … }` [docs](https://developer.apple.com/documentation/swiftui/vstack)
- `HStack(alignment:spacing:content:)` — left to right; `alignment: .firstTextBaseline` lines up text of different sizes by their first line. [docs](https://developer.apple.com/documentation/swiftui/hstack)
- `ZStack(alignment:content:)` — back to front, later children on top. [docs](https://developer.apple.com/documentation/swiftui/zstack)
- `Spacer()` — takes all the space it can along the stack's axis, which is how you push one child to the far end. [docs](https://developer.apple.com/documentation/swiftui/spacer)
- `Text(_:)` — a string, or a value with a format: `Text(date, style: .relative)`. [docs](https://developer.apple.com/documentation/swiftui/text)
- `Image(systemName:)` — an SF Symbol by name, `Image(systemName: "cart")`. The SF Symbols app lists every name. [docs](https://developer.apple.com/documentation/swiftui/image/init(systemname:))
- `Label(_:systemImage:)` — text and a symbol as one element, and it adapts to where it is placed. [docs](https://developer.apple.com/documentation/swiftui/label)
- `Button(_:action:)` / `Button(role:action:label:)` — `role: .destructive` gets the red treatment for free. [docs](https://developer.apple.com/documentation/swiftui/button)
- `ProgressView()` — the spinner; with `value:total:` it is a bar instead. [docs](https://developer.apple.com/documentation/swiftui/progressview)
- `ContentUnavailableView(_:systemImage:description:)` — the standard empty state, with `.search(text:)` as a ready-made "no results for X". [docs](https://developer.apple.com/documentation/swiftui/contentunavailableview)
- `Divider()`, `Group { }`, `@ViewBuilder` — a hairline, a wrapper that applies a modifier to several views at once, and the attribute that lets a function or computed property return several views and `if`/`else` between them. [docs](https://developer.apple.com/documentation/swiftui/viewbuilder)
- `#Preview { }` — renders a view in the canvas without launching the app. `@Previewable @State var x = 0` inside it gives the preview its own mutable state. [docs](https://developer.apple.com/documentation/swiftui/preview(_:body:))

Layout modifiers. Order matters: each one wraps what is above it, so `.padding().background(.red)` colours the padding and `.background(.red).padding()` does not.

- `padding(_ edges: Edge.Set = .all, _ length: CGFloat? = nil)` — `.padding(.vertical, 12)`, `.padding(24)`, or bare `.padding()` for the system default. [docs](https://developer.apple.com/documentation/swiftui/view/padding(_:_:))
- `frame(width:height:alignment:)` — a fixed size. [docs](https://developer.apple.com/documentation/swiftui/view/frame(width:height:alignment:))
- `frame(minWidth:idealWidth:maxWidth:minHeight:idealHeight:maxHeight:alignment:)` — the flexible one. `.frame(maxWidth: .infinity, alignment: .leading)` is how you make a view fill its row and left-align its content. [docs](https://developer.apple.com/documentation/swiftui/view/frame(minwidth:idealwidth:maxwidth:minheight:idealheight:maxheight:alignment:))
- `layoutPriority(_ value: Double)` — who gives way when there is not enough room. The default is `0`; the child you want to keep intact gets `1`. [docs](https://developer.apple.com/documentation/swiftui/view/layoutpriority(_:))
- `fixedSize(horizontal:vertical:)` — "never compress me below my ideal size", the usual cure for a truncated label. [docs](https://developer.apple.com/documentation/swiftui/view/fixedsize(horizontal:vertical:))
- `background(_:in:)` / `overlay(alignment:content:)` — something behind, something in front. `.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))` [docs](https://developer.apple.com/documentation/swiftui/view/background(_:in:fillstyle:))
- `clipShape(_:)` — clip to a shape. `.clipShape(RoundedRectangle(cornerRadius: 16))` is the modern replacement for `.cornerRadius(_:)`, which is deprecated. [docs](https://developer.apple.com/documentation/swiftui/view/clipshape(_:style:))
- `RoundedRectangle(cornerRadius:)`, `Circle()`, `Capsule()` — shapes. `.fill(_:)` paints one, `.stroke(_:lineWidth:)` draws a line centred on the edge, and `.strokeBorder(_:lineWidth:)` draws it inside the edge — which is the one you want on a card, because a centred stroke bleeds half its width outside the corner radius. [docs](https://developer.apple.com/documentation/swiftui/shape)
- `ignoresSafeArea(_:edges:)` — let a background run under the notch or the home indicator. Content should stay inside it. [docs](https://developer.apple.com/documentation/swiftui/view/ignoressafearea(_:edges:))
- `ScrollView`, `LazyVStack`, `LazyVGrid`, `Grid` — a scrolling container, and the lazy stacks that only build the rows on screen. [docs](https://developer.apple.com/documentation/swiftui/scrollview)
- `GeometryReader { proxy in … }` — reads the space it was offered, `proxy.size.width`. It fills that space and aligns its content top-leading, which surprises people; prefer a layout that does not need it. [docs](https://developer.apple.com/documentation/swiftui/geometryreader)
- `ViewThatFits { … }` — tries its children in order and uses the first that fits, which is the clean answer to a row that has to become a column at large text sizes. [docs](https://developer.apple.com/documentation/swiftui/viewthatfits)

## SwiftUI state and data flow

- `@State private var x = 0` — state the view owns. Always `private`, and only for this view's own business. [docs](https://developer.apple.com/documentation/swiftui/state)
- `@Binding var x: Int` — a read-write handle to state someone else owns. `$x` on a `@State` makes one; `Binding.constant(5)` makes a fixed one for previews. [docs](https://developer.apple.com/documentation/swiftui/binding)
- `@Bindable var model: Model` — the same two-way `$` access for an `@Observable` object, needed when the view has one as a plain `let` or a parameter. [docs](https://developer.apple.com/documentation/swiftui/bindable)
- `@Environment(\.dismiss) private var dismiss` — reads a value the system or an ancestor put in the environment: `\.scenePhase`, `\.colorScheme`, `\.dynamicTypeSize`, `\.isSearching`, `\.openURL`. [docs](https://developer.apple.com/documentation/swiftui/environment)
- `@Environment(Model.self) private var model` — the same wrapper reading an `@Observable` object put in by `.environment(model)`. [docs](https://developer.apple.com/documentation/swiftui/environment/init(_:)-8slkf)
- `@Entry var brandTint: Color = .accentColor` — inside `extension EnvironmentValues`, declares your own environment value with a default, replacing the `EnvironmentKey` boilerplate. Needs Xcode 16 or newer; the older form is a `struct BrandTintKey: EnvironmentKey { static let defaultValue = … }` plus a computed property. [docs](https://developer.apple.com/documentation/swiftui/entry())
- `environment(_:_:)` — puts a value into the environment for a subtree: `.environment(\.brandTint, .indigo)`. [docs](https://developer.apple.com/documentation/swiftui/view/environment(_:_:))
- `@FocusState private var field: Field?` — which field has the keyboard. Pair it with `.focused($field, equals: .email)` on the field. [docs](https://developer.apple.com/documentation/swiftui/focusstate)
- `task { }` / `task(id:priority:_:)` — runs an `async` job when the view appears and **cancels it when the view goes away**, or when `id` changes. This is the right place for a load; `onAppear` cannot await and does not cancel. [docs](https://developer.apple.com/documentation/swiftui/view/task(priority:_:))
- `onAppear { }` / `onDisappear { }` — synchronous hooks. `onAppear` can fire more than once for one view. [docs](https://developer.apple.com/documentation/swiftui/view/onappear(perform:))
- `onChange(of:initial:_:)` — runs when a value changes; the closure takes `(oldValue, newValue)`. It exists on `Scene` as well as on `View`, which is where `.onChange(of: scenePhase)` belongs when the work is about the whole scene. [docs](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)-4psgg)
- `withAnimation(_:_:)` and `animation(_:value:)` — animate the change, not the view. `withAnimation(.snappy) { expanded.toggle() }`. [docs](https://developer.apple.com/documentation/swiftui/withanimation(_:_:))

## SwiftUI lists and navigation

- `List { }` / `List(_:id:)` / `List(selection:)` — the scrolling table. With a `selection:` binding to a `Set` it does multi-select for you. [docs](https://developer.apple.com/documentation/swiftui/list)
- `ForEach(_:id:content:)` — repeats a view over a collection. Elements that are `Identifiable` need no `id:`; `id: \.self` on an array of strings is a bug waiting for a duplicate. Stable ids are what make insertions animate correctly. [docs](https://developer.apple.com/documentation/swiftui/foreach)
- `Section { } header: { }` — a group with a header, which is how a grouped dictionary becomes sections. [docs](https://developer.apple.com/documentation/swiftui/section)
- `onDelete(perform:)` / `onMove(perform:)` — on a `ForEach` inside a `List`, gives swipe-to-delete and drag-to-reorder. The closure gets an `IndexSet`. [docs](https://developer.apple.com/documentation/swiftui/foreach/ondelete(perform:))
- `swipeActions(edge:allowsFullSwipe:content:)` — custom swipe buttons, one per `Button` in the closure. [docs](https://developer.apple.com/documentation/swiftui/view/swipeactions(edge:allowsfullswipe:content:))
- `refreshable { }` — pull to refresh. The closure is `async` and the spinner stays until it returns. [docs](https://developer.apple.com/documentation/swiftui/view/refreshable(action:))
- `searchable(text:prompt:)` — the system search field; the `\.isSearching` environment value tells a child whether it is active. [docs](https://developer.apple.com/documentation/swiftui/view/searchable(text:placement:prompt:)-18a8f)
- `NavigationStack(path:root:)` — the stack, with an optional `Binding` to an array of route values. Driving that array from code is what makes deep links and "pop to root" possible. [docs](https://developer.apple.com/documentation/swiftui/navigationstack)
- `NavigationLink(_:value:)` — pushes by appending a **value** to the path, not a view. [docs](https://developer.apple.com/documentation/swiftui/navigationlink)
- `navigationDestination(for:destination:)` — maps a route value type to the screen that shows it, declared once near the stack. [docs](https://developer.apple.com/documentation/swiftui/view/navigationdestination(for:destination:))
- `navigationTitle(_:)` / `navigationBarTitleDisplayMode(_:)` — the title, and `.inline` when the large title is too much. [docs](https://developer.apple.com/documentation/swiftui/view/navigationtitle(_:)-avn5)
- `toolbar { ToolbarItem(placement: .topBarTrailing) { … } }` — bar buttons; other placements include `.bottomBar` and `.confirmationAction`. [docs](https://developer.apple.com/documentation/swiftui/view/toolbar(content:)-5w0tj)
- `sheet(isPresented:content:)` / `sheet(item:content:)` / `fullScreenCover(isPresented:content:)` — modals. The `item:` form takes an `Identifiable?` and is the one that cannot show a stale value. [docs](https://developer.apple.com/documentation/swiftui/view/sheet(item:ondismiss:content:))
- `confirmationDialog(_:isPresented:titleVisibility:actions:)` — the action sheet, for a destructive choice. [docs](https://developer.apple.com/documentation/swiftui/view/confirmationdialog(_:ispresented:titlevisibility:actions:))

## SwiftUI text input and forms

- `Form { }` — the grouped settings layout; `Section` inside it becomes a group with its own header. [docs](https://developer.apple.com/documentation/swiftui/form)
- `TextField(_:text:)` / `SecureField(_:text:)` — bound to a `String`. `TextField("Email", text: $model.email)` [docs](https://developer.apple.com/documentation/swiftui/textfield)
- `LabeledContent(_:value:)` — a label on the left, a value on the right, laid out the way the system does it. [docs](https://developer.apple.com/documentation/swiftui/labeledcontent)
- `Toggle(_:isOn:)`, `Picker(_:selection:)`, `Stepper(_:value:in:)` — a switch, a choice, and a number with `−`/`+`. [docs](https://developer.apple.com/documentation/swiftui/toggle)
- `keyboardType(_:)` — `.emailAddress`, `.numberPad`, `.decimalPad`. iOS only, and it is a hint, not validation. [docs](https://developer.apple.com/documentation/swiftui/view/keyboardtype(_:))
- `textContentType(_:)` — what the field is *for*, so the system can autofill it: `.emailAddress`, `.name`, `.newPassword`, `.creditCardNumber`, `.oneTimeCode`. This is the single cheapest thing you can do for a sign-up form. [docs](https://developer.apple.com/documentation/swiftui/view/textcontenttype(_:)-ufdv)
- `submitLabel(_:)` — what the return key says: `.next`, `.done`, `.go`. Pair with `onSubmit { }` to move focus. [docs](https://developer.apple.com/documentation/swiftui/view/submitlabel(_:))
- `textInputAutocapitalization(_:)` and `autocorrectionDisabled(_:)` — `.never` plus autocorrect off is right for emails, usernames and codes. [docs](https://developer.apple.com/documentation/swiftui/view/textinputautocapitalization(_:))
- `onSubmit(of:_:)` — the return key was pressed. [docs](https://developer.apple.com/documentation/swiftui/view/onsubmit(of:_:))
- `disabled(_:)` — greys a control out and stops it responding; it is also announced, so a disabled submit button is understood rather than mysterious. [docs](https://developer.apple.com/documentation/swiftui/view/disabled(_:))

## SwiftUI styling and type

- `font(_:)` — prefer the semantic sizes, which scale with Dynamic Type: `.largeTitle`, `.title`, `.title2`, `.title3`, `.headline`, `.subheadline`, `.body`, `.callout`, `.footnote`, `.caption`. `.font(.system(size: 17))` does not scale and should be rare. [docs](https://developer.apple.com/documentation/swiftui/view/font(_:))
- `fontWeight(_:)` / `.font(.headline.weight(.semibold))` — weight without changing the size. [docs](https://developer.apple.com/documentation/swiftui/view/fontweight(_:))
- `monospacedDigit()` — digits of equal width, so a live-updating number does not jitter. [docs](https://developer.apple.com/documentation/swiftui/view/monospaceddigit())
- `foregroundStyle(_:)` — the modern `foregroundColor`. `.secondary` and `.tertiary` are the hierarchy that adapts to light and dark for you. [docs](https://developer.apple.com/documentation/swiftui/view/foregroundstyle(_:))
- `Color` — `.accentColor`, `.primary`, `.secondary`, `.red`, and `Color("Brand")` for one from the asset catalogue, which is where light and dark variants belong. [docs](https://developer.apple.com/documentation/swiftui/color)
- `tint(_:)` — the colour for interactive parts of a control. [docs](https://developer.apple.com/documentation/swiftui/view/tint(_:))
- `buttonStyle(_:)` — `.borderedProminent` for the one main action on a screen, `.bordered` for secondary, `.plain` for a button that should not look like one. Attach it above the button, not below. [docs](https://developer.apple.com/documentation/swiftui/view/buttonstyle(_:)-66fbx)
- `Material` — `.regularMaterial`, `.thinMaterial`: a blur that takes its colour from what is behind it. [docs](https://developer.apple.com/documentation/swiftui/material)
- `lineLimit(_:)` — cap the lines. `.lineLimit(2)` truncates; `.lineLimit(2...)` lets it grow. Capping at 1 is how a long name silently disappears. [docs](https://developer.apple.com/documentation/swiftui/view/linelimit(_:)-513mb)
- `preferredColorScheme(_:)` — force `.dark` or `.light`, mostly for previews. [docs](https://developer.apple.com/documentation/swiftui/view/preferredcolorscheme(_:))
- `ViewModifier` + `modifier(_:)` — bundle a set of modifiers into a named style, then expose it as an extension on `View` so call sites read as `.cardStyle()`. [docs](https://developer.apple.com/documentation/swiftui/viewmodifier)
- `opacity(_:)`, `background(_:)` on a shape, and the rest compose by wrapping — read a chain bottom-up when you are working out what wraps what.

## SwiftUI accessibility

- `accessibilityLabel(_:)` — what VoiceOver says instead of the visible text. [docs](https://developer.apple.com/documentation/swiftui/view/accessibilitylabel(_:)-1d7jv)
- `accessibilityHidden(_:)` — hide a decorative image from assistive technology, so an icon beside a number is not read as two things. [docs](https://developer.apple.com/documentation/swiftui/view/accessibilityhidden(_:))
- `accessibilityElement(children:)` — `.combine` merges a group into one element, `.ignore` replaces its children entirely. [docs](https://developer.apple.com/documentation/swiftui/view/accessibilityelement(children:))
- `accessibilityValue(_:)` / `accessibilityAddTraits(_:)` — the changing part of a control, and traits like `.isButton`, `.isHeader`, `.isSelected`. [docs](https://developer.apple.com/documentation/swiftui/view/accessibilityaddtraits(_:))
- `accessibilityIdentifier(_:)` — a non-localised name for UI tests to query; not spoken. [docs](https://developer.apple.com/documentation/swiftui/view/accessibilityidentifier(_:))
- `@Environment(\.dynamicTypeSize)` and `DynamicTypeSize` — `.xSmall` through `.xxxLarge` and then `.accessibility1` to `.accessibility5`. `size.isAccessibilitySize` is the switch for "this row has to become a column". [docs](https://developer.apple.com/documentation/swiftui/dynamictypesize)
- `dynamicTypeSize(_:)` — clamp a subtree to a range, `.dynamicTypeSize(...DynamicTypeSize.accessibility3)`. Use it sparingly; it is a cap on the user's choice. [docs](https://developer.apple.com/documentation/swiftui/view/dynamictypesize(_:)-1m2s8)
- `@ScaledMetric var gap = 12.0` — a number that grows with Dynamic Type the way fonts do, for spacing and icon sizes. [docs](https://developer.apple.com/documentation/swiftui/scaledmetric)

## SwiftUI app, scenes and storage

- `@main struct ShopApp: App` with `var body: some Scene` — the entry point. There is no `main` function and no storyboard. [docs](https://developer.apple.com/documentation/swiftui/app)
- `WindowGroup { }` — the scene that holds your first view. [docs](https://developer.apple.com/documentation/swiftui/windowgroup)
- `@Environment(\.scenePhase)` — `.active`, `.inactive`, `.background`. Save on the way to `.background`; never assume you will be asked twice. [docs](https://developer.apple.com/documentation/swiftui/environmentvalues/scenephase)
- `@AppStorage("showTips") var showTips = true` — a `UserDefaults` value that the view redraws on. For small preferences only, never for secrets or a data model. [docs](https://developer.apple.com/documentation/swiftui/appstorage)
- `@SceneStorage("draft") var draft = ""` — per-scene state the system restores after it kills the app in the background. This is what makes "picking up where they left off" work. [docs](https://developer.apple.com/documentation/swiftui/scenestorage)
- `onOpenURL { url in … }` — a deep link arrived; parse it into a route and push it. [docs](https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:))

## Observation, SwiftData and storage

- `@Observable final class CartModel` — the macro that makes a class's stored properties observable. Views that read a property redraw when it changes; views that do not, do not. It replaces `ObservableObject`, `@Published` and `@StateObject`. [docs](https://developer.apple.com/documentation/observation/observable())
- `@ObservationIgnored` — on a property that is not display state, such as an injected service. [docs](https://developer.apple.com/documentation/observation/observationignored())
- `@State private var model = CartModel()` — how a view **owns** an `@Observable` object. Pass it down as a plain `let`, or put it in the environment. [docs](https://developer.apple.com/documentation/swiftui/state)
- `@Model final class Trip` — SwiftData's persistent class. Properties are stored; `@Attribute(.unique)` and `@Relationship(deleteRule:)` refine them. [docs](https://developer.apple.com/documentation/swiftdata/model())
- `@Query private var trips: [Trip]` — fetches from the model context and keeps the view in sync. `@Query(sort: \Trip.startDate)` orders it. [docs](https://developer.apple.com/documentation/swiftdata/query)
- `modelContainer(for:)` on the scene, and `@Environment(\.modelContext)` in a view — the store, and the handle you `insert(_:)` and `delete(_:)` through. [docs](https://developer.apple.com/documentation/swiftui/view/modelcontainer(for:inmemory:isautosaveenabled:isundoenabled:onsetup:))
- `ModelContainer(for:configurations:)` with `ModelConfiguration(isStoredInMemoryOnly: true)` — an in-memory store, which is what a test wants. [docs](https://developer.apple.com/documentation/swiftdata/modelconfiguration)
- `UserDefaults.standard` — key-value preferences; `bool(forKey:)`, `set(_:forKey:)`. A launch argument of the form `-key value` is read as if it had been written there, which is how a UI test flips a flag. [docs](https://developer.apple.com/documentation/foundation/userdefaults)
- `FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)` — where a JSON file of your own belongs; `Data.write(to:)` and `Data(contentsOf:)` move it. [docs](https://developer.apple.com/documentation/foundation/filemanager)

## Swift Testing and XCTest

Neither framework compiles in this editor, so the testing module teaches them and the exercises test the logic underneath. Swift Testing is the current one; XCTest still owns UI testing and performance testing.

- `@Test func totalsTheCart() { }` — one test. `@Test("a readable name")` sets the display name, and a test function may be `async` and `throws`. [docs](https://developer.apple.com/documentation/testing/test)
- `#expect(cart.total == 250)` — the assertion. It takes an ordinary expression and reports both sides when it fails, so there is no family of `XCTAssertX` names to remember. [docs](https://developer.apple.com/documentation/testing/expectations)
- `#require(try value)` — like `#expect`, but stops the test instead of continuing. `let x = try #require(optional)` unwraps or fails. [docs](https://developer.apple.com/documentation/testing/expectations)
- `@Test(arguments: [1, 2, 3])` — one test run once per argument, each reported separately. [docs](https://developer.apple.com/documentation/testing/parameterizedtesting)
- `@Suite("Cart")` — a group of tests, usually a struct; a fresh instance per test, so `init` is the setup and there is no shared state to leak. [docs](https://developer.apple.com/documentation/testing/organizingtests)
- `XCTestCase` with `func testX()`, `XCTAssertEqual(_:_:)`, `setUp()`/`tearDown()` — the older framework. You will still meet it. [docs](https://developer.apple.com/documentation/xctest)
- `XCUIApplication()`, `app.launch()`, `app.buttons["addToCart"].tap()`, `app.staticTexts["total"].waitForExistence(timeout: 2)` — UI tests, driving the app from outside. Query by the `accessibilityIdentifier` you set, not by visible text, which is localised. `app.debugDescription` prints the whole element tree the queries see, which is the fastest way to find out why a query matched nothing. [docs](https://developer.apple.com/documentation/xctest/xcuiapplication)
- `@testable import ShopKit` — gives the test target access to `internal` declarations. It does not reach `private` ones. [docs](https://developer.apple.com/documentation/xcode/testing-your-apps-in-xcode)

## Swift Package Manager

A package is described by a `Package.swift` manifest: `platforms`, `products` (`.library`), `targets` (`.target`, `.testTarget`) and `dependencies`. Targets are what compile; products are what other packages see.

Version requirements decide which release resolution picks, and the three you write are:

- `.upToNextMajor(from: "2.3.0")` — `2.3.0` up to but not including `3.0.0`. The default for `.package(url:from:)`, and the right one for a library that respects semantic versioning.
- `.upToNextMinor(from: "2.3.0")` — `2.3.0` up to but not including `2.4.0`. For a dependency you do not trust to keep its promises.
- `.exact("2.3.0")` — that release and no other. Safe and brittle; it makes two dependencies that disagree unresolvable.

A range works too, `"2.3.0"..<"2.5.0"`. Resolution picks the **highest** version that satisfies every requirement at once, writes it to `Package.resolved`, and that file belongs in version control so everyone builds the same thing.

Docs: [Package.swift manifest](https://developer.apple.com/documentation/packagedescription), [Adding package dependencies to your app](https://developer.apple.com/documentation/xcode/adding-package-dependencies-to-your-app)
