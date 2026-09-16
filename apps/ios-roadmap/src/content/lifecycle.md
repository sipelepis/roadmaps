# App lifecycle & scenes

An iOS app is not a program that runs from `main` to the end. It is launched, shown, covered by a phone call, put away, woken up by a notification, quietly killed while you are not looking, and launched again pretending nothing happened. The lifecycle is the set of hooks for all of that: where the app starts, what a scene is, what `scenePhase` tells you, and what you owe the system at each moment. Most of it comes down to two questions — what must be saved before we disappear, and what must be redone when we come back.

## The App and its scenes

The entry point is a type marked `@main` that conforms to `App`. It returns one or more scenes.

```swift
@main
struct ShopApp: App {
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootScreen()
                .environment(router)
        }
    }
}
```

A **scene** is one instance of your interface. On iPhone there is normally exactly one; on iPad and on the Mac a `WindowGroup` can have several, each with its own view hierarchy and its own state. That is the reason to be careful with singletons: two scenes of the same app share your global state whether you meant them to or not.

`WindowGroup` is the usual scene. `Settings` adds a Mac preferences window; `DocumentGroup` is for document-based apps. The `App` struct itself is a good place for the objects that outlive any screen — a router, a session, a database handle — created once with `@State` and put into the environment.

There is no `AppDelegate` in a pure SwiftUI app. When you need one, for a framework that still insists on it, `@UIApplicationDelegateAdaptor` attaches it.

## Scene phase

`@Environment(\.scenePhase)` reports which of three states the scene is in:

- `.active` — on screen and receiving events.
- `.inactive` — visible but not receiving events: the app switcher, an incoming call, Control Centre pulled down, the moment before the system takes its snapshot.
- `.background` — off screen. You have a short, unguaranteed window to finish up, and then you may be suspended or killed with no further warning.

```swift
@Environment(\.scenePhase) private var scenePhase

.onChange(of: scenePhase) { _, phase in
    switch phase {
    case .background: save()
    case .active: refreshIfStale()
    default: break
    }
}
```

The transitions matter more than the states: going `.active` → `.inactive` is your cue to hide anything private *before* the snapshot the system takes for the app switcher. Coming back is `.inactive` → `.active`. iOS normally passes through `.inactive` in both directions, so treat it as the doorway rather than a place.

## Going to the background

When you reach `.background`, assume you are about to be frozen. Everything that must survive has to be written now: the draft, the scroll position, the navigation path, anything the user typed. Writing on every keystroke is wasteful; writing only at the background transition is the shape that works.

Do not start long work here. The window is short and not promised, and `UIApplication.beginBackgroundTask` — which asks for a little more — is a last resort, not a habit. Real background work belongs to `BGTaskScheduler`, which runs when the system decides, possibly hours later.

The blunt fact underneath all of this: a backgrounded app can be terminated without ever being told. There is no "about to be killed" callback. `.background` is the last moment you are guaranteed, so treat it as the save point.

## Coming back

Returning to `.active` is a good time to ask what went stale while you were away. Cached data, a countdown, an auth token, a "3 minutes ago" label — all of them were frozen and the world was not.

How stale is worth a refresh is a product decision, and the honest way to write it is with the clock as an input: record *when* you went to the background and compare it with *now* when you come back. That single decision — refresh or don't — is the first exercise, and writing it as a function of `(previous phase, new phase, now)` rather than as scattered `if`s inside a view is what makes it testable at all.

## Entering from a link

A link can arrive in two quite different situations. If the app is already running, `.onOpenURL` fires and your model is ready to receive it. If the app was not running, iOS launches it and delivers the link *while you are still setting up* — before the session is restored, before the router exists, sometimes before the first view has appeared.

```swift
WindowGroup {
    RootScreen()
        .onOpenURL { url in inbox.receive(url) }
}
```

The fix is not to make launch faster. It is to hold the link until you are ready and then replay it, keeping only the most recent one, because a burst of links should land you in one place and not walk you through all of them. That small inbox is the second exercise, and it is the difference between a link that works and a link that works only when the app is already open.

## State restoration

Restoration is what makes a killed-and-relaunched app feel like it was never gone. SwiftUI's built-in version is `@SceneStorage`, which persists a value per scene and gives it back on relaunch:

```swift
@SceneStorage("draft") private var draft = ""
@SceneStorage("path") private var encodedPath = ""
```

