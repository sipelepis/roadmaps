# Classes & properties

A Kotlin class declares its constructor and its properties in its header, so the one-line class is genuinely one line. There are no fields to declare, no `this.x = x` assignments to write, and no getters and setters to generate — a property *is* a getter, a setter and backing storage, and you only write the parts you want to change.

## Declaring a class

```kotlin
class Empty

class Point(val x: Int, val y: Int)

val p = Point(1, 2)
println(p.x)
```

No `new` keyword: you call the class like a function. Classes are `public` and `final` by default — public because that is what most classes are, final because a class that was not designed to be inherited from usually should not be.

## Primary constructors

The parameter list after the class name is the primary constructor. Marking a parameter `val` or `var` also makes it a property; without the keyword it is just a constructor parameter, visible to the header and to `init` but not stored.

```kotlin
class User(val name: String, var age: Int, greeting: String) {
    val greetingLength = greeting.length   // greeting is usable here...
    // ...but `greeting` is not a property, so user.greeting does not exist
}
```

Constructor parameters take defaults like any other function parameters, and callers can name them:

```kotlin
class Server(val host: String = "localhost", val port: Int = 8080)

Server()
Server(port = 9000)
```

## Properties

`val` gives a read-only property, `var` a read-write one. Properties can be declared in the body as well as the header:

```kotlin
class Session(val user: String) {
    var lastSeen: Long = 0
    private var attempts = 0        // visible only inside the class
    val id: String = user.lowercase()
}
```

A property declared in the body needs an initialiser or a custom getter — the compiler will not let you leave it undefined. Access is always `session.lastSeen`, never `getLastSeen()`; when Kotlin code calls a Java getter, it presents it as a property too.

Visibility modifiers are `public` (the default), `private` (this class), `protected` (this class and subclasses) and `internal` (this module).

`lateinit var` is the escape hatch for a non-null property that genuinely cannot be set in the constructor — one a framework injects, or a test sets up in a `@Before`. It buys you a non-null type at the cost of the compiler's guarantee:

```kotlin
class Service {
    lateinit var name: String
    fun ready() = ::name.isInitialized
}
```

Reading `name` before anything assigns it throws `UninitializedPropertyAccessException`, not a `NullPointerException`, and the compiler cannot warn you. `::name.isInitialized` asks first. `lateinit` only works on a `var`, only on a non-null reference type — not on `Int`, `Double` or `Boolean` — and a nullable property with a real `null` check is usually the more honest design.

## `init` blocks and secondary constructors

Code that has to run at construction goes in an `init` block. Several are allowed, and they run in declaration order, interleaved with property initialisers:

```kotlin
class Rectangle(val width: Int, val height: Int) {
    init {
        require(width > 0 && height > 0) { "sides must be positive" }
    }
}
```

`require` throws `IllegalArgumentException` when its condition is false — it is the standard way to reject bad arguments. `check` is the same for `IllegalStateException`.

A secondary constructor delegates to the primary one with `this(...)`:

```kotlin
class Rectangle(val width: Int, val height: Int) {
    constructor(side: Int) : this(side, side)
}
```

Default arguments usually make secondary constructors unnecessary. Reach for one when the alternative form genuinely computes different values, as above.

## Custom getters and setters

A property can compute its value instead of storing one. Give it a getter and it has no backing field at all:

```kotlin
class Rectangle(val width: Int, val height: Int) {
    val area: Int get() = width * height
    val isSquare get() = width == height
}
```

`area` is recomputed on every read, which is what you want for something this cheap. A custom setter uses `field` to reach the backing storage — writing `volume = value` inside the setter would call the setter again, forever:

```kotlin
class Speaker {
    var volume: Int = 0
        set(value) {
            field = value.coerceIn(0, 10)
        }
}
```

You can also keep the generated setter but narrow its visibility, which gives a property the outside world can read and only the class can write:

```kotlin
class Counter {
    var count: Int = 0
        private set
    fun increment() { count++ }
}
```

## Member functions and `this`

