# Functions

A Kotlin function can live at the top level of a file, inside a class, or inside another function. Parameters can have defaults, callers can name them, and a body that is a single expression needs no braces and no `return`. Between them, defaults and named arguments remove most of the reasons other languages have overloads.

## Declaring a function

```kotlin
fun area(width: Int, height: Int): Int {
    return width * height
}
```

`fun`, a name, parameters with their types, then `:` and the return type. Parameter types are always required — there is nothing to infer them from. Parameters are `val`s: you cannot assign to `width` inside the body.

Functions do not need a class around them. A file can declare `fun area(...)` at the top level and anything in the same package can call it.

## Single-expression bodies

When the body is one expression, replace the braces with `=`:

```kotlin
fun area(width: Int, height: Int) = width * height

fun sign(n: Int) = when {
    n > 0 -> 1
    n < 0 -> -1
    else -> 0
}
```

The return type is inferred, and there is no `return` — the expression *is* the result. Writing the return type anyway is good manners on a public function; on a two-line helper nobody minds.

## Default arguments

A parameter can have a default, which makes it optional at the call site:

```kotlin
fun greet(name: String, greeting: String = "Hello", punctuation: String = "!") =
    "$greeting, $name$punctuation"

greet("Ada")                      // "Hello, Ada!"
greet("Ada", "Hi")                // "Hi, Ada!"
```

Defaults are evaluated at the call, and can refer to earlier parameters: `fun pad(text: String, width: Int = text.length + 2)`.

## Named arguments

Any argument can be passed by name, in any order:

```kotlin
greet(name = "Ada", punctuation = "?")
greet("Ada", punctuation = "?")
```

That is how you skip over a middle default without passing it. It is also how `send(message, retry = false)` reads better than `send(message, false)`. Once you name one argument, everything after it must be named too — positional arguments may not follow a named one.

Because names are part of the call, renaming a parameter is a breaking change for callers. Choose them with that in mind.

## `Unit` and `Nothing`

A function that returns nothing useful returns `Unit`, a type with exactly one value. You can leave it off:

```kotlin
fun log(message: String) {          // : Unit is implied
    println(message)
}
```

`Nothing` is the type of an expression that never finishes — `throw` has type `Nothing`, which is why `val name = person ?: throw IllegalStateException("no person")` type-checks: the `throw` branch never produces a value at all.

## `vararg`

One parameter may be marked `vararg`, and the caller can then pass any number of arguments. Inside the function it is an `Array`:

```kotlin
fun total(vararg numbers: Int): Int {
    var sum = 0
    for (n in numbers) sum += n
    return sum
}

total()              // 0
total(1, 2, 3)       // 6
```

`numbers.size` and `numbers.isEmpty()` work as you would expect, and an existing array can be spread into the call with `*`: `total(*scores)`.

If a `vararg` is not the last parameter, everything after it must be passed by name.

## Local functions

A function can be declared inside another one. It sees the enclosing function's variables and is invisible outside:

```kotlin
fun report(values: String): String {
    fun clean(s: String) = s.trim().lowercase()
    return clean(values)
}
```

Use one when a helper is only meaningful inside its parent — it keeps the file's top level to the functions that are actually part of its interface.

## Recursion

A function may call itself. The base case comes first, or it never stops:

```kotlin
fun factorial(n: Int): Long = if (n <= 1) 1L else n * factorial(n - 1)
```

Kotlin does not optimise recursion away by default, so deep recursion overflows the stack. When the recursive call is the very last thing the function does, marking it `tailrec` makes the compiler rewrite it into a loop:

```kotlin
tailrec fun gcd(a: Int, b: Int): Int = if (b == 0) a else gcd(b, a % b)
```

```kotlin playground
fun ruler(text: String, width: Int = 24, fill: Char = '.'): String {
    val room = width - text.length - 2
    val left = room / 2
    return fill.toString().repeat(maxOf(left, 0)) + " $text " + fill.toString().repeat(maxOf(room - left, 0))
}

fun total(vararg numbers: Int): Int {
    var sum = 0
    for (n in numbers) sum += n
    return sum
}

tailrec fun gcd(a: Int, b: Int): Int = if (b == 0) a else gcd(b, a % b)

fun main() {
    println(ruler("menu"))
    println(ruler("menu", fill = '='))
    println(ruler(width = 12, text = "tiny"))

    println("total()        = ${total()}")
    println("total(1,2,3,4) = ${total(1, 2, 3, 4)}")
    val scores = intArrayOf(10, 20, 30)
    println("total(*scores) = ${total(*scores)}")

    fun describe(a: Int, b: Int) = "gcd($a, $b) = ${gcd(a, b)}"
    println(describe(48, 18))
    println(describe(270, 192))

    // Try: call ruler with only `fill = '*'` and see the other two defaults still apply.
}
```

## Exercises

### 1. Repeat text

Write `repeatText(text: String, times: Int = 3, separator: String = ", ")`, which joins `text` to itself `times` times with `separator` between the copies. `repeatText("ha")` is `"ha, ha, ha"`, and `repeatText("x", 3, "-")` is `"x-x-x"`. There is no separator before the first copy or after the last, and `times` of 0 or less gives `""`.

