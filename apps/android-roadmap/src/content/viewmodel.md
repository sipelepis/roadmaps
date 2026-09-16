# ViewModel & UI state

A `ViewModel` is the object that owns a screen's state and outlives the screen's recreation. Rotate the device, fold the phone, change the system font size — the activity is destroyed and rebuilt, every composable is thrown away and composed again, and the ViewModel is handed back to the new one, still holding what the old one had.

That is the mechanical part. The part that changes how your code reads is the discipline it makes possible: the screen's entire state is one immutable object, produced by the ViewModel and consumed by composables that decide nothing. The UI becomes a function of that object, and the interesting logic moves somewhere a unit test can reach without a device.

## What a ViewModel survives

```kotlin
class CartViewModel : ViewModel() {
    private val _state = MutableStateFlow(CartUiState())
    val state: StateFlow<CartUiState> = _state.asStateFlow()

    override fun onCleared() { /* the screen is finished for good */ }
}

@Composable
fun CartScreen(viewModel: CartViewModel = viewModel()) { … }
```

`viewModel()` does not construct a new one on every recomposition. It looks up the `ViewModelStore` of the nearest owner — the activity, the fragment, or the navigation back-stack entry — and either returns the instance already there or creates it.

| Event | The ViewModel |
| --- | --- |
| Recomposition | same instance |
| Configuration change (rotation, dark mode, font scale) | same instance |
| Navigating forward and coming back to the same back-stack entry | same instance |
| The user pressing back, the screen finishing | `onCleared()`, then gone |
| The system killing the process to reclaim memory | gone — only `SavedStateHandle` survives |

The last row is why a ViewModel is not a complete answer to state restoration. It survives the *configuration* change, not the process death; for that you need `SavedStateHandle`, at the end of this module.

Scope matters as much as lifetime. A ViewModel obtained inside a navigation destination is scoped to that destination and cleared when it leaves the back stack; one obtained from the activity is shared by every screen in it, which is occasionally what you want and more often an accident.

## One immutable state object

Give the screen one `data class` holding everything it renders:

```kotlin
data class CartUiState(
    val isLoading: Boolean = false,
    val items: List<CartItem> = emptyList(),
    val error: String? = null,
)
```

Not four separate flows of `Boolean`, `List` and `String?`. One object, because the combinations matter: "loading with stale items still on screen" and "an error with the previous items still visible" are states you want to be able to express, and states you want to be *forced* to think about.

Every change produces a new object with `copy`, never a mutation of the old one:

```kotlin
_state.update { it.copy(isLoading = true, error = null) }
```

The immutability is what makes the state safe to hand to Compose: a `data class` of stable properties is itself stable, so composables taking it can be skipped, and no one can change it underneath a composition that is halfway through reading it.

Where the state has genuinely exclusive shapes, a `sealed interface` says so better than a pile of nullable fields:

```kotlin
sealed interface CartUiState {
    data object Loading : CartUiState
    data class Ready(val items: List<CartItem>, val refreshing: Boolean) : CartUiState
    data class Failed(val message: String) : CartUiState
}
```

Use the sealed version when the screen really is one of n things at a time, and the flat `data class` when the flags combine. Mixing a nullable error into a sealed hierarchy is how you end up with states no designer ever drew.

## StateFlow, and update

`StateFlow` is a hot flow with a current value: it always has one, it gives every new collector that value immediately, and it conflates — setting it to a value equal to the current one notifies nobody, which is exactly right for a UI.

```kotlin
private val _state = MutableStateFlow(CartUiState())
val state: StateFlow<CartUiState> = _state.asStateFlow()
```

Two properties, always: a private mutable one and a public read-only view. `asStateFlow()` is what stops a screen from writing to your state.

Change it with `update`, not with `value =`:

```kotlin
_state.update { it.copy(isLoading = true) }        // atomic read-modify-write
_state.value = _state.value.copy(isLoading = true) // two operations, and a race between them
```

