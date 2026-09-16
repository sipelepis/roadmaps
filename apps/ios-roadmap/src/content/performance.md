# Performance

Performance work goes wrong in a predictable way: someone reads that a thing is slow, spends two days making it fast, and ships an app that is no different because that thing was never on the critical path. The discipline is not optimisation, it is measurement — find where the time actually goes, fix the biggest thing, measure again, stop when it is fast enough.

On iOS the numbers you are working against are hard limits. A frame is 16.7 milliseconds at 60Hz and 8.3 at 120. A cold launch has about 400 milliseconds before it feels slow. A phone has a few hundred megabytes for you before the system kills the app. This module is about living inside those numbers.

## Measure, then fix

Two rules, both learned the hard way.

**Measure on a device, not the simulator.** The simulator runs on your Mac's CPU with your Mac's memory and your Mac's disk. It will happily tell you that a scroll is smooth and a launch is instant. Use the oldest device you support, and use a Release build: the optimiser changes Swift performance by an order of magnitude, and a Debug measurement is a measurement of the wrong program.

**Fix the biggest thing.** If 80% of the time is in decoding and 5% in your sorting, making the sort infinitely fast buys you 5%. That ceiling is worth internalising before you start: the most you can ever gain from fixing something is the share of time it takes.

```swift playground
import Foundation

// A profile is a list of where the time went. The only question worth asking of one is:
// if I made this part free, what would the total become?
let profile = [
    ("decodeJSON", 210.0),
    ("layoutRows", 48.0),
    ("sortTrips", 12.0),
    ("formatDates", 6.0),
]

let total = profile.reduce(0) { $0 + $1.1 }
print(String(format: "total %.0fms", total))

for (name, ms) in profile.sorted(by: { $0.1 > $1.1 }) {
    let share = ms / total * 100
    let halved = total - ms / 2
    print(String(format: "%@ %6.1fms  %4.1f%% of the time — twice as fast would save %.0fms",
                 name.padding(toLength: 12, withPad: " ", startingAt: 0), ms, share, total - halved))
}

// The tempting fix is the one you understand. The useful fix is the one at the top of this list.
print("\nfix decodeJSON and everything else together cannot match the win")
```

## Instruments

Instruments is the profiler, and you only need a few of its templates:

- **Time Profiler** — samples the stack and tells you where CPU time goes. The first stop for a slow launch, a slow scroll or a hot phone. Read it with *Separate by Thread* on and *Invert Call Tree* on, so you see the leaves that actually burn the time.
- **Allocations** and **Leaks** — what was allocated, what is still alive, and what is unreachable but never freed. Leaks finds cycles; Allocations finds the more common problem, which is memory that is reachable and should not be.
- **SwiftUI** — how often each view's `body` runs and why it was invalidated. The fastest way to find a view that re-renders on every keystroke.
- **Hangs** and **Time Profiler** together — a hang is main-thread work over a few hundred milliseconds. Xcode's Organizer also reports hangs and launch times from real users, which is the only data that is actually representative.

A profile is evidence. "It feels slow" is a bug report; a trace showing 300ms in `JSONDecoder` on the main thread during launch is a task.

## The main-thread rule

One thread draws your app. Everything the user sees — layout, rendering, touch handling — happens on the main thread, and anything else you do there is time the interface is frozen.

So: no file reads, no decoding, no image resizing, no `String` work over large inputs, and absolutely no network waiting on the main thread. Do it in a `Task`, and come back to the main actor only to publish the result.

```swift
@Observable @MainActor
final class TripListModel {
    var trips: [Trip] = []

    func load() async {
        let decoded = await Task.detached(priority: .userInitiated) {
            try? JSONDecoder().decode([Trip].self, from: bigPayload)
        }.value
        trips = decoded ?? []   // back on the main actor
    }
}
```

The compiler helps here in Swift 6: `@MainActor` is checked, and work that must hop threads has to say so with `await`. What it cannot check is *how much* you do on the main actor once you are there. A view body that sorts ten thousand items is main-thread work the type system is perfectly happy with.

## A budget per frame

The screen refreshes on a fixed cadence, and every refresh your app gets one slot to produce a frame. At 60Hz that is 16.7ms, at 120Hz 8.3ms — and the budget includes the system's own work, so the realistic target is well under it.

