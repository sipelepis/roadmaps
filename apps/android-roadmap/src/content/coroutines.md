# Coroutines on Android

You already know what a coroutine is. On Android the question is different: *who owns it*. A coroutine that outlives the screen that started it is a leak, a crash, or a spinner that never stops — so every coroutine in an app belongs to a scope that something else is responsible for cancelling. Get the ownership right and the rest is the Kotlin you already write.

## The scope owns the work

Structured concurrency says a coroutine lives inside a scope, and the scope does not finish until its children do. Android adds one rule on top: you almost never create a scope yourself. The framework hands you one whose lifetime already matches something real.

- `viewModelScope` — cancelled when the `ViewModel` is cleared.
- `lifecycleScope` — cancelled when the activity or fragment is destroyed.
- `rememberCoroutineScope()` — cancelled when the composable leaves the composition; for starting work from a click, not for loading data.
- `LaunchedEffect(key)` — a coroutine tied to a composition, restarted when the key changes and cancelled when it leaves.

A bare `CoroutineScope(Dispatchers.IO)` in a class with no `close` is the mistake this list exists to prevent. `GlobalScope` is the same mistake with a longer name.

## viewModelScope

The default home for anything a screen needs is the `ViewModel`, because it survives configuration change and is cleared exactly once, when the screen is finished with for good.

```kotlin
class CartViewModel(private val repo: CartRepository) : ViewModel() {
    private val _state = MutableStateFlow<CartUiState>(CartUiState.Loading)
    val state: StateFlow<CartUiState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _state.value = CartUiState.Loading
            _state.value = try {
                CartUiState.Ready(repo.load())
            } catch (e: IOException) {
                CartUiState.Failed(e.message.orEmpty())
            }
        }
    }
}
```

`viewModelScope` is a `SupervisorJob` on `Dispatchers.Main.immediate`: children fail independently, and the body starts on the main thread without a dispatch if it is already there. Starting on main is deliberate — updating state is a main-thread operation, and the suspending work inside will move itself.

## Dispatchers, and why you rarely name one

`Dispatchers.Main` is the UI thread. `Dispatchers.IO` is a large pool sized for calls that *block* a thread — file reads, blocking JDBC, an old SDK with no suspend API. `Dispatchers.Default` is sized for CPU work — parsing a big response, sorting ten thousand rows.

The important part: a well-written suspend function never blocks, so the caller should not have to know where to run it. **A suspend function is responsible for its own dispatcher.**

```kotlin
class CartRepository(private val api: CartApi, private val io: CoroutineDispatcher = Dispatchers.IO) {
    suspend fun load(): List<Item> = withContext(io) { api.cart().toItems() }
}
```

Retrofit and Room already do this, so wrapping their suspend calls in `withContext(Dispatchers.IO)` is cargo cult. Injecting the dispatcher — that `io` parameter with a default — is what lets a test substitute a deterministic one, and it costs one line.

## Cancellation is cooperative

Cancelling a scope does not stop code; it sets a flag and makes every suspension point throw `CancellationException`. Code that neither suspends nor checks keeps running to the end.

- `delay`, `withContext`, `await` and every well-behaved suspend function check for you.
- A long CPU loop must call `ensureActive()` or `yield()` itself.
- `try/catch (e: Exception)` around suspending work swallows the cancellation and breaks the mechanism. Catch what you mean, or rethrow `CancellationException`.
- Cleanup that must run during cancellation goes in `withContext(NonCancellable)`, and nowhere else.

```kotlin
suspend fun score(rows: List<Row>): Int {
    var total = 0
    for ((i, row) in rows.withIndex()) {
        if (i % 512 == 0) coroutineContext.ensureActive()
        total += expensive(row)
    }
    return total
}
```

The user rotating the phone, pressing back, or typing another character in a search box all end as cancellation. An app that ignores it does five times the work it needs to.

## State as a flow

The UI layer's job is to observe, not to ask. A repository exposes a `Flow`, the `ViewModel` shapes it into exactly one `StateFlow` of UI state, and the screen renders that.

```kotlin
val state: StateFlow<CartUiState> = repo.cartFlow()
    .map { CartUiState.Ready(it) }
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = CartUiState.Loading,
    )
```

