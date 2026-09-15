# Keyword search & BM25

Embeddings are great at meaning and terrible at exact tokens. Search for `Stripe error code 402` and vector search will confidently hand you five documents about generic payment failures. It has no idea that `402` is a magic string that must match exactly. Same story for part numbers, acronyms, surnames, error codes: precisely the things people search for most.

So production systems do not choose. They run keyword search alongside vector search and fuse the results.

## BM25

BM25 is the classic keyword ranking function behind Elasticsearch and most full-text search. For each query term, a document scores higher when the term appears more often in it (term frequency), when the term is rare across the corpus (inverse document frequency), and when the document is short relative to the average (length normalisation).

```
idf(t)   = ln(1 + (N - df + 0.5) / (df + 0.5))

score(d) = Σ  idf(t) · tf · (k1 + 1)
           t        tf + k1 · (1 - b + b · |d| / avg|d|)
```

`k1` (usually 1.5) controls how quickly repeated terms stop adding score. `b` (usually 0.75) controls how much length matters. A document containing none of the query terms scores zero, which is exactly the property vector search lacks.

## Tokenising

Keyword search is only as good as its tokens. Lowercase, split on anything that is not a letter or digit, and `error-402` and `Error 402` both become `["error", "402"]`. Stemming (`cancelled` → `cancel`) helps for prose; skip it for identifiers.

## Fusing two rankings

You now have two ordered lists that disagree. Reciprocal rank fusion merges them without needing the scores to be comparable: each item gets `1 / (k + rank)` from every list it appears in, with `k` around 60, and the sums are sorted.

```
list A: [a, b, c]     list B: [b, c, a]

a: 1/61 + 1/63       b: 1/62 + 1/61       c: 1/63 + 1/62
→ b, a, c
```

An item ranked well by both lists rises; an item one list loved and the other never saw still gets in, lower down. That is the whole of hybrid search: a poet's intuition and a librarian's precision, and at scale you need both halves.

```python playground
import math, re
from collections import Counter

def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())

docs = [
    "Stripe returned error code 402 payment required",
    "Generic payment failures and webhook retries",
    "Refunds are issued within ten business days",
]
query = "error 402"

toks = [tokenize(d) for d in docs]
N, avg = len(docs), sum(map(len, toks)) / len(docs)
def bm25(q, k1=1.5, b=0.75):
    scores = []
    for t in toks:
        tf = Counter(t); s = 0.0
        for term in tokenize(q):
            df = sum(term in d for d in toks)
            idf = math.log(1 + (N - df + 0.5) / (df + 0.5))
            f = tf[term]
            s += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * len(t) / avg))
        scores.append(s)
    return scores

for d, s in zip(docs, bm25(query)):
    print(f"{s:5.2f}  {d}")

# Try: query "payment" and see the second document win on term frequency.
```

## Exercises

### 1. Tokenize

`tokenize(text)` lowercases and returns every run of letters and digits, in order.

```python starter
import re

def tokenize(text):
    ...
```

```python test
def test_tokenize():
    """lowercase alphanumeric runs"""
    assert tokenize("Stripe error-402, Payment!") == ["stripe", "error", "402", "payment"]
    assert tokenize("") == []
    assert tokenize("  a  b ") == ["a", "b"]
```

#### Uses
- [Keyword search & BM25 › Tokenising](#/keyword-search/tokenising)

#### Hints
- Lowercase first, then find the runs.
- `re.findall` with the character class `[a-z0-9]+` returns every run, in order.

#### Tips
- Lowercase before matching. `[a-z]` does not match capitals, so matching first would drop them.

#### Docs
- [Python docs: `re.findall`](https://docs.python.org/3/library/re.html#re.findall)

### 2. BM25

`bm25(query, docs, k1=1.5, b=0.75)` returns one score per document using the formula above and the provided `tokenize`. `N` is the number of documents, `df` how many contain the term, and `avg` the mean token count.

```python starter
import math, re
from collections import Counter

def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())

def bm25(query, docs, k1=1.5, b=0.75):
    ...
```

```python test
def test_bm25():
    """ranks exact terms, zero for no overlap"""
    docs = ["error code 402 payment required", "generic payment failures", "refunds within ten days"]
    s = bm25("error 402", docs)
    assert len(s) == 3
    assert s[0] > s[1] > 0 or (s[0] > s[1] and s[1] == 0)
    assert s[2] == 0.0
    assert s[0] > s[1]
    assert bm25("payment", docs)[1] > 0
```

#### Uses
- [Keyword search & BM25 › BM25](#/keyword-search/bm25)
- [Keyword search & BM25 › Tokenising](#/keyword-search/tokenising)

#### Hints
- Tokenize every document once up front. `N` and `avg` come from those token lists.
- For each document, a `Counter` of its tokens gives `tf` for any term (0 when absent). `df` is the number of token lists that contain the term.
- Each query term adds `idf · tf · (k1 + 1)` divided by `tf + k1 · (1 - b + b · |d| / avg)`, where `|d|` is the document's token count.

#### Tips
- A term no document contains still has a positive `idf`, but its `tf` is 0 everywhere, so it adds nothing.

#### Docs
- [Python docs: `math.log`](https://docs.python.org/3/library/math.html#math.log)
- [Python docs: `collections.Counter`](https://docs.python.org/3/library/collections.html#collections.Counter)

### 3. Reciprocal rank fusion

`rrf(rankings, k=60)` takes a list of ranked id lists and returns the ids ordered by their summed `1 / (k + rank)` score, highest first, where rank starts at 1. Ties keep the order of first appearance.

```python starter
def rrf(rankings, k=60):
    ...
```

```python test
def test_rrf():
    """fuses rankings by reciprocal rank"""
    assert rrf([["a", "b", "c"], ["b", "c", "a"]]) == ["b", "a", "c"]
    assert rrf([["x"], ["y"]]) == ["x", "y"]
    assert rrf([]) == []
    assert rrf([["a", "b"], ["c"]])[0] == "a"
```

#### Uses
- [Keyword search & BM25 › Fusing two rankings](#/keyword-search/fusing-two-rankings)

#### Hints
- Keep a dict from id to score. Walk each ranking with `enumerate(ranking, 1)` and add `1 / (k + rank)`.
- Sort the ids by their score, highest first.
- Dicts remember insertion order and `sorted` is stable, so ties already come out in order of first appearance.

#### Tips
- RRF never looks at the original scores, only positions. That is why it can fuse a cosine ranking with a BM25 ranking whose numbers mean different things.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)
- [Python docs: `sorted()`](https://docs.python.org/3/library/functions.html#sorted)
