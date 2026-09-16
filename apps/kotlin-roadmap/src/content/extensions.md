# Extension functions

An extension lets you call a function you wrote as if it were a method on a type you do not own. `"hello".shout()` can be your code, on a class you cannot change, with no wrapper, no subclass and no `StringUtils` to import.

This is not magic added to the class at runtime. An extension compiles to a plain static function that takes the receiver as its first argument — the syntax is the whole feature, and it is a very good one, because it lets the call read in the order things happen: `text.trim().wrap(40).indent(2)` instead of `indent(wrap(trim(text), 40), 2)`.

## Writing an extension function

Put the receiver type before the function name. Inside the body, `this` is the receiver, and you can leave it out just as in a method.

```kotlin
fun String.shout(): String = this.uppercase() + "!"
fun String.initials(): String = split(" ").map { it.first() }.joinToString("")
fun Int.squared(): Int = this * this

println("hello".shout())        // HELLO!
println("ada lovelace".initials())  // al
println(7.squared())            // 49
```

An extension can be declared at the top level of any file, take parameters and default arguments, be generic, and be called by anyone who imports it. What it cannot do is see private members of the class it extends — it is outside code, and it stays outside code.

## Extensions are resolved statically

Because an extension is a static function, the compiler picks it by the **declared** type of the expression, not the runtime type.

```kotlin
open class Animal
class Dog : Animal()

fun Animal.name() = "animal"
fun Dog.name() = "dog"

val pet: Animal = Dog()
println(pet.name())   // animal — the declared type of `pet` decides
```

There is no overriding here and no dynamic dispatch. The same rule settles the other collision: **a member always wins over an extension with the same signature.** If the class already has `fun size()`, your `fun Thing.size()` is dead code, silently. Adding a member to a library class in a later version can therefore quietly take over calls that used to reach your extension — one more reason to keep extensions small and obvious.

## Extension properties

The same syntax works for a property, as long as it computes its value. An extension property has no backing field, because there is nowhere to put one, so it must define a getter.

```kotlin
val String.firstWord: String get() = substringBefore(" ")
val Int.isEven: Boolean get() = this % 2 == 0

println("hello world".firstWord)   // hello
println(10.isEven)                 // true
```

`val String.x: Int = 0` does not compile: initializers are backing fields, and there are none. Use an extension property when the value is a property of the receiver conceptually and cheap to compute, and an extension function when it does work.

## Extending your own types

Extensions are not only for other people's classes. Keeping a data class to its data and putting the derived answers next to where they are used keeps the type honest:

```kotlin
data class Rect(val width: Int, val height: Int)

val Rect.area: Int get() = width * height
fun Rect.scaled(factor: Int) = copy(width = width * factor, height = height * factor)

println(Rect(3, 4).area)          // 12
println(Rect(3, 4).scaled(2))     // Rect(width=6, height=8)
```

Inside the extension, `width`, `copy` and every other public member are in scope without a prefix, exactly as in a method body.

## Nullable receivers

The receiver type may be nullable, and then the extension gets to handle `null` itself instead of the caller doing it at every call site:

```kotlin
fun String?.orBlank(): String = this ?: ""

val missing: String? = null
println(missing.orBlank().length)   // 0, no safe call needed
```

This is how `toString()` on a `null` reference prints `"null"` rather than crashing, and how `isNullOrEmpty()` works. Inside such a function `this` can be `null`, so check it before touching anything.

## operator and infix extensions

Operators in Kotlin are conventions: `a + b` compiles to `a.plus(b)`, and `plus` can be an extension. `infix` drops the dot and parentheses for a single-argument function.

```kotlin
data class Money(val cents: Int)

operator fun Money.plus(other: Money) = Money(cents + other.cents)
operator fun Money.times(n: Int) = Money(cents * n)
infix fun Int.pow(exp: Int): Int {
    var result = 1
    repeat(exp) { result *= this }
    return result
}

println(Money(150) + Money(99))   // Money(cents=249)
println(Money(150) * 3)           // Money(cents=450)
println(2 pow 10)                 // 1024
```

