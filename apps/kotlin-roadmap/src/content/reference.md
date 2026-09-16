# Reference

A lookup page, not a step on the roadmap. It covers the machinery the exercises run on — the test block and its assertions — and the standard-library functions the exercises reach for, grouped by what they work on. Every entry has its shape, one line about what it does, a sample with the result it produces, and a link to the official docs.

Nothing here has to be read in order. Exercises link to the section they need.

## How the tests work

Every exercise has two editors: your code on the left, and a **test block** you cannot change. The test block is the specification. Read it before you write anything — it shows the exact types, the exact strings, and the edge cases the description only summarises.

The test block is a class of test functions:

```kotlin
class GreetTest {
    // greets a name
    @Test
    fun greets() {
        assertEquals("Hello, Ada!", greet("Ada"))
    }
}
```

Four things to notice:

- **`class GreetTest`** — an ordinary class. It is compiled together with your code, so it can call anything you declare at the top level.
- **`@Test`** — marks one test. Each `@Test` function is run separately and reported separately, so one failure does not hide the others.
- **The `//` comment above `@Test`** — the label the runner shows for that test. `// greets a name` is why the result list says "greets a name" instead of `greets`.
- **A test passes by returning and fails by throwing.** That is the whole protocol. An assertion is a function that throws when it does not like what it sees.

Imports written inside a test block are **hoisted to the top of the file for you**, so a test may start with `import kotlinx.coroutines.runBlocking` even though Kotlin only allows imports at the top of a file. You do not need to repeat them in your own editor; `org.junit.Test` and `org.junit.Assert.*` are always imported.

A `@Test` function cannot be `suspend`. Tests that need coroutines wrap their body in `runBlocking { ... }` instead.

- [Testing basics](https://kotlinlang.org/docs/jvm-test-using-junit.html)

## Assertions

These come from `org.junit.Assert`, imported for you. In every one of them the **expected value comes first** and the value your code produced comes second. Swapping them does not change whether the test passes, but it does swap the two halves of the failure message.

- `assertEquals(expected, actual)` — fails unless `expected == actual`, comparing with `equals`, so lists and data classes compare by content. `assertEquals(listOf(1, 2), parse("1,2"))`. [docs](https://junit.org/junit4/javadoc/latest/org/junit/Assert.html#assertEquals(java.lang.Object,%20java.lang.Object))
- `assertEquals(message, expected, actual)` — the same, with a string shown first in the failure. `assertEquals("input '3'", 3, parse("3"))`.
- `assertEquals(expected, actual, delta)` — for `Double`, where exact equality is the wrong question. `assertEquals(0.3, sum, 1e-9)`.
- `assertTrue(message, condition)` — fails when the condition is `false`. `assertTrue("should start with 'Hello, '", out.startsWith("Hello, "))`. [docs](https://junit.org/junit4/javadoc/latest/org/junit/Assert.html#assertTrue(java.lang.String,%20boolean))
- `assertFalse(message, condition)` — the negation. `assertFalse("empty counter", counter.isEmpty)`.
- `assertNull(actual)` / `assertNotNull(actual)` — fails unless the value is (or is not) `null`. `assertNull(longest(emptyList()))`.
- `fail(message)` — throws unconditionally. Used to mark a line that should never be reached.

Prefer `assertEquals` wherever you can: "expected 3 but was 5" tells you more than "the condition was false". Reach for `assertTrue` only when the check is not an equality, and always give it a message.

Checking that something throws has no assertion of its own here. Call it, then fail if it returns:

```kotlin
try {
    parsePort("nope")
    throw AssertionError("expected a throw")
} catch (e: IllegalArgumentException) {
    assertEquals("not a number: nope", e.message)
}
```

The `throw AssertionError` line is the important one. Without it, a version of `parsePort` that never throws passes silently.

## Strings

A `String` is immutable: every function here returns a new string and leaves the receiver alone. Indexing is from zero.

- `str.length` — the number of characters. `"kotlin".length` is `6`. [docs](https://kotlinlang.org/docs/strings.html)
- `str[i]` — the `Char` at that index; throws past the end. `"kotlin"[0]` is `'k'`. [docs](https://kotlinlang.org/docs/strings.html)
- `str.first()` / `str.last()` — the first or last `Char`; both throw on an empty string. `"kotlin".first()` is `'k'`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/first.html)
- `str.take(n)` / `str.drop(n)` — the first `n` characters, or everything after them, as a `String`. `"kotlin".take(3)` is `"kot"`, `"kotlin".drop(3)` is `"lin"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/take.html)
- `str.takeLast(n)` — the last `n` characters. `"kotlin".takeLast(2)` is `"in"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/take-last.html)
- `str.substring(from, to)` — the characters from `from` up to but not including `to`. `"kotlin".substring(1, 4)` is `"otl"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/substring.html)
- `str.uppercase()` / `str.lowercase()` — a whole string, case folded. `"Kotlin".lowercase()` is `"kotlin"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/uppercase.html)
- `str.reversed()` — the characters back to front. `"kotlin".reversed()` is `"niltok"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/reversed.html)
- `str.trim()` — whitespace removed from both ends. `"  hi  ".trim()` is `"hi"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/trim.html)
- `str.repeat(n)` — the string `n` times; `0` gives `""`. `"ab".repeat(3)` is `"ababab"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/repeat.html)
- `str.padStart(width, char)` / `str.padEnd(width, char)` — pad to a width, or return the string unchanged if it is already that long. `"ab".padStart(5, '.')` is `"...ab"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/pad-start.html)

