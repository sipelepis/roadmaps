# Layout & modifiers

Three composables do most of the arranging in a Compose app: `Row` puts things beside each other, `Column` puts them above each other, and `Box` stacks them on top of each other. Everything else — padding, size, background, clicks, borders — is a `Modifier`, a chain you build in order and pass in. The chain being ordered is not a detail; it is the single most common source of "why is my padding outside the ripple".

Compose lays out in one pass, top-down for constraints and bottom-up for sizes, and it never measures a child twice. That rule is what makes deep layouts cheap, and it is also why a few things you might expect — asking a child how big it wants to be before deciding — need an explicit opt-in.

## Row, Column and Box

```kotlin
Column {
    Text("Title")
    Text("Subtitle")
}

Row {
    Icon(Icons.Default.Star, contentDescription = null)
    Text("4.8")
}

Box {
    Image(painter = painter, contentDescription = null)
    Text("On top of the image", modifier = Modifier.align(Alignment.BottomStart))
}
```

Each takes a trailing lambda of content, and by default each is exactly as big as what it contains. `Box` draws its children in the order you write them, so the last one is on top.

`Spacer(Modifier.height(16.dp))` inserts empty space. Reach for it when the gap belongs *between* two things; reach for `padding` when the gap belongs *to* one of them.

## Arrangement and alignment

Two parameters place the children, and it is worth keeping them straight: **arrangement** distributes along the layout's own axis, **alignment** positions across the other one.

```kotlin
Row(
    horizontalArrangement = Arrangement.SpaceBetween,   // along the row
    verticalAlignment = Alignment.CenterVertically,     // across it
) { … }

Column(
    verticalArrangement = Arrangement.spacedBy(8.dp),   // along the column
    horizontalAlignment = Alignment.CenterHorizontally, // across it
) { … }
```

`Arrangement.spacedBy(8.dp)` is the one to reach for first: it puts a fixed gap between children and none at the ends, which is what a list of chips or a stack of fields almost always wants, and it saves a `Spacer` between every pair.

`Box` has a single `contentAlignment` for all its children, and `Modifier.align(...)` inside it for one child in particular.

## Modifiers are an ordered chain

A `Modifier` is an immutable, ordered list of elements. `Modifier.padding(8.dp).background(Color.Red)` is a two-element chain, and the order is the order you wrote.

Read the chain from the outside in: each element wraps everything after it. The first element is nearest the parent, the last is nearest the content. Constraints travel down the chain from the parent, each element gets a chance to change them, and the measured size travels back up.

```kotlin
Text(
    "Save",
    modifier = Modifier
        .padding(16.dp)          // outside the shape: space between me and my neighbours
        .clip(RoundedCornerShape(8.dp))
        .background(Color.Blue)  // the shape itself
        .clickable { save() }    // what the ripple covers
        .padding(12.dp)          // inside the shape: space between the edge and the text
)
```

Two paddings in one chain, doing different jobs. The first is the component's margin, the second is its inset. There is no separate margin concept in Compose; where the padding sits in the chain is what makes it one or the other.

## Order changes what you see

The same two modifiers in the other order are a different component:

| Chain | Result |
| --- | --- |
| `.padding(8.dp).background(Red)` | red box, with 8dp of *transparent* space around it |
| `.background(Red).padding(8.dp)` | red box 8dp bigger, with the content inset from its edge |
| `.size(48.dp).padding(8.dp)` | 48dp of space, 32dp of content inside it |
| `.padding(8.dp).size(48.dp)` | 48dp of content, 64dp of space in total |
| `.clickable { }.padding(16.dp)` | the whole padded area is tappable |
| `.padding(16.dp).clickable { }` | only the inner area is tappable — a smaller touch target |

The last row matters most. A tap target should be at least 48dp; putting `clickable` after the padding is how a button ends up looking big and behaving small.

Sizing modifiers read the same way. `Modifier.size(48.dp)` asks for 48dp, but it is still coerced into the constraints the parent handed down — a 48dp child of a 30dp parent gets 30dp. `Modifier.requiredSize(48.dp)` ignores the incoming constraints and takes its 48dp, overflowing the parent if it must. `fillMaxWidth()` takes all the width offered, and `fillMaxWidth(0.5f)` takes half of it.

## Weight: sharing what is left

