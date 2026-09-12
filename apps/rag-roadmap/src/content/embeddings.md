# Embeddings

Keyword search fails on "how do I cancel" versus "terminating your subscription": zero shared words, same meaning. Embeddings fix that by mapping text to a point in a high-dimensional space where nearness means similar meaning rather than similar spelling.

```
"how do I cancel"              →  [0.021, -0.118, 0.334, …]   1536 numbers
"terminating my subscription"  →  [0.019, -0.101, 0.341, …]   very close by
"the mitochondria is the…"     →  [ … ]                       far away
```

The model that produces these was trained so that the property holds. 1536 numbers per chunk is what a small embedding model emits, which is why a database column for it is declared at exactly that width. Change the model and that number changes with it.

## Measuring nearness

Cosine similarity compares the *direction* of two vectors, ignoring their length:

```
cos(a, b) = (a · b) / (|a| · |b|)
```

It runs from 1.00 (pointing the same way, near-identical meaning) down to 0.00 (unrelated). Because it ignores length, a long chunk and a short question can still score high. A zero vector has no direction, so its similarity to anything is defined as zero rather than a division error.

In practice anything above ~0.4 is worth reading and anything below ~0.2 is noise, though the useful range shifts by model and by corpus.

## One call for the whole document

```python
def embed(texts: list[str]) -> list[list[float]]:
    result = client.embeddings.create(model=settings.embedding_model, input=texts)
    return [d.embedding for d in result.data]
```

Note the plural. `input` takes the whole list, so a document of forty chunks is one HTTP request, not forty. The API returns results in input order, which is what makes `zip(chunks, vectors)` safe.

## The mismatch that is silent

If the chunks were embedded with one model and questions are embedded with another, every call still succeeds and every query still returns five chunks. They are simply the wrong five, forever, with plausible-looking scores. Nothing errors. There is no migration for that beyond re-embedding the corpus. Change the dimensions too and at least the database will stop you.

## A toy you can run offline

Real embedding models are neural networks behind an API. For the exercises here we use a stand-in: a hashed bag of words. Each word bumps one of 32 slots, and the vector is normalised to unit length. It has the two properties that matter for learning the pipeline: the same text gives the same vector, and texts that share words land closer together. It knows nothing about meaning; that is the part a real model buys you.

```python playground
import math, re, zlib

def embed(text, dims=32):
    """Toy embedding: hashed bag of words, unit length. Deterministic, stdlib only."""
    v = [0.0] * dims
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        v[zlib.crc32(word.encode()) % dims] += 1.0
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else v

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

question = "how long is the warranty period"
for text in ["two year warranty period covering defects", "returns accepted within thirty days", "the mitochondria is the powerhouse"]:
    print(f"{cosine(embed(question), embed(text)):.2f}  {text}")

# Try: reword the question with no shared words and watch the toy fail where a real model would not.
```

## Exercises

### 1. Cosine similarity

Implement `cosine(a, b)` for two equal-length lists of floats. If either vector has zero length, return `0.0`.

```python starter
import math

def cosine(a, b):
    ...
```

```python test
def test_cosine():
    """direction only, zero-safe"""
    assert abs(cosine([1, 0], [1, 0]) - 1.0) < 1e-9
    assert abs(cosine([1, 0], [0, 1])) < 1e-9
    assert abs(cosine([1, 2], [2, 4]) - 1.0) < 1e-9
    assert cosine([0, 0], [1, 1]) == 0.0
    assert abs(cosine([1, 1], [1, 0]) - math.sqrt(0.5)) < 1e-9
```

### 2. Unit length

`normalize(v)` returns the vector scaled to length 1. A zero vector is returned unchanged.

```python starter
import math

def normalize(v):
    ...
```

```python test
def test_normalize():
    """scales to unit length"""
    out = normalize([3.0, 4.0])
    assert abs(out[0] - 0.6) < 1e-9 and abs(out[1] - 0.8) < 1e-9
    assert normalize([0.0, 0.0]) == [0.0, 0.0]
    assert abs(math.sqrt(sum(x * x for x in normalize([1, 1, 1]))) - 1.0) < 1e-9
```

### 3. Nearest vector

`nearest(query, vectors)` returns the index of the vector most similar to `query` by cosine. Ties go to the earliest. `cosine` is provided.

```python starter
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

def nearest(query, vectors):
    ...
```

```python test
def test_nearest():
    """picks the closest by cosine"""
    assert nearest([1, 0], [[0, 1], [0.9, 0.1], [1, 1]]) == 1
    assert nearest([1, 1], [[1, 1], [2, 2]]) == 0
    assert nearest([0, 1], [[1, 0], [0, 5]]) == 1
```