The operator names are fixed (`plus`, `minus`, `times`, `div`, `rem`, `get`, `contains`, `compareTo`, ...) and each one is tied to its symbol. Use them when the symbol means what everybody expects; an `operator fun` that surprises the reader is worse than a named function.

## Where extensions live

An extension is only callable where it is in scope: in the file that declares it, or wherever it is imported from. That is the quiet benefit over adding a method to the class — `import com.acme.text.wrap` brings in exactly one function, and code that does not import it is not affected. Standard practice is a small file per group of extensions, named after what they extend.

```kotlin playground
data class Task(val title: String, val minutes: Int, val done: Boolean)

val Task.hours: Double get() = minutes / 60.0
fun Task.finished() = copy(done = true)
fun Task.line(): String = "[${if (done) "x" else " "}] $title (${minutes}m)"

fun String.truncate(max: Int): String = if (length <= max) this else take(max - 1) + "…"
val String.wordCount: Int get() = split(" ").count { it.isNotBlank() }
fun String?.orDash(): String = if (isNullOrBlank()) "-" else this

operator fun Task.plus(extra: Int) = copy(minutes = minutes + extra)

fun main() {
    val task = Task("write the release notes", 90, false)

    println(task.line())
    println(task.finished().line())
    println("still ${task.done} on the original")
    println("%.1f hours".format(task.hours))

    println((task + 30).line())

    println(task.title.truncate(12))
    println("${task.title.wordCount} words in the title")

    val note: String? = null
    println("note: ${note.orDash()}")
}
```

## Exercises

### 1. Two little extensions on Int

Write an extension property `Int.isEven`, true for even numbers, and an extension function `Int.clamp(min, max)` that returns the receiver pinned into the range: `min` when it is below, `max` when it is above, and the number itself when it already fits. Assume `min <= max`.

```kotlin starter
val Int.isEven: Boolean get() = true

fun Int.clamp(min: Int, max: Int): Int = this
```

```kotlin test
class IntExtensionsTest {
    // even and odd, including zero and negatives
    @Test
    fun even() {
        assertTrue("2 is even", 2.isEven)
        assertTrue("0 is even", 0.isEven)
        assertTrue("-4 is even", (-4).isEven)
        assertEquals(false, 7.isEven)
        assertEquals(false, (-3).isEven)
    }

    // a value inside the range comes back unchanged
    @Test
    fun inside() {
        assertEquals(5, 5.clamp(0, 10))
        assertEquals(0, 0.clamp(0, 10))
        assertEquals(10, 10.clamp(0, 10))
        assertEquals(-5, (-5).clamp(-10, -1))
    }

    // values outside are pulled to the nearest bound
    @Test
    fun outside() {
        assertEquals(0, (-3).clamp(0, 10))
        assertEquals(10, 99.clamp(0, 10))
        assertEquals(-10, (-40).clamp(-10, -1))
        assertEquals(-1, 7.clamp(-10, -1))
    }

    // a range of one value
    @Test
    fun singleValue() {
        assertEquals(3, 1.clamp(3, 3))
        assertEquals(3, 9.clamp(3, 3))
        assertEquals(3, 3.clamp(3, 3))
    }
}
```

