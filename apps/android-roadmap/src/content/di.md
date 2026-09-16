# Dependency injection

Dependency injection is a grand name for a small habit: a class asks for what it needs instead of going and getting it. `class NoteRepository(private val dao: NoteDao)` is dependency injection. That is the whole idea, and everything else — Hilt, modules, scopes, `@Inject` — is machinery for doing it at scale without writing a thousand lines of `new`.

## Why bother

Look at the version that fetches its own collaborators.

```kotlin
class NoteRepository {
    private val dao = AppDatabase.getInstance(MyApp.context).noteDao()
    private val api = Retrofit.Builder().baseUrl(BuildConfig.API).build().create<NoteApi>()
}
```

It works. It is also a class you cannot test without a device, cannot point at a staging server without editing it, cannot reuse in a second app, and cannot read without knowing what `getInstance` does. It has a hidden dependency on a global `MyApp.context`, which means it has a hidden dependency on the application being fully started.

```kotlin
class NoteRepository(private val dao: NoteDao, private val api: NoteApi)
```

The same class, honest about what it needs. The constructor is now the documentation. A test hands it two fakes and runs on the JVM in milliseconds. Nothing about it knows Android exists.

The cost is that somebody, somewhere, still has to build the `NoteDao` and the `NoteApi` and hand them over. That somebody is the graph.

## Constructor injection

Prefer the constructor to every other kind of injection.

- **Constructor** — required, immutable, impossible to forget, visible in the signature.
- **Field or property** — what you fall back to when the framework creates the object and you cannot change its constructor. An `Activity` is the classic case: the system calls its no-argument constructor, so Hilt sets fields on it after the fact.
- **Method** — rare, and usually a sign that the dependency is really a parameter.

A dependency that is optional is a dependency with a default: `class Uploader(private val retries: Int = 3)`. A dependency that is sometimes present is usually two classes pretending to be one.

## A graph by hand

Before reaching for a library, know what the library does, because for a small app doing it yourself is perfectly reasonable.

```kotlin
class AppContainer(context: Context) {
    // built once, shared by everybody
    private val database: AppDatabase by lazy { buildDatabase(context) }
    private val client: OkHttpClient by lazy { OkHttpClient.Builder().build() }
    val noteRepository: NoteRepository by lazy { NoteRepository(database.noteDao(), buildApi(client)) }

    // built fresh every time
    fun newNoteFormatter(): NoteFormatter = NoteFormatter(Locale.getDefault())
}
```

`by lazy` gives you a singleton: created the first time somebody asks, shared after that. A function gives you a factory: a new instance per call. Those two lifetimes cover most of what an app needs, and the difference between them is the single most common source of DI bugs.

Hang the container off your `Application` and screens reach it through their `ViewModel` factory. That is the manual pattern the Android documentation calls a *container*, and it scales further than people expect.

## Lifetimes and scopes

A **scope** is a lifetime with a name. Objects in a scope are created once per instance of that scope, and thrown away when it ends.

| Scope | Lives as long as | Good for |
| --- | --- | --- |
| `@Singleton` | the process | database, network client, DataStore, repositories |
| `@ActivityRetainedScoped` | the ViewModel, across rotation | per-flow state, a checkout session |
| `@ViewModelScoped` | one ViewModel | a use case that caches for one screen |
| `@ActivityScoped` | one Activity instance | anything that holds a `Context` from an Activity |
| unscoped | nothing — new every time | stateless mappers, formatters, validators |

Two rules follow from the table and cause most of the crashes people blame on Hilt.

**A longer-lived object may never hold a shorter-lived one.** A `@Singleton` that keeps an `Activity` keeps the whole screen alive after it is destroyed. That is a leak, and it is the reason `@ApplicationContext` exists as a separate thing from `@ActivityContext`.

**Unscoped is the correct default.** A scope costs memory for as long as the scope lives. Scope something because it is expensive to build or because sharing the same instance is the point, not out of habit.

## Hilt

Hilt is Dagger with the Android wiring already written. You annotate, it generates the container.

```kotlin
@HiltAndroidApp
class MyApp : Application()

@Module
@InstallIn(SingletonComponent::class)
object DataModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "notes.db").build()

    @Provides
    fun provideNoteDao(db: AppDatabase): NoteDao = db.noteDao()
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindNoteRepository(impl: OfflineFirstNoteRepository): NoteRepository
}
```

- `@Provides` is for objects you build yourself, usually because they come from a library and you cannot annotate their constructor.
- `@Binds` is for "when someone asks for this interface, give them that implementation". It is an abstract function and generates less code than the equivalent `@Provides`.
- `@InstallIn` says which component — and therefore which lifetime — the binding belongs to.

