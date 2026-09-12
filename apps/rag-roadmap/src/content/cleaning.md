# Cleaning extracted text

Text out of a PDF parser or an OCR engine is not the text a human wrote. It carries the artifacts of the page it was printed on, and every one of them becomes part of a chunk, gets embedded, and can be retrieved. Cleaning is cheap and it happens before chunking, so it pays for itself on every query.

## The usual suspects

**Hyphens at line ends.** A justified column breaks `agreement` into `agree-` and `ment` on the next line. Left alone, neither half is a word the embedding model knows.

```
agree-
ment          →   agreement
```

Only join when both sides are word characters. `well-known` stays, and a dash followed by a line break with a space around it is punctuation, not a broken word.

**Running headers and footers.** "ACME Corp · Confidential" at the top of every page and "Page 4 of 12" at the bottom. They are in every chunk from that document, they match every question about ACME, and they push real content out of the retrieved set. Detect them by their repetition: a line that appears on most pages of a document is furniture.

**Whitespace.** Multiple spaces where a column was aligned, tabs, and long runs of blank lines. Collapse runs of spaces to one and runs of blank lines to a single paragraph break; the paragraph breaks are worth keeping because chunkers use them.

**Unicode.** Ligatures such as `ﬁ` (one character) for `fi` (two), circled digits, full-width letters. `unicodedata.normalize("NFKC", text)` folds those to their plain equivalents so `ﬁnance` matches `finance`.

## What not to clean

Do not lowercase, do not strip punctuation, do not remove numbers. Embedding models handle all of that, and each one is information a citation or an exact-match search might need. Clean the artifacts of the medium, not the content.

## Order

Normalize unicode first, then dehyphenate, then strip repeated lines, then collapse whitespace. Whitespace last, because the other steps leave gaps behind.

```python playground
import re, unicodedata

pages = [
    "ACME Corp · Conﬁdential\n\nThe agree-\nment renews  automatically.\n\n\n\nPage 1 of 2",
    "ACME Corp · Conﬁdential\n\nEither party may cancel with thirty days notice.\n\nPage 2 of 2",
]

def normalize(t): return unicodedata.normalize("NFKC", t)
def dehyphenate(t): return re.sub(r"(\w)-\n(\w)", r"\1\2", t)
def collapse(t):
    t = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in t.split("\n"))
    return re.sub(r"\n{3,}", "\n\n", t).strip()

cleaned = [collapse(dehyphenate(normalize(p))) for p in pages]
for c in cleaned:
    print(repr(c))

# Try: count how many pages each line appears on, and drop the ones on every page.
```

## Exercises

### 1. Dehyphenate

`dehyphenate(text)` joins a word split by a hyphen at a line break. Only join when a word character sits on both sides of `-\n`.

```python starter
def dehyphenate(text):
    ...
```

```python test
def test_dehyphenate():
    """joins broken words and leaves real hyphens alone"""
    assert dehyphenate("agree-\nment") == "agreement"
    assert dehyphenate("well-known") == "well-known"
    assert dehyphenate("x -\ny") == "x -\ny"
    assert dehyphenate("re-\nceipt and deliv-\nery") == "receipt and delivery"
```

### 2. Collapse whitespace

`collapse_whitespace(text)`: runs of spaces or tabs become one space, every line is stripped, three or more consecutive newlines become two, and the result is stripped at both ends.

```python starter
def collapse_whitespace(text):
    ...
```

```python test
def test_collapse():
    """tidies spaces, tabs and blank runs"""
    assert collapse_whitespace("a  b\t c\n\n\n\nd ") == "a b c\n\nd"
    assert collapse_whitespace("  x  ") == "x"
    assert collapse_whitespace("p1\n\np2") == "p1\n\np2"
```

### 3. Strip running headers and footers

`strip_repeated_lines(pages, min_pages=2)` takes a list of page strings and removes any line (compared after stripping) that occurs on at least `min_pages` different pages. Other lines are kept in order. Return the list of cleaned page strings.

```python starter
def strip_repeated_lines(pages, min_pages=2):
    ...
```

```python test
def test_strip_repeated():
    """removes lines that repeat across pages"""
    pages = ["ACME Corp\nThe deal.\nPage 1", "ACME Corp\nThe terms.\nPage 2", "ACME Corp\nSignatures.\nPage 3"]
    assert strip_repeated_lines(pages) == ["The deal.\nPage 1", "The terms.\nPage 2", "Signatures.\nPage 3"]
    assert strip_repeated_lines(["one\nfoot", "two\nfoot"], min_pages=3) == ["one\nfoot", "two\nfoot"]
    assert strip_repeated_lines(["solo"]) == ["solo"]
```

### 4. Normalize unicode

`normalize_unicode(text)` applies NFKC normalization so ligatures and compatibility characters become their plain equivalents.

```python starter
def normalize_unicode(text):
    ...
```

```python test
def test_normalize():
    """folds ligatures and compatibility forms"""
    assert normalize_unicode("ﬁnance") == "finance"
    assert normalize_unicode("①") == "1"
    assert normalize_unicode("plain") == "plain"
```
