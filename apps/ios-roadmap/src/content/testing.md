# Testing

A test suite is not there to prove the app works. It is there so that in eighteen months someone can change one thing and find out, in under a minute, what else moved. That means most of the value is in tests that are fast, deterministic and about behaviour — and most of the pain comes from the opposite: slow tests, tests that fail on Tuesdays, and tests that break whenever you rename a method without changing what it does.

On iOS you have two frameworks (Swift Testing and XCTest), a preview canvas that is a faster feedback loop than either, and a UI test runner that is powerful and expensive. This module is about spending each one where it pays.

## The pyramid, on iOS

The old shape still holds, with iOS names on it:

- **Many unit tests.** Pure logic: state machines, formatting, merges, decoding, policies. Milliseconds each, no simulator behaviour involved.
- **Some integration tests.** Your code against a real store, a real decoder, a fake network. Tenths of a second.
- **A few UI tests.** The two or three flows that must never break: launch, sign in, buy. Tens of seconds each, and the first thing to go flaky.

The reason for the shape is diagnostic, not dogmatic. When a unit test fails you know which function is wrong. When a UI test fails you know *something* between the tap and the pixel is wrong, and you go and find out by hand.

The practical consequence is where you put your logic. A view that computes as well as draws can only be tested through the UI; the same logic in a model or a free function is a unit test. Most "iOS is hard to test" complaints are really "this logic is inside a view".

## Swift Testing and XCTest

Swift Testing is the current framework: macros, plain functions, `#expect`, parallel by default, parameterised tests built in.

```swift
import Testing
@testable import Trips

@Suite("Badge")
struct BadgeTests {
    @Test func emptyCartShowsZero() {
        #expect(badge(.ready([])) == "0")
    }

    @Test("totals are capped at 99", arguments: [100, 250, 1_000])
    func capped(quantity: Int) {
        #expect(badge(.ready([Item(id: 1, name: "x", qty: quantity)])) == "99+")
    }

    @Test func decodingRejectsRubbish() throws {
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(Trip.self, from: Data("{}".utf8))
        }
    }
}
```

`#expect` records a failure and carries on, so one run tells you everything that is wrong. `try #require(...)` is the other half: it unwraps or stops the test, for when continuing would be meaningless.

XCTest is not deprecated and you will keep writing it, because **UI tests and performance tests are XCTest only**. `XCTestCase`, `XCTAssertEqual`, `setUp`/`tearDown`, `XCTExpectation`. The two frameworks coexist in one target; new logic tests go in Swift Testing, UI tests stay in XCTest.

## Fakes, not mocks

A **fake** is a working implementation that is simpler than the real one: an in-memory store, a canned network client, a clock you move by hand. A **mock** records how it was called so the test can assert on it.

Prefer fakes. A test built on a fake says "given this data, the app behaves like so", and survives refactoring. A test built on a mock says "this method was called twice with these arguments", and fails when you change how something is implemented without changing what it does — which is the definition of a test that costs more than it gives.

This is where the protocol seams from the previous module earn their keep. Anything you can only fake by mocking — a type that constructs its own `URLSession`, a function that calls `Date()` — has to be reworked before it can be tested well. The cheapest fix is almost always to pass the thing in.

Mocks are not forbidden. Verifying that an analytics event fires exactly once, or that a payment is not submitted twice, is genuinely about the call. Just notice that you are asserting on an interaction, and keep it rare.

## Testing async code

`async` tests need no ceremony: mark the test function `async` and `await` what you are testing. The framework awaits it.

```swift
@Test func loadsTrips() async throws {
    let store = InMemoryTripStore(trips: [Trip(name: "Lisbon", startDate: .now)])
    let model = TripListModel(store: store)
    await model.load()
    #expect(model.trips.count == 1)
}
```

What to avoid is real time. `Task.sleep` in a test is a slow test and, eventually, a flaky one. Inject the clock instead — a protocol with a `now`, or Swift's own `Clock` protocol with a test implementation — and move it by hand. A timeout of an hour should be testable in a microsecond.

