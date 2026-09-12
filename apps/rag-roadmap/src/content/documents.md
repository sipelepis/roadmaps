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
def test_decode():
    """valid utf-8 comes through, invalid bytes are replaced"""
    assert decode_bytes(b"caf\xc3\xa9") == "café"
    assert decode_bytes(b"caf\xe9") == "caf�"
    assert decode_bytes(b"") == ""
```

### 2. Join the pages

`extract_text(pages)` takes what a PDF parser returns per page, a string or `None`, and joins them with newlines. `None` becomes an empty string so page count is preserved.

```python starter
def extract_text(pages):
    ...
```

```python test
def test_extract():
    """joins pages with newlines, None as empty"""
    assert extract_text(["a", None, "b"]) == "a\n\nb"
    assert extract_text([None, None]) == "\n"
    assert extract_text([]) == ""
```

### 3. Is there a text layer?

`has_text_layer(pages)` is `True` only if at least one page contains something other than whitespace.

```python starter
def has_text_layer(pages):
    ...
```

```python test
def test_text_layer():
    """whitespace-only pages do not count"""
    assert has_text_layer(["  ", None]) is False
    assert has_text_layer(["", "x"]) is True
    assert has_text_layer([]) is False
    assert has_text_layer(["\n\n"]) is False
```

### 4. Check the upload

`check_upload(name, size, max_bytes)` raises `ValueError` when `size` exceeds `max_bytes`. Otherwise it returns `"pdf"` when the name ends in `.pdf` in any case, else `"text"`.

```python starter
def check_upload(name, size, max_bytes):
    ...
```

```python test
def test_check_upload():
    """routes by extension and rejects oversize files"""
    assert check_upload("Contract.PDF", 10, 100) == "pdf"
    assert check_upload("notes.md", 10, 100) == "text"
    assert check_upload("exact", 100, 100) == "text"
    try:
        check_upload("big.pdf", 101, 100)
    except ValueError:
        pass
    else:
        raise AssertionError("oversize upload must raise ValueError")
```