It holds small values — a string, a number, a `Bool` — so a navigation path is stored as encoded JSON rather than directly. `@AppStorage` is the other one, backed by `UserDefaults` and shared by every scene, right for preferences and wrong for "where this window was".

Restore defensively. Anything that came from an older build, or from long enough ago that it no longer means anything, should be dropped in favour of the root screen. Opening in the wrong place is worse than opening at the start.

## Work at launch

Launch is the most expensive moment in the app's life and the one users judge hardest. Three rules survive contact with reality:

- Do the smallest thing that gets pixels on screen, and no more.
- Anything that can happen after the first frame should: put it in a `.task` on the root view rather than in `init`.
- One-time work — migrating a store, moving a token to the keychain — should be keyed to the build it was introduced in, so it runs once and never again. Recording the last build that launched is enough, and the list of steps to run becomes a pure function of two numbers. That is the third exercise.

Never block the main thread in an `App`'s `init` or a view's `init`. Those run before anything is drawn, so every millisecond there is a millisecond of blank screen.

```swift playground
import Foundation

enum Phase {
    case active, inactive, background
}

enum Effect: String {
    case save, hidePreview, showPreview, pauseTimers, resumeTimers, refresh
}

struct SceneMachine {
    private(set) var phase: Phase = .inactive
    private(set) var backgroundedAt: Date?

    mutating func handle(_ new: Phase, at now: Date) -> [Effect] {
        guard new != phase else { return [] }
        defer { phase = new }
        switch (phase, new) {
        case (_, .background):
            backgroundedAt = now
            return [.save, .pauseTimers]
        case (.active, .inactive):
            return [.hidePreview]
        case (_, .active):
            defer { backgroundedAt = nil }
            guard let since = backgroundedAt else { return [.showPreview] }
            let away = now.timeIntervalSince(since)
            return away >= 300 ? [.showPreview, .resumeTimers, .refresh] : [.showPreview, .resumeTimers]
        default:
            return []
        }
    }
}

let start = Date(timeIntervalSinceReferenceDate: 800_000_000)
var machine = SceneMachine()

// A phone call, then back: nothing was lost, so nothing is reloaded.
// Then away for ten minutes, and the feed is worth refreshing.
let script: [(Phase, TimeInterval)] = [
    (.active, 0), (.inactive, 5), (.active, 9),
    (.inactive, 20), (.background, 21), (.inactive, 640), (.active, 641),
]

for (phase, offset) in script {
    let effects = machine.handle(phase, at: start.addingTimeInterval(offset))
    let names = effects.map(\.rawValue).joined(separator: ", ")
    print("t+\(Int(offset))s \(phase) -> \(names.isEmpty ? "nothing to do" : names)")
}
```

## Exercises

### 1. What to do when the app moves

Finish `SceneMachine.handle(_:at:)`. It takes the phase the scene has moved to and the current time, records what it needs, updates `phase`, and returns the effects to run — in the order listed here.

- A repeat of the phase it is already in: no effects, nothing changed.
- Into `.background`, from anywhere: `[.save, .pauseTimers]`, and remember the time in `backgroundedAt`.
- `.active` to `.inactive`: `[.hidePreview]` — the system is about to take its snapshot.
- Into `.active`:
  - if `backgroundedAt` is `nil`, the app was only interrupted: `[.showPreview]`.
  - if it went to the background less than 300 seconds ago: `[.showPreview, .resumeTimers]`.
  - if it was away 300 seconds or more: `[.showPreview, .resumeTimers, .refresh]`.
  - either way `backgroundedAt` is cleared afterwards.
- Anything else — `.background` to `.inactive` on the way back up, for instance: no effects.

```swift starter
enum Phase {
    case active, inactive, background
}

enum Effect: String {
    case save, hidePreview, showPreview, pauseTimers, resumeTimers, refresh
}

struct SceneMachine {
    private(set) var phase: Phase = .inactive
    private(set) var backgroundedAt: Date?

    mutating func handle(_ new: Phase, at now: Date) -> [Effect] {
        return []
    }
}
```

