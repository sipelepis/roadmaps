# Lambdas

A lambda is a function written as a value: something you can put in a variable, pass to another function, or return. Kotlin's collection library is built out of functions that take lambdas, and so is most of its DSL-flavoured API, so this is the module that unlocks the idiomatic half of the language.

Nothing here is new machinery — a lambda is an ordinary function with the ceremony removed. What is new is that functions become values with types, which means you can write functions that build other functions.

## Lambda syntax

A lambda always lives between braces. Parameters come first, then `->`, then the body. The last expression in the body is the result; there is no `return`.

```kotlin
val double = { n: Int -> n * 2 }
val add = { a: Int, b: Int -> a + b }
val shout = { s: String -> s.uppercase() + "!" }

println(double(21))     // 42
println(add(2, 3))      // 5
```

A lambda that takes nothing is just braces and a body: `val hello = { println("hi") }`. Call it like any function, `hello()`.

If Kotlin already knows what type is expected, you can drop the parameter types:

```kotlin
val nums = listOf(1, 2, 3)
nums.map { n -> n * 2 }     // n is an Int, the compiler knows
```

## `it` and the trailing lambda

Two shorthands make lambdas nearly invisible, and both are used constantly.

When a lambda has exactly one parameter you may leave it unnamed and call it `it`:

```kotlin
nums.map { it * 2 }
nums.filter { it > 1 }
```

When a lambda is the **last** argument of a call, it moves outside the parentheses. When it is the *only* argument, the parentheses disappear entirely:

```kotlin
nums.fold(0) { acc, n -> acc + n }   // fold(0, { acc, n -> ... })
repeat(3) { println("tick") }        // repeat(3, { ... })
```

That is why so much Kotlin looks like it has built-in blocks. `repeat`, `forEach` and `let` are ordinary functions whose last parameter is a lambda.

Use `it` when the lambda is one short line and the meaning is obvious. Name the parameter when the lambda is long, or when lambdas are nested and two `it`s would collide.

## Function types

A lambda's type is written with parameter types in parentheses, an arrow, and a return type:

```kotlin
val double: (Int) -> Int = { n -> n * 2 }
val add: (Int, Int) -> Int = { a, b -> a + b }
val log: (String) -> Unit = { s -> println(s) }
val now: () -> Int = { 42 }
```

`(Int) -> Int` is a real type, so it can be a parameter type, a return type, a property type, or the element type of a list: `List<(Int) -> Int>` is a list of functions. `Unit` is Kotlin's "no useful value", the equivalent of `void`; a lambda whose type ends in `-> Unit` may end with any expression, and its value is thrown away.

Declaring the type on the left lets you drop it on the right, and vice versa. One of the two sides has to say.

## Higher-order functions

A function that takes or returns another function is a higher-order function. Writing one takes no special syntax: give a parameter a function type and call it.

```kotlin
fun applyTwice(x: Int, f: (Int) -> Int): Int = f(f(x))

println(applyTwice(3) { it + 10 })   // 23
```

Putting the function parameter **last** is a convention worth following, because it is what makes the trailing-lambda syntax available to your callers.

## Closures

A lambda can read and write variables from the scope where it was written, and it keeps them alive for as long as the lambda lives. Unlike Java, Kotlin does not require those variables to be final.

```kotlin
fun makeAdder(n: Int): (Int) -> Int = { x -> x + n }

val add5 = makeAdder(5)
println(add5(1))     // 6

var count = 0
val tick = { count++ }
tick(); tick()
println(count)       // 2
```

Each call to `makeAdder` creates a fresh `n`, so `makeAdder(5)` and `makeAdder(100)` do not share anything. A closure over a `var` is how a lambda keeps state between calls — it is a very small object with one method.

That capture is by reference, not by value, and it has two edges worth knowing. A lambda stored somewhere keeps the captured variable alive for as long as the lambda lives, and everything that captured the same `var` sees the same value — which makes a captured `var` shared mutable state the moment two coroutines or two threads touch it. A loop variable is not affected, because `for` gives you a fresh read-only binding on every pass:

```kotlin
val fns = mutableListOf<() -> Int>()
for (i in 1..3) fns.add { i }
println(fns.map { it() })     // [1, 2, 3], not [3, 3, 3]
```

