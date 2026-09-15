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

Parsing takes two pieces of syntax that the Conditional types module covers in depth. Here is enough for this module. A *conditional type* `A extends B ? X : Y` resolves to `X` when `A` is assignable to `B`, and to `Y` otherwise. Inside `B` you can write `infer Name` to capture whatever matched at that spot, then use `Name` in the `X` branch:

```ts
type AfterGet<S extends string> = S extends `get${infer Rest}` ? Rest : never
type A = AfterGet<'getName'>   // 'Name'
type B = AfterGet<'setName'>   // never
```

In a template literal, each `infer` placeholder captures a substring. Placeholders match as little as possible, except the last, which takes the rest. A conditional type can also refer to itself, which is how these examples walk the whole string:

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

#### Uses
- [Template literal types › Basics](#/template-literal-types/basics)
- [Template literal types › Intrinsic string utilities](#/template-literal-types/intrinsic-string-utilities)

#### Hints
- Write a template literal type that starts with `on` and interpolates `T`.
- Wrap `T` in `Capitalize<…>` inside the placeholder.

#### Tips
- You don't need anything special for the union test. A union inside a template literal type expands to one string per member.

#### Docs
- [Template Literal Types: `Capitalize<StringType>`](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html#capitalizestringtype)

### 2. Getters

`Getters<T>` maps every property `foo` of `T` to a method `getFoo(): T['foo']`.

```ts starter
type Getters<T> = unknown
```

```ts test
interface User { id: number; name: string }

type _1 = Expect<Equal<Getters<User>, { getId: () => number; getName: () => string }>>
```

#### Uses
- [Template literal types › With key remapping](#/template-literal-types/with-key-remapping)
- [Mapped types › Key remapping with `as`](#/mapped-types/key-remapping-with-as)

#### Hints
- Map over `keyof T` and rename each key with an `as` clause that builds `` `get${…}` ``.
- `Capitalize` only takes strings, and `keyof T` may include `number` and `symbol`. Intersect first: `Capitalize<string & K>`.
- The value is a function type with no parameters that returns `T[K]`.

#### Docs
- [Mapped Types: Key Remapping via `as`](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#key-remapping-via-as)

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

#### Uses
- [Template literal types › Parsing with `infer`](#/template-literal-types/parsing-with-infer)
- [Template literal types › Real-world example: route params](#/template-literal-types/real-world-example-route-params)

#### Hints
- `` `${string}:${infer Name}` `` skips everything up to the first `:` and captures the rest.
- There are two cases. A param followed by more path, `` `${string}:${infer Name}/${infer Rest}` ``, gives `Name` plus whatever `Rest` contains, so recurse on `Rest`. A param at the very end gives just `Name`.
- Check the longer pattern first, and fall back to `never` when neither matches.

#### Tips
- Unioning with the recursive result collects every name, and `never` disappears from a union, so a path with no params adds nothing.

#### Docs
- [Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
- [Conditional Types: Inferring Within Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#inferring-within-conditional-types)

### 4. Typed `getParam`

Use `RouteParams` to implement `getParam`, which only accepts a parameter name that exists in the route. It reads from a plain key/value object. Each exercise is its own file, so paste your `RouteParams` from the previous exercise above the function.

One thing to know: a type parameter constrained to `string` keeps the literal you pass. Given `function f<P extends string>(p: P)`, the call `f('/users/:id')` infers `P` as `'/users/:id'`, not `string`, so you can feed `P` to other types.

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

#### Uses
- [Template literal types › Real-world example: route params](#/template-literal-types/real-world-example-route-params)
- [keyof, typeof, and indexed access › Putting them together](#/keyof-typeof/putting-them-together)
- [Utility types › Object transformers](#/utility-types/object-transformers)

#### Hints
- Make `getParam` generic over the route, `<P extends string>`, and type `route` as `P`.
- `name` is `RouteParams<P>`. `params` can be a `Record<string, string>`.
- The body is one line: look `name` up in `params`.

#### Tips
- `route` is never read at runtime. It is there so TypeScript can infer `P`, and that is all it does.

#### Docs
- [Generics: Using Type Parameters in Generic Constraints](https://www.typescriptlang.org/docs/handbook/2/generics.html#using-type-parameters-in-generic-constraints)
- [Utility Types: `Record<Keys, Type>`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
