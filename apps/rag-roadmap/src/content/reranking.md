# Reranking & diversity

Vector search is fast and rough. It scores the question against each chunk independently, using an embedding computed before the question existed. Two upgrades earn their complexity, in this order, and only once you have a question the system demonstrably gets wrong.

## Reranking

Retrieve wide, then read closely. Hybrid search returns the top ~100 candidates cheaply; a heavier model, a cross-encoder, then reads the question *together with* each candidate and rescores it. It is slow, which is why you run it on 100 rather than ten million, and it catches the relevance gaps pure vector math always misses: a chunk that mentions all the right words in the wrong relationship, or the right answer phrased in words the embedding blurred.

```
vector search    10,000,000 → 100     milliseconds, approximate
rerank                  100 → 5       one model call per candidate, precise
```

Any function that scores `(question, text)` can stand in for the cross-encoder: term overlap is a crude one, an LLM asked "does this passage answer the question, 0 to 10" is an expensive one. The plumbing is identical: score every candidate, sort, keep the top few.

**The gotcha: ties.** A coarse scorer produces a lot of them — an LLM judge that answers in whole numbers out of 10 will hand five candidates the same 8. Whatever breaks that tie decides what the model reads, so make it something stable. Python's `sorted` is stable — equal scores come out in the order they went in, `reverse=True` included — which means the tie is broken by the *previous* stage's ranking rather than at random. Rely on that deliberately, or add an explicit second key. Leave it to chance and the answer changes when an unrelated document is added to the corpus, and you will spend a day trying to reproduce it.

## Diversity

Top-k by similarity has a failure mode: the five most similar chunks are often five near-copies of each other, from the same paragraph or a duplicated document. Maximal marginal relevance fixes that by picking greedily, and at each step penalising candidates that resemble what was already picked.

```
next = argmax  λ · sim(query, c)  −  (1 − λ) · max sim(c, chosen)
         c
```

`λ = 1` is plain top-k. `λ = 0.5` weighs novelty as much as relevance. For questions that need synthesis across sources, a little diversity buys more than a little extra relevance.

## The shape to remember

Filters narrow what may be seen, hybrid search finds what is probably relevant, reranking decides what is actually relevant, diversity stops the answer being five copies of one sentence. Skip any step and the system still returns something, confidently.

```python playground
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

q = [1.0, 0.0]
cands = {"a": [1.0, 0.0], "b": [0.99, 0.1], "c": [0.6, 0.8]}   # a and b are near-copies

def mmr(query, cands, k, lam):
    chosen = []
    while len(chosen) < k and len(chosen) < len(cands):
        best, best_score = None, None
        for cid, v in cands.items():
            if cid in chosen:
                continue
            novelty = max((cosine(v, cands[c]) for c in chosen), default=0.0)
            s = lam * cosine(query, v) - (1 - lam) * novelty
            if best is None or s > best_score:
                best, best_score = cid, s
        chosen.append(best)
    return chosen

for lam in (1.0, 0.7, 0.3):
    print(f"λ={lam}: {mmr(q, cands, 2, lam)}")

# Try: add a fourth candidate identical to "a" and watch λ=1 pick both copies.
```

## Exercises

### 1. Rerank with any scorer

`rerank(candidates, score_fn, top_n)` returns the `top_n` candidates with the highest `score_fn(candidate)`, highest first. Equal scores keep their original order.

```python starter
def rerank(candidates, score_fn, top_n):
    ...
```

