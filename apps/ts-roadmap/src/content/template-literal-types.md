# Template literal types

Template literal types build string types the same way template literals build strings. With unions they expand combinatorially, and with `infer` they parse strings at the type level.

## Basics

```ts
type Greeting = `hello ${string}`
const g: Greeting = 'hello world'   // ok
const h: Greeting = 'hi world'      // error

type Size = 'sm' | 'md' | 'lg'
type Color = 'red' | 'blue'
type Variant = `${Size}-${Color}`   // 'sm-red' | 'sm-blue' | 'md-red' | ...
```

## Intrinsic string utilities

`Uppercase`, `Lowercase`, `Capitalize`, and `Uncapitalize` are built into the compiler:

```ts
type EventName<T extends string> = `on${Capitalize<T>}`
type Click = EventName<'click'>   // 'onClick'
```

## With key remapping

This is the combination that powers typed event emitters and getters:

```ts
type Handlers<T> = {
  [K in keyof T as `on${Capitalize<string & K>}Change`]: (value: T[K]) => void
}

interface Form { name: string; age: number }
type FormHandlers = Handlers<Form>
// { onNameChange: (value: string) => void; onAgeChange: (value: number) => void }
```

The `string & K` intersection drops `number | symbol` keys, which `Capitalize` cannot take.

## Parsing with `infer`

Inside a conditional type, `infer` in a template literal captures substrings. Placeholders match as little as possible, except the last, which takes the rest.

```ts
type Split<S extends string> = S extends `${infer Head},${infer Tail}` ? [Head, ...Split<Tail>] : [S]
type Parts = Split<'a,b,c'>   // ['a', 'b', 'c']

type TrimLeft<S extends string> = S extends ` ${infer R}` ? TrimLeft<R> : S
```

## Real-world example: route params

```ts
type Params<P extends string> =
  P extends `${string}:${infer Name}/${infer Rest}` ? Name | Params<Rest>
  : P extends `${string}:${infer Name}` ? Name
  : never

type P = Params<'/users/:id/posts/:postId'>   // 'id' | 'postId'
```

Type-safe routers, CSS-in-TS, and SQL builders lean on exactly this.

## Limits

Unions expand multiplicatively and TypeScript caps template literal unions at 100,000 members. `${number}` and `${string}` placeholders are patterns, not enumerations: `${number}px` accepts `'12px'` but you cannot extract the `12` as a numeric type.

```ts playground
type CssUnit = 'px' | 'rem' | '%'
type Length = `${number}${CssUnit}`

function setWidth(el: { style: Record<string, string> }, width: Length) {
  el.style.width = width
}

const el = { style: {} as Record<string, string> }
setWidth(el, '12px')
setWidth(el, '1.5rem')
console.log(el.style)

// Try: setWidth(el, '12pt')
```

## Exercises

### 1. Event names

`EventName<T>` turns `'click'` into `'onClick'`.

```ts starter
type EventName<T extends string> = unknown
```

```ts test
type _1 = Expect<Equal<EventName<'click'>, 'onClick'>>
type _2 = Expect<Equal<EventName<'focus' | 'blur'>, 'onFocus' | 'onBlur'>>
```

### 2. Getters

`Getters<T>` maps every property `foo` of `T` to a method `getFoo(): T['foo']`.

```ts starter
type Getters<T> = unknown
```

```ts test
interface User { id: number; name: string }

type _1 = Expect<Equal<Getters<User>, { getId: () => number; getName: () => string }>>
```

### 3. Route parameters

`RouteParams<P>` extracts every `:param` segment name from a path as a union, or `never` when there are none.

```ts starter
type RouteParams<P extends string> = unknown
```

```ts test
type _1 = Expect<Equal<RouteParams<'/users/:id'>, 'id'>>
type _2 = Expect<Equal<RouteParams<'/users/:id/posts/:postId'>, 'id' | 'postId'>>
type _3 = Expect<Equal<RouteParams<'/about'>, never>>
```

### 4. Typed `getParam`

Use `RouteParams` (or write your own) to implement `getParam`, which only accepts a parameter name that exists in the route. It reads from a plain key/value object.

```ts starter
function getParam(route, params, name): string {
  throw new Error('todo')
}
```

```ts test
test('reads a param', () => {
  expect(getParam('/users/:id', { id: '42' }, 'id')).toBe('42')
})

// @ts-expect-error `slug` is not a param of this route
getParam('/users/:id', { id: '42' }, 'slug')
```
