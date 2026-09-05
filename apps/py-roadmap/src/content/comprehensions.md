# Comprehensions

A comprehension builds a collection from an iterable in one expression. It replaces the "create empty list, loop, append" pattern with something shorter that also runs faster, and it exists for lists, dicts, sets, and generators.

## List comprehensions

```python
squares = [n * n for n in range(10)]
evens = [n for n in range(10) if n % 2 == 0]
pairs = [(x, y) for x in range(3) for y in range(3) if x != y]
```

Read them left to right as the loop they replace: *for each n in range, if the condition holds, produce n squared*.

## Conditional expressions inside

```python
labels = ["even" if n % 2 == 0 else "odd" for n in range(5)]
```

The `if/else` before the `for` maps every item; the `if` after the `for` filters items.

## Dict and set comprehensions

```python
lengths = {word: len(word) for word in words}
inverted = {v: k for k, v in mapping.items()}
unique_initials = {name[0] for name in names}
```

## Generator expressions

Parentheses (or just the bare expression inside a call) give a lazy generator instead of a list:

```python
total = sum(n * n for n in range(1_000_000))     # no list of a million ints
any(word.startswith("q") for word in words)      # stops at the first match
```

Use these whenever the result is consumed once by a function like `sum`, `max`, `any`, `all`, or `join`.

## Nested data

```python
matrix = [[1, 2, 3], [4, 5, 6]]
flat = [x for row in matrix for x in row]           # [1, 2, 3, 4, 5, 6]
transposed = [[row[i] for row in matrix] for i in range(3)]
```

The outer loop comes first in a flattening comprehension, same order as the nested `for` statements would be written.

## When not to use one

If it needs more than one condition plus one transformation, or a nested comprehension is hard to read, write the loop. Comprehensions are for clarity; a clever one defeats the point. Also avoid comprehensions purely for side effects (`[print(x) for x in xs]`); use a loop.

```python playground
words = ["python", "comprehension", "list", "generator", "dict"]

lengths = {w: len(w) for w in words}
long_words = [w.upper() for w in words if len(w) > 5]
initials = {w[0] for w in words}

print(lengths)
print(long_words)
print(sorted(initials))
print(sum(len(w) for w in words), "characters in total")

grid = [[r * c for c in range(1, 4)] for r in range(1, 4)]
for row in grid:
    print(*row)

# Try: transpose grid with a nested comprehension.
```

## Exercises

### 1. Squares of odds

Return the squares of the odd numbers in `numbers`, in order, as a list comprehension.

```python starter
def odd_squares(numbers):
    ...
```

```python test
def test_odd_squares():
    """squares only the odd numbers"""
    assert odd_squares([1, 2, 3, 4, 5]) == [1, 9, 25]
    assert odd_squares([2, 4]) == []
```

### 2. Index by key

`index_by(items, key)` returns a dict mapping `item[key]` to the item, using a dict comprehension. Later items with the same key win.

```python starter
def index_by(items, key):
    ...
```

```python test
def test_index():
    """indexes dicts by a key"""
    users = [{"id": 1, "name": "Ada"}, {"id": 2, "name": "Bob"}]
    assert index_by(users, "id") == {1: users[0], 2: users[1]}
```

### 3. Flatten

Flatten one level of nesting: `[[1, 2], [3], []]` becomes `[1, 2, 3]`.

```python starter
def flatten(lists):
    ...
```

```python test
def test_flatten():
    """flattens one level"""
    assert flatten([[1, 2], [3], []]) == [1, 2, 3]
    assert flatten([]) == []
```

### 4. Transpose

Return the transpose of a rectangular matrix (list of lists).

```python starter
def transpose(matrix):
    ...
```

```python test
def test_transpose():
    """swaps rows and columns"""
    assert transpose([[1, 2, 3], [4, 5, 6]]) == [[1, 4], [2, 5], [3, 6]]
```
