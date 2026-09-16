# Utility types

TypeScript ships a set of built-in generic types for the transformations you need most often. They are all written with the mapped and conditional types you'll meet in later modules, so you could define every one of them yourself. Knowing them by name saves a lot of typing.

## Object transformers

| Utility | Effect |
| --- | --- |
| `Partial<T>` | every property optional |
| `Required<T>` | every property required |
| `Readonly<T>` | every property readonly |
| `Pick<T, K>` | only the properties in `K` |
| `Omit<T, K>` | every property except `K` |
| `Record<K, V>` | object with keys `K` and values `V` |

```ts
interface User { id: number; name: string; email: string; password: string }

type UserPatch = Partial<User>             // for update endpoints
type PublicUser = Omit<User, 'password'>   // for API responses
type Credentials = Pick<User, 'email' | 'password'>
type UsersById = Record<number, User>
```

`Partial` is shallow: nested objects stay required.

## Union transformers

| Utility | Effect |
| --- | --- |
| `Exclude<T, U>` | remove members of `T` assignable to `U` |
| `Extract<T, U>` | keep only members assignable to `U` |
| `NonNullable<T>` | remove `null` and `undefined` |

```ts
type Method = 'GET' | 'POST' | 'DELETE'
type Safe = Exclude<Method, 'DELETE'>       // 'GET' | 'POST'
type Name = NonNullable<string | null>      // string
```

## Function utilities

| Utility | Effect |
| --- | --- |
| `ReturnType<F>` | what `F` returns |
| `Parameters<F>` | tuple of `F`'s parameters |
| `ConstructorParameters<C>` | tuple of a class's constructor params |
| `InstanceType<C>` | instance type of a class |
| `Awaited<T>` | unwraps a Promise (recursively) |

```ts
async function load() { return { items: [1, 2] } }
type Loaded = Awaited<ReturnType<typeof load>>   // { items: number[] }
```

These are indispensable when a library exports a function but not the types it uses.

## String utilities

`Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize` operate on string literal types. They pair with template literal types later on.

## `satisfies` versus utilities

Sometimes what you want isn't a new type but a check that a value fits a shape *while keeping its inferred type*. That is `satisfies`, covered in Advanced patterns.

```ts playground
interface Todo {
  id: number
  title: string
  done: boolean
  tags: string[]
}

type TodoDraft = Omit<Todo, 'id'>
type TodoPatch = Partial<Omit<Todo, 'id'>>

let nextId = 1
const todos: Record<number, Todo> = {}

function create(draft: TodoDraft): Todo {
  const todo = { id: nextId++, ...draft }
  todos[todo.id] = todo
  return todo
}

function update(id: number, patch: TodoPatch): Todo {
  return (todos[id] = { ...todos[id], ...patch })
}

create({ title: 'Learn utility types', done: false, tags: ['ts'] })
console.log(update(1, { done: true }))

// Try: update(1, { id: 9 }) — Omit removed id from the patch type.
```

## Exercises

### 1. Partial update

Implement `updateUser`, returning a *new* user with the fields from `patch` applied. Type `patch` so any subset of `User` is allowed.

```ts starter
interface User { id: number; name: string; email: string }

function updateUser(user: User, patch): User {
  throw new Error('todo')
}
```

```ts test
const ada: User = { id: 1, name: 'Ada', email: 'ada@x.io' }

test('applies a partial patch', () => {
  expect(updateUser(ada, { name: 'Ada L.' })).toEqual({ id: 1, name: 'Ada L.', email: 'ada@x.io' })
  expect(updateUser(ada, { id: 2, email: 'b@x.io' })).toEqual({ id: 2, name: 'Ada', email: 'b@x.io' })
})
test('an empty patch changes nothing', () => {
  expect(updateUser(ada, {})).toEqual({ id: 1, name: 'Ada', email: 'ada@x.io' })
})
test('does not mutate', () => {
  updateUser(ada, { email: 'new@x.io' })
  expect(ada.email).toBe('ada@x.io')
  expect(updateUser(ada, {}) === ada).toBe(false)
})

type _1 = Expect<Equal<Parameters<typeof updateUser>[1], Partial<User>>>
```

