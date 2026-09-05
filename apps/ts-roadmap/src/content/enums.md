# Enums

Enums are one of the few TypeScript features that emit runtime code. They give a name to a set of constants. They are also controversial, because a union of literal types usually does the same job with less machinery.

## Numeric enums

```ts
enum Direction { Up, Down, Left, Right }   // 0, 1, 2, 3

let d: Direction = Direction.Left
Direction[2]  // 'Left' – numeric enums get a reverse mapping
```

Numeric enums are loosely checked: any `number` is assignable to `Direction`, which defeats part of the point.

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
test('is a string enum', () => {
  expect<string>(LogLevel.Warn).toBe('warn')
})
```

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
  expect(colorName(Color.Blue)).toBe('Blue')
})
test('members are numbers', () => {
  expect(Color.Green).toBe(1)
})
```
