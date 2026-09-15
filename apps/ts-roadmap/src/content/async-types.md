# Async and Promises

Asynchronous code is where untyped JavaScript hurts most: a forgotten `await` silently hands you a `Promise` instead of a value. TypeScript makes the wrapper visible and unwraps it for you at every `await`.

## `Promise<T>`

A promise is generic over the value it resolves with. `async` functions always return a `Promise`, and TypeScript wraps the declared return type for you.

```ts
async function loadName(id: number): Promise<string> {
  return `user${id}`          // returning string is fine; the function returns Promise<string>
}

const p = loadName(1)         // Promise<string>
const name = await loadName(1) // string
```

Annotate the return type of async functions as `Promise<T>`, never as `T`.

## The forgotten `await`

```ts
async function count(): Promise<number> { return 3 }

const n = count()
n + 1                // error: Operator '+' cannot be applied to Promise<number>
if (count()) {}      // error in 5.x: this condition will always return true
```

The type system catches most of these. `@typescript-eslint/no-floating-promises` catches the rest.

## `Promise.all` and tuples

`Promise.all` on a tuple gives a tuple back, with each element unwrapped:

```ts
const [user, posts] = await Promise.all([loadUser(1), loadPosts(1)])
// user: User, posts: Post[]
```

`Promise.allSettled` gives `PromiseSettledResult<T>[]`, a discriminated union on `status` you narrow like any other.

## `Awaited<T>`

`Awaited<T>` recursively unwraps promises. Use it to get the resolved type of a function you don't control:

```ts
type User = Awaited<ReturnType<typeof loadUser>>
```

## Errors are `unknown`

In `catch`, the error is `unknown` (with `useUnknownInCatchVariables`, part of `strict`). Narrow before you use it:

```ts
try {
  await save()
} catch (e) {
  if (e instanceof Error) console.error(e.message)
  else console.error(String(e))
}
```

Anything can be thrown, so this is the honest type.

## Callbacks that return promises

An `async` callback passed where `() => void` is expected is allowed and its promise is ignored. That is fine for event handlers and a bug for `array.forEach`, where you probably wanted `Promise.all(items.map(async …))`.

## Typing `setTimeout`

`delay` is the smallest useful async helper and a nice demonstration of `Promise<void>`:

```ts
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
```

The explicit `<void>` tells the constructor what `resolve` accepts.

```ts playground
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function fetchUser(id: number): Promise<{ id: number; name: string }> {
  await delay(50)
  return { id, name: `user${id}` }
}

async function fetchScore(id: number): Promise<number> {
  await delay(30)
  return id * 10
}

const [user, score] = await Promise.all([fetchUser(1), fetchScore(1)])
console.log(user.name, score)

type LoadedUser = Awaited<ReturnType<typeof fetchUser>>
const cached: LoadedUser = user
console.log(cached)

// Try: remove `await` before Promise.all and see what `user` becomes.
```

## Exercises

### 1. Load in parallel

`fetchName` is given. Implement `loadNames` so it fetches every id *concurrently* (use `Promise.all`) and returns the names in order. Annotate the return type.

```ts starter
async function fetchName(id: number): Promise<string> {
  await new Promise(r => setTimeout(r, 5))
  return `user${id}`
}

async function loadNames(ids: number[]) {
  throw new Error('todo')
}
```

```ts test
test('loads every name in order', async () => {
  expect(await loadNames([3, 1, 2])).toEqual(['user3', 'user1', 'user2'])
})
test('empty input', async () => {
  expect(await loadNames([])).toEqual([])
})

type _1 = Expect<Equal<ReturnType<typeof loadNames>, Promise<string[]>>>
```

