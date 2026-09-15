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

#### Uses
- [Arrays and tuples › Tuples](#/arrays-tuples/tuples)
- [Arrays and tuples › Arrays](#/arrays-tuples/arrays)

#### Hints
- Annotate the return type as a two-element tuple of strings. Without it, returning `[a, b]` is inferred as `string[]`.
- `full.split(' ')` gives the words. The first is at index `0`, the last at `length - 1`.

#### Tips
- Index access on a `string[]` is typed `string` even when nothing is there. That's why this compiles, and why `noUncheckedIndexedAccess` exists.

#### Docs
- [Object Types: Tuple types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types)

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

#### Uses
- [Arrays and tuples › Arrays](#/arrays-tuples/arrays)
- [Basic types › Inference rules of thumb](#/basic-types/inference-rules-of-thumb)

#### Hints
- Start from an empty array annotated as `number[]`, then fill it.
- Loop `i` from `0` while `i < n`, pushing each `i`. When `n` is `0` the loop never runs and you return the empty array.

#### Tips
- `Array.from({ length: n }, (_, i) => i)` builds the same array in one expression.

#### Docs
- [Everyday Types: Arrays](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#arrays)

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

#### Uses
- [Arrays and tuples › Readonly arrays](#/arrays-tuples/readonly-arrays)

#### Hints
- A `readonly string[]` can't be passed where a `string[]` is expected, because the function might `push` to it.
- Only the parameter type changes. The body just reads, so it compiles as is.

#### Tips
- The other direction is fine: a mutable array is assignable to a readonly one, so a readonly parameter accepts both.

#### Docs
- [Object Types: The ReadonlyArray type](https://www.typescriptlang.org/docs/handbook/2/objects.html#the-readonlyarray-type)
