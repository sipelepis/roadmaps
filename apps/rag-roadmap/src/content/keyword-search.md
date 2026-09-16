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

`ln` is the natural logarithm, `math.log` in Python. Worked once, for the term `payment` against these three documents:

```
docs   ["error code 402 payment required", "payment payment failures", "refunds within ten days"]
       token counts 5, 3, 4  →  N = 3, avg|d| = 4.0

for the second document:  df = 2 (two docs contain "payment"),  tf = 2,  |d| = 3

idf   = ln(1 + (3 - 2 + 0.5) / (2 + 0.5)) = ln(1.6)                  = 0.470003…
denom = 2 + 1.5 · (1 - 0.75 + 0.75 · 3/4) = 2 + 1.21875              = 3.21875
score = 0.470003… · 2 · (1.5 + 1) / 3.21875                          = 0.730102…
```

Rarity is the loudest of the three factors. A term in one document out of three has an idf of `0.980829…`; the same term in all three drops to `0.133531…`, because a word everyone uses cannot tell documents apart. Length is the quietest: for `["cat", "cat dog bird fish"]` the query `cat` scores `[0.2498, 0.1436]` at `b = 0.75`, but at `b = 0.0` length stops counting and both score `0.1823`.

## Tokenising

Keyword search is only as good as its tokens. Lowercase, split on anything that is not a letter or digit, and `error-402` and `Error 402` both become `["error", "402"]`. Stemming (`cancelled` → `cancel`) helps for prose; skip it for identifiers.

**The gotcha: tokenizer drift.** The tokens in the index were produced by one function; the tokens in a query are produced by whatever the search path happens to call. Let those two drift apart — one lowercases and the other does not, one splits on `_` and the other keeps it, one gains stemming in a later release — and every query silently loses the matches it should have found. Nothing errors; the index just gets quieter. Tokenize with the same function on both sides and re-index whenever you change it, exactly as you re-embed whenever the embedding model changes.

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
    """lowercase alphanumeric runs, in order"""
    assert tokenize("Stripe error-402, Payment!") == ["stripe", "error", "402", "payment"]
    assert tokenize("MiXeD CaSe") == ["mixed", "case"]

def test_separators():
    """anything that is not a letter or digit splits tokens"""
    assert tokenize("  a  b ") == ["a", "b"]
    assert tokenize("a_b.c/d") == ["a", "b", "c", "d"]
    assert tokenize("v2.0\nrelease") == ["v2", "0", "release"]
    assert tokenize("Error 402") == tokenize("error-402")

def test_no_tokens():
    """empty or punctuation-only text has no tokens"""
    assert tokenize("") == []
    assert tokenize("--- !!! ...") == []
```

#### Uses
- [Keyword search & BM25 › Tokenising](#/keyword-search/tokenising)

#### Hints
- Lowercase first, then find the runs.
- `re.findall` with the character class `[a-z0-9]+` returns every run, in order.

#### Tips
- Lowercase before matching. `[a-z]` does not match capitals, so matching first would drop them.
- The same function has to run on the documents and on the query. Two tokenizers that disagree by one rule give an index that silently stops matching, with no error anywhere.
- `[a-z0-9]+` throws away accents and every non-Latin script. Fine for error codes and English prose, wrong the moment the corpus is not; `\w+` with `re.UNICODE` is the next step up when you need it.

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
    """one score per document, matching the formula"""
    docs = ["error code 402 payment required", "payment payment failures", "refunds within ten days"]
    s = bm25("payment 402", docs)
    assert len(s) == 3
    assert abs(s[0] - 1.304119) < 1e-6
    assert abs(s[1] - 0.730103) < 1e-6
    assert s[2] == 0.0

def test_no_overlap():
    """a document with none of the query terms scores zero"""
    docs = ["error code 402 payment required", "generic payment failures", "refunds within ten days"]
    s = bm25("error 402", docs)
    assert s[0] > 0
    assert s[1] == 0.0 and s[2] == 0.0
    assert bm25("zebra", docs) == [0.0, 0.0, 0.0]

def test_parameters():
    """uses k1 and b, and b = 0 ignores document length"""
    docs = ["error code 402 payment required", "payment payment failures", "refunds within ten days"]
    s = bm25("payment 402", docs, k1=1.2, b=0.0)
    assert abs(s[0] - 1.450833) < 1e-6
    assert abs(s[1] - 0.646255) < 1e-6
    short_long = ["cat", "cat dog bird fish"]
    flat = bm25("cat", short_long, b=0.0)
    assert abs(flat[0] - flat[1]) < 1e-9
    s = bm25("cat", short_long)
    assert s[0] > s[1] > 0
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
- `df` is counted over the corpus, `tf` within one document. Swap them and every score is still a plausible-looking number, which is why this is worth checking against the worked example rather than eyeballing the ranking.
- Tokenize each document once and compute `avg` once, outside both loops. Re-tokenizing per query term is the difference between a search and a search you have to cache.
- A repeated term saturates. With `k1 = 1.5` and length ignored, the `tf` factor runs 1.00, 1.43, 1.92, 2.17 at one, two, five and ten occurrences: the second mention adds `0.43`, the tenth adds `0.03`. That is the parameter's whole job, and it is why a keyword-stuffed document does not automatically win.

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
    assert rrf([["a", "b"], ["c"]]) == ["a", "c", "b"]
    assert rrf([["x", "p", "y"], ["q", "r", "y"]]) == ["y", "x", "q", "p", "r"]

def test_ties():
    """ties keep the order of first appearance"""
    assert rrf([["x"], ["y"]]) == ["x", "y"]
    assert rrf([["y"], ["x"]]) == ["y", "x"]
    assert rrf([["a", "b"], ["b", "a"]]) == ["a", "b"]

def test_k():
    """uses k, with ranks starting at 1"""
    assert rrf([["x", "p", "y"], ["q", "r", "y"]], k=0) == ["x", "q", "y", "p", "r"]
    assert rrf([["a", "b"]], k=0) == ["a", "b"]

def test_empty():
    """no rankings, or empty ones, give nothing"""
    assert rrf([]) == []
    assert rrf([[], []]) == []
    assert rrf([["a"], []]) == ["a"]
```

#### Uses
- [Keyword search & BM25 › Fusing two rankings](#/keyword-search/fusing-two-rankings)
- [Documents to text › Pages come with their index](#/documents/pages-come-with-their-index)
- [Reference › The small maths](#/reference/the-small-maths)

#### Hints
- Keep a dict from id to score. Walk each ranking with `enumerate(ranking, 1)` and add `1 / (k + rank)`.
- Sort the ids by their score, highest first.
- Dicts remember insertion order and `sorted` is stable, so ties already come out in order of first appearance.

#### Tips
- RRF never looks at the original scores, only positions. That is why it can fuse a cosine ranking with a BM25 ranking whose numbers mean different things.
- Ranks start at 1, which is what `enumerate(ranking, 1)` is for. Start at 0 and the top item of every list gets `1/k` instead of `1/(k+1)` — a small inflation applied to exactly the slot that matters most.
- `k` is a flattener, not a tuning knob you need to touch. At 60, rank 1 is worth `0.0164` and rank 3 is worth `0.0159` — a gap of `0.0005` — so appearing in both lists beats being first in one. Drop `k` toward 0 and the first list to speak wins.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)
- [Python docs: `sorted()`](https://docs.python.org/3/library/functions.html#sorted)