#### Uses
- [Extension functions › Writing an extension function](#/extensions/writing-an-extension-function)
- [Extension functions › Extension properties](#/extensions/extension-properties)
- [Variables & types › Clamping and kotlin.math](#/basics/clamping-and-kotlin-math)

#### Hints
- An extension property needs a getter, not an initializer: `val Int.isEven: Boolean get() = ...`.
- Inside both, `this` is the number the extension was called on, so `isEven` is `this % 2 == 0`.
- `clamp` is two comparisons, or one expression with the standard library: `maxOf(min, minOf(this, max))`.

#### Tips
- `coerceIn(min, max)` in the standard library already does this. Writing it once shows why extensions make such utilities feel built in.
- An extension property must define a getter and cannot have an initializer, because there is nowhere to put a backing field.
- An extension compiles to a static function taking the receiver as its first argument, so it can only see public members of the type it extends.

#### Docs
- [Extension properties](https://kotlinlang.org/docs/extensions.html#extension-properties)

### 2. Title case

`String.titleCase()` uppercases the first letter of every word and lowercases the rest. A word starts at the beginning of the string and after any whitespace. All whitespace is preserved exactly as it was, so only letters change.

```kotlin starter
fun String.titleCase(): String = this
```

```kotlin test
class TitleCaseTest {
    // capitalises each word
    @Test
    fun words() {
        assertEquals("Hello World", "hello world".titleCase())
        assertEquals("Kotlin Is Fun", "kotlin IS fun".titleCase())
        assertEquals("The Quick Brown Fox", "THE QUICK BROWN FOX".titleCase())
    }

    // whitespace is preserved exactly
    @Test
    fun spacing() {
        assertEquals("  Hi  There ", "  hi  there ".titleCase())
        assertEquals("A\tB\nC", "a\tb\nc".titleCase())
    }

    // only the first letter of a word changes
    @Test
    fun insideWords() {
        assertEquals("O'neil Mcdonald", "o'neil mcDonald".titleCase())
        assertEquals("123 Abc", "123 abc".titleCase())
        assertEquals("Ok", "oK".titleCase())
    }

    // empty and single-character strings
    @Test
    fun small() {
        assertEquals("", "".titleCase())
        assertEquals("A", "a".titleCase())
        assertEquals(" ", " ".titleCase())
    }
}
```

#### Uses
- [Extension functions › Writing an extension function](#/extensions/writing-an-extension-function)
- [Variables & types › Character tests](#/basics/character-tests)

#### Hints
- Walk the characters and remember whether you are at the start of a word: a flag that is `true` at the beginning and becomes `true` again after every whitespace character.
- `buildString { }` gives you a string builder to `append` to, and returns the finished string.
- `c.isWhitespace()`, `c.uppercaseChar()` and `c.lowercaseChar()` are all you need for the characters themselves.

#### Tips
- `"abc".uppercase()` works on whole strings and `'a'.uppercaseChar()` on single characters — mixing them up is the usual first compile error here.
- Any whitespace starts a new word, not just a space: a tab or a newline has to count too, which is what `isWhitespace()` is for.
- Lowercase the rest of each word as you go. Passing `"hELLO"` through untouched is the case that catches a solution which only fixes the first letter.

#### Docs
- [buildString](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/build-string.html)

### 3. Extending a data class

`Duration` holds a whole number of seconds, never negative. Add to it:

- `val Duration.minutes: Int` — the number of **whole** minutes, so 119 seconds is 1.
- `operator fun Duration.plus(other: Duration)` — a new `Duration` with the seconds added, leaving both inputs alone.
- `fun Duration.format(): String` — `"1m 05s"`: whole minutes, then the remaining seconds always as two digits.

```kotlin starter
data class Duration(val seconds: Int)

val Duration.minutes: Int get() = seconds

operator fun Duration.plus(other: Duration): Duration = this

fun Duration.format(): String = "${seconds}s"
```

```kotlin test
class DurationTest {
    // whole minutes, rounded down
    @Test
    fun minutes() {
        assertEquals(1, Duration(60).minutes)
        assertEquals(1, Duration(119).minutes)
        assertEquals(0, Duration(59).minutes)
        assertEquals(0, Duration(0).minutes)
        assertEquals(10, Duration(600).minutes)
    }

    // plus adds and leaves both inputs alone
    @Test
    fun adds() {
        val a = Duration(60)
        val b = Duration(5)
        assertEquals(Duration(65), a + b)
        assertEquals(Duration(0), Duration(0) + Duration(0))
        assertEquals(Duration(60), a)
        assertEquals(Duration(5), b)
    }

    // the seconds are always two digits
    @Test
    fun formatting() {
        assertEquals("1m 05s", Duration(65).format())
        assertEquals("0m 05s", Duration(5).format())
        assertEquals("10m 00s", Duration(600).format())
        assertEquals("0m 00s", Duration(0).format())
        assertEquals("1m 59s", Duration(119).format())
    }

    // it all composes
    @Test
    fun together() {
        assertEquals("2m 00s", (Duration(90) + Duration(30)).format())
        assertEquals(2, (Duration(90) + Duration(30)).minutes)
    }
}
```

#### Uses
- [Extension functions › Extending your own types](#/extensions/extending-your-own-types)
- [Extension functions › operator and infix extensions](#/extensions/operator-and-infix-extensions)
- [Data & enum classes › Data classes](#/data-classes/data-classes)

#### Hints
- Inside the extensions, `seconds` refers to the receiver's property; no `this.` needed.
- Integer division already rounds down: `seconds / 60`. The leftover is `seconds % 60`.
- Two digits: `"%02d".format(n)`, or `n.toString().padStart(2, '0')`.

#### Tips
- `plus` returns a new `Duration` because `Duration` is immutable — the same reason `copy` exists.
- Operator names are fixed: `+` only ever calls `plus`. You cannot invent a symbol, and an `operator fun` whose meaning surprises the reader is worse than a named function.
- Inside the extension, `seconds` and `copy` are in scope with no prefix, exactly as they would be in a method body.

#### Docs
- [Operator overloading](https://kotlinlang.org/docs/operator-overloading.html)
- [padStart](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/pad-start.html)

### 4. Wrap a paragraph

`String.wrap(width)` breaks text into lines of at most `width` characters, joined with `"\n"`. Words are separated by whitespace and put on a line greedily: keep adding words while the line — counting the single space between words — still fits. A word longer than `width` goes on a line of its own and is not broken up. Leading, trailing and repeated whitespace disappears, and a blank string wraps to `""`.

```kotlin starter
fun String.wrap(width: Int): String = this
```

```kotlin test
class WrapTest {
    // fills each line greedily
    @Test
    fun greedy() {
        assertEquals("the quick\nbrown fox", "the quick brown fox".wrap(10))
        assertEquals("the quick brown\nfox", "the quick brown fox".wrap(15))
        assertEquals("aa bb", "aa bb".wrap(5))
        assertEquals("aa\nbb", "aa bb".wrap(4))
    }

    // one word per line when the width is small
    @Test
    fun narrow() {
        assertEquals("the\nquick\nbrown\nfox", "the quick brown fox".wrap(5))
        assertEquals("a\nb\nc", "a b c".wrap(1))
    }

    // a word longer than the width keeps its own line
    @Test
    fun longWords() {
        assertEquals("extraordinary", "extraordinary".wrap(5))
        assertEquals("hi\nextraordinary\nthere", "hi extraordinary there".wrap(5))
        assertEquals("ok\nunbelievable", "ok unbelievable".wrap(6))
    }

    // extra whitespace is dropped
    @Test
    fun whitespace() {
        assertEquals("a b", "  a\t\tb  ".wrap(10))
        assertEquals("", "".wrap(10))
        assertEquals("", "   ".wrap(10))
    }

    // everything fits on one line when the width is generous
    @Test
    fun oneLine() {
        assertEquals("the quick brown fox", "the quick brown fox".wrap(100))
        assertEquals("solo", "solo".wrap(100))
    }
}
```

#### Uses
- [Extension functions › Writing an extension function](#/extensions/writing-an-extension-function)

#### Hints
- Get the words first: `trim().split(Regex("\\s+"))`, and remember that splitting an empty string gives you a list holding one empty string.
- Keep the current line in a `var line = ""`. A word fits when `line.length + 1 + word.length <= width`; when it does not, push the line and start a new one with that word.
- A word longer than `width` falls out of that rule by itself: it never fits next to anything, so it starts a line and is immediately pushed by the following word.

#### Tips
- Greedy wrapping is what every terminal does. The prettier "minimum raggedness" wrapping used by typesetters needs dynamic programming and a definition of pretty.
- Splitting `""` gives a list holding one empty string, not an empty list. That is the edge case this exercise hides.
- The `+ 1` in `line.length + 1 + word.length` is the space you are about to add. Leave it out and every line comes back one character too long.

#### Docs
- [split](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/split.html)
- [joinToString](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/join-to-string.html)
