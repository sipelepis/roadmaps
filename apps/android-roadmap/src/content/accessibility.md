# Accessibility

An accessible app is one that works when the user cannot see it, cannot tap precisely, or has set their text to twice the size you designed for. Most of the work is small and mechanical — a label here, a minimum size there — and almost all of it is easier to do while you are writing the screen than to retrofit afterwards. The parts that are not mechanical are the parts worth thinking about: what a row of icons and numbers actually *means*, said out loud, in one sentence.

## What TalkBack does

TalkBack is Android's screen reader. It walks the screen as a tree of **semantics nodes**, stopping on each focusable one, reading its label, its role and its state: "Send, button", "Notifications, switch, on", "Ada Lovelace, 3 unread messages, double tap to open".

Two things follow immediately. A node with no label is a stop that says nothing useful — "button", or worse, silence. And a row split into six nodes is six stops for one idea, which is exhausting to listen to. Good accessibility is as much about merging as about labelling.

Turn it on — Settings, Accessibility, TalkBack — and swipe through one of your own screens. Fifteen minutes of that teaches more than this article does. Volume up and volume down together is the shortcut that turns it off again.

## Content descriptions

Every composable that carries meaning through an image needs a label:

```kotlin
Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.delete_item))
```

Three rules cover almost every case.

**Say the action, not the picture.** "Delete" beats "Trash can". The user does not care what the icon looks like.

**Do not say "icon" or "button".** TalkBack announces the role itself, so `contentDescription = "Delete button"` is read as "Delete button, button".

**Decorative images take `null`.** An avatar next to a name the screen already reads, a divider, a background flourish — `contentDescription = null` removes the node from the tree entirely, which is the correct outcome. An empty string is not the same thing and is worse: it leaves a stop that says nothing.

Labels are user-visible text, so they belong in `strings.xml` like every other string, and they change with the state. A play/pause button has two labels, not one.

## Semantics and merging

Compose builds the semantics tree from your layout, and you adjust it with modifiers.

```kotlin
Row(
    modifier = Modifier
        .clickable(onClick = onOpen)
        .semantics(mergeDescendants = true) { }
) { … }
```

`mergeDescendants = true` folds a subtree's labels into one node, so the whole row becomes a single stop reading "Ada Lovelace, 3 unread messages". A `clickable` on the `Row` already merges, which is why a well-built list row is usually accessible by accident and a decorative one is not.

The other tools you will actually use:

- `Modifier.semantics { contentDescription = … }` for a label on something that has none;
- `Modifier.clearAndSetSemantics { }` to hide a subtree and replace it wholesale — for a chart or a custom control whose parts are meaningless separately;
- `Modifier.semantics { heading() }` to mark a section title, so TalkBack users can jump heading to heading;
- `stateDescription` for "selected", "3 of 5", "downloading";
- `onClick(label = "Open conversation") { … }` inside `semantics`, to name what the double tap will do;
- custom actions, so a long row does not need a visible button for every option.

If you find yourself writing a lot of these, the layout is usually fighting you. A structure that reads well aloud tends to be a structure that reads well on screen.

## Touch targets

Material's minimum is **48dp by 48dp**, which is roughly a fingertip, and it applies to anything tappable — including a 24dp icon.

```kotlin
IconButton(onClick = onDelete) {          // IconButton is 48dp; the icon inside is 24dp
    Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.delete))
}
```

`IconButton`, `Checkbox`, `Switch` and friends already enforce it. A `Modifier.clickable` on a bare `Icon` or `Text` does not, and that is where the failures are. `Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)` fixes it without changing what is drawn — the target can be bigger than the visual.

Spacing counts too: two 48dp targets sharing an edge are still hard to hit. Eight dp between them is the usual minimum.

## Text that grows

A user who has set their font scale to 200% has told the system something important. Honour it: sizes in `sp`, no fixed heights on anything containing text, no `maxLines = 1` on a label that might be translated into German and then doubled.