`update` applies the lambda atomically, retrying if something else changed the value in between. With two coroutines finishing at once — a refresh and a delete, say — the `value =` form silently loses one of them. Assign directly only when the new value does not depend on the old one.

## Collecting state in the UI

```kotlin
@Composable
fun CartScreen(viewModel: CartViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    CartContent(
        state = state,
        onRemove = viewModel::remove,
    )
}
```

`collectAsStateWithLifecycle()` — from `lifecycle-runtime-compose` — collects only while the screen is at least STARTED, and stops when it goes to the background. The plain `collectAsState()` keeps collecting behind a locked screen, which for a `StateFlow` is mostly harmless and for anything upstream of it is a battery bill. Prefer the lifecycle-aware one on Android, always.

Note the shape of the screen: a stateful composable that gets the ViewModel and collects, and a stateless `CartContent` that takes the state and callbacks. The second one previews, screenshot-tests, and has no idea a ViewModel exists. The ViewModel does not belong in the composable you want to look at.

## Events are not state

Some things happen once: show a snackbar, navigate away, fire a share sheet. If you model them as state, they happen again on the next recomposition, and again after the next rotation — the infamous snackbar that reappears every time you turn the phone.

The two workable answers:

**Keep the event in the state, with an identity, and remove it when it has been handled.**

```kotlin
data class CartUiState(val messages: List<UserMessage> = emptyList())
data class UserMessage(val id: Long, val text: String)

fun onMessageShown(id: Long) {
    _state.update { it.copy(messages = it.messages.filterNot { m -> m.id == id }) }
}
```

The UI shows the first message, and tells the ViewModel when it has been shown. Nothing is lost if the screen is recreated mid-flight, and nothing repeats. This is the recommended approach for anything the user must not miss.

**Or send it down a `Channel`, consumed exactly once.**

```kotlin
private val _events = Channel<CartEvent>(Channel.BUFFERED)
val events = _events.receiveAsFlow()
```

`receiveAsFlow` delivers each element to exactly one collector, so a recreated screen does not replay what the old one already handled. Do not use a `SharedFlow` with a replay for this; replay is precisely the behaviour you are trying to avoid.

What never works: a `Boolean` in the state called `navigateToCheckout`, set to `true` and never reliably set back.

## viewModelScope

`viewModelScope` is a `CoroutineScope` tied to the ViewModel: everything launched in it is cancelled in `onCleared()`, so a request in flight when the user leaves does not hold the screen alive or crash on a dead reference.

```kotlin
fun refresh() {
    viewModelScope.launch {
        _state.update { it.copy(isLoading = true, error = null) }
        val result = runCatching { repository.load() }
        _state.update { state ->
            result.fold(
                onSuccess = { state.copy(isLoading = false, items = it) },
                onFailure = { state.copy(isLoading = false, error = it.message ?: "Something went wrong") },
            )
        }
    }
}
```

It runs on `Dispatchers.Main.immediate`, so the state updates happen on the main thread; the actual work should suspend onto an IO dispatcher inside the repository, not here.

## What does not belong in a ViewModel

- **A `Context`, an `Activity` or a `View`.** They outlive nothing and holding one leaks the whole activity. If you need a string, pass a resource id out in the state and resolve it in the composable.
- **Composables.** A ViewModel produces state, it does not produce UI.
- **Navigation decisions made for the caller.** Emit an event; let the screen call the navigator.
- **Business rules that have nothing to do with this screen.** They belong in a use case or a repository the ViewModel calls, so that two screens can share them.

A ViewModel that only needs a repository and produces one state object is a ViewModel you can test in a plain JVM test: construct it with a fake, send events, assert on `state.value`.

## SavedStateHandle

```kotlin
class SearchViewModel(private val savedState: SavedStateHandle) : ViewModel() {
    val query: StateFlow<String> = savedState.getStateFlow("query", "")

    fun onQueryChange(value: String) { savedState["query"] = value }
}
```