`stateIn` turns a cold flow into a hot one shared by every collector. `WhileSubscribed(5_000)` keeps the upstream alive for five seconds after the last collector leaves, which is long enough to survive a rotation and short enough to stop the work when the user goes home. One state object, not five flags — if `isLoading` and `error` can both be true at once, the screen has a state you never designed.

Operators earn their place here: `debounce` for typing, `distinctUntilChanged` to stop redundant work, `flatMapLatest` to cancel the previous request when a new one arrives, `combine` to fold two sources into one state.

## Collecting safely

Collecting a flow from the UI must stop when the UI is not visible, or a background screen keeps redrawing itself. In Compose:

```kotlin
val state by viewModel.state.collectAsStateWithLifecycle()
```

That is `collectAsState` plus a `repeatOnLifecycle(Lifecycle.State.STARTED)`: it collects while the screen is at least started and cancels when it stops. Plain `collectAsState()` keeps collecting behind a dialog, behind another activity, and while the screen is off. The lifecycle-aware one is the default you should reach for; it lives in `androidx.lifecycle:lifecycle-runtime-compose`.

For one-off effects rather than state, `LaunchedEffect(key)` starts a coroutine in the composition and cancels it when the key changes.

```kotlin playground
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

sealed interface UiState {
    data object Loading : UiState
    data class Ready(val items: List<String>) : UiState
}

// What viewModelScope actually is: a SupervisorJob-backed scope that something else cancels for you.
class CartViewModel {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val _state = MutableStateFlow<UiState>(UiState.Loading)
    val state: StateFlow<UiState> = _state.asStateFlow()
    private var started = 0
    private var finished = 0

    fun load(takesMs: Long, items: List<String>) {
        scope.launch {
            started++
            delay(takesMs)          // a suspension point, so it notices cancellation
            finished++
            _state.value = UiState.Ready(items)
        }
    }

    fun cleared() = scope.cancel()  // onCleared(), in one line
    fun report() = "started=$started finished=$finished"
}

fun main() = runBlocking {
    val vm = CartViewModel()
    val watcher = launch { vm.state.collect { println("ui: $it") } }

    vm.load(100, listOf("Pen", "Pad"))
    delay(250)

    vm.load(1_000, listOf("never arrives"))
    delay(100)
    vm.cleared()                     // the screen is gone; so is the in-flight work
    delay(300)

    println(vm.report())
    println("final state: ${vm.state.value}")
    watcher.cancel()
}
```

## Exercises

### 1. Try again, but not immediately

A failed request is often worth retrying, and retrying instantly is the worst possible moment: whatever was overloaded is still overloaded. Exponential backoff waits a little, then more, then more, up to a ceiling.

`retry(attempts, initialDelayMs, factor, maxDelayMs, wait, block)` calls `block(n)` with the attempt number, starting at 1.

- If `block` returns, that is the result.
- If it throws and attempts remain, call `wait(ms)` and try again.
- The first wait is `initialDelayMs`; each later one is the previous multiplied by `factor`, truncated to a `Long`, and never more than `maxDelayMs`.
- After `attempts` failures, rethrow the last exception. There is no wait after the final failure.

The delay is passed in as `wait` rather than called directly, so the tests can record the schedule instead of sitting through it. In an app you would pass `::delay`.

```kotlin starter
import kotlinx.coroutines.*

suspend fun <T> retry(
    attempts: Int,
    initialDelayMs: Long,
    factor: Double,
    maxDelayMs: Long,
    wait: suspend (Long) -> Unit,
    block: suspend (Int) -> T,
): T = block(1)
```