### Asking questions about a string

- `str.startsWith(prefix)` — `Boolean`. `"kotlin".startsWith("kot")` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/starts-with.html)
- `str.endsWith(suffix)` — `Boolean`. `"kotlin".endsWith("lin")` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/ends-with.html)
- `str.contains(part)`, or `part in str` — is it anywhere inside. `"tl" in "kotlin"` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/contains.html)
- `str.indexOf(x)` — the position of the first occurrence, or `-1`. `"kotlin".indexOf('t')` is `2`; `"kotlin".indexOf('z')` is `-1`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/index-of.html)
- `str.lastIndexOf(x)` — the position of the last occurrence, or `-1`. `"a b c".lastIndexOf(' ')` is `3`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/last-index-of.html)
- `str.isEmpty()` / `str.isNotEmpty()` — is the length zero. `"  ".isEmpty()` is `false`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-not-empty.html)
- `str.isBlank()` / `str.isNotBlank()` — empty **or only whitespace**. `"  ".isBlank()` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-blank.html)
- `str.isNullOrEmpty()` / `str.isNullOrBlank()` — callable on a `String?`, with no safe call in front. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-null-or-blank.html)

### Cutting a string up

- `str.split(sep)` — a `List<String>`; empty pieces are kept. `"a,b,,c".split(",")` is `[a, b, , c]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/split.html)
- `str.split(Regex("\\s+"))` — split on runs of whitespace. `"a b  c".split(Regex("\\s+"))` is `[a, b, c]`.
- `str.lines()` — split on line breaks; a trailing newline leaves a final `""`. `"a\nb\n".lines()` is `[a, b, ]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/lines.html)
- `str.substringBefore(x)` / `str.substringAfter(x)` — everything before or after the **first** `x`. `"a=1=2".substringAfter('=')` is `"1=2"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/substring-after.html)
- `str.substringAfterLast(x)` — everything after the **last** `x`. `"a=1=2".substringAfterLast('=')` is `"2"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/substring-after-last.html)
- `str.removePrefix(p)` / `str.removeSuffix(s)` — drop it if it is there, otherwise return the string unchanged. `"SAVE10".removePrefix("SAVE")` is `"10"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/remove-prefix.html)
- `str.replace(old, new)` — every occurrence. `"a-b".replace("-", "+")` is `"a+b"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/replace.html)
- `str.toList()` — the characters as a `List<Char>`. `"abc".toList()` is `[a, b, c]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-list.html)
- `chars.joinToString("")` — a list of characters back into a string. `listOf('a', 'b').joinToString("")` is `"ab"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/join-to-string.html)

