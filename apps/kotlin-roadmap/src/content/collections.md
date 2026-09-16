# Collections

Kotlin's collections come in three shapes — `List`, `Set` and `Map` — and each comes in two flavours: a read-only view and a mutable one. There is no separate "immutable" library and no `ArrayList` in your face; `listOf(...)` gives you a list, `mutableListOf(...)` gives you one you can add to.

This module is the data structures themselves and what you can do with them by hand. The one-line transformations — `map`, `filter`, `sumOf` and friends — need lambdas, so they have their own module later.

## Lists

A `List` is an ordered sequence, indexed from zero, that may hold duplicates.

```kotlin
val names = listOf("Ada", "Grace", "Barbara")
names[0]              // "Ada"
names.size            // 3
names.first()         // "Ada"
names.last()          // "Barbara"
names.indexOf("Grace")// 1, or -1 when it is not there
"Ada" in names        // true
names.isEmpty()       // false
```

The element type is inferred: `listOf("Ada")` is a `List<String>`, and `listOf(1, 2)` is a `List<Int>`. Write it yourself when the list starts empty, since there is nothing to infer from: `val empty = listOf<String>()`, or `emptyList<String>()`.

Indexing out of bounds throws `IndexOutOfBoundsException`. `names.getOrNull(9)` gives `null` instead, and `names.getOrElse(9) { "?" }` gives a fallback.

## Read-only and mutable

`listOf` returns a `List`, which has no `add` or `set`. `mutableListOf` returns a `MutableList`, which does:

```kotlin
val queue = mutableListOf("a", "b")
queue.add("c")            // [a, b, c]
queue.addAll(listOf("d")) // [a, b, c, d] — every element of another collection
queue.add(0, "start")     // [start, a, b, c, d]
queue[1] = "A"            // replaces
queue.remove("b")         // by value
queue.removeAt(0)         // by index
queue.clear()
```

`addAll` copies the elements across; the two lists are separate from then on, and changing one does not touch the other.

Note that `val queue = mutableListOf(...)` is normal: `val` stops you reassigning the *name*, not changing the object it points at.

A `MutableList` *is* a `List`, so passing one to something expecting a `List` works, and that parameter simply cannot modify it. It is a read-only view, not a guarantee of immutability — whoever holds the mutable reference can still change it under you. `list.toList()` takes a copy when you need a real snapshot.

## Sets

A `Set` holds each element once and answers `in` fast. `setOf` preserves insertion order when you iterate it.

```kotlin
val tags = setOf("kotlin", "jvm", "kotlin")   // [kotlin, jvm]
tags.size                                     // 2
"jvm" in tags                                 // true

val seen = mutableSetOf<String>()
seen.add("a")      // true  — it was new
seen.add("a")      // false — it was already there
```

That `Boolean` from `add` is useful: it tells you whether you had seen the element before, which saves a separate `contains` check.

Sets support union, intersection and difference with infix words:

```kotlin
setOf(1, 2, 3) intersect setOf(2, 3, 4)   // [2, 3]
setOf(1, 2) union setOf(2, 3)             // [1, 2, 3]
setOf(1, 2, 3) subtract setOf(2)          // [1, 3]
```

`list.toSet()` drops duplicates, and `list.distinct()` does the same but hands back a `List` with the original order.

## Maps

A `Map` associates keys with values. `to` builds a pair, and `mapOf` collects them:

```kotlin
val ages = mapOf("Ada" to 36, "Grace" to 85)
ages["Ada"]            // 36
ages["Nobody"]         // null — the lookup type is Int?
ages.size              // 2
"Ada" in ages          // true, the same as ages.containsKey("Ada")
ages.keys              // a Set of keys
ages.values            // a Collection of values
```

Look-up returns a nullable, because the key may not be there. Supply a fallback with `?:`, or ask for one directly:

```kotlin
val age = ages["Nobody"] ?: 0
val same = ages.getOrDefault("Nobody", 0)
```

A `MutableMap` can be written to with index assignment:

```kotlin
val counts = mutableMapOf<String, Int>()
counts["a"] = 1
counts["a"] = (counts["a"] ?: 0) + 1   // the counting idiom
counts.remove("a")
```

Keys are unique: assigning to an existing key replaces its value. `mutableMapOf` keeps insertion order, so iterating a map you built yourself is predictable.

A few more you will need, including how to start from nothing and how to copy:

```kotlin
emptyMap<String, Int>()        // {} — when there is nothing to infer the types from
ages.getValue("Ada")           // 36, throwing NoSuchElementException if the key is absent
counts.getOrPut("a") { 0 }     // read it, or compute and store it in one call
ages.toMutableMap()            // a mutable COPY — the original is untouched
listOf("a" to 1).toMap()       // {a=1} — a read-only map from pairs
counts.toMap()                 // a read-only copy of a MutableMap
ages.mapValues { it.value + 1 }// {Ada=37, Grace=86} — a new map, same keys
```

`getValue` is the one to reach for after you have already checked `key in map`: it hands back a non-null value, where `map[key]` always gives you a nullable to unwrap again. `getOrPut` is the counting idiom's shorter cousin, with one catch — it cannot cache a `null`, because a stored `null` is indistinguishable from a missing key.

## Looping over collections

`for` walks any collection. For a map, each element is an entry that can be destructured into its key and value:

```kotlin
for (name in names) println(name)
for (i in names.indices) println("$i: ${names[i]}")
for ((i, name) in names.withIndex()) println("$i: $name")
for ((name, age) in ages) println("$name is $age")
for (entry in ages) println("${entry.key} is ${entry.value}")
```

You cannot add to or remove from a collection while a `for` is walking it — that throws `ConcurrentModificationException`. Collect what you want into a second list and apply it afterwards.

## Everyday operations

These need no lambdas, and cover a surprising amount of ground:

```kotlin
val n = listOf(3, 1, 2)
n.sum()                    // 6
n.average()                // 2.0, a Double
n.min(); n.max()           // 1, 3 — both throw if the list is empty
n.minOrNull(); n.maxOrNull()  // 1, 3 — or null for an empty list
n.sorted()                 // [1, 2, 3] — a new list, the original is untouched
n.sortedDescending()       // [3, 2, 1]
n.reversed()               // [2, 1, 3]
n.contains(2)              // true
n.joinToString(", ")       // "3, 1, 2"
n + 4                      // [3, 1, 2, 4] — a new list
n.take(2); n.drop(1)       // [3, 1]; [1, 2]
listOf("a", "b").joinToString(separator = "", prefix = "<", postfix = ">")  // "<ab>"
```

Strings turn into collections and back: `"a,b".split(",")` gives `["a", "b"]`, `text.toCharArray()` and `text.toList()` give the characters, and `chars.joinToString("")` puts them back together.

## Arrays

An `Array<T>` is the JVM's fixed-size array. You need one for `vararg` parameters and for Java interop; otherwise prefer `List`.

```kotlin
val a = arrayOf(1, 2, 3)
val ints = intArrayOf(1, 2, 3)   // no boxing, use for numbers
a[0] = 9                          // elements are always mutable
a.size                            // fixed at creation
a.toList()                        // back to a List
```

Arrays do not have value equality: `arrayOf(1) == arrayOf(1)` is `false`. Use `contentEquals`, or just use lists.

```kotlin playground
fun main() {
    val orders = listOf("latte", "mocha", "latte", "tea", "mocha", "latte")

    val counts = mutableMapOf<String, Int>()
    for (drink in orders) counts[drink] = (counts[drink] ?: 0) + 1
    for ((drink, n) in counts) println("$drink: ${"#".repeat(n)} ($n)")

    val menu = orders.toSet()
    println("menu:      ${menu.joinToString(", ")}")
    println("distinct:  ${menu.size} of ${orders.size} orders")
    println("alphabetical: ${orders.sorted().joinToString(" ")}")

    val hot = setOf("tea", "mocha", "cocoa")
    println("both hot and ordered: ${(menu intersect hot).joinToString(", ")}")
    println("ordered but not hot:  ${(menu subtract hot).joinToString(", ")}")

    val sizes = mutableListOf(12, 16, 8)
    sizes.add(20)
    sizes.remove(8)
    println("cup sizes $sizes: total ${sizes.sum()}, largest ${sizes.max()}, average ${sizes.average()}")

    // Try: swap mutableMapOf for mutableSetOf and count how many drinks you have seen twice.
}
```

## Exercises

### 1. Summary line

`summary(numbers)` returns a one-line report of a list of numbers in the form `"sum=6 min=1 max=3"`. An empty list has nothing to report, so return `"empty"` for it.

```kotlin starter
fun summary(numbers: List<Int>): String {
    return "sum=0 min=0 max=0"
}
```

