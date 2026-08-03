from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://rag:rag@localhost:5433/rag"

    openai_api_key: str = ""
    anthropic_api_key: str = ""

    embedding_model: str = "text-embedding-3-small"
    embedding_dims: int = 1536
    chat_model: str = "claude-opus-5"

    chunk_chars: int = 1200
    chunk_overlap: int = 200
    top_k: int = 5

    class Config:
        env_file = ".env"


settings = Settings()
