# Retrieval

The retrieval step is one query: embed the question, order every chunk by distance to it, take the first *k*. Everything the model will ever see about your corpus is decided right there.

```sql
SELECT text, 1 - (embedding <=> :question_vector) AS score
FROM chunks
ORDER BY embedding <=> :question_vector
LIMIT 5
```

Worth saying plainly, because it is the most common wrong mental model: the question text is never matched against the chunk text. No keywords, no `LIKE`, no full-text index. The only thing compared is the vector, which is why a question phrased completely differently from the document can still retrieve it, and why an exact quotation sometimes does not.

## Choosing k

Too low and the answer is missing; too high and the genuinely relevant passage gets buried in four irrelevant ones, which measurably degrades the answer. Five is a sane default for focused questions. Raise it for questions that need to synthesise across sources, lower it when your chunks are large. Cap it, because everything retrieved gets pasted into the prompt and paid for.

## A threshold, or an honest model

With no score threshold, a corpus that contains nothing relevant still returns the five least-irrelevant chunks with low scores, and the model is asked to answer from them. There are two ways to handle that: a minimum similarity below which a chunk is not returned, or an instruction to the model to say plainly when the sources do not contain the answer. Do both. The threshold saves the prompt from noise; the instruction covers the chunks that cleared it and still do not help.

## Duplicates

Upload the same file twice and retrieval happily fills the top five slots with two copies of the same passage. Even without duplicates, one long document can dominate every slot. Capping how many chunks a single document may contribute is a two-line fix that noticeably improves synthesis across sources.

## The diagnostic that matters

When an answer is wrong, look at the retrieved chunks before touching the prompt:

```
Is the answer present in the retrieved chunks?
  no  → retrieval problem. Fix chunking, k, or the corpus itself.
  yes → generation problem. Fix the prompt.
```

Those two failures look identical from the outside and have nothing in common as fixes. Rewriting a prompt to repair bad retrieval is the most common wasted afternoon in this field. Showing the chunks next to the answer is what prevents it, and it is the one piece of production architecture worth having from day one.

```python playground
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

texts = [
    "The product ships with a two year warranty covering defects.",
    "Returns are accepted within thirty days of delivery.",
    "Refunds go to the original payment method.",
    "The warranty does not cover accidental damage.",
]
chunks = [{"id": i, "text": t, "vector": embed(t)} for i, t in enumerate(texts)]

question = "how long is the warranty"
q = embed(question)
ranked = sorted(chunks, key=lambda c: -cosine(q, c["vector"]))
for c in ranked[:3]:
    print(f"{cosine(q, c['vector']):.2f}  {c['text']}")

needle = "two year"
present = any(needle in c["text"] for c in ranked[:3])
print("answer present in top 3:", present, "→", "generation problem" if present else "retrieval problem")

# Try: ask about "refund timing" and see which chunk wins and why.
```

## Exercises

### 1. Top-k with a threshold

`retrieve(query, chunks, k, min_score=0.0)` returns up to `k` chunks (dicts with a `vector`) most similar to `query` by cosine, highest first, each copied with a `score` key added. Chunks scoring below `min_score` are excluded. `cosine` is provided.

```python starter
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

def retrieve(query, chunks, k, min_score=0.0):
    ...
```

```python test
def test_retrieve():
    """top-k by cosine, thresholded, scored"""
    chunks = [
        {"id": "a", "vector": [1, 0]},
        {"id": "b", "vector": [0, 1]},
        {"id": "c", "vector": [1, 1]},
    ]
    out = retrieve([1, 0], chunks, 2)
    assert [c["id"] for c in out] == ["a", "c"]
    assert abs(out[0]["score"] - 1.0) < 1e-9
    assert "score" not in chunks[0]
    assert [c["id"] for c in retrieve([1, 0], chunks, 3, min_score=0.5)] == ["a", "c"]
    assert retrieve([1, 0], [], 3) == []
```

### 2. Diagnose the failure

`diagnose(chunks, needle)` returns `"generation"` if any chunk's `text` contains `needle` (case-insensitive), otherwise `"retrieval"`.

```python starter
def diagnose(chunks, needle):
    ...
```

```python test
def test_diagnose():
    """present means generation problem, absent means retrieval problem"""
    chunks = [{"text": "Two Year warranty"}, {"text": "returns"}]
    assert diagnose(chunks, "two year") == "generation"
    assert diagnose(chunks, "refund") == "retrieval"
    assert diagnose([], "x") == "retrieval"
```

### 3. One document, so many slots

`dedupe_by_document(results, per_doc=1)` keeps at most `per_doc` results per `document_id`, preserving order.

```python starter
def dedupe_by_document(results, per_doc=1):
    ...
```

```python test
def test_dedupe():
    """caps results per document"""
    r = [{"id": 1, "document_id": 7}, {"id": 2, "document_id": 7}, {"id": 3, "document_id": 8}, {"id": 4, "document_id": 7}]
    assert [x["id"] for x in dedupe_by_document(r)] == [1, 3]
    assert [x["id"] for x in dedupe_by_document(r, per_doc=2)] == [1, 2, 3]
    assert dedupe_by_document([]) == []
```
