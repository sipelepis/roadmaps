# Conditional types

A conditional type picks one of two types based on whether a type is assignable to another. It is the `if` statement of the type system, and with `infer` it becomes pattern matching.

## The basic form

```ts
type IsString<T> = T extends string ? true : false

type A = IsString<'hello'>   // true
type B = IsString<number>    // false
```

`T extends U ? X : Y` reads: "if `T` is assignable to `U`, then `X`, else `Y`".

## Distribution over unions

When the checked type is a *naked* type parameter and you pass a union, the conditional runs on each member and the results are unioned:

```ts
type ToArray<T> = T extends unknown ? T[] : never
type R = ToArray<string | number>   // string[] | number[]
```

This is how `Exclude` works:

```ts
type Exclude<T, U> = T extends U ? never : T
type R2 = Exclude<'a' | 'b' | 'c', 'a'>   // 'b' | 'c'  (the 'a' branch became never and dropped out)
```

To *prevent* distribution, wrap both sides in a tuple: `[T] extends [U] ? X : Y`.

## `infer`

`infer` declares a type variable inside the `extends` clause and captures whatever matches there.

```ts
type ElementType<T> = T extends (infer U)[] ? U : T
type E = ElementType<string[]>   // string

type MyReturnType<F> = F extends (...args: any[]) => infer R ? R : never
type MyParameters<F> = F extends (...args: infer P) => any ? P : never

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
```

Every function utility type from the previous module is one of these.

## Recursive conditional types

A conditional type can refer to itself, which unwraps nested structures:

```ts
type DeepAwaited<T> = T extends Promise<infer U> ? DeepAwaited<U> : T
type Flatten<T> = T extends (infer U)[] ? Flatten<U> : T

type F = Flatten<number[][][]>   // number
```

TypeScript limits recursion depth (around 1000 instantiations, 50 for non-tail cases), which is plenty for realistic types.

## Filtering keys

Combine with `keyof` and indexed access to select keys by their value type:

```ts
type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T]

interface User { id: number; name: string; age: number }
type NumericKeys = KeysOfType<User, number>   // 'id' | 'age'
```

The mapped type in the middle is the subject of the next module.

```ts playground
type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T extends (infer E)[] ? Unwrap<E>[] : T

type A = Unwrap<Promise<Promise<number>>>       // number
type B = Unwrap<Promise<string>[]>              // string[]
type C = Unwrap<boolean>                        // boolean

// Types have no runtime, so we "print" them with assignments the checker verifies:
const a: A = 1
const b: B = ['x']
const c: C = true
console.log(a, b, c)

// Try: change `const a: A = 1` to a string and read the error.
```

## Exercises

### 1. `IsString`

Implement `IsString<T>`, which is `true` for string types (including literals) and `false` otherwise. A union is checked member by member, so `IsString<string | number>` is `boolean`.

```ts starter
type IsString<T> = unknown
```

```ts test
type _1 = Expect<Equal<IsString<string>, true>>
type _2 = Expect<Equal<IsString<'hi'>, true>>
type _3 = Expect<Equal<IsString<number>, false>>
type _4 = Expect<Equal<IsString<string[]>, false>>
type _5 = Expect<Equal<IsString<boolean>, false>>
type _6 = Expect<Equal<IsString<string | number>, boolean>>
```

