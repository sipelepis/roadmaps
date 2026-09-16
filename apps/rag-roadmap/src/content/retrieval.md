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
def test_top_k():
    """top-k by cosine, highest first"""
    chunks = [{"id": "a", "vector": [1, 0]}, {"id": "b", "vector": [0, 1]}, {"id": "c", "vector": [1, 1]}]
    assert [c["id"] for c in retrieve([1, 0], chunks, 2)] == ["a", "c"]
    assert [c["id"] for c in retrieve([0, 1], chunks, 3)] == ["b", "c", "a"]
    assert [c["id"] for c in retrieve([1, 0], chunks, 1)] == ["a"]

def test_scored_copies():
    """each result is a copy of its chunk with a score added"""
    chunks = [{"id": "a", "text": "alpha", "vector": [1, 0]}, {"id": "c", "text": "gamma", "vector": [1, 1]}]
    out = retrieve([1, 0], chunks, 2)
    assert abs(out[0]["score"] - 1.0) < 1e-9
    assert abs(out[1]["score"] - math.sqrt(0.5)) < 1e-9
    assert out[1]["text"] == "gamma" and out[1]["vector"] == [1, 1]
    assert all("score" not in c for c in chunks)

def test_threshold():
    """drops scores below min_score and keeps a score exactly at it"""
    chunks = [{"id": "a", "vector": [1, 0]}, {"id": "b", "vector": [0, 1]}, {"id": "c", "vector": [3, 4]}]
    assert [c["id"] for c in retrieve([1, 0], chunks, 3, min_score=0.5)] == ["a", "c"]
    assert [c["id"] for c in retrieve([1, 0], chunks, 3, min_score=0.6)] == ["a", "c"]
    assert [c["id"] for c in retrieve([1, 0], chunks, 3, min_score=0.61)] == ["a"]

def test_default_threshold():
    """by default a zero score stays and a negative one goes"""
    chunks = [{"id": "opposite", "vector": [-1, 0]}, {"id": "unrelated", "vector": [0, 1]}]
    assert [c["id"] for c in retrieve([1, 0], chunks, 5)] == ["unrelated"]
    assert retrieve([1, 0], [], 3) == []
```

#### Uses
- [Retrieval › Choosing k](#/retrieval/choosing-k)
- [Retrieval › A threshold, or an honest model](#/retrieval/a-threshold-or-an-honest-model)
- [Embeddings › Measuring nearness](#/embeddings/measuring-nearness)
- [Reference › Lists, dicts and sets](#/reference/lists-dicts-and-sets)
- [Reference › Shapes of the data](#/reference/shapes-of-the-data)

#### Hints
- Score every chunk and make a copy that carries the score: `{**c, "score": s}` leaves the original untouched.
- Drop the copies below `min_score`, sort the rest by score from high to low, and slice to `k`.

#### Tips
- `dict(c)` or `c.copy()` work too. Writing `c["score"] = ...` on the input fails the test that checks the input is unchanged — and in a real store it would leave the last query's score attached to the chunk forever.
- Threshold before you slice, not after. Filtering the top five down to two is a different result from taking the best two that cleared the bar.
- A threshold is model-specific. `0.4` on one embedding model is `0.7` on another, so re-tune it whenever you change models, and expect it to change when the corpus changes too.

#### Docs
- [Python docs: `dict.copy`](https://docs.python.org/3/library/stdtypes.html#dict.copy)
- [Python docs: `sorted()`](https://docs.python.org/3/library/functions.html#sorted)

### 2. Diagnose the failure

`diagnose(chunks, needle)` returns `"generation"` if any chunk's `text` contains `needle` (case-insensitive), otherwise `"retrieval"`.

```python starter
def diagnose(chunks, needle):
    ...
```

```python test
def test_present():
    """answer in any chunk means a generation problem"""
    chunks = [{"text": "Two Year warranty"}, {"text": "returns within 30 days"}]
    assert diagnose(chunks, "two year") == "generation"
    assert diagnose(chunks, "30 days") == "generation"
    assert diagnose(chunks, "year") == "generation"

