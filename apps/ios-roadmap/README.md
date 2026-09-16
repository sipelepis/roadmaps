# iOS Roadmap

A self-hosted iOS learning platform in the same shell as the other roadmaps: 20 modules laid out as a dependency graph, from an Xcode project and SwiftUI views through state, lists, navigation, forms, concurrency, networking, SwiftData, accessibility, testing, performance and shipping to the App Store. It teaches the platform, not the language; the Swift Roadmap covers Swift itself.

Pages: `#/` roadmap graph · `#/learn` module index · `#/<module>` article + playground + exercises · `#/exercises` every problem with status filters · `#/exercise/<module>/<n>` a single problem with prev/next · `#/reference` the lookup appendix.

```sh
npm install      # from the monorepo root
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run verify   # compile and run every playground and starter
```

## Two kinds of exercise

SwiftUI ships with Apple's SDKs and needs Xcode and a simulator; no browser can give you that, and `import SwiftUI` fails on a Linux compiler. So an exercise is one of two kinds, and the site renders them differently.

**Tested exercises** are plain Swift — a navigation path model, a validator, a debouncer, an actor cache, a DTO mapping, a contrast ratio — compiled and run for real by a `swiftc` 6.3 on [Compiler Explorer](https://godbolt.org), with per-test results. They have a ```` ```swift starter ```` block and a ```` ```swift test ```` block of `func testXxx()` functions, exactly like the Swift Roadmap.

**Build tasks** are the screens. They have no starter and no tests. Instead they carry a `#### Build it` checklist of what "done" means and a ```` ```swift solution ```` block holding reference SwiftUI code. The site renders the checklist as checkboxes it remembers, a "Mark as done" button, and the solution behind a disclosure. They are marked **Done**, never "Passed": nothing compiled them, and the page says so.

That split is deliberate. Most of what makes an app correct is logic a compiler can check, and this roadmap checks it. The rest is honest about being unchecked. Note that the build tasks need a Mac: there is no supported way to build an iOS app on Linux or Windows. Every tested exercise runs anywhere.

## Adding a module

1. Add a node to `src/graph.ts` (`id`, short `label`, `level` = row in the graph, `deps`).
2. Create `src/content/<id>.md`:
   - `# Title`, then the article. The first paragraph is the summary on the Learn page.
   - One ```` ```swift playground ```` block becomes the live editor. It is top-level code that must compile without SwiftUI — express the iOS idea in runnable Swift. Playground blocks get no automatic `import Foundation`; write it when a sample needs it.
   - Under `## Exercises`, each `### Title` is a tested exercise or a build task, as above, then `#### Uses`, `#### Hints`, and optionally `#### Tips` and `#### Docs`.
3. `npm run verify -- src/content/<id>.md --solutions <dir>` checks the playground runs, every starter compiles but fails, every `<dir>/<id>.<n>.swift` passes, and that each build task has both a checklist and a solution block. `<n>` counts every exercise in the module, build tasks included.

`npm run check:refs` from the repo root enforces that each exercise's Uses links resolve and point at this module or one it builds on; the reference appendix may be cited from anywhere. `npm run check:taught` reports functions an exercise uses that no article it can reach, nor the appendix, describes.

Progress, drafts and checklist ticks are stored in `localStorage`.
