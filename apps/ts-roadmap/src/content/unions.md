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
})
test('rectangle area', () => {
  expect(area({ kind: 'rect', width: 2, height: 3 })).toBe(6)
})

type _1 = Expect<Equal<Shape['kind'], 'circle' | 'rect'>>
```

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
test('does not mutate', () => {
  const start = { x: 5, y: 5 }
  move(start, 'up')
  expect(start).toEqual({ x: 5, y: 5 })
})

type _1 = Expect<Equal<Direction, 'up' | 'down' | 'left' | 'right'>>
function neverCalled() {
  // @ts-expect-error not a direction
  move({ x: 0, y: 0 }, 'north')
}
```

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
})

type _1 = Expect<Equal<keyof Audited, 'title' | 'author' | 'createdAt' | 'updatedAt'>>
```
