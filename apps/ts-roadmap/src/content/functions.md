# Functions

Functions are where you annotate the most, because parameters are the one place TypeScript refuses to guess. Return types are usually inferred, but annotating them on exported functions documents intent and stops accidental changes from leaking out.

## Parameters and return types

```ts
function area(width: number, height: number): number {
  return width * height
}

const double = (n: number) => n * 2   // return type inferred: number
```

## Optional and default parameters

```ts
function greet(name: string, greeting?: string) {
  return `${greeting ?? 'Hello'}, ${name}`
}

function greet2(name: string, greeting = 'Hello') {  // greeting: string, optional to callers
  return `${greeting}, ${name}`
}
```

Optional parameters must come after required ones. Inside the body an optional parameter has type `T | undefined`.

## Rest parameters

```ts
function joinWords(separator: string, ...words: string[]): string {
  return words.join(separator)
}
joinWords('-', 'a', 'b', 'c')
```

## Function types

A function's type is written with an arrow. Use it to type callbacks and higher-order functions.

```ts
type Predicate = (value: number) => boolean

function count(xs: number[], test: Predicate): number {
  return xs.filter(test).length
}

count([1, 2, 3, 4], n => n % 2 === 0)  // n is inferred as number from Predicate
```

The parameter name in a function type (`value`) is documentation only; callers can name it anything.

## `void` returns and callbacks

A callback typed `() => void` may return anything; the return value is simply ignored. That is why `array.forEach(x => list.push(x))` compiles even though `push` returns a number.

## Overloads

When a function's return type depends on its argument types, write overload signatures above a single implementation:

```ts
function parse(input: string): number
function parse(input: string[]): number[]
function parse(input: string | string[]) {
  return Array.isArray(input) ? input.map(Number) : Number(input)
}
```

Overloads are verbose; often a generic or a union return is simpler. Reach for them last.

```ts playground
type Formatter = (value: number) => string

function formatAll(values: number[], fmt: Formatter = v => v.toString()): string[] {
  return values.map(fmt)
}

console.log(formatAll([1.5, 2.25]))
console.log(formatAll([1.5, 2.25], v => v.toFixed(0)))

function average(...nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

console.log(average(1, 2, 3, 4))
console.log(average())
```

## Exercises

### 1. Apply twice

Implement `applyTwice`: call `fn` on `value`, then call it again on the result.

```ts starter
function applyTwice(fn, value) {
  throw new Error('todo')
}
```

```ts test
test('applies the function two times', () => {
  expect(applyTwice((n: number) => n * 3, 2)).toBe(18)
  expect(applyTwice((n: number) => n + 1, 0)).toBe(2)
})

type _1 = Expect<Equal<Parameters<typeof applyTwice>, [fn: (n: number) => number, value: number]>>
type _2 = Expect<Equal<ReturnType<typeof applyTwice>, number>>
```

### 2. Optional last name

`fullName` takes a required first name and an optional last name. It returns `"First Last"` when both are given and just `"First"` otherwise.

```ts starter
function fullName(first: string, last: string): string {
  return `${first} ${last}`
}
```

```ts test
test('joins both names', () => {
  expect(fullName('Ada', 'Lovelace')).toBe('Ada Lovelace')
})
test('last name is optional', () => {
  expect(fullName('Ada')).toBe('Ada')
})

type _1 = Expect<Equal<Parameters<typeof fullName>, [first: string, last?: string | undefined]>>
```

### 3. Average of any number of values

Implement `average` with a rest parameter. The average of no numbers is `0`.

```ts starter
function average(): number {
  throw new Error('todo')
}
```

```ts test
test('averages', () => {
  expect(average(2, 4, 6)).toBe(4)
})
test('no values is zero', () => {
  expect(average()).toBe(0)
})

type _1 = Expect<Equal<Parameters<typeof average>, number[]>>
```
