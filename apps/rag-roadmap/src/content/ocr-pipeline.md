# Build the OCR → RAG pipeline

Everything on the roadmap, assembled. A document arrives as pages. Some have a text layer, some are scans. The pipeline extracts what it can, OCRs what it must, cleans the result, chunks it, embeds it, stores it, and answers a question with a grounded prompt that cites its sources.

```
pages ─┬─ text layer ──────────┐
       └─ no text → OCR ───────┤
                               ▼
                    clean → chunk → embed → store
                                              │
question → embed → top-k ─────────────────────┘
                     │
                     ▼
              numbered prompt → model → cited answer
```

Nothing new is introduced here. The point of the capstone is that each piece is small and the seams are where the bugs live: OCR called on every page instead of the empty ones, cleaning run after chunking instead of before, a question embedded with a different function than the chunks, sources numbered from zero.

## What the toy leaves out

The embedding is a hashed bag of words, so it retrieves by shared vocabulary rather than meaning. The OCR is a function you pass in. The store is a list. Swap in a real embedding model, Tesseract or a hosted OCR, and pgvector, and the shape of the code does not change. That is the claim the whole roadmap has been making, and this is where you check it.

## Order of operations

1. **Extract.** Text layer per page; OCR only for pages that came back blank.
2. **Clean.** Normalize unicode, join hyphenated line breaks, collapse whitespace. Before chunking, so the chunker sees words, not fragments.
3. **Chunk.** Sliding window with overlap.
4. **Embed and store.** One vector per chunk, with filename and ordinal attached.
5. **Ask.** Embed the question with the same function, take the top-k, build the numbered prompt.

```python playground
import math, re, unicodedata, zlib

def embed(text, dims=32):
    v = [0.0] * dims
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        v[zlib.crc32(word.encode()) % dims] += 1.0
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else v

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

def chunk_text(text, size, overlap):
    text = text.strip(); chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(" ", start + size // 2, end)
            if space > start: end = space
        piece = text[start:end].strip()
        if piece: chunks.append(piece)
        if end >= len(text): break
        start = max(end - overlap, start + 1)
    return chunks

def clean(text):
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    return re.sub(r"[ \t]+", " ", text).strip()

pages = ["The product ships with a two year warranty period covering defects.", None]
scans = {1: "Returns are accepted within thirty days with the original re-\nceipt."}

texts = [p if (p or "").strip() else scans[i] for i, p in enumerate(pages)]
chunks = [{"ordinal": i, "text": c, "vector": embed(c)} for i, c in enumerate(chunk_text(clean("\n".join(texts)), 80, 20))]
print(len(chunks), "chunks")

q = "how long is the warranty period"
top = sorted(chunks, key=lambda c: -cosine(embed(q), c["vector"]))[:2]
prompt = "\n\n".join(f"[{i}] (manual.pdf) {c['text']}" for i, c in enumerate(top, 1)) + f"\n\nQuestion: {q}"
print(prompt)

# Try: ask about the receipt and confirm the OCR'd page wins.
```

## Exercises

### 1. Extract with OCR fallback

`extract(pages, ocr)` returns one string per page: the text layer if it is not blank, otherwise `ocr(index)`. Then `clean(text)` normalizes unicode with NFKC, joins `-\n` between word characters, and collapses runs of spaces and tabs to one space, stripping the ends.

```python starter
import re, unicodedata

def extract(pages, ocr):
    ...

def clean(text):
    ...
```

```python test
def test_extract_clean():
    """ocr only when needed, then clean"""
    calls = []
    def ocr(i):
        calls.append(i)
        return "re-\nceipt  here"
    assert extract(["a", None, "  "], ocr) == ["a", "re-\nceipt  here", "re-\nceipt  here"]
    assert calls == [1, 2]
    assert clean("re-\nceipt  here ﬁne") == "receipt here fine"
```

### 2. Ingest

`ingest(filename, pages, ocr, size=80, overlap=20)` runs extract, joins the pages with `"\n"`, cleans, chunks with the provided `chunk_text`, and returns a list of dicts with `filename`, `ordinal`, `text` and `vector` (from the provided `embed`). Reuse your `extract` and `clean`.

```python starter
import math, re, unicodedata, zlib

def embed(text, dims=32):
    v = [0.0] * dims
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        v[zlib.crc32(word.encode()) % dims] += 1.0
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else v

def chunk_text(text, size, overlap):
    text = text.strip(); chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(" ", start + size // 2, end)
            if space > start: end = space
        piece = text[start:end].strip()
        if piece: chunks.append(piece)
        if end >= len(text): break
        start = max(end - overlap, start + 1)
    return chunks

def extract(pages, ocr):
    ...

def clean(text):
    ...

def ingest(filename, pages, ocr, size=80, overlap=20):
    ...
```

```python test
def test_ingest():
    """pages become cleaned, embedded chunks"""
    pages = ["The product ships with a two year warranty period covering defects.", None]
    calls = []
    def ocr(i):
        calls.append(i)
        return "Returns are accepted within thirty days with the original re-\nceipt."
    chunks = ingest("manual.pdf", pages, ocr)
    assert calls == [1]
    assert len(chunks) >= 2
    assert [c["ordinal"] for c in chunks] == list(range(len(chunks)))
    assert all(c["filename"] == "manual.pdf" and len(c["vector"]) == 32 for c in chunks)
    joined = " ".join(c["text"] for c in chunks)
    assert "receipt" in joined and "re-\n" not in joined
    assert "warranty" in joined
```

### 3. Ask

`ask(question, chunks, k=2)` embeds the question with the same `embed`, picks the `k` most similar chunks by cosine, and returns a dict with `sources` (those chunks, each with a `score` added, highest first) and `prompt` (numbered from 1, `[n] (filename) text`, joined by blank lines, then a blank line and `Question: …`).

```python starter
import math, re, zlib

def embed(text, dims=32):
    v = [0.0] * dims
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        v[zlib.crc32(word.encode()) % dims] += 1.0
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else v

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

def ask(question, chunks, k=2):
    ...
```

```python test
def test_ask():
    """retrieves by the same embedding and builds the numbered prompt"""
    texts = ["two year warranty period covering defects", "returns accepted within thirty days with receipt", "refunds to the original payment method"]
    chunks = [{"filename": "manual.pdf", "ordinal": i, "text": t, "vector": embed(t)} for i, t in enumerate(texts)]
    out = ask("how long is the warranty period", chunks, k=2)
    assert out["sources"][0]["text"].startswith("two year warranty")
    assert len(out["sources"]) == 2
    assert out["sources"][0]["score"] >= out["sources"][1]["score"]
    assert out["prompt"].startswith("[1] (manual.pdf) two year warranty")
    assert out["prompt"].endswith("\n\nQuestion: how long is the warranty period")
    assert ask("receipt", chunks, k=1)["sources"][0]["ordinal"] == 1
```
