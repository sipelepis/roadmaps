# Objects and interfaces

Most of the types you write describe the shape of an object. TypeScript has three ways to spell that shape, and they are more alike than different.

## Object type literals

```ts
function describe(user: { name: string; age: number }) {
  return `${user.name} (${user.age})`
}
```

Fine inline, unreadable once reused. Give it a name.

## `interface` and `type`

```ts
interface User {
  id: number
  name: string
  email?: string          // optional: string | undefined
  readonly createdAt: Date // cannot be reassigned after construction
}

type Point = { x: number; y: number }
```

The two are interchangeable for object shapes. Practical differences:

| | `interface` | `type` |
| --- | --- | --- |
| Describes | objects (and call signatures) | anything: unions, primitives, tuples, mapped types |
| Extending | `interface B extends A` | `type B = A & { ... }` |
| Reopening | declarations merge (used for augmenting libraries) | no |
| Error messages | shows the name | may expand inline |

A common convention: `interface` for object shapes that might be extended, `type` for everything else. Don't agonise over it.

## Structural typing

TypeScript compares types by *shape*, not by name. Anything with the right properties is a `Point`, whether it was declared as one or not.

```ts
const p = { x: 1, y: 2, z: 3 }
const q: Point = p   // ok: p has at least x and y
```

But object *literals* get an extra check for excess properties, because a typo there is almost always a bug:

```ts
const r: Point = { x: 1, y: 2, z: 3 }  // error: 'z' does not exist in type 'Point'
```

That check only fires on a *fresh* object literal. Assign the same literal to a variable first and it passes, which is the usual explanation for "why did my typo get caught here but not there":

```ts
const s = { x: 1, y: 2, z: 3 }
const t: Point = s   // no error: s is not a fresh literal
```

Structural typing also means a type is never a guarantee of *origin*. Anything with the right shape passes, so an object that happens to have `x` and `y` is a `Point` even if it came from somewhere you never intended. When identity matters, use a class and `instanceof`, or a branded type (Advanced patterns).

## Extending

```ts
interface Animal { name: string }
interface Dog extends Animal { breed: string }

type Cat = Animal & { indoor: boolean }
```

## `readonly` is shallow, and compile-time only

`readonly` stops assignment *through that type*. It does not freeze anything, and it stops at the first level:

```ts
interface Config {
  readonly name: string
  readonly tags: string[]
}

declare const c: Config
c.name = 'x'        // error
c.tags = []         // error
c.tags.push('x')    // fine: the array itself is not readonly
```

Use `readonly string[]` for the inner array, and `Object.freeze` when you want the object to resist mutation at runtime too. Note also that a `readonly` property is still assignable to a mutable one, so handing the object to a function typed `{ name: string }` loses the protection entirely.

## Index signatures

When you don't know the keys ahead of time:

```ts
interface Counts { [word: string]: number }

const c: Counts = {}
c.hello = 1
c['world'] = 2
```

Prefer `Record<string, number>` (covered in Utility types) or a `Map` for dynamic keys; index signatures make every lookup typed as present even when it isn't.

## Methods

```ts
interface Counter {
  value: number
  increment(): void            // method shorthand
  reset: () => void            // property with a function type
}
```

```ts playground
interface Product {
  id: number
  name: string
  price: number
  tags?: string[]
}

function label(p: Product): string {
  const tags = p.tags?.length ? ` [${p.tags.join(', ')}]` : ''
  return `${p.name}: $${p.price.toFixed(2)}${tags}`
}

console.log(label({ id: 1, name: 'Keyboard', price: 79.9 }))
console.log(label({ id: 2, name: 'Mouse', price: 25, tags: ['wireless'] }))

// Try: add a `color: 'black'` property to one of the literals above.
```

## Exercises

### 1. Define `User`

Declare a `User` type (interface or alias) with a numeric `id`, a `name`, and an *optional* `email`. Then implement `contact`, which returns the email or the string `'no email'`.

```ts starter
// type User = ...

function contact(user: User): string {
  throw new Error('todo')
}
```

```ts test
const ada: User = { id: 1, name: 'Ada' }
const grace: User = { id: 2, name: 'Grace', email: 'grace@navy.mil' }
const alan: User = { id: 3, name: 'Alan', email: 'alan@bletchley.uk' }
const linus: User = { id: 4, name: 'Linus', email: undefined }

test('falls back when there is no email', () => {
  expect(contact(ada)).toBe('no email')
  expect(contact(linus)).toBe('no email')
})
test('returns the email', () => {
  expect(contact(grace)).toBe('grace@navy.mil')
  expect(contact(alan)).toBe('alan@bletchley.uk')
})

type _1 = Expect<Equal<User['id'], number>>
type _2 = Expect<Equal<User['email'], string | undefined>>
type _3 = Expect<Equal<User['name'], string>>
```