def test_case():
    """matching ignores case on both sides"""
    assert diagnose([{"text": "the WARRANTY covers defects"}], "Warranty") == "generation"
    assert diagnose([{"text": "refund policy"}], "REFUND") == "generation"

def test_absent():
    """answer in no single chunk means a retrieval problem"""
    chunks = [{"text": "Two Year warranty"}, {"text": "returns within 30 days"}]
    assert diagnose(chunks, "refund") == "retrieval"
    assert diagnose(chunks, "warranty returns") == "retrieval"
    assert diagnose([], "x") == "retrieval"
```

#### Uses
- [Retrieval › The diagnostic that matters](#/retrieval/the-diagnostic-that-matters)

#### Hints
- Lowercase both the needle and each chunk's text before using `in`.
- `any(...)` over the chunks, then pick the string with a conditional expression.

#### Tips
- `casefold()` is the stricter `lower()` for comparing text: German `ß` casefolds to `ss`, where `lower()` leaves it alone. Use it whenever you compare text you did not write.
- A substring check is a stand-in for a human reading the chunks. It answers "is this string present", not "is the answer here" — a chunk saying the warranty is *not* two years contains "two year" just as well.
- Run this check before you touch the prompt. Rewriting a prompt to fix bad retrieval is the most expensive way to change nothing.

#### Docs
- [Python docs: `str.casefold`](https://docs.python.org/3/library/stdtypes.html#str.casefold)
- [Python docs: `any()`](https://docs.python.org/3/library/functions.html#any)

### 3. One document, so many slots

`dedupe_by_document(results, per_doc=1)` keeps at most `per_doc` results per `document_id`, preserving order.

```python starter
def dedupe_by_document(results, per_doc=1):
    ...
```

```python test
def test_dedupe():
    """keeps the first result of each document"""
    r = [{"id": 1, "document_id": 7}, {"id": 2, "document_id": 7}, {"id": 3, "document_id": 8}, {"id": 4, "document_id": 7}]
    assert [x["id"] for x in dedupe_by_document(r)] == [1, 3]
    r = [{"id": 1, "document_id": 8}, {"id": 2, "document_id": 7}, {"id": 3, "document_id": 8}, {"id": 4, "document_id": 9}]
    assert [x["id"] for x in dedupe_by_document(r)] == [1, 2, 4]

def test_per_doc():
    """per_doc sets the cap"""
    r = [{"id": 1, "document_id": 7}, {"id": 2, "document_id": 7}, {"id": 3, "document_id": 8}, {"id": 4, "document_id": 7}]
    assert [x["id"] for x in dedupe_by_document(r, per_doc=2)] == [1, 2, 3]
    assert [x["id"] for x in dedupe_by_document(r, per_doc=3)] == [1, 2, 3, 4]

def test_order():
    """keeps the ranked order instead of grouping by document"""
    r = [{"id": 1, "document_id": 7}, {"id": 2, "document_id": 8}, {"id": 3, "document_id": 7}, {"id": 4, "document_id": 8}, {"id": 5, "document_id": 7}]
    assert [x["id"] for x in dedupe_by_document(r, per_doc=2)] == [1, 2, 3, 4]
    assert dedupe_by_document([]) == []
```

#### Uses
- [Retrieval › Duplicates](#/retrieval/duplicates)
- [Reference › Lists, dicts and sets](#/reference/lists-dicts-and-sets)

#### Hints
- Keep a count per `document_id` in a dict as you walk the results.
- Append a result only while its document's count is below `per_doc`, and bump the count when you do.

#### Tips
- This runs on results that are already ranked, so the ones that survive are the best-scoring chunks of each document.
- Retrieve more than you need before capping. Cap `k=5` down to one chunk per document and a question answered by two documents comes back with two sources — raise `k` first, then cap.
- `dict.get(doc_id, 0)` avoids a `KeyError` on the first chunk of each document without a separate "have I seen this" branch.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)
