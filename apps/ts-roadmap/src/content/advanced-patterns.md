# Advanced patterns

You now have every building block. This module is about idioms that combine them to make illegal states unrepresentable and to push validation to the edges of your program.

## `satisfies`

`satisfies` checks a value against a type *without* widening the value to that type. You keep the precise inferred type and gain a check.

```ts
type Theme = Record<string, [number, number, number]>

const theme = {
  primary: [31, 120, 198],
  danger: [220, 38, 38],
} satisfies Theme

theme.primary          // still known: [number, number, number], and `theme.accent` is an error
```

Compare `const theme: Theme = ...`, which forgets the keys.

## `as const`

Freeze a literal into its most specific type. Combine with `satisfies` for config objects.

```ts
const ROUTES = { home: '/', profile: '/me' } as const satisfies Record<string, `/${string}`>
```

## Branded types

Primitives are interchangeable: a user id and an order id are both `string`. A *brand* is a phantom property that makes them distinct at compile time and costs nothing at runtime.

```ts
type UserId = string & { readonly __brand: 'UserId' }

function toUserId(raw: string): UserId {
  if (!/^u_\w+$/.test(raw)) throw new Error('bad id')
  return raw as UserId
}

function loadUser(id: UserId) {}
loadUser('u_1')              // error: plain string
loadUser(toUserId('u_1'))    // ok
```

The cast lives in exactly one function, which is also where validation lives. That pairing is the whole idea.

## `Result` instead of exceptions

Exceptions are invisible in types. A discriminated union makes failure part of the signature:

```ts
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

function parseJSON(s: string): Result<unknown, SyntaxError> {
  try { return ok(JSON.parse(s)) } catch (e) { return err(e as SyntaxError) }
}
```

## Assertion functions

`asserts x is T` narrows *after* the call, the way `x is T` narrows inside an `if`:

```ts
function assertDefined<T>(v: T, msg = 'value is missing'): asserts v is NonNullable<T> {
  if (v == null) throw new Error(msg)
}

const el = document.querySelector('#app')  // Element | null
assertDefined(el)
el.textContent                              // Element
```

## Validate at the boundary

Types describe what you *believe*. Data from a network, a file, or `localStorage` is `unknown` until checked. Write (or generate) a type guard at the edge, then trust the type everywhere inside.

```ts
interface User { id: number; name: string }

function isUser(v: unknown): v is User {
  return typeof v === 'object' && v !== null
    && typeof (v as User).id === 'number'
    && typeof (v as User).name === 'string'
}
```

Libraries such as Zod and Valibot generate both the type and the guard from one schema, which removes the duplication.

## Exhaustiveness helper

```ts
function assertNever(x: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(x)}`)
}
```

Call it in the `default` of every switch over a union.

```ts playground
type Cents = number & { readonly __brand: 'Cents' }
const cents = (n: number): Cents => {
  if (!Number.isInteger(n)) throw new Error('cents must be whole')
  return n as Cents
}

function add(a: Cents, b: Cents): Cents {
  return (a + b) as Cents
}

const total = add(cents(199), cents(1))
console.log(total)

const PLANS = {
  free: { price: cents(0) },
  pro: { price: cents(1200) },
} satisfies Record<string, { price: Cents }>

console.log(PLANS.pro.price)

// Try: add(1, 2) — plain numbers are rejected.
```

## Exercises

### 1. Branded email

Define `Email` as a branded `string`. `toEmail` validates that the input contains `@` (throwing otherwise) and returns an `Email`. `send` must accept only `Email`.

```ts starter
type Email = string

function toEmail(raw: string): Email {
  throw new Error('todo')
}

function send(to: Email): string {
  return `sent to ${to}`
}
```

```ts test
test('validates', () => {
  expect(send(toEmail('ada@x.io'))).toBe('sent to ada@x.io')
  expect(() => toEmail('nope')).toThrow()
})

// @ts-expect-error a plain string is not an Email
send('ada@x.io')
```

### 2. `Result`

Implement `safeDivide` returning a `Result<number, string>`: an error `'division by zero'` when `b` is `0`, otherwise the quotient. Then implement `unwrapOr`.

```ts starter
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

function safeDivide(a: number, b: number): Result<number, string> {
  throw new Error('todo')
}

function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  throw new Error('todo')
}
```

```ts test
test('divides', () => {
  expect(safeDivide(6, 3)).toEqual({ ok: true, value: 2 })
  expect(safeDivide(1, 0)).toEqual({ ok: false, error: 'division by zero' })
})
test('unwraps with a fallback', () => {
  expect(unwrapOr(safeDivide(6, 3), -1)).toBe(2)
  expect(unwrapOr(safeDivide(1, 0), -1)).toBe(-1)
})
```

### 3. Assertion function

Write `assertDefined` as an assertion function so that after calling it a `T | null | undefined` value is usable as `T`. Throw when the value is `null` or `undefined`.

```ts starter
function assertDefined(value) {
  throw new Error('todo')
}
```

```ts test
test('throws on missing values', () => {
  expect(() => assertDefined(null)).toThrow()
  expect(() => assertDefined(undefined)).toThrow()
})
test('narrows afterwards', () => {
  const maybe = 'hello' as string | null
  assertDefined(maybe)
  expect(maybe.toUpperCase()).toBe('HELLO')   // compiles only if narrowed to string
})
```

### 4. `satisfies`

Type-check `THEME` against `Record<string, Rgb>` while keeping the exact keys, so that `THEME.primary` is known and `THEME.accent` is a compile error. Don't use a type annotation on the constant.

```ts starter
type Rgb = [number, number, number]

const THEME = {
  primary: [31, 120, 198],
  danger: [220, 38, 38],
}

function css(rgb: Rgb): string {
  return `rgb(${rgb.join(', ')})`
}
```

```ts test
test('keys are preserved', () => {
  expect(css(THEME.primary)).toBe('rgb(31, 120, 198)')
})

// @ts-expect-error accent is not a key of THEME
THEME.accent

type _1 = Expect<Equal<keyof typeof THEME, 'primary' | 'danger'>>
```
