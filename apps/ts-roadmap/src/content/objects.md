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

## Extending

```ts
interface Animal { name: string }
interface Dog extends Animal { breed: string }

type Cat = Animal & { indoor: boolean }
```

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

test('falls back when there is no email', () => {
  expect(contact(ada)).toBe('no email')
})
test('returns the email', () => {
  expect(contact(grace)).toBe('grace@navy.mil')
})

type _1 = Expect<Equal<User['id'], number>>
type _2 = Expect<Equal<User['email'], string | undefined>>
```

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
})

function neverCalled() {
  // @ts-expect-error x is readonly
  origin.x = 1
}

type _1 = Expect<Equal<ReadonlyPoint, { readonly x: number; readonly y: number }>>
```

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
})

type _1 = Expect<Equal<Employee['role'], string>>
type _2 = Expect<Equal<Employee['age'], number>>
```
