# keyof, typeof, and indexed access

These three operators let you derive types from other types and from values, so that one source of truth drives everything. They are the building blocks of every advanced type on this roadmap.

## `keyof`

`keyof T` is the union of `T`'s property names.

```ts
interface User { id: number; name: string; email: string }
type UserKey = keyof User   // 'id' | 'name' | 'email'
```

## `typeof` in type positions

In a type, `typeof value` gives the type of a variable. This is different from the runtime `typeof` operator.

```ts
const config = { port: 3000, host: 'localhost' }
type Config = typeof config   // { port: number; host: string }
```

Combined with `as const`, `typeof` captures literal types:

```ts
const ROLES = ['admin', 'editor', 'viewer'] as const
type Role = (typeof ROLES)[number]   // 'admin' | 'editor' | 'viewer'
```

## Indexed access types

`T[K]` is the type of property `K` on `T`. `K` can be a union, in which case you get a union of property types.

```ts
type Email = User['email']             // string
type IdOrName = User['id' | 'name']    // number | string
type AllValues = User[keyof User]      // number | string
type Elem = string[][number]           // string
```

## Putting them together

The classic example is a type-safe property getter:

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const u: User = { id: 1, name: 'Ada', email: 'a@b.c' }
getProp(u, 'name')    // string
getProp(u, 'phone')   // error: 'phone' is not assignable to 'id' | 'name' | 'email'
```

And the `as const` object enum from the Enums module:

```ts
const HttpStatus = { OK: 200, NotFound: 404, ServerError: 500 } as const
type StatusName = keyof typeof HttpStatus                  // 'OK' | 'NotFound' | 'ServerError'
type StatusCode = (typeof HttpStatus)[StatusName]          // 200 | 404 | 500
```

## `keyof` on other types

- `keyof any` is `string | number | symbol`: the set of things that can be a key.
- `keyof string[]` includes `number` and every array method name.
- On an index signature `{ [k: string]: V }`, `keyof` is `string | number`.

```ts playground
const settings = {
  theme: 'dark',
  fontSize: 14,
  showLineNumbers: true,
} as const

type Settings = typeof settings
type SettingName = keyof Settings

function get<K extends SettingName>(key: K): Settings[K] {
  return settings[key]
}

const theme = get('theme')      // 'dark'
const size = get('fontSize')    // 14
console.log(theme, size)

// Try: get('fontsize') — autocomplete knows the valid keys.
```

## Exercises

### 1. `pluck`

Implement `pluck` so it returns the given property from every item, with a precise return type.

```ts starter
function pluck(items, key) {
  throw new Error('todo')
}
```

```ts test
const users = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]

test('extracts a property', () => {
  expect(pluck(users, 'name')).toEqual(['Ada', 'Grace'])
  expect(pluck(users, 'id')).toEqual([1, 2])
})

type _1 = Expect<Equal<ReturnType<typeof pluck<{ id: number; name: string }, 'name'>>, string[]>>
// @ts-expect-error not a key of the items
pluck(users, 'email')
```

#### Uses
- [keyof, typeof, and indexed access › Putting them together](#/keyof-typeof/putting-them-together)
- [keyof, typeof, and indexed access › Indexed access types](#/keyof-typeof/indexed-access-types)
- [Generics › Constraints](#/generics/constraints)

#### Hints
- You need two type parameters: `T` for the item type and `K` for the key, constrained so only real keys of `T` are accepted.
- The return type is an array of whatever `T[K]` is.
- `items.map(item => item[key])` does the work.

#### Tips
- `T[K][]` reads as "array of `T[K]`". `Array<T[K]>` is the same type if that reads better to you.

#### Docs
- [Generics: Using Type Parameters in Generic Constraints](https://www.typescriptlang.org/docs/handbook/2/generics.html#using-type-parameters-in-generic-constraints)
- [Indexed Access Types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)

### 2. Status codes

Derive `StatusName` and `StatusCode` from the `HttpStatus` object without repeating the values.

```ts starter
const HttpStatus = { OK: 200, NotFound: 404, ServerError: 500 } as const

type StatusName = unknown
type StatusCode = unknown
```

```ts test
type _1 = Expect<Equal<StatusName, 'OK' | 'NotFound' | 'ServerError'>>
type _2 = Expect<Equal<StatusCode, 200 | 404 | 500>>
```

#### Uses
- [keyof, typeof, and indexed access › `keyof`](#/keyof-typeof/keyof)
- [keyof, typeof, and indexed access › `typeof` in type positions](#/keyof-typeof/typeof-in-type-positions)
- [keyof, typeof, and indexed access › Putting them together](#/keyof-typeof/putting-them-together)

#### Hints
- `HttpStatus` is a value, so you need `typeof HttpStatus` before any other type operator can touch it.
- The names are the keys of that type. The codes are the values: index into it with the key union.
- `(typeof HttpStatus)[StatusName]` reuses the answer to the first half.

#### Tips
- Without `as const` the values widen to `number` and `StatusCode` would be plain `number`.

#### Docs
- [Keyof Type Operator](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html#the-keyof-type-operator)
- [Indexed Access Types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)

### 3. Type-safe setter

Implement `setProp` so that `value` must match the type of the chosen key. It should mutate and return the object.

```ts starter
function setProp(obj, key, value) {
  throw new Error('todo')
}
```

```ts test
test('sets a property', () => {
  const u = { id: 1, name: 'Ada' }
  expect(setProp(u, 'name', 'Grace').name).toBe('Grace')
})

// @ts-expect-error value must be a number for `id`
setProp({ id: 1, name: 'Ada' }, 'id', 'one')
```

#### Uses
- [keyof, typeof, and indexed access › Putting them together](#/keyof-typeof/putting-them-together)
- [keyof, typeof, and indexed access › Indexed access types](#/keyof-typeof/indexed-access-types)
- [Generics › Constraints](#/generics/constraints)

#### Hints
- Start from `getProp` in the article: one type parameter for the object, one constrained to its keys.
- `value` is typed with indexed access, so it depends on which key was passed.
- The body is two lines: assign `obj[key] = value`, then return `obj`.

#### Tips
- `K` is inferred as the literal `'id'`, not `string`, because it is constrained to `keyof T`. That is what makes `T[K]` precise.

#### Docs
- [Generics: Using Type Parameters in Generic Constraints](https://www.typescriptlang.org/docs/handbook/2/generics.html#using-type-parameters-in-generic-constraints)