Test it with `@Preview(fontScale = 2f)`, and fix what overlaps by letting the layout wrap or scroll rather than by capping the size. Compose's non-linear font scaling on Android 14 and up grows small text more than large, so a screen can look fine at 130% and break at 200%.

`TextUnit` in `sp` is the only correct unit for text. `16.dp` for a font size compiles, ignores the user, and is always a bug.

## Contrast

WCAG's contrast ratio is a number between 1 and 21, computed from the relative luminance of two colours. AA wants **4.5:1** for body text and **3:1** for large text — 18pt and up, or 14pt bold and up.

The trap is that contrast is not brightness. `#777777` on white is 4.48:1 and fails; `#767676`, one step darker and visually identical, is 4.54:1 and passes. Eyeballing does not work, which is why the ratio exists.

Material 3's colour scheme is built so that each `on*` colour is accessible against its pair — `onSurface` on `surface`, `onPrimary` on `primary`. Using those pairings gets you contrast for free in both light and dark themes. Contrast problems appear the moment you hand-pick a colour, put text on an image, or grey out a disabled label a shade too far.

## Focus and reading order

TalkBack's order follows the semantics tree, which follows your layout. That is usually right, and where it is not, fix the layout before reaching for an override.

For keyboard and switch access, `Modifier.focusRequester`, `focusProperties { next = … }` and `focusGroup()` control where focus goes. A dialog should take focus when it opens and give it back when it closes; a newly revealed error should be announced, which is what `liveRegion` is for:

```kotlin
Text(
    text = error,
    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
)
```

And headings are what make a long screen navigable: marking your section titles with `heading()` lets someone jump through a settings screen in four gestures instead of forty.

```kotlin playground
// TalkBack walks a tree and stops on each focusable node. Merging changes how many stops a row costs.
sealed interface Node {
    data class Label(val text: String) : Node
    data class Decoration(val what: String) : Node                     // contentDescription = null
    data class Group(val children: List<Node>, val merged: Boolean, val role: String? = null) : Node
}

fun stops(node: Node): List<String> = when (node) {
    is Node.Label -> listOf(node.text)
    is Node.Decoration -> emptyList()                                  // no node at all, which is the point
    is Node.Group -> if (!node.merged) {
        node.children.flatMap { stops(it) }
    } else {
        val said = node.children.flatMap { stops(it) }.joinToString(", ")
        if (said.isEmpty()) emptyList() else listOf(said + (node.role?.let { ", $it" } ?: ""))
    }
}

fun main() {
    val row = listOf(
        Node.Decoration("avatar image"),
        Node.Label("Ada Lovelace"),
        Node.Label("See you at six"),
        Node.Label("3 unread messages"),
        Node.Label("09:14"),
    )

    println("A row with no merging — four stops to hear one conversation:")
    stops(Node.Group(row, merged = false)).forEachIndexed { i, s -> println("  ${i + 1}. $s") }

    println()
    println("The same row, clickable and merged — one stop:")
    stops(Node.Group(row, merged = true, role = "button")).forEachIndexed { i, s -> println("  ${i + 1}. $s") }

    println()
    val screen = Node.Group(
        merged = false,
        children = listOf(
            Node.Label("Messages"),
            Node.Group(row, merged = true, role = "button"),
            Node.Group(
                merged = true,
                role = "button",
                children = listOf(Node.Decoration("pencil"), Node.Label("New message")),
            ),
            Node.Group(merged = true, children = listOf(Node.Decoration("divider"))),
        ),
    )
    println("The whole screen, as it is read out:")
    stops(screen).forEachIndexed { i, s -> println("  ${i + 1}. $s") }
}
```

## Exercises

### 1. Say the row out loud

A conversation row shows an avatar, a name, the last message, an unread badge, a mute icon and a time. Sighted users take that in at a glance. TalkBack has to say it, once, as a sentence.

`describe(conversation)` returns that sentence: the parts below, in this order, joined with `", "`.

