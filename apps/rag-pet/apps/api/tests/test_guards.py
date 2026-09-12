from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

# No `with`: the lifespan (and so the database) never starts. Every guard here
# fires before a query would; a request that gets past one 500s, which is fine.
client = TestClient(app, raise_server_exceptions=False)


def test_oversized_text_is_rejected():
    body = {"filename": "big.md", "text": "x" * (settings.max_chars + 1)}
    assert client.post("/api/documents/text", json=body).status_code == 413


def test_oversized_upload_is_rejected():
    files = {"file": ("big.txt", b"x" * (settings.max_upload_bytes + 1))}
    assert client.post("/api/documents/upload", files=files).status_code == 413


def test_write_key_guards_ingest_and_delete_but_not_query(monkeypatch):
    monkeypatch.setattr(settings, "write_key", "hunter2")
    body = {"filename": "a.md", "text": "hello"}
    assert client.post("/api/documents/text", json=body).status_code == 401
    assert client.post("/api/documents/text", json=body, headers={"x-write-key": "nope"}).status_code == 401
    assert client.delete("/api/documents/1").status_code == 401
    # right key gets past the guard (and then fails on the absent database, which is fine here)
    assert client.post("/api/documents/text", json=body, headers={"x-write-key": "hunter2"}).status_code != 401
    # /api/query is deliberately open
    assert client.post("/api/query", json={"question": "hi"}).status_code != 401
