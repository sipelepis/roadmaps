# State & recomposition

State is any value that changes over time and that the UI should reflect. In Compose it is not enough for a value to change — the framework has to be able to *notice*. `mutableStateOf` creates a value that records who read it and tells them when it changes, and that single mechanism is what drives every recomposition in your app.

The rest of this module is the two questions that follow. Where does that state live, so that it survives a recomposition, a screen rotation, or the system killing your process to save memory? And who owns it, so that the composable showing it can stay a function of its inputs?

## State that Compose can see

```kotlin
@Composable
fun Counter() {
    var count by remember { mutableStateOf(0) }

    Button(onClick = { count++ }) {
        Text("Clicked $count times")
    }
}
```

`mutableStateOf(0)` returns a `MutableState<Int>` — an observable box. Reading it inside a composable *subscribes* that composable to it; writing it schedules a recomposition of everything that read it.

There are three ways to spell the read, and you will meet all of them:

```kotlin
val state = remember { mutableStateOf(0) }
state.value++                                     // explicit box

var count by remember { mutableStateOf(0) }       // property delegate; needs
count++                                           // import androidx.compose.runtime.getValue / setValue

val (count, setCount) = remember { mutableStateOf(0) }
setCount(count + 1)                               // destructured, handy for passing a setter down
```

`by` is the usual choice: `count` reads and writes like an ordinary variable while staying observable.

An ordinary `var count = 0` inside a composable is a bug twice over: it is reset on every recomposition, and nothing is watching it.

## remember

`remember { … }` stores a value in the composition at this call site and returns the same instance on every later recomposition. Without it, `mutableStateOf(0)` would build a brand new state object each time the function ran, and the count would never leave zero.

`remember` takes keys. When a key changes, the stored value is thrown away and the lambda runs again:

```kotlin
val formatted = remember(amount, currency) { format(amount, currency) }
```

That is the whole contract, and the whole trap: **if you forget the key, you keep a stale value forever**. `remember { format(amount, currency) }` computes once, with the first `amount` you ever passed, and cheerfully shows it for the rest of the screen's life.

What `remember` survives, and what it does not:

| Event | `remember` | `rememberSaveable` |
| --- | --- | --- |
| Recomposition | survives | survives |
| Leaving and returning in the same navigation graph | lost | survives |
| Screen rotation or other configuration change | lost | survives |
| The system killing your process in the background | lost | survives |
| The user navigating back, finishing the screen | lost | lost |

## rememberSaveable

`rememberSaveable` writes its value into the saved-instance-state bundle, so it comes back after a rotation or after Android quietly kills your process to reclaim memory and re-creates it when the user returns.

```kotlin
var query by rememberSaveable { mutableStateOf("") }
```

It can only store what a `Bundle` can: primitives, `String`, `Parcelable`, and a few collections of those. For your own type, give it a `Saver` — a pair of functions that flatten the object into something storable and build it back:

```kotlin
data class FormState(val name: String, val email: String, val step: Int)

val FormSaver = listSaver<FormState, Any>(
    save = { listOf(it.name, it.email, it.step) },
    restore = { FormState(it[0] as String, it[1] as String, it[2] as Int) },
)

var form by rememberSaveable(stateSaver = ...) { mutableStateOf(FormState("", "", 0)) }
```

Save what the user typed and where they are, not what you can fetch again. A bundle is small — a few hundred kilobytes across the whole app — and stuffing a list of search results into it is how you meet `TransactionTooLargeException`.

## Hoisting state

A composable that owns its own state cannot be controlled, cannot be previewed with a particular value, and cannot be tested. **Hoisting** moves the state up to the caller and leaves behind a function of its inputs:

```kotlin
// stateless: value in, events out
@Composable
fun SearchField(query: String, onQueryChange: (String) -> Unit, modifier: Modifier = Modifier) {
    TextField(value = query, onValueChange = onQueryChange, modifier = modifier)
}

// stateful: owns the state, wires the two together
@Composable
fun SearchScreen() {
    var query by rememberSaveable { mutableStateOf("") }
    SearchField(query = query, onQueryChange = { query = it })
}
```

The pattern is always the same pair: a `value` parameter and an `onValueChange` callback. State goes **down**, events go **up**.

Hoist to the lowest common ancestor of everything that reads or writes it — no higher. A dropdown's open/closed flag belongs in the dropdown; the selected item belongs wherever the selection is used.

## Unidirectional data flow

Put the two halves together and you get a loop that only turns one way: state flows down into composables, composables emit events upward, the owner of the state handles the event and produces new state, and the new state flows down again.

Nothing in the middle mutates anything. A composable never reaches up to change a value, it reports what happened — `onQueryChange(it)`, `onItemClick(id)` — and lets the owner decide. That is what makes a screen reproducible: give the same state, get the same pixels, every time.

## derivedStateOf

Some state is computed from other state. Most of the time you just compute it, in the composable, every recomposition:

```kotlin
val enabled = name.isNotBlank() && email.contains("@")     // fine: cheap, and changes when they do
```

`derivedStateOf` is for the case where the source changes far more often than the result:

```kotlin
val showScrollToTop by remember {
    derivedStateOf { listState.firstVisibleItemIndex > 0 }
}
```

`firstVisibleItemIndex` changes on every frame of a scroll. The boolean changes twice in a whole gesture. `derivedStateOf` re-runs the calculation whenever the source changes — that part is unavoidable — but only *notifies* its readers when the result is different. Without it, every scrolled pixel recomposes whatever reads that flag.

Two rules, both learned the hard way. Always wrap it in `remember`, or you create a new derived state on every recomposition and gain nothing. And do not use it for a value derived from a composable's own parameters — if `name` changes, the composable is already recomposing, and the derived state is pure overhead.

```kotlin playground
// derivedStateOf, modelled: the calculation runs on every change, the reader hears about very few of them.
data class Counts(val calculations: Int, val notifications: Int)

fun track(sources: List<Int>, derive: (Int) -> Boolean): Counts {
    if (sources.isEmpty()) return Counts(0, 0)
    var calculations = 1
    var notifications = 0
    var last = derive(sources.first())
    for (value in sources.drop(1)) {
        calculations++
        val next = derive(value)
        if (next != last) {
            notifications++
            last = next
        }
    }
    return Counts(calculations, notifications)
}

fun main() {
    // A scroll from the top, down past item 40, and back up again: one index per frame.
    val scroll = (0..40).toList() + (40 downTo 0).toList()
    val showButton = track(scroll) { it > 0 }
    println("scrolled through ${scroll.size} frames")
    println("derivedStateOf: ${showButton.calculations} calculations, ${showButton.notifications} recompositions")
    println("without it:     ${scroll.size} calculations, ${scroll.size} recompositions")

    // The same trick is worthless when the result changes as often as the source.
    val label = track(scroll) { it % 2 == 0 }
    println("\nderiving something that flips constantly: ${label.notifications} of ${label.calculations} changes got through")
    println("^ derivedStateOf only pays when the result is much steadier than the source")
}
```

## Exercises

### 1. remember, with a key

`RememberSlot` is one `remember { … }` call site. `get(key, calculate)` returns the stored value, and only runs `calculate` when there is nothing stored yet or when the key differs from the one stored with it. `calculations` counts how many times `calculate` actually ran. A `null` key is a perfectly good key, and it is equal to the next `null`.

```kotlin starter
class RememberSlot {
    var calculations = 0
        private set

    fun get(key: Any?, calculate: () -> String): String {
        calculations++
        return calculate()
    }
}
```

