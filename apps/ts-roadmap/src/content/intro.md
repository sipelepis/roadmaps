# What is TypeScript?

TypeScript is JavaScript with a static type system layered on top. You write `.ts` files, the compiler checks them, and then it *erases* every type annotation and emits plain JavaScript. Nothing about types survives to runtime. That single fact explains most of the language: types are a tool for catching mistakes and powering your editor, never a runtime guard.

## Why bother?

```ts
function total(items) {
  return items.reduce((sum, i) => sum + i.price, 0)
}
total([{ prize: 10 }]) // NaN, discovered in production
```

In TypeScript the same code refuses to compile until you say what `items` is, and then the typo in `prize` is a red squiggle before you ever run it:

```ts
interface Item { price: number }

function total(items: Item[]): number {
  return items.reduce((sum, i) => sum + i.price, 0)
}
total([{ prize: 10 }]) // error: Object literal may only specify known properties
```

Beyond bugs, types are what make "rename symbol", "go to definition", and autocomplete work reliably across a large codebase.

## The compiler

- `tsc` is the compiler. `npx tsc --init` creates a `tsconfig.json`, and `npx tsc` type-checks and emits.
- Bundlers (Vite, esbuild, swc) usually strip types *without* checking them for speed. Run `tsc --noEmit` in CI to actually check.
- `strict: true` in `tsconfig.json` turns on the checks that make TypeScript worth using. Every module on this roadmap assumes strict mode.

## Annotations and inference

You rarely have to write a type. TypeScript infers most of them:

```ts
let city = 'Berlin'       // inferred: string
const year = 2024         // inferred: 2024 (a literal type, because const)
const names = ['a', 'b']  // inferred: string[]

city = 42                 // error: Type 'number' is not assignable to type 'string'
```

Annotate where inference can't help: function parameters, empty arrays, and places where you want a *wider* type than the initializer.

```ts
function greet(name: string): string {
  return `Hello, ${name}!`
}
```

## How this roadmap works

Each module has an article, a live playground, and exercises. The exercises ship with test cases: runtime checks written with `test`/`expect`, and *type-level* checks written as `type _ = Expect<Equal<A, B>>` that only compile when the types match. A problem passes when it type-checks cleanly and every test passes.

```ts playground
// Fix the type error, then press Run.
function greet(name: string): string {
  return `Hello, ${name}!`
}

console.log(greet('world'))
console.log(greet(42))
```

## Exercises

### 1. Annotate the parameter

Give `name` a type so the function compiles under `strict` and calling `greet(42)` is a compile-time error.

```ts starter
function greet(name) {
  return `Hello, ${name}!`
}
```

```ts test
test('greets by name', () => {
  expect(greet('Ada')).toBe('Hello, Ada!')
})

type _1 = Expect<Equal<Parameters<typeof greet>[0], string>>
type _2 = Expect<Equal<ReturnType<typeof greet>, string>>
```

### 2. Sum a list

Implement `sum` so it adds every number in the array and returns `0` for an empty array. Annotate the parameter and the return type.

```ts starter
function sum(numbers) {
  throw new Error('todo')
}
```

```ts test
test('adds numbers', () => {
  expect(sum([1, 2, 3])).toBe(6)
})
test('empty list is 0', () => {
  expect(sum([])).toBe(0)
})

type _1 = Expect<Equal<Parameters<typeof sum>[0], number[]>>
type _2 = Expect<Equal<ReturnType<typeof sum>, number>>
```
