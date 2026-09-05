# Files and JSON

Reading and writing files is where most scripts start. Python's `open`, the `with` statement, `pathlib`, and the `json` module cover the everyday cases in a few lines each. The playground runs on a virtual filesystem, so everything here works in the browser too.

## `open` and `with`

```python
with open("notes.txt", "w") as f:
    f.write("first line\n")

with open("notes.txt") as f:        # mode "r" is the default
    text = f.read()
```

`with` closes the file when the block ends, even if an exception is raised. Never leave a file open by hand.

Modes: `"r"` read, `"w"` write (truncate), `"a"` append, `"x"` create-only, add `"b"` for bytes. Pass `encoding="utf-8"` explicitly for text; the default depends on the platform.

## Reading line by line

```python
with open("data.txt") as f:
    for line in f:              # lazy, one line at a time
        process(line.rstrip("\n"))

lines = path.read_text().splitlines()   # small files
```

## `pathlib`

`Path` objects replace string manipulation of paths:

```python
from pathlib import Path

p = Path("data") / "users.json"
p.parent, p.name, p.suffix, p.stem     # data, users.json, .json, users
p.exists(), p.is_file()
p.read_text(), p.write_text("...")
p.parent.mkdir(parents=True, exist_ok=True)
list(Path(".").glob("*.py"))
```

Prefer `pathlib` over `os.path` in new code.

## JSON

```python
import json

data = {"name": "Ada", "tags": ["math", "engines"]}
text = json.dumps(data, indent=2)            # to string
data = json.loads(text)                      # from string

with open("data.json", "w") as f:
    json.dump(data, f)                       # to file
with open("data.json") as f:
    data = json.load(f)                      # from file
```

JSON has no tuples, sets, dates, or custom objects. `default=str` on `dumps` is the blunt fix; a proper encoder or converting beforehand is the real one. Keys are always strings after a round trip.

## CSV

```python
import csv

with open("rows.csv", newline="") as f:
    for row in csv.DictReader(f):
        print(row["name"], row["price"])
```

`csv` handles quoting and commas inside fields, which a naive `split(",")` does not.

## Errors

`FileNotFoundError`, `PermissionError`, and `IsADirectoryError` are all subclasses of `OSError`. `json.JSONDecodeError` is a `ValueError`.

```python playground
import json
from pathlib import Path

path = Path("inventory.json")
path.write_text(json.dumps({"apples": 3, "pears": 0}, indent=2))

stock = json.loads(path.read_text())
stock["plums"] = 7
path.write_text(json.dumps(stock))

print(path.read_text())
print(path.stat().st_size, "bytes")

for p in Path(".").glob("*.json"):
    print("found", p)

# Try: json.loads("{'single': 'quotes'}")
```

## Exercises

### 1. Line count

`count_lines(path)` returns the number of lines in a text file. The tests create the file first.

```python starter
def count_lines(path):
    ...
```

```python test
from pathlib import Path

def test_count():
    """counts lines"""
    Path("sample.txt").write_text("a\nb\nc\n")
    assert count_lines("sample.txt") == 3

def test_empty():
    """empty file has zero lines"""
    Path("empty.txt").write_text("")
    assert count_lines("empty.txt") == 0
```

### 2. Append a log entry

`log(path, message)` appends `message` plus a newline to the file, creating it if needed. Calling it twice leaves two lines.

```python starter
def log(path, message):
    ...
```

```python test
from pathlib import Path

def test_append():
    """appends lines"""
    Path("app.log").unlink(missing_ok=True)
    log("app.log", "started")
    log("app.log", "stopped")
    assert Path("app.log").read_text() == "started\nstopped\n"
```

### 3. Load settings with defaults

`load_settings(path)` reads a JSON object from `path` and merges it over `DEFAULTS`. If the file is missing, return a copy of `DEFAULTS`. If it contains invalid JSON, raise `ValueError`.

```python starter
import json

DEFAULTS = {"theme": "dark", "font_size": 14}

def load_settings(path):
    ...
```

```python test
from pathlib import Path

def test_merges():
    """file values override defaults"""
    Path("s.json").write_text('{"theme": "light"}')
    assert load_settings("s.json") == {"theme": "light", "font_size": 14}

def test_missing():
    """missing file gives the defaults, as a copy"""
    Path("nope.json").unlink(missing_ok=True)
    s = load_settings("nope.json")
    assert s == DEFAULTS and s is not DEFAULTS

def test_invalid():
    """invalid JSON raises ValueError"""
    Path("bad.json").write_text("{not json")
    try:
        load_settings("bad.json")
    except ValueError:
        return
    assert False, "expected ValueError"
```

### 4. CSV totals

`total_by_category(path)` reads a CSV with `category,amount` columns and returns a dict of category to summed amount (as floats).

```python starter
def total_by_category(path):
    ...
```

```python test
from pathlib import Path

def test_totals():
    """sums amounts per category"""
    Path("spend.csv").write_text("category,amount\nfood,10.5\nrent,800\nfood,4.5\n")
    assert total_by_category("spend.csv") == {"food": 15.0, "rent": 800.0}
```
