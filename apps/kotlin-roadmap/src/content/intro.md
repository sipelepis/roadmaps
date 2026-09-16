# What is Kotlin?

Kotlin is a statically typed language that runs on the JVM, compiles to Android apps, and reads like a modern scripting language. It was designed to fix the parts of Java that hurt: nullability is part of the type system, data holders are one line, and the compiler infers most types you would otherwise spell out.

Every module here is an article, a playground you can edit and run, and exercises with real tests. Your code is compiled and run by the official Kotlin Playground service, so this is the real compiler, not a simulation.

## Hello, Kotlin

A program starts at `fun main`. `println` writes a line, and string templates put values inside a string with `$name`.

```kotlin playground
fun main() {
    val name = "Kotlin"
    val version = 2.2

    println("Hello from $name $version")
    println("2 + 2 = ${2 + 2}")

    val languages = listOf("Kotlin", "Swift", "Go")
    for (lang in languages) {
        println("- $lang")
    }
}
```

`val` declares something that cannot be reassigned; `var` declares something that can. Types are inferred, so `val name = "Kotlin"` is a `String` without your saying so.

## Expressions, not statements

Much of Kotlin is expressions, which means they produce a value. `if` is an expression, so there is no ternary operator, because `if` already does the job.

```kotlin
val max = if (a > b) a else b
```

That idea runs through the language: `when`, `try`, and function bodies can all be expressions. A function whose body is a single expression is written with `=` and no braces.

```kotlin
fun double(n: Int) = n * 2
```

## Semicolons and structure

Semicolons are optional and nobody writes them. Top-level functions are fine, so you do not need a class to hold a function. Files can declare functions, classes, and constants side by side.

## What you will build here

The roadmap runs from variables through null safety, collections, classes, and lambdas, to coroutines and Flow. Later modules assume the earlier ones, and the graph on the home page shows what each module builds on. The last module is a set of practice problems that mix everything.

## Reading the test block

Every exercise has two editors: your code, and a **test block** you cannot edit. The test block is the specification. Read it first — it shows the exact types, the exact strings, and the edge cases the description only summarises.

```kotlin
class GreetTest {
    // greets a name
    @Test
    fun greets() {
        assertEquals("Hello, Ada!", greet("Ada"))
    }
}
```

That is four ideas:

- `class GreetTest` is an ordinary class, compiled together with your code, so it can call anything you declare.
- `@Test` marks one test. Each is run and reported separately, so one failure does not hide the others.
- The `//` comment above `@Test` is the label you see in the results — `// greets a name` is why the list reads "greets a name".
- A test passes by returning and fails by throwing. That is the whole protocol; an assertion is just a function that throws when it does not like what it sees.

The assertions come from JUnit and are imported for you. In all of them the **expected value comes first** and yours comes second:

```kotlin
assertEquals("Hello, Ada!", greet("Ada"))       // expected, then actual
assertTrue("should end with '!'", out.endsWith("!"))
assertFalse("should not be empty", out.isEmpty())
assertNull(lastNameInitial(""))
```

Swapping the two arguments of `assertEquals` does not change whether the test passes, but it does swap the two halves of the failure message, which sends you looking in the wrong place. `assertTrue` and `assertFalse` take their message first; always give them one, because "the condition was false" on its own tells you nothing.

Imports written inside a test block are hoisted to the top of the file for you, so a test can start with an `import` line even though your code is above it. You never need to repeat those imports in your own editor.

The full list, with how to check that something throws, is on the [Reference](#/reference) page.

## Exercises

### 1. Greet

`greet(name)` returns a greeting: `greet("Ada")` is `"Hello, Ada!"`. Use a string template.

```kotlin starter
fun greet(name: String): String {
    return ""
}
```

```kotlin test
class GreetTest {
    // greets a name
    @Test
    fun greets() {
        assertEquals("Hello, Ada!", greet("Ada"))
        assertEquals("Hello, Kotlin!", greet("Kotlin"))
    }

    // the name goes in the middle, whatever it is
    @Test
    fun anyName() {
        assertEquals("Hello, !", greet(""))
        assertEquals("Hello, Ada Lovelace!", greet("Ada Lovelace"))
    }

    // nothing is lost around the name
    @Test
    fun exactShape() {
        val out = greet("X")
        assertTrue("should start with 'Hello, '", out.startsWith("Hello, "))
        assertTrue("should end with '!'", out.endsWith("!"))
        assertEquals(9, out.length)
    }
}
```

#### Uses
- [What is Kotlin? › Hello, Kotlin](#/intro/hello-kotlin)
- [What is Kotlin? › Reading the test block](#/intro/reading-the-test-block)
- [Reference › Strings](#/reference/strings)

#### Hints
- A string template puts a value inside a string: `"Hello, $name!"`.
- The whole function body is one expression, so you can write it as `fun greet(name: String) = "Hello, $name!"`.

#### Tips
- Use `${...}` when the expression is more than a plain name, as in `"${name.length} letters"`.
- `greet("")` has to produce `"Hello, !"`. Nothing special-cases an empty name, and the third test checks the exact length to prove nothing was trimmed.
- The third test uses `startsWith` and `endsWith`, which are ordinary `String` functions — [Reference › Strings](#/reference/strings) lists them.

#### Docs
- [String templates](https://kotlinlang.org/docs/strings.html#string-templates)
- [Functions](https://kotlinlang.org/docs/functions.html)

### 2. Bigger of two

`larger(a, b)` returns the larger of two numbers, and `a` when they are equal. Write it with `if` used as an expression.

```kotlin starter
fun larger(a: Int, b: Int): Int {
    return 0
}
```

```kotlin test
class LargerTest {
    // picks the bigger number
    @Test
    fun picksBigger() {
        assertEquals(5, larger(5, 3))
        assertEquals(5, larger(3, 5))
        assertEquals(100, larger(100, 99))
    }

    // works with negatives and zero
    @Test
    fun negatives() {
        assertEquals(-1, larger(-1, -4))
        assertEquals(0, larger(0, -7))
        assertEquals(0, larger(-7, 0))
    }

    // equal values return that value
    @Test
    fun equal() {
        assertEquals(4, larger(4, 4))
        assertEquals(-2, larger(-2, -2))
    }
}
```

#### Uses
- [What is Kotlin? › Expressions, not statements](#/intro/expressions-not-statements)

#### Hints
- `if` returns a value in Kotlin, so `val m = if (a > b) a else b` works.
- With a single expression body you can drop the braces entirely: `fun larger(a: Int, b: Int) = if (a > b) a else b`.

#### Tips
- `maxOf(a, b)` in the standard library does the same thing. Writing it by hand once is the point here.
- `larger(4, 4)` must give `4`. With `if (a > b) a else b` the tie falls to `b`, which happens to be the same value — but say what you mean if you ever change the rule.

#### Docs
- [If expression](https://kotlinlang.org/docs/control-flow.html#if-expression)
