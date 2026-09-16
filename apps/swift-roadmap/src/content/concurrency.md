# Concurrency

Swift's concurrency model is built into the language rather than bolted on as a library. `async` marks a function that can suspend, `await` marks the points where it does, and the compiler tracks which data crosses between concurrent contexts — so a data race is usually a compile error rather than a bug you find in production at 3am.

The model is *structured*: concurrent work is created inside a scope and cannot outlive it. That makes the lifetime question — who is still running, and when does it stop — answerable by reading the code, the same way a `for` loop's lifetime is.

## async and await

An `async` function may suspend: it gives up its thread, lets other work run, and resumes later. Every call to one is marked `await`, so the suspension points are visible.

```swift
func loadName() async -> String {
    try? await Task.sleep(for: .milliseconds(50))
    return "Ada"
}

let name = await loadName()
```

`await` is not "wait here doing nothing". The thread is released while the call is suspended. What it *is*, by itself, is sequential: two `await`s in a row run one after the other. Getting things to overlap takes `async let` or a task group.

An `async` function can also be `throws`, and then calls read `try await`.

## Task

A `Task` starts concurrent work from a synchronous context, or alongside the code that created it. `task.value` awaits its result, and `task.cancel()` asks it to stop.

```swift
let task = Task { await loadName() }
let name = await task.value
```

Cancellation is cooperative: nothing is killed. `Task.isCancelled` is a flag you check, and the suspending calls in the standard library — `Task.sleep` among them — throw `CancellationError` when cancelled, which is why `try?` around a sleep is so common.

`Task { }` inherits the actor context it was created in. Written inside an actor's method or a `@MainActor` function, the new task runs on that same actor, which means it can touch the isolated state without `await` — and also that it queues behind everything else on that actor. `Task.detached { }` is the version that inherits nothing; it needs `await` for every actor access and is the right choice far less often than it looks.

A `Task` is also *unstructured*: unlike `async let` and a task group, it outlives the scope that created it unless you await its `value`. Nothing stops the enclosing function returning while the task is still running.

## async let

`async let` starts a child task immediately and binds its result to a name. The work runs while the following lines do, and the first `await` on the name waits for it.

```swift
async let name = loadName()
async let score = loadScore()
let line = "\(await name): \(await score)"   // both ran at the same time
```

Two 50ms fetches take about 50ms this way, not 100ms. The children are bound to the enclosing scope: it cannot return until they are done, and if it throws they are cancelled.

Use `async let` when you know at compile time how many things you are starting.

## Task groups

When the number of children depends on the input, use a group. `withTaskGroup(of:)` creates one, `addTask` adds children, and iterating the group with `for await` yields results **as they finish** — not in the order you added them.

```swift
let squares = await withTaskGroup(of: (Int, Int).self) { group in
    for (i, n) in ns.enumerated() { group.addTask { (i, await slowSquare(n)) } }
    var out = [Int](repeating: 0, count: ns.count)
    for await (i, value) in group { out[i] = value }
    return out
}
```

Carrying the index into the group and writing into a pre-sized array is the standard way to get input order back. `withThrowingTaskGroup` is the throwing version: the first child to throw cancels the rest, and the error comes out of the group.

The group's scope is the whole story — `withTaskGroup` does not return until every child has finished, so nothing escapes.

## Actors

An `actor` is a reference type that protects its own mutable state. Only one task runs inside it at a time, so its properties cannot be read and written concurrently. From outside, every access is `await`, because you may have to queue.

```swift
actor Counter {
    private var n = 0
    func bump() { n += 1 }
    func value() -> Int { n }
}

let counter = Counter()
await counter.bump()
print(await counter.value())
```

Inside the actor, its own methods see the state directly with no `await` at all. This is the answer to the shared-mutable-state problem that a `class` plus a lock used to solve by hand — and unlike a lock, you cannot forget to take it.

Actors are *reentrant*: an actor method that suspends at an `await` lets another task in. State you read before a suspension may have changed after it, so re-check anything you depend on.

## Sendable and isolation

`Sendable` marks a type that is safe to hand to another concurrent context. Value types made of `Sendable` parts are `Sendable` automatically; actors always are; a `class` with mutable state is not, and the compiler will stop you passing one into a `Task`.

That is the rule behind most of the errors you will meet: if a closure running elsewhere captures something mutable and unprotected, it will not compile. The fixes are to use a value type, to put the state in an actor, or — for a global that really is only touched in one place — to write `nonisolated(unsafe)` and take responsibility yourself.

