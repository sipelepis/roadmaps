# Dependencies & modules

Every app is mostly code you did not write: the SDK, a handful of packages, and — the part people forget — your own code in one file reaching into your own code in another. Dependencies are not a build-system topic. They decide what you can test, what you can change on a Friday, and how long a clean build takes.

This module covers Swift Package Manager and version pinning, then the more interesting half: cutting your own app into modules, putting protocol seams where the outside world gets in, and wiring the pieces together through the environment or an explicit container.

## Everything you did not write

A dependency is anything your code needs that it does not own. A third-party package is the obvious kind. So is `URLSession`, the Keychain, the clock, the file system, the user's locale and the network itself. The ones that hurt are the invisible ones: a type that calls `Date()` or `URLSession.shared` in the middle of a method has a dependency you cannot see in its signature and cannot replace in a test.

The whole discipline is one habit. Take the things a type needs and make them arguments — to its initializer, or to the function — instead of letting it reach out and grab them.

```swift
// Hidden: nothing in the signature says this touches the network or the clock.
final class TripLoader {
    func load() async throws -> [Trip] {
        let (data, _) = try await URLSession.shared.data(from: URL(string: "https://api.example.com/trips")!)
        return try JSONDecoder().decode([Trip].self, from: data)
    }
}

// Declared: the same work, but you can hand it a fake.
final class TripLoader {
    private let fetch: (URL) async throws -> Data

    init(fetch: @escaping (URL) async throws -> Data) { self.fetch = fetch }
}
```

A closure is a perfectly good seam for one function. A protocol is better when there are several related operations, and it gives the fake a name.

## Swift Package Manager

SPM is built into Xcode: **File → Add Package Dependencies**, or `.package(url:from:)` in a `Package.swift` if the thing you are building is itself a package. A package declares products (libraries other people import), targets (units of compilation) and dependencies.

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TripKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "TripKit", targets: ["TripKit"])
    ],
    targets: [
        .target(name: "TripKit"),
        .testTarget(name: "TripKitTests", dependencies: ["TripKit"])
    ]
)
```

A **local package** — a folder inside your repo, added to the project with *Add Local…* — costs nothing and is the best way to carve up an app. It compiles separately, so its tests do not need the app to launch, and the compiler enforces the boundary: `TripKit` cannot reach into your app target, because it cannot import it.

Before adding a third-party package, price it honestly. It is your build time, your Swift-version upgrades, your App Store review if it collects data, and your 3am problem when it breaks. A package that saves fifty lines is rarely worth it; one that implements a protocol you would get wrong — cryptography, a real database, an image codec — usually is.

## Versioning and pinning

Packages are resolved by semantic version: `MAJOR.MINOR.PATCH`, where major means "this breaks you", minor means "new things, still compatible" and patch means "fixes". The requirement you write is a range, not a version:

- `.upToNextMajor(from: "2.3.0")` — from 2.3.0 up to but not including 3.0.0. The sane default.
- `.upToNextMinor(from: "2.3.0")` — up to but not including 2.4.0. For a dependency you do not trust to respect semver.
- `.exact("2.3.1")` — no movement at all. For the one that broke you.
- A branch or a commit — fine while developing, never in a release.

Resolution picks the **highest** version that satisfies every requirement in the whole graph, and records the answer in `Package.resolved`. That file is the pin, and it belongs in version control: without it, two developers and CI can build three different apps from the same commit. Updating is deliberate — *File → Packages → Update to Latest Package Versions*, then read the diff of `Package.resolved` in the pull request.

## What belongs in a module

A module is a unit of compilation and a wall. Things inside can see each other; things outside see only what is `public`. Good walls are drawn around a *capability*, not around a layer of the architecture: `TripKit` (models, storage and the API client for trips) is a module; `Models`, `Views` and `Services` as three modules is just your app with extra `public` keywords.

Signs a split is working: the module has a short public surface, its tests run without launching the app, and you can describe it in a sentence without using the word "and". Signs it is not: every change touches three modules, or the module imports the app back through a protocol nobody else implements.

Modules also cut build time, because only the ones that changed rebuild — but that is the bonus, not the reason. The reason is that a boundary the compiler enforces is the only kind that survives a deadline.

## Protocol seams

A seam is a place where you can swap the real thing for a fake without changing the code under test. In Swift the tool is a protocol with a small, honest surface:

```swift
protocol TripStore {
    func all() throws -> [Trip]
    func save(_ trip: Trip) throws
}
```

Write the protocol from the *caller's* needs, not from the implementation's capabilities. `TripStore` with two methods can be faked in five lines; a protocol that mirrors every method of `ModelContext` can only be faked by reimplementing SwiftData.

Seams belong at the edges: network, disk, clock, randomness, notifications, analytics, anything with an SDK behind it. Pure logic does not need one — a function that takes values and returns values is already testable, and wrapping it in a protocol adds a layer with one implementation, which is a cost with no buyer.

```swift playground
import Foundation

