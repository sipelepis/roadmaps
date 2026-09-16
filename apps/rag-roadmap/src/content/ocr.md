# OCR: pages as pictures

A scanned PDF is a photograph of each page. There is no text layer, `extract_text()` returns nothing, and the ingest guard fires. Optical character recognition is how you get text back out of the picture, and it is the one step in this pipeline that is genuinely a computer vision problem.

## What an OCR engine gives you

Tesseract, the open-source engine behind most self-hosted OCR, does not return a string. It returns *words*, each with a position on the page, a confidence score, and its place in a hierarchy of blocks, paragraphs, and lines. The tab-separated output looks like this:

```
level page block par line word left top width height conf text
5     1    1     1   1    1    72   88  61    14     96   The
5     1    1     1   1    2    139  88  74    14     95   product
5     1    1     1   1    3    219  88  49    14     91   ships
5     1    1     1   2    1    72   108 38    14     -1
5     1    1     1   2    2    118  108 92    14     88   warranty
```

Three things in there matter for RAG:

- **Confidence** is 0 to 100, and `-1` marks rows that are not words at all (a block or line header). Low-confidence words are usually noise: a smudge, a stray line, a decorative glyph. Dropping them below a threshold removes garbage that would otherwise be embedded as if it meant something.
- **Block, paragraph, line** give reading order. A two-column page comes back as two blocks, and if you concatenate words by their `top` coordinate alone you interleave the columns. Sort by block, then paragraph, then line, then left-to-right.
- **Bounding boxes** let you keep the page and position of every word, which is what a citation needs when the source is a scan: "page 3, top right" beats "somewhere in the PDF".

## Reassembling text

```python
words = [w for w in rows if w["conf"] >= MIN_CONF and w["text"].strip()]
words.sort(key=lambda w: (w["block"], w["par"], w["line"], w["left"]))
lines = group by (block, par, line) → " ".join(texts)
```

Then the text is text again and the rest of the pipeline does not care where it came from. Except that OCR output has its own habits: hyphens at line ends, running headers on every page, and `l` where there should be `1`. The cleaning module handles those.

## When to run it

OCR is slow and, hosted, it costs money per page. Run it as a fallback, not a default: try the text layer first, and only rasterize and recognise the pages that came back empty. A mixed document, where the body is native and one appendix is a scan, gets exactly the pages it needs.

```
for each page:
    text = extract_text(page)
    if not text.strip():
        text = ocr(render(page))
```

## The alternatives

