# Evaluating retrieval

A RAG system that is not measured is a demo. The measurements split cleanly along the pipeline: did retrieval find the right chunks, did generation stay faithful to them, and how long and how much did it all cost.

## Retrieval metrics

Build a small set of questions where you know which chunks hold the answer. Twenty is enough to start. Then, for each question, compare what retrieval returned against that set.

```
precision@k = relevant chunks in the top k / k
recall@k    = relevant chunks in the top k / all relevant chunks
MRR         = mean over questions of 1 / rank of the first relevant chunk
```

Precision says how much of the prompt was useful. Recall says whether the answer was there at all, which is the one that predicts a wrong answer. MRR says how high the right passage sat, which matters because models attend more to what comes first.

Re-run the set after every change to chunk size, embedding model, `k`, or the reranker. If recall drops, the change was wrong however much nicer the prose got.

## Faithfulness

Given the chunks, did the answer stay inside them? The cheap check is structural: every `[n]` citation must point at a source that exists. A `[7]` in an answer built from five sources is an invented citation, and it usually means an invented claim. The expensive check is an LLM-as-judge: show it the sources and the answer and ask whether each claim is supported. Tools such as Ragas, TruLens, and DeepEval automate that continuously, not once at launch.

## Latency and cost

A perfect answer that takes forty seconds and costs two dollars is not a product, it is a cloud bill. Time each stage separately, because they fail differently: embedding time is the provider, search time is the database and the index you have not added yet, answer time is the model and the size of the prompt you sent it. A waterfall of where the milliseconds went is the first thing to look at when a query is slow.

```
embed    38 ms   ██
search   12 ms   █
answer  912 ms   ████████████████████████████████████
```

```python playground
def precision_at_k(retrieved, relevant, k):
    top = retrieved[:k]
    return sum(r in relevant for r in top) / k if k else 0.0

def recall_at_k(retrieved, relevant, k):
    top = retrieved[:k]
    return sum(r in relevant for r in top) / len(relevant) if relevant else 0.0

questions = [
    ("warranty length", ["c1", "c9", "c4"], {"c9"}),
    ("return window", ["c2", "c3", "c7"], {"c2", "c7"}),
    ("refund method", ["c5", "c6", "c8"], {"c8"}),
]
for q, got, want in questions:
    print(f"{q:16} P@3={precision_at_k(got, want, 3):.2f}  R@3={recall_at_k(got, want, 3):.2f}")

trace = {"ms_embed": 38, "ms_search": 12, "ms_answer": 912}
total = sum(trace.values())
for stage, ms in trace.items():
    print(f"{stage:10} {ms:4d} ms  {'█' * round(40 * ms / total)}")

# Try: swap the reranker in by moving c9 to the front of the first question and watch MRR.
```

## Exercises

### 1. Precision and recall at k

Implement `precision_at_k(retrieved, relevant, k)` and `recall_at_k(retrieved, relevant, k)`, where `retrieved` is an ordered list of ids and `relevant` a set. Return `0.0` when `k` is zero or there are no relevant items respectively.

```python starter
def precision_at_k(retrieved, relevant, k):
    ...

def recall_at_k(retrieved, relevant, k):
    ...
```

```python test
def test_pr():
    """hits over k, hits over relevant"""
    got, want = ["a", "b", "c", "d"], {"b", "d", "z"}
    assert abs(precision_at_k(got, want, 2) - 0.5) < 1e-9
    assert abs(precision_at_k(got, want, 4) - 0.5) < 1e-9
    assert abs(recall_at_k(got, want, 4) - 2 / 3) < 1e-9
    assert recall_at_k(got, set(), 4) == 0.0
    assert precision_at_k(got, want, 0) == 0.0
```

### 2. Mean reciprocal rank

`mrr(rankings, relevant_sets)` takes parallel lists: for each question, an ordered list of retrieved ids and a set of relevant ids. Return the mean of `1 / rank` of the first relevant id per question, counting `0` for a question with no relevant hit. An empty input returns `0.0`.

```python starter
def mrr(rankings, relevant_sets):
    ...
```

```python test
def test_mrr():
    """mean of first-hit reciprocal ranks"""
    r = [["a", "b", "c"], ["x", "y"], ["p"]]
    s = [{"b"}, {"x"}, {"q"}]
    assert abs(mrr(r, s) - (0.5 + 1.0 + 0.0) / 3) < 1e-9
    assert mrr([], []) == 0.0
```

### 3. Check the citations

`bad_citations(answer, n_sources)` returns the sorted list of distinct cited numbers `[n]` that do not correspond to a source, i.e. `n < 1` or `n > n_sources`.

```python starter
import re

def bad_citations(answer, n_sources):
    ...
```

```python test
def test_bad_citations():
    """flags citations that point nowhere"""
    assert bad_citations("Per [1] and [3], see [7] and [0].", 3) == [0, 7]
    assert bad_citations("[1] [2]", 2) == []
    assert bad_citations("none", 0) == []
```

### 4. Waterfall

`waterfall(trace)` takes a dict of stage name to milliseconds and returns a dict of stage name to its integer percentage of the total, rounded. An all-zero trace returns zero for every stage.

```python starter
def waterfall(trace):
    ...
```

```python test
def test_waterfall():
    """percent of total per stage"""
    assert waterfall({"embed": 100, "search": 300, "answer": 600}) == {"embed": 10, "search": 30, "answer": 60}
    assert waterfall({"a": 0, "b": 0}) == {"a": 0, "b": 0}
    assert waterfall({"only": 5}) == {"only": 100}
```