```swift test
/// launching and being interrupted by a call
func testInterruption() {
    let t0 = Date(timeIntervalSinceReferenceDate: 800_000_000)
    var machine = SceneMachine()
    expect(machine.handle(.active, at: t0), [.showPreview])
    expect(machine.phase, .active)
    expect(machine.handle(.inactive, at: t0.addingTimeInterval(5)), [.hidePreview])
    expect(machine.handle(.active, at: t0.addingTimeInterval(9)), [.showPreview])
    expect(machine.backgroundedAt, nil)
}

/// going away saves, and records when
func testBackground() {
    let t0 = Date(timeIntervalSinceReferenceDate: 800_000_000)
    var machine = SceneMachine()
    _ = machine.handle(.active, at: t0)
    _ = machine.handle(.inactive, at: t0.addingTimeInterval(1))
    expect(machine.handle(.background, at: t0.addingTimeInterval(2)), [.save, .pauseTimers])
    expect(machine.phase, .background)
    expect(machine.backgroundedAt, t0.addingTimeInterval(2))
    expect(machine.handle(.inactive, at: t0.addingTimeInterval(60)), [])
}

/// a short trip away resumes without reloading
func testBackShortly() {
    let t0 = Date(timeIntervalSinceReferenceDate: 800_000_000)
    var machine = SceneMachine()
    _ = machine.handle(.active, at: t0)
    _ = machine.handle(.background, at: t0.addingTimeInterval(10))
    _ = machine.handle(.inactive, at: t0.addingTimeInterval(100))
    expect(machine.handle(.active, at: t0.addingTimeInterval(101)), [.showPreview, .resumeTimers])
    expect(machine.backgroundedAt, nil)
}

/// five minutes away is long enough to be stale
func testBackLater() {
    let t0 = Date(timeIntervalSinceReferenceDate: 800_000_000)
    var machine = SceneMachine()
    _ = machine.handle(.active, at: t0)
    _ = machine.handle(.background, at: t0.addingTimeInterval(10))
    expect(machine.handle(.active, at: t0.addingTimeInterval(309)), [.showPreview, .resumeTimers])
    _ = machine.handle(.background, at: t0.addingTimeInterval(400))
    expect(machine.handle(.active, at: t0.addingTimeInterval(700)), [.showPreview, .resumeTimers, .refresh])
}

/// the same phase twice does nothing at all
func testRepeats() {
    let t0 = Date(timeIntervalSinceReferenceDate: 800_000_000)
    var machine = SceneMachine()
    _ = machine.handle(.active, at: t0)
    expect(machine.handle(.active, at: t0.addingTimeInterval(1)), [])
    _ = machine.handle(.background, at: t0.addingTimeInterval(2))
    expect(machine.handle(.background, at: t0.addingTimeInterval(3)), [])
    expect(machine.backgroundedAt, t0.addingTimeInterval(2))
}
```

