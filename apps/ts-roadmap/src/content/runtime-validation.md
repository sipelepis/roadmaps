# Validating unknown data

Types are erased. Everything that crosses into your program from outside, whether a JSON response, a form, a file, `localStorage`, or a URL, arrives at runtime with no guarantee that it matches the type you wrote for it. The fix is a *boundary*: one place where `unknown` becomes a real type through an actual check.

## `JSON.parse` lies

`JSON.parse` returns `any`, which lets you write `const user: User = JSON.parse(text)` and never be told. Wrap it once:

```ts
function parseJSON(text: string): unknown {
  return JSON.parse(text)
}
```

Now every consumer must narrow before they use the result, and the compiler enforces it.

## Guards for objects

Checking `typeof x === 'object'` gets you `object | null`. From there `in` narrows key by key:

```ts
interface User { id: number; name: string }

function isUser(v: unknown): v is User {
  return typeof v === 'object' && v !== null
    && 'id' in v && typeof v.id === 'number'
    && 'name' in v && typeof v.name === 'string'
}
```

Since TS 4.9, `'id' in v` narrows `v` to `object & Record<'id', unknown>`, which is why `v.id` compiles without a cast.

## Composing guards

Small guards compose into bigger ones:

```ts
const isArrayOf = <T>(guard: (x: unknown) => x is T) => (v: unknown): v is T[] =>
  Array.isArray(v) && v.every(guard)

const isUserList = isArrayOf(isUser)
```

## Decoding instead of guarding

A guard only answers yes or no. A *decoder* returns the typed value or an explanation of what was wrong, which is what you want at an API boundary:

```ts
type Decoded<T> = { ok: true; value: T } | { ok: false; error: string }

function decodeUser(v: unknown): Decoded<User> {
  if (typeof v !== 'object' || v === null) return { ok: false, error: 'expected an object' }
  if (!('id' in v) || typeof v.id !== 'number') return { ok: false, error: 'id must be a number' }
  if (!('name' in v) || typeof v.name !== 'string') return { ok: false, error: 'name must be a string' }
  return { ok: true, value: { id: v.id, name: v.name } }
}
```

Note that the decoder returns a *new* object with only the known fields. Extra properties from the outside never leak in.

## Assertion functions at the edge

When failure should just throw, use `asserts`:

```ts
function assertUser(v: unknown): asserts v is User {
  if (!isUser(v)) throw new TypeError('not a user')
}
```

## Schema libraries

Writing guards by hand does not scale past a handful of types. Libraries such as Zod, Valibot, and ArkType let you write the schema once and derive both the type and the validator:

```ts
const User = z.object({ id: z.number(), name: z.string() })
type User = z.infer<typeof User>
const user = User.parse(JSON.parse(text))   // typed, or throws with a precise message
```

The exercises below make you write the guards by hand so you understand what those libraries generate.

```ts playground
function parseJSON(text: string): unknown {
  try { return JSON.parse(text) } catch { return undefined }
}

interface Settings { theme: 'light' | 'dark'; fontSize: number }

function isSettings(v: unknown): v is Settings {
  return typeof v === 'object' && v !== null
    && 'theme' in v && (v.theme === 'light' || v.theme === 'dark')
    && 'fontSize' in v && typeof v.fontSize === 'number'
}

for (const raw of ['{"theme":"dark","fontSize":14}', '{"theme":"blue"}', 'not json']) {
  const data = parseJSON(raw)
  console.log(raw, '→', isSettings(data) ? `ok: ${data.theme} @ ${data.fontSize}px` : 'rejected')
}
```

## Exercises

### 1. Safe parse

Implement `safeParse`: on success return `{ ok: true, value }` where `value` is typed `unknown`; on a `SyntaxError` return `{ ok: false, error }` with the error message. Never throw.

```ts starter
type Parsed = { ok: true; value: unknown } | { ok: false; error: string }

function safeParse(text: string): Parsed {
  throw new Error('todo')
}
```

```ts test
test('parses valid JSON', () => {
  expect(safeParse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
})
test('reports invalid JSON', () => {
  const r = safeParse('{oops')
  expect(r.ok).toBe(false)
  expect(!r.ok && r.error.length > 0).toBe(true)
})
```

