# Generics

A generic declaration is one written once and type-checked for every type you use it with. `List<String>` and `List<Int>` are the same code with a different promise attached, and the compiler keeps that promise so you never cast on the way out. Kotlin's generics are Java's — erased at runtime — with three additions that matter daily: declaration-site variance (`out` and `in`), use-site projections, and `reified` type parameters that survive erasure inside inline functions.

Everything here builds on interfaces: a type parameter is only useful when you can say something about what it can do, and that "something" is almost always an interface such as `Comparable`.

## Generic functions

Type parameters go in angle brackets before the function name. They are usually inferred at the call site.

```kotlin
fun <T> firstOrNull(items: List<T>): T? = if (items.isEmpty()) null else items[0]

firstOrNull(listOf(1, 2))        // T is Int
firstOrNull<String>(emptyList()) // spelled out when there is nothing to infer from
```

Inside the function `T` is opaque: you can pass it around, store it and compare it with `==`, but nothing more, because nothing more has been promised.

## Generic classes

A class parameterised the same way carries its type through its members.

```kotlin
class Stack<T> {
    private val items = mutableListOf<T>()
    fun push(item: T) { items.add(item) }
    fun pop(): T? = items.removeLastOrNull()
}
```

`Stack<String>().pop()` gives a `String?` with no cast. The type parameter is available everywhere in the class body, including in property types.

## Upper bounds

`<T : Comparable<T>>` says T must be comparable with itself, which unlocks `<`, `>` and `coerceIn` inside the function. Without a bound, the implicit upper bound is `Any?`.

```kotlin
fun <T : Comparable<T>> largest(items: List<T>): T? = items.maxOrNull()
```

More than one bound needs a `where` clause: `fun <T> f(x: T) where T : Comparable<T>, T : CharSequence`.

A bound of `Any` (not `Any?`) is the usual way to say "and not nullable".

## Variance: out and in

`Box<String>` is not a `Box<Any>` by default, and for a mutable box that is exactly right — otherwise you could put an `Int` in it. When a type only ever *produces* T, mark the parameter `out` and the subtyping follows the type:

```kotlin
class Box<out T>(val value: T)       // Box<String> IS a Box<Any>
```

When a type only ever *consumes* T, mark it `in`, and the subtyping runs the other way: a `Sink<Any>` is a `Sink<String>`.

The rule the compiler enforces is mechanical: an `out` parameter may not appear in an input position, and an `in` parameter may not appear in a return position. `List<out E>` is covariant and `MutableList<E>` is not, which is the whole difference between them.

## Use-site projections

When a class must stay invariant, a single parameter can still be relaxed where it is used. `List<Box<out Number>>` accepts a `Box<Int>` and a `Box<Double>` while promising only to read. `MutableList<in Int>` accepts a `MutableList<Any>` and promises only to write.

```kotlin
fun fill(target: MutableList<in Int>, count: Int) {
    repeat(count) { target.add(it) }
}
```

`Box<*>` — a star projection — means "a Box of something unknown": you can read `Any?` out of it and put nothing in.

## reified type parameters

Type arguments are erased, so a plain generic function cannot ask `value is T`. An `inline` function can: the compiler pastes the body into every call site, where the real type is known, and `reified` asks it to substitute the type there.

```kotlin
inline fun <reified T> List<Any?>.only(): List<T> = filterIsInstance<T>()
inline fun <reified T> typeNameOf(): String = T::class.simpleName ?: "?"
```

`reified` requires `inline`; that is the price of the trick.

## Generic extension functions

An extension can be generic in its receiver, which is how the standard library covers every collection at once: `fun <T> List<T>.second(): T` works on any list, and `fun <T : Comparable<T>> List<T>.isSorted(): Boolean` works on any list you can compare.

```kotlin playground
class Stack<T> {
    private val items = mutableListOf<T>()
    val size: Int get() = items.size
    fun push(item: T) { items.add(item) }
    fun pop(): T? = items.removeLastOrNull()
    fun peek(): T? = items.lastOrNull()
}

class Box<out T>(val value: T)

fun <T : Comparable<T>> largest(items: List<T>): T? = items.maxOrNull()

fun readAll(boxes: List<Box<out Number>>): List<Double> = boxes.map { it.value.toDouble() }

fun fill(target: MutableList<in Int>, count: Int) { repeat(count) { target.add(it) } }

inline fun <reified T> List<Any?>.only(): List<T> = filterIsInstance<T>()

fun main() {
    val stack = Stack<String>()
    stack.push("a")
    stack.push("b")
    println("peek=${stack.peek()} pop=${stack.pop()} size=${stack.size}")

    println(largest(listOf(3, 9, 4)))
    println(largest(listOf("pear", "apple")))
    println(largest(emptyList<Int>()))

    val any: Box<Any> = Box("covariance means this needs no cast")
    println(any.value)
    println(readAll(listOf(Box(1), Box(2.5))))

    val mixed: MutableList<Any> = mutableListOf("head")
    fill(mixed, 3)
    println(mixed)

    println(listOf("a", 1, null, "b").only<String>())
}
```