For code that has to be on the main actor, mark the test `@MainActor`. For code that must *not* deadlock, do not put everything on the main actor out of habit — a test that only passes because everything is serialised is not testing the thing you shipped.

## Previews are the fastest loop

A `#Preview` is not a test, but it is the tightest feedback you have: change a line, see the view redraw, with no build-and-launch cycle. Use it deliberately.

```swift
#Preview("Loaded") { TripList(state: .loaded(.sample)) }
#Preview("Empty") { TripList(state: .empty) }
#Preview("Failed") { TripList(state: .failed("Offline")) }
```

Three previews of the three states catch more layout bugs than any assertion will, because layout bugs are visual. They also push you towards views that take their state as an argument — which is the same design that makes the logic unit-testable. A view you cannot preview without a network call is a view you cannot test either.

## Snapshot and UI tests

A **snapshot test** renders a view, compares it to a stored image, and fails on any difference. It is the only automated way to catch "the button moved 4pt". The cost is maintenance: every intentional design change regenerates images, and rendering differs across OS versions and devices, so pin the simulator and record on one machine or the suite becomes noise.

A **UI test** drives the real app through the accessibility layer:

```swift
let app = XCUIApplication()
app.launchArguments += ["-uiTesting"]
app.launch()
app.buttons["Add trip"].tap()
XCTAssertTrue(app.staticTexts["New trip"].waitForExistence(timeout: 2))
```

Two habits keep them alive. Query by accessibility identifier, not by visible text — text is translated and edited, identifiers are yours. And always `waitForExistence` rather than sleeping: the app is a separate process and its timing is not yours.

Launch arguments are how you make a UI test deterministic: a flag that seeds a fixed in-memory store, disables animations, and skips the "rate us" prompt. A UI test against live data is a test that fails when someone else's data changes.

## Flakiness

A flaky test is one that passes and fails without the code changing. It is worse than no test: the suite goes red so often that a real failure gets waved through.

The causes are always the same short list. Real time and sleeps. Shared state between tests — a singleton, `UserDefaults`, the same on-disk database. Test order dependence, which you notice when tests run in parallel. Real network. Animations that have not settled. And the clock-and-calendar family: a test that passes until it runs at 23:59 on the last day of the month.

Three rules cover most of it: each test builds its own world and tears it down, nothing in a test touches wall-clock time or the network, and a test that fails intermittently is quarantined immediately and fixed or deleted — never re-run until it passes.

```swift playground
import Foundation

// A flaky test is a coin flip you did not know you wrote. Run the same "test" many times
// and the truth comes out: this one is not failing, it is failing *sometimes*.
struct Seeded {
    private var state: UInt64
    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return state >> 33
    }
}

var rng = Seeded(seed: 42)

/// Passes unless the "network" is slow, which it is one time in five.
func requestFinishesInTime() -> Bool {
    let latencyMs = 50 + Int(rng.next() % 100)
    return latencyMs < 130
}

var results: [Bool] = []
for _ in 0..<40 { results.append(requestFinishesInTime()) }

let passed = results.filter { $0 }.count
print("passed \(passed)/40")
print("verdict:", passed == 40 ? "passing" : passed == 0 ? "failing" : "flaky")

// One run tells you nothing. This is why CI reruns matter, and why "it passed on my machine" is not evidence.
print("first five runs:", results.prefix(5).map { $0 ? "pass" : "fail" }.joined(separator: " "))
```

## What is worth testing

Not everything. Tests are code, and code is a liability.

Worth testing: anything with a rule you could get wrong (money, dates, permissions, merges, pagination), anything that has broken before, the decoding of every payload you do not control, and every state machine.

Not worth testing: that SwiftUI lays out a `VStack`, that a getter returns what the setter set, or that a mapping function maps. And do not chase a coverage number — 100% coverage of code with no assertions about behaviour is a suite that costs you time and catches nothing.

## Exercises

### 1. A clock you can move

`Session` expires after a period of inactivity. Real time would make that untestable, so it reads the current time from a `ClockSource` handed to it.

