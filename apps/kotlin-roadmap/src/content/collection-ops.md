# Collection operations

The standard library ships roughly two hundred functions on `Iterable`, and knowing thirty of them replaces almost every loop you would otherwise write. They all follow the same shape: you call one on a collection, hand it a lambda, and get a **new** collection back.

This module is the payoff for lambdas. A transformation written as a chain of named steps says what it does — filter, group, sort, take — where the equivalent loop makes you reconstruct the intent from an accumulator and an `if`.

## Transforming: map and filter

`map` applies a lambda to every element and returns a list of the results. `filter` keeps the elements a predicate likes.

```kotlin
val nums = listOf(1, 2, 3, 4, 5)

nums.map { it * it }            // [1, 4, 9, 16, 25]
nums.filter { it % 2 == 0 }     // [2, 4]
nums.filterNot { it % 2 == 0 }  // [1, 3, 5]
nums.map { it * 2 }.filter { it > 4 }   // [6, 8, 10]
```

Both keep the original order and neither touches the receiver. Variants worth knowing:

- `mapIndexed { i, x -> ... }` — the index as well as the element
- `mapNotNull { ... }` — map, then drop the `null` results in one step
- `filterNotNull()` — a `List<String?>` becomes a `List<String>`, which is how you get rid of nulls before the rest of a chain
- `flatMap { ... }` — the lambda returns a collection per element, and the results are concatenated
- `distinct()`, `take(n)`, `drop(n)`, `reversed()`, `chunked(n)`, `windowed(n)`, `zip(other)`
- `zipWithNext()` — every element paired with the one after it, which is how you compare neighbours:

```kotlin
listOf(1, 2, 3, 4).zipWithNext()            // [(1, 2), (2, 3), (3, 4)]
listOf(1, 2, 3).zipWithNext().all { (a, b) -> a <= b }   // true — "is it sorted?"
listOf(1).zipWithNext()                     // [] — n elements give n-1 pairs
```

A list of one or zero elements yields no pairs at all, so predicates written over `zipWithNext` are naturally `true` for the short cases without a special branch.

## Finding and testing

```kotlin
val words = listOf("apple", "fig", "banana", "kiwi")

words.first()                   // "apple"
words.first { it.length == 3 }  // "fig" — throws NoSuchElementException if nothing matches
words.firstOrNull { it.length == 9 }   // null
words.find { it.startsWith("b") }      // "banana", an alias for firstOrNull
words.last { it.length == 4 }          // "kiwi"
words.indexOfFirst { it.length == 3 }  // 1, or -1

words.any { it.length > 5 }     // true
words.all { it.isNotEmpty() }   // true
words.none { it.isEmpty() }     // true
words.count { it.length == 4 }  // 1
```

The rule of thumb: the plain names throw when there is nothing to return, and the `...OrNull` names give you a `null` to handle. Prefer the `OrNull` form and deal with the empty case deliberately — `firstOrNull()?.length ?: 0` is a complete answer in one line.

`any()`, `none()` and `count()` also work with no lambda at all, as emptiness checks and a size.

## Aggregating

```kotlin
val prices = listOf(3, 11, 7)

prices.sum()                    // 21
prices.average()                // 7.0 — a Double
prices.maxOrNull()              // 11, null on an empty list
words.sumOf { it.length }       // 18 — sum of a computed value
words.maxByOrNull { it.length } // "banana" — the element, not the length
words.minByOrNull { it.length } // "fig"
words.joinToString(", ")        // "apple, fig, banana, kiwi"
```

`maxByOrNull` returns the **first** element that achieves the maximum, so ties go to whichever came earlier in the list. That is worth remembering, because it makes the result depend on the input order.

When nothing more specific fits, `fold` carries an accumulator through the collection:

```kotlin
prices.fold(0) { acc, n -> acc + n }         // 21
words.fold("") { acc, w -> acc + w.first() } // "afbk"
prices.runningFold(0) { acc, n -> acc + n }  // [0, 3, 14, 21] — every step, including the seed
prices.reduce { acc, n -> acc + n }          // 21, but throws on an empty list
```

`fold` takes a starting value and is safe on an empty collection; `reduce` starts from the first element and has nothing to start from when there isn't one.

## Grouping and partitioning

