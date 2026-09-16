# Control flow

Kotlin has `if`, `when`, `for`, `while` and `do while`, and the first two are expressions: they produce a value you can assign or return. `when` is the workhorse — it replaces `switch`, long `else if` chains, and most of what you would otherwise write with nested conditions.

## `if` as an expression

`if` needs a `Boolean`. There is no truthiness, so `if (count)` does not compile; write the comparison you mean.

```kotlin
if (n % 2 == 0) {
    println("even")
} else if (n < 0) {
    println("negative and odd")
} else {
    println("odd")
}
```

Because every block evaluates to its last expression, `if` produces a value, which is why Kotlin has no `?:` ternary:

```kotlin
val parity = if (n % 2 == 0) "even" else "odd"
```

Used as an expression, `if` must have an `else` — otherwise there would be nothing to produce when the condition is false. Both branches have to agree on a type, or the result widens to their nearest common one.

A function body can be that expression directly:

```kotlin
fun sign(n: Int) = if (n > 0) 1 else if (n < 0) -1 else 0
```

## `when` with a subject

`when (x)` compares `x` against each branch in order and runs the first that matches. Branches can list several values, test a range with `in`, or test a type with `is`.

```kotlin
val label = when (code) {
    0 -> "ok"
    1, 2 -> "retryable"
    in 400..499 -> "client error"
    in 500..599 -> "server error"
    else -> "unknown"
}
```

As an expression, `when` must cover every case, which normally means an `else`. As a statement — where you ignore the value — `else` is optional.

Branch bodies can be blocks; the block's last expression is the branch's value:

```kotlin
val cost = when (size) {
    "small" -> 3
    "large" -> {
        val surcharge = 2
        5 + surcharge
    }
    else -> 4
}
```

## `when` without a subject

Drop the subject and each branch becomes its own `Boolean` condition. This is the replacement for an `else if` ladder:

```kotlin
val grade = when {
    score >= 90 -> "A"
    score >= 80 -> "B"
    else -> "F"
}
```

Order matters, since the first true branch wins. A score of 95 matches `>= 90` and never reaches `>= 80`.

## Ranges

A range is a value in its own right, built with `..`, `..<` or `downTo`:

```kotlin
1..5            // 1, 2, 3, 4, 5
1..<5           // 1, 2, 3, 4   (`until` is the older spelling)
5 downTo 1      // 5, 4, 3, 2, 1
1..10 step 3    // 1, 4, 7, 10
'a'..'f'        // characters work too
```

`in` asks whether something is inside a range, and `!in` asks the opposite. It also works on strings, where it means "contains":

```kotlin
n in 1..100
c in 'a'..'z'
c in "aeiou"
```

## `for`

`for` walks anything iterable: ranges, strings, arrays, collections.

```kotlin
for (i in 1..5) println(i)
for (i in 0..<text.length) println(text[i])
for (c in text) println(c)
for (i in text.indices) println("$i: ${text[i]}")
for ((i, c) in text.withIndex()) println("$i: $c")
```

There is no C-style `for (i = 0; i < n; i++)`; a range covers it. The loop variable is a fresh, read-only binding each pass, so anything you accumulate is a `var` declared before the loop.

## `while` and `do while`

```kotlin
var n = 27
var steps = 0
while (n != 1) {
    n = if (n % 2 == 0) n / 2 else 3 * n + 1
    steps++
}

do {
    line = readNext()
} while (line != null)
```

`while` checks first and may run zero times; `do while` runs the body at least once. Use them when the number of passes is not known up front.

## `break`, `continue` and labels

`break` leaves the innermost loop, `continue` skips to its next pass. To reach an outer loop, put a label on it and name the label:

```kotlin
outer@ for (i in 1..5) {
    for (j in 1..5) {
        if (i * j > 6) break@outer
        if (j > i) continue@outer
        println("$i x $j")
    }
}
```

Unlike Rust's `loop`, a Kotlin loop never produces a value, so anything you want to keep goes in a `var` declared before it.