### Building and parsing

- `buildString { append(x) }` — a `StringBuilder` scope that returns the finished string. `buildString { append("a"); append(1) }` is `"a1"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/build-string.html)
- `str.toInt()` — throws `NumberFormatException` on anything that is not a number. `"42".toInt()` is `42`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int.html)
- `str.toIntOrNull()` — `null` instead of throwing, and no trimming or leniency. `"4x".toIntOrNull()` is `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int-or-null.html)
- `"%02d".format(n)` — Java-style formatting. `"%02d".format(9)` is `"09"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/format.html)

## Characters

A `Char` is its own type, written with single quotes, and is not a one-letter `String`. The predicates below are the ones the exercises use.

- `c.isDigit()` — `'7'.isDigit()` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-digit.html)
- `c.isLetter()` — `'a'.isLetter()` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-letter.html)
- `c.isLetterOrDigit()` — the usual test for "not punctuation". `'_'.isLetterOrDigit()` is `false`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-letter-or-digit.html)
- `c.isWhitespace()` — space, tab, newline. `' '.isWhitespace()` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-whitespace.html)
- `c.isUpperCase()` / `c.isLowerCase()` — `'a'.isUpperCase()` is `false`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-upper-case.html)
- `c.uppercaseChar()` / `c.lowercaseChar()` — case folding for a single character; the `String` versions are `uppercase()` and `lowercase()`. `'A'.lowercaseChar()` is `'a'`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/lowercase-char.html)
- `c.digitToInt()` — the numeric value of a digit character; throws on a non-digit. `'7'.digitToInt()` is `7`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/digit-to-int.html)
- `c.code` — the character's numeric code. `'A'.code` is `65`. [docs](https://kotlinlang.org/docs/characters.html)
- `c.toString()` — a one-character `String`. `'A'.toString()` is `"A"`. [docs](https://kotlinlang.org/docs/characters.html)
- `c in 'a'..'z'` — range membership works on characters. `'a' in 'a'..'z'` is `true`. [docs](https://kotlinlang.org/docs/ranges.html)

## Numbers and ranges

- `a / b` on two `Int`s — integer division, truncated toward zero. `7 / 2` is `3`. Make one side a `Double` for a fraction: `7 / 2.0` is `3.5`. [docs](https://kotlinlang.org/docs/numbers.html)
- `a % b` — a remainder whose sign follows the left operand. `-7 % 3` is `-1`. For a non-negative answer, `Math.floorMod(-7, 3)` is `2`.
- `d.toInt()` — truncates, it does not round. `3.9.toInt()` is `3`. [docs](https://kotlinlang.org/docs/numbers.html#explicit-number-conversions)
- `minOf(a, b)` / `maxOf(a, b)` — the smaller or larger of two (or more) comparable values. `maxOf(1, 5, 3)` is `5`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.comparisons/max-of.html)
- `n.coerceIn(min, max)` — the standard-library clamp. `15.coerceIn(0, 10)` is `10`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.ranges/coerce-in.html)
- `n.coerceAtLeast(min)` / `n.coerceAtMost(max)` — clamp one end only. `(-3).coerceAtLeast(0)` is `0`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.ranges/coerce-at-least.html)
- `kotlin.math.abs(n)` — absolute value. `abs(-5)` is `5`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.math/abs.html)
- `kotlin.math.sqrt(d)` — square root of a `Double`. `sqrt(9.0)` is `3.0`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.math/sqrt.html)
- `d.roundToInt()` — rounds half up and returns an `Int`. `3.6.roundToInt()` is `4`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.math/round-to-int.html)
- `Int.MAX_VALUE` / `Int.MIN_VALUE` — where an `Int` stops; overflow wraps silently. [docs](https://kotlinlang.org/docs/numbers.html)

Ranges are values, and they are iterable and testable:

- `1..5` — inclusive at both ends. `(1..5).toList()` is `[1, 2, 3, 4, 5]`. [docs](https://kotlinlang.org/docs/ranges.html)
- `1..<5` — open at the top (`until` is the older spelling). `(1..<5).toList()` is `[1, 2, 3, 4]`.
- `5 downTo 1` — counting down. `(5 downTo 1).toList()` is `[5, 4, 3, 2, 1]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.ranges/down-to.html)
- `1..10 step 3` — with a stride. `(1..10 step 3).toList()` is `[1, 4, 7, 10]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.ranges/step.html)
- `x in 1..5` — membership. `3 in 1..5` is `true`. An empty range such as `1..0` simply never iterates.

## Lists, sets and maps

- `listOf(...)`, `setOf(...)`, `mapOf(k to v)` — read-only. [docs](https://kotlinlang.org/docs/collections-overview.html)
- `mutableListOf()`, `mutableSetOf()`, `mutableMapOf()` — the versions with `add`, `remove` and index assignment.
- `emptyList<T>()`, `emptySet<T>()`, `emptyMap<K, V>()` — an empty collection when there is nothing to infer the type from. `emptyMap<String, Int>()` prints as `{}`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/empty-map.html)
- `List(n) { i -> ... }` — build a list from its indices. `List(3) { it * 2 }` is `[0, 2, 4]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/-list.html)
- `buildList { add(x) }` — a `MutableList` scope that returns a read-only list. `buildList { add(1); add(2) }` is `[1, 2]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/build-list.html)

On a list:

- `list.size`, `list.isEmpty()`, `list.isNotEmpty()` — `listOf(1, 2).size` is `2`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/is-not-empty.html)
- `list[i]` — throws `IndexOutOfBoundsException` past the end.
- `list.getOrNull(i)` — `null` instead of throwing. `listOf(1).getOrNull(9)` is `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/get-or-null.html)
- `list.getOrElse(i) { fallback }` — a computed fallback. `listOf(1).getOrElse(9) { -1 }` is `-1`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/get-or-else.html)
- `list.indices` — the valid index range. `listOf("a", "b").indices.toList()` is `[0, 1]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/indices.html)
- `list.withIndex()` — pairs of index and value, for `for ((i, v) in ...)`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/with-index.html)
- `x in list`, `list.indexOf(x)` — membership and position, or `-1`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/index-of.html)
- `list.toList()` — a read-only **copy**; the way to take a snapshot of something mutable. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/to-list.html)
- `mutable.add(x)`, `mutable.addAll(other)`, `mutable.remove(x)`, `mutable.removeAt(i)`, `mutable.clear()` — `mutableListOf(1).apply { addAll(listOf(2, 3)) }` is `[1, 2, 3]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/add-all.html)