#### Uses
- [Async and Promises › `Promise<T>`](#/async-types/promiset)
- [Async and Promises › `Promise.all` and tuples](#/async-types/promise-all-and-tuples)

#### Hints
- Turn the ids into an array of promises first, one `fetchName` call per id. `map` does that without waiting on any of them.
- Hand that array to `Promise.all` and return (or `await`) the result.
- The annotation is the resolved value wrapped in a promise: `Promise<string[]>`.

#### Tips
- `for (const id of ids) names.push(await fetchName(id))` gives the same answer but waits for each call before starting the next. `Promise.all` starts them all at once.

#### Docs
- [MDN: `Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- [Everyday Types: Functions Which Return Promises](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#functions-which-return-promises)

### 2. Retry

Implement a generic `retry` that calls `fn` until it resolves, at most `times` attempts, and rethrows the last error when every attempt fails.

```ts starter
function retry(fn, times: number) {
  throw new Error('todo')
}
```

```ts test
test('resolves once fn succeeds', async () => {
  let calls = 0
  const flaky = async () => { calls++; if (calls < 3) throw new Error('flaky'); return 'ok' }
  expect(await retry(flaky, 5)).toBe('ok')
  expect(calls).toBe(3)
})
test('gives up after `times` attempts', async () => {
  let calls = 0
  const broken = async () => { calls++; throw new Error('nope') }
  let caught: unknown
  try { await retry(broken, 2) } catch (e) { caught = e }
  expect(caught instanceof Error && caught.message).toBe('nope')
  expect(calls).toBe(2)
})

type _1 = Expect<Equal<ReturnType<typeof retry<number>>, Promise<number>>>
```

#### Uses
- [Generics › Generic functions](#/generics/generic-functions)
- [Functions › Function types](#/functions/function-types)
- [Async and Promises › `Promise<T>`](#/async-types/promiset)
- [Async and Promises › Errors are `unknown`](#/async-types/errors-are-unknown)

#### Hints
- One type parameter `T` is enough: `fn` is a function with no arguments that returns `Promise<T>`, and `retry` returns `Promise<T>` too. Make `retry` an `async` function.
- Loop `times` times. Inside, `try` to return `await fn()`; in the `catch`, remember the error in a variable declared before the loop.
- If the loop finishes, every attempt failed: `throw` the error you remembered.

#### Tips
- Write `return await fn()`, not `return fn()`. Without `await`, the promise leaves the `try` before it rejects, so the `catch` never sees the error.

#### Docs
- [Generics: Hello World of Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html#hello-world-of-generics)
- [MDN: `try...catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)

### 3. Error messages from `unknown`

Implement `errorMessage`: an `Error` gives its `message`, a string is returned as is, anything else gives `'Unknown error'`.

```ts starter
function errorMessage(e: unknown): string {
  throw new Error('todo')
}
```

```ts test
test('handles the common thrown values', () => {
  expect(errorMessage(new TypeError('bad'))).toBe('bad')
  expect(errorMessage('oops')).toBe('oops')
  expect(errorMessage(42)).toBe('Unknown error')
  expect(errorMessage(undefined)).toBe('Unknown error')
})
test('works in a catch block', async () => {
  let msg = ''
  try { await Promise.reject(new Error('rejected')) } catch (e) { msg = errorMessage(e) }
  expect(msg).toBe('rejected')
})
```

#### Uses
- [Async and Promises › Errors are `unknown`](#/async-types/errors-are-unknown)
- [Basic types › `unknown` – the safe `any`](#/basic-types/unknown-the-safe-any)

#### Hints
- `e` is `unknown`, so you have to check what it is before reading anything from it.
- `e instanceof Error` narrows to `Error`, which has `message`. `typeof e === 'string'` narrows to `string`.
- Anything that passes neither check falls through to the final `return`.

#### Tips
- `instanceof Error` also matches subclasses such as `TypeError` and `SyntaxError`, which is why the first test passes.

#### Docs
- [Narrowing: `instanceof` narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#instanceof-narrowing)
- [Narrowing: `typeof` type guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#typeof-type-guards)

### 4. Timeout wrapper

Implement `withTimeout`, which resolves with the promise's value or rejects with an `Error('timeout')` after `ms` milliseconds, whichever comes first. It must keep the resolved type of the input promise.

Two tools you haven't met yet. `Promise.race([a, b])` returns a promise that settles the same way as whichever of `a` and `b` settles first. And the function you pass to `new Promise` receives a second argument, `reject`, which fails the promise:

```ts
const failed = new Promise<never>((resolve, reject) => reject(new Error('no')))
```

A promise that can only reject never produces a value, so `Promise<never>` is its honest type.

```ts starter
function withTimeout(promise, ms: number) {
  throw new Error('todo')
}
```

```ts test
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

test('passes through a fast promise', async () => {
  expect(await withTimeout(Promise.resolve(7), 50)).toBe(7)
})
test('rejects a slow one', async () => {
  let caught = ''
  try { await withTimeout(delay(60).then(() => 'late'), 10) } catch (e) { caught = (e as Error).message }
  expect(caught).toBe('timeout')
})

type _1 = Expect<Equal<ReturnType<typeof withTimeout<string>>, Promise<string>>>
```

#### Uses
- [Async and Promises › Typing `setTimeout`](#/async-types/typing-settimeout)
- [Async and Promises › `Promise<T>`](#/async-types/promiset)
- [Generics › Generic functions](#/generics/generic-functions)
- [Basic types › `void` and `never`](#/basic-types/void-and-never)

#### Hints
- Make it generic: `promise` is a `Promise<T>` and the function returns `Promise<T>`.
- Build a second promise that calls `reject(new Error('timeout'))` from inside a `setTimeout` of `ms` milliseconds. Type it `Promise<never>`.
- Race the input against it. `never` adds nothing to a union, so the race is still typed `Promise<T>`.

#### Tips
- The timer keeps running after the input wins. Harmless here; in long-lived code, keep the id from `setTimeout` and `clearTimeout` it once the race settles.

#### Docs
- [MDN: `Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)
- [MDN: `Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise)
