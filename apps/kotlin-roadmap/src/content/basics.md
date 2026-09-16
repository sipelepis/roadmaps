# Variables & types

Kotlin has no untyped values. Everything has a type, but you rarely write one down: the compiler reads it off the initializer. This module covers `val` and `var`, the number types and their sharp edges, conversions, strings, and characters.

The types you meet first are `Int`, `Long`, `Double`, `Boolean`, `Char` and `String`. They are ordinary classes with methods on them — there is no primitive/object split to keep track of, and `null` is not a legal value for any of them unless you ask for it.

## `val` and `var`

`val` binds a name once. `var` binds a name you can reassign.

```kotlin
val name = "Ada"
var count = 0
count += 1
count = 10

name = "Grace"   // error: val cannot be reassigned
```

Reach for `val` by default and change it to `var` only when the compiler complains. A `val` is not a constant — it is a name that is assigned once, so `val now = readLine()` is fine.

Types are inferred from the right-hand side, but you can always spell one out, and you must when there is nothing to infer from:

```kotlin
val temperature: Double = 21.0
var lastError: String                // no initializer, so the type is required
lastError = "none yet"
```

The inferred type is exact, and this bites: `val ratio = 1 / 2` is an `Int` holding `0`, not `0.5`.

## Numbers and arithmetic

| Type | Size | Literal |
| --- | --- | --- |
| `Int` | 32-bit | `42` |
| `Long` | 64-bit | `42L` |
| `Double` | 64-bit float | `4.2` |
| `Float` | 32-bit float | `4.2f` |
| `Byte`, `Short` | 8, 16-bit | (explicit type only) |

A plain integer literal is an `Int`, unless it is too big for one, in which case it is a `Long`. A plain decimal literal is a `Double`. Underscores make long literals readable: `1_000_000`.

`+ - * / %` do what you expect, and `+=`, `-=`, `*=`, `/=`, `%=`, `++` and `--` all work on a `var`. There is no implicit widening: an `Int` and a `Long` do not mix without a conversion, and `Int` arithmetic that overflows wraps around silently rather than failing.

```kotlin
val big = Int.MAX_VALUE + 1    // -2147483648, not an error
```

`Int.MAX_VALUE`, `Int.MIN_VALUE` and their `Long` equivalents tell you where the edges are.

## Integer division

Dividing two `Int`s gives an `Int`, truncated toward zero. This is the single most common surprise in the language:

```kotlin
7 / 2        // 3
-7 / 2       // -3, not -4
7 % 2        // 1
-7 % 2       // -1, the sign follows the left operand
```

To get a fractional answer, at least one side has to be a `Double`:

```kotlin
7 / 2.0              // 3.5
7.toDouble() / 2     // 3.5
```

Note what `%` does with negatives: it is a remainder, not a mathematical modulo, so `-7 % 3` is `-1`, not `2`. When you need a non-negative answer, `Math.floorMod(-7, 3)` gives `2`, or take the absolute value with `abs`.

## Converting between types

Conversions are explicit methods, never automatic: `toInt()`, `toLong()`, `toDouble()`, `toChar()`, `toString()`.

```kotlin
val d = 3.9
d.toInt()            // 3 — truncates, it does not round
"42".toInt()         // 42
"4.5".toDouble()     // 4.5
"nope".toInt()       // throws NumberFormatException
"nope".toIntOrNull() // null
```

`toInt()` on a `Double` throws away the fraction. For rounding, `Math.round(3.9)` gives `4`, and `kotlin.math.round(3.5)` gives `4.0` (still a `Double`).

## Clamping and kotlin.math

Four standard functions come up constantly and are easy to reimplement by accident.

```kotlin
minOf(3, 9)                // 3
maxOf(3, 9)                // 9
maxOf(1, 5, 3)             // 5 — more than two arguments is fine
15.coerceIn(0, 10)         // 10 — the standard-library clamp
(-3).coerceAtLeast(0)      // 0  — clamp the bottom only
12.coerceAtMost(10)        // 10 — clamp the top only
```

`coerceIn` is what you want whenever a value has to stay inside a range; writing `if (n < min) min else if (n > max) max else n` is the same thing, four times as long.

The `kotlin.math` package holds the rest. It is a normal package, so you import what you use:

```kotlin
import kotlin.math.abs
import kotlin.math.sqrt
import kotlin.math.roundToInt

abs(-5)            // 5
sqrt(9.0)          // 3.0
3.6.roundToInt()   // 4 — rounds and gives an Int
```

`abs` is overloaded for `Int`, `Long`, `Float` and `Double`, so `abs(-5)` stays an `Int`. `sqrt` only takes a `Double`, which is why `sqrt(9)` does not compile.

