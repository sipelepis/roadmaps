# Data & enum classes

Most of the classes in a real program hold data rather than behaviour: a point, a user, an order line. Kotlin has a keyword for that, `data`, which makes the compiler write the equality, hashing, printing and copying code you would otherwise type out by hand. Its companion is `enum class`, a type whose values are a fixed, named list.

Together these two cover a surprising amount of modelling. A `data class` says "this is a bundle of values, compared by its contents"; an `enum class` says "this can only be one of these".

## Data classes

Put `data` in front of a class whose primary constructor holds its properties, and you are done.

```kotlin
data class Point(val x: Int, val y: Int)

val p = Point(1, 2)
println(p.x)          // 1
```

The rules are small: the primary constructor must have at least one parameter, and every parameter must be a `val` or a `var`. That is all a data class needs to know.

## What the compiler writes for you

For a data class, the compiler generates four things from the primary-constructor properties:

- `equals` — two instances are equal when all of their properties are equal
- `hashCode` — consistent with that equality, so data classes work as map keys and set elements
- `toString` — `Point(x=1, y=2)`
- `copy` and `componentN` — see below

```kotlin
val a = Point(1, 2)
val b = Point(1, 2)

println(a == b)          // true  — structural equality, calls equals
println(a === b)         // false — identity, two different objects
println(a)               // Point(x=1, y=2)
println(a.hashCode() == b.hashCode())   // true
```

Without `data`, `a == b` would be `false` and `println(a)` would print something like `Point@4b67cf4d`. `==` calls `equals` in Kotlin, and `===` is the reference comparison — the opposite convention to Java, and the better one.

One property type breaks all of this: an `Array`. The generated `equals` compares each property with `equals`, and arrays compare by identity, so two data classes holding equal arrays are not equal:

```kotlin
data class Row(val cells: Array<String>)
Row(arrayOf("a")) == Row(arrayOf("a"))   // false

data class Row2(val cells: List<String>)
Row2(listOf("a")) == Row2(listOf("a"))   // true
```

The fix is almost always to hold a `List` instead. If you really need the array, you have to write `equals` and `hashCode` by hand using `contentEquals` and `contentHashCode` — and then remember that `copy` still shares the same array with the original.

## copy

Data classes are meant to be immutable: declare the properties `val` and make a changed *copy* instead of mutating.

```kotlin
data class User(val name: String, val email: String, val active: Boolean)

val ada = User("Ada", "ada@example.com", true)
val renamed = ada.copy(name = "Ada Lovelace")
val gone = ada.copy(active = false)

println(renamed)     // User(name=Ada Lovelace, email=ada@example.com, active=true)
println(ada.active)  // true — the original is untouched
```

`copy` takes every property as a named argument defaulting to the current value, so you name only the ones you are changing. Prefer this to `var` properties: a value that never changes cannot be changed behind your back.

## Destructuring

The generated `component1()`, `component2()` and so on let you unpack an instance into variables:

```kotlin
val (name, email, active) = ada
println("$name <$email> active=$active")
```

The order is the order of the primary constructor, not the names, so destructuring a class with several same-typed properties is easy to get subtly wrong. Use `_` to skip one you do not need: `val (name, _, active) = ada`.

## What is left out

Only the properties in the **primary constructor** take part. Anything declared in the body is ignored by `equals`, `hashCode`, `toString` and `copy`:

```kotlin
data class Session(val id: String) {
    var lastSeen: Long = 0      // not part of equality, not copied
}
```

Two `Session("a")` values are equal even with different `lastSeen`. That is occasionally what you want and more often a trap, so keep the identity of the value in the constructor.

## Enum classes

An enum class is a type with a closed set of instances, each one a named constant.

```kotlin
enum class Status { PENDING, SHIPPED, DELIVERED }

val s = Status.SHIPPED
println(s)              // SHIPPED
println(s.name)         // SHIPPED, as a String
println(s.ordinal)      // 1, its position, counting from 0
```

Enum constants are singletons, so `==` and `===` agree, and `when` over them reads well.

## Enums with state and behaviour

An enum constant can carry values and the class can have methods, which is what makes Kotlin enums more useful than a handful of integer constants.

```kotlin
enum class Planet(val massKg: Double, val radiusM: Double) {
    EARTH(5.976e24, 6.37814e6),
    MARS(6.421e23, 3.3972e6);

    fun surfaceGravity(): Double = 6.67300E-11 * massKg / (radiusM * radiusM)
}

println(Planet.MARS.surfaceGravity())   // 3.71...
```

