# Composable functions

A composable function describes a piece of user interface for the data you hand it. It takes parameters, it calls other composable functions, and it returns nothing. There is no view to hold on to and no `findViewById`: when the data changes, Compose calls your function again and works out what on screen has to change. Everything else in this roadmap is a consequence of that one idea.

The whole of Compose is functions annotated `@Composable`, and the compiler plugin that makes them work. Understanding what that annotation actually buys you — and what it costs — is the difference between a UI that is obvious and one that redraws the world every frame.

## A composable is a function

```kotlin
@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    Text(text = "Hello, $name", modifier = modifier)
}
```

Conventions, all of which the tooling and your reviewers expect:

- **PascalCase name, no return value.** It describes UI, it does not produce a value. A composable that returns something is a different kind of function and should be named `rememberSomething` if it does.
- **A `modifier: Modifier = Modifier` parameter**, first among the optional parameters, passed to the outermost element. This is how a caller positions and sizes your composable without you knowing anything about where it is used.
- **Parameters in order:** required ones first, then `modifier`, then other optional ones, then a trailing `content: @Composable () -> Unit` if it takes one.

A `@Composable` function can only be called from another `@Composable` function. That is not a style rule, it is the type system: the compiler plugin adds a hidden `Composer` parameter to every composable, and only a composable has one to pass on. The chain has to start somewhere, and that somewhere is `setContent` in your activity.

## What the function actually does

Calling `Text(...)` does not draw text and does not return a text object. It *emits* a node into the tree Compose is currently building, at the position in the tree given by where the call appears in your source. That position is the node's identity: the first `Text` in a `Column` is a different node from the second, forever, because they are different call sites.

This is why composables must behave themselves:

- **No side effects.** No writing to a variable outside the function, no network call, no logging you rely on. Your function may run on any thread, out of order with its siblings, many times a second, or not at all.
- **Idempotent.** Called twice with the same inputs it must emit the same thing.
- **Fast.** It runs on the main thread. Anything that takes real time belongs in a coroutine, behind a `LaunchedEffect` or, better, in a ViewModel.

The rule that catches everyone once: never read a `var` that changes and expect to see it change. Compose has no idea you read it. State that drives UI must be state Compose can observe, which is the next module.

## Recomposition

When observable state changes, Compose re-invokes the composables that **read** that state, and only those. It does not re-run your whole screen.

```kotlin
@Composable
fun Header(title: String, unread: Int) {
    Column {
        Text(title)          // does not read `unread` — untouched when it changes
        Badge(unread)        // reads it — this is what re-runs
    }
}
```

The unit of recomposition is the enclosing composable scope, not the individual call. Compose walks up from the changed state to the nearest composable function that read it and re-runs that function. Keep those functions small and the amount of work per change is small; write one 400-line `Screen()` that reads everything, and every keystroke re-runs all of it.

The other half of the rule is that recomposition **skips** what it can. When Compose re-runs a function, every child call whose arguments have not changed is skipped: the previous result is kept and the child is not invoked.

## Skipping and stability

"Have not changed" has a precise meaning. With strong skipping — on by default in the current Compose compiler — a composable can be skipped when every argument matches the previous composition:

- Arguments of a **stable** type are compared with `equals`. Primitives, `String`, functional types and any `data class` whose properties are all stable `val`s are stable. Compose can trust that if two values are equal now, they will keep behaving the same.
- Arguments of an **unstable** type are compared by **instance**. `List`, `Set` and `Map` are the usual ones: the interface says nothing about whether somebody else can mutate it behind your back, so `listOf("a") == listOf("a")` is not enough, and Compose asks whether it is literally the same object.

The practical consequence: passing a freshly built list on every recomposition (`items.filter { it.done }` computed inline in the caller) creates a new instance each time, so the child can never be skipped. Hoist the computation, or mark your own types `@Immutable` when you can genuinely promise their contents never change.

Lambdas are stable, but a lambda that captures a changing value is a new value when that value changes, which is usually what you want.