Anything you own needs no module at all:

```kotlin
class OfflineFirstNoteRepository @Inject constructor(
    private val dao: NoteDao,
    private val api: NoteApi,
) : NoteRepository

@HiltViewModel
class NotesViewModel @Inject constructor(
    private val repository: NoteRepository,
) : ViewModel()

@AndroidEntryPoint
class MainActivity : ComponentActivity()
```

In Compose, `hiltViewModel()` gets you the ViewModel with its dependencies already supplied. The `@AndroidEntryPoint` on the Activity is what makes that work; forget it and you get a runtime crash that names the missing annotation, which is the friendliest error message in the whole framework.

## What belongs in a graph

Not everything. A graph is for **collaborators**, not for **data**.

In the graph: things with a lifetime (a database, a client, a repository), things with more than one implementation (a real and a fake, a free and a paid), and things that are expensive to build.

Not in the graph: a `String` the user typed, an id from a navigation argument, the current screen state. Those are parameters. Putting a note id in the graph so a use case can read it is how you get a use case that works on exactly one screen and breaks the next.

A useful test: if two instances of the object could sensibly exist at once with different values, it is data, and data travels as an argument.

## Testability is the point

The real payoff shows up in the test source set.

```kotlin
class CheckoutTest {
    @Test
    fun logsThePurchase() {
        val analytics = FakeAnalytics()
        val checkout = Checkout(FixedClock(1_000), analytics)
        checkout.buy("book", 999)
        assertEquals(listOf("1000 buy:book"), analytics.events)
    }
}
```

No framework, no `@RunWith`, no device. The constructor is the seam, and a seam is any place you can replace a real thing with a controlled one without editing the code under test. Constructor injection puts a seam at every dependency, for free, whether or not you ever use a DI library.

```kotlin playground
// A container by hand: singletons are shared, factories are not, and a scope can be closed.
class Scope(val name: String, private val parent: Scope? = null) {
    private val recipes = mutableMapOf<String, () -> Any>()
    private val instances = mutableMapOf<String, Any>()
    private var open = true

    fun single(key: String, create: () -> Any) { recipes[key] = create }

    fun get(key: String): Any {
        check(open) { "scope $name is closed" }
        recipes[key]?.let { create -> return instances.getOrPut(key) { create() } }
        return parent?.get(key) ?: error("nothing registered for $key")
    }

    fun close() { instances.clear(); open = false }
}

class Database(val label: String)
class ScreenState(val label: String)

fun main() {
    var built = 0
    val app = Scope("app").apply { single("db") { Database("shared").also { built++ } } }
    val one = Scope("screen-1", app).apply { single("state") { ScreenState("one") } }
    val two = Scope("screen-2", app).apply { single("state") { ScreenState("two") } }

    println("same database on both screens: ${one.get("db") === two.get("db")}")
    println("same state on both screens:    ${one.get("state") === two.get("state")}")
    println("database built $built time(s)")

    one.close()
    println("app survives a closed screen:  ${app.get("db") === two.get("db")}")
    println(runCatching { one.get("state") }.exceptionOrNull()?.message)
}
```

## Exercises

### 1. A container with two lifetimes

Write the smallest useful container. `single` registers a recipe whose result is created once and shared; `factory` registers one that runs on every `get`. Nothing is built until somebody asks for it — registering a recipe must not run it.

`get` on a key nobody registered throws `IllegalStateException` with the message `"nothing registered for $key"`. Registering a key again replaces the recipe and forgets any instance already cached for it, so the next `get` uses the new one.

```kotlin starter
class Container {
    fun single(key: String, create: () -> Any) {
    }

    fun factory(key: String, create: () -> Any) {
    }

    fun get(key: String): Any = key
}
```

```kotlin test
class ContainerTest {
    // a singleton is built once, lazily
    @Test
    fun shared() {
        var built = 0
        val c = Container()
        c.single("db") { built++; Any() }
        assertEquals("registering must not build anything", 0, built)
        val first = c.get("db")
        assertSame(first, c.get("db"))
        assertEquals(1, built)
    }

    // a factory is built every time
    @Test
    fun fresh() {
        var built = 0
        val c = Container()
        c.factory("formatter") { built++; Any() }
        assertEquals(0, built)
        val first = c.get("formatter")
        assertNotSame(first, c.get("formatter"))
        assertEquals(2, built)
    }

    // recipes can depend on other recipes
    @Test
    fun wiring() {
        val c = Container()
        c.single("db") { "DB" }
        c.factory("repo") { "repo(${c.get("db")})" }
        assertEquals("repo(DB)", c.get("repo"))
        assertEquals("repo(DB)", c.get("repo"))
    }

    // an unknown key says so
    @Test
    fun missing() {
        var message: String? = null
        try {
            Container().get("nope")
        } catch (e: IllegalStateException) {
            message = e.message
        }
        assertEquals("nothing registered for nope", message)
    }

    // re-registering wins, cache and all
    @Test
    fun replaced() {
        val c = Container()
        c.single("api") { "staging" }
        assertEquals("staging", c.get("api"))
        c.single("api") { "production" }
        assertEquals("production", c.get("api"))
    }
}
```

