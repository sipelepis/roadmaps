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

Two things `satisfies` is not. It is not a cast: if the value doesn't fit, you get an error, not a silent reinterpretation. And it does not change the variable's type, so a *later* mutation is checked against the inferred type, not against `Theme`. Order matters when you combine it with `as const`: write `{ … } as const satisfies T`, so the literal is frozen first and the frozen type is what gets checked.

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
test('keeps the address as is', () => {
  expect(send(toEmail('grace@navy.mil'))).toBe('sent to grace@navy.mil')
  expect(send(toEmail('linus@kernel.org'))).toBe('sent to linus@kernel.org')
})
test('rejects anything without @', () => {
  expect(() => toEmail('')).toThrow()
  expect(() => toEmail('ada.x.io')).toThrow()
})

// @ts-expect-error a plain string is not an Email
send('ada@x.io')
```

#### Uses
- [Advanced patterns › Branded types](#/advanced-patterns/branded-types)
- [Unions, literals, and intersections › Intersections](#/unions/intersections)
- [Reference › String methods](#/reference/string-methods)
- [Reference › Matchers](#/reference/matchers)

#### Hints
- Redefine `Email` as `string` intersected with an object type holding a readonly `__brand` property, just like `UserId` in the article.
- In `toEmail`, check the input with `raw.includes('@')` and throw an `Error` when it fails.
- A plain string still isn't an `Email`, so the last step is the cast: `return raw as Email`.

#### Tips
- Keep the `as Email` cast inside `toEmail` and nowhere else. If every `Email` comes through that function, every `Email` has been validated.
- The brand property never exists at runtime. `__brand` is a lie the type system tells itself; the value is still just a string, and `send(toEmail('a@b'))` receives exactly what you passed in.
- `toThrow` needs a function, so the test writes `expect(() => toEmail('nope')).toThrow()`. Make sure you `throw` rather than returning a sentinel, or those three tests fail no matter what the types say.

#### Docs
- [Everyday Types: Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)

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
  expect(safeDivide(7, -2)).toEqual({ ok: true, value: -3.5 })
  expect(safeDivide(1, 0)).toEqual({ ok: false, error: 'division by zero' })
})
test('a zero numerator is fine', () => {
  expect(safeDivide(0, 5)).toEqual({ ok: true, value: 0 })
  expect(safeDivide(0, 0)).toEqual({ ok: false, error: 'division by zero' })
})
test('unwraps with a fallback', () => {
  expect(unwrapOr(safeDivide(6, 3), -1)).toBe(2)
  expect(unwrapOr(safeDivide(1, 0), -1)).toBe(-1)
  expect(unwrapOr(safeDivide(0, 5), -1)).toBe(0)
  expect(unwrapOr({ ok: false, error: 404 }, 'fallback')).toBe('fallback')
})
```

#### Uses
- [Advanced patterns › `Result` instead of exceptions](#/advanced-patterns/result-instead-of-exceptions)
- [Narrowing › Discriminated unions](#/narrowing/discriminated-unions)

#### Hints
- `safeDivide` returns one of two object literals: `{ ok: false, error: … }` when `b` is `0`, `{ ok: true, value: … }` otherwise.
- In `unwrapOr`, check `r.ok`. When it is `true`, TypeScript knows `r.value` exists; otherwise return `fallback`.

#### Tips
- Try reading `r.value` before checking `r.ok`. The compiler refuses, and that refusal is the whole point of `Result`.
- `ok: true` and `ok: false` must be literal types, not `boolean`. A single `{ ok: boolean; value?: T; error?: E }` would compile and narrow nothing.
- `unwrapOr` is generic over both `T` and `E`, which is why the last test can hand it a result whose error is a `number` and a fallback that is a `string`.

#### Docs
- [Narrowing: Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)

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
  const count = 41 as number | undefined
  assertDefined(count)
  expect(count + 1).toBe(42)                  // compiles only if narrowed to number
})
test('lets falsy but defined values through', () => {
  const zero = 0 as number | null
  assertDefined(zero)
  expect(zero).toBe(0)
  const empty = '' as string | undefined
  assertDefined(empty)
  expect(empty).toBe('')
})
```

#### Uses
- [Advanced patterns › Assertion functions](#/advanced-patterns/assertion-functions)
- [Utility types › Union transformers](#/utility-types/union-transformers)
- [Narrowing › Truthiness and equality](#/narrowing/truthiness-and-equality)

#### Hints
- Make it generic, `<T>(value: T)`, and give it the return type `asserts value is NonNullable<T>`.
- `value == null` is true for both `null` and `undefined`. Throw in that case and do nothing otherwise.

#### Tips
- Use `== null`, not a falsy check. `assertDefined(0)` and `assertDefined('')` should pass.
- Write it as a `function` declaration. An arrow function works only if the *variable* carries the full type annotation (`const f: (v: unknown) => asserts v is string = …`); writing `asserts` on the arrow itself gives "assertions require every name in the call target to be declared with an explicit type annotation".
- The narrowing only sticks for a variable the compiler can track. `assertDefined(getUser())` narrows nothing, because there is no reference to narrow.

#### Docs
- [Narrowing: Assertion functions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#assertion-functions)
- [TypeScript 3.7: Assertion Functions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions)

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
  expect(css(THEME.danger)).toBe('rgb(220, 38, 38)')
})

// @ts-expect-error accent is not a key of THEME
THEME.accent

type _1 = Expect<Equal<keyof typeof THEME, 'primary' | 'danger'>>
```

#### Uses
- [Advanced patterns › `satisfies`](#/advanced-patterns/satisfies)
- [Reference › Array methods](#/reference/array-methods)

#### Hints
- Add `satisfies Record<string, Rgb>` after the object literal's closing brace.
- Leave the `const THEME` line without an annotation. An annotation would widen the type to `Record<string, Rgb>` and forget the keys.

#### Tips
- `satisfies` also gives the literal its context, so `[31, 120, 198]` is checked as an `Rgb` tuple instead of widening to `number[]`. That is why `css(THEME.primary)` compiles.
- It is a check, not a cast. Add a fourth number to one of the colours and you get an error on the object, which is the difference from `as Record<string, Rgb>`.
- Reach for this whenever you want both halves: the *shape* validated and the *keys* remembered. Config objects, route tables and theme maps are the usual cases.

#### Docs
- [TypeScript 4.9: The `satisfies` Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
