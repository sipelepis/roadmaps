# Closures

A closure is a block of code you can pass around like a value, and which remembers the variables it was written next to. Functions are closures with a name; everything in this module applies to both. Closures are how Swift does callbacks, sorting rules, lazy work and most of its collection API.

## Closure expressions

A closure expression is written in braces, with the parameters and return type inside, before the keyword `in`:

```swift
let double = { (n: Int) -> Int in
    return n * 2
}
double(21)          // 42
```

The type of `double` is `(Int) -> Int`: a function taking one `Int` and returning one. Function types are ordinary types, so they can be the type of a variable, a parameter, or a return value:

```swift
var operation: (Int, Int) -> Int = { a, b in a + b }
operation = { a, b in a * b }
```

## Letting the compiler do the work

Swift shortens closures aggressively, one step at a time. When the expected type is known, the parameter and return types are inferred. A single-expression body returns its value without `return`. And the parameters can be left out entirely, referred to as `$0`, `$1`, and so on:

```swift
let names = ["Grace", "Ada", "Alan"]

names.sorted(by: { (a: String, b: String) -> Bool in return a < b })
names.sorted(by: { a, b in a < b })
names.sorted(by: { $0 < $1 })
names.sorted(by: <)          // an operator is just a function
```

All four sort the same way. Use as much shorthand as still reads clearly: `$0` is fine for one short line, and named parameters are better once the body grows.

## Trailing closures

When the last argument is a closure, it can move outside the parentheses. If it is the only argument, the parentheses disappear too:

```swift
names.sorted { $0.count < $1.count }

let total = (1...10).reduce(0) { running, n in running + n }
```

That is why so much Swift looks like it has custom keywords: `map { }`, `filter { }`, `forEach { }` are all ordinary functions taking a trailing closure.

## Capturing values

A closure keeps access to the variables in scope where it was written, even after that scope has returned. It captures them by reference, not by copying their value at that moment:

```swift
func makeCounter() -> () -> Int {
    var count = 0
    return {
        count += 1
        return count
    }
}

let next = makeCounter()
next()      // 1
next()      // 2
```

`count` is a local variable of `makeCounter`, but the returned closure still reads and writes it after `makeCounter` has returned. Swift keeps it alive for as long as the closure does. Each call to `makeCounter` makes a fresh `count`, so two counters never interfere.

Because the capture is by reference, later changes are visible:

```swift
var greeting = "Hello"
let say = { print(greeting) }
greeting = "Goodbye"
say()               // Goodbye, not Hello
```

To capture the current value instead, use a capture list: `{ [greeting] in print(greeting) }` copies `greeting` when the closure is created.

This is where value semantics catch people out. A capture list on a struct or an array takes a *copy* at the moment the closure is made, so later changes to the original are invisible inside it — and writes inside the closure never reach the original. Without the capture list, the closure shares the variable and sees everything:

```swift
var items = [1]
let shared = { items.count }
let frozen = { [items] in items.count }
items.append(2)
shared()        // 2 — the same variable
frozen()        // 1 — a copy taken when the closure was written
```

A closure that captures `self` in a class captures the reference, so it does see later changes — and keeps the object alive. The ARC module is about the consequences of that.

## Closures are reference types

Assigning a closure to a second variable does not copy it. Both names refer to the same closure, sharing the same captured state:

```swift
let a = makeCounter()
let b = a           // the same counter, not a second one
a()                 // 1
b()                 // 2
```

This is the opposite of a struct, which is copied. It matters whenever a closure holds mutable state.

## Escaping closures

A closure passed to a function is assumed to be called before that function returns. If the function instead stores it or returns it, the closure *escapes*, and the parameter must say so with `@escaping`:

```swift
var pending: [() -> Void] = []

func later(_ work: @escaping () -> Void) {
    pending.append(work)
}

func now(_ work: () -> Void) {
    work()
}
```

The compiler enforces this: storing a non-`@escaping` closure is an error. Closures inside an array or an optional are always escaping, so `[(Int) -> Int]` needs no annotation.

## Functions are values too

A named function can be used anywhere a closure is expected, by writing its name without calling it:

```swift
func isShort(_ s: String) -> Bool { s.count < 4 }

names.filter(isShort)                       // ["Ada"]
let check: (String) -> Bool = isShort
```