## Previews

`@Preview` renders a composable in Studio without launching the app. It costs one annotation and pays for itself the first afternoon.

```kotlin
@Preview(name = "light")
@Preview(name = "dark", uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun GreetingPreview() {
    AppTheme {
        Greeting(name = "Ada")
    }
}
```

A preview function takes no parameters, is `private`, and supplies its own data. Stack the annotations to see several configurations at once — light and dark, a tiny font scale and a huge one, a phone and a foldable. For a composable with many interesting inputs, a `PreviewParameterProvider` feeds a sequence of them:

```kotlin
private class NameProvider : PreviewParameterProvider<String> {
    override val values = sequenceOf("Ada", "", "A name long enough to wrap onto a second line")
}

@Preview
@Composable
private fun GreetingPreview(@PreviewParameter(NameProvider::class) name: String) {
    AppTheme { Greeting(name) }
}
```

A composable that cannot be previewed — because it needs a ViewModel, a repository or a network — is telling you something. Split it: a stateful wrapper that fetches, and a stateless composable that takes plain data and renders it. The second one previews, and later it is the one you test.

## Keeping logic out of composables

The most useful habit in Compose has nothing to do with Compose. Every decision that can be made by a plain function — what to show, how to format it, which items to keep — should be made by a plain function, outside the composable, where it is testable in a millisecond and cannot accidentally read state.

```kotlin
// not this
@Composable
fun Timestamp(sentAt: Long) {
    val now = System.currentTimeMillis()          // read during composition: wrong, and untestable
    Text(if (now - sentAt < 60_000) "now" else "${(now - sentAt) / 60_000}m")
}

// this
fun relativeTime(now: Long, then: Long): String = …   // pure, tested

@Composable
fun Timestamp(label: String) {
    Text(label)
}
```

The composable that is left is boring, and boring is the goal.

```kotlin playground
// Recomposition, modelled: who reads what, what changed, and who is skipped.
class Composer(private val reads: Map<String, Set<String>>) {
    private val ran = mutableListOf<String>()

    fun change(vararg keys: String): List<String> {
        ran.clear()
        val changed = keys.toSet()
        reads.keys.sorted().filter { name -> reads.getValue(name).any { it in changed } }.forEach { ran += it }
        return ran.toList()
    }
}

/** Strong skipping: stable arguments compare with ==, unstable ones by instance. */
sealed interface Arg {
    data class Stable(val value: Any?) : Arg
    class Unstable(val value: Any?) : Arg
}

fun skips(previous: List<Arg>, next: List<Arg>): Boolean =
    previous.size == next.size && previous.zip(next).all { (a, b) ->
        when {
            a is Arg.Stable && b is Arg.Stable -> a.value == b.value
            a is Arg.Unstable && b is Arg.Unstable -> a.value === b.value
            else -> false
        }
    }

fun main() {
    val screen = Composer(
        mapOf(
            "Screen" to setOf(),                       // reads nothing: never recomposed by state
            "Header" to setOf("title"),
            "Badge" to setOf("unread"),
            "MessageList" to setOf("messages"),
            "Footer" to setOf("unread", "connected"),
        )
    )
    println("unread changes  -> ${screen.change("unread")}")
    println("title changes   -> ${screen.change("title")}")
    println("a sync arrives  -> ${screen.change("messages", "unread", "connected")}")
    println("nothing changes -> ${screen.change()}")

    println()
    val items = listOf("a", "b")
    println("same String again:       ${skips(listOf(Arg.Stable("Inbox")), listOf(Arg.Stable("Inbox")))}")
    println("different String:        ${skips(listOf(Arg.Stable("Inbox")), listOf(Arg.Stable("Sent")))}")
    println("the same list instance:  ${skips(listOf(Arg.Unstable(items)), listOf(Arg.Unstable(items)))}")
    println("an equal, fresh list:    ${skips(listOf(Arg.Unstable(items)), listOf(Arg.Unstable(items.toList())))}")
    println("^ that last false is why filtering inline in the caller costs you every skip")
}
```

