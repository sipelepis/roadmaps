# Exceptions & Result

Kotlin has exceptions, but no checked exceptions: nothing forces you to declare or catch anything, and `try` is an expression that produces a value. Alongside them the standard library offers `Result`, a value that is either a success or a failure, so a function can hand the caller a problem instead of unwinding the stack. And because `when` over a sealed type is exhaustive, a third option is always open — model the failures you actually expect as data.

The rule of thumb: throw for programmer error and genuinely exceptional conditions, return a value for failures the caller is expected to handle.

## Throwing and catching

`throw` takes any `Throwable`. `try`/`catch`/`finally` looks like Java's, and you can catch several types in sequence.

```kotlin
try {
    risky()
} catch (e: NumberFormatException) {
    println("bad number: ${e.message}")
} finally {
    cleanup()
}
```

`throw` has the type `Nothing`, the type with no values, which is why `val x = value ?: throw IllegalStateException("missing")` type-checks: the `throw` branch never produces anything for `x` to be.

## try is an expression

`try` produces a value — the last expression of the block that ran. That turns the usual four-line dance into one assignment.

```kotlin
val port = try {
    text.toInt()
} catch (e: NumberFormatException) {
    8080
}
```

A `finally` block runs either way but does not contribute to the value.

## require, check and error

Three standard functions cover almost every hand-written throw:

- `require(condition) { "message" }` throws `IllegalArgumentException` — for bad arguments.
- `check(condition) { "message" }` throws `IllegalStateException` — for an object in the wrong state.
- `error("message")` always throws `IllegalStateException`, and has type `Nothing`, so it works as the `else` of a `when`.

There are `requireNotNull` and `checkNotNull` too; both return the value, non-null, when it passes. The message is a lambda so the string is only built when the check actually fails.

## Your own exception types

An exception is a class that extends `Exception` (or `RuntimeException`). Give it whatever extra data the handler needs.

```kotlin
class ParseError(val index: Int, message: String) : Exception(message)
```

Catching it is catching a type, so a specific class is what lets a caller handle your failure without swallowing everyone else's.

## Result and runCatching

`Result<T>` holds either a value or a `Throwable`. `runCatching { ... }` runs a block and wraps the outcome, turning an exception-throwing API into a value-returning one.

```kotlin
val r: Result<Int> = runCatching { text.toInt() }
r.isSuccess          // Boolean
r.getOrNull()        // T?
r.exceptionOrNull()  // Throwable?
```

`runCatching` catches `Throwable`, which is broad. Reach for it at a boundary where you genuinely want to report anything that went wrong, not sprinkled through ordinary logic.

You can also build a `Result` by hand, which is what a function that decides for itself whether something failed returns:

```kotlin
Result.success(42)                                  // Success(42)
Result.failure<Int>(IllegalStateException("no"))    // a failure carrying that exception
```

`Result.failure` needs its type argument spelled out when there is no value to infer it from, as above.

## Working with a Result

A `Result` is transformed rather than unwrapped. `map` changes the success value and leaves a failure alone; `recover` does the opposite; `fold` collapses both sides into one value; `getOrElse` supplies a default from the exception; `getOrThrow` rethrows.

```kotlin
runCatching { text.toInt() }
    .map { it * 2 }
    .getOrElse { 0 }
```

The rest of the family, with what each one is for:

```kotlin
r.getOrThrow()                 // the value, rethrowing the failure
r.mapCatching { it / 0 }       // like map, but a throw inside becomes a failure
r.recover { -1 }               // turn a failure back into a success
r.onSuccess { }.onFailure { }  // side effects; both return the Result unchanged
r.fold({ "ok $it" }, { "err ${it.message}" })   // success lambda first, then failure
```

`map` and `mapCatching` differ in exactly one way: if your lambda throws, `map` lets the exception escape while `mapCatching` folds it into the `Result`. Reach for `mapCatching` when the transformation itself can fail.

## A sealed outcome instead

When the failures are known and few, they are data, not exceptions. A sealed type lists them, and `when` makes the compiler check that you handled each one.

```kotlin
sealed interface Outcome {
    data class Ok(val value: Int) : Outcome
    data class Failed(val reason: String) : Outcome
}
```

The cost is a type per operation; the benefit is that a new failure mode breaks every `when` that has not been updated, at compile time.

