# Testing

A test is a program that runs your program and complains when the answer is wrong. Everything else — frameworks, runners, mocking libraries — is packaging. Kotlin on the JVM uses JUnit, and that is exactly what every exercise in this roadmap has been running: a class of `@Test` functions, `assertEquals`, `assertTrue`, and a runner that reports each one separately.

This module turns that around. Instead of writing code that a test checks, you write the small pieces a test suite is made of — comparisons, case tables, exception capture, and the fakes that make time and randomness behave.

## What a test is here

The runtime compiles your code together with the test block and hands it to JUnit. A test is a public class with a no-argument constructor and methods marked `@Test`:

```kotlin
class AdderTest {
    @Test
    fun addsTwoNumbers() {
        assertEquals(4, add(2, 2))
    }
}
```

A test passes by returning normally and fails by throwing. That is the whole protocol — an assertion is a function that throws when it does not like what it sees.

## assertEquals, expected first

`assertEquals(expected, actual)` takes the value you want first and the value you got second. The order does not change whether the test passes, but it does decide which value the failure message calls "expected", and a report that has them backwards costs real minutes.

```kotlin
assertEquals(listOf(1, 2), parse("1,2"))
```

It compares with `equals`, so data classes and collections compare by content. For `Double`, use the three-argument form with a tolerance — `assertEquals(0.3, sum, 1e-9)` — because floating point arithmetic does not land on exact values.

## assertTrue and a message

`assertTrue(message, condition)` is for conditions that are not an equality. Always pass the message: a bare `assertTrue` failure tells you nothing but a line number, and the message is what you will actually read at the top of a stack trace.

```kotlin
assertTrue("expected an empty result, got $result", result.isEmpty())
```

Prefer `assertEquals` where you can. "expected 3 but was 5" beats "the condition was false" every time.

## Testing that something throws

The failure path deserves as much attention as the happy one. Catch the exception, then assert on it:

```kotlin
try {
    parsePort("nope")
    throw AssertionError("expected a throw")
} catch (e: IllegalArgumentException) {
    assertEquals("not a number: nope", e.message)
}
```

The `throw AssertionError` line matters. Without it a test that never throws passes silently, which is the quietest way to test nothing at all.

## Arrange, act, assert

A readable test has three parts in order: build the inputs, call the thing once, check the result. When a test calls the function under test three times in three different ways, it is three tests wearing a coat, and when it fails you cannot tell which behaviour broke.

Name the function after the behaviour, not the method: `emptyInputGivesEmptyOutput` says more than `test3`.

## Table-driven cases

When one behaviour has many inputs, a table beats copy-paste. A list of input/expected pairs, one loop, and a message that says which row failed:

```kotlin
val cases = listOf("1" to 1, "-2" to -2, " 3 " to 3)
for ((input, expected) in cases) {
    assertEquals("input '$input'", expected, parse(input))
}
```

Adding a case is then one line, which is the difference between a suite that grows and one that does not.

## Fakes and the seam they need

A function that reads the clock, the network or a random number generator cannot be tested — it gives a different answer every run. The fix is always the same: name the dependency as an interface, take it as a parameter, and pass a predictable implementation in the test.

```kotlin
interface Clock { fun now(): Long }

class FakeClock(private var time: Long = 0) : Clock {
    override fun now() = time
    fun advance(by: Long) { time += by }
}
```

That interface is the seam. Production code passes the real clock; tests pass one they can move by hand, and a timeout that takes an hour in reality takes no time at all to test.

## What makes a test worth having

A test earns its place by failing when the code is wrong. That means covering the edges — empty, zero, negative, one element, duplicates, ties, the exact boundary — because the middle of the range is where bugs are not. A suite that a `return 0` could pass is a suite that tells you nothing.

