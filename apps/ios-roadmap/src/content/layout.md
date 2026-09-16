# Stacks & layout

SwiftUI's layout system has no constraints, no solver and no ambiguity errors. It is a conversation, repeated once per view per pass: a parent proposes a size, the child answers with the size it wants, and the parent places it. Almost every layout surprise — a view that fills the screen when you wanted it small, a `Spacer` that does nothing, a `GeometryReader` that collapses everything around it — is one of those three steps behaving exactly as specified.

## The three-step negotiation

1. **The parent proposes a size.** It may propose a number, or `nil` in either dimension meaning "take what you want", or `.infinity` meaning "take everything".
2. **The child chooses its own size.** This is the part people miss: the proposal is advice, not an instruction. `Text` takes the width it needs up to what was offered and then wraps; `Image` takes its natural size unless told to be resizable; `Color` and `Shape` accept whatever they are offered; a stack proposes onward to its children and reports the total.
3. **The parent places the child** in its own coordinate space, using the alignment it was given.

A child can return a size larger than the proposal, and nothing clips it by default. That is why a too-long `Text` with `.fixedSize()` runs off the screen rather than being squeezed: it was asked politely and it said no.

## Stacks

`HStack` lays children out left to right, `VStack` top to bottom, `ZStack` back to front in the order written. Each one measures its children, adds the spacing between them, and reports the total: for an `HStack` the width is the sum of the children plus the gaps, and the height is the tallest child.

Stacks are not a layout algorithm you configure; they are three simple ones you compose. Most screens are stacks inside stacks, and the right question when a layout misbehaves is usually "which stack owns this size?" rather than "which modifier fixes it?".

`ZStack` is the odd one out: it proposes its own size to every child and reports the largest, which is why a `ZStack` containing a `Color` fills whatever it is given.

## Spacing

Every stack has a default spacing that depends on the platform and on what the neighbours are — SwiftUI puts more space between two paragraphs than between a label and its icon. Passing `spacing:` replaces that with a number, everywhere in that stack.

```swift
VStack(spacing: 12) { … }      // 12 between every pair
VStack { … }                    // system spacing, which adapts
```

Use the system default when the content is ordinary text, and a number when you are building something with a rhythm of its own — a card, a toolbar, a grid of tiles. `spacing: 0` plus explicit `.padding` on the children is the usual answer when different gaps are needed in one stack.

## Alignment

A stack's alignment decides where children sit on the *other* axis: `HStack(alignment:)` takes a `VerticalAlignment`, and vice versa. `.center` is the default.

The interesting ones are the text alignments. `.firstTextBaseline` lines children up by the baseline of their first line of text rather than by their boxes, which is what you want whenever two pieces of text of different sizes sit side by side — a big number and its unit, a title and a timestamp. Aligning those `.center` or `.bottom` always looks very slightly wrong and it is hard to say why.

`.frame(alignment:)` is a different alignment: it says where the content sits inside the frame you gave it. `.frame(maxWidth: .infinity, alignment: .leading)` is the standard way to say "take the full width, but keep the text on the left".

## Frames are a proposal, not a command

`.frame(width:height:)` creates a new view of that exact size and proposes it to its child. The child may still choose something else — the frame's own size is fixed, but its content can overflow or be smaller.

The flexible form is the one you will reach for constantly:

```swift
.frame(maxWidth: .infinity)                     // take everything offered
.frame(minHeight: 44)                           // never smaller than a hit target
.frame(maxWidth: 600, alignment: .leading)      // readable on iPad, full width on iPhone
```

`.infinity` here means "accept whatever the parent proposed", not "be enormous". Inside a `ScrollView`, where the proposal in the scroll direction is unbounded, `.frame(maxHeight: .infinity)` really does mean enormous, which is a good thing to know before it happens to you.

## Spacer, and who takes the slack

A `Spacer` is a view that wants no size of its own and accepts everything offered on the stack's axis. Put one in an `HStack` and it absorbs the leftover width, pushing everything else aside; put two around a view and the leftover is split evenly, centring it.

That is also why a `Spacer` sometimes does nothing: if the stack has no slack — because it is sized to fit its content rather than filling its parent — there is nothing to absorb. The fix is upstream, on whichever view should have been taking the full width.

