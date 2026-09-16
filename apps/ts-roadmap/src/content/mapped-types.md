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
type _3 = Expect<Equal<MyPartial<{ readonly a: string; b?: boolean }>, { readonly a?: string; b?: boolean }>>
type _4 = Expect<Equal<MyPartial<{ nested: { x: number } }>, { nested?: { x: number } }>>
```

#### Uses
- [Mapped types › The basic form](#/mapped-types/the-basic-form)
- [keyof, typeof, and indexed access › Indexed access types](#/keyof-typeof/indexed-access-types)

#### Hints
- Iterate every key with `[K in keyof T]` and keep each property's type with `T[K]`.
- A `?` right after the closing bracket makes each property optional.

#### Tips
- Mapping over `keyof T` makes this *homomorphic*, which is why the third test keeps `readonly a` readonly. Map over a different key union and every modifier is lost.
- It is shallow, as the fourth test shows: `nested` becomes optional, but `{ x: number }` inside it is untouched. A `DeepPartial` needs a recursive conditional.

#### Docs
- [Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)

### 2. `Mutable`

Implement `Mutable<T>`, removing `readonly` from every property.

```ts starter
type Mutable<T> = unknown
```

```ts test
type Frozen = { readonly x: number; readonly y: number }

type _1 = Expect<Equal<Mutable<Frozen>, { x: number; y: number }>>
type _2 = Expect<Equal<Mutable<{ readonly id: string; readonly nick?: string }>, { id: string; nick?: string }>>

test('a mutable copy can be changed', () => {
  const p: Mutable<Frozen> = { x: 1, y: 2 }
  p.x = 10
  expect(p.x).toBe(10)
})
```

#### Uses
- [Mapped types › Modifiers](#/mapped-types/modifiers)

#### Hints
- Copy every property unchanged with `[K in keyof T]: T[K]`, then change only the modifier.
- A `-` in front of `readonly` removes it: `-readonly [K in keyof T]`.

#### Tips
- `readonly` only exists at compile time. Removing it changes what the checker allows, not the object.
- `-readonly` removes the modifier; a bare `readonly` would add it. The `+` form (`+readonly`) is legal and means the same as writing nothing, so it is rarely used.
- Note what the second test does *not* ask for: `nick?` stays optional. You are changing one modifier, so leave the `?` alone.

#### Docs
- [Mapped Types: Mapping Modifiers](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#mapping-modifiers)

### 3. `Nullable`

Implement `Nullable<T>` so that every property may also be `null`.

```ts starter
type Nullable<T> = unknown
```

```ts test
type _1 = Expect<Equal<Nullable<{ a: string; b: number }>, { a: string | null; b: number | null }>>
type _2 = Expect<Equal<Nullable<{ readonly id: number; tags?: string[] }>, { readonly id: number | null; tags?: string[] | null }>>
type _3 = Expect<Equal<Nullable<{ inner: { x: number } }>, { inner: { x: number } | null }>>
```

#### Uses
- [Mapped types › The basic form](#/mapped-types/the-basic-form)
- [Unions, literals, and intersections › `null` and `undefined` in unions](#/unions/null-and-undefined-in-unions)

#### Hints
- Map over `keyof T` like `MyPartial`, but keep the properties required.
- The value type is the original `T[K]` in a union with `null`.

#### Tips
- Don't add `-?`. The second test keeps `tags?` optional, so the `?` has to survive, and it does automatically because you are mapping over `keyof T`.
- On an optional property the value type already includes `undefined`, so `tags?: string[] | null` really means `string[] | null | undefined`. That is what the test asserts.

#### Docs
- [Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)

### 4. Pick by value type

`PickByType<T, V>` keeps only the properties of `T` whose type is assignable to `V`. Use key remapping with `as`.

You need one piece of syntax from the Conditional types module: `A extends B ? X : Y` is a *conditional type*. It resolves to `X` when `A` is assignable to `B`, and to `Y` otherwise. For example, `'hi' extends string ? 'yes' : 'no'` is `'yes'`.

```ts starter
type PickByType<T, V> = unknown
```

```ts test
interface Mixed { id: number; name: string; age: number; active: boolean }

type _1 = Expect<Equal<PickByType<Mixed, number>, { id: number; age: number }>>
type _2 = Expect<Equal<PickByType<Mixed, string>, { name: string }>>
type _3 = Expect<Equal<PickByType<Mixed, symbol>, {}>>
type _4 = Expect<Equal<PickByType<Mixed, string | boolean>, { name: string; active: boolean }>>
type _5 = Expect<Equal<PickByType<{ id: string | number; slug: string }, string>, { slug: string }>>
type _6 = Expect<Equal<PickByType<{ readonly a: number; b: string }, number>, { readonly a: number }>>
```

#### Uses
- [Mapped types › Key remapping with `as`](#/mapped-types/key-remapping-with-as)

#### Hints
- Mapping a key to `never` in the `as` clause drops that property. Keep `T[K]` as the value.
- After `as`, write a conditional type: when `T[K]` is assignable to `V`, the key stays `K`, otherwise it becomes `never`.
- `OnlyStrings` in the article is this exact pattern with `string` in place of `V`.

#### Tips
- An `as` clause that filters keys still keeps each property's `readonly` and `?`, because you are still mapping over `keyof T`.
- Test the *property* type against `V`, not the other way round. `PickByType<{ id: string | number }, string>` drops `id`, because `string | number` is not assignable to `string`.
- `never` in an `as` clause deletes the key. It is the only way to remove a property from a mapped type, and it is how `Omit` is built.

#### Docs
- [Mapped Types: Key Remapping via `as`](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#key-remapping-via-as)
