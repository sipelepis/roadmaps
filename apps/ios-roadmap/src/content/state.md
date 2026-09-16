# State & bindings

A view is a value that SwiftUI creates and throws away many times a second, so anything that has to survive between those values cannot live in the struct. `@State` is the framework holding that storage on the view's behalf, `@Binding` is a permission slip to read and write somebody else's storage, and `@Environment` is a value handed down the view tree without being passed through every initialiser. Almost every state bug is one piece of data owned in two places.

## `@State` is storage the view does not own

```swift
struct CounterScreen: View {
    @State private var count = 0

    var body: some View {
        Button("Tapped \(count) times") { count += 1 }
    }
}
```

`count` is not stored in `CounterScreen`. The struct holds a small box that points at storage SwiftUI keeps alongside the view's position in the tree, which is why mutating it from a `let` view value compiles at all, and why the value survives the struct being rebuilt on every frame.

Three rules follow. Declare `@State` with an initial value, because the view cannot be built without one. Mark it `private`, because it is this view's storage and nobody else's — a `@State` you pass into an initialiser is a bug waiting to happen, since SwiftUI only uses that value the first time. And keep it small: `@State` is for view state (what is selected, what is typed, whether a sheet is up), not for your app's model.

## Value semantics, and why a `var` is not enough

A plain `var` on a view does nothing useful. The struct is rebuilt from its inputs constantly, so the change is discarded before the next frame — and in fact the compiler stops you first, because `body` is not mutating.

The same value semantics that make this awkward are what make SwiftUI fast. A `@State` holding a struct gives you copies that cannot be changed behind your back: passing it to a child hands over a snapshot, and the child has no way to mutate the parent's copy by accident. When you *want* the child to mutate it, you have to say so — and that is `@Binding`.

## `@Binding` is a read/write pair

A `Binding<Value>` is two closures: one that reads the value and one that writes it. That is genuinely all it is.

```swift
struct StepperRow: View {
    @Binding var value: Int          // no storage here, just access to someone else's

    var body: some View {
        Stepper(value: $value, in: 1...10) { Text("\(value)") }
    }
}
```

The `$` prefix is the property wrapper's *projected value*. On a `@State` it hands you a `Binding` to that storage; on a `@Binding` it hands the same binding onward. So `$count` in the parent and `$value` in the child are two names for one piece of storage, and there is no copy to keep in step.

Bindings derive. `$person.name` gives you a `Binding<String>` that reads the name out of the person and, when written, reads the whole person, changes the name and writes the person back. The property wrapper builds that for you from a key path, and that read-modify-write is exactly what you will implement in the first exercise.

`Binding.constant(5)` is a binding whose writes go nowhere. It exists for previews, where there is no source of truth to point at.

## One source of truth

Each piece of state is owned by exactly one place, and everything else gets a binding to it. Two views each holding their own `@State` copy of the same thing is the bug that produces "the toggle in the sheet did not stick" and "the list shows the old name".

The tell is a line that copies state across: an `onAppear` that seeds one `@State` from another, an `onChange` that mirrors a value into a second place. Both are workarounds for a duplicate that should not exist.

The other half of the rule is: state that can be derived should be derived, not stored. If `isSubmitEnabled` can be computed from the email and the checkbox, it is a computed property, not a fourth `@State` you have to remember to update.

## Hoisting state

When two views need the same piece of state, it moves up to their nearest common ancestor and comes back down as bindings. Not higher: state hoisted all the way to the root is state every intermediate view now has to pass through, and a redraw everything shares.

So the rule has two halves. Push state as high as it needs to go — and no higher. The lowest view whose subtree contains everyone who reads or writes it is the owner, and finding that view is a plain tree question, which is the third exercise.

## `@Environment`

Some values are needed by views scattered all over the tree, and threading them through twelve initialisers is worse than the problem. `@Environment` reads a value that an ancestor put in scope:

```swift
struct SettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    …
}
```

The system fills a lot of it in for you: the colour scheme, the Dynamic Type size, the locale, the layout direction, whether the view is enabled, and action handles like `dismiss` and `openURL`. You add your own with the `@Entry` macro:

```swift
extension EnvironmentValues {
    @Entry var brandTint: Color = .accentColor
}
```

and set it with `.environment(\.brandTint, .teal)` on any ancestor. Reading an environment value makes the view depend on it, so a view reading `colorScheme` redraws when the scheme changes and its siblings do not.

Environment is for configuration that genuinely is ambient — theming, a date formatter, a feature flag, a dependency the whole subtree shares. It is not a way to avoid thinking about ownership. Data passed invisibly is data whose flow nobody can see, and a screen whose inputs are all ambient is a screen you cannot preview.

## What actually triggers a redraw

SwiftUI re-runs `body` when something the view *read* has changed. Reading a `@State`, a `@Binding`, or an `@Environment` value creates that dependency; a value you never touch cannot invalidate you.

Two practical consequences. Writing a value equal to the one already there still marks the state dirty — SwiftUI compares the resulting view tree, not the assignment, so the cost is a `body` call and a structural comparison, not a redraw. And an `if` in a `body` does not merely hide a branch: swapping branches replaces the view, and `@State` inside a replaced view is discarded and starts again. When a text field mysteriously empties itself, look for an `if` above it.

```swift playground
// One reducer, one source of truth: the state is a value, every action returns
// a new one, and everything you can derive stays derived.
enum Status: Equatable {
    case editing
    case submitting
    case failed(String)
    case done
}

struct SignUp: Equatable {
    var email = ""
    var agreed = false
    var status: Status = .editing

    var canSubmit: Bool {
        guard status == .editing || isFailed else { return false }
        guard let at = email.firstIndex(of: "@") else { return false }
        return at != email.startIndex && email.index(after: at) != email.endIndex && agreed
    }

    var isFailed: Bool { if case .failed = status { return true } else { return false } }
}

enum Action {
    case editEmail(String)
    case toggleAgreed
    case submit
    case failed(String)
    case succeeded
}

func apply(_ action: Action, to state: SignUp) -> SignUp {
    var next = state
    switch action {
    case .editEmail(let text):
        guard state.status == .editing || state.isFailed else { return state }
        next.email = text
        next.status = .editing
    case .toggleAgreed:
        guard state.status == .editing || state.isFailed else { return state }
        next.agreed.toggle()
        next.status = .editing
    case .submit:
        guard state.canSubmit else { return state }
        next.status = .submitting
    case .failed(let message):
        guard state.status == .submitting else { return state }
        next.status = .failed(message)
    case .succeeded:
        guard state.status == .submitting else { return state }
        next.status = .done
    }
    return next
}

var state = SignUp()
let script: [Action] = [
    .submit,                        // nothing to submit yet
    .editEmail("ada@example.com"),
    .submit,                        // still not agreed
    .toggleAgreed,
    .submit,
    .editEmail("grace@example.com"), // ignored: already in flight
    .failed("no network"),
    .submit,
    .succeeded,
]

for action in script {
    let before = state
    state = apply(action, to: state)
    let mark = before == state ? "—" : "→"
    print("\(mark) \(action)  status=\(state.status) canSubmit=\(state.canSubmit)")
}

// Try: move `canSubmit` into a stored property and keep it in step by hand.
```

## Exercises

### 1. Build a binding

A `Binding` is not magic, it is a pair of closures. Write one, and the `$person.name` trick stops being mysterious.

Fill in three things. `wrappedValue` reads through `get` and writes through `set`. `constant(_:)` returns a binding that always reads the same value and drops every write. `map(get:set:)` derives a binding to something inside the value: reading maps through, and writing reads the whole value, changes the part, and writes the whole value back.

```swift starter
struct Binding<Value> {
    let get: () -> Value
    let set: (Value) -> Void

    var wrappedValue: Value {
        get { get() }
        nonmutating set { }
    }

    static func constant(_ value: Value) -> Binding<Value> {
        Binding(get: { value }, set: { _ in })
    }

    func map<T>(get read: @escaping (Value) -> T,
                set write: @escaping (inout Value, T) -> Void) -> Binding<T> {
        Binding<T>(get: { read(self.get()) }, set: { _ in })
    }
}
```

