# Scope functions

Five functions in the standard library — `let`, `run`, `with`, `apply` and `also` — do nothing except run a block of code on an object. They add no behaviour at all; what they add is a *scope* in which the object is available as `it` or as `this`, so you can do several things to a value without naming it twice.

They look interchangeable because they nearly are. The differences are two: how the block refers to the object, and what the call returns. Learn that small table and the idioms built on it — null handling with `?.let`, object configuration with `apply`, side effects with `also` — stop looking like syntax and start looking like the obvious thing to write.

## The five scope functions

| function | object is | returns |
| --- | --- | --- |
| `let` | `it` | the block's result |
| `run` | `this` | the block's result |
| `with` | `this` | the block's result |
| `apply` | `this` | the object |
| `also` | `it` | the object |

`with` is the odd one out in syntax — it takes the object as an argument, `with(x) { ... }`, where the others are called on it, `x.let { ... }`.

## let

`let` passes the object as `it` and gives back whatever the block produces. Its main use is the safe call: `x?.let { ... }` runs the block only when `x` is not null, which is how you turn "do this if there is a value" into one expression.

```kotlin
val name: String? = readName()

val length = name?.let { it.trim().length } ?: 0
val shout = name?.let { "HEY ${it.uppercase()}" } ?: "nobody here"
```

Inside the block `it` is the non-null type, so no further `?.` is needed. `let` is also a way to keep a temporary value out of the surrounding scope:

```kotlin
val stats = numbers.filter { it > 0 }.let { positives ->
    "${positives.size} positive, sum ${positives.sum()}"
}
```

Naming the parameter, as `positives` here, beats `it` as soon as the block is longer than a line or one `let` sits inside another.

## run

`run` is `let` with `this` instead of `it`: the object becomes the receiver, so its members are in scope without a prefix. Use it when the block touches several members of the same object.

```kotlin
val summary = person.run { "$firstName $lastName, $age" }
```

There is also a receiverless `run { ... }`, which simply runs a block as an expression — handy for a computed `val` that needs a couple of statements.

## with

`with(x) { ... }` is `run` written as a call, and it is the one to reach for when you are not chaining: it reads as a sentence, "with this object, do these things".

```kotlin
val text = with(StringBuilder()) {
    append("Dear ")
    append(name)
    append(",\n")
    toString()
}
```

Prefer `x.run { }` when `x` may be null (`x?.run { }` works, `with(x)` has nowhere to put the `?`).

## apply

`apply` runs the block with the object as `this` and then returns **the object**, which makes it the configuration idiom: build something, set it up, hand it back.

```kotlin
val server = Server().apply {
    host = "localhost"
    port = 8080
    tags.add("local")
}
```

Without `apply` that is four statements and a variable mentioned four times. The rule of thumb: if the block is about *setting properties*, you want `apply`.

## also

`also` passes the object as `it` and returns the object, so it slots into a chain without changing what flows through it. That makes it the place for side effects — logging, validation, registering — that must not disturb the value.

```kotlin
val cleaned = input.trim()
    .also { println("trimmed to '$it'") }
    .lowercase()
```

The deliberate `it` is a feature: it keeps the outer `this` visible and makes the side effect read as being *about* the value rather than *inside* it.

## takeIf and takeUnless

Two smaller relatives that turn a condition into a nullable value:

```kotlin
val even = number.takeIf { it % 2 == 0 }          // the number, or null
val nonBlank = text.takeUnless { it.isBlank() }   // the text, or null
```

`takeIf` returns the receiver when the predicate holds and `null` otherwise; `takeUnless` is its negation. They are made for chains, because a `null` in the middle of a `?.` chain short-circuits the rest:

```kotlin
val port = raw.trim().takeIf { it.isNotEmpty() }?.toIntOrNull()?.takeIf { it in 1..65535 } ?: 8080
```

Each step either narrows the value or gives up, and the `?:` at the end supplies the fallback once.

## Choosing between them

Ask two questions. *Do I want the object back, or the block's result?* — `apply`/`also` for the object, `let`/`run`/`with` for the result. *Does the block mostly use members of the object?* — then `this` (`apply`, `run`, `with`); if it uses the object as a whole or mixes it with outer variables, then `it` (`let`, `also`).

Which leaves four idioms that cover almost every real use:

- `x?.let { }` — do something only when `x` is not null
- `X().apply { }` — create and configure
- `.also { }` — a side effect inside a chain
- `with(x) { }` — several operations on one object

## When not to use them

Scope functions are easy to overuse. A chain of three of them, or one nested in another, produces code where every `it` and `this` means something different and the reader has to hold a stack in their head. When that happens, a plain local variable with a name is better — the goal was never fewer lines, it was fewer things to look up.

```kotlin playground
class Server {
    var host: String = ""
    var port: Int = 0
    val tags: MutableList<String> = mutableListOf()
    override fun toString() = "$host:$port $tags"
}

fun main() {
    // apply: create and configure, get the object back
    val server = Server().apply {
        host = "localhost"
        port = 8080
        tags.add("local")
    }
    println(server)

    // also: a side effect that leaves the value alone
    val ports = listOf(80, 8080, 443)
        .also { println("checking ${it.size} ports") }
        .filter { it > 100 }
    println(ports)

    // let on a nullable, with a fallback
    val configured: String? = null
    println(configured?.let { "using $it" } ?: "using the default")

    // run: several members of one object, as an expression
    println(server.run { "$host is ${if (port == 8080) "dev" else "prod"}" })

    // with: a sentence about one object
    val banner = with(StringBuilder()) {
        append("== ")
        append(server.host.uppercase())
        append(" ==")
        toString()
    }
    println(banner)

    // takeIf / takeUnless in a chain
    for (raw in listOf(" 443 ", "", "99999", "x")) {
        val port = raw.trim().takeIf { it.isNotEmpty() }?.toIntOrNull()?.takeIf { it in 1..65535 } ?: 8080
        println("'$raw' -> $port")
    }
}
```

## Exercises

### 1. Configure with apply

`defaultServer()` returns a `Server` with `host` set to `"localhost"`, `port` to `8080`, `secure` left `false`, and the tags `"local"` and `"http"` added in that order. `tagged(server, tag)` adds a tag and returns **the same object**, not a copy. Write both with `apply`.

```kotlin starter
class Server {
    var host: String = ""
    var port: Int = 0
    var secure: Boolean = false
    val tags: MutableList<String> = mutableListOf()
}

fun defaultServer(): Server {
    return Server()
}

fun tagged(server: Server, tag: String): Server {
    return server
}
```

```kotlin test
class ServerTest {
    // the defaults are filled in
    @Test
    fun defaults() {
        val s = defaultServer()
        assertEquals("localhost", s.host)
        assertEquals(8080, s.port)
        assertEquals(false, s.secure)
        assertEquals(listOf("local", "http"), s.tags)
    }

    // every call builds a fresh server
    @Test
    fun fresh() {
        val a = defaultServer()
        val b = defaultServer()
        assertTrue("each call should return a new Server", a !== b)
        a.tags.add("extra")
        a.port = 1
        assertEquals(listOf("local", "http"), b.tags)
        assertEquals(8080, b.port)
    }

    // tagged adds to the server it was given
    @Test
    fun tags() {
        val s = defaultServer()
        val same = tagged(s, "eu")
        assertTrue("tagged should return the same object", same === s)
        assertEquals(listOf("local", "http", "eu"), s.tags)
        tagged(s, "beta")
        assertEquals(listOf("local", "http", "eu", "beta"), s.tags)
    }

    // tagging does not disturb anything else
    @Test
    fun onlyTags() {
        val s = tagged(tagged(defaultServer(), "a"), "b")
        assertEquals(listOf("local", "http", "a", "b"), s.tags)
        assertEquals("localhost", s.host)
        assertEquals(8080, s.port)
    }
}
```