#### Uses
- [Objects and interfaces › `interface` and `type`](#/objects/interface-and-type)

#### Hints
- Declare `interface User { … }` with `id: number` and `name: string`. A `?` after a property name makes it optional.
- An optional property reads as `string | undefined`. Return `user.email` when it's set and `'no email'` otherwise. The `??` operator does that in one expression.

#### Tips
- `??` falls back only on `null` and `undefined`, while `||` would also replace an empty string.
- `email?: string` and `email: string | undefined` are not the same. The optional form lets callers leave the property out; the union form makes them write `email: undefined`. The test passes `{ id: 4, name: 'Linus', email: undefined }`, which only the optional form and the union both accept.
- The type test asserts `User['email']` is `string | undefined`. That is what `?` produces, so don't also write `| undefined` by hand.

#### Docs
- [Object Types: Optional properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#optional-properties)

### 2. Read-only point

Define `ReadonlyPoint` so that both `x` and `y` are `readonly` numbers. Then implement `distance` between two points.

```ts starter
type ReadonlyPoint = {}

function distance(a: ReadonlyPoint, b: ReadonlyPoint): number {
  throw new Error('todo')
}
```

```ts test
const origin: ReadonlyPoint = { x: 0, y: 0 }

test('computes euclidean distance', () => {
  expect(distance(origin, { x: 3, y: 4 })).toBe(5)
  expect(distance(origin, { x: 5, y: 12 })).toBe(13)
})
test('works between any two points', () => {
  expect(distance({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(5)
  expect(distance({ x: 4, y: 5 }, { x: -2, y: -3 })).toBe(10)
})
test('the same point is zero apart', () => {
  expect(distance({ x: 7, y: -2 }, { x: 7, y: -2 })).toBe(0)
  expect(distance(origin, origin)).toBe(0)
})

function neverCalled() {
  // @ts-expect-error x is readonly
  origin.x = 1
}

type _1 = Expect<Equal<ReadonlyPoint, { readonly x: number; readonly y: number }>>
```

#### Uses
- [Objects and interfaces › `interface` and `type`](#/objects/interface-and-type)
- [Objects and interfaces › Object type literals](#/objects/object-type-literals)
- [Objects and interfaces › `readonly` is shallow, and compile-time only](#/objects/readonly-is-shallow-and-compile-time-only)
- [Reference › Numbers and Math](#/reference/numbers-and-math)
- [Reference › Type-level assertions](#/reference/type-level-assertions)

#### Hints
- Fill in the type literal with `x` and `y`, both `number`, each with `readonly` in front.
- Distance is the square root of `dx² + dy²`: `Math.sqrt` of the squared differences, or `Math.hypot(dx, dy)`.

#### Tips
- `readonly` is compile-time only. It blocks assignment through this type but doesn't freeze the object at runtime.
- `Math.hypot(dx, dy)` is the whole formula in one call, and it avoids the overflow you can get from squaring large numbers yourself.
- The `neverCalled` function in the test is never run. It exists so `// @ts-expect-error` can assert that `origin.x = 1` is *rejected*; if you forget `readonly`, that line compiles and the assertion itself fails.

#### Docs
- [Object Types: readonly properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties)

### 3. Extend a shape

`Employee` must have everything `Person` has plus a `role` string. Implement `intro` to return `"<name>, <role>"`.

```ts starter
interface Person {
  name: string
  age: number
}

// interface Employee ...

function intro(e: Employee): string {
  throw new Error('todo')
}
```

```ts test
test('introduces an employee', () => {
  expect(intro({ name: 'Ada', age: 36, role: 'engineer' })).toBe('Ada, engineer')
  expect(intro({ name: 'Grace', age: 85, role: 'admiral' })).toBe('Grace, admiral')
})

type _1 = Expect<Equal<Employee['role'], string>>
type _2 = Expect<Equal<Employee['age'], number>>
type _3 = Expect<Equal<Employee['name'], string>>
```

#### Uses
- [Objects and interfaces › Extending](#/objects/extending)

#### Hints
- Declare `Employee` as an interface that `extends Person`, and list only the new property.
- `intro` is a template string built from `e.name` and `e.role`.

#### Tips
- `type Employee = Person & { role: string }` also works. `extends` reports clearer errors when properties conflict.
- `extends` also checks as you write it: redeclaring `name: number` in `Employee` is an error straight away, whereas an intersection would quietly give you `string & number`, which is `never`.
- You don't have to relist `name` and `age`. The type test asserts they are there, and they are, by inheritance.

#### Docs
- [Object Types: Extending types](https://www.typescriptlang.org/docs/handbook/2/objects.html#extending-types)