`SavedStateHandle` is a `Bundle` with a ViewModel's lifetime and a saved-state's durability: it survives process death, so the user who left your app for a phone call comes back to the query they typed. It also carries a navigation destination's arguments, which is how a detail screen gets the id it is showing.

Same discipline as `rememberSaveable`: put in what the user cannot reproduce — their input, their selection, their position — not what you can fetch again.

```kotlin playground
// A screen's whole life as a fold: one immutable state, one reducer, one event at a time.
data class UiState(
    val isLoading: Boolean = false,
    val items: List<String> = emptyList(),
    val error: String? = null,
)

sealed interface Event {
    data object Refresh : Event
    data class Loaded(val items: List<String>) : Event
    data class Failed(val message: String) : Event
    data class Removed(val item: String) : Event
    data object DismissError : Event
}

fun reduce(state: UiState, event: Event): UiState = when (event) {
    is Event.Refresh -> state.copy(isLoading = true, error = null)
    is Event.Loaded -> state.copy(isLoading = false, items = event.items, error = null)
    is Event.Failed -> state.copy(isLoading = false, error = event.message)
    is Event.Removed -> state.copy(items = state.items.filterNot { it == event.item })
    is Event.DismissError -> state.copy(error = null)
}

fun render(state: UiState): String = when {
    state.isLoading && state.items.isEmpty() -> "spinner"
    state.error != null && state.items.isEmpty() -> "error screen: ${state.error}"
    state.items.isEmpty() -> "empty state"
    else -> "${state.items.size} rows${if (state.isLoading) " + refreshing" else ""}${state.error?.let { " + snackbar: $it" } ?: ""}"
}

fun main() {
    val events = listOf(
        Event.Refresh,
        Event.Loaded(listOf("Milk", "Bread", "Coffee")),
        Event.Removed("Bread"),
        Event.Refresh,                       // a pull-to-refresh, with rows still on screen
        Event.Failed("offline"),             // which fails: keep the rows, add a message
        Event.DismissError,
    )
    var state = UiState()
    println("%-28s %s".format("start", render(state)))
    for (event in events) {
        state = reduce(state, event)
        println("%-28s %s".format(event::class.simpleName, render(state)))
    }
    println("\nfinal state: $state")
    println("^ every line is a new object; nothing above was mutated to get here")
}
```

## Exercises

### 1. The reducer

Every event a screen can receive, and the one immutable state it produces. `reduce(state, event)` returns the next state. `Refresh` starts loading and clears any error, keeping whatever rows are already on screen. `Loaded` stops loading, replaces the items and clears the error. `Failed` stops loading and records the message, leaving the items alone — a failed refresh should not blank the screen. `Removed` drops every copy of that item without touching anything else, and `DismissError` clears the error and nothing else.

```kotlin starter
data class UiState(
    val isLoading: Boolean = false,
    val items: List<String> = emptyList(),
    val error: String? = null,
)

sealed interface Event {
    data object Refresh : Event
    data class Loaded(val items: List<String>) : Event
    data class Failed(val message: String) : Event
    data class Removed(val item: String) : Event
    data object DismissError : Event
}

fun reduce(state: UiState, event: Event): UiState {
    return state
}
```

