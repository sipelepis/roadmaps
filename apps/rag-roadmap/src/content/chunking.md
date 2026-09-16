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

Because the window backs off to whitespace and every piece is stripped, the real overlap between two consecutive chunks is rarely exactly the configured number. Measure it rather than assume it: how many leading characters of this chunk does the previous chunk end with?

```
chunk_text("one two three four five six", size=10, overlap=4)
  → ["one two", "two three", "hree four", "four five", "five six"]

measured overlaps:  3, 4, 4, 4
```

The first pair shares three characters, not four, because the window cut at the space and `.strip()` removed it. `overlap` is a request, not a guarantee, and "the overlap is 200 so a 200-character sentence can never be orphaned" is off by one in the direction that loses the sentence. If a boundary case matters to you, measure the overlap you got rather than the one you configured.

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

def test_chunk_guard():
    """rejects overlap >= size and never loops on spaceless text"""
    for size, overlap in [(10, 10), (5, 8)]:
        try:
            chunk_text("abc", size, overlap)
        except ValueError:
            pass
        else:
            raise AssertionError(f"size {size} with overlap {overlap} must raise")
    assert chunk_text("x" * 50, 10, 3) != []

def test_known_output():
    """backs off to a space and steps back by the overlap"""
    assert chunk_text("aaaa bbbb cccc dddd", 10, 3) == ["aaaa bbbb", "bbb cccc", "ccc dddd"]
    assert chunk_text("one two three four five six", 10, 4) == ["one two", "two three", "hree four", "four five", "five six"]

def test_spaceless():
    """cuts full windows through text with no spaces"""
    assert chunk_text("x" * 25, 10, 3) == ["x" * 10, "x" * 10, "x" * 10, "xxxx"]
    assert chunk_text("y" * 10, 10, 2) == ["y" * 10]

def test_edges():
    """strips the text, and blank text gives no chunks"""
    assert chunk_text("", 100, 10) == []
    assert chunk_text("   \n  ", 100, 10) == []
    assert chunk_text("short", 100, 10) == ["short"]
    assert chunk_text("   hello world   ", 100, 10) == ["hello world"]
```

#### Uses
- [Chunking › The sliding window](#/chunking/the-sliding-window)
- [Reference › String methods](#/reference/string-methods)
- [Reference › Built-ins](#/reference/built-ins)

#### Hints
- Guard first: raise `ValueError` when `size <= overlap`, then strip the text.
- Each window ends at `min(start + size, len(text))`. If that is not the end of the text, look for a space with `rfind` between `start + size // 2` and the end, and cut there if it lies past `start`.
- After keeping the stripped piece, stop if you reached the end. Otherwise the next window starts at `max(end - overlap, start + 1)`.

#### Tips
- `rfind` returns `-1` when there is no space in range. `-1 > start` is false, so the window keeps its full width and cuts mid-word, which is the only way through a spaceless run.
- `max(end - overlap, start + 1)` is the infinite-loop guard, not a rounding detail. Without it, a configuration where the back-off lands at or before `start` makes the loop stand still and the tab hangs — in a browser, with no stack trace.
- Test the spaceless case first. Every hand-written chunker works on prose; base64 blobs, minified JSON and long German compounds are what break it, and they all turn up in real corpora.

