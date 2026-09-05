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

### 4. Timeout wrapper

Implement `withTimeout`, which resolves with the promise's value or rejects with an `Error('timeout')` after `ms` milliseconds, whichever comes first. It must keep the resolved type of the input promise.

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
