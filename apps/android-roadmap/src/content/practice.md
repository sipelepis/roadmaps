# Practice problems

This module teaches nothing new. It is twelve problems that pull the whole roadmap together — state, lists, navigation, saved state, networking, storage, dependency injection, testing, performance and shipping — reduced to the plain Kotlin at the centre of each. Every one of them is a decision a real app makes, taken out of the composable where it usually hides and put somewhere you can test it.

They are roughly in order of difficulty, not of topic. The first few are list and state work; the middle ones are storage, navigation and background work; the last few are the parts of the job that happen after the code is written.

## How to work through these

Read the tests before you write anything. They are the specification, they fix the exact types, and they contain the awkward cases the description only hints at. If a test surprises you, the description says why somewhere.

Get it working with the obvious loop first. Then look for the version the standard library already has — `groupBy`, `zipWithNext`, `associateBy`, `sortedWith`, `firstOrNull`, `filterIsInstance`. Shorter is not automatically better, but here it usually is, and the short version is usually the one that handles the empty list correctly without a guard.

`println` from a failing test shows up in its result, which is the fastest way to see what your code actually did.

## What you can reach for

Everything the roadmap has covered, and nothing else — no androidx, no third-party libraries. What these problems want most often:

- **Collections**: `map`, `filter`, `mapNotNull`, `groupBy`, `associateBy`, `zipWithNext`, `sortedWith`, `compareBy`, `distinct`, `firstOrNull`, `withIndex`, `dropLast`, `indexOfLast`.
- **Strings**: `split`, `trim`, `isBlank`, `contains(..., ignoreCase = true)`, `toIntOrNull`, `padEnd`.
- **Types**: sealed interfaces with an exhaustive `when`, `data class` equality, nullable types and `?:`, `filterIsInstance`, `as?`.
- **Failures**: `require` for an `IllegalArgumentException`, `error` for an `IllegalStateException`.

## A warm-up

The playground below solves a thirteenth problem — the file size the Play Console shows next to a bundle — to set the tone: a pure function, a couple of awkward boundaries, and a `check` that proves it. Edit it freely; it is scratch space.

```kotlin playground
/** Bytes, the way a store listing shows them: "512 B", "1.5 MB", "3.0 GB". */
fun humanBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val units = listOf("KB", "MB", "GB")
    var value = bytes.toDouble()
    var unit = 0
    while (value >= 1024 && unit < units.size) {
        value /= 1024
        unit++
    }
    return "%.1f %s".format(value, units[unit - 1])
}

fun main() {
    listOf(0L, 512L, 1024L, 2048L, 1_572_864L, 42_000_000L, 3_221_225_472L)
        .forEach { println("${it.toString().padEnd(12)} -> ${humanBytes(it)}") }

    check(humanBytes(0) == "0 B")
    check(humanBytes(1023) == "1023 B")
    check(humanBytes(1024) == "1.0 KB")
    println("all checks passed")
}
```

## Exercises

### 1. What the search screen shows

A list screen with a search box has four states, and the difference between two of them is where most apps go wrong: "you have no notes" and "no notes match *sourdough*" are not the same screen and must not show the same message.

`screenState(loading, all, query)` decides, in this order:

1. While `loading` is true the answer is `Loading`, whatever else is true.
2. With nothing stored at all, `Empty` — even when there is a query.
3. With a blank query — empty or only whitespace — `Results(all)`.
4. Otherwise match case-insensitively on the trimmed query: any item containing it, in the original order. No matches gives `NoMatches` carrying the trimmed query.

```kotlin starter
sealed interface ScreenState {
    data object Loading : ScreenState
    data object Empty : ScreenState
    data class NoMatches(val query: String) : ScreenState
    data class Results(val items: List<String>) : ScreenState
}

fun screenState(loading: Boolean, all: List<String>, query: String): ScreenState = ScreenState.Loading
```