```swift test
struct Person: Equatable {
    var name: String
    var age: Int
}

/// reading goes straight through to the source
func testReads() {
    var count = 7
    let binding = Binding(get: { count }, set: { count = $0 })
    expect(binding.wrappedValue, 7)
    count = 9
    expect(binding.wrappedValue, 9)
}

/// writing reaches the source, not a copy of it
func testWrites() {
    var count = 0
    let binding = Binding(get: { count }, set: { count = $0 })
    binding.wrappedValue = 5
    expect(count, 5)
    binding.wrappedValue += 1
    expect(count, 6)
    expect(binding.wrappedValue, 6)
}

/// a constant binding is readable and ignores writes
func testConstant() {
    let binding = Binding.constant("hello")
    expect(binding.wrappedValue, "hello")
    binding.wrappedValue = "goodbye"
    expect(binding.wrappedValue, "hello")
}

/// a derived binding reads the part it was given
func testMapReads() {
    var person = Person(name: "Ada", age: 36)
    let root = Binding(get: { person }, set: { person = $0 })
    let name = root.map(get: { $0.name }, set: { $0.name = $1 })
    expect(name.wrappedValue, "Ada")
    person.name = "Grace"
    expect(name.wrappedValue, "Grace")
}

/// writing a derived binding writes the whole value back
func testMapWrites() {
    var person = Person(name: "Ada", age: 36)
    let root = Binding(get: { person }, set: { person = $0 })
    let name = root.map(get: { $0.name }, set: { $0.name = $1 })
    let age = root.map(get: { $0.age }, set: { $0.age = $1 })

    name.wrappedValue = "Grace"
    expect(person, Person(name: "Grace", age: 36))
    age.wrappedValue = 85
    expect(person, Person(name: "Grace", age: 85))
}

/// derived bindings compose
func testMapChains() {
    var person = Person(name: "Ada", age: 36)
    let root = Binding(get: { person }, set: { person = $0 })
    let name = root.map(get: { $0.name }, set: { $0.name = $1 })
    let initial = name.map(get: { String($0.prefix(1)) }, set: { $0 = $1 + $0.dropFirst() })

    expect(initial.wrappedValue, "A")
    initial.wrappedValue = "E"
    expect(person.name, "Eda")
}
```