// A seam is one protocol wide. The report does not know what kind of clock it has.
protocol TimeSource {
    var now: Date { get }
}

struct SystemTime: TimeSource {
    var now: Date { Date() }
}

struct FixedTime: TimeSource {
    let now: Date
}

struct Receipt {
    let item: String
    let cents: Int
    let at: Date
}

func summary(_ receipts: [Receipt], time: some TimeSource) -> String {
    let day: TimeInterval = 86_400
    let recent = receipts.filter { time.now.timeIntervalSince($0.at) < day }
    let total = recent.reduce(0) { $0 + $1.cents }
    return "\(recent.count) receipt(s) in the last day, \(total)c"
}

let noon = Date(timeIntervalSince1970: 1_700_000_000)
let receipts = [
    Receipt(item: "coffee", cents: 350, at: noon.addingTimeInterval(-3_600)),
    Receipt(item: "book", cents: 1_200, at: noon.addingTimeInterval(-90_000)),
]

// Same function, two clocks: one answer is a fact, the other depends on when you read this.
print(summary(receipts, time: FixedTime(now: noon)))
print(summary(receipts, time: FixedTime(now: noon.addingTimeInterval(86_400 * 3))))
print(summary(receipts, time: SystemTime()))
```

## Injecting: the environment or a container

SwiftUI already has a dependency injection system, and it is the environment. Put a value in once, read it anywhere below:

```swift
extension EnvironmentValues {
    @Entry var tripStore: any TripStore = LiveTripStore()
}

// at the top
ContentView().environment(\.tripStore, LiveTripStore())

// anywhere below
@Environment(\.tripStore) private var store
```

That is the right tool when views need the dependency. It is the wrong tool for everything else: a model object that reads the environment has to be a view to do it, and code that is only reachable from a view hierarchy is code you can only test through a view hierarchy.

The alternative is boring and works everywhere: pass dependencies into initializers, and let one **composition root** — usually the `App` struct — build the real object graph.

```swift
@main
struct TripsApp: App {
    private let store = LiveTripStore()

