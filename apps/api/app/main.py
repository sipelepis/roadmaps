from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from time import perf_counter

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader

from . import db, rag
from .config import settings
from .models import (
    Chunk,
    ChunkPreviewRequest,
    ChunkPreviewResponse,
    Document,
    Health,
    IngestText,
    QueryRequest,
    QueryResponse,
    Stats,
    Trace,
)

# How many leading dimensions of the question vector /flow gets to draw. Enough
# to see it is just numbers; not so many that the response doubles in size.
TRACE_DIMS = 48


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.startup()
    yield
    db.shutdown()


app = FastAPI(title="rag-pet", version="0.0.0", lifespan=lifespan)

# ponytail: wide-open CORS — the API is local-only today. Lock to the deployed
# origin the moment it leaves localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health(status="ok", database=db.healthy())


@app.get("/api/stats", response_model=Stats)
def stats() -> Stats:
    with db.pool.connection() as conn:
        documents = conn.execute("SELECT count(*) FROM documents").fetchone()[0]
        chunks = conn.execute("SELECT count(*) FROM chunks").fetchone()[0]
    return Stats(
        documents=documents,
        chunks=chunks,
        chat_model=settings.chat_model,
        embedding_model=settings.embedding_model,
        embedding_dims=settings.embedding_dims,
        chunk_chars=settings.chunk_chars,
        chunk_overlap=settings.chunk_overlap,
    )


@app.get("/api/documents", response_model=list[Document])
def list_documents() -> list[Document]:
    with db.pool.connection() as conn:
        rows = conn.execute(
            """SELECT d.id, d.filename, d.chars, count(c.id), d.created_at
               FROM documents d LEFT JOIN chunks c ON c.document_id = d.id
               GROUP BY d.id ORDER BY d.created_at DESC"""
        ).fetchall()
    return [
        Document(id=r[0], filename=r[1], chars=r[2], chunks=r[3], created_at=r[4])
        for r in rows
    ]


@app.post("/api/documents/text", response_model=Document)
def ingest_text(body: IngestText) -> Document:
    return _ingest(body.filename, body.text)


@app.post("/api/documents/upload", response_model=Document)
async def ingest_upload(file: UploadFile) -> Document:
    raw = await file.read()
    name = file.filename or "upload"
    if name.lower().endswith(".pdf"):
        text = "\n".join(p.extract_text() or "" for p in PdfReader(BytesIO(raw)).pages)
    else:
        text = raw.decode("utf-8", errors="replace")
    if not text.strip():
        raise HTTPException(422, "No extractable text in that file")
    return _ingest(name, text)


@app.delete("/api/documents/{document_id}", status_code=204)
def delete_document(document_id: int) -> None:
    with db.pool.connection() as conn:
        deleted = conn.execute(
            "DELETE FROM documents WHERE id = %s", (document_id,)
        ).rowcount
    if not deleted:
        raise HTTPException(404, "No such document")


@app.post("/api/query", response_model=QueryResponse)
def query(body: QueryRequest) -> QueryResponse:
    embed_start = perf_counter()
    vector = rag.embed([body.question])[0]
    search_start = perf_counter()
    with db.pool.connection() as conn:
        rows = conn.execute(
            """SELECT c.id, c.document_id, d.filename, c.ordinal, c.text,
                      1 - (c.embedding <=> %s::vector) AS score
               FROM chunks c JOIN documents d ON d.id = c.document_id
               ORDER BY c.embedding <=> %s::vector
               LIMIT %s""",
            (vector, vector, body.top_k),
        ).fetchall()
        # Every chunk was compared to reach that LIMIT — the point of the exact
        # scan, and the number that makes an ANN index worth adding one day.
        scanned = conn.execute("SELECT count(*) FROM chunks").fetchone()[0]
    answer_start = perf_counter()
    sources = [
        Chunk(
            id=r[0],
            document_id=r[1],
            filename=r[2],
            ordinal=r[3],
            text=r[4],
            score=float(r[5]),
        )
        for r in rows
    ]
    text = rag.answer(body.question, sources)
    done = perf_counter()

    trace = None
    if body.trace:
        trace = Trace(
            embedding_dims=len(vector),
            embedding_preview=[round(v, 4) for v in vector[:TRACE_DIMS]],
            chunks_scanned=scanned,
            system=rag.SYSTEM,
            prompt=rag.build_prompt(body.question, sources),
            ms_embed=round((search_start - embed_start) * 1000),
            ms_search=round((answer_start - search_start) * 1000),
            ms_answer=round((done - answer_start) * 1000),
        )
    return QueryResponse(answer=text, sources=sources, trace=trace)


@app.post("/api/chunk-preview", response_model=ChunkPreviewResponse)
def chunk_preview(body: ChunkPreviewRequest) -> ChunkPreviewResponse:
    """Run the chunker and throw the result away. Nothing is embedded and
    nothing is stored — /flow uses it to show the split before you commit to it."""
    chunks = rag.chunk_text(body.text, settings.chunk_chars, settings.chunk_overlap)
    return ChunkPreviewResponse(
        chunks=chunks,
        shared=[
            rag.shared_prefix(chunks[i - 1], c, settings.chunk_overlap) if i else 0
            for i, c in enumerate(chunks)
        ],
        chunk_chars=settings.chunk_chars,
        chunk_overlap=settings.chunk_overlap,
    )


# ── Serving the console ─────────────────────────────
# In the container the built SPA sits next to the app package; in dev the
# directory is absent and Vite serves it instead, so these routes never
# register and the OpenAPI schema stays identical either way.
WEB = Path(__file__).resolve().parent.parent / "web"

if WEB.is_dir():
    app.mount("/assets", StaticFiles(directory=WEB / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        """Serve a real file if it exists, else index.html so client-side
        routes like /learn/embeddings survive a hard refresh."""
        candidate = (WEB / path).resolve()
        # `path` is attacker-controlled: resolve it and confirm it stayed
        # inside WEB before touching the filesystem.
        if path and candidate.is_relative_to(WEB) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(WEB / "index.html")


def _ingest(filename: str, text: str) -> Document:
    pieces = rag.chunk_text(text, settings.chunk_chars, settings.chunk_overlap)
    if not pieces:
        raise HTTPException(422, "Nothing to index")
    vectors = rag.embed(pieces)

    with db.pool.connection() as conn:
        row = conn.execute(
            "INSERT INTO documents (filename, chars) VALUES (%s, %s) RETURNING id, created_at",
            (filename, len(text)),
        ).fetchone()
        document_id, created_at = row
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO chunks (document_id, ordinal, text, embedding) VALUES (%s, %s, %s, %s)",
                [(document_id, i, p, v) for i, (p, v) in enumerate(zip(pieces, vectors))],
            )
    return Document(
        id=document_id,
        filename=filename,
        chars=len(text),
        chunks=len(pieces),
        created_at=created_at,
    )
