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

**The gotcha: every one of these divides by something that can be zero.** Precision divides by `k`, recall by the number of relevant chunks, MRR and any mean by the number of questions, and BM25's length normalisation by the average document length. A question nobody labelled, an empty document, a `k` of 0 — each of them is a `ZeroDivisionError` in the middle of a nightly evaluation run, or worse, a silent `0.0` that looks like a regression. Decide what an empty denominator *means* before you write the division: here it means `0.0`, and the guard goes in front.

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
def test_precision():
    """hits in the top k over k"""
    got, want = ["a", "b", "c", "d"], {"b", "d", "z"}
    assert abs(precision_at_k(got, want, 2) - 0.5) < 1e-9
    assert abs(precision_at_k(got, want, 3) - 1 / 3) < 1e-9
    assert abs(precision_at_k(got, want, 4) - 0.5) < 1e-9
    assert precision_at_k(got, want, 1) == 0.0

def test_recall():
    """hits in the top k over all relevant"""
    got, want = ["a", "b", "c", "d"], {"b", "d", "z"}
    assert abs(recall_at_k(got, want, 4) - 2 / 3) < 1e-9
    assert abs(recall_at_k(got, want, 2) - 1 / 3) < 1e-9
    assert recall_at_k(got, want, 1) == 0.0

def test_short_list():
    """missing results count against precision, not recall"""
    got, want = ["a", "b", "c", "d"], {"b", "d", "z"}
    assert abs(precision_at_k(got, want, 10) - 0.2) < 1e-9
    assert abs(recall_at_k(got, want, 10) - 2 / 3) < 1e-9

def test_zero():
    """k of zero, or nothing relevant, gives 0.0"""
    assert precision_at_k(["a", "b"], {"a"}, 0) == 0.0
    assert recall_at_k(["a", "b"], set(), 2) == 0.0
    assert recall_at_k([], {"a"}, 3) == 0.0
```

#### Uses
- [Evaluating retrieval › Retrieval metrics](#/evaluation/retrieval-metrics)
- [Reference › The small maths](#/reference/the-small-maths)

#### Hints
- Both count the hits in `retrieved[:k]`. `sum(r in relevant for r in top)` works because `True` counts as 1.
- Precision divides by `k`, recall by `len(relevant)`. Check each divisor for 0 first.

#### Tips
- Precision divides by `k` even when fewer than `k` results came back. Missing results count against you.
- Track both or neither. Precision alone is maximised by returning one very safe chunk; recall alone is maximised by returning the whole corpus. Only together do they describe a retriever.
- Recall is the one that predicts a wrong answer. If the passage was never retrieved, no prompt, model or reranker downstream can recover it.
- A relevant chunk that retrieval can never reach — mislabelled, deleted, in a document nobody indexed — caps recall below 1 forever. When recall plateaus at an odd number, check the labels before you change the chunker.

#### Docs
- [Python docs: `sum()`](https://docs.python.org/3/library/functions.html#sum)

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
    assert abs(mrr([["x", "y", "z"]], [{"z"}]) - 1 / 3) < 1e-9

def test_first_hit_only():
    """only the first relevant id in each ranking counts"""
    assert abs(mrr([["a", "b", "c"]], [{"b", "c"}]) - 0.5) < 1e-9
    assert abs(mrr([["a", "b"], ["c", "d"]], [{"a", "b"}, {"d"}]) - 0.75) < 1e-9

def test_misses():
    """a question with no hit counts as zero"""
    assert abs(mrr([["a"], ["b"]], [{"z"}, {"b"}]) - 0.5) < 1e-9
    assert mrr([[]], [{"a"}]) == 0.0
    assert mrr([], []) == 0.0
```