Functions inside a class see its properties directly. `this` refers to the instance and is only needed to disambiguate:

```kotlin
class Account(var balance: Int) {
    fun deposit(amount: Int) {
        balance += amount
    }

    fun withdraw(amount: Int): Boolean {
        if (amount > balance) return false
        balance -= amount
        return true
    }

    override fun toString() = "Account($balance)"
}
```

`toString()` comes from `Any`, the root of every class, along with `equals()` and `hashCode()`. Overriding it is worth the one line — it is what `println(account)` and string templates use. Note that `==` on an ordinary class compares identity until you override `equals`; the data classes module has the one-word way to get all three.

## Companion objects

Kotlin has no `static`. Things that belong to the class rather than to an instance go in a `companion object`:

```kotlin
class Temperature(val celsius: Double) {
    companion object {
        const val ABSOLUTE_ZERO = -273.15
        fun fromFahrenheit(f: Double) = Temperature((f - 32) / 1.8)
    }
}

Temperature.fromFahrenheit(212.0)
Temperature.ABSOLUTE_ZERO
```

Callers write `Temperature.fromFahrenheit(...)`, exactly as they would a static method. A factory function in a companion pairs well with a `private constructor`, when every instance has to go through validation.

## Inheritance

Classes and members are final unless marked `open`. A subclass names its parent after a `:`, calling its constructor there:

```kotlin
open class Shape(val name: String) {
    open fun area(): Double = 0.0
    fun describe() = "$name has area ${area()}"
}

class Circle(val radius: Double) : Shape("circle") {
    override fun area() = Math.PI * radius * radius
}
```

`override` is required, not optional — the compiler refuses a member that accidentally shadows another. An `override` is itself `open` for further subclasses; `final override` stops the chain. `super.area()` calls the parent's version.

Notice that `describe()` is not open, yet it picks up the subclass's `area()`: that is ordinary dynamic dispatch, and it is how a base class defines a workflow whose steps subclasses fill in.

```kotlin playground
open class Shape(val name: String) {
    open val area: Double get() = 0.0
    fun describe() = "$name: area ${Math.round(area * 100) / 100.0}"
}

class Circle(val radius: Double) : Shape("circle") {
    override val area get() = Math.PI * radius * radius
}

class Rect(val width: Double, val height: Double) : Shape(if (width == height) "square" else "rectangle") {
    init { require(width > 0 && height > 0) { "sides must be positive" } }
    override val area get() = width * height

    companion object {
        fun square(side: Double) = Rect(side, side)
    }
}

class Counter(val label: String) {
    var count: Int = 0
        private set
    val isEmpty get() = count == 0
    fun add() { count++ }
    override fun toString() = "$label=$count"
}

fun main() {
    println(Circle(1.0).describe())
    println(Rect(3.0, 4.0).describe())
    println(Rect.square(2.5).describe())

    val tally = Counter("shapes")
    println("before: $tally (empty: ${tally.isEmpty})")
    tally.add(); tally.add(); tally.add()
    println("after:  $tally (empty: ${tally.isEmpty})")

    try {
        Rect(0.0, 4.0)
    } catch (e: IllegalArgumentException) {
        println("require() rejected it: ${e.message}")
    }

    // Try: add `tally.count = 9` and watch `private set` refuse it.
}
```

## Exercises

### 1. Counter

Write a `Counter` class. `Counter(start)` keeps the value it started from in a readable `start` property — it defaults to 0 — and exposes a `value` that begins there. `increment(by)` adds to it, with `by` defaulting to 1; `reset()` puts `value` back to `start`; and `isAtStart` reports whether it is there now. Callers must be able to read `value` but not assign to it.

```kotlin starter
class Counter(val start: Int = 0) {
    var value: Int = 0
    val isAtStart: Boolean = true

    fun increment(by: Int = 1) {
    }

    fun reset() {
    }
}
```

