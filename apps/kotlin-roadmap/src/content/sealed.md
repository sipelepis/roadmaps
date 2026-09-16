# Sealed types & when

An enum says "one of these values". A sealed type says "one of these *shapes*" — a fixed set of subclasses, each free to carry its own data. Paired with `when`, it gives you the thing Java spent twenty years without: a value you can take apart by case, with the compiler checking that you handled every case.

This is how Kotlin models a result, a state machine, a parsed token, or anything else that comes in a small number of kinds. Where an object-oriented design would put a method on each subclass, a sealed hierarchy lets the *caller* branch — which is better when the set of kinds is stable and the set of operations keeps growing.

## `when`, revisited

`when` is a `switch` that is an expression, matches anything, and needs no `break`.

```kotlin
val label = when (code) {
    200 -> "ok"
    301, 302 -> "redirect"          // several values in one branch
    else -> "something else"
}
```

Used as an **expression**, `when` must produce a value for every possible subject, so it needs an `else` — unless the compiler can already prove the branches are exhaustive, which is the point of this module. Used as a **statement**, where you ignore the result, `else` is optional.

## Branches beyond equality

A branch can be a range, a membership test, a type test, or an arbitrary condition:

```kotlin
fun describe(n: Int): String = when {
    n < 0 -> "negative"
    n == 0 -> "zero"
    n in 1..9 -> "single digit"
    else -> "big"
}

fun kind(x: Any): String = when (x) {
    in 1..9 -> "small number"
    is String -> "text of ${x.length} characters"
    is Boolean -> "a flag"
    else -> "no idea"
}
```

Two forms are worth separating in your head. `when (subject) { ... }` compares each branch against the subject: `in` a range, `is` a type, or `==` a value. `when { ... }` with no subject is a chain of independent conditions, a tidier `if / else if`. Both can bind their subject: `when (val row = load()) { ... }` keeps `row` in scope for the branches.

## Sealed classes and interfaces

`sealed` means: this type may be extended, but only by subclasses declared in the same package and module. The compiler therefore knows the complete list.

```kotlin
sealed interface Shape

data class Circle(val radius: Double) : Shape
data class Rect(val width: Double, val height: Double) : Shape
data object UnitSquare : Shape
```

Subclasses are ordinary classes: usually data classes, because they carry values, and `data object` for a case with no data at all — a singleton with a sensible `toString`. `sealed interface` is the common choice today; `sealed class` behaves the same and additionally lets you put shared state in a constructor.

Unlike an enum, each case can have a different shape, and you can have many `Circle` instances with different radii. Unlike an open class, nobody outside can add a fourth case behind your back.

## Exhaustive when

Because the case list is closed, a `when` over a sealed type that covers every case needs no `else`:

```kotlin
fun area(shape: Shape): Double = when (shape) {
    is Circle -> 3.141592653589793 * shape.radius * shape.radius
    is Rect -> shape.width * shape.height
    UnitSquare -> 1.0
}
```

Leave out a case and it is a compile error, not a runtime surprise. That is the real payoff: add `Triangle` to the hierarchy next year and the compiler walks you through every place that has to change. Writing `else -> 0.0` here throws that away — an `else` makes the `when` exhaustive by brute force, so a new case silently falls into it. Resist the `else` on a sealed `when`.

Note that `data object UnitSquare` is matched with `UnitSquare` (an equality check), while a class needs `is Circle` (a type check).

## Smart casts

Inside `is Circle ->`, the compiler knows `shape` is a `Circle`, so `shape.radius` just works: no cast, no new variable. The same applies after an `if (x is String)`, after an early `return`, and to `!is` in the other direction.

```kotlin
fun length(x: Any): Int {
    if (x !is String) return 0
    return x.length            // x is a String from here on
}
```

Smart casts need the compiler to be able to prove the value cannot change between the check and the use. They work on `val`s and on local `var`s that nothing captures, and not on a `var` property of a class, which another thread could change in between. When Kotlin refuses, copy the value into a local `val` first.

## Sealed hierarchies nest

A case of a sealed type can hold another value of the same sealed type, which is how you get trees:

```kotlin
sealed interface Expr
data class Num(val value: Int) : Expr
data class Add(val left: Expr, val right: Expr) : Expr

fun eval(e: Expr): Int = when (e) {
    is Num -> e.value
    is Add -> eval(e.left) + eval(e.right)
}
```

The `when` mirrors the shape of the type, and recursion handles the depth. Every interpreter, formatter and JSON model you will write in Kotlin looks like this.

## Sealed versus enum

