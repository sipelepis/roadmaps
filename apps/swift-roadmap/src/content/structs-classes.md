# Structs & classes

Swift has two ways to define a type with stored data and methods. A `struct` is a value: assigning it copies it, so nobody else can change your copy. A `class` is a reference: assigning it shares it, so two names see each other's changes. Almost everything in the standard library — `Int`, `String`, `Array`, `Dictionary` — is a struct, and most types you write should be too.

## Defining a struct

A struct lists its stored properties and its methods:

```swift
struct Point {
    var x: Double
    var y: Double

    func offset(to other: Point) -> Double {
        abs(x - other.x) + abs(y - other.y)
    }
}
```

Inside a method, the properties are reachable by name. `self` refers to the instance, and is only needed to disambiguate — usually when a parameter shadows a property.

## Initializers

A struct gets a *memberwise initializer* for free, with one labelled argument per stored property, in declaration order:

```swift
let origin = Point(x: 0, y: 0)
```

Writing your own `init` is how you validate, compute, or offer a shorter call. Every stored property must have a value by the time `init` finishes:

```swift
struct Temperature {
    var celsius: Double

    init(celsius: Double) {
        self.celsius = celsius
    }

    init(fahrenheit: Double) {
        self.celsius = (fahrenheit - 32) * 5 / 9
    }
}
```

An initializer can also fail. `init?` returns an optional, and `return nil` from it means the arguments were not acceptable:

```swift
struct Percentage {
    var value: Int

    init?(_ value: Int) {
        guard (0...100).contains(value) else { return nil }
        self.value = value
    }
}

Percentage(50)      // Optional(Percentage(value: 50))
Percentage(150)     // nil
```

Properties given a default value can be left out of the memberwise initializer, and a struct whose properties all have defaults can be created with `Type()`.

## Value semantics: structs are copied

Assigning a struct, passing it to a function, or putting it in an array all make a copy:

```swift
struct Counter { var count = 0 }

var a = Counter()
var b = a           // a copy
b.count = 5
a.count             // still 0
```

This is why a `let` struct is deeply immutable: you cannot change any of its properties, even the `var` ones. It is also why a struct in an array is copied out when you read it — `scores[0].bump()` mutates the array's element in place, but `var first = scores[0]; first.bump()` does not.

## Mutating methods

A method that changes the struct's own properties must be marked `mutating`, because it effectively replaces `self`:

```swift
struct Counter {
    var count = 0

    mutating func increment() { count += 1 }
    func doubled() -> Int { count * 2 }
}
```

`mutating` can only be called on a `var`, never on a `let`. The compiler catching that is the whole point: a constant struct really is constant. A method that returns a modified copy instead of mutating — `scaled(by:)` rather than `scale(by:)` — needs no `mutating` and works on constants.

## Classes are references

A class looks similar but behaves differently. It has no memberwise initializer, so you write `init` yourself; and a variable holding one is a reference to a shared instance:

```swift
class Account {
    var balance: Int

    init(balance: Int) {
        self.balance = balance
    }

    func deposit(_ amount: Int) { balance += amount }
}

let mine = Account(balance: 100)
let alias = mine        // the same account
alias.deposit(50)
mine.balance            // 150
```

Note that `mine` is a `let` and `alias.deposit(50)` still worked. `let` on a class means the *reference* cannot be repointed, not that the object is frozen. Class methods are never `mutating`, because changing a property does not replace the instance.

Classes can also inherit from another class, which structs cannot. That is the other reason to reach for one.

## Identity vs equality

Because a reference can be shared, classes have a question structs do not: are these two variables the same object? `===` and `!==` answer it:

```swift
let x = Account(balance: 0)
let y = Account(balance: 0)
let z = x

x === z         // true, one object
x === y         // false, two objects with equal balances
```

`===` is not `==`. Equality is a separate idea you opt into by conforming to `Equatable`; for a struct whose properties are all `Equatable`, `struct Point: Equatable` is enough and Swift writes the comparison for you.

## Which one to use

