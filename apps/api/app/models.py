"""Wire contract. These pydantic models are the ONLY source of truth for shared
types — `nx run shared:codegen` turns them into libs/shared/src/api.gen.ts via
the OpenAPI schema. Never hand-edit the TS side."""

from datetime import datetime

from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str
    database: bool


class Document(BaseModel):
    id: int
    filename: str
    chars: int
    chunks: int
    created_at: datetime


class Chunk(BaseModel):
    id: int
    document_id: int
    filename: str
    ordinal: int
    text: str
    score: float


class IngestText(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1)


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)
    trace: bool = False


class Trace(BaseModel):
    """What actually happened inside one query. Opt-in via QueryRequest.trace
    because the vector preview and the full prompt only matter to /flow."""

    embedding_dims: int
    embedding_preview: list[float]  # leading dims only — 1536 floats teach nothing
    chunks_scanned: int
    system: str
    prompt: str  # byte-for-byte what the model was sent
    ms_embed: int
    ms_search: int
    ms_answer: int


class QueryResponse(BaseModel):
    answer: str
    sources: list[Chunk]
    trace: Trace | None = None


class ChunkPreviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)


class ChunkPreviewResponse(BaseModel):
    """A dry run of the chunker: same function ingest uses, nothing embedded
    and nothing stored."""

    chunks: list[str]
    shared: list[int]  # chars chunk i repeats from chunk i-1; first is always 0
    chunk_chars: int
    chunk_overlap: int


class Stats(BaseModel):
    documents: int
    chunks: int
    chat_model: str
    embedding_model: str
    embedding_dims: int
    chunk_chars: int
    chunk_overlap: int