    var body: some Scene {
        WindowGroup {
            TripList(model: TripListModel(store: store))
        }
    }
}
```

A **container** — a registry you ask for things by type — is a third option. It is convenient at scale and it costs you the compiler: a missing registration becomes a crash at runtime instead of an error at build time. Reach for one when constructor injection has genuinely become unwieldy, not before, and keep the registrations in one file so the graph is still readable.

## Lifetimes

Whatever the wiring, each dependency has a lifetime, and getting it wrong is subtle:

- **Singleton** — created once, shared. Right for a database container, a cache, a logger. Wrong for anything holding per-user state, which then survives a logout.
- **Scoped** — one per session, per screen, per document. The one people skip, and the one that actually models most apps.
- **Transient** — a fresh instance for every request. Right for small stateless helpers and for anything you would be unhappy to see two callers share.

A container has to make the choice explicit because it hides the construction. With constructor injection the lifetime is obvious from where the object is stored: a `let` on the `App` struct lives forever, a `@State` model lives as long as the view.

## Keeping the graph acyclic

Module dependencies must form a directed acyclic graph. SPM refuses a cycle outright, and within one target Swift will let you build a cycle of types that is legal to compile and impossible to reason about.

Two modules that need each other are usually one module that has been cut in the wrong place, or two modules plus a third holding what they share. The mechanical version of "is this graph sane?" is a topological sort: repeatedly take a module whose dependencies are all built, and if you run out of those with modules left over, you have a cycle. That is exactly what a build system does before it compiles anything, and it is worth being able to write.

## Exercises

### 1. Resolve a version requirement

Implement enough semantic versioning to pin a package.

`Version(_ text:)` parses exactly three non-negative integers separated by dots — `"1.2.3"`. Anything else is `nil`: `"1.2"`, `"1.2.3.4"`, `"v1.2.3"`, `"1.2.x"`, `"1.2.3-beta"`, `""`. Ordering compares major, then minor, then patch.

`resolve` returns the highest version in `available` that satisfies the requirement, as the original string, or `nil` when nothing does. Entries that do not parse are ignored rather than fatal. `.exact` matches one version; `.upToNextMajor(from: v)` matches `v <= x` below the next major; `.upToNextMinor(from: v)` matches `v <= x` below the next minor.

```swift starter
struct Version: Equatable, Comparable {
    let major: Int
    let minor: Int
    let patch: Int

    init(_ major: Int, _ minor: Int, _ patch: Int) {
        self.major = major
        self.minor = minor
        self.patch = patch
    }

    init?(_ text: String) {
        return nil
    }

    static func < (lhs: Version, rhs: Version) -> Bool {
        return false
    }
}

enum Requirement {
    case exact(Version)
    case upToNextMajor(from: Version)
    case upToNextMinor(from: Version)
}

func resolve(_ requirement: Requirement, from available: [String]) -> String? {
    return nil
}
```

```swift test
let releases = ["1.9.9", "2.0.0", "2.3.0", "2.3.1", "2.4.0", "3.0.0", "nightly"]

/// three numbers and nothing else
func testParsing() {
    expect(Version("1.2.3"), Version(1, 2, 3))
    expect(Version("0.0.0"), Version(0, 0, 0))
    expect(Version("10.20.30"), Version(10, 20, 30))
    expect(Version("1.2"), nil)
    expect(Version("1.2.3.4"), nil)
    expect(Version("v1.2.3"), nil)
    expect(Version("1.2.x"), nil)
    expect(Version("1.2.3-beta"), nil)
    expect(Version(""), nil)
}

/// major, then minor, then patch
func testOrdering() {
    expect(Version(1, 0, 0) < Version(2, 0, 0), "1.0.0 < 2.0.0")
    expect(Version(1, 2, 0) < Version(1, 10, 0), "1.2.0 < 1.10.0")
    expect(Version(1, 2, 3) < Version(1, 2, 4), "1.2.3 < 1.2.4")
    expect(Version(2, 0, 0) < Version(1, 9, 9), false)
    expect(Version(1, 2, 3) < Version(1, 2, 3), false)
    expect([Version(2, 0, 0), Version(1, 9, 9), Version(2, 3, 1)].max(), Version(2, 3, 1))
}

/// exactly this one
func testExact() {
    expect(resolve(.exact(Version(2, 3, 0)), from: releases), "2.3.0")
    expect(resolve(.exact(Version(2, 3, 9)), from: releases), nil)
    expect(resolve(.exact(Version(3, 0, 0)), from: releases), "3.0.0")
}

/// up to the next major
func testUpToNextMajor() {
    expect(resolve(.upToNextMajor(from: Version(2, 3, 0)), from: releases), "2.4.0")
    expect(resolve(.upToNextMajor(from: Version(1, 0, 0)), from: releases), "1.9.9")
    expect(resolve(.upToNextMajor(from: Version(3, 0, 0)), from: releases), "3.0.0")
    expect(resolve(.upToNextMajor(from: Version(4, 0, 0)), from: releases), nil)
}

