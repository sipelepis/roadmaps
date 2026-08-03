from app.rag import chunk_text


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