```kotlin
words.groupBy { it.length }
// {5=[apple], 3=[fig], 6=[banana], 4=[kiwi]}

words.groupBy({ it.first() }, { it.uppercase() })
// {a=[APPLE], f=[FIG], b=[BANANA], k=[KIWI]}   — key selector, then value selector

words.associateWith { it.length }   // {apple=5, fig=3, banana=6, kiwi=4}
words.associateBy { it.first() }    // {a=apple, f=fig, b=banana, k=kiwi}

val (short, long) = words.partition { it.length <= 4 }   // ([fig, kiwi], [apple, banana])

words.groupingBy { it.first() }.eachCount()   // {a=1, f=1, b=1, k=1}
```

`groupBy` returns a `Map<K, List<V>>` and keeps every element; the lists hold their elements in the original order, and the map itself is a `LinkedHashMap`, so iterating it follows first-appearance order. `associateBy` returns a `Map<K, V>` and keeps only the **last** element per key, silently dropping earlier ones — use it only when the key is unique.

`groupingBy { }.eachCount()` is the idiomatic word-count: it counts without building the intermediate lists.

## Sorting

```kotlin
words.sorted()                        // natural order: [apple, banana, fig, kiwi]
words.sortedBy { it.length }          // [fig, kiwi, apple, banana]
words.sortedByDescending { it.length }
words.sortedWith(compareBy({ it.length }, { it }))   // by length, then alphabetically
```

For more than one key, `compareBy` and its friends build the comparator:

```kotlin
val ranking = compareByDescending<String> { it.length }.thenBy { it }
words.sortedWith(ranking)             // [banana, apple, kiwi, fig]
```

`thenBy` only ever breaks ties left by the comparator before it, so the order of the keys is the order of importance. All of these are stable: elements that compare equal keep their relative order. And all of them return a new list — `sorted()` on a read-only `List` cannot sort in place, while `sortBy` (no `ed`) on a `MutableList` does.

To compare two values directly rather than build a comparator, `compareValuesBy` takes the pair and the keys and returns the `Int` that `compareTo` is defined to return:

```kotlin
compareValuesBy(a, b, { it.major }, { it.minor }, { it.patch })
```

Negative means `a` comes first, zero means they tie, positive means `b` does. That one line is usually the whole body of an `override fun compareTo`.

## Sequences: doing it lazily

Each step in a chain of list operations builds a whole intermediate list. For short collections that is free. For long ones, or when you only want the first few results, `asSequence()` switches to lazy evaluation: elements flow through the whole chain one at a time, and nothing runs until a terminal operation like `toList`, `first` or `sum` pulls them.

```kotlin
val firstBig = (1..1_000_000).asSequence()
    .map { it * it }
    .filter { it % 7 == 0 }
    .first()          // stops after a handful of elements
```

Written without `asSequence()`, that would square a million numbers first. The API is otherwise identical, so this is a one-word change when profiling says you need it — and only then.

Two things about that laziness are worth having burned in. First, a chain with no terminal operation does **nothing at all** — no `map` lambda runs, no `println` inside one prints, and a chain you forgot to finish looks exactly like a chain that found nothing. Second, the work happens element by element rather than stage by stage, so a side effect inside `map` no longer runs for every element before `filter` sees any of them. Keep sequence lambdas pure and the difference stops mattering.

```kotlin
val lazy = (1..3).asSequence().map { println("mapping $it"); it }   // prints nothing
lazy.toList()                                                      // now it prints
```

## Read-only, not immutable

`listOf` returns a `List`, an interface with no mutating methods, while `mutableListOf` returns a `MutableList`. Every operation in this module returns a new read-only list and leaves its receiver alone, which is why chains are safe to read: nothing in the middle of one can change what an earlier step produced.

"Read-only" is not the same as "immutable": a `List` can be a view of a `MutableList` that somebody else still holds. Returning `list.toList()` makes a copy when that matters.

```kotlin playground
fun main() {
    val log = listOf(
        "INFO  12 login ok",
        "WARN  95 slow query",
        "INFO   8 render",
        "ERROR 40 timeout",
        "INFO  22 login ok",
        "WARN 120 slow query",
    )

    val entries = log.map { it.trim().split(Regex("\\s+"), limit = 3) }

    // counting by a key
    println(entries.groupingBy { it[0] }.eachCount())

    // filter, map, aggregate
    val slow = entries.filter { it[1].toInt() > 30 }
    println("slow: ${slow.joinToString(" | ") { "${it[2]} (${it[1]}ms)" }}")

    // an aggregate per group
    val avgByLevel = entries.groupBy { it[0] }.mapValues { (_, rows) -> rows.sumOf { it[1].toInt() } / rows.size }
    println("average ms: $avgByLevel")

    // sorting on two keys: slowest first, then alphabetically
    val ranked = entries.sortedWith(compareByDescending<List<String>> { it[1].toInt() }.thenBy { it[2] })
    println(ranked.take(3).map { it[2] })

    // the OrNull family, and the list we started from
    println(entries.firstOrNull { it[0] == "FATAL" }?.get(2) ?: "no fatal errors")
    println("still ${log.size} lines")
}
```