Inside a `Row` or `Column`, `Modifier.weight(1f)` claims a share of the space no one else asked for. The layout measures every unweighted child first, subtracts what they took, and splits the remainder in proportion to the weights.

```kotlin
Row(modifier = Modifier.fillMaxWidth()) {
    Icon(Icons.Default.Person, contentDescription = null)   // as wide as it needs
    Column(modifier = Modifier.weight(1f)) {                // everything that is left
        Text(name)
        Text(subtitle)
    }
    Icon(Icons.Default.ChevronRight, contentDescription = null)
}
```

That is the standard list row, and the `weight(1f)` in the middle is what stops a long name from pushing the chevron off the screen. Two children with `weight(1f)` and `weight(2f)` get a third and two thirds of the leftover space.

`weight(1f, fill = false)` is the variant worth knowing: the child may take *up to* its share but is allowed to be smaller, rather than being forced to fill it.

## Constraints

Every measurement in Compose passes `Constraints`: a minimum and maximum width, and a minimum and maximum height. A parent measures a child by handing it constraints; the child picks a size within them and reports back.

- **Bounded** constraints have a real maximum. A child of a `Column` with a fixed width gets one.
- **Infinite** maximums happen inside scrolling containers: a `LazyColumn` gives its children infinite maximum height, because the scroll can be as long as it likes. This is why `fillMaxHeight()` inside a vertically scrolling list is an error, not a layout — you cannot fill something with no end.
- **Tight** constraints have minimum equal to maximum: the child has no choice at all.

A child is measured **once**. Compose does not let a parent measure a child, look at the answer, and measure it again with different constraints — that is what made deep view hierarchies quadratic in the old system.

## Intrinsic sizing

Sometimes you genuinely need to ask "how wide does this want to be?" before deciding — two columns that should be the same height, a divider that should be exactly as tall as the tallest of its neighbours. `IntrinsicSize` is the explicit opt-in:

```kotlin
Row(modifier = Modifier.height(IntrinsicSize.Min)) {
    Text(question, modifier = Modifier.weight(1f))
    VerticalDivider()
    Text(answer, modifier = Modifier.weight(1f))
}
```

`IntrinsicSize.Min` asks each child for the smallest size at which it can still render sensibly — for text, the width of its longest word, because that is the narrowest column it can wrap into. `IntrinsicSize.Max` asks for the size at which it needs no wrapping at all — the whole line on one line.

A `Row`'s own intrinsic width is the **sum** of its children's; a `Column`'s is the **largest** of its children's. The heights work the other way round.

It costs an extra measurement pass over that subtree, so it is not free — but it is a bounded, opt-in cost, and far better than the alternative of laying the same content out twice by hand.

```kotlin playground
// The two rules that decide every layout: the modifier chain, and how weight splits what is left.
sealed interface Mod {
    data class Padding(val all: Int) : Mod
    data class Size(val value: Int) : Mod
    data class RequiredSize(val value: Int) : Mod
}

/** Constraints travel down the chain; each element narrows what is left for the content. */
fun contentWidth(available: Int, chain: List<Mod>): Int = chain.fold(available) { width, mod ->
    when (mod) {
        is Mod.Padding -> maxOf(0, width - 2 * mod.all)
        is Mod.Size -> minOf(mod.value, width)
        is Mod.RequiredSize -> mod.value
    }
}

fun bar(width: Int, total: Int) = "▉".repeat(width * 40 / total).padEnd(40, '·')

fun main() {
    val chains = listOf(
        "no modifiers" to listOf(),
        ".padding(8)" to listOf(Mod.Padding(8)),
        ".padding(8).size(50)" to listOf(Mod.Padding(8), Mod.Size(50)),
        ".size(50).padding(8)" to listOf(Mod.Size(50), Mod.Padding(8)),
        ".size(200)" to listOf(Mod.Size(200)),
        ".requiredSize(200)" to listOf(Mod.RequiredSize(200)),
    )
    println("content width inside a 100-wide parent:")
    for ((label, chain) in chains) {
        val w = contentWidth(100, chain)
        println("%-22s %3d  %s".format(label, w, bar(minOf(w, 100), 100)))
    }
    println("\n^ .size(200) is coerced by the parent; .requiredSize(200) overflows it")

    // A list row: icon, a weighted middle, a chevron.
    val total = 300
    val fixed = listOf(24, 24)
    val remaining = total - fixed.sum()
    println("\nrow of ${total}: icon ${fixed[0]}, middle weight(1f) -> $remaining, chevron ${fixed[1]}")
    println("two weights 1f and 2f share it: ${remaining / 3} and ${remaining * 2 / 3}")
}
```