## Strings and characters

A `String` is a sequence of `Char`s, indexed from zero. `String` is immutable: every operation returns a new one.

```kotlin
val s = "Kotlin"
s.length          // 6
s[0]              // 'K', a Char — single quotes
s.first()         // 'K'
s.uppercase()     // "KOTLIN"
s.substring(0, 3) // "Kot"
s + "!"           // "Kotlin!"
s.padStart(8, '.')// "..Kotlin"
```

`Char` is its own type, not a one-letter `String`. `'K'.uppercaseChar()` gives `'K'`, `'7'.digitToInt()` gives `7`, and `c.code` gives the character's numeric code.

String templates interpolate with `$name` for a plain name and `${...}` for anything more:

```kotlin
val cost = 5
println("$cost items cost ${cost * 3} dollars")
```

Triple-quoted strings span lines and take no escapes, which is handy for expected output in tests:

```kotlin
val block = """
    line one
    line two
""".trimIndent()
```

## Asking questions about a string

The exercises lean on these constantly, in your own code and in the tests that check it. They all return a new value; none of them changes the string.

```kotlin
val s = "kotlin"

s.startsWith("kot")   // true
s.endsWith("lin")     // true
s.contains("tl")      // true — "tl" in s says the same thing
s.indexOf('t')        // 2, and -1 when the character is not there
"a b c".lastIndexOf(' ')  // 3 — the last occurrence
```

Emptiness comes in two flavours, and mixing them up is a classic bug:

```kotlin
"".isEmpty()        // true   — length is zero
"  ".isEmpty()      // false  — two spaces are two characters
"  ".isBlank()      // true   — empty or only whitespace
"a".isNotEmpty()    // true
"a".isNotBlank()    // true
```

Taking a string apart:

```kotlin
s.take(3)                        // "kot"
s.drop(3)                        // "lin"
s.reversed()                     // "niltok"
"  hi  ".trim()                  // "hi"
"ab".repeat(3)                   // "ababab"
"a,b,,c".split(",")              // [a, b, , c] — empty pieces are kept
"a b  c".split(Regex("\\s+"))    // [a, b, c]
"a=1=2".substringBefore('=')     // "a"
"a=1=2".substringAfter('=')      // "1=2" — splits at the FIRST '='
"SAVE10".removePrefix("SAVE")    // "10", and unchanged if the prefix is absent
"a-b".replace("-", "+")          // "a+b"
"abc".toList()                   // [a, b, c]
```

When you are assembling a string piece by piece, `buildString` gives you a `StringBuilder` and returns the finished text:

```kotlin
buildString {
    append("a")
    append(1)
}                                // "a1"
```

## Character tests

`Char` has its own predicates, and they are not the `String` ones. Calling `uppercase()` on a `Char` or `uppercaseChar()` on a `String` is usually the first compile error people hit here.

```kotlin
'7'.isDigit()          // true
'a'.isLetter()         // true
'_'.isLetterOrDigit()  // false — the usual test for "not punctuation"
' '.isWhitespace()     // true
'a'.isUpperCase()      // false

'a'.uppercaseChar()    // 'A'  — a Char
'A'.lowercaseChar()    // 'a'
'7'.digitToInt()       // 7    — throws on a non-digit
'A'.code               // 65
'A'.toString()         // "A"  — a one-character String
'a' in 'a'..'z'        // true — ranges work on characters
```

## Booleans and equality

`Boolean` is `true` or `false`, and nothing else is: there is no truthiness, so `if (count)` will not compile. `&&` and `||` short-circuit, `!` negates.

`==` compares *values* by calling `equals`, so `"ab" + "c" == "abc"` is `true`. `===` compares identity, which you almost never want. Comparison operators `< > <= >=` work on anything comparable, including `String` (alphabetically) and `Char`.

## Constants

A `val` at the top level marked `const` is inlined at compile time. It has to be a primitive or `String` literal, and it lives outside any function:

```kotlin
const val MAX_RETRIES = 3
```

A top-level `val` without `const` is also fine; it is just computed when the file loads.

