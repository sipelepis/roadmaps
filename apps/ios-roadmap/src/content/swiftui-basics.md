# Views & modifiers

A SwiftUI view is not an object you keep and poke at. It is a small immutable value describing what should be on screen for the inputs it was handed, and the framework builds, compares and throws away thousands of them a second. Once that lands, most of SwiftUI's odder rules — why modifier order changes the picture, why you never store a view in a variable to mutate later — turn into consequences of one idea.

## A view is a value, not an object

`View` is a protocol, and almost every conforming type is a `struct`:

```swift
struct Greeting: View {
    let name: String

    var body: some View {
        Text("Hello, \(name)!")
    }
}
```

`Greeting(name: "Ada")` is a value about as heavy as a `String`. It has no reference, no lifetime you manage, no `self` that survives between frames. SwiftUI creates it, reads its `body`, works out what changed, updates the real drawing layer, and discards the struct.

Two consequences follow immediately. A view's stored properties are the inputs it renders from, so anything you want to *change* over time cannot just be a `var` on the struct — that is what `@State` and friends are for, in the next module. And a view's `body` should be cheap and free of side effects, because it runs far more often than you think and in an order you do not control.

## `body` and `some View`

`body` is a computed property: a function from the view's inputs to a description of the screen. `some View` is an *opaque return type* — it promises the caller a single concrete type conforming to `View` without naming it.

It has to be opaque, because the real type is unspeakable. `Text("Hi").padding().background(.blue)` has the type `ModifiedContent<ModifiedContent<Text, _PaddingLayout>, _BackgroundStyleModifier<Color>>`, and adding one modifier changes it. `some View` lets the compiler keep that precise static type — which is what makes SwiftUI fast, since it can compare old and new structurally — while you never have to write it down.

Inside `body` you are in a `@ViewBuilder` context, which is why several views in a row work with no commas and no `return`. The builder turns them into a `TupleView`, and turns an `if`/`else` into a `_ConditionalContent<A, B>`. Both branches exist in the type; only one is rendered.

## Modifiers return new views

A modifier is an ordinary method that wraps its receiver in another view and hands it back:

```swift
Text("Hi")
    .padding(12)          // ModifiedContent<Text, _PaddingLayout>
    .background(.blue)    // ModifiedContent<ModifiedContent<…>, …>
```

Nothing is set on the `Text`. Each call produces a new value that contains the old one. Reading a chain outwards — "a text, padded, on a blue background" — is the accurate mental model, and it explains the next section entirely.

Modifiers of the same kind accumulate rather than replace. `.padding(.horizontal, 8).padding(.top, 4)` gives you eight points at the sides and four at the top, because each one wraps the last.

## Order is the whole story

Since each modifier wraps the result of the one before, the order decides what is wrapped:

```swift
Text("Hi").padding(12).background(.blue)   // blue behind text AND padding
Text("Hi").background(.blue).padding(12)   // blue tight to the text, padding outside it
```

The same applies to size. `.frame(width: 100, height: 40)` proposes a fixed size to whatever is inside it, so `.padding(10).frame(width: 100, height: 40)` is 100×40 with the padding *inside*, while `.frame(width: 100, height: 40).padding(10)` is 120×60.

Some modifiers do not participate in layout at all. `.border`, `.background` and `.overlay` draw in the space the content already took, so the measured size never moves. Others are *about* layout and therefore care intensely about their position in the chain. When a view looks wrong by a few points, moving one modifier is usually the fix.

There is a matching trap for interaction: `.onTapGesture` and `Button` only respond where the content actually draws, so the padding around a label is not tappable by default. `.contentShape(Rectangle())` declares the whole frame as the hit area, and belongs on almost every custom row.

## Composing views

The smallest useful unit in SwiftUI is a `struct` with one job. There is no runtime cost to splitting a screen up — it is all static types the compiler flattens — and there are three real benefits: each piece gets a preview, each piece states its inputs, and a `body` shorter than a screen is one you can read.

The usual signal that it is time to extract is a `body` you are scrolling, a chunk of it that needs a comment, or a `let` computed halfway down that only one section uses. Extract the piece into its own view with the inputs it needs and nothing more.

