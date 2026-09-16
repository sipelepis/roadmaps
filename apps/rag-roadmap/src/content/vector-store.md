# Storing vectors

There is no separate vector database in a small RAG system, and there does not need to be one. The `vector` extension adds a column type and a set of distance operators to Postgres, and that is the whole of the infrastructure: chunks sit in a normal table, next to normal columns, covered by normal transactions and normal backups.

## The schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
    id          SERIAL PRIMARY KEY,
    document_id INT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal     INT  NOT NULL,
    text        TEXT NOT NULL,
    embedding   VECTOR(1536) NOT NULL
);
```

Three details in that schema are doing real work.

**The column has a fixed width.** `VECTOR(1536)` matches the embedding model's output. Insert a vector of a different length and Postgres refuses. That is the one place a model mismatch is caught loudly instead of silently.

**`ON DELETE CASCADE`.** Deleting a document removes its chunks in the same statement. Without it, deleted sources keep answering questions: the console shows an empty corpus while the model keeps citing a document nobody can see.

**The text is stored next to the vector.** Retrieval has to return something readable. A coordinate cannot be pasted into a prompt.

## The search is one operator

```sql
SELECT text, 1 - (embedding <=> :question) AS score
FROM chunks
ORDER BY embedding <=> :question
LIMIT 5
```

`<=>` is cosine distance: 0 when two vectors point the same way, 2 when opposite. Ordering ascending by it puts the closest chunks first, and `1 - distance` flips it into the similarity score a console shows.

## Exact scan, and the index you do not have yet

With no index on the vector column, Postgres computes the distance between the question and *every* chunk before applying the limit. That sounds bad and is fine: exact search has no recall loss, no tuning parameters, and stays fast well past a hundred thousand chunks.

```sql
-- when queries start to drag:
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
```

HNSW, a hierarchical navigable small world graph, navigates a layered network to approximate the nearest neighbours instead of scanning linearly. You trade a sliver of accuracy for an enormous speedup. That is not a bug, it is the deal you are signing, and it is worth signing only once the scan is measurably slow.

## Why not a vector database

pgvector puts vectors in a column next to your ordinary data, so a document's filename, its chunks, and their embeddings live in one place with one query language and one backup. A dedicated vector database becomes worth the extra service when you need heavy metadata filtering or hundreds of millions of vectors. For a corpus you can imagine, it is a service to run for no benefit.

```python playground
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

# An in-memory stand-in for the chunks table. Same shape, same query.
rows = [
    {"id": 1, "document_id": 1, "text": "two year warranty", "embedding": [1.0, 0.0, 0.0]},
    {"id": 2, "document_id": 1, "text": "returns within thirty days", "embedding": [0.0, 1.0, 0.0]},
    {"id": 3, "document_id": 2, "text": "warranty claims by email", "embedding": [0.8, 0.0, 0.6]},
]
question = [1.0, 0.0, 0.2]

scored = sorted(rows, key=lambda r: 1 - cosine(r["embedding"], question))   # ORDER BY embedding <=> question
for r in scored[:2]:                                                          # LIMIT 2
    print(f"{cosine(r['embedding'], question):.2f}  {r['text']}")

# Try: delete document 1 and re-run. Every row of it must go.
```

## Exercises

### 1. An in-memory vector store

Implement `VectorStore(dims)` with `add(chunk_id, vector)`, which raises `ValueError` when `len(vector) != dims`; `search(query, k)`, which returns a list of `(chunk_id, score)` pairs for the `k` most similar vectors by cosine, highest first; and `__len__`. `cosine` is provided.

```python starter
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

class VectorStore:
    def __init__(self, dims):
        ...

    def add(self, chunk_id, vector):
        ...

    def search(self, query, k):
        ...

    def __len__(self):
        ...
```

```python test
def test_add_and_len():
    """counts what was added and refuses wrong widths"""
    s = VectorStore(2)
    assert len(s) == 0
    s.add("a", [1, 0]); s.add("b", [0, 1]); s.add("c", [1, 1])
    assert len(s) == 3
    for bad in ([1, 2, 3], [1]):
        try:
            s.add("bad", bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f"a vector of width {len(bad)} must raise")
    assert len(s) == 3

def test_search():
    """returns (chunk_id, score) pairs by cosine, highest first"""
    s = VectorStore(2)
    s.add("a", [1, 0]); s.add("b", [0, 1]); s.add("c", [1, 1])
    top = s.search([1, 0.1], 2)
    assert [t[0] for t in top] == ["a", "c"]
    assert abs(top[0][1] - cosine([1, 0.1], [1, 0])) < 1e-9
    assert abs(top[1][1] - cosine([1, 0.1], [1, 1])) < 1e-9
    assert [t[0] for t in s.search([0, 1], 3)] == ["b", "c", "a"]

def test_k():
    """k caps the results, and a big k returns everything"""
    s = VectorStore(3)
    assert s.search([1, 0, 0], 5) == []
    s.add(1, [1, 0, 0]); s.add(2, [0, 1, 0])
    assert len(s.search([1, 0, 0], 10)) == 2
    assert len(s.search([1, 0, 0], 1)) == 1
    assert s.search([1, 0, 0], 0) == []