```kotlin playground
sealed interface Outcome {
    data class Ok(val value: Int) : Outcome
    data class Failed(val reason: String) : Outcome
}

class ParseError(val index: Int, message: String) : Exception(message)

fun parsePort(text: String): Int {
    val n = text.trim().toIntOrNull()
    require(n != null) { "not a number: ${text.trim()}" }
    require(n in 1..65535) { "port out of range: $n" }
    return n
}

fun readAge(text: String): Outcome {
    val n = text.trim().toIntOrNull() ?: return Outcome.Failed("not a number")
    return if (n in 0..150) Outcome.Ok(n) else Outcome.Failed("out of range")
}

fun main() {
    println(parsePort(" 8080 "))

    val fallback = try {
        parsePort("70000")
    } catch (e: IllegalArgumentException) {
        println("rejected: ${e.message}")
        80
    }
    println("using port $fallback")

    val doubled = runCatching { "21".toInt() }.map { it * 2 }
    println("doubled = ${doubled.getOrElse { -1 }}")
    println("broken  = ${runCatching { "x".toInt() }.map { it * 2 }.getOrElse { -1 }}")

    for (input in listOf("30", "-4", "old")) {
        val text = when (val o = readAge(input)) {
            is Outcome.Ok -> "age ${o.value}"
            is Outcome.Failed -> "rejected (${o.reason})"
        }
        println("$input -> $text")
    }

    println(runCatching { throw ParseError(2, "bad item at 2") }.exceptionOrNull()?.message)
}
```

## Exercises

### 1. Validate a port

`parsePort(text)` trims the text and returns it as a port number. It throws `IllegalArgumentException` when the text is not a whole number, with the message `"not a number: <trimmed text>"`, and when the number is outside `1..65535`, with the message `"port out of range: <n>"`. Note that 0 and 65536 are both rejected. Use `require` rather than a hand-written `throw`.

```kotlin starter
fun parsePort(text: String): Int {
    return 8080
}
```

```kotlin test
class PortTest {
    // accepts valid ports, trimming whitespace
    @Test
    fun accepts() {
        assertEquals(8080, parsePort("8080"))
        assertEquals(8080, parsePort("  8080  "))
        assertEquals(1, parsePort("1"))
        assertEquals(65535, parsePort("65535"))
        assertEquals(443, parsePort("443"))
    }

    // rejects text that is not a number
    @Test
    fun rejectsText() {
        for (bad in listOf("http", "", "  ", "80.5", "8o8o")) {
            try {
                parsePort(bad)
                throw AssertionError("expected a throw for '$bad'")
            } catch (e: IllegalArgumentException) {
                assertEquals("not a number: ${bad.trim()}", e.message)
            }
        }
    }

    // rejects numbers outside 1..65535
    @Test
    fun rejectsRange() {
        for (n in listOf(0, -1, 65536, 100000)) {
            try {
                parsePort(" $n ")
                throw AssertionError("expected a throw for $n")
            } catch (e: IllegalArgumentException) {
                assertEquals("port out of range: $n", e.message)
            }
        }
    }

    // the boundaries themselves are fine
    @Test
    fun boundaries() {
        assertEquals(1, parsePort("1"))
        assertEquals(65535, parsePort("65535"))
        assertEquals(2, parsePort("2"))
        assertEquals(65534, parsePort("65534"))
    }
}
```

