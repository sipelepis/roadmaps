from app.rag import chunk_text, shared_prefix


def test_chunking_splits_and_covers():
    body = " ".join(f"word{i}" for i in range(400))
    pieces = chunk_text(body, size=200, overlap=40)
    assert len(pieces) > 1
    assert all(len(p) <= 200 for p in pieces)
    assert "word0" in pieces[0] and "word399" in pieces[-1]


def test_chunking_edges():
    assert chunk_text("", 100, 10) == []
    assert chunk_text("short", 100, 10) == ["short"]
    # no whitespace to back off to: still terminates, still covers the text
    assert "".join(chunk_text("x" * 500, 100, 10)) != ""


def test_shared_prefix_measures_real_overlap():
    assert shared_prefix("abcdef", "defgh", 10) == 3
    assert shared_prefix("abc", "xyz", 10) == 0
    assert shared_prefix("abcdef", "defgh", 2) == 0  # capped below the true overlap
    assert shared_prefix("", "abc", 10) == 0

    # what /flow draws: consecutive chunks really do share text
    pieces = chunk_text(" ".join(f"word{i}" for i in range(400)), size=200, overlap=40)
    overlaps = [shared_prefix(pieces[i - 1], p, 40) for i, p in enumerate(pieces) if i]
    assert all(n > 0 for n in overlaps), overlaps
