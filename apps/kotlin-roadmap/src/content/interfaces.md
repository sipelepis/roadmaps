# Interfaces & delegation

An interface says what a type can do without saying how. Kotlin interfaces go further than Java's original ones: they can carry default implementations, declare properties, and be handed to a class as a ready-made delegate with a single `by`. That last feature is the one that removes the most code, because "wrap this thing and change one method" stops being fifty lines of forwarding.

A class can implement any number of interfaces but extend only one class, so interfaces are where most of Kotlin's polymorphism lives.

## Declaring an interface

An interface declares members with no body. A class implements it with `:` and marks each member `override`.

```kotlin
interface Shape {
    fun area(): Double
}

class Square(val side: Double) : Shape {
    override fun area() = side * side
}
```

There is no `implements` keyword and no `@Override` annotation. `override` is a modifier on the member, and it is mandatory: if you misspell the name, the compiler tells you there is nothing to override instead of quietly adding a new method.

## Default implementations

A member with a body becomes a default. Implementers get it for free and may replace it.

```kotlin
interface Shape {
    val name: String
    fun area(): Double
    fun describe(): String = "$name of area ${area()}"
}
```

The default can call abstract members, which is how a small interface grows a useful API: implementers supply `name` and `area()`, and everyone gets `describe()`.

## Properties in interfaces

An interface can declare a property. It has no backing field, so it is either abstract — the implementer provides storage — or it has a custom getter computed from other members.

```kotlin
interface Shape {
    val name: String                    // implementer stores it
    val isTiny: Boolean get() = area() < 1.0   // computed, inherited as-is
}
```

An implementer can satisfy `val name: String` with a constructor parameter: `class Circle(override val name: String) : Shape`.

## Implementing more than one

A class lists every interface it implements. When two of them supply a default with the same signature, the compiler refuses to guess, and you must override the member and pick. `super<Interface>.member()` calls a specific one.

```kotlin
class Both : A, B {
    override fun hello() = super<A>.hello() + super<B>.hello()
}
```

## Delegation with `by`

`class C(x: I) : I by x` makes `C` implement `I` by forwarding every member to `x`. The compiler writes the forwarding methods. You then override only the members you actually want to change.

```kotlin
class LoggingList(private val inner: MutableList<String>) : MutableList<String> by inner {
    override fun add(element: String): Boolean {
        println("adding $element")
        return inner.add(element)
    }
}
```

One catch worth knowing: the generated forwarders call the delegate directly, so a member you did not override never routes through one you did. If `addAll` matters, override `addAll` too.

## Functional interfaces

An interface with exactly one abstract method can be marked `fun interface`. A lambda is then converted to it automatically, which is how you get a named, self-documenting type without the ceremony of an object expression.

```kotlin
fun interface Rule {
    fun check(value: String): Boolean
}

val notEmpty = Rule { it.isNotEmpty() }
```

```kotlin playground
interface Shape {
    val name: String
    fun area(): Double
    fun describe(): String = "$name of area ${area()}"
}

class Rectangle(val width: Double, val height: Double) : Shape {
    override val name = "rectangle"
    override fun area() = width * height
}

class Square(val side: Double) : Shape {
    override val name = "square"
    override fun area() = side * side
    override fun describe() = "square with side $side"
}

fun interface Rule {
    fun check(shape: Shape): Boolean
}

// A set that counts how many shapes were actually added, delegating everything else.
class CountingSet(private val inner: MutableSet<String> = mutableSetOf()) : MutableSet<String> by inner {
    var additions = 0
        private set

    override fun add(element: String): Boolean =
        inner.add(element).also { if (it) additions++ }
}

fun main() {
    val shapes: List<Shape> = listOf(Rectangle(2.0, 3.0), Square(4.0), Rectangle(1.0, 0.5))
    shapes.forEach { println(it.describe()) }

    val big = Rule { it.area() >= 4.0 }
    println("big ones: " + shapes.filter(big::check).map { it.name })

    val names = CountingSet()
    names.add("square")
    names.add("square")
    names.addAll(listOf("rectangle", "circle"))
    println("set = ${names.sorted()}, size = ${names.size}, additions = ${names.additions}")
}
```

Notice the last line: `addAll` went straight to the delegate, so `additions` is 1 and not 3. The forwarders do not know about your override.

## Exercises

### 1. A shape hierarchy

