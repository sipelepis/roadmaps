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
def test_extract():
    """calls ocr only for blank pages, with their index"""
    calls = []
    def ocr(i):
        calls.append(i)
        return f"scan {i}"
    assert extract(["a", None, "  "], ocr) == ["a", "scan 1", "scan 2"]
    assert extract(["  native text  ", "b"], ocr) == ["  native text  ", "b"]
    assert calls == [1, 2]

def test_clean():
    """normalizes unicode, joins broken words, collapses spaces"""
    assert clean("re-\nceipt  here ﬁne") == "receipt here fine"
    assert clean("  a\t\tb  ") == "a b"
    assert clean("① ﬂoor") == "1 floor"

def test_clean_keeps():
    """keeps line breaks and real hyphens"""
    assert clean("para one\n\npara two") == "para one\n\npara two"
    assert clean("well-known") == "well-known"
    assert clean("x -\ny") == "x -\ny"
```

#### Uses
- [OCR: pages as pictures › When to run it](#/ocr/when-to-run-it)
- [Cleaning extracted text › The usual suspects](#/cleaning/the-usual-suspects)
- [Build the OCR → RAG pipeline › Order of operations](#/ocr-pipeline/order-of-operations)
- [Documents to text › Pages come with their index](#/documents/pages-come-with-their-index)

#### Hints
- `extract` is the fallback from the OCR module: enumerate the pages and call `ocr(i)` only when `(p or "").strip()` is empty.
- `clean` is three steps in order: NFKC with `unicodedata.normalize`, `re.sub` to join `-\n` between word characters, then another `re.sub` for runs of spaces and tabs, and a final strip.

#### Tips
- Collapse `[ \t]+`, not `\s+`. `\s` matches newlines too, and would flatten the paragraph breaks chunkers rely on.
- Normalize before dehyphenating. NFKC changes which characters exist, and `\w` has to see the normalised ones — a ligature or a full-width letter either side of the `-\n` would otherwise not match.
- `extract` returns the native text untouched, spaces and all. Cleaning is `clean`'s job; two functions that each strip a little is how you end up unable to say which one broke something.

#### Docs
- [Python docs: `unicodedata.normalize`](https://docs.python.org/3/library/unicodedata.html#unicodedata.normalize)
- [Python docs: `re.sub`](https://docs.python.org/3/library/re.html#re.sub)

### 2. Ingest

`ingest(filename, pages, ocr, size=80, overlap=20)` runs extract, joins the pages with `"\n"`, cleans, chunks with the provided `chunk_text`, and returns a list of dicts with `filename`, `ordinal`, `text` and `vector` (from the provided `embed`). Fill in `extract` and `clean` again, as in exercise 1.

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

def test_rows():
    """each row is filename, ordinal, text, and embed of that text"""
    chunks = ingest("a.txt", ["Short page.", None], lambda i: "Scanned  re-\nceipt text.")
    text = "Short page.\nScanned receipt text."
    assert chunks == [{"filename": "a.txt", "ordinal": 0, "text": text, "vector": embed(text)}]

def test_join_then_clean():
    """joins pages with a newline before cleaning, so a word split across pages is rejoined"""
    chunks = ingest("contract.pdf", ["The agree-", "ment renews yearly."], lambda i: "")
    assert [c["text"] for c in chunks] == ["The agreement renews yearly."]

def test_size_and_overlap():
    """passes size and overlap on to chunk_text"""
    text = "one two three four five six seven eight nine ten"
    for size, overlap in [(20, 5), (12, 0)]:
        chunks = ingest("n.txt", [text], lambda i: "", size=size, overlap=overlap)
        assert [c["text"] for c in chunks] == chunk_text(text, size, overlap)
        assert all(c["vector"] == embed(c["text"]) for c in chunks)
```

