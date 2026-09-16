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
def test_joins():
    """joins words broken across a line"""
    assert dehyphenate("agree-\nment") == "agreement"
    assert dehyphenate("re-\nceipt and deliv-\nery") == "receipt and delivery"
    assert dehyphenate("x2-\ny") == "x2y"

def test_real_hyphens():
    """leaves real hyphens and plain line breaks alone"""
    assert dehyphenate("well-known") == "well-known"
    assert dehyphenate("state-of-the-art\nwork") == "state-of-the-art\nwork"
    assert dehyphenate("one\ntwo") == "one\ntwo"

def test_needs_word_both_sides():
    """only joins with a word character on both sides"""
    assert dehyphenate("x -\ny") == "x -\ny"
    assert dehyphenate("x-\n y") == "x-\n y"
    assert dehyphenate("end-\n") == "end-\n"
    assert dehyphenate("a-\n\nb") == "a-\n\nb"
```

#### Uses
- [Cleaning extracted text › The usual suspects](#/cleaning/the-usual-suspects)

#### Hints
- This is a job for `re.sub`: match a word character, `-`, a newline, and another word character.
- Capture the two word characters in groups and put them back without the `-\n` between them: `r"\1\2"`.

#### Tips
- `\w` matches letters, digits and `_`. In `x -\ny` the character before the dash is a space, so it is left alone.
- Run this before chunking. Once `agree-` and `ment` are in different chunks, no regex will ever join them again.
- It will occasionally be wrong. A genuine compound that happened to break at its own hyphen — `cost-\neffective` — comes out as `costeffective`. That trade is worth making, but know you are making it.

#### Docs
- [Python docs: `re.sub`](https://docs.python.org/3/library/re.html#re.sub)

### 2. Collapse whitespace

`collapse_whitespace(text)`: runs of spaces or tabs become one space, every line is stripped, three or more consecutive newlines become two, and the result is stripped at both ends.

```python starter
def collapse_whitespace(text):
    ...
```

```python test
def test_spaces():
    """runs of spaces and tabs become one space"""
    assert collapse_whitespace("a  b\t c") == "a b c"
    assert collapse_whitespace("x\t\ty") == "x y"
    assert collapse_whitespace("one two") == "one two"

def test_strips():
    """strips every line and both ends"""
    assert collapse_whitespace("  x  ") == "x"
    assert collapse_whitespace(" a \n b ") == "a\nb"
    assert collapse_whitespace("\n\nhi\n\n") == "hi"

def test_blank_runs():
    """keeps line breaks, and shrinks any run of blank lines to one"""
    assert collapse_whitespace("a  b\t c\n\n\n\nd ") == "a b c\n\nd"
    assert collapse_whitespace("p1\n\np2") == "p1\n\np2"
    assert collapse_whitespace("a\nb") == "a\nb"
    assert collapse_whitespace("p1\n   \n\t\np2") == "p1\n\np2"
    assert collapse_whitespace("a\nb\n\n\n\nc") == "a\nb\n\nc"