/// up to the next minor
func testUpToNextMinor() {
    expect(resolve(.upToNextMinor(from: Version(2, 3, 0)), from: releases), "2.3.1")
    expect(resolve(.upToNextMinor(from: Version(2, 4, 0)), from: releases), "2.4.0")
    expect(resolve(.upToNextMinor(from: Version(2, 3, 5)), from: releases), nil)
}

/// junk in the list is ignored, and an empty list resolves to nothing
func testJunk() {
    expect(resolve(.upToNextMajor(from: Version(0, 1, 0)), from: ["nightly", "main", "0.1.0"]), "0.1.0")
    expect(resolve(.upToNextMajor(from: Version(1, 0, 0)), from: ["nightly"]), nil)
    expect(resolve(.upToNextMajor(from: Version(1, 0, 0)), from: []), nil)
}
```

#### Uses
- [Dependencies & modules › Versioning and pinning](#/dependencies/versioning-and-pinning)
- [Dependencies & modules › Swift Package Manager](#/dependencies/swift-package-manager)

#### Hints
- `text.split(separator: ".", omittingEmptySubsequences: false)` then check there are exactly three parts and each maps to an `Int`.
- `Int("1.2.3-beta")` is already `nil`, so mapping each part through `Int.init` rejects most of the junk for you.
- `<` reads best as a tuple comparison: `(lhs.major, lhs.minor, lhs.patch) < (rhs.major, rhs.minor, rhs.patch)`.
- In `resolve`, use `available.compactMap { Version($0) }` to drop junk, filter by the requirement, and take `.max()` — then render it back to a string.

#### Tips
- Tuples of `Comparable` values compare lexicographically out of the box, which is exactly semver's rule for the numeric part. Real semver also orders pre-release identifiers, which is where the fiddly bits live.
- Returning the *original string* rather than a re-rendered one matters in practice: the resolver reports what the registry called the tag, not what your formatter would have printed.
- `.upToNextMajor` includes the lower bound. A requirement of "from 2.3.0" that rejected 2.3.0 itself would be a strange thing to write, and yet it is the easy off-by-one here.

#### Docs
- [Adding package dependencies to your app](https://developer.apple.com/documentation/xcode/adding-package-dependencies-to-your-app)
- [Package.Dependency.Requirement](https://developer.apple.com/documentation/packagedescription/package/dependency)

### 2. A container with lifetimes

Write the small container an app's composition root might use. `register` records how to make something; `resolve` hands one back.

A `.singleton` registration makes the value once, on first resolve, and returns the same instance forever after. A `.transient` registration calls the factory on every resolve. Registering is lazy: nothing is constructed until something is resolved. Resolving a type nobody registered returns `nil`. Registering a type twice replaces the old registration, and throws away any instance the old one had cached.

```swift starter
enum Lifetime {
    case singleton
    case transient
}

final class Container {
    private var factories: [String: (lifetime: Lifetime, make: () -> Any)] = [:]
    private var cache: [String: Any] = [:]

    func register<T>(_ type: T.Type, lifetime: Lifetime, make: @escaping () -> T) {
    }

    func resolve<T>(_ type: T.Type) -> T? {
        return nil
    }
}
```

```swift test
final class Analytics {
    nonisolated(unsafe) static var made = 0
    let id: Int
    init() { Analytics.made += 1; id = Analytics.made }
}

final class Formatter {
    nonisolated(unsafe) static var made = 0
    init() { Formatter.made += 1 }
}

func fresh() -> Container {
    Analytics.made = 0
    Formatter.made = 0
    return Container()
}

/// nothing is built until something asks
func testLazy() {
    let container = fresh()
    container.register(Analytics.self, lifetime: .singleton) { Analytics() }
    container.register(Formatter.self, lifetime: .transient) { Formatter() }
    expect(Analytics.made, 0)
    expect(Formatter.made, 0)
    _ = container.resolve(Analytics.self)
    expect(Analytics.made, 1)
    expect(Formatter.made, 0)
}

