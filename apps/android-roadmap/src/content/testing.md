# Testing

A test suite is not there to prove the app works. It is there so that six months from now somebody can change one line and find out, in seconds, whether they broke something. On Android that goal runs into a particular obstacle: half your code lives inside a framework you cannot instantiate on a desktop JVM. The craft is knowing which half, keeping as much logic as possible out of it, and using the right kind of test for what is left.

## The pyramid, and where Android puts it

The shape is the usual one — many fast tests, fewer slow ones — but the numbers matter more here than elsewhere, because the slow ones are *extremely* slow.

- **Unit tests** (`src/test`, plain JUnit on your machine): milliseconds each, thousands of them. State machines, mappers, validators, reducers, formatting, your repository against a fake DAO.
- **Integration tests** (`src/androidTest`, on a device or Robolectric): seconds each, dozens. Room against a real SQLite file, a DataStore round trip, a WorkManager job, one screen wired to a real ViewModel.
- **End-to-end tests** (on a device, whole app): tens of seconds each, a handful. Sign in, add a note, kill the process, see it again.

The inversion to avoid is the ice-cream cone: a thin layer of unit tests under a pile of UI tests that take forty minutes and fail for reasons nobody can reproduce. If your only way to check that a discount is applied correctly is to drive a screen, the discount logic is in the wrong place.

## Local tests and instrumentation tests

Two source sets, two very different costs.

| | `src/test` | `src/androidTest` |
| --- | --- | --- |
| Runs on | your JVM | a device or emulator |
| Starts in | milliseconds | tens of seconds |
| Sees Android classes | as stubs that throw | for real |
| Good for | logic | framework behaviour |

The stubs are the catch: `android.jar` on the unit-test classpath is a set of empty methods that throw `RuntimeException("Stub!")`, which is why a harmless-looking `Uri.parse` or `Log.d` blows up a test that should not care. Two ways out. Wrap the Android type behind an interface of your own, which is best when you can. Or use **Robolectric**, which provides working implementations of a great deal of the framework and runs in `src/test` at JVM speed.

`testOptions { unitTests.isIncludeAndroidResources = true }` is what lets Robolectric read your resources, and the AndroidX Test APIs — `ApplicationProvider`, `ActivityScenario` — are written so the same test can run in either source set.

## Test the state, not the screen

The most valuable thing you can do for your test suite is decide, early, that the answer to "what should be on screen" is a value.

```kotlin
sealed interface UiState {
    data object Loading : UiState
    data object Empty : UiState
    data class Ready(val notes: List<Note>) : UiState
    data class Error(val message: String) : UiState
}
```

Now "an empty response shows the empty state, not a spinner forever" is an `assertEquals` on a data class. No device, no waiting, no screenshot to eyeball. The composable that turns a `UiState` into pixels stays small enough to check by looking at it, and the decisions — which are where the bugs are — are all in code you can call directly.

The same applies to mapping. Entity to domain, domain to display string, response to entity: every one of those is a pure function and every one of them deserves a test with the awkward cases in it.

## Fakes over mocks

A **fake** is a working implementation with a shortcut: an in-memory `UserStore`, an API that returns canned responses, a repository backed by a list. A **mock** is a generated object that records calls and returns whatever you told it to.

Prefer fakes, for reasons that show up on the second year of a project.

- A fake honours the contract. If `save` then `find` has to return what you saved, the fake does it, and a test written against the fake is a test that would pass against the real thing.
- A mock encodes your current beliefs about how the code calls its dependency. Change the implementation without changing the behaviour and the mock test fails anyway. That is a test that costs you maintenance and tells you nothing.
- A fake fails with a readable value. `expected [Ada] but was []` beats a verification error about argument matchers.

Write the fake once, next to the interface, and share it between tests. If a fake is hard to write, the interface is probably too big — which is useful information about the design, not about testing.

Mocks still earn their place at the edges: a third-party SDK with forty methods you use two of, or asserting that a fire-and-forget analytics call happened at all.

## Controlling time

