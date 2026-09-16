# Design system

A design system on iOS is mostly the discipline of never writing a number or a colour twice. Apple supplies more of it than people realise — a type scale that responds to the user's chosen text size, semantic colours that flip for dark mode, four thousand icons that align with your text — and the job is to add a thin layer of your own on top and then use it everywhere. The failure mode is not an ugly app; it is an app with nine slightly different greys and a card that breaks at the largest text size.

## Semantic colour

Name a colour for what it *means*, not what it looks like. `Color.brandPrimary` and `Color.cardBackground` survive a rebrand and a dark mode; `Color(red: 0.1, green: 0.4, blue: 0.9)` survives nothing.

The system's own colours are already semantic, and using them is free correctness: `.primary` and `.secondary` for text, `Color(.systemBackground)` and its grouped variants, `.tint` for anything interactive. They adapt to dark mode, to increased contrast, and to whatever Apple changes next year.

Your own colours belong in the asset catalog, with an Any and a Dark appearance defined per colour. A `Color("Brand")` then needs no `if colorScheme == .dark` anywhere in the codebase. Better still, define them once in an extension so a typo is a compiler error:

```swift
extension Color {
    static let brand = Color("Brand")
    static let cardBackground = Color("CardBackground")
}
```

Hierarchical styles are the other half. `.foregroundStyle(.secondary)` and `.tertiary` give you the system's own de-emphasis, correct in both schemes, without picking a grey.

## Dark mode is not a second stylesheet

If every colour is semantic, dark mode is already done. What it actually breaks is the places you cheated: a hardcoded white card, an image with a baked-in background, a shadow that vanishes on a dark surface, text over a photo that was legible on a light one.

Two rules that cover most of it. Never put text on an unknown background — if a colour comes from data, compute a legible foreground rather than assuming black. And prefer a border or a material to a shadow for separating surfaces, since shadows carry almost no information on a dark background.

`@Environment(\.colorScheme)` exists for the cases where the *content* differs, not the colour — a different illustration, say. Reaching for it to pick between two hex values means a colour that should have been in the asset catalog.

## The type scale

iOS has eleven text styles, from `.largeTitle` down to `.caption2`, and they are a scale — the sizes, weights and line heights are designed together. Use them:

```swift
Text("Receipts").font(.largeTitle)
Text("1,284 items").font(.subheadline).foregroundStyle(.secondary)
```

`.font(.system(size: 17))` opts out of the scale and, more importantly, out of Dynamic Type: that text will stay 17 points when the user has asked for 34. Reach for a fixed size only for something that is not really text — a numeric display, a logo — and then use `@ScaledMetric` so it still scales.

`.headline` and `.body` are the same point size and differ in weight; that is deliberate and is how a title and its paragraph stay related. Adjusting a style with `.font(.body.weight(.semibold))` or `.bold()` keeps you inside the scale, which is nearly always what you want instead of a custom size.

## Dynamic Type

The user picks a text size in Settings, on a scale with seven ordinary steps and five accessibility steps above them. At `.accessibility5` body text is roughly three times its default size, and a fair number of people use those sizes every day.

What breaks is layout, not type. Two things sitting side by side stop fitting; a fixed-height row clips; a button label truncates. The fixes, in order of preference:

- **`ViewThatFits`** — give it a horizontal layout and a vertical one, and it picks the first that fits.
- **`@ScaledMetric`** — for your own numbers: `@ScaledMetric var iconSize: CGFloat = 28` scales with the text.
- **Stop fixing heights.** `.frame(minHeight: 44)` instead of `.frame(height: 44)`.
- **`.dynamicTypeSize(...DynamicTypeSize.accessibility3)`** to cap it, as a last resort and only where the alternative is unusable.

A preview at `.accessibility5` costs one line and catches nearly all of it before a user does.

## Contrast

WCAG's contrast ratio runs from 1 (identical) to 21 (black on white), and the thresholds worth knowing are **4.5 for ordinary text** and **3.0 for large text** — 18 points and up, or 14 and bold. It is computed from relative luminance, which weights green far more than blue because your eye does.