/// a singleton is made once and shared
func testSingleton() {
    let container = fresh()
    container.register(Analytics.self, lifetime: .singleton) { Analytics() }
    let a = container.resolve(Analytics.self)
    let b = container.resolve(Analytics.self)
    expect(a != nil, "a singleton should resolve")
    expect(a === b, "the same instance both times")
    expect(Analytics.made, 1)
}

/// a transient is made every time
func testTransient() {
    let container = fresh()
    container.register(Analytics.self, lifetime: .transient) { Analytics() }
    let a = container.resolve(Analytics.self)
    let b = container.resolve(Analytics.self)
    expect(a?.id, 1)
    expect(b?.id, 2)
    expect(a === b, false)
    expect(Analytics.made, 2)
}

/// types are kept apart, and unknown ones resolve to nil
func testUnknown() {
    let container = fresh()
    container.register(Analytics.self, lifetime: .singleton) { Analytics() }
    expect(container.resolve(Formatter.self) == nil, "Formatter was never registered")
    expect(Formatter.made, 0)
    expect(container.resolve(Analytics.self) != nil, "Analytics was registered")
    expect(Container().resolve(Analytics.self) == nil, "a new container knows nothing")
}

/// re-registering replaces the registration and drops the cached instance
func testReregister() {
    let container = fresh()
    container.register(Analytics.self, lifetime: .singleton) { Analytics() }
    let first = container.resolve(Analytics.self)
    container.register(Analytics.self, lifetime: .singleton) { Analytics() }
    let second = container.resolve(Analytics.self)
    expect(first === second, false)
    expect(Analytics.made, 2)
    expect(second === container.resolve(Analytics.self), "still a singleton afterwards")
}

/// a value type works too
func testValues() {
    let container = fresh()
    container.register(String.self, lifetime: .singleton) { "https://api.example.com" }
    container.register(Int.self, lifetime: .transient) { 42 }
    expect(container.resolve(String.self), "https://api.example.com")
    expect(container.resolve(Int.self), 42)
    expect(container.resolve(Double.self), nil)
}
```

#### Uses
- [Dependencies & modules › Lifetimes](#/dependencies/lifetimes)
- [Dependencies & modules › Injecting: the environment or a container](#/dependencies/injecting-the-environment-or-a-container)

#### Hints
- `String(describing: type)` is a usable key: `String(describing: Analytics.self)` is `"Analytics"`.
- `register` stores `(lifetime, { make() })` — the inner closure returns `Any`, which is what lets one dictionary hold every type.
- `resolve` looks the registration up, and for `.singleton` returns `cache[key]` if present, otherwise makes one, stores it, and returns it. Cast the result with `as? T`.
- Replacing a registration means `cache[key] = nil` as well as overwriting the factory.

#### Tips
- `as? T` is what makes the type-erased storage safe: resolve the wrong type and you get `nil` rather than a crash. That is also the trade you are making — the mistake shows up at runtime, where a constructor argument would not have compiled.
- `String(describing:)` collides for two types with the same name in different modules. Real containers use `ObjectIdentifier(type)`, which is exact; the string is easier to debug.
- This container is not thread-safe, and a real one used from several tasks needs an actor or a lock. Small, boring and single-threaded is the right first version.

#### Docs
- [Managing model data in your app](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)
- [EnvironmentValues](https://developer.apple.com/documentation/swiftui/environmentvalues)

### 3. A seam for the feature flags

`screen(for:flags:)` decides which screen a launching user sees. The flags come from a remote config service in production; here they come through a protocol, so the decision is testable without one.

The rules, in order: a subscriber always gets `.content`. Otherwise, if the `"freeTrial"` flag is on and the user has not used a trial before, they get `.trial`. Otherwise they get `.paywall`, carrying the variant named by the `"paywallVariant"` value, or `"default"` when the flags do not name one.

```swift starter
protocol FeatureFlags {
    func isOn(_ name: String) -> Bool
    func value(for name: String) -> String?
}

