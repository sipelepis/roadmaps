# Classes

TypeScript classes are JavaScript classes with type annotations and a few extra keywords. Structural typing still applies: a class type is just its instance shape, so an object literal with the same members is assignable to it.

## Fields and constructors

```ts
class Counter {
  count = 0                 // field with inferred type number
  readonly name: string     // must be assigned in the constructor

  constructor(name: string) {
    this.name = name
  }

  increment(): this {       // return `this` for chaining
    this.count++
    return this
  }
}
```

With `strictPropertyInitialization`, every non-optional field must be initialised inline or in the constructor.

## Parameter properties

Declaring the field in the constructor signature saves the boilerplate:

```ts
class Point {
  constructor(public readonly x: number, public readonly y: number) {}
}
```

## Visibility

- `public` (default): accessible everywhere.
- `protected`: this class and subclasses.
- `private`: this class only, *checked at compile time* and erased.
- `#field`: JavaScript private fields, enforced at runtime too.

```ts
class Account {
  #balance = 0
  private id = crypto.randomUUID()

  deposit(n: number) { this.#balance += n }
  get balance() { return this.#balance }   // getter: read-only from outside
}
```

## Inheritance and `abstract`

```ts
abstract class Shape {
  constructor(public readonly name: string) {}
  abstract area(): number                 // subclasses must implement
  describe() { return `${this.name} with area ${this.area()}` }
}

class Circle extends Shape {
  constructor(private radius: number) { super('circle') }
  area() { return Math.PI * this.radius ** 2 }
}
```

An abstract class can't be instantiated. `super()` must be called before touching `this`.

## `implements`

A class can promise to satisfy an interface. It's a check, not inheritance; nothing is copied.

```ts
interface Serializable { toJSON(): string }

class User implements Serializable {
  constructor(public name: string) {}
  toJSON() { return JSON.stringify({ name: this.name }) }
}
```

## Static members and generics

```ts
class Registry<T> {
  private static count = 0
  private items: T[] = []
  add(item: T) { this.items.push(item); Registry.count++ }
}
```

## Classes vs plain objects

Reach for a class when you have state *and* behaviour that belong together, or need `instanceof`. For plain data, a `type` and functions are lighter and serialise better.

```ts playground
class Stopwatch {
  #elapsed = 0
  #laps: number[] = []

  tick(ms: number): this {
    this.#elapsed += ms
    return this
  }

  lap(): this {
    this.#laps.push(this.#elapsed)
    return this
  }

  get laps(): readonly number[] { return this.#laps }
}

const w = new Stopwatch().tick(120).lap().tick(80).lap()
console.log(w.laps)

// Try: w.#elapsed = 0
```

## Exercises

### 1. Chainable counter

Implement `Counter` with a *private* `count` field starting at `0`, an `increment()` method that returns `this` so calls can be chained, and a read-only `value` getter.

```ts starter
class Counter {
  // ...
}
```

```ts test
test('increments and chains', () => {
  expect(new Counter().increment().increment().value).toBe(2)
  expect(new Counter().increment().increment().increment().value).toBe(3)
})
test('starts at zero', () => {
  expect(new Counter().value).toBe(0)
})
test('increment returns the same counter', () => {
  const c = new Counter()
  expect(c.increment()).toBe(c)
  c.increment()
  expect(c.value).toBe(2)
})
test('each counter keeps its own count', () => {
  const a = new Counter()
  const b = new Counter()
  a.increment().increment().increment()
  b.increment()
  expect(a.value).toBe(3)
  expect(b.value).toBe(1)
})

function neverCalled() {
  // @ts-expect-error count must not be public
  new Counter().count
  // @ts-expect-error value is read-only
  new Counter().value = 5
}
```

