# Kotlin Roadmap

A self-hosted Kotlin learning platform in the same shell as the other roadmaps: 20 modules laid out as a dependency graph, from variables and null safety through collections, lambdas, sealed types, coroutines, and Flow. Each module has an article, a live playground, and exercises with tests. Code is compiled and run by the official [Kotlin Playground](https://play.kotlinlang.org) API (`api.kotlinlang.org`, which allows cross-origin requests), so it is real Kotlin with the real compiler, nothing to install.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next.

```sh
npm install      # from the monorepo root
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run verify   # run every playground and starter against the Kotlin Playground
```

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article. The first paragraph is the summary on the Learn page.
   - One ```` ```kotlin playground ```` block becomes the live editor. It is a whole program with `fun main`.
   - Under `## Exercises`, each `### Title` has a description, a ```` ```kotlin starter ```` block, and a ```` ```kotlin test ```` block.
3. The starter is top-level declarations without `fun main`; it must compile. The test block is one or more classes of JUnit tests (`class FooTest { @Test fun bar() { … } }`), and the `//` comment above one is its label. `org.junit.Test` and `org.junit.Assert.*` are imported for you, and any import written inside the test block is hoisted to the top of the file, so line numbers still point where you wrote them. `src/runtime.ts` sends code and tests to the `/compiler/test` endpoint and turns its JUnit results into per-test results; a comparison failure carries expected vs actual straight into the UI. An exception fails only its own test.
4. `npm run verify -- src/content/<id>.md --solutions <dir>` checks the playground runs, the starter compiles but fails, and `<dir>/<id>.<n>.kt` passes every test.

After the starter and test blocks, each exercise lists `#### Uses` (links to the article sections it relies on, as `[Module › Section](#/<module>/<section-slug>)`), `#### Hints` (revealed one at a time), and optionally `#### Tips` and `#### Docs` (official documentation). Uses links may only point at this module or modules it builds on; `npm run check:refs` from the repo root enforces that, so no exercise needs something the learner hasn't reached.

The standard library and `kotlinx.coroutines` are available. Android APIs are not: this roadmap teaches the language, and the Android Roadmap covers the platform.

Progress and drafts are stored in `localStorage`.
