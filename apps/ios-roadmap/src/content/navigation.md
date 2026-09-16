# Navigation

Navigation in SwiftUI is state. There is no "push this view controller" call: you own an array of destinations, a `NavigationStack` renders it, and the back button edits it. Once you accept that, the hard problems — deep links, restoring where the user was, popping three screens at once, returning a value from a sheet — all turn into ordinary work on an array, which is exactly the kind of code this page can compile and test for you.

## A stack and a path

`NavigationStack` shows a root view plus whatever is stacked on top of it. Bind it to an array and that array *is* the stack.

```swift
@State private var path: [Route] = []

var body: some View {
    NavigationStack(path: $path) {
        HomeScreen()
    }
}
```

Appending to `path` pushes. Removing the last element pops. Emptying it goes all the way home. The back button and the swipe-from-the-edge gesture do the removing for you, so the array and the screen never disagree.

`NavigationPath` is the type-erased version of the same idea: it holds heterogeneous `Hashable` values when one screen can push several unrelated kinds of destination. A plain `[Route]` where `Route` is your own enum is simpler, easier to inspect, and easier to test, so reach for it first.

## Value-based destinations

A destination is registered once, by type, on the stack's content:

```swift
.navigationDestination(for: Route.self) { route in
    switch route {
    case .item(let id): ItemScreen(id: id)
    case .search(let query): SearchScreen(query: query)
    case .profile: ProfileScreen()
    }
}
```

Now anything that appends a `Route` gets the right screen. `NavigationLink("Pens", value: Route.item(1))` pushes a value rather than a view, which means the destination is not built until it is needed — the reason value-based links replaced `NavigationLink(destination:)` for anything inside a list.

Put the modifier *inside* the stack, on the root content, not on the `NavigationStack` itself. Registered outside, it is not in the stack's scope and nothing pushes.

## Pushing from code

Because the path is just state, code can push without a link at all: after a successful sign-up, from a notification, from a toolbar button. A small model that owns the path keeps that out of the views.

```swift
@Observable
final class Router {
    var path: [Route] = []
    func push(_ route: Route) { path.append(route) }
    func popToRoot() { path.removeAll() }
}
```

Popping several screens at once is `path.removeLast(2)`. Going back to a particular screen is finding its index and dropping everything after it. These are array operations, and they are the first exercise.

## Sheets and covers

A sheet is modal: it is a detour, not a step forward. It gets its own presentation state rather than a place in the path.

```swift
.sheet(isPresented: $showingPicker) { TagPicker(selected: $tag) }
.sheet(item: $editing) { item in EditScreen(item: item) }
.fullScreenCover(isPresented: $onboarding) { Onboarding() }
```

`.sheet(item:)` takes an `Identifiable?` and presents whenever it is non-`nil`, which is usually what you want: one piece of state says both *whether* to show the sheet and *what* it is about, so the two cannot drift apart. Use `.fullScreenCover` only when a swipe-down dismissal would be wrong — onboarding, a camera, a payment sheet.

A sheet with its own pushes needs its own `NavigationStack` inside it. The presenting stack's path does not reach into it.

## Deep links

A link from outside — a universal link, a custom scheme, a notification payload — arrives as a `URL` and has to become a stack.

```swift
.onOpenURL { url in
    if let stack = routes(for: url) { path = stack }
}
```

The interesting half is `routes(for:)`, and it is pure Swift: parse with `URLComponents`, check the scheme, read the host and path components, look at the query, and return the array of screens to show — or `nil` if the link means nothing to this app. Do not push one screen and hope; a link to a product inside a search result should restore *both*, so the back button behaves the way the user expects. That function is testable without a simulator, which is the second exercise.

## Returning a result

A pushed screen or a sheet often has to hand something back. The direct way is a `@Binding` the child writes and `@Environment(\.dismiss)` to close itself:

```swift
struct TagPicker: View {
    @Binding var selected: Tag?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List(Tag.all) { tag in
            Button(tag.name) { selected = tag; dismiss() }
        }
    }
}
```

The parent owns the state; the child gets a write-through handle and the ability to close itself, and knows nothing about who presented it. A closure parameter (`onPick: (Tag) -> Void`) works too and is better when the parent has to *do* something rather than just store a value. What does not work is the child reaching for the parent's type.

## Restoring where the user was

Because the path is `Codable` when your `Route` is, saving it is `JSONEncoder().encode(path)` and restoring it is a decode. Two things matter in practice. Version it, so a build that renamed a case does not crash or land the user somewhere strange. And date it, so a stack from three weeks ago is not restored on top of stale data — opening at the root is a better failure than opening at a screen that no longer exists.

