# Observable models

`@State` is for a view's own small facts. The app's data — the cart, the document, the signed-in user — is usually shared, long-lived and mutated from several places, which is what reference types are for. The `@Observable` macro makes a class SwiftUI can watch, and watch *precisely*: a view is invalidated only by the properties it actually read, not by every change the model ever makes.

## Reference types, and why a model is one

A struct in `@State` is copied on every read, and that is exactly right for a toggle. It is wrong for a shopping cart that a list, a badge and a checkout button all need to see, because there would be three copies and no way to keep them in step.

A class gives you one instance and many references. The cost is the usual cost of shared mutable state — anyone can change it, from anywhere — so a model earns its keep by owning its rules: methods that make legal changes, and computed properties for everything derived. A class with nothing but `var`s is a struct with extra hazards.

## The `@Observable` macro

```swift
@Observable
final class Cart {
    var lines: [Line] = []
    var promo: String?

    var subtotalPence: Int { lines.reduce(0) { $0 + $1.unitPence * $1.qty } }
}
```

That is the whole adoption. No `ObservableObject`, no `@Published` on each property, no `objectWillChange`. The macro rewrites the stored properties so that reading one registers a dependency and writing one notifies whoever depends on it — and, crucially, computed properties come along for free: reading `subtotalPence` registers a dependency on `lines`, because that is what it read.

Mark the class `final` unless you have a reason not to, and `@Observable` will not work on a struct — it needs identity.

Against the older `ObservableObject`, the differences that matter are: nothing needs `@Published`; a view depends on properties rather than on the whole object; and a change to a property no view is reading costs nothing at all.

## `@State` with a model

A view that *creates* a model owns it, and the annotation is `@State`:

```swift
struct CartScreen: View {
    @State private var cart = Cart()
    …
}
```

That looks odd the first time — `@State` for a reference type — but it is right: `@State` means "SwiftUI keeps this for me across rebuilds", and a class needs that just as much as an `Int` does. It is created once, on first appearance, and survives every rebuild of the struct.

A view that merely *uses* a model takes it as a plain `let`:

```swift
struct CartBadge: View {
    let cart: Cart          // no wrapper at all
    var body: some View { Text("\(cart.itemCount)") }
}
```

There is no `@ObservedObject` equivalent, and none is needed: reading `cart.itemCount` inside `body` is what creates the dependency. This is the biggest practical simplification `@Observable` brought.

## `@Bindable`

When a child needs to *write* to the model's properties — a `TextField`, a `Toggle` — it needs bindings, and `@Bindable` produces them:

```swift
struct ProfileEditor: View {
    @Bindable var profile: Profile

    var body: some View {
        TextField("Name", text: $profile.name)
    }
}
```

Inside a `body` you can also make one locally, which is the trick for a model that arrived from the environment: `@Bindable var profile = profile` as the first line of `body`, then `$profile.name` below it.

`@Bindable` is only for writing. A view that just displays the model should take a `let` — fewer capabilities, fewer ways to be wrong.

## Derive, do not store

A model's computed properties are the best part of this design. `subtotalPence`, `isValid`, `visibleItems` — anything that is a function of the stored state — should be computed, and then it cannot go stale.

```swift
var discountPence: Int {
    switch promo {
    case "SAVE10": return subtotalPence / 10
    case "FIVER": return min(500, subtotalPence)
    default: return 0
    }
}
var totalPence: Int { subtotalPence - discountPence }
```

With `@Observable` this is not merely tidy, it is efficient: a view reading `totalPence` depends on `lines` and `promo` transitively, so it updates when either changes and not otherwise. A stored `total` you remember to recalculate is one you will forget to recalculate.

The exception is a value that is genuinely expensive and read constantly — a sorted index over ten thousand rows. Then cache deliberately, with the invalidation written down, and know you have taken on a correctness risk to buy speed.

## When a view actually re-renders

The rule is: a view re-runs its `body` when a property it *read during the last body* changes.

- Reading `cart.itemCount` and nothing else means a change to `cart.promo` does not touch this view.
- A view that holds a model but reads none of its properties never re-renders from it.
- A change to a property no view reads costs one store and nothing else.
- Writing the same value still marks the property changed; SwiftUI then compares the resulting view tree, so you pay for a `body` call, not for a redraw.

