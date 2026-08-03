import psycopg
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector

from .config import settings

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id         SERIAL PRIMARY KEY,
    filename   TEXT NOT NULL,
    chars      INT  NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id          SERIAL PRIMARY KEY,
    document_id INT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal     INT  NOT NULL,
    text        TEXT NOT NULL,
    embedding   VECTOR({dims}) NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);
"""

# ponytail: no ANN index — exact scan is fine well past 100k chunks on a pet.
# Add `USING hnsw (embedding vector_cosine_ops)` on chunks when queries drag.

pool = ConnectionPool(
    settings.database_url,
    min_size=1,
    max_size=8,
    open=False,
    configure=register_vector,
)


def startup() -> None:
    """Create the extension + tables, then open the pool. Order matters:
    register_vector() needs the `vector` type to already exist."""
    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        conn.execute(SCHEMA.format(dims=settings.embedding_dims))
    pool.open()


def shutdown() -> None:
    pool.close()


def healthy() -> bool:
    try:
        with pool.connection() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False