```kotlin test
class ScreenStateTest {
    // loading wins over everything
    @Test
    fun loading() {
        assertEquals(ScreenState.Loading, screenState(true, emptyList(), ""))
        assertEquals(ScreenState.Loading, screenState(true, listOf("Milk"), "mi"))
    }

    // nothing stored is not the same as nothing matching
    @Test
    fun empty() {
        assertEquals(ScreenState.Empty, screenState(false, emptyList(), ""))
        assertEquals(ScreenState.Empty, screenState(false, emptyList(), "sourdough"))
        assertEquals(ScreenState.NoMatches("sourdough"), screenState(false, listOf("Milk"), "sourdough"))
    }

    // a blank query shows everything
    @Test
    fun noQuery() {
        val all = listOf("Milk", "Bread", "Jam")
        assertEquals(ScreenState.Results(all), screenState(false, all, ""))
        assertEquals(ScreenState.Results(all), screenState(false, all, "   "))
    }

    // matching ignores case and surrounding spaces, and keeps the order
    @Test
    fun matching() {
        val all = listOf("Milk", "Bread", "Marmalade", "jam")
        assertEquals(ScreenState.Results(listOf("Milk", "Marmalade", "jam")), screenState(false, all, "m"))
        assertEquals(ScreenState.Results(listOf("Marmalade")), screenState(false, all, " MA "))
        assertEquals(ScreenState.Results(listOf("jam")), screenState(false, all, "JAM"))
        assertEquals(ScreenState.NoMatches("zz"), screenState(false, all, "  zz  "))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Testing › Test the state, not the screen](#/testing/test-the-state-not-the-screen)

#### Hints
- Four rules, four early returns, in the order the description gives them. Anything cleverer gets the `Empty`-with-a-query case wrong.
- `query.trim()` once, into a local, and use that local for both the blankness check and the matching.
- `it.contains(trimmed, ignoreCase = true)` is the match.

#### Tips
- Distinguishing these four states costs one sealed interface and saves every "where did my notes go" support ticket.
- The order of the rules is the specification. Writing them as a `when` with overlapping conditions is how two of them end up unreachable.
- `Results(emptyList())` should be impossible by construction here — that is the point of having `Empty` and `NoMatches` as separate cases.

#### Docs
- [UI state in the UI layer](https://developer.android.com/topic/architecture/ui-layer#define-ui-state)

### 2. Headers in a long list

A `LazyColumn` has no concept of sections: you hand it a flat list of rows, and a header is just another row. Turn a list of items into that flat list.

`rows(items)` keeps the items in the order given and inserts a `Header` before the first item and before every item whose `day` differs from the previous item's. Items with the same day that are not adjacent get a header each — the input is in display order and you do not reorder it.

```kotlin starter
data class Item(val id: Long, val title: String, val day: String)

sealed interface Row {
    data class Header(val day: String) : Row
    data class Entry(val item: Item) : Row
}

fun rows(items: List<Item>): List<Row> = items.map { Row.Entry(it) }
```

```kotlin test
class RowsTest {
    // a header before each run
    @Test
    fun sections() {
        val items = listOf(
            Item(1, "Standup", "Mon"),
            Item(2, "Review", "Mon"),
            Item(3, "Gym", "Tue"),
        )
        assertEquals(
            listOf(
                Row.Header("Mon"),
                Row.Entry(items[0]),
                Row.Entry(items[1]),
                Row.Header("Tue"),
                Row.Entry(items[2]),
            ),
            rows(items),
        )
    }

    // the order given is the order shown, even when a day comes back
    @Test
    fun repeats() {
        val items = listOf(Item(1, "a", "Mon"), Item(2, "b", "Tue"), Item(3, "c", "Mon"))
        val out = rows(items)
        assertEquals(6, out.size)
        assertEquals(Row.Header("Mon"), out[0])
        assertEquals(Row.Header("Tue"), out[2])
        assertEquals(Row.Header("Mon"), out[4])
    }

