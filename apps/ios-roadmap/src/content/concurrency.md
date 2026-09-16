# Concurrency & MainActor

An app spends most of its life waiting — for a server, for a disk, for the user — and the whole craft of iOS concurrency is doing that waiting without freezing the screen and without two pieces of code stepping on the same state. Swift's answer is `async`/`await` for the waiting, actors for the state, and a compiler that checks the two fit together. SwiftUI's answer is `.task`, which ties a piece of async work to the lifetime of a view.

## Async work in a view

A view's `body` is synchronous and always will be: it must produce a picture right now. Async work therefore happens *beside* the body, in a model, and the body renders whatever state that work has reached.

```swift
@MainActor
@Observable
final class FeedModel {
    private(set) var state: LoadState = .loading

    func load() async {
        state = .loading
        do { state = .loaded(try await api.posts()) }
        catch { state = .failed(error) }
    }
}
```

The pattern is always the same: an enum with the three states a load can be in, a method that walks through them, and a body that switches. Resist the temptation to keep a `Bool` for loading and an array for the results and an optional error — three properties can express states that cannot happen, and one of them will.

## .task and cancellation

`.task { }` starts async work when a view appears and **cancels it when the view goes away**. That second half is the reason to use it over `.onAppear` plus a `Task`.

```swift
.task { await model.load() }
.task(id: query) { await model.search(query) }
```

The `id:` version is the one worth remembering: when the id changes, the running task is cancelled and a new one starts. A search field that reruns on every keystroke, cancelling the request that is now out of date, is that one line.

Cancellation in Swift is **cooperative**. Nothing is killed. A cancelled task keeps running until it notices, and it notices in one of three ways:

- `Task.isCancelled` — a `Bool` you check.
- `try Task.checkCancellation()` — throws `CancellationError` if cancelled.
- a suspending call that throws on cancellation, `Task.sleep` chief among them.

Which means `try? await Task.sleep(...)` quietly *swallows* cancellation: the sleep returns early, the loop keeps going, and the work you meant to stop runs to the end. If you write `try?` around a sleep, check cancellation yourself on the next line. That is the first exercise, and it is a bug that ships often.

## MainActor, and where it belongs

`@MainActor` means "this runs on the main thread". UI state has to, and SwiftUI enforces it.

Put it on the *model*, not on individual methods:

```swift
@MainActor
@Observable
final class FeedModel { ... }
```

An `async` method of a `@MainActor` type still suspends at every `await` and still lets the main thread draw — being main-actor-isolated is about where your code resumes, not about blocking. What must not happen on the main actor is expensive synchronous work: parsing a large JSON document, resizing an image, sorting a hundred thousand rows. Push those into a `nonisolated` function or an actor of their own, `await` the result, and assign it on the main actor.

`await` on a call into another actor is the hand-off; the compiler inserts it precisely where the isolation changes, so the `await`s in your code are a map of where the thread might switch.

## Actors for shared state

An `actor` protects its own mutable state: only one task is inside it at a time, so its properties cannot be read and written concurrently. From outside, every access is `await`.

```swift
actor TokenStore {
    private var token: String?
    func current() -> String? { token }
    func set(_ new: String) { token = new }
}
```

Actors are **reentrant**: a method that suspends at an `await` lets another task in, so anything you checked before a suspension may have changed after it. The practical rule is to do your bookkeeping *before* the first `await` in a method. Registering an in-flight task in a dictionary, then awaiting it, is safe; awaiting first and registering after is a race, and it is the difference between the third exercise passing and failing.

## Sendable

`Sendable` marks a type safe to hand from one concurrent context to another. Value types made of `Sendable` parts get it for free; actors always are; a class with mutable state is not, and the compiler will refuse to let one cross.

You will meet it mostly on closures. A closure captured into a `Task` has to be `@Sendable`, and so does a closure parameter you intend to store and run later:

```swift
func call(_ work: @escaping @Sendable () async -> Void)
```

`@escaping` because it outlives the call; `@Sendable` because it will run somewhere else. When the compiler complains here it is almost always right: something mutable and unprotected is about to be touched from two places.