`@MainActor` marks code that must run on the main actor, which is how UI frameworks pin their work to one place.

```swift playground
actor Tally {
    private var counts: [String: Int] = [:]
    func record(_ key: String) { counts[key, default: 0] += 1 }
    func count(of key: String) -> Int { counts[key] ?? 0 }
    func total() -> Int { counts.values.reduce(0, +) }
}

// 500 tasks hammering one actor. Without the actor this would lose updates.
let tally = Tally()
await withTaskGroup(of: Void.self) { group in
    for i in 0..<500 {
        group.addTask { await tally.record(i % 3 == 0 ? "fizz" : "plain") }
    }
}
print("total:", await tally.total(), "fizz:", await tally.count(of: "fizz"))

func slowSquare(_ n: Int) async -> Int {
    try? await Task.sleep(for: .milliseconds(40 - n * 3))
    return n * n
}

// A group finishes out of order, so carry the index and write into a pre-sized array.
func squares(_ ns: [Int]) async -> [Int] {
    await withTaskGroup(of: (Int, Int).self) { group in
        for (i, n) in ns.enumerated() { group.addTask { (i, await slowSquare(n)) } }
        var out = [Int](repeating: 0, count: ns.count)
        for await (i, value) in group { out[i] = value }
        return out
    }
}

let start = ContinuousClock.now
print("squares:", await squares(Array(0..<10)))
print("ten fetches in \(ContinuousClock.now - start), not the 265ms they would take one at a time")

// async let: a fixed number of children, started immediately.
async let a = slowSquare(1)
async let b = slowSquare(2)
print("async let:", await a, await b)
```

## Exercises

### 1. A tally that survives a stampede

Finish the `Tally` actor. `record` adds one to a key's count, `count(of:)` reports a key's count and `0` for a key never seen, `total()` is the sum of every count, and `keys()` lists the recorded keys in sorted order. Hundreds of tasks call `record` at once, so every update has to be counted.

```swift starter
actor Tally {
    private var counts: [String: Int] = [:]

    func record(_ key: String) {
    }

    func count(of key: String) -> Int {
        return 0
    }

    func total() -> Int {
        return 0
    }

    func keys() -> [String] {
        return []
    }
}
```

```swift test
/// counts a handful of calls
func testBasics() async {
    let t = Tally()
    await t.record("a")
    await t.record("b")
    await t.record("a")
    expect(await t.count(of: "a"), 2)
    expect(await t.count(of: "b"), 1)
    expect(await t.total(), 3)
    expect(await t.keys(), ["a", "b"])
}

/// an untouched tally
func testEmpty() async {
    let t = Tally()
    expect(await t.total(), 0)
    expect(await t.keys(), [])
    expect(await t.count(of: "nothing"), 0)
}

/// 300 concurrent tasks all get counted
func testStampede() async {
    let t = Tally()
    await withTaskGroup(of: Void.self) { group in
        for i in 0..<300 {
            group.addTask { await t.record(i % 3 == 0 ? "three" : "other") }
        }
    }
    expect(await t.total(), 300)
    expect(await t.count(of: "three"), 100)
    expect(await t.count(of: "other"), 200)
    expect(await t.keys(), ["other", "three"])
}

/// many keys at once, still exact
func testManyKeys() async {
    let t = Tally()
    await withTaskGroup(of: Void.self) { group in
        for i in 0..<500 {
            group.addTask { await t.record("k\(i % 5)") }
        }
    }
    expect(await t.total(), 500)
    expect(await t.keys(), ["k0", "k1", "k2", "k3", "k4"])
    expect(await t.count(of: "k0"), 100)
    expect(await t.count(of: "k4"), 100)
    expect(await t.count(of: "k9"), 0)
}
```