#### Uses
- [Validating unknown data › `JSON.parse` lies](#/runtime-validation/json-parse-lies)
- [Async and Promises › Errors are `unknown`](#/async-types/errors-are-unknown)

#### Hints
- Wrap the `JSON.parse` call in `try`, and return the success object from inside it.
- In `catch`, the error is `unknown`. Narrow it with `instanceof Error` before reading `message`, and fall back to `String(e)`.

#### Tips
- Put only the risky call inside `try`. A `try` around a lot of code catches bugs you didn't mean to hide.

#### Docs
- [MDN: `JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
- [MDN: `try...catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)

### 2. Array guard

Write `isStringArray` as a type predicate, then use it in `tags`, which returns the parsed value when it is an array of strings and `[]` otherwise.

```ts starter
function isStringArray(v: unknown) {
  throw new Error('todo')
}

function tags(json: string): string[] {
  const data: unknown = JSON.parse(json)
  throw new Error('todo')
}
```

```ts test
test('accepts only arrays of strings', () => {
  expect(tags('["a","b"]')).toEqual(['a', 'b'])
  expect(tags('["a",1]')).toEqual([])
  expect(tags('"a"')).toEqual([])
  expect(tags('[]')).toEqual([])
})

type _1 = Expect<Equal<ReturnType<typeof isStringArray>, boolean>>
function typeOnly(probe: unknown) {
  if (isStringArray(probe)) {
    type _2 = Expect<Equal<typeof probe, string[]>>
  }
}
```

#### Uses
- [Narrowing › Type predicates](#/narrowing/type-predicates)
- [Validating unknown data › Composing guards](#/runtime-validation/composing-guards)
- [Basic types › `unknown` – the safe `any`](#/basic-types/unknown-the-safe-any)

#### Hints
- Give `isStringArray` the return type `v is string[]`.
- The body has two checks joined by `&&`: `Array.isArray(v)`, then `every` element has `typeof` `'string'`.
- In `tags`, return `data` when the guard passes and `[]` otherwise. Inside the passing branch `data` is already `string[]`.

#### Tips
- TypeScript 5.5+ can infer this predicate on its own, because the `every` callback is itself an inferred predicate. Writing `v is string[]` still documents the intent. The compiler never checks an explicit predicate against the body, so keep the two in sync.

#### Docs
- [Narrowing: Using type predicates](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [MDN: `Array.prototype.every()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every)

### 3. Decode a user

Implement `decodeUser`. Return `{ ok: true, value }` with a *fresh* object containing only `id` and `name`, or `{ ok: false, error }` naming the first bad field: `'expected an object'`, `'id must be a number'`, `'name must be a string'`.

```ts starter
interface User { id: number; name: string }
type Decoded<T> = { ok: true; value: T } | { ok: false; error: string }

function decodeUser(v: unknown): Decoded<User> {
  throw new Error('todo')
}
```

```ts test
test('decodes a valid user and drops extra fields', () => {
  expect(decodeUser({ id: 1, name: 'Ada', admin: true })).toEqual({ ok: true, value: { id: 1, name: 'Ada' } })
})
test('explains failures', () => {
  expect(decodeUser(null)).toEqual({ ok: false, error: 'expected an object' })
  expect(decodeUser({ id: '1', name: 'Ada' })).toEqual({ ok: false, error: 'id must be a number' })
  expect(decodeUser({ id: 1 })).toEqual({ ok: false, error: 'name must be a string' })
})
```

#### Uses
- [Validating unknown data › Decoding instead of guarding](#/runtime-validation/decoding-instead-of-guarding)
- [Validating unknown data › Guards for objects](#/runtime-validation/guards-for-objects)
- [Narrowing › `in` and `instanceof`](#/narrowing/in-and-instanceof)

#### Hints
- Rule out non-objects first: `typeof v !== 'object' || v === null`. `typeof null` is `'object'`, so the second half matters.
- Then check each field in order: `'id' in v` makes `v.id` readable, and `typeof v.id === 'number'` checks it. Return the matching error as soon as one fails.
- On success, build a new object from `v.id` and `v.name` instead of returning `v`.

#### Tips
- Returning `v` itself won't compile: narrowing `v.id` doesn't change the type of `v`, which is still `object & Record<'id', unknown> & …`. Building a fresh object is also what strips the extra `admin` field.

#### Docs
- [Narrowing: The `in` operator narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#the-in-operator-narrowing)
- [TypeScript 4.9: Unlisted Property Narrowing with the `in` Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#unlisted-property-narrowing-with-the-in-operator)

### 4. Generic array decoder

Implement `decodeArray`, which turns a decoder for one item into a decoder for an array of items. The first failing item's error is prefixed with its index, e.g. `'[1]: id must be a number'`.

```ts starter
type Decoded<T> = { ok: true; value: T } | { ok: false; error: string }
type Decoder<T> = (v: unknown) => Decoded<T>

const decodeNumber: Decoder<number> = v =>
  typeof v === 'number' ? { ok: true, value: v } : { ok: false, error: 'expected a number' }

function decodeArray(item) {
  throw new Error('todo')
}
```

```ts test
const decodeNumbers = decodeArray(decodeNumber)

test('decodes every item', () => {
  expect(decodeNumbers([1, 2, 3])).toEqual({ ok: true, value: [1, 2, 3] })
})
test('rejects non-arrays and bad items', () => {
  expect(decodeNumbers('x')).toEqual({ ok: false, error: 'expected an array' })
  expect(decodeNumbers([1, 'two'])).toEqual({ ok: false, error: '[1]: expected a number' })
})

type _1 = Expect<Equal<typeof decodeNumbers, Decoder<number[]>>>
```

#### Uses
- [Validating unknown data › Decoding instead of guarding](#/runtime-validation/decoding-instead-of-guarding)
- [Validating unknown data › Composing guards](#/runtime-validation/composing-guards)
- [Generics › Generic functions](#/generics/generic-functions)
- [Functions › Function types](#/functions/function-types)

#### Hints
- The signature is the whole trick: `decodeArray<T>(item: Decoder<T>): Decoder<T[]>`. Like `isArrayOf` in the article, it returns a function.
- Inside the returned `v => { … }`, reject non-arrays with `Array.isArray`, then loop with an index so you can put it in the error message.
- Call `item` on each element. If a result has `ok` false, return its error prefixed with `` `[${i}]: ` ``. Otherwise push its `value` into a `T[]`.

#### Tips
- Annotating the return type as `Decoder<T[]>` lets TypeScript type `v` as `unknown` and check each returned object literal for you.

#### Docs
- [Generics: Generic Types](https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-types)
- [More on Functions: Function Type Expressions](https://www.typescriptlang.org/docs/handbook/2/functions.html#function-type-expressions)