Miss the deadline and the previous frame stays on screen for another refresh. One miss is invisible; a miss every few frames is the stutter people call jank. This is why "it only takes 30ms" is not a defence: 30ms of work in a scroll is a dropped frame every time, forever.

The useful mental model is a budget rather than a duration. Ask "what fraction of a frame does this take?", and remember that anything over one frame's worth has to move off the main thread or become cheaper — there is no third option.

## Lists, identity and diffing

Scrolling is where frame budgets get spent. Three things matter.

**Stable identity.** SwiftUI diffs lists by `id`. If the id is stable, an update moves and reuses rows; if the id changes — a fresh `UUID()` per reload, an index as the id, a hash of the whole row — every row is destroyed and rebuilt, and the scroll position jumps. Use the model's own identifier, the one that came from the server or the database.

**Lightweight rows.** A row's `body` runs during scrolling. Keep formatting, sorting and filtering out of it; compute those once when the data changes, not once per row per frame.

**Laziness.** `List` and `LazyVStack` only build what is visible. A plain `VStack` inside a `ScrollView` builds every child immediately, which is fine for ten rows and fatal for a thousand.

```swift
List(trips) { trip in                    // identity from Trip: Identifiable
    TripRow(trip: trip)
}

ForEach(trips, id: \.serverID) { ... }   // explicit, still stable
ForEach(trips.indices, id: \.self) { ... } // ← the bug: identity by position
```

## Images cost more than they look

A JPEG is compressed on disk and uncompressed in memory. A 4000×3000 photo is a couple of megabytes as a file and about **48MB** once decoded — width × height × 4 bytes. Ten of those in a scrolling list is half a gigabyte, and the app dies.

Two fixes, and you need both. **Downsample** at load: decode to roughly the size you will draw, using `CGImageSourceCreateThumbnailAtIndex`, rather than loading full size and scaling in the view. And **cache** the results, with a limit expressed in bytes rather than in items, because "100 images" means nothing when one of them is 48MB and another is 40KB. `NSCache` does this and also drops its contents under memory pressure; a hand-rolled cache should behave the same way.

Decoding happens on first draw unless you force it earlier, which is why a list can stutter on exactly the frame a new image appears. Decode off the main thread, then hand the ready image to the view.

## Launch time

A cold launch is the first impression, and Apple's guidance is to be interactive in under 400ms. The work splits in two: what has to finish before the first frame, and what can happen after it.

Almost everything can happen after it. Analytics SDKs, remote config, preloading the next screen, migrating the database, warming a cache — none of that needs to block the first frame, and all of it routinely does because it was easier to put in `init`.

What must block: enough state to draw the first screen. That is usually a read of `UserDefaults` and a small query. Everything else moves into a `.task` on the first view, or into a background task after launch. Measure it with the Time Profiler's *App Launch* template, and watch the Organizer for what real users get on real devices — a launch that takes 300ms on your phone can take two seconds on the oldest one you support.

## Memory, and what never goes away

Two different problems get called leaks.

A **retain cycle** is two objects holding each other, so neither is freed. In Swift the usual shape is a closure capturing `self` strongly and being stored by `self`. `[weak self]` in escaping closures that outlive the call is the fix, and `Instruments → Leaks` finds them.

The commoner problem is **memory that is still reachable and should not be**: an unbounded cache, an array of every row ever loaded, images kept "in case", observers never removed. Nothing is leaked in the technical sense and the app is killed anyway. The fix is a limit — every cache gets a cost limit, every list gets pagination, every buffer gets a cap.

When memory gets tight the system tells you before it kills you: react to memory-pressure notifications by dropping caches. An app that ignores the warning gets terminated, and a termination during a background upload is data loss.

## Exercises

### 1. What fits in a frame

Work out whether a piece of work fits in a frame, expressed in microseconds so the arithmetic is exact.

`microsecondsPerFrame` is `1_000_000 / hertz`, rounded down by integer division: 16666 at 60Hz, 8333 at 120Hz. `fits(_:)` is true when the work is no longer than one frame. `droppedFrames(_:)` is how many refreshes the screen misses: work that fits drops nothing, and anything longer drops one frame for every whole or partial extra frame it occupies. `utilisation(_:)` is the percentage of a frame the work uses, rounded down, and may exceed 100.

```swift starter
struct FrameBudget {
    let hertz: Int

    var microsecondsPerFrame: Int {
        return 0
    }

    func fits(_ work: Int) -> Bool {
        return true
    }

    func droppedFrames(_ work: Int) -> Int {
        return 0
    }

    func utilisation(_ work: Int) -> Int {
        return 0
    }
}
```

