# Roadmaps

Two browser-based learning platforms in one Turborepo:

| App | Path | Runs code with |
| --- | --- | --- |
| TypeScript Roadmap | `apps/ts-roadmap` | Monaco's TypeScript worker (type errors + emit) |
| Python Roadmap | `apps/py-roadmap` | Pyodide (CPython on WebAssembly) |

Each app is a Vite + vanilla TypeScript site: a dependency-graph roadmap, markdown articles, a live editor, and exercises with tests that run in the browser. See each app's README for the content format.

```sh
npm install
npm run dev            # both apps (ts on 5173, py on the next free port)
npm run build          # turbo builds both into apps/*/dist
npx turbo dev --filter=py-roadmap
```

## Deploying on Vercel

Create one Vercel project per app from this repository:

1. Import the repo, set **Root Directory** to `apps/ts-roadmap` (or `apps/py-roadmap`).
2. Framework preset: Vite (auto-detected). Build command `vite build`, output `dist`. No environment variables.
3. Repeat for the other app.

Vercel installs from the root lockfile and only rebuilds a project when its app changes.