Reach for an **enum** when the cases are just names, possibly with the same fixed set of attributes: days of the week, log levels, card suits. Enums bring `entries`, `ordinal` and `valueOf` along.

Reach for a **sealed type** when the cases carry different data: `Loading`, `Content(items)`, `Failed(error)`. You lose `entries` — there is no list of instances, because `Content` has infinitely many — and you gain per-case fields.

```kotlin playground
sealed interface Event
data class Deposit(val amount: Int) : Event
data class Withdraw(val amount: Int) : Event
data class Interest(val percent: Int) : Event
data object Close : Event

sealed interface Account
data class Open(val balance: Int) : Account
data class Closed(val finalBalance: Int) : Account

fun step(account: Account, event: Event): Account = when (account) {
    is Closed -> account                      // nothing happens to a closed account
    is Open -> when (event) {
        is Deposit -> Open(account.balance + event.amount)
        is Withdraw -> if (event.amount > account.balance) account else Open(account.balance - event.amount)
        is Interest -> Open(account.balance + account.balance * event.percent / 100)
        Close -> Closed(account.balance)
    }
}

fun render(account: Account): String = when (account) {
    is Open -> "open, balance ${account.balance}"
    is Closed -> "closed at ${account.finalBalance}"
}

fun main() {
    val events = listOf(Deposit(100), Withdraw(30), Interest(10), Withdraw(1000), Close, Deposit(5))

    var account: Account = Open(0)
    for (event in events) {
        account = step(account, event)
        println("${event.toString().padEnd(20)} -> ${render(account)}")
    }
}
```

## Exercises

### 1. Size of a number

`sizeOf(n)` classifies an `Int` with a single `when` expression:

- below zero → `"negative"`
- exactly zero → `"zero"`
- 1 to 9 → `"single digit"`
- 10 to 99 → `"double digit"`
- anything larger → `"big"`

```kotlin starter
fun sizeOf(n: Int): String {
    return "big"
}
```

```kotlin test
class SizeOfTest {
    // the five categories
    @Test
    fun categories() {
        assertEquals("negative", sizeOf(-42))
        assertEquals("zero", sizeOf(0))
        assertEquals("single digit", sizeOf(4))
        assertEquals("double digit", sizeOf(55))
        assertEquals("big", sizeOf(1000))
    }

    // the boundaries land on the right side
    @Test
    fun boundaries() {
        assertEquals("negative", sizeOf(-1))
        assertEquals("single digit", sizeOf(1))
        assertEquals("single digit", sizeOf(9))
        assertEquals("double digit", sizeOf(10))
        assertEquals("double digit", sizeOf(99))
        assertEquals("big", sizeOf(100))
    }

    // the extremes of Int
    @Test
    fun extremes() {
        assertEquals("negative", sizeOf(Int.MIN_VALUE))
        assertEquals("big", sizeOf(Int.MAX_VALUE))
        assertEquals("negative", sizeOf(-100))
    }
}
```