struct User {
    let isSubscribed: Bool
    let hasUsedTrial: Bool
}

enum Screen: Equatable {
    case content
    case trial
    case paywall(variant: String)
}

func screen(for user: User, flags: some FeatureFlags) -> Screen {
    return .content
}
```

```swift test
struct StubFlags: FeatureFlags {
    var on: Set<String> = []
    var values: [String: String] = [:]

    func isOn(_ name: String) -> Bool { on.contains(name) }
    func value(for name: String) -> String? { values[name] }
}

/// subscribers skip everything
func testSubscriber() {
    let user = User(isSubscribed: true, hasUsedTrial: false)
    expect(screen(for: user, flags: StubFlags()), .content)
    expect(screen(for: user, flags: StubFlags(on: ["freeTrial"])), .content)
    expect(screen(for: User(isSubscribed: true, hasUsedTrial: true),
                  flags: StubFlags(on: ["freeTrial"], values: ["paywallVariant": "b"])), .content)
}

/// the trial is offered once, and only when the flag is on
func testTrial() {
    let eligible = User(isSubscribed: false, hasUsedTrial: false)
    expect(screen(for: eligible, flags: StubFlags(on: ["freeTrial"])), .trial)
    expect(screen(for: eligible, flags: StubFlags()), .paywall(variant: "default"))
    expect(screen(for: User(isSubscribed: false, hasUsedTrial: true),
                  flags: StubFlags(on: ["freeTrial"])), .paywall(variant: "default"))
}

/// the paywall carries its variant
func testVariant() {
    let user = User(isSubscribed: false, hasUsedTrial: true)
    expect(screen(for: user, flags: StubFlags(values: ["paywallVariant": "annual-first"])),
           .paywall(variant: "annual-first"))
    expect(screen(for: user, flags: StubFlags(values: ["somethingElse": "x"])),
           .paywall(variant: "default"))
}

/// an unrelated flag being on changes nothing
func testUnrelatedFlags() {
    let user = User(isSubscribed: false, hasUsedTrial: false)
    expect(screen(for: user, flags: StubFlags(on: ["darkLaunch", "newOnboarding"])),
           .paywall(variant: "default"))
    expect(screen(for: user, flags: StubFlags(on: ["darkLaunch", "freeTrial"])), .trial)
}

/// the same fake drives every branch, which is the point of the seam
func testAllBranches() {
    let flags = StubFlags(on: ["freeTrial"], values: ["paywallVariant": "b"])
    expect(screen(for: User(isSubscribed: true, hasUsedTrial: true), flags: flags), .content)
    expect(screen(for: User(isSubscribed: false, hasUsedTrial: false), flags: flags), .trial)
    expect(screen(for: User(isSubscribed: false, hasUsedTrial: true), flags: flags),
           .paywall(variant: "b"))
}
```

#### Uses
- [Dependencies & modules › Protocol seams](#/dependencies/protocol-seams)
- [Dependencies & modules › Everything you did not write](#/dependencies/everything-you-did-not-write)
- [Reference › SwiftUI state and data flow](#/reference/swiftui-state-and-data-flow)

#### Hints
- The order of the rules is the shape of the function: `if user.isSubscribed { return .content }`, then the trial condition, then the paywall.
- `flags.value(for: "paywallVariant") ?? "default"` is the last line.
- `StubFlags` in the tests is the whole point — nine lines, no framework, and every branch reachable.

#### Tips
- `some FeatureFlags` means the compiler knows the concrete type at each call site, so there is no existential box and the calls can be inlined. Use `any FeatureFlags` when you need to store a heterogeneous list of them.
- A fake returns canned answers; a mock also asserts how it was called. Reach for the fake first — tests that assert on call order break every time you refactor, whether or not the behaviour changed.
- Note what this function does not do: no network, no cache, no defaults file. Those live behind the protocol, so the decision stays a pure function of user and flags and can be reasoned about in a code review.

#### Docs
- [Protocols](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/protocols/)
- [Opaque and boxed protocol types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/opaquetypes/)

### 4. What builds first

`buildOrder` takes modules and the modules each one depends on, and returns an order in which they can be built: every module comes after everything it depends on.

Several orders are usually valid, so make it deterministic — whenever more than one module is ready to build, take the alphabetically first. Return `nil` if there is a cycle, or if a module depends on something that is not in the dictionary at all.

```swift starter
func buildOrder(_ modules: [String: [String]]) -> [String]? {
    return []
}
```

```swift test
/// a straight chain
func testChain() {
    expect(buildOrder(["App": ["TripKit"], "TripKit": ["Core"], "Core": []]),
           ["Core", "TripKit", "App"])
}

