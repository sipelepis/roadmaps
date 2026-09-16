# What is iOS?

iOS apps are written in Swift, and their interfaces are built with SwiftUI: you describe what the screen should look like for the current state, and the framework works out what to redraw. This roadmap covers the platform, not the language. If Swift itself is new, read the Swift Roadmap first; here we assume you can read a struct, a closure, an optional and `async`/`await`.

Every module is an article, a playground you can edit and run, and exercises. The exercises come in two kinds, and it is worth knowing which is which before you start.

## Two kinds of exercise

Most of what makes an app correct is ordinary Swift: what the state is, when to show a spinner, which items to keep, how to turn a response into something the screen can use. That code is compiled and run here by a real `swiftc`, with real tests, exactly like the other roadmaps.

The screens themselves are different. SwiftUI ships with Apple's SDKs and needs Xcode and a simulator or device, and no browser can give you that. So a screen is a **build task**: the problem tells you what to build, a checklist tells you what "done" looks like, and a reference solution is one click away when you want to compare. Nothing marks it for you. That is honest, and it is also how the job works — you look at the screen and decide whether it is right.

```swift playground
// Ordinary Swift, the kind an iOS app is mostly made of: this runs right here.
struct Item: Identifiable {
    let id: Int
    let name: String
    let qty: Int
}

enum CartState {
    case loading
    case ready([Item])
    case failed(String)
}

func badge(_ state: CartState) -> String {
    switch state {
    case .loading: return "…"
    case .failed: return "!"
    case .ready(let items):
        let total = items.reduce(0) { $0 + $1.qty }
        return total > 99 ? "99+" : String(total)
    }
}

let cart = CartState.ready([Item(id: 1, name: "Pen", qty: 2), Item(id: 2, name: "Pad", qty: 3)])
print(badge(.loading))
print(badge(cart))
print(badge(.ready((0..<40).map { Item(id: $0, name: "x", qty: 3) })))
print(badge(.failed("offline")))
```

## What an app is made of

A SwiftUI app starts at a type marked `@main` that conforms to `App`. It returns a scene, and the scene holds your first view.

```swift
@main
struct ShopApp: App {
    var body: some Scene {
        WindowGroup {
            CartScreen()
        }
    }
}
```

There is no storyboard and no view controller in a pure SwiftUI app. From `CartScreen` down, everything is a `View`.

## The tools

**Xcode** is the IDE, the compiler, the simulator, the debugger and the profiler in one. **The simulator** runs iOS on your Mac; a real device is slower to set up and far more honest about performance and memory. **Swift Package Manager** resolves dependencies. You will need Xcode for the build tasks in this roadmap, so **you need a Mac**: there is no supported way to build an iOS app on Linux or Windows. The logic exercises need nothing but this page, on any machine.

## What you will build here

The roadmap runs from an Xcode project through views, layout, state, lists, navigation and a design system, then into the parts that make an app real: app lifecycle, concurrency, networking, storage, dependencies, accessibility, testing, performance and shipping to the App Store. The graph on the home page shows what each module builds on.

## Exercises

### 1. Cart badge

`badge(_:)` returns what the little number on the cart icon should say: `"…"` while loading, `"!"` when it failed, otherwise the total quantity across the items. A total above 99 shows as `"99+"`, and an empty cart shows `"0"`.

```swift starter
struct Item: Identifiable {
    let id: Int
    let name: String
    let qty: Int
}

enum CartState {
    case loading
    case ready([Item])
    case failed(String)
}

func badge(_ state: CartState) -> String {
    return ""
}
```

```swift test
/// loading and failure have their own marks
func testNonReady() {
    expect(badge(.loading), "…")
    expect(badge(.failed("offline")), "!")
    expect(badge(.failed("500")), "!")
}

/// the total counts quantities, not lines
func testTotals() {
    expect(badge(.ready([Item(id: 1, name: "Pen", qty: 2), Item(id: 2, name: "Pad", qty: 3)])), "5")
    expect(badge(.ready([Item(id: 1, name: "Pen", qty: 2)])), "2")
    expect(badge(.ready([])), "0")
}

/// ninety-nine is the last number you see
func testCapped() {
    expect(badge(.ready([Item(id: 1, name: "Pen", qty: 99)])), "99")
    expect(badge(.ready([Item(id: 1, name: "Pen", qty: 100)])), "99+")
    expect(badge(.ready((0..<40).map { Item(id: $0, name: "x", qty: 3) })), "99+")
}
```

#### Uses
- [What is iOS? › Two kinds of exercise](#/intro/two-kinds-of-exercise)
- [Reference › expect](#/reference/expect)

#### Hints
- `switch state` over an enum is exhaustive, so the compiler tells you if you forget a case.
- Bind the payload with `case .ready(let items)` to get at the array.
- `items.reduce(0) { $0 + $1.qty }` totals a property across the list. An empty array reduces to `0`.

#### Tips
- This is the kind of logic worth keeping out of a view: it is pure, it is testable in milliseconds, and the view just displays what it returns.
- `case .failed` without binding the message is fine when you do not need it; the compiler does not force you to name what you ignore.

#### Docs
- [Enumerations with associated values](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/enumerations/#Associated-Values)
- [Managing user interface state](https://developer.apple.com/documentation/swiftui/managing-user-interface-state)

### 2. Your first screen

Create a new project in Xcode (**App**, with SwiftUI as the interface) and make its screen show a title and the cart badge from exercise 1 next to a cart symbol. Run it in the simulator.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A new project from the **App** template with the SwiftUI interface, running in the simulator.
- A view `CartBadge` that takes a `CartState` and shows `badge(state)` as text.
- The `badge` function lives in its own file, not inside the view.
- The screen shows an SF Symbol and the badge beside it, laid out with an `HStack`.
- A `#Preview` that renders the screen without running the whole app.

```swift solution
// ShopApp.swift
@main
struct ShopApp: App {
    var body: some Scene {
        WindowGroup {
            CartScreen(state: .ready([Item(id: 1, name: "Pen", qty: 2),
                                      Item(id: 2, name: "Pad", qty: 3)]))
        }
    }
}

// CartScreen.swift
struct CartScreen: View {
    let state: CartState

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your cart")
                .font(.largeTitle)
            CartBadge(state: state)
        }
        .padding(24)
    }
}

struct CartBadge: View {
    let state: CartState

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "cart")
                .accessibilityHidden(true)
            Text(badge(state))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Cart, \(badge(state)) items")
    }
}

#Preview {
    CartScreen(state: .ready([Item(id: 1, name: "Pen", qty: 2)]))
}
```

#### Uses
- [What is iOS? › What an app is made of](#/intro/what-an-app-is-made-of)
- [What is iOS? › The tools](#/intro/the-tools)

#### Hints
- File → New → Project → iOS → App, and pick SwiftUI for the interface.
- The generated `ContentView` is yours to rename or replace; the `@main` struct decides which view opens.
- `Image(systemName: "cart")` draws an SF Symbol. The SF Symbols app lists every name.

#### Tips
- An icon beside a number reads as two separate things to VoiceOver. Combining them into one element with a spoken label, as the solution does, is the difference between "cart, 5 items" and "cart. five".
- `#Preview` rebuilds as you type, which is much faster than launching the simulator for every change.
- Keep views small enough that the preview is useful; a view that needs a whole logged-in app to render is a view you cannot iterate on.

#### Docs
- [Creating an Xcode project for an app](https://developer.apple.com/documentation/xcode/creating-an-xcode-project-for-an-app)
- [SwiftUI essentials](https://developer.apple.com/tutorials/swiftui)
