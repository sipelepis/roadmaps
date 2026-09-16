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

// T is inferred from the array you pass in
const lastNumber = last([1, 2, 3])
const lastWord = last(['a', 'b'])
type _3 = Expect<Equal<typeof lastNumber, number | undefined>>
type _4 = Expect<Equal<typeof lastWord, string | undefined>>
```

#### Uses
- [Generics › Generic functions](#/generics/generic-functions)

#### Hints
- Add a type parameter after the function name, `last<T>`, and use `T` where the `any`s are.
- The parameter is an array of `T`. The return type is `T | undefined`, since an empty array has no last element.

#### Tips
- With `any`, every caller loses the element type. With `T`, `last([1, 2])` is typed `number | undefined`.
- You never write `last<number>(...)` at a call site. `T` is inferred from the argument, which is the whole point; the explicit form in the test exists only to pin the type down for the assertion.
- The `| undefined` is not optional here. `items[items.length - 1]` on an empty array really is `undefined`, and the test checks it.

#### Docs
- [Generics: Hello World of Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html#hello-world-of-generics)

### 2. Generic stack

Implement `Stack<T>` with `push`, `pop` (returns `T | undefined`), `peek` (same), and a `size` getter.

A getter is a method with `get` in front, `get size() { … }`, that callers read like a property: `s.size`, no parentheses.

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
test('peek does not remove', () => {
  const s = new Stack<number>()
  s.push(1)
  s.push(2)
  expect(s.peek()).toBe(2)
  expect(s.peek()).toBe(2)
  expect(s.size).toBe(2)
})
test('size follows push and pop', () => {
  const s = new Stack<number>()
  expect(s.size).toBe(0)
  s.push(1)
  s.push(2)
  s.push(3)
  s.pop()
  expect(s.size).toBe(2)
})
test('an empty stack gives undefined', () => {
  const s = new Stack<string>()
  expect(s.peek()).toBe(undefined)
  expect(s.pop()).toBe(undefined)
  s.push('a')
  s.pop()
  expect(s.peek()).toBe(undefined)
})

type _1 = Expect<Equal<ReturnType<Stack<number>['pop']>, number | undefined>>
type _2 = Expect<Equal<ReturnType<Stack<number>['peek']>, number | undefined>>
// @ts-expect-error wrong element type
new Stack<number>().push('x')
```

#### Uses
- [Generics › Generic interfaces, types, and classes](#/generics/generic-interfaces-types-and-classes)
- [Reference › Array methods](#/reference/array-methods)

#### Hints
- Start from the `Stack<T>` in the article: a private `T[]` field, with `push` and `pop` handing off to the array.
- `peek` returns the last element without removing it, at index `length - 1`.
- `size` is a getter returning the array's `length`.

#### Tips
- Annotate `peek` as `T | undefined` yourself. Index access on `T[]` is typed plain `T`, even on an empty array.
- `pop()` needs no annotation: the standard library already types it `T | undefined`, which is the honest signature `peek` has to be given by hand.
- The type parameter goes on the *class*, not each method. `class Stack<T>` means one stack holds one element type, which is what `new Stack<number>().push('x')` is expected to reject.

#### Docs
- [Generics: Generic Classes](https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-classes)
- [Classes: Getters / Setters](https://www.typescriptlang.org/docs/handbook/2/classes.html#getters--setters)

### 3. Constrained generic

`longest` should accept any two values that have a numeric `length` (strings, arrays, …) and return the longer one, typed as the input type. On a tie, return `a`. Constrain `T`; don't use `any`.

```ts starter
function longest(a, b) {
  throw new Error('todo')
}
```

```ts test
test('works on strings and arrays', () => {
  expect(longest('abc', 'de')).toBe('abc')
  expect(longest('a', 'xyz')).toBe('xyz')
  expect(longest([1], [1, 2])).toEqual([1, 2])
  expect(longest([1, 2, 3], [4])).toEqual([1, 2, 3])
})
test('returns a on a tie', () => {
  expect(longest('ab', 'cd')).toBe('ab')
  expect(longest([1], [2])).toEqual([1])
})
test('works on any object with a numeric length', () => {
  expect(longest({ length: 2 }, { length: 5 })).toEqual({ length: 5 })
  expect(longest({ length: 9 }, { length: 1 })).toEqual({ length: 9 })
})

type _1 = Expect<Equal<ReturnType<typeof longest<string>>, string>>
type _2 = Expect<Equal<ReturnType<typeof longest<number[]>>, number[]>>
// @ts-expect-error numbers have no length
longest(1, 2)
```

#### Uses
- [Generics › Constraints](#/generics/constraints)

#### Hints
- A plain `<T>` won't let you read `.length`, because `T` could be anything. Constrain it with `extends` to "anything with a numeric `length`".
- Type both parameters and the return as `T`, then return whichever has the larger `length`. Comparing with `>=` keeps `a` on a tie.

#### Tips
- The constraint is a shape, not a list of types, so strings, arrays and any object with a numeric `length` all qualify.
- Both parameters must be the *same* `T`. That is what makes the return type precise, and it is also why `longest('ab', [1])` is rejected: there is no single `T` that fits both.
- Returning `T` beats returning `string | number[]`. The caller gets back exactly the type it passed in, with no narrowing needed afterwards.

#### Docs
- [Generics: Generic Constraints](https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-constraints)