```kotlin test
class ReduceTest {
    private val ready = UiState(isLoading = false, items = listOf("Milk", "Bread"), error = null)

    // loading starts and finishes
    @Test
    fun loading() {
        assertEquals(UiState(isLoading = true), reduce(UiState(), Event.Refresh))
        assertEquals(
            UiState(isLoading = false, items = listOf("Milk", "Bread")),
            reduce(UiState(isLoading = true), Event.Loaded(listOf("Milk", "Bread"))),
        )
        assertEquals(
            UiState(isLoading = true, items = listOf("Milk", "Bread")),
            reduce(ready, Event.Refresh),
        )
    }

    // a failure keeps what is on screen
    @Test
    fun failure() {
        val refreshing = reduce(ready, Event.Refresh)
        val failed = reduce(refreshing, Event.Failed("offline"))
        assertEquals(UiState(isLoading = false, items = listOf("Milk", "Bread"), error = "offline"), failed)
        assertEquals(UiState(isLoading = false, items = listOf("Milk", "Bread")), reduce(failed, Event.DismissError))
        assertEquals(UiState(isLoading = false, error = "offline"), reduce(UiState(isLoading = true), Event.Failed("offline")))
        assertNull("a refresh clears the last error", reduce(failed, Event.Refresh).error)
    }

    // removal and immutability
    @Test
    fun removalAndImmutability() {
        assertEquals(UiState(items = listOf("Bread")), reduce(ready, Event.Removed("Milk")))
        assertEquals(UiState(items = listOf("Milk", "Bread")), reduce(ready, Event.Removed("Coffee")))
        assertEquals(UiState(items = listOf()), reduce(UiState(items = listOf("Milk", "Milk")), Event.Removed("Milk")))
        reduce(ready, Event.Removed("Milk"))
        assertEquals("the state handed in must not change", listOf("Milk", "Bread"), ready.items)
    }
}
```