#### Uses
- [State & bindings › `@Binding` is a read/write pair](#/state/binding-is-a-read-write-pair)
- [State & bindings › Value semantics, and why a `var` is not enough](#/state/value-semantics-and-why-a-var-is-not-enough)
- [Reference › SwiftUI state and data flow](#/reference/swiftui-state-and-data-flow)

#### Hints
- `wrappedValue`'s setter is one line: `set(newValue)`. `nonmutating` is what lets you write through a `let` binding, exactly as SwiftUI does.
- `constant` already works. Read it — it is the whole idea in two closures.
- `map`'s setter is a read-modify-write: `var current = self.get()`, then `write(&current, newValue)`, then `self.set(current)`.
- The closures escape, so `self.get` and `self.set` need the explicit `self.` inside them.

#### Tips
- `binding.wrappedValue += 1` in the second test is the thing to notice. It is a read *and* a write, in that order, through the same pair of closures — which is why a binding to a value that is expensive to read is a binding you will feel.
- The last test is `$person.name` and then some: each `map` wraps the pair below it, so writing the initial rewrites the name, which rewrites the person. Real SwiftUI builds this chain from a key path and calls the result a projected value.
- A closure capturing a local `var` captures it by reference, which is why these tests work at all. That is also why a binding can outlive the expression that made it.

#### Docs
- [Binding](https://developer.apple.com/documentation/swiftui/binding)
- [State](https://developer.apple.com/documentation/swiftui/state)

### 2. One reducer, one source of truth

A sign-up screen has three pieces of state and a handful of things that can happen to it. Put the rules in one function so there is nowhere else for them to disagree.

`canSubmit` is derived, never stored: it is true only when the form is editable (either `.editing` or `.failed`), the checkbox is ticked, and the email has an `@` with at least one character on each side.

`apply(_:to:)` returns the next state:

- `.editEmail` and `.toggleAgreed` are ignored while `.submitting` or `.done`. Otherwise they make their change and clear any failure back to `.editing`.
- `.submit` moves to `.submitting`, but only when `canSubmit` is true.
- `.failed(message)` moves to `.failed(message)`, but only from `.submitting`.
- `.succeeded` moves to `.done`, but only from `.submitting`.

Anything else returns the state unchanged.

```swift starter
enum Status: Equatable {
    case editing
    case submitting
    case failed(String)
    case done
}

struct SignUp: Equatable {
    var email = ""
    var agreed = false
    var status: Status = .editing

    var canSubmit: Bool {
        return false
    }
}

enum Action {
    case editEmail(String)
    case toggleAgreed
    case submit
    case failed(String)
    case succeeded
}

func apply(_ action: Action, to state: SignUp) -> SignUp {
    return state
}
```

```swift test
let ready = SignUp(email: "ada@example.com", agreed: true, status: .editing)

/// a derived value, not a fourth piece of state
func testCanSubmit() {
    expect(SignUp().canSubmit, false)
    expect(SignUp(email: "ada@example.com", agreed: false).canSubmit, false)
    expect(SignUp(email: "ada", agreed: true).canSubmit, false)
    expect(SignUp(email: "@example.com", agreed: true).canSubmit, false)
    expect(SignUp(email: "ada@", agreed: true).canSubmit, false)
    expect(ready.canSubmit, true)
}

/// editing changes the field it names and nothing else
func testEditing() {
    let typed = apply(.editEmail("a@b.c"), to: SignUp())
    expect(typed.email, "a@b.c")
    expect(typed.agreed, false)
    expect(typed.status, .editing)
    expect(apply(.toggleAgreed, to: typed).agreed, true)
    expect(apply(.toggleAgreed, to: apply(.toggleAgreed, to: typed)).agreed, false)
}

/// submitting is only allowed when the form says it is
func testSubmitGuarded() {
    expect(apply(.submit, to: SignUp()), SignUp())
    expect(apply(.submit, to: SignUp(email: "ada@example.com", agreed: false)).status, .editing)
    expect(apply(.submit, to: ready).status, .submitting)
    expect(ready.canSubmit, true)
    expect(apply(.submit, to: ready).canSubmit, false)
}

/// a request in flight ignores the keyboard
func testLockedWhileSubmitting() {
    let inFlight = apply(.submit, to: ready)
    expect(inFlight.status, .submitting)
    expect(apply(.editEmail("grace@example.com"), to: inFlight), inFlight)
    expect(apply(.toggleAgreed, to: inFlight), inFlight)
    expect(apply(.submit, to: inFlight), inFlight)
}

/// only a request in flight can finish
func testOutcomes() {
    let inFlight = apply(.submit, to: ready)
    expect(apply(.succeeded, to: inFlight).status, .done)
    expect(apply(.failed("no network"), to: inFlight).status, .failed("no network"))
    expect(apply(.succeeded, to: ready), ready)
    expect(apply(.failed("no network"), to: ready), ready)
    expect(apply(.editEmail("x@y.z"), to: apply(.succeeded, to: inFlight)).email, "ada@example.com")
}

/// typing after a failure puts the form back in play
func testRecovery() {
    let failed = apply(.failed("no network"), to: apply(.submit, to: ready))
    expect(failed.status, .failed("no network"))
    expect(failed.canSubmit, true)
    let retyped = apply(.editEmail("grace@example.com"), to: failed)
    expect(retyped.status, .editing)
    expect(retyped.email, "grace@example.com")
    expect(apply(.submit, to: failed).status, .submitting)
}
```

#### Uses
- [State & bindings › One source of truth](#/state/one-source-of-truth)
- [State & bindings › Value semantics, and why a `var` is not enough](#/state/value-semantics-and-why-a-var-is-not-enough)

#### Hints
- `var next = state` at the top, mutate `next`, and `return next` at the bottom. Every guard that fails does `return state`.
- For "is the form editable", a small helper reads best: `if case .failed = status { … }` tests the case without caring about the message.
- The email rule is three conditions: there is an `@`, it is not the first character, and it is not the last. `email.firstIndex(of: "@")` gives you all three.
- Because `canSubmit` already checks the status, `.submit` needs no separate status check.

#### Tips
- Look at what `testLockedWhileSubmitting` is really asserting: that a stale keystroke arriving mid-request cannot change what you are about to send. In a view with four independent `@State` properties there is nowhere to put that rule; in a reducer it is one guard.
- `canSubmit` being derived is the point of the first test. A stored `isSubmitEnabled` has to be updated in five places and will be wrong in one of them.
- This function is pure, so it is testable in microseconds and gives identical answers in a test, a preview and the app. That is worth more than the indirection costs.

#### Docs
- [Managing user interface state](https://developer.apple.com/documentation/swiftui/managing-user-interface-state)
- [Model data](https://developer.apple.com/documentation/swiftui/model-data)

### 3. Where does this state belong?

State lives in the lowest view that contains everyone who touches it. Given the view tree and the list of views that read or write a value, find its owner.

`lowestOwner(of:in:)` returns the name of the deepest view whose subtree contains every user. A view contains itself, so a value used by exactly one view is owned by that view. If any user is not in the tree at all, or there are no users, there is no owner: return `nil`. View names are unique.

```swift starter
struct ViewNode {
    let name: String
    let children: [ViewNode]

    init(_ name: String, _ children: [ViewNode] = []) {
        self.name = name
        self.children = children
    }
}

func lowestOwner(of users: Set<String>, in tree: ViewNode) -> String? {
    return nil
}
```

```swift test
let app = ViewNode("App", [
    ViewNode("Sidebar", [
        ViewNode("FilterRow"),
        ViewNode("TagList", [ViewNode("TagChip")]),
    ]),
    ViewNode("Detail", [
        ViewNode("Header", [ViewNode("TitleField")]),
        ViewNode("Body", [ViewNode("Editor")]),
    ]),
])

/// one user owns its own state
func testSingleUser() {
    expect(lowestOwner(of: ["TitleField"], in: app), "TitleField")
    expect(lowestOwner(of: ["App"], in: app), "App")
    expect(lowestOwner(of: ["TagChip"], in: app), "TagChip")
}

/// siblings hoist to their parent, not to the root
func testSiblings() {
    expect(lowestOwner(of: ["FilterRow", "TagList"], in: app), "Sidebar")
    expect(lowestOwner(of: ["Header", "Body"], in: app), "Detail")
    expect(lowestOwner(of: ["TitleField", "Editor"], in: app), "Detail")
}

/// a view contains itself, so an ancestor in the set is the answer
func testAncestorInSet() {
    expect(lowestOwner(of: ["Header", "TitleField"], in: app), "Header")
    expect(lowestOwner(of: ["Sidebar", "TagChip"], in: app), "Sidebar")
}

/// reaching across the tree hoists all the way up
func testAcrossTheTree() {
    expect(lowestOwner(of: ["FilterRow", "Editor"], in: app), "App")
    expect(lowestOwner(of: ["TagChip", "TitleField", "FilterRow"], in: app), "App")
}

/// no users, or a user that is not there, has no owner
func testNoOwner() {
    expect(lowestOwner(of: [], in: app), nil)
    expect(lowestOwner(of: ["Toolbar"], in: app), nil)
    expect(lowestOwner(of: ["Editor", "Toolbar"], in: app), nil)
}
```

#### Uses
- [State & bindings › Hoisting state](#/state/hoisting-state)
- [State & bindings › One source of truth](#/state/one-source-of-truth)
- [Reference › SwiftUI state and data flow](#/reference/swiftui-state-and-data-flow)

#### Hints
- Recurse, and have the recursion return two things: how many users this subtree contains, and the owner if one has already been decided deeper down.
- A node is the owner when no child claimed it and the count in this subtree equals `users.count`.
- A nested `func search(_ node: ViewNode) -> (found: Int, owner: String?)` inside `lowestOwner` can see `users` without passing it around.
- Handle the empty set before you start, or the first leaf you visit will claim ownership of nothing.

#### Tips
- `testSiblings` is the rule people break. `TitleField` and `Editor` both need the draft, so it belongs on `Detail` — not on `App`, where every keystroke would invalidate the sidebar too.
- When the answer comes back as the root for a value only two leaves use, that is usually a sign the tree is wrong rather than the state. A shared value that forces everything to the top often wants to be `@Environment` or a model object instead.
- Names are unique here, which is a convenience the real world does not offer — a `ForEach` makes many views of the same type. That is what identity is for, and the Lists module is entirely about it.

#### Docs
- [Managing model data in your app](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)
- [State and data flow](https://developer.apple.com/documentation/swiftui/state-and-data-flow)

### 4. A counter and a child that can change it

Build the smallest complete example of the ownership rule: a parent that owns two values, and a child with no state of its own that changes one of them.

#### Build it
- A `CounterScreen` with `@State private var count` and `@State private var step`.
- A `StepperRow` child declaring `@Binding var value: Int` and no `@State` at all.
- The parent passes `$step`; changing the step in the child immediately changes the label on the parent's buttons.
- A Reset button that is `.disabled(count == 0)` — derived from the state, not a fourth stored flag.
- Two previews: the whole screen, and `StepperRow` alone driven by `.constant(3)`.

```swift solution
// CounterScreen.swift
struct CounterScreen: View {
    @State private var count = 0
    @State private var step = 1

    var body: some View {
        VStack(spacing: 24) {
            Text("\(count)")
                .font(.system(size: 64, weight: .semibold, design: .rounded))
                .contentTransition(.numericText())
                .animation(.snappy, value: count)

            // The child owns nothing: it reads and writes the parent's storage.
            StepperRow(title: "Step", value: $step, range: 1...10)

            HStack(spacing: 16) {
                Button("−\(step)") { count -= step }
                Button("+\(step)") { count += step }
            }
            .buttonStyle(.borderedProminent)

            // Derived, not stored.
            Button("Reset") { count = 0 }
                .disabled(count == 0)
        }
        .padding()
    }
}

// StepperRow.swift
struct StepperRow: View {
    let title: String
    @Binding var value: Int
    let range: ClosedRange<Int>

    var body: some View {
        Stepper(value: $value, in: range) {
            HStack {
                Text(title)
                Spacer()
                Text("\(value)")
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
    }
}

#Preview {
    CounterScreen()
}

#Preview("Row alone") {
    // No source of truth in a preview, so the writes go nowhere on purpose.
    StepperRow(title: "Step", value: .constant(3), range: 1...10)
        .padding()
}
```

#### Uses
- [State & bindings › `@State` is storage the view does not own](#/state/state-is-storage-the-view-does-not-own)
- [State & bindings › `@Binding` is a read/write pair](#/state/binding-is-a-read-write-pair)
- [State & bindings › Hoisting state](#/state/hoisting-state)

#### Hints
- `$step` in the parent is the projected value of `@State`; `$value` inside the child is the projected value of `@Binding`. They refer to the same storage.
- A `@Binding` property has no initial value and no `private` — it is an input, and the caller must supply it.
- `.constant(3)` is a `Binding` that reads 3 and swallows writes, which is what a preview wants.
- If the child needs a default, that is a sign the value should be `@State` there instead.

#### Tips
- Try declaring `@State private var value` in `StepperRow` and passing the step in as a plain `Int`. It will appear to work, and then quietly ignore any later change from the parent, because `@State` uses the initial value exactly once. That failure mode is worth seeing once.
- `.disabled(count == 0)` is a derived value in the truest sense: there is no way for it to fall out of step with `count`, because it *is* `count`.
- `@State private` is not style advice. A non-private `@State` invites a caller to pass a value that will be ignored, which is a bug with no error message.

#### Docs
- [Stepper](https://developer.apple.com/documentation/swiftui/stepper)
- [Managing user interface state](https://developer.apple.com/documentation/swiftui/managing-user-interface-state)

### 5. A sheet that reads its surroundings

Build a settings sheet that takes one binding from its parent and gets everything else from the environment — including a value you define yourself.

#### Build it
- A custom environment value `brandTint` declared with `@Entry` in an `EnvironmentValues` extension, with a sensible default.
- A `SettingsSheet` reading `\.dismiss`, `\.colorScheme` and `\.brandTint` from `@Environment`, and taking exactly one `@Binding` from its parent.
- A root screen owning the toggle's state, presenting the sheet with `.sheet(isPresented:)`, and setting `.environment(\.brandTint, .teal)` on the whole subtree.
- The Done button in the sheet's toolbar calls `dismiss()`; nothing passes a "close" closure down.
- Flipping the toggle in the sheet is visible on the root screen the moment the sheet closes — and while it is open.

```swift solution
// Theme.swift
extension EnvironmentValues {
    // @Entry writes the EnvironmentKey boilerplate that used to be a dozen lines.
    @Entry var brandTint: Color = .accentColor
}

// SettingsSheet.swift
struct SettingsSheet: View {
    @Binding var notificationsOn: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.brandTint) private var brandTint

    var body: some View {
        NavigationStack {
            Form {
                Section("Alerts") {
                    Toggle("Notifications", isOn: $notificationsOn)
                }
                Section("Appearance") {
                    LabeledContent("Scheme", value: colorScheme == .dark ? "Dark" : "Light")
                }
            }
            .tint(brandTint)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// RootScreen.swift
struct RootScreen: View {
    @State private var notificationsOn = true
    @State private var showingSettings = false

    var body: some View {
        VStack(spacing: 16) {
            Text(notificationsOn ? "Notifications are on" : "Notifications are off")
                .font(.headline)
            Button("Settings…") { showingSettings = true }
                .buttonStyle(.bordered)
        }
        .padding()
        .sheet(isPresented: $showingSettings) {
            SettingsSheet(notificationsOn: $notificationsOn)
        }
        .environment(\.brandTint, .teal)
    }
}

#Preview {
    RootScreen()
}

#Preview("Sheet, dark") {
    SettingsSheet(notificationsOn: .constant(true))
        .environment(\.brandTint, .pink)
        .preferredColorScheme(.dark)
}
```

#### Uses
- [State & bindings › `@Environment`](#/state/environment)
- [State & bindings › `@Binding` is a read/write pair](#/state/binding-is-a-read-write-pair)
- [State & bindings › One source of truth](#/state/one-source-of-truth)

#### Hints
- `@Environment(\.dismiss) private var dismiss` gives you a callable value: `dismiss()`.
- A sheet is presented from the *parent's* state, so `showingSettings` lives on the root and the sheet never sets it.
- `@Entry` needs a default value on the declaration; that default is what every view sees until an ancestor overrides it.
- If `@Entry` is not available in your Xcode, the older form is a `struct BrandTintKey: EnvironmentKey { static let defaultValue = Color.accentColor }` plus a computed property on `EnvironmentValues`.

#### Tips
- The sheet's own `.environment(\.brandTint, …)` in the second preview is doing real work: a sheet is presented in a new window scene and does not inherit everything from the presenting view automatically. Worth knowing before you debug a theme that vanishes in a modal.
- `dismiss` from the environment rather than a `onClose: () -> Void` parameter is the difference between a sheet that also works when pushed and one that only works where it was written.
- Environment is right for the tint and wrong for `notificationsOn`. One is ambient configuration; the other is the data the screen exists to edit, and burying it makes the sheet impossible to preview honestly.

#### Docs
- [EnvironmentValues](https://developer.apple.com/documentation/swiftui/environmentvalues)
- [DismissAction](https://developer.apple.com/documentation/swiftui/dismissaction)
