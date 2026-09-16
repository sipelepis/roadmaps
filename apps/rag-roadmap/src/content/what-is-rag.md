# What RAG actually is

A language model knows what was in its training data. It does not know what is in your documents, and when you ask it anyway it will often produce something plausible and wrong. Retrieval-Augmented Generation fixes that in the dullest way possible: before asking the model anything, go find the relevant passages yourself and paste them into the prompt.

That is the whole idea. Three words for *look it up first, then answer*.

## The four steps

```
INGEST (once per document)
  document → split into chunks → embed each chunk → store vectors

QUERY (every question)
  question → embed → find nearest chunks → paste into prompt → model answers
```

Notice the split. Ingest is slow and costs money per document; you pay it once. Query is fast and costs one small embedding plus one model call. Chunks are the unit of everything downstream, which is why every dashboard for a RAG system counts them.

## Only step four is "AI"

Steps one through three are text extraction, a chunker, an embedding API call, and a database query. When a RAG system gives a bad answer, the cause is almost always in those steps, not in the model. The retrieved passage did not contain the answer, so the model had nothing to work with. Every good RAG console shows the retrieved chunks next to the answer, because that turns "the AI is wrong" into a question you can actually debug.

## When not to bother

If the whole corpus fits comfortably inside the model's context window, skip all of this and paste it in. Nothing on this roadmap beats letting the model read everything.

*Comfortably* is carrying the weight there. An advertised million-token window is a capacity, not a promise of recall across it. Needle-in-a-haystack demos are the easy version of the test. Benchmarks where the answer must be picked out from many near-identical passages degrade as the window fills, and they degrade quietly: nothing errors, you just get a fluent answer assembled from the wrong passage.

```
advertised window   1M tokens      capacity
working budget      what you trust, measured on your own material
your corpus         bigger than that?  → RAG
```

A working ceiling in the low hundreds of thousands of tokens is a common landing spot. RAG earns its complexity when the corpus outgrows the budget you trust, when it changes often enough that re-sending all of it is waste, or when paying for the whole corpus on every question stops making sense.

## Where OCR fits

Everything above assumes you have text. A scanned contract, a photographed receipt, a screenshot of a table: those are pictures, and step one of ingest has nothing to chunk. Optical character recognition turns the picture back into text, and it sits in front of the pipeline as the step that decides whether the rest of it has anything to work with. The next modules take the document apart from that end.

```python playground
# The paste-it-in test. Four characters per token is a fair estimate for English.
CHARS_PER_TOKEN = 4

def estimate_tokens(text_or_chars):
    chars = text_or_chars if isinstance(text_or_chars, int) else len(text_or_chars)
    return -(-chars // CHARS_PER_TOKEN)   # ceiling division

advertised = 1_000_000
working = int(advertised * 0.25)         # the budget you trust, not the one you were sold

for name, chars in [("employee handbook", 180_000), ("one year of support tickets", 6_400_000), ("a single contract", 42_000)]:
    tokens = estimate_tokens(chars)
    verdict = "RAG" if tokens > working else "paste it in"
    print(f"{name:28} {tokens:>10,} tokens  → {verdict}")

# Try: lower the trust factor to 0.1 and see what flips.
```

## Exercises

### 1. Estimate tokens

Return the number of tokens a piece of text roughly costs, at four characters per token, rounding up. An empty string costs zero.

```python starter
def estimate_tokens(text):
    ...
```

```python test
def test_whole_tokens():
    """exact multiples of four cost exactly that many tokens"""
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("a" * 8) == 2
    assert estimate_tokens("a" * 400) == 100

def test_rounds_up():
    """a partial token rounds up"""
    assert estimate_tokens("a") == 1
    assert estimate_tokens("abc") == 1
    assert estimate_tokens("abcde") == 2
    assert estimate_tokens("a" * 401) == 101

def test_empty():
    """an empty string costs zero"""
    assert estimate_tokens("") == 0
```