On a set:

- `set.add(x)` returns `false` when the element was already there — a membership test and an insert in one call. `mutableSetOf(1).add(1)` is `false`. [docs](https://kotlinlang.org/docs/set-operations.html)
- `a intersect b`, `a union b`, `a subtract b` — `setOf(1, 2) intersect setOf(2, 3)` is `[2]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/intersect.html)

On a map:

- `map[key]` — the value or `null`, so the type is always nullable. `mapOf("Ada" to 36)["Nobody"]` is `null`. [docs](https://kotlinlang.org/docs/map-operations.html)
- `map.getValue(key)` — the value, throwing `NoSuchElementException` when the key is absent. Use it when you have already checked `key in map`. `mapOf("Ada" to 36).getValue("Ada")` is `36`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/get-value.html)
- `map.getOrDefault(key, fallback)` — `mapOf<String, Int>().getOrDefault("x", 0)` is `0`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/get-or-default.html)
- `mutable.getOrPut(key) { compute() }` — read, or compute and store. `mutableMapOf<String, Int>().getOrPut("a") { 7 }` is `7` and leaves `{a=7}` behind. Note it cannot cache a `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/get-or-put.html)
- `map.keys`, `map.values`, `map.entries` — the three views; an entry has `.key` and `.value`. [docs](https://kotlinlang.org/docs/map-operations.html)
- `map.mapValues { it.value + 1 }` — a new map with the values transformed. `mapOf("a" to 1).mapValues { it.value + 1 }` is `{a=2}`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/map-values.html)
- `map.toMutableMap()` — a mutable **copy**, which is how you merge two read-only maps. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/to-mutable-map.html)
- `pairs.toMap()` — a read-only map from a list of pairs. `listOf("a" to 1).toMap()` is `{a=1}`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/to-map.html)