The semicolon after the last constant is required once the class has a body — it is the one place in Kotlin where a semicolon is not optional.

## entries, valueOf and ordinal

Every enum class gets three members for free:

```kotlin
println(Status.entries)            // [PENDING, SHIPPED, DELIVERED]
println(Status.entries[0])         // PENDING
println(Status.valueOf("SHIPPED")) // SHIPPED, throws IllegalArgumentException on an unknown name
println(Status.PENDING.ordinal)    // 0
```

`entries` is a list of the constants in declaration order, so `entries.size` counts them and `entries[(ordinal + 1) % entries.size]` steps to the next one and wraps around. (`values()` does the same thing and is the older API; `entries` avoids copying the array on every call.)

## when over an enum

`when` over an enum used as an *expression* does not need an `else` if you list every constant — the compiler checks for you, and adding a new constant later turns every such `when` into a compile error until you handle it. That is a feature, not a nuisance.

```kotlin
fun advice(s: Status) = when (s) {
    Status.PENDING -> "hold tight"
    Status.SHIPPED -> "on its way"
    Status.DELIVERED -> "enjoy"
}
```

```kotlin playground
data class Order(val id: String, val item: String, val quantity: Int, val status: Status)

enum class Status(val label: String, val done: Boolean) {
    PENDING("waiting", false),
    SHIPPED("in transit", false),
    DELIVERED("delivered", true);

    fun next(): Status = entries[minOf(ordinal + 1, entries.size - 1)]
}

fun main() {
    val order = Order("A-1", "keyboard", 2, Status.PENDING)

    println(order)
    println(order == Order("A-1", "keyboard", 2, Status.PENDING))   // structural equality

    // a changed copy, the original untouched
    val shipped = order.copy(status = order.status.next())
    println(shipped)
    println("original is still ${order.status}")

    // destructuring
    val (id, item, quantity, status) = shipped
    println("$id: $quantity x $item is ${status.label}")

    // every constant, with the data it carries
    for (s in Status.entries) {
        println("${s.ordinal}. ${s.name} (${s.label}) done=${s.done}")
    }
}
```

## Exercises

### 1. Make it a data class

Turn `Book` into a data class so that two books with the same title, author and year are equal, hash the same, and print as `Book(title=Dune, author=Herbert, year=1965)`. Then write `label(book)`, which returns `"Dune by Herbert (1965)"`.

```kotlin starter
class Book(val title: String, val author: String, val year: Int)

fun label(book: Book): String {
    return book.title
}
```

```kotlin test
class BookTest {
    // equal contents means equal books
    @Test
    fun equality() {
        assertEquals(Book("Dune", "Herbert", 1965), Book("Dune", "Herbert", 1965))
        assertEquals(Book("", "", 0), Book("", "", 0))
        assertTrue("different years are different books", Book("Dune", "Herbert", 1965) != Book("Dune", "Herbert", 1966))
        assertTrue("different titles are different books", Book("Dune", "Herbert", 1965) != Book("Emma", "Herbert", 1965))
    }

    // equal books hash the same
    @Test
    fun hashing() {
        assertEquals(Book("Dune", "Herbert", 1965).hashCode(), Book("Dune", "Herbert", 1965).hashCode())
        assertEquals(Book("Emma", "Austen", 1815).hashCode(), Book("Emma", "Austen", 1815).hashCode())
    }

    // toString names every property
    @Test
    fun printing() {
        assertEquals("Book(title=Dune, author=Herbert, year=1965)", Book("Dune", "Herbert", 1965).toString())
        assertEquals("Book(title=Emma, author=Austen, year=1815)", Book("Emma", "Austen", 1815).toString())
    }

    // label reads as a citation
    @Test
    fun labels() {
        assertEquals("Dune by Herbert (1965)", label(Book("Dune", "Herbert", 1965)))
        assertEquals("Emma by Austen (1815)", label(Book("Emma", "Austen", 1815)))
        assertEquals(" by  (0)", label(Book("", "", 0)))
    }
}
```