## Exercises

### 1. The modifier chain

`contentWidth(available, chain)` works out how much width is left for the content after a chain of modifiers, given the width the parent offered. `Padding(n)` takes `n` off each side, never going below zero. `Size(n)` asks for `n`, but is coerced into what is still available. `RequiredSize(n)` takes `n` regardless, even if that overflows the parent. The chain applies in order, outermost first.

```kotlin starter
sealed interface Mod {
    data class Padding(val all: Int) : Mod
    data class Size(val value: Int) : Mod
    data class RequiredSize(val value: Int) : Mod
}

fun contentWidth(available: Int, chain: List<Mod>): Int {
    return available
}
```

```kotlin test
class ContentWidthTest {
    // padding takes from both sides
    @Test
    fun padding() {
        assertEquals(100, contentWidth(100, listOf()))
        assertEquals(84, contentWidth(100, listOf(Mod.Padding(8))))
        assertEquals(68, contentWidth(100, listOf(Mod.Padding(8), Mod.Padding(8))))
        assertEquals(0, contentWidth(100, listOf(Mod.Padding(60))))
    }

    // order changes the answer
    @Test
    fun order() {
        assertEquals(50, contentWidth(100, listOf(Mod.Padding(8), Mod.Size(50))))
        assertEquals(34, contentWidth(100, listOf(Mod.Size(50), Mod.Padding(8))))
        assertEquals(24, contentWidth(100, listOf(Mod.Padding(10), Mod.Size(40), Mod.Padding(8))))
    }

    // size is coerced by the parent, requiredSize is not
    @Test
    fun coercion() {
        assertEquals(100, contentWidth(100, listOf(Mod.Size(200))))
        assertEquals(200, contentWidth(100, listOf(Mod.RequiredSize(200))))
        assertEquals(184, contentWidth(100, listOf(Mod.RequiredSize(200), Mod.Padding(8))))
        assertEquals(40, contentWidth(100, listOf(Mod.RequiredSize(200), Mod.Size(40))))
    }
}
```

