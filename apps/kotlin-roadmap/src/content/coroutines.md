# Coroutines

A coroutine is a computation that can suspend in the middle and resume later, without holding a thread while it waits. That is the whole idea: a thousand coroutines waiting on a network call cost a thousand small objects, not a thousand threads. The code stays sequential and readable — no callbacks, no futures chained together — because the compiler does the rewriting.

Coroutines are not part of the language proper. `suspend` is a keyword, but everything else lives in the `kotlinx.coroutines` library, which is available here.

## Suspend functions

Mark a function `suspend` and it may call other suspend functions, including `delay`, which pauses the coroutine without blocking a thread.

```kotlin
suspend fun fetch(id: Int): String {
    delay(100)
    return "item-$id"
}
```

A suspend function can only be called from another suspend function or from a coroutine builder. That restriction is the type system tracking, for you, which code might wait.

## runBlocking, the bridge

Ordinary code — `main`, a JUnit test — is not suspending. `runBlocking { ... }` builds a coroutine and blocks the current thread until it finishes, which is exactly what you want at the very edge of a program and nowhere else.

```kotlin
fun main() = runBlocking {
    println(fetch(1))
}
```

Every test in this module wraps its body in `runBlocking`, because a `@Test` function cannot be `suspend`.

## coroutineScope and structured concurrency

`coroutineScope { ... }` is the suspending version: it creates a scope, runs the block, and does not return until every coroutine started inside it has finished. This is structured concurrency, and it is the rule that makes the rest safe — a function that starts coroutines cannot leak them, because the scope waits.

The scope also propagates failure: if one child throws, the others are cancelled and the exception comes out of `coroutineScope`.

## launch: start and forget the result

`launch` starts a coroutine that returns no value. It gives back a `Job`, which you can `join()` or `cancel()`.

```kotlin
coroutineScope {
    launch { delay(100); println("one") }
    launch { delay(50); println("two") }
}   // returns after both have printed
```

## async and await

`async` starts a coroutine that produces a value and returns a `Deferred<T>`. `await()` suspends until it is ready. Starting several and awaiting them afterwards is what turns sequential waiting into concurrent waiting.

```kotlin
coroutineScope {
    val a = async { fetch(1) }
    val b = async { fetch(2) }
    listOf(a.await(), b.await())     // ~100ms, not ~200ms
}
```

For a list, `map { async { ... } }` then `awaitAll()` is the idiom, and `awaitAll` keeps the original order however the work finishes. The mistake to avoid is `map { async { ... }.await() }`, which awaits each one before starting the next and is exactly as slow as a plain loop.

## Timeouts and cancellation

`withTimeout(ms) { ... }` cancels the block and throws `TimeoutCancellationException` when time runs out. `withTimeoutOrNull(ms) { ... }` returns `null` instead, which is usually what you want.

```kotlin
val result: String? = withTimeoutOrNull(200) { fetch(1) }
```

Cancellation is cooperative: it works because the suspending functions in the standard library check for it. A coroutine stuck in a tight non-suspending loop will not notice.

## Errors and supervisorScope

An exception in a child cancels its siblings and propagates out of the scope. That is worth reading twice: one failing `async` out of ten does not merely lose its own result, it cancels the other nine and the whole `coroutineScope` throws. Structured concurrency trades "one thing failed" for "this whole unit of work failed", which is the right default and a genuine surprise the first time you meet it.

Wrapping the `await` in a `try` does not help, because the cancellation has already reached the siblings by then. When failures are expected and independent, catch them where they happen — `runCatching` inside each `async` keeps one bad result from killing the batch:

```kotlin
coroutineScope {
    ids.map { async { runCatching { load(it) } } }.awaitAll()
}   // a List<Result<T>>: every id reported, none cancelled
```

`supervisorScope { ... }` is the other tool: children fail independently, and a failed child does not bring down the scope. The scope still waits for everyone, and a failed child's exception surfaces when you `await()` it.

## Limiting concurrency

Unlimited concurrency is rarely what a real system wants. `Semaphore(limit)` from `kotlinx.coroutines.sync` hands out a fixed number of permits, and `withPermit { ... }` suspends until one is free.

```kotlin
val gate = Semaphore(2)
val results = items.map { async { gate.withPermit { fetch(it) } } }.awaitAll()
```

All the work is still started at once; only two coroutines are ever inside the block.

## Dispatchers

A dispatcher decides which thread a coroutine runs on. `withContext(Dispatchers.Default) { ... }` moves a CPU-heavy block onto a shared pool; `Dispatchers.IO` is sized for blocking calls. For suspending work that never blocks, the default inherited dispatcher is fine, and most code never names one.

