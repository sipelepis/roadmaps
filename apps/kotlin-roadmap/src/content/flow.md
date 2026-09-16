# Flow

A `Flow<T>` is a sequence of values produced over time by suspending code. Where a suspend function returns one value when it is ready, a flow emits many, and the collector is suspended between them rather than blocked. It is the coroutine answer to a stream: same operators you know from collections — `map`, `filter`, `take` — except every step may suspend.

The defining property is that a flow is *cold*. Building one runs nothing. The code inside only executes when somebody collects, and it executes again for each collector.

## What a flow is

The interface is almost embarrassingly small: a flow has one method, `collect`, that takes something to call for each value. Everything else in the library is built on it.

```kotlin
val numbers: Flow<Int> = flow {
    emit(1)
    delay(100)
    emit(2)
}
```

Nothing has happened yet. `numbers.collect { println(it) }` is what starts it, and `collect` is a suspend function, so collecting happens inside a coroutine.

## Building a flow

- `flow { emit(x) }` — the general builder, where the block is suspending.
- `flowOf(1, 2, 3)` — a fixed set of values.
- `listOf(1, 2, 3).asFlow()` — any collection or sequence.
- `emptyFlow()` — no values at all.

Inside `flow { }` you can loop, call suspend functions, and emit as you go, which is how a flow wraps a paged API or a file read.

## Intermediate operators

These describe work and return a new flow; none of them runs anything.

```kotlin
source.filter { it % 2 == 0 }
      .map { it * it }
      .take(3)
      .onEach { println("saw $it") }
```

`transform { }` is the general one: for each input value emit zero, one or many outputs. `withIndex()`, `distinctUntilChanged()`, `drop`, `takeWhile` and `runningReduce` are all there too. An operator's lambda may suspend, which is the difference from the collection versions.

## Terminal operators

A terminal operator suspends and actually runs the flow: `collect`, `toList`, `first`, `firstOrNull`, `single`, `count`, `reduce`, `fold`.

```kotlin
val squares = flowOf(1, 2, 3).map { it * it }.toList()   // [1, 4, 9]
```

`first()` stops the flow as soon as it has a value — an infinite flow is fine as long as something eventually stops collecting.

## Writing your own operator

An operator is just an extension function returning a flow, so your own fits in beside the library's. Inside a `flow { }` builder you can `collect` the receiver and `emit` whatever you like, keeping state between values in a local variable.

```kotlin
fun Flow<Int>.runningMax(): Flow<Int> = flow {
    var best = Int.MIN_VALUE
    collect { value ->
        best = maxOf(best, value)
        emit(best)
    }
}
```

That local `best` is safe because a flow is collected by one coroutine at a time, in order.

## Handling failures

An exception anywhere upstream travels down to the collector. `catch { }` intercepts it — it sees only failures from above it in the chain, and it may `emit` a replacement value before finishing.

```kotlin
source.map { it.toInt() }
      .catch { emit(-1) }
```

`onCompletion { cause -> ... }` runs when the flow ends either way; `cause` is `null` on success and the exception otherwise. It does not swallow the failure, so a `catch` after it still sees one. `retry(2)` re-collects from the top after a failure.

## Concurrency

A plain flow is sequential: each value is processed before the next is produced. `buffer()` lets the producer run ahead of the collector, and `flatMapMerge(concurrency) { }` starts an inner flow per value and merges their emissions as they arrive — the Flow way to do many slow calls at once, with a cap.

Because they finish in whatever order they finish, merged results are not in input order. If you need order, sort afterwards or use `flatMapConcat`.

## StateFlow

`MutableStateFlow(initial)` is a flow that always holds exactly one current value, readable through `.value` and observable by collecting. It is *hot*: it exists and holds its value whether anybody is collecting or not, which makes it the standard way to publish state.

