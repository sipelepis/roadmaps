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

Each module has an article, a live playground, and exercises. You write your answer in the editor; a hidden test file is appended to it and the two are compiled together as one module.

That test file holds two kinds of check. Runtime tests use `test` and `expect`:

```ts
test('greets by name', () => {
  expect(greet('Ada')).toBe('Hello, Ada!')
})
```

`test(name, fn)` registers a test; the whole file runs first, then each `fn` in order. `expect(...)` gives you the matchers: `toBe` for identity, `toEqual` for arrays and objects, `toThrow` for a function that should fail.

Type-level checks are written as a type alias that only compiles when the types match:

```ts
type _1 = Expect<Equal<ReturnType<typeof greet>, string>>
```

`Equal<A, B>` is `true` only when `A` and `B` are exactly the same type, and `Expect<T>` accepts nothing but `true`. So a mismatch is a compile error on that line. **A type error anywhere in the file is a failure**, even if every runtime test would have passed: nothing runs until the file compiles.

You will also see `// @ts-expect-error` above a line that is *supposed* to be rejected, sometimes inside a function named `neverCalled` that only exists to hold compile-time checks.

The [Reference](#/reference) page documents every matcher, the type-level assertions, and the JavaScript built-ins the exercises use. Keep it open in a second tab.

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
  expect(greet('Grace')).toBe('Hello, Grace!')
  expect(greet('world')).toBe('Hello, world!')
})

type _1 = Expect<Equal<Parameters<typeof greet>[0], string>>
type _2 = Expect<Equal<ReturnType<typeof greet>, string>>
```

#### Uses
- [What is TypeScript? › Annotations and inference](#/intro/annotations-and-inference)
- [What is TypeScript? › How this roadmap works](#/intro/how-this-roadmap-works)
- [Reference › Type-level assertions](#/reference/type-level-assertions)
- [Reference › Built-in utility types](#/reference/built-in-utility-types)

#### Hints
- Parameters are the one place TypeScript won't infer a type. Annotate `name` with the type it should accept.
- Write the type after the parameter name with a colon, as in the `greet` example. The return type is then inferred for you.

#### Tips
- Under `strict`, an unannotated parameter is an error (`noImplicitAny`), not a silent `any`.
- The two `type _1 = Expect<…>` lines in the test are compile-time assertions. `Parameters<typeof greet>[0]` is the type of the first parameter and `ReturnType<typeof greet>` is what it returns; if either is wrong the line goes red and nothing runs.
- Don't annotate the return type here. `Hello, ${name}!` is already a `string`, and letting the compiler infer it means one less thing to keep in sync.

#### Docs
- [Everyday Types: Parameter type annotations](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#parameter-type-annotations)

### 2. Sum a list

Implement `sum` so it adds every number in the array and returns `0` for an empty array. Annotate the parameter and the return type. An array of numbers is written `number[]`, the same way `Item[]` means an array of `Item` in the example at the top.

```ts starter
function sum(numbers) {
  throw new Error('todo')
}
```

```ts test
test('adds numbers', () => {
  expect(sum([1, 2, 3])).toBe(6)
  expect(sum([10, 20, 30, 40])).toBe(100)
})
test('a single number is its own sum', () => {
  expect(sum([7])).toBe(7)
  expect(sum([0])).toBe(0)
})
test('handles negative numbers', () => {
  expect(sum([5, -2, -3])).toBe(0)
  expect(sum([-1, -1])).toBe(-2)
})
test('empty list is 0', () => {
  expect(sum([])).toBe(0)
})

type _1 = Expect<Equal<Parameters<typeof sum>[0], number[]>>
type _2 = Expect<Equal<ReturnType<typeof sum>, number>>
```

#### Uses
- [What is TypeScript? › Why bother?](#/intro/why-bother)
- [What is TypeScript? › Annotations and inference](#/intro/annotations-and-inference)
- [Reference › Array methods](#/reference/array-methods)

#### Hints
- Annotate the parameter as `number[]`, and put `: number` after the parentheses for the return type.
- The `total` example at the top of the article adds up prices with `reduce`. Do the same with the numbers themselves, starting from `0`.

#### Tips
- Always give `reduce` a starting value. Without one, an empty array throws a `TypeError` instead of returning `0`.
- The starting value also fixes the accumulator's type. `reduce((a, b) => a + b, 0)` is `number`; drop the `0` and the compiler has to guess from the first element.
- A plain `for (const n of numbers)` loop is just as good. `reduce` is idiomatic, not compulsory.

#### Docs
- [Everyday Types: Arrays](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#arrays)
- [Everyday Types: Return type annotations](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#return-type-annotations)
