# Mapped types

A mapped type builds a new object type by iterating over the keys of another. It is the `for` loop of the type system, and it is how `Partial`, `Readonly`, `Pick`, and `Record` are implemented.

## The basic form

```ts
type Optional<T> = { [K in keyof T]?: T[K] }         // this is Partial
type Stringified<T> = { [K in keyof T]: string }

interface User { id: number; name: string }
type S = Stringified<User>   // { id: string; name: string }
```

`[K in keyof T]` iterates every key; `T[K]` reads the original property type.

## Modifiers

Add or remove `readonly` and `?` with `+` and `-`:

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type Concrete<T> = { [K in keyof T]-?: T[K] }          // this is Required
type Frozen<T> = { +readonly [K in keyof T]: T[K] }    // Readonly; the + is optional
```

## Homomorphic mapped types

When you map over `keyof T`, TypeScript preserves each property's `readonly` and `?` modifiers (unless you change them) and, when `T` is an array or tuple, produces an array or tuple. That is why `Partial<[number, string]>` is `[number?, string?]` rather than a bag of numeric keys.

## Mapping over a union of keys

You don't have to start from `keyof`:

```ts
type Flags = { [K in 'a' | 'b']: boolean }   // { a: boolean; b: boolean }
type Record<K extends keyof any, V> = { [P in K]: V }
```

## Key remapping with `as`

Since TS 4.1 you can rename or filter keys:

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
}
type G = Getters<User>   // { getId: () => number; getName: () => string }

type OnlyStrings<T> = { [K in keyof T as T[K] extends string ? K : never]: T[K] }
```

Mapping a key to `never` removes it. The template literal part is the next module.

## Combining with conditional types

```ts
type Nullable<T> = { [K in keyof T]: T[K] | null }
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }
```

```ts playground
interface Settings {
  readonly theme: 'light' | 'dark'
  fontSize: number
  plugins?: string[]
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type Complete<T> = { [K in keyof T]-?: T[K] }
type Editable = Complete<Mutable<Settings>>

const s: Editable = { theme: 'dark', fontSize: 14, plugins: [] }
s.theme = 'light'      // allowed: readonly removed
console.log(s)

// Try: remove `plugins` from the literal — Complete made it required.
```

## Exercises

### 1. `MyPartial`

Reimplement `Partial<T>` as a mapped type.

```ts starter
type MyPartial<T> = unknown
```

```ts test
interface User { id: number; name: string }

type _1 = Expect<Equal<MyPartial<User>, { id?: number; name?: string }>>
type _2 = Expect<Equal<MyPartial<User>, Partial<User>>>
```

### 2. `Mutable`

Implement `Mutable<T>`, removing `readonly` from every property.

```ts starter
type Mutable<T> = unknown
```

```ts test
type Frozen = { readonly x: number; readonly y: number }

type _1 = Expect<Equal<Mutable<Frozen>, { x: number; y: number }>>

test('a mutable copy can be changed', () => {
  const p: Mutable<Frozen> = { x: 1, y: 2 }
  p.x = 10
  expect(p.x).toBe(10)
})
```

### 3. `Nullable`

Implement `Nullable<T>` so that every property may also be `null`.

```ts starter
type Nullable<T> = unknown
```

```ts test
type _1 = Expect<Equal<Nullable<{ a: string; b: number }>, { a: string | null; b: number | null }>>
```

### 4. Pick by value type

`PickByType<T, V>` keeps only the properties of `T` whose type is assignable to `V`. Use key remapping with `as`.

```ts starter
type PickByType<T, V> = unknown
```

```ts test
interface Mixed { id: number; name: string; age: number; active: boolean }

type _1 = Expect<Equal<PickByType<Mixed, number>, { id: number; age: number }>>
type _2 = Expect<Equal<PickByType<Mixed, string>, { name: string }>>
type _3 = Expect<Equal<PickByType<Mixed, symbol>, {}>>
```
