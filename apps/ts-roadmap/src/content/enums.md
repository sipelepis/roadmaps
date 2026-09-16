# Enums

Enums are one of the few TypeScript features that emit runtime code. They give a name to a set of constants. They are also controversial, because a union of literal types usually does the same job with less machinery.

## Numeric enums

```ts
enum Direction { Up, Down, Left, Right }   // 0, 1, 2, 3

let d: Direction = Direction.Left
Direction[2]  // 'Left' – numeric enums get a reverse mapping
```

Numeric enums are loosely checked: any value typed `number` is assignable to `Direction`, which defeats part of the point.

## String enums

```ts
enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}
```

String enums are strictly checked (only `LogLevel.X` members are assignable) and read well in logs and JSON. If you use enums, use string enums.

## Enum sharp edges

- A numeric enum leaks. A literal that isn't a member is now rejected (`const d: Direction = 99` is an error since TS 5.0), but anything typed plain `number` still slips straight in: `declare const n: number; const d: Direction = n` compiles. A string enum has no such hole.
- String enums are nominal in one direction. `LogLevel.Info` is assignable to a parameter typed `'info'`, but `'info'` is *not* assignable to `LogLevel`, so callers must reach for the enum object.
- Only numeric enums get a reverse mapping, so `Color[1]` is `'Green'` but `LogLevel['info']` is not a thing.
- `Object.values` on a *numeric* enum returns the names as well as the values, because the reverse mapping is part of the object. For a string enum you get just the values, in declaration order.

## `const enum`

`const enum` inlines the values at every use and emits nothing. It is faster but breaks with `isolatedModules` and single-file transpilers, so most projects avoid it.

## The `as const` alternative

The modern idiom is a frozen object plus a derived type:

```ts
const LogLevel = {
  Debug: 'debug',
  Info: 'info',
  Warn: 'warn',
} as const

type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]  // 'debug' | 'info' | 'warn'

function log(level: LogLevel, msg: string) {}
log(LogLevel.Info, 'hi')
log('warn', 'also fine')   // plain strings work too
```

You get autocomplete, iteration over `Object.values(LogLevel)`, no runtime helper, and plain strings interoperate. The `keyof typeof` part is covered in a later module; for now, just know this pattern exists.

## When to use which

- A closed set of string values: literal union, or the `as const` object if you need to iterate.
- Interop with an existing enum-heavy codebase or protocol: string enum.
- Bit flags (`Read | Write`): numeric enum, one of its few good uses.

```ts playground
enum Color { Red, Green, Blue }

console.log(Color.Green)      // 1
console.log(Color[Color.Green]) // 'Green'

enum Level { Low = 'low', High = 'high' }

function describe(level: Level) {
  return level === Level.Low ? 'take it easy' : 'all hands'
}

console.log(describe(Level.High))

// Try: describe('low') — why does the string enum reject this?
```

## Exercises

### 1. Log level threshold

Define a string enum `LogLevel` with members `Debug`, `Info`, `Warn`, `Error` (values are the lowercase names). Implement `shouldLog`, returning `true` when `level` is at least as severe as `min` in that order.

```ts starter
// enum LogLevel { ... }

function shouldLog(level: LogLevel, min: LogLevel): boolean {
  throw new Error('todo')
}
```

```ts test
test('compares severity', () => {
  expect(shouldLog(LogLevel.Error, LogLevel.Warn)).toBe(true)
  expect(shouldLog(LogLevel.Warn, LogLevel.Warn)).toBe(true)
  expect(shouldLog(LogLevel.Debug, LogLevel.Info)).toBe(false)
})
test('logs anything at or above min', () => {
  expect(shouldLog(LogLevel.Info, LogLevel.Debug)).toBe(true)
  expect(shouldLog(LogLevel.Error, LogLevel.Debug)).toBe(true)
  expect(shouldLog(LogLevel.Debug, LogLevel.Debug)).toBe(true)
  expect(shouldLog(LogLevel.Error, LogLevel.Error)).toBe(true)
})
test('skips anything below min', () => {
  expect(shouldLog(LogLevel.Info, LogLevel.Warn)).toBe(false)
  expect(shouldLog(LogLevel.Warn, LogLevel.Error)).toBe(false)
  expect(shouldLog(LogLevel.Debug, LogLevel.Error)).toBe(false)
})
test('is a string enum', () => {
  expect<string>(LogLevel.Debug).toBe('debug')
  expect<string>(LogLevel.Info).toBe('info')
  expect<string>(LogLevel.Warn).toBe('warn')
  expect<string>(LogLevel.Error).toBe('error')
})

function neverCalled() {
  // @ts-expect-error a string enum only accepts its own members
  shouldLog('warn', LogLevel.Info)
}
```

#### Uses
- [Enums › String enums](#/enums/string-enums)
- [Enums › Enum sharp edges](#/enums/enum-sharp-edges)
- [Reference › Matchers](#/reference/matchers)
- [Reference › Array methods](#/reference/array-methods)

#### Hints
- Declare `enum LogLevel { Debug = 'debug', … }`, one member per level.
- The string values don't sort by severity (`'error' < 'warn'` alphabetically), so spell the order out: put the four members in an array from least to most severe.
- Compare positions: `level` passes when its `indexOf` in that array is at least the index of `min`.

#### Tips
- For a string enum, `Object.values(LogLevel)` returns the values in declaration order. Numeric enums also include the reverse-mapped names, so don't rely on it there.
- The last test writes `expect<string>(LogLevel.Debug)`, not `expect(...)`. `expect<T>(actual: T).toBe(expected: T)` types both sides the same, and an enum member is not a plain `string`, so the explicit `<string>` is what makes the comparison legal.
- `indexOf` returns `-1` for something not in the list. It can't happen here, since the parameters are typed `LogLevel`, but a lookup table (`Record<LogLevel, number>`) says the same thing without that hole.

#### Docs
- [Enums: String enums](https://www.typescriptlang.org/docs/handbook/enums.html#string-enums)

### 2. Reverse mapping

Given a numeric enum, implement `colorName` returning the member name for a value, e.g. `colorName(Color.Blue)` is `'Blue'`.

```ts starter
enum Color { Red, Green, Blue }

function colorName(c: Color): string {
  throw new Error('todo')
}
```

```ts test
test('maps values back to names', () => {
  expect(colorName(Color.Red)).toBe('Red')
  expect(colorName(Color.Green)).toBe('Green')
  expect(colorName(Color.Blue)).toBe('Blue')
})
test('members are numbers', () => {
  expect(Color.Green).toBe(1)
})
```

#### Uses
- [Enums › Numeric enums](#/enums/numeric-enums)

#### Hints
- Numeric enums get a reverse mapping: the enum object also maps each value back to its name.
- The article's `Direction[2]` returns `'Left'`. Index `Color` the same way, with `c`.

#### Tips
- String enums have no reverse mapping, so this only works for numeric ones.
- The reverse mapping is plain runtime code: the emitted object literally contains both `Red: 0` and `0: 'Red'`. That is the main reason enums are the one TypeScript feature that costs you bytes.
- `Color[c]` is typed `string` already, so no annotation or cast is needed on the return.

#### Docs
- [Enums: Reverse mappings](https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings)