```kotlin playground
interface Clock { fun now(): Long }

class FakeClock(private var time: Long = 0) : Clock {
    override fun now() = time
    fun advance(by: Long) { time += by }
}

class SessionTimer(private val clock: Clock, private val timeoutMs: Long) {
    private var last = clock.now()
    fun touch() { last = clock.now() }
    fun isExpired() = clock.now() - last >= timeoutMs
}

// A hand-rolled runner, so the playground can report like JUnit does.
fun <T> expectEquals(expected: T, actual: T): String =
    if (expected == actual) "PASS" else "FAIL: expected $expected but was $actual"

fun check(name: String, result: String) = println("${if (result == "PASS") "ok  " else "FAIL"} $name  $result")

fun main() {
    val clock = FakeClock(1_000)
    val timer = SessionTimer(clock, timeoutMs = 500)

    check("fresh session is alive", expectEquals(false, timer.isExpired()))
    clock.advance(499)
    check("just inside the timeout", expectEquals(false, timer.isExpired()))
    clock.advance(1)
    check("exactly at the timeout", expectEquals(true, timer.isExpired()))
    timer.touch()
    check("touching resets it", expectEquals(false, timer.isExpired()))

    val cases = listOf("1" to 1, "-2" to -2, " 3 " to 3, "x" to null)
    for ((input, expected) in cases) {
        check("parse '$input'", expectEquals(expected, input.trim().toIntOrNull()))
    }

    val thrown = try {
        listOf<Int>().first()
        "nothing was thrown"
    } catch (e: NoSuchElementException) {
        e::class.simpleName
    }
    check("first() on an empty list", expectEquals("NoSuchElementException", thrown))
}
```

## Exercises

### 1. An assertion of your own

`expectEquals(expected, actual)` returns `"PASS"` when the two values are equal, and otherwise `"FAIL: expected <expected> but was <actual>"` — expected first, as in every assertion library.

It works for any type, including `null` on either side, and compares by value, so two lists with the same contents are equal.

```kotlin starter
fun <T> expectEquals(expected: T, actual: T): String = "PASS"
```

```kotlin test
class ExpectTest {
    // equal values pass
    @Test
    fun passes() {
        assertEquals("PASS", expectEquals(3, 3))
        assertEquals("PASS", expectEquals("a", "a"))
        assertEquals("PASS", expectEquals(listOf(1, 2), listOf(1, 2)))
        assertEquals("PASS", expectEquals(null, null))
    }

    // different values report both sides
    @Test
    fun fails() {
        assertEquals("FAIL: expected 3 but was 4", expectEquals(3, 4))
        assertEquals("FAIL: expected a but was b", expectEquals("a", "b"))
        assertEquals("FAIL: expected [1, 2] but was [2, 1]", expectEquals(listOf(1, 2), listOf(2, 1)))
    }

    // nulls on either side
    @Test
    fun nulls() {
        assertEquals("FAIL: expected null but was a", expectEquals(null, "a"))
        assertEquals("FAIL: expected a but was null", expectEquals("a", null))
        assertEquals("PASS", expectEquals<String?>(null, null))
    }

    // empty and zero are values like any other
    @Test
    fun edges() {
        assertEquals("PASS", expectEquals(emptyList<Int>(), emptyList<Int>()))
        assertEquals("FAIL: expected [] but was [0]", expectEquals(emptyList<Int>(), listOf(0)))
        assertEquals("FAIL: expected 0 but was -0", expectEquals("0", "-0"))
    }
}
```