```swift test
let sixty = FrameBudget(hertz: 60)
let oneTwenty = FrameBudget(hertz: 120)

/// the budget itself
func testBudget() {
    expect(sixty.microsecondsPerFrame, 16_666)
    expect(oneTwenty.microsecondsPerFrame, 8_333)
    expect(FrameBudget(hertz: 30).microsecondsPerFrame, 33_333)
}

/// what fits
func testFits() {
    expect(sixty.fits(0), true)
    expect(sixty.fits(10_000), true)
    expect(sixty.fits(16_666), true)
    expect(sixty.fits(16_667), false)
    expect(oneTwenty.fits(10_000), false)
    expect(oneTwenty.fits(8_333), true)
}

/// dropped frames
func testDropped() {
    expect(sixty.droppedFrames(0), 0)
    expect(sixty.droppedFrames(16_666), 0)
    expect(sixty.droppedFrames(16_667), 1)
    expect(sixty.droppedFrames(33_332), 1)
    expect(sixty.droppedFrames(33_333), 2)
    expect(sixty.droppedFrames(100_000), 6)
}

/// the same work is twice as expensive at 120Hz
func testRefreshRate() {
    expect(sixty.droppedFrames(10_000), 0)
    expect(oneTwenty.droppedFrames(10_000), 1)
    expect(sixty.utilisation(10_000), 60)
    expect(oneTwenty.utilisation(10_000), 120)
}

/// utilisation, rounded down
func testUtilisation() {
    expect(sixty.utilisation(0), 0)
    expect(sixty.utilisation(8_333), 50)
    expect(sixty.utilisation(16_666), 100)
    expect(sixty.utilisation(33_332), 200)
    expect(sixty.utilisation(1_000), 6)
    expect(sixty.utilisation(2_777), 16)
}
```