```kotlin playground
fun main() {
    for (n in 1..20) {
        val label = when {
            n % 15 == 0 -> "FizzBuzz"
            n % 3 == 0 -> "Fizz"
            n % 5 == 0 -> "Buzz"
            else -> "$n"
        }
        print(label.padStart(9))
        if (n % 5 == 0) println()
    }

    var candidate = 91
    var divisor = 0
    search@ for (d in 2..candidate / 2) {
        if (candidate % d == 0) {
            divisor = d
            break@search
        }
    }
    println(if (divisor == 0) "$candidate is prime" else "$candidate = $divisor x ${candidate / divisor}")

    var n = 27
    var steps = 0
    while (n != 1) {
        n = if (n % 2 == 0) n / 2 else 3 * n + 1
        steps++
    }
    println("27 reaches 1 in $steps steps")

    for (c in 'a'..'e') print(if (c in "aeiou") "${c.uppercaseChar()} " else "$c ")
    println()

    // Try: swap the first two branches of the `when` and watch 15 stop being FizzBuzz.
}
```

## Exercises

### 1. Grade

`grade(score)` returns a letter for a test score: `"A"` for 90 and up, `"B"` for 80–89, `"C"` for 70–79, `"D"` for 60–69, and `"F"` below that. Scores above 100 still count as `"A"`, and negative scores as `"F"`. Use a subjectless `when`.

```kotlin starter
fun grade(score: Int): String {
    return "F"
}
```

```kotlin test
class GradeTest {
    // a letter for each band
    @Test
    fun bands() {
        assertEquals("A", grade(95))
        assertEquals("B", grade(85))
        assertEquals("C", grade(75))
        assertEquals("D", grade(65))
        assertEquals("F", grade(20))
    }

    // the boundaries belong to the higher grade
    @Test
    fun boundaries() {
        assertEquals("A", grade(90))
        assertEquals("B", grade(89))
        assertEquals("B", grade(80))
        assertEquals("C", grade(79))
        assertEquals("D", grade(60))
        assertEquals("F", grade(59))
    }

    // beyond the usual range
    @Test
    fun extremes() {
        assertEquals("A", grade(100))
        assertEquals("A", grade(140))
        assertEquals("F", grade(0))
        assertEquals("F", grade(-10))
    }
}
```

