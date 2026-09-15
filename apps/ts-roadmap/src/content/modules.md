# Modules

TypeScript uses standard ES modules: `import` and `export`. A file with at least one `import` or `export` is a module with its own scope; a file with none is a *script* whose declarations are global. Under `moduleDetection: "force"` (used by this playground) every file is a module.

## Exports and imports

```ts
// math.ts
export const PI = 3.14159
export function area(r: number) { return PI * r * r }
export default class Circle { constructor(public r: number) {} }

// main.ts
import Circle, { PI, area } from './math'
import * as math from './math'
```

Prefer named exports. They rename consistently, autocomplete better, and tree-shake cleanly. Default exports invite every importer to pick a different name.

## Type-only imports and exports

Types are erased, so importing one for a value-level import is wasteful and can create circular-dependency surprises. Mark them:

```ts
import type { User } from './types'
import { type Config, loadConfig } from './config'   // inline form
export type { User }
```

With `verbatimModuleSyntax` enabled, the compiler *requires* this for type-only imports. Turn it on in new projects.

## Module-private state

Anything not exported is private to the file. This is the simplest way to get encapsulation without a class:

```ts
let nextId = 0
export function createId() { return ++nextId }
```

## Re-exports and barrels

```ts
export * from './users'
export { area as circleArea } from './math'
```

An `index.ts` that re-exports a folder's public API is called a barrel. Handy for consumers, but over-used barrels hurt build times and make circular imports easy to create.

## Resolution and `tsconfig`

`module` and `moduleResolution` control how the compiler finds and emits imports. For modern code:

- Bundled apps: `"module": "esnext"`, `"moduleResolution": "bundler"`.
- Node libraries: `"module": "nodenext"`, and write `.js` extensions in relative imports because that is what Node needs at runtime.

## Declaration files

`.d.ts` files describe the types of JavaScript code without implementing it. Libraries ship them (`types` in `package.json`) or the community provides them via `@types/*`. You can write your own for an untyped dependency:

```ts
// globals.d.ts
declare module 'legacy-lib' {
  export function doThing(x: string): number
}
```

## Namespaces

`namespace` is a pre-ES-modules way to group code. You will meet it in old code and in `.d.ts` files; do not use it in new code.

```ts playground
// This file is a module because of the exports below.
export interface Config {
  port: number
  host: string
  debug: boolean
}

export const defaults: Config = { port: 3000, host: 'localhost', debug: false }

let instances = 0
export function withOverrides(overrides: Partial<Config>): Config {
  instances++
  return { ...defaults, ...overrides }
}

console.log(withOverrides({ port: 8080 }))
console.log('instances created:', instances)

// Try: add `import type { Config as C } from './x'` — module resolution fails, as expected here.
```

## Exercises

### 1. Configuration module

Export an interface `Config` (`port: number`, `host: string`), a `defaults` constant typed as `Config`, and `withOverrides`, which takes an object with the same fields, all optional, and merges it on top of the defaults without mutating them.

```ts starter
export interface Config {
  port: number
  host: string
}

export const defaults = { port: 3000, host: 'localhost' }

export function withOverrides(overrides): Config {
  throw new Error('todo')
}
```

```ts test
test('merges overrides on the defaults', () => {
  expect(withOverrides({ port: 8080 })).toEqual({ port: 8080, host: 'localhost' })
})
test('leaves the defaults alone', () => {
  withOverrides({ host: 'example.com' })
  expect(defaults.host).toBe('localhost')
})

type _1 = Expect<Equal<typeof defaults, Config>>
type _2 = Expect<Equal<Parameters<typeof withOverrides>[0], { port?: number; host?: string }>>
```

#### Uses
- [Modules › Exports and imports](#/modules/exports-and-imports)
- [Objects and interfaces › `interface` and `type`](#/objects/interface-and-type)

#### Hints
- Annotate `defaults` with `Config`, otherwise its type is an anonymous object literal type.
- Type `overrides` as an object type where both properties are optional, written with `?` like `email?` in the Objects article.
- Return a new object that spreads `defaults` first and `overrides` second: `{ ...a, ...b }` lets `b` win.

#### Tips
- The Utility types module has a shortcut for "every field optional": `Partial<Config>`. It produces the same type as the one you write by hand here.

#### Docs
- [Modules: ES Module Syntax](https://www.typescriptlang.org/docs/handbook/2/modules.html#es-module-syntax)
- [Object Types: Optional Properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#optional-properties)

### 2. Module-private counter

Implement `nextId` (returns 1, 2, 3, …) and `resetIds` using a module-level variable that is *not* exported.

```ts starter
export function nextId(): number {
  throw new Error('todo')
}

export function resetIds(): void {
  throw new Error('todo')
}
```

```ts test
test('counts up and resets', () => {
  resetIds()
  expect(nextId()).toBe(1)
  expect(nextId()).toBe(2)
  resetIds()
  expect(nextId()).toBe(1)
})
```

#### Uses
- [Modules › Module-private state](#/modules/module-private-state)

#### Hints
- Declare a `let` counter at the top of the file, outside both functions, and don't export it.
- `nextId` increments and returns it. `resetIds` sets it back to `0`.

#### Tips
- `return ++count` increments first and returns the new value. `count++` would return the old one.

#### Docs
- [Modules: How JavaScript Modules are Defined](https://www.typescriptlang.org/docs/handbook/2/modules.html#how-javascript-modules-are-defined)