The old `ObservableObject` model was coarser: any `@Published` change published `objectWillChange`, and every view observing the object re-rendered. On a big model shared by a dozen screens that is the difference between an app that stays smooth and one that does not, and the first exercise measures exactly that gap.

## Where the model comes from

Three patterns, in order of how often you should reach for them:

1. **Owned by a screen** — `@State private var model = Model()`, passed down as `let`. Start here.
2. **Passed explicitly** — the parent owns it, the child takes it as a parameter. Still obvious, still previewable.
3. **In the environment** — `.environment(model)` on an ancestor and `@Environment(Model.self) private var model` in a descendant, for something genuinely app-wide such as the signed-in user. It is invisible data flow, so spend it sparingly; and a view that reads it will crash in a preview unless the preview supplies one.

Whatever you choose, previews decide whether it was a good idea. If a view can only be rendered inside a running app, the model is in the wrong place.

```swift playground
// Why @Observable replaced ObservableObject: the same change, two invalidation rules.
struct Observer {
    let name: String
    let reads: Set<String>
}

let screen = [
    Observer(name: "CartBadge", reads: ["lines"]),
    Observer(name: "TotalLabel", reads: ["lines", "promo"]),
    Observer(name: "PromoField", reads: ["promo"]),
    Observer(name: "HelpButton", reads: []),
]

func withObservation(_ changed: Set<String>, _ observers: [Observer]) -> [String] {
    observers.filter { !$0.reads.isDisjoint(with: changed) }.map(\.name)
}

func withObservableObject(_ changed: Set<String>, _ observers: [Observer]) -> [String] {
    changed.isEmpty ? [] : observers.map(\.name)
}

for changed in [Set(["lines"]), Set(["promo"]), Set(["lastSyncedAt"])] {
    print("changed \(changed.sorted())")
    print("  @Observable:      \(withObservation(changed, screen))")
    print("  ObservableObject: \(withObservableObject(changed, screen))")
}

// The third case is the interesting one: a property nobody displays. Under the old
// model, touching it still redrew all four views.
```

## Exercises

### 1. Who re-renders?

Two invalidation rules, side by side. Implement both and the difference stops being a slogan.

Each observer is a view with the set of model properties it read during its last `body`.

`rerenders(after:observers:)` is the `@Observable` rule: an observer re-renders when at least one property it read is among the changed ones.

`rerendersWithObservableObject(after:observers:)` is the old rule: if anything changed at all, every observer of the object re-renders — including ones that read nothing.

Both return the names in the order the observers were given.

```swift starter
struct Observer: Equatable {
    let name: String
    let reads: Set<String>
}

func rerenders(after changed: Set<String>, observers: [Observer]) -> [String] {
    return []
}

func rerendersWithObservableObject(after changed: Set<String>, observers: [Observer]) -> [String] {
    return []
}
```

```swift test
let screen = [
    Observer(name: "CartBadge", reads: ["lines"]),
    Observer(name: "TotalLabel", reads: ["lines", "promo"]),
    Observer(name: "PromoField", reads: ["promo"]),
    Observer(name: "HelpButton", reads: []),
]

/// nothing changed, nothing re-renders
func testNoChange() {
    expect(rerenders(after: [], observers: screen), [])
    expect(rerendersWithObservableObject(after: [], observers: screen), [])
    expect(rerenders(after: ["lines"], observers: []), [])
}

/// only the views that read the changed property
func testPrecise() {
    expect(rerenders(after: ["lines"], observers: screen), ["CartBadge", "TotalLabel"])
    expect(rerenders(after: ["promo"], observers: screen), ["TotalLabel", "PromoField"])
    expect(rerenders(after: ["lines", "promo"], observers: screen),
           ["CartBadge", "TotalLabel", "PromoField"])
}

/// a property nobody displays costs nothing
func testUnreadProperty() {
    expect(rerenders(after: ["lastSyncedAt"], observers: screen), [])
    expect(rerenders(after: ["lastSyncedAt", "promo"], observers: screen), ["TotalLabel", "PromoField"])
}

/// a view that reads nothing is never invalidated by the model
func testReadsNothing() {
    expect(rerenders(after: ["lines", "promo", "lastSyncedAt"], observers: screen),
           ["CartBadge", "TotalLabel", "PromoField"])
}

/// the old rule does not care what anyone read
func testObservableObjectIsCoarse() {
    expect(rerendersWithObservableObject(after: ["lines"], observers: screen),
           ["CartBadge", "TotalLabel", "PromoField", "HelpButton"])
    expect(rerendersWithObservableObject(after: ["lastSyncedAt"], observers: screen),
           ["CartBadge", "TotalLabel", "PromoField", "HelpButton"])
}

/// the gap between the two rules is the whole reason the macro exists
func testTheGap() {
    let changed: Set<String> = ["lastSyncedAt"]
    expect(rerenders(after: changed, observers: screen).count, 0)
    expect(rerendersWithObservableObject(after: changed, observers: screen).count, 4)
}
```

