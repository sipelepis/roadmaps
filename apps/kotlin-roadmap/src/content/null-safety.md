# Null safety

In Kotlin, `null` is part of the type system. A `String` can never be null; only a `String?` can. The compiler will not let you use a nullable value until you have dealt with the null case, which turns the null pointer exception from a runtime surprise into a compile error.

That one rule brings a small vocabulary with it: `?.` to call through a nullable, `?:` to supply a fallback, `!!` to insist, and `as?` to cast without throwing. This module is that vocabulary.

## Nullable types

Every type has a nullable twin, written with a trailing `?`:

```kotlin
var name: String = "Ada"
name = null            // error: null cannot be a value of a non-null type String

var nickname: String? = "Addy"
nickname = null        // fine
```

A `String?` is a *wider* type than `String`: every `String` is a valid `String?`, so assigning one to the other works in that direction only. And you cannot use a `String?` as if it were a `String`:

```kotlin
val length = nickname.length   // error: only safe (?.) or non-null asserted (!!.) calls are allowed
```

The error is the point. The compiler is asking what should happen when `nickname` is null, and the rest of this module is the list of answers.

## Checking for null and smart casts

The plainest answer is an `if`. Once you have checked, the compiler *smart casts* the value to the non-null type for the rest of that branch:

```kotlin
if (nickname != null) {
    println(nickname.length)   // nickname is a String here, no ? needed
}
```

Smart casts work for `is` checks too, and for early returns: after `if (nickname == null) return 0`, the value is non-null below. They need the compiler to be sure the value cannot change in between, which holds for a `val` or a local `var`, but not for a `var` that something else could write to.

## Safe calls

`?.` calls a member only when the receiver is not null, and produces `null` otherwise:

```kotlin
val n: Int? = nickname?.length      // Int? — null when nickname is null
val upper = nickname?.uppercase()   // String?
```

Safe calls chain, and the whole chain gives up at the first null: `a?.b?.c` is `null` if any link is. The result type is always nullable, which is what makes the compiler keep asking until you handle it.

`?.let { ... }` runs a block only for non-null values; it belongs to the scope functions module, but you will see it everywhere.

## The Elvis operator

`?:` takes the left side unless it is null, in which case it takes the right:

```kotlin
val length = nickname?.length ?: 0
val label = nickname ?: "no nickname"
```

The right-hand side can be any expression, including one that never returns a value, which is how you turn a null into an early exit:

```kotlin
val id = lookupId(name) ?: return "unknown"
val port = setting ?: throw IllegalStateException("port not configured")
```

It reads sideways: "the length, or else 0". Together with `?.` it covers most nullable code you will write.

## Asserting non-null

`!!` converts a nullable to a non-null, and throws `NullPointerException` if it was null:

```kotlin
val length = nickname!!.length   // NPE if nickname is null
```

It is the escape hatch, and reaching for it is usually a sign that the type should not have been nullable in the first place. Legitimate uses exist — a value you initialised yourself two lines up, a test asserting a value is present — but `?:` with a real fallback or a thrown exception carrying a message is nearly always better. `!!` tells your reader nothing about *why* it cannot be null.

## Safe casts with `as?`

`as` casts and throws `ClassCastException` when the value is the wrong type. `as?` casts and gives `null` instead:

```kotlin
val value: Any = "42"
val text = value as? String      // "42"
val number = value as? Int       // null, no exception
```

That pairs naturally with `?:`: `val n = value as? Int ?: 0`. Inside a `when (value) { is Int -> ... }`, the `is` check smart casts for you and no explicit cast is needed at all.

## Nullable strings and numbers

The standard library has functions built for nullable receivers, so you can skip a check:

```kotlin
val s: String? = null
s.isNullOrEmpty()     // true — callable on a null receiver
s.isNullOrBlank()     // true, and also true for "   "
s.orEmpty()           // "" — a String, not a String?
```