#### Uses
- [App lifecycle & scenes › Scene phase](#/lifecycle/scene-phase)
- [App lifecycle & scenes › Going to the background](#/lifecycle/going-to-the-background)
- [App lifecycle & scenes › Coming back](#/lifecycle/coming-back)

#### Hints
- `guard new != phase else { return [] }` is the first line, and it has to come before anything is recorded.
- A `switch (phase, new)` over the pair of phases reads better than nested `if`s, and `case (_, .background)` catches the transition from wherever it came.
- `defer { phase = new }` at the top sets the new phase on every path out, so each `return` can be just the effects.
- The staleness test is `now.timeIntervalSince(backgroundedAt) >= 300`.

#### Tips
- Returning effects rather than performing them is what makes a lifecycle testable. The view's job shrinks to `for effect in machine.handle(phase, at: .now) { apply(effect) }`, and every rule above is checkable in a millisecond.
- `now` is a parameter for the same reason it was in the navigation module: a function that reads the wall clock can only be tested by waiting five real minutes.
- Hiding the preview on the way to `.inactive` rather than to `.background` is not a detail. The snapshot for the app switcher is taken during that transition, and a banking app that gets it wrong shows balances in the app switcher.

#### Docs
- [scenePhase](https://developer.apple.com/documentation/swiftui/environmentvalues/scenephase)
- [ScenePhase](https://developer.apple.com/documentation/swiftui/scenephase)

### 2. A link that arrives too early

A deep link can land before the app is ready to handle it. `LinkInbox` holds it until it is.

- `receive(_:)` before `ready()` has been called: store the link as `pending`, replacing anything already waiting, and return `nil`.
- `ready()`: mark the inbox ready, and hand back the waiting link if there is one, clearing `pending`. Nothing waiting means `nil`. Calling it again later returns `nil`.
- `receive(_:)` after the inbox is ready: hand the link straight back and leave `pending` empty.
- `delivered` records every link that was actually handed out, in the order it was handed out.

```swift starter
struct LinkInbox {
    private(set) var isReady = false
    private(set) var pending: URL?
    private(set) var delivered: [URL] = []

    mutating func receive(_ url: URL) -> URL? {
        return nil
    }

    mutating func ready() -> URL? {
        return nil
    }
}
```

```swift test
/// a link while the app is already running goes straight through
func testWarmStart() {
    var inbox = LinkInbox()
    expect(inbox.ready(), nil)
    expect(inbox.isReady, true)
    let link = URL(string: "shop://item/42")!
    expect(inbox.receive(link), link)
    expect(inbox.pending, nil)
    expect(inbox.delivered, [link])
}

/// a link during launch waits for the app to catch up
func testColdStart() {
    var inbox = LinkInbox()
    let link = URL(string: "shop://item/42")!
    expect(inbox.receive(link), nil)
    expect(inbox.pending, link)
    expect(inbox.delivered, [])
    expect(inbox.ready(), link)
    expect(inbox.pending, nil)
    expect(inbox.delivered, [link])
}

/// only the newest waiting link survives
func testNewestWins() {
    var inbox = LinkInbox()
    let first = URL(string: "shop://item/1")!
    let second = URL(string: "shop://item/2")!
    let third = URL(string: "shop://search?q=pens")!
    expect(inbox.receive(first), nil)
    expect(inbox.receive(second), nil)
    expect(inbox.receive(third), nil)
    expect(inbox.pending, third)
    expect(inbox.ready(), third)
    expect(inbox.delivered, [third])
}

/// nothing was waiting
func testNothingWaiting() {
    var inbox = LinkInbox()
    expect(inbox.ready(), nil)
    expect(inbox.delivered, [])
    expect(inbox.ready(), nil)
    expect(inbox.delivered, [])
}

/// everything after launch flows through in order
func testAfterLaunch() {
    var inbox = LinkInbox()
    let queued = URL(string: "shop://item/1")!
    let later = URL(string: "shop://item/2")!
    let last = URL(string: "shop://profile")!
    _ = inbox.receive(queued)
    expect(inbox.ready(), queued)
    expect(inbox.receive(later), later)
    expect(inbox.receive(last), last)
    expect(inbox.delivered, [queued, later, last])
    expect(inbox.pending, nil)
}
```

#### Uses
- [App lifecycle & scenes › Entering from a link](#/lifecycle/entering-from-a-link)
- [App lifecycle & scenes › Work at launch](#/lifecycle/work-at-launch)
- [Navigation › Deep links](#/navigation/deep-links)

#### Hints
- `receive` is one branch: if `isReady`, record it in `delivered` and return it; otherwise set `pending = url` and return `nil`.
- `ready()` sets `isReady = true`, then takes `pending` — reading it, setting it to `nil`, and recording it in `delivered` only if there was one.
- A small `mutating func deliver(_ url: URL) -> URL { delivered.append(url); return url }` keeps both paths honest about recording what they hand out.
- Calling `ready()` twice has to be harmless: after the first call `pending` is `nil`, so there is nothing left to return.

#### Tips
- Keeping only the newest link is deliberate. Three notifications tapped in a row should land the user in one place, not walk them through a history.
- This is a queue of one on purpose. A real queue tempts you to replay a backlog, and replaying navigation is how an app ends up four screens deep for no reason the user can see.
- Test the cold path by killing the app in the simulator, then opening the link from Notes or Messages. The warm path almost always works; the cold one is where the bug is.

#### Docs
- [onOpenURL(perform:)](https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:))
- [Defining a custom URL scheme for your app](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)

### 3. One-time work, exactly once

Some launch work must happen once per user, not once per launch: moving a token into the keychain, adding an index, deleting a cache an old build left behind. Each step is tagged with the build it was introduced in, and the app remembers the last build that launched.

Write `migrations(lastLaunchedBuild:currentBuild:all:)`, which returns the names of the steps to run now, in ascending build order.

- A fresh install — `lastLaunchedBuild` is `nil` — has nothing to migrate: `[]`.
- Otherwise: every step whose build is greater than `lastLaunchedBuild` and no greater than `currentBuild`.
- A downgrade, where `currentBuild` is below `lastLaunchedBuild`, runs nothing.
- `all` may arrive in any order; the result is always sorted by build.

```swift starter
struct Migration {
    let build: Int
    let name: String
}

let allMigrations = [
    Migration(build: 41, name: "drop-legacy-cache"),
    Migration(build: 12, name: "add-index"),
    Migration(build: 30, name: "move-tokens-to-keychain"),
]

func migrations(lastLaunchedBuild: Int?, currentBuild: Int, all: [Migration]) -> [String] {
    return []
}
```

```swift test
/// a fresh install starts where the app is now
func testFreshInstall() {
    expect(migrations(lastLaunchedBuild: nil, currentBuild: 41, all: allMigrations), [])
    expect(migrations(lastLaunchedBuild: nil, currentBuild: 1, all: allMigrations), [])
}

/// an upgrade runs what it skipped, oldest first
func testUpgrade() {
    expect(migrations(lastLaunchedBuild: 1, currentBuild: 41, all: allMigrations),
           ["add-index", "move-tokens-to-keychain", "drop-legacy-cache"])
    expect(migrations(lastLaunchedBuild: 12, currentBuild: 41, all: allMigrations),
           ["move-tokens-to-keychain", "drop-legacy-cache"])
    expect(migrations(lastLaunchedBuild: 30, currentBuild: 41, all: allMigrations),
           ["drop-legacy-cache"])
}

/// relaunching the same build runs nothing
func testSameBuild() {
    expect(migrations(lastLaunchedBuild: 41, currentBuild: 41, all: allMigrations), [])
    expect(migrations(lastLaunchedBuild: 12, currentBuild: 12, all: allMigrations), [])
    expect(migrations(lastLaunchedBuild: 5, currentBuild: 11, all: allMigrations), [])
}

/// a step from a build we have not reached yet waits
func testNotYet() {
    expect(migrations(lastLaunchedBuild: 12, currentBuild: 30, all: allMigrations),
           ["move-tokens-to-keychain"])
    expect(migrations(lastLaunchedBuild: 12, currentBuild: 29, all: allMigrations), [])
}

/// a downgrade runs nothing, and an empty list is fine
func testEdges() {
    expect(migrations(lastLaunchedBuild: 41, currentBuild: 12, all: allMigrations), [])
    expect(migrations(lastLaunchedBuild: 1, currentBuild: 41, all: []), [])
    expect(migrations(lastLaunchedBuild: 0, currentBuild: 12, all: allMigrations), ["add-index"])
}
```

#### Uses
- [App lifecycle & scenes › Work at launch](#/lifecycle/work-at-launch)
- [App lifecycle & scenes › State restoration](#/lifecycle/state-restoration)

#### Hints
- `guard let last = lastLaunchedBuild else { return [] }` handles the fresh install before anything else.
- The filter is one predicate: `$0.build > last && $0.build <= currentBuild`. The downgrade case falls out of it with no extra code.
- `.sorted { $0.build < $1.build }` before `.map(\.name)` gives the order, whatever order `all` arrived in.

#### Tips
- A fresh install running every migration is the classic bug here: the steps are written against data that does not exist yet, and they range from wasteful to destructive. `nil` meaning "brand new" is worth the optional.
- Sorting rather than trusting the array is cheap insurance. The list grows by one line per release, in whatever order someone pastes it, and nothing else will catch the mistake.
- Store the build number after the steps succeed, not before. A crash halfway through should mean they run again next launch, not that they are skipped forever.

#### Docs
- [AppStorage](https://developer.apple.com/documentation/swiftui/appstorage)
- [Bundle.infoDictionary](https://developer.apple.com/documentation/foundation/bundle/infodictionary)

### 4. The app's entry point

Build the `App` struct that wires the last three exercises into a real app: scenes, `scenePhase`, launch work and an inbox for links.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `@main struct` conforming to `App` with a single `WindowGroup`, and the long-lived objects — a `Router`, an `AppModel` — created as `@State` and put into the environment.
- `@Environment(\.scenePhase)` read in the `App` and an `.onChange(of: scenePhase)` that feeds the phase into `SceneMachine` and applies whatever effects come back.
- `.onOpenURL { }` feeding `LinkInbox`, and the resulting link — if any — turned into a navigation path.
- A `.task` on the root view doing launch work: running the migrations for `@AppStorage("lastLaunchedBuild")`, writing the new build **after** they succeed, and then telling the inbox it is `ready()`.
- Nothing expensive in `init`: the whole of launch is inside that `.task`.
- A privacy overlay that appears whenever the phase is not `.active`.

```swift solution
// AppModel.swift
@MainActor
@Observable
final class AppModel {
    private(set) var machine = SceneMachine()
    private(set) var inbox = LinkInbox()
    var isCovered = false

    let router: Router

    init(router: Router) {
        self.router = router
    }

    func phaseChanged(to phase: ScenePhase, now: Date = .now) {
        let next: Phase = switch phase {
        case .active: .active
        case .inactive: .inactive
        default: .background
        }
        for effect in machine.handle(next, at: now) {
            apply(effect)
        }
    }

    func open(_ url: URL) {
        guard let url = inbox.receive(url) else { return }   // held until launch finishes
        navigate(to: url)
    }

    func launch(currentBuild: Int, lastLaunchedBuild: Int?) async -> Int? {
        for step in migrations(lastLaunchedBuild: lastLaunchedBuild, currentBuild: currentBuild, all: allMigrations) {
            await run(step)
        }
        if let queued = inbox.ready() {
            navigate(to: queued)
        }
        return currentBuild   // stored by the caller, only now that the steps are done
    }

    private func navigate(to url: URL) {
        guard let stack = routes(for: url) else { return }
        router.path = stack
    }

    private func apply(_ effect: Effect) {
        switch effect {
        case .save: save()
        case .hidePreview: isCovered = true
        case .showPreview: isCovered = false
        case .pauseTimers, .resumeTimers, .refresh: break   // wired up per feature
        }
    }

    private func save() { /* persist drafts, path, scroll position */ }
    private func run(_ step: String) async { /* the one-time work */ }
}

// ShopApp.swift
@main
struct ShopApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("lastLaunchedBuild") private var lastLaunchedBuild = 0
    @State private var router: Router
    @State private var model: AppModel

    private let currentBuild = 41

    init() {
        let router = Router()
        _router = State(wrappedValue: router)
        _model = State(wrappedValue: AppModel(router: router))
    }

    var body: some Scene {
        WindowGroup {
            RootScreen()
                .environment(router)
                .environment(model)
                .overlay {
                    if model.isCovered {
                        Rectangle()
                            .fill(.regularMaterial)
                            .ignoresSafeArea()
                            .accessibilityHidden(true)
                    }
                }
                .task {
                    let stored = lastLaunchedBuild == 0 ? nil : lastLaunchedBuild
                    if let done = await model.launch(currentBuild: currentBuild, lastLaunchedBuild: stored) {
                        lastLaunchedBuild = done
                    }
                }
                .onOpenURL { url in
                    model.open(url)
                }
        }
        .onChange(of: scenePhase) { _, phase in
            model.phaseChanged(to: phase)
        }
    }
}
```

#### Uses
- [App lifecycle & scenes › The App and its scenes](#/lifecycle/the-app-and-its-scenes)
- [App lifecycle & scenes › Scene phase](#/lifecycle/scene-phase)
- [App lifecycle & scenes › Work at launch](#/lifecycle/work-at-launch)
- [Concurrency & MainActor › MainActor, and where it belongs](#/concurrency/mainactor-and-where-it-belongs)

#### Hints
- `.onChange(of: scenePhase)` can go on the `Scene` itself, not only on a view — which is the right place for something that is about the whole scene.
- `_router = State(wrappedValue: router)` in `init` is how two `@State` objects can be created with one of them holding the other.
- `@AppStorage` cannot hold an optional `Int` directly, so `0` stands in for "never launched" and is mapped to `nil` on the way in.
- Writing `lastLaunchedBuild` only after `launch` returns is what makes a crash mid-migration safe: the steps simply run again.

#### Tips
- Do the work in `.task`, never in `init`. An `App`'s `init` runs before the first frame, so anything slow there is measured directly in blank-screen milliseconds.
- The `.regularMaterial` overlay is the cheap version of a privacy screen. It goes up on the way to `.inactive`, which is before the system takes its app-switcher snapshot — after is too late.
- Two scenes on iPad both run this `App` body. Anything you keep in a `static let` singleton is shared between them, which is a decision, not a default.

#### Docs
- [App](https://developer.apple.com/documentation/swiftui/app)
- [WindowGroup](https://developer.apple.com/documentation/swiftui/windowgroup)
- [UIApplicationDelegateAdaptor](https://developer.apple.com/documentation/swiftui/uiapplicationdelegateadaptor)

### 5. Picking up where they left off

Build restoration: the app is killed while backgrounded, relaunched from the home screen, and opens on the screen the user was last looking at — with their half-typed note still in the box.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- `@SceneStorage("path")` holding the navigation path as an encoded JSON string, not as the array itself.
- `@SceneStorage("draft")` on a note screen holding whatever is in the `TextField`.
- The path written to scene storage when `scenePhase` becomes `.background`, and decoded back into the router once, on appear.
- Decoding guarded so a stored path from another build, or one that is too old, falls back to the root — reusing the versioned snapshot from the navigation module.
- A deliberate check that this actually works: background the app, kill it from Xcode, and relaunch from the home screen rather than from Xcode.
- `@AppStorage` used for one genuine preference — a sort order, say — to make the difference from `@SceneStorage` concrete.

```swift solution
// NotesScreen.swift
struct NotesScreen: View {
    @Environment(Router.self) private var router
    @Environment(\.scenePhase) private var scenePhase

    // Per scene: two windows on iPad restore to two different places.
    @SceneStorage("path") private var storedPath = ""
    @SceneStorage("draft") private var draft = ""

    // Shared by every scene: a preference, not a position.
    @AppStorage("sortNewestFirst") private var sortNewestFirst = true

    @State private var didRestore = false

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.path) {
            Form {
                Section("Draft") {
                    TextField("Note", text: $draft, axis: .vertical)
                        .lineLimit(3...6)
                }
                Section {
                    Toggle("Newest first", isOn: $sortNewestFirst)
                    NavigationLink("Item 1", value: Route.item(1))
                    NavigationLink("Item 2", value: Route.item(2))
                }
            }
            .navigationTitle("Notes")
            .navigationDestination(for: Route.self) { route in
                DetailScreen(route: route)
            }
        }
        .onAppear {
            guard !didRestore else { return }
            didRestore = true
            router.path = restore(storedPath, now: .now)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                storedPath = save(router.path, at: .now)
            }
        }
    }
}

// DetailScreen.swift
struct DetailScreen: View {
    let route: Route

    var body: some View {
        Text(String(describing: route))
            .navigationTitle("Detail")
    }
}

#Preview {
    NotesScreen()
        .environment(Router())
}
```

#### Uses
- [App lifecycle & scenes › State restoration](#/lifecycle/state-restoration)
- [App lifecycle & scenes › Going to the background](#/lifecycle/going-to-the-background)
- [Navigation › Restoring where the user was](#/navigation/restoring-where-the-user-was)
- [Navigation › A stack and a path](#/navigation/a-stack-and-a-path)
- [Reference › SwiftUI app, scenes and storage](#/reference/swiftui-app-scenes-and-storage)

#### Hints
- `@SceneStorage` holds small values only, so encode the `[Route]` to a JSON string first — the `save`/`restore` pair from the navigation module does exactly that.
- Restore once, not on every appearance: a `@State` flag, or `.task {}` which runs once per view identity, both work; `.onAppear` alone fires again when a sheet is dismissed.
- Write on the way to `.background`, not on every change. That is the last moment you are guaranteed, and writing per keystroke is work nobody sees.
- `TextField(..., axis: .vertical)` with `.lineLimit(3...6)` gives a note box that grows as you type.

#### Tips
- Relaunching from Xcode is not the test. Xcode's relaunch is a fresh process the way a crash is; the case you care about is the system killing a backgrounded app and the user tapping the icon later.
- `@SceneStorage` is per scene and `@AppStorage` is per app. Putting a navigation path in `@AppStorage` works right up until an iPad user has two windows open and both jump to the same screen.
- Restoration hurts more than it helps when it restores something invalid. The version-and-age check is not a nicety: without it, the first rename of an enum case turns a relaunch into a wrong screen or a crash.

#### Docs
- [SceneStorage](https://developer.apple.com/documentation/swiftui/scenestorage)
- [Restoring your app's state with SwiftUI](https://developer.apple.com/documentation/swiftui/restoring-your-apps-state-with-swiftui)