## Exercises

### 1. Who recomposes?

`recomposeTargets(reads, changed)` answers the question at the centre of Compose: when these pieces of state change, which composables run again? `reads` maps each composable's name to the set of state keys it reads. Return the names that read at least one of the `changed` keys, sorted alphabetically. A composable that reads nothing is never in the answer, and neither is anything when nothing changed.

```kotlin starter
fun recomposeTargets(reads: Map<String, Set<String>>, changed: Set<String>): List<String> {
    return reads.keys.sorted()
}
```

```kotlin test
class RecomposeTest {
    private val screen = mapOf(
        "Badge" to setOf("unread"),
        "Footer" to setOf("unread", "connected"),
        "Header" to setOf("title"),
        "Screen" to setOf<String>(),
    )

    // only the readers of the changed state
    @Test
    fun readersOnly() {
        assertEquals(listOf("Badge", "Footer"), recomposeTargets(screen, setOf("unread")))
        assertEquals(listOf("Header"), recomposeTargets(screen, setOf("title")))
        assertEquals(listOf("Footer"), recomposeTargets(screen, setOf("connected")))
    }

    // several keys at once, still each composable once, sorted
    @Test
    fun several() {
        assertEquals(listOf("Badge", "Footer", "Header"), recomposeTargets(screen, setOf("unread", "title", "connected")))
        assertEquals(listOf("Badge", "Footer"), recomposeTargets(screen, setOf("unread", "nobodyReadsThis")))
    }

    // nothing to do
    @Test
    fun nothing() {
        assertEquals(listOf<String>(), recomposeTargets(screen, setOf()))
        assertEquals(listOf<String>(), recomposeTargets(screen, setOf("somethingElse")))
        assertEquals(listOf<String>(), recomposeTargets(mapOf(), setOf("unread")))
    }
}
```

