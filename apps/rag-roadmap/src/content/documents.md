# Documents to text

Embeddings are computed over strings, so every format has to collapse to one first. In a small system the rule is short enough to read in one go: if the name ends in `.pdf`, walk the pages and concatenate what the parser finds; otherwise decode the bytes as UTF-8 and replace anything that isn't.

```python
if name.lower().endswith(".pdf"):
    text = "\n".join(p.extract_text() or "" for p in PdfReader(BytesIO(raw)).pages)
else:
    text = raw.decode("utf-8", errors="replace")
if not text.strip():
    raise HTTPException(422, "No extractable text in that file")
```

## The text layer

A PDF is not text. It is a set of drawing instructions, and *sometimes* those instructions include the characters they draw, positioned on the page. That is the text layer, and `extract_text()` reads it. A PDF exported from a word processor has one. A PDF produced by a scanner is a photograph of each page with no text layer at all, and `extract_text()` returns an empty string for every page.

The guard at the bottom is the difference between an obvious error at upload and a mysteriously useless corpus a week later. Note it checks `text.strip()`, not `text`: a PDF that yields nothing but newlines is just as empty.

## Where this fails, and it does fail

- **Scanned pages** have no text layer. Fixing that means OCR, which is the next module.
- **Multi-column layouts** extract fine but arrive in the reading order the parser guessed. A table can come out interleaved with the paragraph beside it.
- **Wrong encoding.** A file that is really Latin-1 decoded as UTF-8 raises by default. `errors="replace"` turns that into a few replacement characters instead of a failed upload, and the rest of the document indexes normally.

## The filename is not just a label

Every chunk carries its document's filename into the prompt so the model can cite *which* source said the thing. Name a snippet `untitled` and citations become useless to a reader even though retrieval works exactly as well.

## Pages come with their index

The other half of a citation is *where* in the document. A page's position is not stored anywhere in the page's text — it is the position in the list, so every pass over the pages has to carry the index along with the text. `enumerate` does that in one loop instead of a counter you increment by hand and forget once.

```python
for i, page in enumerate(pages):
    print(i, page)          # 0 first, matching pages[0]
```

A second argument moves the counter's start, which is how a zero-based list becomes a one-based label:

```python
list(enumerate(["front", "terms"]))      # [(0, 'front'), (1, 'terms')]   list positions
list(enumerate(["front", "terms"], 1))   # [(1, 'front'), (2, 'terms')]   what a reader calls them
```

Both forms show up all the way down the pipeline: `enumerate(chunks)` for the ordinal stored on a chunk, `enumerate(sources, 1)` for the `[1]`, `[2]` markers in a prompt, `enumerate(ranking, 1)` for the rank of a search result. Pick the wrong start and nothing errors — the citation is just off by one, forever.

## Caps

A public ingest endpoint with no accounts needs two ceilings: bytes per upload and characters per document. Both exist to cap what one visitor can cost you in embedding calls and storage. Check the size before doing anything else with the bytes.

```python playground
raw_ok = "Ingest reads the whole file into memory.".encode("utf-8")
raw_latin1 = "café".encode("latin-1")

print(raw_ok.decode("utf-8", errors="replace"))
print(raw_latin1.decode("utf-8", errors="replace"))   # one replacement character, no crash

# What a PDF parser hands back, page by page. None and "" both mean "nothing here".
pages = ["Page one has a text layer.", None, "   \n  ", "Page four too."]
text = "\n".join(p or "" for p in pages)
print(repr(text))
print("has text layer:", bool(text.strip()))

# Try: make every page None and watch the guard fire.
```

## Exercises

### 1. Decode without crashing

`decode_bytes(raw)` decodes UTF-8 and substitutes the replacement character for anything invalid rather than raising.

```python starter
def decode_bytes(raw):
    ...
```

```python test
def test_valid():
    """valid UTF-8 comes through unchanged"""
    assert decode_bytes(b"caf\xc3\xa9") == "café"
    assert decode_bytes("naïve – 42".encode("utf-8")) == "naïve – 42"
    assert decode_bytes(b"") == ""

def test_invalid():
    """invalid bytes become the replacement character"""
    assert decode_bytes(b"caf\xe9") == "caf�"
    assert decode_bytes(b"\xff\xfeabc") == "��abc"

def test_keeps_the_rest():
    """a bad byte does not cost the text around it"""
    assert decode_bytes(b"a\x80b\x80c") == "a�b�c"
    assert decode_bytes("café".encode("latin-1") + b" menu") == "caf� menu"
```