#### Uses
- [Performance › A budget per frame](#/performance/a-budget-per-frame)
- [Performance › Measure, then fix](#/performance/measure-then-fix)

#### Hints
- Integer division already rounds down: `1_000_000 / hertz`.
- `droppedFrames` is a ceiling minus one: `(work + frame - 1) / frame - 1`, with `max(0, ...)` around it for work of zero.
- `utilisation` is `work * 100 / microsecondsPerFrame` — multiply before dividing, or integer division throws the answer away.

#### Tips
- Doing this in integers is not pedantry. `1000.0 / 60` in a `Double` gives 16.666666666666668, and a test on "exactly one frame" then depends on which way the last bit rounded.
- 10ms of work is comfortable at 60Hz and a dropped frame at 120Hz. ProMotion devices are the common ones now, so the tighter budget is the real budget.
- Utilisation over 100% is the number worth putting in a report: "this row costs 240% of a frame" says more than "this row takes 40ms".

#### Docs
- [Improving app responsiveness](https://developer.apple.com/documentation/xcode/improving-app-responsiveness)
- [Analyzing responsiveness issues](https://developer.apple.com/documentation/xcode/analyzing-responsiveness-issues-in-your-shipping-app)

### 2. An image cache with a cost limit

`ImageCache` holds decoded images, measured in bytes, up to `costLimit`. When an insert takes it over the limit, it evicts least-recently-used entries until it fits.

Both `insert` and `value(for:)` count as use, and `keys` lists what is held, most recently used first. Inserting a key that is already there replaces its cost and makes it the most recent. An entry larger than the whole limit is refused: nothing is stored and nothing is evicted.

```swift starter
struct ImageCache {
    let costLimit: Int
    private var costs: [String: Int] = [:]
    private var recency: [String] = []

    init(costLimit: Int) {
        self.costLimit = costLimit
    }

    var totalCost: Int {
        return 0
    }

    var keys: [String] {
        return []
    }

    mutating func insert(_ key: String, cost: Int) {
    }

    mutating func value(for key: String) -> Int? {
        return nil
    }
}
```

```swift test
/// what goes in comes out
func testInsertAndRead() {
    var cache = ImageCache(costLimit: 1_000)
    cache.insert("a", cost: 100)
    cache.insert("b", cost: 200)
    expect(cache.value(for: "a"), 100)
    expect(cache.value(for: "missing"), nil)
    expect(cache.totalCost, 300)
}

/// most recently used first
func testRecencyOrder() {
    var cache = ImageCache(costLimit: 1_000)
    cache.insert("a", cost: 100)
    cache.insert("b", cost: 100)
    cache.insert("c", cost: 100)
    expect(cache.keys, ["c", "b", "a"])
    _ = cache.value(for: "a")
    expect(cache.keys, ["a", "c", "b"])
    _ = cache.value(for: "nothing")
    expect(cache.keys, ["a", "c", "b"])
}

/// the least recently used goes first
func testEviction() {
    var cache = ImageCache(costLimit: 300)
    cache.insert("a", cost: 100)
    cache.insert("b", cost: 100)
    cache.insert("c", cost: 100)
    cache.insert("d", cost: 100)
    expect(cache.keys, ["d", "c", "b"])
    expect(cache.value(for: "a"), nil)
    expect(cache.totalCost, 300)
}

/// reading protects an entry from the next eviction
func testReadProtects() {
    var cache = ImageCache(costLimit: 300)
    cache.insert("a", cost: 100)
    cache.insert("b", cost: 100)
    cache.insert("c", cost: 100)
    _ = cache.value(for: "a")
    cache.insert("d", cost: 100)
    expect(cache.keys, ["d", "a", "c"])
    expect(cache.value(for: "b"), nil)
    expect(cache.value(for: "a"), 100)
    expect(cache.keys, ["a", "d", "c"])
}

/// one big image can evict several small ones
func testBigInsert() {
    var cache = ImageCache(costLimit: 1_000)
    cache.insert("a", cost: 200)
    cache.insert("b", cost: 200)
    cache.insert("c", cost: 200)
    cache.insert("big", cost: 700)
    expect(cache.keys, ["big", "c"])
    expect(cache.totalCost, 900)
}

/// replacing a key updates its cost without duplicating it
func testReplace() {
    var cache = ImageCache(costLimit: 500)
    cache.insert("a", cost: 100)
    cache.insert("b", cost: 100)
    cache.insert("a", cost: 400)
    expect(cache.keys, ["a", "b"])
    expect(cache.totalCost, 500)
    cache.insert("c", cost: 100)
    expect(cache.keys, ["c", "a"])
    expect(cache.totalCost, 500)
}

/// something too big to ever fit is refused
func testTooBig() {
    var cache = ImageCache(costLimit: 300)
    cache.insert("a", cost: 100)
    cache.insert("huge", cost: 400)
    expect(cache.value(for: "huge"), nil)
    expect(cache.keys, ["a"])
    expect(cache.totalCost, 100)
}
```

#### Uses
- [Performance › Images cost more than they look](#/performance/images-cost-more-than-they-look)
- [Performance › Memory, and what never goes away](#/performance/memory-and-what-never-goes-away)
- [SwiftData & files › Caching with a lifetime](#/persistence/caching-with-a-lifetime)

#### Hints
- Keep `recency` as the keys with the most recent at index 0. "Touching" a key is `recency.removeAll { $0 == key }` then `recency.insert(key, at: 0)`.
- `insert` starts by refusing anything over the limit, then removes the old entry if the key is already there, then adds and touches.
- Evicting is `while totalCost > costLimit, let oldest = recency.last` — remove it from both `recency` and `costs`.
- `totalCost` is `costs.values.reduce(0, +)`.

#### Tips
- Evicting *after* inserting is simpler than working out in advance what has to go, and it handles the "one big image displaces three small ones" case without a special path.
- Reading has to count as use, or the cache evicts exactly the images that are on screen. That one line is the difference between an LRU cache and a random one.
- A real cache would use `NSCache`, which also responds to memory pressure and is thread-safe. Writing one once is still worth it — the policy is the part you have to understand when `NSCache` evicts something you wanted.

#### Docs
- [NSCache](https://developer.apple.com/documentation/foundation/nscache)
- [Downsampling images for better performance](https://developer.apple.com/documentation/uikit/uiimage/preparingthumbnail(of:))

### 3. What actually changed

Before a list can update smoothly, something has to work out what changed. `changes(from:to:)` answers that by id.

`inserted` is the ids in `new` that were not in `old`; `removed` the reverse; `updated` is the ids present in both whose `title` differs. All three come back sorted. `reordered` is `true` when the ids present in both appear in a different relative order in the two lists — inserting or removing around them does not count.

```swift starter
struct Row: Equatable {
    let id: String
    let title: String
}

struct Changes: Equatable {
    var inserted: [String] = []
    var removed: [String] = []
    var updated: [String] = []
    var reordered: Bool = false
}

func changes(from old: [Row], to new: [Row]) -> Changes {
    return Changes()
}
```

```swift test
func rows(_ pairs: [(String, String)]) -> [Row] {
    pairs.map { Row(id: $0.0, title: $0.1) }
}

/// nothing happened
func testNoChange() {
    let list = rows([("1", "Lisbon"), ("2", "Oslo")])
    expect(changes(from: list, to: list), Changes())
    expect(changes(from: [], to: []), Changes())
}

/// added and gone
func testInsertRemove() {
    let old = rows([("1", "Lisbon"), ("2", "Oslo")])
    let new = rows([("1", "Lisbon"), ("3", "Rome")])
    expect(changes(from: old, to: new),
           Changes(inserted: ["3"], removed: ["2"], updated: [], reordered: false))
}

/// same id, new contents
func testUpdated() {
    let old = rows([("1", "Lisbon"), ("2", "Oslo")])
    let new = rows([("1", "Lisboa"), ("2", "Oslo")])
    expect(changes(from: old, to: new), Changes(updated: ["1"]))
}

/// order changed, contents did not
func testReordered() {
    let old = rows([("1", "a"), ("2", "b"), ("3", "c")])
    let new = rows([("3", "c"), ("1", "a"), ("2", "b")])
    expect(changes(from: old, to: new), Changes(reordered: true))
}

/// an insertion in the middle is not a reorder
func testInsertIsNotReorder() {
    let old = rows([("1", "a"), ("2", "b")])
    let new = rows([("1", "a"), ("9", "new"), ("2", "b")])
    expect(changes(from: old, to: new), Changes(inserted: ["9"]))
    let shrunk = rows([("2", "b")])
    expect(changes(from: old, to: shrunk), Changes(removed: ["1"]))
}

/// ids regenerated on every load: the whole list churns
func testIdentityChurn() {
    let old = rows([("a1", "Lisbon"), ("a2", "Oslo")])
    let new = rows([("b1", "Lisbon"), ("b2", "Oslo")])
    expect(changes(from: old, to: new),
           Changes(inserted: ["b1", "b2"], removed: ["a1", "a2"]))
}

/// everything at once, sorted
func testEverything() {
    let old = rows([("1", "a"), ("2", "b"), ("3", "c"), ("4", "d")])
    let new = rows([("3", "c!"), ("1", "a"), ("5", "e"), ("2", "b")])
    expect(changes(from: old, to: new),
           Changes(inserted: ["5"], removed: ["4"], updated: ["3"], reordered: true))
}
```

#### Uses
- [Performance › Lists, identity and diffing](#/performance/lists-identity-and-diffing)
- [Performance › Measure, then fix](#/performance/measure-then-fix)
- [Reference › Collections](#/reference/collections)

#### Hints
- Build `[String: String]` from id to title for each side; the three id sets fall out of `Set` operations on the keys.
- `Set(newIds).subtracting(oldIds).sorted()` is `inserted`.
- For `reordered`, take the common ids in `old` order and the common ids in `new` order — two arrays — and compare them.

#### Tips
- Comparing the common ids in their two orders is what makes an insertion in the middle *not* a reorder: the inserted id is not common, so it never enters either array.
- `Changes` has defaults for every field, so a test can name only the parts that are not empty. That makes the expectations readable, and it is worth designing result types that way.
- This is the diff SwiftUI computes for you from `id`. The point of writing it once is to see exactly what an unstable id does: `testIdentityChurn` is every row destroyed and rebuilt, which on screen is a flash and a lost scroll position.

#### Docs
- [Identifiable](https://developer.apple.com/documentation/swift/identifiable)
- [ForEach](https://developer.apple.com/documentation/swiftui/foreach)

### 4. Get the launch under budget

Launch does a list of tasks. Some must finish before the first frame; some are only there because someone put them in `init`. `plan` decides what to defer.

Start with every task blocking. While the total of the blocking tasks is over `budget` and there is still a deferrable one among them, defer the most expensive deferrable task — ties broken by taking the alphabetically first name. Stop when it fits, or when only required tasks are left. `blocking` and `deferred` come back sorted by name, `blockingCost` is the total of what still blocks, and `withinBudget` says whether that total is within it.

```swift starter
struct StartupTask {
    let name: String
    let cost: Int
    let required: Bool
}

struct LaunchPlan: Equatable {
    let blocking: [String]
    let deferred: [String]
    let blockingCost: Int
    let withinBudget: Bool
}

func plan(_ tasks: [StartupTask], budget: Int) -> LaunchPlan {
    return LaunchPlan(blocking: tasks.map(\.name).sorted(), deferred: [],
                      blockingCost: tasks.reduce(0) { $0 + $1.cost }, withinBudget: false)
}
```

```swift test
let launch = [
    StartupTask(name: "readDefaults", cost: 20, required: true),
    StartupTask(name: "firstQuery", cost: 80, required: true),
    StartupTask(name: "analytics", cost: 150, required: false),
    StartupTask(name: "remoteConfig", cost: 120, required: false),
    StartupTask(name: "warmCache", cost: 60, required: false),
]

/// already fast enough: nothing is deferred
func testFits() {
    let got = plan(launch, budget: 1_000)
    expect(got, LaunchPlan(blocking: ["analytics", "firstQuery", "readDefaults",
                                      "remoteConfig", "warmCache"],
                           deferred: [], blockingCost: 430, withinBudget: true))
}

/// the most expensive deferrable goes first
func testDefersOne() {
    let got = plan(launch, budget: 300)
    expect(got.deferred, ["analytics"])
    expect(got.blockingCost, 280)
    expect(got.withinBudget, true)
}

/// keep going until it fits
func testDefersSeveral() {
    let got = plan(launch, budget: 180)
    expect(got.deferred, ["analytics", "remoteConfig"])
    expect(got.blocking, ["firstQuery", "readDefaults", "warmCache"])
    expect(got.blockingCost, 160)
    expect(got.withinBudget, true)
}

/// required work can blow the budget on its own
func testImpossible() {
    let got = plan(launch, budget: 50)
    expect(got.deferred, ["analytics", "remoteConfig", "warmCache"])
    expect(got.blocking, ["firstQuery", "readDefaults"])
    expect(got.blockingCost, 100)
    expect(got.withinBudget, false)
}

/// ties go to the alphabetically first name
func testTies() {
    let tasks = [
        StartupTask(name: "zebra", cost: 100, required: false),
        StartupTask(name: "apple", cost: 100, required: false),
        StartupTask(name: "core", cost: 10, required: true),
    ]
    let got = plan(tasks, budget: 150)
    expect(got.deferred, ["apple"])
    expect(got.blocking, ["core", "zebra"])
}

/// degenerate inputs
func testEmpty() {
    expect(plan([], budget: 0),
           LaunchPlan(blocking: [], deferred: [], blockingCost: 0, withinBudget: true))
    expect(plan([StartupTask(name: "only", cost: 5, required: false)], budget: 0),
           LaunchPlan(blocking: [], deferred: ["only"], blockingCost: 0, withinBudget: true))
}
```

#### Uses
- [Performance › Launch time](#/performance/launch-time)
- [Performance › Measure, then fix](#/performance/measure-then-fix)

#### Hints
- Keep `var blocking = tasks` and `var deferred: [StartupTask] = []`, then loop while the cost is over budget.
- The candidate each round is `blocking.filter { !$0.required }` sorted by cost descending and then by name — `.sorted { ($0.cost, $1.name) > ($1.cost, $0.name) }` is fiddly, so sort by name first and then take the max by cost.
- `blocking.firstIndex { $0.name == chosen.name }` gives you what to remove.
- Stop the loop when no deferrable task is left, and report `withinBudget` from the final cost.

#### Tips
- Greedy is right here because deferring is free: there is no cost to moving work after the first frame, so the biggest saving is always the best next move. That is not true when deferral has a price — then it is a knapsack problem, and much less fun.
- The tie-break exists only to make the answer deterministic. Any rule would do; having *no* rule gives you a function whose output depends on dictionary ordering, which is a test that fails once a fortnight.
- In a real app the analytics SDK is the one at the top of this list, every single time.

#### Docs
- [Reducing your app's launch time](https://developer.apple.com/documentation/xcode/reducing-your-app-s-launch-time)
- [Improving app responsiveness](https://developer.apple.com/documentation/xcode/improving-app-responsiveness)

### 5. Profile it, then fix it

Take a list screen that stutters and make it smooth — with a trace before and after, not a guess.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A list of at least 500 rows, each with a photo loaded from a file or a bundled asset, that visibly stutters when scrolled on a device.
- A **Time Profiler** trace of the stutter, taken on a device with a Release build, with *Invert Call Tree* on — write down the top three symbols before changing anything.
- The image work moved off the main thread and downsampled with `CGImageSourceCreateThumbnailAtIndex` to roughly the drawn size, rather than loading full-size images.
- A cache with a **byte** cost limit (`NSCache` with `totalCostLimit`, cost set per image), not a count limit.
- Row identity taken from the model's own id — not `\.self` on indices — and any formatting hoisted out of the row's `body`.
- A second trace after the fix, and a note of the actual numbers: main-thread time per frame before and after.

```swift solution
// Downsampling: decode straight to the size you will draw. The full-size decode never happens.
import ImageIO
import UIKit

func downsampledImage(at url: URL, maxPixelSize: CGFloat, scale: CGFloat) -> UIImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

    let options = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixelSize * scale,
    ] as [CFString: Any] as CFDictionary

    guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
    return UIImage(cgImage: thumbnail)
}

// A cache limited by bytes, not by count, and emptied under memory pressure by the system.
final class ThumbnailCache {
    static let shared = ThumbnailCache()
    private let cache = NSCache<NSURL, UIImage>()

    private init() {
        cache.totalCostLimit = 50 * 1_024 * 1_024   // 50MB of decoded pixels
    }

    func image(for url: URL) -> UIImage? {
        cache.object(forKey: url as NSURL)
    }

    func store(_ image: UIImage, for url: URL) {
        let bytes = Int(image.size.width * image.size.height * image.scale * image.scale * 4)
        cache.setObject(image, forKey: url as NSURL, cost: bytes)
    }
}

// The loading happens in a task, off the main actor, and only the finished image comes back.
struct Thumbnail: View {
    let url: URL
    @State private var image: UIImage?

    var body: some View {
        Color.secondary.opacity(0.1)
            .overlay {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                }
            }
            .frame(width: 60, height: 60)
            .clipShape(.rect(cornerRadius: 8))
            .task(id: url) {
                if let cached = ThumbnailCache.shared.image(for: url) {
                    image = cached
                    return
                }
                let loaded = await Task.detached(priority: .userInitiated) {
                    downsampledImage(at: url, maxPixelSize: 60, scale: 3)
                }.value
                if let loaded {
                    ThumbnailCache.shared.store(loaded, for: url)
                    image = loaded
                }
            }
    }
}

// The list: stable identity, a lazy container, and no formatting inside the row body.
struct PhotoList: View {
    let photos: [Photo]        // Photo: Identifiable, id came from the server

    var body: some View {
        List(photos) { photo in
            HStack(spacing: 12) {
                Thumbnail(url: photo.url)
                VStack(alignment: .leading) {
                    Text(photo.title)
                    Text(photo.formattedDate)   // formatted once, when the model was built
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
```

#### Uses
- [Performance › Instruments](#/performance/instruments)
- [Performance › The main-thread rule](#/performance/the-main-thread-rule)
- [Performance › Images cost more than they look](#/performance/images-cost-more-than-they-look)
- [Performance › Lists, identity and diffing](#/performance/lists-identity-and-diffing)

#### Hints
- Product → Profile (⌘I) builds for profiling in Release and opens Instruments with the template picker.
- In the Time Profiler, filter to the main thread and turn on *Invert Call Tree*: the top row is where the time actually goes.
- `.task(id: url)` restarts when the row is reused for a different URL, which is exactly the behaviour a recycled row needs.

#### Tips
- Write the three numbers down before you change anything. Without a before, "it feels better now" is the only report you can give, and it is not one anyone can check.
- `kCGImageSourceShouldCache: false` on the source and `ShouldCacheImmediately: true` on the thumbnail is the pairing that matters: do not keep the full-size decode, do force the small one to decode now, off the main thread.
- If the stutter survives all this, profile again rather than continuing to guess. The second bottleneck is usually somewhere else entirely — often a `body` that re-runs far more often than you expect, which the SwiftUI instrument will show you.

#### Docs
- [Instruments](https://developer.apple.com/documentation/xcode/improving-your-app-s-performance)
- [CGImageSourceCreateThumbnailAtIndex](https://developer.apple.com/documentation/imageio/cgimagesourcecreatethumbnailatindex(_:_:_:))
- [NSCache](https://developer.apple.com/documentation/foundation/nscache)