`Spacer(minLength: 0)` is worth knowing. A plain `Spacer` has a minimum length of the system spacing, which is a few points of gap you did not ask for.

## Safe areas

The safe area is the part of the screen not covered by the status bar, the notch or Dynamic Island, the home indicator, a navigation bar or a keyboard. By default every view is laid out inside it, which is almost always right.

`.ignoresSafeArea()` opts out, and the only thing that usually should is a background: a gradient or image that runs under the status bar while the content on top stays inside. `.ignoresSafeArea(.keyboard)` is the other common one, for a background that should not jump when the keyboard appears.

Going the other way, `.safeAreaInset(edge:)` adds your own view to the safe area — a floating "Add to cart" bar, say — so everything that scrolls underneath gets inset by exactly its height and nothing ends up hidden behind it. Overlaying such a bar with `.overlay(alignment: .bottom)` instead is the bug where the last row can never be read.

## GeometryReader, and when not to reach for it

`GeometryReader` hands you the proposed size so you can compute with it. It is also the layout system's biggest footgun, because a `GeometryReader` accepts *everything* proposed to it in both dimensions. Drop one into a `VStack` and it will happily take the entire remaining height, flattening the stack around it.

Before reaching for it, check whether one of these does the job:

- **A proportion of the parent** — `.containerRelativeFrame(.horizontal) { w, _ in w * 0.4 }`.
- **Equal widths across siblings** — a `Grid`, or `.frame(maxWidth: .infinity)` on each child.
- **Matching one view's size to another's** — the `.overlay`/`.background` pair: the overlay is given the size of the view it sits on.
- **Aspect ratio** — `.aspectRatio(16/9, contentMode: .fit)`.

What genuinely needs a `GeometryReader` is arithmetic on the actual size — a custom chart, a parallax offset, a shape drawn from a ratio. When you do use one, keep it as small as possible and give it a known size from the outside, so its appetite has already been bounded.

```swift playground
// Step 2 and 3 of the negotiation, for one HStack: the fixed children keep
// their size, and whatever is left is split between the flexible ones.
enum Slot {
    case fixed(Double)
    case flexible
}

func widths(proposed: Double, children: [Slot], spacing: Double) -> [Double] {
    let gaps = children.isEmpty ? 0 : spacing * Double(children.count - 1)
    var used = gaps
    var flexible = 0
    for child in children {
        switch child {
        case .fixed(let width): used += width
        case .flexible: flexible += 1
        }
    }
    let each = flexible == 0 ? 0 : max(0, proposed - used) / Double(flexible)
    return children.map { child in
        if case .fixed(let width) = child { return width }
        return each
    }
}

func bar(_ widths: [Double], scale: Double = 0.25) -> String {
    widths.map { String(repeating: "█", count: Int($0 * scale)) }.joined(separator: "·")
}

let row: [Slot] = [.fixed(80), .flexible, .fixed(60)]
for proposed in [200.0, 320.0, 480.0] {
    let result = widths(proposed: proposed, children: row, spacing: 8)
    print("proposed \(Int(proposed)): \(result.map { Int($0) })  \(bar(result))")
}

// Two spacers around one view is how centring actually works:
print(widths(proposed: 300, children: [.flexible, .fixed(100), .flexible], spacing: 0))

// Try: make the fixed children add up to more than the proposal.
```

## Exercises

### 1. How big is that stack?

A stack reports the size it needs: along its axis, the children plus the gaps between them; across its axis, the largest child. Implement it for both axes.

`stackSize(_:children:spacing:)` takes the axis, the children's sizes in order, and the spacing between neighbours. An empty stack is zero by zero, and a stack of one child has no gaps at all.

```swift starter
struct Size: Equatable {
    var width: Double
    var height: Double
}

enum Axis {
    case horizontal
    case vertical
}

func stackSize(_ axis: Axis, children: [Size], spacing: Double) -> Size {
    return Size(width: 0, height: 0)
}
```

