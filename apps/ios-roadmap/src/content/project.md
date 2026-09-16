# Xcode & the app

An iOS app is not a folder of Swift files: it is an Xcode project that describes how those files become a signed bundle, which frameworks they link against, and what the resulting app is allowed to do. Most of that description is data — targets, schemes, build settings, a property list — and the day you can read it is the day Xcode stops feeling like weather.

## The project, the target, the scheme

Three words get used interchangeably and mean quite different things.

A **project** (`MyApp.xcodeproj`) is the container. It holds file references, groups, and one set of build settings that everything inside inherits.

A **target** is one thing that gets built: the app, a widget extension, a test bundle, a framework. A target has its own build settings, its own list of source files, and its own list of the other targets it depends on. Two targets can share a source file simply by both claiming it — which is how an app and its test bundle usually work, and why "file not found" so often means "not a member of that target".

A **scheme** is a saved plan for *doing* something with targets: which target to build, in which configuration, with which arguments and environment variables, and what to run for Test, Profile and Archive. Schemes are the least mysterious and the most useful. Duplicating a scheme and adding `-com.apple.CoreData.SQLDebug 1` to its run arguments is a two-minute change that saves an afternoon.

## Build settings, and where a value comes from

A build setting is a key with a string value: `SWIFT_VERSION`, `PRODUCT_BUNDLE_IDENTIFIER`, `IPHONEOS_DEPLOYMENT_TARGET`. What makes them confusing is that the same key is defined in several places, and the answer is whichever definition is most specific:

1. the platform defaults,
2. the project,
3. the target,
4. an `.xcconfig` file assigned to that configuration.

The more specific level normally replaces the less specific one. The exception is `$(inherited)`, which expands to the value the level below would have given. That is why linker flags are conventionally written `$(inherited) -ObjC`: without it, one target quietly drops everything the project set.

```
// Project:  OTHER_SWIFT_FLAGS = -warn-concurrency
// Target:   OTHER_SWIFT_FLAGS = $(inherited) -strict-concurrency=complete
// resolved: -warn-concurrency -strict-concurrency=complete
```

Settings can also refer to each other: `PRODUCT_BUNDLE_IDENTIFIER = com.example.$(PRODUCT_NAME)`. The build settings editor has a "Levels" toggle that shows all four columns at once, which is the fastest way to find out who set the value you did not expect.

**Configurations** are named sets of settings — `Debug` and `Release` out of the box. A scheme picks one per action, so Run uses Debug and Archive uses Release. If you need a third (a staging build pointing at a staging server), add a configuration rather than a build flag you have to remember to flip.

## Target dependencies and build order

A target lists the targets it depends on, and Xcode builds them depth-first: everything a target needs is built before the target itself, and nothing is built twice. That ordering is a topological sort, and a cycle is an error rather than a slow build.

This matters when you split an app into modules. The build graph is what makes a modular app fast — targets with no dependency on each other build in parallel — and what makes a badly split one slow, because a single leaf module that everything depends on is a barrier every build has to cross.

## Info.plist and capabilities

`Info.plist` is a property list compiled into the app bundle, and the system reads it before your code runs. It carries the display name, the version (`CFBundleShortVersionString`, the marketing version) and the build number (`CFBundleVersion`, which must increase for every upload), the supported orientations, and — most importantly — the usage descriptions.

Every privacy-sensitive API requires a matching `NS…UsageDescription` string. Without it the app does not prompt; it crashes the first time you touch the camera. The string is shown to the user verbatim, so "We need camera access" is a worse answer than "Take a photo of a receipt to attach it to an expense".

Modern Xcode generates the plist from build settings by default, so you edit these in the target's **Info** tab rather than in a file. **Capabilities** (push notifications, App Groups, Sign in with Apple) are a separate mechanism: they write an entitlements file and register the identifier with your developer account.

## Swift Package Manager