1. The name, trimmed. Always present.
2. `"<n> unread messages"`, or `"1 unread message"` when there is exactly one. Omitted when the count is zero or negative.
3. The last message, trimmed; omitted when it is blank.
4. `"muted"`, when the conversation is muted.
5. The time, trimmed; omitted when it is blank.

`iconDescription(label)` cleans up an icon's label. A `null` or blank label means the icon is decorative and the answer is `null`. Otherwise the label is trimmed, and if its last word is `"icon"` or `"button"` in any casing **and there is more than one word**, that word is dropped — TalkBack announces the role itself, so saying it again is noise.

```kotlin starter
data class Conversation(
    val name: String,
    val lastMessage: String,
    val unread: Int,
    val isMuted: Boolean,
    val time: String,
)

fun describe(conversation: Conversation): String = conversation.name

fun iconDescription(label: String?): String? = label
```

```kotlin test
class DescribeTest {
    // everything the row is showing, in one sentence
    @Test
    fun full() {
        assertEquals(
            "Ada Lovelace, 3 unread messages, See you at six, 09:14",
            describe(Conversation("Ada Lovelace", "See you at six", 3, false, "09:14")),
        )
    }

    // one is a special case, zero is not mentioned at all
    @Test
    fun counts() {
        assertEquals(
            "Ada, 1 unread message, Hi, 09:14",
            describe(Conversation("Ada", "Hi", 1, false, "09:14")),
        )
        assertEquals("Ada, Hi, 09:14", describe(Conversation("Ada", "Hi", 0, false, "09:14")))
        assertEquals("Ada, Hi, 09:14", describe(Conversation("Ada", "Hi", -2, false, "09:14")))
    }

    // muted sits between the message and the time
    @Test
    fun muted() {
        assertEquals(
            "Ada, 2 unread messages, Hi, muted, 09:14",
            describe(Conversation("Ada", "Hi", 2, true, "09:14")),
        )
        assertEquals("Ada, muted", describe(Conversation("Ada", "", 0, true, "")))
    }

    // blanks are dropped, not read out as pauses
    @Test
    fun blanks() {
        assertEquals("Ada", describe(Conversation("  Ada  ", "   ", 0, false, "")))
        assertEquals("Ada, Hi", describe(Conversation("Ada", "  Hi  ", 0, false, "  ")))
    }

    // an icon says what it does, and does not say what it is
    @Test
    fun icons() {
        assertEquals("Delete", iconDescription("Delete icon"))
        assertEquals("Delete", iconDescription("  Delete Icon  "))
        assertEquals("delete", iconDescription("delete Button"))
        assertEquals("Add to cart", iconDescription("Add to cart button"))
        assertEquals("Delete", iconDescription("Delete"))
        assertEquals("Icon", iconDescription("Icon"))
        assertEquals(null, iconDescription(null))
        assertEquals(null, iconDescription("   "))
    }
}
```

