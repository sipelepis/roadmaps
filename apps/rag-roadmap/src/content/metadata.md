# Structure & metadata

A chunk on its own is a passage with no idea where it came from. It cannot be cited, cannot be deleted with its document, and cannot be filtered. Every chunk needs to carry at least two things: which document it belongs to and where in that document it sits.

```python
{"filename": "handbook.pdf", "ordinal": 7, "text": "Employees accrue 1.5 days…"}
```

`ordinal` is the chunk's index within its document. It is the only reason you can tell chunk 0 from chunk 7 in a citation, and it leaves the door open for a useful trick: fetching the neighbours of a matched chunk to widen context before prompting.

## Headings as breadcrumbs

The sliding window has no idea what a section is. A chunk from the middle of "Section 4.2: Termination" reads as a bare paragraph about notice periods. Prepend the heading it fell under and the chunk knows what it is about, the embedding sharpens, and the citation can say where it came from.

```
# Termination
Either party may cancel…      →   heading: "Termination", text: "Either party may cancel…"
```

The heading detector is simple for markdown and for OCR output with a consistent layout: a line that starts with `#`, or a short line in a larger font. Carry the most recent heading forward until the next one.

## Tables are atomic

Splitting every 512 characters means the scissors do not care whether they are cutting a sentence or slicing through a table. A table cut mid-row gives three numbers with no column headers, meaningless to an embedding model and to the model reading it later. Production chunkers treat a table as one unsplittable unit even when it exceeds the size limit, or serialise it to markdown so the structure survives as text.

## Pages for citations

When the source is a scan, "page 3" is the citation a reader can act on. Record where each page begins in the joined text, and any character offset maps back to a page number with a binary search.

## Filters are non-negotiable at scale

With a thousand documents, pure vector similarity is fine. With ten million, everything looks vaguely similar to everything else, and you need hard filters on top: only documents after 2024, only ones tagged public, only this user's. That is metadata on the chunk, queried by a relational database before any vector is compared. The production module comes back to this.

```python playground
from bisect import bisect_right

pages = ["Terms of service\n\nThe agreement renews yearly.", "Cancellation\n\nEither party may cancel with notice."]
page_starts, text, pos = [], "", 0
for p in pages:
    page_starts.append(pos)
    text += p + "\n"
    pos += len(p) + 1

def page_of(offset):
    return bisect_right(page_starts, offset)

for needle in ["renews", "cancel"]:
    at = text.index(needle)
    print(f"{needle!r} is at offset {at}, page {page_of(at)}")

# Try: add a third page and locate a word on it.
```

## Exercises

### 1. Attach headings

`attach_headings(lines)` walks a list of lines. A line starting with `#` sets the current heading (with the `#`s and surrounding whitespace removed) and is not emitted. Every other line is emitted as a `(heading, line)` tuple. Before any heading, the heading is `""`.

```python starter
def attach_headings(lines):
    ...
```

```python test
def test_headings():
    """carries the latest heading forward"""
    lines = ["intro", "# Terms", "renews yearly", "## Cancellation", "with notice"]
    assert attach_headings(lines) == [("", "intro"), ("Terms", "renews yearly"), ("Cancellation", "with notice")]
    assert attach_headings([]) == []
```

### 2. Chunks with metadata

`with_metadata(chunks, filename)` turns a list of chunk strings into dicts with `filename`, `ordinal` (starting at 0) and `text`.

```python starter
def with_metadata(chunks, filename):
    ...
```

```python test
def test_metadata():
    """adds filename and ordinal"""
    out = with_metadata(["a", "b"], "doc.pdf")
    assert out == [{"filename": "doc.pdf", "ordinal": 0, "text": "a"}, {"filename": "doc.pdf", "ordinal": 1, "text": "b"}]
    assert with_metadata([], "x") == []
```

### 3. Which page?

`page_of(offset, page_starts)` returns the 1-based page number containing character `offset`, given the sorted offsets at which each page begins. `page_starts[0]` is always `0`.

```python starter
def page_of(offset, page_starts):
    ...
```

```python test
def test_page_of():
    """maps offsets to pages"""
    starts = [0, 100, 250]
    assert page_of(0, starts) == 1
    assert page_of(99, starts) == 1
    assert page_of(100, starts) == 2
    assert page_of(300, starts) == 3
    assert page_of(5, [0]) == 1
```