## Exercises

### 1. A stack of anything

Finish `Stack<T>`. `push` adds an item, `pop` removes and returns the most recent one, `peek` returns it without removing, and both return `null` on an empty stack. `size` counts what is in there and `isEmpty()` says whether it is empty.

`drain()` pops everything and returns it in pop order — most recent first — leaving the stack empty. Draining an empty stack gives an empty list.

```kotlin starter
class Stack<T> {
    private val items = mutableListOf<T>()

    val size: Int get() = 0

    fun push(item: T) {}

    fun pop(): T? = null

    fun peek(): T? = null

    fun isEmpty(): Boolean = true

    fun drain(): List<T> = emptyList()
}
```

```kotlin test
class StackTest {
    // last in, first out
    @Test
    fun lifo() {
        val s = Stack<Int>()
        s.push(1)
        s.push(2)
        s.push(3)
        assertEquals(3, s.pop())
        assertEquals(2, s.pop())
        assertEquals(1, s.pop())
        assertEquals(null, s.pop())
    }

    // peek leaves the item where it is
    @Test
    fun peeking() {
        val s = Stack<String>()
        assertEquals(null, s.peek())
        s.push("a")
        assertEquals("a", s.peek())
        assertEquals("a", s.peek())
        assertEquals(1, s.size)
        s.push("b")
        assertEquals("b", s.peek())
        assertEquals(2, s.size)
    }

    // size and isEmpty track the contents
    @Test
    fun counting() {
        val s = Stack<String>()
        assertTrue("a new stack is empty", s.isEmpty())
        assertEquals(0, s.size)
        s.push("x")
        assertTrue("not empty after a push", !s.isEmpty())
        assertEquals(1, s.size)
        s.pop()
        assertTrue("empty again after popping", s.isEmpty())
        assertEquals(0, s.size)
    }

    // drain empties the stack, newest first
    @Test
    fun draining() {
        val s = Stack<Int>()
        listOf(1, 2, 3).forEach { s.push(it) }
        assertEquals(listOf(3, 2, 1), s.drain())
        assertTrue("empty after draining", s.isEmpty())
        assertEquals(emptyList<Int>(), s.drain())
        s.push(9)
        assertEquals(listOf(9), s.drain())
    }

    // it holds whatever type you give it
    @Test
    fun anyType() {
        val s = Stack<List<String>>()
        s.push(listOf("a"))
        s.push(listOf("b", "c"))
        val top: List<String>? = s.pop()
        assertEquals(listOf("b", "c"), top)
        assertEquals(1, s.size)
    }
}
```

