# At 10 million documents

Everything before this module describes a system you can hold in your head: extract, clean, chunk, embed, retrieve, prompt. That is a real RAG system and it works. It keeps working right up until the corpus stops being a thousand clean PDFs and starts being ten million scanned contracts, half-broken spreadsheets, and chat exports.

At that point almost every simplification becomes a bug. What follows is the map of what replaces them, grouped into three pillars. Read it as a preview of problems, not a to-do list: adding any of this before you have the failure it fixes is how projects die.

## Pillar 1: ingestion

**Formats come first, and they are not an AI problem.** You are no longer writing a parser, you are writing a universal translator, and you do not write it yourself. Apache Tika turns any file into clean text and metadata in one consistent shape. Unstructured partitions a document into typed elements, so the pipeline can tell a heading from a footnote. Docling handles the worst format of all, PDFs: reading order across columns, table structure recovery, OCR for the scanned pages. Tika gets you the words; the other two get you the shape.

**Chunking is where most bad RAG systems quietly die.** Tables atomic, headings carried as breadcrumbs, cuts on sentence boundaries. Chunk size is a metric; semantic completeness is the goal.

**Metadata is non-negotiable.** Date, source, access level, section. Some pipelines have a model precompute a summary, keywords, even hypothetical questions each chunk would answer, reverse-engineering retrieval before anyone asks anything.

## Pillar 2: retrieval as a funnel

**A relational filter first.** Only HR documents, only what this user may see, only this fiscal year. A database narrows ten million candidates to a few thousand instantly, so semantic search never wastes a cycle on rows the user was never allowed to read.

**Approximate vector search.** HNSW instead of an exact scan. A sliver of recall for an enormous speedup.

**Hybrid.** Dense vectors for meaning alongside BM25 for exact terms, fused.

**Rerank.** The top ~100 rescored by a cross-encoder that actually reads each candidate with the question.

```
SQL filter      10,000,000 → 5,000     what you may see
hybrid search        5,000 → 100       what is probably relevant
rerank                 100 → 5         what is actually relevant
```

Skip any step and the system returns garbage confidently, but quickly.

## Pillar 3: routing, safety, and knowing whether it works

**A router** asks first whether this message needs retrieval at all. A greeting goes straight to the model. An arithmetic question goes to a calculator. Why pay embedding latency for something solved in microseconds?

**A planner and tools** turn "summarise yesterday's latency and email DevOps" into two jobs. That is the line where RAG stops being a search engine and starts being an agent, and where injection stops being a bad answer and starts being an incident.

**A feedback loop.** Low confidence loops back to the router and tries a different strategy rather than shipping a mediocre answer. Production RAG is a loop permitted to doubt itself.

**Human validation as risk-tiering.** Cheap reversible actions run automatically. Money, deletions, and legal commitments get a person, and an audit log of who approved what.

**Measurement.** Retrieval precision and recall, faithfulness by judge, latency and cost per query, continuously.

## What to actually do with this

Nothing, yet. Recognise the symptom when it arrives: exact identifiers failing points at hybrid search, plausible-but-wrong ranking points at a reranker, slow queries point at an HNSW index, and answers that cite the wrong section point back at chunking. You already have the instrument for that diagnosis: the retrieved chunks and their scores, shown next to every answer.

```python playground
import re

GREETING = re.compile(r"^\s*(hi|hello|hey|thanks|thank you)\b", re.I)
ARITHMETIC = re.compile(r"^[\d\s+\-*/().]+$")

def route(query):
    if GREETING.match(query):
        return "chat"
    if ARITHMETIC.match(query) and any(ch.isdigit() for ch in query):
        return "calc"
    return "retrieve"

for q in ["hello there", "(12 + 30) * 2", "how long is the warranty?", "thanks!"]:
    print(f"{route(q):9} ← {q}")

SYMPTOMS = {
    "exact identifiers fail": "hybrid search",
    "plausible but wrong ranking": "reranker",
    "slow queries": "hnsw index",
    "cites the wrong section": "chunking",
}
for s, fix in SYMPTOMS.items():
    print(f"{s:28} → {fix}")

# Try: add a route for "translate …" that would go to a different model.
```

## Exercises

### 1. Route before you retrieve

`route(query)` returns `"chat"` for messages that start with a greeting (`hi`, `hello`, `hey`, `thanks`, `thank you`, any case), `"calc"` for messages made only of digits, spaces and `+ - * / ( ) .` that contain at least one digit, and `"retrieve"` for everything else.

