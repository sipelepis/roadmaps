# Accessibility

Accessibility is not a feature bolted on at the end; it is the difference between an app a person can use and one they cannot. On iOS most of it is free — a `Button` is already a button to VoiceOver, a `TextField` already announces itself — and the work is in the places where you drew something custom, wrote a label only a sighted user could infer, or assumed the text would stay the size you chose. This module is about those places, and much of the decision-making turns out to be arithmetic you can test.

## VoiceOver and the accessibility tree

VoiceOver reads a tree that sits beside your view hierarchy. Each **element** in it has a label, optionally a value, a set of traits, and sometimes a hint. Swiping moves between elements; double-tapping activates one.

Standard controls fill this in themselves. `Button("Save")` becomes an element labelled "Save" with the button trait. The tree goes wrong when you build a control out of pieces — a tappable `HStack` of an icon and two `Text`s becomes three separate elements, none of which is a button, and none of which reads as the thing you drew.

Turn VoiceOver on for ten minutes (Settings → Accessibility → VoiceOver, or triple-click the side button once you have set the shortcut) and swipe through your own app with the screen off. Nothing else finds these problems as fast.

## Labels, values and traits

Four pieces, and they answer four different questions:

```swift
Image(systemName: "heart.fill")
    .accessibilityLabel("Favourite")            // what is it
    .accessibilityValue(isFavourite ? "On" : "Off")  // what is it set to
    .accessibilityAddTraits(.isButton)          // how does it behave
    .accessibilityHint("Adds this track to your favourites")  // what happens if I use it
```

A **label** names the thing, in words a person would say, without the control's kind in it — VoiceOver already says "button". "Favourite", not "Favourite button", not "heart icon".

A **value** is the part that changes. A slider's number, a toggle's state, a row's "Playing". Keeping it out of the label means VoiceOver can reannounce just the value when it changes instead of the whole row.

**Traits** say how the element behaves: `.isButton`, `.isHeader`, `.isSelected`, `.updatesFrequently`. `.isHeader` in particular is what makes rotor navigation by heading work.

A **hint** is optional and usually unnecessary. Add one when what happens next is genuinely not obvious from the label.

A decorative image should be removed from the tree entirely with `.accessibilityHidden(true)`, not given a label describing the picture.

## Grouping and merging

A row of five `Text`s is five swipes. Almost always it should be one:

```swift
HStack { icon; title; subtitle; duration }
    .accessibilityElement(children: .combine)
```

`.combine` merges the children's labels into one element and keeps their actions. `.ignore` throws the children away and expects you to supply the label yourself, which is what you want when the pieces do not read well in order — an icon, a truncated title and "3:05" become "Blue Pens, by Ada, 3 minutes 5 seconds" only if you write that sentence.

Writing it is a pure function from your model to a string, which is why it is the first exercise. `.contain` is the third option, for a container that should group its children without flattening them.

When one element has more than one thing you can do, `.accessibilityAction(named:)` adds it to the rotor rather than making the user find a tiny second button.

## Dynamic Type

Users set the text size, system-wide, and a great many of them set it large. Text styles scale with it automatically:

```swift
Text("Blue Pens").font(.body)          // scales
Text("Blue Pens").font(.system(size: 17))   // does not
```

So use the styles — `.body`, `.headline`, `.caption` — and reach for `.system(size:)` only with `@ScaledMetric`, which scales a number of your own:

```swift
@ScaledMetric private var iconSize = 24
```

At the five **accessibility sizes** the text roughly doubles or triples, and a layout that was fine at `.large` falls apart. The two moves that fix most of it are swapping a horizontal stack for a vertical one, and letting text wrap instead of truncating:

```swift
@Environment(\.dynamicTypeSize) private var typeSize

if typeSize.isAccessibilitySize { VStack { ... } } else { HStack { ... } }
```

Never cap the scaling to keep a design intact. `.minimumScaleFactor(0.5)` on a label that a user set to triple size is a way of saying you would rather it looked right than be readable. The arithmetic behind all of this — a multiplier per size, a sensible ceiling, when to change the axis — is the second exercise.

## Reduce motion and the other settings

The system settings you should read are in the environment:

```swift
@Environment(\.accessibilityReduceMotion) private var reduceMotion
@Environment(\.accessibilityReduceTransparency) private var reduceTransparency
@Environment(\.accessibilityDifferentiateWithoutColor) private var differentiateWithoutColor
@Environment(\.colorSchemeContrast) private var contrast
```

Reduce Motion is the one to honour first, because motion makes some people genuinely ill. Honouring it does not mean removing the change — it means crossing between the states instead of flying, sliding or bouncing:

```swift
withAnimation(reduceMotion ? nil : .bouncy) { isExpanded.toggle() }
```

Differentiate Without Color is a reminder of a rule that applies whether the setting is on or not: colour must never be the only way something is said. A red border with no icon and no text is invisible to a large number of users, and that is the same bug as an unlabelled icon.

## Contrast

Text has to stand out from what is behind it. WCAG puts a number on it: the **contrast ratio** between two colours, from 1 (identical) to 21 (black on white). The AA threshold is **4.5** for normal text and **3.0** for large text — 18pt and up, or 14pt bold.

The ratio is computed from each colour's *relative luminance*, which is not its brightness: each channel is linearised with a small curve and then weighted, green counting for far more than blue. That means two colours can look similarly dark and have quite different luminance, and eyeballing it does not work. Computing it does, and it is the third exercise.

The system colours are chosen to pass. Your brand colours very often do not, especially a mid-grey on white and a saturated blue or red on white — both of which land just under 4.5.

## The Accessibility Inspector

Xcode ships an inspector (Xcode → Open Developer Tool → Accessibility Inspector) that points at the simulator and shows you the element under the cursor: its label, value, traits and frame. Its audit tab sweeps a screen for the common faults — unlabelled elements, contrast below the threshold, hit targets under 44×44 points, text that will clip at large sizes — and it takes about a minute per screen.

In SwiftUI previews, the Dynamic Type and colour-scheme variants show a screen at every text size at once, which catches the layout half before the simulator is even involved.

```swift playground
import Foundation

struct Track {
    let title: String
    let artist: String
    let seconds: Int
    let isExplicit: Bool
    let isDownloaded: Bool
}

func plural(_ n: Int, _ word: String) -> String {
    "\(n) \(word)\(n == 1 ? "" : "s")"
}

func spokenDuration(_ seconds: Int) -> String {
    let total = max(0, seconds)
    let (minutes, rest) = (total / 60, total % 60)
    if minutes == 0 { return plural(rest, "second") }
    if rest == 0 { return plural(minutes, "minute") }
    return "\(plural(minutes, "minute")) \(plural(rest, "second"))"
}

func label(for track: Track) -> String {
    var parts = [track.title.isEmpty ? "Untitled" : track.title]
    if !track.artist.isEmpty { parts.append("by \(track.artist)") }
    if track.isExplicit { parts.append("explicit") }
    parts.append(spokenDuration(track.seconds))
    if track.isDownloaded { parts.append("downloaded") }
    return parts.joined(separator: ", ")
}

let tracks = [
    Track(title: "Blue Pens", artist: "Ada", seconds: 185, isExplicit: true, isDownloaded: true),
    Track(title: "One", artist: "Grace", seconds: 61, isExplicit: false, isDownloaded: false),
    Track(title: "Sketch", artist: "", seconds: 45, isExplicit: false, isDownloaded: false),
]
for track in tracks { print("“\(label(for: track))”") }

// Contrast is arithmetic, not an opinion. Two greys one hex digit apart land either side of AA.
struct RGB {
    let red: Double, green: Double, blue: Double

    init(_ hex: Int) {
        red = Double((hex >> 16) & 0xFF) / 255
        green = Double((hex >> 8) & 0xFF) / 255
        blue = Double(hex & 0xFF) / 255
    }
}

func luminance(_ c: RGB) -> Double {
    func channel(_ v: Double) -> Double {
        v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(c.red) + 0.7152 * channel(c.green) + 0.0722 * channel(c.blue)
}

func ratio(_ a: RGB, _ b: RGB) -> Double {
    let (la, lb) = (luminance(a), luminance(b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

func hexLabel(_ hex: Int) -> String {
    let digits = String(hex, radix: 16, uppercase: true)
    return "#" + String(repeating: "0", count: max(0, 6 - digits.count)) + digits
}

let white = RGB(0xFFFFFF)
for hex in [0x000000, 0x767676, 0x777777, 0x007AFF, 0xAAAAAA] {
    let value = (ratio(RGB(hex), white) * 100).rounded() / 100
    let verdict = value >= 4.5 ? "passes AA" : (value >= 3 ? "large text only" : "fails")
    print("\(hexLabel(hex)) on white: \(value):1 — \(verdict)")
}
```

