# Reference

A lookup page, not a step on the roadmap. It covers three things: the test block the exercises run in, the Kotlin standard library calls those exercises reach for, and a glossary of the Android APIs that show up in the articles and the build-task solutions but cannot be compiled in a browser.

Nothing here has to be read in order. Exercises link to the section they need. Every Kotlin sample below was run on the same compiler the exercises use; the Android entries were not, because nothing here can run them — that limit has [its own section](#/reference/what-does-not-run-here).

## How the tests work

Every logic exercise has two editors: your code on the left, and a **test block** you cannot change. The test block is the specification. Read it before you write anything — it shows the exact types, the exact strings, and the edge cases the description only summarises.

The test block is a class of test functions:

```kotlin
class BadgeTest {
    // an empty cart still shows a number
    @Test
    fun empty() {
        assertEquals("0", badge(CartState.Ready(emptyList())))
    }
}
```

Four things to notice:

- **`class BadgeTest`** — an ordinary class, compiled together with your code, so it can call anything you declare at the top level.
- **`@Test`** — marks one test. Each one runs and is reported separately, so a failure does not hide the others.
- **The `//` comment above `@Test`** — the label shown in the results. `// an empty cart still shows a number` is why the list says that instead of `empty`.
- **A test passes by returning and fails by throwing.** That is the whole protocol. An assertion is just a function that throws when it does not like what it sees.

Imports written inside a test block are **hoisted to the top of the file for you**, so a test can start with `import kotlinx.coroutines.runBlocking` even though Kotlin only allows imports at the top of a file. There is one thing to know about that: an import you already wrote in your own editor is not hoisted a second time. Kotlin treats a duplicate import as an ambiguity rather than a harmless repeat, so the hoisting skips anything your code already imports. `org.junit.Test` and `org.junit.Assert.*` are always there.

A `@Test` function cannot be `suspend`. Tests that need coroutines wrap their body in `runBlocking { ... }`.

The other kind of exercise is a **build task**: a screen, built in Android Studio against a checklist, with a reference solution to compare against. Nothing marks those, and nothing on this page can.

- [Testing fundamentals](https://developer.android.com/training/testing/fundamentals)

## Assertions

These come from `org.junit.Assert`, imported for you. In every one the **expected value comes first** and the value your code produced comes second. Swapping them does not change whether the test passes, only which half of the failure message is a lie.

- `assertEquals(expected, actual)` — fails unless `expected == actual`, compared with `equals`, so lists and data classes compare by content. `assertEquals(listOf(1, 2), parse("1,2"))`.
- `assertEquals(message, expected, actual)` — the same, with a string shown first in the failure.
- `assertEquals(expected, actual, delta)` — for `Double`, where exact equality is the wrong question. `assertEquals(4.5, contrast(a, b), 0.05)`.
- `assertTrue(message, condition)` — fails when the condition is `false`. `assertTrue("48dp or more", target.height >= 48)`.
- `assertFalse(message, condition)` — the negation.
- `assertNull(actual)` / `assertNotNull(actual)` — fails unless the value is (or is not) `null`. `assertNull(resolve("nope"))`.
- `assertSame(expected, actual)` / `assertNotSame(expected, actual)` — compares **identity**, not `equals`. This is the assertion a dependency-injection test wants: "did the container hand back the same instance, or build a second one?".
- `fail(message)` — throws unconditionally, to mark a line that should never be reached.

Prefer `assertEquals` wherever you can: "expected 3 but was 5" says more than "the condition was false". Reach for `assertTrue` only when the check is not an equality, and give it a message.

Checking that something throws has no assertion of its own here. Call it, then fail if it returns:

```kotlin
try {
    Version.parse("1.x")
    throw AssertionError("expected a throw")
} catch (e: IllegalArgumentException) {
    assertEquals("not a version: 1.x", e.message)
}
```

The `throw AssertionError` line is the important one. Without it, a version that never throws passes silently.

- [Assert javadoc](https://junit.org/junit4/javadoc/latest/org/junit/Assert.html)

## Strings

A `String` is immutable: everything below returns a new one and leaves the receiver alone.

- `str.length` — the number of characters. `"kotlin".length` is `6`.
- `str.trim()` — whitespace off both ends. `"  hi  ".trim()` is `"hi"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/trim.html)
- `str.isEmpty()` / `str.isNotEmpty()` — is the length zero.
- `str.isBlank()` / `str.isNotBlank()` — empty **or only whitespace**. `"   ".isBlank()` is `true`. The one to use on anything a user typed. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-blank.html)
- `str.lowercase()` / `str.uppercase()` — `"en-GB".lowercase()` is `"en-gb"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/lowercase.html)
- `str.startsWith(p)` / `str.endsWith(s)` — `Boolean`. `"en-GB".startsWith("en")` is `true`.
- `str.contains(part)`, or `part in str` — is it anywhere inside. `"tl" in "kotlin"` is `true`.
- `str.split(sep)` — a `List<String>`; empty pieces are kept. `"a,b,,c".split(",")` is `[a, b, , c]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/split.html)
- `str.split(Regex("\\s+"))` — split on runs of whitespace. `"a b  c".split(Regex("\\s+"))` is `[a, b, c]`.
- `str.substringBefore(x)` / `str.substringAfter(x)` — everything before or after the **first** `x`, and the **whole string** when `x` is not there. `"en-GB".substringBefore('-')` is `"en"`, and so is `"en".substringBefore('-')`. That fallback is why these two are the easy way to parse a tag that may or may not have a region. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/substring-after.html)
- `str.substringAfterLast(x)` / `str.substringBeforeLast(x)` — the same from the other end. `"a=1=2".substringAfterLast('=')` is `"2"`.
- `str.substring(from, to)` — from `from` up to but not including `to`; throws past the end.
- `str.removePrefix(p)` / `str.removeSuffix(s)` — drop it if present, otherwise return the string unchanged. `"#FF6750A4".removePrefix("#")` is `"FF6750A4"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/remove-prefix.html)
- `str.replace(old, new)` — every occurrence.
- `str.padStart(width, char)` / `str.padEnd(width, char)` — pad to a width, or return it unchanged if already that long. `"ab".padStart(5, '.')` is `"...ab"`.
- `str.repeat(n)` — `"ab".repeat(3)` is `"ababab"`.
- `str.toIntOrNull()` / `str.toLongOrNull()` / `str.toDoubleOrNull()` — `null` instead of throwing, with no trimming and no leniency. `"4x".toIntOrNull()` is `null`. This is the parser to use on anything from a file, a header or a text field. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int-or-null.html)
- `str.toInt()` — throws `NumberFormatException` on anything else.
- `str.toIntOrNull(16)` — parse in another radix; `"FF".toIntOrNull(16)` is `255`, which is how a hex colour becomes a number.
- `"%.1f".format(x)` / `"%02d".format(n)` — Java-style formatting. `"%.1f".format(4.55)` is `"4.6"`, `"%02d".format(9)` is `"09"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/format.html)
- `buildString { append(x) }` — a `StringBuilder` scope returning the finished string.
- `str.orEmpty()` — callable on a `String?`; `null` becomes `""`. `e.message.orEmpty()` is the usual way to put an exception into UI state.

A `Char` is its own type, in single quotes, not a one-letter string: `c.isDigit()`, `c.isLetter()`, `c.isWhitespace()`, `c.digitToInt()`, `c.lowercaseChar()`, `c.code`.

## Numbers

- `a.coerceAtMost(max)` — the value, capped. `(30_000L * 4).coerceAtMost(10_000L)` is `10_000` — one line of backoff ceiling. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.ranges/coerce-at-most.html)
- `a.coerceAtLeast(min)` — the value, floored. `12.coerceAtLeast(48)` is `48`.
- `a.coerceIn(min, max)` — both at once. `7.coerceIn(1, 5)` is `5`.
- `maxOf(a, b)` / `minOf(a, b)` — of two (or more) values, not of a collection.
- Integer division truncates toward zero: `59_999L / 60_000L` is `0`. Most "how long ago" formatting is exactly that, with no rounding code needed.
- `abs(x)`, `min`, `max`, `sqrt`, `pow`, `ln` — from `kotlin.math`, which you import. `abs(-3.5)` is `3.5`.
- `x.roundToInt()` — `(16 * 2.625).roundToInt()` is `42`. The dp-to-pixel conversion in this roadmap is this function.
- `1..5`, `1 until 5`, `5 downTo 1`, `1..9 step 2` — ranges. `x in 1..5` is an inclusive test.
- Enums: `Phase.STARTED.ordinal` is its position, counting from `0`, and enums compare by that position, so `Phase.RESUMED >= Phase.STARTED` is `true`. `Phase.entries` is the list of all of them, in declaration order. [docs](https://kotlinlang.org/docs/enum-classes.html)

## Lists, sets and maps

- `listOf(a, b)`, `setOf(a, b)`, `mapOf(k to v)` — read-only. `mutableListOf()`, `mutableMapOf()`, `mutableSetOf()` when you need to add.
- `emptyList<T>()`, `emptySet<T>()`, `emptyMap<K, V>()` — the empty ones, with no allocation. `emptyList<Int>()` equals `listOf<Int>()`; a test comparing against "nothing" almost always writes `emptyList()`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/empty-list.html)
- `list.size`, `list.isEmpty()`, `list.isNotEmpty()`.
- `list[i]` — throws past the end. `list.getOrNull(i)` returns `null` instead; `list.getOrElse(i) { default }` computes one. `listOf(1, 2).getOrElse(5) { 0 }` is `0`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/get-or-else.html)
- `list.first()` / `list.last()` throw on empty; `firstOrNull()` / `lastOrNull()` do not.
- `map[k]` is already `null` on a miss. `map.getOrElse(k) { d }` gives a default, `map.getOrDefault(k, d)` a constant one, and `mutable.getOrPut(k) { d }` stores the default as it returns it.
- `map.keys`, `map.values`, `map.entries`, and `for ((k, v) in map)`.
- `map.mapValues { it.value + 1 }`, `map.filterKeys { … }`, `map.filterValues { … }` — a new map each time.
- `list.toList()`, `list.toSet()`, `map.toList()` — a copy in another shape. `mapOf("a" to 1).toList()` is `[(a, 1)]`, a list of `Pair`s, which is how you sort a map. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/to-list.html)
- `list.toSortedSet()` — a `SortedSet`, so it deduplicates **and** orders in one call. `listOf("b", "a", "b").toSortedSet().toList()` is `[a, b]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/to-sorted-set.html)
- `a intersect b`, `a union b`, `a subtract b` — set algebra on any two collections, returning a `Set`. `setOf(1, 2, 3) intersect setOf(2, 3, 4)` is `[2, 3]` — the natural way to ask "which of these changed and is also on screen". [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/intersect.html)
- `list + other`, `list - item` — a new collection, never a mutation.
- `nullableList.orEmpty()` — `null` becomes the empty list, so the call site stops branching. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/or-empty.html)