```kotlin playground
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlin.system.measureTimeMillis

suspend fun fetch(id: Int): String {
    delay(100)
    return "item-$id"
}

fun main() = runBlocking {
    val ids = listOf(1, 2, 3, 4, 5)

    val slow = measureTimeMillis { println(ids.map { fetch(it) }) }
    println("one at a time: ${slow}ms")

    val fast = measureTimeMillis {
        val all = coroutineScope { ids.map { async { fetch(it) } }.awaitAll() }
        println(all)
    }
    println("all at once:   ${fast}ms")

    val gated = measureTimeMillis {
        val gate = Semaphore(2)
        coroutineScope { ids.map { async { gate.withPermit { fetch(it) } } }.awaitAll() }
    }
    println("two at a time: ${gated}ms")

    println("timed out: ${withTimeoutOrNull(50) { fetch(9) }}")
    println("in time:   ${withTimeoutOrNull(500) { fetch(9) }}")

    val mixed = coroutineScope {
        listOf(1, -2, 3).map {
            async { runCatching { require(it > 0) { "bad id $it" }; fetch(it) }.getOrElse { e -> "error: ${e.message}" } }
        }.awaitAll()
    }
    println(mixed)
}
```

## Exercises

### 1. Fetch them all at once

`fetchAll(ids)` returns one result per id, in the order the ids were given. The tests provide `fetchOne`, which takes about 100ms, and they time a batch of ten — so awaiting each fetch before starting the next will not pass.

An empty list of ids gives an empty list.

```kotlin starter
import kotlinx.coroutines.*

suspend fun fetchAll(ids: List<Int>): List<String> = emptyList()
```

```kotlin test
import kotlinx.coroutines.*
import kotlin.system.measureTimeMillis

suspend fun fetchOne(id: Int): String {
    delay(100)
    return "item-$id"
}

class FetchAllTest {
    // one result per id, in order
    @Test
    fun inOrder() {
        runBlocking {
            assertEquals(listOf("item-3", "item-1", "item-2"), fetchAll(listOf(3, 1, 2)))
            assertEquals(listOf("item-7"), fetchAll(listOf(7)))
        }
    }

    // duplicates and empty input
    @Test
    fun edges() {
        runBlocking {
            assertEquals(emptyList<String>(), fetchAll(emptyList()))
            assertEquals(listOf("item-5", "item-5"), fetchAll(listOf(5, 5)))
        }
    }

    // ten fetches take about as long as one
    @Test
    fun concurrent() {
        runBlocking {
            val ids = (1..10).toList()
            var out: List<String> = emptyList()
            val ms = measureTimeMillis { out = fetchAll(ids) }
            assertEquals(ids.map { "item-$it" }, out)
            assertTrue("ten 100ms fetches took ${ms}ms; they should overlap", ms < 500)
        }
    }
}
```