Nothing flakes like real time. Every `Thread.sleep`, every `System.currentTimeMillis()` and every `delay` in production code is a test that passes on your laptop and fails on a loaded CI machine.

Take time as a dependency. A `Clock` interface with one method costs you nothing and buys you a fake that jumps ten minutes instantly. For coroutines, `runTest` from `kotlinx-coroutines-test` runs on a virtual clock: a `delay(10_000)` inside it returns immediately while still ordering everything correctly.

```kotlin
@Test
fun retriesWithBackoff() = runTest {
    val api = FlakyApi(failuresBeforeSuccess = 2)
    val result = repository.refresh()     // sleeps 1s then 2s in production
    assertTrue(result.isSuccess)          // returns instantly here
}
```

Set a `TestDispatcher` as `Dispatchers.Main` with `Dispatchers.setMain(...)` in a `@Before` so `viewModelScope` uses it, and call `Dispatchers.resetMain()` in `@After`. Better still, inject the dispatcher rather than hard-coding `Dispatchers.IO` in a repository — it is one more constructor parameter and one less reason to need a rule.

## Compose tests and the semantics tree

A Compose test does not look at pixels. It queries the **semantics tree**, the same structure a screen reader walks, which is why testability and accessibility improve together.

```kotlin
@get:Rule val rule = createAndroidComposeRule<MainActivity>()

@Test
fun addingANoteShowsIt() {
    rule.onNodeWithText("New note").performClick()
    rule.onNodeWithContentDescription("Title").performTextInput("Milk")
    rule.onNodeWithText("Save").performClick()
    rule.onNodeWithText("Milk").assertIsDisplayed()
}
```

Find nodes by what the user perceives — text, content description, role, state — before reaching for `testTag`. A test written that way fails when the experience breaks and survives a refactor. When you do need a tag because there is nothing else to grab, `Modifier.testTag("note-list")` is there.

Compose tests synchronise automatically: the framework waits until there is no pending recomposition or animation before each assertion, so no `sleep` is needed. The exception is anything outside Compose's knowledge — your own background thread, an infinite animation — where you need `rule.waitUntil { }` or `mainClock.advanceTimeBy(...)` with autoAdvance turned off.

## Flakiness

A test that fails one run in twenty is worse than no test: the team learns to re-run it, and then they re-run the real failure too. The usual causes, in the order you will meet them:

1. **Real time.** Fixed by injecting the clock and using `runTest`.
2. **Shared state between tests.** A singleton, a database file, a DataStore, a static cache. Reset it in `@Before`, and prefer a fresh instance to a cleanup routine you can forget to update.
3. **Order dependence.** Two tests that pass alone and fail together. Run the suite in a random order occasionally and find out.
4. **Waiting for the wrong thing.** `waitUntil { list.isDisplayed() }` rather than a sleep that is "usually long enough".
5. **The emulator.** Animations on, low memory, a slow CI host. Disable animations in the test setup and keep end-to-end tests few enough that you can look at every failure.

Quarantine a flaky test if you must, but give it an owner and a date. A quarantine with no date is a deletion with extra steps.

```kotlin playground
// A load reduced to a list of states, driven by a fake, checked without a device.
import kotlinx.coroutines.runBlocking

sealed interface UiState {
    data object Loading : UiState
    data object Empty : UiState
    data class Ready(val notes: List<String>) : UiState
    data class Error(val message: String) : UiState
}

interface NoteRepository {
    suspend fun load(): List<String>
}

class FakeRepository(private val result: Result<List<String>>) : NoteRepository {
    var calls = 0
        private set

    override suspend fun load(): List<String> {
        calls++
        return result.getOrThrow()
    }
}

suspend fun statesFor(repository: NoteRepository): List<UiState> {
    val states = mutableListOf<UiState>(UiState.Loading)
    try {
        val notes = repository.load()
        states.add(if (notes.isEmpty()) UiState.Empty else UiState.Ready(notes))
    } catch (e: Exception) {
        states.add(UiState.Error(e.message ?: "unknown"))
    }
    return states
}

fun main() = runBlocking {
    println(statesFor(FakeRepository(Result.success(listOf("Milk", "Bread")))))
    println(statesFor(FakeRepository(Result.success(emptyList()))))
    println(statesFor(FakeRepository(Result.failure(IllegalStateException("offline")))))

    val counted = FakeRepository(Result.success(listOf("Jam")))
    statesFor(counted)
    println("the repository was asked ${counted.calls} time(s)")
}
```

