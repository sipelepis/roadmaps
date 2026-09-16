# Practice problems

This module is practice only: twelve self-contained problems of the kind that turn up in interviews, scripts and code review. Nothing new is taught here. The point is fluency — collections, sealed types, generics, `Result`, coroutines and Flow working together without your having to stop and look anything up.

They are roughly in order of difficulty, but not of topic: the last four lean on coroutines and Flow, the middle ones on generics and sealed types, the first few on nothing but the standard library.

## How to work through these

Read the tests before you write anything. They are the specification, they show the exact types, and they contain the edge cases the description promises. If a test surprises you, the description says why.

Get it working first with the obvious loop and a `mutableListOf`. Then look for the version the standard library already has: `groupingBy().eachCount()`, `zipWithNext`, `sortedWith`, `fold`, `mapNotNull`. Shorter is not automatically better, but in Kotlin it usually is.

`println` output from a failing test shows up in its result, which is the fastest way to see what your code actually did.

## What you can reach for

Everything in the roadmap so far, and nothing else — no third-party libraries. The pieces these problems want most often:

- **Collections**: `map`, `filter`, `mapNotNull`, `groupingBy`, `sortedWith`, `compareBy`, `zipWithNext`, `chunked`, `associate`, `fold`, `sumOf`, `maxByOrNull`, `takeWhile`.
- **Strings**: `split`, `trim`, `substringBefore`, `lowercase`, `toIntOrNull`, `isLetter`, `buildString`, `repeat`.
- **Types**: sealed interfaces with `when`, `data class`, `Comparable`, generic functions with `<T : Comparable<T>>`, `reified`.
- **Failures**: `require`, `runCatching`, `Result.map` and `fold`.
- **Concurrency**: `coroutineScope`, `async`/`awaitAll`, `Semaphore.withPermit`, `withTimeoutOrNull`, `flow { }`, `collect`, `emit`.

## A warm-up

The playground below solves a thirteenth problem — two sum — to show the shape a solution takes here: a `Map` from value to index, one pass, `null` for "not found". Edit it freely; it is scratch space.

```kotlin playground
/** Indices of the two values that add up to [target], or null. */
fun twoSum(numbers: List<Int>, target: Int): Pair<Int, Int>? {
    val seen = mutableMapOf<Int, Int>()
    numbers.forEachIndexed { i, n ->
        seen[target - n]?.let { return it to i }
        seen.putIfAbsent(n, i)
    }
    return null
}

fun main() {
    println(twoSum(listOf(2, 7, 11, 15), 9))   // (0, 1)
    println(twoSum(listOf(3, 2, 4), 6))        // (1, 2)
    println(twoSum(listOf(1, 2), 10))          // null
    println(twoSum(listOf(5, 5), 10))          // (0, 1)

    check(twoSum(listOf(0, 0), 0) == 0 to 1)
    println("all checks passed")
}
```

## Exercises

### 1. Top words

`topWords(text, k)` returns the `k` most frequent words with their counts. A word is a run of letters — anything that is not a letter separates words — and words are compared in lowercase. Sort by count, highest first, and break ties alphabetically. If there are fewer than `k` distinct words, return them all; `k` of 0 returns nothing.

```kotlin starter
fun topWords(text: String, k: Int): List<Pair<String, Int>> = emptyList()
```