```kotlin test
class CounterTest {
    // starts where it was told to
    @Test
    fun starts() {
        assertEquals(0, Counter().value)
        assertEquals(5, Counter(5).value)
        assertEquals(-3, Counter(-3).value)
        assertTrue("a fresh counter is at its start", Counter(5).isAtStart)
    }

    // increments by one, or by a given step
    @Test
    fun increments() {
        val c = Counter()
        c.increment()
        assertEquals(1, c.value)
        c.increment(4)
        assertEquals(5, c.value)
        c.increment(-5)
        assertEquals(0, c.value)

        val d = Counter(10)
        d.increment(2)
        d.increment(3)
        assertEquals(15, d.value)
    }

    // isAtStart follows the value, and reset goes back
    @Test
    fun resets() {
        val c = Counter(7)
        c.increment()
        assertFalse("moved away from the start", c.isAtStart)
        assertEquals(8, c.value)
        c.reset()
        assertEquals(7, c.value)
        assertTrue("back at the start", c.isAtStart)
        assertEquals(7, c.start)
    }
}
```

#### Uses
- [Classes & properties › Primary constructors](#/classes/primary-constructors)
- [Classes & properties › Custom getters and setters](#/classes/custom-getters-and-setters)
- [Classes & properties › Member functions and `this`](#/classes/member-functions-and-this)
- [Functions › Default arguments](#/functions/default-arguments)

#### Hints
- `value` must start at `start`, not at 0: initialise it with `var value: Int = start`.
- The starter's `isAtStart` is computed once at construction and then never changes. Give it a getter instead: `val isAtStart get() = value == start`.
- Read-only from outside, writable inside, is exactly what `private set` is for. Put it on the line below `var value: Int = start`.

#### Tips
- `increment(-5)` has to work, so do not guard against negative steps.
- `private set` gives a property the outside can read and only the class can write. It goes on its own indented line under the declaration.
- A `val` with a getter is recomputed on every read, so `isAtStart` can never drift out of step with `value`.

#### Docs
- [Classes](https://kotlinlang.org/docs/classes.html)
- [Getters and setters](https://kotlinlang.org/docs/properties.html#getters-and-setters)

### 2. Rectangle

Write a `Rectangle(width, height)` whose `area`, `perimeter` and `isSquare` are computed from the sides, with a `scaled(factor)` that returns a *new* rectangle with both sides multiplied, and a companion `Rectangle.square(side)` that builds a square. Sides must be positive: a zero or negative side throws `IllegalArgumentException`.

```kotlin starter
class Rectangle(val width: Int, val height: Int) {
    val area: Int = 0
    val perimeter: Int = 0
    val isSquare: Boolean = false

    fun scaled(factor: Int): Rectangle = this

    companion object {
        fun square(side: Int): Rectangle = Rectangle(side, 1)
    }
}
```

```kotlin test
class RectangleTest {
    // measurements
    @Test
    fun measures() {
        val r = Rectangle(3, 4)
        assertEquals(12, r.area)
        assertEquals(14, r.perimeter)
        assertFalse("3 by 4 is not a square", r.isSquare)

        val s = Rectangle(5, 5)
        assertEquals(25, s.area)
        assertEquals(20, s.perimeter)
        assertTrue("5 by 5 is a square", s.isSquare)
    }

    // scaling leaves the original alone
    @Test
    fun scaling() {
        val r = Rectangle(3, 4)
        val big = r.scaled(2)
        assertEquals(6, big.width)
        assertEquals(8, big.height)
        assertEquals(48, big.area)
        assertEquals(12, r.area)
        assertEquals(3, Rectangle(1, 3).scaled(1).height)
    }

    // the companion factory, and rejected sides
    @Test
    fun factoryAndValidation() {
        val sq = Rectangle.square(6)
        assertEquals(6, sq.width)
        assertEquals(6, sq.height)
        assertTrue("square() builds a square", sq.isSquare)
        try {
            Rectangle(0, 4)
            fail("a zero side should be rejected")
        } catch (e: IllegalArgumentException) {
        }
        try {
            Rectangle(4, -1)
            fail("a negative side should be rejected")
        } catch (e: IllegalArgumentException) {
        }
    }
}
```

#### Uses
- [Classes & properties › Custom getters and setters](#/classes/custom-getters-and-setters)
- [Classes & properties › `init` blocks and secondary constructors](#/classes/init-blocks-and-secondary-constructors)
- [Classes & properties › Companion objects](#/classes/companion-objects)

#### Hints
- The starter stores constants. Replace each with a getter: `val area: Int get() = width * height`.
- `require(width > 0 && height > 0)` inside an `init` block throws `IllegalArgumentException` for you.
- `scaled` builds something new rather than changing anything: `fun scaled(factor: Int) = Rectangle(width * factor, height * factor)`.
- The companion's `square(side)` is one call away: `Rectangle(side, side)`.

#### Tips
- `perimeter` is `2 * (width + height)`, not `width + height`.
- `require` in an `init` block runs before the object exists for anyone else, which is the only place a validity rule cannot be skipped.
- A companion function is called as `Rectangle.square(3)`, exactly like a Java static — Kotlin has no `static` keyword.

#### Docs
- [Companion objects](https://kotlinlang.org/docs/object-declarations.html#companion-objects)
- [require](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/require.html)

### 3. Thermostat

Write a `Thermostat(initial)` with a `var target` that can never leave the range 5 to 30: assigning 40 stores 30, assigning 0 stores 5. `initial` defaults to 20 and is clamped the same way. `warmer(by)` and `cooler(by)` move the target, both defaulting to a step of 1 and both respecting the limits, and `isFrostProtection` reports whether the target has bottomed out at 5.

```kotlin starter
class Thermostat(initial: Int = 20) {
    var target: Int = initial
    val isFrostProtection: Boolean = false

    fun warmer(by: Int = 1) {
        target += by
    }

    fun cooler(by: Int = 1) {
        target -= by
    }
}
```

```kotlin test
class ThermostatTest {
    // the initial value, clamped
    @Test
    fun initial() {
        assertEquals(20, Thermostat().target)
        assertEquals(18, Thermostat(18).target)
        assertEquals(30, Thermostat(99).target)
        assertEquals(5, Thermostat(-4).target)
        assertEquals(5, Thermostat(5).target)
    }

    // assignment is clamped too
    @Test
    fun assignment() {
        val t = Thermostat()
        t.target = 25
        assertEquals(25, t.target)
        t.target = 40
        assertEquals(30, t.target)
        t.target = 0
        assertEquals(5, t.target)
        t.target = 30
        assertEquals(30, t.target)
    }

    // warmer and cooler stop at the limits
    @Test
    fun steps() {
        val t = Thermostat(20)
        t.warmer()
        assertEquals(21, t.target)
        t.cooler(3)
        assertEquals(18, t.target)
        t.warmer(100)
        assertEquals(30, t.target)
        t.cooler(100)
        assertEquals(5, t.target)
    }

    // frost protection is the bottom of the range
    @Test
    fun frostProtection() {
        val t = Thermostat(20)
        assertFalse("20 is not frost protection", t.isFrostProtection)
        t.cooler(50)
        assertTrue("clamped at 5 is frost protection", t.isFrostProtection)
        t.warmer()
        assertFalse("6 is not frost protection", t.isFrostProtection)
        assertTrue("a cold start is frost protection", Thermostat(1).isFrostProtection)
    }
}
```

#### Uses
- [Classes & properties › Custom getters and setters](#/classes/custom-getters-and-setters)
- [Classes & properties › `init` blocks and secondary constructors](#/classes/init-blocks-and-secondary-constructors)
- [Classes & properties › Member functions and `this`](#/classes/member-functions-and-this)
- [Functions › Default arguments](#/functions/default-arguments)
- [Variables & types › Clamping and kotlin.math](#/basics/clamping-and-kotlin-math)

#### Hints
- The setter is the only place the clamp belongs: `set(value) { field = value.coerceIn(5, 30) }`. Assign to `field`, never to `target`, or the setter calls itself.
- `var target: Int = initial` skips the setter — an initialiser writes the backing field directly. Start it at any legal value and assign `initial` in an `init` block, which does go through the setter.
- With the clamp in the setter, `warmer` and `cooler` need no limit checks of their own; `target += by` is already safe.
- `isFrostProtection` has to be a getter, since it changes as the target does.

#### Tips
- `coerceIn(5, 30)` is the standard-library clamp. An `if` chain works too; it is just longer.
- Inside a setter, assign to `field`. Assigning to the property's own name calls the setter again, forever.
- A property initialiser writes the backing field directly and skips the setter. That is why `initial` has to go through an `init` block to be clamped.

#### Docs
- [Backing fields](https://kotlinlang.org/docs/properties.html#backing-fields)
- [coerceIn](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.ranges/coerce-in.html)

### 4. Shapes

Write an open class `Shape(name)` with a `name`, an open `area()` that returns `0.0`, and a final `describe()` that returns `"<name> has area <area>"` — for example `"square has area 9.0"`. Then two subclasses: `Square(side)`, named `"square"`, and `Box(width, height)`, named `"box"`, each overriding `area()`. `describe()` is written once, in `Shape`, and must not be overridden.

```kotlin starter
open class Shape(val name: String) {
    open fun area(): Double = 0.0
    fun describe(): String = "$name has area 0.0"
}

class Square(val side: Double) : Shape("square")

class Box(val width: Double, val height: Double) : Shape("box")
```

```kotlin test
class ShapesTest {
    // each shape knows its own area
    @Test
    fun areas() {
        assertEquals(9.0, Square(3.0).area(), 1e-9)
        assertEquals(0.25, Square(0.5).area(), 1e-9)
        assertEquals(12.0, Box(3.0, 4.0).area(), 1e-9)
        assertEquals(0.0, Box(0.0, 4.0).area(), 1e-9)
        assertEquals(0.0, Shape("nothing").area(), 1e-9)
    }

    // names come from the subclass
    @Test
    fun names() {
        assertEquals("square", Square(3.0).name)
        assertEquals("box", Box(1.0, 2.0).name)
        assertEquals("blob", Shape("blob").name)
    }

    // describe() is inherited and uses the overridden area
    @Test
    fun describes() {
        assertEquals("square has area 9.0", Square(3.0).describe())
        assertEquals("box has area 12.0", Box(3.0, 4.0).describe())
        assertEquals("blob has area 0.0", Shape("blob").describe())
    }

    // a Square is a Shape
    @Test
    fun polymorphism() {
        val shape: Shape = Square(2.0)
        assertEquals(4.0, shape.area(), 1e-9)
        assertEquals("square has area 4.0", shape.describe())
        assertTrue("Box is a Shape", Box(1.0, 1.0) is Shape)
    }
}
```

#### Uses
- [Classes & properties › Inheritance](#/classes/inheritance)
- [Classes & properties › Declaring a class](#/classes/declaring-a-class)
- [Classes & properties › Member functions and `this`](#/classes/member-functions-and-this)
- [Functions › Single-expression bodies](#/functions/single-expression-bodies)

#### Hints
- `describe()` must call `area()` rather than repeat a number: `fun describe() = "$name has area ${area()}"`. Because `area()` is open, each subclass's version is the one that runs.
- A subclass overrides with `override fun area() = side * side`. The compiler insists on the keyword.
- `Square(3.0).describe()` gives `"square has area 9.0"` because a `Double` prints with its decimal point. No formatting is needed.

#### Tips
- The subclasses pass their name to the parent constructor in the header — `: Shape("square")` — so they have no `name` property of their own.
- `describe()` is not `open`, yet it calls the subclass's `area()`. That is ordinary dynamic dispatch, and it is how a base class defines a workflow its subclasses fill in.
- Classes and members are final unless marked `open`, so the parent needs `open class` and `open fun area()` before anything can override them.

#### Docs
- [Inheritance](https://kotlinlang.org/docs/inheritance.html)
- [Overriding methods](https://kotlinlang.org/docs/inheritance.html#overriding-methods)