    // the easy edges
    @Test
    fun edges() {
        assertEquals(emptyList<Row>(), rows(emptyList()))
        val one = Item(1, "a", "Mon")
        assertEquals(listOf(Row.Header("Mon"), Row.Entry(one)), rows(listOf(one)))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Performance › Lists that scroll](#/performance/lists-that-scroll)

#### Hints
- Walk the list with a `var lastDay: String?` that starts as `null`; a header goes in whenever `item.day != lastDay`.
- `buildList { }` lets you `add` as you go and returns an immutable list at the end.
- `null` is never equal to any day, which is why the first item gets its header without a special case.

#### Tips
- Flattening in the ViewModel, not in the composable, means the flattening has a unit test and the list has one job.
- Give each row a distinct key when you render this: `when (row) { is Header -> "h-${row.day}"; is Entry -> "e-${row.item.id}" }`. Two rows with the same key is a crash.
- `stickyHeader` in a `LazyColumn` needs the headers to be separate items, which is exactly the shape this produces.

#### Docs
- [Lists and grids](https://developer.android.com/develop/ui/compose/lists)

### 3. Wait until they stop typing

Firing a search request per keystroke is how you get rate-limited by your own backend. Debouncing keeps only the keystrokes that were followed by a pause.

`debounce(events, quietMs)` takes timestamped queries in ascending time order and returns the query strings that should actually be sent, in order. An event survives when nothing else arrives within `quietMs` of it: either it is the last event, or the next event is at least `quietMs` later.

```kotlin starter
fun debounce(events: List<Pair<Long, String>>, quietMs: Long): List<String> = events.map { it.second }
```

```kotlin test
class DebounceTest {
    // fast typing collapses to the last keystroke
    @Test
    fun typing() {
        val events = listOf(0L to "s", 50L to "so", 90L to "sou", 700L to "sourdough")
        assertEquals(listOf("sou", "sourdough"), debounce(events, 300))
    }

    // a long enough pause lets one through
    @Test
    fun pauses() {
        val events = listOf(0L to "a", 300L to "ab", 600L to "abc")
        assertEquals(listOf("a", "ab", "abc"), debounce(events, 300))
        assertEquals(listOf("abc"), debounce(events, 301))
    }

    // the last event always survives
    @Test
    fun edges() {
        assertEquals(emptyList<String>(), debounce(emptyList(), 300))
        assertEquals(listOf("only"), debounce(listOf(5L to "only"), 300))
        assertEquals(listOf("b"), debounce(listOf(0L to "a", 1L to "b"), 1000))
    }

    // a quiet period of zero keeps everything
    @Test
    fun noDebounce() {
        val events = listOf(0L to "a", 0L to "b", 1L to "c")
        assertEquals(listOf("a", "b", "c"), debounce(events, 0))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Testing › Controlling time](#/testing/controlling-time)

#### Hints
- `events.zipWithNext()` gives you each event paired with the one after it, and leaves the last event out — which is the one that always survives.
- Or index the list: keep `events[i]` when `i == events.lastIndex || events[i + 1].first - events[i].first >= quietMs`.
- `filterIndexed { i, _ -> ... }.map { it.second }` does it in two steps without a mutable list.

#### Tips
- Flow's `debounce(300)` does exactly this over real time. The version here is the same rule with the time passed in, which is why it needs no coroutine and no waiting to test.
- The rule is about the *next* event, not the previous one, which is why an event at time 0 can survive and one at time 50 not.
- Debouncing is for input; throttling — at most one per window — is for output. Reaching for the wrong one gives you a search box that feels sticky.

#### Docs
- [Kotlin flows on Android](https://developer.android.com/kotlin/flow)

### 4. Another page arrives

An infinite list asks for page two while page one is on screen. The server may have changed a row you already have, and it may repeat one at a page boundary.

`appendPage(loaded, page)` returns the new list. Every note already loaded keeps its position. A note in the page whose id is already loaded **replaces** that entry where it sits — it does not move to the end and it does not appear twice. A note with an id you have not seen is appended, in page order. A page that repeats an id within itself follows the same rule.

```kotlin starter
data class Note(val id: Long, val title: String)

fun appendPage(loaded: List<Note>, page: List<Note>): List<Note> = loaded + page
```

```kotlin test
class AppendPageTest {
    // the ordinary case
    @Test
    fun appends() {
        val loaded = listOf(Note(1, "a"), Note(2, "b"))
        val page = listOf(Note(3, "c"), Note(4, "d"))
        assertEquals(loaded + page, appendPage(loaded, page))
        assertEquals(page, appendPage(emptyList(), page))
        assertEquals(loaded, appendPage(loaded, emptyList()))
    }

    // an overlap at the page boundary updates in place
    @Test
    fun overlaps() {
        val loaded = listOf(Note(1, "a"), Note(2, "b"))
        val page = listOf(Note(2, "b (edited)"), Note(3, "c"))
        assertEquals(
            listOf(Note(1, "a"), Note(2, "b (edited)"), Note(3, "c")),
            appendPage(loaded, page),
        )
    }

    // a page that repeats itself
    @Test
    fun repeatsWithin() {
        val page = listOf(Note(1, "first"), Note(2, "other"), Note(1, "second"))
        assertEquals(listOf(Note(1, "second"), Note(2, "other")), appendPage(emptyList(), page))
    }

    // ids are never duplicated, whatever arrives
    @Test
    fun unique() {
        val loaded = listOf(Note(1, "a"), Note(2, "b"), Note(3, "c"))
        val page = listOf(Note(3, "c2"), Note(1, "a2"), Note(9, "new"))
        val out = appendPage(loaded, page)
        assertEquals(listOf(1L, 2L, 3L, 9L), out.map { it.id })
        assertEquals(out.map { it.id }.distinct().size, out.size)
        assertEquals("a2", out.first().title)
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Room & DataStore › Offline-first and the single source of truth](#/persistence/offline-first-and-the-single-source-of-truth)

#### Hints
- Copy `loaded` into a `MutableList` and keep a `MutableMap<Long, Int>` from id to its index in that list.
- For each note in the page: if the map has its id, assign into the list at that index; otherwise record the new index and `add`.
- `loaded.withIndex().associate { (i, n) -> n.id to i }.toMutableMap()` builds the starting index.

#### Tips
- Duplicated ids in a keyed `LazyColumn` are a crash, not a glitch, which is why the rule is "never two entries with the same id" rather than "usually".
- Updating in place rather than appending is what stops a list jumping under a reader's finger when page two arrives.
- The Paging library does this for you and it is worth knowing what "for you" means before you rely on it.

#### Docs
- [Paging library overview](https://developer.android.com/topic/libraries/architecture/paging/v3-overview)

### 5. Both sides changed

Two devices edited the same field while one of them was offline. You have three values: what the field was at the last sync (`base`), what it is here (`local`), and what it is on the server (`remote`). Any of them may be `null`, meaning the field was absent or deleted.

`merge3(base, local, remote)` applies the three-way rules, in order:

1. `local` and `remote` agree — take that value, whatever `base` was.
2. `local` equals `base` — only the remote changed, so take `remote`.
3. `remote` equals `base` — only the local changed, so take `local`.
4. Both changed, to different things — a `Conflict` carrying both.

```kotlin starter
sealed interface Merge {
    data class Value(val text: String?) : Merge
    data class Conflict(val local: String?, val remote: String?) : Merge
}

fun merge3(base: String?, local: String?, remote: String?): Merge = Merge.Value(local)
```

```kotlin test
class Merge3Test {
    // nobody changed anything, or both made the same change
    @Test
    fun agreed() {
        assertEquals(Merge.Value("x"), merge3("x", "x", "x"))
        assertEquals(Merge.Value("y"), merge3("x", "y", "y"))
        assertEquals(Merge.Value(null), merge3("x", null, null))
    }

    // one side changed
    @Test
    fun oneSided() {
        assertEquals(Merge.Value("remote"), merge3("base", "base", "remote"))
        assertEquals(Merge.Value("local"), merge3("base", "local", "base"))
        assertEquals(Merge.Value("new"), merge3(null, null, "new"))
        assertEquals(Merge.Value(null), merge3("base", null, "base"))
    }

    // both changed, differently
    @Test
    fun conflicts() {
        assertEquals(Merge.Conflict("mine", "theirs"), merge3("base", "mine", "theirs"))
        assertEquals(Merge.Conflict(null, "theirs"), merge3("base", null, "theirs"))
        assertEquals(Merge.Conflict("mine", null), merge3("base", "mine", null))
        assertEquals(Merge.Conflict("mine", "theirs"), merge3(null, "mine", "theirs"))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Room & DataStore › Offline-first and the single source of truth](#/persistence/offline-first-and-the-single-source-of-truth)

#### Hints
- Four `if`s in the order given, each returning. The order is what makes the `null` cases work without a special case.
- `==` on nullable `String`s already treats `null == null` as true, so you need no null checks at all.
- Only the fourth branch builds a `Conflict`.

#### Tips
- Three-way merging is why version control can merge a file two people edited and a last-write-wins sync cannot. The extra information is the `base`.
- Storing `base` means keeping the last synced copy of every row, which costs space. That is the trade: space for the ability to tell "changed" from "different".
- A `Conflict` has to reach a human eventually. An app that silently picks a side on a document is an app that loses work.

#### Docs
- [Build an offline-first app](https://developer.android.com/topic/architecture/data-layer/offline-first)

### 6. The back stack

Navigation is a stack of routes with two awkward options bolted on. Implement both.

`navigate(stack, route, singleTop, popUpTo)` returns the new stack, given the current one with the top at the end.

- When `popUpTo` is given, first pop everything above the **last** occurrence of that route, leaving it on top. A `popUpTo` that is not in the stack throws `IllegalArgumentException` with the message `"$popUpTo is not in the back stack"`.
- Then, when `singleTop` is true and the route is already on top, the stack is returned unchanged rather than pushing a second copy.
- Otherwise the route is pushed.

`back(stack)` pops the top, except that the last entry is never popped: a stack of one is returned unchanged, and so is an empty one.

```kotlin starter
fun navigate(stack: List<String>, route: String, singleTop: Boolean, popUpTo: String?): List<String> = stack + route

fun back(stack: List<String>): List<String> = stack
```

```kotlin test
class BackStackTest {
    // pushing and popping
    @Test
    fun pushPop() {
        assertEquals(listOf("home", "detail"), navigate(listOf("home"), "detail", false, null))
        assertEquals(listOf("home"), back(listOf("home", "detail")))
        assertEquals(listOf("home"), back(listOf("home")))
        assertEquals(emptyList<String>(), back(emptyList()))
    }

    // singleTop refuses to stack a screen on itself
    @Test
    fun singleTop() {
        assertEquals(listOf("home", "detail"), navigate(listOf("home", "detail"), "detail", true, null))
        assertEquals(listOf("home", "detail", "detail"), navigate(listOf("home", "detail"), "detail", false, null))
        assertEquals(listOf("home", "detail", "home"), navigate(listOf("home", "detail"), "home", true, null))
    }

    // popUpTo unwinds to a route and leaves it there
    @Test
    fun popUpTo() {
        val stack = listOf("home", "list", "detail", "edit")
        assertEquals(listOf("home", "list"), navigate(stack, "list", true, "list"))
        assertEquals(listOf("home", "list", "detail"), navigate(stack, "detail", true, "detail"))
        assertEquals(listOf("home", "settings"), navigate(stack, "settings", false, "home"))
    }

    // the last occurrence, and a route that is not there
    @Test
    fun edges() {
        val looped = listOf("home", "detail", "home", "detail")
        assertEquals(listOf("home", "detail", "home", "profile"), navigate(looped, "profile", false, "home"))

        var message: String? = null
        try {
            navigate(listOf("home"), "detail", false, "missing")
        } catch (e: IllegalArgumentException) {
            message = e.message
        }
        assertEquals("missing is not in the back stack", message)
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Dependency injection › Lifetimes and scopes](#/di/lifetimes-and-scopes)

#### Hints
- `stack.indexOfLast { it == popUpTo }` gives you the position, and `-1` when it is not there.
- `stack.take(index + 1)` is the stack with that route on top.
- Do the `popUpTo` work first into a local, then apply the `singleTop` check to *that* stack, not to the original.

#### Tips
- `navigate(stack, "list", true, "list")` — pop up to `list`, then refuse to push it again — is how a "back to the list" button avoids growing the stack forever.
- Real Navigation also has `inclusive` (pop the target too) and `saveState`. The shape is the same; there are just more flags.
- The back stack belongs to navigation, and the state of each screen belongs to its ViewModel. Mixing them is how you get a screen that forgets its scroll position on the way back.

#### Docs
- [Navigation in Compose](https://developer.android.com/develop/ui/compose/navigation)

### 7. Surviving process death

The system can kill your process while the user is in another app, and rebuild the screen from a `Bundle` when they come back. That round trip is a pure function and deserves a test.

`toBundle(state)` writes the three fields under the keys `"title"`, `"tags"` and `"draftCount"`. `fromBundle(saved)` reads them back, and must survive a bundle that is missing keys or holds the wrong types — because a bundle written by an older version of your app is exactly that. A missing or wrong-typed value falls back to the default: `""`, an empty list, `0`. A `"tags"` value that is a list keeps only its `String` elements.

```kotlin starter
data class FormState(
    val title: String = "",
    val tags: List<String> = emptyList(),
    val draftCount: Int = 0,
)

fun toBundle(state: FormState): Map<String, Any> = emptyMap()

fun fromBundle(saved: Map<String, Any>): FormState = FormState()
```

```kotlin test
class SavedStateTest {
    // what goes out comes back
    @Test
    fun roundTrip() {
        val state = FormState("Sourdough", listOf("baking", "weekend"), 2)
        assertEquals(state, fromBundle(toBundle(state)))
        assertEquals(FormState(), fromBundle(toBundle(FormState())))
    }

    // the keys are the ones the rest of the app expects
    @Test
    fun keys() {
        val bundle = toBundle(FormState("t", listOf("a"), 7))
        assertEquals("t", bundle["title"])
        assertEquals(listOf("a"), bundle["tags"])
        assertEquals(7, bundle["draftCount"])
    }

    // a bundle from an older version
    @Test
    fun missingKeys() {
        assertEquals(FormState(), fromBundle(emptyMap()))
        assertEquals(FormState(title = "only"), fromBundle(mapOf("title" to "only")))
        assertEquals(FormState(draftCount = 3), fromBundle(mapOf("draftCount" to 3)))
    }

    // a bundle from a version that stored something else entirely
    @Test
    fun wrongTypes() {
        assertEquals(FormState(), fromBundle(mapOf("title" to 42, "draftCount" to "3")))
        assertEquals(FormState(), fromBundle(mapOf("tags" to "baking")))
        assertEquals(
            FormState(tags = listOf("baking")),
            fromBundle(mapOf("tags" to listOf("baking", 7, null))),
        )
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Testing › Test the state, not the screen](#/testing/test-the-state-not-the-screen)

#### Hints
- `saved["title"] as? String ?: ""` is the whole pattern: a safe cast, then a default.
- For the list: `(saved["tags"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()`.
- `mapOf("title" to state.title, ...)` is all `toBundle` needs; the values are already `Any`.

#### Tips
- `as?` returning `null` rather than throwing is what makes forward and backward compatibility cheap. A plain cast here is a crash on a version upgrade.
- A real `Bundle` holds only a fixed set of types. If the state does not fit, it belongs in a ViewModel or the database, not in saved state.
- `SavedStateHandle` in a ViewModel and `rememberSaveable` in a composable both come down to this: a map of primitives that survives the process.

#### Docs
- [Save UI state](https://developer.android.com/topic/libraries/architecture/saving-states)

### 8. Is now a good time to sync?

Background work has constraints, and the constraints are a decision table. Write it down so it can be argued about and tested rather than rediscovered in a battery complaint.

`shouldSync(conditions)` applies these rules **in order**:

1. Nothing pending — never sync.
2. Charging — sync, whatever else is true.
3. Battery below 15% — do not sync.
4. On a metered connection, sync only when there are 10 or more changes waiting.
5. Otherwise, sync.

```kotlin starter
data class Conditions(
    val pendingChanges: Int,
    val metered: Boolean,
    val batteryPercent: Int,
    val charging: Boolean,
)

fun shouldSync(conditions: Conditions): Boolean = true
```

```kotlin test
class ShouldSyncTest {
    // nothing to do
    @Test
    fun nothingPending() {
        assertFalse(shouldSync(Conditions(0, metered = false, batteryPercent = 100, charging = true)))
        assertFalse(shouldSync(Conditions(-1, metered = false, batteryPercent = 100, charging = true)))
    }

    // plugged in is permission for almost anything
    @Test
    fun charging() {
        assertTrue(shouldSync(Conditions(1, metered = true, batteryPercent = 2, charging = true)))
        assertTrue(shouldSync(Conditions(100, metered = true, batteryPercent = 5, charging = true)))
    }

    // a low battery stops it
    @Test
    fun lowBattery() {
        assertFalse(shouldSync(Conditions(50, metered = false, batteryPercent = 14, charging = false)))
        assertTrue(shouldSync(Conditions(50, metered = false, batteryPercent = 15, charging = false)))
    }

    // mobile data is only worth it for a real batch
    @Test
    fun metered() {
        assertFalse(shouldSync(Conditions(9, metered = true, batteryPercent = 90, charging = false)))
        assertTrue(shouldSync(Conditions(10, metered = true, batteryPercent = 90, charging = false)))
        assertTrue(shouldSync(Conditions(1, metered = false, batteryPercent = 90, charging = false)))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Room & DataStore › Offline-first and the single source of truth](#/persistence/offline-first-and-the-single-source-of-truth)

#### Hints
- Five rules, five lines, in order. `if (conditions.pendingChanges <= 0) return false` first.
- Rule 2 returning `true` before rule 3 is what makes the charging tests pass with a 2% battery.
- The last rule needs no condition at all.

#### Tips
- WorkManager expresses the same thing as `Constraints` — `setRequiresCharging`, `setRequiredNetworkType`, `setRequiresBatteryNotLow` — and the system enforces them for you. Writing the table out first tells you which constraints to ask for.
- A rule table read in a different order is a different app. Ordering the rules is the design work; the code is a formality.
- Notice that rule 1 makes every later rule cheaper to reason about: nothing below it has to think about an empty queue.

#### Docs
- [Define work constraints](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work#work-constraints)

### 9. What starts first

An object graph has an order: the database needs a context, the repository needs the database, the sync worker needs the repository. Work out the order, and notice when there isn't one.

`initOrder(dependencies)` returns every component exactly once, each one after everything it depends on. A name that appears only inside a dependency list is still a component, with no dependencies of its own. When several components could go next, take them in alphabetical order, so the answer is the same on every run. A cycle throws `IllegalStateException` with the message `"dependency cycle"`.

```kotlin starter
fun initOrder(dependencies: Map<String, List<String>>): List<String> = dependencies.keys.toList()
```

```kotlin test
class InitOrderTest {
    // dependencies first, ties alphabetically
    @Test
    fun ordering() {
        val graph = mapOf(
            "app" to listOf("db", "network"),
            "db" to listOf("context"),
            "network" to listOf("context"),
            "context" to emptyList(),
        )
        assertEquals(listOf("context", "db", "network", "app"), initOrder(graph))
    }

    // a name that is only ever depended on still gets initialised
    @Test
    fun implicitNodes() {
        assertEquals(listOf("context", "db"), initOrder(mapOf("db" to listOf("context"))))
        assertEquals(listOf("a", "b", "c"), initOrder(mapOf("c" to listOf("a", "b"))))
        assertEquals(emptyList<String>(), initOrder(emptyMap()))
    }

    // independent components come out sorted
    @Test
    fun independent() {
        val graph = mapOf("zebra" to emptyList<String>(), "ant" to emptyList(), "moose" to emptyList())
        assertEquals(listOf("ant", "moose", "zebra"), initOrder(graph))
    }

    // a cycle has no order at all
    @Test
    fun cycles() {
        val messages = mutableListOf<String?>()
        val graphs = listOf(
            mapOf("a" to listOf("b"), "b" to listOf("a")),
            mapOf("a" to listOf("a")),
            mapOf("a" to listOf("b"), "b" to listOf("c"), "c" to listOf("a"), "d" to emptyList()),
        )
        for (graph in graphs) {
            try {
                initOrder(graph)
            } catch (e: IllegalStateException) {
                messages.add(e.message)
            }
        }
        assertEquals(List(3) { "dependency cycle" }, messages)
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Dependency injection › A graph by hand](#/di/a-graph-by-hand)
- [Reference › Lists, sets and maps](#/reference/lists-sets-and-maps)

#### Hints
- Collect every name first: the keys, plus everything in every dependency list. `toSortedSet()` keeps them in alphabetical order for you.
- Repeatedly take the alphabetically first name whose dependencies have all been placed already, and place it.
- When a round finds nothing ready and names are still left, that is the cycle: `error("dependency cycle")`.

#### Tips
- This is a topological sort, and the "alphabetically first ready" rule is what makes it deterministic — without it, two runs can give different valid answers and your test becomes flaky.
- Dagger and Hilt do this at compile time, which is why a cycle in a Hilt graph is a build error with the loop printed out rather than a stack overflow at launch.
- A cycle in a real graph is almost always a design problem: two classes that each need the other usually want a third thing they both need.

#### Docs
- [Manual dependency injection](https://developer.android.com/training/dependency-injection/manual)

### 10. What actually changed

With stable keys, Compose recomposes only the rows whose content changed. Work out which those are — it is also the list you would log when a screen redraws more than you expected.

`changedKeys(before, after)` returns the ids of the items in `after`, in `after`'s order, that are either new or different from the item with the same id in `before`. An item that only moved is not a change. An item that disappeared is not reported at all, because there is nothing left to recompose.

```kotlin starter
data class Item(val id: Long, val title: String)

fun changedKeys(before: List<Item>, after: List<Item>): List<Long> = after.map { it.id }
```

```kotlin test
class ChangedKeysTest {
    // only the edited row
    @Test
    fun edits() {
        val before = listOf(Item(1, "a"), Item(2, "b"), Item(3, "c"))
        val after = listOf(Item(1, "a"), Item(2, "B!"), Item(3, "c"))
        assertEquals(listOf(2L), changedKeys(before, after))
        assertEquals(emptyList<Long>(), changedKeys(before, before))
    }

    // moving is not changing
    @Test
    fun reorder() {
        val before = listOf(Item(1, "a"), Item(2, "b"), Item(3, "c"))
        val after = listOf(Item(3, "c"), Item(1, "a"), Item(2, "b"))
        assertEquals(emptyList<Long>(), changedKeys(before, after))
    }

    // arrivals count, departures do not
    @Test
    fun insertsAndRemovals() {
        val before = listOf(Item(1, "a"), Item(2, "b"))
        assertEquals(listOf(9L), changedKeys(before, listOf(Item(9, "new"), Item(1, "a"), Item(2, "b"))))
        assertEquals(emptyList<Long>(), changedKeys(before, listOf(Item(1, "a"))))
        assertEquals(listOf(1L, 2L), changedKeys(emptyList(), before))
        assertEquals(emptyList<Long>(), changedKeys(before, emptyList()))
    }

    // order follows the new list
    @Test
    fun ordering() {
        val before = listOf(Item(1, "a"), Item(2, "b"), Item(3, "c"))
        val after = listOf(Item(3, "C"), Item(2, "b"), Item(1, "A"))
        assertEquals(listOf(3L, 1L), changedKeys(before, after))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Performance › Recomposition, and why it is usually fine](#/performance/recomposition-and-why-it-is-usually-fine)

#### Hints
- `before.associateBy { it.id }` gives you a lookup from id to the old item.
- Then it is one filter over `after`: keep the item when the lookup misses, or when the looked-up item is not equal to it.
- `data class` equality compares every property, so `!=` is the whole comparison.

#### Tips
- Without keys the runtime compares by position instead, so inserting one row at the top makes every row below it look changed. That is the entire argument for `key = { it.id }` in one sentence.
- A change list like this one is also what a `DiffUtil` callback computes for a `RecyclerView` — same idea, older API.
- If this returns everything on every update, look at whether something upstream is rebuilding the items rather than reusing them.

#### Docs
- [Compose performance: use lazy layout keys](https://developer.android.com/develop/ui/compose/performance/bestpractices)

### 11. Which version is in trouble

A rollout is running and you have per-version numbers. Find the one to worry about.

`worstVersion(reports, minSessions)` considers only versions with at least `minSessions` sessions, and returns the one with the lowest crash-free rate — the fraction of sessions that did not crash. When two versions tie on the rate, the one with more sessions wins, because it is better evidence; when they still tie, the alphabetically first version name. If no version has enough sessions, return `null`.

```kotlin starter
data class Report(val version: String, val sessions: Int, val crashes: Int)

fun worstVersion(reports: List<Report>, minSessions: Int): String? = reports.firstOrNull()?.version
```

```kotlin test
class WorstVersionTest {
    // the lowest crash-free rate
    @Test
    fun worst() {
        val reports = listOf(
            Report("2.4.0", 10_000, 20),
            Report("2.4.1", 8_000, 96),
            Report("2.3.9", 40_000, 40),
        )
        assertEquals("2.4.1", worstVersion(reports, 1000))
        assertEquals("2.4.1", worstVersion(reports, 8000))
    }

    // small samples are ignored, however bad they look
    @Test
    fun sampleSize() {
        val reports = listOf(
            Report("2.4.0", 10_000, 20),
            Report("2.4.1", 12, 12),
        )
        assertEquals("2.4.0", worstVersion(reports, 1000))
        assertNull(worstVersion(reports, 50_000))
        assertNull(worstVersion(emptyList(), 1))
    }

    // ties go to the better evidence, then to the name
    @Test
    fun ties() {
        val reports = listOf(
            Report("2.4.1", 1_000, 10),
            Report("2.4.0", 5_000, 50),
            Report("2.3.0", 5_000, 50),
        )
        assertEquals("2.3.0", worstVersion(reports, 1000))
    }

    // a version with no crashes at all can still be the worst one
    @Test
    fun allHealthy() {
        val reports = listOf(Report("2.4.0", 1_000, 0), Report("2.4.1", 2_000, 0))
        assertEquals("2.4.1", worstVersion(reports, 1000))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Shipping to Play › Watching the release](#/release/watching-the-release)

#### Hints
- Filter by `sessions >= minSessions` first, then `minWithOrNull` over a comparator — or sort and take the first.
- The comparator is `compareBy<Report> { (it.sessions - it.crashes).toDouble() / it.sessions }.thenByDescending { it.sessions }.thenBy { it.version }`.
- `.toDouble()` before the division, or every rate is 0 or 1.

#### Tips
- Sorting version strings alphabetically is only a tiebreak here. Comparing `"2.10.0"` and `"2.9.0"` as text gets the wrong answer, which is why version *codes* are integers.
- The `allHealthy` case is the reminder that "worst" is relative. A dashboard that only shows the worst version always shows something alarming.
- Rate first, then sample size, then name: every tie is settled, so the answer never depends on the order the reports arrived in.

#### Docs
- [Android vitals](https://developer.android.com/topic/performance/vitals)

### 12. Settings that survive an upgrade

Preferences are read from storage that may have been written by any version of your app you ever shipped. Read them defensively, and migrate the key you renamed.

`readSettings(stored)` builds a `Settings` from a map of strings:

- `theme` — the stored `"theme"` when it is `"light"`, `"dark"` or `"system"`. Otherwise, if the old `"darkMode"` key is there, `"true"` becomes `"dark"` and `"false"` becomes `"light"`. Otherwise `"system"`.
- `sortNewestFirst` — `false` when `"sort"` is exactly `"title"`, and `true` for anything else, including a missing key.
- `pageSize` — the stored `"pageSize"` when it parses as a number in `10..100`, otherwise `20`.

```kotlin starter
data class Settings(val theme: String, val sortNewestFirst: Boolean, val pageSize: Int)

fun readSettings(stored: Map<String, String>): Settings = Settings("system", true, 20)
```

```kotlin test
class ReadSettingsTest {
    // a fresh install
    @Test
    fun defaults() {
        assertEquals(Settings("system", true, 20), readSettings(emptyMap()))
    }

    // everything set
    @Test
    fun stored() {
        val map = mapOf("theme" to "dark", "sort" to "title", "pageSize" to "50")
        assertEquals(Settings("dark", false, 50), readSettings(map))
        assertEquals(Settings("light", true, 10), readSettings(mapOf("theme" to "light", "pageSize" to "10")))
    }

    // the renamed key still works
    @Test
    fun migration() {
        assertEquals(Settings("dark", true, 20), readSettings(mapOf("darkMode" to "true")))
        assertEquals(Settings("light", true, 20), readSettings(mapOf("darkMode" to "false")))
        assertEquals(Settings("system", true, 20), readSettings(mapOf("darkMode" to "maybe")))
        assertEquals(
            Settings("system", true, 20),
            readSettings(mapOf("theme" to "neon", "darkMode" to "nonsense")),
        )
    }

    // a new key always wins over the old one
    @Test
    fun rubbish() {
        assertEquals(Settings("light", true, 20), readSettings(mapOf("theme" to "light", "darkMode" to "true")))
        assertEquals(Settings("system", true, 20), readSettings(mapOf("pageSize" to "9")))
        assertEquals(Settings("system", true, 20), readSettings(mapOf("pageSize" to "101")))
        assertEquals(Settings("system", true, 20), readSettings(mapOf("pageSize" to "lots")))
        assertEquals(Settings("system", true, 100), readSettings(mapOf("pageSize" to "100")))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Room & DataStore › DataStore for preferences](#/persistence/datastore-for-preferences)

#### Hints
- Work the theme out in three steps: the valid stored value, then the migration, then the default — `stored["theme"]?.takeIf { it in setOf("light", "dark", "system") }` for the first.
- `stored["pageSize"]?.toIntOrNull()?.takeIf { it in 10..100 } ?: 20` handles every `pageSize` case in one expression.
- `when (stored["darkMode"]) { "true" -> "dark"; "false" -> "light"; else -> null }` keeps the migration readable and leaves the default to an elvis.

#### Tips
- Reading with a default at the point of reading, rather than writing defaults in at install time, means a key you add in version 5 works on a device that installed version 1.
- `takeIf { }` is the neat way to turn a value you do not like into a `null` that the `?:` can catch.
- Keep the migration until you are sure nobody is still on the old version, then delete it — and write down why it was there, or somebody will delete it next month instead.

#### Docs
- [DataStore](https://developer.android.com/topic/libraries/architecture/datastore)
- [Migrate from SharedPreferences to DataStore](https://developer.android.com/topic/libraries/architecture/datastore#datastore-typed-prefs)