```kotlin playground
const val SLICES_PER_CAKE = 8

fun main() {
    val guests = 7
    var cakes = 3
    cakes += 1

    val slices = cakes * SLICES_PER_CAKE
    println("$cakes cakes = $slices slices for $guests guests")
    println("  whole slices each: ${slices / guests}")
    println("  exactly:           ${slices.toDouble() / guests}")
    println("  left on the plate: ${slices % guests}")

    val edge = Int.MAX_VALUE
    println("Int stops at $edge, and $edge + 1 wraps to ${edge + 1}")
    println("Long goes to ${Long.MAX_VALUE}")

    val name = "Kotlin"
    val initial: Char = name[0]
    println("'$initial' has code ${initial.code}; ${name.uppercase()} is ${name.length} letters")
    println("receipt no. ${17.toString().padStart(5, '0')}")

    // Try: change `slices.toDouble() / guests` to `slices / guests` and watch the fraction vanish.
}
```

## Exercises

### 1. Average of three

`average(a, b, c)` returns the mean of three whole numbers as a `Double`. `average(1, 2, 3)` is `2.0` and `average(1, 2, 4)` is `2.3333333333333335`. Negative numbers count normally.

```kotlin starter
fun average(a: Int, b: Int, c: Int): Double {
    return 0.0
}
```

```kotlin test
class AverageTest {
    // whole answers
    @Test
    fun whole() {
        assertEquals(2.0, average(1, 2, 3), 1e-9)
        assertEquals(10.0, average(10, 10, 10), 1e-9)
        assertEquals(0.0, average(0, 0, 0), 1e-9)
    }

    // fractions are not thrown away
    @Test
    fun fractions() {
        assertEquals(1.0 / 3, average(1, 0, 0), 1e-9)
        assertEquals(7.0 / 3, average(1, 2, 4), 1e-9)
        assertEquals(16.0 / 3, average(5, 5, 6), 1e-9)
    }

    // negatives and mixed signs
    @Test
    fun negatives() {
        assertEquals(-2.0, average(-1, -2, -3), 1e-9)
        assertEquals(-1.0 / 3, average(-1, 1, -1), 1e-9)
        assertEquals(0.0, average(-5, 0, 5), 1e-9)
    }
}
```