Prefer a new view over a `var someSection: some View` property when the piece has its own inputs; the property gets you a shorter `body` but keeps everything sharing the parent's whole world.

## Previews

`#Preview` is a macro that registers a snippet to render in the canvas:

```swift
#Preview("Online") {
    ProfileCard(person: .sample)
}
```

It is not decoration. A preview is a cheap harness for exactly one state, which is what you want when a state is hard to reach in the running app — an error, an empty list, a name in Arabic, Dynamic Type at its largest. Write one preview per interesting state and you have effectively written the screen's test plan.

Previews compile your whole module, so a preview that will not build is a build error you have to fix regardless. And a view with no inputs — one that reaches into a logged-in session for its data — is a view you cannot preview, which is a design smell more than a preview problem.

```swift playground
// A view is a value, so a chain of modifiers is a value transform. Model it and
// the difference between the two orders stops being mysterious.
struct Size: CustomStringConvertible {
    var width: Double
    var height: Double
    var description: String { "\(Int(width))×\(Int(height))" }
}

enum Modifier {
    case padding(Double)
    case frame(Double, Double)
    case border(Double)

    var typeName: String {
        switch self {
        case .padding: return "_PaddingLayout"
        case .frame: return "_FrameLayout"
        case .border: return "_OverlayModifier<_ShapeView<Rectangle, Color>>"
        }
    }
}

func size(of content: Size, after modifiers: [Modifier]) -> Size {
    var current = content
    for modifier in modifiers {
        switch modifier {
        case .padding(let amount):
            current = Size(width: current.width + 2 * amount, height: current.height + 2 * amount)
        case .frame(let width, let height):
            current = Size(width: width, height: height)
        case .border:
            break            // drawn, not laid out: the size does not move
        }
    }
    return current
}

func typeName(of base: String, after modifiers: [Modifier]) -> String {
    modifiers.reduce(base) { "ModifiedContent<\($0), \($1.typeName)>" }
}

let text = Size(width: 60, height: 20)
let framedThenPadded: [Modifier] = [.frame(100, 40), .padding(10)]
let paddedThenFramed: [Modifier] = [.padding(10), .frame(100, 40)]

print("frame then padding:", size(of: text, after: framedThenPadded))
print("padding then frame:", size(of: text, after: paddedThenFramed))
print()
print(typeName(of: "Text", after: framedThenPadded))
print(typeName(of: "Text", after: paddedThenFramed))

// Try: add .border(2) anywhere in either list. The size never moves.
```

## Exercises

### 1. Where does the padding end up?

`.padding` can name one edge, an axis, or everything, and repeated calls accumulate because each one wraps the last. Work out the insets a chain leaves behind.

`insets(after:)` takes the padding modifiers in the order they were applied and returns the total on each edge. `.horizontal` is leading and trailing; `.vertical` is top and bottom; `.all` is all four.

```swift starter
struct Insets: Equatable {
    var top: Double = 0
    var leading: Double = 0
    var bottom: Double = 0
    var trailing: Double = 0
}

enum Edge {
    case top, leading, bottom, trailing
    case horizontal, vertical, all
}

func insets(after paddings: [(Edge, Double)]) -> Insets {
    return Insets()
}
```

