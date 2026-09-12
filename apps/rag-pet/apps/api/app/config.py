from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://rag:rag@localhost:5433/rag"

    anthropic_api_key: str = ""

    # Any OpenAI-compatible embeddings endpoint; OpenAI direct by default.
    # The dims must match the model, and the VECTOR column is declared at that width.
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_model: str = "text-embedding-3-small"
    embedding_dims: int = 1536
    chat_model: str = "claude-opus-5"

    chunk_chars: int = 1200
    chunk_overlap: int = 200
    top_k: int = 5

    # The app is public with no accounts. These cap what one visitor can cost.
    max_chars: int = 200_000
    max_upload_bytes: int = 5_000_000
    write_key: str = ""  # set in production: required on ingest and delete

    class Config:
        env_file = ".env"


settings = Settings()
