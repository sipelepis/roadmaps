# Dicts and sets

Dictionaries are the workhorse data structure of Python: fast key lookups, insertion-ordered since 3.7, and the shape of most data you'll load from JSON. Sets are dicts without values: unordered collections of unique, hashable items with fast membership tests.

## Dict basics

```python
user = {"name": "Ada", "age": 36}
user["email"] = "ada@x.io"     # add or overwrite
user["age"]                    # 36
user["phone"]                  # KeyError
user.get("phone")              # None
user.get("phone", "n/a")       # default
"name" in user                 # key membership
del user["email"]
len(user)
```

## Iterating

```python
for key in user: ...
for key, value in user.items(): ...
for value in user.values(): ...
```

Modifying a dict while iterating over it raises `RuntimeError`. Iterate over `list(d)` if you must delete keys.

## Counting and grouping

The two idioms you'll write most:

```python
counts = {}
for word in words:
    counts[word] = counts.get(word, 0) + 1

groups = {}
for item in items:
    groups.setdefault(item.category, []).append(item)
```

`collections.Counter` and `collections.defaultdict` make both one-liners; the Standard library module covers them.

## Merging and updating

```python
defaults = {"theme": "dark", "size": 14}
merged = {**defaults, **overrides}    # right side wins
merged = defaults | overrides         # 3.9+
defaults.update(overrides)            # in place
```

## Keys must be hashable

Strings, numbers, tuples of hashables, and frozensets work. Lists and dicts don't, because they can change after insertion.

## Sets

```python
seen = set()
seen.add("a")
"a" in seen           # True, O(1)
{1, 2, 3} & {2, 3, 4}  # {2, 3}  intersection
{1, 2, 3} | {4}        # union
{1, 2, 3} - {2}        # difference
{1, 2} <= {1, 2, 3}    # subset
set("hello")           # {'h', 'e', 'l', 'o'}
```

`{}` is an empty *dict*; an empty set is `set()`.

Deduplicating while keeping order: `list(dict.fromkeys(items))`.

```python playground
text = "the cat and the dog and the bird"

counts = {}
for word in text.split():
    counts[word] = counts.get(word, 0) + 1

for word, n in sorted(counts.items(), key=lambda kv: -kv[1]):
    print(f"{word:<5} {'#' * n}")

print(set(text.split()) - {"the", "and"})

# Try: group the words by their length.
```

## Exercises

### 1. Word frequencies

Return a dict mapping each word (lowercased) to the number of times it appears.

```python starter
def word_counts(text):
    ...
```

```python test
def test_counts():
    """counts words case-insensitively"""
    assert word_counts("The cat the CAT") == {"the": 2, "cat": 2}

def test_empty():
    """empty text gives an empty dict"""
    assert word_counts("") == {}
```

### 2. Invert a dict

Given a dict of `name -> team`, return `team -> sorted list of names`.

```python starter
def by_team(members):
    ...
```

```python test
def test_groups():
    """groups names by team, sorted"""
    members = {"cy": "blue", "ada": "red", "bob": "blue"}
    assert by_team(members) == {"blue": ["bob", "cy"], "red": ["ada"]}
```

### 3. Set logic

`common_and_unique(a, b)` returns a tuple `(common, only_a, only_b)` of *sorted lists*: items in both, items only in `a`, items only in `b`.

```python starter
def common_and_unique(a, b):
    ...
```

```python test
def test_sets():
    """intersection and both differences"""
    assert common_and_unique([1, 2, 3, 3], [3, 4]) == ([3], [1, 2], [4])
```

### 4. Deep get

`deep_get(data, path, default=None)` walks nested dicts following a dotted `path` like `"user.address.city"`, returning `default` if any step is missing.

```python starter
def deep_get(data, path, default=None):
    ...
```

```python test
data = {"user": {"address": {"city": "Berlin"}, "tags": ["a"]}}

def test_found():
    """walks nested keys"""
    assert deep_get(data, "user.address.city") == "Berlin"

def test_missing():
    """default when a step is missing"""
    assert deep_get(data, "user.phone.home") is None
    assert deep_get(data, "user.tags.0", "x") == "x"
```