Give `Shape` a default `describe()` that returns `"<name> of area <area>"` — for a 2.0 by 3.0 rectangle, `"rectangle of area 6.0"`. Then fill in the three areas: rectangle is width times height, circle is `PI * radius * radius`, square is side squared. `Square` overrides `describe()` to return `"square with side <side>"` instead. A shape with a zero dimension has area 0.0.

```kotlin starter
import kotlin.math.PI

interface Shape {
    val name: String
    fun area(): Double
    fun describe(): String = ""
}

class Rectangle(val width: Double, val height: Double) : Shape {
    override val name = "rectangle"
    override fun area(): Double = 0.0
}

class Circle(val radius: Double) : Shape {
    override val name = "circle"
    override fun area(): Double = 0.0
}

class Square(val side: Double) : Shape {
    override val name = "square"
    override fun area(): Double = 0.0
}
```

```kotlin test
class ShapeTest {
    // areas of rectangles and squares
    @Test
    fun straightEdges() {
        assertEquals(6.0, Rectangle(2.0, 3.0).area(), 1e-9)
        assertEquals(0.5, Rectangle(1.0, 0.5).area(), 1e-9)
        assertEquals(16.0, Square(4.0).area(), 1e-9)
        assertEquals(0.0, Square(0.0).area(), 1e-9)
        assertEquals(0.0, Rectangle(5.0, 0.0).area(), 1e-9)
    }

    // circle area uses PI
    @Test
    fun circles() {
        assertEquals(Math.PI, Circle(1.0).area(), 1e-9)
        assertEquals(Math.PI * 4.0, Circle(2.0).area(), 1e-9)
        assertEquals(0.0, Circle(0.0).area(), 1e-9)
    }

    // the default describe uses name and area
    @Test
    fun defaultDescribe() {
        assertEquals("rectangle of area 6.0", Rectangle(2.0, 3.0).describe())
        assertEquals("rectangle of area 0.5", Rectangle(1.0, 0.5).describe())
        assertTrue("circle should use its own name", Circle(1.0).describe().startsWith("circle of area "))
    }

    // square replaces the default
    @Test
    fun squareOverrides() {
        assertEquals("square with side 4.0", Square(4.0).describe())
        assertEquals("square with side 1.5", Square(1.5).describe())
    }

    // every shape is usable through the interface
    @Test
    fun polymorphic() {
        val shapes: List<Shape> = listOf(Square(2.0), Rectangle(2.0, 3.0), Circle(0.0))
        assertEquals(10.0, shapes.sumOf { it.area() }, 1e-9)
        assertEquals(listOf("circle", "square", "rectangle"), shapes.sortedBy { it.area() }.map { it.name })
    }
}
```

