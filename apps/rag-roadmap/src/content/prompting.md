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

def test_numbering():
    """numbers every source from 1, in order"""
    one = [{"filename": "manual.pdf", "text": "Two years."}]
    assert build_prompt("How long?", one) == "[1] (manual.pdf) Two years.\n\nQuestion: How long?"
    three = [{"filename": "x.txt", "text": "A"}, {"filename": "y.txt", "text": "B"}, {"filename": "x.txt", "text": "C"}]
    assert build_prompt("which?", three) == "[1] (x.txt) A\n\n[2] (y.txt) B\n\n[3] (x.txt) C\n\nQuestion: which?"

def test_no_sources():
    """no sources leave two newlines and the question"""
    assert build_prompt("Q?", []) == "\n\nQuestion: Q?"
    assert build_prompt("anything", []) == "\n\nQuestion: anything"
```

#### Uses
- [Grounded prompts › The f-string that is "augmented generation"](#/prompting/the-f-string-that-is-augmented-generation)
- [Documents to text › Pages come with their index](#/documents/pages-come-with-their-index)

#### Hints
- Number the sources with `enumerate(sources, 1)` and format each as `[i] (filename) text`.
- Join those with `"\n\n"`, then add two newlines, `Question: ` and the question.

#### Tips
- With no sources the context is `""`, so the prompt starts with two newlines. The short-circuit in exercise 4 keeps that prompt from ever reaching a model.
- `enumerate(sources, 1)`, not `enumerate(sources)`. The model cites the numbers you print, so a zero-based prompt produces answers full of `[0]`, and every downstream citation check then has to know which convention it is looking at.
- Keep this function separate from the call that sends it. A trace that shows the exact string beats a description of it every time, and this is the one string you will read most often when an answer goes wrong.
- The question goes last. Instructions and sources first, then the thing to answer, is the order models follow most reliably.

#### Docs
- [Python tutorial: Formatted string literals](https://docs.python.org/3/tutorial/inputoutput.html#formatted-string-literals)
- [Python docs: `enumerate()`](https://docs.python.org/3/library/functions.html#enumerate)

### 2. Parse citations

`parse_citations(answer)` returns the sorted list of distinct source numbers cited as `[n]` in the answer.

```python starter
import re

def parse_citations(answer):
    ...
```

```python test
def test_citations():
    """distinct and sorted"""
    assert parse_citations("See [2] and [1]; also [2].") == [1, 2]
    assert parse_citations("[3][1][2][3]") == [1, 2, 3]

def test_numeric_order():
    """integers, sorted as numbers"""
    assert parse_citations("[10] beats [9]") == [9, 10]
    assert parse_citations("[100], [20] and [3]") == [3, 20, 100]
    assert all(type(n) is int for n in parse_citations("[12] [4]"))

def test_no_citations():
    """text without [n] markers cites nothing"""
    assert parse_citations("No sources.") == []
    assert parse_citations("(1) and 2 and [x] and []") == []
```

#### Uses
- [Grounded prompts › Citations are not decoration](#/prompting/citations-are-not-decoration)

#### Hints
- `re.findall(r"\[(\d+)\]", answer)` returns the numbers inside the brackets, as strings.
- Convert them to `int`, remove duplicates with a `set`, and sort.

#### Tips
- Convert before sorting. As strings, `"10"` sorts before `"9"`.
- `set()` then `sorted()` is the usual pair: the set removes the duplicates, the sort puts them back in an order. Neither on its own gives "distinct and sorted".
- Parsing the markers back out is the cheapest faithfulness check there is. It costs a regex, it runs on every answer, and it catches the most common symptom of an invented claim — a citation pointing at a source that does not exist.

#### Docs
- [Python docs: `re.findall`](https://docs.python.org/3/library/re.html#re.findall)

### 3. Fit the budget

`fit_sources(sources, budget_chars)` returns the longest prefix of `sources` whose combined `text` length does not exceed `budget_chars`.

```python starter
def fit_sources(sources, budget_chars):
    ...
```

```python test
def test_fit():
    """keeps the longest prefix within budget"""
    s = [{"text": "aaaa"}, {"text": "bbb"}, {"text": "cc"}]
    assert fit_sources(s, 7) == s[:2]
    assert fit_sources(s, 5) == s[:1]
    assert fit_sources(s, 100) == s