```kotlin test
class RememberSlotTest {
    // the same key keeps the stored value, and does not run the lambda again
    @Test
    fun sameKey() {
        val slot = RememberSlot()
        assertEquals("first", slot.get("a") { "first" })
        assertEquals("first", slot.get("a") { "second" })
        assertEquals("first", slot.get("a") { "third" })
        assertEquals(1, slot.calculations)
    }

    // a new key throws the old value away
    @Test
    fun changedKey() {
        val slot = RememberSlot()
        assertEquals("for a", slot.get("a") { "for a" })
        assertEquals("for b", slot.get("b") { "for b" })
        assertEquals(2, slot.calculations)
        assertEquals("for a again", slot.get("a") { "for a again" })
        assertEquals("keys are compared to the previous one, not to every key ever seen", 3, slot.calculations)
    }

    // null is a key like any other
    @Test
    fun nullKeys() {
        val slot = RememberSlot()
        assertEquals("computed", slot.get(null) { "computed" })
        assertEquals("computed", slot.get(null) { "recomputed" })
        assertEquals(1, slot.calculations)
        assertEquals("keyed", slot.get(1) { "keyed" })
        assertEquals(2, slot.calculations)
    }
}
```

#### Uses
- [State & recomposition › remember](#/state/remember)
- [State & recomposition › State that Compose can see](#/state/state-that-compose-can-see)
- [Reference › Compose state](#/reference/compose-state)

#### Hints
- Three fields: the stored value, the key it was stored with, and a flag for "nothing stored yet" — the first call has to run even if the key happens to be `null`.
- `if (!hasValue || key != this.key)` is the whole condition. `!=` on `Any?` handles `null` on either side correctly.
- Store the new key at the same time as the new value, or the next call recomputes too.

#### Tips
- The second assertion of the first test is the bug `remember` keys exist to prevent: a stale value returned by a call site whose inputs have moved on. In a real composable the lambda captures its parameters, so the value that comes back is computed from parameters that are no longer current.
- `remember(a, b) { … }` compares *all* its keys. Passing too many keys costs you a recomputation; passing too few costs you correctness, so err on the side of too many.
- Real `remember` also forgets everything when the call site leaves the composition. There is no slot to come back to — which is exactly why a rotation loses it.

#### Docs
- [State and Jetpack Compose](https://developer.android.com/develop/ui/compose/state)
- [remember](https://developer.android.com/reference/kotlin/androidx/compose/runtime/package-summary#remember(kotlin.Function0))

### 2. What derivedStateOf saves you

`track(sources, derive)` counts the two things that make `derivedStateOf` worth using. `sources` is the sequence of values the source state took, starting with its initial value. The derived value is calculated once for the initial value and once for every change after it — that is `calculations`. A reader is notified only when a calculation produces a value **different from the previous one** — that is `notifications`, and the initial calculation is not one, because nothing has changed yet. An empty list of sources means nothing happened at all.

```kotlin starter
data class Counts(val calculations: Int, val notifications: Int)

fun track(sources: List<Int>, derive: (Int) -> Boolean): Counts {
    return Counts(sources.size, sources.size)
}
```

```kotlin test
class TrackTest {
    // a steady result: many calculations, almost no notifications
    @Test
    fun steady() {
        assertEquals(Counts(5, 1), track(listOf(0, 1, 2, 3, 4)) { it > 0 })
        assertEquals(Counts(4, 0), track(listOf(1, 2, 3, 4)) { it > 0 })
        assertEquals(Counts(41, 1), track((0..40).toList()) { it > 0 })
    }

    // every flip is one notification
    @Test
    fun flips() {
        assertEquals(Counts(4, 3), track(listOf(0, 1, 0, 1)) { it > 0 })
        assertEquals(Counts(6, 2), track(listOf(0, 0, 5, 5, 0, 0)) { it > 0 })
        assertEquals(Counts(5, 4), track(listOf(1, 2, 3, 4, 5)) { it % 2 == 0 })
    }

    // one value, and none at all
    @Test
    fun edges() {
        assertEquals(Counts(1, 0), track(listOf(7)) { it > 0 })
        assertEquals(Counts(0, 0), track(listOf()) { it > 0 })
        assertEquals(0, track(listOf(3, 3, 3)) { it > 0 }.notifications)
    }
}
```

#### Uses
- [State & recomposition › derivedStateOf](#/state/derivedstateof)
- [State & recomposition › State that Compose can see](#/state/state-that-compose-can-see)
- [Composable functions › Recomposition](#/compose-basics/recomposition)

#### Hints
- Handle the empty list first, then calculate the first value and keep it as `last` before looping over the rest.
- `sources.drop(1)` is the sequence of changes; every one of them is a calculation.
- Only compare the new result with `last`. Comparing against the initial value instead would count a flip back as no change.

#### Tips
- The first test is the scroll-button case, at the scale it really happens: forty frames of scrolling, one recomposition.
- The third assertion of the second test is the warning. When the derived value changes as often as its source, `derivedStateOf` adds a layer and saves nothing.
- Deriving from `State` objects is the point — `derivedStateOf` tracks whatever state the calculation read, so you do not list dependencies by hand the way `remember(a, b)` makes you.

#### Docs
- [derivedStateOf](https://developer.android.com/develop/ui/compose/side-effects#derivedstateof)
- [Compose performance: defer reads](https://developer.android.com/develop/ui/compose/performance/bestpractices)

### 3. Surviving a rotation

`rememberSaveable` can only store what fits in a `Bundle`, so a custom type needs a `Saver`: a function that flattens it, and a function that builds it back. Write both for a form. `save` returns the fields in order — name, email, accepted, step. `restore` takes a list that came back from the system and rebuilds the state, or returns `null` if the list is not the right shape or the right types, which is what happens when an old saved bundle meets a new version of your app. A round trip must give back an equal object.

```kotlin starter
data class FormState(val name: String, val email: String, val accepted: Boolean, val step: Int)

fun save(state: FormState): List<Any> {
    return listOf(state.name)
}

fun restore(saved: List<Any>): FormState? {
    return null
}
```

```kotlin test
class SaverTest {
    // the fields, in order
    @Test
    fun flattens() {
        assertEquals(listOf("Ada", "ada@example.com", true, 2), save(FormState("Ada", "ada@example.com", true, 2)))
        assertEquals(listOf("", "", false, 0), save(FormState("", "", false, 0)))
    }

    // what goes in comes back out
    @Test
    fun roundTrip() {
        val form = FormState("Grace", "grace@example.com", false, 1)
        assertEquals(form, restore(save(form)))
        val empty = FormState("", "", false, 0)
        assertEquals(empty, restore(save(empty)))
        assertEquals(FormState("Ada", "a@b.c", true, 9), restore(save(FormState("Ada", "a@b.c", true, 9))))
    }

    // a bundle from another version of the app
    @Test
    fun rejectsRubbish() {
        assertNull("too few fields", restore(listOf("Ada")))
        assertNull("nothing at all", restore(listOf()))
        assertNull("the step is not an Int", restore(listOf("Ada", "a@b.c", true, "2")))
        assertNull("accepted is not a Boolean", restore(listOf("Ada", "a@b.c", 1, 2)))
        assertNull("too many fields", restore(listOf("Ada", "a@b.c", true, 2, "extra")))
    }
}
```

#### Uses
- [State & recomposition › rememberSaveable](#/state/remembersaveable)
- [State & recomposition › remember](#/state/remember)
- [State & recomposition › Hoisting state](#/state/hoisting-state)

#### Hints
- `save` is one `listOf(...)` with the four fields in the order `restore` will read them.
- In `restore`, check `saved.size != 4` first and return `null`.
- `saved[0] as? String ?: return null` narrows a type safely. Do the same for each field and build the `FormState` from the four locals.

#### Tips
- The `as?` cast is not paranoia. The bundle is written by one version of your app and read by the next, and a field that changed type comes back as whatever the old version stored.
- Save what the user cannot get back — the text they typed, the step they reached, the item they had selected. Do not save a list you can fetch again; `Bundle` space is shared across the whole app and running out of it crashes you.
- `listSaver` and `mapSaver` in `androidx.compose.runtime.saveable` are exactly this pair of functions, wrapped. Writing one by hand once makes the API obvious.

#### Docs
- [Save UI state](https://developer.android.com/topic/libraries/architecture/saving-states)
- [State in Compose: rememberSaveable](https://developer.android.com/develop/ui/compose/state#restore-ui-state)

### 4. Hoist a counter

Build the same counter twice — once stateless, once stateful — and see what each one buys you. Not marked here: work the checklist, then open the solution.

#### Build it
- `Counter(count: Int, onIncrement: () -> Unit, onReset: () -> Unit, modifier: Modifier = Modifier)`: no `remember`, no state of its own, just a function of its parameters.
- `CounterScreen()` owns `var count by rememberSaveable { mutableStateOf(0) }` and passes it down.
- The reset button is disabled when the count is zero, decided from the parameter, not from state inside the stateless composable.
- Rotating the device keeps the count. Switching `rememberSaveable` to `remember` loses it — try both, so you have seen the difference.
- Two previews of the stateless `Counter`: one at `0`, one at `42`. Neither one needs the screen.
- No `Text` inside `Counter` reads anything other than its parameters.

```kotlin solution
// Counter.kt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Composable
fun Counter(
    count: Int,
    onIncrement: () -> Unit,
    onReset: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(text = "$count", style = MaterialTheme.typography.displayMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onIncrement) { Text("Add one") }
            OutlinedButton(onClick = onReset, enabled = count > 0) { Text("Reset") }
        }
    }
}

@Composable
fun CounterScreen(modifier: Modifier = Modifier) {
    var count by rememberSaveable { mutableStateOf(0) }
    Counter(
        count = count,
        onIncrement = { count++ },
        onReset = { count = 0 },
        modifier = modifier,
    )
}

@Preview(showBackground = true, name = "empty")
@Composable
private fun CounterEmptyPreview() {
    MaterialTheme { Counter(count = 0, onIncrement = {}, onReset = {}) }
}

@Preview(showBackground = true, name = "counted")
@Composable
private fun CounterCountedPreview() {
    MaterialTheme { Counter(count = 42, onIncrement = {}, onReset = {}) }
}
```

#### Uses
- [State & recomposition › Hoisting state](#/state/hoisting-state)
- [State & recomposition › Unidirectional data flow](#/state/unidirectional-data-flow)
- [State & recomposition › rememberSaveable](#/state/remembersaveable)

#### Hints
- `var count by remember { mutableStateOf(0) }` needs two imports that the IDE will not always offer: `androidx.compose.runtime.getValue` and `setValue`.
- To rotate the emulator, press Ctrl+F11 (Cmd+Left on a Mac) or use the rotate buttons in the emulator's side panel.
- If rotation still loses the count with `rememberSaveable`, check you are not re-creating the state somewhere above it.

#### Tips
- The two previews are the payoff. You cannot preview a count of 42 on a composable that owns its own state starting at 0 — you would have to tap it 42 times.
- `enabled = count > 0` in the stateless composable is fine: it is derived from a parameter, not remembered. Derived values should be computed, not stored.
- Passing `onIncrement` rather than the whole state object keeps `Counter` reusable by anything with an integer, which is the actual test of a good hoist.

#### Docs
- [State hoisting](https://developer.android.com/develop/ui/compose/state-hoisting)
- [Where to hoist state](https://developer.android.com/develop/ui/compose/state-hoisting#ui-state)

### 5. A form that survives

Build a two-field signup form that keeps what the user typed through a rotation, enables its button only when the form is valid, and keeps every decision out of the composables.

#### Build it
- `name` and `email` each held in `rememberSaveable { mutableStateOf("") }` at the screen level.
- A stateless `SignupForm(state: FormState, onNameChange: (String) -> Unit, onEmailChange: (String) -> Unit, onSubmit: () -> Unit, modifier: Modifier = Modifier)`.
- Validation lives in a plain function outside any composable: `fun isValid(state: FormState): Boolean`.
- The submit button's `enabled` comes from that function, and an invalid email shows a `supportingText` error once the field has been touched — not while it is still empty.
- Typing, rotating and finding the text still there, in both fields, with the error state intact.
- A preview for each of: empty, half-filled, invalid email, and valid.

```kotlin solution
// SignupScreen.kt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions

data class FormState(val name: String, val email: String)

fun isValid(state: FormState): Boolean =
    state.name.isNotBlank() && emailLooksValid(state.email)

fun emailLooksValid(email: String): Boolean =
    email.count { it == '@' } == 1 && email.substringAfter('@').contains('.') && !email.startsWith('@')

@Composable
fun SignupForm(
    state: FormState,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val emailError = state.email.isNotEmpty() && !emailLooksValid(state.email)
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        OutlinedTextField(
            value = state.name,
            onValueChange = onNameChange,
            label = { Text("Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = state.email,
            onValueChange = onEmailChange,
            label = { Text("Email") },
            singleLine = true,
            isError = emailError,
            supportingText = { if (emailError) Text("That does not look like an email address") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = onSubmit,
            enabled = isValid(state),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Create account")
        }
    }
}

@Composable
fun SignupScreen(onCreated: (FormState) -> Unit, modifier: Modifier = Modifier) {
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    val state = FormState(name = name, email = email)
    SignupForm(
        state = state,
        onNameChange = { name = it },
        onEmailChange = { email = it },
        onSubmit = { onCreated(state) },
        modifier = modifier,
    )
}

@Preview(showBackground = true, name = "empty")
@Composable
private fun EmptyPreview() {
    MaterialTheme { SignupForm(FormState("", ""), {}, {}, {}) }
}

@Preview(showBackground = true, name = "invalid email")
@Composable
private fun InvalidPreview() {
    MaterialTheme { SignupForm(FormState("Ada", "ada@"), {}, {}, {}) }
}

@Preview(showBackground = true, name = "valid")
@Composable
private fun ValidPreview() {
    MaterialTheme { SignupForm(FormState("Ada", "ada@example.com"), {}, {}, {}) }
}
```

#### Uses
- [State & recomposition › Unidirectional data flow](#/state/unidirectional-data-flow)
- [State & recomposition › rememberSaveable](#/state/remembersaveable)
- [State & recomposition › derivedStateOf](#/state/derivedstateof)

#### Hints
- `OutlinedTextField`'s `value` and `onValueChange` are hoisting by another name: the field holds nothing, you do.
- `supportingText` and `isError` are how Material 3 shows a validation message under a field. Do not build your own `Text` below it.
- Show the error only once there is something to be wrong about — `state.email.isNotEmpty() && !valid` — or the form scolds the user before they have typed.
- `isValid` is a plain function, so you can unit-test it without any Compose testing library at all.

#### Tips
- The validation being a free function is what lets you write the four previews: each one is a `FormState`, not a sequence of taps.
- Real email validation is a lost cause; `android.util.Patterns.EMAIL_ADDRESS` is the pragmatic ceiling, and the only real check is sending a message to it.
- Two `rememberSaveable` strings beat one saveable `FormState` here, because `String` needs no `Saver`. Reach for a `Saver` when the state is genuinely one object with invariants across its fields.

#### Docs
- [Text fields in Compose](https://developer.android.com/develop/ui/compose/text/user-input)
- [State in Compose](https://developer.android.com/develop/ui/compose/state)