#### Uses
- [What RAG actually is › When not to bother](#/what-is-rag/when-not-to-bother)
- [Reference › Standard library](#/reference/standard-library)

#### Hints
- Tokens are characters divided by four, and "rounding up" means 5 characters cost 2 tokens, not 1.
- Ceiling division without floats: `-(-n // 4)`. Or `math.ceil(n / 4)` after `import math`.
- An empty string has length 0, and either formula already gives 0 for it.

#### Tips
- Four characters per token is an average for English prose. Code, URLs and non-Latin scripts cost more tokens per character.
- `int(n / 4)` is the wrong reflex here: it truncates down, so 5 characters come out as 1 token and every estimate is a little too cheap. Round up, and be wrong in the safe direction.
- This is a budgeting number, not a billing number. When the bill matters, count with the provider's own tokenizer — the estimate and the invoice will not agree.

#### Docs
- [Python docs: `math.ceil`](https://docs.python.org/3/library/math.html#math.ceil)

### 2. Working budget

`working_budget(advertised, trust=0.25)` returns the number of tokens you should plan against: the advertised window multiplied by the fraction you trust, as an integer. Round down.

```python starter
def working_budget(advertised, trust=0.25):
    ...
```

```python test
def test_default_trust():
    """trusts a quarter of the window by default"""
    assert working_budget(1_000_000) == 250_000
    assert working_budget(200_000) == 50_000

def test_trust():
    """applies the trust factor you pass"""
    assert working_budget(200_000, 0.5) == 100_000
    assert working_budget(1_000_000, 0.1) == 100_000
    assert working_budget(128_000, 1.0) == 128_000

def test_integer():
    """returns an integer, rounded down"""
    assert isinstance(working_budget(10), int)
    assert working_budget(10) == 2
    assert working_budget(7, 0.5) == 3
    assert working_budget(1_000_003) == 250_000
```

#### Uses
- [What RAG actually is › When not to bother](#/what-is-rag/when-not-to-bother)
- [Reference › Built-ins](#/reference/built-ins)

#### Hints
- Multiply `advertised` by `trust`.
- The product is a float (`250000.0`). Wrap it in `int()` to pass the type check.

#### Tips
- `int()` truncates toward zero. For a budget, rounding down is the safe direction.
- The test uses `isinstance(..., int)`, so `250000.0` fails even though it equals `250000`. A budget that has drifted into float arithmetic will eventually print as `249999.99999999997` somewhere.
- `trust` is the only honest number here, and it is not 1.0. Measure it on your own material — a haystack demo passing at 900k tokens does not mean recall holds across your corpus at 900k.

#### Docs
- [Python docs: `int()`](https://docs.python.org/3/library/functions.html#int)

### 3. Paste it in, or RAG?

`needs_rag(corpus_chars, budget_tokens)` returns `True` when the corpus, at four characters per token rounded up, does not fit in the budget.

```python starter
def needs_rag(corpus_chars, budget_tokens):
    ...
```

```python test
def test_fits():
    """a corpus inside the budget does not need RAG"""
    assert needs_rag(400_000, 120_000) is False
    assert needs_rag(0, 1) is False
    assert needs_rag(3, 1) is False

def test_too_big():
    """a corpus over the budget needs RAG"""
    assert needs_rag(800_000, 120_000) is True
    assert needs_rag(5, 1) is True
    assert needs_rag(1, 0) is True

def test_boundary():
    """exactly the budget fits, one more character does not"""
    assert needs_rag(480_000, 120_000) is False
    assert needs_rag(480_001, 120_000) is True
    assert needs_rag(4, 1) is False
```

#### Uses
- [What RAG actually is › When not to bother](#/what-is-rag/when-not-to-bother)

#### Hints
- Turn the characters into tokens first, rounding up, the same way as in exercise 1.
- Return the comparison itself: `tokens > budget_tokens` is already `True` or `False`.

#### Tips
- A corpus of exactly the budget fits. Only strictly more needs RAG.
- This is not a one-time decision. A corpus that fits today grows, and the answer flips quietly — nothing errors when you go over, the answers just get worse.

#### Docs
- [Python docs: Comparisons](https://docs.python.org/3/library/stdtypes.html#comparisons)