Parsing gives you a nullable instead of an exception when you ask for it:

```kotlin
"42".toIntOrNull()    // 42
"4x".toIntOrNull()    // null
" 4".toIntOrNull()    // null — no trimming, no leniency
"42".toInt()          // 42, but throws NumberFormatException on "4x"
```

## Platform types

Values that come from Java have *platform types*, written `String!` in error messages: the compiler does not know whether they can be null, so it lets you use them either way and checks nothing. They are the one place a null pointer exception can still reach you unannounced.

```kotlin
val name: String = someJavaApi.getName()   // compiles, and throws here if it was null
val safe: String? = someJavaApi.getName()  // you decided; now the compiler helps again
```

The rule is to pin the type down the moment a value crosses the boundary. Write `String?` and handle the null, or write `String` and accept that you have asserted something the compiler could not check. Anything from `System.getenv`, a JVM map lookup, or a library without nullability annotations falls into this category.

The same discipline applies to `!!`. It is the one operator that converts a compile-time question into a runtime crash, and a chain like `a!!.b!!.c` throws without telling you which link was null. When you catch yourself writing it, the honest fix is almost always to make the type non-null further upstream.

```kotlin playground
fun lookup(id: Int): String? = if (id == 1) "Ada" else null

fun main() {
    val found: String? = lookup(1)
    val missing: String? = lookup(2)

    println("found:   ${found?.uppercase()} (${found?.length} letters)")
    println("missing: ${missing?.uppercase()} (${missing?.length ?: 0} letters)")
    println("fallback: ${missing ?: "nobody"}")

    if (found != null) {
        println("smart cast: ${found.length} letters, no question mark needed")
    }

    println("\"42\".toIntOrNull() = ${"42".toIntOrNull() ?: "null"}")
    println("\"4x\".toIntOrNull() = ${"4x".toIntOrNull() ?: "null"}")
    println("\" 4\".toIntOrNull() = ${" 4".toIntOrNull() ?: "null"}")

    val anything: Any = "not a number"
    println("as? Int  -> ${anything as? Int}")
    println("as? String -> ${anything as? String}")

    try {
        println(missing!!.length)
    } catch (e: NullPointerException) {
        println("!! on a null threw ${e::class.simpleName}, exactly as advertised")
    }

    // Try: drop the `?:` from the `missing?.length` line and watch the type become Int?.
}
```

## Exercises

### 1. Display name

`displayName(name)` takes a `String?` and returns something safe to show. Trim the name and return it; if it is null, empty, or only spaces, return `"Anonymous"` instead.

```kotlin starter
fun displayName(name: String?): String {
    return "Anonymous"
}
```

```kotlin test
class DisplayNameTest {
    // a real name comes back trimmed
    @Test
    fun realName() {
        assertEquals("Ada", displayName("Ada"))
        assertEquals("Ada Lovelace", displayName("  Ada Lovelace  "))
        assertEquals("x", displayName(" x"))
    }

    // null, empty and blank all become Anonymous
    @Test
    fun missing() {
        assertEquals("Anonymous", displayName(null))
        assertEquals("Anonymous", displayName(""))
        assertEquals("Anonymous", displayName("   "))
        assertEquals("Anonymous", displayName("\t "))
    }

    // inner spaces survive
    @Test
    fun innerSpaces() {
        assertEquals("Ada  B", displayName("Ada  B "))
        assertEquals("A n o n", displayName("A n o n"))
    }
}
```

