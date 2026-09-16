# Basic types

TypeScript's primitive types mirror JavaScript's: `string`, `number`, `boolean`, `bigint`, `symbol`, `null`, and `undefined`. On top of those it adds a handful of *special* types that describe what you know (or don't know) about a value.

## The primitives

```ts
let name: string = 'Ada'
let age: number = 36          // ints and floats are both number
let admin: boolean = false
let big: bigint = 9007199254740993n
let nothing: null = null
let missing: undefined = undefined
```

Note the lowercase names. `String`, `Number`, and `Boolean` with capitals are the wrapper object types and are almost never what you want.

## `any` – turning the checker off

`any` is compatible with everything in both directions. It exists for migration and interop, and every `any` is a hole in your type safety.

```ts
let data: any = JSON.parse('{"x": 1}')
data.foo.bar.baz  // compiles, crashes at runtime
```

With `strict`, `noImplicitAny` makes the compiler complain when it would have to *infer* `any` (typically an unannotated parameter).

## `unknown` – the safe `any`

`unknown` also accepts any value, but you cannot *use* it until you narrow it. This is the right type for parsed JSON, `catch` clause errors, and untrusted input.

```ts
function len(value: unknown): number {
  if (typeof value === 'string') return value.length   // narrowed to string
  if (Array.isArray(value)) return value.length        // narrowed to any[]
  return 0
}
```

The difference in one line: `any` lets a mistake through silently, `unknown` refuses to compile until you prove what the value is.

```ts
declare const a: any, u: unknown
a.toUpperCase()   // compiles, may crash
u.toUpperCase()   // error: 'u' is of type 'unknown'
```

`any` is also contagious. `JSON.parse(text).items.map(f)` is `any` all the way down, and every value derived from it loses checking too. When you must accept anything, take `unknown` and narrow once at the edge.

## `void` and `never`

- `void` is the return type of a function that returns nothing useful.
- `never` is the type of something that cannot happen: a function that always throws, or the leftover type after you have narrowed away every possibility.

```ts
function log(msg: string): void { console.log(msg) }

function fail(msg: string): never { throw new Error(msg) }
```

## Literal types

A specific value is also a type. `'GET'` is a subtype of `string`, `42` a subtype of `number`.

```ts
let method: 'GET' | 'POST' = 'GET'
method = 'DELETE' // error
```

`const` declarations infer literal types automatically; `let` widens to the primitive.

```ts
const a = 'x'  // type: 'x'
let b = 'x'    // type: string
```

## Inference rules of thumb

| Situation | What TypeScript does |
| --- | --- |
| `let x = 5` | infers `number` |
| `const x = 5` | infers `5` |
| `let x` (no initializer) | `any` in strict mode? No: it is `any` until assigned, then evolves |
| `[]` | `never[]` in strict, so annotate: `const xs: number[] = []` |
| Function parameter | never inferred, annotate it |

```ts playground
let username = 'ada'
const retries = 3

function describe(value: unknown): string {
  if (typeof value === 'string') return `a string of length ${value.length}`
  if (typeof value === 'number') return `the number ${value}`
  return `something of type ${typeof value}`
}

console.log(describe(username))
console.log(describe(retries))
console.log(describe(null))

// Try: uncomment the next line. Why does it fail?
// username = retries
```

## Exercises

### 1. Replace `any`

Every parameter below is typed `any`. Replace each annotation with the correct primitive type, judging from how the value is used.

```ts starter
function describeBook(title: any, pages: any, inStock: any): string {
  return `${title.toUpperCase()} (${pages.toFixed(0)} pages) – ${inStock ? 'in stock' : 'sold out'}`
}
```

```ts test
type _1 = Expect<Equal<Parameters<typeof describeBook>, [title: string, pages: number, inStock: boolean]>>

test('formats a book', () => {
  expect(describeBook('Refactoring', 448, true)).toBe('REFACTORING (448 pages) – in stock')
  expect(describeBook('Dune', 412, true)).toBe('DUNE (412 pages) – in stock')
})
test('says sold out when not in stock', () => {
  expect(describeBook('Refactoring', 448, false)).toBe('REFACTORING (448 pages) – sold out')
  expect(describeBook('Emma', 474, false)).toBe('EMMA (474 pages) – sold out')
})
```

#### Uses
- [Basic types › The primitives](#/basic-types/the-primitives)
- [Basic types › `any` – turning the checker off](#/basic-types/any-turning-the-checker-off)
- [Reference › String methods](#/reference/string-methods)
- [Reference › Numbers and Math](#/reference/numbers-and-math)

#### Hints
- Read how the body uses each parameter. The method you call on a value tells you its type.
- `toUpperCase` lives on strings and `toFixed` on numbers. `inStock` only picks between two strings with `? :`, so it's a yes/no value.

#### Tips
- Use the lowercase names. `String`, `Number` and `Boolean` with capitals are wrapper object types.
- `toFixed` returns a *string*, not a number, which is why it can be dropped straight into the template literal.
- Getting a type wrong here is not a runtime crash you have to hunt for. The compiler points at the call, because the method you used doesn't exist on the type you wrote.

#### Docs
- [Everyday Types: The primitives](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#the-primitives-string-number-and-boolean)

### 2. Describe an unknown

Implement `kindOf` so it accepts *anything* (use `unknown`, not `any`) and returns the JavaScript `typeof` string for it.

```ts starter
function kindOf(value) {
  throw new Error('todo')
}
```

```ts test
test('reports primitives', () => {
  expect(kindOf('a')).toBe('string')
  expect(kindOf(1)).toBe('number')
  expect(kindOf(true)).toBe('boolean')
  expect(kindOf(undefined)).toBe('undefined')
  expect(kindOf(10n)).toBe('bigint')
  expect(kindOf(Symbol('id'))).toBe('symbol')
})
test('reports objects and functions', () => {
  expect(kindOf({ a: 1 })).toBe('object')
  expect(kindOf([1, 2])).toBe('object')
  expect(kindOf(() => 1)).toBe('function')
})
test('typeof null is object (a JavaScript quirk)', () => {
  expect(kindOf(null)).toBe('object')
})

type _1 = Expect<Equal<Parameters<typeof kindOf>[0], unknown>>
type _2 = Expect<Equal<ReturnType<typeof kindOf>, string>>
```

#### Uses
- [Basic types › `unknown` – the safe `any`](#/basic-types/unknown-the-safe-any)
- [What is TypeScript? › Annotations and inference](#/intro/annotations-and-inference)

#### Hints
- Annotate the parameter as `unknown`. The JavaScript `typeof` operator accepts any value, so you don't need to narrow first.
- Add a `: string` return type. Left to inference, `typeof value` is the union `'string' | 'number' | …`, which isn't `string`, so the type test fails.

#### Tips
- `typeof null` is `'object'`. Check `=== null` separately when the difference matters.
- `unknown` accepts every value, exactly like `any`. The difference shows up on the *next* line, when you try to use it.
- `typeof` on an array gives `'object'` too. `Array.isArray` is the check you actually want for arrays.

#### Docs
- [More on Functions: unknown](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown)
- [Narrowing: typeof type guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#typeof-type-guards)
