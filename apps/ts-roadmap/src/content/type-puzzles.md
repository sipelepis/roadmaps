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

#### Uses
- [Mapped types › Mapping over a union of keys](#/mapped-types/mapping-over-a-union-of-keys)
- [keyof, typeof, and indexed access › Indexed access types](#/keyof-typeof/indexed-access-types)

#### Hints
- A mapped type doesn't have to iterate `keyof T`. Iterate `K` instead.
- Each property keeps its type from `T`: `T[P]` for the key `P` you are mapping.

#### Docs
- [Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)

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

#### Uses
- [Conditional types › Distribution over unions](#/conditional-types/distribution-over-unions)

#### Hints
- A conditional on a naked `T` runs once per union member.
- For each member: if it is assignable to `U`, produce `never` (it drops out of the union), otherwise keep it.

#### Tips
- `() => void` is assignable to `Function`, which is why the second test removes it.

#### Docs
- [Conditional Types: Distributive Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types)

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

#### Uses
- [Conditional types › `infer`](#/conditional-types/infer)
- [Conditional types › Recursive conditional types](#/conditional-types/recursive-conditional-types)
- [Objects and interfaces › Methods](#/objects/methods)

#### Hints
- Don't match `Promise<infer U>`; that misses the plain object in the third test. Match the shape instead: an object with a `then` function whose first parameter is itself a function.
- Put `infer V` where that callback's `value` parameter goes: `{ then: (onfulfilled: (value: infer V) => any) => any }`.
- Recurse on `V` so nested promises unwrap, and return `T` itself when nothing matches.

#### Docs
- [Conditional Types: Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)
- [Utility Types: `Awaited<Type>`](https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype)

### 4. `TupleToUnion`

```ts starter
type TupleToUnion<T extends readonly unknown[]> = unknown
```

```ts test
type _1 = Expect<Equal<TupleToUnion<[1, 2, 3]>, 1 | 2 | 3>>
type _2 = Expect<Equal<TupleToUnion<readonly ['a', 'b']>, 'a' | 'b'>>
type _3 = Expect<Equal<TupleToUnion<[]>, never>>
```

#### Uses
- [keyof, typeof, and indexed access › Indexed access types](#/keyof-typeof/indexed-access-types)
- [Arrays and tuples › `as const`](#/arrays-tuples/as-const)

#### Hints
- Indexing an array or tuple type with `number` gives the union of its element types.
- It's the same move as `(typeof METHODS)[number]`, minus the `typeof`.

#### Docs
- [Indexed Access Types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)

### 5. `Length`

The length of a tuple, as a literal number type. A tuple's `length` property has a literal type too: for `[string, number]` it is `2`, not `number`.

```ts starter
type Length<T extends readonly unknown[]> = unknown
```

```ts test
type _1 = Expect<Equal<Length<['a', 'b', 'c']>, 3>>
type _2 = Expect<Equal<Length<[]>, 0>>
// @ts-expect-error a string is not a tuple
type _3 = Length<'abc'>
```

#### Uses
- [keyof, typeof, and indexed access › Indexed access types](#/keyof-typeof/indexed-access-types)
- [Arrays and tuples › Tuples](#/arrays-tuples/tuples)

#### Hints
- You don't need a conditional type. Read a property off `T` with indexed access.
- The property is `'length'`.

#### Tips
- On a plain array, `T['length']` is just `number`, since the compiler doesn't know how many elements there are.

#### Docs
- [Object Types: Tuple Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types)

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

#### Uses
- [Type-level puzzles › How to approach these](#/type-puzzles/how-to-approach-these)
- [Conditional types › `infer`](#/conditional-types/infer)

#### Hints
- Match `T` against a tuple with at least one element: `[infer Head, ...unknown[]]`.
- Return `Head` when it matches and `never` when it doesn't. Only the empty tuple fails to match.

#### Tips
- `T[0]` alone gives `undefined` for `[]`, not `never`, which is why the pattern match is worth it.

#### Docs
- [Conditional Types: Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)

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

#### Uses
- [Type-level puzzles › How to approach these](#/type-puzzles/how-to-approach-these)
- [Arrays and tuples › Optional and rest elements](#/arrays-tuples/optional-and-rest-elements)

#### Hints
- Spread works inside tuple types the way it does in array literals: `[...T]` is a copy of `T`.
- Put `U` after the spread for `Push`, before it for `Unshift`.

#### Docs
- [Object Types: Tuple Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types)

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

#### Uses
- [Type-level puzzles › How to approach these](#/type-puzzles/how-to-approach-these)
- [Conditional types › Recursive conditional types](#/conditional-types/recursive-conditional-types)

#### Hints
- Walk the tuple one element at a time: `T extends readonly [infer Head, ...infer Tail]`. The empty tuple is the base case, `false`.
- For each `Head`, `Equal<Head, U> extends true` decides it. If it matches, the answer is `true`; otherwise recurse on `Tail`.

#### Tips
- `U extends T[number]` looks shorter but fails the `false` test, because `false` is assignable to `boolean`. Only `Equal` compares exactly.

#### Docs
- [Conditional Types: Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)

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

#### Uses
- [Template literal types › Parsing with `infer`](#/template-literal-types/parsing-with-infer)
- [Template literal types › Basics](#/template-literal-types/basics)

#### Hints
- Name the characters to strip: `type Space = ' ' | '\n' | '\t'`. A union in a template pattern matches any of its members.
- Strip from the left like `TrimLeft` in the article, with `` `${Space}${infer R}` ``, recursing until nothing matches.
- Then do the same on the right with `` `${infer L}${Space}` ``, and return `S` when neither side matches.

#### Docs
- [Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)

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

#### Uses
- [Template literal types › Parsing with `infer`](#/template-literal-types/parsing-with-infer)
- [Conditional types › The basic form](#/conditional-types/the-basic-form)

#### Hints
- Deal with the empty `From` first: `From extends '' ? S : …`.
- Split `S` around `From` with `` `${infer L}${From}${infer R}` `` and glue the pieces back with `To` in the middle.
- No recursion needed. Placeholders match as little as possible, so `L` stops at the first occurrence.

#### Docs
- [Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)

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

#### Uses
- [Mapped types › Combining with conditional types](#/mapped-types/combining-with-conditional-types)
- [Mapped types › Homomorphic mapped types](#/mapped-types/homomorphic-mapped-types)
- [Conditional types › `infer`](#/conditional-types/infer)

#### Hints
- Start like `Readonly`: `{ readonly [K in keyof T]: … }`, and decide each property's type with a conditional, like `DeepPartial` in the Mapped types article.
- Three cases, in this order: a function stays as it is (match it with `(...args: any[]) => any`), another `object` gets `DeepReadonly` again, anything else stays as it is.
- Arrays need no special case. A homomorphic mapped type over an array produces an array, here a readonly one.

#### Tips
- The function check has to come first, because functions are objects too, and mapping over a function's keys turns it into `{}`.

#### Docs
- [Mapped Types: Mapping Modifiers](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#mapping-modifiers)

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

#### Uses
- [Type-level puzzles › How to approach these](#/type-puzzles/how-to-approach-these)
- [Conditional types › Recursive conditional types](#/conditional-types/recursive-conditional-types)

#### Hints
- Peel off one element: `T extends [infer Head, ...infer Tail]`. The empty tuple is the base case, `[]`.
- If `Head` is itself an array, flatten it and spread it in; otherwise keep it as a single element.
- Either way, spread `Flatten<Tail>` after it: `[...Flatten<Head>, ...Flatten<Tail>]` or `[Head, ...Flatten<Tail>]`.

#### Docs
- [Conditional Types: Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)

### 13. `ObjectFromEntries`

Turn a union of `[key, value]` tuples into an object type.

```ts starter
type ObjectFromEntries<E extends [PropertyKey, unknown]> = unknown
```

```ts test
type _1 = Expect<Equal<ObjectFromEntries<['a', 1] | ['b', 'x']>, { a: 1; b: 'x' }>>
type _2 = Expect<Equal<ObjectFromEntries<never>, {}>>
```

#### Uses
- [Mapped types › Mapping over a union of keys](#/mapped-types/mapping-over-a-union-of-keys)
- [Utility types › Union transformers](#/utility-types/union-transformers)
- [keyof, typeof, and indexed access › Indexed access types](#/keyof-typeof/indexed-access-types)

#### Hints
- The keys are the first element of every entry: `E[0]` is the union `'a' | 'b'`. Map over that.
- For each key `K`, pull its entry out of the union with `Extract<E, [K, unknown]>`, then take element `[1]` of it.

#### Tips
- Mapping over `never` gives `{}`, so the second test needs no special case.

#### Docs
- [Utility Types: `Extract<Type, Union>`](https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union)

### 14. `Chainable`

A builder whose `option(key, value)` accumulates a typed object and whose `get()` returns it. Each call must add a new key to the result type.

One catch: `Equal` treats an intersection such as `{ a: string } & { b: number }` as different from the single object `{ a: string; b: number }`, even though they accept the same values. Passing an intersection through a mapped type, `{ [K in keyof T]: T[K] }`, rebuilds it as one plain object.

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

#### Uses
- [Generics › Defaults](#/generics/defaults)
- [Objects and interfaces › Methods](#/objects/methods)
- [Unions, literals, and intersections › Intersections](#/unions/intersections)
- [Mapped types › Mapping over a union of keys](#/mapped-types/mapping-over-a-union-of-keys)

#### Hints
- `Chainable<T>` is an object type with two methods. `T` is what has been collected so far, starting at `{}`.
- `option` is a generic method, `option<K extends string, V>(key: K, value: V)`, that returns another `Chainable` whose `T` also has `K` mapped to `V`: `T & { [P in K]: V }`.
- `get()` returns `T` flattened with `{ [P in keyof T]: T[P] }`, so `Equal` sees one plain object.

#### Tips
- `V` infers as `string`, not `'ts'`, because an unconstrained type parameter widens literals. `K extends string` keeps `'name'` as a literal, which is what you want for keys.

#### Docs
- [Generics: Generic Parameter Defaults](https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-parameter-defaults)
- [Object Types: Intersection Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types)