## Exercises

### 1. The sentence VoiceOver reads

A track row draws an icon, a title, an artist, a badge and a duration. Read out in order, those pieces are noise. Write the sentence instead.

`spokenDuration(_:)` turns a number of seconds into words: `"3 minutes 5 seconds"`, `"1 minute 1 second"`, `"45 seconds"`, `"2 minutes"` when the seconds are zero, and `"0 seconds"` for nothing at all. Anything negative reads as `"0 seconds"`.

`label(for:)` joins the parts with `", "`, in this order:

1. the title, trimmed of whitespace — `"Untitled"` if there is nothing left,
2. `"by <artist>"`, trimmed, and left out entirely when the artist is blank,
3. `"explicit"`, when the track is,
4. the spoken duration, always,
5. `"downloaded"`, when it is.

```swift starter
struct Track {
    let title: String
    let artist: String
    let seconds: Int
    let isExplicit: Bool
    let isDownloaded: Bool
}

func spokenDuration(_ seconds: Int) -> String {
    return "\(seconds) seconds"
}

func label(for track: Track) -> String {
    return track.title
}
```

```swift test
/// minutes and seconds, in words, with the plurals right
func testDuration() {
    expect(spokenDuration(0), "0 seconds")
    expect(spokenDuration(1), "1 second")
    expect(spokenDuration(45), "45 seconds")
    expect(spokenDuration(60), "1 minute")
    expect(spokenDuration(61), "1 minute 1 second")
    expect(spokenDuration(120), "2 minutes")
    expect(spokenDuration(125), "2 minutes 5 seconds")
    expect(spokenDuration(185), "3 minutes 5 seconds")
    expect(spokenDuration(3600), "60 minutes")
}

/// nothing sensible to say about a negative length
func testNegativeDuration() {
    expect(spokenDuration(-1), "0 seconds")
    expect(spokenDuration(-500), "0 seconds")
}

/// the whole row as one sentence
func testFullLabel() {
    let track = Track(title: "Blue Pens", artist: "Ada", seconds: 185, isExplicit: true, isDownloaded: true)
    expect(label(for: track), "Blue Pens, by Ada, explicit, 3 minutes 5 seconds, downloaded")
}

/// the plain case, and the badges each on their own
func testOptionalParts() {
    let plain = Track(title: "One", artist: "Grace", seconds: 61, isExplicit: false, isDownloaded: false)
    expect(label(for: plain), "One, by Grace, 1 minute 1 second")

    let explicit = Track(title: "Two", artist: "Grace", seconds: 60, isExplicit: true, isDownloaded: false)
    expect(label(for: explicit), "Two, by Grace, explicit, 1 minute")

    let downloaded = Track(title: "Three", artist: "Grace", seconds: 30, isExplicit: false, isDownloaded: true)
    expect(label(for: downloaded), "Three, by Grace, 30 seconds, downloaded")
}

/// missing pieces do not leave gaps in the sentence
func testMissingPieces() {
    let noArtist = Track(title: "Sketch", artist: "   ", seconds: 45, isExplicit: false, isDownloaded: false)
    expect(label(for: noArtist), "Sketch, 45 seconds")

    let noTitle = Track(title: "  ", artist: "Ada", seconds: 45, isExplicit: false, isDownloaded: false)
    expect(label(for: noTitle), "Untitled, by Ada, 45 seconds")

    let padded = Track(title: "  Spaced  ", artist: "  Ada  ", seconds: 60, isExplicit: false, isDownloaded: false)
    expect(label(for: padded), "Spaced, by Ada, 1 minute")

    let nothing = Track(title: "", artist: "", seconds: 0, isExplicit: false, isDownloaded: false)
    expect(label(for: nothing), "Untitled, 0 seconds")
}
```