#### Uses
- [ViewModel & UI state › One immutable state object](#/viewmodel/one-immutable-state-object)
- [State & recomposition › Unidirectional data flow](#/state/unidirectional-data-flow)

#### Hints
- `when (event)` over the sealed interface, with one `state.copy(...)` per branch. The compiler will not let you forget a case.
- Only name the fields that change. `state.copy(isLoading = true, error = null)` keeps `items` by itself.
- "Every copy" of an item means `filterNot { it == event.item }`, not `items - event.item`, which removes only the first.

#### Tips
- A reducer is a pure function of `(state, event)`, which means a screen's whole behaviour can be tested as a list of events folded into a list of states — no Android, no coroutines, no device.
- `Failed` keeping the items is a product decision hiding in a line of code. Writing it as a reducer is what makes that decision visible and reviewable.
- Once this function exists, the ViewModel's job shrinks to calling it: `_state.update { reduce(it, event) }`.

#### Docs
- [UI state production](https://developer.android.com/topic/architecture/ui-layer/state-production)
- [UI layer architecture](https://developer.android.com/topic/architecture/ui-layer)

### 2. A search pipeline

A ViewModel usually transforms one flow into another. `results(queries, search)` turns a flow of what the user has typed into the flow of states the screen should show. A repeated identical query is ignored. A blank query emits `Empty` and never calls `search`. Any other query emits `Loading` and then either `Success` with what came back, or `Error` with the exception's message — a search that throws must not kill the flow, because the user will type again.

```kotlin starter
import kotlinx.coroutines.flow.*

sealed interface SearchState {
    data object Empty : SearchState
    data object Loading : SearchState
    data class Success(val results: List<String>) : SearchState
    data class Error(val message: String) : SearchState
}

fun results(queries: Flow<String>, search: suspend (String) -> List<String>): Flow<SearchState> =
    queries.map { SearchState.Empty }
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class SearchTest {
    private val index = mapOf("a" to listOf("apple", "apricot"), "ap" to listOf("apple"))
    private val search: suspend (String) -> List<String> = { q -> index[q] ?: emptyList() }

    // loading, then what came back
    @Test
    fun happyPath() {
        runBlocking {
            assertEquals(
                listOf(SearchState.Loading, SearchState.Success(listOf("apple", "apricot"))),
                results(flowOf("a"), search).toList(),
            )
            assertEquals(
                listOf(SearchState.Loading, SearchState.Success(listOf("apple", "apricot")), SearchState.Loading, SearchState.Success(listOf("apple"))),
                results(flowOf("a", "ap"), search).toList(),
            )
            assertEquals(
                listOf(SearchState.Loading, SearchState.Success(listOf())),
                results(flowOf("zz"), search).toList(),
            )
        }
    }

    // repeats are ignored, blanks are empty
    @Test
    fun repeatsAndBlanks() {
        runBlocking {
            assertEquals(
                listOf(SearchState.Loading, SearchState.Success(listOf("apple", "apricot"))),
                results(flowOf("a", "a", "a"), search).toList(),
            )
            assertEquals(listOf(SearchState.Empty), results(flowOf(""), search).toList())
            assertEquals(listOf(SearchState.Empty), results(flowOf("   "), search).toList())
            assertEquals(
                listOf(SearchState.Loading, SearchState.Success(listOf("apple")), SearchState.Empty),
                results(flowOf("ap", ""), search).toList(),
            )
            assertEquals(listOf<SearchState>(), results(emptyFlow(), search).toList())
        }
    }

    // a failure is a state, not the end of the flow
    @Test
    fun failure() {
        runBlocking {
            var calls = 0
            val flaky: suspend (String) -> List<String> = { q ->
                calls++
                if (q == "boom") throw IllegalStateException("offline") else listOf(q)
            }
            assertEquals(
                listOf(SearchState.Loading, SearchState.Error("offline"), SearchState.Loading, SearchState.Success(listOf("ok"))),
                results(flowOf("boom", "ok"), flaky).toList(),
            )
            assertEquals("the repository is asked once per distinct query", 2, calls)
        }
    }
}
```

#### Uses
- [ViewModel & UI state › StateFlow, and update](#/viewmodel/stateflow-and-update)
- [ViewModel & UI state › One immutable state object](#/viewmodel/one-immutable-state-object)
- [State & recomposition › Unidirectional data flow](#/state/unidirectional-data-flow)
- [Reference › Flow and StateFlow](#/reference/flow-and-stateflow)

#### Hints
- `distinctUntilChanged()` drops a repeated value; it compares with `equals`, so identical strings are dropped.
- `transform { query -> … }` lets one incoming value emit several outgoing ones — which is exactly `Loading` followed by a result.
- Wrap the call in `try`/`catch` inside the `transform`, and emit `SearchState.Error(e.message ?: "…")`. A `catch { }` operator outside would end the flow after the first failure.
- Return early for a blank query with `emit(SearchState.Empty)` before anything else runs.

#### Tips
- In a real ViewModel this flow ends in `.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SearchState.Empty)`, which turns it into a `StateFlow` that keeps running for five seconds after the screen goes away — long enough to survive a rotation, short enough not to leak.
- `debounce(300)` before `distinctUntilChanged()` is the other half of a real search box: do not ask the server about `"a"`, `"ap"`, `"app"` and `"appl"` on the way to `"apple"`.
- `flatMapLatest` would cancel the previous search when a new query arrives, which is usually what a search box wants and much harder to test deterministically. Reach for it once the sequential version is understood.

#### Docs
- [StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)
- [Flows in the UI layer](https://developer.android.com/topic/architecture/ui-layer#consume-ui-state)

### 3. A state holder

Put the pieces together into the object a ViewModel actually is: one `MutableStateFlow`, a read-only view of it, and functions that update it atomically. `onSave` starts saving. `onSaved(message)` stops saving and adds a message for the UI to show. `onMessageShown(message)` removes the first copy of that message, so a shown message is gone for good — an event, not state that repeats. Nothing here needs a `ViewModel` class or a `viewModelScope`; a plain object with a `StateFlow` is testable in exactly the same way.

```kotlin starter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class SaveState(val saving: Boolean = false, val messages: List<String> = emptyList())

class SaveHolder {
    private val _state = MutableStateFlow(SaveState())
    val state: StateFlow<SaveState> = _state.asStateFlow()

    fun onSave() {
    }

    fun onSaved(message: String) {
    }

    fun onMessageShown(message: String) {
    }
}
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class SaveHolderTest {
    // the state moves through saving and back
    @Test
    fun transitions() {
        val holder = SaveHolder()
        assertEquals(SaveState(), holder.state.value)
        holder.onSave()
        assertEquals(SaveState(saving = true), holder.state.value)
        holder.onSaved("Saved")
        assertEquals(SaveState(saving = false, messages = listOf("Saved")), holder.state.value)
    }

    // a message is shown once and never again
    @Test
    fun messagesAreOneShot() {
        val holder = SaveHolder()
        holder.onSaved("Saved")
        holder.onSaved("Saved")
        assertEquals(listOf("Saved", "Saved"), holder.state.value.messages)
        holder.onMessageShown("Saved")
        assertEquals("only the first copy goes", listOf("Saved"), holder.state.value.messages)
        holder.onMessageShown("Saved")
        assertEquals(listOf<String>(), holder.state.value.messages)
        holder.onMessageShown("never sent")
        assertEquals(listOf<String>(), holder.state.value.messages)
    }

    // every update is atomic, and the old state is untouched
    @Test
    fun atomic() {
        val holder = SaveHolder()
        val before = holder.state.value
        holder.onSave()
        assertEquals("the previous state object must not have changed", SaveState(), before)
        runBlocking {
            (1..200).map { launch(Dispatchers.Default) { holder.onSaved("message") } }.joinAll()
        }
        assertEquals(200, holder.state.value.messages.size)
        assertEquals(false, holder.state.value.saving)
    }
}
```

#### Uses
- [ViewModel & UI state › StateFlow, and update](#/viewmodel/stateflow-and-update)
- [ViewModel & UI state › Events are not state](#/viewmodel/events-are-not-state)
- [ViewModel & UI state › One immutable state object](#/viewmodel/one-immutable-state-object)
- [Reference › Coroutines](#/reference/coroutines)

#### Hints
- Each function is one `_state.update { it.copy(…) }`. Nothing else should touch `_state`.
- Appending is `it.messages + message`; removing the first copy is `it.messages - message`, which is precisely a first-occurrence removal.
- The last test is why `update` exists: `_state.value = _state.value.copy(...)` from two hundred coroutines at once loses some of them.

#### Tips
- The public `state` being a `StateFlow` and not a `MutableStateFlow` is not politeness. A screen that can write to the state is a screen that will, and then two places decide what is true.
- `holder.state.value` is the whole testing story for a state holder: send events, read the value. Collecting the flow is only needed when you care about the *sequence* of states.
- Making this a plain class rather than a `ViewModel` subclass is a real technique — the state logic is pure Kotlin, and the `ViewModel` around it just owns the scope. It is also how the same logic gets shared with iOS in a multiplatform project.

#### Docs
- [ViewModel overview](https://developer.android.com/topic/libraries/architecture/viewmodel)
- [StateFlow.update](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/update.html)

### 4. A screen driven by a ViewModel

Build the screen the reducer is for: a real `ViewModel` exposing one `StateFlow<UiState>`, a stateful composable that collects it, and a stateless one that renders loading, content and error. Not marked here — work the checklist, then compare with the solution.

#### Build it
- A `ViewModel` with a private `MutableStateFlow<UiState>` and a public `StateFlow` view, updated only through `update { reduce(it, event) }`.
- `implementation(libs.androidx.lifecycle.viewmodel.compose)` and `implementation(libs.androidx.lifecycle.runtime.compose)` in the app module.
- A stateful `ItemsRoute(viewModel: ItemsViewModel = viewModel())` that collects with `collectAsStateWithLifecycle()` and passes state and callbacks down.
- A stateless `ItemsScreen(state: UiState, onRefresh: () -> Unit, onRemove: (String) -> Unit, modifier: Modifier = Modifier)` with no ViewModel reference anywhere in it.
- Three visible states: a spinner when loading with nothing to show, the list when there is something, and an error message with a retry button when it failed with nothing to show.
- A refresh that fails while rows are on screen keeps the rows.
- Previews of the stateless screen in all three states, plus the "refreshing over existing content" one.
- Rotating the device does not re-trigger the load, because the ViewModel still has the state.

```kotlin solution
// ItemsViewModel.kt
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class ItemsViewModel(private val repository: ItemsRepository) : ViewModel() {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { reduce(it, Event.Refresh) }
            val event = runCatching { repository.load() }.fold(
                onSuccess = { Event.Loaded(it) },
                onFailure = { Event.Failed(it.message ?: "Something went wrong") },
            )
            _state.update { reduce(it, event) }
        }
    }

    fun remove(item: String) = _state.update { reduce(it, Event.Removed(item)) }

    fun dismissError() = _state.update { reduce(it, Event.DismissError) }
}

// ItemsScreen.kt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun ItemsRoute(
    modifier: Modifier = Modifier,
    viewModel: ItemsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ItemsScreen(
        state = state,
        onRefresh = viewModel::refresh,
        onRemove = viewModel::remove,
        modifier = modifier,
    )
}

@Composable
fun ItemsScreen(
    state: UiState,
    onRefresh: () -> Unit,
    onRemove: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    when {
        state.isLoading && state.items.isEmpty() -> Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator()
        }

        state.error != null && state.items.isEmpty() -> Column(
            modifier = modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(text = state.error, style = MaterialTheme.typography.bodyLarge)
            Button(onClick = onRefresh) { Text("Try again") }
        }

        else -> Column(modifier = modifier.fillMaxSize()) {
            if (state.isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(state.items, key = { it }) { item ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(text = item, modifier = Modifier.weight(1f))
                        TextButton(onClick = { onRemove(item) }) { Text("Remove") }
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true, name = "loading")
@Composable
private fun LoadingPreview() {
    MaterialTheme { ItemsScreen(UiState(isLoading = true), {}, {}) }
}

@Preview(showBackground = true, name = "content")
@Composable
private fun ContentPreview() {
    MaterialTheme { ItemsScreen(UiState(items = listOf("Milk", "Bread")), {}, {}) }
}

@Preview(showBackground = true, name = "error")
@Composable
private fun ErrorPreview() {
    MaterialTheme { ItemsScreen(UiState(error = "You are offline"), {}, {}) }
}

@Preview(showBackground = true, name = "refreshing over content")
@Composable
private fun RefreshingPreview() {
    MaterialTheme { ItemsScreen(UiState(isLoading = true, items = listOf("Milk", "Bread")), {}, {}) }
}
```

#### Uses
- [ViewModel & UI state › Collecting state in the UI](#/viewmodel/collecting-state-in-the-ui)
- [ViewModel & UI state › What a ViewModel survives](#/viewmodel/what-a-viewmodel-survives)
- [ViewModel & UI state › viewModelScope](#/viewmodel/viewmodelscope)
- [Composable functions › Previews](#/compose-basics/previews)

#### Hints
- `viewModel()` comes from `androidx.lifecycle.viewmodel.compose`, `collectAsStateWithLifecycle()` from `androidx.lifecycle.compose`. They are two different artifacts and the IDE will offer you the wrong one first.
- A ViewModel with constructor parameters needs a factory. `viewModel { ItemsViewModel(repository) }` with the `initializer` DSL is the lightweight way; Hilt's `@HiltViewModel` is the usual way in a real app.
- Loading in `init { }` is fine for a screen that always loads. Anything that needs an argument should take it from `SavedStateHandle` rather than from a `LaunchedEffect` in the composable.
- To prove the rotation behaviour, log in `init`. One line per screen, not one per rotation.

#### Tips
- The three-way `when` is the whole screen. If it grows a fourth branch that is not a real state, the state class is wrong, not the screen.
- Keeping the rows visible under a `LinearProgressIndicator` during a refresh is the difference between an app that feels solid and one that flashes a spinner at you every thirty seconds.
- `viewModel::refresh` as a method reference is stable, so passing it does not break skipping. A lambda that captures nothing is equally fine.

#### Docs
- [ViewModels in Compose](https://developer.android.com/develop/ui/compose/libraries#viewmodel)
- [Collect flows in a lifecycle-aware way](https://developer.android.com/topic/libraries/architecture/coroutines#lifecycle-aware)

### 5. A snackbar that does not come back

Wire the one-shot messages from exercise 3 to a real `Snackbar`, and prove they behave: shown once, never repeated by a rotation, never lost by one either.

#### Build it
- `UiState` carrying `messages: List<UserMessage>`, where `UserMessage` has an id and text.
- A `Scaffold` with a `SnackbarHostState` remembered at the screen level.
- A `LaunchedEffect` keyed on the first message's id that calls `snackbarHostState.showSnackbar(...)` and then tells the ViewModel the message was shown.
- The ViewModel removes the message by id in response; nothing else clears it.
- Rotating the device while the snackbar is visible does not show it a second time after it has been marked as shown, and does not lose it if it had not been.
- No `Boolean` flag anywhere called anything like `showSnackbar`.
- An action on the snackbar ("Undo") that sends an event back to the ViewModel, with the result handled in the reducer.

```kotlin solution
// UserMessage.kt
data class UserMessage(val id: Long, val text: String, val actionLabel: String? = null)

// ItemsViewModel.kt (the message parts)
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.concurrent.atomic.AtomicLong

class ItemsViewModel : ViewModel() {
    private val nextMessageId = AtomicLong(0)
    private val _state = MutableStateFlow(ItemsUiState())
    val state: StateFlow<ItemsUiState> = _state.asStateFlow()

    fun remove(item: String) {
        _state.update { current ->
            current.copy(
                items = current.items - item,
                lastRemoved = item,
                messages = current.messages + UserMessage(
                    id = nextMessageId.incrementAndGet(),
                    text = "$item removed",
                    actionLabel = "Undo",
                ),
            )
        }
    }

    fun undoRemove() {
        _state.update { current ->
            val item = current.lastRemoved ?: return@update current
            current.copy(items = current.items + item, lastRemoved = null)
        }
    }

    fun onMessageShown(id: Long) {
        _state.update { it.copy(messages = it.messages.filterNot { message -> message.id == id }) }
    }
}

// ItemsScreen.kt
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun ItemsRoute(
    modifier: Modifier = Modifier,
    viewModel: ItemsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val message = state.messages.firstOrNull()

    LaunchedEffect(message?.id) {
        if (message != null) {
            val result = snackbarHostState.showSnackbar(
                message = message.text,
                actionLabel = message.actionLabel,
                duration = SnackbarDuration.Short,
            )
            if (result == SnackbarResult.ActionPerformed) viewModel.undoRemove()
            viewModel.onMessageShown(message.id)
        }
    }

    Scaffold(
        modifier = modifier,
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        ItemsScreen(
            state = state,
            onRefresh = viewModel::refresh,
            onRemove = viewModel::remove,
            modifier = Modifier.padding(padding),
        )
    }
}
```

#### Uses
- [ViewModel & UI state › Events are not state](#/viewmodel/events-are-not-state)
- [ViewModel & UI state › Collecting state in the UI](#/viewmodel/collecting-state-in-the-ui)
- [ViewModel & UI state › SavedStateHandle](#/viewmodel/savedstatehandle)

#### Hints
- `showSnackbar` is a suspending function that returns when the snackbar is dismissed, which is why it lives in a `LaunchedEffect` and not in a click handler.
- Key the `LaunchedEffect` on the message *id*, not on the message object or on the whole state, or it restarts on every unrelated state change and shows the snackbar again.
- `onMessageShown` must run whether the snackbar was dismissed or actioned — put it after the `if`, not inside it.
- Rotating mid-snackbar cancels the effect and starts it again with the same id, which is correct: the message has not been marked shown yet, so the user still sees it.

#### Tips
- The id is doing the work. Two identical "Saved" messages are two different events, and only an id can tell them apart.
- A `Channel` plus `receiveAsFlow` is the other correct answer, and is better when the event is navigation rather than a message — there is nothing to re-show.
- `SnackbarHostState` belongs to the UI and stays in the composable. The ViewModel knows there is a message, not that it is a snackbar; that is what lets the same state drive a different design.

#### Docs
- [Snackbar](https://developer.android.com/develop/ui/compose/components/snackbar)
- [UI events](https://developer.android.com/topic/architecture/ui-layer/events)