#### Uses
- [Composable functions › Recomposition](#/compose-basics/recomposition)
- [Composable functions › What the function actually does](#/compose-basics/what-the-function-actually-does)
- [Reference › Lists, sets and maps](#/reference/lists-sets-and-maps)

#### Hints
- `reads.filter { (_, keys) -> … }` keeps the entries you want; `.keys.sorted()` turns them into the answer.
- "Reads at least one changed key" is `keys.any { it in changed }`.
- `changed.intersect(keys).isNotEmpty()` says the same thing if you prefer sets to loops.

#### Tips
- `Screen` reads nothing and so never recomposes on its own — but it will still re-run when *its* parameters change. State reads and parameter changes are two different routes to the same function.
- The sorted result is for the test's benefit. Real recomposition happens in tree order, and nothing in your app should depend on the order two siblings recompose in.
- The layout inspector in Studio shows recomposition counts per composable. A number climbing while you do nothing is the bug this exercise is about.

#### Docs
- [Thinking in Compose](https://developer.android.com/develop/ui/compose/mental-model)
- [Lifecycle of composables](https://developer.android.com/develop/ui/compose/lifecycle)

### 2. Can this be skipped?

`skips(previous, next)` decides whether a composable can keep its previous output instead of running again. Each argument is either `Stable`, compared with `==`, or `Unstable`, compared by instance with `===`. Every argument has to match for the call to be skipped. A different number of arguments is a different call, so it is never skipped; a composable with no arguments at all always is.

```kotlin starter
sealed interface Arg {
    data class Stable(val value: Any?) : Arg
    class Unstable(val value: Any?) : Arg
}

fun skips(previous: List<Arg>, next: List<Arg>): Boolean {
    return previous == next
}
```

```kotlin test
class SkipTest {
    // stable arguments compare by value
    @Test
    fun stable() {
        assertEquals(true, skips(listOf(Arg.Stable("Inbox")), listOf(Arg.Stable("Inbox"))))
        assertEquals(false, skips(listOf(Arg.Stable("Inbox")), listOf(Arg.Stable("Sent"))))
        assertEquals(true, skips(listOf(Arg.Stable(3), Arg.Stable(null)), listOf(Arg.Stable(3), Arg.Stable(null))))
        assertEquals(false, skips(listOf(Arg.Stable(3)), listOf(Arg.Stable(4))))
    }

    // unstable arguments compare by identity, even when they are equal
    @Test
    fun unstable() {
        val items = listOf("a", "b")
        assertEquals(true, skips(listOf(Arg.Unstable(items)), listOf(Arg.Unstable(items))))
        assertEquals(false, skips(listOf(Arg.Unstable(items)), listOf(Arg.Unstable(items.toList()))))
        assertEquals(false, skips(listOf(Arg.Unstable(listOf("a"))), listOf(Arg.Unstable(listOf("a")))))
    }

    // mixed arguments, and the degenerate cases
    @Test
    fun mixedAndEmpty() {
        val items = listOf("a")
        assertEquals(true, skips(listOf(Arg.Stable("Inbox"), Arg.Unstable(items)), listOf(Arg.Stable("Inbox"), Arg.Unstable(items))))
        assertEquals(false, skips(listOf(Arg.Stable("Inbox"), Arg.Unstable(items)), listOf(Arg.Stable("Sent"), Arg.Unstable(items))))
        assertEquals(true, skips(listOf(), listOf()))
        assertEquals(false, skips(listOf(Arg.Stable("Inbox")), listOf()))
        assertEquals(false, skips(listOf(Arg.Stable(items)), listOf(Arg.Unstable(items))))
    }
}
```

#### Uses
- [Composable functions › Skipping and stability](#/compose-basics/skipping-and-stability)
- [Composable functions › Recomposition](#/compose-basics/recomposition)

#### Hints
- Check the sizes first, then compare the pairs: `previous.zip(next).all { (a, b) -> … }`.
- A `when` with smart casts handles the four combinations: both stable, both unstable, and the two mismatches, which can never be skipped.
- `==` is `equals`; `===` is "the same object". `Unstable` is deliberately not a data class, so that it has no `equals` of its own to mislead you.

#### Tips
- This is why `LazyColumn(items = viewModel.all.filter { it.done })` never skips: `filter` builds a new list every recomposition, and a new list is a new instance.
- Marking your own type `@Immutable` promises Compose that its contents never change after construction, which moves it from the second rule to the first. Break that promise and you get a UI that never updates.
- `kotlinx.collections.immutable`'s `PersistentList` is stable out of the box, and is the usual fix for list parameters you cannot hoist.

#### Docs
- [Stability in Compose](https://developer.android.com/develop/ui/compose/performance/stability)
- [Strong skipping mode](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)

### 3. Relative time

Pull the formatting out of the composable so it can be tested. `relativeTime(now, then)` describes how long ago `then` was, given the current time, both in milliseconds: under a minute is `"now"`, under an hour is minutes (`"5m"`), under a day is hours (`"3h"`), under a week is days (`"6d"`), and anything older is whole weeks (`"2w"`). Every unit rounds down. A timestamp in the future is a clock-skew artefact, not a bug worth showing the user: report it as `"now"`.

```kotlin starter
fun relativeTime(now: Long, then: Long): String {
    return "${(now - then) / 60_000}m"
}
```

```kotlin test
class RelativeTimeTest {
    private val minute = 60_000L
    private val hour = 60 * minute
    private val day = 24 * hour
    private val week = 7 * day

    // the first minute, and clocks that disagree
    @Test
    fun recent() {
        assertEquals("now", relativeTime(1_000_000, 1_000_000))
        assertEquals("now", relativeTime(1_000_000, 1_000_000 - 59_999))
        assertEquals("now", relativeTime(1_000_000, 1_000_000 + 5 * minute))
    }

    // minutes and hours, rounded down
    @Test
    fun minutesAndHours() {
        assertEquals("1m", relativeTime(minute, 0))
        assertEquals("59m", relativeTime(hour - 1, 0))
        assertEquals("1h", relativeTime(hour, 0))
        assertEquals("1h", relativeTime(hour + 59 * minute, 0))
        assertEquals("23h", relativeTime(day - 1, 0))
    }

    // days and weeks
    @Test
    fun daysAndWeeks() {
        assertEquals("1d", relativeTime(day, 0))
        assertEquals("6d", relativeTime(week - 1, 0))
        assertEquals("1w", relativeTime(week, 0))
        assertEquals("1w", relativeTime(2 * week - 1, 0))
        assertEquals("2w", relativeTime(2 * week, 0))
        assertEquals("52w", relativeTime(365 * day, 0))
    }
}
```

#### Uses
- [Composable functions › Keeping logic out of composables](#/compose-basics/keeping-logic-out-of-composables)
- [Composable functions › What the function actually does](#/compose-basics/what-the-function-actually-does)
- [Reference › Numbers](#/reference/numbers)

#### Hints
- Compute `val elapsed = now - then` once, then a chain of `when` branches on it, largest last.
- Integer division already rounds down: `elapsed / hour` is the whole hours.
- The future case is `elapsed < 0`, which the same `elapsed < minute` branch covers if it is first.

#### Tips
- `now` is a parameter, not `System.currentTimeMillis()` read inside the function. That is the whole reason this is testable, and the reason a composable must never read the clock during composition.
- A real app would localise these strings and use `DateUtils.getRelativeTimeSpanString`. The shape of the decision is the same, and the tests you write around it are the same.
- Underscores in numeric literals (`60_000`) are Kotlin's, not a formatting convention — they compile to the same constant and save one misread zero.

#### Docs
- [State and Jetpack Compose](https://developer.android.com/develop/ui/compose/state)
- [Compose performance: avoid backwards writes](https://developer.android.com/develop/ui/compose/performance/bestpractices)

### 4. Your first composables, with previews

Build a small profile card out of composable functions and look at it entirely in previews, without running the app. This one is not marked here: work the checklist, then open the solution and compare.

#### Build it
- A composable `ProfileCard(name: String, role: String, modifier: Modifier = Modifier)` — required parameters first, `modifier` after them, defaulting to `Modifier`.
- The `modifier` parameter is applied to the outermost element of the composable and to nothing else.
- Nothing inside reads a clock, a repository or a global variable — everything it renders arrives as a parameter.
- A `private` `@Preview` composable that supplies its own data and wraps the card in `MaterialTheme`.
- A second `@Preview` on the same function for dark mode, with `uiMode = Configuration.UI_MODE_NIGHT_YES`.
- Both previews render in Studio's split view without the app being installed.

```kotlin solution
// ProfileCard.kt
import android.content.res.Configuration
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Composable
fun ProfileCard(name: String, role: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = name, style = MaterialTheme.typography.titleMedium)
            Text(text = role, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Preview(name = "light", showBackground = true)
@Preview(name = "dark", showBackground = true, uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun ProfileCardPreview() {
    MaterialTheme {
        ProfileCard(
            name = "Ada Lovelace",
            role = "Analytical Engine",
            modifier = Modifier.padding(16.dp),
        )
    }
}
```

#### Uses
- [Composable functions › A composable is a function](#/compose-basics/a-composable-is-a-function)
- [Composable functions › Previews](#/compose-basics/previews)
- [Project & Gradle › Dependencies and the version catalog](#/project/dependencies-and-the-version-catalog)

#### Hints
- Previews need `debugImplementation(libs.androidx.compose.ui.tooling)` and `implementation(libs.androidx.compose.ui.tooling.preview)`. The Empty Activity template already has both.
- The preview lives in the same file as the composable, under it, and is `private` so it never leaks into your API.
- `showBackground = true` puts a surface behind the preview; without it a card on a transparent canvas is hard to judge.
- Studio's "Build & Refresh" arrow above the preview rebuilds after a change. If previews stop rendering entirely, the module did not compile.

#### Tips
- Passing `Modifier.padding(16.dp)` from the *preview* rather than baking it into the card is the whole point of the modifier convention: the caller decides the spacing around a component, the component decides the spacing inside it.
- Stacking two `@Preview` annotations on one function is cheaper than two preview functions, and guarantees both configurations show the same data.
- If you find yourself unable to write a preview, the composable is doing too much. Split the part that fetches from the part that renders.

#### Docs
- [Preview your UI with composable previews](https://developer.android.com/develop/ui/compose/tooling/previews)
- [Compose API guidelines: naming](https://developer.android.com/develop/ui/compose/api-guidelines)

### 5. A stateless card, previewed against its awkward cases

The value of a preview is not seeing the happy path. Take the card from the previous exercise and drive it from a `PreviewParameterProvider` that feeds it the inputs that break layouts: empty strings, one very long name, an unusual script.

#### Build it
- A `private class ProfileProvider : PreviewParameterProvider<Profile>` whose `values` sequence has at least four entries, including an empty name and a name long enough to wrap.
- A `Profile` data class, declared outside the composable, holding the data the card renders.
- `ProfileCard(profile: Profile, modifier: Modifier = Modifier)` — still no state, no clock, no repository.
- A preview function taking `@PreviewParameter(ProfileProvider::class) profile: Profile`, rendering one preview per entry.
- Every entry renders without the text being clipped or the card collapsing.
- The provider is `private` and lives beside the preview, not in production code.

```kotlin solution
// ProfileCard.kt
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.tooling.preview.PreviewParameterProvider
import androidx.compose.ui.unit.dp

data class Profile(val name: String, val role: String)

@Composable
fun ProfileCard(profile: Profile, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = profile.name.ifBlank { "Unnamed" },
                style = MaterialTheme.typography.titleMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = profile.role,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private class ProfileProvider : PreviewParameterProvider<Profile> {
    override val values = sequenceOf(
        Profile("Ada Lovelace", "Analytical Engine"),
        Profile("", "No name at all"),
        Profile("A name quite long enough to wrap onto a second line and then some", "Long"),
        Profile("Гра́се Хо́ппер", "Компилятор"),
    )
}

@Preview(showBackground = true, widthDp = 320)
@Composable
private fun ProfileCardPreview(@PreviewParameter(ProfileProvider::class) profile: Profile) {
    MaterialTheme {
        ProfileCard(profile = profile, modifier = Modifier.padding(16.dp))
    }
}
```

#### Uses
- [Composable functions › Previews](#/compose-basics/previews)
- [Composable functions › Keeping logic out of composables](#/compose-basics/keeping-logic-out-of-composables)
- [Composable functions › Skipping and stability](#/compose-basics/skipping-and-stability)

#### Hints
- `PreviewParameterProvider` lives in `androidx.compose.ui.tooling.preview`, the same artifact as `@Preview`.
- `values` is an `override val` of type `Sequence<T>`; `sequenceOf(...)` is all you need.
- `widthDp = 320` on the preview forces a narrow phone width, which is where long text goes wrong first.
- A `limit` on `@PreviewParameter` renders only the first *n* entries when the list gets long.

#### Tips
- A `Profile` parameter rather than four `String`s makes the call site readable and keeps the composable skippable — a `data class` of stable properties is itself stable.
- `maxLines` with `TextOverflow.Ellipsis` is a decision, not a default. Making it explicitly, in the preview where you can see it, beats discovering it from a screenshot in a bug report.
- Previews are the cheapest accessibility check you have: add one with `fontScale = 2f` and find out today what a user with large text sees.

#### Docs
- [Preview parameters](https://developer.android.com/develop/ui/compose/tooling/previews#preview-data)
- [Text in Compose](https://developer.android.com/develop/ui/compose/text)
