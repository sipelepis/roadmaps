# Performance

Performance on Android is not about clever algorithms. It is about a deadline: every frame the screen draws gives your app a few milliseconds to produce it, and an app feels fast when it hits that deadline every single time. Miss it occasionally and people call the app janky without being able to say why. The work, then, is mostly arithmetic and measurement — find the frames that miss, find out why, fix that, and do not guess.

## Measure before you change anything

Every performance instinct you have is wrong until a profiler agrees with it. The tools, roughly in the order you should reach for them:

- **Android Studio Profiler** — CPU, memory, energy and network on a running app. The CPU recording with a system trace shows you exactly which frames missed and what was on the main thread when they did.
- **Macrobenchmark** — a test that launches your app a dozen times and reports startup time and jank with a confidence interval. This is what you put in CI so a regression shows up as a number.
- **Layout Inspector** — recomposition counts per composable, live. The single fastest way to find the composable that redraws on every keystroke.
- **Android vitals** in the Play Console — what actually happens on real devices, most of which are slower than yours.

Three rules that save weeks. Profile a **release** build, because debug builds disable optimisations and Compose's own debug instrumentation makes recomposition look far more expensive than it is. Profile on the slowest device you support, not the newest. And write the measurement down before you change anything, or you will not know whether you helped.

## The frame budget

A 60Hz display asks for a frame every 16.7ms; a 120Hz display every 8.3ms. That is the budget for everything: your composition, layout, drawing, the system's own work. In practice you want to be well under it, because the budget is shared.

A frame that misses is dropped, and the previous frame stays on screen twice as long. One dropped frame is invisible. Ten in a row during a scroll is the thing people mean when they say an app feels cheap. Android vitals counts a session as janky when more than a small percentage of its frames miss, and it ranks you against other apps on that number.

Higher refresh rates make the budget *smaller*, which is why an app that was fine on a 60Hz phone can be visibly rough on a 120Hz one.

## Recomposition, and why it is usually fine

Compose redraws by re-running composable functions whose inputs changed. That sounds expensive and mostly is not: the runtime skips any composable whose parameters are equal to last time, so a state change usually re-runs a handful of functions near the change rather than the whole tree.

It stops being fine in two situations.

**Reading state too high up.** If your top-level screen reads `scrollState.firstVisibleItemIndex`, every scrolled pixel recomposes the entire screen. Read state as deep in the tree as you can, and pass lambdas rather than values when the value is only needed at the moment of the click: `onClick = { viewModel.select(id) }` rather than passing the selected id down through six composables.

**Something the runtime cannot skip.** That is a stability problem, and it has its own section below.

The instinct to fight is optimising recomposition you have not measured. Turn on recomposition counts in the Layout Inspector, scroll, and look at the numbers. Usually two or three composables are responsible for all of it.

## Stability

A type is **stable** when Compose can rely on `equals` telling it whether anything changed, and when its public properties do not change without the runtime being told. Compose skips a composable only when all of its arguments are stable *and* equal to last time.

Stable: primitives, `String`, function types, `data class`es whose properties are all stable and `val`, anything marked `@Immutable` or `@Stable`.

Unstable, and the usual culprits:

- `List<T>`, `Set<T>`, `Map<K, V>` — the interface is read-only, not immutable, so the runtime cannot assume nobody is mutating it behind its back. Use `kotlinx.collections.immutable`'s `ImmutableList`, or wrap the list in an `@Immutable data class`.
- a `data class` with a `var`, or with a property of an unstable type.
- any class from a module that is not compiled with the Compose compiler — which is why a domain model in a pure-Kotlin module is unstable until you turn on strong skipping or annotate it.

The Compose compiler can write a report telling you which of your composables are skippable and which are not. Turn it on when you have a problem, read the list, and you usually find one type that makes half the tree unskippable.

Kotlin 2.x ships **strong skipping** on by default, which lets Compose skip composables with unstable parameters by comparing them by instance. It removes most of this pain, and it makes it more important that you do not hand a composable a freshly built list on every recomposition — a new instance is never the same instance.

## remember, and where state lives