## Collection operations

Each of these returns a **new** collection and leaves its receiver alone. The samples use `nums = listOf(1, 2, 3, 4, 5)` and `words = listOf("apple", "fig", "banana", "kiwi")`.

- `map { }` — one result per element. `nums.map { it * it }` is `[1, 4, 9, 16, 25]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/map.html)
- `mapIndexed { i, x -> }` — the index as well as the element. `words.mapIndexed { i, w -> "$i-$w" }` starts `[0-apple, ...]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/map-indexed.html)
- `mapNotNull { }` — map, then drop the `null` results. `listOf("1", "x").mapNotNull { it.toIntOrNull() }` is `[1]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/map-not-null.html)
- `filter { }` / `filterNot { }` — keep, or discard, what the predicate likes. `nums.filter { it % 2 == 0 }` is `[2, 4]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/filter.html)
- `filterNotNull()` — a `List<T?>` becomes a `List<T>`. `listOf(1, null).filterNotNull()` is `[1]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/filter-not-null.html)
- `filterIsInstance<T>()` — keep only the elements of one type. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/filter-is-instance.html)
- `flatMap { }` — the lambda returns a collection per element and the results are concatenated. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/flat-map.html)
- `take(n)` / `drop(n)` / `takeWhile { }` — `nums.takeWhile { it < 3 }` is `[1, 2]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/take-while.html)
- `distinct()` — duplicates removed, first-appearance order kept. `listOf(1, 1, 2).distinct()` is `[1, 2]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/distinct.html)
- `reversed()` — `nums.reversed()` is `[5, 4, 3, 2, 1]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/reversed.html)
- `chunked(n)` — fixed-size pieces; the last one may be short. `nums.chunked(2)` is `[[1, 2], [3, 4], [5]]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/chunked.html)
- `windowed(n)` — every sliding window. `nums.windowed(2)` is `[[1, 2], [2, 3], [3, 4], [4, 5]]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/windowed.html)
- `zipWithNext()` — every element paired with the one after it, so a list of `n` gives `n - 1` pairs and a list of one gives none. `nums.zipWithNext()` is `[(1, 2), (2, 3), (3, 4), (4, 5)]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/zip-with-next.html)
- `zip(other)` — pairs from two collections, stopping at the shorter. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/zip.html)

Finding and testing:

- `first { }` / `last { }` — the match, throwing `NoSuchElementException` when there is none. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/first.html)
- `firstOrNull { }`, and its alias `find { }` — `null` instead of throwing. `words.find { it.startsWith("b") }` is `"banana"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/find.html)
- `indexOfFirst { }` — the index, or `-1`. `words.indexOfFirst { it.length == 3 }` is `1`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/index-of-first.html)
- `any { }` / `all { }` / `none { }` — `words.all { it.isNotEmpty() }` is `true`. `all` on an empty list is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/all.html)
- `count { }` — how many match. `words.count { it.length == 4 }` is `1`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/count.html)

Aggregating:

- `sum()` / `average()` — `nums.sum()` is `15`, `nums.average()` is `3.0`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/sum.html)
- `sumOf { }` — sum of a computed value. `words.sumOf { it.length }` is `18`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/sum-of.html)
- `maxOrNull()` / `minOrNull()` — the largest or smallest, or `null` on an empty collection. `nums.maxOrNull()` is `5`; `emptyList<Int>().maxOrNull()` is `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-or-null.html)
- `maxByOrNull { }` — the **element** with the largest key, the first one on a tie. `words.maxByOrNull { it.length }` is `"banana"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-by-or-null.html)
- `maxOfOrNull { }` — the largest **key**, not the element. `words.maxOfOrNull { it.length }` is `6`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-of-or-null.html)
- `joinToString(sep, prefix, postfix)` — `listOf("a", "b").joinToString("", "<", ">")` is `"<ab>"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/join-to-string.html)
- `fold(seed) { acc, x -> }` — carry an accumulator; safe on an empty collection. `nums.fold(0) { a, n -> a + n }` is `15`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/fold.html)
- `runningFold(seed) { }` — every accumulator including the seed, so it is one longer than the input. `nums.runningFold(0) { a, n -> a + n }` is `[0, 1, 3, 6, 10, 15]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/running-fold.html)
- `runningReduce { }` — the same without a seed. `nums.runningReduce { a, n -> a + n }` is `[1, 3, 6, 10, 15]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/running-reduce.html)

Grouping:

- `groupBy { }` — a `Map<K, List<V>>` keeping every element. `words.groupBy { it.length }` is `{5=[apple], 3=[fig], 6=[banana], 4=[kiwi]}`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/group-by.html)
- `groupingBy { }.eachCount()` — the idiomatic word count. `words.groupingBy { it.first() }.eachCount()` is `{a=1, f=1, b=1, k=1}`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/each-count.html)
- `associateWith { }` — elements as keys. `words.associateWith { it.length }` is `{apple=5, fig=3, banana=6, kiwi=4}`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/associate-with.html)
- `associateBy { }` — computed keys, keeping only the **last** element per key. `words.associateBy { it.first() }` is `{a=apple, f=fig, b=banana, k=kiwi}`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/associate-by.html)
- `partition { }` — one pass, two lists, destructured with `val (yes, no) = ...`. `words.partition { it.length <= 4 }` is `([fig, kiwi], [apple, banana])`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/partition.html)

## Sorting and comparing

All of these return a new list and are stable: elements that compare equal keep their relative order.

- `sorted()` — natural order. `words.sorted()` is `[apple, banana, fig, kiwi]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/sorted.html)
- `sortedBy { }` / `sortedByDescending { }` — by a computed key. `words.sortedBy { it.length }` is `[fig, kiwi, apple, banana]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/sorted-by.html)
- `sortedWith(comparator)` — by a comparator you built. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/sorted-with.html)
- `compareBy({ }, { })` — a comparator over several keys, most important first. `words.sortedWith(compareBy({ it.length }, { it }))` is `[fig, kiwi, apple, banana]`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.comparisons/compare-by.html)
- `compareByDescending<T> { }.thenBy { }` — descending on one key, ascending on the tie-breaker. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.comparisons/compare-by-descending.html)
- `compareValuesBy(a, b, { }, { })` — compares two values directly by several keys and returns an `Int`, which is exactly what `compareTo` has to return. `compareValuesBy(this, other, { it.major }, { it.minor })` is a whole `Comparable` implementation. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.comparisons/compare-values-by.html)
- `mutable.sort()` / `mutable.sortBy { }` — sort a `MutableList` **in place**, returning `Unit`. The names without `ed` are the mutating ones. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/sort.html)

## Sequences

A sequence runs the whole chain one element at a time and does nothing until a terminal operation pulls. The operator names are the same as the list ones.

- `list.asSequence()` — switch a collection to lazy evaluation. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.sequences/as-sequence.html)
- `generateSequence(seed) { next }` — an infinite sequence, which is fine as long as something stops it. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.sequences/generate-sequence.html)
- `toList()`, `first()`, `sum()`, `count()` — terminal: these are what make it run. [docs](https://kotlinlang.org/docs/sequences.html)

```kotlin
(1..1_000_000).asSequence().map { it * it }.filter { it % 7 == 0 }.first()   // 49
```

Written without `asSequence()` that squares a million numbers first. With it, it stops after seven.

## Result and runCatching

`Result<T>` holds either a value or a `Throwable`, so a function can hand a failure back instead of unwinding the stack.

- `runCatching { ... }` — run a block and wrap the outcome. Catches `Throwable`, which is broad, so use it at a boundary. `runCatching { "x".toInt() }.getOrNull()` is `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/run-catching.html)
- `Result.success(value)` — a success you build yourself. `Result.success(1)` prints as `Success(1)`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/-companion/success.html)
- `Result.failure(throwable)` — a failure you build yourself. `Result.failure<Int>(IllegalStateException("no")).isFailure` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/-companion/failure.html)
- `r.isSuccess` / `r.isFailure` — `Boolean`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/is-success.html)
- `r.getOrNull()` — the value, or `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/get-or-null.html)
- `r.exceptionOrNull()` — the `Throwable`, or `null`. `runCatching { error("boom") }.exceptionOrNull()?.message` is `"boom"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-result/exception-or-null.html)
- `r.getOrElse { e -> fallback }` — the value, or something computed from the exception. `runCatching { 1 }.map { it * 2 }.getOrElse { 0 }` is `2`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/get-or-else.html)
- `r.getOrThrow()` — the value, rethrowing the failure. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/get-or-throw.html)
- `r.map { }` — transform a success, leave a failure alone. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/map.html)
- `r.mapCatching { }` — the same, but a throw inside the block becomes a failure. `runCatching { 1 }.mapCatching { it / 0 }.isFailure` is `true`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/map-catching.html)
- `r.recover { e -> value }` — turn a failure back into a success. `runCatching { "x".toInt() }.recover { -1 }.getOrNull()` is `-1`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/recover.html)
- `r.fold({ value -> }, { error -> })` — collapse both sides into one value; the success lambda comes first. `runCatching { "x".toInt() }.fold({ "ok $it" }, { "err ${it::class.simpleName}" })` is `"err NumberFormatException"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/fold.html)
- `r.onSuccess { }` / `r.onFailure { }` — side effects that return the `Result` unchanged. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/on-success.html)

Throwing deliberately:

- `require(condition) { "message" }` — throws `IllegalArgumentException`; for bad arguments. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/require.html)
- `check(condition) { "message" }` — throws `IllegalStateException`; for an object in the wrong state. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/check.html)
- `error("message")` — always throws `IllegalStateException`, and has type `Nothing`, so it can be the `else` of a `when`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/error.html)

## Scope functions

Five functions that only run a block on an object. They differ in how the block names the object and in what the call returns.

| function | object is | returns |
| --- | --- | --- |
| `let` | `it` | the block's result |
| `run` | `this` | the block's result |
| `with` | `this` | the block's result |
| `apply` | `this` | the object |
| `also` | `it` | the object |

- `x?.let { }` — run only when `x` is not null; inside, `it` is the non-null type. `null?.let { it.length } ?: 0` is `0`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/let.html)
- `x.run { }` — the block's result, with members in scope. `"abc".run { length }` is `3`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/run.html)
- `with(x) { }` — the same, written as a call. `with("abc") { uppercase() }` is `"ABC"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/with.html)
- `X().apply { }` — configure and get the object back. `StringBuilder().apply { append("hi") }.toString()` is `"hi"`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/apply.html)
- `x.also { }` — a side effect inside a chain, leaving the value alone. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/also.html)
- `x.takeIf { }` — the receiver, or `null` when the predicate fails. `4.takeIf { it % 2 == 0 }` is `4`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/take-if.html)
- `x.takeUnless { }` — the negation. `"".takeUnless { it.isBlank() }` is `null`. [docs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/take-unless.html)