#### Uses
- [Testing › assertEquals, expected first](#/testing/assertequals-expected-first)
- [Generics › Generic functions](#/generics/generic-functions)

#### Hints
- `==` on any two values calls `equals`, and handles `null` on either side without a null check.
- A string template interpolates `null` as the text `null` and a list as `[1, 2]`, so `"FAIL: expected $expected but was $actual"` is already the right shape.
- The whole function is one `if` expression.

#### Tips
- `expectEquals<String?>(null, null)` spells out the type argument because there is nothing for the compiler to infer it from.
- `==` handles `null` on either side without a null check, so the comparison needs no guard.
- Keep the expected value first in your own message too. A helper whose message reads backwards is worse than no helper.

#### Docs
- [Equality](https://kotlinlang.org/docs/equality.html)

### 2. A table of cases

`runCases(cases, f)` applies `f` to each case's input and reports only the failures, in the order the cases were given. A failure reads `"<input>: expected <expected> but was <actual>"`. When every case passes, or there are no cases, the result is an empty list.

```kotlin starter
data class Case<I, O>(val input: I, val expected: O)

fun <I, O> runCases(cases: List<Case<I, O>>, f: (I) -> O): List<String> = emptyList()
```

```kotlin test
class CasesTest {
    // everything passing reports nothing
    @Test
    fun allPass() {
        val cases = listOf(Case(1, 2), Case(0, 0), Case(-3, -6))
        assertEquals(emptyList<String>(), runCases(cases) { it * 2 })
        assertEquals(emptyList<String>(), runCases(emptyList<Case<Int, Int>>()) { it })
    }

    // failures are reported, in order
    @Test
    fun someFail() {
        val cases = listOf(Case(1, 2), Case(2, 5), Case(3, 6), Case(4, 9))
        assertEquals(
            listOf("2: expected 5 but was 4", "4: expected 9 but was 8"),
            runCases(cases) { it * 2 }
        )
    }

    // every case can fail
    @Test
    fun allFail() {
        val cases = listOf(Case("a", "A"), Case("b", "B"))
        assertEquals(
            listOf("a: expected A but was a", "b: expected B but was b"),
            runCases(cases) { it }
        )
    }

    // inputs and outputs can be different types
    @Test
    fun mixedTypes() {
        val cases: List<Case<String, Int?>> = listOf(Case("1", 1), Case("x", 0), Case("", 5))
        assertEquals(
            listOf("x: expected 0 but was null", ": expected 5 but was null"),
            runCases(cases) { it.toIntOrNull() }
        )
    }
}
```

#### Uses
- [Testing › Table-driven cases](#/testing/table-driven-cases)
- [Generics › Generic functions](#/generics/generic-functions)

#### Hints
- `cases.mapNotNull { ... }` builds the failure list and drops the passing cases in one pass.
- For each case, compute `val actual = f(case.input)` once, then compare it with `case.expected`.
- The message needs all three values: `"${case.input}: expected ${case.expected} but was $actual"`.

#### Tips
- `Case` is a `data class`, so `Case(1, 2) == Case(1, 2)`, and a failing list prints readably in a test report.
- `mapNotNull` builds the failure list and drops the passing cases in one pass — return `null` for a pass and the message for a failure.
- The message has to name the input. A table that reports "expected 2 but was 3" without saying which row is a table you still have to debug by hand.

#### Docs
- [Higher-order functions](https://kotlinlang.org/docs/lambdas.html)

### 3. Catching the failure path

Two helpers for testing code that throws.

`catchMessage(block)` runs the block and returns the message of whatever it threw, or `null` if nothing was thrown. An exception with no message gives `null` too.

`expectThrows<E>(block)` returns `"PASS"` when the block throws an `E` — including any subclass of it — `"FAIL: nothing was thrown"` when it completes normally, and `"FAIL: threw <SimpleName>"` when it throws something else. It never lets an exception escape.

```kotlin starter
fun catchMessage(block: () -> Unit): String? = "nothing"

inline fun <reified E : Throwable> expectThrows(block: () -> Unit): String = "PASS"
```

```kotlin test
class ThrowsTest {
    // the message of whatever was thrown
    @Test
    fun messages() {
        assertEquals("boom", catchMessage { throw IllegalStateException("boom") })
        assertEquals("bad arg", catchMessage { require(false) { "bad arg" } })
        assertEquals(null, catchMessage { })
        assertEquals(null, catchMessage { val x = 1 + 1 })
    }

    // an exception with no message
    @Test
    fun noMessage() {
        assertEquals(null, catchMessage { throw IllegalStateException() })
        assertEquals(null, catchMessage { throw RuntimeException() })
        assertEquals("", catchMessage { throw IllegalStateException("") })
    }

    // the right type, or a subclass of it
    @Test
    fun rightType() {
        assertEquals("PASS", expectThrows<IllegalStateException> { throw IllegalStateException("x") })
        assertEquals("PASS", expectThrows<IllegalArgumentException> { require(false) })
        assertEquals("PASS", expectThrows<RuntimeException> { throw IllegalStateException("x") })
        assertEquals("PASS", expectThrows<Throwable> { throw AssertionError("x") })
    }

    // the wrong type, or nothing at all
    @Test
    fun wrongType() {
        assertEquals("FAIL: nothing was thrown", expectThrows<IllegalStateException> { })
        assertEquals("FAIL: nothing was thrown", expectThrows<Throwable> { listOf(1).first() })
        assertEquals(
            "FAIL: threw IllegalArgumentException",
            expectThrows<IllegalStateException> { require(false) }
        )
        assertEquals(
            "FAIL: threw NumberFormatException",
            expectThrows<IllegalStateException> { "x".toInt() }
        )
    }
}
```

#### Uses
- [Testing › Testing that something throws](#/testing/testing-that-something-throws)
- [Generics › reified type parameters](#/generics/reified-type-parameters)

#### Hints
- `catchMessage` is a `try` expression: run the block and return `null`, or `catch (e: Throwable) { e.message }`.
- In `expectThrows`, catch `Throwable`, then ask `if (e is E)` — legal only because `E` is `reified`, which is why the function is `inline`.
- Returning from the `try` block after the call is how you detect that nothing was thrown; `"FAIL: nothing was thrown"` is the value of the successful branch.

#### Tips
- `e is E` is true for subclasses too, which is why `expectThrows<RuntimeException>` accepts an `IllegalStateException`.
- The branch that runs when nothing was thrown is the one that matters. Leave it out and a function that never throws passes silently.
- `is E` needs `E` to be `reified`, and `reified` needs `inline`. That pair is the whole reason this function is written the way it is.

#### Docs
- [Exceptions](https://kotlinlang.org/docs/exceptions.html)

### 4. Faking the clock

`SessionTimer` expires when nothing has touched it for `timeoutMs`. Reading the real clock would make that untestable, so it takes a `Clock` and the test supplies a fake one.

A timer is created at the clock's current time. `isExpired()` is true once at least `timeoutMs` has passed since the last touch — exactly `timeoutMs` counts as expired. `touch()` restarts the count from the clock's current time, even if the timer had already expired.

`FakeClock` starts at whatever time it is given, returns it from `now()`, and moves forward by `advance(by)`.

```kotlin starter
interface Clock {
    fun now(): Long
}

class FakeClock(private var time: Long = 0L) : Clock {
    override fun now(): Long = 0L
    fun advance(by: Long) {}
}

class SessionTimer(private val clock: Clock, private val timeoutMs: Long) {
    fun touch() {}
    fun isExpired(): Boolean = false
}
```

```kotlin test
class TimerTest {
    // the fake clock only moves when told
    @Test
    fun fakeClock() {
        val clock = FakeClock(1_000)
        assertEquals(1_000L, clock.now())
        assertEquals(1_000L, clock.now())
        clock.advance(5)
        assertEquals(1_005L, clock.now())
        clock.advance(0)
        assertEquals(1_005L, clock.now())
        assertEquals(0L, FakeClock().now())
    }

    // the timeout boundary
    @Test
    fun expiry() {
        val clock = FakeClock(1_000)
        val timer = SessionTimer(clock, 500)
        assertTrue("a fresh timer has not expired", !timer.isExpired())
        clock.advance(499)
        assertTrue("one tick before the timeout", !timer.isExpired())
        clock.advance(1)
        assertTrue("exactly at the timeout it has expired", timer.isExpired())
        clock.advance(1_000)
        assertTrue("and it stays expired", timer.isExpired())
    }

    // touching restarts the count
    @Test
    fun touching() {
        val clock = FakeClock(0)
        val timer = SessionTimer(clock, 100)
        clock.advance(90)
        timer.touch()
        clock.advance(90)
        assertTrue("touching pushed the deadline out", !timer.isExpired())
        clock.advance(10)
        assertTrue("now it has expired", timer.isExpired())
        timer.touch()
        assertTrue("touching revives an expired timer", !timer.isExpired())
    }

    // it depends on the interface, not on FakeClock
    @Test
    fun anyClock() {
        var t = 0L
        val clock = object : Clock {
            override fun now(): Long = t
        }
        val timer = SessionTimer(clock, 10)
        t = 9
        assertTrue("not yet", !timer.isExpired())
        t = 10
        assertTrue("expired", timer.isExpired())
    }
}
```

#### Uses
- [Testing › Fakes and the seam they need](#/testing/fakes-and-the-seam-they-need)
- [Testing › What makes a test worth having](#/testing/what-makes-a-test-worth-having)

#### Hints
- `FakeClock` already stores `time`; `now()` returns it and `advance(by)` adds to it.
- `SessionTimer` needs one property: `private var last = clock.now()`, initialised when the timer is built.
- `isExpired()` is `clock.now() - last >= timeoutMs`, and `touch()` is `last = clock.now()`.

#### Tips
- Note what the last test proves: `SessionTimer` never mentions `FakeClock`. Depending on the interface is what lets the test choose the implementation.
- `isExpired()` uses `>=`, so the exact boundary counts as expired. Boundaries are where this kind of bug lives, and where the tests look.
- `last` is initialised from `clock.now()` at construction, not from zero — a timer built at time 1000 is not already an hour old.

#### Docs
- [Interfaces](https://kotlinlang.org/docs/interfaces.html)
