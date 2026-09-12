# ── Stage 1: build the console ──────────────────────
FROM node:24-slim AS web

WORKDIR /repo
# Manifests first so the install layer caches independently of source edits.
COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY libs/shared/package.json libs/shared/
COPY libs/ui/package.json libs/ui/
COPY libs/styles/package.json libs/styles/
RUN npm ci

# api.gen.ts is committed, so the SPA builds without a Python toolchain here.
COPY tsconfig.base.json ./
COPY libs libs
COPY apps/web apps/web
RUN npm run build --workspace @rag/web

# ── Stage 2: the API, serving that build ────────────
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /srv
ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/api/app app
COPY --from=web /repo/apps/web/dist web

EXPOSE 8080
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