#### Uses
- [Accessibility › Content descriptions](#/accessibility/content-descriptions)
- [Accessibility › Semantics and merging](#/accessibility/semantics-and-merging)
- [Resources & config › Strings, formatting and plurals](#/resources/strings-formatting-and-plurals)

#### Hints
- `buildList { }` then `joinToString(", ")` keeps the order obvious and the omissions easy: add each part only when it is worth saying.
- `if (unread == 1) "1 unread message" else "$unread unread messages"` — and only add it at all when `unread > 0`.
- For the icon, `label?.trim()?.takeIf { it.isNotEmpty() } ?: return null`, then split on whitespace and check whether the last word `lowercase()`s to `"icon"` or `"button"`.

#### Tips
- In a real app this sentence is built from `<plurals>` and `<string>` resources, not concatenated in Kotlin. The logic is the same; the strings come from `res/`.
- A screen reader reads punctuation as pauses, so `", "` between the parts is doing real work — it is the difference between a sentence and a run-on.
- The avatar is not in the sentence. It is decorative here because the name is already read, and a `contentDescription` of "Photo of Ada Lovelace" would just make the row longer.

#### Docs
- [Compose accessibility: describe visual elements](https://developer.android.com/develop/ui/compose/accessibility/key-steps)
- [Accessibility principles](https://developer.android.com/guide/topics/ui/accessibility/principles)

### 2. Big enough to hit

Material's minimum touch target is 48dp by 48dp. A 24dp icon with a `clickable` on it is 24dp, and it is the single most common accessibility failure in a Compose codebase.

- `meetsMinimum(target)` is true when both dimensions are at least 48.
- `missingDp(target)` returns how much is missing on each axis, as a `width to height` pair — zero on an axis that is already big enough.
- `audit(targets)` returns one message per failing target, in the order given, reading `"save is 32x48dp, minimum is 48x48dp"`.

```kotlin starter
data class Target(val id: String, val widthDp: Int, val heightDp: Int)

fun meetsMinimum(target: Target): Boolean = true

fun missingDp(target: Target): Pair<Int, Int> = 0 to 0

fun audit(targets: List<Target>): List<String> = emptyList()
```

```kotlin test
class TouchTargetTest {
    // the line is 48dp on both axes
    @Test
    fun minimum() {
        assertTrue(meetsMinimum(Target("a", 48, 48)))
        assertTrue(meetsMinimum(Target("a", 64, 48)))
        assertTrue(meetsMinimum(Target("a", 120, 200)))
        assertFalse(meetsMinimum(Target("a", 47, 48)))
        assertFalse(meetsMinimum(Target("a", 48, 24)))
        assertFalse(meetsMinimum(Target("a", 24, 24)))
    }

    // how much padding the fix needs
    @Test
    fun missing() {
        assertEquals(0 to 0, missingDp(Target("a", 48, 48)))
        assertEquals(0 to 0, missingDp(Target("a", 96, 96)))
        assertEquals(24 to 24, missingDp(Target("a", 24, 24)))
        assertEquals(16 to 0, missingDp(Target("a", 32, 56)))
        assertEquals(0 to 1, missingDp(Target("a", 48, 47)))
    }

    // a report of what to fix, in the order it appears
    @Test
    fun report() {
        val screen = listOf(
            Target("title", 200, 32),
            Target("save", 32, 48),
            Target("close", 48, 48),
            Target("overflow", 24, 24),
        )
        assertEquals(
            listOf(
                "title is 200x32dp, minimum is 48x48dp",
                "save is 32x48dp, minimum is 48x48dp",
                "overflow is 24x24dp, minimum is 48x48dp",
            ),
            audit(screen),
        )
    }

    // a clean screen reports nothing
    @Test
    fun clean() {
        assertEquals(emptyList<String>(), audit(listOf(Target("a", 48, 48), Target("b", 56, 56))))
        assertEquals(emptyList<String>(), audit(emptyList()))
    }
}
```

#### Uses
- [Accessibility › Touch targets](#/accessibility/touch-targets)
- [Resources & config › Density, dp, sp and px](#/resources/density-dp-sp-and-px)
- [Reference › Collection operations](#/reference/collection-operations)

#### Hints
- `(48 - dp).coerceAtLeast(0)` on each axis is `missingDp`, and it is also the definition of `meetsMinimum` when both come out zero.
- `audit` is `targets.filterNot(::meetsMinimum).map { … }` — one filter, one format.
- The message is a plain string template: `"${target.id} is ${target.widthDp}x${target.heightDp}dp, minimum is 48x48dp"`.

#### Tips
- The touch target does not have to match what is drawn. `Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)` around a 24dp icon keeps the design and fixes the target.
- Material's own components already enforce this, so the fastest fix for a hand-rolled tappable `Text` or `Icon` is usually to use an `IconButton` or a `TextButton` instead.
- Accessibility Scanner, on the Play Store, runs this audit on a real screen and finds the ones you did not model. Run it once per screen before shipping.

#### Docs
- [Touch target size](https://developer.android.com/develop/ui/compose/accessibility/key-steps#touch-target)
- [Accessibility Scanner](https://developer.android.com/guide/topics/ui/accessibility/testing#accessibility-scanner)

### 3. Contrast is a number, not an opinion

WCAG defines contrast as a ratio between the relative luminance of two colours, and the whole point is that you cannot judge it by looking.

`relativeLuminance(color)` takes a colour as `0xRRGGBB` and returns its luminance. For each channel, divide by 255 to get `c`, then linearise it: `c / 12.92` when `c <= 0.03928`, otherwise `((c + 0.055) / 1.055)` raised to the power `2.4`. Weight the results and add them: `0.2126 × red + 0.7152 × green + 0.0722 × blue`.

`contrastRatio(a, b)` is `(lighter + 0.05) / (darker + 0.05)`, so it runs from 1 (identical) to 21 (black on white) and does not care which argument is which.

`meetsAA(foreground, background, largeText)` is the check that matters: at least `3.0` for large text, at least `4.5` for everything else.

```kotlin starter
fun relativeLuminance(color: Int): Double = 1.0

fun contrastRatio(a: Int, b: Int): Double = 21.0

fun meetsAA(foreground: Int, background: Int, largeText: Boolean): Boolean = true
```

```kotlin test
class ContrastTest {
    // the ends of the scale, and the channel weights
    @Test
    fun luminance() {
        assertEquals(0.0, relativeLuminance(0x000000), 1e-6)
        assertEquals(1.0, relativeLuminance(0xFFFFFF), 1e-6)
        assertEquals(0.2126, relativeLuminance(0xFF0000), 1e-6)
        assertEquals(0.7152, relativeLuminance(0x00FF00), 1e-6)
        assertEquals(0.0722, relativeLuminance(0x0000FF), 1e-6)
        assertEquals(0.184475, relativeLuminance(0x777777), 1e-5)
    }

    // 21 at one end, 1 at the other, and the same either way round
    @Test
    fun ratios() {
        assertEquals(21.0, contrastRatio(0x000000, 0xFFFFFF), 1e-6)
        assertEquals(21.0, contrastRatio(0xFFFFFF, 0x000000), 1e-6)
        assertEquals(1.0, contrastRatio(0xFFFFFF, 0xFFFFFF), 1e-6)
        assertEquals(1.0, contrastRatio(0x777777, 0x777777), 1e-6)
        assertEquals(8.592471, contrastRatio(0x0000FF, 0xFFFFFF), 1e-5)
    }

    // the pair nobody can tell apart by eye
    @Test
    fun theOneStepThatMatters() {
        assertEquals(4.478089, contrastRatio(0x777777, 0xFFFFFF), 1e-5)
        assertEquals(4.542225, contrastRatio(0x767676, 0xFFFFFF), 1e-5)
        assertFalse(meetsAA(0x777777, 0xFFFFFF, largeText = false))
        assertTrue(meetsAA(0x767676, 0xFFFFFF, largeText = false))
    }

    // large text is allowed to be fainter
    @Test
    fun thresholds() {
        assertTrue(meetsAA(0x777777, 0xFFFFFF, largeText = true))
        assertTrue(meetsAA(0x000000, 0xFFFFFF, largeText = false))
        assertFalse(meetsAA(0xFFFFFF, 0xFFFFFF, largeText = true))
        assertFalse(meetsAA(0xCCCCCC, 0xFFFFFF, largeText = true))
    }
}
```

#### Uses
- [Accessibility › Contrast](#/accessibility/contrast)

#### Hints
- `(color shr 16) and 0xFF`, `(color shr 8) and 0xFF` and `color and 0xFF` pull the three channels out of the packed integer.
- Kotlin's power operator is `Math.pow(base, 2.4)` or `base.pow(2.4)` from `kotlin.math`; write the channel linearisation as its own small function and call it three times.
- `maxOf(la, lb)` and `minOf(la, lb)` make `contrastRatio` symmetric without an `if`.

#### Tips
- "Large text" means 18pt, or 14pt bold — about 24sp and 18.66sp. It is not "the heading looks big to me".
- The disabled state is where this is usually failed on purpose: greying a label out to 38% alpha almost always drops it below 4.5:1. Material's disabled colours are chosen to stay legible; hand-rolled ones are not.
- Text over a photograph has no single background colour. A scrim behind the text is the fix, and the ratio is measured against the scrim.

#### Docs
- [Compose accessibility: colour contrast](https://developer.android.com/develop/ui/compose/accessibility/key-steps#color-contrast)
- [Material 3 colour roles](https://m3.material.io/styles/color/roles)

### 4. A row that reads as one sentence

Build the conversation row from exercise 1 as a real composable, and make TalkBack read it as a single stop with the sentence you designed — then add the actions a sighted user gets from swiping.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- The row is one semantics node: TalkBack stops on it once, not five times.
- It reads name, unread count, message preview, muted and time, in that order, from string and plural resources.
- The avatar has `contentDescription = null`, and so does any other purely decorative image in the row.
- Archive and mute are exposed as custom accessibility actions, so a TalkBack user can reach them without a visible button.
- Unread state is a `stateDescription`, not a colour, and not only a badge.
- The whole row's tappable area is at least 48dp tall.
- Turn TalkBack on and swipe through a list of these. It should take one swipe per conversation.

```kotlin solution
@Composable
fun ConversationRow(
    conversation: Conversation,
    onOpen: () -> Unit,
    onArchive: () -> Unit,
    onToggleMute: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val description = conversationDescription(conversation)
    val archiveLabel = stringResource(R.string.archive)
    val muteLabel = stringResource(
        if (conversation.isMuted) R.string.unmute else R.string.mute
    )
    val state = stringResource(
        if (conversation.unread > 0) R.string.unread else R.string.read
    )

    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .clickable(onClick = onOpen)
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = description
                stateDescription = state
                onClick(label = archiveLabel, action = null)
                customActions = listOf(
                    CustomAccessibilityAction(archiveLabel) { onArchive(); true },
                    CustomAccessibilityAction(muteLabel) { onToggleMute(); true },
                )
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = rememberAsyncImagePainter(conversation.avatarUrl),
            contentDescription = null,                 // the name is already read out
            modifier = Modifier.size(40.dp).clip(CircleShape),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(conversation.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
            Text(
                text = conversation.lastMessage,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(conversation.time, style = MaterialTheme.typography.labelSmall)
            if (conversation.unread > 0) {
                Badge { Text(conversation.unread.toString()) }
            }
        }
    }
}

@Composable
private fun conversationDescription(conversation: Conversation): String = buildList {
    add(conversation.name)
    if (conversation.unread > 0) {
        add(pluralStringResource(R.plurals.unread, conversation.unread, conversation.unread))
    }
    if (conversation.lastMessage.isNotBlank()) add(conversation.lastMessage)
    if (conversation.isMuted) add(stringResource(R.string.muted))
    if (conversation.time.isNotBlank()) add(conversation.time)
}.joinToString(", ")
```

#### Uses
- [Accessibility › Semantics and merging](#/accessibility/semantics-and-merging)
- [Accessibility › Content descriptions](#/accessibility/content-descriptions)
- [Accessibility › Touch targets](#/accessibility/touch-targets)

#### Hints
- `Modifier.semantics(mergeDescendants = true) { }` is the merge; `contentDescription = …` inside that block replaces what the children would have said.
- `customActions = listOf(CustomAccessibilityAction(label) { … true })` — the lambda returns `true` when it handled the action.
- The order of the modifiers matters: `clickable` before `padding` makes the padding part of the touch target.

#### Tips
- `onClick(label = …, action = null)` only renames the double-tap announcement; the `clickable` still does the work. Passing a real action there as well would run it twice.
- A merged row with a custom `contentDescription` means the visible text and the spoken text can drift apart. Build the sentence from the same values the row displays, in one function, as above.
- Do not use colour alone for unread. A badge, a bold weight and a `stateDescription` all say the same thing through different channels, which is the point.

#### Docs
- [Compose accessibility: semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics)
- [Custom accessibility actions](https://developer.android.com/develop/ui/compose/accessibility/key-steps#custom-actions)

### 5. Fix a screen you already have

Take any screen you have already built in this roadmap and put it through the whole checklist. This is the exercise that changes how you write the next screen.

#### Build it
- Run Accessibility Scanner on the screen and fix every touch target and contrast finding it reports.
- Every `Icon` and `Image` has either a meaningful `contentDescription` from `strings.xml` or an explicit `null`; none has a description ending in "icon" or "button".
- Section titles are marked with `Modifier.semantics { heading() }`, and swiping by headings in TalkBack reaches each section in one gesture.
- Nothing is announced twice: no label repeated on both a parent and a child, no merged row that also stops on its children.
- The screen renders correctly at `@Preview(fontScale = 2f)` with nothing clipped or overlapping.
- An error message uses `liveRegion = LiveRegionMode.Polite` so it is announced when it appears.
- A UI test asserts the important nodes: `composeTestRule.onNodeWithContentDescription(…).assertExists()` for at least one label and one custom action.
- Walk the whole screen with TalkBack, eyes closed, and complete the screen's main task.

```kotlin solution
@Composable
fun SettingsScreen(
    state: SettingsUiState,
    onToggleNotifications: (Boolean) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())      // survives fontScale = 2f
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(R.string.notifications),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .toggleable(
                    value = state.notificationsEnabled,
                    onValueChange = onToggleNotifications,
                    role = Role.Switch,
                )
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(stringResource(R.string.push_notifications), Modifier.weight(1f))
            Switch(checked = state.notificationsEnabled, onCheckedChange = null)
        }

        Text(
            text = stringResource(R.string.account),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )

        if (state.error != null) {
            Text(
                text = state.error,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
            TextButton(onClick = onRetry) { Text(stringResource(R.string.retry)) }
        }
    }
}

// SettingsScreenTest.kt (androidTest)
@Test
fun theSwitchIsReachableAndLabelled() {
    composeTestRule.setContent {
        AppTheme { SettingsScreen(SettingsUiState(), {}, {}) }
    }
    composeTestRule
        .onNodeWithText(context.getString(R.string.push_notifications))
        .assertIsToggleable()
        .assertHeightIsAtLeast(48.dp)
}
```

#### Uses
- [Accessibility › Focus and reading order](#/accessibility/focus-and-reading-order)
- [Accessibility › Text that grows](#/accessibility/text-that-grows)
- [Accessibility › What TalkBack does](#/accessibility/what-talkback-does)
- [Resources & config › Right-to-left](#/resources/right-to-left)
- [Reference › Modifiers](#/reference/modifiers)

#### Hints
- Putting `toggleable` on the `Row` and `onCheckedChange = null` on the `Switch` gives one focusable node for the whole setting instead of two.
- `assertHeightIsAtLeast(48.dp)` in a Compose test is a touch-target regression test you only have to write once.
- `Modifier.verticalScroll(rememberScrollState())` is usually the entire fix for a screen that breaks at large font scales.

#### Tips
- The eyes-closed run is not theatre. It is the only way to notice that your "Done" button is the fourteenth stop and that two of the stops say "button".
- Accessibility findings are cheapest at review time. A screen that shipped inaccessible tends to stay that way, because fixing it means changing layout that someone has since built on.
- Everything here also makes the app easier to test: a screen whose nodes have labels is a screen whose UI tests do not depend on pixel positions.

#### Docs
- [Accessibility in Compose](https://developer.android.com/develop/ui/compose/accessibility)
- [Test for accessibility](https://developer.android.com/guide/topics/ui/accessibility/testing)