```swift test
/// nothing in, nothing out
func testEmpty() {
    expect(insets(after: []), Insets())
}

/// a single edge touches only that edge
func testSingleEdge() {
    expect(insets(after: [(.top, 12)]), Insets(top: 12))
    expect(insets(after: [(.trailing, 4)]), Insets(trailing: 4))
    expect(insets(after: [(.leading, 4)]), Insets(leading: 4))
    expect(insets(after: [(.bottom, 4)]), Insets(bottom: 4))
}

/// an axis touches two edges, .all touches four
func testAxes() {
    expect(insets(after: [(.horizontal, 8)]), Insets(leading: 8, trailing: 8))
    expect(insets(after: [(.vertical, 6)]), Insets(top: 6, bottom: 6))
    expect(insets(after: [(.all, 16)]), Insets(top: 16, leading: 16, bottom: 16, trailing: 16))
}

/// repeated padding adds up, it does not replace
func testAccumulates() {
    expect(insets(after: [(.horizontal, 8), (.top, 4)]), Insets(top: 4, leading: 8, trailing: 8))
    expect(insets(after: [(.all, 10), (.top, 6)]), Insets(top: 16, leading: 10, bottom: 10, trailing: 10))
    expect(insets(after: [(.top, 2), (.top, 3), (.top, 5)]), Insets(top: 10))
}

/// order does not matter here, only the totals
func testOrderIrrelevant() {
    expect(insets(after: [(.all, 10), (.horizontal, 5)]), insets(after: [(.horizontal, 5), (.all, 10)]))
    expect(insets(after: [(.vertical, 8), (.horizontal, 8)]), insets(after: [(.all, 8)]))
}
```