```kotlin test
class TopWordsTest {
    // most frequent first
    @Test
    fun ranking() {
        val text = "The cat and the hat. The END, the end!"
        assertEquals(listOf("the" to 4, "end" to 2, "and" to 1), topWords(text, 3))
        assertEquals(listOf("a" to 3, "b" to 2), topWords("a b c a b a", 2))
    }

    // ties are broken alphabetically
    @Test
    fun ties() {
        assertEquals(listOf("a" to 1, "b" to 1), topWords("c b a", 2))
        assertEquals(listOf("y" to 2, "z" to 2, "x" to 1), topWords("z y y x z", 3))
    }

    // fewer words than asked for, or none at all
    @Test
    fun shortages() {
        assertEquals(listOf("b" to 2, "a" to 1), topWords("b a b", 10))
        assertEquals(emptyList<Pair<String, Int>>(), topWords("...", 2))
        assertEquals(emptyList<Pair<String, Int>>(), topWords("a b c", 0))
        assertEquals(emptyList<Pair<String, Int>>(), topWords("", 5))
    }

    // anything that is not a letter separates words
    @Test
    fun separators() {
        assertEquals(listOf("one" to 2, "two" to 1), topWords("one2two3one", 5))
        assertEquals(listOf("a" to 2), topWords("a---a", 1))
        assertEquals(listOf("don" to 1, "t" to 1), topWords("don't", 2))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Variables & types › Character tests](#/basics/character-tests)
- [Collection operations › Grouping and partitioning](#/collection-ops/grouping-and-partitioning)

#### Hints
- To split on anything that is not a letter, replace every non-letter with a space and split on that: `text.lowercase().map { if (it.isLetter()) it else ' ' }.joinToString("").split(" ").filter { it.isNotEmpty() }`.
- Count with `groupingBy { it }.eachCount()`, which gives a `Map<String, Int>`.
- Sort the entries with `sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })`, then `take(k)`.

#### Tips
- A map has no defined order, so the sort has to settle every tie. Leave a tie unresolved and the answer can change between runs.
- Splitting leaves empty strings wherever two separators meet; filter them out before counting or `""` becomes your most common word.
- `take(k)` on a list shorter than `k` returns the whole list rather than throwing, so a small input needs no guard.

#### Docs
- [Grouping](https://kotlinlang.org/docs/collection-grouping.html)

### 2. Balanced brackets

`balanced(text)` returns true when every `(`, `[` and `{` is closed by the matching bracket in the right order. Every other character is ignored, so text with no brackets at all is balanced, and so is an empty string.

```kotlin starter
fun balanced(text: String): Boolean = true
```

```kotlin test
class BalancedTest {
    // properly nested
    @Test
    fun nested() {
        assertTrue("simple pair", balanced("()"))
        assertTrue("nested", balanced("(a[b]{c})"))
        assertTrue("sequence", balanced("{}[]()"))
        assertTrue("deep", balanced("((((()))))"))
    }

    // unclosed or unopened
    @Test
    fun unmatched() {
        assertTrue("open only", !balanced("("))
        assertTrue("close only", !balanced(")"))
        assertTrue("closed first", !balanced(")("))
        assertTrue("one left open", !balanced("(()"))
    }

    // the wrong closer
    @Test
    fun crossed() {
        assertTrue("mismatched pair", !balanced("(]"))
        assertTrue("interleaved", !balanced("([)]"))
        assertTrue("wrong closer at depth", !balanced("{[}]"))
    }

    // anything else is ignored
    @Test
    fun ignoresOtherCharacters() {
        assertTrue("empty", balanced(""))
        assertTrue("no brackets", balanced("plain text"))
        assertTrue("brackets in prose", balanced("a (quoted [aside]) here"))
        assertTrue("angle brackets are not brackets", balanced("<>"))
    }
}
```

#### Uses
- [Practice problems › How to work through these](#/practice/how-to-work-through-these)

#### Hints
- A `MutableList<Char>` used as a stack is all the state you need: `addLast`/`removeLast`, or `add` and `removeLastOrNull`.
- On an opener, push the closer you expect. On a closer, it must equal what you pop.
- The string is balanced only if you never hit a mismatch *and* the stack is empty at the end.

#### Tips
- `"([{".indexOf(c)` and `")]}"[i]` is one way to pair them up without a `when`.
- Push the closer you *expect*, not the opener you saw. Then a closing bracket is one equality check instead of a lookup.
- Both failure modes have to be caught: a mismatch in the middle, and a non-empty stack at the end. Checking only one of them passes half the tests.

### 3. Run-length coding

`encode(text)` replaces each run of identical characters with the character and the length of the run: `"aaabbc"` becomes `"a3b2c1"`. Every run gets a count, including a run of one, and counts of ten or more are written in full.

`decode(text)` is the inverse, and reads multi-digit counts. Both return an empty string for empty input, and `decode(encode(s)) == s` for any text of letters.

```kotlin starter
fun encode(text: String): String = text

fun decode(text: String): String = text
```

```kotlin test
class RunLengthTest {
    // encoding runs
    @Test
    fun encoding() {
        assertEquals("a3b2c1", encode("aaabbc"))
        assertEquals("a1", encode("a"))
        assertEquals("a1b1a1b1", encode("abab"))
        assertEquals("", encode(""))
    }

    // counts of ten or more
    @Test
    fun longRuns() {
        assertEquals("a12", encode("a".repeat(12)))
        assertEquals("x100y1", encode("x".repeat(100) + "y"))
        assertEquals("a".repeat(12), decode("a12"))
    }

    // decoding
    @Test
    fun decoding() {
        assertEquals("aaabbc", decode("a3b2c1"))
        assertEquals("a", decode("a1"))
        assertEquals("", decode(""))
        assertEquals("abab", decode("a1b1a1b1"))
    }

    // round trip
    @Test
    fun roundTrip() {
        for (s in listOf("", "a", "aa", "abc", "aaabbbccc", "z".repeat(25), "mississippi")) {
            assertEquals(s, decode(encode(s)))
        }
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Variables & types › Character tests](#/basics/character-tests)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)

#### Hints
- `buildString { ... }` gives you a builder to `append` into and returns the finished string.
- For encoding, walk the string keeping the current character and how many of it you have seen; flush when it changes and once more at the end.
- For decoding, read a letter, then take digits with `takeWhile { it.isDigit() }` until the next letter, and `append(ch.toString().repeat(count))`.

#### Tips
- `s.repeat(n)` is in the standard library, and `n` of 0 gives an empty string.
- A run can be longer than nine, so read digits until the next letter rather than taking exactly one character.
- Flush the final run after the loop ends. Forgetting that last flush is what drops the tail of every encoded string.

### 4. Roman numerals

`toRoman(n)` writes a number from 1 to 3999 the Roman way, using the subtractive forms: 4 is `IV`, 9 is `IX`, 40 is `XL`, 90 is `XC`, 400 is `CD`, 900 is `CM`. `fromRoman(text)` reads one back. You may assume the input to each is valid.

```kotlin starter
fun toRoman(n: Int): String = ""

fun fromRoman(text: String): Int = 0
```

```kotlin test
class RomanTest {
    // the plain cases
    @Test
    fun simple() {
        assertEquals("I", toRoman(1))
        assertEquals("III", toRoman(3))
        assertEquals("VIII", toRoman(8))
        assertEquals("XXVII", toRoman(27))
        assertEquals("MMXXV", toRoman(2025))
    }

    // the subtractive forms
    @Test
    fun subtractive() {
        assertEquals("IV", toRoman(4))
        assertEquals("IX", toRoman(9))
        assertEquals("XL", toRoman(40))
        assertEquals("XC", toRoman(90))
        assertEquals("CD", toRoman(400))
        assertEquals("CM", toRoman(900))
        assertEquals("MCMXCIV", toRoman(1994))
        assertEquals("MMMCMXCIX", toRoman(3999))
    }

    // reading them back
    @Test
    fun reading() {
        assertEquals(1, fromRoman("I"))
        assertEquals(4, fromRoman("IV"))
        assertEquals(27, fromRoman("XXVII"))
        assertEquals(1994, fromRoman("MCMXCIV"))
        assertEquals(3999, fromRoman("MMMCMXCIX"))
    }

    // every number in range survives a round trip
    @Test
    fun roundTrip() {
        for (n in 1..3999) {
            assertEquals(n, fromRoman(toRoman(n)))
        }
        assertEquals("I", toRoman(fromRoman("I")))
    }
}
```

#### Uses
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)

#### Hints
- Keep the pairs in descending order — 1000 to `M`, 900 to `CM`, 500 to `D`, … 4 to `IV`, 1 to `I` — and greedily subtract the largest that fits.
- Reading is the classic trick: add each letter's value, but subtract instead when the letter to its right is worth more.
- `"MCMXCIV".zipWithNext()` gives you each letter with the one after it, which is exactly the comparison the rule needs; the last letter is always added.

#### Tips
- The round-trip test covers all 3999 values, so a rule that only works for the examples will not survive it.
- Put the six subtractive pairs — 900, 400, 90, 40, 9, 4 — in the same descending table as the plain values, and the greedy loop needs no special cases at all.
- `zipWithNext()` leaves the last letter out of the pairs, which is why it is always added rather than compared.

### 5. An expression tree

`Expr` is a sealed interface: a number, or an addition, multiplication or division of two sub-expressions.

`eval(e)` computes the value as a `Result<Int>`, with integer division. Dividing by zero is a failure carrying the `ArithmeticException`, and a failure anywhere in the tree makes the whole evaluation a failure.

`show(e)` renders the expression fully parenthesised, with spaces around every operator: `Add(Num(1), Mul(Num(2), Num(3)))` shows as `"(1 + (2 * 3))"`, and a bare `Num(5)` as `"5"`.

```kotlin starter
sealed interface Expr {
    data class Num(val value: Int) : Expr
    data class Add(val left: Expr, val right: Expr) : Expr
    data class Mul(val left: Expr, val right: Expr) : Expr
    data class Div(val left: Expr, val right: Expr) : Expr
}

fun eval(e: Expr): Result<Int> = Result.success(0)

fun show(e: Expr): String = ""
```

```kotlin test
class ExprTest {
    private val one = Expr.Num(1)
    private val two = Expr.Num(2)
    private val three = Expr.Num(3)

    // arithmetic
    @Test
    fun values() {
        assertEquals(5, eval(Expr.Num(5)).getOrNull())
        assertEquals(3, eval(Expr.Add(one, two)).getOrNull())
        assertEquals(7, eval(Expr.Add(one, Expr.Mul(two, three))).getOrNull())
        assertEquals(0, eval(Expr.Mul(Expr.Num(0), three)).getOrNull())
        assertEquals(-4, eval(Expr.Add(Expr.Num(-6), two)).getOrNull())
    }

    // integer division, and division by zero
    @Test
    fun division() {
        assertEquals(3, eval(Expr.Div(Expr.Num(7), two)).getOrNull())
        assertEquals(0, eval(Expr.Div(one, Expr.Num(5))).getOrNull())
        val bad = eval(Expr.Div(one, Expr.Num(0)))
        assertTrue("dividing by zero should fail", bad.isFailure)
        assertTrue("with an ArithmeticException", bad.exceptionOrNull() is ArithmeticException)
    }

    // a failure deep in the tree sinks the whole thing
    @Test
    fun propagates() {
        val e = Expr.Add(Expr.Num(100), Expr.Mul(two, Expr.Div(one, Expr.Num(0))))
        assertTrue("the whole expression fails", eval(e).isFailure)
        assertEquals(null, eval(e).getOrNull())
        assertTrue("a healthy tree still succeeds",
            eval(Expr.Add(Expr.Num(100), Expr.Mul(two, Expr.Div(Expr.Num(6), three)))).isSuccess)
    }

    // rendering
    @Test
    fun rendering() {
        assertEquals("5", show(Expr.Num(5)))
        assertEquals("(1 + 2)", show(Expr.Add(one, two)))
        assertEquals("(1 + (2 * 3))", show(Expr.Add(one, Expr.Mul(two, three))))
        assertEquals("((1 / 2) * 3)", show(Expr.Mul(Expr.Div(one, two), three)))
        assertEquals("-7", show(Expr.Num(-7)))
    }
}
```

#### Uses
- [Exceptions & Result › A sealed outcome instead](#/errors/a-sealed-outcome-instead)
- [Exceptions & Result › Working with a Result](#/errors/working-with-a-result)

#### Hints
- Both functions are a `when (e)` over the four cases, calling themselves on the sub-expressions. Because `Expr` is sealed, no `else` is needed.
- `runCatching { ... }` around the arithmetic turns the division by zero into a failure without your testing for it.
- Combining two results: `eval(e.left).mapCatching { l -> l + eval(e.right).getOrThrow() }` keeps the failure of either side.

#### Tips
- `show` has no failure case at all, which is the tell that rendering and evaluating are two different jobs over the same tree.
- `Result.success(...)` is how a branch that cannot fail still returns the same type as one that can.
- A division by zero deep in the tree has to reach the top unchanged. Combine with `mapCatching`/`getOrThrow` rather than unwrapping with `getOrNull()`, which loses which side failed.

#### Docs
- [Sealed classes](https://kotlinlang.org/docs/sealed-classes.html)

### 6. Memoize anything

`memoize(f)` returns a function that behaves exactly like `f` but calls it at most once for each distinct argument, remembering the result for later calls.

It must cache a `null` result too: if `f` returns `null` for some key, asking again must not call `f` a second time.

```kotlin starter
fun <K, V> memoize(f: (K) -> V): (K) -> V = f
```

```kotlin test
class MemoizeTest {
    // the same answers as the original
    @Test
    fun sameResults() {
        val double = memoize<Int, Int> { it * 2 }
        assertEquals(4, double(2))
        assertEquals(0, double(0))
        assertEquals(-6, double(-3))
        assertEquals(4, double(2))
    }

    // each distinct key costs one call
    @Test
    fun callsOnce() {
        var calls = 0
        val f = memoize<Int, Int> { calls++; it * it }
        assertEquals(9, f(3))
        assertEquals(9, f(3))
        assertEquals(9, f(3))
        assertEquals(1, calls)
        assertEquals(16, f(4))
        assertEquals(2, calls)
        assertEquals(9, f(3))
        assertEquals(2, calls)
    }

    // null results are cached as well
    @Test
    fun cachesNull() {
        var calls = 0
        val f = memoize<Int, String?> { calls++; if (it < 0) null else "n$it" }
        assertEquals(null, f(-1))
        assertEquals(null, f(-1))
        assertEquals(1, calls)
        assertEquals("n2", f(2))
        assertEquals(2, calls)
        assertEquals(null, f(-1))
        assertEquals(2, calls)
    }

    // any key type
    @Test
    fun otherKeys() {
        var calls = 0
        val length = memoize<String, Int> { calls++; it.length }
        assertEquals(3, length("abc"))
        assertEquals(3, length("abc"))
        assertEquals(0, length(""))
        assertEquals(0, length(""))
        assertEquals(2, calls)
    }
}
```

#### Uses
- [Generics › Generic functions](#/generics/generic-functions)
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Collections › Maps](#/collections/maps)
- [Lambdas › Closures](#/lambdas/closures)

#### Hints
- The returned lambda closes over a `mutableMapOf<K, V>()` created once, before the lambda.
- `cache[key] ?: f(key)` looks right and is the bug the null test catches — a cached `null` is indistinguishable from a missing key.
- `if (key in cache) cache.getValue(key) else f(key).also { cache[key] = it }` asks the right question, and `getOrPut` does not, for the same reason.

#### Tips
- The cache is not synchronised, so this is a single-threaded memoizer. Say so in a comment and you have written the same caveat every real implementation carries.
- `key in cache` is the only question that distinguishes a cached `null` from a missing key. `cache[key] ?: f(key)` and `getOrPut` both get it wrong, in the same way.
- The map has to be created outside the returned lambda; create it inside and every call starts with an empty cache.

### 7. Version numbers

`Version` holds three numbers and sorts the way software versions do: by major, then minor, then patch. `toString()` renders it as `"1.2.3"`.

`Version.parse(text)` returns a `Version`, or `null` when the text is not exactly three non-negative whole numbers separated by dots — `"1.2"`, `"1.2.3.4"`, `"1.2.x"` and `""` are all `null`.

```kotlin starter
class Version(val major: Int, val minor: Int, val patch: Int) : Comparable<Version> {
    override fun compareTo(other: Version): Int = 0

    override fun toString(): String = ""

    companion object {
        fun parse(text: String): Version? = null
    }
}
```

```kotlin test
class VersionTest {
    // rendering
    @Test
    fun rendering() {
        assertEquals("1.2.3", Version(1, 2, 3).toString())
        assertEquals("0.0.0", Version(0, 0, 0).toString())
        assertEquals("10.20.30", Version(10, 20, 30).toString())
    }

    // ordering by each part in turn
    @Test
    fun ordering() {
        assertTrue("major wins", Version(2, 0, 0) > Version(1, 9, 9))
        assertTrue("then minor", Version(1, 2, 0) > Version(1, 1, 9))
        assertTrue("then patch", Version(1, 1, 2) > Version(1, 1, 1))
        assertEquals(0, Version(1, 2, 3).compareTo(Version(1, 2, 3)))
        assertTrue("smaller is smaller", Version(1, 0, 0) < Version(1, 0, 1))
    }

    // sorting a list
    @Test
    fun sorting() {
        val list = listOf(Version(1, 10, 0), Version(1, 2, 0), Version(0, 9, 9), Version(1, 2, 1))
        assertEquals(listOf("0.9.9", "1.2.0", "1.2.1", "1.10.0"), list.sorted().map { it.toString() })
        assertEquals("1.10.0", list.max().toString())
        assertEquals("0.9.9", list.min().toString())
    }

    // parsing, including what should not parse
    @Test
    fun parsing() {
        assertEquals("1.2.3", Version.parse("1.2.3").toString())
        assertEquals("0.0.1", Version.parse("0.0.1").toString())
        assertEquals(null, Version.parse("1.2"))
        assertEquals(null, Version.parse("1.2.3.4"))
        assertEquals(null, Version.parse("1.2.x"))
        assertEquals(null, Version.parse(""))
        assertEquals(null, Version.parse("1..3"))
        assertEquals(null, Version.parse("-1.0.0"))
    }
}
```

#### Uses
- [Generics › Upper bounds](#/generics/upper-bounds)
- [Interfaces & delegation › Declaring an interface](#/interfaces/declaring-an-interface)
- [Collection operations › Sorting](#/collection-ops/sorting)

#### Hints
- `compareTo` can chain: `compareValuesBy(this, other, { it.major }, { it.minor }, { it.patch })`.
- Implementing `Comparable<Version>` is what makes `<`, `>`, `sorted()`, `max()` and `min()` work — they are all defined in terms of `compareTo`.
- `parse` splits on `"."`, checks there are exactly three parts, and maps each with `toIntOrNull()`; if any part is `null` or negative, the whole thing is `null`.

#### Tips
- `"1..3".split(".")` gives `["1", "", "3"]`, and `"".toIntOrNull()` is `null`, so the empty middle part is rejected without a special case.
- `compareValuesBy` returns the `Int` that `compareTo` is defined to return: negative, zero or positive. You never need to produce `-1` and `1` by hand.
- Implementing `Comparable<Version>` is what makes `<`, `sorted()`, `maxOrNull()` and `coerceIn` all start working at once.

### 8. Map a list in parallel

`parallelMap(limit, f)` applies a suspending function to every element of a list, running at most `limit` of them at a time, and returns the results in the order of the original list.

The tests use a `f` that waits 100ms, and they time a batch of six: with a limit of six the calls must overlap, and with a limit of two they must not all run at once.

```kotlin starter
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

suspend fun <T, R> List<T>.parallelMap(limit: Int, f: suspend (T) -> R): List<R> = emptyList()
```

```kotlin test
import kotlinx.coroutines.*
import kotlin.system.measureTimeMillis

class ParallelMapTest {
    // results in input order
    @Test
    fun ordered() {
        runBlocking {
            assertEquals(listOf(6, 2, 4), listOf(3, 1, 2).parallelMap(2) { delay(10); it * 2 })
            assertEquals(listOf("a!"), listOf("a").parallelMap(1) { "$it!" })
            assertEquals(emptyList<Int>(), emptyList<Int>().parallelMap(3) { it })
        }
    }

    // a wide limit runs them together
    @Test
    fun overlapping() {
        runBlocking {
            var out: List<Int> = emptyList()
            val ms = measureTimeMillis { out = (1..6).toList().parallelMap(6) { delay(100); it * 10 } }
            assertEquals(listOf(10, 20, 30, 40, 50, 60), out)
            assertTrue("six 100ms calls with limit 6 took ${ms}ms; they should overlap", ms < 300)
        }
    }

    // a narrow limit holds them back
    @Test
    fun throttled() {
        runBlocking {
            var out: List<Int> = emptyList()
            val ms = measureTimeMillis { out = (1..6).toList().parallelMap(2) { delay(100); it } }
            assertEquals((1..6).toList(), out)
            assertTrue("six 100ms calls with limit 2 took ${ms}ms; at most two may run at once", ms >= 250)
            assertTrue("six 100ms calls with limit 2 took ${ms}ms; they were not batched", ms < 550)
        }
    }

    // duplicates and single elements
    @Test
    fun edges() {
        runBlocking {
            assertEquals(listOf(5, 5, 5), listOf(5, 5, 5).parallelMap(2) { it })
            assertEquals(listOf(1), listOf(1).parallelMap(10) { it })
        }
    }
}
```

#### Uses
- [Coroutines › Limiting concurrency](#/coroutines/limiting-concurrency)
- [Coroutines › async and await](#/coroutines/async-and-await)
- [Generics › Generic functions](#/generics/generic-functions)

#### Hints
- One `Semaphore(limit)` for the whole call, created before the loop.
- `coroutineScope { map { async { gate.withPermit { f(it) } } }.awaitAll() }` is the shape.
- `awaitAll()` restores the input order regardless of which call finished first.

#### Tips
- Build the `Semaphore` once, before the `map`. One per element gates nothing.
- `require(limit >= 1)` belongs at the top of the function: a semaphore of zero permits would simply hang forever rather than fail.
- The permit has to be held around `f(it)`, not around the whole batch, or you have written a sequential loop with extra steps.

#### Docs
- [Semaphore](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.sync/-semaphore/)

### 9. Retry with a pause

`retry(times, delayMs, block)` calls `block` with the attempt number, starting at 1. If it throws, `retry` waits `delayMs` and tries again, up to `times` attempts in total. If the last attempt also throws, that exception is rethrown — there is no delay after it.

`times` below 1 is an `IllegalArgumentException` with the message `"times must be at least 1"`, thrown before anything is attempted.

```kotlin starter
import kotlinx.coroutines.*

suspend fun <T> retry(times: Int, delayMs: Long, block: suspend (attempt: Int) -> T): T =
    block(1)
```

```kotlin test
import kotlinx.coroutines.*
import kotlin.system.measureTimeMillis

class RetryTest {
    // a first-time success costs one call and no delay
    @Test
    fun succeedsImmediately() {
        runBlocking {
            var calls = 0
            var result = ""
            val ms = measureTimeMillis {
                result = retry(3, 200) { attempt -> calls++; "ok on $attempt" }
            }
            assertEquals("ok on 1", result)
            assertEquals(1, calls)
            assertTrue("no delay should be paid on success, took ${ms}ms", ms < 150)
        }
    }

    // it keeps trying until one works
    @Test
    fun succeedsLater() {
        runBlocking {
            var calls = 0
            var result = 0
            val ms = measureTimeMillis {
                result = retry(5, 100) { attempt ->
                    calls++
                    if (attempt < 3) throw IllegalStateException("attempt $attempt failed")
                    attempt * 10
                }
            }
            assertEquals(30, result)
            assertEquals(3, calls)
            assertTrue("two failures should cost two delays, took ${ms}ms", ms >= 150)
        }
    }

    // the last failure is the one that escapes, with no delay after it
    @Test
    fun givesUp() {
        runBlocking {
            var calls = 0
            var message: String? = null
            val ms = measureTimeMillis {
                try {
                    retry(3, 300) { attempt -> calls++; throw IllegalStateException("attempt $attempt failed") }
                } catch (e: IllegalStateException) {
                    message = e.message
                }
            }
            assertEquals("attempt 3 failed", message)
            assertEquals(3, calls)
            assertTrue("three attempts need two delays, not three; took ${ms}ms", ms < 750)
        }
    }

    // one attempt means one attempt
    @Test
    fun atLeastOnce() {
        runBlocking {
            var calls = 0
            assertEquals(7, retry(1, 10) { calls++; 7 })
            assertEquals(1, calls)

            var thrown: String? = null
            try {
                retry(0, 10) { calls++; 7 }
            } catch (e: IllegalArgumentException) {
                thrown = e.message
            }
            assertEquals("times must be at least 1", thrown)
            assertEquals(1, calls)
        }
    }
}
```

#### Uses
- [Exceptions & Result › require, check and error](#/errors/require-check-and-error)
- [Coroutines › Suspend functions](#/coroutines/suspend-functions)

#### Hints
- Start with `require(times >= 1) { "times must be at least 1" }`.
- Loop over the first `times - 1` attempts inside a `try`, returning on success and `delay(delayMs)` in the `catch`; then run the final attempt outside the `try` so its exception escapes.
- `runCatching { block(attempt) }.getOrNull()` is another way to spell the loop body, as long as the last attempt is not wrapped.

#### Tips
- Waiting after the *last* failure is the classic off-by-one here, and the timing assertions are what catch it.
- `times = 1` means one attempt and no retries at all, so its exception must escape untouched.
- `delay` is a suspend function, which is why `retry` has to be `suspend` too — the signature is telling you it might wait.

### 10. Chunk a flow

`chunked(size)` collects a flow into lists of `size` values. The final list is whatever is left over, so it may be shorter. An empty flow produces no lists at all, and a `size` below 1 is an `IllegalArgumentException` thrown when `chunked` is called, before anything is collected.

```kotlin starter
import kotlinx.coroutines.flow.*

fun <T> Flow<T>.chunked(size: Int): Flow<List<T>> = flowOf(emptyList())
```

```kotlin test
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class ChunkedTest {
    // a partial last chunk
    @Test
    fun leftovers() {
        runBlocking {
            assertEquals(
                listOf(listOf(1, 2, 3), listOf(4, 5, 6), listOf(7)),
                flowOf(1, 2, 3, 4, 5, 6, 7).chunked(3).toList()
            )
            assertEquals(listOf(listOf(1, 2), listOf(3)), flowOf(1, 2, 3).chunked(2).toList())
        }
    }

    // exact multiples and single-value chunks
    @Test
    fun exact() {
        runBlocking {
            assertEquals(listOf(listOf(1, 2), listOf(3, 4)), flowOf(1, 2, 3, 4).chunked(2).toList())
            assertEquals(listOf(listOf("a"), listOf("b")), flowOf("a", "b").chunked(1).toList())
            assertEquals(listOf(listOf(1, 2, 3)), flowOf(1, 2, 3).chunked(9).toList())
        }
    }

    // an empty flow produces nothing
    @Test
    fun empty() {
        runBlocking {
            assertEquals(emptyList<List<Int>>(), emptyFlow<Int>().chunked(3).toList())
            assertEquals(emptyList<List<Int>>(), emptyFlow<Int>().chunked(1).toList())
        }
    }

    // a size below one is rejected straight away
    @Test
    fun rejectsSize() {
        var zero: Boolean = false
        var negative: Boolean = false
        try {
            flowOf(1, 2).chunked(0)
        } catch (e: IllegalArgumentException) {
            zero = true
        }
        try {
            flowOf(1, 2).chunked(-2)
        } catch (e: IllegalArgumentException) {
            negative = true
        }
        assertTrue("chunked(0) should throw before collection", zero)
        assertTrue("chunked(-2) should throw before collection", negative)
    }
}
```

#### Uses
- [Flow › Writing your own operator](#/flow/writing-your-own-operator)
- [Exceptions & Result › require, check and error](#/errors/require-check-and-error)

#### Hints
- Put the `require(size >= 1)` in the function body *before* the `flow { }` builder, so it runs when `chunked` is called rather than when the flow is collected.
- Inside the builder, keep a `val batch = mutableListOf<T>()`, add each collected value, and `emit(batch.toList())` plus `batch.clear()` once it is full.
- After `collect` returns, emit what is left if the batch is not empty.

#### Tips
- `emit(batch)` without `toList()` emits the same mutable list every time, and clearing it afterwards empties what the collector is holding. Copy it.
- `require` outside the `flow { }` builder fails when `chunked` is called; inside it, it would not fail until somebody collects. The tests check the eager version.
- The final partial batch is emitted after `collect` returns, and only when it is not empty — otherwise an exact multiple would end with a stray `[]`.

### 11. Diff two lists

`diff(expected, actual)` is the reporting half of an assertion library. It returns an empty list when the two lists are identical.

When the sizes differ, the first entry is `"size: expected <n> but was <m>"`. After that — whether or not the sizes matched — comes one entry per index where the lists have different values, in index order, reading `"[i]: expected <e> but was <a>"`. Only indices present in both lists are compared.

```kotlin starter
fun <T> diff(expected: List<T>, actual: List<T>): List<String> = emptyList()
```

```kotlin test
class DiffTest {
    // identical lists report nothing
    @Test
    fun same() {
        assertEquals(emptyList<String>(), diff(listOf(1, 2, 3), listOf(1, 2, 3)))
        assertEquals(emptyList<String>(), diff(emptyList<Int>(), emptyList()))
        assertEquals(emptyList<String>(), diff(listOf("a"), listOf("a")))
    }

    // differing values, in index order
    @Test
    fun values() {
        assertEquals(listOf("[1]: expected 2 but was 9"), diff(listOf(1, 2, 3), listOf(1, 9, 3)))
        assertEquals(
            listOf("[0]: expected a but was x", "[1]: expected b but was y"),
            diff(listOf("a", "b"), listOf("x", "y"))
        )
        assertEquals(listOf("[2]: expected 3 but was 0"), diff(listOf(1, 2, 3), listOf(1, 2, 0)))
    }

    // a size mismatch comes first
    @Test
    fun sizes() {
        assertEquals(listOf("size: expected 3 but was 2"), diff(listOf(1, 2, 3), listOf(1, 2)))
        assertEquals(listOf("size: expected 0 but was 1"), diff(emptyList<Int>(), listOf(1)))
        assertEquals(listOf("size: expected 2 but was 4"), diff(listOf(1, 2), listOf(1, 2, 3, 4)))
    }

    // a size mismatch and a value mismatch together
    @Test
    fun both() {
        assertEquals(
            listOf("size: expected 3 but was 2", "[0]: expected 1 but was 9"),
            diff(listOf(1, 2, 3), listOf(9, 2))
        )
        assertEquals(
            listOf("size: expected 1 but was 3", "[0]: expected a but was z"),
            diff(listOf("a"), listOf("z", "y", "x"))
        )
    }
}
```

#### Uses
- [Testing › assertEquals, expected first](#/testing/assertequals-expected-first)
- [Testing › What makes a test worth having](#/testing/what-makes-a-test-worth-having)

#### Hints
- `buildList { ... }` lets you `add` the size line conditionally and then the index lines.
- The compared range is `0 until minOf(expected.size, actual.size)`.
- Build each message with a template: `"[$i]: expected ${expected[i]} but was ${actual[i]}"`.

#### Tips
- Note the argument order: expected first, actual second, exactly as in `assertEquals`. Getting it backwards produces messages that send the reader in the wrong direction.
- Compare only up to `minOf(expected.size, actual.size)`; indexing past the shorter list is the bug this problem is really about.
- Two equal lists must produce an empty result, not a "no differences" line. An empty list is the honest answer.

### 12. Read a config file

`parseConfig(text)` turns a block of text into a map. Lines are separated by `\n`. A blank line, or one whose first non-blank character is `#`, is skipped. Every other line must contain an `=`: the key is what comes before the first one and the value is everything after it, both trimmed, so a value may itself contain `=`. A later line with the same key replaces an earlier one.

A line with no `=` throws `IllegalArgumentException` with the message `"line <n>: missing '='"`, and a line whose key is empty throws `"line <n>: empty key"`. Line numbers start at 1 and count every line, including the ones that were skipped.

```kotlin starter
fun parseConfig(text: String): Map<String, String> = emptyMap()
```

```kotlin test
class ConfigTest {
    // keys and values, trimmed
    @Test
    fun basics() {
        assertEquals(mapOf("a" to "1", "b" to "2"), parseConfig("a=1\nb=2"))
        assertEquals(mapOf("host" to "localhost"), parseConfig("  host  =  localhost  "))
        assertEquals(emptyMap<String, String>(), parseConfig(""))
        assertEquals(mapOf("k" to ""), parseConfig("k="))
    }

    // comments, blanks and repeated keys
    @Test
    fun skippingAndOverriding() {
        val text = "# a comment\n\nport = 80\n   # indented comment\nport = 443\n"
        assertEquals(mapOf("port" to "443"), parseConfig(text))
        assertEquals(emptyMap<String, String>(), parseConfig("#only\n\n  \n"))
        assertEquals(mapOf("a" to "2", "b" to "3"), parseConfig("a=1\nb=3\na=2"))
    }

    // the value keeps any further equals signs
    @Test
    fun valuesWithEquals() {
        assertEquals(mapOf("query" to "a=b&c=d"), parseConfig("query = a=b&c=d"))
        assertEquals(mapOf("eq" to "="), parseConfig("eq = ="))
    }

    // bad lines are reported with their line number
    @Test
    fun failures() {
        var missing: String? = null
        try {
            parseConfig("# header\na=1\noops\nb=2")
        } catch (e: IllegalArgumentException) {
            missing = e.message
        }
        assertEquals("line 3: missing '='", missing)

        var emptyKey: String? = null
        try {
            parseConfig("a=1\n  = 2")
        } catch (e: IllegalArgumentException) {
            emptyKey = e.message
        }
        assertEquals("line 2: empty key", emptyKey)

        var firstLine: String? = null
        try {
            parseConfig("nope")
        } catch (e: IllegalArgumentException) {
            firstLine = e.message
        }
        assertEquals("line 1: missing '='", firstLine)
    }
}
```

#### Uses
- [Exceptions & Result › require, check and error](#/errors/require-check-and-error)
- [Practice problems › What you can reach for](#/practice/what-you-can-reach-for)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)
- [Collections › Maps](#/collections/maps)

#### Hints
- `text.lines()` splits on line breaks; `withIndex()` or `forEachIndexed` gives you the line number, which is the index plus one.
- `line.substringBefore('=')` and `line.substringAfter('=')` split on the *first* `=`, which is exactly the rule for values containing more of them.
- Build into a `mutableMapOf<String, String>()`; assigning the same key twice naturally keeps the last value.

#### Tips
- `"a=1\nb=2\n".lines()` ends with an empty string, which the blank-line rule skips — so a trailing newline needs no special handling.
- `substringBefore` and `substringAfter` split at the *first* `=`, which is exactly the rule a value containing an `=` needs.
- An empty input has to give `emptyMap()`, and building into a `mutableMapOf` gets that for free — the loop simply never runs.