Dependencies come in as Swift packages. A package is a directory with a `Package.swift` manifest listing its products (libraries other code can import) and its targets (what the package itself builds).

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopKit",
    platforms: [.iOS(.v17)],
    products: [.library(name: "ShopKit", targets: ["ShopKit"])],
    targets: [
        .target(name: "ShopKit"),
        .testTarget(name: "ShopKitTests", dependencies: ["ShopKit"]),
    ]
)
```

You name a version *requirement*, not a version. `.upToNextMajor(from: "1.2.0")` accepts any 1.x at or above 1.2.0 and refuses 2.0.0, because semantic versioning promises that a major bump is allowed to break you. There are three others: `.upToNextMinor(from: "1.2.0")` stops at 1.3.0, for a dependency you do not trust to keep that promise; `.exact("1.2.0")` takes one release and nothing else, which is safe until two dependencies want different exact versions and nothing resolves; and a plain range, `"1.0.0"..<"1.5.0"`, is half-open at the top like every Swift range. The resolver picks the highest version that satisfies every requirement at once and records it in `Package.resolved`, which belongs in git: it is the difference between "works on my machine" and "works on the machine that ships".

Local packages are the other half of this. `File ▸ New ▸ Package` inside your project gives you a folder you can `import`, with its own tests that run without launching a simulator. It is the cheapest way to stop a 40-file app from becoming a 400-file app.

## Simulator or device

The simulator is fast, scriptable, and lies about several things that matter. It runs your code compiled for the Mac's own architecture against a simulated iOS, so it has the Mac's memory, the Mac's CPU and no cellular radio, no camera, no real GPS, no Metal performance you can trust, and a Keychain and push-notification story of its own. Performance work and anything touching hardware needs a device.

What the simulator is excellent at is iteration: multiple devices side by side, `xcrun simctl` to install and launch from a script, and a filesystem you can open in Finder. Develop on the simulator, and check on a device before you believe anything.

```swift playground
import Foundation

// How Xcode resolves a build setting, in fifteen lines of ordinary Swift.
// Levels run from least specific (the project) to most specific (an xcconfig).
let levels: [[String: String]] = [
    ["OTHER_SWIFT_FLAGS": "-warn-concurrency", "SWIFT_VERSION": "6.0"],
    ["OTHER_SWIFT_FLAGS": "$(inherited) -strict-concurrency=complete"],
    ["OTHER_SWIFT_FLAGS": "$(inherited) -D STAGING"],
]

func resolve(_ key: String, in levels: [[String: String]]) -> String {
    var value = ""
    for level in levels {
        guard let raw = level[key] else { continue }
        value = raw.replacingOccurrences(of: "$(inherited)", with: value)
        value = value.split(separator: " ").joined(separator: " ")
    }
    return value
}

print(resolve("OTHER_SWIFT_FLAGS", in: levels))
print(resolve("SWIFT_VERSION", in: levels))
print("[\(resolve("ENABLE_TESTABILITY", in: levels))]")

// Try: drop "$(inherited)" from the last level and watch the project's flag vanish.
```

Note the import. `replacingOccurrences(of:with:)` is a Foundation method, and a playground on this page gets no imports for free, so it has to ask. The exercises below get Foundation whether they use it or not.

## Exercises

### 1. Resolve a build setting

`resolve(_:in:)` answers the question the Levels view answers: given the levels of a build setting from least specific to most specific, what value does the compiler actually see?

Each level either sets the key or does not. A level that sets it replaces what came before, except that `$(inherited)` inside the value expands to the value the earlier levels produced. Values are space-separated flag lists, so normalise the result: no leading, trailing or doubled spaces. A key no level sets resolves to the empty string.

```swift starter
func resolve(_ key: String, in levels: [[String: String]]) -> String {
    return ""
}
```

```swift test
/// an unset key is empty, a set one comes straight through
func testSimple() {
    expect(resolve("SWIFT_VERSION", in: [[:], [:]]), "")
    expect(resolve("SWIFT_VERSION", in: [["SWIFT_VERSION": "6.0"], [:]]), "6.0")
    expect(resolve("SWIFT_VERSION", in: []), "")
}

/// a more specific level replaces a less specific one
func testOverride() {
    expect(resolve("A", in: [["A": "one"], ["A": "two"]]), "two")
    expect(resolve("A", in: [["A": "one"], ["A": "two"], ["A": "three"]]), "three")
    expect(resolve("A", in: [["A": "one"], ["B": "two"]]), "one")
}

/// $(inherited) keeps what the level below set
func testInherited() {
    expect(resolve("A", in: [["A": "one"], ["A": "$(inherited) two"]]), "one two")
    expect(resolve("A", in: [["A": "one"], ["A": "$(inherited) two"], ["A": "$(inherited) three"]]), "one two three")
    expect(resolve("A", in: [["A": "-w $(inherited) -x"]]), "-w -x")
}