def test_separate_stores():
    """each store keeps its own width and rows"""
    small, big = VectorStore(2), VectorStore(3)
    small.add("x", [1, 0])
    big.add("y", [1, 0, 0])
    assert len(small) == 1 and len(big) == 1
    assert [t[0] for t in big.search([1, 0, 0], 5)] == ["y"]
```

#### Uses
- [Storing vectors › The schema](#/vector-store/the-schema)
- [Storing vectors › The search is one operator](#/vector-store/the-search-is-one-operator)
- [Embeddings › Measuring nearness](#/embeddings/measuring-nearness)

#### Hints
- In `__init__`, keep `dims` and an empty list of `(chunk_id, vector)` pairs. `__len__` returns the length of that list.
- `add` compares `len(vector)` with `self.dims` and raises before appending.
- `search` scores every stored vector with `cosine`, sorts by score from high to low, and slices to `k`.

#### Tips
- Slicing past the end is safe: `[:10]` on three items gives three. `[:0]` gives none, which is what `k=0` should do.
- The width check in `add` is the only place a model swap is caught loudly. Everything else about a mismatched embedding model succeeds: same call, same shape of result, wrong five chunks, forever.
- Scoring every stored vector on every search is exactly what Postgres does with no index on the column. It is the correct starting point, not a stand-in for the real thing.

#### Docs
- [Python docs: `object.__len__`](https://docs.python.org/3/reference/datamodel.html#object.__len__)
- [Python docs: `sorted()`](https://docs.python.org/3/library/functions.html#sorted)

### 2. Cascade the delete

`delete_document(rows, document_id)` returns the rows that remain after every chunk of `document_id` is removed, in the original order. Leave `rows` itself unchanged.

```python starter
def delete_document(rows, document_id):
    ...
```

```python test
def test_cascade():
    """removes every chunk of the document"""
    rows = [{"id": 1, "document_id": 1}, {"id": 2, "document_id": 2}, {"id": 3, "document_id": 1}]
    assert delete_document(rows, 1) == [{"id": 2, "document_id": 2}]
    assert delete_document(rows, 2) == [{"id": 1, "document_id": 1}, {"id": 3, "document_id": 1}]

def test_neighbours():
    """removes chunks that sit next to each other"""
    rows = [{"id": 1, "document_id": 5}, {"id": 2, "document_id": 5}, {"id": 3, "document_id": 5}, {"id": 4, "document_id": 6}]
    assert [r["id"] for r in delete_document(rows, 5)] == [4]
    assert [r["id"] for r in delete_document(rows, 6)] == [1, 2, 3]

def test_input_unchanged():
    """leaves rows alone, and an unknown document removes nothing"""
    rows = [{"id": 1, "document_id": 1}, {"id": 2, "document_id": 2}]
    assert delete_document(rows, 9) == rows
    delete_document(rows, 1)
    assert rows == [{"id": 1, "document_id": 1}, {"id": 2, "document_id": 2}]
    assert delete_document([], 1) == []
```

#### Uses
- [Storing vectors › The schema](#/vector-store/the-schema)

#### Hints
- Keep the rows whose `document_id` is not the one being deleted.
- A list comprehension keeps the order and returns a new list.

#### Tips
- Build a new list rather than removing from `rows` while looping over it. Removing during iteration skips the element after each one you remove.
- In a database this is one `ON DELETE CASCADE`, not a second statement. Two statements means a crash between them leaves orphan chunks, and orphan chunks keep answering questions about a document the console says is gone.
- Deleting is also how you re-ingest. Changing chunk size means every vector changes, so the old chunks have to go first or the corpus ends up holding both generations.

#### Docs
- [PostgreSQL: Foreign keys and `ON DELETE CASCADE`](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)

### 3. Distance and score

`to_score(distance)` converts a cosine distance from `<=>` into the similarity a console shows, and `to_distance(score)` does the reverse.

```python starter
def to_score(distance):
    ...

def to_distance(score):
    ...
```

```python test
def test_score():
    """score is 1 - distance"""
    assert to_score(0.0) == 1.0
    assert abs(to_score(0.35) - 0.65) < 1e-9
    assert abs(to_score(1.0)) < 1e-9
    assert abs(to_score(2.0) + 1.0) < 1e-9

def test_distance():
    """distance is 1 - score"""
    assert abs(to_distance(1.0)) < 1e-9
    assert abs(to_distance(0.65) - 0.35) < 1e-9
    assert abs(to_distance(-1.0) - 2.0) < 1e-9

def test_round_trip():
    """each undoes the other"""
    for x in (0.0, 0.42, 1.3, 2.0):
        assert abs(to_distance(to_score(x)) - x) < 1e-9
        assert abs(to_score(to_distance(x)) - x) < 1e-9
```

#### Uses
- [Storing vectors › The search is one operator](#/vector-store/the-search-is-one-operator)

#### Hints
- The article gives the conversion: the score a console shows is `1 - distance`.
- The reverse is the same subtraction the other way round.

#### Tips
- Floats don't always round-trip exactly, which is why the tests compare with a tolerance instead of `==`.
- Cosine distance runs 0 to 2, so a score can be negative. Clamping it to 0 for a prettier console throws away the one signal that says "nothing here is even slightly relevant".
- Convert in exactly one place. A console that shows distance in one panel and score in another, both called "relevance", is a bug report you will receive and not understand.

#### Docs
- [pgvector README: distance operators](https://github.com/pgvector/pgvector)
