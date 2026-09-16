# Unions, literals, and intersections

A union type says a value is *one of* several types. Combined with literal types, unions replace enums, boolean flags, and a lot of defensive code.

## Union types

```ts
function pad(value: string | number, width: number): string {
  return String(value).padStart(width)
}
```

You can only use members that exist on *every* constituent until you narrow. `value.toUpperCase()` fails above because `number` has no such method. The next module is all about narrowing.

## Literal unions

```ts
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

function request(url: string, method: Method) {}

request('/api', 'GET')
request('/api', 'FETCH')  // error
```

Watch for widening: `const m = { method: 'GET' }` infers `method: string`, which is *not* assignable to `Method`. Use `as const`, annotate the object, or pass the literal directly.

## Discriminated unions

Give each object in a union a shared property with a distinct literal value. TypeScript can then tell them apart.

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.radius ** 2  // s is the circle variant here
    case 'square': return s.side ** 2
  }
}
```

This is the single most useful pattern in TypeScript. It models state machines, API responses, redux actions, and results.

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }
```

## Intersections

`A & B` is a type with *all* properties of both. Use it to combine object types.

```ts
type Timestamped = { createdAt: Date }
type Named = { name: string }
type Entity = Timestamped & Named   // { createdAt: Date; name: string }
```

Intersecting primitives that can't overlap gives `never`: `string & number` is `never`.

## `null` and `undefined` in unions

With `strictNullChecks`, `null` and `undefined` are not part of any other type. A value that might be missing is a union: `string | undefined`. This forces you to handle absence at the type level, which is where most JavaScript crashes come from.

```ts playground
type Status =
  | { state: 'loading' }
  | { state: 'success'; data: string[] }
  | { state: 'error'; message: string }

function render(s: Status): string {
  switch (s.state) {
    case 'loading': return 'Loading…'
    case 'success': return `${s.data.length} items`
    case 'error': return `Failed: ${s.message}`
  }
}

console.log(render({ state: 'loading' }))
console.log(render({ state: 'success', data: ['a', 'b'] }))
console.log(render({ state: 'error', message: 'timeout' }))

// Try: add a fourth variant to Status and watch render() complain.
```

## Exercises

### 1. Shapes

Define `Shape` as a discriminated union of a circle (`kind: 'circle'`, `radius`) and a rectangle (`kind: 'rect'`, `width`, `height`). Implement `area`.

```ts starter
// type Shape = ...

function area(shape: Shape): number {
  throw new Error('todo')
}
```

```ts test
test('circle area', () => {
  expect(area({ kind: 'circle', radius: 1 })).toBe(Math.PI)
  expect(area({ kind: 'circle', radius: 2 })).toBe(Math.PI * 4)
  expect(area({ kind: 'circle', radius: 0.5 })).toBe(Math.PI / 4)
})
test('rectangle area', () => {
  expect(area({ kind: 'rect', width: 2, height: 3 })).toBe(6)
  expect(area({ kind: 'rect', width: 4, height: 5 })).toBe(20)
  expect(area({ kind: 'rect', width: 1.5, height: 2 })).toBe(3)
})

type _1 = Expect<Equal<Shape['kind'], 'circle' | 'rect'>>
function neverCalled() {
  // @ts-expect-error a circle needs a radius
  area({ kind: 'circle' })
  // @ts-expect-error a rectangle needs a height
  area({ kind: 'rect', width: 2 })
}
```

