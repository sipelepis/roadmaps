from contextlib import asynccontextmanager
from io import BytesIO

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

from . import db, rag
from .config import settings
from .models import (
    Chunk,
    Document,
    Health,
    IngestText,
    QueryRequest,
    QueryResponse,
    Stats,
)


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
    vector = rag.embed([body.question])[0]
    with db.pool.connection() as conn:
        rows = conn.execute(
            """SELECT c.id, c.document_id, d.filename, c.ordinal, c.text,
                      1 - (c.embedding <=> %s::vector) AS score
               FROM chunks c JOIN documents d ON d.id = c.document_id
               ORDER BY c.embedding <=> %s::vector
               LIMIT %s""",
            (vector, vector, body.top_k),
        ).fetchall()
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
    return QueryResponse(answer=rag.answer(body.question, sources), sources=sources)


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