#### Uses
- [Sealed types & when › `when`, revisited](#/sealed/when-revisited)
- [Sealed types & when › Branches beyond equality](#/sealed/branches-beyond-equality)

#### Hints
- The subjectless form reads best here: `when { n < 0 -> ...; n == 0 -> ... }`.
- Branches are tried in order, so once `n < 0` and `n == 0` are out of the way, the rest only ever see positive numbers.
- `n in 1..9` and `n in 10..99` express the two middle cases directly.

#### Tips
- As an expression, `when` needs a branch that always matches — that last `else` is what makes the function total.
- Branches are tried top to bottom and the first match wins, so `n in 1..9` never sees a negative once `n < 0` is above it.
- A `when` used as a statement, where you throw the value away, does not need an `else` at all. It is only the expression form that must produce something.

#### Docs
- [when expressions](https://kotlinlang.org/docs/control-flow.html#when-expressions-and-statements)

### 2. Area of a shape

`Shape` is sealed, so write `area(shape)` as one `when` with a branch per case and **no `else`**. A circle is `π r²` (use `Math.PI`), a rectangle is width times height, a square is its side squared, and the unit square is `1.0`.

```kotlin starter
sealed interface Shape
data class Circle(val radius: Double) : Shape
data class Rect(val width: Double, val height: Double) : Shape
data class Square(val side: Double) : Shape
data object UnitSquare : Shape

fun area(shape: Shape): Double {
    return 0.0
}
```

```kotlin test
class AreaTest {
    // each kind of shape
    @Test
    fun shapes() {
        assertEquals(Math.PI, area(Circle(1.0)), 1e-9)
        assertEquals(4.0 * Math.PI, area(Circle(2.0)), 1e-9)
        assertEquals(6.0, area(Rect(2.0, 3.0)), 1e-9)
        assertEquals(9.0, area(Square(3.0)), 1e-9)
        assertEquals(1.0, area(UnitSquare), 1e-9)
    }

    // a square is not just any rectangle
    @Test
    fun squares() {
        assertEquals(area(Rect(4.0, 4.0)), area(Square(4.0)), 1e-9)
        assertEquals(0.25, area(Square(0.5)), 1e-9)
        assertEquals(1.0, area(Square(1.0)), 1e-9)
    }

    // degenerate shapes have no area
    @Test
    fun zero() {
        assertEquals(0.0, area(Circle(0.0)), 1e-9)
        assertEquals(0.0, area(Rect(0.0, 5.0)), 1e-9)
        assertEquals(0.0, area(Rect(5.0, 0.0)), 1e-9)
        assertEquals(0.0, area(Square(0.0)), 1e-9)
    }

    // fractional sizes
    @Test
    fun fractions() {
        assertEquals(3.75, area(Rect(1.5, 2.5)), 1e-9)
        assertEquals(0.25 * Math.PI, area(Circle(0.5)), 1e-9)
    }
}
```

#### Uses
- [Sealed types & when › Sealed classes and interfaces](#/sealed/sealed-classes-and-interfaces)
- [Sealed types & when › Exhaustive when](#/sealed/exhaustive-when)
- [Sealed types & when › Smart casts](#/sealed/smart-casts)

#### Hints
- Match a class with `is Circle ->` and the `data object` with plain `UnitSquare ->`.
- Inside a branch, the smart cast has already happened: `shape.radius` compiles in the `is Circle` branch and nowhere else.
- If the compiler says the `when` is not exhaustive, a case is missing — that message is the feature working.

#### Tips
- Try deleting one branch and reading the error. Then try adding `else -> 0.0` and deleting the branch again: the error disappears, and so does the safety.
- A `data object` is matched with plain `UnitSquare ->`, an equality check. A class needs `is Circle ->`, a type check.
- `sealed` only restricts *where* subclasses may be declared, not how many there are: `Circle(1.0)` and `Circle(2.0)` are two instances of the same case.

#### Docs
- [Sealed classes](https://kotlinlang.org/docs/sealed-classes.html)

### 3. A tiny account machine

`apply(balance, command)` returns the new balance after a command:

- `Deposit(amount)` adds the amount.
- `Withdraw(amount)` subtracts it, but only if the balance covers it; otherwise the balance is returned unchanged.
- `Reset` sets the balance to `0`.

`describe(command)` returns `"deposit 50"`, `"withdraw 20"` or `"reset"`. Neither function may use `else`.

```kotlin starter
sealed interface Command
data class Deposit(val amount: Int) : Command
data class Withdraw(val amount: Int) : Command
data object Reset : Command

fun apply(balance: Int, command: Command): Int {
    return balance
}

fun describe(command: Command): String {
    return "reset"
}
```

```kotlin test
class CommandTest {
    // deposits and resets
    @Test
    fun deposits() {
        assertEquals(150, apply(100, Deposit(50)))
        assertEquals(50, apply(0, Deposit(50)))
        assertEquals(100, apply(100, Deposit(0)))
        assertEquals(0, apply(9999, Reset))
        assertEquals(0, apply(0, Reset))
    }

    // withdrawals that fit
    @Test
    fun withdrawals() {
        assertEquals(80, apply(100, Withdraw(20)))
        assertEquals(0, apply(100, Withdraw(100)))
        assertEquals(100, apply(100, Withdraw(0)))
    }

    // a withdrawal that does not fit changes nothing
    @Test
    fun overdraft() {
        assertEquals(100, apply(100, Withdraw(101)))
        assertEquals(0, apply(0, Withdraw(1)))
        assertEquals(5, apply(5, Withdraw(9999)))
    }

    // every command describes itself
    @Test
    fun descriptions() {
        assertEquals("deposit 50", describe(Deposit(50)))
        assertEquals("deposit 0", describe(Deposit(0)))
        assertEquals("withdraw 20", describe(Withdraw(20)))
        assertEquals("reset", describe(Reset))
    }
}
```

#### Uses
- [Sealed types & when › Exhaustive when](#/sealed/exhaustive-when)
- [Sealed types & when › Smart casts](#/sealed/smart-casts)
- [Data & enum classes › Data classes](#/data-classes/data-classes)

#### Hints
- One `when (command)` in each function, with three branches: `is Deposit`, `is Withdraw` and `Reset`.
- The withdrawal branch is itself an expression: `if (command.amount > balance) balance else balance - command.amount`.
- `describe` is three string templates; the `Reset` branch is a constant.

#### Tips
- Keeping the rule "never go below zero" inside `apply` means no caller can forget it. That is the argument for branching on the command rather than on the caller's mood.
- Each branch is itself an expression, so `is Withdraw -> if (...) balance else balance - command.amount` is one line, not a block with a `return`.
- Inside `is Withdraw ->` the smart cast has already happened; `command.amount` compiles there and nowhere else.

#### Docs
- [Sealed classes and when](https://kotlinlang.org/docs/sealed-classes.html#use-sealed-classes-with-when-expression)

### 4. An expression tree

`Expr` is a recursive sealed type. Write:

- `eval(e)` — the value of the expression, as an `Int`.
- `render(e)` — the expression as text, fully parenthesised: a number is its digits, `Neg` is `-(inner)`, `Add` is `(left + right)` and `Mul` is `(left * right)`, with single spaces around the operator.

So `render(Add(Num(1), Mul(Num(2), Num(3))))` is `"(1 + (2 * 3))"` and `eval` of it is `7`.

```kotlin starter
sealed interface Expr
data class Num(val value: Int) : Expr
data class Neg(val operand: Expr) : Expr
data class Add(val left: Expr, val right: Expr) : Expr
data class Mul(val left: Expr, val right: Expr) : Expr

fun eval(e: Expr): Int {
    return 0
}

fun render(e: Expr): String {
    return "0"
}
```

```kotlin test
class ExprTest {
    // single numbers and one operation
    @Test
    fun simple() {
        assertEquals(42, eval(Num(42)))
        assertEquals(-7, eval(Num(-7)))
        assertEquals(5, eval(Add(Num(2), Num(3))))
        assertEquals(6, eval(Mul(Num(2), Num(3))))
        assertEquals(-3, eval(Neg(Num(3))))
    }

    // nesting, in both branches
    @Test
    fun nested() {
        assertEquals(7, eval(Add(Num(1), Mul(Num(2), Num(3)))))
        assertEquals(9, eval(Mul(Add(Num(1), Num(2)), Num(3))))
        assertEquals(0, eval(Add(Num(5), Neg(Num(5)))))
        assertEquals(12, eval(Neg(Mul(Num(3), Neg(Num(4))))))
    }

    // rendering puts brackets around every operation
    @Test
    fun rendering() {
        assertEquals("42", render(Num(42)))
        assertEquals("(2 + 3)", render(Add(Num(2), Num(3))))
        assertEquals("(2 * 3)", render(Mul(Num(2), Num(3))))
        assertEquals("-(3)", render(Neg(Num(3))))
    }

    // rendering nested expressions
    @Test
    fun renderNested() {
        assertEquals("(1 + (2 * 3))", render(Add(Num(1), Mul(Num(2), Num(3)))))
        assertEquals("((1 + 2) * 3)", render(Mul(Add(Num(1), Num(2)), Num(3))))
        assertEquals("-((4 + -(1)))", render(Neg(Add(Num(4), Neg(Num(1))))))
    }

    // a deep tree still works
    @Test
    fun deep() {
        var e: Expr = Num(1)
        repeat(100) { e = Add(e, Num(1)) }
        assertEquals(101, eval(e))
        assertTrue("rendering should nest 100 deep", render(e).startsWith("((((("))
    }
}
```

#### Uses
- [Sealed types & when › Sealed hierarchies nest](#/sealed/sealed-hierarchies-nest)
- [Sealed types & when › Exhaustive when](#/sealed/exhaustive-when)
- [Sealed types & when › Smart casts](#/sealed/smart-casts)
- [Variables & types › Asking questions about a string](#/basics/asking-questions-about-a-string)

#### Hints
- Both functions are one `when (e)` with four branches, and no `else`.
- The `Num` branch is the base case. Every other branch calls the function again on its children: `is Add -> eval(e.left) + eval(e.right)`.
- `render` is the same shape with string templates: `"(${render(e.left)} + ${render(e.right)})"`.

#### Tips
- Two functions over the same sealed type, neither of them touching the type's declaration, is the pattern this whole module is for. Adding `Div` later breaks exactly the two `when`s that need attention.
- The recursion terminates because `Num` carries no sub-expression. Every sealed tree needs at least one case like it.
- `render` builds its parentheses from the inside out, so the outermost call is the last to add a pair — which is why the whole expression ends up fully bracketed.

#### Docs
- [Sealed classes](https://kotlinlang.org/docs/sealed-classes.html)
- [Recursion](https://kotlinlang.org/docs/functions.html#tail-recursive-functions)