#### Uses
- [Accessibility › Labels, values and traits](#/accessibility/labels-values-and-traits)
- [Accessibility › Grouping and merging](#/accessibility/grouping-and-merging)

#### Hints
- A small `func plural(_ n: Int, _ word: String) -> String` returning `"\(n) \(word)\(n == 1 ? "" : "s")"` is used four times between the two functions.
- `spokenDuration` is `(total / 60, total % 60)` after `max(0, seconds)`, then three cases: no minutes, no leftover seconds, and both.
- Build the label as `var parts: [String]`, appending only the pieces that apply, and finish with `parts.joined(separator: ", ")`. That is why there are never two commas in a row.
- `trimmingCharacters(in: .whitespaces)` on the title and the artist, then `isEmpty` to decide.

#### Tips
- `", "` between the parts is not cosmetic. VoiceOver pauses at a comma, so the commas are what stop the sentence running together into one unreadable word.
- Say "3 minutes 5 seconds", not "3:05". VoiceOver reads a colon as a colon, and a duration as a time of day; this is the most common unreadable label in a media app.
- The label is a pure function of the model, so it can be checked here in milliseconds — and the same function can feed a search index or a share sheet. A label built inline in a view can do none of that.

#### Docs
- [accessibilityLabel(_:)](https://developer.apple.com/documentation/swiftui/view/accessibilitylabel(_:)-1d7jv)
- [accessibilityElement(children:)](https://developer.apple.com/documentation/swiftui/view/accessibilityelement(children:))

### 2. Layout that survives the largest text

Write the arithmetic behind Dynamic Type.

- `multiplier` scales relative to `.large`, which is the default and is `1.0`. Each step from `.xSmall` to `.xxxLarge` is `0.1`, so `.xSmall` is `0.7` and `.xxxLarge` is `1.3`. The accessibility sizes are a bigger jump: `.accessibility1` is `1.6` and each one after adds `0.4`, up to `3.2` at `.accessibility5`. Round it to two decimal places, or binary floating point will hand you `2.4000000000000004`.
- `isAccessibilitySize` is true from `.accessibility1` up.
- `scaled(_:for:maximum:)` is the point size times the multiplier, rounded to two decimal places, and capped at `maximum` when one is given.
- `stacksVertically(_:)` says whether a row should become a column: yes at the accessibility sizes.
- `lineLimit(for:)` is `2` normally and `nil` — no limit — at the accessibility sizes, because truncating tripled text leaves almost nothing.

```swift starter
enum TypeSize: Int, CaseIterable, Comparable {
    case xSmall = 0, small, medium, large, xLarge, xxLarge, xxxLarge
    case accessibility1, accessibility2, accessibility3, accessibility4, accessibility5

    static func < (a: TypeSize, b: TypeSize) -> Bool { a.rawValue < b.rawValue }

    var isAccessibilitySize: Bool {
        return false
    }

    var multiplier: Double {
        return 1
    }
}

func scaled(_ points: Double, for size: TypeSize, maximum: Double? = nil) -> Double {
    return points
}

func stacksVertically(_ size: TypeSize) -> Bool {
    return false
}

func lineLimit(for size: TypeSize) -> Int? {
    return 2
}
```

```swift test
/// the ordinary sizes step by a tenth around 1.0
func testMultipliers() {
    expect(TypeSize.large.multiplier, 1.0)
    expect(TypeSize.xSmall.multiplier, 0.7)
    expect(TypeSize.small.multiplier, 0.8)
    expect(TypeSize.medium.multiplier, 0.9)
    expect(TypeSize.xLarge.multiplier, 1.1)
    expect(TypeSize.xxxLarge.multiplier, 1.3)
}

/// the accessibility sizes are a different scale entirely
func testAccessibilityMultipliers() {
    expect(TypeSize.accessibility1.multiplier, 1.6)
    expect(TypeSize.accessibility2.multiplier, 2.0)
    expect(TypeSize.accessibility3.multiplier, 2.4)
    expect(TypeSize.accessibility4.multiplier, 2.8)
    expect(TypeSize.accessibility5.multiplier, 3.2)
    for size in TypeSize.allCases where size >= .accessibility1 {
        expect(size.isAccessibilitySize, "\(size) should count as an accessibility size")
    }
    for size in TypeSize.allCases where size <= .xxxLarge {
        expect(!size.isAccessibilitySize, "\(size) should not count as an accessibility size")
    }
}

/// scaling a point size, with and without a ceiling
func testScaled() {
    expect(scaled(17, for: .large), 17.0)
    expect(scaled(17, for: .xSmall), 11.9)
    expect(scaled(20, for: .xxxLarge), 26.0)
    expect(scaled(17, for: .accessibility1), 27.2)
    expect(scaled(10, for: .accessibility5), 32.0)
}

/// a ceiling caps the result and nothing else
func testCeiling() {
    expect(scaled(17, for: .accessibility5, maximum: 40), 40.0)
    expect(scaled(17, for: .accessibility1, maximum: 40), 27.2)
    expect(scaled(17, for: .large, maximum: 40), 17.0)
    expect(scaled(17, for: .large, maximum: 10), 10.0)
}

/// what the layout does about it
func testLayoutDecisions() {
    expect(stacksVertically(.large), false)
    expect(stacksVertically(.xxxLarge), false)
    expect(stacksVertically(.accessibility1), true)
    expect(stacksVertically(.accessibility5), true)
    expect(lineLimit(for: .large), 2)
    expect(lineLimit(for: .xxxLarge), 2)
    expect(lineLimit(for: .accessibility1), nil)
    expect(lineLimit(for: .accessibility3), nil)
}
```

#### Uses
- [Accessibility › Dynamic Type](#/accessibility/dynamic-type)
- [Accessibility › The Accessibility Inspector](#/accessibility/the-accessibility-inspector)
- [Reference › SwiftUI accessibility](#/reference/swiftui-accessibility)

#### Hints
- `isAccessibilitySize` is `self >= .accessibility1`, which works because the enum is already `Comparable`.
- For the ordinary sizes the multiplier is `1.0 + 0.1 * Double(rawValue - TypeSize.large.rawValue)`; for the accessibility ones it is `1.6 + 0.4 * Double(rawValue - TypeSize.accessibility1.rawValue)`.
- Round both `multiplier` and `scaled` with `(value * 100).rounded() / 100` — floating point makes `1.6 + 0.4 + 0.4` untidy, and the rounding is what lets the tests compare exactly.
- The ceiling is `min(value, maximum)`, but only when `maximum` is there: `maximum.map { min(value, $0) } ?? value`.

#### Tips
- Rounding to two places is not fussiness. `1.0 + 0.1 * -3` is `0.7000000000000001` in binary floating point, and a layout built on that number is fine while a test comparing it is not.
- A ceiling on a *decorative* size — an icon, a corner radius, the height of a chart — is reasonable. A ceiling on body text is not: the user asked for that size.
- `stacksVertically` and `lineLimit` are the two changes that fix most accessibility-size layouts. Deciding them from the size, in one place, beats scattering `if typeSize.isAccessibilitySize` through a view.

#### Docs
- [DynamicTypeSize](https://developer.apple.com/documentation/swiftui/dynamictypesize)
- [ScaledMetric](https://developer.apple.com/documentation/swiftui/scaledmetric)

### 3. Is this text readable?

Write the WCAG contrast calculation, so "is this grey light enough" stops being an argument.

- `relativeLuminance(_:)`: linearise each channel with `v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)`, then weight them `0.2126` red, `0.7152` green, `0.0722` blue, and add.
- `contrastRatio(_:_:)`: `(lighter + 0.05) / (darker + 0.05)`, where lighter and darker are the two luminances — so the answer is the same whichever way round you pass the colours, and runs from `1` to `21`.
- `passesAA(_:_:isLargeText:)`: the ratio must be at least `4.5` for normal text, or `3.0` for large text.

```swift starter
struct RGB {
    let red: Double
    let green: Double
    let blue: Double

    /// 0xRRGGBB, as you would write it in a design tool.
    init(_ hex: Int) {
        red = Double((hex >> 16) & 0xFF) / 255
        green = Double((hex >> 8) & 0xFF) / 255
        blue = Double(hex & 0xFF) / 255
    }

    static let white = RGB(0xFFFFFF)
    static let black = RGB(0x000000)
}

func relativeLuminance(_ color: RGB) -> Double {
    return 0
}

func contrastRatio(_ a: RGB, _ b: RGB) -> Double {
    return 1
}

func passesAA(_ a: RGB, _ b: RGB, isLargeText: Bool) -> Bool {
    return true
}
```

```swift test
/// the two ends of the scale
func testLuminanceEnds() {
    expect(relativeLuminance(.white), 1.0)
    expect(relativeLuminance(.black), 0.0)
    expect(abs(relativeLuminance(RGB(0xFF0000)) - 0.2126) < 1e-9, "pure red should weigh 0.2126")
    expect(abs(relativeLuminance(RGB(0x00FF00)) - 0.7152) < 1e-9, "pure green should weigh 0.7152")
    expect(abs(relativeLuminance(RGB(0x0000FF)) - 0.0722) < 1e-9, "pure blue should weigh 0.0722")
}

/// black on white is as good as it gets, and a colour on itself is as bad
func testExtremes() {
    expect(contrastRatio(.white, .black), 21.0)
    expect(contrastRatio(.black, .white), 21.0)
    expect(contrastRatio(.white, .white), 1.0)
    expect(contrastRatio(RGB(0x007AFF), RGB(0x007AFF)), 1.0)
}

/// real colours, to two decimal places
func testRealColours() {
    let cases: [(String, Int, Double)] = [
        ("#767676", 0x767676, 4.54),
        ("#777777", 0x777777, 4.48),
        ("#007AFF", 0x007AFF, 4.02),
        ("#0000FF", 0x0000FF, 8.59),
        ("#595959", 0x595959, 7.00),
    ]
    for (name, hex, expected) in cases {
        let got = contrastRatio(RGB(hex), .white)
        expect(abs(got - expected) < 0.01, "\(name) on white should be about \(expected), got \(got)")
    }
}

/// two greys one digit apart, either side of the line
func testAAThreshold() {
    expect(passesAA(RGB(0x767676), .white, isLargeText: false), true)
    expect(passesAA(RGB(0x777777), .white, isLargeText: false), false)
    expect(passesAA(RGB(0x777777), .white, isLargeText: true), true)
    expect(passesAA(.white, RGB(0x767676), isLargeText: false), true)
}

/// large text gets a lower bar, but not no bar
func testLargeText() {
    expect(passesAA(RGB(0x007AFF), .white, isLargeText: false), false)
    expect(passesAA(RGB(0x007AFF), .white, isLargeText: true), true)
    expect(passesAA(RGB(0xAAAAAA), .white, isLargeText: true), false)
    expect(passesAA(.black, .white, isLargeText: false), true)
    expect(passesAA(.white, .white, isLargeText: true), false)
}
```

#### Uses
- [Accessibility › Contrast](#/accessibility/contrast)
- [Accessibility › The Accessibility Inspector](#/accessibility/the-accessibility-inspector)

#### Hints
- A nested `func channel(_ v: Double) -> Double` applying the curve keeps `relativeLuminance` to one readable line of weighting.
- `pow` comes from Foundation, which the exercises already import.
- In `contrastRatio`, compute both luminances and use `max` and `min` rather than an `if` — that is what makes the order of the arguments stop mattering.
- `passesAA` is one comparison: `contrastRatio(a, b) >= (isLargeText ? 3.0 : 4.5)`.

#### Tips
- `#777777` failing and `#767676` passing is the whole argument for computing this. They are one hex digit apart, indistinguishable by eye, and only one of them is legible to everyone.
- Large text is 18pt, or 14pt bold — and Dynamic Type means a user can turn your "normal" text into large text. The safe move is to design to `4.5` and treat `3.0` as an allowance for genuinely display-sized type.
- Contrast applies to more than text. An icon that carries meaning, a focus ring, a chart's series colours: all of them need to be distinguishable, and the same number answers all of them.

#### Docs
- [Color and effects](https://developer.apple.com/design/human-interface-guidelines/accessibility#Color-and-effects)
- [Accessibility Inspector](https://developer.apple.com/documentation/accessibility/accessibility-inspector)

### 4. A row that reads as one thing

Build the track row the first exercise wrote the label for: one element, one sentence, the decoration hidden, and the second action on the rotor instead of a tiny button.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `TrackRow` drawing an icon, the title, an explicit badge, the artist and the duration — as a normal-looking row, with `Duration.seconds(_:).formatted(.time(pattern: .minuteSecond))` for the "3:05".
- `.accessibilityHidden(true)` on the icon and the explicit badge, since their meaning is already in the label.
- `.accessibilityElement(children: .ignore)` plus `.accessibilityLabel(label(for: track))`, so the row is a single element reading the sentence from exercise 1.
- `.accessibilityValue` carrying only the part that changes — "Playing" — rather than folding it into the label.
- `.accessibilityAddTraits(.isButton)` and, when it is the current track, `.isSelected`.
- A second action, "Add to queue", exposed with `.accessibilityAction(named:)` rather than as a separate visible button.
- A `Section` header marked `.accessibilityAddTraits(.isHeader)` so rotor navigation by heading works.
- Previews at `.large` and at `.accessibility3`.

```swift solution
// TrackRow.swift
struct TrackRow: View {
    let track: Track
    let isPlaying: Bool
    let play: () -> Void
    let addToQueue: () -> Void

    var body: some View {
        Button(action: play) {
            HStack(spacing: 12) {
                Image(systemName: isPlaying ? "waveform" : "music.note")
                    .frame(width: 28)
                    .foregroundStyle(isPlaying ? Color.accentColor : .secondary)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.title)
                        .font(.body)

                    HStack(spacing: 4) {
                        if track.isExplicit {
                            Image(systemName: "e.square.fill")
                                .font(.caption2)
                                .accessibilityHidden(true)
                        }
                        Text(track.artist)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 8)

                Text(Duration.seconds(track.seconds).formatted(.time(pattern: .minuteSecond)))
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label(for: track))
        .accessibilityValue(isPlaying ? "Playing" : "")
        .accessibilityAddTraits(isPlaying ? [.isButton, .isSelected] : .isButton)
        .accessibilityAction(named: "Add to queue", addToQueue)
    }
}

// TrackList.swift
struct TrackList: View {
    let tracks: [Track]
    @State private var playingID: String?

    var body: some View {
        List {
            Section {
                ForEach(tracks, id: \.title) { track in
                    TrackRow(
                        track: track,
                        isPlaying: track.title == playingID,
                        play: { playingID = track.title },
                        addToQueue: { }
                    )
                }
            } header: {
                Text("Recently added")
                    .accessibilityAddTraits(.isHeader)
            }
        }
    }
}

#Preview("Default size") {
    TrackList(tracks: Track.samples)
}

#Preview("Accessibility 3") {
    TrackList(tracks: Track.samples)
        .environment(\.dynamicTypeSize, .accessibility3)
}
```

#### Uses
- [Accessibility › Labels, values and traits](#/accessibility/labels-values-and-traits)
- [Accessibility › Grouping and merging](#/accessibility/grouping-and-merging)
- [Accessibility › VoiceOver and the accessibility tree](#/accessibility/voiceover-and-the-accessibility-tree)

#### Hints
- `.accessibilityElement(children: .ignore)` throws the children's own labels away, which is the point: you are replacing five fragments with one sentence.
- The order matters — `.accessibilityElement` first, then the label, value and traits that describe the element it just made.
- `.accessibilityAddTraits` takes an option set, so `[.isButton, .isSelected]` adds both at once.
- Turn VoiceOver on in the simulator (Settings → Accessibility) and swipe through the list. One swipe per row is the result you are looking for.

#### Tips
- A `Button` wrapping the whole row gives you the 44-point hit target and the button trait for free. Building the same thing from `.onTapGesture` gives you neither, and is the most common way a custom row becomes unusable.
- Keep "Playing" in the value, not the label. VoiceOver reannounces a changed value without repeating the title, so the state change is one word rather than a whole sentence.
- `.accessibilityAction(named:)` is how a row gets a second action without a second control. Swipe actions and context menus are invisible to VoiceOver unless you do this.

#### Docs
- [accessibilityAction(named:_:)](https://developer.apple.com/documentation/swiftui/view/accessibilityaction(named:_:)-9ehbf)
- [AccessibilityTraits](https://developer.apple.com/documentation/swiftui/accessibilitytraits)
- [accessibilityValue(_:)](https://developer.apple.com/documentation/swiftui/view/accessibilityvalue(_:)-7wqxk)

### 5. A screen that survives the settings

Build a card that still works at triple text size, with Reduce Motion on, with increased contrast, and without relying on colour to say anything.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A card with an icon, a title, a subtitle and a control, laid out in an `HStack` normally and a `VStack` when `dynamicTypeSize.isAccessibilitySize`.
- Text styles throughout — no `.system(size:)` — and `@ScaledMetric` for the one size that is yours, the icon.
- No `.minimumScaleFactor` anywhere, and `lineLimit(nil)` at the accessibility sizes.
- An expand/collapse animation wrapped in `withAnimation(reduceMotion ? nil : .snappy)`, so the state still changes but does not fly.
- A status that is said with an icon *and* a word, not only with a colour, and a colour chosen per `colorSchemeContrast`.
- The whole card wrapped in a `ScrollView` so tripled text can still be reached.
- Previews at `.large`, `.accessibility5`, and in dark mode.

```swift solution
// StatusCard.swift
struct StatusCard: View {
    enum Status {
        case ok, warning

        var symbol: String { self == .ok ? "checkmark.circle.fill" : "exclamationmark.triangle.fill" }
        var word: String { self == .ok ? "Up to date" : "Needs attention" }
    }

    let status: Status
    @State private var isExpanded = false

    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorSchemeContrast) private var contrast
    @ScaledMetric private var iconSize: CGFloat = 28

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if typeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 8) { icon; titles }
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 12) { icon; titles }
                }

                Button(isExpanded ? "Hide details" : "Show details") {
                    withAnimation(reduceMotion ? nil : .snappy) {
                        isExpanded.toggle()
                    }
                }

                if isExpanded {
                    Text("Your library was last checked a moment ago. Everything on this device matches the server.")
                        .font(.footnote)
                        .foregroundStyle(subtitleColour)
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 4)
                }
            }
            .padding()
        }
    }

    private var icon: some View {
        Image(systemName: status.symbol)
            .font(.system(size: iconSize))
            .foregroundStyle(status == .ok ? Color.green : Color.orange)
            .accessibilityHidden(true)
    }

    private var titles: some View {
        VStack(alignment: .leading, spacing: 4) {
            // The status is said in words as well as in colour and shape.
            Text(status.word)
                .font(.headline)
                .lineLimit(typeSize.isAccessibilitySize ? nil : 2)
            Text("Library")
                .font(.subheadline)
                .foregroundStyle(subtitleColour)
        }
        .accessibilityElement(children: .combine)
    }

    /// `.secondary` is a low-contrast grey; at increased contrast it is not good enough.
    private var subtitleColour: Color {
        contrast == .increased ? .primary : .secondary
    }
}

#Preview("Default") {
    StatusCard(status: .warning)
}

#Preview("Accessibility 5") {
    StatusCard(status: .warning)
        .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Dark") {
    StatusCard(status: .ok)
        .preferredColorScheme(.dark)
}
```

#### Uses
- [Accessibility › Dynamic Type](#/accessibility/dynamic-type)
- [Accessibility › Reduce motion and the other settings](#/accessibility/reduce-motion-and-the-other-settings)
- [Accessibility › Contrast](#/accessibility/contrast)
- [Forms & input › Form and its sections](#/forms/form-and-its-sections)

#### Hints
- `@ScaledMetric private var iconSize: CGFloat = 28` gives a number that grows with the text; use it with `.font(.system(size: iconSize))` for a symbol.
- `withAnimation(nil) { }` performs the change with no animation at all, which is exactly what Reduce Motion asks for — the state still changes.
- `@Environment(\.colorSchemeContrast)` is `.increased` when the user has turned on Increase Contrast, and `.secondary` foreground styles are the first thing to reconsider.
- The Dynamic Type variant in the preview canvas renders every size at once, which is far faster than changing the simulator's setting for each one.

#### Tips
- `ViewThatFits { HStack { ... }; VStack { ... } }` is the other way to do the axis swap, and it decides from the actual space rather than from the size class. Worth knowing; the explicit check is easier to reason about.
- Colour alone is never enough. The tick and the triangle, plus "Up to date" and "Needs attention" in words, mean the card works for a colour-blind user, in bright sunlight, and through VoiceOver — three problems, one fix.
- Turning Reduce Motion, Increase Contrast and the largest text size on together, on a real device, takes two minutes and finds more than an hour of reading the code will.

#### Docs
- [accessibilityReduceMotion](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion)
- [colorSchemeContrast](https://developer.apple.com/documentation/swiftui/environmentvalues/colorschemecontrast)
- [ViewThatFits](https://developer.apple.com/documentation/swiftui/viewthatfits)