#### Uses
- [Dependency injection › A graph by hand](#/di/a-graph-by-hand)
- [Dependency injection › Lifetimes and scopes](#/di/lifetimes-and-scopes)
- [Reference › Assertions](#/reference/assertions)

#### Hints
- Two maps of recipes — one for singletons, one for factories — and a third map for the instances you have already built.
- `instances.getOrPut(key) { create() }` is the whole of the singleton case, and it only calls `create` when the key is absent.
- Re-registering has to remove the cached instance as well as replacing the recipe, and registering in one map should clear the key from the other.

#### Tips
- `assertSame` compares identity, `assertEquals` compares value. For lifetimes only identity tells you the truth.
- This is roughly what Hilt generates, minus the compile-time checking. Hilt's real advantage is that a missing binding is a build error rather than a crash the first time that screen opens.
- Keys as strings are fine for twenty lines; a real locator keys on the type, which is why Dagger can catch your mistakes before you run.

#### Docs
- [Manual dependency injection](https://developer.android.com/training/dependency-injection/manual)
- [Dependency injection in Android](https://developer.android.com/training/dependency-injection)

### 2. Scopes that end

An app-wide object outlives every screen; a screen-scoped object dies with its screen. Model both with one class.

A `Scope` has an optional parent. `get(key)` returns this scope's own instance if this scope registered that key, otherwise it asks its parent; each scope caches its own instances, so two children of the same parent share the parent's objects and none of each other's. `close()` throws away this scope's instances, and any `get` on a closed scope throws `IllegalStateException` with the message `"scope $name is closed"`. Closing a child must leave the parent and its siblings untouched.

A key nobody in the chain registered throws `IllegalStateException` with the message `"nothing registered for $key"`.

```kotlin starter
class Scope(val name: String, private val parent: Scope? = null) {
    fun single(key: String, create: () -> Any) {
    }

    fun get(key: String): Any = name

    fun close() {
    }
}
```

```kotlin test
class ScopeTest {
    // the parent's object is shared, the children's are not
    @Test
    fun sharing() {
        val app = Scope("app")
        app.single("db") { Any() }
        val one = Scope("screen-1", app).apply { single("state") { Any() } }
        val two = Scope("screen-2", app).apply { single("state") { Any() } }
        assertSame(one.get("db"), two.get("db"))
        assertNotSame(one.get("state"), two.get("state"))
        assertSame(one.get("state"), one.get("state"))
    }

    // a child shadows the parent rather than sharing with it
    @Test
    fun shadowing() {
        val app = Scope("app")
        app.single("clock") { "app clock" }
        val screen = Scope("screen", app).apply { single("clock") { "screen clock" } }
        assertEquals("screen clock", screen.get("clock"))
        assertEquals("app clock", app.get("clock"))
    }

    // closing one screen leaves everything else alone
    @Test
    fun closing() {
        val app = Scope("app")
        app.single("db") { "DB" }
        val one = Scope("screen-1", app).apply { single("state") { "one" } }
        val two = Scope("screen-2", app).apply { single("state") { "two" } }
        one.close()
        assertEquals("DB", app.get("db"))
        assertEquals("two", two.get("state"))
        assertEquals("DB", two.get("db"))

        var message: String? = null
        try {
            one.get("state")
        } catch (e: IllegalStateException) {
            message = e.message
        }
        assertEquals("scope screen-1 is closed", message)
    }

    // nobody in the chain has it
    @Test
    fun missing() {
        val screen = Scope("screen", Scope("app"))
        var message: String? = null
        try {
            screen.get("nope")
        } catch (e: IllegalStateException) {
            message = e.message
        }
        assertEquals("nothing registered for nope", message)
    }
}
```

#### Uses
- [Dependency injection › Lifetimes and scopes](#/di/lifetimes-and-scopes)
- [Dependency injection › A graph by hand](#/di/a-graph-by-hand)
- [Reference › Assertions](#/reference/assertions)

#### Hints
- Keep a `recipes` map, an `instances` map and an `open` flag. `check(open) { "scope $name is closed" }` at the top of `get` covers the closed case.
- Ask your own recipes first; only if you have none for that key should you delegate to `parent?.get(key)`.
- When there is no parent and no recipe, `error("nothing registered for $key")`.

#### Tips
- This is the shape of Hilt's components: `SingletonComponent` is the root, `ActivityRetainedComponent` hangs off it, `ViewModelComponent` hangs off that. A child can see everything above it and nothing beside it.
- The reason a `@Singleton` must never hold an `Activity` is right here: the parent outlives the child, so a reference pointing upwards is fine and a reference pointing downwards is a leak.
- `close()` clearing instances but keeping recipes is deliberate — a scope can be reopened in some designs, and forgetting the recipes would make that impossible.

#### Docs
- [Hilt components and scopes](https://developer.android.com/training/dependency-injection/hilt-android#component-scopes)
- [Component lifetimes](https://developer.android.com/training/dependency-injection/hilt-android#component-lifetimes)

### 3. A seam you can fake

`Checkout` needs to know the time and needs to report what happened. Both arrive through the constructor as interfaces, which is what makes the test below possible without a device, a network or a real clock.

`buy(item, priceCents)` returns `true` when the purchase goes through and `false` when it does not, and logs exactly one event either way through `Analytics.log`. A price of zero or less is refused and logs `"reject:$item"`. An item with a blank name — empty or only whitespace — is also refused and logs `"reject:"` followed by the name exactly as given. Otherwise it logs `"buy:$item"` and returns `true`. Every call to `log` carries `clock.nowMs()` as its second argument.

Write the two interfaces and the class.

```kotlin starter
interface Clock {
    fun nowMs(): Long
}

interface Analytics {
    fun log(event: String, atMs: Long)
}

class Checkout(private val clock: Clock, private val analytics: Analytics) {
    fun buy(item: String, priceCents: Int): Boolean = true
}
```

```kotlin test
class FakeAnalytics : Analytics {
    val events = mutableListOf<String>()
    override fun log(event: String, atMs: Long) {
        events.add("$atMs $event")
    }
}

class FixedClock(private val value: Long) : Clock {
    override fun nowMs(): Long = value
}

class CheckoutTest {
    // a good purchase is logged with the time from the clock
    @Test
    fun succeeds() {
        val analytics = FakeAnalytics()
        val checkout = Checkout(FixedClock(1_000), analytics)
        assertTrue(checkout.buy("book", 999))
        assertEquals(listOf("1000 buy:book"), analytics.events)
    }

    // a free item is not a purchase
    @Test
    fun refusesPrice() {
        val analytics = FakeAnalytics()
        val checkout = Checkout(FixedClock(7), analytics)
        assertFalse(checkout.buy("book", 0))
        assertFalse(checkout.buy("pen", -1))
        assertEquals(listOf("7 reject:book", "7 reject:pen"), analytics.events)
    }

    // a blank name is not an item
    @Test
    fun refusesBlank() {
        val analytics = FakeAnalytics()
        val checkout = Checkout(FixedClock(0), analytics)
        assertFalse(checkout.buy("", 100))
        assertFalse(checkout.buy("   ", 100))
        assertEquals(listOf("0 reject:", "0 reject:   "), analytics.events)
    }

    // the clock is asked every time, not once
    @Test
    fun movingClock() {
        val analytics = FakeAnalytics()
        var t = 0L
        val checkout = Checkout(object : Clock { override fun nowMs(): Long = t }, analytics)
        checkout.buy("a", 1)
        t = 500
        checkout.buy("b", 1)
        t = 900
        checkout.buy("c", 0)
        assertEquals(listOf("0 buy:a", "500 buy:b", "900 reject:c"), analytics.events)
        assertEquals("exactly one event per call", 3, analytics.events.size)
    }
}
```

#### Uses
- [Dependency injection › Testability is the point](#/di/testability-is-the-point)
- [Dependency injection › Constructor injection](#/di/constructor-injection)
- [Dependency injection › What belongs in a graph](#/di/what-belongs-in-a-graph)

#### Hints
- `item.isBlank()` is true for `""` and for `"   "`.
- Read the time once per call into a local, then use it for whichever event you log — but do not read it in the constructor.
- Both rejections log the same shape, so work out the event string first and return at the end.

#### Tips
- `Clock` and `Analytics` belong in the graph: they have implementations you swap. `item` and `priceCents` are data and belong in the signature.
- A fake that records into a list is easier to read in a failure message than a mock's verification error, and it never goes stale when you rename a method.
- If `Checkout` called `System.currentTimeMillis()` directly, the fourth test could not exist. That is the practical meaning of "untestable".

#### Docs
- [Use dependency injection to improve testability](https://developer.android.com/training/dependency-injection#di-android)
- [Test doubles](https://developer.android.com/training/testing/fundamentals/test-doubles)

### 4. Hilt in a real app

Take an app that builds its own database and network client inside a repository, and move the wiring into Hilt. Nothing about the behaviour changes; what changes is that you can now point the app at a different server without touching the repository.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- The `com.google.dagger.hilt.android` plugin applied, with the KSP `hilt-compiler`.
- `@HiltAndroidApp` on your `Application` class, and that class named in the manifest.
- A `@Module @InstallIn(SingletonComponent::class)` object providing the Room database as a `@Singleton`, and the DAO from it unscoped.
- An interface `NoteRepository` with an `@Inject constructor` implementation, bound with `@Binds` in an abstract module.
- A `@HiltViewModel class NotesViewModel @Inject constructor(...)`, reached from Compose with `hiltViewModel()`.
- `@AndroidEntryPoint` on the Activity that hosts the screen.
- No `Context` stored in any `@Singleton` except through `@ApplicationContext`.
- Delete every `getInstance()` and every global you were using; the build should fail if you missed one.

```kotlin solution
// MyApp.kt
@HiltAndroidApp
class MyApp : Application()

// DataModule.kt — things you did not write, so they need @Provides
@Module
@InstallIn(SingletonComponent::class)
object DataModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "notes.db")
            .addMigrations(MIGRATION_1_2)
            .build()

    // Unscoped: it is a thin handle onto the database, which is the thing that is scoped.
    @Provides
    fun provideNoteDao(database: AppDatabase): NoteDao = database.noteDao()

    @Provides
    @Singleton
    fun provideOkHttp(): OkHttpClient = OkHttpClient.Builder().build()

    @Provides
    @Singleton
    fun provideNoteApi(client: OkHttpClient): NoteApi =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(Json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(NoteApi::class.java)
}

// RepositoryModule.kt — things you did write, so @Binds is enough
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindNoteRepository(impl: OfflineFirstNoteRepository): NoteRepository
}

// OfflineFirstNoteRepository.kt
interface NoteRepository {
    val notes: Flow<List<Note>>
    suspend fun refresh()
}

class OfflineFirstNoteRepository @Inject constructor(
    private val dao: NoteDao,
    private val api: NoteApi,
) : NoteRepository {
    override val notes: Flow<List<Note>> = dao.observeAll().map { rows -> rows.map(NoteEntity::toNote) }
    override suspend fun refresh() = api.fetchNotes().forEach { dao.upsert(it.toEntity()) }
}

// NotesViewModel.kt
@HiltViewModel
class NotesViewModel @Inject constructor(
    private val repository: NoteRepository,
) : ViewModel() {
    val notes: StateFlow<List<Note>> = repository.notes
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

// MainActivity.kt
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AppTheme { NotesScreen(viewModel = hiltViewModel()) } }
    }
}
```

#### Uses
- [Dependency injection › Hilt](#/di/hilt)
- [Dependency injection › Lifetimes and scopes](#/di/lifetimes-and-scopes)
- [Dependency injection › What belongs in a graph](#/di/what-belongs-in-a-graph)

#### Hints
- Hilt needs its Gradle plugin *and* its KSP processor. Applying only the plugin gives you a build that succeeds and an app that crashes on launch.
- `@Binds` functions are abstract and live in an abstract class or an interface; `@Provides` functions have bodies and usually live in an `object`. Mixing the two in one module is allowed but confusing.
- `MissingBinding` at build time names the type it could not construct and the chain that asked for it. Read the chain from the bottom.
- `hiltViewModel()` needs the composable to be inside an `@AndroidEntryPoint` Activity. If it is not, the error is about the ViewModel factory, not about Hilt.

#### Tips
- Scope `AppDatabase`, not `NoteDao`. The DAO is free to create and scoping it just adds a second thing that must be kept alive.
- Resist `@Singleton` on everything. It is a memory commitment for the life of the process, and an unscoped binding costs one allocation.
- Once the graph exists, a test can replace any binding with `@TestInstallIn`, which is how an instrumentation test runs the real screen against a fake server.

#### Docs
- [Dependency injection with Hilt](https://developer.android.com/training/dependency-injection/hilt-android)
- [Hilt and Jetpack integrations](https://developer.android.com/training/dependency-injection/hilt-jetpack)
- [Hilt testing guide](https://developer.android.com/training/dependency-injection/hilt-testing)
