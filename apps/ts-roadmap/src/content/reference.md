# Reference

A lookup page, not a step on the roadmap. It explains the test harness every exercise uses, then lists the JavaScript built-ins and the built-in TypeScript utility types the exercises lean on. Skim it once, come back when a name in an exercise is unfamiliar.

The editor type-checks against the ES2020 library, so anything newer is a compile error even though your browser would run it: `array.at()`, `array.findLast()`, `string.replaceAll()`, `Object.hasOwn()`, `Object.groupBy()` and `Promise.any()` are all out of reach here.

## How the tests work

Every exercise has a hidden test file that is appended to your code and compiled as one module. Two kinds of check live in it: runtime tests and type-level assertions.

```ts
test('adds numbers', () => {
  expect(sum([1, 2, 3])).toBe(6)
})

type _1 = Expect<Equal<ReturnType<typeof sum>, number>>
```

- `test(name: string, fn: () => void | Promise<void>): void` — registers a test. Tests do not run where they are written: the whole file executes first, then each `fn` runs in order. An `async fn` is awaited, so `test('…', async () => { expect(await load()).toBe(1) })` works.
- `expect<T>(actual: T)` — returns the matchers below. A test fails on the first matcher that throws; anything after it in that `fn` never runs.
- **A type error is a failure.** The file has to compile before a single test runs. If the run panel shows compiler errors and no test results, fix the types first.
- `console.log` inside a `test` is captured and shown with that test's result. Outside a test it goes to the output panel.

## Matchers

- `toBe(expected: T): void` — identity, using `Object.is`. Right for numbers, strings, booleans, `null`, `undefined`, and for asking "is this the same object?".
  `expect(2 + 2).toBe(4)` passes; `expect({ a: 1 }).toBe({ a: 1 })` fails, because those are two different objects.
  Note the signature: `expected` has the same type `T` as `actual`, so `expect(LogLevel.Debug).toBe('debug')` is a *type* error. Widen it with `expect<string>(LogLevel.Debug).toBe('debug')`.
  [MDN: `Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)
- `toEqual(expected: unknown): void` — deep equality, implemented as `JSON.stringify(actual) === JSON.stringify(expected)`. Use it for arrays and plain objects.
  `expect(splitName('Ada Lovelace')).toEqual(['Ada', 'Lovelace'])` passes.
  It is **key-order sensitive**: `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` do *not* match. Build result objects in the order the test writes them.
  It also inherits the rest of `JSON.stringify`'s behaviour: a property whose value is `undefined` disappears (`{ a: 1, b: undefined }` equals `{ a: 1 }`), `NaN` and `Infinity` both become `null`, a `Date` becomes its ISO string, and a `Map` or `Set` becomes `{}`.
  [MDN: `JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
- `toBeTruthy(): void` / `toBeFalsy(): void` — asserts the value is truthy / falsy. Remember `0`, `''`, `NaN`, `null` and `undefined` are all falsy.
  [MDN: Truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy)
- `toThrow(message?: string): void` — calls `actual` and asserts it threw. The actual value must be a **function**, so wrap the call: `expect(() => toEmail('nope')).toThrow()`, not `expect(toEmail('nope')).toThrow()`. With an argument, the thrown message only has to *contain* it: `expect(() => parse('')).toThrow('empty')`.
  [MDN: `throw`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw)

There is no `rejects` matcher. Test a rejecting promise with `try`/`catch` inside an async test:

```ts
test('rejects', async () => {
  let caught = ''
  try { await withTimeout(delay(60), 10) } catch (e) { caught = (e as Error).message }
  expect(caught).toBe('timeout')
})
```

## Type-level assertions

Types are erased, so a type cannot be tested at runtime. Instead the tests state a type equality that only compiles when it holds. A red squiggle *is* the failure.

```ts
type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
```

- `Equal<A, B>` — `true` only when `A` and `B` are the *same* type, not merely assignable to each other. It is exact: `readonly` and `?` modifiers count, `Equal<{ a: 1 }, { readonly a: 1 }>` is `false`, and `Equal<any, number>` is `false` too.
- `Expect<T extends true>` — accepts nothing but `true`. So `type _1 = Expect<Equal<A, B>>` is an error whenever the two types differ, and the error points at the assertion line.
- The name (`_1`, `_2`, …) is meaningless; it exists because a type expression needs somewhere to live.
- `// @ts-expect-error` — asserts that the **next line** does not compile. It is an error when that line compiles cleanly, which is how the tests check that something is *rejected*: `// @ts-expect-error` above `send('ada@x.io')` passes only while a plain string really is refused.
  [TypeScript 3.9: `@ts-expect-error`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#-ts-expect-error-comments)
- `function neverCalled() { … }` (also spelled `typeOnly`) — a function the tests declare and never call. Its body holds checks that only need to *compile*: `@ts-expect-error` lines, or an assignment that proves a narrowing happened. Nothing in it runs, so an expression like `origin.x = 1` under `@ts-expect-error` is safe.

```ts
function neverCalled() {
  // @ts-expect-error x is readonly
  origin.x = 1
}
```

## Array methods

`T[]` methods, plus the two `Array` statics the exercises use. Each is listed with the element type `T`.

- `map<U>(fn: (value: T, index: number) => U): U[]` — a new array with `fn` applied to every element.
  `[1, 2, 3].map(n => n * 2)` → `[2, 4, 6]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
- `filter(fn: (value: T, index: number) => boolean): T[]` — keeps the elements `fn` accepts. Given a type predicate (`x is U`) it returns `U[]`.
  `[1, 2, 3, 4].filter(n => n % 2 === 0)` → `[2, 4]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)
- `reduce<U>(fn: (acc: U, value: T, index: number) => U, initial: U): U` — folds the array into one value. Always pass `initial`: without it, an empty array throws.
  `[1, 2, 3].reduce((a, b) => a + b, 0)` → `6`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
- `forEach(fn: (value: T, index: number) => void): void` — runs `fn` for each element and returns nothing. An `async` callback here is *not* awaited.
  `['a', 'b'].forEach(s => console.log(s))` logs `a` then `b`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
- `every(fn: (value: T) => boolean): boolean` / `some(fn): boolean` — do all / does any element pass. `every` on an empty array is `true`.
  `['a', 'b'].every(s => typeof s === 'string')` → `true`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every)