#### Uses
- [Evaluating retrieval › Retrieval metrics](#/evaluation/retrieval-metrics)
- [Documents to text › Pages come with their index](#/documents/pages-come-with-their-index)
- [Reference › The small maths](#/reference/the-small-maths)

#### Hints
- For each question, find the first rank (starting at 1) whose id is in its relevant set. Its value is `1 / rank`, or 0 if there is none.
- `zip(rankings, relevant_sets)` walks the pairs. Average the per-question values, checking for an empty input first.

#### Tips
- `enumerate(ranking, 1)` gives 1-based ranks directly, so there is no `+ 1` to forget. Start at 0 and the top hit scores infinity, which your averages will notice.
- MRR only ever sees the *first* hit, so it is blind to whether the second relevant chunk came back at all. Pair it with recall@k; on its own it flatters a retriever that gets one thing right and nothing else.
- A question with no hit counts as 0, not as "skip this question". Dropping misses from the average is the single easiest way to publish a number that says the system improved when it did not.

#### Docs
- [Python docs: `zip()`](https://docs.python.org/3/library/functions.html#zip)
- [Python docs: `enumerate()`](https://docs.python.org/3/library/functions.html#enumerate)

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
    assert bad_citations("[1] [4] [5]", 3) == [4, 5]

def test_valid():
    """citations from 1 to n_sources are fine"""
    assert bad_citations("[1] [2]", 2) == []
    assert bad_citations("[3] closes the list", 3) == []
    assert bad_citations("none", 0) == []

def test_distinct_sorted():
    """distinct, sorted as numbers"""
    assert bad_citations("[12] [4] [12] [9]", 3) == [4, 9, 12]
    assert bad_citations("[1] and [2]", 0) == [1, 2]
```

#### Uses
- [Evaluating retrieval › Faithfulness](#/evaluation/faithfulness)

#### Hints
- Pull every `[n]` out with `re.findall(r"\[(\d+)\]", answer)` and convert each to `int`.
- Keep the distinct numbers outside `1..n_sources`, then sort them.

#### Tips
- Sources are numbered from 1, so `[0]` is always invalid, however many sources there are. If you see a lot of `[0]`, the prompt builder is numbering from zero, not the model hallucinating.
- An out-of-range citation usually travels with an invented claim. A citation *in* range proves only that the number exists — for whether the claim is supported you need a judge, or a human.
- This runs on every answer for the price of one regex, which is what makes it worth having. The expensive checks get run on a sample; this one gets run on everything.

#### Docs
- [Python docs: `re.findall`](https://docs.python.org/3/library/re.html#re.findall)

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
    assert waterfall({"embed": 38, "search": 12, "answer": 912}) == {"embed": 4, "search": 1, "answer": 95}
    assert waterfall({"only": 5}) == {"only": 100}

def test_rounding():
    """rounds to the nearest whole percent"""
    assert waterfall({"a": 1, "b": 2}) == {"a": 33, "b": 67}
    assert waterfall({"x": 1, "y": 1, "z": 1}) == {"x": 33, "y": 33, "z": 33}
    assert all(type(p) is int for p in waterfall({"a": 1, "b": 2}).values())

def test_zero():
    """a zero stage gets 0, and an all-zero trace is all 0"""
    assert waterfall({"a": 0, "b": 0}) == {"a": 0, "b": 0}
    assert waterfall({"embed": 0, "answer": 50}) == {"embed": 0, "answer": 100}
```

#### Uses
- [Evaluating retrieval › Latency and cost](#/evaluation/latency-and-cost)

#### Hints
- Sum the values first. If the total is 0, every stage gets 0.
- Otherwise each stage is `round(100 * ms / total)`. A dict comprehension keeps the keys in their original order.

#### Tips
- Rounded percentages don't always add up to 100: three equal stages give 33 each, totalling 99. Fine for a chart, not for a bill.
- `round` sends halves to the even neighbour, so `round(2.5)` is `2` and `round(3.5)` is `4`. Surprising once, then useful — it stops a column of rounded numbers drifting upward.
- Time the stages separately from day one. A total tells you the query is slow; the split tells you whether to email the embedding provider, add an index, or send a shorter prompt.

#### Docs
- [Python docs: `round()`](https://docs.python.org/3/library/functions.html#round)
- [Python tutorial: Dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)
