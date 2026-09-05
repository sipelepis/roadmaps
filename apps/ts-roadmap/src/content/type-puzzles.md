# Type-level puzzles

This module is practice only. Each exercise asks for a single type, in the spirit of the [type-challenges](https://github.com/type-challenges/type-challenges) collection, and every test is a compile-time assertion. Nothing runs; a puzzle passes when the file type-checks.

## How to approach these

- Conditional types are your `if`, `infer` is your pattern match, recursion is your loop.
- Tuples are lists: `[infer Head, ...infer Tail]` peels one element off, `[...A, ...B]` concatenates.
- Template literals do the same for strings: `` `${infer Head}${infer Rest}` `` takes one character.
- Mapped types with `as` filter keys; `T[keyof T]` collects values.
- `never` is the empty union. `[T] extends [never]` tests for it without distributing.
- `Equal<A, B>` from the harness is available to you. Use it inside your own types when you need exact matching.

Hover over a type alias in the editor to see what it evaluates to. That is your debugger here.

## Exercises

### 1. `MyPick`

Reimplement `Pick<T, K>`.

```ts starter
type MyPick<T, K extends keyof T> = unknown
```

```ts test
interface Todo { title: string; description: string; completed: boolean }

type _1 = Expect<Equal<MyPick<Todo, 'title'>, { title: string }>>
type _2 = Expect<Equal<MyPick<Todo, 'title' | 'completed'>, { title: string; completed: boolean }>>
// @ts-expect-error key must exist on Todo
type _3 = MyPick<Todo, 'invalid'>
```

### 2. `MyExclude`

Reimplement `Exclude<T, U>`.

```ts starter
type MyExclude<T, U> = unknown
```

```ts test
type _1 = Expect<Equal<MyExclude<'a' | 'b' | 'c', 'a'>, 'b' | 'c'>>
type _2 = Expect<Equal<MyExclude<string | number | (() => void), Function>, string | number>>
type _3 = Expect<Equal<MyExclude<'a', 'a'>, never>>
```

### 3. `MyAwaited`

Unwrap nested promises: `MyAwaited<Promise<Promise<string>>>` is `string`. Work on anything with a `then` that takes a callback.

```ts starter
type MyAwaited<T> = unknown
```

```ts test
type _1 = Expect<Equal<MyAwaited<Promise<string>>, string>>
type _2 = Expect<Equal<MyAwaited<Promise<Promise<number>>>, number>>
type _3 = Expect<Equal<MyAwaited<{ then: (onfulfilled: (value: boolean) => any) => any }>, boolean>>
```

### 4. `TupleToUnion`

```ts starter
type TupleToUnion<T extends readonly unknown[]> = unknown
```

```ts test
type _1 = Expect<Equal<TupleToUnion<[1, 2, 3]>, 1 | 2 | 3>>
type _2 = Expect<Equal<TupleToUnion<readonly ['a', 'b']>, 'a' | 'b'>>
type _3 = Expect<Equal<TupleToUnion<[]>, never>>
```

### 5. `Length`

The length of a tuple, as a literal number type.

```ts starter
type Length<T extends readonly unknown[]> = unknown
```

```ts test
type _1 = Expect<Equal<Length<['a', 'b', 'c']>, 3>>
type _2 = Expect<Equal<Length<[]>, 0>>
// @ts-expect-error a string is not a tuple
type _3 = Length<'abc'>
```

### 6. `First`

The first element of a tuple, or `never` for an empty one.

```ts starter
type First<T extends unknown[]> = unknown
```

```ts test
type _1 = Expect<Equal<First<[3, 2, 1]>, 3>>
type _2 = Expect<Equal<First<[() => 123, { a: string }]>, () => 123>>
type _3 = Expect<Equal<First<[]>, never>>
```

### 7. `Push` and `Unshift`

```ts starter
type Push<T extends unknown[], U> = unknown
type Unshift<T extends unknown[], U> = unknown
```

```ts test
type _1 = Expect<Equal<Push<[1, 2], '3'>, [1, 2, '3']>>
type _2 = Expect<Equal<Push<[], 1>, [1]>>
type _3 = Expect<Equal<Unshift<[1, 2], 0>, [0, 1, 2]>>
```

### 8. `Includes`

`true` if the tuple contains `U` *exactly* (`1` is not `number`). Use `Equal` from the harness.

```ts starter
type Includes<T extends readonly unknown[], U> = unknown
```

```ts test
type _1 = Expect<Equal<Includes<['a', 'b', 'c'], 'a'>, true>>
type _2 = Expect<Equal<Includes<['a', 'b', 'c'], 'd'>, false>>
type _3 = Expect<Equal<Includes<[1, 2], number>, false>>
type _4 = Expect<Equal<Includes<[boolean, 2], false>, false>>
type _5 = Expect<Equal<Includes<[], undefined>, false>>
```

### 9. `Trim`

Remove leading and trailing spaces, tabs, and newlines.

```ts starter
type Trim<S extends string> = unknown
```

```ts test
type _1 = Expect<Equal<Trim<'  hello'>, 'hello'>>
type _2 = Expect<Equal<Trim<'hello  '>, 'hello'>>
type _3 = Expect<Equal<Trim<' \n\t hello world \t'>, 'hello world'>>
type _4 = Expect<Equal<Trim<''>, ''>>
```

### 10. `Replace`

Replace the *first* occurrence of `From` with `To`. An empty `From` leaves the string unchanged.

```ts starter
type Replace<S extends string, From extends string, To extends string> = unknown
```

```ts test
type _1 = Expect<Equal<Replace<'foobarbar', 'bar', 'foo'>, 'foofoobar'>>
type _2 = Expect<Equal<Replace<'foobar', 'baz', 'x'>, 'foobar'>>
type _3 = Expect<Equal<Replace<'foobar', '', 'x'>, 'foobar'>>
type _4 = Expect<Equal<Replace<'', '', 'x'>, ''>>
```

### 11. `DeepReadonly`

Make every property readonly, recursively, leaving functions alone.

```ts starter
type DeepReadonly<T> = unknown
```

```ts test
type In = { a: { b: number; c: { d: string }[] }; fn: () => void }
type Out = { readonly a: { readonly b: number; readonly c: readonly { readonly d: string }[] }; readonly fn: () => void }

type _1 = Expect<Equal<DeepReadonly<In>, Out>>
```

### 12. `Flatten`

Flatten nested tuples completely.

```ts starter
type Flatten<T extends unknown[]> = unknown
```

```ts test
type _1 = Expect<Equal<Flatten<[1, [2, [3]], 4]>, [1, 2, 3, 4]>>
type _2 = Expect<Equal<Flatten<[]>, []>>
type _3 = Expect<Equal<Flatten<[[[]]]>, []>>
```

### 13. `ObjectFromEntries`

Turn a union of `[key, value]` tuples into an object type.

```ts starter
type ObjectFromEntries<E extends [PropertyKey, unknown]> = unknown
```

```ts test
type _1 = Expect<Equal<ObjectFromEntries<['a', 1] | ['b', 'x']>, { a: 1; b: 'x' }>>
type _2 = Expect<Equal<ObjectFromEntries<never>, {}>>
```

### 14. `Chainable`

A builder whose `option(key, value)` accumulates a typed object and whose `get()` returns it. Each call must add a new key to the result type.

```ts starter
type Chainable<T = {}> = unknown
```

```ts test
function typeOnly(config: Chainable) {
  const result = config.option('name', 'ts').option('version', 5).option('strict', true).get()
  type _1 = Expect<Equal<typeof result, { name: string; version: number; strict: boolean }>>
  // @ts-expect-error key must be a string
  config.option(1, 'x')
}
```