#### Uses
- [Control flow › `when` without a subject](#/control-flow/when-without-a-subject)

#### Hints
- A `when` with no subject takes a `Boolean` per branch: `when { score >= 90 -> "A"; ... }`.
- Go from the highest band down. Once `score >= 90` is checked first, the `>= 80` branch only ever sees scores below 90.
- The final `else ->` catches everything left, which is exactly the `"F"` case.

#### Tips
- `when (score) { in 90..Int.MAX_VALUE -> "A" ... }` works too, but the subjectless form reads better for open-ended bands.
- As an expression, `when` needs an `else`: there has to be something to produce when nothing else matched.
- Branch order is the logic here. Put `>= 60` first and every score becomes a D.

#### Docs
- [when expressions](https://kotlinlang.org/docs/control-flow.html#when-expressions-and-statements)

### 2. Describe a character

`describe(c)` classifies a single character: `"vowel"` for `a e i o u` in either case, `"consonant"` for any other English letter, `"digit"` for `0`–`9`, and `"other"` for everything else.

```kotlin starter
fun describe(c: Char): String {
    return "other"
}
```

```kotlin test
class DescribeTest {
    // vowels in both cases
    @Test
    fun vowels() {
        assertEquals("vowel", describe('a'))
        assertEquals("vowel", describe('u'))
        assertEquals("vowel", describe('E'))
        assertEquals("vowel", describe('O'))
    }

    // the rest of the alphabet
    @Test
    fun consonants() {
        assertEquals("consonant", describe('b'))
        assertEquals("consonant", describe('z'))
        assertEquals("consonant", describe('Z'))
        assertEquals("consonant", describe('Y'))
    }

    // digits and everything else
    @Test
    fun digitsAndOther() {
        assertEquals("digit", describe('0'))
        assertEquals("digit", describe('7'))
        assertEquals("digit", describe('9'))
        assertEquals("other", describe(' '))
        assertEquals("other", describe('!'))
        assertEquals("other", describe('é'))
    }
}
```

#### Uses
- [Control flow › `when` with a subject](#/control-flow/when-with-a-subject)
- [Control flow › Ranges](#/control-flow/ranges)
- [Variables & types › Strings and characters](#/basics/strings-and-characters)
- [Variables & types › Character tests](#/basics/character-tests)

#### Hints
- `c in "aeiouAEIOU"` is true when the character appears anywhere in that string.
- Letters and digits are contiguous ranges: `c in 'a'..'z'`, `c in 'A'..'Z'`, `c in '0'..'9'`.
- Check the vowels before the consonants, or every vowel comes back a consonant.

#### Tips
- `c.lowercaseChar()` lets you handle both cases with one test instead of two.
- `c.isLetter()` and `c.isDigit()` are the standard-library versions of those range checks, and they are right about accented letters and non-Latin scripts where `'a'..'z'` is not.
- A `when` with a subject compares with `==`, `in` for ranges and `is` for types — the three can be mixed in one `when`.

#### Docs
- [Ranges and progressions](https://kotlinlang.org/docs/ranges.html)

### 3. Collatz steps

Starting from `n`, repeat: halve it if it is even, otherwise replace it with `3 * n + 1`. `collatz(n)` returns how many steps that takes to reach 1. `n` is at least 1, and `collatz(1)` is `0`.

```kotlin starter
fun collatz(n: Long): Int {
    return 1
}
```

```kotlin test
class CollatzTest {
    // one is already there
    @Test
    fun one() {
        assertEquals(0, collatz(1L))
    }

    // small starting points
    @Test
    fun small() {
        assertEquals(1, collatz(2L))
        assertEquals(7, collatz(3L))
        assertEquals(2, collatz(4L))
        assertEquals(8, collatz(6L))
        assertEquals(16, collatz(7L))
    }

    // long detours
    @Test
    fun long() {
        assertEquals(111, collatz(27L))
        assertEquals(118, collatz(97L))
        assertEquals(524, collatz(837799L))
    }
}
```

#### Uses
- [Control flow › `while` and `do while`](#/control-flow/while-and-do-while)
- [Control flow › `if` as an expression](#/control-flow/if-as-an-expression)
- [Variables & types › `val` and `var`](#/basics/val-and-var)

#### Hints
- The parameter is read-only, so copy it: `var current = n`, plus a `var steps = 0`.
- Loop `while (current != 1L)`, and count one step per pass.
- One line does the step: `current = if (current % 2 == 0L) current / 2 else 3 * current + 1`.

#### Tips
- The parameter is a `Long` because the sequence climbs far above the starting number — 27 peaks at 9232, and bigger starts overflow an `Int`. Compare against `1L` and `0L`, not `1` and `0`.
- `collatz(1)` is `0` steps, and a `while` that checks first gets that right for free. A `do while` would count one step too many.

#### Docs
- [while loops](https://kotlinlang.org/docs/control-flow.html#while-loops)

### 4. FizzBuzz line

`fizzBuzz(n)` returns the numbers from 1 to `n`, space-separated, with multiples of 3 replaced by `Fizz`, multiples of 5 by `Buzz`, and multiples of both by `FizzBuzz`. `fizzBuzz(5)` is `"1 2 Fizz 4 Buzz"`. There is no trailing space, and `fizzBuzz(0)` is `""`.

```kotlin starter
fun fizzBuzz(n: Int): String {
    return "1 2 Fizz 4 Buzz"
}
```

```kotlin test
class FizzBuzzTest {
    // short runs
    @Test
    fun short() {
        assertEquals("", fizzBuzz(0))
        assertEquals("1", fizzBuzz(1))
        assertEquals("1 2", fizzBuzz(2))
        assertEquals("1 2 Fizz", fizzBuzz(3))
    }

    // fizz, buzz and both
    @Test
    fun replacements() {
        assertEquals("1 2 Fizz 4 Buzz", fizzBuzz(5))
        assertEquals("1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz", fizzBuzz(10))
        assertEquals("1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz", fizzBuzz(15))
    }

    // no stray spaces at either end
    @Test
    fun spacing() {
        val out = fizzBuzz(20)
        assertEquals(20, out.split(" ").size)
        assertTrue("should not start with a space", !out.startsWith(" "))
        assertTrue("should not end with a space", !out.endsWith(" "))
        assertEquals("FizzBuzz", out.split(" ")[14])
    }
}
```

#### Uses
- [Control flow › `for`](#/control-flow/for)
- [Control flow › `when` without a subject](#/control-flow/when-without-a-subject)
- [Variables & types › Strings and characters](#/basics/strings-and-characters)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)

#### Hints
- Build the answer in a `var out = ""` declared before a `for (i in 1..n)` loop.
- Add the separator only when there is already something in `out`: `if (out.isNotEmpty()) out += " "`. That keeps the ends clean without a trim.
- The label for one number is the same `when` chain as the article's playground, with `else -> "$i"`.

#### Tips
- `1..0` is an empty range, so `fizzBuzz(0)` falls out for free — the loop just never runs.
- Repeated `+=` on a `String` allocates each time. `StringBuilder` is the grown-up answer; at this size nobody notices.

#### Docs
- [For loops](https://kotlinlang.org/docs/control-flow.html#for-loops)

### 5. First shared letter

`firstShared(a, b)` returns the first character of `a` that also appears anywhere in `b`, or `'?'` if there is none. `firstShared("hello", "world")` is `'l'`, because `h` and `e` are not in `"world"`. Either string may be empty.

Write it with two nested loops and a labeled `break`, even though the standard library could do it in one call — the point is the label.

```kotlin starter
fun firstShared(a: String, b: String): Char {
    return '?'
}
```

```kotlin test
class FirstSharedTest {
    // the first match in a, not in b
    @Test
    fun firstInA() {
        assertEquals('l', firstShared("hello", "world"))
        assertEquals('o', firstShared("october", "world"))
        assertEquals('a', firstShared("abc", "cba"))
    }

    // no shared character
    @Test
    fun noMatch() {
        assertEquals('?', firstShared("abc", "xyz"))
        assertEquals('?', firstShared("abc", ""))
        assertEquals('?', firstShared("", "abc"))
        assertEquals('?', firstShared("", ""))
    }

    // case and repeats are literal
    @Test
    fun literalMatching() {
        assertEquals('?', firstShared("ABC", "abc"))
        assertEquals('b', firstShared("aabbcc", "b"))
        assertEquals(' ', firstShared("a b", " "))
    }
}
```

#### Uses
- [Control flow › `break`, `continue` and labels](#/control-flow/break-continue-and-labels)
- [Control flow › `for`](#/control-flow/for)
- [Variables & types › `val` and `var`](#/basics/val-and-var)

#### Hints
- Keep the answer in `var found = '?'` before the loops and return it afterwards; that also handles the "none" case.
- The outer loop walks `a`, the inner walks `b`. When `outerChar == innerChar`, set `found`.
- A loop cannot hand back a value, so you need `break@outer` to stop both loops once `found` is set. Label the outer loop `outer@ for (x in a) { ... }`.

#### Tips
- Matching is exact: `'A'` and `'a'` are different characters, and so is a space.
- A label is `name@` in front of the loop and `break@name` inside it. Without the label, `break` only leaves the inner loop and the outer one keeps going.
- The first shared letter is defined by `a`'s order, not `b`'s, so `a` has to be the outer loop.

#### Docs
- [Break and continue labels](https://kotlinlang.org/docs/returns.html#break-and-continue-labels)
