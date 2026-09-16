# Structure & metadata

A chunk on its own is a passage with no idea where it came from. It cannot be cited, cannot be deleted with its document, and cannot be filtered. Every chunk needs to carry at least two things: which document it belongs to and where in that document it sits.

## Filename and ordinal

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

Two string methods do the whole of the markdown case. `str.startswith` answers "is this a heading line" without slicing, and `str.lstrip` strips the marker off the front:

```python
"# Termination".startswith("#")     # True
"### Deep  ".lstrip("#")            # ' Deep  '   → .strip() → 'Deep'
```

`lstrip` with an argument treats it as a *set of characters to remove*, not as a prefix string, so one call handles `#`, `##` and `###` with no counting. The same property is a trap elsewhere: `"handbook.pdf".lstrip("hand")` gives `'book.pdf'`, because it keeps eating leading `h`, `a`, `n` and `d` characters rather than removing the word once.

Carrying the heading forward is the other half. Keep it in a variable across the loop, and a chunk from the middle of a long section still knows which section it is in.

## Tables are atomic

Splitting every 512 characters means the scissors do not care whether they are cutting a sentence or slicing through a table. A table cut mid-row gives three numbers with no column headers, meaningless to an embedding model and to the model reading it later. Production chunkers treat a table as one unsplittable unit even when it exceeds the size limit, or serialise it to markdown so the structure survives as text.

## Pages for citations

When the source is a scan, "page 3" is the citation a reader can act on. Record where each page begins in the joined text, and any character offset maps back to a page number with a binary search.

`bisect.bisect_right(sorted_list, x)` answers "how many items are less than or equal to `x`", in log time rather than by scanning. Because page starts are sorted and the first is always `0`, that count *is* the 1-based page number:

```python
page_starts = [0, 100, 250]      # page 1 starts at 0, page 2 at 100, page 3 at 250

bisect_right(page_starts, 0)     # 1   the very first character is on page 1
bisect_right(page_starts, 99)    # 1   last character of page 1
bisect_right(page_starts, 100)   # 2   first character of page 2
bisect_right(page_starts, 150)   # 2
```

`bisect_left` is the sharp edge here. It answers `1` for an offset of exactly `100`, putting the first character of a page on the page before it — a citation that is right almost always and wrong exactly at every page break.

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
    assert attach_headings(["# A", "one", "two"]) == [("A", "one"), ("A", "two")]

def test_heading_text():
    """removes any number of #s and the whitespace around the title"""
    assert attach_headings(["### Deep  ", "x"]) == [("Deep", "x")]
    assert attach_headings(["#NoSpace", "y"]) == [("NoSpace", "y")]

def test_heading_lines():
    """heading lines are not emitted, and a new one replaces the old"""
    assert attach_headings(["# A", "# B", "text"]) == [("B", "text")]
    assert attach_headings(["# Only"]) == []

def test_no_heading():
    """lines before any heading get an empty heading"""
    assert attach_headings(["a", "b"]) == [("", "a"), ("", "b")]
    assert attach_headings([]) == []
```

#### Uses
- [Structure & metadata › Headings as breadcrumbs](#/metadata/headings-as-breadcrumbs)

#### Hints
- Keep a `heading` variable that starts as `""`, and walk the lines in order.
- A line starting with `#` updates `heading` and is not emitted. Any other line is emitted as `(heading, line)`.
- `line.lstrip("#").strip()` removes the hashes and the space after them.

#### Tips
- `lstrip("#")` treats its argument as a set of characters, so it removes any number of `#`s. That covers `##` and `###` with no extra code.
- That same behaviour bites when the argument is a word: `"handbook.pdf".lstrip("hand")` gives `'book.pdf'`. Reach for it to strip markers, never to strip a prefix.
- The heading line itself is not emitted. It rides on the lines under it, which is the point — a chunk from the middle of a section carries the section's name into its own embedding.

#### Docs
- [Python docs: `str.lstrip`](https://docs.python.org/3/library/stdtypes.html#str.lstrip)
- [Python docs: `str.startswith`](https://docs.python.org/3/library/stdtypes.html#str.startswith)

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
    assert with_metadata(["only"], "notes.md") == [{"filename": "notes.md", "ordinal": 0, "text": "only"}]

def test_ordinals():
    """ordinals count up from 0 in chunk order, even for repeated text"""
    out = with_metadata(["x", "y", "x"], "f.txt")
    assert [c["ordinal"] for c in out] == [0, 1, 2]
    assert [c["text"] for c in out] == ["x", "y", "x"]

def test_empty():
    """no chunks give no rows"""
    assert with_metadata([], "x") == []
```

#### Uses
- [Structure & metadata › Filename and ordinal](#/metadata/filename-and-ordinal)
- [Documents to text › The filename is not just a label](#/documents/the-filename-is-not-just-a-label)
- [Documents to text › Pages come with their index](#/documents/pages-come-with-their-index)
- [Reference › Shapes of the data](#/reference/shapes-of-the-data)

#### Hints
- `enumerate(chunks)` gives you the ordinal and the text together, starting at 0.
- Build one dict per chunk with the three keys. A list comprehension does it in one line.

#### Tips
- `ordinal` is the position *within its document*, not a global id. Two documents both have an ordinal 0, so a citation needs the filename as well — neither half identifies a chunk on its own.
- Start at 0 here and at 1 in the prompt. The ordinal is a list position; a citation marker is something a human reads. Mixing the two conventions is how `[0]` ends up in an answer.
- Attach the metadata at ingest, in the same pass that made the chunks. Recovering an ordinal later means re-chunking, and re-chunking with a different size gives different chunks.

#### Docs
- [Python docs: `enumerate()`](https://docs.python.org/3/library/functions.html#enumerate)

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
    assert page_of(150, starts) == 2
    assert page_of(300, starts) == 3

def test_page_starts():
    """an offset exactly at a page start belongs to that page"""
    assert page_of(100, [0, 100, 250]) == 2
    assert page_of(250, [0, 100, 250]) == 3
    assert page_of(30, [0, 10, 20, 30]) == 4

def test_other_layouts():
    """works for one page and for uneven pages"""
    assert page_of(5, [0]) == 1
    assert page_of(10_000, [0]) == 1
    starts = [0, 5, 6, 40]
    assert page_of(5, starts) == 2
    assert page_of(39, starts) == 3
    assert page_of(1_000, starts) == 4
```

#### Uses
- [Structure & metadata › Pages for citations](#/metadata/pages-for-citations)
- [Reference › Standard library](#/reference/standard-library)

#### Hints
- The page containing `offset` is the last one whose start is `<= offset`.
- Counting the starts that are `<= offset` gives the 1-based page number directly. A loop works.
- `bisect.bisect_right(page_starts, offset)` counts the same thing with a binary search.

#### Tips
- `bisect_right`, not `bisect_left`: an offset exactly at a page start belongs to that page, not the one before. `bisect_left` is right everywhere except at page boundaries, which is the worst place for a citation to be wrong and the hardest to notice in a spot check.
- A plain loop counting the starts `<= offset` gives the same answer and is easier to read. Reach for bisect when you map every chunk of a thousand-page scan, not before.
- `page_starts` has to be built from the *same* joined text the offsets came from. Join the pages, clean, then chunk, and every offset moves — record the starts after the join that the offsets will be measured against.

#### Docs
- [Python docs: `bisect.bisect_right`](https://docs.python.org/3/library/bisect.html#bisect.bisect_right)
