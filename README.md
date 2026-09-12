# AI Engineering Course

Projects built along the course, one Turborepo.

| Project | Path | What it is | Live |
| --- | --- | --- | --- |
| TypeScript Roadmap | `apps/ts-roadmap` | Dependency-graph roadmap of 20 modules, markdown articles, live Monaco editor, exercises with type-level and runtime tests. Runs code with Monaco's TypeScript worker | https://ts-roadmap-puce.vercel.app |
| Python Roadmap | `apps/py-roadmap` | The same shell for Python. Runs code with Pyodide (CPython on WebAssembly) | https://py-roadmap-ten.vercel.app |
| rag-pet | `apps/rag-pet` | RAG over your own documents: FastAPI + pgvector ingest and retrieval, a React console that shows the exact chunks behind every answer, and a Flow page that runs the pipeline step by step. OCR for scanned PDFs is the next piece | https://rag-pet.fly.dev |

The two roadmaps are Vite + vanilla TypeScript sites; see each app's README for the content format. rag-pet keeps its own Nx workspace with a Python API; see `apps/rag-pet/README.md`.

```sh
npm install                          # everything, including rag-pet's web and libs
npm run dev                          # both roadmaps plus the rag-pet console (vite only, no API)
npm run build                        # turbo builds all three fronts into their dist/
npm run check                        # typecheck all three
npx turbo dev --filter=py-roadmap    # one app
cd apps/rag-pet && npm run stack     # rag-pet full stack: api :3300 + web :5300 (needs uv, Docker, keys)
```

## Deploying

**Roadmaps on Vercel.** One Vercel project per app from this repository:

1. Import the repo, set **Root Directory** to `apps/ts-roadmap` (or `apps/py-roadmap`).
2. Framework preset: Vite (auto-detected). Build command `vite build`, output `dist`. No environment variables.
3. Repeat for the other app.

Vercel installs from the root lockfile and only rebuilds a project when its app changes.

**rag-pet on Fly.** `fly deploy` from `apps/rag-pet`. Its Dockerfile is self-contained and uses the lockfile in that directory, so keep `apps/rag-pet/package-lock.json` in sync with its own `package.json` when its web dependencies change.