#### Uses
- [Classes › Visibility](#/classes/visibility)
- [Classes › Fields and constructors](#/classes/fields-and-constructors)

#### Hints
- Declare the field with an initial value and mark it `private` (or use a `#count` field).
- `increment()` adds one to `this.count` and returns `this`. Annotate the return type as `this`, like `Counter` in the article.
- For `value`, write a getter (`get value() { … }`) and no setter, so assigning to it is a compile error.

#### Tips
- `private` is checked only at compile time. A `#count` field is private at runtime too.
- Annotate `increment(): this`, not `: Counter`. `this` is what keeps chaining working in a subclass, and it is what makes `expect(c.increment()).toBe(c)` type-check as well as pass.
- A getter with no setter is read-only to the outside, which is exactly what the `@ts-expect-error` on `value = 5` checks. Adding `set value(...)` would break that assertion.

#### Docs
- [Classes: Getters / Setters](https://www.typescriptlang.org/docs/handbook/2/classes.html#getters--setters)
- [Classes: this Types](https://www.typescriptlang.org/docs/handbook/2/classes.html#this-types)

### 2. Abstract shapes

`Shape` is abstract with a `name` and an abstract `area()`. Implement `Rect extends Shape` (name `'rect'`, constructed with width and height) so the inherited `describe()` works.

```ts starter
abstract class Shape {
  constructor(public readonly name: string) {}
  abstract area(): number
  describe(): string {
    return `${this.name} with area ${this.area()}`
  }
}

// class Rect extends Shape { ... }
```

```ts test
test('computes area', () => {
  expect(new Rect(2, 3).area()).toBe(6)
  expect(new Rect(4, 5).area()).toBe(20)
})
test('inherits describe', () => {
  expect(new Rect(2, 3).describe()).toBe('rect with area 6')
  expect(new Rect(10, 0.5).describe()).toBe('rect with area 5')
})
test('is a Shape named rect', () => {
  expect(new Rect(2, 3) instanceof Shape).toBe(true)
  expect(new Rect(7, 1).name).toBe('rect')
})

function neverCalled() {
  // @ts-expect-error cannot instantiate an abstract class
  new Shape('x')
}
```

#### Uses
- [Classes › Inheritance and `abstract`](#/classes/inheritance-and-abstract)
- [Classes › Parameter properties](#/classes/parameter-properties)

#### Hints
- `class Rect extends Shape`. Its constructor takes a width and a height and must call `super('rect')` before anything else.
- Parameter properties (`private width: number` in the constructor) store the arguments as fields in one step.
- Implement `area()`. `describe()` is inherited, so don't write it.

#### Tips
- Leave out `area()` and the compiler reports that `Rect` doesn't implement the abstract member. That's what `abstract` is for.
- `super('rect')` has to come before any use of `this`, including the parameter properties the constructor declares. Put it on the first line and the ordering never bites you.
- `abstract` only blocks `new Shape(...)`. `Rect extends Shape` still satisfies `instanceof Shape`, which the third test checks.

#### Docs
- [Classes: abstract Classes and Members](https://www.typescriptlang.org/docs/handbook/2/classes.html#abstract-classes-and-members)

### 3. Implement an interface

Make `Queue<T>` implement `Container<T>`. `size` is a getter for the number of stored items; `dequeue` returns the oldest item or `undefined`.

`Queue<T>` is generic, like `Registry<T>` in the article: `T` stands for whatever item type the caller picks (`new Queue<string>()`), and inside the class you use `T` like any other type, for example `items: T[]`. The Generics module covers this properly.

```ts starter
interface Container<T> {
  enqueue(item: T): void
  dequeue(): T | undefined
  readonly size: number
}

class Queue<T> {
  // ...
}
```

```ts test
test('is first-in first-out', () => {
  const q: Container<string> = new Queue<string>()
  q.enqueue('a')
  q.enqueue('b')
  expect(q.size).toBe(2)
  expect(q.dequeue()).toBe('a')
  expect(q.dequeue()).toBe('b')
  expect(q.dequeue()).toBe(undefined)
})
test('size follows enqueue and dequeue', () => {
  const q: Container<number> = new Queue<number>()
  expect(q.size).toBe(0)
  q.enqueue(1)
  q.enqueue(2)
  q.enqueue(3)
  q.dequeue()
  expect(q.size).toBe(2)
  q.dequeue()
  q.dequeue()
  q.dequeue()
  expect(q.size).toBe(0)
})
test('mixes enqueue and dequeue', () => {
  const q: Container<number> = new Queue<number>()
  q.enqueue(1)
  q.enqueue(2)
  expect(q.dequeue()).toBe(1)
  q.enqueue(3)
  expect(q.dequeue()).toBe(2)
  expect(q.dequeue()).toBe(3)
})

function neverCalled() {
  // @ts-expect-error size is a getter, so it can't be assigned
  new Queue<string>().size = 3
}
```

#### Uses
- [Classes › `implements`](#/classes/implements)
- [Classes › Static members and generics](#/classes/static-members-and-generics)
- [Classes › Visibility](#/classes/visibility)

#### Hints
- Add `implements Container<T>` after the class name. The compiler then lists every member you still owe.
- Keep the items in a private `T[]` field. `push` adds to the end, and `shift` removes from the front and returns `undefined` when the array is empty.
- `size` can be a getter: `get size() { … }` satisfies the interface's `readonly size`.

#### Tips
- `implements` only checks. You still write every member yourself; nothing is inherited.
- `shift()` returns `T | undefined` on an empty array, which is exactly what `dequeue` promises, so you can return it straight through with no check.
- `shift` is O(n): it reindexes the whole array. Fine for an exercise; a real queue keeps a head index or a linked list.
- Declaring the field as `private items: T[] = []` is enough. An `implements` clause never adds members, so a missing `items` shows up as a normal "property does not exist" error.

#### Docs
- [Classes: implements Clauses](https://www.typescriptlang.org/docs/handbook/2/classes.html#implements-clauses)