- `find(fn: (value: T) => boolean): T | undefined` / `findIndex(fn): number` — the first match, or `undefined` / `-1`.
  `[1, 5, 9].find(n => n > 4)` → `5`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find)
- `includes(value: T): boolean` / `indexOf(value: T): number` — membership by `===`, so two equal-looking objects don't match.
  `['a', 'b'].includes('b')` → `true`; `['a', 'b'].indexOf('z')` → `-1`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)
- `join(separator?: string): string` — concatenates with `separator` (default `','`). `null` and `undefined` become empty strings.
  `[31, 120, 198].join(', ')` → `'31, 120, 198'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join)
- `slice(start?: number, end?: number): T[]` — a copy of part of the array; the original is untouched. Negative indices count from the end.
  `[1, 2, 3].slice(1)` → `[2, 3]`; `[1, 2, 3].slice(-1)` → `[3]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice)
- `concat(...items: T[][]): T[]` — a new array with the arguments appended. `[...a, ...b]` does the same thing.
  `[1].concat([2, 3])` → `[1, 2, 3]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat)
- `push(...items: T[]): number` — appends **in place** and returns the new length.
  `const xs = [1]; xs.push(2)` → `2`, and `xs` is `[1, 2]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push)
- `pop(): T | undefined` / `shift(): T | undefined` — removes and returns the last / first element, in place. `shift` is how a queue dequeues.
  `const xs = [1, 2]; xs.pop()` → `2`; `xs.shift()` → `1`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift)
- `unshift(...items: T[]): number` — inserts at the front, in place, and returns the new length.
  `const xs = [2]; xs.unshift(1)` → `2`, and `xs` is `[1, 2]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift)
- `sort(compare?: (a: T, b: T) => number): T[]` — sorts **in place** and returns the same array. Without a comparator it sorts by string, so `[10, 9].sort()` is `[10, 9]`. Copy first if the input must survive: `[...xs].sort(…)`.
  `[3, 1, 2].sort((a, b) => a - b)` → `[1, 2, 3]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
- `reverse(): T[]` — reverses **in place**. Same warning as `sort`.
  `[1, 2, 3].reverse()` → `[3, 2, 1]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse)
- `flat(depth?: number): …[]` — flattens nested arrays one level by default.
  `[1, [2, [3]]].flat()` → `[1, 2, [3]]`; `.flat(2)` → `[1, 2, 3]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat)
