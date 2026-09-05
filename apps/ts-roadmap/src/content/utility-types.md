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
})
test('does not mutate', () => {
  updateUser(ada, { email: 'new@x.io' })
  expect(ada.email).toBe('ada@x.io')
})

type _1 = Expect<Equal<Parameters<typeof updateUser>[1], Partial<User>>>
```

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
})

type _1 = Expect<Equal<keyof PublicUser, 'id' | 'name'>>
```

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
})

type _1 = Expect<Equal<Parameters<typeof totalStock>[0], Record<Fruit, number>>>
// @ts-expect-error missing a fruit
totalStock({ apple: 1, banana: 2 })
```