`remember` keeps a value across recompositions of the same composable. Two failure modes, opposite to each other.

**Forgetting it.** `val formatter = SimpleDateFormat(...)` inside a composable builds a new one on every recomposition, dozens of times a second during an animation. `remember { }` it, or better, hoist it out of the composable entirely.

**Overusing it.** `remember { }` around a cheap calculation costs an allocation and a slot in the composition to avoid an addition. And `remember` with no keys is a bug waiting for the parameter to change:

```kotlin
// wrong: the greeting is stuck on the first name this composable ever saw
val greeting = remember { "Hello, $name" }

// right: recompute when the input changes
val greeting = remember(name) { "Hello, $name" }
```

`derivedStateOf` is for the narrow case where a frequently-changing state produces a rarely-changing value: reading a scroll offset to decide whether a "back to top" button is visible. Without it, every pixel of scroll recomposes the button; with it, only the change from false to true does.

`rememberSaveable` survives process death and configuration changes too, but only for types that can go into a `Bundle`. State that belongs to the screen rather than to the widget belongs in the ViewModel.

## Lists that scroll

A `LazyColumn` composes only what is visible, which is most of the battle. The rest:

**Give items a key.** `items(notes, key = { it.id })` lets Compose match an item to its previous composition across a reorder or an insert. Without a key, inserting at the top invalidates everything below it, and item state — a text field's cursor, an expanded row — follows the wrong item.

**Do no work per item.** Formatting a date, building a list, sorting: all of it happens once per visible item per frame. Do it in the ViewModel, once, and pass the finished string.

**Give items a stable height when you can.** `contentType` on `items` lets the runtime reuse compositions between items of the same shape.

**Load images through a library.** Coil handles decoding off the main thread, downsampling to the size actually drawn, and a memory cache with an eviction policy. Decoding a 4000×3000 JPEG to draw it 200px wide is one of the great reliable sources of jank and `OutOfMemoryError`.

## Startup and baseline profiles

Startup is the performance number users notice most, and it is measured in three ways: time to first frame, time to first *useful* frame, and time until the app responds to touch. Android vitals flags a cold start over 5 seconds.

The single highest-return fix is a **baseline profile**. Android ships your code as bytecode that is interpreted or JIT-compiled the first time it runs; a baseline profile is a list of the methods worth compiling ahead of time, shipped in the APK and applied at install. A typical app gets 20–30% off cold start for the price of a Gradle plugin and a generator test.

```kotlin
@Test
fun generate() = baselineProfileRule.collect(packageName = "com.example.notes") {
    pressHome()
    startActivityAndWait()
    device.findObject(By.res("note-list")).fling(Direction.DOWN)
}
```

Regenerate it when the startup path changes. A stale profile is not harmful, just less useful.

The other startup wins are subtractive: do not initialise libraries in `Application.onCreate` that the first screen does not need — use `androidx.startup` or lazy initialisation — and do not block the first frame on a network call. Show the screen with a skeleton and fill it in.

## Memory and leaks

A leak on Android is almost always the same story: something long-lived holds something screen-sized. The classic offenders are a static or `@Singleton` holding an `Activity` or a `View`, a listener registered in `onCreate` and never unregistered, an inner class holding an implicit reference to its outer `Activity`, and a coroutine launched in a scope that outlives the screen.

**LeakCanary** in your debug build finds these while you develop, with a full reference chain telling you exactly who is holding what. Add it, use the app, read what it tells you.

For allocation pressure rather than leaks, the Memory Profiler's allocation recording shows what is being created during a scroll. Anything allocating per frame is worth looking at: a new lambda, a new list, a boxed `Int` in a hot loop.

Caches deserve a size limit for the same reason. A cache with a TTL but no maximum size grows until the process is killed — the LRU eviction in exercise 2 is the standard answer, and it is what Coil's memory cache does for you.