- `Array.isArray(value: unknown): value is unknown[]` — the only reliable array check, and a type guard: it narrows an `unknown` for you.
  `Array.isArray(JSON.parse('[1]'))` → `true`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray)
- `Array.from<T, U>(arrayLike, fn?: (value: T, index: number) => U): U[]` — builds an array from anything iterable or array-like. With `{ length: n }` it is the idiomatic "range".
  `Array.from({ length: 3 }, (_, i) => i)` → `[0, 1, 2]`; `Array.from(new Set([1, 1, 2]))` → `[1, 2]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)

## String methods

Strings are immutable: every method below returns a new string and leaves the original alone.

- `length: number` — the number of UTF-16 code units. `'abc'.length` → `3`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length)
- `toUpperCase(): string` / `toLowerCase(): string` — case conversion. `'Dune'.toUpperCase()` → `'DUNE'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toUpperCase)
- `includes(search: string): boolean` — substring test. `'ada@x.io'.includes('@')` → `true`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes)
- `startsWith(search: string): boolean` / `endsWith(search: string): boolean` — prefix / suffix test.
  `'/users/1'.startsWith('/')` → `true`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith)
- `split(separator: string): string[]` — cuts the string into pieces. `''` as the separator splits into characters.
  `'Ada Lovelace'.split(' ')` → `['Ada', 'Lovelace']`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split)
- `slice(start?: number, end?: number): string` — a substring; negative indices count from the end.
  `'hello'.slice(1, 3)` → `'el'`; `'hello'.slice(-2)` → `'lo'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice)
- `trim(): string` — removes whitespace from both ends. `'  hi  '.trim()` → `'hi'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim)
- `padStart(length: number, pad?: string): string` / `padEnd(…)` — pads to a target length.
  `'5'.padStart(3, '0')` → `'005'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart)
- `repeat(count: number): string` — `'ab'.repeat(2)` → `'abab'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat)
- `replace(search: string | RegExp, replacement: string): string` — replaces the **first** match when `search` is a string. For all of them use a `/g` regex (`replaceAll` is ES2021 and unavailable here).
  `'a-b-c'.replace('-', '+')` → `'a+b-c'`; `'a-b-c'.replace(/-/g, '+')` → `'a+b+c'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace)
- `indexOf(search: string): number` — position of the first match, or `-1`. `'abc'.indexOf('c')` → `2`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf)
- `` `a ${b} c` `` — a template literal. Every interpolated value is converted with `String(…)`, so `` `n=${null}` `` is `'n=null'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
- `RegExp.prototype.test(s: string): boolean` — does the pattern match anywhere in `s`.
  `/^u_\w+$/.test('u_1')` → `true`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test)

## Numbers and Math

- `toFixed(digits: number): string` — fixed-point decimal, rounded, **as a string**.
  `(3.14159).toFixed(2)` → `'3.14'`; `(448).toFixed(0)` → `'448'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed)
- `Number(value: unknown): number` — converts, giving `NaN` when the *whole* string isn't numeric. Watch out: `Number('')` is `0`.
  `Number('36')` → `36`; `Number('36abc')` → `NaN`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number)
- `parseInt(s: string, radix?: number): number` / `parseFloat(s: string): number` — parse a *prefix* and stop at the first character that doesn't fit, which is why `Number` is the stricter choice for validation.
  `parseInt('36abc')` → `36`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt)
- `Number.isFinite(v: unknown): boolean` — `true` only for a real number, so it rejects `NaN`, `Infinity` *and* numeric strings. The global `isFinite` coerces first and would accept `'36'`.
  `Number.isFinite(36)` → `true`; `Number.isFinite('36')` → `false`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite)
- `Number.isInteger(v: unknown): boolean` — `Number.isInteger(2.5)` → `false`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger)
- `Number.isNaN(v: unknown): boolean` — the only correct `NaN` test, since `NaN === NaN` is `false`.
  `Number.isNaN(0 / 0)` → `true`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN)
- `Math.sqrt(x: number): number` — `Math.sqrt(9)` → `3`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sqrt)
- `Math.hypot(...values: number[]): number` — the square root of the sum of squares, i.e. euclidean distance in one call.
  `Math.hypot(3, 4)` → `5`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/hypot)
- `Math.max(...values: number[]): number` / `Math.min(…)` — spread an array in: `Math.max(...[1, 9, 3])` → `9`. With no arguments `Math.max()` is `-Infinity`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/max)
- `Math.round / floor / ceil / abs(x: number): number` — `Math.round(2.5)` → `3`; `Math.floor(-1.5)` → `-2`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round)
- `Math.PI: number` — `3.141592653589793`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/PI)
- `x ** y` — exponentiation. `2 ** 3` → `8`; `r ** 2` is the idiomatic "squared". [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation)

## Objects and JSON

- `Object.keys(o: object): string[]` — own enumerable keys. Always `string[]`, never `(keyof T)[]`, because the object may have more properties at runtime than its type lists.
  `Object.keys({ a: 1, b: 2 })` → `['a', 'b']`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys)
- `Object.values<T>(o: { [k: string]: T }): T[]` — the values. On a `Record<K, number>` you get `number[]`, ready to `reduce`.
  `Object.values({ a: 1, b: 2 })` → `[1, 2]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values)
