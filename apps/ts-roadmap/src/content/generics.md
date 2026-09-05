# Generics

A generic is a type with a parameter. Instead of writing `firstNumber`, `firstString`, and `firstUser`, you write `first<T>` once and let each call site fill in `T`. Generics are how library code stays precise without knowing your types in advance.

## Generic functions

```ts
function first<T>(items: T[]): T | undefined {
  return items[0]
}

first([1, 2, 3])        // T inferred as number → number | undefined
first(['a'])            // string | undefined
first<boolean>([])      // explicit: boolean | undefined
```

`T` is a placeholder. TypeScript infers it from the arguments, and you almost never need to write `<T>` at a call site.

## Multiple parameters

```ts
function mapObject<K extends string, V, R>(obj: Record<K, V>, fn: (v: V) => R): Record<K, R> {
  const out = {} as Record<K, R>
  for (const k in obj) out[k] = fn(obj[k])
  return out
}
```

## Constraints

`extends` restricts what `T` can be, which is what lets you *use* it inside the function:

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b
}

longest('abc', 'de')       // 'abc', T = string
longest([1, 2], [3])       // T = number[]
longest(1, 2)              // error: number has no length
```

## Generic interfaces, types, and classes

```ts
interface Box<T> { value: T }
type Pair<A, B> = [A, B]

class Stack<T> {
  private items: T[] = []
  push(item: T) { this.items.push(item) }
  pop(): T | undefined { return this.items.pop() }
}

const s = new Stack<number>()
```

## Defaults

```ts
type ApiResponse<T = unknown> = { data: T; status: number }
```

## Inference from return position

TypeScript can also infer `T` from where the result is used, via a contextual type:

```ts
const empty: string[] = makeArray()   // T inferred as string from the annotation
```

## Guidelines

- If a type parameter appears only once in a signature, you probably don't need it. `function log<T>(x: T): void` is just `function log(x: unknown): void`.
- Name parameters meaningfully when there are several: `<Key, Value>` beats `<K, V>` in public APIs.
- Constrain as loosely as the body allows. `T extends { length: number }` accepts more than `T extends string | any[]`.

```ts playground
function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) (out[key(item)] ??= []).push(item)
  return out
}

const people = [
  { name: 'Ada', team: 'math' },
  { name: 'Grace', team: 'navy' },
  { name: 'Alan', team: 'math' },
]

const byTeam = groupBy(people, p => p.team)
console.log(byTeam)
console.log(byTeam.math.map(p => p.name))

// Try: hover over `byTeam` in the editor to see the inferred type.
```

## Exercises

### 1. Generic `last`

Make `last` generic so it works for arrays of any element type and returns the element type or `undefined`.

```ts starter
function last(items: any[]): any {
  return items[items.length - 1]
}
```

```ts test
test('returns the last element', () => {
  expect(last([1, 2, 3])).toBe(3)
  expect(last(['a', 'b'])).toBe('b')
  expect(last([])).toBe(undefined)
})

type _1 = Expect<Equal<ReturnType<typeof last<number>>, number | undefined>>
type _2 = Expect<Equal<ReturnType<typeof last<string>>, string | undefined>>
```

### 2. Generic stack

Implement `Stack<T>` with `push`, `pop` (returns `T | undefined`), `peek` (same), and a `size` getter.

```ts starter
class Stack<T> {
  // ...
}
```

```ts test
test('is last-in first-out', () => {
  const s = new Stack<string>()
  s.push('a')
  s.push('b')
  expect(s.size).toBe(2)
  expect(s.peek()).toBe('b')
  expect(s.pop()).toBe('b')
  expect(s.pop()).toBe('a')
  expect(s.pop()).toBe(undefined)
})

type _1 = Expect<Equal<ReturnType<Stack<number>['pop']>, number | undefined>>
// @ts-expect-error wrong element type
new Stack<number>().push('x')
```

### 3. Constrained generic

`longest` should accept any two values that have a numeric `length` (strings, arrays, …) and return the longer one, typed as the input type. Constrain `T`; don't use `any`.

```ts starter
function longest(a, b) {
  throw new Error('todo')
}
```

```ts test
test('works on strings and arrays', () => {
  expect(longest('abc', 'de')).toBe('abc')
  expect(longest([1], [1, 2])).toEqual([1, 2])
})

type _1 = Expect<Equal<ReturnType<typeof longest<string>>, string>>
// @ts-expect-error numbers have no length
longest(1, 2)
```