#### Uses
- [Unions, literals, and intersections › Discriminated unions](#/unions/discriminated-unions)
- [Reference › Type-level assertions](#/reference/type-level-assertions)

#### Hints
- Write two object types joined with `|`. Each has a `kind` property with its own literal value.
- `switch (shape.kind)`. Inside each `case` TypeScript knows which variant you have, so `shape.radius` or `shape.width` is allowed.
- Circle area is `Math.PI * radius ** 2`, rectangle area `width * height`.

#### Tips
- Because the switch covers every `kind`, TypeScript knows the function always returns and doesn't ask for a trailing `return`.
- The discriminant has to be a *literal* type. `kind: string` on both variants would compile and narrow nothing.
- The two `@ts-expect-error` lines in `neverCalled` check that a variant can't be built with a missing field. They only pass while each variant really requires its own property, so don't make `radius` or `height` optional.

#### Docs
- [Narrowing: Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)

### 2. Directions

Define `Direction` as the four literal strings `'up' | 'down' | 'left' | 'right'`. Implement `move`, returning a *new* position (don't mutate) where `up` decreases `y`, `down` increases it, `left` decreases `x`, `right` increases it.

```ts starter
type Position = { x: number; y: number }
// type Direction = ...

function move(pos: Position, dir: Direction): Position {
  throw new Error('todo')
}
```

```ts test
test('moves in each direction', () => {
  expect(move({ x: 0, y: 0 }, 'up')).toEqual({ x: 0, y: -1 })
  expect(move({ x: 0, y: 0 }, 'down')).toEqual({ x: 0, y: 1 })
  expect(move({ x: 0, y: 0 }, 'left')).toEqual({ x: -1, y: 0 })
  expect(move({ x: 0, y: 0 }, 'right')).toEqual({ x: 1, y: 0 })
})
test('moves from any position', () => {
  expect(move({ x: 2, y: 5 }, 'up')).toEqual({ x: 2, y: 4 })
  expect(move({ x: 2, y: 5 }, 'down')).toEqual({ x: 2, y: 6 })
  expect(move({ x: -3, y: 7 }, 'left')).toEqual({ x: -4, y: 7 })
  expect(move({ x: -3, y: 7 }, 'right')).toEqual({ x: -2, y: 7 })
})
test('does not mutate', () => {
  const start = { x: 5, y: 5 }
  move(start, 'up')
  move(start, 'down')
  move(start, 'left')
  move(start, 'right')
  expect(start).toEqual({ x: 5, y: 5 })
})

type _1 = Expect<Equal<Direction, 'up' | 'down' | 'left' | 'right'>>
function neverCalled() {
  // @ts-expect-error not a direction
  move({ x: 0, y: 0 }, 'north')
}
```

#### Uses
- [Unions, literals, and intersections › Literal unions](#/unions/literal-unions)
- [Unions, literals, and intersections › Discriminated unions](#/unions/discriminated-unions)

#### Hints
- Join the four string literals with `|` in a `type` alias.
- `switch (dir)` with one `case` per direction. Each returns a fresh object literal built from `pos.x` and `pos.y`.

#### Tips
- `{ ...pos, y: pos.y - 1 }` copies the object and overrides one property, which scales better than retyping every field.
- `toEqual` compares the serialised object, so returning the *same* object with mutated fields would pass the first two tests and fail the third. Build a new one.
- A `switch` beats a chain of `if`s here: once every direction has a case, adding a fifth to `Direction` makes the compiler complain that the function can return `undefined`.

#### Docs
- [Everyday Types: Literal types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types)

### 3. Combine shapes with an intersection

Using `&`, define `Audited` as `Post` plus `Timestamps`. Implement `summary` returning `"<title> by <author> (<createdAt>)"`.

```ts starter
type Post = { title: string; author: string }
type Timestamps = { createdAt: string; updatedAt: string }
// type Audited = ...

function summary(p: Audited): string {
  throw new Error('todo')
}
```

```ts test
test('summarises', () => {
  expect(summary({ title: 'Hi', author: 'Ada', createdAt: '2024-01-01', updatedAt: '2024-01-02' })).toBe('Hi by Ada (2024-01-01)')
  expect(summary({ title: 'Notes', author: 'Grace', createdAt: '2023-06-15', updatedAt: '2024-03-09' })).toBe('Notes by Grace (2023-06-15)')
})

type _1 = Expect<Equal<keyof Audited, 'title' | 'author' | 'createdAt' | 'updatedAt'>>
type _2 = Expect<Equal<Audited, Post & Timestamps>>
```

#### Uses
- [Unions, literals, and intersections › Intersections](#/unions/intersections)

#### Hints
- Join the two existing types with `&`. The result has every property of both.
- `summary` is a template string using `p.title`, `p.author` and `p.createdAt`.

#### Tips
- `|` would mean *either* shape, and then you could only read properties they share. `&` means both.
- `keyof (A & B)` is `keyof A | keyof B`: intersecting the objects unions their keys. That is what the first type test checks.
- Intersections are not merges. If both sides declared `title` with different types, you'd get `string & number`, which is `never`, and the error would only surface when someone tried to build the value.

#### Docs
- [Object Types: Intersection types](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types)
