# Rust Roadmap

A self-hosted Rust learning platform in the same shell as the other roadmaps: 20 modules laid out as a dependency graph, from ownership and borrowing through enums, traits, generics, iterators, lifetimes, smart pointers, and threads. Each module has an article, a live playground, and exercises with tests. Code is compiled and run by the official [Rust Playground](https://play.rust-lang.org) (its `/execute` endpoint allows cross-origin requests), so it is real rustc and `cargo test`, nothing to install.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next.

```sh
npm install      # from the monorepo root
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run verify   # run every playground and starter against the Rust Playground
```

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article. The first paragraph is the summary on the Learn page.
   - One ```` ```rust playground ```` block becomes the live editor. It is a whole program with `fn main`.
   - Under `## Exercises`, each `### Title` has a description, a ```` ```rust starter ```` block, and a ```` ```rust test ```` block.
3. The starter is library code (edition 2024, std only), usually with `todo!()` bodies; it must compile. The test block is only `#[test]` functions: `src/runtime.ts` wraps them in `mod tests { use super::*; … }` and runs `cargo test`. A `///` comment above a test is its label, and `assert_eq!(actual, expected)` shows up as actual vs expected.
4. `npm run verify -- src/content/<id>.md --solutions <dir>` checks the playground runs, the starter compiles but fails, and `<dir>/<id>.<n>.rs` passes every test.

After the starter and test blocks, each exercise lists `#### Uses` (links to the article sections it relies on, as `[Module › Section](#/<module>/<section-slug>)`), `#### Hints` (revealed one at a time), and optionally `#### Tips` and `#### Docs` (official documentation). Uses links may only point to this module or modules it builds on; `npm run check:refs` from the repo root enforces that, so no exercise needs something the learner hasn't reached.

Progress and drafts are stored in `localStorage`.