#### Uses
- [Observable models › When a view actually re-renders](#/observation/when-a-view-actually-re-renders)
- [Observable models › The `@Observable` macro](#/observation/the-observable-macro)

#### Hints
- `Set` has `isDisjoint(with:)`, so "read at least one changed property" is `!reads.isDisjoint(with: changed)`.
- `filter` then `map(\.name)` keeps the input order for free.
- The old rule has only one decision to make, and it is about `changed`, not about any observer.
- An empty change set must produce nothing under both rules; that is the one case they agree on.

#### Tips
- `testTheGap` is the exercise in one line: a timestamp nobody shows on screen redraws four views under the old rule and none under the new one. Multiply that by a model updated once a second and you have the reason the macro exists.
- The `@Observable` rule depends on what the last `body` read, not on what the view *could* read. A property behind an `if` that was false last time is not a dependency — which is how a view can stop and start observing something.
- This also explains the classic `ObservableObject` workaround of splitting a fat model into several small ones. With `@Observable` that split buys you nothing, so you can keep the model shaped like the domain.

#### Docs
- [Observable](https://developer.apple.com/documentation/observation/observable())
- [Migrating from the Observable Object protocol to the Observable macro](https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro)

### 2. A model that derives everything it can

Write the cart. The stored state is two properties; everything else on the screen is a function of them.

- `itemCount` is the total quantity across the lines, not the number of lines.
- `subtotalPence` is the sum of `unitPence * qty`.
- `discountPence`: `"SAVE10"` takes a tenth of the subtotal, rounded down by integer division; `"FIVER"` takes 500, or the whole subtotal if it is smaller; anything else — including `nil` — takes nothing.
- `totalPence` is the subtotal less the discount.
- `summary` is `"Empty"` for an empty cart, otherwise `"1 item · £4.50"` or `"3 items · £22.05"`, using the total and the right plural.
- `add(_:)` merges into an existing line with the same name by increasing its quantity; otherwise it appends.
- `remove(name:)` removes every line with that name.

```swift starter
struct Line: Equatable {
    let name: String
    let unitPence: Int
    var qty: Int
}

final class Cart {
    var lines: [Line]
    var promo: String?

    init(lines: [Line] = [], promo: String? = nil) {
        self.lines = lines
        self.promo = promo
    }

    var itemCount: Int { 0 }

    var subtotalPence: Int { 0 }

    var discountPence: Int { 0 }

    var totalPence: Int { 0 }

    var summary: String { "Empty" }

    func add(_ line: Line) {
    }

    func remove(name: String) {
    }
}
```

```swift test
func pen(_ name: String, _ unit: Int, _ qty: Int) -> Line {
    Line(name: name, unitPence: unit, qty: qty)
}

/// an empty cart is all zeroes
func testEmpty() {
    let cart = Cart()
    expect(cart.itemCount, 0)
    expect(cart.subtotalPence, 0)
    expect(cart.totalPence, 0)
    expect(cart.summary, "Empty")
}

/// quantities count, not lines
func testTotals() {
    let cart = Cart(lines: [pen("Pen", 150, 2), pen("Pad", 450, 1)])
    expect(cart.itemCount, 3)
    expect(cart.subtotalPence, 750)
    expect(cart.totalPence, 750)
}

/// the promo code is applied to the subtotal
func testDiscounts() {
    expect(Cart(lines: [pen("Pad", 2450, 1)], promo: "SAVE10").discountPence, 245)
    expect(Cart(lines: [pen("Pad", 2450, 1)], promo: "SAVE10").totalPence, 2205)
    expect(Cart(lines: [pen("Pen", 155, 1)], promo: "SAVE10").discountPence, 15)
    expect(Cart(lines: [pen("Pad", 2450, 1)], promo: "FIVER").totalPence, 1950)
    expect(Cart(lines: [pen("Pen", 300, 1)], promo: "FIVER").totalPence, 0)
    expect(Cart(lines: [pen("Pad", 2450, 1)], promo: "NOPE").totalPence, 2450)
    expect(Cart(promo: "SAVE10").discountPence, 0)
}

/// the summary formats the total and gets the plural right
func testSummary() {
    expect(Cart(lines: [pen("Pen", 450, 1)]).summary, "1 item · £4.50")
    expect(Cart(lines: [pen("Pen", 150, 2), pen("Pad", 450, 1)]).summary, "3 items · £7.50")
    expect(Cart(lines: [pen("Pad", 2450, 1)], promo: "SAVE10").summary, "1 item · £22.05")
    expect(Cart(lines: [pen("Pen", 300, 1)], promo: "FIVER").summary, "1 item · £0.00")
    expect(Cart(lines: [pen("Pen", 10_000, 1)]).summary, "1 item · £100.00")
}

/// adding merges by name instead of stacking duplicate lines
func testAddMerges() {
    let cart = Cart()
    cart.add(pen("Pen", 150, 1))
    cart.add(pen("Pad", 450, 2))
    expect(cart.lines.count, 2)
    cart.add(pen("Pen", 150, 3))
    expect(cart.lines.count, 2)
    expect(cart.lines[0], pen("Pen", 150, 4))
    expect(cart.itemCount, 6)
}

/// every derived value moves the moment the stored state does
func testDerivedValuesFollow() {
    let cart = Cart(lines: [pen("Pen", 150, 2)])
    expect(cart.summary, "2 items · £3.00")
    cart.promo = "SAVE10"
    expect(cart.discountPence, 30)
    expect(cart.summary, "2 items · £2.70")
    cart.remove(name: "Pen")
    expect(cart.itemCount, 0)
    expect(cart.summary, "Empty")
    expect(cart.discountPence, 0)
}
```

#### Uses
- [Observable models › Derive, do not store](#/observation/derive-do-not-store)
- [Observable models › Reference types, and why a model is one](#/observation/reference-types-and-why-a-model-is-one)
- [State & bindings › One source of truth](#/state/one-source-of-truth)
- [Reference › Collections](#/reference/collections)

#### Hints
- `lines.reduce(0) { $0 + $1.qty }` and `lines.reduce(0) { $0 + $1.unitPence * $1.qty }` are the two totals.
- Integer division already rounds down, so a tenth of the subtotal is `subtotalPence / 10`.
- For the money string, `pence / 100` is the pounds and `pence % 100` is the pence; `String(format: "%02d", …)` pads the second half. Foundation is imported for you here.
- `add` is `if let index = lines.firstIndex(where: { $0.name == line.name })`, then `lines[index].qty += line.qty`, else `lines.append(line)`.

#### Tips
- `testDerivedValuesFollow` is the whole argument. Nothing recalculated anything — the values are the calculation, so there is no moment at which the screen can show a stale total.
- Money in `Int` pence, not `Double` pounds. `0.1 + 0.2` is not `0.3` in binary floating point, and a currency total that is out by a penny is a bug report you cannot reproduce.
- The plural here is hardcoded English. A real app uses a `String.LocalizationValue` with a plural rule, because plenty of languages have more than two forms — but the shape of the code is the same.

#### Docs
- [Managing model data in your app](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)
- [Properties](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/properties/)

### 3. A model that loads

Give the model the one piece of async state a screen really needs: idle, loading, loaded or failed, with no way to end up in two of them at once.

`load(using:)` runs the fetch and moves `state` through it: `.loading` while the fetch is in flight, then `.loaded` with the items, or `.failed` with a message. A `LoadError` contributes its own message; any other error becomes `"Something went wrong"`. Loading again from any state starts over.

```swift starter
struct LoadError: Error {
    let message: String
}

enum LoadState: Equatable {
    case idle
    case loading
    case loaded([String])
    case failed(String)
}

final class Feed {
    private(set) var state: LoadState = .idle

    func load(using fetch: () async throws -> [String]) async {
    }
}
```

```swift test
struct Boom: Error {}

/// a new feed has not tried yet
func testStartsIdle() {
    let feed = Feed()
    expect(feed.state, .idle)
}

/// a successful fetch ends in loaded
func testLoads() async {
    let feed = Feed()
    await feed.load { ["Ada", "Grace"] }
    expect(feed.state, .loaded(["Ada", "Grace"]))
    await feed.load { [] }
    expect(feed.state, .loaded([]))
}

/// the state is loading while the fetch is still running
func testLoadingWhileInFlight() async {
    let feed = Feed()
    await feed.load {
        expect(feed.state, .loading)
        return ["x"]
    }
    expect(feed.state, .loaded(["x"]))
}

/// a LoadError carries its own message through
func testFailsWithMessage() async {
    let feed = Feed()
    await feed.load { throw LoadError(message: "offline") }
    expect(feed.state, .failed("offline"))
}

/// anything else gets a message the user can read
func testFailsWithFallback() async {
    let feed = Feed()
    await feed.load { throw Boom() }
    expect(feed.state, .failed("Something went wrong"))
}

/// retrying starts over from whatever state it was in
func testRetry() async {
    let feed = Feed()
    await feed.load { throw LoadError(message: "offline") }
    expect(feed.state, .failed("offline"))
    await feed.load {
        expect(feed.state, .loading)
        return ["Ada"]
    }
    expect(feed.state, .loaded(["Ada"]))
    await feed.load { throw Boom() }
    expect(feed.state, .failed("Something went wrong"))
}
```

#### Uses
- [Observable models › Derive, do not store](#/observation/derive-do-not-store)
- [Observable models › Reference types, and why a model is one](#/observation/reference-types-and-why-a-model-is-one)
- [State & bindings › One source of truth](#/state/one-source-of-truth)
- [Reference › Observation, SwiftData and storage](#/reference/observation-swiftdata-and-storage)

#### Hints
- Set `state = .loading` before the `do` block, so the state is right while the fetch is suspended.
- `do { state = .loaded(try await fetch()) } catch { … }` is the whole body.
- In the `catch`, `error as? LoadError` picks out the one you can quote; `?.message ?? "Something went wrong"` supplies the rest.
- `fetch` is not marked `@escaping`, so it is called and finished inside `load`. That is why the tests can check `feed.state` from inside it.

#### Tips
- One `state` property rather than `isLoading`, `items` and `errorMessage` is the point. With three properties there are eight combinations and only four of them mean anything; with an enum the illegal ones cannot be written down.
- The "loading while in flight" test is unusual and worth keeping. It is the difference between a spinner that appears and one that appears *before* the work starts, which is what the user actually experiences.
- A real screen also needs cancellation: if the view goes away mid-fetch, the `Task` should be cancelled rather than writing to a model nobody is watching. The Concurrency module takes that up, along with why this model's mutations belong on the main actor.

#### Docs
- [LoadState-style enums: Modeling app state](https://developer.apple.com/documentation/swiftui/model-data)
- [do-catch](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/errorhandling/)

### 4. The cart, on screen

Take the model you just wrote, mark it `@Observable`, and build the screen around it. The point is how little wiring is left.

#### Build it
- `@Observable final class Cart` with `lines` and `promo` stored, and every total computed.
- A `CartScreen` owning it with `@State private var cart = Cart()` — the only view that creates one.
- A `CartBadge` and a `CartTotals` taking the cart as a plain `let`, with no property wrapper of any kind.
- Buttons that call methods on the model — `cart.add(…)`, `cart.remove(name:)` — rather than mutating `cart.lines` from the view.
- A `#Preview` that builds a `Cart` with sample lines, proving the screen renders with no app running.

```swift solution
// Cart.swift
struct Line: Identifiable, Equatable {
    var id: String { name }
    let name: String
    let unitPence: Int
    var qty: Int
}

@Observable
final class Cart {
    var lines: [Line] = []
    var promo: String?

    var itemCount: Int { lines.reduce(0) { $0 + $1.qty } }
    var subtotalPence: Int { lines.reduce(0) { $0 + $1.unitPence * $1.qty } }

    var discountPence: Int {
        switch promo {
        case "SAVE10": subtotalPence / 10
        case "FIVER": min(500, subtotalPence)
        default: 0
        }
    }

    var totalPence: Int { subtotalPence - discountPence }

    func add(_ line: Line) {
        if let index = lines.firstIndex(where: { $0.name == line.name }) {
            lines[index].qty += line.qty
        } else {
            lines.append(line)
        }
    }

    func remove(name: String) {
        lines.removeAll { $0.name == name }
    }

    static var sample: Cart {
        let cart = Cart()
        cart.add(Line(name: "Pen", unitPence: 150, qty: 2))
        cart.add(Line(name: "Pad", unitPence: 450, qty: 1))
        return cart
    }
}

// Money.swift
extension Int {
    /// Pence, formatted as a localised currency string.
    var asMoney: String {
        (Decimal(self) / 100).formatted(.currency(code: "GBP"))
    }
}

// CartScreen.swift
struct CartScreen: View {
    // The only place a Cart is created. Everything below takes it as a `let`.
    @State private var cart = Cart()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(cart.lines) { line in
                        LineRow(line: line)
                            .swipeActions {
                                Button("Remove", role: .destructive) {
                                    cart.remove(name: line.name)
                                }
                            }
                    }
                } header: {
                    Text("Items")
                } footer: {
                    if cart.lines.isEmpty { Text("Nothing in the cart yet.") }
                }

                Section("Total") {
                    CartTotals(cart: cart)
                }
            }
            .navigationTitle("Cart")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    CartBadge(cart: cart)
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("Add a pen", systemImage: "plus") {
                        cart.add(Line(name: "Pen", unitPence: 150, qty: 1))
                    }
                }
            }
        }
    }
}

// CartBadge.swift — reads one property, so only that property invalidates it.
struct CartBadge: View {
    let cart: Cart

    var body: some View {
        Label("\(cart.itemCount)", systemImage: "cart")
            .labelStyle(.titleAndIcon)
            .monospacedDigit()
            .accessibilityLabel("Cart, \(cart.itemCount) items")
    }
}

// CartTotals.swift
struct CartTotals: View {
    let cart: Cart

    var body: some View {
        LabeledContent("Subtotal", value: cart.subtotalPence.asMoney)
        if cart.discountPence > 0 {
            LabeledContent("Discount", value: "−" + cart.discountPence.asMoney)
        }
        LabeledContent("Total", value: cart.totalPence.asMoney)
            .font(.headline)
    }
}

// LineRow.swift
struct LineRow: View {
    let line: Line

    var body: some View {
        LabeledContent {
            Text((line.unitPence * line.qty).asMoney)
                .monospacedDigit()
        } label: {
            Text(line.name)
            Text("\(line.qty) × \(line.unitPence.asMoney)")
        }
    }
}

#Preview {
    CartScreen()
}

#Preview("With items") {
    CartTotals(cart: .sample)
        .padding()
}
```

#### Uses
- [Observable models › `@State` with a model](#/observation/state-with-a-model)
- [Observable models › Derive, do not store](#/observation/derive-do-not-store)
- [Observable models › When a view actually re-renders](#/observation/when-a-view-actually-re-renders)
- [State & bindings › Hoisting state](#/state/hoisting-state)
- [Reference › Dates and formatted values](#/reference/dates-and-formatted-values)

#### Hints
- `@State private var cart = Cart()` in the owner; a plain `let cart: Cart` everywhere else. There is no `@ObservedObject` in this design.
- `@Observable` needs `import Observation` only if you are outside SwiftUI; a SwiftUI file gets it for free.
- `Section { … } header: { … } footer: { … }` is the long form when a section needs both.
- `.formatted(.currency(code:))` gives you a localised currency string without building one by hand.

#### Tips
- `CartBadge` reads only `itemCount`, so changing `promo` does not invalidate it. Nothing in the code says that; it falls out of what `body` read.
- Methods, not raw mutation. `cart.add(line)` can enforce the merge-by-name rule; a view reaching into `cart.lines` cannot, and the fourth caller will forget.
- The second preview is the tell-tale: `CartTotals` renders from a `Cart` you built in two lines. A model that cannot be constructed in a preview is a model with a dependency it should not have.

#### Docs
- [Observation](https://developer.apple.com/documentation/observation)
- [State](https://developer.apple.com/documentation/swiftui/state)

### 5. Editing a model through `@Bindable`

Displaying a model needs no wrapper. Editing one needs bindings, and this is where `@Bindable` and the environment fit together.

#### Build it
- An `@Observable final class Profile` with `name`, `email` and `wantsNewsletter`, plus a computed `isValid`.
- A `ProfileEditor` declaring `@Bindable var profile: Profile` and driving a `TextField` and a `Toggle` with `$profile.…`.
- A `ProfileSummary` taking the same model as a plain `let`, showing that reading needs no wrapper.
- A root view putting the model in the environment with `.environment(profile)`, and a screen reading it with `@Environment(Profile.self)` plus a local `@Bindable var profile = profile` inside `body`.
- Every preview supplies its own `Profile`, including the one for the environment-reading screen.

```swift solution
// Profile.swift
@Observable
final class Profile {
    var name: String = ""
    var email: String = ""
    var wantsNewsletter: Bool = false

    var isValid: Bool {
        guard let at = email.firstIndex(of: "@") else { return false }
        return !name.isEmpty && at != email.startIndex && email.index(after: at) != email.endIndex
    }

    static var sample: Profile {
        let profile = Profile()
        profile.name = "Ada Lovelace"
        profile.email = "ada@example.com"
        return profile
    }
}

// ProfileEditor.swift — writes, so it needs bindings.
struct ProfileEditor: View {
    @Bindable var profile: Profile

    var body: some View {
        Form {
            Section("You") {
                TextField("Name", text: $profile.name)
                    .textContentType(.name)
                TextField("Email", text: $profile.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            Section {
                Toggle("Send me the newsletter", isOn: $profile.wantsNewsletter)
            } footer: {
                if !profile.isValid {
                    Text("A name and an email address are needed before we can save.")
                }
            }
        }
    }
}

// ProfileSummary.swift — reads only, so no wrapper at all.
struct ProfileSummary: View {
    let profile: Profile

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(profile.name.isEmpty ? "No name yet" : profile.name)
                .font(.headline)
            Text(profile.email.isEmpty ? "No email yet" : profile.email)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

// SettingsScreen.swift — takes the model from the environment.
struct SettingsScreen: View {
    @Environment(Profile.self) private var profile

    var body: some View {
        // A model from the environment is a `let`; this makes it bindable locally.
        @Bindable var profile = profile

        NavigationStack {
            Form {
                Section { ProfileSummary(profile: profile) }
                Section("Edit") {
                    TextField("Name", text: $profile.name)
                }
                Section {
                    NavigationLink("All details") { ProfileEditor(profile: profile) }
                }
            }
            .navigationTitle("Settings")
        }
    }
}

// ProfileApp.swift
@main
struct ProfileApp: App {
    @State private var profile = Profile()

    var body: some Scene {
        WindowGroup {
            SettingsScreen()
                .environment(profile)
        }
    }
}

#Preview("Editor") {
    ProfileEditor(profile: .sample)
}

#Preview("Summary") {
    ProfileSummary(profile: .sample)
        .padding()
}

#Preview("Settings") {
    // Without this the screen crashes: the environment has no Profile.
    SettingsScreen()
        .environment(Profile.sample)
}
```

#### Uses
- [Observable models › `@Bindable`](#/observation/bindable)
- [Observable models › Where the model comes from](#/observation/where-the-model-comes-from)
- [Observable models › `@State` with a model](#/observation/state-with-a-model)
- [State & bindings › `@Environment`](#/state/environment)

#### Hints
- `@Bindable var profile: Profile` as a property is for a model passed in; `@Bindable var profile = profile` as the first line of `body` is for one that arrived from the environment.
- `.environment(profile)` with no key path is the `@Observable` form; the key-path form is for `EnvironmentValues` entries.
- `@Environment(Profile.self) private var profile` is non-optional and traps when nothing supplied it, which is why every preview has to.
- `Form`, `Section`, `TextField` and `Toggle` are enough here; the Forms module covers validation and focus properly.

#### Tips
- Three access levels, deliberately: `let` to read, `@Bindable` to write, `@State` to own. Picking the weakest one that works is the cheapest design review you will ever do.
- The third preview is the price of the environment. A screen whose model is ambient cannot be rendered without someone supplying it, and a preview that crashes is the reminder.
- `@Bindable` does not make a copy or add a layer of state. It produces bindings that read and write the same instance — the same read/write pair as any other binding, pointed at a reference type.

#### Docs
- [Bindable](https://developer.apple.com/documentation/swiftui/bindable)
- [Environment](https://developer.apple.com/documentation/swiftui/environment)
