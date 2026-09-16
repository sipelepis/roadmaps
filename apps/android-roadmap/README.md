# Android Roadmap

A self-hosted Android learning platform in the same shell as the other roadmaps: 20 modules laid out as a dependency graph, from a Gradle project and composable functions through state, lists, navigation, lifecycle, coroutines, networking, Room, dependency injection, accessibility, testing, performance and shipping to Play. It teaches the platform, not the language; the Kotlin Roadmap covers Kotlin itself.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next · `#/reference` the lookup appendix.

```sh
npm install      # from the monorepo root
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run verify   # run every playground and starter against the Kotlin Playground
```

## Two kinds of exercise

Jetpack Compose needs the Android toolchain and a device; no browser can give you that, and `androidx` does not resolve on the Kotlin Playground. So an exercise is one of two kinds, and the site renders them differently.

**Tested exercises** are plain Kotlin — a state machine, a reducer, a route parser, a retry with backoff, a DTO mapping, a contrast ratio — compiled and run for real by the official [Kotlin Playground](https://play.kotlinlang.org) API, with per-test results. They have a ```` ```kotlin starter ```` block and a ```` ```kotlin test ```` block of JUnit classes, exactly like the Kotlin Roadmap.

**Build tasks** are the screens. They have no starter and no tests. Instead they carry a `#### Build it` checklist of what "done" means and a ```` ```kotlin solution ```` block holding reference Compose code. The site renders the checklist as checkboxes it remembers, a "Mark as done" button, and the solution behind a disclosure. They are marked **Done**, never "Passed": nothing compiled them, and the page says so.

That split is deliberate. Most of what makes an app correct is logic a compiler can check, and this roadmap checks it. The rest is honest about being unchecked.

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article. The first paragraph is the summary on the Learn page.
   - One ```` ```kotlin playground ```` block becomes the live editor. It is a whole program with `fun main` that must run on the Playground, so no `androidx` imports — express the Android idea in runnable Kotlin.
   - Under `## Exercises`, each `### Title` is a tested exercise or a build task, as above, then `#### Uses`, `#### Hints`, and optionally `#### Tips` and `#### Docs`.
3. `npm run verify -- src/content/<id>.md --solutions <dir>` checks the playground runs, every starter compiles but fails, every `<dir>/<id>.<n>.kt` passes, and that each build task has both a checklist and a solution block. `<n>` counts every exercise in the module, build tasks included.

`npm run check:refs` from the repo root enforces that each exercise's Uses links resolve and point at this module or one it builds on; the reference appendix may be cited from anywhere. `npm run check:taught` reports functions an exercise uses that no article it can reach, nor the appendix, describes.

Progress, drafts and checklist ticks are stored in `localStorage`.