```kotlin test
import kotlinx.coroutines.*

class RetryTest {
    // a call that works costs nothing extra
    @Test
    fun firstTry() {
        runBlocking {
            val waits = mutableListOf<Long>()
            var calls = 0
            val out = retry(3, 100, 2.0, 5_000, { waits += it }) { calls++; "ok" }
            assertEquals("ok", out)
            assertEquals(1, calls)
            assertEquals(emptyList<Long>(), waits)
        }
    }

    // the wait doubles between attempts
    @Test
    fun backsOff() {
        runBlocking {
            val waits = mutableListOf<Long>()
            val out = retry(4, 100, 2.0, 5_000, { waits += it }) { n ->
                if (n < 3) throw IllegalStateException("boom $n") else "ok on $n"
            }
            assertEquals("ok on 3", out)
            assertEquals(listOf(100L, 200L), waits)
        }
    }

    // the ceiling holds
    @Test
    fun capped() {
        runBlocking {
            val waits = mutableListOf<Long>()
            val out = retry(5, 100, 10.0, 500, { waits += it }) { n ->
                if (n < 5) throw IllegalStateException("boom") else "done"
            }
            assertEquals("done", out)
            assertEquals(listOf(100L, 500L, 500L, 500L), waits)
        }
    }

    // out of attempts: the last failure is the one you see
    @Test
    fun givesUp() {
        runBlocking {
            val waits = mutableListOf<Long>()
            var calls = 0
            val thrown = try {
                retry(3, 50, 3.0, 5_000, { waits += it }) { n -> calls++; throw IllegalStateException("boom $n") }
                null
            } catch (e: IllegalStateException) {
                e
            }
            assertEquals("boom 3", thrown?.message)
            assertEquals(3, calls)
            assertEquals(listOf(50L, 150L), waits)
        }
    }

    // one attempt means no retrying at all
    @Test
    fun singleAttempt() {
        runBlocking {
            val waits = mutableListOf<Long>()
            var calls = 0
            val thrown = try {
                retry(1, 100, 2.0, 5_000, { waits += it }) { calls++; throw IllegalStateException("once") }
                null
            } catch (e: IllegalStateException) {
                e
            }
            assertEquals("once", thrown?.message)
            assertEquals(1, calls)
            assertEquals(emptyList<Long>(), waits)
        }
    }
}
```