```kotlin playground
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlin.system.measureTimeMillis

fun Flow<Int>.runningTotal(): Flow<Int> = flow {
    var sum = 0
    collect { sum += it; emit(sum) }
}

suspend fun load(id: Int): String {
    delay(100)
    return "ok-$id"
}

fun main() = runBlocking {
    val ticks = flow {
        for (i in 1..5) { emit(i); delay(10) }
    }

    println(ticks.map { it * it }.toList())
    println(ticks.filter { it % 2 == 1 }.toList())
    println(ticks.runningTotal().toList())
    println(ticks.first())

    println(flowOf("1", "2", "oops", "4").map { it.toInt() }.catch { emit(-1) }.toList())

    val log = mutableListOf<String>()
    flowOf("a", "b").onCompletion { log.add("done, cause=$it") }.collect { log.add("item $it") }
    println(log)

    val merged = measureTimeMillis {
        val out = (1..6).asFlow().flatMapMerge(concurrency = 3) { flow { emit(load(it)) } }.toList()
        println(out.sorted())
    }
    println("six 100ms loads, three at a time: ${merged}ms")

    val state = MutableStateFlow(0)
    state.value = 42
    println("state holds ${state.value} with no collector at all")
}
```

## Exercises

### 1. Make one and shape it

Three small pieces of a pipeline.

`squares(n)` emits `1, 4, 9, ...` up to and including `n * n`, in order. When `n` is zero or negative it emits nothing.

`evens(source)` passes through only the even values of another flow. `total(source)` collects a flow and returns the sum of its values; an empty flow totals 0.

```kotlin starter
import kotlinx.coroutines.flow.*

fun squares(n: Int): Flow<Int> = emptyFlow()

fun evens(source: Flow<Int>): Flow<Int> = source

suspend fun total(source: Flow<Int>): Int = 0
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class FlowBasicsTest {
    // squares counts up
    @Test
    fun squaring() {
        runBlocking {
            assertEquals(listOf(1, 4, 9, 16), squares(4).toList())
            assertEquals(listOf(1), squares(1).toList())
            assertEquals(emptyList<Int>(), squares(0).toList())
            assertEquals(emptyList<Int>(), squares(-3).toList())
        }
    }

    // evens filters
    @Test
    fun filtering() {
        runBlocking {
            assertEquals(listOf(2, 4, 6), evens(flowOf(1, 2, 3, 4, 5, 6)).toList())
            assertEquals(listOf(0, -2), evens(flowOf(0, -1, -2)).toList())
            assertEquals(emptyList<Int>(), evens(flowOf(1, 3, 5)).toList())
            assertEquals(emptyList<Int>(), evens(emptyFlow()).toList())
        }
    }

    // total adds everything up
    @Test
    fun totalling() {
        runBlocking {
            assertEquals(6, total(flowOf(1, 2, 3)))
            assertEquals(0, total(emptyFlow()))
            assertEquals(-4, total(flowOf(-10, 6)))
            assertEquals(7, total(flowOf(7)))
        }
    }

    // the three compose
    @Test
    fun together() {
        runBlocking {
            assertEquals(20, total(evens(squares(4))))
            assertEquals(0, total(evens(squares(1))))
            assertEquals(30, total(squares(4)))
        }
    }
}
```