## Exercises

### 1. Squares of the even numbers

`evenSquares(numbers)` returns the squares of the even numbers, in the order they appeared. Zero is even. The input list is not modified.

```kotlin starter
fun evenSquares(numbers: List<Int>): List<Int> {
    return numbers
}
```

```kotlin test
class EvenSquaresTest {
    // keeps the evens and squares them
    @Test
    fun squares() {
        assertEquals(listOf(4, 16, 36), evenSquares(listOf(1, 2, 3, 4, 5, 6)))
        assertEquals(listOf(64), evenSquares(listOf(7, 8, 9)))
    }

    // order is the input order, and zero and negatives count
    @Test
    fun orderAndSigns() {
        assertEquals(listOf(36, 4, 16), evenSquares(listOf(6, 2, 4)))
        assertEquals(listOf(4, 0), evenSquares(listOf(-2, 0, 7)))
        assertEquals(listOf(16), evenSquares(listOf(-3, -4, 5, -1)))
    }

    // empty when nothing is even
    @Test
    fun nothing() {
        assertEquals(emptyList<Int>(), evenSquares(listOf(1, 3, 5)))
        assertEquals(emptyList<Int>(), evenSquares(listOf(-7)))
        assertEquals(emptyList<Int>(), evenSquares(emptyList()))
    }

    // the input is left alone
    @Test
    fun doesNotMutate() {
        val input = mutableListOf(1, 2, 3)
        assertEquals(listOf(4), evenSquares(input))
        assertEquals(listOf(1, 2, 3), input)
    }
}
```