```python test
def test_rerank():
    """sorts by the scorer, highest first, and truncates"""
    c = [{"id": 1, "s": 0.2}, {"id": 2, "s": 0.9}, {"id": 3, "s": 0.8}, {"id": 4, "s": 0.5}]
    assert [x["id"] for x in rerank(c, lambda x: x["s"], 3)] == [2, 3, 4]
    assert [x["id"] for x in rerank(c, lambda x: -x["s"], 2)] == [1, 4]
    assert rerank(["bb", "a", "cccc", "ddd"], len, 2) == ["cccc", "ddd"]

def test_stable():
    """equal scores keep their original order"""
    c = [{"id": 1, "s": 0.2}, {"id": 2, "s": 0.9}, {"id": 3, "s": 0.9}, {"id": 4, "s": 0.5}]
    assert [x["id"] for x in rerank(c, lambda x: x["s"], 3)] == [2, 3, 4]
    assert [x["id"] for x in rerank(c, lambda x: 1, 4)] == [1, 2, 3, 4]

def test_size():
    """returns top_n, or everything when there are fewer"""
    c = [{"id": 1, "s": 0.2}, {"id": 2, "s": 0.9}]
    assert len(rerank(c, lambda x: x["s"], 10)) == 2
    assert rerank(c, lambda x: x["s"], 0) == []
    assert rerank([], lambda x: 0, 5) == []
```