This works in reverse as well: a function that takes `(Int) -> Int` accepts a closure literal, a stored closure, or another function's name without knowing the difference.

```swift playground
let numbers = [8, 3, 11, 5, 1]

// The same sort, written four ways.
print(numbers.sorted(by: { (a: Int, b: Int) -> Bool in return a < b }))
print(numbers.sorted(by: { a, b in a < b }))
print(numbers.sorted { $0 < $1 })
print(numbers.sorted(by: <))

// A closure stored in a constant, then used as an argument.
let describe: (Int) -> String = { $0 % 2 == 0 ? "\($0) even" : "\($0) odd" }
print(numbers.map(describe).joined(separator: ", "))

// Captured state: each counter has its own.
func makeCounter() -> () -> Int {
    var count = 0
    return {
        count += 1
        return count
    }
}
let first = makeCounter()
let second = makeCounter()
print("first: \(first()) \(first()) \(first())   second: \(second())")

// Capture is by reference, unless a capture list copies the value.
var label = "before"
let live = { label }
let frozen = { [label] in label }
label = "after"
print("\(live()) vs \(frozen())")

// Try: change `sorted { $0 < $1 }` to sort by distance from 6.
```

## Exercises

### 1. Passing and returning functions

Two small functions that treat code as data.

- `applyTwice(f, to: value)` returns `f(f(value))`.
- `makeAdder(n)` returns a closure that adds `n` to whatever it is given.

```swift starter
func applyTwice(_ f: (Int) -> Int, to value: Int) -> Int {
    return value
}

func makeAdder(_ n: Int) -> (Int) -> Int {
    return { $0 }
}
```

```swift test
/// applies the function twice
func testApplyTwice() {
    expect(applyTwice({ $0 + 3 }, to: 0), 6)
    expect(applyTwice({ $0 * $0 }, to: 3), 81)
    expect(applyTwice({ $0 - 1 }, to: 10), 8)
}

/// the two calls really are nested, not added
func testNested() {
    expect(applyTwice({ $0 * 2 + 1 }, to: 1), 7)
    expect(applyTwice({ _ in 5 }, to: 99), 5)
    expect(applyTwice({ $0 }, to: -4), -4)
}

/// an adder adds the number it was made with
func testAdder() {
    let add5 = makeAdder(5)
    expect(add5(1), 6)
    expect(add5(-5), 0)
    expect(makeAdder(0)(7), 7)
    expect(makeAdder(-3)(10), 7)
}

/// each adder keeps its own number
func testAddersIndependent() {
    let add2 = makeAdder(2)
    let add100 = makeAdder(100)
    expect(add2(0), 2)
    expect(add100(0), 100)
    expect(add2(1), 3)
    expect(add100(1), 101)
}

/// one fits inside the other
func testTogether() {
    expect(applyTwice(makeAdder(4), to: 2), 10)
    expect(applyTwice(makeAdder(-1), to: 0), -2)
}
```