#### Uses
- [Views & modifiers › Modifiers return new views](#/swiftui-basics/modifiers-return-new-views)
- [Reference › SwiftUI views and layout](#/reference/swiftui-views-and-layout)

#### Hints
- Start from `var result = Insets()` and walk the list, adding as you go.
- `for (edge, amount) in paddings` destructures the tuple straight into two names.
- A `switch` over `Edge` is exhaustive, so the compiler will not let you forget `.all`.
- `.horizontal` is two `+=`, `.all` is four. There is no need to be clever about it.

#### Tips
- The last test is the real insight and the only one that is not obvious: `.padding(.vertical, 8).padding(.horizontal, 8)` and `.padding(8)` give the same insets, so when only totals matter the order genuinely does not. That is *not* true once a background or a frame joins the chain, which is the next exercise.
- SwiftUI's own `.padding()` with no arguments uses a system default that varies by platform and context, not a constant you should hardcode.
- `EdgeInsets` in real SwiftUI has exactly these four properties and the same leading/trailing naming — leading and trailing rather than left and right, so a right-to-left language flips them for free.

#### Docs
- [padding(_:_:)](https://developer.apple.com/documentation/swiftui/view/padding(_:_:))
- [EdgeInsets](https://developer.apple.com/documentation/swiftui/edgeinsets)

### 2. Order decides the size

Each modifier wraps the result of the one before it, so a chain is a fold over a size. Implement it.

`size(of:after:)` starts from the content's size and applies each modifier in turn. `.padding(p)` grows the size by `p` on every side. `.frame(width:height:)` replaces the size outright. `.border` and `.background` draw inside the space that is already there, so they change nothing.

```swift starter
struct Size: Equatable {
    var width: Double
    var height: Double
}

enum Modifier {
    case padding(Double)
    case frame(width: Double, height: Double)
    case border(Double)
    case background
}

func size(of content: Size, after modifiers: [Modifier]) -> Size {
    return content
}
```

```swift test
let text = Size(width: 60, height: 20)

/// an unmodified view is its content
func testNoModifiers() {
    expect(size(of: text, after: []), Size(width: 60, height: 20))
}

/// padding grows every side
func testPadding() {
    expect(size(of: text, after: [.padding(10)]), Size(width: 80, height: 40))
    expect(size(of: text, after: [.padding(10), .padding(5)]), Size(width: 90, height: 50))
}

/// drawing modifiers do not move the size
func testDecorationIsFree() {
    expect(size(of: text, after: [.border(4)]), Size(width: 60, height: 20))
    expect(size(of: text, after: [.background]), Size(width: 60, height: 20))
    expect(size(of: text, after: [.border(4), .background, .border(1)]), Size(width: 60, height: 20))
}

/// a frame replaces the size, whatever was underneath
func testFrame() {
    expect(size(of: text, after: [.frame(width: 100, height: 40)]), Size(width: 100, height: 40))
    expect(size(of: text, after: [.padding(50), .frame(width: 100, height: 40)]), Size(width: 100, height: 40))
}

/// the same two modifiers, the other way round
func testOrderMatters() {
    let padded = size(of: text, after: [.padding(10), .frame(width: 100, height: 40)])
    let framed = size(of: text, after: [.frame(width: 100, height: 40), .padding(10)])
    expect(padded, Size(width: 100, height: 40))
    expect(framed, Size(width: 120, height: 60))
    expect(padded != framed, "the two orders must not agree")
}
```

#### Uses
- [Views & modifiers › Order is the whole story](#/swiftui-basics/order-is-the-whole-story)
- [Views & modifiers › Modifiers return new views](#/swiftui-basics/modifiers-return-new-views)

#### Hints
- One `var current = content`, then a `switch` inside a `for` loop.
- `.padding(p)` adds `2 * p` to each dimension, not `p`: it applies to both sides.
- `.border` and `.background` need a `break` in their `switch` case. A Swift `switch` case cannot be empty.
- `.frame` ignores `current` entirely — that is the whole point of the last test.

#### Tips
- The real `.frame(width:height:)` is subtler than this: it proposes that size to its child, and a child that refuses (a long unwrappable `Text`, say) can still overflow. The frame sets the size *of the frame*, which is what the parent then lays out.
- `.frame(maxWidth: .infinity)` is the one you will reach for most, and it is a different modifier: it takes as much as the parent offers rather than a fixed number.
- When a layout is one modifier away from right, try moving a modifier before you try adding one. Chains grow by accretion and the order is rarely reconsidered.

#### Docs
- [frame(width:height:alignment:)](https://developer.apple.com/documentation/swiftui/view/frame(width:height:alignment:))
- [Configuring views](https://developer.apple.com/documentation/swiftui/configuring-views)

### 3. The type a chain builds

`some View` exists because the type of a view expression is real, precise and awful to write. Build the name of one.

`typeName(of:)` renders the static type SwiftUI would infer:

- a plain view is its own name;
- `.modified(child, m)` is `ModifiedContent<CHILD, M>`;
- `.tuple([a, b, c])` — what `@ViewBuilder` makes of several views in a row — is `TupleView<(A, B, C)>`;
- `.conditional(a, b)` — what it makes of an `if`/`else` — is `_ConditionalContent<A, B>`.

```swift starter
indirect enum Built {
    case view(String)
    case modified(Built, String)
    case tuple([Built])
    case conditional(Built, Built)
}

func typeName(of built: Built) -> String {
    return ""
}
```

```swift test
/// a bare view is its own name
func testPlain() {
    expect(typeName(of: .view("Text")), "Text")
    expect(typeName(of: .view("ProfileCard")), "ProfileCard")
}

/// each modifier wraps what came before it
func testModified() {
    expect(typeName(of: .modified(.view("Text"), "_PaddingLayout")),
           "ModifiedContent<Text, _PaddingLayout>")
    expect(typeName(of: .modified(.modified(.view("Text"), "_PaddingLayout"), "_BackgroundStyleModifier<Color>")),
           "ModifiedContent<ModifiedContent<Text, _PaddingLayout>, _BackgroundStyleModifier<Color>>")
}

/// views in a row become a tuple
func testTuple() {
    expect(typeName(of: .tuple([.view("Text"), .view("Image")])), "TupleView<(Text, Image)>")
    expect(typeName(of: .tuple([.view("Text"), .view("Image"), .view("Spacer")])),
           "TupleView<(Text, Image, Spacer)>")
    expect(typeName(of: .tuple([.view("Text")])), "TupleView<(Text)>")
    expect(typeName(of: .tuple([])), "TupleView<()>")
}

/// an if/else keeps both branches in the type
func testConditional() {
    expect(typeName(of: .conditional(.view("Text"), .view("ProgressView"))),
           "_ConditionalContent<Text, ProgressView>")
}

/// a realistic body nests all three
func testNested() {
    let body = Built.modified(
        .tuple([
            .modified(.view("Text"), "_PaddingLayout"),
            .conditional(.view("ProgressView"), .view("EmptyView")),
        ]),
        "_FrameLayout"
    )
    expect(typeName(of: body),
           "ModifiedContent<TupleView<(ModifiedContent<Text, _PaddingLayout>, _ConditionalContent<ProgressView, EmptyView>)>, _FrameLayout>")
}
```

#### Uses
- [Views & modifiers › `body` and `some View`](#/swiftui-basics/body-and-some-view)
- [Views & modifiers › Modifiers return new views](#/swiftui-basics/modifiers-return-new-views)
- [Reference › SwiftUI views and layout](#/reference/swiftui-views-and-layout)

#### Hints
- One `switch`, four cases, and three of them call `typeName(of:)` again.
- String interpolation does the assembly: `"ModifiedContent<\(typeName(of: child)), \(modifier)>"`.
- For `.tuple`, map the children to their names and `joined(separator: ", ")`. The empty case then falls out on its own.
- `indirect` is already on the enum, which is what lets a case hold another `Built`.

#### Tips
- Look at the last expected string. That is the type of a perfectly ordinary six-line `body`, and it changes every time you touch a modifier. Writing it by hand is not merely tedious, it is unmaintainable — which is exactly the argument for `some View`.
- `_ConditionalContent` is why an `if` in a `body` is not free: both branches are in the type, and swapping branches replaces the view rather than updating it, losing any state inside. The State module comes back to this.
- The leading underscores are not decoration. A type named `_Something` is SwiftUI telling you it is an implementation detail: never name it, never depend on it.

#### Docs
- [Opaque types](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/opaquetypes/)
- [ViewBuilder](https://developer.apple.com/documentation/swiftui/viewbuilder)

### 4. A profile card, in three views

Build a profile card and, more importantly, build it out of parts. The goal is that no `body` is longer than about a dozen lines and each piece has its own preview.

#### Build it
- A `Person` model with a name, a role, an SF Symbol name and an online flag.
- Three views: `Avatar` (the symbol in a circle), `StatusPill` (a capsule saying Online or Away), and `ProfileCard` composing them in an `HStack`.
- Each small view takes only the inputs it needs — `StatusPill` gets a `Bool`, not the whole `Person`.
- A `#Preview` for `ProfileCard` showing both an online and an away person at once.
- A separate `#Preview` for `StatusPill` on its own, proving the piece renders without the card.

```swift solution
// Person.swift
struct Person: Identifiable {
    let id = UUID()
    var name: String
    var role: String
    var symbol: String
    var isOnline: Bool

    static let sample = Person(name: "Ada Lovelace", role: "Engineer", symbol: "person.fill", isOnline: true)
}

// Avatar.swift
struct Avatar: View {
    let symbol: String
    var diameter: CGFloat = 56

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: diameter * 0.45))
            .foregroundStyle(.white)
            .frame(width: diameter, height: diameter)
            .background(Color.accentColor, in: Circle())
            .accessibilityHidden(true)
    }
}

// StatusPill.swift
struct StatusPill: View {
    let isOnline: Bool

    var body: some View {
        Text(isOnline ? "Online" : "Away")
            .font(.caption.weight(.semibold))
            .foregroundStyle(isOnline ? Color.green : Color.orange)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background((isOnline ? Color.green : Color.orange).opacity(0.15), in: Capsule())
    }
}

#Preview("Status pill") {
    VStack(spacing: 8) {
        StatusPill(isOnline: true)
        StatusPill(isOnline: false)
    }
    .padding()
}

// ProfileCard.swift
struct ProfileCard: View {
    let person: Person

    var body: some View {
        HStack(spacing: 12) {
            Avatar(symbol: person.symbol)
            VStack(alignment: .leading, spacing: 4) {
                Text(person.name)
                    .font(.headline)
                Text(person.role)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                StatusPill(isOnline: person.isOnline)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview("Profile card") {
    VStack(spacing: 12) {
        ProfileCard(person: .sample)
        ProfileCard(person: Person(name: "Grace Hopper", role: "Rear Admiral", symbol: "person.fill", isOnline: false))
    }
    .padding()
}
```

#### Uses
- [Views & modifiers › Composing views](#/swiftui-basics/composing-views)
- [Views & modifiers › Previews](#/swiftui-basics/previews)
- [Views & modifiers › A view is a value, not an object](#/swiftui-basics/a-view-is-a-value-not-an-object)

#### Hints
- Start with everything in one `body`, get it looking right, then pull pieces out. Extracting is easy; guessing the pieces up front is not.
- `Circle()` and `Capsule()` are shapes, and `.background(style, in: shape)` fills one behind the content.
- `Spacer(minLength: 0)` inside the `HStack` pushes the text block to the leading edge so cards of different widths still line up.
- `#Preview("A name") { … }` labels a preview, and you can have as many per file as you like.

#### Tips
- `StatusPill(isOnline:)` rather than `StatusPill(person:)` is the whole lesson. A view that takes the narrowest input it can is one you can preview, reuse and reason about; one that takes the whole model drags the model everywhere it goes.
- `.accessibilityHidden(true)` on the avatar is right: the symbol repeats what the name already says, and VoiceOver reading "person, Ada Lovelace" helps nobody.
- Resist a `var avatarSection: some View` property here. Once a piece has its own input — the symbol, the flag — it wants to be a view with a preview.

#### Docs
- [Declaring a custom view](https://developer.apple.com/documentation/swiftui/declaring-a-custom-view)
- [Previews in Xcode](https://developer.apple.com/documentation/swiftui/previews-in-xcode)

### 5. The order bug

Two buttons that look nearly identical, one of which only works if you hit the text. Build both, side by side, and see the difference yourself.

#### Build it
- A screen with two buttons whose labels differ only in the order of `.padding` and `.background`.
- The correct one pads first, so the coloured area and the tappable area are the same rectangle.
- Both actions `print` something, so the console tells you which one fired.
- A settings-style row — a label, a `Spacer`, a chevron — with `.contentShape(Rectangle())` so the empty middle is tappable.
- Verified by tapping in the padding of each button in the simulator, not by reading the code.

```swift solution
// OrderDemo.swift
struct OrderDemo: View {
    var body: some View {
        VStack(spacing: 24) {
            // Right: padding first, so the background wraps it — and so does the hit area.
            Button {
                print("padded button")
            } label: {
                Text("Tap the edge")
                    .padding(12)
                    .background(Color.accentColor.opacity(0.2), in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)

            // Wrong: the background hugs the text, and the padding sits outside it.
            Button {
                print("unpadded button")
            } label: {
                Text("Tap the edge")
                    .background(Color.red.opacity(0.2), in: RoundedRectangle(cornerRadius: 10))
                    .padding(12)
            }
            .buttonStyle(.plain)

            // A custom row: without contentShape the gap in the middle draws nothing,
            // so nothing there is tappable either.
            HStack {
                Text("Notifications")
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
            .onTapGesture { print("row") }
        }
        .padding()
    }
}

#Preview {
    OrderDemo()
}
```

#### Uses
- [Views & modifiers › Order is the whole story](#/swiftui-basics/order-is-the-whole-story)
- [Views & modifiers › Modifiers return new views](#/swiftui-basics/modifiers-return-new-views)
- [Reference › SwiftUI styling and type](#/reference/swiftui-styling-and-type)

#### Hints
- `.buttonStyle(.plain)` stops the system style from adding its own background and confusing the comparison.
- The console is in the bottom pane of Xcode; ⇧⌘C focuses it.
- `.contentShape(Rectangle())` sets the shape used for hit testing, without drawing anything.
- To see the frames rather than guess at them, add `.border(.red)` temporarily, or use Debug ▸ View Debugging ▸ Capture View Hierarchy on a running app.

#### Tips
- The Human Interface Guidelines ask for a hit target of at least 44×44 points. A 17-point line of text with no padding inside the tappable area is half that, and it is the single most common reason an app feels imprecise.
- `.contentShape(Rectangle())` belongs on essentially every custom row in a list. The system's own rows already do it, which is why nobody notices until they write their own.
- A `.background` is not a decoration you add at the end. It decides where the view draws, and therefore where it can be touched.

#### Docs
- [contentShape(_:eoFill:)](https://developer.apple.com/documentation/swiftui/view/contentshape(_:eofill:))
- [Human Interface Guidelines: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