#### Uses
- [Coroutines › async and await](#/coroutines/async-and-await)
- [Coroutines › coroutineScope and structured concurrency](#/coroutines/coroutinescope-and-structured-concurrency)

#### Hints
- You need a scope to start coroutines in, and `coroutineScope { ... }` is the one that waits for them.
- Start them all first, then wait: `ids.map { async { fetchOne(it) } }.awaitAll()`.
- `awaitAll()` returns results in the order of the list, not the order they finished, so nothing extra is needed to keep the order.

#### Tips
- Writing `ids.map { async { fetchOne(it) }.await() }` compiles and passes the first two tests, then fails the timing one. That one misplaced `.await()` is the most common coroutine bug there is.
- Start everything first, await afterwards. The rule is that no `await` may appear inside the loop that creates the coroutines.
- `awaitAll()` restores the input order however the work finished, so you never need to sort or tag the results.

#### Docs
- [Composing suspending functions](https://kotlinlang.org/docs/composing-suspending-functions.html)

### 2. Give up on time

`attempt(workMs, timeoutMs)` waits `workMs` milliseconds and returns `"done"`, unless that takes longer than `timeoutMs`, in which case it returns `null` rather than throwing.

`bestEffort(tasks, timeoutMs)` runs every task concurrently — each task is just a number of milliseconds to wait — and returns the durations of the ones that finished in time, in the order they appear in `tasks`. Tasks that ran out of time are dropped. The whole call must not take much longer than the timeout, so the tasks have to overlap.

```kotlin starter
import kotlinx.coroutines.*

suspend fun attempt(workMs: Long, timeoutMs: Long): String? = "done"

suspend fun bestEffort(tasks: List<Long>, timeoutMs: Long): List<Long> = tasks
```

```kotlin test
import kotlinx.coroutines.*
import kotlin.system.measureTimeMillis

class TimeoutTest {
    // finishes in time, or gives up
    @Test
    fun attempts() {
        runBlocking {
            assertEquals("done", attempt(10, 300))
            assertEquals("done", attempt(0, 50))
            assertEquals(null, attempt(400, 100))
            assertEquals(null, attempt(200, 20))
        }
    }

    // the slow ones are dropped
    @Test
    fun partial() {
        runBlocking {
            assertEquals(listOf(50L, 100L), bestEffort(listOf(50, 600, 100), 300))
            assertEquals(listOf(30L), bestEffort(listOf(700, 30, 800), 300))
        }
    }

    // all in, all out, or nothing at all
    @Test
    fun extremes() {
        runBlocking {
            assertEquals(listOf(10L, 20L, 30L), bestEffort(listOf(10, 20, 30), 300))
            assertEquals(emptyList<Long>(), bestEffort(listOf(500, 600), 100))
            assertEquals(emptyList<Long>(), bestEffort(emptyList(), 100))
        }
    }

    // the tasks run together, not one after another
    @Test
    fun concurrent() {
        runBlocking {
            var out: List<Long> = emptyList()
            val ms = measureTimeMillis { out = bestEffort(listOf(100, 100, 100, 100, 100, 100), 400) }
            assertEquals(List(6) { 100L }, out)
            assertTrue("six 100ms tasks took ${ms}ms; they should overlap", ms < 400)
        }
    }
}
```

#### Uses
- [Coroutines › Timeouts and cancellation](#/coroutines/timeouts-and-cancellation)
- [Coroutines › async and await](#/coroutines/async-and-await)

#### Hints
- `withTimeoutOrNull(timeoutMs) { delay(workMs); "done" }` is the whole of `attempt`.
- In `bestEffort`, give each task its own `async` inside a `coroutineScope`, and put the timeout inside the `async` so each task is timed separately.
- An `async` that timed out yields `null`, so `awaitAll().filterNotNull()` keeps the survivors in order.

#### Tips
- Putting the timeout *around* the whole batch instead of around each task changes the meaning: one slow task would then cancel everything.
- `withTimeoutOrNull` gives `null` on expiry; `withTimeout` throws `TimeoutCancellationException`. Pick the one whose failure mode you actually want to handle.
- Cancellation is cooperative. It works here because `delay` checks for it; a tight non-suspending loop would run to the end regardless.

#### Docs
- [Cancellation and timeouts](https://kotlinlang.org/docs/cancellation-and-timeouts.html)

### 3. One failure should not sink the batch

`loadAll(ids)` loads every id concurrently and returns one string per id, in order. The tests provide `load`, which takes about 100ms and throws `IllegalArgumentException("bad id <id>")` for a negative id.

A successful load contributes its own result; a failed one contributes `"error: bad id <id>"` — the exception's message, prefixed. A failure must not cancel the other loads, and the timing test makes sure they all still ran together.

```kotlin starter
import kotlinx.coroutines.*

suspend fun loadAll(ids: List<Int>): List<String> = ids.map { "ok-$it" }
```

```kotlin test
import kotlinx.coroutines.*
import kotlin.system.measureTimeMillis

suspend fun load(id: Int): String {
    delay(100)
    require(id >= 0) { "bad id $id" }
    return "ok-$id"
}

class LoadAllTest {
    // successes and failures side by side
    @Test
    fun mixed() {
        runBlocking {
            assertEquals(listOf("ok-1", "error: bad id -2", "ok-3"), loadAll(listOf(1, -2, 3)))
            assertEquals(listOf("error: bad id -9", "ok-0"), loadAll(listOf(-9, 0)))
        }
    }

    // every id can fail, or none
    @Test
    fun extremes() {
        runBlocking {
            assertEquals(listOf("error: bad id -1", "error: bad id -2"), loadAll(listOf(-1, -2)))
            assertEquals(listOf("ok-4", "ok-5"), loadAll(listOf(4, 5)))
            assertEquals(emptyList<String>(), loadAll(emptyList()))
        }
    }

    // a failure early in the list does not stop the rest
    @Test
    fun failureDoesNotCancel() {
        runBlocking {
            val ids = listOf(-1) + (1..9).toList()
            var out: List<String> = emptyList()
            val ms = measureTimeMillis { out = loadAll(ids) }
            assertEquals("error: bad id -1", out.first())
            assertEquals((1..9).map { "ok-$it" }, out.drop(1))
            assertTrue("ten loads took ${ms}ms; they should overlap", ms < 500)
        }
    }
}
```

#### Uses
- [Coroutines › Errors and supervisorScope](#/coroutines/errors-and-supervisorscope)
- [Coroutines › async and await](#/coroutines/async-and-await)

#### Hints
- Catch inside each coroutine, not outside the scope: `async { runCatching { load(it) } }`.
- `runCatching { ... }.getOrElse { e -> "error: ${e.message}" }` turns the failure into the string the tests want.
- If the exception escapes the `async`, `coroutineScope` cancels every sibling and rethrows — which is why the catch has to be inside.

#### Tips
- `require(id >= 0) { "bad id $id" }` produces exactly the message `"bad id -2"`, so `e.message` is all you need.
- The catch has to be *inside* the `async`. Once an exception escapes a child, `coroutineScope` has already cancelled its siblings, and a `try` around `awaitAll` is too late.
- `supervisorScope` is the other answer to the same problem, and the one to reach for when the children are genuinely independent pieces of work.

#### Docs
- [Coroutine exceptions](https://kotlinlang.org/docs/exception-handling.html)

### 4. Only so many at a time

`runAll(tasks, limit)` runs every task, but never more than `limit` of them at the same time, and returns the results in the order of the input list. Every task is started as part of one batch — you may not run them one by one.

The tests use tasks that each wait 100ms. Six of them with a limit of 2 should take roughly 300ms: clearly more than running them all at once, clearly less than running them in sequence. A limit larger than the number of tasks means no limit at all.

```kotlin starter
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

suspend fun runAll(tasks: List<suspend () -> Int>, limit: Int): List<Int> = emptyList()
```

```kotlin test
import kotlinx.coroutines.*
import kotlin.system.measureTimeMillis

class RunAllTest {
    private fun waiting(values: List<Int>): List<suspend () -> Int> =
        values.map { v -> suspend { delay(100); v } }

    // results come back in input order
    @Test
    fun ordered() {
        runBlocking {
            assertEquals(listOf(3, 1, 2), runAll(waiting(listOf(3, 1, 2)), 2))
            assertEquals(listOf(9), runAll(waiting(listOf(9)), 1))
            assertEquals(emptyList<Int>(), runAll(emptyList(), 3))
        }
    }

    // a generous limit runs everything together
    @Test
    fun unlimited() {
        runBlocking {
            var out: List<Int> = emptyList()
            val ms = measureTimeMillis { out = runAll(waiting((1..6).toList()), 10) }
            assertEquals((1..6).toList(), out)
            assertTrue("six 100ms tasks with limit 10 took ${ms}ms; they should overlap", ms < 300)
        }
    }

    // a limit of two runs them in three waves
    @Test
    fun throttled() {
        runBlocking {
            var out: List<Int> = emptyList()
            val ms = measureTimeMillis { out = runAll(waiting((1..6).toList()), 2) }
            assertEquals((1..6).toList(), out)
            assertTrue("six 100ms tasks with limit 2 took ${ms}ms; at most two may run at once", ms >= 250)
            assertTrue("six 100ms tasks with limit 2 took ${ms}ms; they were not batched", ms < 550)
        }
    }

    // a limit of one is plain sequence
    @Test
    fun oneAtATime() {
        runBlocking {
            var out: List<Int> = emptyList()
            val ms = measureTimeMillis { out = runAll(waiting(listOf(1, 2, 3)), 1) }
            assertEquals(listOf(1, 2, 3), out)
            assertTrue("three 100ms tasks with limit 1 took ${ms}ms", ms >= 250)
        }
    }
}
```

#### Uses
- [Coroutines › Limiting concurrency](#/coroutines/limiting-concurrency)
- [Coroutines › async and await](#/coroutines/async-and-await)
- [Coroutines › coroutineScope and structured concurrency](#/coroutines/coroutinescope-and-structured-concurrency)

#### Hints
- Build one `Semaphore(limit)` for the whole call, outside the loop.
- Start every task in its own `async`, and wrap the body in `gate.withPermit { ... }` so the waiting happens on the permit.
- `tasks.map { async { gate.withPermit { it() } } }.awaitAll()` inside a `coroutineScope` is the whole function.

#### Tips
- `suspend { ... }` builds a value of type `suspend () -> Int`, which is how the tests make their task lists.
- Build the `Semaphore` once, outside the loop. One semaphore per task limits nothing.
- Every task still starts at once; only the body inside `withPermit` is gated. That is what keeps the results in order while the work is throttled.

#### Docs
- [Semaphore](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.sync/-semaphore/)
