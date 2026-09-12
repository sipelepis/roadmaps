# Chunking

Retrieval returns whole units. If a unit is an entire 80-page PDF, then "relevant" means "this PDF is roughly on topic", which is useless. If a unit is one sentence, you get a precise match with none of the surrounding context needed to understand it. Chunk size is the dial between those two failures.

```
small chunks (~200 chars)   sharp matches, but answers lose context
large chunks (~4000 chars)  full context, but the match is diluted
                            by everything else in the chunk
```

1200 characters with 200 of overlap, roughly a long paragraph, is a reasonable starting point for prose. Not a law. Dense reference material wants smaller; narrative wants larger.

## The sliding window

This is the whole chunker from a working system. Plain string slicing, no tokenizer, no dependency.

```python
def chunk_text(text, size, overlap):
    if size <= overlap:
        raise ValueError("chunk size must exceed overlap")
    text = text.strip()
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(" ", start + size // 2, end)
            if space > start:
                end = space
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)   # max() guarantees forward progress
    return chunks
```

Three decisions live in there.

**Back off to whitespace.** A window that ends mid-word produces a chunk ending in `the agreem`, which embeds as something slightly wrong. The `rfind` searches backwards for a space, but only within the second half of the window, so a stretch of text with no spaces at all still makes progress instead of collapsing into tiny chunks.

**Overlap.** Each chunk starts a fixed distance back from where the last one ended, so a sentence unlucky enough to straddle a boundary appears whole in one of the two. Without it, the answer to a question can be split across two chunks such that neither one retrieves. You pay in storage and a little duplication in results. Cheap insurance.

**The `max()`.** If `overlap` ever equalled `size`, `end - overlap` would return to where the loop started and it would spin forever. The guard makes that impossible, and the constructor rejects the configuration outright.

## Measuring the overlap you actually got

Because the window backs off to whitespace, the real overlap between two consecutive chunks is never exactly the configured number. Measure it rather than assume it: how many leading characters of this chunk does the previous chunk end with?

## Paragraph-aware chunking

Prose has natural boundaries. A chunker that packs whole paragraphs until the next one would overflow the size keeps sentences intact and section breaks meaningful. A single paragraph larger than the size becomes its own chunk; splitting it is the sliding window's job.

## What to try when answers are bad

Change the chunk size, re-ingest, ask the same question again, and watch the similarity scores. If the right passage climbs the ranking, the chunk size was the problem. Re-ingesting is required because embeddings are computed per chunk at ingest time; changing the size changes every vector.

```python playground
def chunk_text(text, size, overlap):
    if size <= overlap:
        raise ValueError("chunk size must exceed overlap")
    text = text.strip()
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(" ", start + size // 2, end)
            if space > start:
                end = space
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks

text = ("The product ships with a two year warranty covering defects in materials and workmanship. "
        "Returns are accepted within thirty days of delivery with the original receipt. "
        "Refunds are issued to the original payment method within ten business days.")

for size, overlap in [(80, 20), (120, 30), (300, 0)]:
    pieces = chunk_text(text, size, overlap)
    print(f"size {size}, overlap {overlap} → {len(pieces)} chunks")
    for p in pieces:
        print("   ", repr(p))

# Try: size 40, overlap 39. Then size 40, overlap 40.
```

## Exercises

### 1. The sliding window

Implement `chunk_text(text, size, overlap)` as described: strip the text, back off to the last space in the second half of the window, strip each piece, skip empty pieces, and raise `ValueError` when `size <= overlap`.

```python starter
def chunk_text(text, size, overlap):
    ...
```

```python test
def test_chunk_text():
    """splits, respects size, never splits words, covers everything"""
    body = " ".join(f"word{i}" for i in range(400))
    pieces = chunk_text(body, 200, 40)
    assert len(pieces) > 1
    assert all(len(p) <= 200 for p in pieces)
    assert all(p == p.strip() for p in pieces)
    assert all(not p.endswith("wor") and not p.startswith("rd") for p in pieces)
    joined = " ".join(pieces)
    assert "word0 " in joined and "word399" in joined
    assert chunk_text("", 100, 10) == []
    assert chunk_text("short", 100, 10) == ["short"]

def test_chunk_guard():
    """rejects overlap >= size and never loops on spaceless text"""
    try:
        chunk_text("abc", 10, 10)
    except ValueError:
        pass
    else:
        raise AssertionError("size <= overlap must raise")
    assert chunk_text("x" * 50, 10, 3) != []
```

### 2. Measure the real overlap

`shared_prefix(previous, current, limit)` returns the largest `n <= limit` such that `previous` ends with the first `n` characters of `current`, or `0`.

```python starter
def shared_prefix(previous, current, limit):
    ...
```

```python test
def test_shared_prefix():
    """finds the longest shared boundary up to the limit"""
    assert shared_prefix("the quick brown", "brown fox", 10) == 5
    assert shared_prefix("abc", "xyz", 3) == 0
    assert shared_prefix("aaaa", "aaaa", 2) == 2
    assert shared_prefix("", "abc", 3) == 0
```

### 3. Pack paragraphs

`chunk_paragraphs(text, size)` splits on blank lines and packs consecutive paragraphs, joined with `"\n\n"`, into chunks whose length does not exceed `size`. A paragraph longer than `size` on its own becomes its own chunk.

```python starter
def chunk_paragraphs(text, size):
    ...
```

```python test
def test_paragraphs():
    """packs whole paragraphs up to the size"""
    assert chunk_paragraphs("aaa\n\nbbb\n\nccccccc", 8) == ["aaa\n\nbbb", "ccccccc"]
    assert chunk_paragraphs("x" * 20, 5) == ["x" * 20]
    assert chunk_paragraphs("one\n\ntwo\n\nthree", 100) == ["one\n\ntwo\n\nthree"]
    assert chunk_paragraphs("", 10) == []
```