#### Docs
- [Python docs: `str.rfind`](https://docs.python.org/3/library/stdtypes.html#str.rfind)

### 2. Measure the real overlap

`shared_prefix(previous, current, limit)` returns the largest `n <= limit` such that `previous` ends with the first `n` characters of `current`, or `0`. `n` can be no longer than either string.

```python starter
def shared_prefix(previous, current, limit):
    ...
```

```python test
def test_shared_prefix():
    """finds the shared boundary"""
    assert shared_prefix("the quick brown", "brown fox", 10) == 5
    assert shared_prefix("hello world", "world peace", 20) == 5
    assert shared_prefix("abc", "xyz", 3) == 0

def test_longest():
    """returns the longest match, not the shortest"""
    assert shared_prefix("xabab", "ababz", 10) == 4
    assert shared_prefix("aaaa", "aaab", 10) == 3

def test_limit():
    """never goes past the limit or the length of either string"""
    assert shared_prefix("aaaa", "aaaa", 2) == 2
    assert shared_prefix("the quick brown", "brown fox", 3) == 0
    assert shared_prefix("the end", "end", 10) == 3
    assert shared_prefix("ab", "abc", 5) == 2

def test_empty():
    """empty strings and a zero limit share nothing"""
    assert shared_prefix("", "abc", 3) == 0
    assert shared_prefix("abc", "", 3) == 0
    assert shared_prefix("abc", "abc", 0) == 0
```

#### Uses
- [Chunking › Measuring the overlap you actually got](#/chunking/measuring-the-overlap-you-actually-got)

#### Hints
- Try every `n` from the largest possible down to 1, and return the first one that fits.
- The largest possible `n` is capped by `limit` and by the length of both strings.
- One `n` fits when `previous.endswith(current[:n])`.

#### Tips
- Counting down means the first match is the largest, so you can return as soon as you find it.
- `limit` is what keeps this cheap. Without it you compare every possible length of two full chunks, which on 4000-character chunks is work you will notice.
- Run it over a real document after changing `size` or `overlap`. The measured overlap is the honest version of a setting you otherwise have to take on trust.

#### Docs
- [Python docs: `str.endswith`](https://docs.python.org/3/library/stdtypes.html#str.endswith)

### 3. Pack paragraphs

`chunk_paragraphs(text, size)` splits on blank lines and packs consecutive paragraphs, joined with `"\n\n"`, into chunks whose length does not exceed `size`. A paragraph longer than `size` on its own becomes its own chunk. Paragraphs are stripped, and empty ones are skipped.

```python starter
def chunk_paragraphs(text, size):
    ...
```

```python test
def test_paragraphs():
    """packs whole paragraphs up to the size"""
    assert chunk_paragraphs("aaa\n\nbbb\n\nccccccc", 8) == ["aaa\n\nbbb", "ccccccc"]
    assert chunk_paragraphs("one\n\ntwo\n\nthree", 100) == ["one\n\ntwo\n\nthree"]
    assert chunk_paragraphs("l1\nl2\n\np2", 5) == ["l1\nl2", "p2"]

def test_separator_counts():
    """the blank line between paragraphs counts toward the size"""
    assert chunk_paragraphs("aaa\n\nbbb", 8) == ["aaa\n\nbbb"]
    assert chunk_paragraphs("aaa\n\nbbb", 7) == ["aaa", "bbb"]
    assert chunk_paragraphs("ab\n\ncd", 5) == ["ab", "cd"]
    assert chunk_paragraphs("ab\n\ncd\n\nef", 6) == ["ab\n\ncd", "ef"]

def test_oversized():
    """a paragraph longer than size stands alone"""
    assert chunk_paragraphs("x" * 20, 5) == ["x" * 20]
    assert chunk_paragraphs("a\n\n" + "x" * 20 + "\n\nb", 5) == ["a", "x" * 20, "b"]

def test_blank_lines():
    """strips paragraphs and skips empty ones"""
    assert chunk_paragraphs("", 10) == []
    assert chunk_paragraphs("a\n\n\n\nb", 100) == ["a\n\nb"]
    assert chunk_paragraphs("  a  \n\n  b  ", 100) == ["a\n\nb"]
```

#### Uses
- [Chunking › Paragraph-aware chunking](#/chunking/paragraph-aware-chunking)
- [Cleaning extracted text › The usual suspects](#/cleaning/the-usual-suspects)

#### Hints
- Split on `"\n\n"`, strip each paragraph, and drop the empty ones.
- Keep a `current` chunk. For each paragraph, work out how long `current` would be with `"\n\n"` and the paragraph added. If that exceeds `size`, emit `current` and start again from the paragraph.
- Emit the last `current` after the loop, and don't put a separator in front of a chunk's first paragraph.

#### Tips
- An oversized paragraph needs no special case: it starts a fresh chunk, and nothing fits behind it.
- The `"\n\n"` between paragraphs counts toward `size`. Forget those two characters and every full chunk comes out one separator over the limit, which is the kind of bug a database column width finds for you later.
- Paragraph packing keeps sentences whole, which the sliding window cannot promise. Use it when the source has real paragraph breaks left in it, and fall back to the window when cleaning has flattened them.

#### Docs
- [Python docs: `str.split`](https://docs.python.org/3/library/stdtypes.html#str.split)