Tesseract is free, runs anywhere, and is fine on clean scans of printed text. It struggles with handwriting, skewed photos, and tables. Hosted document AI (the cloud vendors' OCR products, or a vision-capable language model asked to transcribe the page) handles those better and returns structure such as tables and key-value pairs, at a per-page price. Layout-aware parsers like Docling combine OCR with reading-order recovery for the worst PDFs. Start with the free one and measure the confidence scores; they tell you when to upgrade.

```python playground
# Rows as Tesseract's TSV output would give them, already parsed. Two columns on one page.
rows = [
    {"block": 1, "par": 1, "line": 1, "left": 72,  "conf": 96, "text": "The"},
    {"block": 1, "par": 1, "line": 1, "left": 139, "conf": 95, "text": "product"},
    {"block": 1, "par": 1, "line": 2, "left": 72,  "conf": -1, "text": ""},
    {"block": 1, "par": 1, "line": 2, "left": 118, "conf": 88, "text": "warranty"},
    {"block": 2, "par": 1, "line": 1, "left": 400, "conf": 93, "text": "Returns"},
    {"block": 2, "par": 1, "line": 1, "left": 470, "conf": 12, "text": "|"},
    {"block": 2, "par": 1, "line": 1, "left": 480, "conf": 90, "text": "accepted"},
]

MIN_CONF = 60
kept = [r for r in rows if r["conf"] >= MIN_CONF and r["text"].strip()]
kept.sort(key=lambda r: (r["block"], r["par"], r["line"], r["left"]))

from itertools import groupby
for key, group in groupby(kept, key=lambda r: (r["block"], r["par"], r["line"])):
    print(key, " ".join(r["text"] for r in group))

confs = [r["conf"] for r in kept]
print("mean confidence:", round(sum(confs) / len(confs), 1))

# Try: sort by left only and watch the two columns interleave.
```

## Exercises

### 1. Drop the noise

`drop_low_confidence(words, min_conf)` keeps only rows whose `conf` is at least `min_conf` and whose `text` is not blank. Order is preserved.

```python starter
def drop_low_confidence(words, min_conf):
    ...
```

```python test
def test_confidence():
    """keeps rows at or above min_conf"""
    rows = [{"conf": 96, "text": "The"}, {"conf": 12, "text": "|"}, {"conf": 60, "text": "ok"}, {"conf": 59, "text": "no"}]
    assert [r["text"] for r in drop_low_confidence(rows, 60)] == ["The", "ok"]
    assert [r["text"] for r in drop_low_confidence(rows, 90)] == ["The"]
    assert [r["text"] for r in drop_low_confidence(rows, 0)] == ["The", "|", "ok", "no"]

def test_blank_text():
    """drops blank text whatever its confidence"""
    rows = [{"conf": 99, "text": "   "}, {"conf": -1, "text": ""}, {"conf": 80, "text": "a"}, {"conf": 95, "text": "\t"}]
    assert drop_low_confidence(rows, -1) == [{"conf": 80, "text": "a"}]
    assert drop_low_confidence(rows, 90) == []

def test_order():
    """keeps whole rows in their original order"""
    rows = [{"conf": 70, "text": "b", "left": 9}, {"conf": 95, "text": "a", "left": 1}, {"conf": 80, "text": "c", "left": 5}]
    assert drop_low_confidence(rows, 60) == rows
    assert drop_low_confidence([], 50) == []
```

#### Uses
- [OCR: pages as pictures › What an OCR engine gives you](#/ocr/what-an-ocr-engine-gives-you)
- [OCR: pages as pictures › Reassembling text](#/ocr/reassembling-text)
- [Reference › Lists, dicts and sets](#/reference/lists-dicts-and-sets)
- [Reference › Shapes of the data](#/reference/shapes-of-the-data)

#### Hints
- A list comprehension with two conditions keeps the order for free.
- The two conditions: `conf` is at least `min_conf`, and `text.strip()` is not empty.

#### Tips
- The `-1` rows are structure, not words. The blank-text check drops them even if someone passes `min_conf=-1`.
- A comprehension builds a new list, so the caller's rows survive. That matters when you want to try two thresholds on the same page and compare.
- 60 is a starting threshold, not a setting. Too high and a genuinely faint scan loses real words; too low and smudges get embedded as if they were vocabulary. Print the confidences on a page you have read yourself before you pick a number.

#### Docs
- [Python tutorial: List comprehensions](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions)
- [Tesseract: TSV output](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html#tsv-output)

### 2. Reading order

`words_to_lines(words)` groups words into lines by `(block, par, line)`, orders lines in that order and words within a line by `left`, and returns each line as a single space-joined string. The input may arrive in any order.

```python starter
def words_to_lines(words):
    ...
```

```python test
def test_lines():
    """rebuilds lines in block, paragraph, line, left order"""
    words = [
        {"block": 2, "par": 1, "line": 1, "left": 470, "text": "accepted"},
        {"block": 1, "par": 1, "line": 2, "left": 118, "text": "warranty"},
        {"block": 1, "par": 1, "line": 1, "left": 139, "text": "product"},
        {"block": 2, "par": 1, "line": 1, "left": 400, "text": "Returns"},
        {"block": 1, "par": 1, "line": 1, "left": 72,  "text": "The"},
    ]
    assert words_to_lines(words) == ["The product", "warranty", "Returns accepted"]

def test_columns():
    """sorts by block before position, so columns do not interleave"""
    words = [
        {"block": 1, "par": 1, "line": 1, "left": 400, "text": "right"},
        {"block": 2, "par": 1, "line": 1, "left": 72,  "text": "left"},
        {"block": 1, "par": 1, "line": 1, "left": 480, "text": "column"},
        {"block": 2, "par": 1, "line": 1, "left": 130, "text": "column"},
    ]
    assert words_to_lines(words) == ["right column", "left column"]

def test_paragraphs():
    """a new paragraph starts a new line, even with the same line number"""
    words = [
        {"block": 1, "par": 2, "line": 1, "left": 72,  "text": "Second"},
        {"block": 1, "par": 1, "line": 2, "left": 72,  "text": "two"},
        {"block": 1, "par": 1, "line": 1, "left": 72,  "text": "one"},
        {"block": 1, "par": 1, "line": 1, "left": 150, "text": "line"},
    ]
    assert words_to_lines(words) == ["one line", "two", "Second"]

def test_edges():
    """no words give no lines, one word gives one line"""
    assert words_to_lines([]) == []
    assert words_to_lines([{"block": 3, "par": 1, "line": 4, "left": 10, "text": "alone"}]) == ["alone"]
```

#### Uses
- [OCR: pages as pictures › Reassembling text](#/ocr/reassembling-text)
- [OCR: pages as pictures › What an OCR engine gives you](#/ocr/what-an-ocr-engine-gives-you)

#### Hints
- Sort the words with a tuple key: `(block, par, line, left)`.
- Walk the sorted words and start a new line whenever `(block, par, line)` differs from the previous word's.
- `itertools.groupby` does that walk for you, as long as the list is already sorted by the same key.

#### Tips
- `groupby` only merges *adjacent* items with equal keys. That is why the sort has to come first.
- Sort with a tuple, not four passes. Tuples compare element by element, so `(block, par, line, left)` gets all four levels in one `sorted` call.
- `left` alone is the bug this ordering exists to prevent. Sorting a two-column page by horizontal position reads a line from column one, then a line from column two, and produces text that is grammatical nonsense with a perfect confidence score.

#### Docs
- [Python docs: `itertools.groupby`](https://docs.python.org/3/library/itertools.html#itertools.groupby)
- [Sorting HOWTO: Key functions](https://docs.python.org/3/howto/sorting.html#key-functions)

### 3. OCR only what needs it

`page_texts(pages, ocr)` takes the per-page result of the text layer (a string or `None`) and a function `ocr(index)` that recognises page `index`. Return one string per page, calling `ocr` only for pages whose text layer is blank. Pages with text are returned unchanged.

```python starter
def page_texts(pages, ocr):
    ...
```

```python test
def test_fallback():
    """calls ocr only for empty pages"""
    calls = []
    def fake_ocr(i):
        calls.append(i)
        return f"ocr page {i}"
    out = page_texts(["native", None, "  ", "also native"], fake_ocr)
    assert out == ["native", "ocr page 1", "ocr page 2", "also native"]
    assert calls == [1, 2]

def test_all_native():
    """never calls ocr when every page has text"""
    calls = []
    def fake_ocr(i):
        calls.append(i)
        return "ocr"
    assert page_texts(["a", "b"], fake_ocr) == ["a", "b"]
    assert page_texts([], fake_ocr) == []
    assert calls == []

def test_all_scanned():
    """passes each blank page's own index to ocr"""
    calls = []
    def fake_ocr(i):
        calls.append(i)
        return f"scan {i}"
    assert page_texts([None, "", " \n "], fake_ocr) == ["scan 0", "scan 1", "scan 2"]
    assert calls == [0, 1, 2]

def test_unchanged():
    """native text comes back exactly as it was"""
    assert page_texts(["  padded  ", "\tx\n"], lambda i: "ocr") == ["  padded  ", "\tx\n"]
```

#### Uses
- [OCR: pages as pictures › When to run it](#/ocr/when-to-run-it)
- [Documents to text › Pages come with their index](#/documents/pages-come-with-their-index)

#### Hints
- Use `enumerate(pages)` so you have the index to pass to `ocr`.
- A page needs OCR when `(text or "").strip()` is empty. Otherwise keep its text as it is.

#### Tips
- Return the native text unstripped. Cleaning is a later step; this function only decides which pages go to OCR.
- Pass the index, not the text. `ocr` has to go back to the page *image*, and the only thing connecting the two is the position in the list — which is exactly what `enumerate` hands you.
- The test asserting `calls == [1, 2]` is the whole point of the exercise. On a 900-page document where four pages are scans, calling OCR on every page is not a slow version of the right answer, it is a bill.

#### Docs
- [Python docs: `enumerate()`](https://docs.python.org/3/library/functions.html#enumerate)

### 4. How good was the scan?

`ocr_quality(words)` returns the mean `conf` of rows with a non-blank `text` and `conf >= 0`, as a float. With nothing to average, return `0.0`.

```python starter
def ocr_quality(words):
    ...
```

```python test
def test_mean():
    """averages confidence over real words, as a float"""
    assert abs(ocr_quality([{"conf": 90, "text": "a"}, {"conf": 70, "text": "b"}]) - 80.0) < 1e-9
    assert abs(ocr_quality([{"conf": 85, "text": "a"}, {"conf": 90, "text": "b"}]) - 87.5) < 1e-9
    assert abs(ocr_quality([{"conf": 0, "text": "x"}, {"conf": 60, "text": "y"}]) - 30.0) < 1e-9
    assert isinstance(ocr_quality([{"conf": 90, "text": "a"}]), float)

def test_skips():
    """skips blank text and conf below zero"""
    rows = [{"conf": 90, "text": "a"}, {"conf": 70, "text": "b"}, {"conf": -1, "text": ""}, {"conf": 50, "text": " "}]
    assert abs(ocr_quality(rows) - 80.0) < 1e-9
    assert abs(ocr_quality([{"conf": -1, "text": "word"}, {"conf": 40, "text": "a"}]) - 40.0) < 1e-9
    assert abs(ocr_quality([{"conf": 99, "text": "  "}, {"conf": 20, "text": "z"}]) - 20.0) < 1e-9

def test_nothing():
    """returns 0.0 with nothing to average"""
    assert ocr_quality([]) == 0.0
    assert ocr_quality([{"conf": -1, "text": ""}]) == 0.0
    assert ocr_quality([{"conf": 90, "text": "   "}]) == 0.0
```

#### Uses
- [OCR: pages as pictures › What an OCR engine gives you](#/ocr/what-an-ocr-engine-gives-you)
- [Reference › Standard library](#/reference/standard-library)

#### Hints
- Collect the `conf` of every row that passes both checks: non-blank text and `conf >= 0`.
- The mean is `sum(values) / len(values)`, but check for an empty list first.

#### Tips
- `statistics.fmean` does the division for you, but it raises on an empty list just like dividing by zero does.
- The `-1` rows are not low-confidence words, they are block and line headers. Averaging them in drags the number down for a reason that has nothing to do with the scan.
- Store this per document and watch it over time. A mean confidence that used to be 92 and is now 71 means somebody changed a scanner setting, and nobody is going to tell you — the number is the only notice you get.

#### Docs
- [Python docs: `statistics.fmean`](https://docs.python.org/3/library/statistics.html#statistics.fmean)
