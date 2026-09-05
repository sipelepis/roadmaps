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

Implement `IsString<T>`, which is `true` for string types (including literals) and `false` otherwise.

```ts starter
type IsString<T> = unknown
```

```ts test
type _1 = Expect<Equal<IsString<string>, true>>
type _2 = Expect<Equal<IsString<'hi'>, true>>
type _3 = Expect<Equal<IsString<number>, false>>
type _4 = Expect<Equal<IsString<string[]>, false>>
```

### 2. `ElementOf`

`ElementOf<T>` gives the element type of an array (mutable or `readonly`), and leaves non-arrays unchanged. Use `infer`. Hint: `readonly (infer U)[]` matches both kinds of array.

```ts starter
type ElementOf<T> = unknown
```

```ts test
type _1 = Expect<Equal<ElementOf<string[]>, string>>
type _2 = Expect<Equal<ElementOf<readonly number[]>, number>>
type _3 = Expect<Equal<ElementOf<boolean>, boolean>>
```

### 3. Your own `ReturnType`

Implement `MyReturnType<F>` without using the built-in. For non-function types it should be `never`.

```ts starter
type MyReturnType<F> = unknown
```

```ts test
type _1 = Expect<Equal<MyReturnType<() => string>, string>>
type _2 = Expect<Equal<MyReturnType<(a: number) => Promise<void>>, Promise<void>>>
type _3 = Expect<Equal<MyReturnType<string>, never>>
```

### 4. Non-distributive check

`IsUnion<T>` should be `true` only when `T` is a union of two or more members. Hint: distribute over `T` while holding a non-distributed copy of it in a tuple.

```ts starter
type IsUnion<T> = unknown
```

```ts test
type _1 = Expect<Equal<IsUnion<'a' | 'b'>, true>>
type _2 = Expect<Equal<IsUnion<string | number>, true>>
type _3 = Expect<Equal<IsUnion<string>, false>>
type _4 = Expect<Equal<IsUnion<never>, false>>
```