#### Uses
- [Collection operations › Transforming: map and filter](#/collection-ops/transforming-map-and-filter)
- [Lambdas › `it` and the trailing lambda](#/lambdas/it-and-the-trailing-lambda)

#### Hints
- Two steps chained: keep what you want with `filter`, then change it with `map`.
- `it % 2 == 0` is true for evens, and true for `0` and `-2` as well.

#### Tips
- `filter` before `map` does less work than `map` before `filter`, and here it is also the only order that gives the right answer.
- `it % 2 == 0` is true for `0` and for `-2` as well. The tests include both.
- Every operator here returns a new list; the input is never modified, which is what makes a chain safe to read top to bottom.

#### Docs
- [Filtering collections](https://kotlinlang.org/docs/collection-filtering.html)
- [Mapping](https://kotlinlang.org/docs/collection-transformations.html#map)

### 2. The longest word

`longestWord(words)` returns the longest word, or `null` when the list is empty. If several words tie for longest, return the one that comes first in the list.

```kotlin starter
fun longestWord(words: List<String>): String? {
    return words.firstOrNull()
}
```

```kotlin test
class LongestWordTest {
    // finds the longest
    @Test
    fun longest() {
        assertEquals("banana", longestWord(listOf("fig", "banana", "kiwi")))
        assertEquals("elephant", longestWord(listOf("elephant", "cat")))
        assertEquals("a", longestWord(listOf("a")))
    }

    // ties go to the earlier word
    @Test
    fun ties() {
        assertEquals("fig", longestWord(listOf("fig", "cat", "ox")))
        assertEquals("cat", longestWord(listOf("ox", "cat", "fig")))
        assertEquals("aa", longestWord(listOf("aa", "bb", "c")))
    }

    // empty list, and empty strings
    @Test
    fun edges() {
        assertNull(longestWord(emptyList()))
        assertEquals("", longestWord(listOf("", "")))
        assertEquals("x", longestWord(listOf("", "x", "")))
    }
}
```

#### Uses
- [Collection operations › Aggregating](#/collection-ops/aggregating)
- [Collection operations › Finding and testing](#/collection-ops/finding-and-testing)

#### Hints
- `maxByOrNull` takes a lambda that turns each element into something comparable, and returns the *element*.
- The thing to compare here is `it.length`.
- `maxByOrNull` already returns `null` for an empty list and already keeps the first of several equal maxima, so both of the edge cases are handled for you.

#### Tips
- `maxOfOrNull { it.length }` would give you `6` instead of `"banana"`. `maxBy...` picks an element, `maxOf...` picks a value.
- Ties go to the **first** element that achieves the maximum, so the answer depends on the input order. The tests rely on that.
- The `...OrNull` name is what makes the empty case a value instead of a `NoSuchElementException`.

#### Docs
- [maxByOrNull](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/max-by-or-null.html)

### 3. Running totals

`runningTotals(values)` returns the total after each value: `[3, 1, 4]` becomes `[3, 4, 8]`. The result has exactly as many items as the input, so an empty list gives an empty list — the starting `0` is not part of the output.

```kotlin starter
fun runningTotals(values: List<Int>): List<Int> {
    return values
}
```

```kotlin test
class RunningTotalsTest {
    // each item is the total so far
    @Test
    fun totals() {
        assertEquals(listOf(3, 4, 8), runningTotals(listOf(3, 1, 4)))
        assertEquals(listOf(1, 3, 6, 10), runningTotals(listOf(1, 2, 3, 4)))
    }

    // negatives and zeros are just added in
    @Test
    fun signs() {
        assertEquals(listOf(5, 3, 3, -7), runningTotals(listOf(5, -2, 0, -10)))
        assertEquals(listOf(0, 0, 0), runningTotals(listOf(0, 0, 0)))
    }

    // the result is the same length as the input
    @Test
    fun length() {
        assertEquals(emptyList<Int>(), runningTotals(emptyList()))
        assertEquals(listOf(7), runningTotals(listOf(7)))
        assertEquals(5, runningTotals(listOf(1, 1, 1, 1, 1)).size)
        assertEquals(listOf(1, 2, 3, 4, 5), runningTotals(listOf(1, 1, 1, 1, 1)))
    }

    // the last total is the sum of everything
    @Test
    fun endsAtTheSum() {
        assertEquals(10, runningTotals(listOf(2, 3, 5)).last())
        assertEquals(-1, runningTotals(listOf(-4, 3)).last())
    }
}
```

#### Uses
- [Collection operations › Aggregating](#/collection-ops/aggregating)
- [Lambdas › Higher-order functions](#/lambdas/higher-order-functions)

#### Hints
- `fold` carries an accumulator along; `runningFold` returns every accumulator it passed through.
- `values.runningFold(0) { acc, n -> acc + n }` gives `[0, 3, 4, 8]` — one item too many. `drop(1)` removes the seed.
- `runningReduce { acc, n -> acc + n }` does the same thing without a seed, and returns an empty list for an empty input.

#### Tips
- A `var total = 0` and a loop is a perfectly good answer too. Write both and see which one you would rather read in a year.
- `runningFold` includes the seed, so its result is one longer than the input; `runningReduce` does not, and gives `[]` for an empty input.
- `fold` is safe on an empty collection and `reduce` throws, for the same reason: `reduce` has no starting value to hand back.

#### Docs
- [runningFold](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/running-fold.html)

### 4. Group by length

`groupByLength(words)` returns a map from a word's length to all the words of that length, in the order they appeared in the input. Lengths with no words simply do not appear as keys, and an empty list gives an empty map. Duplicates are kept.

```kotlin starter
fun groupByLength(words: List<String>): Map<Int, List<String>> {
    return emptyMap()
}
```

```kotlin test
class GroupByLengthTest {
    // groups words under their length
    @Test
    fun groups() {
        assertEquals(
            mapOf(3 to listOf("fig", "ant"), 6 to listOf("banana")),
            groupByLength(listOf("fig", "banana", "ant")),
        )
        assertEquals(mapOf(1 to listOf("a", "b", "c")), groupByLength(listOf("a", "b", "c")))
    }

    // words keep their input order inside a group
    @Test
    fun orderInsideGroups() {
        assertEquals(listOf("kiwi", "lime", "pear"), groupByLength(listOf("kiwi", "fig", "lime", "pear"))[4])
        assertEquals(listOf("ox", "ax"), groupByLength(listOf("ox", "cat", "ax"))[2])
    }

    // duplicates are kept, and the empty string has length 0
    @Test
    fun duplicatesAndEmpty() {
        assertEquals(mapOf(2 to listOf("hi", "hi")), groupByLength(listOf("hi", "hi")))
        assertEquals(mapOf(0 to listOf(""), 1 to listOf("x")), groupByLength(listOf("", "x")))
    }

    // no words, no keys
    @Test
    fun nothing() {
        assertEquals(emptyMap<Int, List<String>>(), groupByLength(emptyList()))
        assertEquals(1, groupByLength(listOf("only")).size)
        assertNull(groupByLength(listOf("only"))[3])
    }
}
```

#### Uses
- [Collection operations › Grouping and partitioning](#/collection-ops/grouping-and-partitioning)
- [Collection operations › Transforming: map and filter](#/collection-ops/transforming-map-and-filter)
- [Collections › Maps](#/collections/maps)

#### Hints
- `groupBy` takes a lambda that produces the key for each element and returns exactly a `Map<K, List<V>>`.
- The key here is `it.length`.
- `associateBy` looks similar but keeps only one word per key — that is not what this asks for.

#### Tips
- The map `groupBy` returns preserves insertion order, so the keys come out in the order their first member appeared. That is why the expected maps above read the way they do.
- `groupBy` on an empty list gives `emptyMap()`, which is exactly what the tests expect — no branch needed.
- `associateBy` keeps only the last element per key and silently drops the others. Use it only when the key is genuinely unique.

#### Docs
- [groupBy](https://kotlinlang.org/docs/collection-grouping.html)

### 5. Top words

`topWords(text, n)` returns the `n` most frequent words in `text`, most frequent first. Words are separated by any whitespace and compared without case, and the results come back lowercased. Words that occur equally often are ordered alphabetically. If `text` holds fewer than `n` distinct words you get all of them, and `n = 0` gives an empty list.

```kotlin starter
fun topWords(text: String, n: Int): List<String> {
    return text.split(" ").take(n)
}
```

```kotlin test
class TopWordsTest {
    // most frequent first
    @Test
    fun frequency() {
        assertEquals(listOf("the"), topWords("the quick the lazy the dog", 1))
        assertEquals(listOf("the", "fox"), topWords("the fox the fox the bird", 2))
        assertEquals(listOf("a", "b"), topWords("b a a b a", 2))
    }

    // case is ignored and results are lowercase
    @Test
    fun caseInsensitive() {
        assertEquals(listOf("the"), topWords("The the THE cat", 1))
        assertEquals(listOf("dog", "cat"), topWords("Dog DOG cat", 2))
    }

    // ties are broken alphabetically
    @Test
    fun ties() {
        assertEquals(listOf("ant", "bee", "cow"), topWords("cow bee ant", 3))
        assertEquals(listOf("zebra", "ant"), topWords("zebra zebra ant cow", 2))
        assertEquals(listOf("ant", "cow"), topWords("ant cow zebra zebra", 3).drop(1))
    }

    // any whitespace separates words
    @Test
    fun whitespace() {
        assertEquals(listOf("a", "b", "c"), topWords("a\tb\nc", 3))
        assertEquals(listOf("hi"), topWords("   hi   ", 5))
    }

    // asking for too many, or for none
    @Test
    fun counts() {
        assertEquals(listOf("one", "two"), topWords("two one two one", 9))
        assertEquals(emptyList<String>(), topWords("a b c", 0))
        assertEquals(emptyList<String>(), topWords("", 3))
        assertEquals(emptyList<String>(), topWords("   ", 3))
    }
}
```

#### Uses
- [Collection operations › Grouping and partitioning](#/collection-ops/grouping-and-partitioning)
- [Collection operations › Sorting](#/collection-ops/sorting)
- [Collection operations › Transforming: map and filter](#/collection-ops/transforming-map-and-filter)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)

#### Hints
- Split with `text.split(Regex("\\s+"))`, then drop the empty pieces that leading or trailing whitespace leaves behind, and lowercase what is left.
- `groupingBy { it }.eachCount()` gives you a `Map<String, Int>` of counts.
- Sort the map's `entries` with `compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key }`, then `take(n)` and `map { it.key }`.

#### Tips
- Sorting a `Map` means sorting `map.entries`, which is a collection like any other; `it.key` and `it.value` get at the two halves.
- Settle every tie. A comparator that leaves two words equal lets their order depend on the input, and the test that checks alphabetical tie-breaking will catch it.
- Splitting on whitespace leaves empty strings when the text has leading or trailing spaces; `filter { it.isNotEmpty() }` removes them.

#### Docs
- [eachCount](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/each-count.html)
- [compareByDescending](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.comparisons/compare-by-descending.html)