## Structured and unstructured work

`async let` and `withTaskGroup` create **child** tasks: they cannot outlive the scope that made them, they are cancelled if the parent is, and the parent cannot return until they finish. That is structured concurrency, and it is what you want by default.

`Task { }` is **unstructured**: it starts work that outlives the function that created it. It inherits the current actor — a `Task { }` inside a `@MainActor` method runs on the main actor — but nothing waits for it unless you keep the handle and `await` its `value`. Keep the handle whenever you might need to cancel it, which is most of the time; a `Task` you throw away is work you can no longer stop.

`Task.detached { }` inherits nothing, not the actor and not the task-local values. It is right far less often than it is written.

## Debouncing and the last keystroke

A field that fires a request on every keystroke sends five requests for "pens" and shows the answer to whichever one is slowest. Debouncing fixes it: wait for a pause, and if another call arrives first, throw the pending one away.

In a view, `.task(id:)` already does this — the framework cancels the previous run for you. Away from a view, a small actor holding a pending `Task` does the same thing, and writing one is the clearest way to see what `.task(id:)` is doing on your behalf.

```swift playground
actor Recorder {
    private(set) var values: [String] = []
    func record(_ value: String) { values.append(value) }
    var count: Int { values.count }
    var last: String? { values.last }
}

/// Coalesces a burst of calls into the last one.
actor Debouncer {
    private let delay: Duration
    private var pending: Task<Void, Never>?

    init(delay: Duration) { self.delay = delay }

    func call(_ work: @escaping @Sendable () async -> Void) {
        pending?.cancel()
        let delay = self.delay
        pending = Task {
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await work()
        }
    }
}

let recorder = Recorder()
let debouncer = Debouncer(delay: .milliseconds(120))
for keystroke in ["p", "pe", "pen", "pens"] {
    await debouncer.call { await recorder.record(keystroke) }
    try? await Task.sleep(for: .milliseconds(25))
}
try? await Task.sleep(for: .milliseconds(300))
print("requests sent:", await recorder.count, "for:", await recorder.last ?? "-")

// Cancellation is cooperative: `try?` around a sleep throws the notice away.
func steps(_ n: Int, checking: Bool) async -> Int {
    var done = 0
    for _ in 0..<n {
        if checking && Task.isCancelled { break }
        try? await Task.sleep(for: .milliseconds(20))
        done += 1
    }
    return done
}

for checking in [false, true] {
    let task = Task { await steps(10, checking: checking) }
    try? await Task.sleep(for: .milliseconds(50))
    task.cancel()
    let label = checking ? "checks Task.isCancelled" : "only `try?`s the sleep"
    print(label, "->", await task.value, "of 10 steps ran after cancelling")
}
```

## Exercises

### 1. A loader that stops when it is told to

`loadAll` fetches a list of ids **one at a time, in order**, recording each result in the `Progress` actor as it arrives, and returns them all. `fetchOne` takes about 20ms and — like a great deal of real code — swallows cancellation with `try?`, so `loadAll` has to notice on its own.

Before each fetch, check for cancellation and throw `CancellationError` if the task has been cancelled. A cancelled load must not start work it was told to skip.

```swift starter
actor Progress {
    private(set) var loaded: [String] = []
    func add(_ value: String) { loaded.append(value) }
    var count: Int { loaded.count }
}

/// Stands in for a network call. Note the `try?`: it throws cancellation away.
func fetchOne(_ id: Int) async -> String {
    try? await Task.sleep(for: .milliseconds(20))
    return "item-\(id)"
}

func loadAll(_ ids: [Int], into progress: Progress) async throws -> [String] {
    return []
}
```

