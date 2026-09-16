# Lifecycle & saved state

Your app does not control when it runs. The system starts it, stops it when the user takes a call, rebuilds it when they rotate the phone, and kills it outright when it needs the memory — and then, later, restores it as though nothing happened. Everything in this module is about that last word. State that vanishes when the user rotates the screen is a bug; state you refetch on every recomposition is a battery bill; state you cannot restore after a process death is a support ticket you will not be able to reproduce.

## The activity lifecycle

An activity moves up and down a ladder of states, and the framework calls a method on each rung.

| From | To | Callback |
| --- | --- | --- |
| Initialized | Created | `onCreate` |
| Created | Started | `onStart` |
| Started | Resumed | `onResume` |
| Resumed | Started | `onPause` |
| Started | Created | `onStop` |
| Created | Destroyed | `onDestroy` |

The rungs matter more than the callbacks. **Created** means the activity exists but nothing is on screen. **Started** means it is visible. **Resumed** means it is in the foreground and taking input. Moving between two rungs always passes through the ones between, so going from Resumed to Created is `onPause` then `onStop`, never a jump.

In a Compose app you will write `onCreate` and almost nothing else: `lifecycleScope` and `repeatOnLifecycle` cover the cases the other callbacks used to. What you do need is the vocabulary, because "collect while at least Started" is a sentence about this ladder.

## The composable lifecycle

A composable has a simpler one: it **enters** the composition, **recomposes** zero or more times, and **leaves**. `remember` holds a value across recompositions of the same instance and is thrown away when the composable leaves.

```kotlin
var query by remember { mutableStateOf("") }
```

`LaunchedEffect(key)` starts a coroutine when the composable enters and cancels it when it leaves or the key changes; `DisposableEffect(key)` gives you an `onDispose` block for anything that has to be unregistered. The keys are the whole API: a wrong key means an effect that never restarts, or one that restarts on every frame.

The important boundary: the composition is rebuilt for a configuration change, so anything in `remember` is gone. Recomposition and recreation are different events, and only one of them is cheap.

## Configuration changes

Rotating the device, changing the theme, resizing a window, changing the font size or the language — all of these are configuration changes, and by default the system destroys the activity and creates a new one so the right resources are loaded. It happens far more often than "the user rotated the phone": folding a foldable, dragging a split-screen divider, and a system dark-mode schedule all do it.

Three things survive it:

- a `ViewModel`, which is retained across the recreation and only cleared when the screen is really finished with;
- anything in `rememberSaveable`, which is written into the saved instance state bundle;
- anything you wrote to disk.

Setting `android:configChanges` in the manifest to dodge the recreation looks like a shortcut and is a trap: it means your app keeps the old resources, and the bug it hides — state you never saved — is still there for process death.

## Process death

This is the one people miss. When your app is in the background and the system needs memory, it kills the process. The user does not see this. They see their app where they left it, because when they come back Android recreates the activity **and gives it the bundle you saved**. Your `ViewModel` is gone. Your singletons are gone. Static fields are back to their initial values.

The test is two commands, and every screen should pass it:

```sh
adb shell am kill com.example.app      # background the app first
```

or turn on "Don't keep activities" in developer options and walk through the app. What you save in the bundle is what comes back, and the bundle is small — a few hundred kilobytes for the whole task — so it is for *what the user did*, not for what you downloaded. Save the query, not the results; the selected id, not the object.

## rememberSaveable

`rememberSaveable` is `remember` plus that bundle. Anything a `Bundle` can hold — primitives, `String`, `Parcelable`, lists of those — works as it is:

```kotlin
var query by rememberSaveable { mutableStateOf("") }
```

For your own type, give it a `Saver`: a pair of functions turning the value into something savable and back.

```kotlin
data class Filter(val text: String, val onlyInStock: Boolean)

val FilterSaver = listSaver<Filter, Any>(
    save = { listOf(it.text, it.onlyInStock) },
    restore = { Filter(it[0] as String, it[1] as Boolean) },
)

var filter by rememberSaveable(stateSaver = …) { mutableStateOf(Filter("", false)) }
```

`restore` runs against a bundle that may have been written by an older version of your app, so it should be defensive: a `restore` that throws takes the whole screen down on a user who did nothing but leave the app open overnight.

## SavedStateHandle