```kotlin playground
// The two calculations behind every performance conversation: is the frame in budget,
// and did that composable really need to run again?
import kotlin.math.round

fun budgetMs(refreshHz: Int): Double = 1000.0 / refreshHz

fun jankPercent(frameTimesMs: List<Double>, refreshHz: Int): Double {
    if (frameTimesMs.isEmpty()) return 0.0
    val janky = frameTimesMs.count { it > budgetMs(refreshHz) }
    return round(janky * 1000.0 / frameTimesMs.size) / 10.0
}

/** One composition for the first frame, then one more each time the arguments actually change. */
fun recompositions(frames: List<List<Any?>>): Int =
    if (frames.isEmpty()) 0 else 1 + frames.zipWithNext().count { (a, b) -> a != b }

data class Note(val id: Long, val title: String)

fun main() {
    val frames = listOf(14.2, 15.9, 21.0, 9.4, 33.7, 12.0, 8.1, 16.9)
    for (hz in listOf(60, 90, 120)) {
        println("%dHz: budget %.2fms, %.1f%% of frames missed".format(hz, budgetMs(hz), jankPercent(frames, hz)))
    }

    val stable = List(5) { listOf(Note(1, "Milk"), "en-GB") }
    println("stable arguments over 5 frames: ${recompositions(stable)} composition(s)")

    val unstable = List(5) { listOf(Note(1, "Milk"), Any()) }
    println("one unstable argument:          ${recompositions(unstable)} composition(s)")

    val changing = listOf(listOf(1), listOf(1), listOf(2), listOf(2), listOf(3))
    println("a value that really changes:    ${recompositions(changing)} composition(s)")
}
```

## Exercises

### 1. Count the compositions

Model what Compose does when it decides whether to skip. A frame is the list of arguments a composable was called with. The first frame is its initial composition. Every frame after that re-runs the composable only if its arguments differ from the previous frame's; otherwise it is skipped.

`recompositions(frames)` returns how many times the composable actually ran — initial composition included. `skipped(frames)` returns how many frames were skipped. No frames at all means no compositions and no skips.

The interesting case is in the tests: a `data class` compares by value, so repeating it skips, while a plain object compares by identity, so a fresh one every frame never skips. That is the whole of stability in two assertions.

```kotlin starter
fun recompositions(frames: List<List<Any?>>): Int = frames.size

fun skipped(frames: List<List<Any?>>): Int = 0
```

```kotlin test
data class Note(val id: Long, val title: String)

class RecompositionTest {
    // arguments that never change cost one composition
    @Test
    fun stable() {
        val frames = List(5) { listOf(Note(1, "Milk"), "en-GB") }
        assertEquals(1, recompositions(frames))
        assertEquals(4, skipped(frames))
    }

    // a value that really changes causes a recomposition, and only then
    @Test
    fun changing() {
        val frames = listOf(listOf(1), listOf(1), listOf(2), listOf(2), listOf(3))
        assertEquals(3, recompositions(frames))
        assertEquals(2, skipped(frames))
    }

    // an unstable argument is never equal to itself, so nothing is ever skipped
    @Test
    fun unstable() {
        val frames = List(5) { listOf(Note(1, "Milk"), Any()) }
        assertEquals(5, recompositions(frames))
        assertEquals(0, skipped(frames))
    }

    // edges
    @Test
    fun edges() {
        assertEquals(0, recompositions(emptyList()))
        assertEquals(0, skipped(emptyList()))
        assertEquals(1, recompositions(listOf(emptyList())))
        assertEquals(1, recompositions(listOf(listOf<Any?>(null), listOf<Any?>(null))))
        assertEquals(2, recompositions(listOf(listOf<Any?>(null), listOf<Any?>(0))))
    }
}
```