## Collection operations

All of these return a new collection and leave the receiver alone.

- `map { }` — one in, one out. `flatMap { }` when each element produces several.
- `mapIndexed { i, x -> }` / `forEachIndexed { i, x -> }` — with the position.
- `filter { }` — keep what matches. `filterNot { }` — keep what does not, which reads better than a negated lambda. `listOf(1, 2, 3, 4).filterNot { it % 2 == 0 }` is `[1, 3]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/filter-not.html)
- `filterNotNull()` — drop the nulls and change the type from `List<T?>` to `List<T>`. `filterIsInstance<T>()` — keep one subtype of a sealed hierarchy.
- `any { }`, `all { }`, `none { }` — a `Boolean`. `any()` with no lambda is `isNotEmpty()`.
- `count { }` — how many match. `sumOf { }` — add a property up; an empty list sums to `0`.
- `groupBy { }` — `Map<K, List<T>>`. `associateBy { }` — `Map<K, T>`, keeping the **last** on a collision, which is what makes it the one-liner for "index these rows by id".
- `partition { }` — a `Pair` of the matches and the rest.
- `distinct()` / `distinctBy { }` — first occurrence wins, order kept.
- `take(n)` / `drop(n)` / `takeWhile { }` / `dropWhile { }`.
- `chunked(n)` — fixed-size batches. `windowed(n)` — every sliding pair or triple, which is how you compare each row with its neighbour.
- `zip(other)` — pairs, stopping at the shorter one.
- `fold(initial) { acc, x -> }` — accumulate with a starting value, and the only one that is safe on an empty list. `reduce { acc, x -> }` throws there.
- `joinToString(separator, prefix, postfix) { }` — one string out.
- [Collection operations overview](https://kotlinlang.org/docs/collection-operations.html)

## Sorting and picking

- `sortedBy { }` / `sortedByDescending { }` — a new list ordered by one property.
- `sortedWith(comparator)` — for anything more complicated. Build the comparator with `compareBy { }`, `thenBy { }`, `compareByDescending { }`.
- `sorted()` / `sortedDescending()` — for things that are already `Comparable`.
- `maxOrNull()` / `minOrNull()` — the largest or smallest value, `null` on an empty collection. `listOf(1, 7, 3).maxOrNull()` is `7`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-or-null.html)
- `maxByOrNull { }` / `minByOrNull { }` — the **element** whose selector is largest, not the selector's value. `listOf("a", "bbb", "cc").maxByOrNull { it.length }` is `"bbb"`.
- `maxWithOrNull(comparator)` / `minWithOrNull(comparator)` — the same, when the order needs a comparator rather than a single key. This is the one for "highest version", where `1.10.0` beats `1.2.0` and string order would say otherwise. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-with-or-null.html)
- Every `…OrNull` here has an older non-null twin that throws on empty. Prefer the `OrNull` version and decide what empty means yourself.

## Sequences

A `List` operation builds a whole new list at every step. A `Sequence` is lazy: nothing happens until a terminal operation asks for a value, and then each element travels the whole chain on its own. For the sizes in this roadmap it rarely matters; for a long chain over thousands of rows, or an infinite source, it does.

- `list.asSequence()` — start a lazy chain. `listOf(1, 2, 3).asSequence().map { it * 2 }.first { it > 2 }` is `4`, and never doubles the third element.
- `generateSequence(seed) { next }` — an infinite sequence from a rule. `generateSequence(1) { it * 2 }.take(4).toList()` is `[1, 2, 4, 8]` — a backoff ladder in one line. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.sequences/generate-sequence.html)
- `sequence { yield(x) }` — build one by hand.
- `toList()`, `first { }`, `firstOrNull { }`, `take(n)` — the terminal end of the chain. A sequence that is never terminated does nothing at all.
- [Sequences](https://kotlinlang.org/docs/sequences.html)

## Result and runCatching

`Result<T>` is a success or a failure in one value, which is what a repository hands a `ViewModel` when "it broke" is a state on screen and not a crash.

- `runCatching { … }` — runs the block and catches anything it throws. `runCatching { "x".toInt() }.getOrNull()` is `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.runCatching.html)
- `Result.success(v)` / `Result.failure(e)` — build one directly.
- `result.getOrNull()` — the value, or `null`. `result.exceptionOrNull()` — the throwable, or `null`.
- `result.getOrElse { e -> fallback }` — a value either way. `runCatching { "3".toInt() }.getOrElse { 0 }` is `3`.
- `result.getOrThrow()` — unwrap, rethrowing the failure.
- `result.isSuccess` / `result.isFailure`.
- `result.map { }` — transform the success, leave a failure alone. `mapCatching { }` when the transform itself can throw.
- `result.fold(onSuccess = { }, onFailure = { })` — collapse both sides into one value, usually the UI state. `runCatching { 2 }.fold({ "ok$it" }, { "err" })` is `"ok2"`.
- `result.onSuccess { }` / `result.onFailure { }` — side effects, returning the same `Result`.