/// independent modules come out alphabetically
func testIndependent() {
    expect(buildOrder(["Zebra": [], "Apple": [], "Mango": []]), ["Apple", "Mango", "Zebra"])
    expect(buildOrder([:]), [])
    expect(buildOrder(["Only": []]), ["Only"])
}

/// a diamond: both middles before the top, ties broken alphabetically
func testDiamond() {
    let modules = ["App": ["Feed", "Profile"], "Feed": ["Core"], "Profile": ["Core"], "Core": []]
    expect(buildOrder(modules), ["Core", "Feed", "Profile", "App"])
}

/// ready modules are taken alphabetically, not in the order they were declared
func testDeterministic() {
    let modules = ["B": [], "A": ["B"], "C": ["B"], "D": ["A", "C"]]
    expect(buildOrder(modules), ["B", "A", "C", "D"])
    expect(buildOrder(modules), buildOrder(modules))
}

/// cycles have no order
func testCycles() {
    expect(buildOrder(["A": ["B"], "B": ["A"]]), nil)
    expect(buildOrder(["A": ["A"]]), nil)
    expect(buildOrder(["A": ["B"], "B": ["C"], "C": ["A"]]), nil)
    expect(buildOrder(["Core": [], "A": ["B", "Core"], "B": ["A"]]), nil)
}

/// a dependency on something that is not declared
func testUnknown() {
    expect(buildOrder(["App": ["Missing"]]), nil)
    expect(buildOrder(["App": ["Core"], "Core": ["Missing"]]), nil)
}
```

#### Uses
- [Dependencies & modules › Keeping the graph acyclic](#/dependencies/keeping-the-graph-acyclic)
- [Dependencies & modules › What belongs in a module](#/dependencies/what-belongs-in-a-module)

#### Hints
- Check first that every dependency named is a key of the dictionary, and bail out with `nil` if not.
- Keep a `var built: Set<String>` and a `var order: [String]`. Each round, look for the modules not built yet whose dependencies are all in `built`.
- `.sorted().first` on the ready modules is what makes the answer deterministic; take one at a time rather than a whole round at once.
- If a round finds nothing ready and modules remain, that is the cycle: return `nil`.

#### Tips
- Taking one module per round instead of all the ready ones is a little slower and much easier to get right — and it is what gives you the exact alphabetical tie-break the tests want.
- "Depends on something undeclared" and "is in a cycle" are different bugs with different fixes, so a real tool would say which. Returning `nil` for both is fine here; returning "it failed" for both in a build system is not.
- Dictionaries have no order, so any implementation that iterates `modules` and appends as it goes will pass sometimes and fail sometimes. The `testDeterministic` check runs the same input twice for exactly that reason.

#### Docs
- [Organizing your code with local packages](https://developer.apple.com/documentation/xcode/organizing-your-code-with-local-packages)
- [Package targets](https://developer.apple.com/documentation/packagedescription/target)

### 5. Carve out a local package

Move the trip storage out of the app target and into a local Swift package, with a protocol at the boundary and the live implementation injected from the app.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A local package `TripKit` in a `Packages/` folder inside the repo, added to the project with **File → Add Package Dependencies… → Add Local…**, and listed in the app target's *Frameworks, Libraries, and Embedded Content*.
- `TripStore` as a `public protocol` in `TripKit`, with an in-memory implementation `InMemoryTripStore` that ships in the package for previews and tests.
- Everything the app touches marked `public`, including the initializers — a `public struct` still has an internal memberwise init until you write one.
- The app target imports `TripKit` and never the other way round. Deleting the app from the project must leave the package building.
- The concrete store chosen in exactly one place — the `App` struct — and reached by views through an environment value.
- A test target in the package that exercises `InMemoryTripStore` and runs with ⌘U without launching the app.

```swift solution
// Packages/TripKit/Package.swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TripKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "TripKit", targets: ["TripKit"])
    ],
    targets: [
        .target(name: "TripKit"),
        .testTarget(name: "TripKitTests", dependencies: ["TripKit"])
    ]
)