#### Uses
- [Layout & modifiers › Modifiers are an ordered chain](#/layout/modifiers-are-an-ordered-chain)
- [Layout & modifiers › Order changes what you see](#/layout/order-changes-what-you-see)
- [Layout & modifiers › Constraints](#/layout/constraints)

#### Hints
- The chain is a left-to-right fold over a single number: `chain.fold(available) { width, mod -> … }`.
- `when (mod)` over the sealed interface gives you the three cases, and the compiler checks you covered them.
- "Coerced into what is available" is `minOf(mod.value, width)`; "regardless" is just `mod.value`.

#### Tips
- This is the whole reason `.padding(8.dp).size(48.dp)` and `.size(48.dp).padding(8.dp)` produce different components: the first is 64dp across, the second is 48dp.
- `requiredSize` exists for the rare case where a child must be a particular size — an avatar, a fixed-size icon — and you accept it overflowing. Use it deliberately or not at all.
- Real `Constraints` carry a minimum too, which is how `fillMaxWidth` works: it sets the minimum equal to the maximum, leaving the child no choice.

#### Docs
- [Modifiers](https://developer.android.com/develop/ui/compose/modifiers)
- [Compose layout basics](https://developer.android.com/develop/ui/compose/layouts/basics)

### 2. Sharing the space that is left

`distribute(total, children)` is what a `Row` does with `Modifier.weight`. Measure the fixed children first and subtract their sizes; whatever remains is split between the weighted children in proportion to their weights. Each weighted child gets its share rounded down, and any pixels left over from the rounding go to the **last** weighted child so the row adds up exactly. If the fixed children already fill the row there is nothing to share, and every weighted child gets `0`. Return the sizes in the order the children were given.

```kotlin starter
sealed interface Child {
    data class Fixed(val size: Int) : Child
    data class Weighted(val weight: Float) : Child
}

fun distribute(total: Int, children: List<Child>): List<Int> {
    return children.map { if (it is Child.Fixed) it.size else 0 }
}
```

```kotlin test
class DistributeTest {
    // the leftover is split in proportion
    @Test
    fun shares() {
        assertEquals(listOf(100, 100, 100), distribute(300, listOf(Child.Fixed(100), Child.Weighted(1f), Child.Weighted(1f))))
        assertEquals(listOf(24, 252, 24), distribute(300, listOf(Child.Fixed(24), Child.Weighted(1f), Child.Fixed(24))))
        assertEquals(listOf(100, 200), distribute(300, listOf(Child.Weighted(1f), Child.Weighted(2f))))
    }

    // rounding down, with the remainder on the last weighted child
    @Test
    fun rounding() {
        assertEquals(listOf(33, 67), distribute(100, listOf(Child.Weighted(1f), Child.Weighted(2f))))
        assertEquals(listOf(33, 33, 34), distribute(100, listOf(Child.Weighted(1f), Child.Weighted(1f), Child.Weighted(1f))))
        assertEquals(100, distribute(100, listOf(Child.Weighted(1f), Child.Weighted(1f), Child.Weighted(1f))).sum())
    }

    // nothing left to share, and nothing weighted to share it
    @Test
    fun edges() {
        assertEquals(listOf(80, 0), distribute(50, listOf(Child.Fixed(80), Child.Weighted(1f))))
        assertEquals(listOf(10, 20), distribute(300, listOf(Child.Fixed(10), Child.Fixed(20))))
        assertEquals(listOf<Int>(), distribute(300, listOf()))
        assertEquals(listOf(300), distribute(300, listOf(Child.Weighted(7.5f))))
    }
}
```

#### Uses
- [Layout & modifiers › Weight: sharing what is left](#/layout/weight-sharing-what-is-left)
- [Layout & modifiers › Row, Column and Box](#/layout/row-column-and-box)
- [Layout & modifiers › Constraints](#/layout/constraints)

#### Hints
- Three quantities first: the sum of the fixed sizes, the space remaining (never below zero), and the sum of the weights.
- One child's share is `(remaining * weight / totalWeight).toInt()`, which rounds down for the positive numbers here.
- Find the index of the last weighted child before you build the result, then give that one `remaining - everythingElseAllocated`.

#### Tips
- Rounding matters more than it looks. Three equal weights across 100 pixels have to come to 100, or a `SpaceBetween` row develops a one-pixel gap that only appears on some screen densities.
- The fixed children being measured first is why an unconstrained `Text` beside a `weight(1f)` sibling can still push it around: the text takes what it wants before there is a remainder to share.
- A single `weight(7.5f)` child gets everything, whatever the number — weights are relative, so only their ratios matter.

#### Docs
- [Row and Column arrangement and weight](https://developer.android.com/develop/ui/compose/layouts/basics#layout-model)
- [Modifier.weight](https://developer.android.com/reference/kotlin/androidx/compose/foundation/layout/RowScope#weight(androidx.compose.ui.Modifier,kotlin.Float,kotlin.Boolean))

### 3. Intrinsic width

`intrinsicWidth(children, axis, mode)` answers the question `IntrinsicSize` asks of a subtree. For one piece of text, the **minimum** intrinsic width is the length of its longest word — the narrowest column it can wrap into without breaking a word — and the **maximum** is the length of the whole string, the width at which it never wraps. A `Row`'s intrinsic width is the sum of its children's; a `Column`'s is the largest of its children's. Words are separated by single spaces, and an empty string is zero wide. An empty list of children is zero wide either way.

```kotlin starter
enum class Axis { ROW, COLUMN }
enum class Mode { MIN, MAX }

fun intrinsicWidth(children: List<String>, axis: Axis, mode: Mode): Int {
    return children.sumOf { it.length }
}
```

```kotlin test
class IntrinsicTest {
    // one child: the longest word, or the whole line
    @Test
    fun single() {
        assertEquals(5, intrinsicWidth(listOf("hello world"), Axis.ROW, Mode.MIN))
        assertEquals(11, intrinsicWidth(listOf("hello world"), Axis.ROW, Mode.MAX))
        assertEquals(11, intrinsicWidth(listOf("hello world"), Axis.COLUMN, Mode.MAX))
        assertEquals(14, intrinsicWidth(listOf("unsubscribable"), Axis.ROW, Mode.MIN))
    }

    // a row sums, a column takes the largest
    @Test
    fun axes() {
        val cells = listOf("one", "two words", "a")
        assertEquals(3 + 5 + 1, intrinsicWidth(cells, Axis.ROW, Mode.MIN))
        assertEquals(3 + 9 + 1, intrinsicWidth(cells, Axis.ROW, Mode.MAX))
        assertEquals(5, intrinsicWidth(cells, Axis.COLUMN, Mode.MIN))
        assertEquals(9, intrinsicWidth(cells, Axis.COLUMN, Mode.MAX))
    }

    // nothing to measure
    @Test
    fun empty() {
        assertEquals(0, intrinsicWidth(listOf(), Axis.ROW, Mode.MIN))
        assertEquals(0, intrinsicWidth(listOf(), Axis.COLUMN, Mode.MAX))
        assertEquals(0, intrinsicWidth(listOf(""), Axis.ROW, Mode.MIN))
        assertEquals(0, intrinsicWidth(listOf(""), Axis.COLUMN, Mode.MAX))
        assertEquals(4, intrinsicWidth(listOf("", "four"), Axis.ROW, Mode.MAX))
    }
}
```

#### Uses
- [Layout & modifiers › Intrinsic sizing](#/layout/intrinsic-sizing)
- [Layout & modifiers › Constraints](#/layout/constraints)
- [Composable functions › Keeping logic out of composables](#/compose-basics/keeping-logic-out-of-composables)
- [Reference › Sorting and picking](#/reference/sorting-and-picking)

#### Hints
- One child's width: `MIN` is `text.split(" ").maxOfOrNull { it.length } ?: 0`, `MAX` is `text.length`.
- Combine with `sumOf` for a row and `maxOrNull() ?: 0` for a column — the `?: 0` is the empty-list case.
- `"".split(" ")` gives `[""]`, whose longest word has length zero, which is the answer you want anyway.

#### Tips
- Text is the interesting case because its width and height trade off against each other: narrower means taller. Intrinsic measurement is how a parent asks about that trade-off without laying the text out twice.
- `Modifier.height(IntrinsicSize.Min)` on a `Row` is the idiomatic way to make a divider exactly as tall as the tallest thing beside it.
- Intrinsics are not free and not always available — a composable can decline to answer, and some `LazyColumn` content genuinely cannot. Use them for a bounded piece of layout, never across a whole screen.

#### Docs
- [Intrinsic measurements in Compose layouts](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements)
- [Custom layouts](https://developer.android.com/develop/ui/compose/layouts/custom)

### 4. The list row everyone writes

Build the standard list row: a leading avatar, a two-line middle that takes whatever space is left, a trailing value and a chevron. Get the modifier order right and it stays correct with a one-character name and a forty-character one. Not marked here — work the checklist, then compare with the solution.

#### Build it
- `ContactRow(name: String, subtitle: String, modifier: Modifier = Modifier)`, with `modifier` applied to the outermost `Row`.
- The row is `fillMaxWidth()`, vertically centred, with the middle `Column` on `Modifier.weight(1f)`.
- A very long name truncates with an ellipsis instead of pushing the chevron off screen (`maxLines = 1`, `TextOverflow.Ellipsis`).
- The whole row is `clickable`, and `clickable` comes **before** the padding in the chain so the padded area is tappable too.
- The row's own touch target is at least 48dp tall.
- Spacing between the avatar, the text and the chevron comes from `Arrangement.spacedBy`, not from a `Spacer` between each pair.
- A preview with three rows: a short name, a long name, and an empty subtitle.

```kotlin solution
// ContactRow.kt
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Composable
fun ContactRow(
    name: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .clickable(onClick = onClick)      // before the padding: the whole row is the target
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(
            imageVector = Icons.Default.Person,
            contentDescription = null,         // decorative: the name beside it is the label
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = name,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (subtitle.isNotBlank()) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun ContactRowPreview() {
    MaterialTheme {
        Surface {
            Column {
                ContactRow("Ada Lovelace", "Analytical Engine", onClick = {})
                ContactRow("A name long enough that it has to be truncated somewhere", "Overflow", onClick = {})
                ContactRow("Grace", "", onClick = {})
            }
        }
    }
}
```

#### Uses
- [Layout & modifiers › Weight: sharing what is left](#/layout/weight-sharing-what-is-left)
- [Layout & modifiers › Order changes what you see](#/layout/order-changes-what-you-see)
- [Layout & modifiers › Arrangement and alignment](#/layout/arrangement-and-alignment)

#### Hints
- Build it with the long name from the start. A row that only works with short text is a row you will fix twice.
- `Modifier.weight(1f)` is only available inside a `Row` or `Column`'s content lambda — that is what `RowScope` means, and why it does not compile elsewhere.
- Pass `onClick` in rather than doing the work inside: a row that knows what it navigates to is a row you cannot reuse.
- Turn on Layout Inspector, or just drop `Modifier.background(Color.Red)` on the middle column for a moment, to see exactly what space it took.

#### Tips
- `contentDescription = null` on a decorative icon is correct and deliberate — the name beside it already says who this is, and a screen reader announcing "person icon, Ada Lovelace" is noise.
- `defaultMinSize` sets a floor without fixing the height, so the row still grows for two lines of text. `height(48.dp)` would clip them.
- The chevron uses `Icons.AutoMirrored` so it flips in right-to-left languages. Every directional icon should.

#### Docs
- [Material 3 list items](https://developer.android.com/develop/ui/compose/components/list)
- [Accessibility in Compose](https://developer.android.com/develop/ui/compose/accessibility)

### 5. Equal heights with intrinsics

Build a two-column comparison card — a question and an answer, separated by a vertical divider that is exactly as tall as the taller of the two, whichever that turns out to be. This is the layout that is genuinely awkward without intrinsics.

#### Build it
- A `Row` with `Modifier.height(IntrinsicSize.Min)`, containing two `Text`s with `Modifier.weight(1f)` and a `VerticalDivider` between them.
- The divider is `Modifier.fillMaxHeight()` and reaches top to bottom of the taller column, with no hardcoded height anywhere.
- Swapping which side has the longer text changes nothing about the code and the divider still fits.
- A `Card` or `Surface` around the row, with padding inside it rather than around each text.
- A preview with one short side and one side long enough to wrap to four lines.
- A second preview at `fontScale = 2f` where the divider is still correct.

```kotlin solution
// ComparisonCard.kt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Composable
fun ComparisonCard(question: String, answer: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)          // ask both children how short they can be
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = question,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
            )
            VerticalDivider(modifier = Modifier.fillMaxHeight())
            Text(
                text = answer,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360)
@Preview(showBackground = true, widthDp = 360, fontScale = 2f)
@Composable
private fun ComparisonCardPreview() {
    MaterialTheme {
        ComparisonCard(
            question = "Why?",
            answer = "Because the divider has to be as tall as the tallest column, and neither column " +
                "knows how tall the other one is until both have been measured.",
            modifier = Modifier.padding(16.dp),
        )
    }
}
```

#### Uses
- [Layout & modifiers › Intrinsic sizing](#/layout/intrinsic-sizing)
- [Layout & modifiers › Constraints](#/layout/constraints)
- [Layout & modifiers › Row, Column and Box](#/layout/row-column-and-box)

#### Hints
- Without `height(IntrinsicSize.Min)` the divider has no height to fill and disappears. Try it that way first, so you have seen the failure.
- `VerticalDivider` is the Material 3 composable; in older code you will see `Divider(Modifier.width(1.dp).fillMaxHeight())` doing the same job.
- The `fontScale = 2f` preview is the one that finds hardcoded heights. If the divider is short there, something in the chain has a fixed `dp`.

#### Tips
- `IntrinsicSize.Min` on the `Row` measures the subtree an extra time. That is fine for a card and a bad idea for every item of a long list.
- A `LazyColumn` child cannot always answer an intrinsic query, which is why this pattern belongs inside an item, not around one.
- If intrinsics will not do what you need, `SubcomposeLayout` will — at a much higher cost. Reach for it last.

#### Docs
- [Intrinsic measurements](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements)
- [Material 3 dividers](https://developer.android.com/reference/kotlin/androidx/compose/material3/package-summary#VerticalDivider(androidx.compose.ui.Modifier,androidx.compose.ui.unit.Dp,androidx.compose.ui.graphics.Color))
