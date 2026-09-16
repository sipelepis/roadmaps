# Reference

Everything the exercises on this roadmap lean on, in one place: the Python they use, the shapes the data arrives in, and the arithmetic behind the scores. This is a lookup page, not a step. Skim it once, then come back when an exercise uses something you have not met.

Every sample here was run. The `→` shows what the expression actually evaluates to.

## Built-ins

- **`len(x)`** — how many items, or how many characters. `len("café")` → `4`, `len([1, 2, 3])` → `3`. [docs](https://docs.python.org/3/library/functions.html#len)
- **`range(stop)` / `range(start, stop)`** — the whole numbers from `start` up to but not including `stop`. `list(range(3))` → `[0, 1, 2]`, `list(range(2, 5))` → `[2, 3, 4]`. A third argument is the step, and `range(10, 0, -1)` counts down. [docs](https://docs.python.org/3/library/stdtypes.html#range)
- **`enumerate(seq, start=0)`** — pairs each item with a counter, so you get the index and the item in one loop. `list(enumerate(["a", "b"]))` → `[(0, 'a'), (1, 'b')]`, `list(enumerate(["a", "b"], 1))` → `[(1, 'a'), (2, 'b')]`. [docs](https://docs.python.org/3/library/functions.html#enumerate)
- **`zip(a, b)`** — walks two sequences side by side, stopping at the shorter one. `list(zip([1, 2, 3], [4, 5, 6]))` → `[(1, 4), (2, 5), (3, 6)]`, `list(zip([1, 2], [3, 4, 5]))` → `[(1, 3), (2, 4)]`. [docs](https://docs.python.org/3/library/functions.html#zip)
- **`sum(iterable)`** — adds the items. `True` counts as 1, which is how you count matches: `sum(r in {"b", "d"} for r in ["a", "b", "c", "d"])` → `2`. [docs](https://docs.python.org/3/library/functions.html#sum)
- **`any(iterable)` / `all(iterable)`** — is anything true, is everything true. `any([])` → `False`, `all([])` → `True`. That empty-list asymmetry is why `all(...)` over an empty filter dict passes everything. [docs](https://docs.python.org/3/library/functions.html#any)
- **`max(iterable, key=...)` / `min(...)`** — the largest item, optionally by a computed key. On a tie it returns the **first** of the equal items: `max([("a", 1), ("b", 1)], key=lambda t: t[1])` → `('a', 1)`. [docs](https://docs.python.org/3/library/functions.html#max)
- **`sorted(iterable, key=..., reverse=True)`** — a new sorted list; the original is untouched. `sorted([3, 1, 2], reverse=True)` → `[3, 2, 1]`. It is stable, so equal items keep their input order even with `reverse=True`. [docs](https://docs.python.org/3/library/functions.html#sorted)
- **`abs(x)`** — distance from zero. `abs(-0.25)` → `0.25`. The tests use it to compare floats, see [How the tests work](#/reference/how-the-tests-work). [docs](https://docs.python.org/3/library/functions.html#abs)
- **`round(x)`** — nearest whole number, but halves go to the **even** neighbour: `round(2.5)` → `2`, `round(3.5)` → `4`, `round(0.5)` → `0`. `round(x, 2)` keeps two decimals. [docs](https://docs.python.org/3/library/functions.html#round)
- **`int(x)` / `float(x)`** — convert. `int` truncates toward zero, it does not round: `int(2.99)` → `2`, `int(-2.99)` → `-2`, `int(1_000_000 * 0.25)` → `250000`. [docs](https://docs.python.org/3/library/functions.html#int)
- **`isinstance(x, int)`** — type check that the tests use to insist on an `int` rather than a `float`. `isinstance(0.25, float)` → `True`. [docs](https://docs.python.org/3/library/functions.html#isinstance)
- **`bool(x)`** — truthiness. `""`, `[]`, `{}`, `0` and `None` are false; everything else, `"0"` included, is true. `bool(re.search("x", "axb"))` → `True` turns a match object into a real boolean. [docs](https://docs.python.org/3/library/stdtypes.html#truth-value-testing)

## String methods

- **`.strip()` / `.lstrip()` / `.rstrip()`** — remove whitespace from both ends, the left, the right. `"  a  ".strip()` → `'a'`, `"   \n ".strip()` → `''` (falsy, which is how "is this page blank" is tested). [docs](https://docs.python.org/3/library/stdtypes.html#str.strip)
- **`.lstrip(chars)`** — with an argument it strips any of *those characters*, not that string. `"### Deep  ".lstrip("#")` → `' Deep  '`, and `.strip()` after it → `'Deep'`. One call handles `#`, `##` and `###`. [docs](https://docs.python.org/3/library/stdtypes.html#str.lstrip)
- **`.lower()` / `.upper()`** — case conversion. `"WARRANTY".lower()` → `'warranty'`. [docs](https://docs.python.org/3/library/stdtypes.html#str.lower)
- **`.casefold()`** — a more aggressive `lower()` meant for comparison. `"Straße".casefold()` → `'strasse'`, where `"Straße".lower()` → `'straße'`. Use it when you compare text from documents you did not write. [docs](https://docs.python.org/3/library/stdtypes.html#str.casefold)
- **`.startswith(prefix)` / `.endswith(suffix)`** — `True` or `False`, no slicing needed. `"# Terms".startswith("#")` → `True`, `"Contract.PDF".lower().endswith(".pdf")` → `True`. Both accept a tuple: `"hi there".startswith(("hi", "hello"))` → `True`. [docs](https://docs.python.org/3/library/stdtypes.html#str.startswith)
- **`.split()` / `.split(sep)`** — with no argument it splits on any run of whitespace and drops the empties: `"a b  c".split()` → `['a', 'b', 'c']`. With a separator it splits on exactly that: `"a\n\nb\n\nc".split("\n\n")` → `['a', 'b', 'c']`. [docs](https://docs.python.org/3/library/stdtypes.html#str.split)
- **`.splitlines()`** — split on line breaks. `"a\nb".splitlines()` → `['a', 'b']`. [docs](https://docs.python.org/3/library/stdtypes.html#str.splitlines)
- **`sep.join(list)`** — the inverse, called on the separator. `"\n".join(["a", "b"])` → `'a\nb'`, `"\n\n".join(["a"])` → `'a'`. It fails on `None`, so write `p or ""` first. [docs](https://docs.python.org/3/library/stdtypes.html#str.join)
- **`.rfind(sub, start, end)`** — the index of the last occurrence, or `-1` when there is none. `"aaaa bbbb".rfind(" ")` → `4`, `"aaaabbbb".rfind(" ")` → `-1`, `"aaaa bbbb cccc".rfind(" ", 5, 10)` → `9`. The `-1` is what makes the chunker fall through to a mid-word cut. [docs](https://docs.python.org/3/library/stdtypes.html#str.rfind)
- **Slicing `s[a:b]`** — a substring from `a` up to but not including `b`. `"abcdef"[1:4]` → `'bcd'`, `"abcdef"[-2:]` → `'ef'`. Out-of-range is safe, not an error: `"abc"[:100]` → `'abc'`, `"abc"[:0]` → `''`. The same syntax slices lists, which is how `results[:k]` takes the top k. [docs](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)
- **`in`** — substring test for strings, membership test for lists, sets and dict keys. `"war" in "warranty"` → `True`. [docs](https://docs.python.org/3/library/stdtypes.html#comparisons)
- **f-strings** — `f"{value}"` interpolates; after a colon comes the format. `f"{200_000:,}"` → `'200,000'`, `f"{0.974631846:.2f}"` → `'0.97'`, `f"{5:>3}"` → `'  5'`. [docs](https://docs.python.org/3/library/string.html#format-specification-mini-language)

## Lists, dicts and sets

- **`list.append(x)`** — add one item to the end, in place. It returns `None`, so `xs = xs.append(1)` throws your list away. [docs](https://docs.python.org/3/tutorial/datastructures.html#more-on-lists)
- **List comprehension** — build a list from a loop and an optional filter. `[w for w in ["a", "", "b"] if w]` → `['a', 'b']`. Order is preserved, and it is the usual way to keep the rows that pass a test. [docs](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions)
- **`dict.get(key)` / `dict.get(key, default)`** — a lookup that does not raise on a missing key. `{"a": 1}.get("b")` → `None`, `{"a": 1}.get("b", 0)` → `0`. This is how a chunk with no `public` field is filtered out instead of crashing the search. [docs](https://docs.python.org/3/library/stdtypes.html#dict.get)
- **`dict.items()`** — the key/value pairs, for looping. `list({"a": 1, "b": 2}.items())` → `[('a', 1), ('b', 2)]`. [docs](https://docs.python.org/3/library/stdtypes.html#dict.items)
- **`dict.copy()` and `{**d, "score": s}`** — a shallow copy, and a copy with a key added. `{**{"id": 1}, "score": 0.5}` → `{'id': 1, 'score': 0.5}` and the original still has no `score`. Retrieval returns scored *copies* so the stored chunks stay clean. [docs](https://docs.python.org/3/library/stdtypes.html#dict.copy)
- **Dicts keep insertion order** — `list({"b": 1, "a": 2})` → `['b', 'a']`. Combined with a stable `sorted`, that is what makes "ties keep the order of first appearance" fall out for free. [docs](https://docs.python.org/3/library/stdtypes.html#dict)
- **Sorting a dict by value** — `sorted(scores, key=scores.get, reverse=True)` returns the keys, best first. With `scores = {"a": 0.0323, "b": 0.0325, "c": 0.0320}` → `['b', 'a', 'c']`. [docs](https://docs.python.org/3/howto/sorting.html#key-functions)
- **Sets and `&`** — `&` is the intersection, `|` the union, `-` the difference. `{"warranty", "period"} & {"warranty", "claims"}` → `{'warranty'}`, and `len(...)` of that is the overlap count a crude reranker divides by. [docs](https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset)

## Standard library

- **`math.sqrt(x)`** — square root. `math.sqrt(14)` → `3.7416573867739413`. [docs](https://docs.python.org/3/library/math.html#math.sqrt)
- **`math.hypot(*v)`** — the length of a vector, in one call, without writing the sum of squares. `math.hypot(3, 4)` → `5.0`, `math.hypot(*[1, 2, 2])` → `3.0`. The `*` unpacks a list into separate arguments. [docs](https://docs.python.org/3/library/math.html#math.hypot)
- **`math.sumprod(a, b)`** — the dot product: multiply pairwise and add. `math.sumprod([1, 2, 3], [4, 5, 6])` → `32`. [docs](https://docs.python.org/3/library/math.html#math.sumprod)
- **`math.ceil(x)`** — round up. `math.ceil(401 / 4)` → `101`. Without floats, `-(-401 // 4)` → `101` does the same. [docs](https://docs.python.org/3/library/math.html#math.ceil)
- **`math.log(x)`** — natural logarithm, base *e*, not base 10. `round(math.log(2.5), 6)` → `0.916291`. BM25's idf uses this one. [docs](https://docs.python.org/3/library/math.html#math.log)
- **`statistics.fmean(data)`** — the mean, as a float. `statistics.fmean([90, 70])` → `80.0`. It raises `StatisticsError` on an empty list, exactly as `sum(x) / len(x)` would raise `ZeroDivisionError`, so guard it either way. [docs](https://docs.python.org/3/library/statistics.html#statistics.fmean)
- **`re.findall(pattern, s)`** — every match, in order, as a list. With one capture group it returns the group. `re.findall(r"[a-z0-9]+", "Error-402".lower())` → `['error', '402']`, `re.findall(r"\[(\d+)\]", "[2] and [10]")` → `['2', '10']` (strings, convert with `int`). [docs](https://docs.python.org/3/library/re.html#re.findall)
- **`re.sub(pattern, repl, s)`** — replace every match. `\1` in the replacement is the first captured group. `re.sub(r"(\w)-\n(\w)", r"\1\2", "agree-\nment")` → `'agreement'`. [docs](https://docs.python.org/3/library/re.html#re.sub)
- **`re.search` vs `re.match`** — `search` looks anywhere, `match` only at the start. `re.match(r"(hi|hello)\b", "hire a contractor")` → `None`, because `\b` demands a word boundary. Both return a match object or `None`. [docs](https://docs.python.org/3/library/re.html#re.search)
- **Pattern pieces used here** — `\w` a letter, digit or underscore; `\s` any whitespace including newlines; `\d` a digit; `+` one or more; `{3,}` three or more; `[ \t]` a literal space or tab only; `re.I` case-insensitive. Put `-` last in a character class, `[A-Za-z0-9_-]`, so it means a dash and not a range. [docs](https://docs.python.org/3/library/re.html#regular-expression-syntax)
- **`collections.Counter(items)`** — counts, with `0` for anything absent instead of a `KeyError`. `Counter(["a", "b", "a"])["a"]` → `2`, `Counter(["a", "b", "a"])["z"]` → `0`. That is the term frequency in BM25. [docs](https://docs.python.org/3/library/collections.html#collections.Counter)
- **`itertools.groupby(seq, key=...)`** — groups **adjacent** items with an equal key, so sort by the same key first. On `[("b", 1), ("a", 1), ("a", 2)]` the keys come out `['b', 'a']`; sorted first, `['a', 'b']`. [docs](https://docs.python.org/3/library/itertools.html#itertools.groupby)
- **`bisect.bisect_right(sorted_list, x)`** — how many items are `<= x`, found by binary search. `bisect_right([0, 100, 250], 150)` → `2`, `bisect_right([0, 100, 250], 100)` → `2`, `bisect_right([0, 100, 250], 0)` → `1`. `bisect_left` would answer `1` for the second one, which puts an offset on the previous page. [docs](https://docs.python.org/3/library/bisect.html#bisect.bisect_right)
- **`unicodedata.normalize("NFKC", s)`** — folds compatibility characters to plain ones. `normalize("NFKC", "ﬁnance")` → `'finance'`, `normalize("NFKC", "①")` → `'1'`. [docs](https://docs.python.org/3/library/unicodedata.html#unicodedata.normalize)
- **`hmac.compare_digest(a, b)`** — string comparison that takes the same time whether the first character differs or the last. `compare_digest("secret", "secret")` → `True`, `compare_digest("secre", "secret")` → `False`. [docs](https://docs.python.org/3/library/hmac.html#hmac.compare_digest)
- **`zlib.crc32(b"...")`** — a fast, deterministic, non-cryptographic hash of bytes. The toy embedder uses `crc32(word.encode()) % dims` to pick which slot a word bumps: `zlib.crc32(b"warranty") % 32` → `18`. [docs](https://docs.python.org/3/library/zlib.html#zlib.crc32)
- **`bytes.decode(encoding, errors=...)`** — bytes to text. `errors="replace"` substitutes `�` for invalid bytes instead of raising; `errors="ignore"` deletes them silently. [docs](https://docs.python.org/3/library/stdtypes.html#bytes.decode)

## Shapes of the data

Four dict shapes recur across every module. Nothing enforces them; they are a convention the exercises share.

**A chunk**, the unit of everything after chunking. `ordinal` is its index within its document, which is what a citation and a "fetch the neighbours" trick both need.

```python
{"filename": "manual.pdf", "ordinal": 7, "text": "The product ships with a two year warranty.",
 "vector": [0.12, -0.03, ...]}
```

**A word box**, one row of OCR output. `conf` is 0 to 100, and `-1` marks a row that is a block or line header rather than a word. `block`, `par`, `line` and `left` together give reading order; `left`, `top`, `width`, `height` give the position for a citation.

```python
{"block": 1, "par": 1, "line": 2, "left": 118, "top": 108, "width": 92, "height": 14,
 "conf": 88, "text": "warranty"}
```

**A scored candidate**, what retrieval returns: a copy of the chunk with a `score` added, so the stored chunk keeps no trace of any one query.

```python
{"id": "a", "text": "…", "vector": [...], "score": 0.83}
```

**A ranking**, the input to fusion and to every retrieval metric: just an ordered list of ids, best first, with rank 1 at the front.

```python
["c9", "c1", "c4"]          # what retrieval returned, in order
{"c9"}                      # which of them were actually relevant
```

## The small maths

Every formula the modules use, with a worked number you can check.

**Dot product.** Multiply pairwise, add. For `a = [1, 2, 3]` and `b = [4, 5, 6]`: `1·4 + 2·5 + 3·6` = `4 + 10 + 18` = `32`. In code, `math.sumprod(a, b)` → `32`.

**Vector length** (the magnitude, written `|a|`). The square root of the sum of squares. `|[1, 2, 3]|` = `sqrt(1 + 4 + 9)` = `sqrt(14)` → `3.7416573867739413`. In code, `math.hypot(*a)`.

**Cosine similarity.** The dot product divided by both lengths, which is the cosine of the angle between them.

```
cos(a, b) = (a · b) / (|a| · |b|)
          = 32 / (3.74165… × 8.77496…)
          = 32 / 32.8329…
          = 0.9746318461970762
```

`cos([1, 0], [0, 1])` → `0.0` (nothing in common), `cos([1, 0], [-1, 0])` → `-1.0` (opposite), `cos([1, 1], [1, 0])` → `0.7071067811865475`. Length is divided out, so `cos([1, 1], [2, 2])` is 1 — printed as `0.9999999999999998`, because floats.

**Unit length.** Divide a vector by its own length and it becomes length 1: `[3, 4]` has length `5.0`, so it normalises to `[0.6, 0.8]`. Once both vectors are unit length the two divisions are by 1, and cosine collapses to the plain dot product: `math.sumprod([0.6, 0.8], [1.0, 0.0])` → `0.6`, the same as `cos([3, 4], [1, 0])`.

**Precision and recall at k.** With `retrieved = ["a", "b", "c", "d"]` and `relevant = {"b", "d", "z"}`:

```
P@2 = hits in the top 2 / 2            = 1 / 2 = 0.5
R@2 = hits in the top 2 / all relevant = 1 / 3 = 0.333…
P@4 = 2 / 4 = 0.5        R@4 = 2 / 3 = 0.666…
```

Precision divides by `k` even when fewer than `k` results came back, so a short result list costs you precision. Recall divides by the number of relevant chunks, which is why `"z"` — relevant but never retrievable — caps recall at 2/3 forever.

**MRR.** Per question, `1 / rank` of the *first* relevant hit, or 0 if there is none; then the mean. For three questions hitting at rank 2, rank 1 and never: `(0.5 + 1.0 + 0.0) / 3` = `0.5`.

**BM25.** Three factors multiplied per query term and summed over the terms.

```
idf(t)   = ln(1 + (N - df + 0.5) / (df + 0.5))

score(d) = Σ  idf(t) · tf · (k1 + 1)
           t        tf + k1 · (1 - b + b · |d| / avg|d|)
```

`N` is the number of documents, `df` how many contain the term, `tf` how often it appears in *this* document, `|d|` this document's token count and `avg|d|` the corpus mean. Worked, for the three documents `["error code 402 payment required", "payment payment failures", "refunds within ten days"]` (token counts 5, 3, 4, so `avg|d|` = `4.0`) and the term `payment` in the second document, with `k1 = 1.5` and `b = 0.75`:

```
df = 2, N = 3   idf   = ln(1 + (3 - 2 + 0.5) / (2 + 0.5)) = ln(1.6)   = 0.47000362924573563
tf = 2, |d| = 3 denom = 2 + 1.5 · (1 - 0.75 + 0.75 · 3/4) = 2 + 1.21875 = 3.21875
                score = 0.47000362924573563 · 2 · 2.5 / 3.21875        = 0.7301027250419194
```

A rarer term scores higher: at `df = 1` the idf is `0.9808292530117263`, at `df = 3` (in every document) it drops to `0.13353139262452257`. And length matters: for `["cat", "cat dog bird fish"]` the query `cat` scores `[0.2498, 0.1436]`, but with `b = 0.0` length is ignored and both score `0.1823`.

**Reciprocal rank fusion.** Each list contributes `1 / (k + rank)`, ranks starting at 1, `k` around 60. For `A = [a, b, c]` and `B = [b, c, a]`:

```
a: 1/61 + 1/63 = 0.0322664
b: 1/62 + 1/61 = 0.0325225
c: 1/63 + 1/62 = 0.0320020
→ b, a, c
```

The gaps are tiny, which is the point: `k = 60` flattens the difference between rank 1 and rank 3 so no single list can dominate.

**Maximal marginal relevance.** Pick greedily; each round, score every unpicked candidate as `λ · sim(query, c) − (1 − λ) · max sim(c, already chosen)`. With `q = [1, 0]` and candidates `a = [1, 0]`, `b = [0.99, 0.1]`, `c = [0.6, 0.8]`, `a` is picked first. Then:

```
λ = 0.7   b: 0.7·0.99494 − 0.3·0.99494 = 0.39797     c: 0.7·0.6 − 0.3·0.6 = 0.24     → b
λ = 0.3   b: 0.3·0.99494 − 0.7·0.99494 = −0.39797    c: 0.3·0.6 − 0.7·0.6 = −0.24    → c
```

`λ = 1` is plain top-k. Lower it and the near-copy `b` loses to the different-but-weaker `c`.

**Tokens from characters.** Four characters per token, rounded up: `-(-401 // 4)` → `101`, and `-(-0 // 4)` → `0`. A 480,000-character corpus is 120,000 tokens.

## How the tests work

Each exercise ships a test file that runs in your browser under Pyodide. Your editor's code runs first, then the tests run in the same namespace, so they call your functions directly. Nothing is imported and nothing is mocked.

- **A test is a function named `test_…`.** Every one is run. If it returns without raising, it passed.
- **The docstring is the label.** The line under `def test_…():` is what the results panel shows, so a failure reads `✗ rounds up` rather than `✗ test_rounds_up`.
- **`assert expr`** raises `AssertionError` when `expr` is falsy, and does nothing when it is truthy. That is the whole mechanism. The first failing assert stops that test; the other tests still run. On a failing `assert a == b` the panel shows both sides as they were compared, which is usually enough to see what went wrong.
- **`print(...)` inside your code is kept.** Whatever a test printed is shown under its result, so a `print` in the middle of your function is the fastest debugger here.
- **`assert abs(got - want) < 1e-9`** is how floats are compared. `0.1 + 0.2 == 0.3` is `False` in binary floating point, so tests ask "close enough" instead. A cosine of exactly 1 often arrives as `0.9999999999999998`.
- **`assert f(x) is True`** is stricter than `assert f(x)`. It demands the actual boolean, so returning `1`, `"yes"` or a match object fails. When you see `is True` or `is False`, wrap your result in `bool(...)` or return a comparison.
- **`assert isinstance(x, int)`** demands the type: `250000` passes, `250000.0` does not.
- **Checking that something raises** uses `try` / `except` / `else`, because a missing exception has to fail too:

```python
try:
    check_upload("big.pdf", 101, 100)
except ValueError:
    pass
else:
    raise AssertionError("101 bytes over a limit of 100 must raise")
```

- **Checking a function was *not* called** uses a list the test appends to. `calls` and `seen` in those tests are the test's own bookkeeping, not something your solution defines: the test hands you a fake `ocr` or `call` that records its arguments, then asserts on the list afterwards.
- **`assert all("score" not in c for c in chunks)`** means the input must come back unmodified. Build copies with `{**c, "score": s}` rather than assigning into the caller's dicts.