#### Uses
- [Conditional types › The basic form](#/conditional-types/the-basic-form)

#### Hints
- Replace `unknown` with a conditional type that checks `T` against `string`.
- Both branches are literal types: `true` and `false`.

#### Tips
- `'hi' extends string` holds because a literal type is a subtype of its primitive. And since `T` is a naked type parameter, `IsString<string | number>` distributes to `true | false`, which is `boolean`.
- Write `true` and `false`, not `boolean`, in the branches. `boolean` in either branch would make every answer `boolean` and the first four tests would fail.

#### Docs
- [Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)

### 2. `ElementOf`

`ElementOf<T>` gives the element type of an array (mutable or `readonly`), and leaves non-arrays unchanged. Use `infer`.

```ts starter
type ElementOf<T> = unknown
```

```ts test
type _1 = Expect<Equal<ElementOf<string[]>, string>>
type _2 = Expect<Equal<ElementOf<readonly number[]>, number>>
type _3 = Expect<Equal<ElementOf<boolean>, boolean>>
type _4 = Expect<Equal<ElementOf<(string | number)[]>, string | number>>
type _5 = Expect<Equal<ElementOf<boolean[][]>, boolean[]>>
```

#### Uses
- [Conditional types › `infer`](#/conditional-types/infer)
- [Arrays and tuples › Readonly arrays](#/arrays-tuples/readonly-arrays)

#### Hints
- Start from `ElementType` in the article, which uses `(infer U)[]`. Try it: the `readonly number[]` test fails.
- A mutable array is assignable to a readonly one, but not the other way round. So match against `readonly (infer U)[]` and both kinds fit.

#### Tips
- Matching the *wider* pattern is the general trick with `infer`: `readonly T[]` accepts both kinds of array, so it is the one to write in an `extends` clause.
- The last test is the reason to stop at one level. `ElementOf<boolean[][]>` is `boolean[]`, not `boolean`; recursing would flatten it and break that assertion.

#### Docs
- [Conditional Types: Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)

### 3. Your own `ReturnType`

Implement `MyReturnType<F>` without using the built-in. For non-function types it should be `never`.

```ts starter
type MyReturnType<F> = unknown
```

```ts test
type _1 = Expect<Equal<MyReturnType<() => string>, string>>
type _2 = Expect<Equal<MyReturnType<(a: number) => Promise<void>>, Promise<void>>>
type _3 = Expect<Equal<MyReturnType<string>, never>>
type _4 = Expect<Equal<MyReturnType<(a: string, b: number) => boolean>, boolean>>
type _5 = Expect<Equal<MyReturnType<{ name: string }>, never>>
```

#### Uses
- [Conditional types › `infer`](#/conditional-types/infer)
- [Functions › Function types](#/functions/function-types)
- [Functions › Rest parameters](#/functions/rest-parameters)

#### Hints
- Check `F` against a function type and put `infer R` where the return type goes.
- To accept any parameter list, write the parameters as a rest parameter: `(...args: any[])`.
- The else branch is `never`.

#### Tips
- `(...args: unknown[])` looks safer but fails: a function that needs a `number` can't accept any `unknown` argument, so `(a: number) => void` doesn't match it. `any[]` sidesteps that.
- This is the rare place `any` is the right answer. It appears only inside a pattern that is matched against, never in a type anyone can hold a value of.

#### Docs
- [Conditional Types: Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)

### 4. Non-distributive check

`IsUnion<T>` should be `true` only when `T` is a union of two or more members.

One thing the article doesn't cover: a distributive conditional applied to `never` gives `never`, whatever its branches say, because the empty union has no members to run on. So `IsUnion<never>` needs its own check, and `[T] extends [never]` is the way to test for `never` without distributing.

```ts starter
type IsUnion<T> = unknown
```

```ts test
type _1 = Expect<Equal<IsUnion<'a' | 'b'>, true>>
type _2 = Expect<Equal<IsUnion<string | number>, true>>
type _3 = Expect<Equal<IsUnion<string>, false>>
type _4 = Expect<Equal<IsUnion<never>, false>>
type _5 = Expect<Equal<IsUnion<'a'>, false>>
type _6 = Expect<Equal<IsUnion<1 | 2 | 3>, true>>
type _7 = Expect<Equal<IsUnion<boolean>, true>>
```

#### Uses
- [Conditional types › Distribution over unions](#/conditional-types/distribution-over-unions)
- [Generics › Defaults](#/generics/defaults)

#### Hints
- Add a second type parameter with a default, `IsUnion<T, Whole = T>`. It keeps a copy of the full union that you never distribute over.
- Inside `T extends unknown ? … : never`, `T` is one member at a time while `Whole` is still the whole union. If `[Whole] extends [T]`, the whole thing fits in a single member, so it was not a union.
- Put the `[T] extends [never] ? false : …` check in front of everything else.

#### Tips
- `boolean` is secretly `true | false`, so `IsUnion<boolean>` is `true`.
- The `Whole = T` default is the standard way to keep an undistributed copy of a type parameter. You will see it in most real-world conditional types that need to look at the union as a whole.
- Remember the two halves of the trick: a bare `T` in the `extends` position distributes, and `[T] extends [U]` does not. Every puzzle in this family is built from those two.

#### Docs
- [Conditional Types: Distributive Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types)