#### Uses
- [Exceptions & Result › require, check and error](#/errors/require-check-and-error)
- [Exceptions & Result › Throwing and catching](#/errors/throwing-and-catching)

#### Hints
- `text.trim().toIntOrNull()` gives you a `Int?` without throwing, which is the easiest thing to `require` on.
- After `require(n != null) { ... }` the compiler smart-casts `n` to `Int` for the rest of the function.
- `require(n in 1..65535) { "port out of range: $n" }` reads exactly like the rule it enforces.

#### Tips
- The message lambda only runs when the check fails, so building a string there costs nothing on the happy path.
- After `require(n != null) { ... }` the compiler smart casts `n` to a plain `Int` below, which is why the range check needs no `!!`.
- `require` throws `IllegalArgumentException` and `check` throws `IllegalStateException`. Bad argument, bad state — pick by which one it is.

#### Docs
- [Preconditions](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/require.html)

### 2. A parse error of your own

`parseAll(items)` turns a list of strings into a list of ints. On the first item that is not a whole number it throws `ParseError` carrying that item's `index` and the message `"bad item at <index>: <item>"`. An empty list gives an empty list.

`parseAllOrEmpty(items)` returns the same list, but returns an empty list instead of throwing when a `ParseError` comes out. It must not swallow other exceptions. Write its body as a single `try` expression.

```kotlin starter
class ParseError(val index: Int, message: String) : Exception(message)

fun parseAll(items: List<String>): List<Int> {
    return items.map { 0 }
}

fun parseAllOrEmpty(items: List<String>): List<Int> {
    return emptyList()
}
```

```kotlin test
class ParseAllTest {
    // parses a whole list
    @Test
    fun happyPath() {
        assertEquals(listOf(1, 2, 3), parseAll(listOf("1", "2", "3")))
        assertEquals(listOf(-4, 0), parseAll(listOf("-4", "0")))
        assertEquals(emptyList<Int>(), parseAll(emptyList()))
    }

    // throws ParseError at the first bad item
    @Test
    fun reportsIndex() {
        try {
            parseAll(listOf("1", "2", "x", "y"))
            throw AssertionError("expected a throw")
        } catch (e: ParseError) {
            assertEquals(2, e.index)
            assertEquals("bad item at 2: x", e.message)
        }
        try {
            parseAll(listOf("nope"))
            throw AssertionError("expected a throw")
        } catch (e: ParseError) {
            assertEquals(0, e.index)
            assertEquals("bad item at 0: nope", e.message)
        }
    }

    // the forgiving version returns an empty list
    @Test
    fun forgiving() {
        assertEquals(listOf(7, 8), parseAllOrEmpty(listOf("7", "8")))
        assertEquals(emptyList<Int>(), parseAllOrEmpty(listOf("7", "x")))
        assertEquals(emptyList<Int>(), parseAllOrEmpty(listOf("x")))
        assertEquals(emptyList<Int>(), parseAllOrEmpty(emptyList()))
    }

    // other exceptions still escape
    @Test
    fun doesNotSwallowEverything() {
        try {
            parseAllOrEmpty(object : AbstractList<String>() {
                override val size = 1
                override fun get(index: Int): String = throw IllegalStateException("boom")
            })
            throw AssertionError("expected the IllegalStateException to escape")
        } catch (e: IllegalStateException) {
            assertEquals("boom", e.message)
        }
    }
}
```

#### Uses
- [Exceptions & Result › Your own exception types](#/errors/your-own-exception-types)
- [Exceptions & Result › try is an expression](#/errors/try-is-an-expression)

#### Hints
- `items.mapIndexed { i, s -> ... }` gives you the index you need for the error.
- Inside the lambda, `s.toIntOrNull() ?: throw ParseError(i, "bad item at $i: $s")` both parses and reports.
- `parseAllOrEmpty` is `try { parseAll(items) } catch (e: ParseError) { emptyList() }` — catching the one type keeps everything else escaping.

#### Tips
- `mapIndexed` is lazy about nothing: it walks the whole list, so the throw happens on the first bad item and the rest are never parsed.
- Catching your own exception type is what lets a caller handle your failure without swallowing everyone else's; `catch (e: Exception)` would also eat bugs.
- Give the exception the data the handler needs — here the index — rather than only a message the caller has to parse back out.

#### Docs
- [Exceptions](https://kotlinlang.org/docs/exceptions.html)

### 3. Results instead of throws

Three small functions over `Result`.

`divide(a, b)` returns a successful `Result` with `a / b`, or a failure holding the `ArithmeticException` that integer division by zero throws — do not test for zero yourself, let `runCatching` capture it.

`parseAndDouble(text)` trims, parses and doubles: `" 21 "` succeeds with 42, `"x"` fails.

`describe(r)` collapses a result into a string: `"ok: 42"` on success, `"error: ArithmeticException"` on failure — the exception's simple class name, not its message.

```kotlin starter
fun divide(a: Int, b: Int): Result<Int> = Result.success(0)

fun parseAndDouble(text: String): Result<Int> = Result.success(0)

fun describe(r: Result<Int>): String = "ok: 0"
```

```kotlin test
class ResultTest {
    // division succeeds and fails
    @Test
    fun division() {
        assertEquals(5, divide(10, 2).getOrNull())
        assertEquals(-3, divide(-9, 3).getOrNull())
        assertEquals(0, divide(1, 2).getOrNull())
        assertTrue("dividing by zero should fail", divide(1, 0).isFailure)
        assertTrue("and carry an ArithmeticException",
            divide(1, 0).exceptionOrNull() is ArithmeticException)
    }

    // parse then double
    @Test
    fun parsing() {
        assertEquals(42, parseAndDouble(" 21 ").getOrNull())
        assertEquals(0, parseAndDouble("0").getOrNull())
        assertEquals(-8, parseAndDouble("-4").getOrNull())
        assertTrue("letters fail", parseAndDouble("x").isFailure)
        assertTrue("empty fails", parseAndDouble("").isFailure)
    }

    // describe covers both sides
    @Test
    fun describing() {
        assertEquals("ok: 5", describe(divide(10, 2)))
        assertEquals("ok: 42", describe(parseAndDouble("21")))
        assertEquals("error: ArithmeticException", describe(divide(1, 0)))
        assertEquals("error: NumberFormatException", describe(parseAndDouble("x")))
    }

    // a result can be carried around before it is unwrapped
    @Test
    fun deferred() {
        val all = listOf(divide(8, 4), divide(1, 0), parseAndDouble("3"))
        assertEquals(listOf(2, 6), all.mapNotNull { it.getOrNull() })
        assertEquals(1, all.count { it.isFailure })
        assertEquals(listOf("ok: 2", "error: ArithmeticException", "ok: 6"), all.map { describe(it) })
    }
}
```

#### Uses
- [Exceptions & Result › Result and runCatching](#/errors/result-and-runcatching)
- [Exceptions & Result › Working with a Result](#/errors/working-with-a-result)

#### Hints
- `divide(a, b) = runCatching { a / b }` is the whole function.
- `parseAndDouble` chains: `runCatching { text.trim().toInt() }.map { it * 2 }`.
- `describe` is a `fold`: `r.fold({ "ok: $it" }, { "error: ${it::class.simpleName}" })` — the first lambda gets the value, the second the exception.

#### Tips
- `it::class.simpleName` is the short class name of any object; on `NumberFormatException` it is exactly `"NumberFormatException"`.
- In `fold`, the success lambda comes first and the failure lambda second — the opposite order from `getOrElse`, which only takes the failure one.
- `runCatching` catches `Throwable`, which is very broad. It belongs at a boundary, not sprinkled through ordinary logic.

#### Docs
- [Result](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/)

### 4. Failures as data

Model reading an age as a sealed `Outcome` instead of an exception.

`readAge(text)` trims the text and returns `Outcome.Ok(n)` when it is a whole number in `0..150`, `Outcome.Failed("not a number")` when it does not parse at all, and `Outcome.Failed("out of range")` otherwise. The boundaries 0 and 150 are accepted.

`summarize(list)` reports on a batch: `"2 ok, 1 failed"`, always with both halves, even when one of them is zero. `oldest(list)` returns the largest accepted age, or `null` when nothing was accepted.

```kotlin starter
sealed interface Outcome {
    data class Ok(val value: Int) : Outcome
    data class Failed(val reason: String) : Outcome
}

fun readAge(text: String): Outcome = Outcome.Ok(0)

fun summarize(list: List<Outcome>): String = "0 ok, 0 failed"

fun oldest(list: List<Outcome>): Int? = null
```

```kotlin test
class OutcomeTest {
    // accepts ages in range
    @Test
    fun accepts() {
        assertEquals(Outcome.Ok(30), readAge("30"))
        assertEquals(Outcome.Ok(30), readAge("  30 "))
        assertEquals(Outcome.Ok(0), readAge("0"))
        assertEquals(Outcome.Ok(150), readAge("150"))
    }

    // distinguishes the two failures
    @Test
    fun rejects() {
        assertEquals(Outcome.Failed("not a number"), readAge("old"))
        assertEquals(Outcome.Failed("not a number"), readAge(""))
        assertEquals(Outcome.Failed("not a number"), readAge("12.5"))
        assertEquals(Outcome.Failed("out of range"), readAge("-1"))
        assertEquals(Outcome.Failed("out of range"), readAge("151"))
    }

    // summarize counts both kinds
    @Test
    fun summary() {
        val list = listOf(readAge("30"), readAge("x"), readAge("41"))
        assertEquals("2 ok, 1 failed", summarize(list))
        assertEquals("0 ok, 0 failed", summarize(emptyList()))
        assertEquals("1 ok, 0 failed", summarize(listOf(readAge("7"))))
        assertEquals("0 ok, 2 failed", summarize(listOf(readAge("-5"), readAge("y"))))
    }

    // oldest ignores failures and empty input
    @Test
    fun max() {
        assertEquals(41, oldest(listOf(readAge("30"), readAge("x"), readAge("41"))))
        assertEquals(0, oldest(listOf(readAge("0"), readAge("-9"))))
        assertEquals(null, oldest(listOf(readAge("x"), readAge("200"))))
        assertEquals(null, oldest(emptyList()))
    }
}
```

#### Uses
- [Exceptions & Result › A sealed outcome instead](#/errors/a-sealed-outcome-instead)

#### Hints
- `readAge` can return early: `val n = text.trim().toIntOrNull() ?: return Outcome.Failed("not a number")`.
- `list.filterIsInstance<Outcome.Ok>()` narrows a list to just the successes, which makes both `summarize` and `oldest` short.
- `maxOfOrNull { it.value }` returns `null` for an empty list, which is exactly what `oldest` promises.

#### Tips
- Because `Outcome` is sealed, a `when (o)` covering `Ok` and `Failed` needs no `else`, and adding a third case later turns every such `when` into a compile error — which is the point.
- `filterIsInstance<Outcome.Ok>()` narrows the list and smart casts in one step, so `it.value` compiles afterwards.
- Modelling the failures as data costs a type per operation and buys a compiler that walks you through every call site when the list of failures grows.

#### Docs
- [Sealed classes and interfaces](https://kotlinlang.org/docs/sealed-classes.html)