#### Uses
- [Flow › Building a flow](#/flow/building-a-flow)
- [Flow › Intermediate operators](#/flow/intermediate-operators)
- [Flow › Terminal operators](#/flow/terminal-operators)

#### Hints
- `flow { for (i in 1..n) emit(i * i) }` covers `squares`, and an empty range emits nothing on its own.
- `evens` is one operator: `source.filter { it % 2 == 0 }`.
- `total` needs a terminal operator. `source.toList().sum()` works; `fold(0) { acc, v -> acc + v }` avoids building the list.

#### Tips
- Nothing in a flow runs until a terminal operator is called, so `squares(4)` on its own does no work at all.
- A flow is cold, so collecting the same flow twice runs the builder twice. Do not expect a `var` outside it to survive between collections.
- `toList().sum()` and `fold(0) { acc, v -> acc + v }` give the same answer; the `fold` never builds the intermediate list.

#### Docs
- [Asynchronous Flow](https://kotlinlang.org/docs/flow.html)

### 2. Two operators of your own

Write two extension functions on `Flow`.

`runningTotal()` emits the sum so far after each value: `1, 2, 3` becomes `1, 3, 6`. An empty flow stays empty.

`everyOther()` keeps the first value, drops the second, keeps the third, and so on — for any element type, not just numbers. A flow of one value emits that value.

```kotlin starter
import kotlinx.coroutines.flow.*

fun Flow<Int>.runningTotal(): Flow<Int> = this

fun <T> Flow<T>.everyOther(): Flow<T> = this
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class OperatorTest {
    // running totals
    @Test
    fun totals() {
        runBlocking {
            assertEquals(listOf(1, 3, 6), flowOf(1, 2, 3).runningTotal().toList())
            assertEquals(listOf(5, 5, 8), flowOf(5, 0, 3).runningTotal().toList())
            assertEquals(listOf(5), flowOf(5).runningTotal().toList())
            assertEquals(emptyList<Int>(), emptyFlow<Int>().runningTotal().toList())
        }
    }

    // negatives bring the total back down
    @Test
    fun negatives() {
        runBlocking {
            assertEquals(listOf(-1, -3, 0), flowOf(-1, -2, 3).runningTotal().toList())
            assertEquals(listOf(10, 0), flowOf(10, -10).runningTotal().toList())
        }
    }

    // every other value, starting with the first
    @Test
    fun alternating() {
        runBlocking {
            assertEquals(listOf(1, 3, 5), flowOf(1, 2, 3, 4, 5).everyOther().toList())
            assertEquals(listOf(1, 3), flowOf(1, 2, 3, 4).everyOther().toList())
            assertEquals(listOf(9), flowOf(9).everyOther().toList())
            assertEquals(emptyList<Int>(), emptyFlow<Int>().everyOther().toList())
        }
    }

    // it works on any element type
    @Test
    fun anyType() {
        runBlocking {
            assertEquals(listOf("a", "c"), flowOf("a", "b", "c").everyOther().toList())
            assertEquals(listOf(1, 4), flowOf(1, 2, 3).everyOther().runningTotal().toList())
        }
    }
}
```

#### Uses
- [Flow › Writing your own operator](#/flow/writing-your-own-operator)
- [Generics › Generic extension functions](#/generics/generic-extension-functions)

#### Hints
- Both are `flow { ... }` builders that `collect { }` the receiver and `emit` what they want to pass on.
- `runningTotal` keeps a `var sum = 0` outside the `collect` and emits it after adding each value.
- `everyOther` keeps a counter, or uses `withIndex().filter { it.index % 2 == 0 }.map { it.value }`.

#### Tips
- `runningReduce { a, b -> a + b }` in the standard library does what `runningTotal` does. Writing it once shows what an operator actually is.
- An operator is nothing but an extension function on `Flow<T>` that returns a flow, so yours sits beside the library's with no ceremony.
- A local `var` inside the `flow { }` builder is safe: a flow is collected by one coroutine at a time, in order.

#### Docs
- [Flow operators](https://kotlinlang.org/docs/flow.html#intermediate-flow-operators)

### 3. When a flow goes wrong

`toNumbers()` parses each string of a flow into an `Int`. At the first string that will not parse it emits `-1` and ends normally, so nothing is thrown at the collector and no later value is emitted.

`logged(log)` records what a flow does into the list it is given: `"item: <value>"` for every value, then `"done"` if the flow completed successfully or `"failed: <message>"` if it ended with an exception. It must not hide the failure — the exception still reaches the collector.

```kotlin starter
import kotlinx.coroutines.flow.*

fun Flow<String>.toNumbers(): Flow<Int> = emptyFlow()

fun <T> Flow<T>.logged(log: MutableList<String>): Flow<T> = this
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class FailureTest {
    // clean input parses straight through
    @Test
    fun parses() {
        runBlocking {
            assertEquals(listOf(1, 2, 3), flowOf("1", "2", "3").toNumbers().toList())
            assertEquals(listOf(-7, 0), flowOf("-7", "0").toNumbers().toList())
            assertEquals(emptyList<Int>(), emptyFlow<String>().toNumbers().toList())
        }
    }

    // a bad value ends the flow with -1
    @Test
    fun replacesFailure() {
        runBlocking {
            assertEquals(listOf(1, -1), flowOf("1", "x", "3").toNumbers().toList())
            assertEquals(listOf(-1), flowOf("nope", "2").toNumbers().toList())
            assertEquals(listOf(1, 2, -1), flowOf("1", "2", "").toNumbers().toList())
        }
    }

    // logging a flow that finishes
    @Test
    fun logsSuccess() {
        runBlocking {
            val log = mutableListOf<String>()
            assertEquals(listOf("a", "b"), flowOf("a", "b").logged(log).toList())
            assertEquals(listOf("item: a", "item: b", "done"), log)

            val empty = mutableListOf<String>()
            emptyFlow<String>().logged(empty).toList()
            assertEquals(listOf("done"), empty)
        }
    }

    // logging a flow that blows up, without swallowing it
    @Test
    fun logsFailure() {
        runBlocking {
            val log = mutableListOf<String>()
            val boom = flow { emit("a"); throw IllegalStateException("boom") }
            var escaped: String? = null
            try {
                boom.logged(log).toList()
            } catch (e: IllegalStateException) {
                escaped = e.message
            }
            assertEquals("boom", escaped)
            assertEquals(listOf("item: a", "failed: boom"), log)
        }
    }
}
```

#### Uses
- [Flow › Handling failures](#/flow/handling-failures)
- [Flow › Writing your own operator](#/flow/writing-your-own-operator)

#### Hints
- `toNumbers` is `map { it.toInt() }.catch { emit(-1) }`; `catch` sees the failure from `map` above it and turns it into a value.
- `logged` combines two operators: `onEach { log.add("item: $it") }` and `onCompletion { cause -> ... }`.
- In `onCompletion`, `cause` is `null` when the flow finished and the exception otherwise — `if (cause == null) "done" else "failed: ${cause.message}"`.

#### Tips
- `catch` only sees what happens upstream of it. Put it at the end of a chain and it covers the chain; put it first and it covers almost nothing.
- `catch` may `emit` a replacement value, and the flow then completes normally — which is why `[1, -1]` and not an exception.
- `onCompletion` runs either way and does **not** swallow the failure, so a `catch` placed after it still sees one.

#### Docs
- [Flow exceptions](https://kotlinlang.org/docs/flow.html#flow-exceptions)

### 4. Load them a few at a time

`loadAll(ids, concurrency)` loads every id in the incoming flow and returns the results as a list, with at most `concurrency` loads in flight at any moment. The tests provide `load`, which takes about 100ms.

Because the loads finish in whatever order they finish, the order of the returned list is not specified — the tests sort it. What is specified is the timing: six ids with a concurrency of six must overlap, and six ids with a concurrency of two must not all run at once.

```kotlin starter
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

suspend fun loadAll(ids: Flow<Int>, concurrency: Int): List<String> = emptyList()
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlin.system.measureTimeMillis

suspend fun load(id: Int): String {
    delay(100)
    return "ok-$id"
}

class LoadAllFlowTest {
    // one result per id
    @Test
    fun results() {
        runBlocking {
            assertEquals(listOf("ok-1", "ok-2", "ok-3"), loadAll(flowOf(1, 2, 3), 3).sorted())
            assertEquals(listOf("ok-5", "ok-5"), loadAll(flowOf(5, 5), 2).sorted())
            assertEquals(emptyList<String>(), loadAll(emptyFlow(), 4))
        }
    }

    // a wide limit runs them all together
    @Test
    fun wideOpen() {
        runBlocking {
            var out: List<String> = emptyList()
            val ms = measureTimeMillis { out = loadAll((1..6).asFlow(), 6) }
            assertEquals((1..6).map { "ok-$it" }, out.sorted())
            assertTrue("six 100ms loads with concurrency 6 took ${ms}ms; they should overlap", ms < 300)
        }
    }

    // a narrow limit holds them back
    @Test
    fun throttled() {
        runBlocking {
            var out: List<String> = emptyList()
            val ms = measureTimeMillis { out = loadAll((1..6).asFlow(), 2) }
            assertEquals((1..6).map { "ok-$it" }, out.sorted())
            assertTrue("six 100ms loads with concurrency 2 took ${ms}ms; at most two may run at once", ms >= 250)
            assertTrue("six 100ms loads with concurrency 2 took ${ms}ms; they were not merged", ms < 550)
        }
    }
}
```

#### Uses
- [Flow › Concurrency](#/flow/concurrency)
- [Flow › Terminal operators](#/flow/terminal-operators)
- [Coroutines › Limiting concurrency](#/coroutines/limiting-concurrency)

#### Hints
- `flatMapMerge` takes the cap as its first argument and a lambda that turns each value into a flow.
- The inner flow for one id is `flow { emit(load(it)) }`.
- Finish with a terminal operator: `.toList()`.

#### Tips
- `map { load(it) }` looks similar and is completely sequential: a flow processes one value at a time unless you explicitly merge.
- Merged results arrive in whatever order they finish, not input order. Sort afterwards, or use `flatMapConcat` when order matters more than speed.
- The `concurrency` argument is the cap, not the target: `flatMapMerge(3)` never has more than three inner flows running.

#### Docs
- [flatMapMerge](https://kotlinlang.org/docs/flow.html#flattening-flows)