```

#### Uses
- [Cleaning extracted text › The usual suspects](#/cleaning/the-usual-suspects)
- [Cleaning extracted text › Order](#/cleaning/order)

#### Hints
- Work line by line: split on `"\n"`, tidy each line, join back with `"\n"`.
- On each line, replace `[ \t]+` with one space, then strip the line.
- After joining, a regex with `{3,}` turns long runs of newlines into exactly two. Strip the ends last.

#### Tips
- Strip the lines before collapsing newlines. A line holding only spaces would otherwise break up the run of `\n`s.
- `[ \t]+`, never `\s+`. `\s` includes `\n`, so the lazy version flattens the whole document to one line and takes every paragraph break with it — and paragraph breaks are what the chunker cuts on.
- The order in the article is not a style preference. Whitespace goes last because dehyphenation and header stripping both leave gaps behind that this step is there to close.

#### Docs
- [Python docs: `re.sub`](https://docs.python.org/3/library/re.html#re.sub)
- [Python docs: Regular expression syntax](https://docs.python.org/3/library/re.html#regular-expression-syntax)

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

def test_min_pages():
    """a line must be on at least min_pages pages to go"""
    assert strip_repeated_lines(["one\nfoot", "two\nfoot"], min_pages=3) == ["one\nfoot", "two\nfoot"]
    assert strip_repeated_lines(["a\nfoot", "b\nfoot", "c"]) == ["a", "b", "c"]
    pages = ["hdr\nx\n1", "hdr\nx\n2", "hdr\n3"]
    assert strip_repeated_lines(pages, min_pages=3) == ["x\n1", "x\n2", "3"]

def test_counts_pages():
    """counts pages rather than occurrences, and compares stripped lines"""
    assert strip_repeated_lines(["dup\ndup\nbody", "other"]) == ["dup\ndup\nbody", "other"]
    assert strip_repeated_lines(["  ACME  \nA", "ACME\nB"]) == ["A", "B"]
    assert strip_repeated_lines(["solo"]) == ["solo"]
```

#### Uses
- [Cleaning extracted text › The usual suspects](#/cleaning/the-usual-suspects)
- [Reference › Standard library](#/reference/standard-library)

#### Hints
- First pass: for each page, take the *set* of its stripped lines, and count how many pages each line appears on.
- Second pass: rebuild each page from the lines whose count is below `min_pages`, joined with `"\n"`.
- The set per page matters. A line printed twice on one page is still on only one page.

#### Tips
- "Page 1" and "Page 2" are different strings, so exact matching keeps page numbers. Catching those needs a pattern such as `Page \d+`.
- Two-page documents are the trap. With `min_pages=2`, any line appearing on both pages goes — including a real heading that happens to repeat. Scale the threshold with the page count rather than hard-coding 2.
- Count *pages*, not occurrences. A line printed three times on one page is still furniture on only one page, and counting occurrences deletes it from a document it never repeated across.

#### Docs
- [Python docs: `collections.Counter`](https://docs.python.org/3/library/collections.html#collections.Counter)
- [Python docs: `str.splitlines`](https://docs.python.org/3/library/stdtypes.html#str.splitlines)

### 4. Normalize unicode

`normalize_unicode(text)` applies NFKC normalization so ligatures and compatibility characters become their plain equivalents.

```python starter
def normalize_unicode(text):
    ...
```

```python test
def test_ligatures():
    """folds ligatures into plain letters"""
    assert normalize_unicode("ﬁnance") == "finance"
    assert normalize_unicode("ﬂow") == "flow"
    assert normalize_unicode("eﬀort") == "effort"

def test_compatibility():
    """folds circled, full-width and superscript forms"""
    assert normalize_unicode("①") == "1"
    assert normalize_unicode("Ｈｅｌｌｏ") == "Hello"
    assert normalize_unicode("x²") == "x2"

def test_plain():
    """leaves ordinary text as it is"""
    assert normalize_unicode("plain") == "plain"
    assert normalize_unicode("Mixed Case, 42!") == "Mixed Case, 42!"
    assert normalize_unicode("café") == "café"
```

#### Uses
- [Cleaning extracted text › The usual suspects](#/cleaning/the-usual-suspects)

#### Hints
- The `unicodedata` module is in the standard library. Import it.
- `unicodedata.normalize(form, text)`, with the form `"NFKC"`.

#### Tips
- NFKC is lossy on purpose: `²` becomes `2`. Right for text you search, wrong for text you need to show exactly as written.
- Normalize first, before any regex or length check. `ﬁ` is one character, so `len` and `\w` both see something different from `fi` until this step has run.
- If you keep the original text for display, keep it *before* this step and index the normalised copy. Trying to reverse NFKC later is not a thing you can do.

#### Docs
- [Python docs: `unicodedata.normalize`](https://docs.python.org/3/library/unicodedata.html#unicodedata.normalize)