One warning that matters on Android: `runCatching` catches `CancellationException` too, which quietly breaks coroutine cancellation. Inside a coroutine, either catch the specific exceptions you expect or rethrow cancellation yourself.

## Coroutines

The language side of coroutines is assumed here; these are the calls the exercises use.

- `suspend fun` — a function that can pause. It can only be called from another suspending function or a coroutine builder.
- `launch { }` — start a coroutine, return a `Job`, ignore the result. `async { }` — start one that returns a value, and `await()` it.
- `awaitAll()` on a list of `Deferred`, `joinAll()` on a list of `Job` — wait for all of them. `(1..50).map { launch { … } }.joinAll()` is how a test hammers a state holder from fifty coroutines at once. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/join-all.html)
- `delay(ms)` — suspend without blocking a thread.
- `withContext(dispatcher) { }` — run this part somewhere else and come back with its value. `withContext(Dispatchers.Default) { 2 + 2 }` is `4`.
- `Dispatchers.Main` (the UI thread), `Dispatchers.IO` (calls that block), `Dispatchers.Default` (CPU work). Take a `CoroutineDispatcher` as a constructor parameter with a default and a test can substitute one.
- `coroutineScope { }` — a scope that waits for its children; one child failing cancels the rest. `supervisorScope { }` — the same, except children fail independently.
- `runBlocking { }` — bridge from ordinary code into suspending code. Fine in a test, wrong in an app.
- `withTimeoutOrNull(ms) { }` — the block's value, or `null` if it ran long. `withTimeoutOrNull(1) { delay(1000); 1 }` is `null`.
- `job.cancel()`, `job.join()`, `job.isCancelled`. Cancellation is cooperative: it throws at the next suspension point, and a loop that never suspends must call `ensureActive()` or `yield()` itself.
- [Coroutines on Android](https://developer.android.com/kotlin/coroutines)

## Flow and StateFlow

A `Flow` is a cold stream: it does nothing until something collects it, and it runs again for each collector.

- `flowOf(a, b)` — a flow of fixed values. `flowOf(1, 2, 3).toList()` is `[1, 2, 3]`.
- `emptyFlow<T>()` — emits nothing and completes. `emptyFlow<Int>().toList()` is `[]`. The right "there is no query yet" value. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/empty-flow.html)
- `flow { emit(x) }` — build one by hand, from a suspending body.
- `map { }`, `filter { }`, `onEach { }` — the same names as on collections, applied per emission.
- `distinctUntilChanged()` — drop a value equal to the one before it, not every duplicate ever seen. `flowOf(1, 1, 2, 1).distinctUntilChanged().toList()` is `[1, 2, 1]`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/distinct-until-changed.html)
- `debounce(ms)` — emit only after a quiet gap, which is the whole of "do not search on every keystroke".
- `flatMapLatest { }` — switch to a new inner flow and cancel the previous one, so a stale response can never win. `flowOf(1, 2).flatMapLatest { flow { delay(20); emit(it * 10) } }.toList()` is `[20]`. `mapLatest { }` is the same cancellation rule for a plain transform. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/flat-map-latest.html)
- `combine(a, b) { x, y -> }` — a new value whenever **either** side emits, once both have.
- `merge(a, b)` — interleave two flows of the same type.
- `catch { emit(fallback) }` — handle an exception from upstream. `onStart { emit(loading) }` — put a value in front.
- `collect { }` — the terminal operation, suspending until the flow ends. `toList()`, `first()`, `firstOrNull()` also terminate it.
- `MutableStateFlow(initial)` — a hot flow holding exactly one current value. `.value` reads or writes it, `.update { }` applies a function atomically, and `.asStateFlow()` exposes the read-only half.
- A `StateFlow` **conflates and deduplicates**: setting `value` to something equal to the current value emits nothing, and a slow collector may miss intermediate values. Use `SharedFlow` (or a `Channel`) for one-shot events like "show a snackbar", where dropping a duplicate would be a bug.
- `flow.stateIn(scope, SharingStarted.WhileSubscribed(5_000), initial)` — turn a cold flow into a `StateFlow` shared by every collector, stopping five seconds after the last one goes away. That timeout is what keeps a rotation from restarting the work.
- [StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)

