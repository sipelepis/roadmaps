# Grounded prompts

After retrieval you have five passages and a question. Generation is assembling them into a prompt and making a single call. There is no chain, no agent, no framework: a string and an API call.

```
system: Answer using only the numbered sources below. Cite them as [1], [2].
        If the sources don't contain the answer, say so — do not guess.

user:   [1] (handbook.pdf) Employees accrue 1.5 days per month…
        [2] (policy.md) Unused leave expires at year end…

        Question: how much leave do I get?
```

## The f-string that is "augmented generation"

```python
def build_prompt(question, sources):
    context = "\n\n".join(f"[{i}] ({c.filename}) {c.text}" for i, c in enumerate(sources, 1))
    return f"{context}\n\nQuestion: {question}"
```

The numbering exists so the model has something to cite. `enumerate(sources, 1)` starts at 1 because `[1]` reads like a citation and `[0]` reads like a bug. The filename rides along so a citation can name its source rather than just a number. Keep this function separate from the call that uses it, so a trace can show the exact string that was sent rather than a description of it.

## The two instructions doing the work

**"Only the sources"** is what makes the answer grounded. Without it the model happily blends in half-remembered training data, and you lose the one property RAG exists to provide.

**"Say so if the answer is not there"** gives it a permitted way to fail. Without an escape hatch, a model asked a question its context cannot answer will construct something anyway. "I don't see that in these documents" is a correct answer, and you have to explicitly allow it.

A third instruction is unglamorous and entirely practical: write plain prose, no markdown, when the answer is rendered as text. Asking the model not to emit `**bold**` is cheaper than shipping a renderer.

## Citations are not decoration

Asking for `[1]`-style markers gives every claim a traceable origin, so a reader can check the specific chunk rather than trusting the paragraph wholesale. It also makes the answer more faithful: a claim that has to name its source is harder to invent. Parse the markers back out of the answer and you can highlight the sources that were actually used.

## The short-circuit

```python
if not sources:
    return "Nothing indexed yet — upload a document first."
```

With an empty corpus there is nothing to ground an answer in, so the model is never called. It saves a pointless request and prevents the one case where an ungrounded model would answer from its own training and look exactly like a working RAG system.

## Fitting the budget

Every retrieved chunk is pasted in, so the prompt grows with `k` and with chunk size. When sources would overflow the context you trust, drop from the bottom of the ranking, never the top.

```python playground
SYSTEM = ("Answer the question using only the numbered sources below. "
          "Cite the sources you used as [1], [2], etc. "
          "If the sources don't contain the answer, say so plainly — do not guess. "
          "Write plain prose: no markdown.")

sources = [
    {"filename": "handbook.pdf", "text": "Employees accrue 1.5 days of leave per month."},
    {"filename": "policy.md", "text": "Unused leave expires at the end of the calendar year."},
]

def build_prompt(question, sources):
    context = "\n\n".join(f"[{i}] ({s['filename']}) {s['text']}" for i, s in enumerate(sources, 1))
    return f"{context}\n\nQuestion: {question}"

print(SYSTEM, "\n")
print(build_prompt("how much leave do I get?", sources))

# Try: pass an empty list and decide what the caller should do instead of calling the model.
```

## Exercises

### 1. Build the prompt

Implement `build_prompt(question, sources)` exactly as shown, where each source is a dict with `filename` and `text`.

```python starter
def build_prompt(question, sources):
    ...
```

```python test
def test_prompt():
    """numbered sources, filename, question last"""
    sources = [{"filename": "a.pdf", "text": "Alpha."}, {"filename": "b.md", "text": "Beta."}]
    assert build_prompt("Q?", sources) == "[1] (a.pdf) Alpha.\n\n[2] (b.md) Beta.\n\nQuestion: Q?"
    assert build_prompt("Q?", []) == "\n\nQuestion: Q?"
```

### 2. Parse citations

`parse_citations(answer)` returns the sorted list of distinct source numbers cited as `[n]` in the answer.

```python starter
import re

def parse_citations(answer):
    ...
```

```python test
def test_citations():
    """distinct, sorted, integers"""
    assert parse_citations("See [2] and [1]; also [2].") == [1, 2]
    assert parse_citations("No sources.") == []
    assert parse_citations("[10] beats [9]") == [9, 10]
```

### 3. Fit the budget

`fit_sources(sources, budget_chars)` returns the longest prefix of `sources` whose combined `text` length does not exceed `budget_chars`.

```python starter
def fit_sources(sources, budget_chars):
    ...
```

```python test
def test_fit():
    """keeps a prefix within budget"""
    s = [{"text": "aaaa"}, {"text": "bbb"}, {"text": "cc"}]
    assert fit_sources(s, 7) == s[:2]
    assert fit_sources(s, 100) == s
    assert fit_sources(s, 3) == []
    assert fit_sources([], 10) == []
```

### 4. Answer or refuse

`answer(question, sources, call)` returns the fixed string `"Nothing indexed yet — upload a document first."` when there are no sources, and otherwise returns `call(build_prompt(question, sources))`. Reuse your `build_prompt`.

```python starter
def build_prompt(question, sources):
    context = "\n\n".join(f"[{i}] ({s['filename']}) {s['text']}" for i, s in enumerate(sources, 1))
    return f"{context}\n\nQuestion: {question}"

def answer(question, sources, call):
    ...
```

```python test
def test_answer():
    """short-circuits on an empty corpus"""
    seen = []
    def fake_model(prompt):
        seen.append(prompt)
        return "ok [1]"
    assert answer("Q?", [], fake_model) == "Nothing indexed yet — upload a document first."
    assert seen == []
    assert answer("Q?", [{"filename": "f", "text": "t"}], fake_model) == "ok [1]"
    assert seen == ["[1] (f) t\n\nQuestion: Q?"]
```
