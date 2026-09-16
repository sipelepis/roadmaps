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
  expect(splitName('Alan Turing')).toEqual(['Alan', 'Turing'])
})
test('uses the last word when there are middle names', () => {
  expect(splitName('Grace Brewster Hopper')).toEqual(['Grace', 'Hopper'])
  expect(splitName('Johann Sebastian Bach')).toEqual(['Johann', 'Bach'])
})
test('skips any number of middle names', () => {
  expect(splitName('Maria Salomea Sklodowska Curie')).toEqual(['Maria', 'Curie'])
  expect(splitName('Pablo Diego José Francisco Picasso')).toEqual(['Pablo', 'Picasso'])
})

type _1 = Expect<Equal<ReturnType<typeof splitName>, [string, string]>>
```

#### Uses
- [Arrays and tuples › Tuples](#/arrays-tuples/tuples)
- [Arrays and tuples › Arrays](#/arrays-tuples/arrays)
- [Reference › String methods](#/reference/string-methods)
- [Reference › Matchers](#/reference/matchers)

#### Hints
- Annotate the return type as a two-element tuple of strings. Without it, returning `[a, b]` is inferred as `string[]`.
- `full.split(' ')` gives the words. The first is at index `0`, the last at `length - 1`.

#### Tips
- Index access on a `string[]` is typed `string` even when nothing is there. That's why this compiles, and why `noUncheckedIndexedAccess` exists.
- Returning `[first, last]` from a function annotated `: [string, string]` is enough. `as const` or a cast would work too, but the annotation is the one that also checks you returned two elements.
- `toEqual` compares arrays element by element, so the order of the two words is part of the assertion.

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
  expect(range(6)).toEqual([0, 1, 2, 3, 4, 5])
})
test('stops before n', () => {
  expect(range(1)).toEqual([0])
  expect(range(2)).toEqual([0, 1])
})
test('zero gives an empty array', () => {
  expect(range(0)).toEqual([])
})
```

#### Uses
- [Arrays and tuples › Arrays](#/arrays-tuples/arrays)
- [Basic types › Inference rules of thumb](#/basic-types/inference-rules-of-thumb)
- [Reference › Array methods](#/reference/array-methods)

#### Hints
- Start from an empty array annotated as `number[]`, then fill it.
- Loop `i` from `0` while `i < n`, pushing each `i`. When `n` is `0` the loop never runs and you return the empty array.

#### Tips
- `Array.from({ length: n }, (_, i) => i)` builds the same array in one expression.
- An unannotated `const out = []` works here, because TypeScript lets an empty array literal *evolve* from what you push into it. Annotating `number[]` is still better: the evolution stops as soon as the array leaves the function, and the annotation catches a stray `push('x')` at the push, not later.
- `new Array(n).map((_, i) => i)` looks equivalent and isn't: the array has holes, and `map` skips them, so you get `[empty × n]`. `Array.from` fills them.

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
const days = ['mon', 'tue', 'wed', 'thu'] as const
const mutable: string[] = ['x', 'y']

test('accepts readonly arrays', () => {
  expect(firstAndLast(frozen)).toEqual(['a', 'c'])
  expect(firstAndLast(days)).toEqual(['mon', 'thu'])
})
test('still accepts mutable arrays', () => {
  expect(firstAndLast(mutable)).toEqual(['x', 'y'])
  expect(firstAndLast(['p', 'q', 'r', 's', 't'])).toEqual(['p', 't'])
})
test('handles empty', () => {
  expect(firstAndLast([])).toEqual([undefined, undefined])
})

type _1 = Expect<Equal<Parameters<typeof firstAndLast>[0], readonly string[]>>
```

#### Uses
- [Arrays and tuples › Readonly arrays](#/arrays-tuples/readonly-arrays)

#### Hints
- A `readonly string[]` can't be passed where a `string[]` is expected, because the function might `push` to it.
- Only the parameter type changes. The body just reads, so it compiles as is.

#### Tips
- The other direction is fine: a mutable array is assignable to a readonly one, so a readonly parameter accepts both.
- Make this the default for parameters you only read. It costs nothing, documents that the function won't mutate, and widens what callers can pass.
- `days` is `readonly ['mon', 'tue', 'wed', 'thu']` thanks to `as const`. A tuple is assignable to an array of the same element type, so the only thing stopping it from reaching a `string[]` parameter is the `readonly`.

#### Docs
- [Object Types: The ReadonlyArray type](https://www.typescriptlang.org/docs/handbook/2/objects.html#the-readonlyarray-type)