For accumulating a result, a captured `var` and `forEach` works and reads fine on one thread; `fold`, `sumOf` or `map` says the same thing without the mutation.

## Function references

If a function with the right shape already exists, `::` refers to it instead of wrapping it in a lambda:

```kotlin
fun isLong(s: String) = s.length > 4

val words = listOf("hi", "hello", "greetings")
println(words.filter(::isLong))          // [hello, greetings]
println(words.map(String::uppercase))    // [HI, HELLO, GREETINGS]
```

`::isLong` is a top-level function reference. `String::uppercase` is a member reference: its receiver becomes the first parameter, so it has type `(String) -> String`. Both are values of a function type, interchangeable with a lambda.

## Returning from a lambda

`return` inside a lambda returns from the *enclosing function*, not from the lambda. That is usually what you want inside `forEach`, and a surprise everywhere else. To leave just the lambda, use a labelled return:

```kotlin
fun firstEven(nums: List<Int>): Int {
    nums.forEach { if (it % 2 == 0) return it }   // returns from firstEven
    return -1
}

val trimmed = listOf(" a ", "  ").map {
    val t = it.trim()
    if (t.isEmpty()) return@map "?"               // leaves only this lambda
    t
}
```

The label is the name of the function the lambda was passed to: `return@map`, `return@forEach`. Most lambdas never need either form, because the last expression is already the result.

```kotlin playground
fun main() {
    val words = listOf("kotlin", "is", "a", "pragmatic", "language")

    // lambdas as arguments
    println(words.filter { it.length > 2 }.map { it.uppercase() })

    // a function that builds a function
    fun repeater(times: Int): (String) -> String = { s -> s.repeat(times) }
    val thrice = repeater(3)
    println(thrice("ha"))

    // a closure keeping state between calls
    var calls = 0
    val counted: (String) -> Int = { s -> calls++; s.length }
    println(words.map(counted).sum())
    println("counted was called $calls times")

    // a list of functions, applied in order
    val steps: List<(String) -> String> = listOf(
        { it.trim() },
        { it.lowercase() },
        { it.replace(" ", "-") },
    )
    var slug = "  Hello Lambda World  "
    for (step in steps) slug = step(slug)
    println(slug)
}
```

## Exercises

### 1. Apply twice

`applyTwice(x, f)` applies `f` to `x`, then applies `f` to that result, and returns it. So `applyTwice(3) { it + 10 }` is `23`.

```kotlin starter
fun applyTwice(x: Int, f: (Int) -> Int): Int {
    return f(x)
}
```

```kotlin test
class ApplyTwiceTest {
    // applies the function twice, not once
    @Test
    fun twice() {
        assertEquals(23, applyTwice(3) { it + 10 })
        assertEquals(12, applyTwice(3) { it * 2 })
        assertEquals(0, applyTwice(4) { it - 2 })
    }

    // the order of the two calls is f(f(x))
    @Test
    fun order() {
        assertEquals(7, applyTwice(1) { it * 2 + 1 })
        assertEquals(1, applyTwice(1) { -it })
        assertEquals(16, applyTwice(2) { it * it })
    }

    // works with zero, negatives and an unchanged value
    @Test
    fun edges() {
        assertEquals(0, applyTwice(0) { it * 5 })
        assertEquals(-6, applyTwice(-2) { it + -2 })
        assertEquals(7, applyTwice(7) { it })
    }
}
```