#### Uses
- [Variables & types › Integer division](#/basics/integer-division)
- [Variables & types › Converting between types](#/basics/converting-between-types)

#### Hints
- `(a + b + c) / 3` divides three `Int`s, so the answer is truncated before it is ever a `Double`.
- Make one side a `Double` first: `(a + b + c).toDouble() / 3`, or divide by `3.0`.
- The whole body is one expression, so `fun average(a: Int, b: Int, c: Int) = (a + b + c) / 3.0` is enough.

#### Tips
- Comparing `Double`s for exact equality is a bad habit; the tests allow a tiny tolerance instead.
- That tolerance is the three-argument `assertEquals(expected, actual, 1e-9)`. The two-argument form on a `Double` would be asking the wrong question.
- `(a + b + c) / 3.0` and `(a + b + c).toDouble() / 3` are the same answer. Dividing by `3` and converting afterwards is not.

#### Docs
- [Basic types: numbers](https://kotlinlang.org/docs/numbers.html)
- [Explicit number conversions](https://kotlinlang.org/docs/numbers.html#explicit-number-conversions)

### 2. Initials

`initials(first, last)` returns the two initials, uppercase, each followed by a dot: `initials("ada", "lovelace")` is `"A.L."`. The inputs may be in any case, and both names have at least one letter.

```kotlin starter
fun initials(first: String, last: String): String {
    return "?.?."
}
```

```kotlin test
class InitialsTest {
    // takes the first letter of each name
    @Test
    fun basic() {
        assertEquals("A.L.", initials("Ada", "Lovelace"))
        assertEquals("G.H.", initials("Grace", "Hopper"))
    }

    // any input case gives uppercase initials
    @Test
    fun uppercases() {
        assertEquals("A.L.", initials("ada", "lovelace"))
        assertEquals("K.T.", initials("kotlin", "TEAM"))
        assertEquals("X.Y.", initials("x", "y"))
    }

    // exactly four characters, dots in the right places
    @Test
    fun shape() {
        val out = initials("barbara", "liskov")
        assertEquals(4, out.length)
        assertEquals('.', out[1])
        assertEquals('.', out[3])
        assertEquals("B.L.", out)
    }
}
```

#### Uses
- [Variables & types › Strings and characters](#/basics/strings-and-characters)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)
- [Variables & types › Character tests](#/basics/character-tests)

#### Hints
- `first[0]` is the first `Char` of a string; `first.first()` is the same thing spelled out.
- A `Char` has `uppercaseChar()`; a `String` has `uppercase()`. Pick whichever matches what you took.
- Build the answer with a template: `"${...}.${...}."`.

#### Tips
- `first.take(1).uppercase()` gives you a `String` instead of a `Char`, which also works.
- A `Char` in a string template interpolates as itself, so `"${name.first()}."` needs no conversion.
- `first()` and `[0]` both throw on an empty string. The tests never pass one, but a real caller would.

#### Docs
- [Characters](https://kotlinlang.org/docs/characters.html)
- [String templates](https://kotlinlang.org/docs/strings.html#string-templates)

### 3. Clock label

`clock(totalSeconds)` turns a count of seconds into `"HH:MM:SS"`, every part padded to two digits: `clock(3661)` is `"01:01:01"` and `clock(0)` is `"00:00:00"`. Hours are not wrapped at 24, so `clock(90000)` is `"25:00:00"`. `totalSeconds` is never negative.

```kotlin starter
fun clock(totalSeconds: Int): String {
    return "00:00:00"
}
```

```kotlin test
class ClockTest {
    // splits into hours, minutes and seconds
    @Test
    fun splits() {
        assertEquals("01:01:01", clock(3661))
        assertEquals("00:02:05", clock(125))
        assertEquals("12:34:56", clock(45296))
    }

    // zero and single-digit parts are padded
    @Test
    fun padding() {
        assertEquals("00:00:00", clock(0))
        assertEquals("00:00:09", clock(9))
        assertEquals("00:10:00", clock(600))
    }

    // hours keep counting past 24
    @Test
    fun beyondADay() {
        assertEquals("24:00:00", clock(86400))
        assertEquals("25:00:00", clock(90000))
        assertEquals("100:00:01", clock(360001))
    }
}
```

#### Uses
- [Variables & types › Integer division](#/basics/integer-division)
- [Variables & types › Strings and characters](#/basics/strings-and-characters)

#### Hints
- Hours are `totalSeconds / 3600`. What is left after them is `totalSeconds % 3600`.
- From that remainder, minutes are `/ 60` and seconds are `% 60`.
- `n.toString().padStart(2, '0')` turns `9` into `"09"` and leaves `25` as `"25"`.

#### Tips
- Give each part its own `val` before you build the string. One giant template is where the off-by-one hides.
- `padStart` only ever adds characters: `"25".padStart(2, '0')` is still `"25"`, so you can apply it to every part without checking the width first.

#### Docs
- [padStart](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/pad-start.html)

### 4. Money

`money(cents)` formats a whole number of cents as a price string: `money(1234)` is `"$12.34"`, `money(5)` is `"$0.05"`, and `money(0)` is `"$0.00"`. Negative amounts put the minus sign in front of the dollar sign: `money(-1234)` is `"-$12.34"`.

```kotlin starter
fun money(cents: Int): String {
    return "\$0.00"
}
```

```kotlin test
class MoneyTest {
    // dollars and cents
    @Test
    fun positive() {
        assertEquals("\$12.34", money(1234))
        assertEquals("\$1.00", money(100))
        assertEquals("\$100.99", money(10099))
    }

    // small amounts keep two decimal places
    @Test
    fun smallAmounts() {
        assertEquals("\$0.00", money(0))
        assertEquals("\$0.05", money(5))
        assertEquals("\$0.50", money(50))
        assertEquals("\$0.99", money(99))
    }

    // the minus sign comes before the dollar sign
    @Test
    fun negative() {
        assertEquals("-\$12.34", money(-1234))
        assertEquals("-\$0.05", money(-5))
        assertEquals("-\$1.00", money(-100))
    }
}
```

#### Uses
- [Variables & types › Integer division](#/basics/integer-division)
- [Variables & types › Strings and characters](#/basics/strings-and-characters)
- [Variables & types › Booleans and equality](#/basics/booleans-and-equality)
- [Variables & types › Clamping and kotlin.math](#/basics/clamping-and-kotlin-math)

#### Hints
- Integer division truncates toward zero and `%` keeps the left operand's sign, so `-5 / 100` is `0` and `-5 % 100` is `-5`. Working with `-5` directly gives you `"$0.-5"`.
- Take the sign off first: remember whether `cents < 0`, then do all the arithmetic on `kotlin.math.abs(cents)`.
- Put it together with a template, padding the cents part to two digits: `"$sign\$$dollars.$paddedCents"`.

#### Tips
- A literal `$` in a string has to be escaped as `\$`, or written as `${'$'}`, since a bare `$` starts a template.
- `abs` lives in `kotlin.math` and is overloaded per type, so `abs(-5)` is an `Int` and needs no conversion afterwards.
- Take the sign off before the arithmetic, not after. Formatting a negative and then prefixing a minus is where this exercise usually goes wrong.

#### Docs
- [String literals and escaping](https://kotlinlang.org/docs/strings.html#string-literals)
- [kotlin.math.abs](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.math/abs.html)