/// an override higher up still wins, inherited or not
func testOverrideBeatsInherited() {
    expect(resolve("A", in: [["A": "one"], ["A": "$(inherited) two"], ["A": "three"]]), "three")
    expect(resolve("A", in: [["A": "one"], [:], ["A": "$(inherited) two"]]), "one two")
}

/// nothing to inherit leaves no stray spaces
func testNoStraySpaces() {
    expect(resolve("A", in: [[:], ["A": "$(inherited) two"]]), "two")
    expect(resolve("A", in: [["A": "$(inherited)"]]), "")
    expect(resolve("A", in: [["A": "one"], ["A": "$(inherited)"]]), "one")
}
```

#### Uses
- [Xcode & the app › Build settings, and where a value comes from](#/project/build-settings-and-where-a-value-comes-from)

#### Hints
- Walk the levels in order, keeping the value so far in a `var`.
- `levels[i][key]` is an `Optional<String>`: `guard let raw = level[key] else { continue }` skips the levels that say nothing.
- `raw.replacingOccurrences(of: "$(inherited)", with: value)` splices the inherited value in. Foundation is already imported for you here.
- `value.split(separator: " ").joined(separator: " ")` drops empty pieces, which is exactly the whitespace tidy-up the last test wants.

#### Tips
- Note what the second-to-last case proves: a level that does not mention the key is not the same as a level that sets it to nothing. Skipping is not overriding.
- Real Xcode also expands `$(OTHER_KEY)` references and has a handful of modifiers like `$(PRODUCT_NAME:rfc1034identifier)`. Same mechanism, more rules.
- When a flag you set at project level mysteriously is not applied, look for a target-level value without `$(inherited)`. It is almost always that.

#### Docs
- [Build settings reference](https://developer.apple.com/documentation/xcode/build-settings-reference)
- [Adding a build configuration file to your project](https://developer.apple.com/documentation/xcode/adding-a-build-configuration-file-to-your-project)

### 2. Does this version satisfy the requirement?

Swift Package Manager does not pin versions, it pins *requirements*, and then resolves the highest version that satisfies them. Implement the two halves of that.

`satisfies(_:_:)` says whether a version meets a requirement. `upToNextMajor(from: 1.2.0)` means `1.2.0 ..< 2.0.0`; `upToNextMinor(from: 1.2.0)` means `1.2.0 ..< 1.3.0`; `range(from:upTo:)` is half-open too, and `exact` is exact. Versions compare by major, then minor, then patch.

`highest(of:satisfying:)` returns the newest version in the list that satisfies the requirement, or `nil` when none does. The list is in no particular order.

```swift starter
struct Version: Equatable {
    let major: Int
    let minor: Int
    let patch: Int
}

enum Requirement {
    case exact(Version)
    case upToNextMajor(from: Version)
    case upToNextMinor(from: Version)
    case range(from: Version, upTo: Version)
}

func satisfies(_ version: Version, _ requirement: Requirement) -> Bool {
    return false
}

func highest(of versions: [Version], satisfying requirement: Requirement) -> Version? {
    return nil
}
```

```swift test
func v(_ major: Int, _ minor: Int, _ patch: Int) -> Version {
    Version(major: major, minor: minor, patch: patch)
}

/// exact means exact
func testExact() {
    expect(satisfies(v(1, 2, 3), .exact(v(1, 2, 3))), true)
    expect(satisfies(v(1, 2, 4), .exact(v(1, 2, 3))), false)
    expect(satisfies(v(2, 2, 3), .exact(v(1, 2, 3))), false)
}

/// up to the next major accepts the rest of the major line
func testUpToNextMajor() {
    expect(satisfies(v(1, 2, 0), .upToNextMajor(from: v(1, 2, 0))), true)
    expect(satisfies(v(1, 9, 9), .upToNextMajor(from: v(1, 2, 0))), true)
    expect(satisfies(v(1, 1, 9), .upToNextMajor(from: v(1, 2, 0))), false)
    expect(satisfies(v(2, 0, 0), .upToNextMajor(from: v(1, 2, 0))), false)
    expect(satisfies(v(0, 9, 0), .upToNextMajor(from: v(0, 1, 0))), true)
}

/// up to the next minor is a much tighter promise
func testUpToNextMinor() {
    expect(satisfies(v(1, 2, 9), .upToNextMinor(from: v(1, 2, 0))), true)
    expect(satisfies(v(1, 3, 0), .upToNextMinor(from: v(1, 2, 0))), false)
    expect(satisfies(v(1, 2, 0), .upToNextMinor(from: v(1, 2, 1))), false)
}