```kotlin test
class SummaryTest {
    // several numbers
    @Test
    fun several() {
        assertEquals("sum=6 min=1 max=3", summary(listOf(1, 2, 3)))
        assertEquals("sum=6 min=1 max=3", summary(listOf(3, 1, 2)))
        assertEquals("sum=25 min=4 max=11", summary(listOf(10, 4, 11)))
    }

    // one number is its own min and max
    @Test
    fun single() {
        assertEquals("sum=5 min=5 max=5", summary(listOf(5)))
        assertEquals("sum=0 min=0 max=0", summary(listOf(0)))
        assertEquals("sum=4 min=2 max=2", summary(listOf(2, 2)))
    }

    // negatives, and nothing at all
    @Test
    fun edges() {
        assertEquals("empty", summary(listOf()))
        assertEquals("sum=-6 min=-3 max=-1", summary(listOf(-1, -2, -3)))
        assertEquals("sum=0 min=-5 max=5", summary(listOf(5, -5)))
    }
}
```

#### Uses
- [Collections › Lists](#/collections/lists)
- [Collections › Everyday operations](#/collections/everyday-operations)
- [Variables & types › Strings and characters](#/basics/strings-and-characters)

#### Hints
- Deal with the empty list first: `if (numbers.isEmpty()) return "empty"`.
- After that guard, `numbers.sum()`, `numbers.min()` and `numbers.max()` are all safe — they only throw on an empty list.
- Build the line with a template: `"sum=${...} min=${...} max=${...}"`, with single spaces between the parts.

#### Tips
- `min()` and `max()` on a `List<Int>` return an `Int`. `minOrNull()` and `maxOrNull()` return `Int?` and would leave you handling null a second time.
- Guard the empty case with an early `return`, and the compiler stops asking about it for the rest of the function.
- `sum()` on an empty list is `0`, not an error — it is only `min()` and `max()` that have nothing to return.

#### Docs
- [Aggregate operations](https://kotlinlang.org/docs/collection-aggregate.html)

### 2. Tally

`tally(words)` counts how often each word appears and returns a `Map<String, Int>`. `tally(listOf("a", "b", "a"))` is `{a=2, b=1}`. An empty list gives an empty map, and words are counted exactly as given — `"A"` and `"a"` are different words.

```kotlin starter
fun tally(words: List<String>): Map<String, Int> {
    return mapOf()
}
```

```kotlin test
class TallyTest {
    // counts repeats
    @Test
    fun counts() {
        assertEquals(mapOf("a" to 2, "b" to 1), tally(listOf("a", "b", "a")))
        assertEquals(mapOf("x" to 3), tally(listOf("x", "x", "x")))
        assertEquals(mapOf("a" to 1, "b" to 1, "c" to 1), tally(listOf("a", "b", "c")))
    }

    // nothing to count
    @Test
    fun empty() {
        assertEquals(mapOf<String, Int>(), tally(listOf()))
        assertEquals(0, tally(listOf()).size)
        assertEquals(mapOf("" to 2), tally(listOf("", "")))
    }

    // case matters, and the totals add up
    @Test
    fun exact() {
        assertEquals(mapOf("A" to 1, "a" to 2), tally(listOf("a", "A", "a")))
        val many = tally(listOf("to", "be", "or", "not", "to", "be"))
        assertEquals(4, many.size)
        assertEquals(2, many["to"])
        assertEquals(2, many["be"])
        assertEquals(1, many["or"])
        assertNull("a word that never appeared has no entry", many["To"])
    }
}
```

#### Uses
- [Collections › Maps](#/collections/maps)
- [Collections › Looping over collections](#/collections/looping-over-collections)
- [Control flow › `for`](#/control-flow/for)

#### Hints
- Start from `val counts = mutableMapOf<String, Int>()` and walk the words with a `for`.
- A key that is not there yet looks up as `null`, so the count for a new word starts from a fallback: `counts[w] = (counts[w] ?: 0) + 1`.
- `counts.getOrDefault(w, 0) + 1` says the same thing without the `?:`.

#### Tips
- Returning the `MutableMap` as a `Map` is fine — a `MutableMap` is a `Map`. Return `counts.toMap()` if you want the caller to hold a copy instead.
- A map lookup is always nullable, because the key may be absent. `counts[w] ?: 0` is the whole of the counting idiom.
- `mutableMapOf` keeps insertion order, which is why the expected maps in the tests read in first-appearance order.

#### Docs
- [Maps](https://kotlinlang.org/docs/map-operations.html)

### 3. Duplicates

`duplicates(items)` returns the items that appear more than once, each listed once, in the order they first appear in the input. `duplicates(listOf("b", "a", "b", "c", "a", "b"))` is `["b", "a"]`. With no repeats the result is empty.

```kotlin starter
fun duplicates(items: List<String>): List<String> {
    return items
}
```

```kotlin test
class DuplicatesTest {
    // repeated items, in first-appearance order
    @Test
    fun repeats() {
        assertEquals(listOf("b", "a"), duplicates(listOf("b", "a", "b", "c", "a", "b")))
        assertEquals(listOf("a"), duplicates(listOf("a", "a")))
        assertEquals(listOf("x", "y"), duplicates(listOf("x", "y", "x", "y")))
    }

    // each duplicate appears once in the result
    @Test
    fun oncePerItem() {
        assertEquals(listOf("a"), duplicates(listOf("a", "a", "a", "a")))
        assertEquals(1, duplicates(listOf("z", "z", "z")).size)
        assertEquals(listOf("a", "b"), duplicates(listOf("a", "b", "a", "b", "a", "b")))
    }

    // nothing repeats, or nothing at all
    @Test
    fun noRepeats() {
        assertEquals(listOf<String>(), duplicates(listOf("a", "b", "c")))
        assertEquals(listOf<String>(), duplicates(listOf("only")))
        assertEquals(listOf<String>(), duplicates(listOf()))
    }
}
```

#### Uses
- [Collections › Sets](#/collections/sets)
- [Collections › Read-only and mutable](#/collections/read-only-and-mutable)
- [Collections › Looping over collections](#/collections/looping-over-collections)

#### Hints
- Two collections do it in one pass: a `MutableSet` of everything seen so far, and a `MutableList` of the answer.
- `seen.add(item)` returns `false` when the item was already there — that is exactly "this is a repeat".
- A third set, or a check that the item is not already in the result list, stops the third `"b"` from being added twice.

#### Tips
- The result keeps first-appearance order, so build a `MutableList` rather than a `Set` — a `Set` would be right about membership but you would be relying on its iteration order.
- `seen.add(x)` does the membership test and the insert in one call, so you never need a `contains` beside it.
- An item seen three times must appear in the result once. That is the case a single `seen` set gets wrong.

#### Docs
- [Set-specific operations](https://kotlinlang.org/docs/set-operations.html)

### 4. Merge tallies

`merge(a, b)` combines two `Map<String, Int>`s by adding the values of keys they share. Keys only in one map come through unchanged. The result contains every key from either map.

```kotlin starter
fun merge(a: Map<String, Int>, b: Map<String, Int>): Map<String, Int> {
    return a
}
```

```kotlin test
class MergeTest {
    // shared keys add up
    @Test
    fun shared() {
        assertEquals(mapOf("a" to 3), merge(mapOf("a" to 1), mapOf("a" to 2)))
        assertEquals(mapOf("a" to 3, "b" to 7), merge(mapOf("a" to 1, "b" to 3), mapOf("a" to 2, "b" to 4)))
    }

    // keys from only one side survive
    @Test
    fun unshared() {
        assertEquals(mapOf("a" to 1, "b" to 2), merge(mapOf("a" to 1), mapOf("b" to 2)))
        assertEquals(mapOf("a" to 1, "b" to 2, "c" to 4), merge(mapOf("a" to 1, "c" to 4), mapOf("b" to 2)))
        val out = merge(mapOf("x" to 1, "y" to 2), mapOf("y" to 3, "z" to 4))
        assertEquals(3, out.size)
        assertEquals(1, out["x"])
        assertEquals(5, out["y"])
        assertEquals(4, out["z"])
    }

    // empty maps, zeros and negatives
    @Test
    fun edges() {
        assertEquals(mapOf("a" to 1), merge(mapOf("a" to 1), mapOf()))
        assertEquals(mapOf("a" to 1), merge(mapOf(), mapOf("a" to 1)))
        assertEquals(mapOf<String, Int>(), merge(mapOf(), mapOf()))
        assertEquals(mapOf("a" to 0), merge(mapOf("a" to 2), mapOf("a" to -2)))
    }
}
```

#### Uses
- [Collections › Maps](#/collections/maps)
- [Collections › Looping over collections](#/collections/looping-over-collections)
- [Collections › Read-only and mutable](#/collections/read-only-and-mutable)

#### Hints
- Start from a mutable copy of `a`: `val out = a.toMutableMap()`. That gives you every key from the first map for free.
- Walk `b` with a destructuring loop: `for ((key, value) in b) { ... }`.
- For each key, add to whatever is already there: `out[key] = (out[key] ?: 0) + value`.

#### Tips
- `a.toMutableMap()` copies. Assigning into `a` directly would not compile anyway, since the parameter is a read-only `Map`.
- `for ((key, value) in b)` destructures each entry, which reads better than `entry.key` and `entry.value`.
- Keys only in `b` have to appear too, so start from a copy of `a` and add — never iterate the keys of `a` alone.

#### Docs
- [Map-specific operations](https://kotlinlang.org/docs/map-operations.html)
- [Destructuring declarations](https://kotlinlang.org/docs/destructuring-declarations.html)