- `Object.entries<T>(o: { [k: string]: T }): [string, T][]` — key/value pairs as tuples.
  `Object.entries({ a: 1 })` → `[['a', 1]]`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries)
- `Object.fromEntries(entries): object` — the inverse of `entries`. The result is typed loosely, so annotate it.
  `Object.fromEntries([['a', 1]])` → `{ a: 1 }`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries)
- `Object.assign(target, ...sources)` — copies properties **into** `target` and returns it. Mutating; `{ ...a, ...b }` is the non-mutating version.
  `Object.assign({}, { a: 1 }, { a: 2 })` → `{ a: 2 }`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
- `Object.freeze<T>(o: T): Readonly<T>` — makes an object genuinely immutable at runtime, unlike the compile-time `readonly`. Shallow.
  `const p = Object.freeze({ x: 1 })`, then `p.x = 2` silently does nothing (and throws in a module, which is strict mode). [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)
- `{ ...a, ...b }` — object spread. Later spreads win, so this is the one-line "merge patch onto defaults".
  `{ ...{ x: 1, y: 2 }, ...{ y: 9 } }` → `{ x: 1, y: 9 }`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#spread_in_object_literals)
- `JSON.parse(text: string): any` — parses, or throws a `SyntaxError`. It returns `any`, which is a hole in your types: assign it to `unknown` and narrow.
  `JSON.parse('{"a":1}')` → `{ a: 1 }`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
- `JSON.stringify(value: unknown, replacer?, space?): string` — serialises. Drops `undefined` properties and functions, turns `NaN` and `Infinity` into `null`, and throws on a circular structure.
  `JSON.stringify({ a: 1, b: undefined })` → `'{"a":1}'`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
- `x?.y` and `a ?? b` — optional chaining short-circuits to `undefined` when `x` is `null` or `undefined`; nullish coalescing falls back only on `null`/`undefined`, where `||` would also replace `0` and `''`.
  `({ a: 0 }).a ?? 9` → `0`, while `({ a: 0 }).a || 9` → `9`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)

## Promises

- `new Promise<T>((resolve, reject) => …)` — the constructor. Call `resolve(value)` to fulfil, `reject(error)` to fail. Annotate `<T>` so `resolve` knows what it takes: `new Promise<void>(r => setTimeout(r, ms))`.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise)
- `Promise.resolve<T>(value: T): Promise<T>` — an already-fulfilled promise, handy in tests.
  `await Promise.resolve(7)` → `7`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve)
- `Promise.reject<T = never>(reason?: unknown): Promise<T>` — an already-rejected promise. `await`ing it throws the reason.
  `try { await Promise.reject(new Error('boom')) } catch (e) { /* e is unknown */ }`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject)
- `Promise.all(promises): Promise<T[]>` — waits for all of them, in parallel, preserving order. Rejects as soon as any one rejects. On a tuple it gives a tuple back, each element unwrapped.
  `await Promise.all([f(1), f(2)])` → `['user1', 'user2']`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- `Promise.allSettled(promises): Promise<PromiseSettledResult<T>[]>` — waits for all of them and never rejects; each result is `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`, a discriminated union you narrow on `status`.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- `Promise.race(promises): Promise<T>` — settles the same way as whichever promise settles **first**, fulfilled or rejected. The losers keep running; nothing cancels them.
  `await Promise.race([slow, timeout])`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)
- `.then(onFulfilled)` / `.catch(onRejected)` / `.finally(fn)` — the callback form. `await` is nicer for sequential code; `.then` is still useful for a one-liner such as `delay(10).then(() => 'on time')`.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then)