Reach for a struct by default: a value that is copied cannot be changed behind your back, which removes a whole category of bug. Reach for a class when you need one of the things only a reference gives you — a shared mutable object several parts of the program observe, an identity that survives copying, or inheritance.

```swift playground
struct Point: Equatable {
    var x: Double
    var y: Double

    func offset(to other: Point) -> Double {
        abs(x - other.x) + abs(y - other.y)
    }

    mutating func move(dx: Double, dy: Double) {
        x += dx
        y += dy
    }
}

let start = Point(x: 0, y: 0)
var copy = start
copy.move(dx: 3, dy: 4)
print("start \(start), copy \(copy), apart \(start.offset(to: copy))")
print("equal? \(start == Point(x: 0, y: 0))")

class Account {
    let owner: String
    var balance: Int

    init(owner: String, balance: Int = 0) {
        self.owner = owner
        self.balance = balance
    }

    func deposit(_ amount: Int) { balance += amount }
}

let mine = Account(owner: "Ada", balance: 100)
let alias = mine
alias.deposit(50)
print("\(mine.owner): \(mine.balance), same object: \(mine === alias)")

let other = Account(owner: "Ada", balance: 150)
print("same balance, same object? \(mine === other)")

struct Percentage {
    var value: Int
    init?(_ value: Int) {
        guard (0...100).contains(value) else { return nil }
        self.value = value
    }
}
print([50, 150, 0].map { Percentage($0)?.value })

// Try: make `copy` a `let` and see which line stops compiling.
```

## Exercises

### 1. A rectangle value

Write a `Rectangle` struct with `var width: Double` and `var height: Double`, in that order, so the free memberwise initializer is `Rectangle(width:height:)`.

- `area()` returns width times height.
- `perimeter()` returns twice the sum of the sides.
- `scaled(by:)` returns a *new* rectangle with both sides multiplied, leaving the original untouched.
- `isSquare()` is true when the sides are equal.

```swift starter
struct Rectangle {
    var width: Double
    var height: Double

    func area() -> Double {
        return 0
    }

    func perimeter() -> Double {
        return 0
    }

    func scaled(by factor: Double) -> Rectangle {
        return self
    }

    func isSquare() -> Bool {
        return true
    }
}
```

```swift test
/// area and perimeter
func testAreaAndPerimeter() {
    let r = Rectangle(width: 3, height: 4)
    expect(r.area(), 12)
    expect(r.perimeter(), 14)
    let thin = Rectangle(width: 0.5, height: 10)
    expect(thin.area(), 5)
    expect(thin.perimeter(), 21)
}

/// a zero side has zero area
func testZero() {
    let flat = Rectangle(width: 0, height: 7)
    expect(flat.area(), 0)
    expect(flat.perimeter(), 14)
    expect(Rectangle(width: 0, height: 0).area(), 0)
}

/// scaling makes a new rectangle
func testScaled() {
    let r = Rectangle(width: 2, height: 5)
    let big = r.scaled(by: 3)
    expect(big.width, 6)
    expect(big.height, 15)
    expect(big.area(), 90)
    let small = r.scaled(by: 0.5)
    expect(small.width, 1)
    expect(small.height, 2.5)
}

/// scaling leaves the original alone
func testScaledDoesNotMutate() {
    let r = Rectangle(width: 2, height: 5)
    _ = r.scaled(by: 10)
    expect(r.width, 2)
    expect(r.height, 5)
    expect(r.area(), 10)
    let once = r.scaled(by: 2)
    let twice = r.scaled(by: 2)
    expect(once.width, twice.width)
}

/// squares and non-squares
func testIsSquare() {
    expect(Rectangle(width: 4, height: 4).isSquare(), true)
    expect(Rectangle(width: 4, height: 5).isSquare(), false)
    expect(Rectangle(width: 0, height: 0).isSquare(), true)
    expect(Rectangle(width: 3, height: 4).scaled(by: 2).isSquare(), false)
}
```

