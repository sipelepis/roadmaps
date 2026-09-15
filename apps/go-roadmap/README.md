# Go Roadmap

A self-hosted Go learning platform in the same shell as the other roadmaps: 18 modules laid out as a dependency graph, from variables and slices through interfaces, generics, goroutines, and the standard library. Each module has an article, a live playground, and exercises with tests. Code is compiled and run by the official [Go Playground](https://go.dev/play) (`play.golang.org/compile`, which allows cross-origin requests), so it is real Go with the real toolchain, nothing to install.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next.

```sh
npm install      # from the monorepo root
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run verify   # run every playground and starter against the Go Playground
```

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article. The first paragraph is the summary on the Learn page.
   - One ```` ```go playground ```` block becomes the live editor. It is a whole program with `func main`.
   - Under `## Exercises`, each `### Title` has a description, a ```` ```go starter ```` block, and a ```` ```go test ```` block.
3. The starter is `package main` without `func main`; it must compile. The test block is a Go file of `func TestXxx(t *testing.T)` functions; the `//` comment above one is its label. `src/runtime.ts` adds a `main` that runs them with `testing.Main`, and an `expect(t, got, want)` helper that reports expected vs actual. A panic fails only its own test.
4. `npm run verify -- src/content/<id>.md --solutions <dir>` checks the playground runs, the starter compiles but fails, and `<dir>/<id>.<n>.go` passes every test.

After the starter and test blocks, each exercise lists `#### Uses` (links to the article sections it relies on, as `[Module › Section](#/<module>/<section-slug>)`), `#### Hints` (revealed one at a time), and optionally `#### Tips` and `#### Docs` (official documentation). Uses links may only point to this module or modules it builds on; `npm run check:refs` from the repo root enforces that, so no exercise needs something the learner hasn't reached.

Progress and drafts are stored in `localStorage`.