A few things this reveals. Apple's own system blue on white is about 4.0, which is why it is used for controls and large text rather than paragraphs. Grey-on-grey secondary text is where apps fail most often. And "it looks fine to me" is not evidence: the calculation exists precisely because the eye is a poor judge of its own limits.

The system's Increase Contrast setting is exposed as `@Environment(\.colorSchemeContrast)`, and the asset catalog can carry a High Contrast variant of every colour, which is the cheapest way to support it.

## SF Symbols

Over six thousand icons that are designed as *glyphs*: they take a font, a weight and a size, and sit on the text baseline.

```swift
Label("Receipts", systemImage: "doc.text")
Image(systemName: "checkmark.circle.fill")
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(.green)
```

`Label` is the one to reach for: it gives you an icon and text with the system's own spacing, it adapts when the container wants icon-only, and it reads correctly to VoiceOver. A bare `Image(systemName:)` beside a `Text` is two accessibility elements and a spacing decision you now own.

Use the SF Symbols app to find names and check availability — symbols have a minimum iOS version, and a name that does not exist renders as nothing at all, silently. `.fill` variants for selected states, `.symbolRenderingMode(.hierarchical)` for depth from a single colour, and `.symbolEffect` for the small animations that make a toggle feel alive.

## Spacing and shape tokens

Pick a spacing scale — 4, 8, 16, 24, 32 is a good one — and give the steps names:

```swift
enum Space {
    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 16
    static let l: CGFloat = 24
}
```

The value is not the grid, it is that `Space.m` is a decision made once. When the design changes the card padding, it changes in one place, and nobody has to find the twelve `16`s that meant something else.

The same goes for corner radii, border widths and shadow definitions. Three radii, not eleven.

## Writing a `ViewModifier`

When a set of modifiers travels together, it is a style, and a style has a name:

```swift
struct CardStyle: ViewModifier {
    var padding: CGFloat = Space.m

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Color.cardBackground, in: RoundedRectangle(cornerRadius: 16))
    }
}

extension View {
    func cardStyle(padding: CGFloat = Space.m) -> some View {
        modifier(CardStyle(padding: padding))
    }
}
```

The extension is not optional politeness — it is what makes the style read like every other modifier at the call site. A `ViewModifier` can also hold `@Environment` and even `@State`, which is how a style can respond to the colour scheme or animate, and is the real reason to prefer one over a `func styled(_ view: some View) -> some View`.

For controls specifically there are dedicated protocols — `ButtonStyle`, `ToggleStyle`, `LabelStyle` — and they are better than a `ViewModifier` because they receive the control's configuration, including whether it is currently pressed.

```swift playground
import Foundation

// Two calculations a design system lives on: what size is this text actually
// rendered at, and can anyone read it against that background?
let basePointSize: [String: Double] = [
    "largeTitle": 34, "title": 28, "headline": 17, "body": 17,
    "subheadline": 15, "footnote": 13, "caption": 12,
]

let scaleFactor: [String: Double] = [
    "large": 1.0, "xxLarge": 1.24, "accessibility1": 1.6, "accessibility5": 3.1,
]

func pointSize(_ style: String, at size: String) -> Double {
    max(11, ((basePointSize[style] ?? 17) * (scaleFactor[size] ?? 1)).rounded())
}

for size in ["large", "xxLarge", "accessibility1", "accessibility5"] {
    let row = ["largeTitle", "body", "caption"].map { "\($0) \(Int(pointSize($0, at: size)))pt" }
    print(size.padding(toLength: 16, withPad: " ", startingAt: 0), row.joined(separator: "   "))
}

// WCAG relative luminance: green counts for more than three times what blue does.
func luminance(_ rgb: (Double, Double, Double)) -> Double {
    func channel(_ c: Double) -> Double {
        c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(rgb.0) + 0.7152 * channel(rgb.1) + 0.0722 * channel(rgb.2)
}

func contrastRatio(_ a: (Double, Double, Double), _ b: (Double, Double, Double)) -> Double {
    let la = luminance(a), lb = luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

let white = (1.0, 1.0, 1.0)
let pairs: [(String, (Double, Double, Double))] = [
    ("black", (0.0, 0.0, 0.0)),
    ("system blue", (0.0, 0.478, 1.0)),
    ("mid grey", (0.5, 0.5, 0.5)),
    ("light grey", (0.8, 0.8, 0.8)),
]

print()
for (name, colour) in pairs {
    let ratio = contrastRatio(colour, white)
    let verdict = ratio >= 4.5 ? "body text" : ratio >= 3 ? "large text only" : "decoration only"
    print("\(name) on white: \(String(format: "%.2f", ratio)):1 — \(verdict)")
}

// Try: system blue is 4.02 on white. One step darker and it passes for body text.
```