## Dates and timers

- `Date.now(): number` — milliseconds since 1970 as a plain number. The exercises use it to check that work happened concurrently: take it before and after, and compare the difference.
  `const start = Date.now(); await work(); Date.now() - start` → elapsed ms. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now)
- `new Date(value?)` — a date object. `new Date(0).toISOString()` → `'1970-01-01T00:00:00.000Z'`. Note `JSON.stringify` turns a `Date` into that ISO string, which is what `toEqual` compares.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
- `setTimeout(fn, ms): number` / `clearTimeout(id)` — run `fn` later, or cancel it. The promise wrapper is `const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))`.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)

## Map and Set

- `new Map<K, V>(entries?)` — keyed collection with any key type, remembering insertion order.
  `new Map([['a', 1]]).get('a')` → `1`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
- `map.get(key): V | undefined` / `set(key, value): this` / `has(key): boolean` / `delete(key): boolean` / `size: number` — note `get` is honest about a miss, unlike an index signature on a plain object.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get)
- `new Set<T>(values?)` — a collection of unique values, compared like `===`.
  `new Set([1, 1, 2]).size` → `2`. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
- `set.add(value): this` / `has(value): boolean` / `delete(value): boolean` / `size: number`.
  `[...new Set([1, 1, 2])]` → `[1, 2]`, the idiomatic dedupe. [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/has)

Neither survives `JSON.stringify`: both serialise to `{}`, so `toEqual` cannot compare them. Convert with `[...set]` or `[...map]` first.

## Built-in utility types

Shipped with the compiler, available everywhere without an import. All of them are ordinary mapped and conditional types; nothing here is magic except the four string ones.

- `Partial<T>` — every property optional. Shallow.
  `Partial<{ id: number }>` → `{ id?: number }`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)
- `Required<T>` — every property required.
  `Required<{ id?: number }>` → `{ id: number }`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#requiredtype)
- `Readonly<T>` — every property `readonly`. Shallow, and compile-time only.
  `Readonly<{ id: number }>` → `{ readonly id: number }`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#readonlytype)
- `Pick<T, K extends keyof T>` — keeps only the listed keys.
  `Pick<{ id: number; name: string }, 'id'>` → `{ id: number }`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys)
- `Omit<T, K>` — drops the listed keys. Unlike `Pick`, `K` is not checked against `keyof T`, so a typo silently omits nothing.
  `Omit<{ id: number; pw: string }, 'pw'>` → `{ id: number }`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)
- `Record<K extends keyof any, V>` — an object with keys `K` and values `V`. Keying by a literal union makes every key **required**.
  `Record<'a' | 'b', number>` → `{ a: number; b: number }`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
- `Exclude<T, U>` — removes the members of union `T` assignable to `U`.
  `Exclude<'a' | 'b', 'a'>` → `'b'`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#excludeuniontype-excludedmembers)
- `Extract<T, U>` — keeps only the members assignable to `U`. Useful for picking one variant out of a discriminated union.
  `Extract<'a' | 'b', 'a'>` → `'a'`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union)
- `NonNullable<T>` — removes `null` and `undefined`.
  `NonNullable<string | null>` → `string`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#nonnullabletype)
- `ReturnType<F>` — what a function type returns. Almost always paired with `typeof`: `ReturnType<typeof sum>`.
  `ReturnType<() => string>` → `string`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#returntypetype)
- `Parameters<F>` — a **tuple** of a function's parameters, so `Parameters<F>[0]` is the first one. The tests use it to assert what you annotated, and the tuple keeps parameter names and `?`: `[first: string, last?: string | undefined]`.
  `Parameters<(a: number) => void>` → `[a: number]`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#parameterstype)
- `ConstructorParameters<C>` / `InstanceType<C>` — the same two for a class, applied to `typeof MyClass`.
  `InstanceType<typeof Date>` → `Date`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#instancetypetype)
- `Awaited<T>` — unwraps a promise, recursively.
  `Awaited<Promise<Promise<number>>>` → `number`. [Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype)
- `Uppercase<S>` / `Lowercase<S>` / `Capitalize<S>` / `Uncapitalize<S>` — work on string *literal* types, not values. `Capitalize` only accepts strings, so intersect first when mapping keys: `Capitalize<string & K>`.
  `Capitalize<'click'>` → `'Click'`. [Handbook](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html#capitalizestringtype)