```swift test
/// an empty stack takes no room
func testEmpty() {
    expect(stackSize(.horizontal, children: [], spacing: 8), Size(width: 0, height: 0))
    expect(stackSize(.vertical, children: [], spacing: 8), Size(width: 0, height: 0))
}

/// one child means no gaps
func testSingle() {
    expect(stackSize(.horizontal, children: [Size(width: 40, height: 20)], spacing: 100),
           Size(width: 40, height: 20))
    expect(stackSize(.vertical, children: [Size(width: 40, height: 20)], spacing: 100),
           Size(width: 40, height: 20))
}

/// an HStack adds widths and takes the tallest child
func testHorizontal() {
    let children = [Size(width: 40, height: 20), Size(width: 60, height: 30)]
    expect(stackSize(.horizontal, children: children, spacing: 0), Size(width: 100, height: 30))
    expect(stackSize(.horizontal, children: children, spacing: 10), Size(width: 110, height: 30))
}

/// a VStack adds heights and takes the widest child
func testVertical() {
    let children = [Size(width: 40, height: 20), Size(width: 60, height: 30)]
    expect(stackSize(.vertical, children: children, spacing: 0), Size(width: 60, height: 50))
    expect(stackSize(.vertical, children: children, spacing: 10), Size(width: 60, height: 60))
}

/// gaps go between children, not around them
func testGapCount() {
    let three = [Size(width: 10, height: 10), Size(width: 10, height: 10), Size(width: 10, height: 10)]
    expect(stackSize(.horizontal, children: three, spacing: 5), Size(width: 40, height: 10))
    expect(stackSize(.vertical, children: three, spacing: 5), Size(width: 10, height: 40))
}
```