```swift playground
import Foundation

enum Route: Hashable, CustomStringConvertible {
    case item(Int)
    case search(String)
    case profile

    var description: String {
        switch self {
        case .item(let id): return "item(\(id))"
        case .search(let query): return "search(\"\(query)\")"
        case .profile: return "profile"
        }
    }
}

/// The whole navigation state of a screen: a root, plus what is stacked on it.
struct NavPath {
    private(set) var routes: [Route] = []
    var top: Route? { routes.last }
    mutating func push(_ route: Route) { routes.append(route) }
    mutating func popToRoot() { routes.removeAll() }
}

/// A link from outside becomes a whole stack, not a single screen.
func routes(for link: String) -> [Route] {
    guard let c = URLComponents(string: link), c.scheme == "shop" else { return [] }
    let query = c.queryItems?.first { $0.name == "q" }?.value
    switch c.host {
    case "item": return Int(c.path.dropFirst()).map { [Route.item($0)] } ?? []
    case "search": return query.map { [Route.search($0)] } ?? []
    case "profile": return [.profile]
    default: return []
    }
}

var path = NavPath()
for link in ["shop://search?q=blue%20pens", "shop://item/42", "shop://nonsense"] {
    let opened = routes(for: link)
    for route in opened { path.push(route) }
    print(link, "->", opened.isEmpty ? "nothing this app knows" : "\(opened)")
}
print("stack:", path.routes)
print("top:", String(describing: path.top))
path.popToRoot()
print("after popToRoot:", path.routes, "top:", String(describing: path.top))
```

## Exercises

### 1. A path you can drive from code

`NavPath` is the model behind a `NavigationStack`'s path. Finish it: `push` adds a screen, `pop` removes and returns the top one (`nil` when there is nothing to pop), `popToRoot` empties the stack, and `popTo(_:)` pops until the given route is on top — using its **topmost** occurrence if it appears more than once, and changing nothing at all if it is not in the stack. `count` and `top` describe the stack as it stands.

```swift starter
enum Route: Hashable {
    case item(Int)
    case search(String)
    case profile
}

struct NavPath {
    private(set) var routes: [Route] = []

    var count: Int {
        return 0
    }

    var top: Route? {
        return nil
    }

    mutating func push(_ route: Route) {
    }

    @discardableResult
    mutating func pop() -> Route? {
        return nil
    }

    mutating func popToRoot() {
    }

    mutating func popTo(_ route: Route) {
    }
}
```

```swift test
/// pushing grows the stack, and the last one pushed is on top
func testPush() {
    var path = NavPath()
    expect(path.count, 0)
    expect(path.top, nil)
    path.push(.profile)
    path.push(.item(7))
    expect(path.count, 2)
    expect(path.top, .item(7))
    expect(path.routes, [.profile, .item(7)])
}

/// popping hands back what it removed, and an empty stack pops to nil
func testPop() {
    var path = NavPath()
    expect(path.pop(), nil)
    path.push(.search("pens"))
    path.push(.item(1))
    expect(path.pop(), .item(1))
    expect(path.count, 1)
    expect(path.pop(), .search("pens"))
    expect(path.pop(), nil)
    expect(path.routes, [])
}

/// home is an empty array
func testPopToRoot() {
    var path = NavPath()
    path.push(.search("pads"))
    path.push(.item(2))
    path.push(.profile)
    path.popToRoot()
    expect(path.routes, [])
    expect(path.count, 0)
    expect(path.top, nil)
    path.popToRoot()
    expect(path.routes, [])
}

/// popTo unwinds to a screen, or leaves the stack alone
func testPopTo() {
    var path = NavPath()
    path.push(.search("pens"))
    path.push(.item(1))
    path.push(.item(2))
    path.popTo(.search("pens"))
    expect(path.routes, [.search("pens")])
    expect(path.top, .search("pens"))

    path.push(.item(1))
    path.popTo(.profile)
    expect(path.routes, [.search("pens"), .item(1)])

    path.popTo(.item(1))
    expect(path.routes, [.search("pens"), .item(1)])
}

/// with a repeated screen, popTo unwinds to the nearest one
func testPopToRepeated() {
    var path = NavPath()
    path.push(.item(1))
    path.push(.search("pens"))
    path.push(.item(1))
    path.push(.profile)
    path.popTo(.item(1))
    expect(path.routes, [.item(1), .search("pens"), .item(1)])
    path.popTo(.item(1))
    expect(path.routes, [.item(1), .search("pens"), .item(1)])
}
```