```swift test
/// everything arrives, in order
func testLoadsEverything() async {
    let progress = Progress()
    let got = try? await loadAll([1, 2, 3], into: progress)
    expect(got, ["item-1", "item-2", "item-3"])
    expect(await progress.loaded, ["item-1", "item-2", "item-3"])
}

/// nothing to load
func testEmpty() async {
    let progress = Progress()
    expect(try? await loadAll([], into: progress), [])
    expect(await progress.count, 0)
}

/// one at a time, not all at once
func testSequential() async {
    let progress = Progress()
    let start = ContinuousClock.now
    let got = try? await loadAll([1, 2, 3, 4, 5], into: progress)
    let elapsed = ContinuousClock.now - start
    expect(got?.count, 5)
    expect(elapsed > .milliseconds(80), "five 20ms fetches in order should take about 100ms, took \(elapsed)")
}

/// cancelling halfway stops the rest and throws
func testCancelHalfway() async {
    let progress = Progress()
    let task = Task { try await loadAll([1, 2, 3, 4, 5, 6, 7, 8], into: progress) }
    try? await Task.sleep(for: .milliseconds(60))
    task.cancel()
    expect(try? await task.value, nil)
    let done = await progress.count
    expect(done < 8, "cancelled after about three fetches, but \(done) of 8 ran")
}

/// cancelled before it really got going
func testCancelEarly() async {
    let progress = Progress()
    let task = Task { try await loadAll([1, 2, 3, 4, 5], into: progress) }
    task.cancel()
    expect(try? await task.value, nil)
    let done = await progress.count
    expect(done <= 1, "cancelled at once, but \(done) fetches ran")
}
```

