# Arrays and tuples

Arrays hold any number of one type. Tuples hold a fixed number of positionally typed elements. Both compile to plain JavaScript arrays, so the difference is purely in what the checker lets you do.

## Arrays

```ts
const scores: number[] = [90, 85]
const names: Array<string> = ['a', 'b']   // same thing, generic syntax

scores.push('x')   // error
scores[0].toFixed(1) // ok: element type is number
```

With `noUncheckedIndexedAccess` off (the default), `scores[99]` is typed `number` even though it is `undefined` at runtime. Treat index access on arrays with some suspicion.

## Readonly arrays

`readonly T[]` (or `ReadonlyArray<T>`) removes every mutating method from the type. Prefer it for parameters you only read: callers can then pass both mutable and immutable arrays.

```ts
function max(xs: readonly number[]): number {
  return Math.max(...xs)
}
xs.push(1) // error: push does not exist on readonly number[]
```

## Tuples

A tuple type lists the type of each position:

```ts
const point: [number, number] = [10, 20]
const entry: [string, number] = ['age', 36]

const [label, value] = entry   // label: string, value: number
entry[2]                        // error: Tuple type has no element at index 2
```

Tuples are how TypeScript types `Object.entries`, `Promise.all`, and React's `useState`.

### Optional and rest elements

```ts
type Range = [start: number, end?: number]           // named + optional
type Command = [name: string, ...args: string[]]      // rest
```

## `as const`

Array literals widen to `T[]`. `as const` keeps the literal types *and* makes the tuple readonly, which is exactly what you want for constants.

```ts
const methods = ['GET', 'POST']            // string[]
const METHODS = ['GET', 'POST'] as const   // readonly ['GET', 'POST']

type Method = (typeof METHODS)[number]     // 'GET' | 'POST'
```

```ts playground
const point: [number, number] = [3, 4]
const [x, y] = point

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

console.log(distance([0, 0], point))

const DAYS = ['mon', 'tue', 'wed'] as const
type Day = (typeof DAYS)[number]
const today: Day = 'tue'
console.log(DAYS.indexOf(today))

// Try: DAYS.push('thu')
```

## Exercises

### 1. Split a full name

Return the first and last word of `full` as a two-element tuple. Annotate the return type as a tuple, not `string[]`.

```ts starter
function splitName(full: string) {
  throw new Error('todo')
}
```

```ts test
test('splits into first and last', () => {
  expect(splitName('Ada Lovelace')).toEqual(['Ada', 'Lovelace'])
})
test('uses the last word when there are middle names', () => {
  expect(splitName('Grace Brewster Hopper')).toEqual(['Grace', 'Hopper'])
})

type _1 = Expect<Equal<ReturnType<typeof splitName>, [string, string]>>
```

### 2. Range

Return the integers from `0` up to but not including `n`. `range(0)` is an empty array. Don't mutate any input.

```ts starter
function range(n: number): number[] {
  throw new Error('todo')
}
```

```ts test
test('counts from zero', () => {
  expect(range(3)).toEqual([0, 1, 2])
})
test('zero gives an empty array', () => {
  expect(range(0)).toEqual([])
})
```

### 3. Read-only parameter

`firstAndLast` should work for any array of strings, including ones declared `readonly`. Fix the parameter type. It returns a tuple of the first and last element, or `undefined` for each missing one.

```ts starter
function firstAndLast(xs: string[]): [string | undefined, string | undefined] {
  return [xs[0], xs[xs.length - 1]]
}
```

```ts test
const frozen: readonly string[] = ['a', 'b', 'c']

test('accepts readonly arrays', () => {
  expect(firstAndLast(frozen)).toEqual(['a', 'c'])
})
test('handles empty', () => {
  expect(firstAndLast([])).toEqual([undefined, undefined])
})
```