#### Uses
- [Performance › Recomposition, and why it is usually fine](#/performance/recomposition-and-why-it-is-usually-fine)
- [Performance › Stability](#/performance/stability)

#### Hints
- Guard the empty case first, then the answer is `1 + (number of adjacent pairs that differ)`.
- `frames.zipWithNext()` gives you every adjacent pair; `count { (a, b) -> a != b }` counts the ones that changed.
- `skipped` is `frames.size - recompositions(frames)`, and it is zero for an empty list because both sides are.

#### Tips
- `List.equals` compares element by element, so two equal `data class` values in two different lists still compare equal. That is exactly why Compose can skip them.
- `Any()` has no `equals` of its own, so it falls back to identity. Every unstable type behaves like this from the runtime's point of view.
- The real runtime compares each parameter separately and can skip on some and not others. Counting whole frames is a simplification, not a lie.

#### Docs
- [Compose performance](https://developer.android.com/develop/ui/compose/performance)
- [Stability in Compose](https://developer.android.com/develop/ui/compose/performance/stability)

### 2. An image cache that forgets

A memory cache with no limit is a leak that takes a week to show up. Write the standard answer: keep the most recently used entries and throw away the rest.

`LruCache(maxSize)` holds at most `maxSize` entries. `put` adds or replaces an entry and makes it the most recently used; if that takes the cache over its limit, the least recently used entry is dropped. `get` returns the value and makes it the most recently used, or returns `null` and changes nothing. `keys()` lists the keys least recently used **first**, so the next eviction is always `keys().first()`. A `maxSize` below 1 throws `IllegalArgumentException` with the message `"maxSize must be at least 1"`.

```kotlin starter
class LruCache<K : Any, V : Any>(private val maxSize: Int) {
    fun get(key: K): V? = null

    fun put(key: K, value: V) {
    }

    fun keys(): List<K> = emptyList()

    fun size(): Int = 0
}
```

```kotlin test
class LruCacheTest {
    // stores and returns, oldest first
    @Test
    fun basics() {
        val cache = LruCache<String, Int>(3)
        cache.put("a", 1)
        cache.put("b", 2)
        assertEquals(1, cache.get("a"))
        assertNull(cache.get("missing"))
        assertEquals(2, cache.size())
    }

    // the least recently used one goes
    @Test
    fun evicts() {
        val cache = LruCache<String, Int>(2)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("c", 3)
        assertNull(cache.get("a"))
        assertEquals(listOf("b", "c"), cache.keys())
        assertEquals(2, cache.size())
    }

    // reading something saves it from eviction
    @Test
    fun getPromotes() {
        val cache = LruCache<String, Int>(2)
        cache.put("a", 1)
        cache.put("b", 2)
        assertEquals(1, cache.get("a"))
        cache.put("c", 3)
        assertEquals(listOf("a", "c"), cache.keys())
        assertNull(cache.get("b"))
    }

    // writing the same key again updates it and promotes it
    @Test
    fun putPromotes() {
        val cache = LruCache<String, Int>(2)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("a", 99)
        assertEquals(listOf("b", "a"), cache.keys())
        assertEquals(99, cache.get("a"))
        cache.put("c", 3)
        assertEquals(listOf("a", "c"), cache.keys())
    }

    // a cache of one, and a cache of none
    @Test
    fun edges() {
        val one = LruCache<String, Int>(1)
        one.put("a", 1)
        one.put("b", 2)
        assertEquals(listOf("b"), one.keys())

        var message: String? = null
        try {
            LruCache<String, Int>(0)
        } catch (e: IllegalArgumentException) {
            message = e.message
        }
        assertEquals("maxSize must be at least 1", message)
    }
}
```

#### Uses
- [Performance › Memory and leaks](#/performance/memory-and-leaks)
- [Performance › Lists that scroll](#/performance/lists-that-scroll)
- [Room & DataStore › Cache invalidation](#/persistence/cache-invalidation)

#### Hints
- A `LinkedHashMap` keeps its keys in insertion order, which is all you need: "most recently used" means "inserted last".
- Promotion is remove-then-insert. Do it in `get` on a hit and in `put` every time.
- Evict with `entries.remove(entries.keys.first())` when the size goes over the limit, and `require(maxSize >= 1) { ... }` in an `init` block.

#### Tips
- `LinkedHashMap(capacity, loadFactor, accessOrder = true)` does the promotion for you and has a `removeEldestEntry` hook — the JDK has had an LRU cache built in since 1.4.
- Size an image cache in bytes rather than entries: a hundred thumbnails and a hundred full-screen photos are very different amounts of memory.
- Coil and Glide already do all of this. Write it once so you know what "memory cache size" in their configuration actually controls.

#### Docs
- [Manage your app's memory](https://developer.android.com/topic/performance/memory)
- [Loading images](https://developer.android.com/develop/ui/compose/graphics/images/loading)

### 3. Did the frame make it?

Turn a trace into the numbers you would put in a bug report.

`budgetMs(refreshHz)` is how long one frame may take: `1000.0 / refreshHz`. `jankyFrames(times, refreshHz)` counts the frames that took **strictly longer** than the budget — a frame exactly on budget made it. `jankPercent(times, refreshHz)` is that count as a percentage of all frames, rounded to one decimal place; with no frames at all it is `0.0`. A refresh rate below 1 throws `IllegalArgumentException` with the message `"refreshHz must be at least 1"`, from all three.

```kotlin starter
import kotlin.math.round

fun budgetMs(refreshHz: Int): Double = 16.0

fun jankyFrames(frameTimesMs: List<Double>, refreshHz: Int): Int = 0

fun jankPercent(frameTimesMs: List<Double>, refreshHz: Int): Double = 0.0
```

```kotlin test
class FrameBudgetTest {
    // the budget shrinks as the screen gets faster
    @Test
    fun budget() {
        assertEquals(16.6667, budgetMs(60), 0.001)
        assertEquals(8.3333, budgetMs(120), 0.001)
        assertEquals(11.1111, budgetMs(90), 0.001)
    }

    // strictly longer than the budget is a miss
    @Test
    fun counting() {
        val frames = listOf(14.2, 15.9, 21.0, 9.4, 33.7, 12.0, 8.1, 16.9)
        assertEquals(3, jankyFrames(frames, 60))
        assertEquals(6, jankyFrames(frames, 90))
        assertEquals(0, jankyFrames(emptyList(), 60))
        assertEquals(0, jankyFrames(listOf(1000.0 / 60), 60))
    }

    // as a percentage, to one decimal place
    @Test
    fun percentage() {
        val frames = listOf(14.2, 15.9, 21.0, 9.4, 33.7, 12.0, 8.1, 16.9)
        assertEquals(37.5, jankPercent(frames, 60), 0.0001)
        assertEquals(33.3, jankPercent(listOf(5.0, 5.0, 20.0), 60), 0.0001)
        assertEquals(0.0, jankPercent(listOf(1.0, 2.0), 60), 0.0001)
        assertEquals(0.0, jankPercent(emptyList(), 120), 0.0001)
        assertEquals(100.0, jankPercent(listOf(50.0), 60), 0.0001)
    }

    // a refresh rate of zero is not a display
    @Test
    fun rejected() {
        val messages = mutableListOf<String?>()
        for (call in listOf({ budgetMs(0) }, { jankyFrames(listOf(1.0), 0) }, { jankPercent(listOf(1.0), -60) })) {
            try {
                call()
            } catch (e: IllegalArgumentException) {
                messages.add(e.message)
            }
        }
        assertEquals(List(3) { "refreshHz must be at least 1" }, messages)
    }
}
```

#### Uses
- [Performance › The frame budget](#/performance/the-frame-budget)
- [Performance › Measure before you change anything](#/performance/measure-before-you-change-anything)

#### Hints
- `require(refreshHz >= 1) { "refreshHz must be at least 1" }` at the top of `budgetMs`; the other two get it for free if they call `budgetMs`.
- Use `1000.0`, not `1000` — integer division gives you 16 at 60Hz and every test fails by a fraction.
- One decimal place is `round(x * 10) / 10.0`. Work out the percentage as `janky * 1000.0 / total` and round *that*, so you only divide once.

#### Tips
- Rounding a percentage before you compare it is a habit worth having: `37.49999999999999` is what floating point actually gives you here.
- Real traces report more than the total: how much of each frame went to the UI thread, to RenderThread and to the GPU. The total tells you *that* you have a problem; the breakdown tells you where.
- The 99th percentile frame is usually more interesting than the average. An average of 8ms hides a 200ms hitch that everybody noticed.

#### Docs
- [Slow rendering](https://developer.android.com/topic/performance/vitals/render)
- [Macrobenchmark](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview)

### 4. Make a bad list scroll

Build a list that is deliberately slow — a thousand items, a date formatted per item, a full-size image per row, no keys — measure it, then fix it and measure again. The number is the deliverable.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `LazyColumn` of at least 1000 items, each with an image, a title and a formatted date. Run it as a **release** build on the slowest device you have.
- A recording from the Studio profiler, or a Macrobenchmark with `FrameTimingMetric`, saved before you change anything.
- `items(..., key = { it.id })` added, and an item's expanded state proved to follow the right item when you insert at the top.
- Every per-item formatting moved into the ViewModel so the composable receives finished strings.
- Images loaded with Coil's `AsyncImage`, sized to the row rather than to the source file.
- The list's item type either `@Immutable` or wrapped, so the Compose compiler reports the row composable as skippable.
- The same measurement repeated, with both numbers written in the commit message.

```kotlin solution
// Before: work per item, per frame, and no keys.
@Composable
fun SlowNoteList(notes: List<Note>) {
    LazyColumn {
        items(notes) { note ->
            val formatter = SimpleDateFormat("d MMM yyyy", Locale.getDefault())   // allocated per item, per frame
            Row {
                Image(painter = painterResource(note.imageRes), contentDescription = null)
                Column {
                    Text(note.title)
                    Text(formatter.format(Date(note.updatedAt)))
                }
            }
        }
    }
}

// After: the ViewModel produces display-ready rows, and the list is keyed.
@Immutable
data class NoteRow(
    val id: Long,
    val title: String,
    val updatedLabel: String,
    val imageUrl: String,
)

class NotesViewModel(repository: NoteRepository) : ViewModel() {
    private val formatter = DateTimeFormatter.ofPattern("d MMM yyyy").withZone(ZoneId.systemDefault())

    val rows: StateFlow<List<NoteRow>> = repository.notes
        .map { notes ->
            notes.map { NoteRow(it.id, it.title, formatter.format(Instant.ofEpochMilli(it.updatedAt)), it.imageUrl) }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

@Composable
fun NoteList(rows: List<NoteRow>, onClick: (Long) -> Unit) {
    LazyColumn {
        items(
            items = rows,
            key = { it.id },
            contentType = { "note" },
        ) { row ->
            NoteRowItem(row, onClick)
        }
    }
}

@Composable
private fun NoteRowItem(row: NoteRow, onClick: (Long) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .clickable { onClick(row.id) }        // a lambda, so the id never travels as a parameter
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AsyncImage(
            model = row.imageUrl,
            contentDescription = null,
            modifier = Modifier.size(56.dp),      // Coil decodes to this size, not to the source size
        )
        Spacer(Modifier.width(12.dp))
        Column {
            Text(row.title, style = MaterialTheme.typography.titleMedium)
            Text(row.updatedLabel, style = MaterialTheme.typography.bodySmall)
        }
    }
}
```

#### Uses
- [Performance › Lists that scroll](#/performance/lists-that-scroll)
- [Performance › Stability](#/performance/stability)
- [Performance › remember, and where state lives](#/performance/remember-and-where-state-lives)

#### Hints
- Turn on recomposition counts in the Layout Inspector while scrolling. A count that climbs on rows that are not moving is the smell.
- Compose compiler reports are a Gradle flag: `composeCompiler { reportsDestination = layout.buildDirectory.dir("compose_reports") }`. The generated `*-composables.txt` marks each function `skippable` or not.
- `fillParentMaxWidth` inside a lazy item forces a measure pass you usually do not need; `fillMaxWidth` is enough.
- A debug build with the Layout Inspector attached is much slower than release. Use it to find *what*, not to measure *how much*.

#### Tips
- The most common cause of a slow list is not Compose at all — it is full-size bitmaps being decoded on the fly.
- If an item's height depends on loaded content, the list jumps as things arrive. Reserve the space with a placeholder of the right size.
- Write the before-and-after numbers in the commit message. Six months later that is the only evidence that the ugly-looking optimisation is load-bearing.

#### Docs
- [Lists and grids](https://developer.android.com/develop/ui/compose/lists)
- [Compose performance best practices](https://developer.android.com/develop/ui/compose/performance/bestpractices)
- [Inspect recomposition counts](https://developer.android.com/develop/ui/compose/tooling/layout-inspector)

### 5. Start faster, and prove it

Measure your app's cold start, add a baseline profile, and measure it again. Then hunt for one leak with LeakCanary.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `:benchmark` module from the Studio template, with a `MacrobenchmarkRule` test measuring `StartupTimingMetric` over at least 5 iterations of `CompilationMode.None()`.
- The cold-start number written down, taken on a real device with the app freshly installed.
- The `androidx.baselineprofile` Gradle plugin applied and a `BaselineProfileRule` generator that launches the app and scrolls the main list.
- `./gradlew generateBaselineProfile` run, and the generated `baseline-prof.txt` committed.
- The same benchmark re-run with `CompilationMode.Partial(baselineProfileMode = BaselineProfileMode.Require)`, and both numbers compared.
- `Application.onCreate` audited: anything not needed for the first frame moved to `androidx.startup` or made lazy.
- LeakCanary in `debugImplementation`, then rotate and navigate around until it reports something, and fix one real leak it finds.

```kotlin solution
// benchmark/src/main/java/.../StartupBenchmark.kt
@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
    @get:Rule
    val rule = MacrobenchmarkRule()

    @Test
    fun startupNoCompilation() = startup(CompilationMode.None())

    @Test
    fun startupWithBaselineProfile() =
        startup(CompilationMode.Partial(baselineProfileMode = BaselineProfileMode.Require))

    private fun startup(mode: CompilationMode) = rule.measureRepeated(
        packageName = "com.example.notes",
        metrics = listOf(StartupTimingMetric()),
        compilationMode = mode,
        startupMode = StartupMode.COLD,
        iterations = 10,
    ) {
        pressHome()
        startActivityAndWait()
    }
}

// benchmark/src/main/java/.../BaselineProfileGenerator.kt
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generate() = rule.collect(packageName = "com.example.notes") {
        pressHome()
        startActivityAndWait()
        device.wait(Until.hasObject(By.res("note-list")), 5_000)
        device.findObject(By.res("note-list")).also { list ->
            list.setGestureMargin(device.displayWidth / 5)
            list.fling(Direction.DOWN)
            list.fling(Direction.UP)
        }
        device.waitForIdle()
    }
}

// app/src/main/java/.../MyApp.kt — nothing here blocks the first frame
@HiltAndroidApp
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Crash reporting is the one thing that must be up before anything can crash.
        Crashlytics.start(this)
        // Everything else initialises on first use, or through androidx.startup.
    }
}
```

#### Uses
- [Performance › Startup and baseline profiles](#/performance/startup-and-baseline-profiles)
- [Performance › Memory and leaks](#/performance/memory-and-leaks)
- [Performance › Measure before you change anything](#/performance/measure-before-you-change-anything)
- [Reference › Testing on Android](#/reference/testing-on-android)

#### Hints
- Macrobenchmark needs a `profileable` or debuggable release variant of the app under test; the Studio template sets up a `benchmark` build type that does this for you.
- Benchmarks must run on a physical device. An emulator's numbers are not comparable between runs, and the library will warn you.
- `By.res("note-list")` matches a `Modifier.testTag("note-list")` only when the tag is exposed to UiAutomator — set `testTagsAsResourceId = true` in a `semantics` modifier on the root.
- LeakCanary will not report anything until an Activity is actually destroyed. Rotate the device, or navigate away and press back.

#### Tips
- Measure with `CompilationMode.None()` for the worst case a user can see, and with the profile applied for what they will actually get. The gap is the value of the profile.
- A baseline profile helps most on cheap devices and on the first launch after install or update — exactly the moments where a first impression is formed.
- Every library you initialise eagerly at startup is a tax on every launch forever. Make each one justify itself.

#### Docs
- [Baseline Profiles overview](https://developer.android.com/topic/performance/baselineprofiles/overview)
- [App startup time](https://developer.android.com/topic/performance/vitals/launch-time)
- [Benchmark your app](https://developer.android.com/topic/performance/benchmarking/benchmarking-overview)