// Packages/TripKit/Sources/TripKit/TripStore.swift
import Foundation

public struct Trip: Identifiable, Equatable, Sendable {
    public let id: UUID
    public var name: String
    public var startDate: Date

    public init(id: UUID = UUID(), name: String, startDate: Date) {
        self.id = id
        self.name = name
        self.startDate = startDate
    }
}

public protocol TripStore: Sendable {
    func all() async throws -> [Trip]
    func save(_ trip: Trip) async throws
}

public actor InMemoryTripStore: TripStore {
    private var trips: [Trip]

    public init(trips: [Trip] = []) {
        self.trips = trips
    }

    public func all() async throws -> [Trip] {
        trips.sorted { $0.startDate < $1.startDate }
    }

    public func save(_ trip: Trip) async throws {
        if let i = trips.firstIndex(where: { $0.id == trip.id }) {
            trips[i] = trip
        } else {
            trips.append(trip)
        }
    }
}

// App/Environment+TripStore.swift
import SwiftUI
import TripKit

extension EnvironmentValues {
    @Entry var tripStore: any TripStore = InMemoryTripStore()
}

// App/TripsApp.swift — the one place that picks the real implementation
import SwiftUI
import TripKit

@main
struct TripsApp: App {
    private let store = LiveTripStore()

    var body: some Scene {
        WindowGroup {
            TripList()
                .environment(\.tripStore, store)
        }
    }
}

// App/TripList.swift
import SwiftUI
import TripKit

struct TripList: View {
    @Environment(\.tripStore) private var store
    @State private var trips: [Trip] = []

    var body: some View {
        List(trips) { trip in
            Text(trip.name)
        }
        .task {
            trips = (try? await store.all()) ?? []
        }
    }
}

#Preview {
    TripList()
        .environment(\.tripStore, InMemoryTripStore(trips: [
            Trip(name: "Lisbon", startDate: .now)
        ]))
}
```

#### Uses
- [Dependencies & modules › Swift Package Manager](#/dependencies/swift-package-manager)
- [Dependencies & modules › What belongs in a module](#/dependencies/what-belongs-in-a-module)
- [Dependencies & modules › Injecting: the environment or a container](#/dependencies/injecting-the-environment-or-a-container)

#### Hints
- Xcode's *Add Local…* adds a folder reference; the package's `Package.swift` must be at the root of the folder you pick.
- The first build after extracting a type is a list of "cannot find X in scope" errors. That list is the public surface, and it is usually shorter than you expected.
- `@Entry` needs a default value for the environment key, which is a good reason for the package to ship a harmless in-memory implementation.

#### Tips
- The compile errors are the feature. Nothing else tells you as precisely what the rest of the app was reaching into.
- Resist making everything `public` to silence the build. A type that only the package uses should stay internal; the smaller the surface, the freer you are to change what is behind it.
- Keeping the environment default as the in-memory store means previews and tests work with no setup, and forgetting to inject the real one shows up as an empty screen rather than a crash. Some teams prefer a default that traps, so the mistake is loud. Both are defensible — decide once.

#### Docs
- [Organizing your code with local packages](https://developer.apple.com/documentation/xcode/organizing-your-code-with-local-packages)
- [Swift Package Manager](https://www.swift.org/documentation/package-manager/)
- [Entry macro](https://developer.apple.com/documentation/swiftui/entry())