## Exercises

### 1. What size is that text, really?

A text style is a base size; Dynamic Type multiplies it. Work out what the user actually sees.

`pointSize(_:at:)` multiplies the style's base size by the size category's factor, rounds to a whole point, and never returns less than 11 — below that nothing is legible whatever the scale says.

`clamped(_:upTo:)` is what `.dynamicTypeSize(...limit)` does: return the smaller of the two categories.

`isAccessibilitySize(_:)` is true from `.accessibility1` upwards, and is the signal to change the layout rather than the type.

```swift starter
enum TextStyle: String {
    case largeTitle, title, title2, title3, headline, body, callout, subheadline, footnote, caption
}

enum DynamicTypeSize: Int {
    case xSmall = 0, small, medium, large, xLarge, xxLarge, xxxLarge
    case accessibility1, accessibility2, accessibility3, accessibility4, accessibility5
}

let basePointSize: [TextStyle: Double] = [
    .largeTitle: 34, .title: 28, .title2: 22, .title3: 20, .headline: 17,
    .body: 17, .callout: 16, .subheadline: 15, .footnote: 13, .caption: 12,
]

let scaleFactor: [DynamicTypeSize: Double] = [
    .xSmall: 0.82, .small: 0.88, .medium: 0.94, .large: 1.0, .xLarge: 1.12,
    .xxLarge: 1.24, .xxxLarge: 1.35, .accessibility1: 1.6, .accessibility2: 1.9,
    .accessibility3: 2.3, .accessibility4: 2.7, .accessibility5: 3.1,
]

func pointSize(_ style: TextStyle, at size: DynamicTypeSize) -> Double {
    return 17
}

func clamped(_ size: DynamicTypeSize, upTo limit: DynamicTypeSize) -> DynamicTypeSize {
    return size
}

func isAccessibilitySize(_ size: DynamicTypeSize) -> Bool {
    return false
}
```

```swift test
/// the default category is the scale as designed
func testDefaultSize() {
    expect(pointSize(.body, at: .large), 17)
    expect(pointSize(.largeTitle, at: .large), 34)
    expect(pointSize(.caption, at: .large), 12)
}

/// bigger categories scale and round to a whole point
func testScaled() {
    expect(pointSize(.body, at: .accessibility1), 27)
    expect(pointSize(.largeTitle, at: .accessibility5), 105)
    expect(pointSize(.subheadline, at: .medium), 14)
    expect(pointSize(.body, at: .xxLarge), 21)
}

/// nothing is ever smaller than eleven points
func testFloor() {
    expect(pointSize(.caption, at: .xSmall), 11)
    expect(pointSize(.footnote, at: .xSmall), 11)
    expect(pointSize(.caption, at: .small), 11)
}

/// text never shrinks as the category grows
func testMonotonic() {
    let sizes: [DynamicTypeSize] = [.xSmall, .small, .medium, .large, .xLarge, .xxLarge, .xxxLarge,
                                    .accessibility1, .accessibility2, .accessibility3, .accessibility4, .accessibility5]
    let rendered = sizes.map { pointSize(.body, at: $0) }
    expect(zip(rendered, rendered.dropFirst()).allSatisfy { $0 <= $1 }, "sizes must never go down")
    expect(rendered[0], 14)
    expect(rendered[rendered.count - 1], 53)
}

/// clamping caps a category and leaves smaller ones alone
func testClamped() {
    expect(clamped(.accessibility5, upTo: .xxLarge), .xxLarge)
    expect(clamped(.small, upTo: .xxLarge), .small)
    expect(clamped(.xxLarge, upTo: .xxLarge), .xxLarge)
    expect(clamped(.large, upTo: .xSmall), .xSmall)
}

/// the accessibility sizes are the ones that change the layout
func testAccessibilitySizes() {
    expect(isAccessibilitySize(.large), false)
    expect(isAccessibilitySize(.xxxLarge), false)
    expect(isAccessibilitySize(.accessibility1), true)
    expect(isAccessibilitySize(.accessibility5), true)
}
```