#### Uses
- [Navigation › A stack and a path](#/navigation/a-stack-and-a-path)
- [Navigation › Pushing from code](#/navigation/pushing-from-code)
- [Reference › Collections](#/reference/collections)

#### Hints
- `routes` is a plain array. `push` is `append`, and `popToRoot` is `removeAll()`.
- `popLast()` removes the last element and returns it, or returns `nil` on an empty array — exactly `pop`.
- For `popTo`, find `routes.lastIndex(of: route)`. If there is no such index, return without touching anything; otherwise `routes.removeSubrange((i + 1)...)`.

#### Tips
- Popping to a repeated screen should land on the nearest one, not the first: the user pushed it again on purpose. `lastIndex(of:)` gets that right and `firstIndex(of:)` does not.
- `popTo` on a route that is already on top has to be a no-op, not a pop. A range like `(i + 1)...` is empty in that case, so the right implementation gets it for free.
- Keeping `routes` `private(set)` means views can read the stack but only the methods can change it. Half the navigation bugs in an app are some view writing the path directly.

#### Docs
- [NavigationStack](https://developer.apple.com/documentation/swiftui/navigationstack)
- [Migrating to new navigation types](https://developer.apple.com/documentation/swiftui/migrating-to-new-navigation-types)

### 2. A deep link becomes a stack

A link from outside the app arrives as a `URL`. Write `routes(for:)`, which turns one into the screens to show, or `nil` when the link means nothing here.

- The scheme must be `shop`. Anything else is `nil`.
- `shop://profile` is `[.profile]`.
- `shop://item/42` is `[.item(42)]`. A missing or non-numeric id is `nil`.
- `shop://search?q=pens` is `[.search("pens")]`. A missing or empty `q` is `nil`.
- A search link may also name an item: `shop://search?q=pens&item=42` is `[.search("pens"), .item(42)]`, so the back button returns to the results. An `item` that is not a number is ignored rather than fatal.
- Any other host is `nil`.

```swift starter
enum Route: Hashable {
    case item(Int)
    case search(String)
    case profile
}

func routes(for url: URL) -> [Route]? {
    return nil
}
```

```swift test
/// the single-screen links
func testSimple() {
    expect(routes(for: URL(string: "shop://profile")!), [.profile])
    expect(routes(for: URL(string: "shop://item/42")!), [.item(42)])
    expect(routes(for: URL(string: "shop://item/1")!), [.item(1)])
    expect(routes(for: URL(string: "shop://search?q=pens")!), [.search("pens")])
}

/// links this app does not understand
func testUnknown() {
    expect(routes(for: URL(string: "https://example.com/item/42")!), nil)
    expect(routes(for: URL(string: "shop://cart")!), nil)
    expect(routes(for: URL(string: "shop://item/nope")!), nil)
    expect(routes(for: URL(string: "shop://item")!), nil)
    expect(routes(for: URL(string: "shop://search")!), nil)
    expect(routes(for: URL(string: "shop://search?q=")!), nil)
}

/// a link that restores two screens, so back goes to the results
func testStack() {
    expect(routes(for: URL(string: "shop://search?q=pens&item=42")!), [.search("pens"), .item(42)])
    expect(routes(for: URL(string: "shop://search?item=42&q=pads")!), [.search("pads"), .item(42)])
    expect(routes(for: URL(string: "shop://search?q=pens&item=oops")!), [.search("pens")])
    expect(routes(for: URL(string: "shop://search?q=pens&ref=email")!), [.search("pens")])
}

/// the query arrives percent-encoded and comes back decoded
func testEncoding() {
    expect(routes(for: URL(string: "shop://search?q=blue%20pens")!), [.search("blue pens")])
    expect(routes(for: URL(string: "shop://search?q=%C3%A9clair")!), [.search("éclair")])
}
```

#### Uses
- [Navigation › Deep links](#/navigation/deep-links)
- [Navigation › Value-based destinations](#/navigation/value-based-destinations)

#### Hints
- `guard let c = URLComponents(url: url, resolvingAgainstBaseURL: false), c.scheme == "shop" else { return nil }` gets you a parsed link and rejects the wrong scheme in one line.
- In `shop://item/42` the host is `"item"` and the path is `"/42"`. `c.path.split(separator: "/")` gives the components without the leading slash, and `Int(...)` on the first one gives the id.
- A small nested `func query(_ name: String) -> String? { c.queryItems?.first { $0.name == name }?.value }` keeps the three query lookups readable. `queryItems` hands back values already percent-decoded.

#### Tips
- Returning `nil` rather than an empty array is the point: the caller has to decide what an unknown link does — open the App Store page, show the root, or hand it back to the system — and an empty array quietly means "go home".
- Restore the whole stack, not the last screen. A user who taps a product link inside a search email expects the back button to show the search, and that expectation is why the rule exists.
- Be generous about extras and strict about essentials. An unknown `ref=email` must not break the link; a missing `q` must.

#### Docs
- [URLComponents](https://developer.apple.com/documentation/foundation/urlcomponents)
- [onOpenURL(perform:)](https://developer.apple.com/documentation/swiftui/view/onopenurl(perform:))

### 3. A stack that survives a relaunch

The app saves its path when it goes to the background and restores it on launch. Write both halves.

`save(_:at:)` returns a JSON string holding the current format version (`2`), the time it was saved, and the routes. `restore(_:now:)` reads one back and returns the routes — but returns `[]` rather than trusting anything suspect:

- text that is not the expected JSON at all,
- a version that is not `2`, because an older build's routes may no longer mean anything,
- a snapshot saved more than 24 hours before `now`, because a day-old stack is stale.

```swift starter
enum Route: Hashable, Codable {
    case item(Int)
    case search(String)
    case profile
}

struct StoredPath: Codable {
    var version: Int
    var savedAt: Date
    var routes: [Route]
}

func save(_ routes: [Route], at now: Date) -> String {
    return ""
}

func restore(_ json: String, now: Date) -> [Route] {
    return []
}
```

```swift test
/// what was saved comes back
func testRoundTrip() {
    let now = Date(timeIntervalSinceReferenceDate: 800_000_000)
    expect(restore(save([.profile], at: now), now: now), [.profile])
    expect(restore(save([.search("pens"), .item(42)], at: now), now: now), [.search("pens"), .item(42)])
    expect(restore(save([], at: now), now: now), [])
}

/// a stack saved an hour ago is still worth restoring
func testFresh() {
    let saved = Date(timeIntervalSinceReferenceDate: 800_000_000)
    let json = save([.item(7)], at: saved)
    expect(restore(json, now: saved.addingTimeInterval(60)), [.item(7)])
    expect(restore(json, now: saved.addingTimeInterval(3600)), [.item(7)])
    expect(restore(json, now: saved.addingTimeInterval(86_399)), [.item(7)])
}

/// a day-old stack opens at the root instead
func testStale() {
    let saved = Date(timeIntervalSinceReferenceDate: 800_000_000)
    let json = save([.item(7), .profile], at: saved)
    expect(restore(json, now: saved.addingTimeInterval(86_401)), [])
    expect(restore(json, now: saved.addingTimeInterval(7 * 86_400)), [])
}

/// nothing usable in, nothing out
func testJunk() {
    let now = Date(timeIntervalSinceReferenceDate: 800_000_000)
    expect(restore("", now: now), [])
    expect(restore("not json at all", now: now), [])
    expect(restore(#"{"version":1,"savedAt":800000000,"routes":[]}"#, now: now), [])
    expect(restore(#"{"version":3,"savedAt":800000000,"routes":[]}"#, now: now), [])
    expect(restore(#"{"savedAt":800000000}"#, now: now), [])
}

/// the saved text really is the snapshot, not a guess
func testStoredShape() throws {
    let saved = Date(timeIntervalSinceReferenceDate: 800_000_000)
    let json = save([.item(3)], at: saved)
    let stored = try JSONDecoder().decode(StoredPath.self, from: Data(json.utf8))
    expect(stored.version, 2)
    expect(stored.savedAt, saved)
    expect(stored.routes, [.item(3)])
}
```

#### Uses
- [Navigation › Restoring where the user was](#/navigation/restoring-where-the-user-was)
- [Navigation › A stack and a path](#/navigation/a-stack-and-a-path)
- [Reference › Dates and formatted values](#/reference/dates-and-formatted-values)

#### Hints
- An `enum` with associated values gets `Codable` synthesised for you, so `StoredPath` encodes with no extra work: `try? JSONEncoder().encode(StoredPath(version: 2, savedAt: now, routes: routes))`.
- `Data` to `String` is `String(decoding: data, as: UTF8.self)`, and back again is `Data(json.utf8)`.
- `try? JSONDecoder().decode(StoredPath.self, from: ...)` gives `nil` for anything that does not fit, which is three of the four junk cases handled at once. Check `version` and the age after that.
- The age is `now.timeIntervalSince(stored.savedAt)`, in seconds. A day is `86_400`.

#### Tips
- Restoring to the root is a *good* failure. Anything that cannot be trusted should end up there, which is why `restore` returns `[Route]` rather than throwing: there is only one sensible recovery, so there is nothing for a caller to decide.
- Version the snapshot from the first day you write it. Renaming an enum case in a later build silently changes what the old JSON means, and a version number is the cheapest way to notice.
- `now` being a parameter rather than `Date()` is what makes the staleness rule testable at all. Pass the clock in; a function that reads the wall clock itself can only be tested by waiting.

#### Docs
- [JSONEncoder](https://developer.apple.com/documentation/foundation/jsonencoder)
- [Restoring your app's state](https://developer.apple.com/documentation/uikit/restoring-your-app-s-state)

### 4. A stack you can browse

Build the browsing stack for real in Xcode: a root list, value-based destinations, and a button that unwinds to the root from three screens deep.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `Route` enum — `item(Int)`, `search(String)`, `profile` — conforming to `Hashable`.
- An `@Observable` `Router` owning `var path: [Route]`, with `push(_:)` and `popToRoot()`, put into the environment by the `App`.
- A `NavigationStack(path:)` bound to the router's path, with `@Bindable` used to get a binding out of the environment object.
- One `.navigationDestination(for: Route.self)` inside the stack that switches over the route, so every screen is reachable from one place.
- A root list using `NavigationLink(_:value:)` for the items and a plain `Button` that calls `router.push(.search("pens"))`.
- On the item screen, a "Back to the top" button that calls `popToRoot()` and visibly unwinds the whole stack.
- A `#Preview` that renders the root with a fresh `Router` in the environment.

```swift solution
// Route.swift
enum Route: Hashable {
    case item(Int)
    case search(String)
    case profile
}

// Router.swift
@Observable
final class Router {
    var path: [Route] = []

    func push(_ route: Route) { path.append(route) }
    func popToRoot() { path.removeAll() }
}

// ShopApp.swift
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

// RootScreen.swift
struct RootScreen: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.path) {
            List {
                Section("Catalogue") {
                    NavigationLink("Pens", value: Route.item(1))
                    NavigationLink("Pads", value: Route.item(2))
                }
                Section {
                    Button("Search for pens") { router.push(.search("pens")) }
                    NavigationLink("Profile", value: Route.profile)
                }
            }
            .navigationTitle("Shop")
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .item(let id): ItemScreen(id: id)
                case .search(let query): SearchScreen(query: query)
                case .profile: ProfileScreen()
                }
            }
        }
    }
}

// ItemScreen.swift
struct ItemScreen: View {
    let id: Int
    @Environment(Router.self) private var router

    var body: some View {
        List {
            LabeledContent("Item", value: "#\(id)")
            Button("See it in search") { router.push(.search("item \(id)")) }
            Button("Back to the top") { router.popToRoot() }
        }
        .navigationTitle("Item \(id)")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// SearchScreen.swift
struct SearchScreen: View {
    let query: String
    @Environment(Router.self) private var router

    var body: some View {
        List(1...5, id: \.self) { id in
            Button("Result \(id) for “\(query)”") { router.push(.item(id)) }
        }
        .navigationTitle(query)
    }
}

// ProfileScreen.swift
struct ProfileScreen: View {
    var body: some View {
        Text("Profile")
            .navigationTitle("You")
    }
}

#Preview {
    RootScreen()
        .environment(Router())
}
```

#### Uses
- [Navigation › A stack and a path](#/navigation/a-stack-and-a-path)
- [Navigation › Value-based destinations](#/navigation/value-based-destinations)
- [Navigation › Pushing from code](#/navigation/pushing-from-code)

#### Hints
- `.navigationDestination(for:)` goes on the `List` inside the stack, not on the `NavigationStack`. Outside its scope, nothing pushes and Xcode warns you at runtime.
- `@Environment(Router.self) private var router` reads an `@Observable` object out of the environment; `@Bindable var router = router` at the top of `body` is how you get `$router.path` from it.
- `NavigationLink("Pens", value: Route.item(1))` needs the explicit `Route.` — inside the link the compiler has nothing to infer the case from.
- Push a search from the item screen, then another item from there, to get three deep and prove `popToRoot()` really unwinds.

#### Tips
- One `navigationDestination` per route type, in one place, is the whole reason to use an enum. Scattering destinations across screens brings back the problem `NavigationStack` was designed to remove.
- Owning the path in a `Router` rather than a `@State` in the root view is what lets a deep link, a push notification and a toolbar button all navigate without knowing anything about each other.
- Keep the `Route` cases small and value-like — an id, a query — rather than whole model objects. The path has to be `Hashable`, may have to be `Codable`, and a case carrying a live object is neither for long.

#### Docs
- [NavigationStack](https://developer.apple.com/documentation/swiftui/navigationstack)
- [navigationDestination(for:destination:)](https://developer.apple.com/documentation/swiftui/view/navigationdestination(for:destination:))
- [Bindable](https://developer.apple.com/documentation/swiftui/bindable)

### 5. A sheet that hands something back

Build a modal tag picker: the parent owns the chosen tag, the sheet writes into it and closes itself, and Cancel leaves the parent's state untouched.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `Tag` model conforming to `Identifiable` and `Hashable`, with a handful of sample values.
- A `ComposeScreen` with `@State private var chosen: Tag?` and a row showing the chosen tag's name or "None".
- A `.sheet(isPresented:)` presenting `TagPicker`, which takes `@Binding var selected: Tag?`.
- `@Environment(\.dismiss)` in the picker, called after the selection is written, so the sheet closes itself rather than having the parent close it.
- A Cancel button in the picker's toolbar that dismisses **without** writing, and a visible check that the parent's value is unchanged afterwards.
- A `NavigationStack` inside the sheet so it has its own title and toolbar, and `.presentationDetents([.medium])` so it does not cover the whole screen.
- A `#Preview` for `TagPicker` on its own, driven by `@Previewable @State`.

```swift solution
// Tag.swift
struct Tag: Identifiable, Hashable {
    let id: Int
    let name: String

    static let all = [
        Tag(id: 1, name: "Work"),
        Tag(id: 2, name: "Home"),
        Tag(id: 3, name: "Urgent"),
    ]
}

// ComposeScreen.swift
struct ComposeScreen: View {
    @State private var chosen: Tag?
    @State private var showingPicker = false

    var body: some View {
        NavigationStack {
            Form {
                LabeledContent("Tag", value: chosen?.name ?? "None")
                Button("Choose a tag") { showingPicker = true }
                if chosen != nil {
                    Button("Clear", role: .destructive) { chosen = nil }
                }
            }
            .navigationTitle("Compose")
            .sheet(isPresented: $showingPicker) {
                TagPicker(selected: $chosen)
            }
        }
    }
}

// TagPicker.swift
struct TagPicker: View {
    @Binding var selected: Tag?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(Tag.all) { tag in
                Button {
                    selected = tag
                    dismiss()
                } label: {
                    HStack {
                        Text(tag.name)
                        Spacer()
                        if tag == selected {
                            Image(systemName: "checkmark")
                                .accessibilityHidden(true)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .navigationTitle("Tags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    @Previewable @State var tag: Tag? = Tag.all[0]
    TagPicker(selected: $tag)
}
```

#### Uses
- [Navigation › Sheets and covers](#/navigation/sheets-and-covers)
- [Navigation › Returning a result](#/navigation/returning-a-result)

#### Hints
- `@Environment(\.dismiss) private var dismiss` gives the sheet a way to close itself; call it as `dismiss()`.
- The binding is the whole channel back: writing `selected = tag` in the child updates the parent's `@State` directly.
- Cancel simply does not write. There is nothing to undo, because nothing was written until the row was tapped.
- `@Previewable @State` lets a preview hold state so you can pass a real `Binding` into a view that needs one.

#### Tips
- Try converting the sheet to `.sheet(item: $editing)` with an `Identifiable?` piece of state. One value then says both whether the sheet is up and what it is about, so the two cannot disagree — the bug you get with a separate `Bool` and a separate "selected" value.
- If the picker needed to push its own screens, the `NavigationStack` inside it is not optional. A sheet has no stack of its own, and the presenting one does not reach in.
- Prefer a binding when the parent stores the result and a closure when the parent has work to do with it. Passing the parent itself into the child is the version that stops being testable.

#### Docs
- [sheet(item:onDismiss:content:)](https://developer.apple.com/documentation/swiftui/view/sheet(item:ondismiss:content:))
- [DismissAction](https://developer.apple.com/documentation/swiftui/dismissaction)
- [presentationDetents(_:)](https://developer.apple.com/documentation/swiftui/view/presentationdetents(_:))
