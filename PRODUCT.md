# Product

<!-- impeccable:product-schema 1 -->

This file covers the roadmap apps, `apps/ts-roadmap`, `apps/py-roadmap`, and `apps/rag-roadmap`. `apps/rag-pet` is a separate project in the same monorepo and has its own README. They share one shell, one content format, and one purpose; only the language and its runtime differ. Facts marked *(inferred)* come from the repository and launch copy rather than a confirmed answer from the owner.

## Platform

web

## Users

- **Primary** *(inferred)*: developers who already program in another language and want the mental model of TypeScript or Python in dependency order. The articles assume familiarity with functions, arrays, and `reduce`, and the Python intro explains the REPL rather than what a variable is.
- **Situation**: self-directed study in a browser tab, often between other work. No install, no account. Progress lives only in that browser.
- **Job**: know what to learn next and why, then prove it by making tests pass.

## Product Purpose

Two free, open-source learning roadmaps, one per language. Each is a dependency graph of 20 modules; every module is an article, a live editor, and exercises with real tests that run in the page. Success is a learner walking the graph top to bottom and turning every node green.

## Positioning

"A map, not a list." Modules are laid out by what they build on, so the order is explained by the graph rather than asserted by a table of contents. The second claim is that the language in the page is real: TypeScript runs through the actual TypeScript compiler in Monaco, Python runs through CPython compiled to WebAssembly (Pyodide). Tests are honest, not simulated.

Source: `social/caption.txt`, the launch copy.

## Operating Context

- Hash-routed static site: `#/` graph, `#/learn` module index, `#/<module>` article plus playground plus exercises, `#/exercises` every problem with status filters, `#/exercise/<module>/<n>` one problem with prev/next.
- Editor is Monaco. Run with the button or Ctrl+Enter.
- TypeScript checks with `strict: true`; each editor is its own module. Type-level assertions use `Expect<Equal<A, B>>` and `// @ts-expect-error`. A problem passes when starter plus tests compile cleanly and every runtime test passes.
- Python loads Pyodide from the jsDelivr CDN on first run, so the first Run in a session shows "Loading Python…". Tests are `test_*` functions using `assert`; the docstring is the label.
- Drafts and pass state are keyed in `localStorage`. Clearing site data resets progress.
- Deployed as static `dist/` to Vercel, one project per app: `ts-roadmap` and `py-roadmap`.

## Capabilities and Constraints

- 20 modules per language, each one markdown file in `src/content/<id>.md` plus a node in `src/graph.ts`. Authoring stays in markdown; there is no CMS.
- No backend and no accounts *(inferred as a commitment, not just current state)*. Everything runs client-side.
- Free, no sign-up, no paywall. The launch copy states this as a promise.
- Open source at `github.com/sipelepis/roadmaps`. Anyone can fork and add modules following the README.
- Monorepo managed with Turborepo and npm workspaces; Vite builds; TypeScript typecheck via `npm run check`.
- Terminology: **module** (a graph node with an article), **exercise** or **problem** (one starter plus test block), **playground** (the module's free-form editor), **roadmap** (the graph). Status values are **To do**, **In progress**, **Passed**.
- Undecided: whether the two apps should ever merge into one site, and whether progress should sync beyond one browser.

## Brand Commitments

- Names: "TypeScript Roadmap" and "Python Roadmap". Marks are the two-letter chips "TS" and "PY".
- Voice, from the launch copy and articles: plain, direct, second person, short declaratives. "Try it, break it, tell me what's missing." No marketing superlatives.
- Existing motion is respected: the graph draws itself top to bottom on the home page, content rises in on route change, and all of it is skipped under `prefers-reduced-motion`.

## Evidence on Hand

- Live sites: `https://ts-roadmap-puce.vercel.app` and `https://py-roadmap-ten.vercel.app`.
- Launch post: `social/caption.txt` and six carousel slides `social/slide-1.png` through `social/slide-6.png`.
- 20 finished modules per language with articles, playgrounds, and exercises, under each app's `src/content/`.
- No testimonials, user counts, completion metrics, or press. Do not invent any.

## Product Principles

1. **The graph is the argument.** Every module must justify its position by what it builds on. Do not add content that has no place in the graph.
2. **Real runtime or nothing.** Tests run the actual language. Never fake a result to make the experience smoother.
3. **Zero friction stays zero.** No sign-up, no install, no paywall. Any feature that needs an account is out of scope.
4. **Progress is the learner's.** It lives in their browser and is never required to be shared.
5. **Two languages, one product.** A change to the shell lands in both apps. Language-specific behavior stays inside the editor and runtime layer.

## Accessibility & Inclusion

- Skip link, landmark roles, `aria-current` on navigation, `aria-live` on results and playground output, and labeled graph nodes are already in place. Keep them.
- Motion respects `prefers-reduced-motion`.
- Keyboard: Ctrl+Enter runs code from inside the editor.
- No formal standard has been committed to. Undecided.
