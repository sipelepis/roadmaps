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

Two things to know about them. A generator is exhausted after one pass, so `list(g)` a second time gives `[]`; build a list when you need the values twice. And the loop variable belongs to the comprehension, not the code around it: after `[n for n in range(3)]` there is no `n`, which is why comprehensions can't accidentally clobber a name you were using.

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
    assert odd_squares([7]) == [49]

def test_order_and_repeats():
    """keeps the original order and repeats"""
    assert odd_squares([5, 3, 5, 1]) == [25, 9, 25, 1]
    assert odd_squares([]) == []

def test_negative_and_zero():
    """negative odd numbers count, zero is even"""
    assert odd_squares([-3, -2, 0, 7]) == [9, 49]
    assert odd_squares([-1, 0]) == [1]
```

#### Uses
- [Comprehensions › List comprehensions](#/comprehensions/list-comprehensions)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- Filter with an `if` after the `for`, and put the transformation in the expression before it.
- `n % 2 == 1` picks out odd numbers; `n * n` squares one.

#### Tips
- `n % 2 == 1` holds for negative odd numbers too: `%` takes the sign of the divisor, so `-3 % 2` is `1`.
- `n % 2 != 0` is the version that keeps working if the numbers ever stop being ints. `n % 2` on its own is truthy for odd numbers and is the shortest form.
- Filter with the `if` *after* the `for`. An `if/else` before the `for` maps every item instead of dropping any, which would leave the evens in.

#### Docs
- [Python tutorial: List comprehensions](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions)

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
    assert index_by(users, "name") == {"Ada": users[0], "Bob": users[1]}

def test_later_wins():
    """later items with the same key win"""
    rows = [{"id": 1, "v": "a"}, {"id": 2, "v": "b"}, {"id": 1, "v": "c"}]
    assert index_by(rows, "id") == {1: rows[2], 2: rows[1]}
    assert index_by(rows, "v") == {"a": rows[0], "b": rows[1], "c": rows[2]}

def test_empty():
    """no items gives an empty dict"""
    assert index_by([], "id") == {}
```

#### Uses
- [Comprehensions › Dict and set comprehensions](#/comprehensions/dict-and-set-comprehensions)
- [Dicts and sets › Dict basics](#/dicts-sets/dict-basics)

#### Hints
- A dict comprehension has the shape `{key_expr: value_expr for item in items}`.
- The key is `item[key]` and the value is the whole `item`. A repeated key overwrites the earlier entry, so later items win without extra work.

#### Tips
- `key` here is a field name, not a function. `item[key]` looks that field up in each dict.
- The values are the original dicts, not copies, which is why the test can compare them with `users[0]`.
- Duplicate keys silently overwrite. That is the behaviour wanted here, but it is also how a dict comprehension quietly loses rows when you didn't expect repeats.

#### Docs
- [Python tutorial: Dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)

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
    assert flatten([["a"], ["b", "c"], ["d"]]) == ["a", "b", "c", "d"]
    assert flatten([[], []]) == []

def test_keeps_order_and_repeats():
    """keeps order and repeated items"""
    assert flatten([[3, 1], [3]]) == [3, 1, 3]
    assert flatten([[], [2, 2], [1]]) == [2, 2, 1]

def test_one_level_only():
    """only removes one level of nesting"""
    assert flatten([[1, [2, 3]], [[4]]]) == [1, [2, 3], [4]]
    assert flatten([[[]]]) == [[]]
```

#### Uses
- [Comprehensions › Nested data](#/comprehensions/nested-data)

#### Hints
- Picture it as two nested `for` loops: for each inner list, for each item in it, keep the item.
- A comprehension lists those `for` clauses in the same order, outer first and inner second.

#### Tips
- Empty inner lists contribute nothing, so they need no special case.
- The `for` clauses read in the same order you would write the nested loops: outer first. Swapping them is the one mistake everyone makes here, and it raises `NameError`.
- `itertools.chain(*lists)` and `sum(lists, [])` also flatten one level. The first is the idiomatic one; the second is quadratic and best avoided.

#### Docs
- [Python tutorial: List comprehensions](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions)

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
    assert transpose([[1, 2], [3, 4], [5, 6]]) == [[1, 3, 5], [2, 4, 6]]

def test_square():
    """square matrices"""
    assert transpose([[1, 2], [3, 4]]) == [[1, 3], [2, 4]]
    assert transpose([[7]]) == [[7]]

def test_single_row_or_column():
    """one row becomes one column, and back"""
    assert transpose([[1, 2, 3]]) == [[1], [2], [3]]
    assert transpose([[1], [2], [3]]) == [[1, 2, 3]]
```

#### Uses
- [Comprehensions › Nested data](#/comprehensions/nested-data)

#### Hints
- Row `i` of the result is column `i` of the input: `[row[i] for row in matrix]`.
- Wrap that in an outer comprehension over every column index. The number of columns is `len(matrix[0])`.

#### Tips
- `zip(*matrix)` also transposes, giving tuples: `[list(col) for col in zip(*matrix)]`.
- Here the inner comprehension is the one that loops over `matrix`, and the outer one over the column indices — the opposite nesting from flattening. Read the innermost expression first when a nested comprehension confuses you.
- `len(matrix[0])` assumes at least one row. A transpose that must survive `[]` needs a guard, or `zip(*matrix)`, which handles it.

#### Docs
- [Python tutorial: Nested list comprehensions](https://docs.python.org/3/tutorial/datastructures.html#nested-list-comprehensions)
