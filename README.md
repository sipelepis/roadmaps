# rag-pet

**Live: https://rag-pet.fly.dev**

RAG over your own documents. A FastAPI service does ingest and retrieval against
Postgres + pgvector; a React console lets you index sources, ask questions, and
**see the exact chunks each answer was built from**. There is a Learn section that
explains every step and points at the file that implements it.

```
apps/api     Python 3.13 · FastAPI · pgvector      ingest, retrieve, answer
apps/web     React 19 · Vite · Tailwind v4         dashboard, ask, learn
libs/shared  @rag/shared                           generated wire types
libs/ui      @boost/ui                             shared components (from boost-library)
libs/styles  @boost/styles                         design tokens
```

## Types cross the wire by codegen

The pydantic models in `apps/api/app/models.py` are the only definition of the
API contract. `nx run shared:codegen` dumps FastAPI's OpenAPI schema and runs
`openapi-typescript` over it into `libs/shared/src/api.gen.ts`; `types.ts` gives
those schemas readable names. Nx wires the dependency, so `nx run web:build`
regenerates the types first and a stale contract cannot compile.

```
models.py  →  openapi.json  →  api.gen.ts  →  types.ts  →  the dashboard
 (source)     (api:openapi)   (shared:codegen)  (by hand)
```

Add a field in Python, re-run codegen, and it appears in the frontend. There is
no second definition to keep in sync.

## Running it

Needs Docker, Node 24, and [uv](https://docs.astral.sh/uv/).

```bash
npm run db                       # pgvector on :5433
cp .env.example apps/api/.env    # then fill in the two API keys
npm run setup                    # npm install + uv sync + codegen
npm run dev                      # api :3300, web :5300
```

Two keys are required: `OPENAI_API_KEY` for embeddings and `ANTHROPIC_API_KEY`
for answers. Without them the console loads and lists documents, but ingest and
query fail — those are the two calls that leave the machine.

| Command | Does |
| --- | --- |
| `npm run dev` | api + web, in parallel |
| `npm run build` | typecheck + production bundle |
| `npm test` | pytest + tsc |
| `npm run codegen` | regenerate the shared types |
| `npm run graph` | Nx project graph |

## Deploying

One Fly machine serves both halves: the Dockerfile builds the SPA in a Node
stage and the API stage copies it in, so `apps/api/app/main.py` serves the
console and `/api` from the same origin — no CORS in production and no second
service. It suspends when idle and wakes on the next request.

Postgres is Neon's free tier rather than a Fly volume: pgvector is supported,
it scales to zero on its own, and the schema is created on boot. Expect a
couple of slow seconds on the first request after an idle period, while both
the machine and the database wake up.

```bash
fly secrets set DATABASE_URL=… ANTHROPIC_API_KEY=… EMBEDDING_API_KEY=…
fly deploy
```

Fly provisions two machines on first deploy for high availability; `fly scale
count 1` is the right call for a pet.

## Deliberate simplifications

Marked with `ponytail:` comments in the source. Exact vector scan with no ANN
index (fine well past 100k chunks); no reranking or hybrid search; wide-open
CORS because the API is local-only. Each comment names its ceiling and the
upgrade, so `grep -rn "ponytail:"` is the debt ledger.
