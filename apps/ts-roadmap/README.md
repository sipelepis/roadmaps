# TypeScript Roadmap

A self-hosted TypeScript learning platform: 20 modules laid out as a dependency graph, each with an article, a live Monaco playground, and exercises with type-level and runtime test cases that run in the browser.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article.
   - One ```` ```ts playground ```` block becomes the live editor.
   - Under `## Exercises`, each `### Title` has a description, a ```` ```ts starter ```` block, and a ```` ```ts test ```` block.
3. Tests get `test`/`expect` for runtime checks and `Expect<Equal<A, B>>` plus `// @ts-expect-error` for type-level checks. A problem passes when the combined starter + tests compiles cleanly and every test passes.

After the starter and test blocks, each exercise lists `#### Uses` (links to the article sections it relies on, as `[Module › Section](#/<module>/<section-slug>)`), `#### Hints` (revealed one at a time), and optionally `#### Tips` and `#### Docs` (official documentation). Uses links may only point to this module or modules it builds on; `npm run check:refs` from the repo root enforces that, so no exercise needs something the learner hasn't reached.

Progress and drafts are stored in `localStorage`.