#### Uses
- [Stacks & layout › Stacks](#/layout/stacks)
- [Stacks & layout › Spacing](#/layout/spacing)

#### Hints
- Handle the empty case first and return early; every other formula divides by or subtracts from the count.
- The number of gaps is `children.count - 1`, which is why one child needs none.
- `children.reduce(0) { $0 + $1.width }` totals one dimension; `children.map(\.height).max() ?? 0` takes the other.
- The two axes are the same code with width and height swapped. Writing it twice is fine and clearer than being clever.

#### Tips
- Note that `spacing` is ignored entirely for a single child. A stack of one is a common runtime case — a list filtered down to one item — and a formula that multiplies by `count` instead of `count - 1` gets it wrong by exactly one gap.
- Real stacks do not have a single spacing value: SwiftUI's default varies per pair of neighbours based on what they are. That is why `VStack { }` with no `spacing:` often looks better than a number you picked.
- `max()` on an empty collection is `nil`, not zero. The `?? 0` is not defensive noise, it is the empty stack's answer.

#### Docs
- [HStack](https://developer.apple.com/documentation/swiftui/hstack)
- [Layout fundamentals](https://developer.apple.com/documentation/swiftui/layout-fundamentals)

### 2. Who takes the slack?

A `Spacer`, or a child with `.frame(maxWidth: .infinity)`, takes whatever width is left once the fixed children have had theirs. Share it out.

`widths(proposed:children:spacing:)` returns each child's width, in order. Fixed children always get exactly what they asked for. The remainder — the proposed width, minus the gaps, minus every fixed child — is split equally between the flexible ones. If there is no remainder, or it is negative because the fixed children already overflow, the flexible children get zero.

```swift starter
enum Slot: Equatable {
    case fixed(Double)
    case flexible
}

func widths(proposed: Double, children: [Slot], spacing: Double) -> [Double] {
    return []
}
```

```swift test
/// nothing to lay out
func testEmpty() {
    expect(widths(proposed: 300, children: [], spacing: 8), [])
}

/// with no flexible child, the leftover is simply unused
func testAllFixed() {
    expect(widths(proposed: 300, children: [.fixed(50), .fixed(50)], spacing: 0), [50, 50])
    expect(widths(proposed: 300, children: [.fixed(100)], spacing: 20), [100])
}

/// one spacer takes everything that is left
func testOneFlexible() {
    expect(widths(proposed: 300, children: [.fixed(100), .flexible], spacing: 0), [100, 200])
    expect(widths(proposed: 300, children: [.flexible], spacing: 0), [300])
}

/// two spacers split the slack, which is how centring works
func testSplitEvenly() {
    expect(widths(proposed: 300, children: [.flexible, .fixed(100), .flexible], spacing: 0), [100, 100, 100])
    expect(widths(proposed: 320, children: [.flexible, .flexible], spacing: 0), [160, 160])
}

/// the gaps are spent before the slack is shared
func testSpacingComesOutFirst() {
    expect(widths(proposed: 300, children: [.fixed(100), .flexible, .fixed(80)], spacing: 10), [100, 100, 80])
    expect(widths(proposed: 300, children: [.fixed(100), .flexible], spacing: 50), [100, 150])
}

/// when the fixed children already overflow, there is no slack to give
func testOverflow() {
    expect(widths(proposed: 300, children: [.fixed(200), .fixed(200), .flexible], spacing: 0), [200, 200, 0])
    expect(widths(proposed: 10, children: [.flexible, .fixed(40)], spacing: 0), [0, 40])
}
```

#### Uses
- [Stacks & layout › Spacer, and who takes the slack](#/layout/spacer-and-who-takes-the-slack)
- [Stacks & layout › The three-step negotiation](#/layout/the-three-step-negotiation)
- [Stacks & layout › Frames are a proposal, not a command](#/layout/frames-are-a-proposal-not-a-command)

#### Hints
- Two passes: one to total the fixed widths and count the flexible children, one to build the result.
- The gaps cost `spacing * Double(children.count - 1)`, and nothing at all when the list is empty.
- `max(0, proposed - used)` keeps a negative remainder from turning into negative widths.
- `if case .fixed(let width) = child { … }` tests one enum case without a whole `switch`.

#### Tips
- The overflow case is not hypothetical: it is a row of buttons on the smallest iPhone with the largest Dynamic Type. Deciding what happens then is design work, and "the spacer gets zero and the fixed children run off the edge" is what SwiftUI actually does.
- Real SwiftUI runs this negotiation with `layoutPriority` as a tiebreak, and asks each child for its ideal, minimum and maximum size rather than one number. Same shape, more rounds.
- `Spacer(minLength: 0)` matters here. A default `Spacer` will not shrink below the system spacing, so in a tight row it is one of the things pushing the others out.

#### Docs
- [Spacer](https://developer.apple.com/documentation/swiftui/spacer)
- [Layout adjustments](https://developer.apple.com/documentation/swiftui/layout-adjustments)

### 3. Line them up

An `HStack`'s alignment decides where each child sits vertically. Work out the offsets.

`offsets(of:alignment:)` returns each child's distance from the top of the stack. For `.top`, `.center` and `.bottom` the stack is as tall as its tallest child and the children are placed inside it. For `.firstTextBaseline`, the children are shifted so their baselines coincide: the child with the deepest baseline is not moved at all, and every other child drops by the difference.

```swift starter
struct Child: Equatable {
    var height: Double
    var baseline: Double      // from the child's own top to its first text baseline
}

enum VerticalAlignment {
    case top, center, bottom, firstTextBaseline
}

func offsets(of children: [Child], alignment: VerticalAlignment) -> [Double] {
    return []
}
```

```swift test
let small = Child(height: 20, baseline: 15)
let large = Child(height: 40, baseline: 30)
let squat = Child(height: 30, baseline: 10)

/// nothing to place
func testEmpty() {
    expect(offsets(of: [], alignment: .center), [])
    expect(offsets(of: [], alignment: .firstTextBaseline), [])
}

/// top alignment leaves everything where it is
func testTop() {
    expect(offsets(of: [small, large, squat], alignment: .top), [0, 0, 0])
}

/// bottom alignment drops each child to the tallest one's bottom
func testBottom() {
    expect(offsets(of: [small, large, squat], alignment: .bottom), [20, 0, 10])
    expect(offsets(of: [large], alignment: .bottom), [0])
}

/// centring splits the difference
func testCenter() {
    expect(offsets(of: [small, large, squat], alignment: .center), [10, 0, 5])
    expect(offsets(of: [small, small], alignment: .center), [0, 0])
}

/// baselines line up, whatever the boxes do
func testFirstTextBaseline() {
    expect(offsets(of: [small, large], alignment: .firstTextBaseline), [15, 0])
    expect(offsets(of: [large, small], alignment: .firstTextBaseline), [0, 15])
    expect(offsets(of: [small, large, squat], alignment: .firstTextBaseline), [15, 0, 20])
}

/// a baseline alignment is not a bottom alignment in disguise
func testBaselineIsNotBottom() {
    expect(offsets(of: [squat, large], alignment: .firstTextBaseline) != offsets(of: [squat, large], alignment: .bottom),
           "the deep-baselined child should end up in a different place")
}
```

#### Uses
- [Stacks & layout › Alignment](#/layout/alignment)
- [Stacks & layout › Stacks](#/layout/stacks)

#### Hints
- Three of the four cases need the tallest child: `children.map(\.height).max() ?? 0`.
- `.top` is `0` for everyone, `.bottom` is `tallest - child.height`, `.center` is half of that.
- `.firstTextBaseline` needs the deepest baseline instead, and each offset is `deepest - child.baseline`.
- Every case is `children.map { … }`, so the shape of the function is a `switch` returning four maps.

#### Tips
- Check the third baseline case by hand. `squat` is 30 points tall with a baseline only 10 points down, so it is pushed 20 points *lower* than the tall child even though it is shorter. No box-based alignment can produce that, which is the whole reason `.firstTextBaseline` exists.
- This is the alignment for a big number next to its unit, a title next to a timestamp, or an SF Symbol next to a label. If two pieces of text of different sizes sit side by side and look subtly off, this is why.
- SwiftUI lets you define your own alignment guide, which is how you line up views that are not even in the same stack. Rare, but it is the escape hatch before `GeometryReader`.

#### Docs
- [VerticalAlignment](https://developer.apple.com/documentation/swiftui/verticalalignment)
- [Aligning views across stacks](https://developer.apple.com/documentation/swiftui/aligning-views-across-stacks)

### 4. A header row that survives a long title

Build a row with an icon, a title and subtitle, and a trailing button — the shape at the top of half the screens ever shipped. Then make it survive the things that break it: a very long title, and the largest Dynamic Type.

#### Build it
- An `HStack` with a leading SF Symbol, a two-line `VStack` of title and subtitle, and a trailing `Button`.
- The text block takes the leftover width via `.frame(maxWidth: .infinity, alignment: .leading)`, not via a `Spacer` after it.
- `.lineLimit(2)` on the title and `.lineLimit(1)` on the subtitle, so neither grows without bound.
- The button never shrinks or truncates, whatever the title does.
- Previews for a short title, an absurdly long one, and one at an accessibility text size.

```swift solution
// HeaderRow.swift
struct HeaderRow: View {
    let title: String
    let subtitle: String
    var action: () -> Void = {}

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Image(systemName: "tray.full")
                .font(.title3)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .lineLimit(2)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            // Takes the slack itself, so nothing here depends on a Spacer.
            .frame(maxWidth: .infinity, alignment: .leading)

            Button("Edit", action: action)
                .buttonStyle(.bordered)
                // Asked for its size before the flexible text block is.
                .layoutPriority(1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

#Preview("Short") {
    HeaderRow(title: "Inbox", subtitle: "3 unread")
}

#Preview("Long") {
    HeaderRow(title: "Archived receipts from the 2019 expense migration",
              subtitle: "1,284 items · last updated yesterday")
}

#Preview("Accessibility size") {
    HeaderRow(title: "Archived receipts", subtitle: "1,284 items")
        .environment(\.dynamicTypeSize, .accessibility3)
}
```

#### Uses
- [Stacks & layout › Frames are a proposal, not a command](#/layout/frames-are-a-proposal-not-a-command)
- [Stacks & layout › Alignment](#/layout/alignment)
- [Stacks & layout › Spacer, and who takes the slack](#/layout/spacer-and-who-takes-the-slack)
- [Views & modifiers › Previews](#/swiftui-basics/previews)
- [Reference › SwiftUI views and layout](#/reference/swiftui-views-and-layout)

#### Hints
- `.frame(maxWidth: .infinity, alignment: .leading)` on the text block does the job a `Spacer` would, and keeps the alignment explicit.
- `.layoutPriority(1)` tells the stack to satisfy the button's size request before sharing out what is left.
- `.environment(\.dynamicTypeSize, .accessibility3)` in a preview is the fastest way to see the large-text layout.
- If the button starts truncating to "E…", the priority is missing or the text block is taking its width from a `Spacer` instead of a frame.

#### Tips
- `Spacer` and `.frame(maxWidth: .infinity)` both absorb slack, but they say different things. The frame says "this view is the flexible one"; a `Spacer` says "the gap is". When you want the tappable or highlighted area to cover the space, it has to be the frame.
- A row with no `.lineLimit` at all is not more flexible, it is unbounded: one pasted paragraph and your header is nine lines tall.
- Check the largest Dynamic Type before you ship a row, not after. Around `.accessibility1` most horizontal rows want to become vertical ones, which is what `ViewThatFits` is for.

#### Docs
- [layoutPriority(_:)](https://developer.apple.com/documentation/swiftui/view/layoutpriority(_:))
- [ViewThatFits](https://developer.apple.com/documentation/swiftui/viewthatfits)

### 5. A hero card and the safe area

Build a scrolling screen with a full-bleed background, a card with an overlaid badge, and a floating action bar that does not hide the last row.

#### Build it
- A `HeroCard`: a `ZStack` with a gradient behind a title, a fixed height, and rounded corners.
- A badge placed with `.overlay(alignment: .topTrailing)` rather than another `ZStack`.
- A screen background that runs under the status bar with `.ignoresSafeArea()`, while the content stays inside it.
- A bottom action bar added with `.safeAreaInset(edge: .bottom)`, so the scroll view's last row can still be scrolled clear of it.
- Checked by scrolling to the very bottom: the last row is fully readable above the bar.

```swift solution
// HeroCard.swift
struct HeroCard: View {
    let title: String
    let badge: String

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [.indigo, .purple],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            Text(title)
                .font(.title2.bold())
                .foregroundStyle(.white)
                .padding(16)
        }
        .frame(height: 180)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        // The overlay is handed the card's size, so no GeometryReader is needed
        // to work out where the top-trailing corner is.
        .overlay(alignment: .topTrailing) {
            Text(badge)
                .font(.caption.weight(.bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.thinMaterial, in: Capsule())
                .padding(12)
        }
    }
}

// SaleScreen.swift
struct SaleScreen: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HeroCard(title: "Autumn sale", badge: "NEW")
                ForEach(0..<10, id: \.self) { index in
                    Text("Row \(index)")
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .padding(.horizontal, 12)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(16)
        }
        .background {
            LinearGradient(colors: [.indigo.opacity(0.2), .clear],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        }
        // Not .overlay: an inset is subtracted from the scroll view's safe area,
        // so the last row can scroll above the bar instead of hiding behind it.
        .safeAreaInset(edge: .bottom) {
            Button("Shop the sale") {}
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
                .padding(16)
                .background(.bar)
        }
    }
}

#Preview {
    SaleScreen()
}
```

#### Uses
- [Stacks & layout › Safe areas](#/layout/safe-areas)
- [Stacks & layout › Stacks](#/layout/stacks)
- [Stacks & layout › GeometryReader, and when not to reach for it](#/layout/geometryreader-and-when-not-to-reach-for-it)
- [Reference › SwiftUI views and layout](#/reference/swiftui-views-and-layout)

#### Hints
- `.background { … }` with a trailing closure takes a whole view, which is where the `.ignoresSafeArea()` goes — putting it on the `ScrollView` itself would push the content under the status bar too.
- `.overlay(alignment:)` is given exactly the size of the view it is attached to, which is what makes corner placement trivial.
- Swap `.safeAreaInset(edge: .bottom)` for `.overlay(alignment: .bottom)` for a moment and scroll to the end. The difference is the exercise.
- `.clipShape(RoundedRectangle(cornerRadius: 20))` rounds the gradient; `.cornerRadius` is deprecated.

#### Tips
- "Content inside the safe area, background outside it" is the rule that covers nearly every real case. A whole screen that ignores the safe area is nearly always a mistake you will find on a device with a Dynamic Island.
- `.safeAreaInset` composes: a bar added by a child and a keyboard appearing both inset the same scroll view, and neither has to know about the other.
- The badge could have been another `ZStack` layer, but then the card's size would depend on the badge. `.overlay` keeps the size question and the decoration question separate.

#### Docs
- [safeAreaInset(edge:alignment:spacing:content:)](https://developer.apple.com/documentation/swiftui/view/safeareainset(edge:alignment:spacing:content:)-6gwby)
- [overlay(alignment:content:)](https://developer.apple.com/documentation/swiftui/view/overlay(alignment:content:))