## Compose

From here down is the Android glossary: what each API is, its shape, and where the real documentation lives. None of it compiles on this page.

- `@Composable` — marks a function that describes UI. It can call other composables, returns `Unit`, and may run many times, in any order, on any thread. `@Composable fun Greeting(name: String) { Text("Hi, $name") }`. [docs](https://developer.android.com/develop/ui/compose/mental-model)
- `setContent { }` — on a `ComponentActivity`, hands the window to Compose. Everything below it is composables.
- `@Preview` — renders a composable in Android Studio with no device. `@Preview(showBackground = true, fontScale = 2f)`, or `uiMode = UI_MODE_NIGHT_YES` for dark. The function must take no required parameters. [docs](https://developer.android.com/develop/ui/compose/tooling/previews)
- `Text(text, style = , color = , maxLines = , overflow = )` — the text element. `Text("Your cart", style = MaterialTheme.typography.headlineMedium)`.
- `Button(onClick = { }) { Text("Save") }` — content goes in the trailing lambda, not a `text` parameter. `TextButton`, `OutlinedButton` and `FilledTonalButton` are the quieter variants.
- `Icon(imageVector, contentDescription)` — a tinted vector. `Icon(Icons.Default.ShoppingCart, contentDescription = "Cart")`. `Icons.Default` is the material icon set; `contentDescription = null` is correct **only** when the icon is decorative and a neighbouring label already says it. [docs](https://developer.android.com/develop/ui/compose/graphics/images/material)
- `OutlinedTextField(value, onValueChange, label = { Text("Email") }, isError = , supportingText = { })` — a text field. It is stateless: it shows `value` and reports edits, and something above it holds the state.
- `Card { }`, `Surface(color, tonalElevation) { }` — containers that carry a background, shape and elevation from the theme.
- `ListItem(headlineContent = { }, supportingContent = { }, leadingContent = { })` — the Material row, so you stop rebuilding one out of `Row`s.
- `Scaffold(topBar = { }, snackbarHost = { }) { padding -> }` — the screen skeleton. The lambda's `padding` is not optional: apply it with `Modifier.padding(padding)` or your content sits under the bars.
- `CircularProgressIndicator()` / `LinearProgressIndicator(progress = { 0.4f })` — the spinner and the bar.
- `Spacer(Modifier.height(16.dp))` — empty space, when padding on a neighbour would be the wrong thing to change.
- [Compose documentation](https://developer.android.com/develop/ui/compose/documentation)

## Layout

- `Column { }` — children stacked top to bottom. `Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) { }`.
- `Row { }` — left to right, with `horizontalArrangement` and `verticalAlignment`.
- `Box { }` — children on top of each other, positioned with `contentAlignment = Alignment.Center` or `Modifier.align()`.
- `Arrangement.spacedBy(8.dp)` — a gap **between** children, with none at the ends. `Arrangement.SpaceBetween`, `SpaceAround`, `SpaceEvenly`, `Center`, `End` do the rest.
- `Alignment.CenterVertically` (in a `Row`), `Alignment.CenterHorizontally` (in a `Column`), `Alignment.Center` (in a `Box`).
- `8.dp` — density-independent pixels, for anything you can see. `16.sp` — scale-independent pixels, for text only, because it also follows the user's font-size setting. Hard-coding a text size in `dp` is how a screen breaks for someone who needs large text. [docs](https://developer.android.com/training/multiscreen/screendensities)
- Compose measures in **one pass**: a parent measures each child once, so there is no `measure` loop to fall into. `IntrinsicSize.Min` / `IntrinsicSize.Max` is the escape hatch that asks children how big they would like to be before laying them out, and it costs an extra measure.
- [Layout basics](https://developer.android.com/develop/ui/compose/layouts/basics)

## Modifiers

A `Modifier` is an ordered list of decorations. Order is behaviour, not style: `Modifier.padding(8.dp).background(Red)` leaves the padding uncoloured, `Modifier.background(Red).padding(8.dp)` paints it.

- `Modifier.padding(16.dp)`, `.padding(horizontal = 16.dp, vertical = 8.dp)`, `.padding(start = 16.dp)`.
- `Modifier.fillMaxWidth()`, `.fillMaxHeight()`, `.fillMaxSize()`, and the fraction form `.fillMaxWidth(0.5f)`.
- `Modifier.size(48.dp)`, `.width(120.dp)`, `.height(48.dp)` — a *preferred* size the parent may override. `.requiredSize(48.dp)` insists, even if that means overflowing.
- `Modifier.weight(1f)` — only inside a `Row` or `Column`. Fixed children are measured first; what is left over is split between the weighted ones in proportion. `weight(1f)` next to `weight(2f)` is a one-third/two-thirds split of the remainder, not of the row.
- `Modifier.clickable(onClick = { })` — a click, plus the ripple, the focus and the accessibility role that come with it. Always better than a bare `pointerInput` for something that is really a button.
- `Modifier.clip(RoundedCornerShape(12.dp))`, `.background(color)`, `.border(1.dp, color, shape)`.
- `Modifier.verticalScroll(rememberScrollState())` — makes a `Column` scroll. It measures every child, so it is for a form or an article, never for a long list — and never around a `LazyColumn`, which scrolls on the same axis. Adding it is usually the whole fix for a screen that clips at `fontScale = 2f`. [docs](https://developer.android.com/develop/ui/compose/touch-input/pointer-input/scroll)
- `rememberScrollState()` — the scroll position, remembered across recomposition, and the thing `verticalScroll` reads and writes.
- `Modifier.semantics { contentDescription = "…" ; heading() }` — what accessibility services see. `Modifier.clearAndSetSemantics { }` replaces a subtree's semantics with one label, which is how a row of four `Text`s is read as one sentence. [docs](https://developer.android.com/develop/ui/compose/accessibility)
- `Modifier.testTag("note-list")` — a handle for tests. A last resort: find nodes by text, content description, role or state first, so the test fails when the experience breaks rather than when a tag is renamed.
- [Modifiers](https://developer.android.com/develop/ui/compose/modifiers)

## Compose state

- `remember { }` — keep a value across recompositions of this composable. `remember(key) { }` recomputes it when `key` changes, and forgetting the key is the classic bug where a row keeps the previous item's data.
- `mutableStateOf(v)` — an observable holder. Read it in a composable and that composable recomposes when it changes. `var name by remember { mutableStateOf("") }` needs `getValue`/`setValue` imported.
- `rememberSaveable { }` — like `remember`, but also survives process death and configuration change by writing to the saved-instance-state `Bundle`. For what the **user** did; not for what you fetched. Anything custom needs a `Saver`. [docs](https://developer.android.com/develop/ui/compose/state-saving)
- `derivedStateOf { }` — a computed state that only notifies when its **result** changes, so a scroll offset changing every frame does not recompose a button that only cares whether the offset is over zero. Wrap it in `remember`.
- `mutableStateListOf()` / `mutableStateMapOf()` — observable collections, for when replacing the whole list each edit is genuinely wasteful.
- `LaunchedEffect(key) { }` — a coroutine tied to the composition: started when it enters, cancelled when it leaves, restarted when `key` changes. `LaunchedEffect(Unit) { }` runs once.
- `DisposableEffect(key) { onDispose { } }` — register something and unregister it on the way out.
- `rememberCoroutineScope()` — a scope for starting work from a callback such as a click. Not for loading data on entry; that is `LaunchedEffect`.
- `rememberUpdatedState(value)` — keep a long-running effect reading the latest lambda without restarting it.
- `collectAsStateWithLifecycle()` — collect a `StateFlow` as Compose state and **stop collecting when the app is backgrounded**. From `androidx.lifecycle:lifecycle-runtime-compose`; prefer it over `collectAsState()` on Android. [docs](https://developer.android.com/topic/libraries/architecture/coroutines)
- **State hoisting** is the pattern all of this serves: a composable takes `value` and `onValueChange` and holds nothing, and the state lives in the lowest common ancestor that needs it.
- `@Stable` / `@Immutable` — promises to the compiler about a type, letting it skip a composable whose parameters are unchanged. A `List<T>` parameter is unstable (the interface is mutable); `ImmutableList` from kotlinx.collections.immutable, or a `@Immutable` wrapper, is the usual fix.
- [State and Jetpack Compose](https://developer.android.com/develop/ui/compose/state)

## Lists and lazy layouts

- `LazyColumn { }` / `LazyRow { }` — compose only the visible items, plus a little either side. The content lambda is a `LazyListScope`, not a composable body: you call `item { }` and `items(…)` rather than writing children directly.
- `items(list, key = { it.id }) { item -> }` — the usual one. **Give it a key.** Without one, position is identity: delete the first row and every row below it recomposes and loses its remembered state. `itemsIndexed(list, key = …)` when you need the index.
- `item { }` — exactly one, for a header or a footer. `stickyHeader { }` — a header that pins while its section scrolls.
- `rememberLazyListState()` — the scroll state. `state.firstVisibleItemIndex` and `state.layoutInfo.totalItemsCount` are what a "load the next page when we are near the end" check reads.
- `LazyVerticalGrid(columns = GridCells.Fixed(2))` / `GridCells.Adaptive(160.dp)` — the grid forms.
- `contentPadding = PaddingValues(16.dp)` — padding inside the scrolling area, so the first and last items clear the edges without clipping while they scroll.
- Never put a `LazyColumn` inside a `Column` with `verticalScroll` on the same axis. Flatten it into `item { }` blocks of the one lazy list.
- [Lists and grids](https://developer.android.com/develop/ui/compose/lists)

## Material theming

- `MaterialTheme(colorScheme, typography, shapes) { }` — wraps your app and publishes those three through composition locals. Your own `AppTheme { }` is a thin wrapper around it.
- `MaterialTheme.colorScheme.primary`, `.onPrimary`, `.surface`, `.onSurface`, `.surfaceVariant`, `.error` — read the colours here, not from constants. Every `X` has an `onX` that is legible on it; using a pair is how contrast survives a dark theme.
- `lightColorScheme(primary = …)` / `darkColorScheme(…)` — build the two schemes. `dynamicLightColorScheme(context)` / `dynamicDarkColorScheme(context)` take the user's wallpaper colours on Android 12 and up.
- `isSystemInDarkTheme()` — a composable returning the current setting, and the usual way to choose between the two schemes.
- `MaterialTheme.typography.headlineMedium`, `.titleLarge`, `.bodyLarge`, `.labelSmall` — the type scale. Passing one as `style` keeps sizes consistent and keeps `sp` scaling working.
- `Color(0xFF6750A4)` — alpha comes **first** in the literal, unlike CSS. `color.luminance()` gives relative luminance, which is what a contrast ratio is computed from.
- `CardDefaults.cardColors(containerColor = …, contentColor = …)` — sets both halves of a colour pair on a `Card`. `contentColor` is inherited by the `Text`s inside, so most of them need no `color` at all. Every Material component has a matching `…Defaults` object (`ButtonDefaults`, `TextFieldDefaults`) for the same job. [docs](https://developer.android.com/develop/ui/compose/designsystems/material3)
- `enableEdgeToEdge()` — called in `onCreate` before `setContent`, from `androidx.activity`. It lets your content draw behind the status and navigation bars; from Android 15 the system does that whether you asked or not, so the real work is handling the insets. `Modifier.safeDrawingPadding()`, or the padding a `Scaffold` hands you, is how. [docs](https://developer.android.com/develop/ui/views/layout/edge-to-edge)

## Resources and configuration

- `stringResource(R.string.title)`, and `stringResource(R.string.greeting, name)` with format arguments. Never concatenate translated fragments; the word order is different in other languages.
- `pluralStringResource(R.plurals.items, count, count)` — `count` twice on purpose: once to pick the form, once to substitute. English has two forms, Polish has four, Japanese has one, and `if (n == 1)` is wrong in most of the world. [docs](https://developer.android.com/guide/topics/resources/string-resource#Plurals)
- `painterResource(R.drawable.logo)`, `dimensionResource(R.dimen.gutter)`, `colorResource(R.color.brand)`.
- Qualified resource folders — `values-fr/`, `values-night/`, `values-sw600dp/`, `drawable-hdpi/` — are how the platform picks a resource for the current locale, theme, size and density. The unqualified folder is the fallback, and it must be complete. [docs](https://developer.android.com/guide/topics/resources/providing-resources)
- Locale resolution walks the user's ordered language list and falls back by language before region: a `fr-CA` user gets `values-fr` if there is no `values-fr-rCA`.
- `LocalContext.current`, `LocalConfiguration.current`, `LocalDensity.current` — composition locals for the context, the current configuration (orientation, locale, `fontScale`) and the density. `with(LocalDensity.current) { 16.dp.toPx() }` converts.
- Screen size is a **configuration**, not a device class: a phone in split screen is a small window. Decide layout from the current window size, not from `isTablet`.

## ViewModel and lifecycle

- `class X : ViewModel()` — survives configuration change, cleared once when the screen is finished with for good. It holds UI state; it never holds a `Context`, a `View` or a composable.
- `viewModelScope` — a `CoroutineScope` cancelled in `onCleared()`. The default home for anything a screen starts. [docs](https://developer.android.com/topic/libraries/architecture/viewmodel)
- `viewModel()` / `hiltViewModel()` — get one in a composable, scoped to the nearest `ViewModelStoreOwner` (the activity, or a navigation entry).
- `SavedStateHandle` — a constructor parameter Hilt and the framework can supply, holding a `Bundle` that survives **process death**, not just rotation. `handle.getStateFlow("query", "")` gives a `StateFlow` backed by it; `handle["query"] = q` writes. Small user input only; it has a hard size limit and is not a cache. [docs](https://developer.android.com/topic/libraries/architecture/viewmodel/viewmodel-savedstate)
- `ComponentActivity` — the base class a Compose app uses, with `onCreate(savedInstanceState: Bundle?)` calling `super` first, then `setContent`.
- The activity ladder is `onCreate` → `onStart` → `onResume`, and back down through `onPause` → `onStop` → `onDestroy`. `onStart`/`onStop` bracket *visible*; `onResume`/`onPause` bracket *focused*, and a dialog or split screen can take focus without stopping you. [docs](https://developer.android.com/guide/components/activities/activity-lifecycle)
- `Lifecycle.State` — `INITIALIZED`, `CREATED`, `STARTED`, `RESUMED`, `DESTROYED`, ordered so `state.isAtLeast(Lifecycle.State.STARTED)` is a real question.
- `lifecycleScope.launch { repeatOnLifecycle(Lifecycle.State.STARTED) { … } }` — run a collection only while the screen is at least started, restarting it each time it comes back. In Compose, `collectAsStateWithLifecycle()` does this for you.
- `DefaultLifecycleObserver` / `LifecycleEventObserver` — observe someone else's lifecycle instead of overriding callbacks.
- `onSaveInstanceState` and `rememberSaveable` write to the same `Bundle`: it survives process death but is capped at about a megabyte across the whole activity, and a `TransactionTooLargeException` is what putting a list of results in there looks like.
- `WorkManager` — for work that must finish even if the app does not: `OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(Constraints(requiredNetworkType = NetworkType.UNMETERED, requiresCharging = true)).build()`, enqueued once and retried by the system. Not for anything the user is waiting on. [docs](https://developer.android.com/topic/libraries/architecture/workmanager)

## Navigation

Navigation Compose is type-safe now: destinations are `@Serializable` classes, not route strings.

- `@Serializable data object Home` / `@Serializable data class ItemDetail(val id: Long)` — a destination and its arguments, checked by the compiler.
- `rememberNavController()` — the controller, created once at the top of the app.
- `NavHost(navController, startDestination = Home) { composable<Home> { } ; composable<ItemDetail> { entry -> } }` — the graph.
- `navController.navigate(ItemDetail(id))` — go somewhere, passing typed arguments.
- `entry.toRoute<ItemDetail>()` — read the arguments back as the class. In a `ViewModel`, `savedStateHandle.toRoute<ItemDetail>()` does the same without touching the entry.
- `navController.popBackStack()` / `navigateUp()` — go back one.
- `navigate(Home) { popUpTo<Home> { inclusive = true } ; launchSingleTop = true }` — the options that rewrite the stack: `popUpTo` drops everything above a destination, `inclusive` drops that one too, and `launchSingleTop` refuses to stack a second copy of the destination you are already on. Login-to-home wants all three, so Back does not return to the login screen.
- `saveState = true` on `popUpTo` plus `restoreState = true` on the call — the bottom-navigation pattern where each tab remembers its own stack.
- `currentBackStackEntryAsState()` — the current entry as Compose state, for highlighting the selected tab.
- `entry?.destination?.hierarchy?.any { it.hasRoute(FeedGraph::class) }` — "am I anywhere inside that graph?". `hasRoute` is the type-safe test; comparing route strings is the old way. [docs](https://developer.android.com/guide/navigation/design/type-safety)
- `navDeepLink<ItemDetail>(basePath = "https://example.com/item")` — attach a deep link to a typed destination. A deep link should land on the right screen **with a sensible back stack**, not on a screen you cannot leave.
- [Navigation](https://developer.android.com/guide/navigation)

## Room and DataStore

Room is a compile-time-checked SQLite layer. Its annotation processor runs through **KSP**, added as `ksp(libs.room.compiler)` in the module's Gradle file, and it verifies your SQL at build time.

- `@Entity(tableName = "notes") data class NoteEntity(@PrimaryKey(autoGenerate = true) val id: Long = 0, @ColumnInfo(name = "body") val body: String)` — a table.
- `@Dao interface NoteDao { … }` — the queries. `@Query("SELECT * FROM notes ORDER BY id DESC")`, `@Insert(onConflict = OnConflictStrategy.REPLACE)`, `@Upsert`, `@Update`, `@Delete`, `@Transaction`.
- A DAO function returning `Flow<List<NoteEntity>>` re-emits whenever the table changes, and is not suspending. One that returns a value once is `suspend`. Both keep the query off the main thread. [docs](https://developer.android.com/training/data-storage/room)
- `@Database(entities = [NoteEntity::class], version = 2) abstract class AppDatabase : RoomDatabase() { abstract fun noteDao(): NoteDao }`.
- `Room.databaseBuilder(context, AppDatabase::class.java, "notes.db").addMigrations(MIGRATION_1_2).build()` — build it once and share it; a second instance on the same file is a lock fight.
- `val MIGRATION_1_2 = object : Migration(1, 2) { override fun migrate(db: SupportSQLiteDatabase) { db.execSQL("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0") } }` — one step per version bump, applied in order. `fallbackToDestructiveMigration()` deletes the user's data; it is a debug convenience, not a shipping strategy.
- `@Embedded` and `@Relation` — read a join into one object; the containing query needs `@Transaction` so the two reads see the same snapshot.
- `by preferencesDataStore(name = "settings")` — a top-level property on `Context`, exactly once per file and per name. Two DataStores on the same name crash at runtime. [docs](https://developer.android.com/topic/libraries/architecture/datastore)
- `stringPreferencesKey("theme")`, `booleanPreferencesKey`, `intPreferencesKey` — typed keys. Read with `dataStore.data.map { it[key] ?: default }` (a `Flow`), write with `dataStore.edit { it[key] = value }` (suspending, and atomic).
- DataStore is for settings and small flags. It replaces `SharedPreferences`, which had a blocking `commit()` and a silent `apply()`, and it is not a database.

## Networking

- Retrofit describes the API as an interface: `interface CartApi { @GET("cart/{id}") suspend fun cart(@Path("id") id: Long, @Query("full") full: Boolean = false): CartDto }`.
- `Retrofit.Builder().baseUrl("https://example.com/").client(okHttp).addConverterFactory(…).build().create(CartApi::class.java)` — the `baseUrl` must end in a slash.
- `@Serializable data class ItemDto(@SerialName("item_id") val id: Long)` — kotlinx.serialization. `Json { ignoreUnknownKeys = true }` is the setting that stops a new server field from crashing an old client.
- `json.asConverterFactory("application/json".toMediaType())` — the bridge between kotlinx.serialization and Retrofit, from `com.jakewharton.retrofit2:retrofit2-kotlinx-serialization-converter`. `toMediaType()` is an OkHttp extension on `String`.
- `OkHttpClient.Builder().connectTimeout(10.seconds.toJavaDuration()).addInterceptor(…).cache(Cache(dir, size)).build()` — timeouts, interceptors and the HTTP cache. Build one client and share it; each one has its own connection and thread pools.
- `Interceptor` — a lambda around every call, for headers, auth and logging. `HttpLoggingInterceptor` prints bodies in debug builds, and should never be at `BODY` level in release.
- Failures come in three shapes worth separating in your own error type: `IOException` (no network, timeout), an HTTP status your code must branch on (401 is not 500), and a deserialization failure (the response was not what you agreed). "Something went wrong" is not one of them.
- `Cache-Control: max-age=300` lets a response be reused for five minutes; `no-cache` means revalidate first; `no-store` means never write it down.
- `MockWebServer` — a real HTTP server in your test, with real status codes and real serialization, and no network.
- [Kotlin serialization](https://developer.android.com/kotlin/serialization) · [Retrofit](https://square.github.io/retrofit/) · [OkHttp](https://square.github.io/okhttp/)

## Dependency injection with Hilt

- `@HiltAndroidApp class App : Application()` — generates the root container. Declare the class in the manifest.
- `@AndroidEntryPoint class MainActivity : ComponentActivity()` — lets the framework inject into an Android class it constructs itself.
- `class CartRepository @Inject constructor(private val api: CartApi)` — the normal case: Hilt can build anything whose constructor it can see.
- `@Module @InstallIn(SingletonComponent::class) object NetworkModule { @Provides @Singleton fun retrofit(): Retrofit = … }` — for types you do not own. `@Provides` writes the construction; `@Binds` on an abstract function just maps an interface to an implementation, and generates less code.
- Components are lifetimes: `SingletonComponent` (the app), `ActivityRetainedComponent` (across rotation), `ViewModelComponent`, `ActivityComponent`. The scope annotations that match are `@Singleton`, `@ActivityRetainedScoped`, `@ViewModelScoped`, `@ActivityScoped`. Unscoped means a new instance every injection, which is the right default.
- `@HiltViewModel class CartViewModel @Inject constructor(repo: CartRepository, handle: SavedStateHandle) : ViewModel()`, fetched in a composable with `hiltViewModel()`.
- A `@Qualifier` annotation distinguishes two bindings of the same type — `@IoDispatcher` and `@DefaultDispatcher` both provide a `CoroutineDispatcher`.
- The point of all of it is the seam: a constructor parameter is where a test puts a fake. A class that calls `SomeSingleton.getInstance()` inside itself has no seam, and Hilt cannot give it one.
- [Hilt](https://developer.android.com/training/dependency-injection/hilt-android)

## Testing on Android

Three tiers: JVM unit tests in `src/test` (fast, no device), instrumentation tests in `src/androidTest` (a real device or emulator, its own `srcDir` in the Gradle config), and Compose UI tests, which are instrumentation tests with a rule that hosts composables.

- `@get:Rule val rule = createComposeRule()` — hosts composables with no activity. `createAndroidComposeRule<MainActivity>()` when you need the real one.
- `rule.setContent { AppTheme { CartScreen(state) } }` — put the UI under test on screen.
- `rule.onNodeWithText("Save")`, `onNodeWithContentDescription("Cart")`, `onNodeWithTag("note-list")`, `onAllNodesWithText(…)[0]` — find a node. The first two are the ones to prefer: a node found by text or description is a node a screen reader can also find. [docs](https://developer.android.com/develop/ui/compose/testing)
- `assertIsDisplayed()`, `assertExists()`, `assertDoesNotExist()`, `assertTextEquals("2")`, `assertIsEnabled()`, `assertHeightIsAtLeast(48.dp)` — the assertions. That last one is a touch-target regression test you write once.
- `performClick()`, `performTextInput("ada@example.com")`, `performScrollTo()` — the actions. Scroll first if the node is off screen.
- `rule.onRoot().printToLog("TAG")` — dump the whole semantics tree to logcat. The fastest way to find out why a node was not found.
- `rule.waitUntil { … }` — for something asynchronous. The rule otherwise synchronises automatically, so arbitrary sleeps are both slow and flaky.
- `runTest { }` from `kotlinx-coroutines-test` — a virtual clock, where `delay(10_000)` returns immediately with the ordering intact. `StandardTestDispatcher`, `advanceUntilIdle()`, and `Dispatchers.setMain(dispatcher)` in a `@Before` for code that assumes a main thread.
- `@RunWith(AndroidJUnit4::class)` — the runner for instrumentation tests, and for Robolectric ones that simulate the framework on the JVM.
- Take the clock as a dependency. An interface with one method buys you a fake that jumps ten minutes instantly, and a test that never sleeps.
- `MacrobenchmarkRule` with UiAutomator (`By.res("note-list")`) measures startup and frame timing on a real device. `By.res` only matches a `Modifier.testTag` when `testTagsAsResourceId = true` is set in a `semantics` modifier on the root.
- [Testing fundamentals](https://developer.android.com/training/testing/fundamentals)

## What does not run here

`androidx` does not resolve on the Kotlin Playground. There is no Android SDK behind this page, no `R` class, no resources, no device and no frame clock — so `@Composable`, `Modifier`, `ViewModel`, Room and everything else in the glossary above will not compile in an exercise editor, however correctly you spell it.

That is why the roadmap splits its exercises in two. The logic an app is mostly made of — the state machine, the reducer, the diff, the retry schedule, the parser, the contrast check — is ordinary Kotlin, and it is compiled and tested here for real. The screens are build tasks: a checklist, a reference solution, and Android Studio. You look at the screen and decide whether it is right, which is also how the job works.

The practical version of that split is worth keeping after this roadmap: whatever you can pull out of a composable and test on the JVM in milliseconds, pull out.