#### Uses
- [Structs & classes › Defining a struct](#/structs-classes/defining-a-struct)
- [Structs & classes › Initializers](#/structs-classes/initializers)

#### Hints
- Inside a method, `width` and `height` are just names; you do not need `self.`.
- `scaled(by:)` builds and returns a brand new value: `Rectangle(width: width * factor, height: height * factor)`.
- Because `scaled(by:)` returns a copy rather than changing `self`, it is not `mutating`.

#### Tips
- Swift's naming convention is a past participle for the copy-returning version (`scaled`) and an imperative for the mutating one (`scale`).
- Declare `width` before `height`. The memberwise initializer's argument order comes from declaration order, so swapping them breaks every test at once.

#### Docs
- [Structures and classes](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/classesandstructures/)

### 2. A mutating counter

`Tally` counts things, starting at zero.

- `count` is a stored property, starting at 0, so `Tally()` works with no arguments.
- `mutating func bump()` adds one.
- `mutating func add(_ n: Int)` adds `n`; a negative `n` is allowed and subtracts, but the count never goes below zero.
- `mutating func reset()` sets the count back to 0.
- `func doubled() -> Int` returns twice the count without changing anything.

Copying a `Tally` must give an independent count.

```swift starter
struct Tally {
    var count = 0

    mutating func bump() {
    }

    mutating func add(_ n: Int) {
        count += n
    }

    mutating func reset() {
        count = 0
    }

    func doubled() -> Int {
        return count
    }
}
```

```swift test
/// bump counts up from zero
func testBump() {
    var t = Tally()
    expect(t.count, 0)
    t.bump()
    expect(t.count, 1)
    t.bump()
    t.bump()
    expect(t.count, 3)
}

/// add moves by any amount, and stops at zero
func testAdd() {
    var t = Tally()
    t.add(10)
    expect(t.count, 10)
    t.add(-3)
    expect(t.count, 7)
    t.add(0)
    expect(t.count, 7)
    t.add(-100)
    expect(t.count, 0)
    t.add(-1)
    expect(t.count, 0)
}

/// reset and doubled
func testResetAndDoubled() {
    var t = Tally()
    t.add(6)
    expect(t.doubled(), 12)
    expect(t.count, 6)
    t.reset()
    expect(t.count, 0)
    expect(t.doubled(), 0)
    t.bump()
    expect(t.doubled(), 2)
}

/// a copy has its own count
func testCopyIsIndependent() {
    var original = Tally()
    original.add(5)
    var copy = original
    copy.bump()
    copy.bump()
    expect(copy.count, 7)
    expect(original.count, 5)
    original.reset()
    expect(copy.count, 7)
}

/// passing one to a function cannot change it
func testPassingCopies() {
    func consume(_ t: Tally) -> Int {
        var local = t
        local.add(1000)
        return local.count
    }
    var t = Tally()
    t.add(2)
    expect(consume(t), 1002)
    expect(t.count, 2)
}
```

#### Uses
- [Structs & classes › Mutating methods](#/structs-classes/mutating-methods)
- [Structs & classes › Value semantics: structs are copied](#/structs-classes/value-semantics-structs-are-copied)

#### Hints
- `bump()` can call `add(1)` rather than repeating the clamp.
- Clamping to zero is `count = max(0, count + n)`.
- `doubled()` reads but never writes, so leaving off `mutating` is correct — and marking it `mutating` would stop it being callable on a constant.

#### Tips
- The copy test is the whole reason to use a struct here. No caller can hand your `Tally` to something that quietly changes it.
- Clamp after adding: `max(0, count + n)`. Clamping `n` first would refuse to subtract at all.

#### Docs
- [Mutating methods](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/methods/#Modifying-Value-Types-from-Within-Instance-Methods)

### 3. A shared account

`Account` is a `class`, because a bank account has an identity and everyone holding it should see the same balance.

- `init(owner:balance:)` in that order, with `balance` defaulting to 0.
- `owner` is a constant `String`; `balance` is a `var Int`.
- `deposit(_:)` adds to the balance. A zero or negative amount does nothing.
- `withdraw(_:)` returns `true` and subtracts when the amount is positive and the balance covers it, and returns `false` and changes nothing otherwise.
- `transfer(_ amount: Int, to other: Account)` moves money and returns whether it happened; transferring to the same object must change nothing and return `false`.

```swift starter
class Account {
    let owner: String
    var balance: Int

    init(owner: String, balance: Int = 0) {
        self.owner = owner
        self.balance = balance
    }

    func deposit(_ amount: Int) {
        balance += amount
    }

    func withdraw(_ amount: Int) -> Bool {
        balance -= amount
        return true
    }

    func transfer(_ amount: Int, to other: Account) -> Bool {
        other.balance += amount
        return true
    }
}
```

```swift test
/// deposits add up, and rubbish amounts are ignored
func testDeposit() {
    let a = Account(owner: "Ada")
    expect(a.balance, 0)
    a.deposit(100)
    a.deposit(50)
    expect(a.balance, 150)
    a.deposit(0)
    a.deposit(-40)
    expect(a.balance, 150)
}

/// withdrawing only works when the money is there
func testWithdraw() {
    let a = Account(owner: "Ada", balance: 100)
    expect(a.withdraw(30), true)
    expect(a.balance, 70)
    expect(a.withdraw(70), true)
    expect(a.balance, 0)
    expect(a.withdraw(1), false)
    expect(a.balance, 0)
    expect(a.withdraw(-5), false)
    expect(a.withdraw(0), false)
    expect(a.balance, 0)
}

/// two names for one account see the same money
func testSharedReference() {
    let mine = Account(owner: "Ada", balance: 10)
    let alias = mine
    alias.deposit(90)
    expect(mine.balance, 100)
    _ = mine.withdraw(60)
    expect(alias.balance, 40)
    expect(mine === alias, true)

    let other = Account(owner: "Ada", balance: 40)
    expect(mine === other, false)
    other.deposit(5)
    expect(mine.balance, 40)
}

/// transfers move money between two accounts
func testTransfer() {
    let a = Account(owner: "Ada", balance: 100)
    let b = Account(owner: "Alan", balance: 5)
    expect(a.transfer(40, to: b), true)
    expect(a.balance, 60)
    expect(b.balance, 45)
    expect(a.transfer(1000, to: b), false)
    expect(a.balance, 60)
    expect(b.balance, 45)
    expect(a.transfer(-10, to: b), false)
    expect(a.balance, 60)
    expect(b.balance, 45)
}

/// transferring to the same object is refused
func testSelfTransfer() {
    let a = Account(owner: "Ada", balance: 100)
    let alias = a
    expect(a.transfer(10, to: alias), false)
    expect(a.balance, 100)
    expect(alias.balance, 100)
}
```

#### Uses
- [Structs & classes › Classes are references](#/structs-classes/classes-are-references)
- [Structs & classes › Identity vs equality](#/structs-classes/identity-vs-equality)

#### Hints
- `withdraw` should check `amount > 0 && amount <= balance` before touching the balance.
- `transfer` is a withdrawal followed by a deposit — reuse `withdraw` and let it do the checking.
- Refuse the self-transfer with `other === self`, which compares identity, not balances.

#### Tips
- Without the `===` guard, a transfer to the same account would subtract and then add — harmless here, but the same shape of bug loses money in a real ledger.
- `withdraw(0)` is `false`. "The balance covers it" is not the whole rule; the amount has to be positive too.

#### Docs
- [Identity operators](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/classesandstructures/#Identity-Operators)

### 4. A ledger of values

The two halves together: a `Ledger` class that owns a list of `Entry` structs.

`Entry` has `var label: String` and `var amount: Int`, in that order, and conforms to `Equatable`.

`Ledger` starts empty and has:

- `add(_ entry: Entry)`.
- `total()`, the sum of every amount, and 0 when empty.
- `entries()`, the entries in the order they were added. Because they are values, the array it returns is a copy — changing it must not change the ledger.
- `entry(labelled:) -> Entry?`, the first entry with that label, or `nil`.
- `largest() -> Entry?`, the entry with the biggest amount, or `nil` when empty. On a tie, the one added first wins.

```swift starter
struct Entry: Equatable {
    var label: String
    var amount: Int
}

class Ledger {
    private var items: [Entry] = []

    func add(_ entry: Entry) {
        items.append(entry)
    }

    func total() -> Int {
        return 0
    }

    func entries() -> [Entry] {
        return items
    }

    func entry(labelled label: String) -> Entry? {
        return items.first
    }

    func largest() -> Entry? {
        return items.first
    }
}
```

```swift test
/// totals and order
func testTotalAndOrder() {
    let l = Ledger()
    expect(l.total(), 0)
    expect(l.entries(), [])
    l.add(Entry(label: "rent", amount: -800))
    l.add(Entry(label: "pay", amount: 2000))
    l.add(Entry(label: "food", amount: -120))
    expect(l.total(), 1080)
    expect(l.entries().map { $0.label }, ["rent", "pay", "food"])
    expect(l.entries().count, 3)
}

/// the returned array is a copy
func testEntriesAreACopy() {
    let l = Ledger()
    l.add(Entry(label: "a", amount: 1))
    l.add(Entry(label: "b", amount: 2))
    var snapshot = l.entries()
    snapshot[0].amount = 999
    snapshot.append(Entry(label: "c", amount: 3))
    expect(l.total(), 3)
    expect(l.entries().count, 2)
    expect(l.entries()[0], Entry(label: "a", amount: 1))
}

/// looking an entry up by label
func testLookup() {
    let l = Ledger()
    l.add(Entry(label: "a", amount: 1))
    l.add(Entry(label: "b", amount: 2))
    l.add(Entry(label: "a", amount: 30))
    expect(l.entry(labelled: "b"), Entry(label: "b", amount: 2))
    expect(l.entry(labelled: "a"), Entry(label: "a", amount: 1))
    expect(l.entry(labelled: "zzz"), nil)
    expect(Ledger().entry(labelled: "a"), nil)
}

/// the largest entry, first one on a tie
func testLargest() {
    expect(Ledger().largest(), nil)
    let l = Ledger()
    l.add(Entry(label: "small", amount: -5))
    expect(l.largest(), Entry(label: "small", amount: -5))
    l.add(Entry(label: "big", amount: 9))
    l.add(Entry(label: "mid", amount: 3))
    expect(l.largest(), Entry(label: "big", amount: 9))
    l.add(Entry(label: "tie", amount: 9))
    expect(l.largest(), Entry(label: "big", amount: 9))
}

/// two names for one ledger share its entries
func testLedgerIsShared() {
    let l = Ledger()
    let same = l
    l.add(Entry(label: "a", amount: 10))
    same.add(Entry(label: "b", amount: 5))
    expect(l.total(), 15)
    expect(same.total(), 15)
    expect(l.entries().count, 2)

    let separate = Ledger()
    separate.add(Entry(label: "c", amount: 100))
    expect(l.total(), 15)
    expect(separate.total(), 100)
}
```

#### Uses
- [Structs & classes › Value semantics: structs are copied](#/structs-classes/value-semantics-structs-are-copied)
- [Structs & classes › Classes are references](#/structs-classes/classes-are-references)
- [Structs & classes › Which one to use](#/structs-classes/which-one-to-use)
- [Reference › Sequence and Collection methods](#/reference/sequence-and-collection-methods)

#### Hints
- `total()` is `items.reduce(0) { $0 + $1.amount }`.
- `entries()` can return `items` directly: returning an array of values already hands back a copy, which is exactly what the test checks.
- `items.first(where:)` gives the first match as an `Entry?` without a loop.
- `largest()` can be a loop keeping the best so far, replacing it only on a strict `>` so that a tie leaves the earlier entry in place.

#### Tips
- The mix is the normal shape of a Swift program: a small number of reference types holding a large number of value types.
- `items` is `private`, so `entries()` is the only way out — and because `[Entry]` is a value type, returning it is already a copy. There is no defensive copying to write.

#### Docs
- [Array.first(where:)](https://developer.apple.com/documentation/swift/sequence/first(where:))