#### Uses
- [Concurrency & MainActor › .task and cancellation](#/concurrency/task-and-cancellation)
- [Concurrency & MainActor › Actors for shared state](#/concurrency/actors-for-shared-state)

#### Hints
- The shape is a plain `for` loop over `ids`, collecting into a local array and returning it at the end.
- `try Task.checkCancellation()` is the first line of the loop body. It throws `CancellationError` when the task has been cancelled and does nothing otherwise.
- Each step is `let value = await fetchOne(id)`, then `await progress.add(value)`, then append to your local array.
- The tests read `try? await task.value`, so the thrown error shows up as `nil` rather than as a crash.

#### Tips
- `try? await Task.sleep(...)` is everywhere in sample code, and every occurrence is a place cancellation goes to die. If you write it, check `Task.isCancelled` on the next line.
- Checking *before* the fetch rather than after is deliberate: the point of cancellation is not doing the work, not discarding it afterwards.
- `Progress` is an actor because the loader and the test look at it from different tasks. The same thing as a `class` would not even compile here, which is the compiler doing its job.

#### Docs
- [Task cancellation](https://developer.apple.com/documentation/swift/task#Cancellation)
- [checkCancellation()](https://developer.apple.com/documentation/swift/task/checkcancellation())

### 2. One request, not five

Write the `Debouncer` actor. `call(_:)` schedules some work to run after `delay`, and **replaces** anything already scheduled, so a burst of calls runs only the last one. `cancel()` drops whatever is pending without running it.

```swift starter
actor Recorder {
    private(set) var values: [String] = []
    func record(_ value: String) { values.append(value) }
    var count: Int { values.count }
    var last: String? { values.last }
}

actor Debouncer {
    private let delay: Duration

    init(delay: Duration) {
        self.delay = delay
    }

    func call(_ work: @escaping @Sendable () async -> Void) {
    }

    func cancel() {
    }
}
```

```swift test
/// a burst of typing sends one request
func testBurst() async {
    let recorder = Recorder()
    let debouncer = Debouncer(delay: .milliseconds(150))
    for _ in 0..<5 {
        await debouncer.call { await recorder.record("x") }
        try? await Task.sleep(for: .milliseconds(20))
    }
    try? await Task.sleep(for: .milliseconds(400))
    expect(await recorder.count, 1)
}

/// and it is the last one that wins
func testLastWins() async {
    let recorder = Recorder()
    let debouncer = Debouncer(delay: .milliseconds(150))
    for query in ["p", "pe", "pen", "pens"] {
        await debouncer.call { await recorder.record(query) }
        try? await Task.sleep(for: .milliseconds(20))
    }
    try? await Task.sleep(for: .milliseconds(400))
    expect(await recorder.values, ["pens"])
}

/// calls further apart than the delay each get through
func testSpacedOut() async {
    let recorder = Recorder()
    let debouncer = Debouncer(delay: .milliseconds(60))
    await debouncer.call { await recorder.record("a") }
    try? await Task.sleep(for: .milliseconds(250))
    await debouncer.call { await recorder.record("b") }
    try? await Task.sleep(for: .milliseconds(250))
    expect(await recorder.values, ["a", "b"])
}

/// nothing runs before the delay is up
func testWaits() async {
    let recorder = Recorder()
    let debouncer = Debouncer(delay: .milliseconds(200))
    await debouncer.call { await recorder.record("a") }
    try? await Task.sleep(for: .milliseconds(50))
    expect(await recorder.count, 0)
    try? await Task.sleep(for: .milliseconds(400))
    expect(await recorder.count, 1)
}

/// cancelling drops the pending call
func testCancel() async {
    let recorder = Recorder()
    let debouncer = Debouncer(delay: .milliseconds(150))
    await debouncer.call { await recorder.record("a") }
    try? await Task.sleep(for: .milliseconds(20))
    await debouncer.cancel()
    try? await Task.sleep(for: .milliseconds(400))
    expect(await recorder.count, 0)
}
```

#### Uses
- [Concurrency & MainActor › Debouncing and the last keystroke](#/concurrency/debouncing-and-the-last-keystroke)
- [Concurrency & MainActor › Structured and unstructured work](#/concurrency/structured-and-unstructured-work)
- [Concurrency & MainActor › Sendable](#/concurrency/sendable)

#### Hints
- Keep the pending work in a property: `private var pending: Task<Void, Never>?`.
- `call` is three steps: `pending?.cancel()`, then `pending = Task { ... }`, and inside that task sleep for the delay and then run `work`.
- `try? await Task.sleep(for: delay)` returns early when the task is cancelled, so follow it with `guard !Task.isCancelled else { return }` before calling `work()`.
- Reading `self.delay` inside the `Task` closure would mean hopping back onto the actor; capture it first with `let delay = self.delay` on the line above.

#### Tips
- This is unstructured work on purpose: `call` has to return immediately so the keystroke is not held up, which means nobody is awaiting the task. Holding the handle in a property is what keeps it cancellable.
- In a SwiftUI view you rarely need this type, because `.task(id: query)` cancels the previous run for you. Writing it once makes what that modifier does concrete.
- A debouncer that fires on the *leading* edge instead — run immediately, then ignore calls for a while — is a different control, usually right for buttons and wrong for text fields.

#### Docs
- [Task](https://developer.apple.com/documentation/swift/task)
- [Task.sleep(for:tolerance:clock:)](https://developer.apple.com/documentation/swift/task/sleep(for:tolerance:clock:))

### 3. A cache a hundred callers can share

Ten rows scroll on screen at once and all ask for the same avatar. Naively that is ten downloads. Finish `ImageCache` so it is one.

`value(for:load:)` returns the cached value if there is one; otherwise it starts the load, remembers the *in-flight* task, and hands the same task's result to every caller that arrives while it is running. Once it finishes, the value is cached and the in-flight entry goes away.

```swift starter
actor Loader {
    private(set) var calls: [String] = []
    var count: Int { calls.count }

    func load(_ key: String) async -> String {
        calls.append(key)
        try? await Task.sleep(for: .milliseconds(40))
        return "value-\(key)"
    }
}

actor ImageCache {
    private var cached: [String: String] = [:]

    func value(for key: String, load: @escaping @Sendable (String) async -> String) async -> String {
        return await load(key)
    }
}
```

```swift test
/// the second ask does not load again
func testCaches() async {
    let loader = Loader()
    let cache = ImageCache()
    let first = await cache.value(for: "a") { await loader.load($0) }
    let second = await cache.value(for: "a") { await loader.load($0) }
    expect(first, "value-a")
    expect(second, "value-a")
    expect(await loader.count, 1)
}

/// different keys are different loads
func testDistinctKeys() async {
    let loader = Loader()
    let cache = ImageCache()
    expect(await cache.value(for: "a") { await loader.load($0) }, "value-a")
    expect(await cache.value(for: "b") { await loader.load($0) }, "value-b")
    expect(await cache.value(for: "a") { await loader.load($0) }, "value-a")
    expect(await loader.calls, ["a", "b"])
}

/// a hundred callers at once, still one load per key
func testStampede() async {
    let loader = Loader()
    let cache = ImageCache()
    let values = await withTaskGroup(of: String.self) { group in
        for i in 0..<100 {
            group.addTask { await cache.value(for: "k\(i % 4)") { await loader.load($0) } }
        }
        var out: [String] = []
        for await value in group { out.append(value) }
        return out.sorted()
    }
    expect(await loader.count, 4)
    expect(values.count, 100)
    expect(Set(values), ["value-k0", "value-k1", "value-k2", "value-k3"])
}

/// sharing the in-flight task is what makes it fast
func testShared() async {
    let loader = Loader()
    let cache = ImageCache()
    let start = ContinuousClock.now
    await withTaskGroup(of: String.self) { group in
        for _ in 0..<50 {
            group.addTask { await cache.value(for: "same") { await loader.load($0) } }
        }
        for await _ in group {}
    }
    let elapsed = ContinuousClock.now - start
    expect(await loader.count, 1)
    expect(elapsed < .milliseconds(500), "fifty callers sharing one 40ms load took \(elapsed)")
}

/// everything is still correct after the stampede
func testAfterwards() async {
    let loader = Loader()
    let cache = ImageCache()
    await withTaskGroup(of: Void.self) { group in
        for i in 0..<30 { group.addTask { _ = await cache.value(for: "k\(i % 3)") { await loader.load($0) } } }
    }
    expect(await cache.value(for: "k0") { await loader.load($0) }, "value-k0")
    expect(await cache.value(for: "k2") { await loader.load($0) }, "value-k2")
    expect(await loader.count, 3)
}
```

#### Uses
- [Concurrency & MainActor › Actors for shared state](#/concurrency/actors-for-shared-state)
- [Concurrency & MainActor › Structured and unstructured work](#/concurrency/structured-and-unstructured-work)
- [Concurrency & MainActor › Sendable](#/concurrency/sendable)

#### Hints
- You need a second dictionary: `private var inFlight: [String: Task<String, Never>] = [:]`.
- The order inside `value(for:load:)` is the whole exercise. Return a cached hit; otherwise, if there is an in-flight task for the key, `return await task.value`; otherwise make one.
- Make the task and **store it before you await it**: `let task = Task { await load(key) }`, then `inFlight[key] = task`, and only then `let value = await task.value`.
- When the value arrives, put it in `cached` and set `inFlight[key] = nil`.

#### Tips
- Actors are reentrant, so every `await` inside one is a door other callers can walk through. Anything that has to be true for the next caller must be written down *before* the first `await` — that is why storing the task first matters, and it is a race you would never reproduce by hand.
- `await task.value` on the same `Task` from a hundred callers is fine: they all suspend on one result rather than starting a hundred loads. That is the cheap version of what a real image pipeline does.
- A cache with no eviction is a memory leak with good manners. For images, a real app reaches for `NSCache` or a bounded LRU; this exercise is about the in-flight half, which neither of those gives you.

#### Docs
- [Actors](https://developer.apple.com/documentation/swift/actor)
- [Task.value](https://developer.apple.com/documentation/swift/task/value-swift.property)

### 4. A screen that loads, fails and retries

Build the standard loading screen: one enum of states, a `@MainActor` model, `.task` to start the work and `.refreshable` to do it again.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `PostAPI` protocol with one `func posts() async throws -> [Post]`, a live implementation, and a `StubAPI` used only by previews.
- A `@MainActor @Observable final class FeedModel` holding one `private(set) var state` of an enum with `loading`, `loaded([Post])` and `failed(String)` — no separate `isLoading` flag and no separate error property.
- `load()` catching `CancellationError` separately and leaving the state alone for it, because a cancelled load is not a failure to show the user.
- A body that `switch`es over the state: `ProgressView`, a `List`, or a `ContentUnavailableView` with a "Try again" button.
- `.task { await model.load() }` on the content, so the load starts on appear and is cancelled if the view goes away.
- `.refreshable { await model.load() }` for pull-to-refresh.
- Two `#Preview`s using the stub — one that loads, one that fails.

```swift solution
// Post.swift
struct Post: Identifiable, Hashable {
    let id: Int
    let title: String
}

// PostAPI.swift
protocol PostAPI: Sendable {
    func posts() async throws -> [Post]
}

struct StubAPI: PostAPI {
    var result: Result<[Post], Error> = .success([Post(id: 1, title: "Hello")])

    func posts() async throws -> [Post] {
        try await Task.sleep(for: .milliseconds(300))
        return try result.get()
    }
}

// FeedModel.swift
@MainActor
@Observable
final class FeedModel {
    enum State {
        case loading
        case loaded([Post])
        case failed(String)
    }

    private(set) var state: State = .loading
    private let api: PostAPI

    init(api: PostAPI) {
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            state = .loaded(try await api.posts())
        } catch is CancellationError {
            // The view went away. Nothing failed, so say nothing.
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

// FeedScreen.swift
struct FeedScreen: View {
    @State private var model: FeedModel

    init(api: PostAPI) {
        _model = State(wrappedValue: FeedModel(api: api))
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Feed")
                .task { await model.load() }
                .refreshable { await model.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView("Loading")
        case .loaded(let posts):
            List(posts) { post in
                Text(post.title)
            }
        case .failed(let message):
            ContentUnavailableView {
                Label("Could not load the feed", systemImage: "wifi.slash")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") {
                    Task { await model.load() }
                }
            }
        }
    }
}

#Preview("Loaded") {
    FeedScreen(api: StubAPI(result: .success([
        Post(id: 1, title: "A quiet week"),
        Post(id: 2, title: "Two quiet weeks"),
    ])))
}

#Preview("Failed") {
    FeedScreen(api: StubAPI(result: .failure(URLError(.notConnectedToInternet))))
}
```

#### Uses
- [Concurrency & MainActor › Async work in a view](#/concurrency/async-work-in-a-view)
- [Concurrency & MainActor › .task and cancellation](#/concurrency/task-and-cancellation)
- [Concurrency & MainActor › MainActor, and where it belongs](#/concurrency/mainactor-and-where-it-belongs)
- [Reference › SwiftUI lists and navigation](#/reference/swiftui-lists-and-navigation)

#### Hints
- `@MainActor` on the class, not on each method. Every property write then happens where SwiftUI needs it, and the compiler stops you assigning from anywhere else.
- `.task` is attached to the content, not to the `NavigationStack`, so it starts and stops with the thing that is actually on screen.
- `ContentUnavailableView { label } description: { } actions: { }` is the three-part form, which is the one with a button in it.
- `_model = State(wrappedValue: ...)` in `init` is how a `@State` object gets a dependency passed in. Writing `@State private var model = FeedModel(api: ...)` and then ignoring the init parameter is the mistake that makes previews untestable.

#### Tips
- Catching `CancellationError` separately is the detail that separates a calm app from a flickering one. Without it, every navigation away paints an error the user never asked about.
- `.refreshable` gives you pull-to-refresh for free and hands you an `async` closure, so there is nothing to manage: the spinner stays until your `await` returns.
- `error.localizedDescription` is fine in a first pass and wrong in the end: it leaks `URLError` wording to users. A module later covers mapping errors into sentences a person wants to read.

#### Docs
- [task(priority:_:)](https://developer.apple.com/documentation/swiftui/view/task(priority:_:))
- [ContentUnavailableView](https://developer.apple.com/documentation/swiftui/contentunavailableview)
- [refreshable(action:)](https://developer.apple.com/documentation/swiftui/view/refreshable(action:))

### 5. A search field that keeps up with typing

Build the search screen: type, pause, one request. `.task(id:)` does the debouncing and the cancelling, so almost all of exercise 2 disappears into one modifier — which is exactly the point.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `@MainActor @Observable` model with `var query`, `private(set) var results` and `private(set) var isSearching`.
- `.searchable(text: $model.query)` on the list, bound straight to the model's query.
- `.task(id: model.query) { ... }` so a new keystroke cancels the run in flight and starts a fresh one.
- Inside that task: `try await Task.sleep(for: .milliseconds(300))` as the pause, then the search. Cancellation during the sleep must leave the results alone.
- An empty query clearing the results without making a request at all.
- `isSearching` set and cleared around the request, shown as a `ProgressView` overlay, and an `.overlay` `ContentUnavailableView.search(text:)` when a finished search found nothing.
- A `#Preview` with a stub search API.

```swift solution
// SearchAPI.swift
protocol SearchAPI: Sendable {
    func search(_ query: String) async throws -> [String]
}

struct StubSearch: SearchAPI {
    func search(_ query: String) async throws -> [String] {
        try await Task.sleep(for: .milliseconds(250))
        return ["Pens", "Pencils", "Pads"].filter { $0.lowercased().hasPrefix(query.lowercased()) }
    }
}

// SearchModel.swift
@MainActor
@Observable
final class SearchModel {
    var query = ""
    private(set) var results: [String] = []
    private(set) var isSearching = false
    private let api: SearchAPI

    init(api: SearchAPI) {
        self.api = api
    }

    /// Called from `.task(id:)`, so cancellation arrives as a thrown error and there is nothing to clean up.
    func search() async {
        let query = self.query.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else {
            results = []
            return
        }
        isSearching = true
        defer { isSearching = false }
        do {
            try await Task.sleep(for: .milliseconds(300))   // the pause that makes it one request
            results = try await api.search(query)
        } catch {
            // Cancelled by the next keystroke, or the request failed. Either way, keep what is on screen.
        }
    }
}

// SearchScreen.swift
struct SearchScreen: View {
    @State private var model: SearchModel

    init(api: SearchAPI) {
        _model = State(wrappedValue: SearchModel(api: api))
    }

    var body: some View {
        NavigationStack {
            List(model.results, id: \.self) { result in
                Text(result)
            }
            .navigationTitle("Search")
            .searchable(text: $model.query, prompt: "Stationery")
            .task(id: model.query) {
                await model.search()
            }
            .overlay {
                if model.isSearching {
                    ProgressView()
                } else if model.results.isEmpty && !model.query.isEmpty {
                    ContentUnavailableView.search(text: model.query)
                }
            }
        }
    }
}

#Preview {
    SearchScreen(api: StubSearch())
}
```

#### Uses
- [Concurrency & MainActor › Debouncing and the last keystroke](#/concurrency/debouncing-and-the-last-keystroke)
- [Concurrency & MainActor › .task and cancellation](#/concurrency/task-and-cancellation)
- [Concurrency & MainActor › Async work in a view](#/concurrency/async-work-in-a-view)

#### Hints
- `.task(id: model.query)` restarts whenever the query changes and cancels the previous run — that restart *is* the debounce, once there is a sleep at the front of the work.
- Use `try await Task.sleep`, not `try?`. You want the cancellation to throw so the lines after it never run.
- `defer { isSearching = false }` clears the flag on every path out, including the thrown one.
- `ContentUnavailableView.search(text:)` is the built-in "No results for …" view; there is no need to write one.

#### Tips
- Watch what happened to exercise 2: the debouncer became a `sleep` at the top of a `.task(id:)`. When the framework already owns the lifetime, the machinery you would have written turns into ordering.
- Deciding to keep the old results on a cancelled search is a product choice, not an accident. Clearing them instead makes the list flash empty between keystrokes, which looks broken.
- `guard !query.isEmpty` before anything else stops the app searching for nothing every time the user clears the field — one of the easiest ways to double your request count.

#### Docs
- [task(id:priority:_:)](https://developer.apple.com/documentation/swiftui/view/task(id:priority:_:))
- [searchable(text:placement:prompt:)](https://developer.apple.com/documentation/swiftui/view/searchable(text:placement:prompt:)-1bjj3)
- [Observable](https://developer.apple.com/documentation/observation/observable())
