# Product: TypeScript Roadmap

<!-- impeccable:product-schema 1 -->

App-specific record for `apps/ts-roadmap`. Users, purpose, positioning, principles, brand voice, and constraints are shared with the Python app and live in the root `PRODUCT.md`. This file holds only what differs.

## Platform

web

## Users

Same as root. The TypeScript-specific assumption is that the learner already writes JavaScript. The first module opens with "TypeScript is JavaScript with a static type system layered on top" and never explains JavaScript itself.

## Product Purpose

Teach TypeScript's type system in dependency order, from basic annotations to type-level programming, with every claim checkable in a real compiler.

## Operating Context

- 20 modules, 19 with a playground, 73 exercises. Stages in graph order: Foundations, Everyday types, Composing types, Type-level programming, In practice.
- Module labels: What is TypeScript?, Basic types, Functions, Objects & interfaces, Arrays & tuples, Unions & literals, Enums, Narrowing, Classes, Generics, keyof typeof T[K], Utility types, Modules, Async & Promises, Conditional types, Mapped types, Template literal types, Advanced patterns, Validating unknown data, Type-level puzzles.
- Runtime: Monaco with the TypeScript language worker in the browser. Compiler options are `strict: true`, ES2020 target, ESNext modules, and forced module detection so each editor on a page is its own module.
- Tests: `test` and `expect` for runtime checks; `Expect<Equal<A, B>>` and `// @ts-expect-error` for type-level checks. A problem passes only when the starter plus tests compile with zero diagnostics and every runtime test passes. The result list always shows a "Type checks pass" or "Type error" row first.
- Console output from the learner's code is collected and shown as a single "Console output" row.
- Live at `https://ts-roadmap-puce.vercel.app`, Vercel project `ts-roadmap`.

## Capabilities and Constraints

- Type errors surface twice: inline in the editor and as failed rows after a run. Both must stay.
- The harness typings are injected as an extra lib, so `test`, `expect`, `Expect`, and `Equal` are always in scope without imports.
- Brand mark: white "TS" on Blueprint Blue (#3178c6), matching the language's own logo color.
- Undecided: whether to add exercises that require multiple files or module imports. The single-module-per-editor model does not support it today.

## Evidence on Hand

- 20 articles under `src/content/`, each with starter and test blocks.
- No usage data. Do not invent completion rates or learner counts.