/// an explicit range is half-open at the top
func testRange() {
    expect(satisfies(v(1, 0, 0), .range(from: v(1, 0, 0), upTo: v(1, 5, 0))), true)
    expect(satisfies(v(1, 4, 9), .range(from: v(1, 0, 0), upTo: v(1, 5, 0))), true)
    expect(satisfies(v(1, 5, 0), .range(from: v(1, 0, 0), upTo: v(1, 5, 0))), false)
}

/// the resolver takes the newest one that fits
func testHighest() {
    let available = [v(1, 0, 0), v(2, 0, 0), v(1, 4, 2), v(1, 2, 0)]
    expect(highest(of: available, satisfying: .upToNextMajor(from: v(1, 0, 0))), v(1, 4, 2))
    expect(highest(of: available, satisfying: .upToNextMinor(from: v(1, 0, 0))), v(1, 0, 0))
    expect(highest(of: available, satisfying: .exact(v(2, 0, 0))), v(2, 0, 0))
    expect(highest(of: available, satisfying: .upToNextMajor(from: v(3, 0, 0))), nil)
    expect(highest(of: [], satisfying: .upToNextMajor(from: v(1, 0, 0))), nil)
}
```

#### Uses
- [Xcode & the app › Swift Package Manager](#/project/swift-package-manager)
- [Reference › Swift Package Manager](#/reference/swift-package-manager)

#### Hints
- Give `Version` an ordering first: `struct Version: Comparable` plus a `<` that compares `(major, minor, patch)` as a tuple. Swift compares tuples of `Comparable` values lexicographically, so `(a.major, a.minor, a.patch) < (b.major, b.minor, b.patch)` is the whole implementation.
- With `<` in place, every case is a two-sided comparison: `version >= from && version < upper`.
- `upToNextMajor(from: a)` has an upper bound of `Version(major: a.major + 1, minor: 0, patch: 0)`.
- `highest` is `versions.filter { satisfies($0, requirement) }.max()`, which is `nil` for an empty result all by itself.

#### Tips
- `Comparable` only asks you for `<`; `>`, `<=`, `>=` and `max()` come free, and `Equatable` is inherited. Writing all six is a common waste.
- Half-open ranges are not fussiness. `1.0.0 ..< 2.0.0` and `2.0.0 ..< 3.0.0` tile the number line with no gap and no overlap; closed ranges cannot.
- A real resolver has the harder half of this problem: satisfying several packages' requirements on the *same* dependency at once. Picking the highest that fits one requirement is the easy base case.

#### Docs
- [Adding package dependencies to your app](https://developer.apple.com/documentation/xcode/adding-package-dependencies-to-your-app)
- [PackageDescription](https://developer.apple.com/documentation/packagedescription)

### 3. What order does Xcode build in?

Each target lists the targets it depends on. Xcode builds depth-first: before a target is built, everything it depends on has been built, and nothing is built twice.

`buildOrder(for:dependencies:)` returns that order, ending with the target you asked for. Where a target has several dependencies, take them in the order they are listed. A target missing from the dictionary has no dependencies. A dependency cycle is not a build order at all, so return `nil`.

```swift starter
func buildOrder(for target: String, dependencies: [String: [String]]) -> [String]? {
    return []
}
```

```swift test
/// a target with nothing under it builds alone
func testLeaf() {
    expect(buildOrder(for: "App", dependencies: ["App": []]), ["App"])
    expect(buildOrder(for: "Widget", dependencies: [:]), ["Widget"])
}

/// dependencies come first, and unrelated targets stay out
func testChain() {
    let deps = ["App": ["Core"], "Core": [], "Tests": ["App"]]
    expect(buildOrder(for: "App", dependencies: deps), ["Core", "App"])
    expect(buildOrder(for: "Tests", dependencies: deps), ["Core", "App", "Tests"])
    expect(buildOrder(for: "Core", dependencies: deps), ["Core"])
}

/// a shared dependency is built once, before both of its dependents
func testDiamond() {
    let deps = ["App": ["Feature", "Analytics"], "Feature": ["Core"], "Analytics": ["Core"], "Core": []]
    expect(buildOrder(for: "App", dependencies: deps), ["Core", "Feature", "Analytics", "App"])
}

