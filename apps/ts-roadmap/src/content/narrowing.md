# Narrowing

Narrowing is how TypeScript turns a broad type like `string | number` into a specific one inside a branch. The checker understands ordinary JavaScript control flow, so most of the time you write the check you would have written anyway and the types follow.

## `typeof`

```ts
function pad(v: string | number) {
  if (typeof v === 'number') {
    return v.toFixed(2)   // number here
  }
  return v.padStart(4)    // string here (the number case returned)
}
```

## Truthiness and equality

```ts
function greet(name?: string) {
  if (!name) return 'Hello, stranger'   // name: string | undefined → falsy branch handled
  return `Hello, ${name}`               // name: string
}
```

Beware: `0` and `''` are also falsy. Use `=== undefined` or `!= null` when zero and empty strings are valid values.

## `in` and `instanceof`

```ts
type Fish = { swim(): void }
type Bird = { fly(): void }

function move(a: Fish | Bird) {
  if ('swim' in a) a.swim()
  else a.fly()
}

function handle(e: unknown) {
  if (e instanceof Error) console.log(e.message)
}
```

## Discriminated unions

Checking the discriminant narrows the whole object, as seen in the previous module:

```ts
if (shape.kind === 'circle') shape.radius
```

## Type predicates

When the check is too complex for the compiler to see through, write a function whose return type is `param is Type`:

```ts
function isString(x: unknown): x is string {
  return typeof x === 'string'
}

const mixed: unknown[] = ['a', 1, 'b']
const strings = mixed.filter(isString)  // string[]
```

A predicate is a promise you make to the compiler. If the body is wrong, the types lie.

Since TypeScript 5.5 the compiler *infers* a predicate for simple one-check functions like `isString` above, so the annotation is optional there. Anything more involved (checking several properties of an object, say) still needs you to write `x is T` yourself.

## Exhaustiveness with `never`

After every case is handled, the remaining type is `never`. Assign to a `never` variable in the `default` branch and the compiler will complain the moment someone adds a variant you forgot.

```ts
function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.radius ** 2
    case 'square': return s.side ** 2
    default: {
      const unreachable: never = s   // error if a case is missing
      throw new Error(`unhandled ${unreachable}`)
    }
  }
}
```

## Narrowing limits

Narrowing applies to references TypeScript can track: variables, parameters, and property paths like `obj.a.b`. It is reset by function calls in between (the callee could have mutated the object) and does not survive into callbacks. When a narrowing "doesn't stick", copy the value into a `const` first.

```ts playground
type Payload = string | string[] | { text: string } | null

function toText(p: Payload): string {
  if (p === null) return ''
  if (typeof p === 'string') return p
  if (Array.isArray(p)) return p.join(' ')
  return p.text
}

console.log(toText('a'))
console.log(toText(['a', 'b']))
console.log(toText({ text: 'c' }))
console.log(JSON.stringify(toText(null)))

// Try: remove the Array.isArray check and read the error.
```

## Exercises

### 1. Type predicate

`isUser` checks the shape correctly, but its return type is just `boolean`, so `filter` cannot narrow. Turn it into a type predicate so `onlyUsers` returns `User[]` without a cast.

```ts starter
interface User { name: string; age: number }

function isUser(value: unknown) {
  return (
    typeof value === 'object' && value !== null &&
    'name' in value && typeof value.name === 'string' &&
    'age' in value && typeof value.age === 'number'
  )
}

function onlyUsers(values: unknown[]) {
  return values.filter(isUser)
}
```

```ts test
test('keeps only well-formed users', () => {
  expect(onlyUsers([{ name: 'Ada', age: 36 }, 'x', { name: 'Bob' }, null])).toEqual([{ name: 'Ada', age: 36 }])
})

type _1 = Expect<Equal<ReturnType<typeof onlyUsers>, User[]>>
```

#### Uses
- [Narrowing › Type predicates](#/narrowing/type-predicates)

#### Hints
- The body is already right. Only the return type changes.
- Replace the inferred `boolean` with a predicate of the form `param is Type`. `filter` recognises predicate functions and narrows its result.

#### Tips
- The compiler trusts a predicate blindly. If the checks drift away from `User`, the types will lie.

#### Docs
- [Narrowing: Using type predicates](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)

### 2. Exhaustive switch

Implement `sound` for every animal. Add a `default` branch that assigns to a `never` so a missing case is a compile error. Dogs say `'woof'`, cats `'meow'`, birds `'tweet'`.

```ts starter
type Animal =
  | { kind: 'dog' }
  | { kind: 'cat' }
  | { kind: 'bird' }

function sound(a: Animal): string {
  throw new Error('todo')
}
```

```ts test
test('every animal has a sound', () => {
  expect(sound({ kind: 'dog' })).toBe('woof')
  expect(sound({ kind: 'cat' })).toBe('meow')
  expect(sound({ kind: 'bird' })).toBe('tweet')
})
```

#### Uses
- [Narrowing › Exhaustiveness with `never`](#/narrowing/exhaustiveness-with-never)
- [Narrowing › Discriminated unions](#/narrowing/discriminated-unions)

#### Hints
- `switch (a.kind)` with a `case` that returns each sound.
- In `default`, every variant has been handled, so `a` is `never`. Assign it to a `const` typed `never`, then throw.

#### Tips
- To see it work, add `| { kind: 'fish' }` to `Animal`: the `default` line turns red until you add a case.

#### Docs
- [Narrowing: Exhaustiveness checking](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking)

### 3. Parse an unknown

`parseAge` receives untrusted input. Return the number when the input is a finite number, or a string that parses to one; otherwise return `null`. Do not use `any`.

```ts starter
function parseAge(input: unknown): number | null {
  throw new Error('todo')
}
```

```ts test
test('accepts numbers and numeric strings', () => {
  expect(parseAge(36)).toBe(36)
  expect(parseAge('36')).toBe(36)
})
test('rejects everything else', () => {
  expect(parseAge('abc')).toBe(null)
  expect(parseAge(null)).toBe(null)
  expect(parseAge({ age: 1 })).toBe(null)
  expect(parseAge(NaN)).toBe(null)
})
```

#### Uses
- [Narrowing › `typeof`](#/narrowing/typeof)
- [Basic types › `unknown` – the safe `any`](#/basic-types/unknown-the-safe-any)

#### Hints
- Narrow with `typeof`: handle `'number'` and `'string'`, and return `null` for everything else.
- For a string, `Number(input)` converts it. `'abc'` becomes `NaN`.
- `Number.isFinite(x)` is `false` for `NaN` and `Infinity`. Use it on both the number input and the converted string.

#### Tips
- `Number('')` is `0`, not `NaN`. Real validation would reject empty strings as well.

#### Docs
- [Narrowing: typeof type guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#typeof-type-guards)