#### Uses
- [Lambdas › Higher-order functions](#/lambdas/higher-order-functions)
- [Lambdas › Function types](#/lambdas/function-types)

#### Hints
- `f` is an ordinary value of type `(Int) -> Int`; call it with `f(x)`.
- Feed the result of the first call into the second: `f(f(x))`.

#### Tips
- Because `f` is the last parameter, callers can write `applyTwice(3) { it + 10 }` with the lambda outside the parentheses.
- `(Int) -> Int` is an ordinary type. It can be a parameter, a return type, a property, or the element type of a list.
- Put function parameters last in your own functions; that is what makes the trailing-lambda syntax available to your callers.

#### Docs
- [Higher-order functions](https://kotlinlang.org/docs/lambdas.html#higher-order-functions)

### 2. Label every item

`labelAll(names, label)` returns a new list where item `i` is `label(i, names[i])`. Indexes start at `0`, the order of `names` is kept, and an empty list gives an empty list. The input list is never modified.

```kotlin starter
fun labelAll(names: List<String>, label: (Int, String) -> String): List<String> {
    return names
}
```

```kotlin test
class LabelAllTest {
    // calls the lambda with index and value
    @Test
    fun labels() {
        assertEquals(listOf("0:a", "1:b"), labelAll(listOf("a", "b")) { i, s -> "$i:$s" })
        assertEquals(listOf("1. red", "2. green"), labelAll(listOf("red", "green")) { i, s -> "${i + 1}. $s" })
    }

    // indexes start at zero and follow the list order
    @Test
    fun indexes() {
        assertEquals(listOf("0", "1", "2", "3"), labelAll(listOf("w", "x", "y", "z")) { i, _ -> "$i" })
        assertEquals(listOf("z0", "y1"), labelAll(listOf("z", "y")) { i, s -> "$s$i" })
    }

    // empty and single-element lists
    @Test
    fun small() {
        assertEquals(emptyList<String>(), labelAll(emptyList()) { i, s -> "$i$s" })
        assertEquals(listOf("0=solo"), labelAll(listOf("solo")) { i, s -> "$i=$s" })
    }

    // the input list is left alone
    @Test
    fun doesNotMutate() {
        val input = mutableListOf("a", "b")
        val out = labelAll(input) { i, s -> "$i$s" }
        assertEquals(listOf("a", "b"), input)
        assertEquals(listOf("0a", "1b"), out)
    }
}
```

#### Uses
- [Lambdas › Function types](#/lambdas/function-types)
- [Lambdas › Higher-order functions](#/lambdas/higher-order-functions)
- [Reference › Collection operations](#/reference/collection-operations)

#### Hints
- A two-parameter lambda is called like a two-argument function: `label(0, "a")`.
- `names.mapIndexed { i, s -> ... }` already walks a list with its indexes, and `mapIndexed(label)` passes your lambda straight through.
- Doing it by hand also works: build a list with `names.indices.map { ... }`, or loop and add to a `mutableListOf()`.

#### Tips
- `map` and friends always return a new list, which is why the input cannot change.
- `mapIndexed { i, s -> ... }` hands the lambda the index and the element, in that order — the same shape as `label`, so `names.mapIndexed(label)` passes it straight through.
- A lambda with two parameters cannot use `it`; `it` only exists when there is exactly one.

#### Docs
- [mapIndexed](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/map-indexed.html)

### 3. Functions that remember

Two functions that return functions:

- `makeAdder(n)` returns a function that adds `n` to its argument.
- `makeCounter()` returns a function that returns `1` the first time it is called, then `2`, then `3`, and so on. Each counter returned by `makeCounter()` counts independently of the others.

```kotlin starter
fun makeAdder(n: Int): (Int) -> Int {
    return { x -> x }
}

fun makeCounter(): () -> Int {
    return { 0 }
}
```

```kotlin test
class ClosureTest {
    // the adder remembers n
    @Test
    fun adds() {
        val add5 = makeAdder(5)
        assertEquals(6, add5(1))
        assertEquals(0, add5(-5))
        assertEquals(5, add5(0))
        assertEquals(9, makeAdder(-1)(10))
    }

    // different adders do not interfere
    @Test
    fun separateAdders() {
        val add2 = makeAdder(2)
        val add100 = makeAdder(100)
        assertEquals(102, add100(2))
        assertEquals(4, add2(2))
        assertEquals(2, makeAdder(0)(2))
    }

    // the counter starts at 1 and keeps going up
    @Test
    fun counts() {
        val next = makeCounter()
        assertEquals(1, next())
        assertEquals(2, next())
        assertEquals(3, next())
        repeat(6) { next() }
        assertEquals(10, next())
    }

    // each counter has its own count
    @Test
    fun independent() {
        val a = makeCounter()
        val b = makeCounter()
        a()
        a()
        assertEquals(1, b())
        assertEquals(3, a())
        assertEquals(2, b())
    }
}
```

#### Uses
- [Lambdas › Closures](#/lambdas/closures)
- [Lambdas › Function types](#/lambdas/function-types)

#### Hints
- `makeAdder` is the example from the article: the returned lambda closes over the parameter `n`.
- For the counter, declare `var count = 0` inside `makeCounter` and return a lambda that increments it and evaluates to the new value.
- `count++` evaluates to the value *before* the increment, `++count` to the value after. One of them starts at 1.

#### Tips
- A fresh `count` is created on every call to `makeCounter`, which is exactly why the counters do not share state.
- The lambda captures the variable, not a copy of its value, so the count survives between calls and is visible to nothing else.
- `count++` evaluates to the old value and `++count` to the new one. Only one of them starts the sequence at 1.

#### Docs
- [Returning functions](https://kotlinlang.org/docs/lambdas.html#returning-a-value-from-a-lambda-expression)

### 4. Combining functions

- `compose(f, g)` returns a function that runs `g` first and then `f`, so `compose(f, g)(x)` equals `f(g(x))`.
- `allOf(checks)` returns a function that answers `true` for a string only when *every* check in the list says `true`. With an empty list of checks nothing can fail, so it answers `true` for everything.

```kotlin starter
fun compose(f: (Int) -> Int, g: (Int) -> Int): (Int) -> Int {
    return { x -> f(x) }
}

fun allOf(checks: List<(String) -> Boolean>): (String) -> Boolean {
    return { true }
}
```

```kotlin test
class ComposeTest {
    // g runs first, then f
    @Test
    fun order() {
        val plus1 = { n: Int -> n + 1 }
        val times10 = { n: Int -> n * 10 }
        assertEquals(20, compose(times10, plus1)(1))
        assertEquals(11, compose(plus1, times10)(1))
        assertEquals(30, compose(times10, plus1)(2))
    }

    // both functions are really applied
    @Test
    fun applied() {
        val square = { n: Int -> n * n }
        val negate = { n: Int -> -n }
        assertEquals(-9, compose(negate, square)(3))
        assertEquals(9, compose(square, negate)(3))
        assertEquals(0, compose(negate, square)(0))
    }

    // an empty list of checks accepts anything
    @Test
    fun noChecks() {
        val any = allOf(emptyList())
        assertTrue("empty checks should accept a word", any("anything"))
        assertTrue("empty checks should accept the empty string", any(""))
    }

    // every check has to pass
    @Test
    fun everyCheck() {
        val long = { s: String -> s.length > 3 }
        val lower = { s: String -> s == s.lowercase() }
        val both = allOf(listOf(long, lower))
        assertTrue("kotlin passes both checks", both("kotlin"))
        assertEquals(false, both("hi"))
        assertEquals(false, both("KOTLIN"))
        assertEquals(false, both("HI"))
    }

    // a single failing check is enough
    @Test
    fun oneFails() {
        val never = allOf(listOf({ _: String -> true }, { _: String -> false }, { _: String -> true }))
        assertEquals(false, never("abc"))
        assertEquals(false, never(""))
        val always = allOf(listOf({ s: String -> s.isNotEmpty() }))
        assertTrue("non-empty string passes", always("x"))
        assertEquals(false, always(""))
    }
}
```

#### Uses
- [Lambdas › Higher-order functions](#/lambdas/higher-order-functions)
- [Lambdas › Function types](#/lambdas/function-types)
- [Lambdas › Closures](#/lambdas/closures)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)

#### Hints
- `compose` returns a lambda that closes over both `f` and `g`. Inside it, the argument is the lambda's own parameter.
- Read `f(g(x))` from the inside out: `g` is applied to `x` first.
- For `allOf`, the returned lambda gets a string and has to ask every check about it. `checks.all { check -> check(s) }` does it in one line, and `all` on an empty list is `true`.

#### Tips
- `compose(f, g)` is deliberately right-to-left, like `f ∘ g` in maths. If you would rather read left to right, write `then(g, f)` instead — same code, swapped arguments.
- `all` on an empty list is `true`, which is exactly the behaviour `allOf(emptyList())` has to have. That is not a special case you write; it is one you get.

#### Docs
- [Lambda expressions](https://kotlinlang.org/docs/lambdas.html#lambda-expressions-and-anonymous-functions)
- [all](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/all.html)