#### Uses
- [Closures › Closure expressions](#/closures/closure-expressions)
- [Closures › Capturing values](#/closures/capturing-values)

#### Hints
- `applyTwice` is one expression: call `f` on `value`, then call `f` on that.
- `makeAdder` returns a closure literal. Inside it, `n` is still in scope because the closure captured it.
- The returned closure can be as short as `{ $0 + n }`.

#### Tips
- `makeAdder(4)` has type `(Int) -> Int`, exactly what `applyTwice` wants for `f`, so they compose without any adapter.
- `applyTwice({ _ in 5 }, to: 99)` is 5, not 99: the second call ignores the first's result too. That test catches an `f(value)` that forgot to nest.

#### Docs
- [Closures](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/closures/)

### 2. Counters that remember

- `makeCounter()` returns a closure that returns 1 the first time it is called, then 2, then 3, and so on.
- `makeStepper(from: start, by: step)` returns a closure that returns `start` the first time, then `start + step`, then `start + 2 * step`. A `step` of 0 keeps returning `start`.

Two counters made by separate calls must not share a count.

```swift starter
func makeCounter() -> () -> Int {
    return { 0 }
}

func makeStepper(from start: Int, by step: Int) -> () -> Int {
    return { start }
}
```

```swift test
/// counts up from 1
func testCountsUp() {
    let c = makeCounter()
    expect(c(), 1)
    expect(c(), 2)
    expect(c(), 3)
    for _ in 0..<6 { _ = c() }
    expect(c(), 10)
}

/// counters do not share a count
func testCountersIndependent() {
    let a = makeCounter()
    let b = makeCounter()
    _ = a()
    _ = a()
    expect(b(), 1)
    expect(a(), 3)
    expect(b(), 2)
}

/// the stepper starts at start and adds step
func testStepper() {
    let s = makeStepper(from: 10, by: 5)
    expect(s(), 10)
    expect(s(), 15)
    expect(s(), 20)

    let down = makeStepper(from: 0, by: -2)
    expect(down(), 0)
    expect(down(), -2)
    expect(down(), -4)
}

/// a step of zero repeats the start
func testZeroStep() {
    let stuck = makeStepper(from: 7, by: 0)
    expect(stuck(), 7)
    expect(stuck(), 7)
    expect(stuck(), 7)
}

/// steppers are independent too
func testSteppersIndependent() {
    let a = makeStepper(from: 1, by: 1)
    let b = makeStepper(from: 100, by: 10)
    expect(a(), 1)
    expect(b(), 100)
    expect(a(), 2)
    expect(b(), 110)
    expect(a(), 3)
}
```

#### Uses
- [Closures › Capturing values](#/closures/capturing-values)
- [Closures › Closures are reference types](#/closures/closures-are-reference-types)

#### Hints
- Declare a `var` inside the function, before the `return`. The closure captures it and keeps it alive.
- The closure body is more than one expression, so it needs an explicit `return`.
- For the stepper, one counter variable holding the value to return next is enough: return it, then add `step` to it.

#### Tips
- Nothing outside the function can see the captured variable. A closure over a `var` is the smallest object Swift has.
- The `var` goes inside the function but outside the returned closure. Declared inside the closure it would be reinitialised on every call and the counter would always answer 1.

#### Docs
- [Capturing values](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/closures/#Capturing-Values)

### 3. Building closures out of closures

- `pipeline(steps)` returns a single closure that applies every step in array order: `pipeline([f, g])(x)` is `g(f(x))`. An empty array gives a closure that returns its input unchanged.
- `applyIf(predicate, transform)` returns a closure that applies `transform` to values satisfying `predicate` and returns every other value untouched.

```swift starter
func pipeline(_ steps: [(Int) -> Int]) -> (Int) -> Int {
    return { $0 }
}

func applyIf(_ predicate: @escaping (Int) -> Bool, _ transform: @escaping (Int) -> Int) -> (Int) -> Int {
    return { transform($0) }
}
```

```swift test
/// applies the steps in order
func testPipelineOrder() {
    let addThenDouble = pipeline([{ $0 + 1 }, { $0 * 2 }])
    expect(addThenDouble(3), 8)
    let doubleThenAdd = pipeline([{ $0 * 2 }, { $0 + 1 }])
    expect(doubleThenAdd(3), 7)
    expect(pipeline([{ $0 - 1 }, { $0 * $0 }, { $0 + 100 }])(4), 109)
}

/// one step and no steps
func testPipelineEdges() {
    expect(pipeline([{ $0 * 3 }])(5), 15)
    expect(pipeline([])(5), 5)
    expect(pipeline([])(-1), -1)
    expect(pipeline([])(0), 0)
}

/// the same pipeline can be reused
func testPipelineReusable() {
    let p = pipeline([{ $0 + 10 }, { $0 * 2 }])
    expect(p(0), 20)
    expect(p(1), 22)
    expect(p(-10), 0)
}

/// applyIf transforms only what matches
func testApplyIf() {
    let doubleEvens = applyIf({ $0 % 2 == 0 }, { $0 * 2 })
    expect(doubleEvens(4), 8)
    expect(doubleEvens(3), 3)
    expect(doubleEvens(0), 0)
    expect(doubleEvens(-7), -7)
}

/// a predicate that never matches leaves everything alone
func testApplyIfNeverMatches() {
    let never = applyIf({ _ in false }, { _ in 999 })
    expect(never(1), 1)
    expect(never(-5), -5)
    let always = applyIf({ _ in true }, { $0 + 1 })
    expect(always(1), 2)
    expect(always(-5), -4)
}

/// the two combine
func testCombined() {
    let p = pipeline([applyIf({ $0 > 0 }, { $0 * 10 }), { $0 + 1 }])
    expect(p(2), 21)
    expect(p(-2), -1)
    expect(p(0), 1)
}
```

#### Uses
- [Closures › Closure expressions](#/closures/closure-expressions)
- [Closures › Capturing values](#/closures/capturing-values)
- [Closures › Escaping closures](#/closures/escaping-closures)
- [Reference › Sequence and Collection methods](#/reference/sequence-and-collection-methods)

#### Hints
- `pipeline` returns `{ value in ... }`. Inside, walk `steps` and feed each result into the next one.
- A `for` loop over `steps` with a `var result = value` is the plain version; `steps.reduce(value) { $1($0) }` is the short one.
- `applyIf` returns a closure whose body is a single conditional expression: `predicate($0) ? transform($0) : $0`.
- `steps` needs no `@escaping`: closures inside an array already are.

#### Tips
- `pipeline([])` returning its input is not a special case if you start from the input and apply nothing.
- `pipeline([f, g])(x)` is `g(f(x))`, not `f(g(x))`. Array order and function-composition order run in opposite directions, and the first two tests tell them apart.
- `applyIf` is one conditional expression: `predicate($0) ? transform($0) : $0`. There is no branch to write.

#### Docs
- [Escaping closures](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/closures/#Escaping-Closures)

### 4. Memoize

`memoize(f)` returns a closure that behaves exactly like `f`, but calls `f` at most once for each distinct input and returns a remembered answer after that. Zero and negative inputs are cached like any other. Two memoized functions must not share a cache.

```swift starter
func memoize(_ f: @escaping (Int) -> Int) -> (Int) -> Int {
    return { n in f(n) }
}
```

```swift test
/// gives the same answers as the original
func testSameAnswers() {
    let square = memoize { $0 * $0 }
    expect(square(4), 16)
    expect(square(0), 0)
    expect(square(-3), 9)
    expect(square(4), 16)
    expect(square(-3), 9)
}

/// calls the original once per distinct input
func testCachesRepeats() {
    var calls = 0
    let f = memoize { (n: Int) -> Int in calls += 1; return n + 1 }
    expect(f(1), 2)
    expect(f(1), 2)
    expect(f(1), 2)
    expect(calls, 1)
    expect(f(2), 3)
    expect(calls, 2)
    expect(f(1), 2)
    expect(calls, 2)
}

/// zero and negative inputs are cached too
func testZeroAndNegative() {
    var calls = 0
    let f = memoize { (n: Int) -> Int in calls += 1; return n * n }
    expect(f(0), 0)
    expect(f(0), 0)
    expect(f(-5), 25)
    expect(f(-5), 25)
    expect(calls, 2)
}

/// each memoized function has its own cache
func testSeparateCaches() {
    var aCalls = 0
    var bCalls = 0
    let a = memoize { (n: Int) -> Int in aCalls += 1; return n * 10 }
    let b = memoize { (n: Int) -> Int in bCalls += 1; return n * 100 }
    expect(a(3), 30)
    expect(b(3), 300)
    expect(a(3), 30)
    expect(b(3), 300)
    expect(aCalls, 1)
    expect(bCalls, 1)
}
```

#### Uses
- [Closures › Capturing values](#/closures/capturing-values)
- [Closures › Closures are reference types](#/closures/closures-are-reference-types)
- [Closures › Escaping closures](#/closures/escaping-closures)

#### Hints
- The cache is a `var cache: [Int: Int] = [:]` declared in `memoize`, captured by the returned closure.
- `cache[n]` is an `Optional<Int>`: `if let hit = cache[n] { return hit }` covers the cached case.
- Otherwise compute `f(n)`, store it under `n`, and return it.
- `f` is stored inside the returned closure, which outlives `memoize`, which is why it is `@escaping`.

#### Tips
- The cache belongs to the returned closure, not to `memoize`, so two calls to `memoize` produce two independent caches without any extra work.
- The `calls` counter in the tests is itself captured by the closure they hand you. The mechanism you are implementing is the one being used to check it.

#### Docs
- [Dictionary](https://developer.apple.com/documentation/swift/dictionary)