Keep those exact parameter names — the tests call them by name.

```kotlin starter
fun repeatText(text: String, times: Int = 1, separator: String = ""): String {
    return text
}
```

```kotlin test
class RepeatTextTest {
    // both defaults apply
    @Test
    fun defaults() {
        assertEquals("ha, ha, ha", repeatText("ha"))
        assertEquals("x, x, x", repeatText("x"))
    }

    // overriding one or both
    @Test
    fun overrides() {
        assertEquals("ha, ha", repeatText("ha", 2))
        assertEquals("x-x-x", repeatText("x", 3, "-"))
        assertEquals("ab ab ab ab", repeatText("ab", 4, " "))
        assertEquals("x-x-x", repeatText("x", separator = "-"))
        assertEquals("ab, ab", repeatText(times = 2, text = "ab"))
    }

    // zero, one and negative counts
    @Test
    fun edges() {
        assertEquals("", repeatText("ha", 0))
        assertEquals("", repeatText("ha", -2))
        assertEquals("ha", repeatText("ha", 1))
        assertEquals("", repeatText("", 0, "-"))
        assertEquals("--", repeatText("", 3, "-"))
    }
}
```

#### Uses
- [Functions › Default arguments](#/functions/default-arguments)
- [Functions › Named arguments](#/functions/named-arguments)
- [Control flow › `for`](#/control-flow/for)
- [Reference › Collection operations](#/reference/collection-operations)

#### Hints
- The starter's defaults are wrong: `times` should default to 3 and `separator` to `", "`.
- Loop `for (i in 1..times)` — when `times` is 0 or negative the range is empty, so `""` falls out on its own.
- Append the separator only when the result is not yet empty, so it never leads or trails.

#### Tips
- `List(times) { text }.joinToString(separator)` is the one-liner, but it needs lambdas and collections, which come later.
- A default is evaluated at the call site, not once at declaration, so a default that reads another parameter is fine.
- Once you pass one argument by name, every argument after it must be named too.

#### Docs
- [Default arguments](https://kotlinlang.org/docs/functions.html#default-arguments)
- [Named arguments](https://kotlinlang.org/docs/functions.html#named-arguments)

### 2. Longest word

`longest(vararg words: String)` returns the longest of the words it is given. If several are equally long, return the first of them; with no arguments at all, return `""`.

```kotlin starter
fun longest(vararg words: String): String {
    return "longest"
}
```

```kotlin test
class LongestTest {
    // picks the longest
    @Test
    fun picksLongest() {
        assertEquals("banana", longest("fig", "banana", "plum"))
        assertEquals("elephant", longest("elephant", "cat"))
        assertEquals("zzz", longest("a", "bb", "zzz"))
    }

    // ties go to the first
    @Test
    fun ties() {
        assertEquals("cat", longest("cat", "dog", "emu"))
        assertEquals("bb", longest("a", "bb", "cc"))
    }

    // no arguments, one argument, empty strings
    @Test
    fun edges() {
        assertEquals("", longest())
        assertEquals("only", longest("only"))
        assertEquals("", longest("", ""))
        assertEquals("a", longest("", "a", ""))
    }
}
```

#### Uses
- [Functions › `vararg`](#/functions/vararg)
- [Control flow › `for`](#/control-flow/for)
- [Variables & types › `val` and `var`](#/basics/val-and-var)

#### Hints
- Start from `var best = ""` and walk the words with `for (w in words)`.
- Replace `best` only when the new word is strictly longer: `if (w.length > best.length)`. Using `>=` would hand ties to the last word instead of the first.
- With no arguments the loop never runs, so `""` is already the right answer.

#### Tips
- Inside the function, `words` is an `Array<out String>`; `words.size` and `words.isEmpty()` are available if you want them.
- `longest()` with no arguments has to return `""`, not throw. Starting from `var best = ""` gives you that answer without a special case.
- Spread an existing array into a `vararg` with `*`: `longest(*names)`.

#### Docs
- [Variable number of arguments](https://kotlinlang.org/docs/functions.html#variable-number-of-arguments-varargs)

### 3. Greatest common divisor

`gcd(a, b)` returns the greatest common divisor of two numbers that are zero or above, using Euclid's algorithm: the gcd of `a` and `0` is `a`, and otherwise it is the gcd of `b` and `a % b`. Write it recursively. `gcd(0, 0)` is `0`.

```kotlin starter
fun gcd(a: Int, b: Int): Int {
    return 1
}
```

```kotlin test
class GcdTest {
    // ordinary pairs
    @Test
    fun ordinary() {
        assertEquals(6, gcd(48, 18))
        assertEquals(6, gcd(18, 48))
        assertEquals(1, gcd(17, 5))
        assertEquals(6, gcd(270, 192))
    }

    // zero and equal arguments
    @Test
    fun zeroAndEqual() {
        assertEquals(0, gcd(0, 0))
        assertEquals(5, gcd(5, 0))
        assertEquals(5, gcd(0, 5))
        assertEquals(7, gcd(7, 7))
    }

    // one divides the other, and coprime pairs
    @Test
    fun divisors() {
        assertEquals(1, gcd(1, 999983))
        assertEquals(4, gcd(4, 12))
        assertEquals(12, gcd(36, 24))
        assertEquals(999983, gcd(999983, 999983))
    }
}
```

#### Uses
- [Functions › Recursion](#/functions/recursion)
- [Functions › Single-expression bodies](#/functions/single-expression-bodies)
- [Control flow › `if` as an expression](#/control-flow/if-as-an-expression)

#### Hints
- The base case is `b == 0`, and the answer there is `a`.
- Otherwise call yourself with the arguments swapped and reduced: `gcd(b, a % b)`.
- The whole thing fits one expression body: `fun gcd(a: Int, b: Int): Int = if (b == 0) a else gcd(b, a % b)`.

#### Tips
- The recursive call is the last thing the function does, so `tailrec fun gcd(...)` compiles it into a loop. It changes nothing about the result.
- The algorithm sorts the arguments out by itself: `gcd(18, 48)` becomes `gcd(48, 18)` after one step.

#### Docs
- [Tail recursive functions](https://kotlinlang.org/docs/functions.html#tail-recursive-functions)

### 4. Palindrome

`isPalindrome(text: String, ignoreCase: Boolean = true, ignorePunctuation: Boolean = true)` reports whether `text` reads the same backwards.

By default it ignores case and every character that is not a letter or digit, so `"A man, a plan, a canal: Panama"` is a palindrome. With `ignoreCase = false`, `'A'` and `'a'` are different characters. With `ignorePunctuation = false`, spaces and punctuation count. The empty string is a palindrome. Keep those exact parameter names — the tests call them by name.

```kotlin starter
fun isPalindrome(text: String, ignoreCase: Boolean = false, ignorePunctuation: Boolean = false): Boolean {
    return text == text.reversed()
}
```

```kotlin test
class PalindromeTest {
    // with the defaults
    @Test
    fun defaults() {
        assertTrue("racecar is a palindrome", isPalindrome("racecar"))
        assertTrue("phrase with punctuation", isPalindrome("A man, a plan, a canal: Panama"))
        assertTrue("digits count", isPalindrome("12321"))
        assertTrue("empty string", isPalindrome(""))
        assertTrue("single character", isPalindrome("x"))
        assertTrue("case is ignored", isPalindrome("Anna"))
    }

    // things that are not palindromes
    @Test
    fun notPalindromes() {
        assertFalse("hello is not", isPalindrome("hello"))
        assertFalse("almost is not", isPalindrome("racecars"))
        assertFalse("12345 is not", isPalindrome("12345"))
        assertFalse("ab is not", isPalindrome("ab"))
    }

    // case-sensitive
    @Test
    fun caseSensitive() {
        assertFalse("Anna fails when case matters", isPalindrome("Anna", ignoreCase = false))
        assertTrue("racecar still passes", isPalindrome("racecar", ignoreCase = false))
        assertFalse("Racecar fails", isPalindrome("Racecar", ignoreCase = false))
        assertTrue("phrase still passes ignoring case", isPalindrome("A man, a plan, a canal: Panama", ignoreCase = true))
    }

    // punctuation-sensitive
    @Test
    fun punctuationSensitive() {
        assertFalse("phrase fails when punctuation counts", isPalindrome("A man, a plan, a canal: Panama", ignorePunctuation = false))
        assertTrue("symmetric spacing passes", isPalindrome("abc cba", ignorePunctuation = false))
        assertFalse("lopsided comma fails", isPalindrome("ab, ba", ignorePunctuation = false))
        assertFalse("both flags off", isPalindrome("Anna", ignoreCase = false, ignorePunctuation = false))
    }
}
```

#### Uses
- [Functions › Default arguments](#/functions/default-arguments)
- [Functions › Named arguments](#/functions/named-arguments)
- [Functions › Local functions](#/functions/local-functions)
- [Control flow › `for`](#/control-flow/for)
- [Variables & types › Character tests](#/basics/character-tests)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)

#### Hints
- Normalise first, compare second. Build a cleaned `var s = ""` by walking `text` and keeping the characters that survive the flags.
- `c.isLetterOrDigit()` is the test for "not punctuation", and `c.lowercaseChar()` folds the case.
- A local `fun keep(c: Char) = !ignorePunctuation || c.isLetterOrDigit()` reads better than the same condition inline, and it can see the parameters.
- Once you have the cleaned string, `s == s.reversed()` is the whole answer.

#### Tips
- The starter compares the raw text and defaults both flags to `false`, so it already passes `"racecar"`. Look at which tests it fails to see what is missing.
- `reversed()` on a `String` gives a `String`, so `s == s.reversed()` is a plain value comparison. On a `List` it gives a `List`, which also compares by content.
- The empty string is a palindrome. Whatever you build, check that it survives `isPalindrome("")`.

#### Docs
- [Char.isLetterOrDigit](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-letter-or-digit.html)
- [String.reversed](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/reversed.html)