## Coroutines

From `kotlinx.coroutines`, which is available here. A `suspend` function may be called only from another `suspend` function or from a coroutine builder.

- `delay(ms)` — suspend without holding a thread. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/delay.html)
- `runBlocking { }` — build a coroutine and block the current thread until it finishes. The bridge at the edge of a program, and how a `@Test` runs suspending code. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/run-blocking.html)
- `coroutineScope { }` — the suspending scope; it does not return until every child has finished, and a child's failure cancels its siblings. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/coroutine-scope.html)
- `supervisorScope { }` — the same, except children fail independently. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/supervisor-scope.html)
- `launch { }` — start a coroutine that returns no value; gives a `Job` you can `join()` or `cancel()`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/launch.html)
- `async { }` — start a coroutine that produces a value; gives a `Deferred<T>`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/async.html)
- `deferred.await()` — suspend until that one is ready. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-deferred/await.html)
- `list.awaitAll()` — await a whole list, **in the input order** however they finished. `listOf(1, 2).map { async { fetch(it) } }.awaitAll()` is `[item-1, item-2]`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/await-all.html)
- `withTimeoutOrNull(ms) { }` — the block's value, or `null` when time runs out. `withTimeoutOrNull(10) { delay(50) }` is `null`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/with-timeout-or-null.html)
- `withTimeout(ms) { }` — the same but throwing `TimeoutCancellationException`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/with-timeout.html)
- `Semaphore(n)` and `gate.withPermit { }` — from `kotlinx.coroutines.sync`; suspends until one of `n` permits is free. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.sync/with-permit.html)
- `withContext(Dispatchers.Default) { }` — move a block to another dispatcher and come back with its value. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/with-context.html)

