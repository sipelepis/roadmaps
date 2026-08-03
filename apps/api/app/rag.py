import anthropic
from openai import OpenAI

from .config import settings
from .models import Chunk

SYSTEM = (
    "Answer the question using only the numbered sources below. "
    "Cite the sources you used as [1], [2], etc. "
    "If the sources don't contain the answer, say so plainly — do not guess."
)


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    """Sliding window over characters, backed off to the nearest whitespace so
    chunks don't split mid-word."""
    if size <= overlap:
        raise ValueError("chunk size must exceed overlap")
    text = text.strip()
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(" ", start + size // 2, end)
            if space > start:
                end = space
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)  # max() guarantees forward progress
    return chunks


def embed(texts: list[str]) -> list[list[float]]:
    client = OpenAI(api_key=settings.openai_api_key)
    result = client.embeddings.create(model=settings.embedding_model, input=texts)
    return [d.embedding for d in result.data]


def answer(question: str, sources: list[Chunk]) -> str:
    if not sources:
        return "Nothing indexed yet — upload a document first."

    context = "\n\n".join(
        f"[{i}] ({c.filename}) {c.text}" for i, c in enumerate(sources, 1)
    )
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=settings.chat_model,
        max_tokens=2048,
        system=SYSTEM,
        # ponytail: low effort — grounded extraction doesn't need deep reasoning.
        # Raise to "medium" if answers start missing things spread across sources.
        output_config={"effort": "low"},
        messages=[
            {"role": "user", "content": f"{context}\n\nQuestion: {question}"}
        ],
    )
    return "".join(b.text for b in response.content if b.type == "text")


def demo() -> None:
    body = " ".join(f"word{i}" for i in range(400))
    pieces = chunk_text(body, size=200, overlap=40)
    assert len(pieces) > 1, "long text must split"
    assert all(len(p) <= 200 for p in pieces), "no chunk may exceed the size"
    assert not any(p.startswith(" ") or p.endswith(" ") for p in pieces)
    assert "".join(pieces).replace(" ", "") != "", "chunks must carry content"
    # every word survives somewhere
    joined = " ".join(pieces)
    assert "word0" in joined and "word399" in joined
    assert chunk_text("", 100, 10) == []
    assert chunk_text("short", 100, 10) == ["short"]
    print("ok")


if __name__ == "__main__":
    demo()