#### Uses
- [Interfaces & delegation › Declaring an interface](#/interfaces/declaring-an-interface)
- [Interfaces & delegation › Default implementations](#/interfaces/default-implementations)
- [Interfaces & delegation › Properties in interfaces](#/interfaces/properties-in-interfaces)

#### Hints
- `describe()` already has everything it needs: `"$name of area ${area()}"` works because the interface can call its own abstract members.
- Doubles print with a decimal point, so `2.0 * 3.0` renders as `6.0`. You do not need to format anything.
- `Square` overrides `describe()` the same way it overrides `area()` — `override fun describe() = ...` in the class body.

#### Tips
- `import kotlin.math.PI` gives you `PI` as a plain `Double`; it is the same value as `Math.PI`.
- A default implementation may call the interface's own abstract members, which is how a two-member interface grows a useful API.
- An implementer can satisfy `val name: String` with a constructor parameter: `class Circle(override val name: String) : Shape`.

#### Docs
- [Interfaces](https://kotlinlang.org/docs/interfaces.html)

### 2. A counting set

`CountingSet` wraps a `MutableSet<String>` and keeps `additions`: how many elements were *actually* added, so re-adding an element already present does not count. Everything else — `size`, `contains`, `remove`, iteration — must keep behaving like the wrapped set, without your writing those methods.

Note that `addAll` is part of the job: the delegate's own `addAll` bypasses your `add`, so elements added that way must still be counted.

```kotlin starter
class CountingSet(private val inner: MutableSet<String> = mutableSetOf()) : MutableSet<String> by inner {
    var additions = 0
        private set
}
```

```kotlin test
class CountingSetTest {
    // counts only elements that were new
    @Test
    fun countsNew() {
        val s = CountingSet()
        assertTrue("first add is new", s.add("a"))
        assertTrue("second add is new", s.add("b"))
        assertTrue("duplicate should report false", !s.add("a"))
        assertEquals(2, s.additions)

        val t = CountingSet()
        repeat(5) { t.add("x") }
        assertEquals(1, t.additions)
    }

    // addAll counts every new element too
    @Test
    fun countsAddAll() {
        val s = CountingSet()
        s.addAll(listOf("a", "b", "c"))
        assertEquals(3, s.additions)
        s.addAll(listOf("c", "d"))
        assertEquals(4, s.additions)
        assertEquals(0, CountingSet().also { it.addAll(emptyList()) }.additions)
    }

    // the set still behaves like a set
    @Test
    fun stillASet() {
        val s = CountingSet()
        s.addAll(listOf("b", "a", "b"))
        assertEquals(2, s.size)
        assertTrue("contains a", s.contains("a"))
        assertEquals(listOf("a", "b"), s.sorted())
        assertTrue("remove reports true", s.remove("a"))
        assertEquals(1, s.size)
        assertTrue("empty after removing both", s.also { it.remove("b") }.isEmpty())
    }

    // removing does not undo the count
    @Test
    fun removalsDoNotCount() {
        val s = CountingSet()
        s.add("a")
        s.remove("a")
        s.add("a")
        assertEquals(2, s.additions)
        assertEquals(1, s.size)
    }
}
```

#### Uses
- [Interfaces & delegation › Delegation with `by`](#/interfaces/delegation-with-by)

#### Hints
- The class already implements `MutableSet<String>` through `by inner`, so you only add the two members you want to change.
- `override fun add(element: String): Boolean` should call `inner.add(element)` and count when the result is `true`.
- `override fun addAll(elements: Collection<String>): Boolean` can loop over `elements` calling your own `add`, and return `true` if any of them was new.

#### Tips
- `x.also { ... }` returns `x` after running the block, which makes `inner.add(e).also { if (it) additions++ }` a one-liner.
- The generated forwarders call the delegate directly, so `addAll` never routes through your `add`. If `addAll` has to count, override `addAll` too — that is the whole lesson of this exercise.
- `inner.add(e)` returns `false` when the element was already present, which is exactly the "was this new?" answer the counter needs.

#### Docs
- [Delegation](https://kotlinlang.org/docs/delegation.html)

### 3. Composable rules

A `Rule` decides whether a string is acceptable. Build a small set of them and two combinators.

`notBlank` rejects a string that is empty or only whitespace. `minLength(n)` accepts a string of at least `n` characters. `a and b` is a rule that passes only when both pass. `allOf(rules)` passes when every rule in the list passes, so `allOf(emptyList())` accepts everything.

```kotlin starter
fun interface Rule {
    fun check(value: String): Boolean
}

val notBlank = Rule { true }

fun minLength(n: Int): Rule = Rule { true }

infix fun Rule.and(other: Rule): Rule = this

fun allOf(rules: List<Rule>): Rule = Rule { true }
```

```kotlin test
class RuleTest {
    // notBlank rejects empty and whitespace
    @Test
    fun blanks() {
        assertTrue("plain text passes", notBlank.check("a"))
        assertTrue("padded text passes", notBlank.check(" x "))
        assertTrue("empty fails", !notBlank.check(""))
        assertTrue("spaces fail", !notBlank.check("   "))
        assertTrue("tab fails", !notBlank.check("\t"))
    }

    // minLength counts characters
    @Test
    fun lengths() {
        val three = minLength(3)
        assertTrue("abc passes", three.check("abc"))
        assertTrue("abcd passes", three.check("abcd"))
        assertTrue("ab fails", !three.check("ab"))
        assertTrue("empty fails", !three.check(""))
        assertTrue("minLength(0) accepts everything", minLength(0).check(""))
    }

    // and needs both
    @Test
    fun combined() {
        val rule = notBlank and minLength(3)
        assertTrue("long enough and not blank", rule.check("abc"))
        assertTrue("blank but long enough fails", !rule.check("   "))
        assertTrue("short fails", !rule.check("ab"))
        assertTrue("both fail", !rule.check(""))
    }

    // allOf over a list
    @Test
    fun all() {
        val rule = allOf(listOf(notBlank, minLength(2), Rule { it.first().isLetter() }))
        assertTrue("letter start, long enough", rule.check("ab"))
        assertTrue("digit start fails", !rule.check("1b"))
        assertTrue("too short fails", !rule.check("a"))
        assertTrue("empty list accepts anything", allOf(emptyList()).check(""))
        assertTrue("single rule list behaves like the rule", !allOf(listOf(minLength(9))).check("short"))
    }
}
```

#### Uses
- [Interfaces & delegation › Functional interfaces](#/interfaces/functional-interfaces)
- [Interfaces & delegation › Declaring an interface](#/interfaces/declaring-an-interface)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)
- [Variables & types › Character tests](#/basics/character-tests)

#### Hints
- Because `Rule` is a `fun interface`, `Rule { value -> ... }` builds one from a lambda, and the single parameter is `it`.
- `and` returns a new rule that closes over both: `Rule { this.check(it) && other.check(it) }`.
- `allOf` is `Rule { value -> rules.all { it.check(value) } }`. `all` on an empty list is `true`, which is exactly the required behaviour.

#### Tips
- `String.isBlank()` is true for `""` and for a string of only whitespace, which is precisely what `notBlank` has to reject.
- A `fun interface` needs exactly one abstract method. Add a second and the lambda conversion stops compiling.
- `all` on an empty list is `true`, so `allOf(emptyList())` accepts everything without a special case.

#### Docs
- [Functional (SAM) interfaces](https://kotlinlang.org/docs/fun-interfaces.html)

### 4. Two interfaces, one class

`Greeter` has a `greeting` property defaulting to `"Hello"` and a `greet(name)` that returns `"<greeting>, <name>!"`. `Shouter` has its own `greet(name)` returning `"HEY <name>"`.

`Polite` implements `Greeter` only, and must greet with `"Good day"` instead of `"Hello"` — change the property, not the method. `Loud` implements both, so it is forced to override `greet`: it returns the `Greeter` version uppercased, then a space, then the `Shouter` version. `Loud().greet("Ada")` is `"HELLO, ADA! HEY Ada"`.

```kotlin starter
interface Greeter {
    val greeting: String get() = "Hello"
    fun greet(name: String): String = "$greeting, $name!"
}

interface Shouter {
    fun greet(name: String): String = "HEY $name"
}

class Polite : Greeter

class Loud : Greeter, Shouter {
    override fun greet(name: String): String = ""
}
```

```kotlin test
class GreetTest {
    // Polite changes only the greeting word
    @Test
    fun polite() {
        assertEquals("Good day, Ada!", Polite().greet("Ada"))
        assertEquals("Good day, Bob!", Polite().greet("Bob"))
        assertEquals("Good day", Polite().greeting)
    }

    // Loud joins both inherited versions
    @Test
    fun loud() {
        assertEquals("HELLO, ADA! HEY Ada", Loud().greet("Ada"))
        assertEquals("HELLO, BOB! HEY Bob", Loud().greet("Bob"))
    }

    // Loud keeps the default Hello greeting
    @Test
    fun loudGreeting() {
        assertEquals("Hello", Loud().greeting)
        assertEquals("HELLO, X! HEY X", Loud().greet("X"))
    }

    // both are usable as a Greeter
    @Test
    fun throughTheInterface() {
        val all: List<Greeter> = listOf(Polite(), Loud())
        assertEquals(listOf("Good day, Sam!", "HELLO, SAM! HEY Sam"), all.map { it.greet("Sam") })
    }
}
```

#### Uses
- [Interfaces & delegation › Implementing more than one](#/interfaces/implementing-more-than-one)
- [Interfaces & delegation › Properties in interfaces](#/interfaces/properties-in-interfaces)

#### Hints
- `Polite` needs one line: `override val greeting = "Good day"`. The inherited `greet` picks it up.
- In `Loud`, name the interface you mean: `super<Greeter>.greet(name)` and `super<Shouter>.greet(name)`.
- `String.uppercase()` does the shouting.

#### Tips
- Remove the `override fun greet` from `Loud` and the compiler reports that it inherits two conflicting implementations. That error is the whole point of the rule.
- `super<Greeter>.greet(name)` names which inherited implementation you mean; plain `super.` is ambiguous when two interfaces supply the same member.
- A class implements any number of interfaces but extends only one class, which is why most Kotlin polymorphism lives here.

#### Docs
- [Resolving overriding conflicts](https://kotlinlang.org/docs/interfaces.html#resolving-overriding-conflicts)