## Flow

A `Flow<T>` is a cold stream: building one runs nothing, and the code inside runs again for every collector.

- `flow { emit(x) }` — the general builder; the block is suspending. [docs](https://kotlinlang.org/docs/flow.html)
- `flowOf(1, 2, 3)` — a fixed set of values. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/flow-of.html)
- `list.asFlow()` — any collection or sequence. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/as-flow.html)
- `emptyFlow<T>()` — no values at all. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/empty-flow.html)
- `map { }`, `filter { }`, `take(n)` — intermediate; they describe work and run nothing. `flowOf(1, 2, 3).map { it * it }.toList()` is `[1, 4, 9]`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/map.html)
- `transform { }` — emit zero, one or many values per input. `flowOf(1, 2).transform { emit(it); emit(it * 10) }.toList()` is `[1, 10, 2, 20]`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/transform.html)
- `onEach { }` — a side effect per value, still intermediate. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/on-each.html)
- `withIndex()` — values wrapped with their index, readable as `it.index` and `it.value`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/with-index.html)
- `distinctUntilChanged()` — drop repeats that are next to each other only. `flowOf(1, 1, 2, 2, 1).distinctUntilChanged().toList()` is `[1, 2, 1]`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/distinct-until-changed.html)
- `runningReduce { }` — every intermediate accumulator. `flowOf(1, 2, 3).runningReduce { a, b -> a + b }.toList()` is `[1, 3, 6]`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/running-reduce.html)
- `collect { }` — terminal; suspends and actually runs the flow. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/collect.html)
- `toList()`, `first()`, `count()`, `fold(seed) { }` — the other terminal operators. `flowOf(1, 2, 3).fold(0) { a, v -> a + v }` is `6`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/to-list.html)
- `catch { }` — intercepts a failure from **upstream of it** and may `emit` a replacement. `flowOf("1", "x").map { it.toInt() }.catch { emit(-1) }.toList()` is `[1, -1]`. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/catch.html)
- `onCompletion { cause -> }` — runs when the flow ends either way; `cause` is `null` on success. It does not swallow the failure. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/on-completion.html)
- `flatMapMerge(concurrency) { }` — an inner flow per value, merged as they arrive, so the results are **not** in input order. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/flat-map-merge.html)
- `MutableStateFlow(initial)` — hot, always holds one current value in `.value`, with or without a collector. [docs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-mutable-state-flow/)