/// listed order decides between siblings
func testSiblingOrder() {
    expect(buildOrder(for: "App", dependencies: ["App": ["B", "A"], "A": [], "B": []]), ["B", "A", "App"])
    expect(buildOrder(for: "App", dependencies: ["App": ["A", "B"], "A": [], "B": []]), ["A", "B", "App"])
}

/// a cycle has no build order
func testCycle() {
    expect(buildOrder(for: "A", dependencies: ["A": ["B"], "B": ["A"]]), nil)
    expect(buildOrder(for: "A", dependencies: ["A": ["A"]]), nil)
    expect(buildOrder(for: "App", dependencies: ["App": ["A"], "A": ["B"], "B": ["A"]]), nil)
    expect(buildOrder(for: "Safe", dependencies: ["Safe": [], "A": ["B"], "B": ["A"]]), ["Safe"])
}
```

#### Uses
- [Xcode & the app › Target dependencies and build order](#/project/target-dependencies-and-build-order)
- [Xcode & the app › The project, the target, the scheme](#/project/the-project-the-target-the-scheme)
- [Reference › Collections](#/reference/collections)

#### Hints
- This is a depth-first post-order walk: visit every dependency, *then* append the target itself.
- Two sets, not one. `done` remembers targets already emitted; `onStack` remembers the targets in the current chain, and meeting one of those again is the cycle.
- A nested `func visit(_ name: String) -> Bool` inside `buildOrder` can capture and mutate the arrays and sets around it, which keeps everything in one function.
- `dependencies[name] ?? []` handles the target that is not a key at all.

#### Tips
- The last cycle case is the interesting one: a cycle that your target cannot reach is somebody else's problem. Only explore from where you were asked to start.
- Returning `[]` for a cycle instead of `nil` would compile and read fine, and then an empty build would look like a successful one. When "no answer" is a real outcome, give it its own value.
- This is why a modular app builds fast: targets with no path between them have no ordering constraint, and Xcode runs them in parallel.

#### Docs
- [Configuring a new target in your project](https://developer.apple.com/documentation/xcode/configuring-a-new-target-in-your-project)
- [Customizing the build schemes for a project](https://developer.apple.com/documentation/xcode/customizing-the-build-schemes-for-a-project)

### 4. A project you can read

Make a new app project and turn its defaults into things you chose. Then run it on two different simulators and confirm they are independent installs.

Not marked here — work the checklist, then compare with the reference.

#### Build it
- A new **App** project, SwiftUI interface, with a bundle identifier of your own (`com.<you>.shop`).
- The deployment target set deliberately in the target's **General** tab, not left at whatever Xcode picked.
- An "About" screen showing the marketing version and build number, read from the bundle rather than hardcoded.
- A duplicated scheme named `Shop (verbose)` whose Run action passes `-showDebugInfo YES` as a launch argument.
- The app run on two simulators; adding data on one does not show up on the other.

```swift solution
// ShopApp.swift
@main
struct ShopApp: App {
    var body: some Scene {
        WindowGroup {
            AboutScreen()
        }
    }
}