A `ViewModel` gets the same mechanism through `SavedStateHandle`, which is the right home for screen state that has to outlive process death:

```kotlin
class SearchViewModel(private val handle: SavedStateHandle) : ViewModel() {
    val query: StateFlow<String> = handle.getStateFlow("query", "")

    fun onQueryChange(value: String) { handle["query"] = value }
}
```

The handle is also where navigation arguments arrive, so a detail screen can read its id from it without the composable passing it down. Written to, it is a `Bundle` under the same size limit as `rememberSaveable`, and read from, it is a flow you can build the rest of the screen's state on.

The rule of thumb for the whole module: `remember` for what only matters this composition, `ViewModel` for what the screen is doing, `SavedStateHandle` or `rememberSaveable` for what the user would be annoyed to lose, disk for what must still be there tomorrow.

```kotlin playground
// Four places to keep a counter, and what each of them survives.
enum class Event { RECOMPOSE, ROTATE, PROCESS_DEATH, BACK }

class Screen {
    // null means "lost": the value is back to whatever it was initialised with.
    var remembered: Int? = 0
    var inViewModel: Int? = 0
    var inSavedState: Int? = 0
    var onDisk: Int? = 0

    fun tap() {
        remembered = remembered?.plus(1)
        inViewModel = inViewModel?.plus(1)
        inSavedState = inSavedState?.plus(1)
        onDisk = onDisk?.plus(1)
    }

    fun happens(event: Event) {
        when (event) {
            Event.RECOMPOSE -> Unit                                  // remember is exactly for this
            Event.ROTATE -> remembered = null                        // the composition is rebuilt
            Event.PROCESS_DEATH -> { remembered = null; inViewModel = null }
            Event.BACK -> { remembered = null; inViewModel = null; inSavedState = null }
        }
    }

    fun row(label: String) = "%-15s %-12s %-12s %-12s %s".format(
        label, show(remembered), show(inViewModel), show(inSavedState), show(onDisk),
    )

    private fun show(v: Int?) = v?.toString() ?: "lost"
}

fun main() {
    val screen = Screen()
    println("%-15s %-12s %-12s %-12s %s".format("event", "remember", "viewModel", "savedState", "disk"))
    println(screen.row("start"))

    repeat(3) { screen.tap() }
    println(screen.row("3 taps"))

    Event.entries.forEach { event ->
        screen.happens(event)
        println(screen.row(event.name.lowercase()))
    }

    println()
    println("Every row above is a bug report somebody has filed.")
}
```

## Exercises

### 1. Walk the ladder

The framework never jumps between lifecycle states; it steps, firing one callback per rung. `transition(from, to)` returns the callbacks fired, in order, moving a component from one state to another.

The rungs, lowest to highest, are `DESTROYED`, `INITIALIZED`, `CREATED`, `STARTED`, `RESUMED`, and the steps are the ones in the table at the top of this module. Two rules beyond it: a component already in the target state fires nothing, and a `DESTROYED` component never comes back, so any transition out of `DESTROYED` fires nothing at all.

`isAtLeast(state, target)` answers the other question the framework is always asking — is this component at least started? — by comparing rungs.

```kotlin starter
enum class LifecycleState { DESTROYED, INITIALIZED, CREATED, STARTED, RESUMED }

fun transition(from: LifecycleState, to: LifecycleState): List<String> = emptyList()

fun isAtLeast(state: LifecycleState, target: LifecycleState): Boolean = true
```