#### Uses
- [Build the OCR → RAG pipeline › Order of operations](#/ocr-pipeline/order-of-operations)
- [Structure & metadata › Filename and ordinal](#/metadata/filename-and-ordinal)
- [Chunking › The sliding window](#/chunking/the-sliding-window)
- [Embeddings › A toy you can run offline](#/embeddings/a-toy-you-can-run-offline)
- [Documents to text › Pages come with their index](#/documents/pages-come-with-their-index)

#### Hints
- Copy your `extract` and `clean` from exercise 1. The rest is plumbing.
- Chain them in the article's order: extract, join with `"\n"`, clean, then `chunk_text` with `size` and `overlap`.
- `enumerate` the chunks to build the dicts, with `vector` set to `embed` of the chunk's text.

#### Tips
- Clean before chunking. Chunk first and `re-` and `ceipt` can land in different chunks, where no regex will ever join them.
- Join the pages *before* cleaning too. A word hyphenated across a page break only rejoins once the two pages are one string, which is what `test_join_then_clean` is checking.
- Every seam in this function is a real bug somebody has shipped: OCR on every page, cleaning after chunking, sources numbered from zero. The order is the lesson; the code is four lines.

#### Docs
- [Python docs: `enumerate()`](https://docs.python.org/3/library/functions.html#enumerate)

### 3. Ask

`ask(question, chunks, k=2)` embeds the question with the same `embed`, picks the `k` most similar chunks by cosine, and returns a dict with `sources` (those chunks, each with a `score` added, highest first) and `prompt` (numbered from 1, `[n] (filename) text`, joined by blank lines, then a blank line and `Question: …`). Leave the input chunks unchanged.

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

def test_prompt_format():
    """numbers sources from 1 with their own filenames"""
    texts = [("a.pdf", "warranty covers defects"), ("b.md", "refunds within ten days")]
    chunks = [{"filename": f, "ordinal": 0, "text": t, "vector": embed(t)} for f, t in texts]
    out = ask("refunds within ten days", chunks)
    assert out["prompt"] == "[1] (b.md) refunds within ten days\n\n[2] (a.pdf) warranty covers defects\n\nQuestion: refunds within ten days"
    out = ask("warranty covers defects", chunks, k=1)
    assert out["prompt"] == "[1] (a.pdf) warranty covers defects\n\nQuestion: warranty covers defects"

def test_scores():
    """scores are cosine to the question, on copies of the chunks"""
    texts = ["two year warranty period covering defects", "returns accepted within thirty days with receipt", "refunds to the original payment method"]
    chunks = [{"filename": "manual.pdf", "ordinal": i, "text": t, "vector": embed(t)} for i, t in enumerate(texts)]
    q = embed("refund of the payment")
    out = ask("refund of the payment", chunks, k=3)
    assert all(abs(s["score"] - cosine(q, s["vector"])) < 1e-9 for s in out["sources"])
    scores = [s["score"] for s in out["sources"]]
    assert scores == sorted(scores, reverse=True)
    assert all("score" not in c for c in chunks)

def test_k():
    """k sets how many sources come back, 2 by default"""
    texts = ["two year warranty period covering defects", "returns accepted within thirty days with receipt", "refunds to the original payment method"]
    chunks = [{"filename": "manual.pdf", "ordinal": i, "text": t, "vector": embed(t)} for i, t in enumerate(texts)]
    assert len(ask("warranty", chunks)["sources"]) == 2
    assert len(ask("warranty", chunks, k=3)["sources"]) == 3
    assert "[2]" not in ask("warranty", chunks, k=1)["prompt"]
```

#### Uses
- [Build the OCR → RAG pipeline › Order of operations](#/ocr-pipeline/order-of-operations)
- [Retrieval › Choosing k](#/retrieval/choosing-k)
- [Grounded prompts › The f-string that is "augmented generation"](#/prompting/the-f-string-that-is-augmented-generation)
- [Reference › Lists, dicts and sets](#/reference/lists-dicts-and-sets)

#### Hints
- Embed the question once, then score each chunk with `cosine` against its `vector`, making a copy that carries the `score`.
- Sort the copies by score from high to low and keep the first `k`. Those are the `sources`.
- Build the prompt exactly like `build_prompt` in the prompting module: numbered from 1 with `enumerate`, joined with blank lines, then the question.

#### Tips
- Embed the question with the same function as the chunks. Any other function still returns results, just the wrong ones, with no error.
- Embed it once, outside the loop. Re-embedding per chunk is the same answer and, with a real API, one HTTP request per chunk.
- Build `sources` and `prompt` from the same sorted list. Two separate sorts is how `[2]` in the prompt stops being the second source in the panel, and nobody notices until a citation is checked.
- Return scored copies. The chunks here stand in for rows in a store, and a `score` written onto them is last query's answer attached to the corpus.

#### Docs
- [Python docs: `sorted()`](https://docs.python.org/3/library/functions.html#sorted)
- [Python tutorial: Formatted string literals](https://docs.python.org/3/tutorial/inputoutput.html#formatted-string-literals)