#### Uses
- [Data & enum classes › Data classes](#/data-classes/data-classes)
- [Data & enum classes › What the compiler writes for you](#/data-classes/what-the-compiler-writes-for-you)

#### Hints
- One keyword in front of `class` gives you equality, hashing and `toString`.
- `label` is a single string template: `"${book.title} by ${book.author} (${book.year})"`.

#### Tips
- The generated `toString` uses exactly the property names you wrote, which is why renaming a property changes your logs.
- Only properties in the **primary constructor** count. A `var` declared in the class body is invisible to `equals`, `hashCode`, `toString` and `copy`.
- A data class needs at least one primary-constructor parameter, and every one of them has to be a `val` or a `var`.

#### Docs
- [Data classes](https://kotlinlang.org/docs/data-classes.html)

### 2. Points of the compass

Fill in `Direction.opposite()` and `Direction.right()`. `right()` turns 90° clockwise, so `NORTH.right()` is `EAST` and `WEST.right()` wraps around to `NORTH`.

```kotlin starter
enum class Direction {
    NORTH, EAST, SOUTH, WEST;

    fun opposite(): Direction = NORTH

    fun right(): Direction = NORTH
}
```

```kotlin test
class DirectionTest {
    // opposite flips every direction
    @Test
    fun opposites() {
        assertEquals(Direction.SOUTH, Direction.NORTH.opposite())
        assertEquals(Direction.WEST, Direction.EAST.opposite())
        assertEquals(Direction.NORTH, Direction.SOUTH.opposite())
        assertEquals(Direction.EAST, Direction.WEST.opposite())
    }

    // right turns clockwise and wraps at WEST
    @Test
    fun turns() {
        assertEquals(Direction.EAST, Direction.NORTH.right())
        assertEquals(Direction.SOUTH, Direction.EAST.right())
        assertEquals(Direction.WEST, Direction.SOUTH.right())
        assertEquals(Direction.NORTH, Direction.WEST.right())
    }

    // two opposites and four turns get you home
    @Test
    fun roundTrips() {
        for (d in Direction.entries) {
            assertEquals(d, d.opposite().opposite())
            assertEquals(d, d.right().right().right().right())
            assertEquals(d.opposite(), d.right().right())
        }
    }
}
```

#### Uses
- [Data & enum classes › Enum classes](#/data-classes/enum-classes)
- [Data & enum classes › entries, valueOf and ordinal](#/data-classes/entries-valueof-and-ordinal)
- [Data & enum classes › when over an enum](#/data-classes/when-over-an-enum)

#### Hints
- The plainest solution is `when (this) { NORTH -> SOUTH; ... }` with all four constants listed. Inside the enum body you can name them without the `Direction.` prefix.
- The arithmetic version is shorter: the constants are in clockwise order, so `entries[(ordinal + 1) % entries.size]` turns right.
- `opposite()` is two right turns, or `+ 2` instead of `+ 1` in the same expression.

#### Tips
- Listing every constant in a `when` expression means the compiler will point at this function if a fifth direction ever appears.
- `entries` is in declaration order, so the arithmetic version only works while the constants stay in clockwise order. Say so in a comment if you take that route.
- `%` on a negative would go wrong here, but `ordinal + 1` is never negative, so the wrap is safe.

#### Docs
- [Enum classes](https://kotlinlang.org/docs/enum-classes.html)

### 3. Promote without mutating

`promote(employee, newTitle, raise)` returns a **new** `Employee` with the given title and with `raise` added to the salary. The employee that was passed in must come back unchanged. `summary(employee)` returns `"Ada — Engineer, 120000"` (an em dash with a space on each side), and has to use destructuring rather than dot access.

```kotlin starter
data class Employee(val name: String, val title: String, val salary: Int)

fun promote(employee: Employee, newTitle: String, raise: Int): Employee {
    return employee
}

fun summary(employee: Employee): String {
    return employee.name
}
```

```kotlin test
class PromoteTest {
    // the copy has the new title and salary
    @Test
    fun promotes() {
        val ada = Employee("Ada", "Engineer", 120000)
        assertEquals(Employee("Ada", "Lead", 130000), promote(ada, "Lead", 10000))
        assertEquals(Employee("Ada", "Engineer", 120000), promote(ada, "Engineer", 0))
        assertEquals(Employee("Bob", "Staff", 95000), promote(Employee("Bob", "Junior", 100000), "Staff", -5000))
    }

    // the original is untouched
    @Test
    fun noMutation() {
        val ada = Employee("Ada", "Engineer", 120000)
        promote(ada, "Lead", 10000)
        assertEquals("Engineer", ada.title)
        assertEquals(120000, ada.salary)
        assertTrue("promote must return a different object", promote(ada, "Lead", 1) !== ada)
    }

    // the name is never changed
    @Test
    fun keepsName() {
        assertEquals("Grace", promote(Employee("Grace", "A", 1), "B", 2).name)
        assertEquals("", promote(Employee("", "A", 0), "B", 0).name)
    }

    // summary reads as one line
    @Test
    fun summaries() {
        assertEquals("Ada — Engineer, 120000", summary(Employee("Ada", "Engineer", 120000)))
        assertEquals("Bob — Junior, 0", summary(Employee("Bob", "Junior", 0)))
        assertEquals(" — , -1", summary(Employee("", "", -1)))
    }
}
```

#### Uses
- [Data & enum classes › copy](#/data-classes/copy)
- [Data & enum classes › Destructuring](#/data-classes/destructuring)

#### Hints
- `copy` takes the properties you want to change as named arguments and keeps the rest: `employee.copy(title = newTitle)`.
- The new salary is computed from the old one: `salary = employee.salary + raise`.
- In `summary`, unpack first: `val (name, title, salary) = employee`, then build the string.

#### Tips
- A raise can be negative, and `copy` does not care — it copies whatever you give it.
- `copy` is a shallow copy: a property that points at a mutable list is still the same list in both instances.
- Destructuring goes by position, not by name, so `val (name, title, salary) = employee` follows the primary constructor's order exactly.

#### Docs
- [Copying](https://kotlinlang.org/docs/data-classes.html#copying)
- [Destructuring declarations](https://kotlinlang.org/docs/destructuring-declarations.html)

### 4. The next working day

`Weekday` already knows whether each day is a workday. Write:

- `workdayCount()` — how many days of the week are workdays, counted from `entries` rather than hardcoded.
- `nextWorkday(day)` — the first workday strictly *after* `day`, wrapping around the end of the week. `FRIDAY` and `SATURDAY` both lead to `MONDAY`.

```kotlin starter
enum class Weekday(val isWorkday: Boolean) {
    MONDAY(true),
    TUESDAY(true),
    WEDNESDAY(true),
    THURSDAY(true),
    FRIDAY(true),
    SATURDAY(false),
    SUNDAY(false),
}

fun workdayCount(): Int {
    return 7
}

fun nextWorkday(day: Weekday): Weekday {
    return Weekday.MONDAY
}
```

```kotlin test
class WeekdayTest {
    // five of the seven days are workdays
    @Test
    fun counts() {
        assertEquals(5, workdayCount())
        assertEquals(7, Weekday.entries.size)
    }

    // midweek it is simply the next day
    @Test
    fun midweek() {
        assertEquals(Weekday.TUESDAY, nextWorkday(Weekday.MONDAY))
        assertEquals(Weekday.WEDNESDAY, nextWorkday(Weekday.TUESDAY))
        assertEquals(Weekday.THURSDAY, nextWorkday(Weekday.WEDNESDAY))
        assertEquals(Weekday.FRIDAY, nextWorkday(Weekday.THURSDAY))
    }

    // the weekend is skipped and the week wraps
    @Test
    fun weekend() {
        assertEquals(Weekday.MONDAY, nextWorkday(Weekday.FRIDAY))
        assertEquals(Weekday.MONDAY, nextWorkday(Weekday.SATURDAY))
        assertEquals(Weekday.MONDAY, nextWorkday(Weekday.SUNDAY))
    }

    // every day leads to a workday, and never to itself
    @Test
    fun always() {
        for (day in Weekday.entries) {
            val next = nextWorkday(day)
            assertTrue("$day should lead to a workday, got $next", next.isWorkday)
            assertTrue("$day should not lead to itself", next != day)
        }
    }
}
```

#### Uses
- [Data & enum classes › Enums with state and behaviour](#/data-classes/enums-with-state-and-behaviour)
- [Data & enum classes › entries, valueOf and ordinal](#/data-classes/entries-valueof-and-ordinal)

#### Hints
- `Weekday.entries` is a list in declaration order, so `entries.size` is 7 and `entries[i]` is a day.
- For the count, walk `entries` with a `for` loop and add one whenever `isWorkday` is true.
- For the next workday, step forward from `day.ordinal + 1` and wrap with `% 7`; keep stepping while the day you land on is not a workday. Seven steps are always enough.

#### Tips
- Counting from `entries` instead of writing `5` means the function stays right if the enum ever changes — which is the whole reason the constants carry their own data.
- The semicolon after the last enum constant is required once the class has a body. It is the one place in Kotlin where a semicolon is not optional.
- `entries.count { it.isWorkday }` says the same as the loop in one line, once you have lambdas.

#### Docs
- [Working with enum constants](https://kotlinlang.org/docs/enum-classes.html#working-with-enum-constants)