## Exercises

### 1. A clock you control

Two pieces: the double, and the thing that needs it.

`TestClock` implements `Clock`. It starts at whatever time you give it and `advance(byMs)` moves it forward; nothing else changes it.

`RateLimiter(clock, windowMs)` decides whether an action may happen. `allow(key)` returns `true` the first time it sees a key, and again once at least `windowMs` has passed since the last call that returned `true` for that key. Otherwise it returns `false`, and a refused call does **not** restart the window. Keys are independent of each other.

```kotlin starter
interface Clock {
    fun nowMs(): Long
}

class TestClock(private var current: Long = 0) : Clock {
    override fun nowMs(): Long = 0

    fun advance(byMs: Long) {
    }
}

class RateLimiter(private val clock: Clock, private val windowMs: Long) {
    fun allow(key: String): Boolean = true
}
```

```kotlin test
class TestClockTest {
    // the double does what it says
    @Test
    fun ticks() {
        val clock = TestClock()
        assertEquals(0L, clock.nowMs())
        clock.advance(500)
        assertEquals(500L, clock.nowMs())
        clock.advance(500)
        assertEquals(1000L, clock.nowMs())
        assertEquals(50L, TestClock(50).nowMs())
    }
}

class RateLimiterTest {
    // the first call always goes through, the next one does not
    @Test
    fun firstThenBlocked() {
        val clock = TestClock()
        val limiter = RateLimiter(clock, 1000)
        assertTrue(limiter.allow("sync"))
        assertFalse(limiter.allow("sync"))
        clock.advance(999)
        assertFalse(limiter.allow("sync"))
    }

    // the window opens again once it has fully elapsed
    @Test
    fun reopens() {
        val clock = TestClock()
        val limiter = RateLimiter(clock, 1000)
        assertTrue(limiter.allow("sync"))
        clock.advance(1000)
        assertTrue(limiter.allow("sync"))
        clock.advance(1000)
        assertTrue(limiter.allow("sync"))
    }

    // a refusal does not push the window out
    @Test
    fun refusalIsFree() {
        val clock = TestClock()
        val limiter = RateLimiter(clock, 1000)
        assertTrue(limiter.allow("sync"))
        clock.advance(500)
        assertFalse(limiter.allow("sync"))
        clock.advance(500)
        assertTrue("the window is measured from the last allowed call", limiter.allow("sync"))
    }

    // keys do not interfere
    @Test
    fun independent() {
        val clock = TestClock()
        val limiter = RateLimiter(clock, 100)
        assertTrue(limiter.allow("a"))
        assertTrue(limiter.allow("b"))
        assertFalse(limiter.allow("a"))
        assertFalse(limiter.allow("b"))
        clock.advance(100)
        assertTrue(limiter.allow("a"))
        assertTrue(limiter.allow("b"))
    }
}
```