#### Uses
- [Scope functions › apply](#/scope-functions/apply)
- [Scope functions › The five scope functions](#/scope-functions/the-five-scope-functions)

#### Hints
- `Server().apply { ... }` runs the block with the new server as `this`, so you can write `host = "localhost"` with no prefix, and the call evaluates to the server.
- `tags` is a `MutableList`, so `tags.add("local")` inside the same block adds to it.
- `tagged` is `server.apply { tags.add(tag) }` — `apply` returns the receiver, which is exactly the "same object" the test asks for.

#### Tips
- `apply` is why Kotlin rarely needs builder classes: any object with settable properties already has a builder syntax.
- `apply` returns the receiver, so `server.apply { ... }` is the *same object*, not a copy. That is exactly what the identity test checks.
- Inside `apply` the object is `this`, so its properties are in scope with no prefix — and a parameter with the same name will shadow one. Use `this.items` when they collide.

#### Docs
- [apply](https://kotlinlang.org/docs/scope-functions.html#apply)

### 2. Describe a nullable string

`describe(text)` returns `"no text"` when `text` is `null`, and otherwise `"'<text>' has N characters"` — the text in single quotes, then its length. Do the non-null half with `?.let` and supply the fallback with `?:`.

```kotlin starter
fun describe(text: String?): String {
    return "no text"
}
```

```kotlin test
class DescribeTest {
    // a missing value
    @Test
    fun missing() {
        assertEquals("no text", describe(null))
    }

    // a value, with its length
    @Test
    fun present() {
        assertEquals("'hi' has 2 characters", describe("hi"))
        assertEquals("'kotlin' has 6 characters", describe("kotlin"))
        assertEquals("'a b' has 3 characters", describe("a b"))
    }

    // the empty string is a value, not a missing one
    @Test
    fun empty() {
        assertEquals("'' has 0 characters", describe(""))
        assertEquals("' ' has 1 characters", describe(" "))
    }
}
```

#### Uses
- [Scope functions › let](#/scope-functions/let)
- [Scope functions › Choosing between them](#/scope-functions/choosing-between-them)

#### Hints
- `text?.let { ... }` runs the block only when `text` is not null; inside it, `it` is a plain `String`.
- The block's result is the `let` call's result, so the whole function is one expression: `text?.let { ... } ?: "no text"`.
- Watch the quotes in the template: `"'$it' has ${it.length} characters"`.

#### Tips
- `""` is not `null`. Treating the empty string as missing is a decision you make with `takeIf { it.isNotEmpty() }`, never something `?.` does for you.
- `?.let { }` gives you a non-null `it` inside the block, so no further `?.` is needed in there.
- The block's result is the whole call's result, which is what lets `text?.let { ... } ?: "no text"` be the entire function body.

#### Docs
- [let](https://kotlinlang.org/docs/scope-functions.html#let)

### 3. Normalize input

`normalize(input)` cleans up a piece of user input: trim the whitespace, and if anything is left, lowercase it and return it. If the input is `null`, or is empty or only whitespace, return `null`. Build it as a single `?.` chain using `takeIf`.

```kotlin starter
fun normalize(input: String?): String? {
    return input
}
```

```kotlin test
class NormalizeTest {
    // trims and lowercases
    @Test
    fun cleans() {
        assertEquals("ada", normalize("  Ada  "))
        assertEquals("ok", normalize("OK"))
        assertEquals("hello world", normalize("\tHello World\n"))
    }

    // nothing to keep gives null
    @Test
    fun nothing() {
        assertNull(normalize(null))
        assertNull(normalize(""))
        assertNull(normalize("   "))
        assertNull(normalize("\t\n"))
    }

    // inner whitespace and case are otherwise left alone
    @Test
    fun inner() {
        assertEquals("a  b", normalize("  a  b  "))
        assertEquals("x", normalize("x"))
        assertEquals("123", normalize(" 123 "))
    }
}
```

#### Uses
- [Scope functions › takeIf and takeUnless](#/scope-functions/takeif-and-takeunless)
- [Scope functions › let](#/scope-functions/let)

#### Hints
- Start with `input?.trim()`; the `?.` already handles the `null` case for the whole chain.
- `takeIf { it.isNotEmpty() }` turns a value you do not want into `null`, which stops the rest of the chain.
- Finish with `?.lowercase()`. The three steps are one expression, and no `if` appears anywhere.

#### Tips
- `isBlank()` is "empty or only whitespace". After a `trim()` the two questions are the same, so either predicate works here.
- `takeIf` returns `null` when the predicate fails, and a `null` in the middle of a `?.` chain short-circuits everything after it. That is the whole trick.
- Order matters: trim first, then test. Testing before trimming lets `"   "` through as a three-space name.

#### Docs
- [takeIf and takeUnless](https://kotlinlang.org/docs/scope-functions.html#takeif-and-takeunless)

### 4. Build an order

`newOrder(customer, items, coupon)` builds an `Order`:

- `customer` and the items are copied in, in order.
- `discount` comes from the coupon: a coupon counts only if it starts with exactly `"SAVE"` followed by a whole number, and the discount is that number, capped at `50`. Anything else — `null`, `"save10"`, `"SAVE"`, `"SAVEX"`, a negative number — means no discount at all, `0`.

Use `apply` for the object and a `?.` chain with `takeIf` and `let` for the coupon.

```kotlin starter
class Order {
    var customer: String = ""
    var discount: Int = 0
    val items: MutableList<String> = mutableListOf()
}

fun newOrder(customer: String, items: List<String>, coupon: String?): Order {
    return Order()
}
```

```kotlin test
class NewOrderTest {
    // the customer and items are copied in
    @Test
    fun fields() {
        val order = newOrder("Ada", listOf("pen", "ink"), null)
        assertEquals("Ada", order.customer)
        assertEquals(listOf("pen", "ink"), order.items)
        assertEquals(0, order.discount)
        assertEquals(emptyList<String>(), newOrder("Bob", emptyList(), null).items)
    }

    // a good coupon sets the discount
    @Test
    fun coupons() {
        assertEquals(10, newOrder("Ada", emptyList(), "SAVE10").discount)
        assertEquals(5, newOrder("Ada", emptyList(), "SAVE5").discount)
        assertEquals(50, newOrder("Ada", emptyList(), "SAVE50").discount)
        assertEquals(0, newOrder("Ada", emptyList(), "SAVE0").discount)
    }

    // the discount is capped at 50
    @Test
    fun capped() {
        assertEquals(50, newOrder("Ada", emptyList(), "SAVE99").discount)
        assertEquals(50, newOrder("Ada", emptyList(), "SAVE1000").discount)
        assertEquals(50, newOrder("Ada", emptyList(), "SAVE51").discount)
    }

    // anything that is not a SAVE coupon is ignored
    @Test
    fun badCoupons() {
        assertEquals(0, newOrder("Ada", emptyList(), null).discount)
        assertEquals(0, newOrder("Ada", emptyList(), "").discount)
        assertEquals(0, newOrder("Ada", emptyList(), "SAVE").discount)
        assertEquals(0, newOrder("Ada", emptyList(), "SAVEX").discount)
        assertEquals(0, newOrder("Ada", emptyList(), "save10").discount)
        assertEquals(0, newOrder("Ada", emptyList(), "10").discount)
        assertEquals(0, newOrder("Ada", emptyList(), "SAVE-10").discount)
    }

    // the list that was passed in is not kept or modified
    @Test
    fun copiesItems() {
        val source = mutableListOf("pen")
        val order = newOrder("Ada", source, "SAVE10")
        source.add("ink")
        assertEquals(listOf("pen"), order.items)
        order.items.add("paper")
        assertEquals(listOf("pen", "ink"), source)
    }
}
```

#### Uses
- [Scope functions › apply](#/scope-functions/apply)
- [Scope functions › takeIf and takeUnless](#/scope-functions/takeif-and-takeunless)
- [Scope functions › let](#/scope-functions/let)
- [Collection operations › Read-only, not immutable](#/collection-ops/read-only-not-immutable)
- [Collections › Read-only and mutable](#/collections/read-only-and-mutable)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)
- [Variables & types › Clamping and kotlin.math](#/basics/clamping-and-kotlin-math)

#### Hints
- The shell is `Order().apply { ... }`: set `customer`, then `items.addAll(items)` — name the parameter something else, or use `this.items`, so the two do not collide.
- The coupon chain reads `coupon?.takeIf { it.startsWith("SAVE") }?.removePrefix("SAVE")?.toIntOrNull()`, and `?: 0` at the end covers every way that can fail.
- `toIntOrNull()` returns `null` for `""`, for `"X"` and for anything that is not a number, which is most of the bad-coupon list. `"SAVE-10"` does parse, to `-10`, so cap from both ends: `coerceIn(0, 50)`, or `?.let { minOf(it, 50) }` plus a `takeIf { it >= 0 }`.

#### Tips
- `items.addAll(other)` copies the elements, so the caller's list and the order's list are two different lists from then on. That is what the last test checks.
- `removePrefix` returns the string unchanged when the prefix is absent, so it cannot stand in for the `startsWith` check — `"save10"` would survive it.
- `"SAVE-10"` parses to `-10`, which is why the cap has to work from both ends. `coerceIn(0, 50)` does both in one call.

#### Docs
- [Scope functions](https://kotlinlang.org/docs/scope-functions.html)
- [toIntOrNull](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-int-or-null.html)