```python starter
import re

def route(query):
    ...
```

```python test
def test_route():
    """triage by cheap rules"""
    assert route("Hello!") == "chat"
    assert route("thank you so much") == "chat"
    assert route("(12 + 30) * 2") == "calc"
    assert route("+ - *") == "retrieve"
    assert route("how long is the warranty") == "retrieve"
    assert route("hire a contractor") == "retrieve"
```

#### Uses
- [At 10 million documents › Pillar 3: routing, safety, and knowing whether it works](#/production/pillar-3-routing-safety-and-knowing-whether-it-works)

#### Hints
- Two regexes: one for a greeting at the start, one for a message made only of the allowed characters.
- End the greeting alternatives with `\b` so `hire` doesn't count as `hi`.
- The calc rule has two parts: the whole message matches the character class, and at least one character is a digit.

#### Tips
- Inside a character class `-` needs escaping (or goes last). `*`, `+`, `(`, `)` and `.` are literal there already.

#### Docs
- [Python docs: `re.match`](https://docs.python.org/3/library/re.html#re.match)
- [Python docs: `str.isdigit`](https://docs.python.org/3/library/stdtypes.html#str.isdigit)

### 2. Filter, then search

`filter_then_search(chunks, filters, query, k)` keeps only chunks whose `meta` dict matches every key/value in `filters`, then returns the `k` most similar of those by cosine of `vector` to `query`, highest first. `cosine` is provided.

```python starter
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

def filter_then_search(chunks, filters, query, k):
    ...
```

```python test
def test_filter_search():
    """hard filters before similarity"""
    chunks = [
        {"id": 1, "meta": {"dept": "hr", "year": 2025}, "vector": [1, 0]},
        {"id": 2, "meta": {"dept": "finance", "year": 2025}, "vector": [1, 0]},
        {"id": 3, "meta": {"dept": "hr", "year": 2024}, "vector": [0.5, 0.5]},
    ]
    assert [c["id"] for c in filter_then_search(chunks, {"dept": "hr"}, [1, 0], 5)] == [1, 3]
    assert [c["id"] for c in filter_then_search(chunks, {"dept": "hr", "year": 2025}, [0, 1], 5)] == [1]
    assert filter_then_search(chunks, {"dept": "legal"}, [1, 0], 5) == []
    assert filter_then_search(chunks, {}, [1, 0], 1)[0]["id"] == 1
```

#### Uses
- [At 10 million documents › Pillar 2: retrieval as a funnel](#/production/pillar-2-retrieval-as-a-funnel)
- [Retrieval › Choosing k](#/retrieval/choosing-k)
- [Embeddings › Measuring nearness](#/embeddings/measuring-nearness)

#### Hints
- A chunk passes when every `key, value` in `filters.items()` equals `c["meta"].get(key)`. `all(...)` is `True` for an empty filter.
- Sort the chunks that pass by `cosine(query, c["vector"])`, highest first, and slice to `k`.

#### Tips
- `.get(key)` rather than `[key]` means a chunk missing a metadata field is filtered out instead of crashing the search.

#### Docs
- [Python docs: `all()`](https://docs.python.org/3/library/functions.html#all)
- [Python docs: `dict.items`](https://docs.python.org/3/library/stdtypes.html#dict.items)

### 3. Symptom to fix

`fix_for(symptom)` maps `"exact identifiers fail"` to `"hybrid search"`, `"plausible but wrong ranking"` to `"reranker"`, `"slow queries"` to `"hnsw index"`, and `"cites the wrong section"` to `"chunking"`. Anything else returns `"look at the retrieved chunks first"`.

```python starter
def fix_for(symptom):
    ...
```

```python test
def test_fix_for():
    """the four symptoms and the default"""
    assert fix_for("slow queries") == "hnsw index"
    assert fix_for("exact identifiers fail") == "hybrid search"
    assert fix_for("cites the wrong section") == "chunking"
    assert fix_for("plausible but wrong ranking") == "reranker"
    assert fix_for("the model is bad") == "look at the retrieved chunks first"
```

#### Uses
- [At 10 million documents › What to actually do with this](#/production/what-to-actually-do-with-this)

#### Hints
- A dict from symptom to fix holds the four pairs.
- `dict.get(key, default)` returns the default for anything it doesn't know.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)