#### Uses
- [Concurrency › Actors](#/concurrency/actors)
- [Concurrency › Task groups](#/concurrency/task-groups)
- [Concurrency › Sendable and isolation](#/concurrency/sendable-and-isolation)

#### Hints
- Inside the actor there is no `await` and no locking to write: `counts[key, default: 0] += 1` is the whole of `record`.
- `counts.values.reduce(0, +)` is the total; `counts.keys.sorted()` is `keys()`.
- `counts[key] ?? 0` gives the zero for a key that was never recorded.

#### Tips
- The `actor` keyword is doing all the work in the stampede test. The same code in a `final class` would lose updates — and the compiler would not even let you share it with 300 tasks.
- No `await` appears inside the actor's own methods. If you find yourself writing one there, you are calling out to something else and should ask whether you meant to.

#### Docs
- [Actors](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/#Actors)

### 2. Fetch them all at once

`slowLabel` is written for you, and it is deliberately slower for smaller numbers, so results come back in roughly the reverse of the order you asked for. Write `labels(_:)`, which returns one label per input **in the order of the input** and runs the fetches concurrently — doing them one at a time is far too slow for the last test. Inputs are between `0` and `13`.

```swift starter
func slowLabel(_ n: Int) async -> String {
    try? await Task.sleep(for: .milliseconds(40 - n * 3))
    return "item-\(n)"
}

func labels(_ ns: [Int]) async -> [String] {
    return []
}
```

```swift test
/// one label per input, in input order
func testOrder() async {
    expect(await labels([0, 1, 2]), ["item-0", "item-1", "item-2"])
    expect(await labels([5, 0, 9]), ["item-5", "item-0", "item-9"])
}

/// duplicates and single elements
func testShapes() async {
    expect(await labels([3, 3, 3]), ["item-3", "item-3", "item-3"])
    expect(await labels([7]), ["item-7"])
    expect(await labels([]), [])
}

/// the slowest item is first, and it still ends up first
func testSlowestFirst() async {
    expect(await labels([0, 13]), ["item-0", "item-13"])
    expect(await labels([13, 12, 11, 0]), ["item-13", "item-12", "item-11", "item-0"])
}

/// ten fetches take about as long as one
func testConcurrent() async {
    let start = ContinuousClock.now
    let got = await labels(Array(0..<10))
    let elapsed = ContinuousClock.now - start
    expect(got, (0..<10).map { "item-\($0)" })
    expect(elapsed < .milliseconds(150), "ten fetches took \(elapsed); one at a time would be about 265ms")
}
```

#### Uses
- [Concurrency › Task groups](#/concurrency/task-groups)
- [Concurrency › async and await](#/concurrency/async-and-await)
- [Collections › Adding and removing](#/collections/adding-and-removing)

#### Hints
- `await withTaskGroup(of: (Int, String).self) { group in ... }` and `group.addTask { (i, await slowLabel(n)) } ` for each `(i, n)` in `ns.enumerated()`.
- Make the result array before you collect: `var out = [String](repeating: "", count: ns.count)`, then `for await (i, label) in group { out[i] = label }`.
- Returning `out` from the closure is what `withTaskGroup` gives back, so the whole body is one expression.

#### Tips
- A `for ... in ns { out.append(await slowLabel(n)) }` loop gives the right answer and fails `testConcurrent`, because each `await` finishes before the next one starts. That is the difference the group exists for.
- Size the output array before collecting and write by index. Appending as results arrive gives you the finishing order, which here is roughly the reverse of what the test wants.

#### Docs
- [withTaskGroup](https://developer.apple.com/documentation/swift/withtaskgroup(of:returning:isolation:body:))

### 3. Three fetches, one wait

`profile(_:)` returns `"<name> #<rank> (<score>)"` — for example `"Ada #3 (10)"` — built from the three fetches below. Each takes about 60ms, so awaiting them one after another takes about 180ms; the tests require the whole call to finish in well under that, so all three have to be in flight at once.

```swift starter
func fetchName(_ id: Int) async -> String {
    try? await Task.sleep(for: .milliseconds(60))
    return ["Ada", "Grace", "Alan"][id]
}

func fetchScore(_ id: Int) async -> Int {
    try? await Task.sleep(for: .milliseconds(60))
    return (id + 1) * 10
}

func fetchRank(_ id: Int) async -> Int {
    try? await Task.sleep(for: .milliseconds(60))
    return 3 - id
}

func profile(_ id: Int) async -> String {
    return ""
}
```

```swift test
/// builds the line for each id
func testFormat() async {
    expect(await profile(0), "Ada #3 (10)")
    expect(await profile(1), "Grace #2 (20)")
    expect(await profile(2), "Alan #1 (30)")
}

/// one profile does not take three fetches' worth of time
func testParallel() async {
    let start = ContinuousClock.now
    let got = await profile(1)
    let elapsed = ContinuousClock.now - start
    expect(got, "Grace #2 (20)")
    expect(elapsed < .milliseconds(140), "took \(elapsed); three fetches in sequence would be about 180ms")
}

/// three profiles at once are no slower than one
func testManyProfiles() async {
    let start = ContinuousClock.now
    async let a = profile(0)
    async let b = profile(1)
    async let c = profile(2)
    let got = await [a, b, c]
    let elapsed = ContinuousClock.now - start
    expect(got, ["Ada #3 (10)", "Grace #2 (20)", "Alan #1 (30)"])
    expect(elapsed < .milliseconds(140), "took \(elapsed) for three profiles")
}
```

#### Uses
- [Concurrency › async let](#/concurrency/async-let)
- [Concurrency › async and await](#/concurrency/async-and-await)

#### Hints
- Three `async let` bindings, one per fetch, written before anything is awaited.
- Then one string: `"\(await name) #\(await rank) (\(await score))"`.
- `let name = await fetchName(id)` on three lines is the version that fails the timing tests — the binding has to be `async let` for the work to start early.

#### Tips
- Order matters less than you might think: because all three started at the binding, awaiting them in any order costs the same. What must not happen is a plain `await` before the next task is created.
- `async let` starts the work at the binding, so interpolating all three into one string is enough. There is no need to await them into locals first.

#### Docs
- [async let](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/#Calling-Asynchronous-Functions-in-Parallel)

### 4. Sum the scores, fail on the bad one

`fetchScoreJSON` returns a small JSON document after a short delay, except for id `13`, which returns something that will not decode. Write `totalPoints(_:)`: fetch every id concurrently, decode each result, and return the sum of `points`. If any document fails to decode, the whole call throws. An empty list totals `0`.

```swift starter
struct Score: Codable {
    let points: Int
}

func fetchScoreJSON(_ id: Int) async -> String {
    try? await Task.sleep(for: .milliseconds(20))
    return id == 13 ? #"{"oops": true}"# : #"{"points": \#(id * 2)}"#
}

func decodeScore(_ json: String) throws -> Int {
    try JSONDecoder().decode(Score.self, from: Data(json.utf8)).points
}

func totalPoints(_ ids: [Int]) async throws -> Int {
    return 0
}
```

```swift test
/// adds up what it fetched
func testSum() async {
    expect(try? await totalPoints([1, 2, 3]), 12)
    expect(try? await totalPoints([5]), 10)
    expect(try? await totalPoints([0, 0, 7]), 14)
}

/// nothing to fetch
func testEmpty() async {
    expect(try? await totalPoints([]), 0)
    expect(try? await totalPoints([0]), 0)
}

/// a document that will not decode fails the whole call
func testThrows() async {
    expect(try? await totalPoints([13]), nil)
    expect(try? await totalPoints([1, 13, 2]), nil)
    expect(try? await totalPoints([1, 2, 13]), nil)
    expect(try? await totalPoints([1, 2, 3]), 12)
}

/// thirteen fetches overlap
func testConcurrent() async {
    let start = ContinuousClock.now
    let got = (try? await totalPoints(Array(0..<13))) ?? -1
    let elapsed = ContinuousClock.now - start
    expect(got, 156)
    expect(elapsed < .milliseconds(150), "took \(elapsed); thirteen 20ms fetches in sequence would be about 260ms")
}
```

#### Uses
- [Concurrency › Task groups](#/concurrency/task-groups)
- [Codable & JSON › Encoding and decoding](#/codable/encoding-and-decoding)
- [Codable & JSON › When decoding fails](#/codable/when-decoding-fails)

#### Hints
- `try await withThrowingTaskGroup(of: Int.self) { group in ... }` — the throwing group is what lets a child's error come out of the whole call.
- Each child is `group.addTask { try decodeScore(await fetchScoreJSON(id)) }`.
- Order does not matter for a sum, so collect with `for try await points in group { total += points }`.

#### Tips
- When one child throws, the group cancels the others and rethrows. You do not have to catch anything: `totalPoints` is `throws`, so the error travels straight out.
- Use `for try await`, not `for await`. The plain form does not compile over a throwing group, and the error points at the loop rather than at the missing `try`.

#### Docs
- [withThrowingTaskGroup](https://developer.apple.com/documentation/swift/withthrowingtaskgroup(of:returning:isolation:body:))
- [Task cancellation](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/#Task-Cancellation)