`touch()` records activity at the clock's current time. `isExpired` is `true` once `timeout` seconds have passed since the last activity — at exactly `timeout` it has expired. `secondsRemaining` counts down and never goes below zero. A session starts active at the time it was created.

```swift starter
protocol ClockSource {
    var now: Date { get }
}

final class Session {
    private let timeout: TimeInterval
    private let clock: any ClockSource
    private var lastActivity: Date

    init(timeout: TimeInterval, clock: any ClockSource) {
        self.timeout = timeout
        self.clock = clock
        self.lastActivity = clock.now
    }

    func touch() {
    }

    var isExpired: Bool {
        return false
    }

    var secondsRemaining: TimeInterval {
        return 0
    }
}
```

```swift test
final class TestClock: ClockSource {
    var now: Date
    init(_ now: Date = Date(timeIntervalSince1970: 1_000)) { self.now = now }
    func advance(_ seconds: TimeInterval) { now = now.addingTimeInterval(seconds) }
}

/// a new session is alive
func testStartsActive() {
    let clock = TestClock()
    let session = Session(timeout: 60, clock: clock)
    expect(session.isExpired, false)
    expect(session.secondsRemaining, 60)
}

/// it expires exactly on the timeout
func testExpires() {
    let clock = TestClock()
    let session = Session(timeout: 60, clock: clock)
    clock.advance(59)
    expect(session.isExpired, false)
    expect(session.secondsRemaining, 1)
    clock.advance(1)
    expect(session.isExpired, true)
    expect(session.secondsRemaining, 0)
}

/// activity resets the countdown
func testTouch() {
    let clock = TestClock()
    let session = Session(timeout: 30, clock: clock)
    clock.advance(20)
    session.touch()
    clock.advance(20)
    expect(session.isExpired, false)
    expect(session.secondsRemaining, 10)
    clock.advance(10)
    expect(session.isExpired, true)
}

/// the countdown never goes negative
func testFloor() {
    let clock = TestClock()
    let session = Session(timeout: 10, clock: clock)
    clock.advance(1_000)
    expect(session.secondsRemaining, 0)
    expect(session.isExpired, true)
}

/// an hour-long timeout is tested in no time at all
func testLongTimeout() {
    let clock = TestClock()
    let session = Session(timeout: 3_600, clock: clock)
    clock.advance(3_599)
    expect(session.isExpired, false)
    session.touch()
    clock.advance(3_599)
    expect(session.isExpired, false)
    clock.advance(1)
    expect(session.isExpired, true)
}
```