#### Uses
- [Generics › Generic classes](#/generics/generic-classes)

#### Hints
- The backing `items` list is already generic in `T`, so most members are one call: `items.add`, `items.size`, `items.isEmpty()`.
- `removeLastOrNull()` pops without throwing on an empty list, and `lastOrNull()` peeks the same way.
- `drain()` can pop in a loop, or take `items.reversed()` and then `items.clear()`.

#### Tips
- `val size: Int get() = items.size` is a computed property: no field, recalculated on each read, so it can never drift out of step.
- Keep `items` private. A generic container whose backing list leaks is no safer than the list itself.
- `removeLastOrNull()` and `lastOrNull()` return `T?`, which is the honest signature for a stack that might be empty.

#### Docs
- [Generics](https://kotlinlang.org/docs/generics.html)

### 2. Comparing any comparable

Three functions over anything that can be compared with itself.

`largest(items)` returns the biggest item, or `null` for an empty list. `clamp(value, min, max)` returns `value` pulled into the range `min..max` — you may assume `min <= max`. `isSorted(items)` says whether a list is in non-decreasing order; an empty or single-item list counts as sorted, and repeated equal items do not break it.

```kotlin starter
fun <T : Comparable<T>> largest(items: List<T>): T? = null

fun <T : Comparable<T>> clamp(value: T, min: T, max: T): T = value

fun <T : Comparable<T>> isSorted(items: List<T>): Boolean = false
```

```kotlin test
class ComparableTest {
    // largest over several types
    @Test
    fun biggest() {
        assertEquals(9, largest(listOf(3, 9, 4)))
        assertEquals(-1, largest(listOf(-7, -1, -4)))
        assertEquals("pear", largest(listOf("apple", "pear", "fig")))
        assertEquals(5, largest(listOf(5)))
        assertEquals(null, largest(emptyList<Int>()))
    }

    // clamp pulls values into range
    @Test
    fun clamping() {
        assertEquals(5, clamp(5, 1, 10))
        assertEquals(1, clamp(-3, 1, 10))
        assertEquals(10, clamp(99, 1, 10))
        assertEquals(1, clamp(1, 1, 10))
        assertEquals(10, clamp(10, 1, 10))
        assertEquals("m", clamp("z", "a", "m"))
        assertEquals("b", clamp("b", "a", "m"))
    }

    // sorted, unsorted and the trivial cases
    @Test
    fun sortedness() {
        assertTrue("ascending", isSorted(listOf(1, 2, 3)))
        assertTrue("equal items are still sorted", isSorted(listOf(2, 2, 2)))
        assertTrue("empty is sorted", isSorted(emptyList<Int>()))
        assertTrue("one item is sorted", isSorted(listOf(42)))
        assertTrue("one dip breaks it", !isSorted(listOf(1, 3, 2)))
        assertTrue("descending is not sorted", !isSorted(listOf(3, 2, 1)))
        assertTrue("the break can be at the end", !isSorted(listOf(1, 2, 3, 0)))
    }

    // strings compare too
    @Test
    fun strings() {
        assertTrue("alphabetical", isSorted(listOf("a", "b", "b", "c")))
        assertTrue("not alphabetical", !isSorted(listOf("b", "a")))
        assertEquals("a", largest(listOf("a")))
    }
}
```

#### Uses
- [Generics › Generic functions](#/generics/generic-functions)
- [Generics › Upper bounds](#/generics/upper-bounds)
- [Collection operations › Transforming: map and filter](#/collection-ops/transforming-map-and-filter)
- [Variables & types › Clamping and kotlin.math](#/basics/clamping-and-kotlin-math)

#### Hints
- The bound `T : Comparable<T>` is what makes `maxOrNull()`, `<` and `coerceIn` legal on a `T`.
- `clamp` is `value.coerceIn(min, max)`, or written out: `if (value < min) min else if (value > max) max else value`.
- `isSorted` can zip a list with itself offset by one: `items.zipWithNext().all { (a, b) -> a <= b }`, which is naturally `true` for lists shorter than two.

#### Tips
- `a < b` on any `Comparable` is compiled to `a.compareTo(b) < 0`, so operators work on your own types the moment they implement the interface.
- Without a bound, the implicit upper bound is `Any?`, and nothing but `==` and `toString()` is legal on a `T`. The bound is what unlocks `<`, `coerceIn` and `maxOrNull`.
- `zipWithNext()` on a list of fewer than two elements gives no pairs, so `isSorted` is `true` for them without a length check.

#### Docs
- [Upper bounds](https://kotlinlang.org/docs/generics.html#upper-bounds)

### 3. Variance in practice

`asAny(box)` hands a `Box<String>` back as a `Box<Any>` — the *same object*, not a copy. That only compiles if `Box` promises never to consume its type parameter, so this exercise is really about one keyword.

`readAll(boxes)` takes boxes of any kind of number and returns their values as `Double`s, in order. `fill(target, count)` appends `0, 1, ... count - 1` to a list that accepts ints, so it must work on a `MutableList<Any>` as well as a `MutableList<Int>`. A count of zero appends nothing.

```kotlin starter
class Box<T>(val value: T)

fun asAny(box: Box<String>): Box<Any> = Box("")

fun readAll(boxes: List<Box<out Number>>): List<Double> = emptyList()

fun fill(target: MutableList<in Int>, count: Int) {}
```

```kotlin test
class VarianceTest {
    // asAny returns the very same box
    @Test
    fun sameObject() {
        val b = Box("hello")
        val a: Box<Any> = asAny(b)
        assertTrue("should be the same object, not a copy", a === b)
        assertEquals("hello", a.value)

        val c = Box("")
        assertTrue("empty box too", asAny(c) === c)
        assertEquals("", asAny(c).value)
    }

    // readAll accepts a mix of number types
    @Test
    fun reading() {
        assertEquals(listOf(1.0, 2.5), readAll(listOf(Box(1), Box(2.5))))
        assertEquals(listOf(3.0, -1.0, 0.0), readAll(listOf(Box(3L), Box(-1), Box(0.0))))
        assertEquals(emptyList<Double>(), readAll(emptyList()))
    }

    // fill writes into any list that accepts ints
    @Test
    fun filling() {
        val ints = mutableListOf(9)
        fill(ints, 3)
        assertEquals(listOf(9, 0, 1, 2), ints)

        val anything: MutableList<Any> = mutableListOf("head")
        fill(anything, 2)
        assertEquals(listOf<Any>("head", 0, 1), anything)
    }

    // a count of zero changes nothing
    @Test
    fun nothingToFill() {
        val numbers: MutableList<Number> = mutableListOf()
        fill(numbers, 0)
        assertEquals(emptyList<Number>(), numbers)
        fill(numbers, 1)
        assertEquals(listOf<Number>(0), numbers)
    }
}
```

#### Uses
- [Generics › Variance: out and in](#/generics/variance-out-and-in)
- [Generics › Use-site projections](#/generics/use-site-projections)

#### Hints
- `Box` only ever hands its value out, so `class Box<out T>(val value: T)` is safe — and once it is covariant, `asAny` is `= box`.
- `readAll` reads through the projection: `boxes.map { it.value.toDouble() }`. Every `Number` has `toDouble()`.
- `fill` writes through the projection: `repeat(count) { target.add(it) }`.

#### Tips
- Try adding `fun replace(newValue: T)` to the covariant `Box` — the compiler rejects it, because a consumer position is exactly what `out` forbids.
- The rule is mechanical: an `out` parameter may not appear in an input position, an `in` parameter may not appear in a return position.
- `List<out E>` is covariant and `MutableList<E>` is not. That one difference is the whole reason both interfaces exist.

#### Docs
- [Variance](https://kotlinlang.org/docs/generics.html#variance)

### 4. Types that survive erasure

Three functions that need to know their type argument at runtime.

`typeNameOf<T>()` returns the simple name of `T`: `"String"`, `"Int"`, and `"List"` for `List<String>` — the argument inside is erased and cannot be recovered.

`only<T>()` on a list keeps the elements that are a `T`, in order; `null` is not a `T`, so nulls are always dropped. `asOrNull<T>()` returns the receiver as a `T`, or `null` if it is not one.

```kotlin starter
inline fun <reified T> typeNameOf(): String = ""

inline fun <reified T> List<Any?>.only(): List<T> = emptyList()

inline fun <reified T : Any> Any?.asOrNull(): T? = null
```

```kotlin test
class ReifiedTest {
    // the name of the type argument
    @Test
    fun names() {
        assertEquals("String", typeNameOf<String>())
        assertEquals("Int", typeNameOf<Int>())
        assertEquals("Boolean", typeNameOf<Boolean>())
        assertEquals("List", typeNameOf<List<String>>())
    }

    // only keeps matching elements, in order
    @Test
    fun filtering() {
        val mixed = listOf("a", 1, null, "b", 2.5)
        assertEquals(listOf("a", "b"), mixed.only<String>())
        assertEquals(listOf(1), mixed.only<Int>())
        assertEquals(emptyList<Boolean>(), mixed.only<Boolean>())
        assertEquals(emptyList<String>(), emptyList<Any?>().only<String>())
    }

    // nulls never match
    @Test
    fun nullsDropped() {
        assertEquals(emptyList<String>(), listOf(null, null).only<String>())
        assertEquals(listOf("x"), listOf(null, "x", null).only<String>())
        assertEquals(10, listOf<Any?>(1, null, 2, null, 3, 4).only<Int>().sum())
    }

    // asOrNull narrows or gives up
    @Test
    fun narrowing() {
        val a: Any? = "text"
        assertEquals("text", a.asOrNull<String>())
        assertEquals(null, a.asOrNull<Int>())
        assertEquals(7, (7 as Any?).asOrNull<Int>())
        assertEquals(null, (null as Any?).asOrNull<String>())
    }
}
```

#### Uses
- [Generics › reified type parameters](#/generics/reified-type-parameters)
- [Generics › Generic extension functions](#/generics/generic-extension-functions)

#### Hints
- `T::class.simpleName` is only legal because `T` is `reified`; it returns `String?`, so supply a fallback with `?:`.
- `only` is what `filterIsInstance<T>()` does; `filter { it is T }` plus a cast works too, and shows why `reified` is needed.
- `asOrNull` is `this as? T`, which is a safe cast: it returns `null` instead of throwing when the type does not match.

#### Tips
- Erasure is why `only<List<String>>()` cannot tell a list of strings from a list of ints. `reified` restores the outer type, not the arguments inside it.
- `reified` requires `inline`. The compiler pastes the body into every call site, which is the only place the real type is still known.
- `T::class.simpleName` returns `String?`, so it needs a fallback — an anonymous class has no simple name.

#### Docs
- [Reified type parameters](https://kotlinlang.org/docs/inline-functions.html#reified-type-parameters)
