# RAG Roadmap

A self-hosted RAG and OCR learning platform in the same shell as the TypeScript and Python roadmaps: 16 modules laid out as a dependency graph, from scanned pages and OCR through cleaning, chunking, embeddings, retrieval, grounded prompts, evaluation, and safety, ending in a capstone that assembles the OCR → RAG pipeline. Each module has an article, a live Python playground, and exercises with tests that run in the browser through [Pyodide](https://pyodide.org).

The content is drawn from `apps/rag-pet`, the working RAG service in this monorepo. Its Learn articles and Flow steps became the articles here; its `chunk_text()`, `shared_prefix()`, `build_prompt()` and write-key guard became exercises. Where the real system calls an embedding API, the exercises use a deterministic hashed bag-of-words stand-in so everything runs offline in the page.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next.

```sh
npm install      # from the monorepo root
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article.
   - One ```` ```python playground ```` block becomes the live editor.
   - Under `## Exercises`, each `### Title` has a description, a ```` ```python starter ```` block, and a ```` ```python test ```` block.
3. Tests are plain `test_*` functions using `assert`; a docstring becomes the label. The starter and the tests run in one namespace, so tests call the learner's functions directly. A problem passes when the code runs without error and every test passes. Helpers a learner should not have to rewrite (the toy `embed`, `cosine`, `chunk_text`) go in the starter above the `...`.

Progress and drafts are stored in `localStorage`.