```kotlin test
class LifecycleLadderTest {
    // opening a screen, one rung at a time
    @Test
    fun goingUp() {
        assertEquals(
            listOf("onCreate", "onStart", "onResume"),
            transition(LifecycleState.INITIALIZED, LifecycleState.RESUMED),
        )
        assertEquals(listOf("onCreate"), transition(LifecycleState.INITIALIZED, LifecycleState.CREATED))
        assertEquals(listOf("onStart", "onResume"), transition(LifecycleState.CREATED, LifecycleState.RESUMED))
        assertEquals(listOf("onResume"), transition(LifecycleState.STARTED, LifecycleState.RESUMED))
    }

    // backgrounding, and being finished with
    @Test
    fun goingDown() {
        assertEquals(listOf("onPause"), transition(LifecycleState.RESUMED, LifecycleState.STARTED))
        assertEquals(listOf("onPause", "onStop"), transition(LifecycleState.RESUMED, LifecycleState.CREATED))
        assertEquals(
            listOf("onPause", "onStop", "onDestroy"),
            transition(LifecycleState.RESUMED, LifecycleState.DESTROYED),
        )
        assertEquals(listOf("onStop", "onDestroy"), transition(LifecycleState.STARTED, LifecycleState.DESTROYED))
    }

    // nothing to do, and nothing left to do
    @Test
    fun nothingHappens() {
        assertEquals(emptyList<String>(), transition(LifecycleState.RESUMED, LifecycleState.RESUMED))
        assertEquals(emptyList<String>(), transition(LifecycleState.DESTROYED, LifecycleState.DESTROYED))
        assertEquals(emptyList<String>(), transition(LifecycleState.DESTROYED, LifecycleState.RESUMED))
        assertEquals(emptyList<String>(), transition(LifecycleState.DESTROYED, LifecycleState.CREATED))
        assertEquals(emptyList<String>(), transition(LifecycleState.INITIALIZED, LifecycleState.DESTROYED))
    }

    // a rotation, as the framework sees it
    @Test
    fun rotation() {
        val away = transition(LifecycleState.RESUMED, LifecycleState.DESTROYED)
        val back = transition(LifecycleState.INITIALIZED, LifecycleState.RESUMED)
        assertEquals(
            listOf("onPause", "onStop", "onDestroy", "onCreate", "onStart", "onResume"),
            away + back,
        )
    }

    // at least started, at least created
    @Test
    fun atLeast() {
        assertTrue(isAtLeast(LifecycleState.RESUMED, LifecycleState.STARTED))
        assertTrue(isAtLeast(LifecycleState.STARTED, LifecycleState.STARTED))
        assertTrue(isAtLeast(LifecycleState.CREATED, LifecycleState.DESTROYED))
        assertFalse(isAtLeast(LifecycleState.CREATED, LifecycleState.STARTED))
        assertFalse(isAtLeast(LifecycleState.DESTROYED, LifecycleState.INITIALIZED))
        assertFalse(isAtLeast(LifecycleState.INITIALIZED, LifecycleState.RESUMED))
    }
}
```

