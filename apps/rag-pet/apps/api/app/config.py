from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://rag:rag@localhost:5433/rag"

    anthropic_api_key: str = ""

    # Any OpenAI-compatible embeddings endpoint. Defaults to OpenRouter, which
    # proxies text-embedding-3-small at its native 1536 dims; point base_url at
    # api.openai.com and drop the `openai/` prefix to go direct instead.
    embedding_api_key: str = ""
    embedding_base_url: str = "https://openrouter.ai/api/v1"
    embedding_model: str = "openai/text-embedding-3-small"
    embedding_dims: int = 1536
    chat_model: str = "claude-opus-5"

    chunk_chars: int = 1200
    chunk_overlap: int = 200
    top_k: int = 5

    class Config:
        env_file = ".env"


settings = Settings()