#### Uses
- [Testing › Testing async code](#/testing/testing-async-code)
- [Testing › Fakes, not mocks](#/testing/fakes-not-mocks)
- [Dependencies & modules › Protocol seams](#/dependencies/protocol-seams)

#### Hints
- `touch()` is one line: `lastActivity = clock.now`.
- `isExpired` is `clock.now.timeIntervalSince(lastActivity) >= timeout`.
- `secondsRemaining` is `max(0, timeout - clock.now.timeIntervalSince(lastActivity))`.

#### Tips
- Every read goes through `clock.now` rather than caching it. A `Session` that remembered "now" at init would be a session that never expires.
- `TestClock` is nine lines, has no framework behind it, and turns a one-hour rule into a microsecond test. That is the entire argument for injecting the clock.
- Swift's own `Clock` protocol, with `ContinuousClock` in production, is the same idea with more power — `Task.sleep(until:clock:)` can be driven by a test clock too.

#### Docs
- [Clock](https://developer.apple.com/documentation/swift/clock)
- [Testing asynchronous code](https://developer.apple.com/documentation/testing/testing-asynchronous-code)

### 2. A fake repository and the states it produces

A list screen has one job before it draws anything: go through the right states. `Loader` calls a repository and records every state it passes through, so a test can assert on the whole sequence rather than just the end.

`load()` appends `.loading` to `history` and sets `state`, then awaits the repository. Non-empty results give `.loaded` with the names exactly as returned; an empty result gives `.empty`, not `.loaded([])`. A thrown `TripError` gives `.failed` carrying its message, and any other error gives `.failed("unknown")`. `state` always equals the last entry in `history`, and calling `load()` again appends to the same history.

```swift starter
struct TripError: Error {
    let message: String
}

protocol TripRepository {
    func fetch() async throws -> [String]
}

enum LoadState: Equatable {
    case idle
    case loading
    case empty
    case loaded([String])
    case failed(String)
}

final class Loader {
    private let repository: any TripRepository
    private(set) var state: LoadState = .idle
    private(set) var history: [LoadState] = [.idle]

    init(repository: any TripRepository) {
        self.repository = repository
    }

    func load() async {
    }
}
```

```swift test
struct FakeRepository: TripRepository {
    var result: Result<[String], Error>
    func fetch() async throws -> [String] { try result.get() }
}

struct CountingRepository: TripRepository {
    let names: [String]
    let calls: Counter
    func fetch() async throws -> [String] { calls.value += 1; return names }
}

final class Counter {
    var value = 0
}

enum OtherError: Error { case boom }

/// the happy path passes through loading
func testLoaded() async {
    let loader = Loader(repository: FakeRepository(result: .success(["Lisbon", "Oslo"])))
    await loader.load()
    expect(loader.state, .loaded(["Lisbon", "Oslo"]))
    expect(loader.history, [.idle, .loading, .loaded(["Lisbon", "Oslo"])])
}

/// nothing to show is its own state
func testEmpty() async {
    let loader = Loader(repository: FakeRepository(result: .success([])))
    await loader.load()
    expect(loader.state, .empty)
    expect(loader.history, [.idle, .loading, .empty])
}

/// a known failure carries its message
func testFailed() async {
    let loader = Loader(repository: FakeRepository(result: .failure(TripError(message: "offline"))))
    await loader.load()
    expect(loader.state, .failed("offline"))
    expect(loader.history, [.idle, .loading, .failed("offline")])
}

/// anything else is reported without pretending to know what it was
func testUnknownFailure() async {
    let loader = Loader(repository: FakeRepository(result: .failure(OtherError.boom)))
    await loader.load()
    expect(loader.state, .failed("unknown"))
}

/// loading twice keeps the whole history
func testReload() async {
    let counter = Counter()
    let loader = Loader(repository: CountingRepository(names: ["Lisbon"], calls: counter))
    await loader.load()
    await loader.load()
    expect(counter.value, 2)
    expect(loader.history, [.idle, .loading, .loaded(["Lisbon"]),
                            .loading, .loaded(["Lisbon"])])
    expect(loader.state, .loaded(["Lisbon"]))
}
```

#### Uses
- [Testing › Fakes, not mocks](#/testing/fakes-not-mocks)
- [Testing › Testing async code](#/testing/testing-async-code)
- [Testing › The pyramid, on iOS](#/testing/the-pyramid-on-ios)

#### Hints
- A small private helper — `func transition(to state: LoadState)` that sets `self.state` and appends to `history` — keeps the two in step and makes `load()` four lines.
- `do { let names = try await repository.fetch() } catch { }` is the shape; the empty check is `names.isEmpty`.
- `catch let error as TripError` first, then a plain `catch` for everything else.

#### Tips
- `.empty` as a state of its own, rather than `.loaded([])` plus an `if` in the view, is the difference between one place deciding what an empty result means and every view deciding again.
- Asserting on the whole `history` catches the bug a final-state assertion misses: a loader that never showed a spinner passes "ends up loaded" and fails this.
- The fake here is a `Result` in a struct. That one type gives you both the success and the failure test without a second fake — and without any framework.

#### Docs
- [Result](https://developer.apple.com/documentation/swift/result)
- [Swift Testing](https://developer.apple.com/documentation/testing)

### 3. Autosave that does not write twice

The editor calls `edited(_:for:)` on every keystroke. Writing to disk on every keystroke is how you get a hot phone, so `Autosaver` only writes when something actually changed.

Save when the text differs from what is currently stored for that id. Do nothing when it is the same. Text that is empty or only whitespace means the draft is gone: remove it, but only if something is stored — removing what is not there is another pointless write. Different ids are independent, and `Autosaver` must ask the store rather than remembering what it wrote.

```swift starter
protocol DraftStore {
    func load(_ id: String) -> String?
    func save(_ text: String, for id: String)
    func remove(_ id: String)
}

struct Autosaver {
    let store: any DraftStore

    func edited(_ text: String, for id: String) {
    }
}
```

```swift test
final class FakeStore: DraftStore {
    var drafts: [String: String] = [:]
    var operations: [String] = []

    func load(_ id: String) -> String? { drafts[id] }

    func save(_ text: String, for id: String) {
        drafts[id] = text
        operations.append("save \(id)=\(text)")
    }

    func remove(_ id: String) {
        drafts[id] = nil
        operations.append("remove \(id)")
    }
}

/// the first edit writes
func testFirstWrite() {
    let store = FakeStore()
    let saver = Autosaver(store: store)
    saver.edited("Hel", for: "a")
    expect(store.drafts["a"], "Hel")
    expect(store.operations, ["save a=Hel"])
}

/// typing the same thing again writes nothing
func testNoRewrite() {
    let store = FakeStore()
    let saver = Autosaver(store: store)
    saver.edited("Hello", for: "a")
    saver.edited("Hello", for: "a")
    saver.edited("Hello", for: "a")
    expect(store.operations, ["save a=Hello"])
}

/// every real change writes once
func testEachChange() {
    let store = FakeStore()
    let saver = Autosaver(store: store)
    for text in ["H", "He", "He", "Hel"] {
        saver.edited(text, for: "a")
    }
    expect(store.operations, ["save a=H", "save a=He", "save a=Hel"])
    expect(store.drafts["a"], "Hel")
}

/// emptying the draft removes it, once
func testRemove() {
    let store = FakeStore()
    let saver = Autosaver(store: store)
    saver.edited("Hello", for: "a")
    saver.edited("", for: "a")
    saver.edited("", for: "a")
    saver.edited("   ", for: "a")
    expect(store.drafts["a"], nil)
    expect(store.operations, ["save a=Hello", "remove a"])
}

/// nothing stored, nothing to remove
func testEmptyFromTheStart() {
    let store = FakeStore()
    let saver = Autosaver(store: store)
    saver.edited("", for: "a")
    saver.edited("  \n ", for: "b")
    expect(store.operations, [])
}

/// ids do not interfere
func testIndependentDrafts() {
    let store = FakeStore()
    let saver = Autosaver(store: store)
    saver.edited("one", for: "a")
    saver.edited("two", for: "b")
    saver.edited("one", for: "a")
    saver.edited("three", for: "b")
    expect(store.operations, ["save a=one", "save b=two", "save b=three"])
    expect(store.drafts["a"], "one")
    expect(store.drafts["b"], "three")
}
```

#### Uses
- [Testing › Fakes, not mocks](#/testing/fakes-not-mocks)
- [Testing › What is worth testing](#/testing/what-is-worth-testing)
- [SwiftData & files › Files and the sandbox](#/persistence/files-and-the-sandbox)

#### Hints
- `text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty` is the "this draft is gone" test.
- For the removal branch, check `store.load(id) != nil` before calling `remove`.
- For the save branch, `guard store.load(id) != text else { return }`.

#### Tips
- Save the untrimmed text but decide emptiness on the trimmed version — a draft of `"Hello "` with a trailing space is still the user's text, and losing it mid-sentence is a bug they will notice.
- `FakeStore` records operations, which makes it a fake with a log rather than a mock: the tests assert on what the store ended up holding *and* on how many times it was written. The second part is the requirement, so here it is worth asserting.
- `Autosaver` asks the store instead of caching the last value it wrote. That is one less piece of state to get out of sync, and it means a draft changed by something else is handled correctly.

#### Docs
- [String.trimmingCharacters(in:)](https://developer.apple.com/documentation/foundation/nsstring/trimmingcharacters(in:))
- [Writing data to a file](https://developer.apple.com/documentation/foundation/data/write(to:options:))

### 4. Triage the suite

CI has run the test suite several times over the same commit. `triage` turns those runs into a verdict per test.

Each run is a dictionary from test name to whether it passed. A test that passed in every run it appeared in is `.passing`; one that failed in every run it appeared in is `.failing`; one that did both is `.flaky`. Tests do not have to appear in every run — a crashed run reports fewer of them — and a test that appears in no run at all is simply not in the result. With no runs, the result is empty.

```swift starter
enum Verdict: String {
    case passing
    case failing
    case flaky
}

func triage(_ runs: [[String: Bool]]) -> [String: Verdict] {
    return [:]
}
```

```swift test
/// one run, everything is either passing or failing
func testSingleRun() {
    expect(triage([["a": true, "b": false]]), ["a": .passing, "b": .failing])
    expect(triage([[:]]), [:])
    expect(triage([]), [:])
}

/// consistent across runs
func testConsistent() {
    let runs = [["a": true, "b": false], ["a": true, "b": false], ["a": true, "b": false]]
    expect(triage(runs), ["a": .passing, "b": .failing])
}

/// mixed results are the interesting ones
func testFlaky() {
    expect(triage([["a": true], ["a": false]]), ["a": .flaky])
    expect(triage([["a": false], ["a": true], ["a": true]]), ["a": .flaky])
    expect(triage([["a": true, "b": true], ["a": false, "b": true]]),
           ["a": .flaky, "b": .passing])
}

/// a run that did not report a test says nothing about it
func testMissingFromARun() {
    expect(triage([["a": true, "b": true], ["a": true]]), ["a": .passing, "b": .passing])
    expect(triage([["a": false], [:], ["a": false]]), ["a": .failing])
    expect(triage([[:], [:]]), [:])
}

/// a whole suite
func testSuite() {
    let runs = [
        ["login": true, "checkout": true, "search": false, "sync": true],
        ["login": true, "checkout": false, "search": false, "sync": true],
        ["login": true, "checkout": true, "search": false],
    ]
    expect(triage(runs), ["login": .passing, "checkout": .flaky,
                          "search": .failing, "sync": .passing])
}
```

#### Uses
- [Testing › Flakiness](#/testing/flakiness)
- [Testing › The pyramid, on iOS](#/testing/the-pyramid-on-ios)

#### Hints
- Build `var seen: [String: (passed: Bool, failed: Bool)]` as you walk every run and every entry in it.
- `seen[name, default: (false, false)]` saves you an existence check.
- At the end, map each entry: both flags true is `.flaky`, otherwise `.passing` if it ever passed, `.failing` if it ever failed.

#### Tips
- The distinction between "did not run" and "failed" is the one that matters operationally: a crashed run that reported nothing should not turn your whole suite red, and a test nobody ran is not evidence of anything.
- One run cannot detect flakiness at all, which is why CI systems rerun failures. Two runs can, but only sometimes — a test that fails one time in twenty needs a lot of runs before it is caught.
- `Verdict` has a `String` raw value so a report can print it, and the three cases are the three actions: ship, fix, quarantine.

#### Docs
- [Running tests and interpreting results](https://developer.apple.com/documentation/xcode/running-tests-and-interpreting-results)
- [Handling issues in tests](https://developer.apple.com/documentation/testing/known-issues)

### 5. A real test target

Add tests to the trips app: a Swift Testing suite for the logic, and one XCTest UI test for the flow that must not break.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A unit test target using **Swift Testing**, with `@testable import Trips`, that runs with ⌘U in under a second.
- A `@Suite` containing at least: one plain `@Test`, one `async` test against a fake store, one parameterised `@Test(arguments:)`, and one `#expect(throws:)`.
- One use of `try #require(...)` where continuing after a `nil` would only produce a second, meaningless failure.
- A separate **UI test target** (XCTest) with one test for the add-a-trip flow.
- The UI test launched with an argument the app recognises to seed a fixed in-memory store, and queries by accessibility identifier rather than by visible text.
- Every wait in the UI test done with `waitForExistence(timeout:)` — no `sleep`.

```swift solution
// TripsTests/TripListModelTests.swift
import Testing
import Foundation
@testable import Trips

@Suite("Trip list model")
struct TripListModelTests {

    @Test func startsEmpty() {
        let model = TripListModel(store: InMemoryTripStore())
        #expect(model.trips.isEmpty)
        #expect(model.state == .idle)
    }

    @Test func loadsFromTheStore() async throws {
        let store = InMemoryTripStore(trips: [Trip(name: "Lisbon", startDate: .distantPast)])
        let model = TripListModel(store: store)

        await model.load()

        let first = try #require(model.trips.first)
        #expect(first.name == "Lisbon")
        #expect(model.state == .loaded)
    }

    @Test("blank names are rejected", arguments: ["", " ", "\n", "   \t "])
    func rejectsBlankNames(name: String) {
        #expect(TripDraft(name: name).validate() == .invalid(reason: "Name is required"))
    }

    @Test func savingWithoutANameThrows() async throws {
        let store = FailingTripStore()
        let model = TripListModel(store: store)

        await #expect(throws: TripError.self) {
            try await model.add(name: "")
        }
    }
}

// TripsTests/FailingTripStore.swift — a fake, not a mock: it just always fails.
struct FailingTripStore: TripStore {
    func all() async throws -> [Trip] { throw TripError.unavailable }
    func save(_ trip: Trip) async throws { throw TripError.unavailable }
}

// Trips/TripList.swift — identifiers the UI test can find
Button("Add trip", systemImage: "plus", action: add)
    .accessibilityIdentifier("addTrip")

List(trips) { trip in
    Text(trip.name)
}
.accessibilityIdentifier("tripList")

// Trips/TripsApp.swift — a deterministic world for UI tests
@main
struct TripsApp: App {
    private let store: any TripStore = ProcessInfo.processInfo.arguments.contains("-uiTesting")
        ? InMemoryTripStore(trips: [Trip(name: "Lisbon", startDate: .distantPast)])
        : LiveTripStore()

    var body: some Scene {
        WindowGroup {
            TripList()
                .environment(\.tripStore, store)
        }
    }
}

// TripsUITests/AddTripUITests.swift
import XCTest

final class AddTripUITests: XCTestCase {

    override func setUp() {
        continueAfterFailure = false
    }

    func testAddingATripShowsItInTheList() {
        let app = XCUIApplication()
        app.launchArguments += ["-uiTesting"]
        app.launch()

        let list = app.collectionViews["tripList"]
        XCTAssertTrue(list.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Lisbon"].exists)

        app.buttons["addTrip"].tap()

        XCTAssertTrue(app.staticTexts["New trip"].waitForExistence(timeout: 2))
    }
}
```

#### Uses
- [Testing › Swift Testing and XCTest](#/testing/swift-testing-and-xctest)
- [Testing › Snapshot and UI tests](#/testing/snapshot-and-ui-tests)
- [Testing › Flakiness](#/testing/flakiness)
- [Reference › Swift Testing and XCTest](#/reference/swift-testing-and-xctest)

#### Hints
- File → New → Target → **Unit Testing Bundle** picks Swift Testing in current Xcode; the UI Testing Bundle is a separate target and always XCTest.
- `@testable import` only works against a target built with testability enabled, which is the default for Debug.
- If the UI test cannot find your button, open the Accessibility Inspector or print `app.debugDescription` — the identifier you set in SwiftUI is what the query needs.

#### Tips
- The launch argument is the whole trick for UI test determinism. Without it the test depends on whatever is in the simulator's database from the last run, which is the definition of flaky.
- Assert on the list existing *and* on its contents. A UI test that only checks a screen appeared passes happily against an empty screen.
- Keep the UI suite to the flows you would hot-fix for. Every extra UI test is another minute of CI and another chance of a spurious red.

#### Docs
- [Swift Testing](https://developer.apple.com/documentation/testing)
- [Migrating a test from XCTest](https://developer.apple.com/documentation/testing/migratingfromxctest)
- [User interface tests](https://developer.apple.com/documentation/xctest/user-interface-tests)