#### Uses
- [Utility types › Object transformers](#/utility-types/object-transformers)
- [Reference › Built-in utility types](#/reference/built-in-utility-types)
- [Reference › Objects and JSON](#/reference/objects-and-json)

#### Hints
- One utility from the table makes every property of `User` optional. Use it as the type of `patch`.
- Build a new object instead of changing `user`: spread `user` first, then `patch`, into one object literal.
- In `{ ...a, ...b }` later spreads win, so any field present in `patch` overrides the one from `user`.

#### Tips
- `Partial` is shallow. A nested object in the patch replaces the old one wholesale; it is not merged.
- Spread order is the whole implementation: `{ ...user, ...patch }` lets the patch win, `{ ...patch, ...user }` would silently ignore it.
- An explicitly `undefined` field still overwrites. `{ ...user, ...{ name: undefined } }` gives `name: undefined`, because spread copies the key whether or not its value is useful.

#### Docs
- [Utility Types: `Partial<Type>`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)
- [MDN: Spread in object literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#spread_in_object_literals)

### 2. Strip the password

Define `PublicUser` from `User` without the `password` field using a utility type, and implement `toPublic`.

```ts starter
interface User { id: number; name: string; password: string }

type PublicUser = User

function toPublic(user: User): PublicUser {
  throw new Error('todo')
}
```

```ts test
test('removes the password', () => {
  expect(toPublic({ id: 1, name: 'Ada', password: 'hunter2' })).toEqual({ id: 1, name: 'Ada' })
  expect(toPublic({ id: 7, name: 'Grace', password: 'cobol' })).toEqual({ id: 7, name: 'Grace' })
})

type _1 = Expect<Equal<keyof PublicUser, 'id' | 'name'>>
type _2 = Expect<Equal<PublicUser, { id: number; name: string }>>
```

#### Uses
- [Utility types › Object transformers](#/utility-types/object-transformers)
- [Reference › Built-in utility types](#/reference/built-in-utility-types)

#### Hints
- Look for the utility that removes keys rather than keeping them.
- `Omit<User, 'password'>` is the type. For the value, return a new object with just `id` and `name`.

#### Tips
- Returning `user` itself would type-check (an object with extra properties still fits `PublicUser`) but would leak the password at runtime. The type removes the field, the code has to as well.
- `Omit` does not check its keys against `T`. `Omit<User, 'passwrod'>` compiles and removes nothing, which is the one sharp edge it has over `Pick`.
- Destructuring says it in one line: `const { password, ...rest } = user; return rest`. The name `password` then appears exactly once, so a rename can't leave the field behind.

#### Docs
- [Utility Types: `Omit<Type, Keys>`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)

### 3. Inventory record

Type `inventory` as a `Record` keyed by `Fruit` so every fruit *must* be present, and implement `totalStock`.

```ts starter
type Fruit = 'apple' | 'banana' | 'cherry'

const inventory = { apple: 3, banana: 0, cherry: 12 }

function totalStock(inv): number {
  throw new Error('todo')
}
```

```ts test
test('sums stock', () => {
  expect(totalStock(inventory)).toBe(15)
  expect(totalStock({ apple: 1, banana: 2, cherry: 4 })).toBe(7)
})
test('no stock is 0', () => {
  expect(totalStock({ apple: 0, banana: 0, cherry: 0 })).toBe(0)
})

type _1 = Expect<Equal<Parameters<typeof totalStock>[0], Record<Fruit, number>>>
// @ts-expect-error missing a fruit
totalStock({ apple: 1, banana: 2 })
```

#### Uses
- [Utility types › Object transformers](#/utility-types/object-transformers)
- [Basic types › Literal types](#/basic-types/literal-types)
- [Reference › Objects and JSON](#/reference/objects-and-json)

#### Hints
- `Record<Fruit, number>` means "an object with exactly the keys `'apple'`, `'banana'` and `'cherry'`, each a number". Use it on both `inventory` and `inv`.
- To add the values up, `Object.values(inv)` gives a `number[]`, and `reduce` sums it.

#### Tips
- `Record<string, number>` would accept a missing fruit. Keying by the union is what makes every fruit required.
- `Object.values` on a `Record<Fruit, number>` is typed `number[]`, so `reduce((a, b) => a + b, 0)` needs no annotations at all.
- Adding a fourth fruit to the union then makes `inventory` an error until you give it a count. That compile error is the reason to key by the union instead of by `string`.

#### Docs
- [Utility Types: `Record<Keys, Type>`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
- [MDN: `Object.values()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values)
