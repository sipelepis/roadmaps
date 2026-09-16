# AI Engineering Course

Projects built along the course, one Turborepo.

| Project | Path | What it is | Live |
| --- | --- | --- | --- |
| TypeScript Roadmap | `apps/ts-roadmap` | Dependency-graph roadmap of 20 modules, markdown articles, live Monaco editor, exercises with type-level and runtime tests. Runs code with Monaco's TypeScript worker | https://ts-roadmap-puce.vercel.app |
| Python Roadmap | `apps/py-roadmap` | The same shell for Python. Runs code with Pyodide (CPython on WebAssembly) | https://py-roadmap-ten.vercel.app |
| RAG Roadmap | `apps/rag-roadmap` | The same shell again for RAG and OCR: 16 modules from scanned pages through chunking, embeddings, retrieval, and grounded answers, with Python exercises run by Pyodide. Content drawn from rag-pet | https://rag-roadmap.vercel.app |
| Go Roadmap | `apps/go-roadmap` | The same shell for Go: 18 modules from slices and maps through interfaces, generics, and goroutines. Code compiles and runs on the official Go Playground | https://go-roadmap-pink.vercel.app |
| Rust Roadmap | `apps/rust-roadmap` | The same shell for Rust: 20 modules from ownership and borrowing through traits, iterators, lifetimes, and threads. Code compiles and runs on the official Rust Playground | https://rust-roadmap-two.vercel.app |
| Kotlin Roadmap | `apps/kotlin-roadmap` | The same shell for Kotlin: 20 modules from null safety and collections through sealed types, coroutines, and Flow. Code compiles and runs on the official Kotlin Playground API, which reports each JUnit test separately | https://kotlin-roadmap-steel.vercel.app |
| Swift Roadmap | `apps/swift-roadmap` | The same shell for Swift: 20 modules from optionals and structs through protocols, generics, Codable, and async/await. Code compiles and runs on a real `swiftc` 6.3 via Compiler Explorer | https://swift-roadmap.vercel.app |
| Android Roadmap | `apps/android-roadmap` | The platform, not the language: 20 modules from Gradle and composables through state, navigation, Room, DI, accessibility and shipping to Play. Logic exercises run as real Kotlin with tests; Compose screens are build tasks with a checklist and a reference solution | https://android-roadmap-three.vercel.app |
| iOS Roadmap | `apps/ios-roadmap` | The same for iOS: 20 modules from Xcode and SwiftUI views through state, navigation, SwiftData, accessibility and the App Store. Logic exercises run as real Swift with tests; SwiftUI screens are build tasks. The build tasks need a Mac; the tested exercises run anywhere | https://ios-roadmap-vert.vercel.app |
| rag-pet | `apps/rag-pet` | RAG over your own documents: FastAPI + pgvector ingest and retrieval, a React console that shows the exact chunks behind every answer, and a Flow page that runs the pipeline step by step. OCR for scanned PDFs is the next piece | https://rag-pet.fly.dev |

The nine roadmaps are Vite + vanilla TypeScript sites; see each app's README for the content format. Every exercise lists the article sections it relies on (`#### Uses`) plus hints, tips, and docs; `npm run check:refs` fails if an exercise points at a module the learner hasn't reached yet. rag-pet keeps its own Nx workspace with a Python API; see `apps/rag-pet/README.md`.

```sh
npm install                          # everything, including rag-pet's web and libs
npm run dev                          # the nine roadmaps plus the rag-pet console (vite only, no API)
npm run build                        # turbo builds every front into its dist/
npm run check                        # typecheck them all
npm run check:refs                   # every exercise's Uses links resolve and point backwards in its graph
npm run check:taught                 # report: functions an exercise uses that no article it can reach, nor the reference appendix, describes
npx turbo dev --filter=py-roadmap    # one app
cd apps/rag-pet && npm run stack     # rag-pet full stack: api :3300 + web :5300 (needs uv, Docker, keys)
```

## Deploying

**Roadmaps on Vercel.** One Vercel project per app from this repository:

1. Import the repo, set **Root Directory** to `apps/ts-roadmap`, `apps/py-roadmap`, `apps/rag-roadmap`, `apps/go-roadmap`, `apps/rust-roadmap`, `apps/kotlin-roadmap`, `apps/swift-roadmap`, `apps/android-roadmap`, or `apps/ios-roadmap`. Pushing `main` then redeploys each app whose files changed. The exception is `ts-roadmap`: its Vercel project is still linked to the old standalone repo, so deploy it with `npx vercel deploy --prod` from `apps/ts-roadmap`.
2. Framework preset: Vite (auto-detected). Build command `vite build`, output `dist`. No environment variables.
3. Repeat for the other apps.

Vercel installs from the root lockfile and only rebuilds a project when its app changes.

**rag-pet on Fly.** `fly deploy` from `apps/rag-pet`. Its Dockerfile is self-contained and uses the lockfile in that directory, so keep `apps/rag-pet/package-lock.json` in sync with its own `package.json` when its web dependencies change.