#### Uses
- [Testing › Controlling time](#/testing/controlling-time)
- [Testing › Fakes over mocks](#/testing/fakes-over-mocks)
- [Dependency injection › Testability is the point](#/di/testability-is-the-point)

#### Hints
- `TestClock` needs its constructor parameter to be a mutable field: `private var current`, returned by `nowMs()` and increased by `advance`.
- `RateLimiter` keeps a `MutableMap<String, Long>` of the time each key was last allowed.
- "At least `windowMs` has passed" is `now - last >= windowMs`. Only write back into the map when you return `true`.

#### Tips
- Written this way, the whole test suite runs in under a millisecond of real time. The same behaviour tested with `Thread.sleep` would take about five seconds and still flake on a busy machine.
- This is the difference between a stub and a fake: `TestClock` is a real, working clock whose only unusual property is that you decide when it moves.
- In production the same `Clock` interface is implemented by one line — `System.currentTimeMillis()` — and that line is the only untested code left.

#### Docs
- [Test your app's logic](https://developer.android.com/training/testing/local-tests)
- [Test doubles in Android](https://developer.android.com/training/testing/fundamentals/test-doubles)

### 2. A load, as a list of states

A screen that loads something goes through a sequence of states, and that sequence is the thing worth testing.

`statesFor(repository)` returns the states in order. The first is always `Loading`. Then exactly one more:

- `Ready(notes)` when `load()` returns a non-empty list, carrying that list unchanged.
- `Empty` when it returns an empty list. An empty result is not an error and is not a spinner.
- `Error(message)` when `load()` throws, carrying the exception's message, or the string `"unknown"` when the message is null.

`load()` is called exactly once.

```kotlin starter
sealed interface UiState {
    data object Loading : UiState
    data object Empty : UiState
    data class Ready(val notes: List<String>) : UiState
    data class Error(val message: String) : UiState
}

interface NoteRepository {
    suspend fun load(): List<String>
}

suspend fun statesFor(repository: NoteRepository): List<UiState> = listOf(UiState.Loading)
```

```kotlin test
import kotlinx.coroutines.runBlocking

class FakeRepository(private val result: Result<List<String>>) : NoteRepository {
    var calls = 0
        private set

    override suspend fun load(): List<String> {
        calls++
        return result.getOrThrow()
    }
}

class StatesForTest {
    // the happy path
    @Test
    fun ready() = runBlocking {
        val states = statesFor(FakeRepository(Result.success(listOf("Milk", "Bread"))))
        assertEquals(listOf(UiState.Loading, UiState.Ready(listOf("Milk", "Bread"))), states)
    }

    // nothing to show is its own state
    @Test
    fun empty() = runBlocking {
        val states = statesFor(FakeRepository(Result.success(emptyList())))
        assertEquals(listOf(UiState.Loading, UiState.Empty), states)
    }

    // a failure carries its message
    @Test
    fun failed() = runBlocking {
        val states = statesFor(FakeRepository(Result.failure(IllegalStateException("offline"))))
        assertEquals(listOf(UiState.Loading, UiState.Error("offline")), states)

        val nameless = statesFor(FakeRepository(Result.failure(IllegalStateException())))
        assertEquals(listOf(UiState.Loading, UiState.Error("unknown")), nameless)
    }

    // one load per call, and the exception never escapes
    @Test
    fun loadsOnce() = runBlocking {
        val good = FakeRepository(Result.success(listOf("Jam")))
        statesFor(good)
        assertEquals(1, good.calls)

        val bad = FakeRepository(Result.failure(IllegalStateException("boom")))
        statesFor(bad)
        assertEquals(1, bad.calls)
    }
}
```

#### Uses
- [Testing › Test the state, not the screen](#/testing/test-the-state-not-the-screen)
- [Testing › Fakes over mocks](#/testing/fakes-over-mocks)
- [Testing › The pyramid, and where Android puts it](#/testing/the-pyramid-and-where-android-puts-it)

#### Hints
- Start the list with `UiState.Loading`, then wrap the `repository.load()` call in `try`/`catch`.
- `catch (e: Exception)` is what you want here, not `Throwable` — you do not want to swallow a cancellation or an `Error`.
- `e.message ?: "unknown"` gives you the fallback in one expression.

#### Tips
- Distinguishing `Empty` from `Ready(emptyList())` looks pedantic until you meet the screen that shows a blank white page because nobody decided what "no results" looks like.
- The list-of-states shape makes assertions blunt and readable. In the real ViewModel this is a `StateFlow` and the test uses Turbine or `toList()` on the flow, but the property under test is the same.
- `Result` is a neat way to write a fake that can produce either outcome without two classes.

#### Docs
- [Architecture: UI state](https://developer.android.com/topic/architecture/ui-layer#define-ui-state)
- [Test coroutines](https://developer.android.com/kotlin/coroutines/test)

### 3. A fake that honours the contract

Write the in-memory implementation that every test in the project will use in place of the real, database-backed one. The point is not that it is simple; the point is that it obeys the same rules, so a test that passes against it would pass against the real thing.

`save(id, name)` stores a name, replacing whatever that id had. `find(id)` returns the stored name or `null`. `all()` returns every stored name sorted alphabetically **ignoring case**, and where two names compare equal, by ascending id. `clear()` empties the store.

```kotlin starter
interface UserStore {
    fun save(id: Long, name: String)
    fun find(id: Long): String?
    fun all(): List<String>
    fun clear()
}

class InMemoryUserStore : UserStore {
    override fun save(id: Long, name: String) {
    }

    override fun find(id: Long): String? = null

    override fun all(): List<String> = emptyList()

    override fun clear() {
    }
}
```

```kotlin test
class InMemoryUserStoreTest {
    // what you save is what you find
    @Test
    fun roundTrip() {
        val store = InMemoryUserStore()
        store.save(1, "Ada")
        store.save(2, "Grace")
        assertEquals("Ada", store.find(1))
        assertEquals("Grace", store.find(2))
        assertNull(store.find(3))
    }

    // the same id twice is an update, not a second user
    @Test
    fun replaces() {
        val store = InMemoryUserStore()
        store.save(1, "Ada")
        store.save(1, "Ada Lovelace")
        assertEquals("Ada Lovelace", store.find(1))
        assertEquals(listOf("Ada Lovelace"), store.all())
    }

    // sorted, ignoring case
    @Test
    fun ordering() {
        val store = InMemoryUserStore()
        store.save(1, "zoe")
        store.save(2, "Ada")
        store.save(3, "Bob")
        assertEquals(listOf("Ada", "Bob", "zoe"), store.all())
        assertEquals(emptyList<String>(), InMemoryUserStore().all())
    }

    // equal names fall back to the id
    @Test
    fun tiesAndClearing() {
        val store = InMemoryUserStore()
        store.save(9, "sam")
        store.save(4, "SAM")
        store.save(7, "Sam")
        assertEquals(listOf("SAM", "Sam", "sam"), store.all())
        store.clear()
        assertEquals(emptyList<String>(), store.all())
        assertNull(store.find(4))
    }
}
```

#### Uses
- [Testing › Fakes over mocks](#/testing/fakes-over-mocks)
- [Testing › Local tests and instrumentation tests](#/testing/local-tests-and-instrumentation-tests)
- [Room & DataStore › Mapping rows to your own types](#/persistence/mapping-rows-to-your-own-types)

#### Hints
- A `MutableMap<Long, String>` is the whole store; `save` is one assignment and `find` is one lookup.
- Ignoring case is `it.lowercase()` inside the comparison, not on the way in — the stored name must come back exactly as it was saved.
- Sort id-and-name pairs, then drop the ids: `compareBy<Pair<Long, String>> { it.second.lowercase() }.thenBy { it.first }` passed to `sortedWith`.

#### Tips
- The ordering rule exists so that the fake cannot return results in a different order from the real `ORDER BY name COLLATE NOCASE, id`. An undefined order in a fake is a test that passes here and fails on a device.
- Keep the fake in a shared test source set, or in `main` behind a `debug`-only module, so every test uses the same one and a contract change is fixed in one place.
- The real proof is a contract test: one abstract test class with the assertions, and two subclasses that supply the real store and the fake.

#### Docs
- [Test doubles in Android](https://developer.android.com/training/testing/fundamentals/test-doubles)
- [Testing the data layer](https://developer.android.com/training/testing/fundamentals/what-to-test)

### 4. Retry without waiting

Retrying a failed request is easy; testing it is not, because the waiting is the part you cannot afford. Make the waiting a parameter.

`retry(attempts, initialDelayMs, sleep, block)` runs `block` and returns its result. If it throws, `retry` calls `sleep` and tries again, up to `attempts` calls of `block` in total. The delay starts at `initialDelayMs` and doubles before each further wait. When the last attempt fails there is nothing left to wait for, so no `sleep` happens and that exception is rethrown. `attempts` below 1 throws `IllegalArgumentException` with the message `"attempts must be at least 1"`.

```kotlin starter
suspend fun <T> retry(
    attempts: Int,
    initialDelayMs: Long,
    sleep: suspend (Long) -> Unit,
    block: suspend () -> T,
): T = block()
```

```kotlin test
import kotlinx.coroutines.runBlocking

class RetryTest {
    // a working call does not wait at all
    @Test
    fun firstTime() = runBlocking {
        val waits = mutableListOf<Long>()
        assertEquals("ok", retry(3, 100, { waits.add(it) }) { "ok" })
        assertEquals(emptyList<Long>(), waits)
    }

    // the backoff doubles
    @Test
    fun backsOff() = runBlocking {
        val waits = mutableListOf<Long>()
        var calls = 0
        val result = retry(4, 100, { waits.add(it) }) {
            calls++
            if (calls < 3) throw IllegalStateException("flaky") else "ok"
        }
        assertEquals("ok", result)
        assertEquals(3, calls)
        assertEquals(listOf(100L, 200L), waits)
    }

    // the last failure is rethrown, with no wait after it
    @Test
    fun givesUp() = runBlocking {
        val waits = mutableListOf<Long>()
        var calls = 0
        var message: String? = null
        try {
            retry(3, 50, { waits.add(it) }) {
                calls++
                throw IllegalStateException("failure $calls")
            }
        } catch (e: IllegalStateException) {
            message = e.message
        }
        assertEquals("failure 3", message)
        assertEquals(3, calls)
        assertEquals(listOf(50L, 100L), waits)
    }

    // one attempt means no retrying
    @Test
    fun edges() = runBlocking {
        val waits = mutableListOf<Long>()
        var calls = 0
        try {
            retry(1, 10, { waits.add(it) }) { calls++; throw IllegalStateException("once") }
        } catch (e: IllegalStateException) {
            // expected
        }
        assertEquals(1, calls)
        assertEquals(emptyList<Long>(), waits)

        var message: String? = null
        try {
            retry(0, 10, { waits.add(it) }) { "never" }
        } catch (e: IllegalArgumentException) {
            message = e.message
        }
        assertEquals("attempts must be at least 1", message)
    }
}
```

#### Uses
- [Testing › Controlling time](#/testing/controlling-time)
- [Testing › Flakiness](#/testing/flakiness)
- [Testing › Test the state, not the screen](#/testing/test-the-state-not-the-screen)

#### Hints
- `require(attempts >= 1) { "attempts must be at least 1" }` first, before anything runs.
- `repeat(attempts - 1) { ... }` handles every attempt that is allowed to fail quietly; run the final attempt outside the loop so its exception escapes.
- Keep the current delay in a `var` and double it after each `sleep`.

#### Tips
- In production `sleep` is `::delay`, and in the test it is a lambda that records. Same code, no waiting.
- `kotlinx-coroutines-test`'s `runTest` skips `delay` on its own, which is the better answer when the delays are already inside coroutine code you own.
- Real backoff adds jitter — a random fraction on top of each delay — so that ten thousand phones that lost the network at the same second do not all retry at the same second.

#### Docs
- [Test coroutines on Android](https://developer.android.com/kotlin/coroutines/test)
- [Background work: retries and backoff](https://developer.android.com/topic/libraries/architecture/workmanager/how-to/define-work#retries_backoff)

### 5. Test the screen for real

Write the tests the JVM cannot: a Room migration against a real database file, and a Compose test that drives the notes screen the way a person would.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- `testImplementation` for JUnit and `kotlinx-coroutines-test`; `androidTestImplementation` for `androidx.test.ext:junit`, `compose-ui-test-junit4`, and `debugImplementation` for `compose-ui-test-manifest`.
- A local test for your ViewModel that sets a `TestDispatcher` as `Dispatchers.Main` in `@Before` and resets it in `@After`.
- An instrumentation test using `MigrationTestHelper` that opens the version 1 schema, inserts a row, runs your migration and reads the row back.
- A Compose test with `createAndroidComposeRule<MainActivity>()` that adds a note and asserts it appears.
- Every node found by text or content description, with `testTag` used only where there is genuinely nothing else.
- One assertion that fails on purpose, so you have seen what the failure output looks like before you need it.
- Animations disabled on the test device, and the suite green three times in a row.

```kotlin solution
// src/test/java/.../NotesViewModelTest.kt — local, milliseconds
@OptIn(ExperimentalCoroutinesApi::class)
class NotesViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun emptyResponseShowsEmptyState() = runTest {
        val viewModel = NotesViewModel(FakeNoteRepository(notes = emptyList()))
        assertEquals(UiState.Loading, viewModel.state.value)
        advanceUntilIdle()
        assertEquals(UiState.Empty, viewModel.state.value)
    }
}

// src/androidTest/java/.../MigrationTest.kt — a real SQLite file
@RunWith(AndroidJUnit4::class)
class MigrationTest {
    private val name = "migration-test"

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        AppDatabase::class.java,
    )

    @Test
    fun migrate1To2KeepsNotes() {
        helper.createDatabase(name, 1).use { db ->
            db.execSQL("INSERT INTO notes (id, title, body, updatedAt) VALUES (1, 'Milk', '', 0)")
        }

        val db = helper.runMigrationsAndValidate(name, 2, true, MIGRATION_1_2)
        db.query("SELECT title, pinned FROM notes WHERE id = 1").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("Milk", cursor.getString(0))
            assertEquals(0, cursor.getInt(1))
        }
    }
}

// src/androidTest/java/.../NotesScreenTest.kt — the semantics tree, not pixels
@RunWith(AndroidJUnit4::class)
class NotesScreenTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun addingANoteShowsItInTheList() {
        rule.onNodeWithContentDescription("Add note").performClick()
        rule.onNodeWithText("Title").performTextInput("Milk")
        rule.onNodeWithText("Save").performClick()

        rule.onNodeWithText("Milk").assertIsDisplayed()
        rule.onNodeWithText("No notes yet").assertDoesNotExist()
    }

    @Test
    fun theEmptyStateIsAnnounced() {
        rule.onNodeWithText("No notes yet").assertIsDisplayed()
        rule.onNode(hasTestTag("note-list")).assertDoesNotExist()
    }
}
```

#### Uses
- [Testing › Compose tests and the semantics tree](#/testing/compose-tests-and-the-semantics-tree)
- [Testing › Local tests and instrumentation tests](#/testing/local-tests-and-instrumentation-tests)
- [Testing › Flakiness](#/testing/flakiness)
- [Room & DataStore › Migrations](#/persistence/migrations)
- [Reference › Testing on Android](#/reference/testing-on-android)

#### Hints
- `compose-ui-test-manifest` goes in `debugImplementation`, not `androidTestImplementation`. Without it `createAndroidComposeRule` cannot launch an Activity and the error does not say why.
- `MigrationTestHelper` needs the exported schema JSON on the test assets path; set `room.schemaLocation` and add `sourceSets["androidTest"].assets.srcDir("$projectDir/schemas")`.
- `rule.onRoot().printToLog("TAG")` dumps the whole semantics tree to logcat, which is the fastest way to find out why a node was not found.
- If a node exists but is off screen, `performScrollTo()` before asserting.

#### Tips
- A Compose node found by `onNodeWithText` is a node a screen reader can also find. If your test needs a `testTag` for everything, your screen is probably hard to use with TalkBack.
- Instrumentation tests belong on the pull request only if they run in a few minutes. A nightly job for the slow ones keeps the feedback loop honest.
- Never `Thread.sleep` in a Compose test. `waitUntil { }` with a condition says what you are actually waiting for and fails with a useful message.

#### Docs
- [Testing your Compose layout](https://developer.android.com/develop/ui/compose/testing)
- [Test your database](https://developer.android.com/training/data-storage/room/testing-db)
- [Testing fundamentals](https://developer.android.com/training/testing/fundamentals)