#### Uses
- [Documents to text › Where this fails, and it does fail](#/documents/where-this-fails-and-it-does-fail)
- [Reference › Standard library](#/reference/standard-library)

#### Hints
- `bytes` has a `.decode()` method that takes the encoding name.
- Its `errors` argument decides what happens to invalid bytes. The default raises; you want the one that substitutes `�`.

#### Tips
- `errors="ignore"` also avoids the crash, but it silently deletes characters. `"replace"` leaves a visible mark where the damage was.
- Decode once, at the edge, and work in `str` from there. Bytes that sneak further in get decoded twice or not at all, and that is where mojibake comes from.
- The `�` characters are worth counting. A document that comes back full of them was not really UTF-8, and the right fix is to detect the encoding at upload, not to clean up afterwards.

#### Docs
- [Python docs: `bytes.decode`](https://docs.python.org/3/library/stdtypes.html#bytes.decode)
- [Python docs: Error handlers](https://docs.python.org/3/library/codecs.html#error-handlers)

### 2. Join the pages

`extract_text(pages)` takes what a PDF parser returns per page, a string or `None`, and joins them with newlines. `None` becomes an empty string so page count is preserved.

```python starter
def extract_text(pages):
    ...
```

```python test
def test_join():
    """joins pages with newlines"""
    assert extract_text(["a", "b"]) == "a\nb"
    assert extract_text(["one", "two", "three"]) == "one\ntwo\nthree"
    assert extract_text(["only"]) == "only"

def test_none_pages():
    """None becomes an empty page, so page count is kept"""
    assert extract_text(["a", None, "b"]) == "a\n\nb"
    assert extract_text([None, None]) == "\n"
    assert extract_text([None, "x"]) == "\nx"

def test_as_is():
    """page text is not altered, and no pages give an empty string"""
    assert extract_text([" a ", "b "]) == " a \nb "
    assert extract_text([]) == ""
```

#### Uses
- [Documents to text › The text layer](#/documents/the-text-layer)

#### Hints
- `"\n".join(...)` joins a list of strings, but it fails on `None`.
- Turn each page into a string first: `p or ""` gives `""` for `None`.

#### Tips
- Don't drop the `None` pages. Keeping one entry per page is what lets you map text back to page numbers later.
- `"\n".join` raises `TypeError` the moment one page is `None`, which is why `p or ""` goes inside the generator rather than in a cleanup pass afterwards.
- The newline between two pages is a seam. A word hyphenated across a page break only rejoins if you clean *after* joining — clean each page separately and the two halves never meet.

#### Docs
- [Python docs: `str.join`](https://docs.python.org/3/library/stdtypes.html#str.join)

### 3. Is there a text layer?

`has_text_layer(pages)` is `True` only if at least one page contains something other than whitespace.

```python starter
def has_text_layer(pages):
    ...
```

```python test
def test_blank_pages():
    """whitespace-only and None pages do not count"""
    assert has_text_layer(["  ", None]) is False
    assert has_text_layer(["\n\n"]) is False
    assert has_text_layer([" \t\n", "", None]) is False

def test_one_page_is_enough():
    """one page with text is enough"""
    assert has_text_layer(["  ", "x"]) is True
    assert has_text_layer([None, None, "  a  "]) is True
    assert has_text_layer(["text"]) is True

def test_no_pages():
    """no pages means no text layer"""
    assert has_text_layer([]) is False
```

#### Uses
- [Documents to text › The text layer](#/documents/the-text-layer)

#### Hints
- `.strip()` of a whitespace-only string is `""`, which is falsy.
- `None` has no `.strip()`, so write `(p or "").strip()`.
- `any(...)` over the pages is `False` for an empty list, which is what the last case wants.

#### Tips
- `any` stops at the first true item, so a 400-page scan with text on page one costs one check, not four hundred.
- This one boolean decides whether the document goes to OCR or straight through. Getting it wrong in the cheap direction — calling a page blank when it has text — costs money; getting it wrong the other way indexes an empty document that answers nothing and reports no error.

#### Docs
- [Python docs: `str.strip`](https://docs.python.org/3/library/stdtypes.html#str.strip)
- [Python docs: `any()`](https://docs.python.org/3/library/functions.html#any)

### 4. Check the upload

`check_upload(name, size, max_bytes)` raises `ValueError` when `size` exceeds `max_bytes`. Otherwise it returns `"pdf"` when the name ends in `.pdf` in any case, else `"text"`.

```python starter
def check_upload(name, size, max_bytes):
    ...
```

```python test
def test_routes_by_extension():
    """.pdf in any case is a pdf, anything else is text"""
    assert check_upload("Contract.PDF", 10, 100) == "pdf"
    assert check_upload("scan.Pdf", 10, 100) == "pdf"
    assert check_upload("report.pdf", 10, 100) == "pdf"
    assert check_upload("notes.md", 10, 100) == "text"
    assert check_upload("report.pdf.txt", 10, 100) == "text"
    assert check_upload("pdf", 10, 100) == "text"

def test_size_limit():
    """a file of exactly max_bytes is allowed"""
    assert check_upload("exact", 100, 100) == "text"
    assert check_upload("exact.pdf", 100, 100) == "pdf"
    assert check_upload("empty.txt", 0, 0) == "text"

def test_oversize():
    """anything over max_bytes raises ValueError"""
    for name, size, max_bytes in [("big.pdf", 101, 100), ("notes.txt", 2, 1), ("huge.md", 10_000_001, 10_000_000)]:
        try:
            check_upload(name, size, max_bytes)
        except ValueError:
            pass
        else:
            raise AssertionError(f"{name} at {size} bytes must raise ValueError")
```

#### Uses
- [Documents to text › Caps](#/documents/caps)

#### Hints
- Check the size first and `raise ValueError(...)` before looking at the name.
- "Exceeds" means strictly greater: a file of exactly `max_bytes` is allowed.
- Lowercase the name before calling `.endswith(".pdf")`, so `Contract.PDF` counts.

#### Tips
- Check the size before you touch the bytes. A limit enforced after reading the file into memory is not a limit.
- Filenames come from users, so nothing about their case is reliable. `.lower()` first, always — and `"report.pdf.txt"` is a text file, which is exactly what `.endswith` gets right and a substring search gets wrong.
- The extension is a hint, not proof. A `.pdf` that is really a JPEG will still fail in the parser; this check routes, it does not validate.

#### Docs
- [Python docs: `str.endswith`](https://docs.python.org/3/library/stdtypes.html#str.endswith)
- [Python docs: `ValueError`](https://docs.python.org/3/library/exceptions.html#ValueError)