#### Uses
- [Coroutines on Android › Dispatchers, and why you rarely name one](#/coroutines/dispatchers-and-why-you-rarely-name-one)
- [Coroutines on Android › The scope owns the work](#/coroutines/the-scope-owns-the-work)
- [Reference › Numbers](#/reference/numbers)

#### Hints
- A loop over `1..attempts` with a `var delayMs = initialDelayMs` carried between iterations is all the state you need.
- `try { return block(n) } catch (e: Throwable) { … }` — and on the last attempt, `throw e` instead of waiting. Rethrow a `CancellationException` straight away too: a cancelled call is not a failed one.
- `(delayMs * factor).toLong().coerceAtMost(maxDelayMs)` advances the schedule; compute it after the wait, not before.

#### Tips
- Passing the delay function in is the whole reason these tests run in milliseconds instead of seconds. Any suspend function you want to test on a clock should take its clock as a parameter.
- Real backoff adds jitter — a random fraction on top of each wait — so that ten thousand phones that failed together do not retry together. Deterministic tests are why it is not in this exercise.
- Do not retry a 404 or a 400. Retry timeouts, connection failures and 5xx; anything the server will answer identically forever is a bug, not a blip.

#### Docs
- [Kotlin coroutines on Android](https://developer.android.com/kotlin/coroutines)
- [Improve app performance with coroutines](https://developer.android.com/kotlin/coroutines/coroutines-best-practices)

### 2. Don't search on every keystroke

A search box emits a value per keystroke. Firing a request for each one wastes the network and races the results. `searchQueries(raw)` turns raw text input into the queries actually worth running.

In order:

1. trim each value;
2. drop the ones that are blank after trimming;
3. wait 200ms of quiet before letting a value through — while the user is still typing, only the latest matters;
4. drop a value that is equal to the one before it.

```kotlin starter
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

@OptIn(FlowPreview::class)
fun searchQueries(raw: Flow<String>): Flow<String> = raw
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class SearchQueriesTest {
    // only the end of a burst of typing survives
    @Test
    fun debounces() {
        runBlocking {
            val typing = flow {
                emit("a"); delay(40)
                emit("ap"); delay(40)
                emit("app"); delay(600)
            }
            assertEquals(listOf("app"), searchQueries(typing).toList())
        }
    }

    // blank input never becomes a search
    @Test
    fun ignoresBlank() {
        runBlocking {
            val typing = flow {
                emit("  "); delay(500)
                emit(""); delay(500)
                emit("  cat  "); delay(500)
            }
            assertEquals(listOf("cat"), searchQueries(typing).toList())
        }
    }

    // deleting a character and retyping it is not a new search
    @Test
    fun deduplicates() {
        runBlocking {
            val typing = flow {
                emit("cat"); delay(500)
                emit("cat "); delay(500)
                emit("cats"); delay(500)
                emit("cats"); delay(500)
            }
            assertEquals(listOf("cat", "cats"), searchQueries(typing).toList())
        }
    }

    // several separate searches, in order
    @Test
    fun separateBursts() {
        runBlocking {
            val typing = flow {
                emit("do"); delay(30)
                emit("dog"); delay(500)
                emit("ca"); delay(30)
                emit("cat"); delay(500)
            }
            assertEquals(listOf("dog", "cat"), searchQueries(typing).toList())
        }
    }
}
```

#### Uses
- [Coroutines on Android › State as a flow](#/coroutines/state-as-a-flow)

#### Hints
- Four operators, one per rule, chained in the order the rules are listed.
- `map { it.trim() }` then `filter { it.isNotEmpty() }` handles the first two.
- `debounce(200)` and `distinctUntilChanged()` are the other two; `debounce` needs the `@OptIn(FlowPreview::class)` that is already on the starter.

#### Tips
- Order matters: debouncing before trimming would let `"cat"` and `"cat "` through as two different searches.
- 200–300ms is the usual window. Shorter and you are back to searching per keystroke; longer and the screen feels stuck.
- This pipeline belongs in the `ViewModel`, between a `MutableStateFlow` holding the text field's value and the repository call. The composable should only be setting text.

#### Docs
- [Flow on Android](https://developer.android.com/kotlin/flow)
- [StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)

### 3. The answer to the question they stopped asking

Debouncing thins the requests out; it does not stop a slow one from landing after a newer one. `liveResults(queries, search)` runs `search` for each query and emits its result — but when a new query arrives while a search is still running, that search is cancelled and its result never appears.

The tests count how many searches were started and how many ran to completion, so returning results in the wrong order, or letting a stale search finish, both fail.

```kotlin starter
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

@OptIn(ExperimentalCoroutinesApi::class)
fun liveResults(queries: Flow<String>, search: suspend (String) -> String): Flow<String> =
    queries.map { search(it) }
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class LiveResultsTest {
    private class Recorder(private val takesMs: Long) {
        val started = mutableListOf<String>()
        val finished = mutableListOf<String>()
        suspend fun search(q: String): String {
            started += q
            delay(takesMs)
            finished += q
            return "results for $q"
        }
    }

    // a quiet query runs to completion
    @Test
    fun oneQuery() {
        runBlocking {
            val rec = Recorder(50)
            val out = liveResults(flowOf("cat"), rec::search).toList()
            assertEquals(listOf("results for cat"), out)
            assertEquals(listOf("cat"), rec.finished)
        }
    }

    // a newer query cancels the older search
    @Test
    fun cancelsStale() {
        runBlocking {
            val rec = Recorder(300)
            val typed = flow {
                emit("ca"); delay(50)
                emit("cat"); delay(600)
            }
            val out = liveResults(typed, rec::search).toList()
            assertEquals(listOf("results for cat"), out)
            assertEquals(listOf("ca", "cat"), rec.started)
            assertEquals(listOf("cat"), rec.finished)
        }
    }

    // several bursts: one result each, in order
    @Test
    fun keepsOrder() {
        runBlocking {
            val rec = Recorder(100)
            val typed = flow {
                emit("do"); delay(30)
                emit("dog"); delay(400)
                emit("ca"); delay(30)
                emit("cat"); delay(400)
            }
            val out = liveResults(typed, rec::search).toList()
            assertEquals(listOf("results for dog", "results for cat"), out)
            assertEquals(listOf("dog", "cat"), rec.finished)
        }
    }

    // nothing typed, nothing searched
    @Test
    fun empty() {
        runBlocking {
            val rec = Recorder(50)
            assertEquals(emptyList<String>(), liveResults(emptyFlow(), rec::search).toList())
            assertEquals(emptyList<String>(), rec.started)
        }
    }
}
```

#### Uses
- [Coroutines on Android › State as a flow](#/coroutines/state-as-a-flow)
- [Coroutines on Android › Cancellation is cooperative](#/coroutines/cancellation-is-cooperative)
- [Reference › Flow and StateFlow](#/reference/flow-and-stateflow)

#### Hints
- One operator does all of this: the one whose name ends in `Latest`.
- `flatMapLatest { query -> flow { emit(search(query)) } }` — the inner flow is cancelled when a new query arrives.
- `mapLatest { search(it) }` is the same thing with the `flow { emit(…) }` written for you.

#### Tips
- The cancellation works because `search` suspends. A search that blocks its thread instead of suspending would run to the end whatever you wrapped it in.
- `flatMapLatest` cancels, `flatMapMerge` runs them all concurrently, `flatMapConcat` queues them. Three very different products from three very similar names.
- Combine this with the previous exercise and you have the whole idiomatic search box: `debounce` to stop asking too often, `flatMapLatest` to throw away the answers you no longer want.

#### Docs
- [Flow: flattening flows](https://kotlinlang.org/docs/flow.html#flattening-flows)
- [Flow on Android](https://developer.android.com/kotlin/flow)

### 4. A ViewModel that loads a screen

Build a screen backed by a `ViewModel` that loads a list, shows a spinner while it is loading, shows an error with a retry button when it fails, and survives rotation without loading again.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A sealed interface of UI states — loading, ready, failed — with exactly one of them live at a time. No separate `isLoading` boolean.
- A `ViewModel` exposing one `StateFlow<UiState>`, private `MutableStateFlow` behind it.
- The load runs in `viewModelScope`, started from `init` or from an explicit `load()` — never from the composable's body.
- The repository's suspend function chooses its own dispatcher, with the dispatcher injected and defaulted.
- The screen collects with `collectAsStateWithLifecycle()` and `when`s over the state.
- Rotating the device does not re-trigger the load; the state is still there.
- The error state has a retry button that calls back into the `ViewModel`.

```kotlin solution
// CartUiState.kt
sealed interface CartUiState {
    data object Loading : CartUiState
    data class Ready(val items: List<Item>) : CartUiState
    data class Failed(val message: String) : CartUiState
}

// CartRepository.kt
class CartRepository(
    private val api: CartApi,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    suspend fun load(): List<Item> = withContext(io) { api.cart().map(ItemDto::toItem) }
}

// CartViewModel.kt
class CartViewModel(private val repo: CartRepository) : ViewModel() {
    private val _state = MutableStateFlow<CartUiState>(CartUiState.Loading)
    val state: StateFlow<CartUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = CartUiState.Loading
            _state.value = try {
                CartUiState.Ready(repo.load())
            } catch (e: IOException) {
                CartUiState.Failed(e.message ?: "Something went wrong")
            }
        }
    }
}

// CartScreen.kt
@Composable
fun CartScreen(
    viewModel: CartViewModel = viewModel(),
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    CartContent(state = state, onRetry = viewModel::load, modifier = modifier)
}

@Composable
fun CartContent(
    state: CartUiState,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state) {
        CartUiState.Loading -> Box(modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
        is CartUiState.Ready -> LazyColumn(modifier.fillMaxSize()) {
            items(state.items, key = { it.id }) { item -> Text(item.name) }
        }
        is CartUiState.Failed -> Column(
            modifier = modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(state.message)
            Spacer(Modifier.height(16.dp))
            Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
        }
    }
}
```

#### Uses
- [Coroutines on Android › viewModelScope](#/coroutines/viewmodelscope)
- [Coroutines on Android › Collecting safely](#/coroutines/collecting-safely)

#### Hints
- `collectAsStateWithLifecycle()` comes from `androidx.lifecycle:lifecycle-runtime-compose`; add the dependency before reaching for `collectAsState`.
- Splitting `CartScreen` (which knows the `ViewModel`) from `CartContent` (which takes state and lambdas) is what makes the second one previewable.
- `init { load() }` runs once per `ViewModel`, and a `ViewModel` outlives rotation — which is the whole reason the load does not repeat.

#### Tips
- `catch (e: Exception)` here would swallow `CancellationException` and leave a cancelled screen stuck on a spinner. Catch the exceptions you expect.
- A `when` over a sealed interface with no `else` branch is how the compiler tells you about the state you forgot to render.
- If you find yourself writing `if (isLoading && error == null)`, the states are not modelled yet. Make the illegal combinations unrepresentable.

#### Docs
- [ViewModel overview](https://developer.android.com/topic/libraries/architecture/viewmodel)
- [UI layer architecture](https://developer.android.com/topic/architecture/ui-layer)

### 5. Wire the search box up

Put exercises 2 and 3 into a real screen: a text field, a debounced search, results that cancel when the query changes, and no work at all while the screen is not visible.

#### Build it
- A `MutableStateFlow<String>` in the `ViewModel` holding the query; the `TextField`'s `onValueChange` only writes to it.
- The results flow is the query flow `debounce`d, de-duplicated and `flatMapLatest`ed into the repository call.
- It becomes state with `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)`.
- The screen collects with `collectAsStateWithLifecycle()`; backgrounding the app stops the collection, and within five seconds of returning nothing has been re-fetched.
- An empty query shows the idle state and makes no request.
- Failures inside the search flow are caught with `catch { }` inside the flow, so one failure does not end the stream for good.

```kotlin solution
// SearchViewModel.kt
@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class SearchViewModel(private val repo: SearchRepository) : ViewModel() {

    private val query = MutableStateFlow("")
    val text: StateFlow<String> = query.asStateFlow()

    val results: StateFlow<SearchUiState> = query
        .map { it.trim() }
        .debounce(250)
        .distinctUntilChanged()
        .flatMapLatest { q ->
            if (q.isEmpty()) flowOf(SearchUiState.Idle)
            else flow {
                emit(SearchUiState.Searching)
                emit(SearchUiState.Results(repo.search(q)))
            }.catch { emit(SearchUiState.Failed(it.message ?: "Search failed")) }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = SearchUiState.Idle,
        )

    fun onQueryChange(value: String) { query.value = value }
}

// SearchScreen.kt
@Composable
fun SearchScreen(viewModel: SearchViewModel = viewModel(), modifier: Modifier = Modifier) {
    val text by viewModel.text.collectAsStateWithLifecycle()
    val state by viewModel.results.collectAsStateWithLifecycle()

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        OutlinedTextField(
            value = text,
            onValueChange = viewModel::onQueryChange,
            label = { Text(stringResource(R.string.search_hint)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        when (val s = state) {
            SearchUiState.Idle -> Text(stringResource(R.string.search_prompt))
            SearchUiState.Searching -> CircularProgressIndicator()
            is SearchUiState.Failed -> Text(s.message, color = MaterialTheme.colorScheme.error)
            is SearchUiState.Results -> LazyColumn {
                items(s.items, key = { it.id }) { Text(it.name) }
            }
        }
    }
}
```

#### Uses
- [Coroutines on Android › State as a flow](#/coroutines/state-as-a-flow)
- [Coroutines on Android › Collecting safely](#/coroutines/collecting-safely)
- [Coroutines on Android › viewModelScope](#/coroutines/viewmodelscope)

#### Hints
- `catch { }` goes on the *inner* flow, inside `flatMapLatest`. On the outer flow it would end the whole stream after the first failure.
- `WhileSubscribed(5_000)` is the number that makes a rotation free and a backgrounded app quiet.
- The text field's value must come from the `ViewModel`'s flow, not a local `remember`, or the text vanishes on rotation.

#### Tips
- `flowOf(SearchUiState.Idle)` for the empty query keeps the whole pipeline declarative; an `if` in the composable would put the decision in the wrong layer.
- `stateIn` with `SharingStarted.Eagerly` starts the work before anything is looking at it, which is occasionally right and usually a battery bug.
- Emitting `Searching` before the request inside the same inner flow means the spinner is cancelled along with the request. That is exactly what you want.

#### Docs
- [Flow on Android: stateIn and shareIn](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)
- [Compose: text fields](https://developer.android.com/develop/ui/compose/text/user-input)