#### Uses
- [Null safety › The Elvis operator](#/null-safety/the-elvis-operator)
- [Null safety › Safe calls](#/null-safety/safe-calls)
- [Null safety › Nullable strings and numbers](#/null-safety/nullable-strings-and-numbers)

#### Hints
- `name?.trim()` is a `String?`: the trimmed name, or null when `name` was.
- Then decide between that and the fallback. An `if` on `isNullOrBlank()` works; so does a safe call plus `?:`.
- Watch the order: trim first, then test for blank, or `"   "` slips through as a three-space name.

#### Tips
- `String?.isNullOrBlank()` can be called on a null receiver — that is the whole point of it — so no `?.` is needed in front.
- `?.` gives up on the first null and hands back `null`, so `name?.trim()?.uppercase()` needs no intermediate checks.
- `orEmpty()` turns a `String?` into a `String` with `""` for null, which is often tidier than `?: ""`.

#### Docs
- [Null safety](https://kotlinlang.org/docs/null-safety.html)
- [isNullOrBlank](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/is-null-or-blank.html)

### 2. Parse an age

`parseAge(input)` takes a `String?` and returns the age it holds. Return `-1` when the input is null, is not a plain whole number, or is negative. `parseAge("0")` is `0`, and `parseAge(" 7")` is `-1` because a leading space is not part of a number.

```kotlin starter
fun parseAge(input: String?): Int {
    return 0
}
```

```kotlin test
class ParseAgeTest {
    // ordinary numbers
    @Test
    fun numbers() {
        assertEquals(7, parseAge("7"))
        assertEquals(0, parseAge("0"))
        assertEquals(42, parseAge("42"))
        assertEquals(120, parseAge("120"))
    }

    // null and unparseable input
    @Test
    fun rejected() {
        assertEquals(-1, parseAge(null))
        assertEquals(-1, parseAge(""))
        assertEquals(-1, parseAge("abc"))
        assertEquals(-1, parseAge("12abc"))
        assertEquals(-1, parseAge("3.5"))
        assertEquals(-1, parseAge(" 7"))
    }

    // negative ages are rejected too
    @Test
    fun negatives() {
        assertEquals(-1, parseAge("-1"))
        assertEquals(-1, parseAge("-42"))
    }
}
```

#### Uses
- [Null safety › Nullable strings and numbers](#/null-safety/nullable-strings-and-numbers)
- [Null safety › Safe calls](#/null-safety/safe-calls)
- [Null safety › The Elvis operator](#/null-safety/the-elvis-operator)

#### Hints
- `input?.toIntOrNull()` handles both failures at once: null input and unparseable input both give `null`.
- `?: return -1` turns that null into an early exit, leaving a plain `Int` behind.
- Then one more check rejects negatives.

#### Tips
- `toInt()` would throw on `"abc"`, and the test would report an exception rather than a wrong answer. `toIntOrNull()` keeps it a value you can reason about.
- `toIntOrNull()` does no trimming: `" 4".toIntOrNull()` is `null`. Trim first if the input might have spaces.
- `?: return -1` is an early exit that also narrows the type — everything below it is a plain `Int`.

#### Docs
- [toIntOrNull](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int-or-null.html)

### 3. Last-name initial

`lastInitial(fullName)` takes a `String?` and returns the uppercase first letter of the last word, as a `Char?`. `lastInitial("Ada Lovelace")` is `'L'`, `lastInitial("Ada")` is `'A'`, and a null, empty or blank name gives `null`. Surrounding spaces do not count as a word.

```kotlin starter
fun lastInitial(fullName: String?): Char? {
    return 'X'
}
```

```kotlin test
class LastInitialTest {
    // the last word's first letter
    @Test
    fun lastWord() {
        assertEquals('L', lastInitial("Ada Lovelace"))
        assertEquals('H', lastInitial("Grace Brewster Murray Hopper"))
        assertEquals('A', lastInitial("Ada"))
    }

    // uppercased, and stray spaces ignored
    @Test
    fun normalised() {
        assertEquals('L', lastInitial("ada lovelace"))
        assertEquals('L', lastInitial("  Ada Lovelace  "))
        assertEquals('K', lastInitial("kotlin"))
    }

    // nothing to take an initial from
    @Test
    fun missing() {
        assertNull("a null name has no initial", lastInitial(null))
        assertNull("an empty name has no initial", lastInitial(""))
        assertNull("a blank name has no initial", lastInitial("   "))
    }
}
```

#### Uses
- [Null safety › Nullable types](#/null-safety/nullable-types)
- [Null safety › Checking for null and smart casts](#/null-safety/checking-for-null-and-smart-casts)
- [Null safety › The Elvis operator](#/null-safety/the-elvis-operator)
- [Variables & types › Strings and characters](#/basics/strings-and-characters)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)
- [Variables & types › Character tests](#/basics/character-tests)

#### Hints
- Start with `val name = fullName?.trim() ?: return null`, which handles the null case and the stray spaces in one line. Below it, `name` is a plain `String`.
- An empty name after trimming has no last word, so return `null` for that too.
- `name.lastIndexOf(' ')` gives the position of the last space, or `-1` when there is none. The last word starts one character after it — and `-1 + 1` is `0`, which is exactly right for a single-word name.

#### Tips
- `name[start].uppercaseChar()` gives the `Char`. Returning a `Char?` from a function that sometimes has no answer is the honest signature; the caller then has to deal with it.
- `lastIndexOf` returns `-1` when there is no space, and `-1 + 1` is `0` — the single-word case falls out of the arithmetic instead of needing a branch.
- The tests use `assertNull` for the no-answer cases. Returning `' '` or `'?'` instead of `null` would fail them.

#### Docs
- [lastIndexOf](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/last-index-of.html)
- [Elvis operator](https://kotlinlang.org/docs/null-safety.html#elvis-operator)

### 4. Number out of anything

`asNumber(value)` takes an `Any?` and digs an `Int` out of it: an `Int` is returned as it is, a `String` that holds a whole number is parsed, and anything else — a `Double`, a `Boolean`, a string that is not a number, or `null` — gives `0`.

```kotlin starter
fun asNumber(value: Any?): Int {
    return 0
}
```

```kotlin test
class AsNumberTest {
    // numbers pass through
    @Test
    fun ints() {
        assertEquals(5, asNumber(5))
        assertEquals(0, asNumber(0))
        assertEquals(-3, asNumber(-3))
    }

    // strings are parsed
    @Test
    fun strings() {
        assertEquals(42, asNumber("42"))
        assertEquals(-7, asNumber("-7"))
        assertEquals(0, asNumber("0"))
    }

    // everything else is zero
    @Test
    fun rest() {
        assertEquals(0, asNumber(null))
        assertEquals(0, asNumber("abc"))
        assertEquals(0, asNumber(""))
        assertEquals(0, asNumber(3.7))
        assertEquals(0, asNumber(true))
        assertEquals(0, asNumber('7'))
    }
}
```

#### Uses
- [Null safety › Safe casts with `as?`](#/null-safety/safe-casts-with-as)
- [Null safety › The Elvis operator](#/null-safety/the-elvis-operator)
- [Null safety › Nullable strings and numbers](#/null-safety/nullable-strings-and-numbers)
- [Control flow › `when` with a subject](#/control-flow/when-with-a-subject)

#### Hints
- `value as? Int` is the `Int` case: the number when it really is an `Int`, `null` otherwise. No exception for a `Double`.
- `(value as? String)?.toIntOrNull()` is the string case — cast safely, then parse safely.
- Chain the two with `?:` and finish with `?: 0`. A `when (value) { is Int -> ...; is String -> ...; else -> 0 }` reads just as well and smart casts for you.

#### Tips
- `asNumber('7')` is `0`: a `Char` is not a `String`, and `as? String` says so without throwing.
- `as` without the question mark would blow up on the very first wrong type, which is why `as?` exists.

#### Docs
- [Safe casts](https://kotlinlang.org/docs/typecasts.html#safe-nullable-cast-operator)
- [Type checks and casts](https://kotlinlang.org/docs/typecasts.html)