#### Uses
- [Reranking & diversity › Reranking](#/reranking/reranking)

#### Hints
- `sorted` takes a `key` function, and `score_fn` already is one.
- Sort from high to low with `reverse=True`, then slice to `top_n`.

#### Tips
- `reverse=True` keeps the sort stable: equal scores stay in their original order rather than flipping.
- `score_fn` is a parameter so the expensive scorer can be swapped in without touching this function. That is the only reason reranking is cheap to experiment with: term overlap today, a cross-encoder tomorrow, same plumbing.
- Rerank a hundred candidates, not ten thousand. The cost is one model call per candidate, so the shortlist is what makes the precise step affordable — and a shortlist that already missed the right chunk cannot be rescued here.

#### Docs
- [Sorting HOWTO: Sort stability](https://docs.python.org/3/howto/sorting.html#sort-stability-and-complex-sorts)

### 2. A crude cross-encoder

`overlap_score(question, text)` returns the fraction of distinct question tokens that also appear in the text, using lowercase alphanumeric tokens. A question with no tokens scores `0.0`.

```python starter
import re

def tokenize(text):
    return set(re.findall(r"[a-z0-9]+", text.lower()))

def overlap_score(question, text):
    ...
```

```python test
def test_overlap():
    """fraction of question tokens present"""
    assert overlap_score("warranty period", "The warranty period is two years") == 1.0
    assert overlap_score("warranty period", "Returns within thirty days") == 0.0
    assert abs(overlap_score("warranty period", "warranty claims") - 0.5) < 1e-9
    assert abs(overlap_score("a b c d", "a") - 0.25) < 1e-9

def test_question_side():
    """divides by the question's distinct tokens, not the text's"""
    assert overlap_score("warranty", "warranty period two years") == 1.0
    assert abs(overlap_score("warranty warranty period", "warranty") - 0.5) < 1e-9

def test_case_and_punctuation():
    """ignores case and punctuation"""
    assert overlap_score("Warranty?", "WARRANTY, period.") == 1.0
    assert abs(overlap_score("refund policy", "Policy on refunds") - 0.5) < 1e-9

def test_empty():
    """an empty question scores 0.0"""
    assert overlap_score("", "anything") == 0.0
    assert overlap_score("?!", "anything") == 0.0
    assert overlap_score("warranty", "") == 0.0
```

#### Uses
- [Reranking & diversity › Reranking](#/reranking/reranking)
- [Keyword search & BM25 › Tokenising](#/keyword-search/tokenising)

#### Hints
- The provided `tokenize` returns sets, so the shared tokens are the intersection `q & t`.
- Divide the size of the intersection by the size of the question's set, after checking that set isn't empty.

#### Tips
- Dividing by the question's tokens, not the text's, is what stops a long document from winning by accident. Swap the denominator and the score becomes "how much of this document is question", which rewards short chunks for nothing.
- An empty question is a real input, not a test artefact. `"?!"` tokenizes to nothing, and without the guard that is a `ZeroDivisionError` on the retrieval path.
- This is deliberately crude, and its ceiling is the point: term overlap cannot tell "A causes B" from "B causes A", or recognise the answer phrased in different words. Closing exactly that gap is what a real cross-encoder is for.

#### Docs
- [Python docs: Set types](https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset)

### 3. Maximal marginal relevance

`mmr(query, candidates, k, lam=0.7)` takes a dict of `id → vector` and returns a list of `k` ids chosen greedily by the formula above. `cosine` is provided. With `lam=1.0` it must equal plain top-k. Ties go to the earlier candidate.

```python starter
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0

def mmr(query, candidates, k, lam=0.7):
    ...
```

```python test
def test_mmr():
    """trades relevance for novelty as lambda falls"""
    q = [1.0, 0.0]
    cands = {"a": [1.0, 0.0], "b": [0.99, 0.1], "c": [0.6, 0.8]}
    assert mmr(q, cands, 2, lam=1.0) == ["a", "b"]
    assert mmr(q, cands, 2, lam=0.3) == ["a", "c"]

def test_default_lambda():
    """uses lam=0.7 when none is given"""
    q = [1.0, 0.0, 0.0]
    cands = {"a": [1.0, 0.5, 1.0], "b": [1.0, 1.0, 0.0], "c": [0.0, 0.0, 1.0], "d": [1.0, 0.5, 0.0]}
    assert mmr(q, cands, 2) == ["d", "a"]
    assert mmr(q, cands, 2, lam=1.0) == ["d", "b"]
    assert mmr(q, cands, 2, lam=0.5) == ["d", "c"]

def test_novelty_is_max():
    """novelty is the highest similarity to anything already chosen"""
    q = [1.0, 0.0, 0.0]
    cands = {"a": [1.0, 0.0, 0.2], "b": [0.5, 0.2, 0.0], "c": [0.5, 0.2, 0.2], "d": [1.0, 0.0, 1.0]}
    assert mmr(q, cands, 3, lam=0.5) == ["a", "b", "c"]

def test_top_k():
    """lam=1.0 is plain top-k, ties going to the earlier candidate"""
    q = [1.0, 0.0]
    cands = {"w": [0.2, 1.0], "x": [1.0, 0.1], "y": [1.0, 0.1], "z": [1.0, 0.5]}
    assert mmr(q, cands, 3, lam=1.0) == ["x", "y", "z"]
    assert mmr(q, cands, 1, lam=1.0) == ["x"]

def test_count():
    """returns k ids, or every id when k is larger"""
    q = [1.0, 0.0]
    cands = {"a": [1.0, 0.0], "b": [0.99, 0.1], "c": [0.6, 0.8]}
    assert sorted(mmr(q, cands, 5)) == ["a", "b", "c"]
    assert mmr(q, cands, 1) == ["a"]
    assert mmr(q, {}, 2) == []
```

#### Uses
- [Reranking & diversity › Diversity](#/reranking/diversity)
- [Embeddings › Measuring nearness](#/embeddings/measuring-nearness)
- [Reference › The small maths](#/reference/the-small-maths)

#### Hints
- Loop until you have `k` ids or run out of candidates. Each round, score every candidate not yet chosen and append the best.
- A candidate's score is `lam * cosine(query, v) - (1 - lam) * novelty`, where novelty is its highest cosine to anything already chosen.
- In the first round nothing is chosen yet. `max(..., default=0.0)` handles the empty case.

#### Tips
- Replace the best only on a strictly higher score, so ties go to the earlier candidate and the result is deterministic.
- Keep the `lam=1.0` test. It is the one that proves the formula reduces to plain top-k, and any sign or bracket error in the novelty term shows up there first.
- Novelty is the **max** similarity to anything already chosen, not the mean. A candidate that duplicates one chosen chunk and differs from the other four is still a duplicate, and averaging hides exactly that.
- The cost is `k` passes over the candidates, each comparing against everything chosen so far. Fine on the hundred a reranker hands you; not something to run over the corpus.

#### Docs
- [Python docs: `max()`](https://docs.python.org/3/library/functions.html#max)