// AboutScreen.swift
struct AboutScreen: View {
    // Both keys live in Info.plist; Xcode fills them from the MARKETING_VERSION
    // and CURRENT_PROJECT_VERSION build settings.
    private var versionText: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "—"
        let build = info?["CFBundleVersion"] as? String ?? "—"
        return "\(short) (\(build))"
    }

    private var verbose: Bool {
        UserDefaults.standard.bool(forKey: "showDebugInfo")
    }

    var body: some View {
        VStack(spacing: 8) {
            Text("Shop")
                .font(.largeTitle.bold())
            Text("Version \(versionText)")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if verbose {
                Text(Bundle.main.bundleIdentifier ?? "no bundle id")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}

#Preview {
    AboutScreen()
}
```

#### Uses
- [Xcode & the app › Info.plist and capabilities](#/project/info-plist-and-capabilities)
- [Xcode & the app › Simulator or device](#/project/simulator-or-device)
- [What is iOS? › The tools](#/intro/the-tools)
- [Reference › Observation, SwiftData and storage](#/reference/observation-swiftdata-and-storage)

#### Hints
- File ▸ New ▸ Project ▸ iOS ▸ App, interface SwiftUI.
- The scheme menu at the top of the window has **Edit Scheme…** and **New Scheme…**; duplicate rather than edit, so the original keeps working.
- A launch argument of the form `-key value` is read by `UserDefaults.standard` as if it had been written there, which is why the reference reads `showDebugInfo` with no extra plumbing.
- Device ▸ Erase All Content and Settings in the Simulator menu is how you get back to a first launch.

#### Tips
- Hardcoding the version in a `Text` means shipping a version number that disagrees with the App Store. Read it from the bundle once and you can never be wrong.
- Launch arguments are the cheapest feature flag there is: no build setting, no recompile, and they vanish in a real launch because nobody passes them.
- Each simulator is a separate installation with its own container. That is a feature — it is how you test a first launch and an upgrade in the same afternoon.

#### Docs
- [Creating an Xcode project for an app](https://developer.apple.com/documentation/xcode/creating-an-xcode-project-for-an-app)
- [Running your app in Simulator or on a device](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device)
- [Information property list](https://developer.apple.com/documentation/bundleresources/information-property-list)

### 5. Move the model into a local package

Split the model out of the app target and into a local Swift package, so it compiles, and tests, without the app.

#### Build it
- A local package `ShopKit` created with File ▸ New ▸ Package, inside the project directory and added to the project.
- `ShopKit` added to the app target's **Frameworks, Libraries, and Embedded Content**, so `import ShopKit` compiles.
- `Item` and the cart logic moved into `Sources/ShopKit/`, with `public` on everything the app uses — including an explicit `public init`.
- A test in `Tests/ShopKitTests/` that runs with ⌘U and does not launch the simulator.
- The app target builds with no reference to the moved types other than the `import`.

```swift solution
// ShopKit/Package.swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShopKit",
    platforms: [.iOS(.v17)],
    products: [.library(name: "ShopKit", targets: ["ShopKit"])],
    targets: [
        .target(name: "ShopKit"),
        .testTarget(name: "ShopKitTests", dependencies: ["ShopKit"]),
    ]
)

// ShopKit/Sources/ShopKit/Item.swift
public struct Item: Identifiable, Equatable, Sendable {
    public let id: Int
    public let name: String
    public let qty: Int

    // A struct's memberwise init is internal, so a public struct still needs this
    // to be constructible from another module.
    public init(id: Int, name: String, qty: Int) {
        self.id = id
        self.name = name
        self.qty = qty
    }
}

public extension Array where Element == Item {
    var totalQuantity: Int { reduce(0) { $0 + $1.qty } }
}

// ShopKit/Tests/ShopKitTests/ItemTests.swift
import Testing
@testable import ShopKit

@Test func totalCountsQuantities() {
    let items = [Item(id: 1, name: "Pen", qty: 2), Item(id: 2, name: "Pad", qty: 3)]
    #expect(items.totalQuantity == 5)
}

@Test func emptyCartIsZero() {
    #expect([Item]().totalQuantity == 0)
}

// App/CartScreen.swift
import ShopKit

struct CartScreen: View {
    let items: [Item]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your cart").font(.largeTitle)
            Text("\(items.totalQuantity) items")
        }
        .padding()
    }
}
```

#### Uses
- [Xcode & the app › Swift Package Manager](#/project/swift-package-manager)
- [Xcode & the app › Target dependencies and build order](#/project/target-dependencies-and-build-order)
- [Xcode & the app › The project, the target, the scheme](#/project/the-project-the-target-the-scheme)

#### Hints
- Drag the package folder into the project navigator, or use File ▸ Add Package Dependencies ▸ Add Local.
- The compiler error you will hit first is `'Item' initializer is inaccessible due to 'internal' protection level`. That is the missing `public init`.
- Package tests use the Swift Testing framework: `import Testing`, `@Test func …`, `#expect(…)`.
- If `import ShopKit` still fails after the package is added, check the app target's General ▸ Frameworks, Libraries, and Embedded Content.

#### Tips
- The real prize is the test target. Package tests run in seconds because there is no app, no simulator boot and no UI to drive.
- `public` is a decision, not a formality. Everything public is API you have to keep working; the smaller that surface, the freer the package is to change.
- Start with one package, not eight. A module boundary you drew before you understood the app is more expensive to move than the code it holds.

#### Docs
- [Organizing your code with local packages](https://developer.apple.com/documentation/xcode/organizing-your-code-with-local-packages)
- [Swift Testing](https://developer.apple.com/documentation/testing)
