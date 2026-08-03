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


class QueryResponse(BaseModel):
    answer: str
    sources: list[Chunk]


class Stats(BaseModel):
    documents: int
    chunks: int
    chat_model: str
    embedding_model: str
