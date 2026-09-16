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
test('feeds the first result into the second call', () => {
  expect(applyTwice((n: number) => n * n, 3)).toBe(81)
  expect(applyTwice((n: number) => n - 5, 1)).toBe(-9)
})

type _1 = Expect<Equal<Parameters<typeof applyTwice>, [fn: (n: number) => number, value: number]>>
type _2 = Expect<Equal<ReturnType<typeof applyTwice>, number>>
```

#### Uses
- [Functions › Function types](#/functions/function-types)
- [Functions › Parameters and return types](#/functions/parameters-and-return-types)

#### Hints
- `fn` takes a number and returns a number. Write its type with the arrow syntax from the Function types section.
- Annotate `value` and the return type as `number` too.
- Call `fn` on `value`, then pass that result straight into `fn` again.

#### Tips
- The parameter name inside a function type is documentation only. `(x: number) => number` is the same type as `(n: number) => number`.
- Annotate the whole parameter in one go: `fn: (n: number) => number`. Writing `fn: Function` would compile and then let you call it with anything, which is the bug this exercise is about.
- The type test spells the parameters as `[fn: (n: number) => number, value: number]`. Those labels come from your parameter names, so calling them something else is fine, but the types have to line up exactly.

#### Docs
- [More on Functions: Function type expressions](https://www.typescriptlang.org/docs/handbook/2/functions.html#function-type-expressions)

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
  expect(fullName('Grace', 'Hopper')).toBe('Grace Hopper')
})
test('last name is optional', () => {
  expect(fullName('Ada')).toBe('Ada')
  expect(fullName('Linus')).toBe('Linus')
})
test('an undefined last name counts as missing', () => {
  expect(fullName('Ada', undefined)).toBe('Ada')
  expect(fullName('Linus', undefined)).toBe('Linus')
})

type _1 = Expect<Equal<Parameters<typeof fullName>, [first: string, last?: string | undefined]>>
```

#### Uses
- [Functions › Optional and default parameters](#/functions/optional-and-default-parameters)

#### Hints
- A `?` after a parameter name makes it optional for callers.
- Inside the body `last` is `string | undefined`. Check it, and return just `first` when it's missing.

#### Tips
- Optional parameters must come after the required ones.
- `last` is `string | undefined` inside the body, so the compiler makes you handle the missing case before you can use it in a template literal.
- A default value (`last = ''`) would also compile, but it changes the type: the parameter is then `string`, and `fullName('Ada')` would return `'Ada '` with a trailing space.

#### Docs
- [More on Functions: Optional parameters](https://www.typescriptlang.org/docs/handbook/2/functions.html#optional-parameters)

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
  expect(average(10, 20, 30, 40)).toBe(25)
})
test('keeps fractions', () => {
  expect(average(1, 2)).toBe(1.5)
  expect(average(1, 2, 4, 4)).toBe(2.75)
})
test('one value is its own average', () => {
  expect(average(5)).toBe(5)
  expect(average(-3)).toBe(-3)
})
test('no values is zero', () => {
  expect(average()).toBe(0)
})

type _1 = Expect<Equal<Parameters<typeof average>, number[]>>
```

#### Uses
- [Functions › Rest parameters](#/functions/rest-parameters)

#### Hints
- Add a rest parameter, `...nums: number[]`. Inside the body `nums` is an ordinary array.
- Handle the empty case first (`nums.length === 0`), then divide the sum by `nums.length`. `reduce` starting from `0` gives the sum.

#### Tips
- Without the empty check you'd compute `0 / 0`, which is `NaN`, not `0`.
- The type test asserts `Parameters<typeof average>` is `number[]`, not a tuple. That is what a rest parameter produces, and it is how you can tell one from a fixed parameter list.
- Inside the body `nums` is an ordinary array. The `...` only exists at the call site, where it gathers the loose arguments.

#### Docs
- [More on Functions: Rest parameters](https://www.typescriptlang.org/docs/handbook/2/functions.html#rest-parameters)
