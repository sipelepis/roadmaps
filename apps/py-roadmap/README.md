# Python Roadmap

A self-hosted Python learning platform: 20 modules laid out as a dependency graph, each with an article, a live playground, and exercises with tests that run in the browser. Real CPython runs client-side through [Pyodide](https://pyodide.org) (WebAssembly), loaded from the jsDelivr CDN on first run.

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
   - One ```` ```python playground ```` block becomes the live editor.
   - Under `## Exercises`, each `### Title` has a description, a ```` ```python starter ```` block, and a ```` ```python test ```` block.
3. Tests are plain `test_*` functions using `assert`; a docstring becomes the label. The starter and the tests run in one namespace, so tests call the learner's functions directly. A problem passes when the code runs without error and every test passes.

After the starter and test blocks, each exercise lists `#### Uses` (links to the article sections it relies on, as `[Module › Section](#/<module>/<section-slug>)`), `#### Hints` (revealed one at a time), and optionally `#### Tips` and `#### Docs` (official documentation). Uses links may only point to this module or modules it builds on; `npm run check:refs` from the repo root enforces that, so no exercise needs something the learner hasn't reached.

Progress and drafts are stored in `localStorage`.
