# Swift Roadmap

A self-hosted Swift learning platform in the same shell as the other roadmaps: 20 modules laid out as a dependency graph, from variables and optionals through structs, protocols, generics, Codable, and async/await. Each module has an article, a live playground, and exercises with tests. Code is compiled and run by a real `swiftc` 6.3 on [Compiler Explorer](https://godbolt.org) (which allows cross-origin requests), so it is the actual compiler with its actual error messages, nothing to install.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next.

```sh
npm install      # from the monorepo root
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run verify   # compile and run every playground and starter
```

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article. The first paragraph is the summary on the Learn page.
   - One ```` ```swift playground ```` block becomes the live editor. It is top-level code, the way `main.swift` runs.
   - Under `## Exercises`, each `### Title` has a description, a ```` ```swift starter ```` block, and a ```` ```swift test ```` block.
3. The starter is declarations only; it must compile. The test block is top-level `func testXxx()` functions, and the `///` comment above one is its label. `src/runtime.ts` appends a runner that calls each test and prints one line per result, plus the `expect(got, want)` and `expect(condition, message)` helpers every test can call. Tests may be `async`; actors, `Task` and `withTaskGroup` all work. Output is unbuffered, so results survive a crash: a trap (force unwrap, index out of range) is reported against the test that caused it, and the tests after it are marked as never run.
4. `npm run verify -- src/content/<id>.md --solutions <dir>` checks the playground runs, the starter compiles but fails, and `<dir>/<id>.<n>.swift` passes every test.

After the starter and test blocks, each exercise lists `#### Uses` (links to the article sections it relies on, as `[Module › Section](#/<module>/<section-slug>)`), `#### Hints` (revealed one at a time), and optionally `#### Tips` and `#### Docs` (official documentation). Uses links may only point at this module or modules it builds on; `npm run check:refs` from the repo root enforces that, so no exercise needs something the learner hasn't reached.

The standard library and Foundation are available, so Codable and JSON work. SwiftUI, UIKit and XCTest are not: they are Apple-platform frameworks that no browser-reachable compiler provides. This roadmap teaches the language, and the iOS Roadmap covers the platform.

One sharp edge: maths needs `import Foundation`. Without it `pow` is not in scope, and even `Double.squareRoot()`, which is stdlib, fails at link time because libm is not linked in. Exercises get the import for free, since `src/runtime.ts` puts it in the preamble it wraps around them; a ```` ```swift playground ```` block gets no preamble, so it has to write the import itself.

Progress and drafts are stored in `localStorage`.