#### Uses
- [Lifecycle & saved state › The activity lifecycle](#/lifecycle/the-activity-lifecycle)
- [Reference › Numbers](#/reference/numbers)

#### Hints
- The enum is declared in rung order, so `state.ordinal` is the rung number and `isAtLeast` is one comparison.
- Going up from rung `i` to `i + 1` fires a callback named by `i`; going down from `i` to `i - 1` fires one named by `i`. Two small lookup maps or lists, keyed by rung.
- `(from.ordinal until to.ordinal)` walks the rungs you climb; `(from.ordinal downTo to.ordinal + 1)` walks the ones you descend.

#### Tips
- There is no `onRestart` in this model and there is one in the real framework — it fires between `onStop` and `onStart` when a stopped activity comes back. Left out here because it is the one rung that is not a state.
- `Lifecycle.State.isAtLeast` really is an ordinal comparison, and `DESTROYED` really is the bottom, which is why "at least CREATED" is false for a destroyed screen.
- `repeatOnLifecycle(Lifecycle.State.STARTED)` is this ladder in one call: run the block when the component climbs to Started, cancel it when it drops below.

#### Docs
- [The activity lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle)
- [Lifecycle-aware components](https://developer.android.com/topic/libraries/architecture/lifecycle)

### 2. Save what the user did, not what you fetched

The saved instance state bundle is small and slow, and it comes back on a device that may have restarted since. Save the user's input; recompute everything else.

`save(form)` returns what belongs in the bundle. Only three things do: the `query` (trimmed), the `page`, and the `selectedIds`. The results, the loading flag and anything else are dropped — they are recomputed from the query on the way back.

`restore(saved)` rebuilds the form from a bundle that may be `null` (a first launch), may be missing keys, and may have been written by an older version of the app with the wrong type in a key. Anything absent or of the wrong type falls back to its default: an empty query, page 1, no selection, nothing in flight and no results. A trimmed-empty query is not saved at all.

```kotlin starter
data class FormState(
    val query: String = "",
    val page: Int = 1,
    val selectedIds: List<Long> = emptyList(),
    val isSubmitting: Boolean = false,
    val results: List<String> = emptyList(),
)

fun save(form: FormState): Map<String, Any?> = emptyMap()

fun restore(saved: Map<String, Any?>?): FormState = FormState()
```

```kotlin test
class SavedStateTest {
    // only the three keys worth their space
    @Test
    fun savesTheInput() {
        val form = FormState(
            query = "  boots  ",
            page = 3,
            selectedIds = listOf(7L, 9L),
            isSubmitting = true,
            results = listOf("a", "b"),
        )
        assertEquals(
            mapOf("query" to "boots", "page" to 3, "selectedIds" to listOf(7L, 9L)),
            save(form),
        )
    }

    // an empty query is not worth saving either
    @Test
    fun skipsEmptyQuery() {
        assertEquals(mapOf("page" to 1, "selectedIds" to emptyList<Long>()), save(FormState()))
        assertEquals(mapOf("page" to 2, "selectedIds" to emptyList<Long>()), save(FormState(query = "   ", page = 2)))
    }

    // what goes in comes out, minus what was never saved
    @Test
    fun roundTrip() {
        val form = FormState("boots", 3, listOf(7L, 9L), isSubmitting = true, results = listOf("a"))
        val back = restore(save(form))
        assertEquals("boots", back.query)
        assertEquals(3, back.page)
        assertEquals(listOf(7L, 9L), back.selectedIds)
        assertEquals(false, back.isSubmitting)
        assertEquals(emptyList<String>(), back.results)
    }

    // a first launch, and a half-empty bundle
    @Test
    fun defaults() {
        assertEquals(FormState(), restore(null))
        assertEquals(FormState(), restore(emptyMap()))
        assertEquals(FormState(query = "boots"), restore(mapOf("query" to "boots")))
        assertEquals(FormState(page = 5), restore(mapOf("page" to 5)))
    }

    // a bundle written by a version of the app that thought differently
    @Test
    fun survivesRubbish() {
        assertEquals(FormState(), restore(mapOf("query" to 42, "page" to "3", "selectedIds" to "7,9")))
        assertEquals(FormState(), restore(mapOf("query" to null, "page" to null, "selectedIds" to null)))
        assertEquals(
            FormState(query = "boots"),
            restore(mapOf("query" to "boots", "page" to listOf(1), "selectedIds" to 9L)),
        )
    }
}
```

#### Uses
- [Lifecycle & saved state › Process death](#/lifecycle/process-death)
- [Lifecycle & saved state › rememberSaveable](#/lifecycle/remembersaveable)

#### Hints
- `buildMap { }` makes the conditional key easy: always put `page` and `selectedIds`, and put `query` only when the trimmed value is not empty.
- `saved?.get("page") as? Int ?: 1` is the whole defensive read: `as?` gives `null` for the wrong type instead of throwing.
- A `List<Long>` read back out is a `List<*>`; `filterIsInstance<Long>()` after an `as? List<*>` gets you a typed list without an unchecked cast.

#### Tips
- `TransactionTooLargeException` is what happens when you save the results as well as the query. The whole bundle for a task is capped at around a megabyte, and exceeding it crashes the app on the way *out*, where you will never see it in testing.
- Restoring defensively is not paranoia: an app that was backgrounded before an update is restored after it, with the old version's bundle.
- The same rule applies to `SavedStateHandle`. It is the same bundle, with a nicer API in front of it.

#### Docs
- [Save UI states](https://developer.android.com/topic/libraries/architecture/saving-states)
- [SavedStateHandle](https://developer.android.com/topic/libraries/architecture/viewmodel/viewmodel-savedstate)

### 3. Pick the cheapest thing that works

Every piece of state has a shortest safe home, and using a longer-lived one than you need costs disk, bundle space or a stale value that will not go away.

`survives(holder, event)` fills in the table. There are four holders, listed from cheapest to most expensive — `REMEMBER`, `VIEW_MODEL`, `SAVED_STATE`, `DISK` — and four things that can happen:

- `RECOMPOSITION` — every holder survives it.
- `CONFIG_CHANGE` — everything except `REMEMBER`.
- `PROCESS_DEATH` — only `SAVED_STATE` and `DISK`.
- `LEAVING_THE_SCREEN` — only `DISK`.

`cheapest(needs)` then returns the first holder in that order surviving everything in `needs`, or `null` when nothing does. An empty set of needs is satisfied by the cheapest holder there is.

```kotlin starter
enum class Holder { REMEMBER, VIEW_MODEL, SAVED_STATE, DISK }

enum class Event { RECOMPOSITION, CONFIG_CHANGE, PROCESS_DEATH, LEAVING_THE_SCREEN }

fun survives(holder: Holder, event: Event): Boolean = true

fun cheapest(needs: Set<Event>): Holder? = Holder.DISK
```

```kotlin test
class HolderTest {
    // recomposition is what remember is for
    @Test
    fun recomposition() {
        Holder.entries.forEach { assertTrue("$it", survives(it, Event.RECOMPOSITION)) }
    }

    // rotation is where remember stops being enough
    @Test
    fun configChange() {
        assertFalse(survives(Holder.REMEMBER, Event.CONFIG_CHANGE))
        assertTrue(survives(Holder.VIEW_MODEL, Event.CONFIG_CHANGE))
        assertTrue(survives(Holder.SAVED_STATE, Event.CONFIG_CHANGE))
        assertTrue(survives(Holder.DISK, Event.CONFIG_CHANGE))
    }

    // process death takes the ViewModel with it
    @Test
    fun processDeath() {
        assertFalse(survives(Holder.REMEMBER, Event.PROCESS_DEATH))
        assertFalse(survives(Holder.VIEW_MODEL, Event.PROCESS_DEATH))
        assertTrue(survives(Holder.SAVED_STATE, Event.PROCESS_DEATH))
        assertTrue(survives(Holder.DISK, Event.PROCESS_DEATH))
    }

    // only what you wrote down is still there tomorrow
    @Test
    fun leaving() {
        assertFalse(survives(Holder.REMEMBER, Event.LEAVING_THE_SCREEN))
        assertFalse(survives(Holder.VIEW_MODEL, Event.LEAVING_THE_SCREEN))
        assertFalse(survives(Holder.SAVED_STATE, Event.LEAVING_THE_SCREEN))
        assertTrue(survives(Holder.DISK, Event.LEAVING_THE_SCREEN))
    }

    // the cheapest home for a given requirement
    @Test
    fun choosing() {
        assertEquals(Holder.REMEMBER, cheapest(emptySet()))
        assertEquals(Holder.REMEMBER, cheapest(setOf(Event.RECOMPOSITION)))
        assertEquals(Holder.VIEW_MODEL, cheapest(setOf(Event.CONFIG_CHANGE)))
        assertEquals(Holder.SAVED_STATE, cheapest(setOf(Event.CONFIG_CHANGE, Event.PROCESS_DEATH)))
        assertEquals(Holder.DISK, cheapest(setOf(Event.LEAVING_THE_SCREEN)))
        assertEquals(
            Holder.DISK,
            cheapest(setOf(Event.RECOMPOSITION, Event.CONFIG_CHANGE, Event.PROCESS_DEATH, Event.LEAVING_THE_SCREEN)),
        )
    }
}
```

#### Uses
- [Lifecycle & saved state › Configuration changes](#/lifecycle/configuration-changes)
- [Lifecycle & saved state › SavedStateHandle](#/lifecycle/savedstatehandle)

#### Hints
- `when (event)` with a `when (holder)` inside — or the other way round — is four short lines either way.
- `Holder.entries` is the enum's values in declaration order, which is already cheapest-first.
- `needs.all { survives(holder, it) }` is the test each candidate has to pass; `firstOrNull` over the entries picks the winner.

#### Tips
- The row that surprises people is `VIEW_MODEL` against `PROCESS_DEATH`. A `ViewModel` survives rotation, which makes it feel permanent, and it is not.
- `DISK` covering everything is not a reason to put everything there. State that should not outlive the screen, but does, is how a search box comes back pre-filled from yesterday.
- In practice the answer for a screen is usually two holders, not one: a `ViewModel` for what it is doing, and its `SavedStateHandle` for the handful of values the user typed.

#### Docs
- [Save UI state: the options](https://developer.android.com/topic/libraries/architecture/saving-states)
- [ViewModel and process death](https://developer.android.com/topic/libraries/architecture/viewmodel/viewmodel-savedstate)

### 4. A screen that cannot lose your work

Build a filter sheet — a text field, a toggle, a multi-select of categories and an Apply button — and make it survive both a rotation and a process death without losing anything the user typed.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- The filter is one data class, held in a `ViewModel` and exposed as a `StateFlow`.
- The values the user typed are kept in the `ViewModel`'s `SavedStateHandle`, not in a plain property.
- Any purely visual state — whether the sheet is expanded, which chip is animating — is `remember`, not saved.
- Rotating the device keeps the text, the toggle and the selection.
- With "Don't keep activities" switched on in developer options, backgrounding the app and returning keeps them too.
- `adb shell am kill <your.package>` while the app is in the background, then reopening it from Recents, keeps them as well.
- The Apply button is disabled while a filter is being applied, and that flag is *not* saved.

```kotlin solution
// FilterViewModel.kt
data class Filter(
    val text: String = "",
    val onlyInStock: Boolean = false,
    val categoryIds: List<Long> = emptyList(),
)

class FilterViewModel(private val handle: SavedStateHandle) : ViewModel() {

    private val _isApplying = MutableStateFlow(false)          // transient: deliberately not saved

    val filter: StateFlow<Filter> = combine(
        handle.getStateFlow(KEY_TEXT, ""),
        handle.getStateFlow(KEY_IN_STOCK, false),
        handle.getStateFlow(KEY_CATEGORIES, longArrayOf()),
    ) { text, inStock, categories ->
        Filter(text = text, onlyInStock = inStock, categoryIds = categories.toList())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Filter())

    val isApplying: StateFlow<Boolean> = _isApplying.asStateFlow()

    fun onTextChange(value: String) { handle[KEY_TEXT] = value }

    fun onInStockChange(value: Boolean) { handle[KEY_IN_STOCK] = value }

    fun toggleCategory(id: Long) {
        val current = handle.get<LongArray>(KEY_CATEGORIES)?.toMutableList() ?: mutableListOf()
        if (!current.remove(id)) current.add(id)
        handle[KEY_CATEGORIES] = current.toLongArray()
    }

    fun apply(onDone: () -> Unit) {
        viewModelScope.launch {
            _isApplying.value = true
            try {
                repo.apply(filter.value)
                onDone()
            } finally {
                _isApplying.value = false
            }
        }
    }

    private companion object {
        const val KEY_TEXT = "text"
        const val KEY_IN_STOCK = "inStock"
        const val KEY_CATEGORIES = "categories"
    }
}

// FilterSheet.kt
@Composable
fun FilterSheet(
    categories: List<Category>,
    viewModel: FilterViewModel = viewModel(),
    onApplied: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val isApplying by viewModel.isApplying.collectAsStateWithLifecycle()
    var expanded by remember { mutableStateOf(false) }   // visual only: losing it costs nothing

    Column(modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = filter.text,
            onValueChange = viewModel::onTextChange,
            label = { Text(stringResource(R.string.filter_text)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = filter.onlyInStock, onCheckedChange = viewModel::onInStockChange)
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.only_in_stock))
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            categories.forEach { category ->
                FilterChip(
                    selected = category.id in filter.categoryIds,
                    onClick = { viewModel.toggleCategory(category.id) },
                    label = { Text(category.name) },
                )
            }
        }
        Button(
            onClick = { viewModel.apply(onApplied) },
            enabled = !isApplying,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.apply)) }
    }
}
```

#### Uses
- [Lifecycle & saved state › SavedStateHandle](#/lifecycle/savedstatehandle)
- [Lifecycle & saved state › Configuration changes](#/lifecycle/configuration-changes)
- [Coroutines on Android › Collecting safely](#/coroutines/collecting-safely)

#### Hints
- `handle.getStateFlow(key, default)` gives a `StateFlow` that updates whenever you write to that key, so the state and the bundle are the same thing.
- `SavedStateHandle` stores what a `Bundle` stores, so a `List<Long>` goes in as a `LongArray` (or an `ArrayList<Long>`), not as a `List`.
- `combine` of three handle flows into one `Filter` keeps the screen reading a single state object.

#### Tips
- The flag you should *not* save is the one that says work is in flight. After a process death that work is not in flight any more, and a restored `true` is a permanently disabled button.
- "Don't keep activities" is the fastest way to find these bugs and the slowest way to use your phone. Turn it on for an afternoon, then off.
- If the screen's arguments came from navigation, they are already in the same `SavedStateHandle` under their argument names — you do not need to save them again.

#### Docs
- [SavedStateHandle](https://developer.android.com/topic/libraries/architecture/viewmodel/viewmodel-savedstate)
- [Save UI states](https://developer.android.com/topic/libraries/architecture/saving-states)

### 5. A saver for a type the bundle has never heard of

Some state does not belong in a `ViewModel` — the position of a wizard, a half-finished drawing, a selection inside one list item. Keep it in the composition, but teach it to survive a process death with a `Saver`.

#### Build it
- A composable holding a value of a type of your own — at least two fields, one of them not a primitive.
- The value lives in `rememberSaveable(stateSaver = …) { mutableStateOf(…) }`, so it survives a rotation with no `ViewModel` involved.
- A `listSaver` or `mapSaver` for the type, written next to it.
- `restore` tolerates a bundle that is the wrong shape and returns the default rather than throwing.
- A `rememberSaveable` whose key depends on an argument, so two instances of the composable in a `LazyColumn` do not share a value.
- Rotating and killing the process both leave the value where the user put it.

```kotlin solution
// WizardStep.kt
data class WizardStep(
    val index: Int,
    val answers: List<String>,
    val startedAt: Instant,
)

val WizardStepSaver: Saver<WizardStep, Any> = listSaver(
    save = { step -> listOf(step.index, step.answers, step.startedAt.toEpochMilli()) },
    restore = { saved ->
        // A bundle written by an older version can be any shape at all; never let it crash the screen.
        runCatching {
            val parts = saved as List<*>
            WizardStep(
                index = parts[0] as Int,
                answers = (parts[1] as List<*>).filterIsInstance<String>(),
                startedAt = Instant.ofEpochMilli(parts[2] as Long),
            )
        }.getOrNull()
    },
)

@Composable
fun Wizard(
    questionId: String,
    modifier: Modifier = Modifier,
) {
    // The key means two Wizards in the same list keep their own state.
    var step by rememberSaveable(questionId, stateSaver = WizardStepSaver) {
        mutableStateOf(WizardStep(index = 0, answers = emptyList(), startedAt = Instant.now()))
    }

    Column(modifier.padding(16.dp)) {
        Text(stringResource(R.string.step_of, step.index + 1, TOTAL_STEPS))
        OutlinedTextField(
            value = step.answers.getOrElse(step.index) { "" },
            onValueChange = { answer ->
                step = step.copy(
                    answers = step.answers.toMutableList().also { list ->
                        while (list.size <= step.index) list.add("")
                        list[step.index] = answer
                    },
                )
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { step = step.copy(index = step.index + 1) },
            enabled = step.index < TOTAL_STEPS - 1,
        ) { Text(stringResource(R.string.next)) }
    }
}

private const val TOTAL_STEPS = 3
```

#### Uses
- [Lifecycle & saved state › rememberSaveable](#/lifecycle/remembersaveable)
- [Lifecycle & saved state › The composable lifecycle](#/lifecycle/the-composable-lifecycle)
- [Lifecycle & saved state › Process death](#/lifecycle/process-death)

#### Hints
- `listSaver(save = { listOf(…) }, restore = { … })` is the shortest `Saver`; `mapSaver` is the same with names instead of positions.
- A `restore` returning `null` means "could not restore", and `rememberSaveable` falls back to the initialiser — which is exactly what you want for a bundle you cannot read.
- The extra arguments to `rememberSaveable(key1, key2, …)` are inputs: change one and the value is recalculated from the initialiser rather than restored.

#### Tips
- Everything a `Saver` produces has to be something a `Bundle` can hold, all the way down. A list of your own data class will not do; a list of its fields will.
- `@Parcelize` on a data class gives you a saver for free — `rememberSaveable` accepts any `Parcelable` with no `Saver` at all.
- If the value is big enough that you hesitate about the bundle, it belongs in a database and the composable should hold its id.

#### Docs
- [Compose: state and saved state](https://developer.android.com/develop/ui/compose/state#restore-ui-state)
- [Saver](https://developer.android.com/reference/kotlin/androidx/compose/runtime/saveable/Saver)