#### Uses
- [Design system › The type scale](#/styling/the-type-scale)
- [Design system › Dynamic Type](#/styling/dynamic-type)
- [Reference › Collections](#/reference/collections)

#### Hints
- `basePointSize[style]` is an optional. `?? 17` gives you a sensible default and keeps the expression one line.
- `Double.rounded()` rounds to the nearest whole number, halves away from zero.
- `max(11, …)` is the floor, and it goes outside the rounding, not inside.
- `DynamicTypeSize` has an `Int` raw value, so `clamped` is a comparison of `rawValue`s and `isAccessibilitySize` is one too.

#### Tips
- `testFloor` is the case that matters on a real device. A caption at the smallest category computes to under ten points, and shipping that is how you get a one-star review that just says "can't read it".
- `testMonotonic` states an invariant rather than a value, which is the right shape for a scale: whatever the numbers, the ordering must hold. That style of test survives a designer changing the factors.
- Capping with `clamped` is a real tool and a small betrayal — the user asked for that size. Cap a badge or a tab bar label; never cap the content.

#### Docs
- [Dynamic Type](https://developer.apple.com/documentation/swiftui/dynamictypesize)
- [Applying custom fonts to text](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text)

### 2. Can anyone read that?

Implement the WCAG contrast calculation, and the check every colour pairing in a design system should have to pass.

For each channel, given a value from 0 to 1: if it is at most 0.03928, divide by 12.92; otherwise raise `(c + 0.055) / 1.055` to the power 2.4. The relative luminance is `0.2126 * r + 0.7152 * g + 0.0722 * b` of those results.

The contrast ratio of two colours is `(lighter + 0.05) / (darker + 0.05)`, so it runs from 1 to 21 and does not care which colour you pass first.

`passesAA(_:_:isLargeText:)` is true at 4.5 or above for ordinary text, and at 3.0 or above for large text — 18 points and up, or 14 and bold.

```swift starter
struct RGB {
    let red: Double
    let green: Double
    let blue: Double
}

func luminance(_ colour: RGB) -> Double {
    return 0
}

func contrastRatio(_ a: RGB, _ b: RGB) -> Double {
    return 1
}

func passesAA(_ foreground: RGB, _ background: RGB, isLargeText: Bool) -> Bool {
    return true
}
```

```swift test
let white = RGB(red: 1, green: 1, blue: 1)
let black = RGB(red: 0, green: 0, blue: 0)
let midGrey = RGB(red: 0.5, green: 0.5, blue: 0.5)
let darkGrey = RGB(red: 0.3, green: 0.3, blue: 0.3)
let systemBlue = RGB(red: 0, green: 0.478, blue: 1)

func near(_ got: Double, _ want: Double, _ tolerance: Double = 0.01) -> Bool {
    abs(got - want) < tolerance
}

/// the ends of the scale
func testExtremes() {
    expect(near(contrastRatio(white, black), 21), "white on black is 21:1")
    expect(near(contrastRatio(white, white), 1), "a colour on itself is 1:1")
    expect(near(contrastRatio(midGrey, midGrey), 1), "a colour on itself is 1:1")
}

/// luminance is not brightness: green counts for far more than blue
func testLuminanceWeights() {
    expect(near(luminance(white), 1), "white is 1")
    expect(near(luminance(black), 0), "black is 0")
    expect(near(luminance(midGrey), 0.214), "mid grey is much darker than half")
    let green = RGB(red: 0, green: 1, blue: 0)
    let blue = RGB(red: 0, green: 0, blue: 1)
    expect(luminance(green) > luminance(blue) * 9, "green outweighs blue by nearly ten to one")
}

/// the order of the arguments does not matter
func testSymmetry() {
    expect(near(contrastRatio(midGrey, white), contrastRatio(white, midGrey)), "symmetric")
    expect(near(contrastRatio(systemBlue, black), contrastRatio(black, systemBlue)), "symmetric")
}

/// the real numbers, for colours you will actually ship
func testKnownPairs() {
    expect(near(contrastRatio(midGrey, white), 3.98), "mid grey on white is about 3.98")
    expect(near(contrastRatio(darkGrey, white), 8.52), "dark grey on white is about 8.52")
    expect(near(contrastRatio(systemBlue, white), 4.02), "system blue on white is about 4.02")
    expect(near(contrastRatio(midGrey, black), 5.28), "mid grey on black is about 5.28")
}

/// AA has two thresholds, and plenty of colours sit between them
func testPassesAA() {
    expect(passesAA(black, white, isLargeText: false), true)
    expect(passesAA(darkGrey, white, isLargeText: false), true)
    expect(passesAA(systemBlue, white, isLargeText: false), false)
    expect(passesAA(systemBlue, white, isLargeText: true), true)
    expect(passesAA(midGrey, white, isLargeText: false), false)
    expect(passesAA(midGrey, white, isLargeText: true), true)
    expect(passesAA(white, white, isLargeText: true), false)
}
```

#### Uses
- [Design system › Contrast](#/styling/contrast)
- [Design system › Semantic colour](#/styling/semantic-colour)

#### Hints
- Write the per-channel step as a nested `func channel(_ c: Double) -> Double` inside `luminance`; it is used three times.
- `pow(x, 2.4)` comes from Foundation, which is already imported for you here.
- For the ratio, sort the two luminances rather than assuming an order: `max` and `min` of the pair.
- `passesAA` is one comparison against `isLargeText ? 3 : 4.5`.

#### Tips
- `testLuminanceWeights` is the part worth internalising. Mid grey has a luminance of 0.21, not 0.5, because the channel transfer is not linear — which is why "just darken it a bit" so rarely fixes a contrast failure.
- System blue at 4.02 on white is a genuine Apple decision, not an oversight: it is a control colour and a large-text colour. Copying it for body text is the mistake.
- AA is the floor, not the goal. AAA is 7.0, and your secondary text is the thing to check first — it is the text most likely to be grey and least likely to have been measured.

#### Docs
- [Color and effects](https://developer.apple.com/design/human-interface-guidelines/color)
- [Accessibility: Color and effects](https://developer.apple.com/design/human-interface-guidelines/accessibility#Color-and-effects)

### 3. Resolve a colour token

A design system's colour layer is a small dictionary: some tokens hold a pair of values, one per scheme, and some are aliases for other tokens. Resolve one.

`resolve(_:in:tokens:)` returns the hex string for a token in a given scheme.

- A `.pair` holds the light and dark values; return the one for the scheme.
- An `.alias` names another token; follow it, and keep following — chains are allowed.
- A token that is not in the dictionary has no value: return `nil`.
- A chain that comes back to a token it has already visited is a mistake in the design system, not a colour: return `nil` rather than looping.

```swift starter
enum Scheme {
    case light, dark
}

enum Token: Equatable {
    case pair(light: String, dark: String)
    case alias(String)
}

func resolve(_ name: String, in scheme: Scheme, tokens: [String: Token]) -> String? {
    return nil
}
```

```swift test
let tokens: [String: Token] = [
    "grey900": .pair(light: "#111111", dark: "#F2F2F7"),
    "blue500": .pair(light: "#007AFF", dark: "#0A84FF"),
    "textPrimary": .alias("grey900"),
    "linkColor": .alias("blue500"),
    "buttonLabel": .alias("linkColor"),
    "pressedLabel": .alias("buttonLabel"),
    "broken": .alias("doesNotExist"),
    "selfish": .alias("selfish"),
    "ping": .alias("pong"),
    "pong": .alias("ping"),
]

/// a pair answers with the value for the scheme
func testPair() {
    expect(resolve("grey900", in: .light, tokens: tokens), "#111111")
    expect(resolve("grey900", in: .dark, tokens: tokens), "#F2F2F7")
    expect(resolve("blue500", in: .dark, tokens: tokens), "#0A84FF")
}

/// an alias resolves to whatever it points at
func testAlias() {
    expect(resolve("textPrimary", in: .light, tokens: tokens), "#111111")
    expect(resolve("textPrimary", in: .dark, tokens: tokens), "#F2F2F7")
    expect(resolve("linkColor", in: .light, tokens: tokens), "#007AFF")
}

/// aliases chain as deep as they like
func testChain() {
    expect(resolve("buttonLabel", in: .light, tokens: tokens), "#007AFF")
    expect(resolve("pressedLabel", in: .dark, tokens: tokens), "#0A84FF")
}

/// a token nobody defined has no colour
func testMissing() {
    expect(resolve("nope", in: .light, tokens: tokens), nil)
    expect(resolve("broken", in: .light, tokens: tokens), nil)
    expect(resolve("", in: .dark, tokens: tokens), nil)
    expect(resolve("grey900", in: .light, tokens: [:]), nil)
}

/// a cycle is a bug in the tokens, not a colour
func testCycle() {
    expect(resolve("selfish", in: .light, tokens: tokens), nil)
    expect(resolve("ping", in: .light, tokens: tokens), nil)
    expect(resolve("pong", in: .dark, tokens: tokens), nil)
}
```

#### Uses
- [Design system › Semantic colour](#/styling/semantic-colour)
- [Design system › Dark mode is not a second stylesheet](#/styling/dark-mode-is-not-a-second-stylesheet)
- [Design system › Spacing and shape tokens](#/styling/spacing-and-shape-tokens)
- [Reference › Collections](#/reference/collections)

#### Hints
- A `while` loop beats recursion here: keep a `current` name and a `Set<String>` of names already seen.
- Insert into the set before following an alias; if the insert finds the name already there, you are in a cycle.
- `Set.insert` returns `(inserted: Bool, memberAfterInsert: Element)`, so `guard seen.insert(current).inserted else { return nil }` is the whole check.
- `guard let token = tokens[current] else { return nil }` handles both the unknown token and the alias that points at one.

#### Tips
- Cycles are not hypothetical. The moment a design system has aliases, somebody points `buttonLabel` at `linkColor` and then points `linkColor` at `buttonLabel`, and without this guard the app hangs rather than showing a wrong colour.
- In a real app this resolution happens once, at build time or at launch, not per view. The asset catalog does exactly this for you, which is the argument for putting colours there rather than in a dictionary.
- Notice the alias names: `textPrimary` says what it is *for*, `grey900` says what it *is*. A system with both layers can restyle by editing one row.

#### Docs
- [Color](https://developer.apple.com/documentation/swiftui/color)
- [Asset management](https://developer.apple.com/documentation/xcode/asset-management)

### 4. Tokens and a card style

Build the layer of your own that sits on top of Apple's: named spacing, named colours, and one reusable `ViewModifier` with a matching `View` extension.

#### Build it
- A `Space` enum of static `CGFloat`s — `xs`, `s`, `m`, `l` — with no case list, so nobody can instantiate it.
- Two colours in the asset catalog, each with an Any and a Dark appearance, exposed as `static let`s in a `Color` extension.
- A `CardStyle: ViewModifier` applying padding, the card background, a rounded shape and a hairline border.
- A `func cardStyle(padding:)` extension on `View`, so the call site reads like any other modifier.
- Two different views using `.cardStyle()` with no raw numbers or colours of their own.

```swift solution
// Tokens.swift
enum Space {
    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 16
    static let l: CGFloat = 24
}

enum Radius {
    static let card: CGFloat = 16
    static let control: CGFloat = 10
}

extension Color {
    // Both defined in Assets.xcassets with an Any and a Dark appearance,
    // so nothing in the code ever asks which scheme it is.
    static let cardBackground = Color("CardBackground")
    static let brand = Color("Brand")
}

// CardStyle.swift
struct CardStyle: ViewModifier {
    var padding: CGFloat = Space.m

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.cardBackground, in: RoundedRectangle(cornerRadius: Radius.card))
            .overlay {
                RoundedRectangle(cornerRadius: Radius.card)
                    .strokeBorder(.quaternary, lineWidth: 1)
            }
    }
}

extension View {
    func cardStyle(padding: CGFloat = Space.m) -> some View {
        modifier(CardStyle(padding: padding))
    }
}

// Usage.swift
struct TotalCard: View {
    let total: String

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text("Total")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(total)
                .font(.largeTitle.weight(.semibold))
        }
        .cardStyle()
    }
}

struct NoteCard: View {
    let note: String

    var body: some View {
        Label(note, systemImage: "info.circle")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .cardStyle(padding: Space.s)
    }
}

#Preview {
    VStack(spacing: Space.m) {
        TotalCard(total: "£248.50")
        NoteCard(note: "Prices include VAT")
    }
    .padding(Space.m)
    .background(Color(.systemGroupedBackground))
}
```

#### Uses
- [Design system › Writing a `ViewModifier`](#/styling/writing-a-viewmodifier)
- [Design system › Spacing and shape tokens](#/styling/spacing-and-shape-tokens)
- [Design system › Semantic colour](#/styling/semantic-colour)
- [Views & modifiers › Modifiers return new views](#/swiftui-basics/modifiers-return-new-views)
- [Reference › SwiftUI views and layout](#/reference/swiftui-views-and-layout)
- [Reference › SwiftUI styling and type](#/reference/swiftui-styling-and-type)

#### Hints
- An `enum` with no cases is the idiomatic namespace in Swift: it cannot be instantiated, so `Space()` is a compiler error.
- `modifier(CardStyle(padding: padding))` is what the extension wraps; `ViewModifier` gives you `Content` as the type of whatever it is applied to.
- `.strokeBorder` draws inside the shape's edge, so a 1-point border does not overflow the card. `.stroke` straddles it.
- Add a colour set in Assets.xcassets, then set Appearances to "Any, Dark" in the inspector and fill in both wells.

#### Tips
- The `View` extension is the point. Without it, every call site reads `.modifier(CardStyle())`, which is noisier than the four modifiers it replaced, and the style never gets used.
- Defaulting the parameter — `cardStyle(padding: Space.s)` — keeps the common case to zero arguments while leaving an escape hatch. A style with six parameters is a style that has stopped being one.
- A `ViewModifier` can hold `@Environment` and `@State`. That is the real reason to prefer it to a free function: a card that dims when the scheme changes, or animates when pressed, has somewhere to keep that.

#### Docs
- [ViewModifier](https://developer.apple.com/documentation/swiftui/viewmodifier)
- [Reducing view modifier maintenance](https://developer.apple.com/documentation/swiftui/reducing-view-modifier-maintenance)

### 5. A card that survives the largest text

Take the card from the previous exercise and make it hold up where design systems usually fail: dark mode, the largest accessibility text size, and an icon that scales with the type.

#### Build it
- A `PriceCard` with an SF Symbol, a title, a note and a price, using only tokens and text styles.
- `ViewThatFits(in: .horizontal)` with a horizontal layout first and a vertical fallback, so the card reflows instead of truncating.
- `@ScaledMetric(relativeTo: .title)` for the icon's size, so it grows with the text rather than becoming a speck.
- No fixed heights anywhere; `.frame(minHeight:)` if a minimum is needed at all.
- Four previews: light, dark, `.accessibility5`, and dark at `.accessibility5`.

```swift solution
// PriceCard.swift
struct PriceCard: View {
    let symbol: String
    let title: String
    let note: String
    let price: String

    // Grows with the user's text size instead of staying 28 points forever.
    @ScaledMetric(relativeTo: .title) private var iconSize: CGFloat = 28

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: Space.m) {
                icon
                details
                Spacer(minLength: Space.s)
                priceLabel
            }
            VStack(alignment: .leading, spacing: Space.s) {
                HStack(alignment: .firstTextBaseline, spacing: Space.s) {
                    icon
                    details
                }
                priceLabel
            }
        }
        .cardStyle()
    }

    private var icon: some View {
        Image(systemName: symbol)
            .font(.system(size: iconSize))
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(Color.brand)
            .accessibilityHidden(true)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(title)
                .font(.headline)
            Text(note)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var priceLabel: some View {
        Text(price)
            .font(.title3.weight(.semibold))
            .monospacedDigit()
    }
}

#Preview("Light") {
    PriceCard(symbol: "cart.fill", title: "Weekly shop", note: "Delivered Friday", price: "£48.20")
        .padding(Space.m)
}

#Preview("Dark") {
    PriceCard(symbol: "cart.fill", title: "Weekly shop", note: "Delivered Friday", price: "£48.20")
        .padding(Space.m)
        .preferredColorScheme(.dark)
}

#Preview("Largest text") {
    PriceCard(symbol: "cart.fill", title: "Weekly shop", note: "Delivered Friday", price: "£48.20")
        .padding(Space.m)
        .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Dark, largest text") {
    PriceCard(symbol: "cart.fill", title: "Weekly shop", note: "Delivered Friday", price: "£48.20")
        .padding(Space.m)
        .preferredColorScheme(.dark)
        .environment(\.dynamicTypeSize, .accessibility5)
}
```

#### Uses
- [Design system › Dynamic Type](#/styling/dynamic-type)
- [Design system › SF Symbols](#/styling/sf-symbols)
- [Design system › Dark mode is not a second stylesheet](#/styling/dark-mode-is-not-a-second-stylesheet)
- [Stacks & layout › Alignment](#/layout/alignment)

#### Hints
- `ViewThatFits` takes the candidates in order of preference and renders the first that fits in the axis you named.
- `@ScaledMetric(relativeTo: .title) private var iconSize: CGFloat = 28` declares 28 as the size *at the default category*; the property is already scaled when you read it.
- Extract `icon`, `details` and `priceLabel` into computed properties so the two layouts share them instead of repeating them.
- To check the vertical fallback in a preview without an accessibility size, narrow the frame instead: `.frame(width: 200)`.

#### Tips
- `.symbolRenderingMode(.hierarchical)` gets you depth from a single colour, which is exactly what a semantic token gives you. Multicolour symbols are lovely and are the thing that stops matching a rebrand.
- `@ScaledMetric` is the fix for every "the icon is tiny at accessibility sizes" bug, and it is one line. There is no good reason to ship a fixed 28.
- The fourth preview — dark *and* largest — is where real bugs live, because the two failures compound: a layout that reflows fine in light mode can put white-on-brand text at a contrast that only shows up in the dark variant.

#### Docs
- [ViewThatFits](https://developer.apple.com/documentation/swiftui/viewthatfits)
- [ScaledMetric](https://developer.apple.com/documentation/swiftui/scaledmetric)
- [SF Symbols](https://developer.apple.com/documentation/symbols)