def test_exact_budget():
    """a total exactly at the budget still fits"""
    s = [{"text": "aaaa"}, {"text": "bbb"}, {"text": "cc"}]
    assert fit_sources(s, 4) == s[:1]
    assert fit_sources(s, 9) == s
    assert fit_sources([{"text": ""}], 0) == [{"text": ""}]

def test_stops_at_first_misfit():
    """stops at the first source that does not fit"""
    s = [{"text": "aaaa"}, {"text": "bbbbbb"}, {"text": "c"}]
    assert fit_sources(s, 6) == s[:1]
    assert fit_sources(s, 3) == []
    assert fit_sources([], 10) == []
```

#### Uses
- [Grounded prompts › Fitting the budget](#/prompting/fitting-the-budget)

#### Hints
- Walk the sources in order, keeping a running total of `len(s["text"])`.
- As soon as the next source would push the total past `budget_chars`, stop, and return the sources before it.

#### Tips
- Stop at the first source that doesn't fit, even if a shorter one further down would. You drop from the bottom of the ranking, you don't skip around in it.
- The sources are not the whole prompt. The system message, the `[n] (filename)` wrappers and the question are all on the bill, so budget against the assembled string rather than the sum of the chunk texts.
- Characters are a stand-in for tokens. Four characters per token is fine for deciding what to drop; it is not fine for deciding whether you are one token under a hard limit.

#### Docs
- [Python tutorial: `break` and `continue`](https://docs.python.org/3/tutorial/controlflow.html#break-and-continue-statements)

### 4. Answer or refuse

`answer(question, sources, call)` returns the fixed string `"Nothing indexed yet — upload a document first."` when there are no sources, and otherwise returns `call(build_prompt(question, sources))`. `build_prompt` is provided.

```python starter
def build_prompt(question, sources):
    context = "\n\n".join(f"[{i}] ({s['filename']}) {s['text']}" for i, s in enumerate(sources, 1))
    return f"{context}\n\nQuestion: {question}"

def answer(question, sources, call):
    ...
```

```python test
def test_empty():
    """short-circuits on an empty corpus without calling the model"""
    seen = []
    def fake_model(prompt):
        seen.append(prompt)
        return "should not be called"
    assert answer("Q?", [], fake_model) == "Nothing indexed yet — upload a document first."
    assert answer("another question", [], fake_model) == "Nothing indexed yet — upload a document first."
    assert seen == []

def test_sends_prompt():
    """sends the prompt build_prompt makes, once per question"""
    seen = []
    def fake_model(prompt):
        seen.append(prompt)
        return "ok"
    answer("Q?", [{"filename": "f", "text": "t"}], fake_model)
    sources = [{"filename": "a.pdf", "text": "Alpha."}, {"filename": "b.md", "text": "Beta."}]
    answer("Why?", sources, fake_model)
    assert seen == ["[1] (f) t\n\nQuestion: Q?", build_prompt("Why?", sources)]

def test_returns_reply():
    """returns the model's reply unchanged"""
    source = [{"filename": "f", "text": "t"}]
    assert answer("Q?", source, lambda prompt: "ok [1]") == "ok [1]"
    assert answer("Q?", source, lambda prompt: prompt.upper()) == "[1] (F) T\n\nQUESTION: Q?"
```

#### Uses
- [Grounded prompts › The short-circuit](#/prompting/the-short-circuit)

#### Hints
- Check `if not sources:` first, and return the fixed string without touching `call`.
- Otherwise build the prompt and return whatever `call` gives back for it.

#### Tips
- Copy the message exactly, em dash `—` included. The test compares the strings character by character.
- The `seen == []` assertion is the real test. Returning the right string while still calling the model passes the first two checks and fails this one, which is the whole point: the short-circuit exists to *not* make the call.
- An empty corpus is the one case where an ungrounded model looks exactly like a working RAG system. It answers fluently from training data, cites nothing, and nobody notices until someone asks about a document that was never uploaded.

#### Docs
- [Python docs: Truth value testing](https://docs.python.org/3/library/stdtypes.html#truth-value-testing)
