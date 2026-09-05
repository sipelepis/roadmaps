# Practice problems

This module is practice only. Each problem is a small, self-contained function of the kind you meet in interviews, scripts, and code review. Nothing new is introduced; the point is fluency with what the previous modules covered. Solve them in whatever order you like.

## Tips

- Read the tests before writing code. They are the specification.
- Start with the simplest thing that passes, then look for the idiomatic version: a comprehension, a `Counter`, a `dict.get`, `sorted` with a key.
- `print()` inside your function shows up in the results panel, which is the fastest way to debug.
- Aim for clarity first. Most of these have a five-line solution.

## Exercises

### 1. Two sum

Return the indices of the two numbers that add up to `target`, as a tuple in ascending order. Assume exactly one solution.

```python starter
def two_sum(nums, target):
    ...
```

```python test
def test_two_sum():
    """finds the pair"""
    assert two_sum([2, 7, 11, 15], 9) == (0, 1)
    assert two_sum([3, 2, 4], 6) == (1, 2)
```

### 2. Anagram groups

Group words that are anagrams of each other. Return a list of groups, each group sorted, and the list sorted by its first word.

```python starter
def anagram_groups(words):
    ...
```

```python test
def test_groups():
    """groups anagrams"""
    words = ["eat", "tea", "tan", "ate", "nat", "bat"]
    assert anagram_groups(words) == [["ate", "eat", "tea"], ["bat"], ["nat", "tan"]]
```

### 3. Balanced brackets

Return `True` if every `(`, `[`, `{` is closed by the matching bracket in the right order.

```python starter
def balanced(text):
    ...
```

```python test
def test_balanced():
    """matching brackets"""
    assert balanced("({[]})") and balanced("") and balanced("a(b)c")
    assert not balanced("(]") and not balanced("((") and not balanced(")(")
```

### 4. Roman numerals

Convert an integer from 1 to 3999 to a Roman numeral.

```python starter
def to_roman(n):
    ...
```

```python test
def test_roman():
    """standard forms including subtractive pairs"""
    assert to_roman(3) == "III"
    assert to_roman(4) == "IV"
    assert to_roman(1994) == "MCMXCIV"
    assert to_roman(3999) == "MMMCMXCIX"
```

### 5. Merge intervals

Given a list of `(start, end)` intervals, merge overlapping or touching ones and return them sorted.

```python starter
def merge_intervals(intervals):
    ...
```

```python test
def test_merge():
    """merges overlaps"""
    assert merge_intervals([(1, 3), (2, 6), (8, 10), (15, 18)]) == [(1, 6), (8, 10), (15, 18)]
    assert merge_intervals([(1, 4), (4, 5)]) == [(1, 5)]
    assert merge_intervals([]) == []
```

### 6. Caesar cipher

Shift letters by `k` positions, wrapping within the alphabet and preserving case. Leave non-letters unchanged.

```python starter
def caesar(text, k):
    ...
```

```python test
def test_caesar():
    """shifts and wraps"""
    assert caesar("Hello, World!", 3) == "Khoor, Zruog!"
    assert caesar("xyz", 3) == "abc"
    assert caesar(caesar("Round trip", 7), -7) == "Round trip"
```

### 7. Run-length decode

Decode strings like `"3a2b1c"` into `"aaabbbc"`. Counts may have several digits.

```python starter
def rle_decode(text):
    ...
```

```python test
def test_decode():
    """expands counts"""
    assert rle_decode("3a2b1c") == "aaabbc"
    assert rle_decode("12x") == "x" * 12
    assert rle_decode("") == ""
```

### 8. Matrix spiral

Return the elements of a matrix in clockwise spiral order.

```python starter
def spiral(matrix):
    ...
```

```python test
def test_spiral():
    """clockwise from the top-left"""
    m = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    assert spiral(m) == [1, 2, 3, 6, 9, 8, 7, 4, 5]
    assert spiral([[1, 2], [3, 4], [5, 6]]) == [1, 2, 4, 6, 5, 3]
    assert spiral([]) == []
```

### 9. Longest common prefix

Return the longest prefix shared by all strings, or `""`.

```python starter
def common_prefix(words):
    ...
```

```python test
def test_prefix():
    """shared prefix"""
    assert common_prefix(["flower", "flow", "flight"]) == "fl"
    assert common_prefix(["dog", "racecar"]) == ""
    assert common_prefix([]) == ""
```

### 10. Binary search

Return the index of `target` in the sorted list `items`, or `-1`. Must run in O(log n): no `in` or `.index()`.

```python starter
def binary_search(items, target):
    ...
```

```python test
def test_search():
    """finds or returns -1"""
    items = list(range(0, 100, 3))
    assert binary_search(items, 27) == 9
    assert binary_search(items, 28) == -1
    assert binary_search([], 1) == -1

def test_logarithmic():
    """few comparisons on a big input"""
    class Probe:
        def __init__(self, v): self.v = v; self.n = 0
        def __eq__(self, o): return self.v == o
        def __lt__(self, o): return self.v < o
        def __gt__(self, o): return self.v > o
    n = 0
    class Item(int):
        def __lt__(self, o): nonlocal n; n += 1; return int.__lt__(self, o)
        def __gt__(self, o): nonlocal n; n += 1; return int.__gt__(self, o)
        def __eq__(self, o): nonlocal n; n += 1; return int.__eq__(self, o)
        __hash__ = int.__hash__
    big = [Item(i) for i in range(100_000)]
    binary_search(big, 77_777)
    assert n < 100, f"{n} comparisons is too many"
```

### 11. Word wrap

Wrap `text` so that no line exceeds `width` characters, breaking only at spaces. Return the list of lines. Words longer than `width` go on their own line.

```python starter
def wrap(text, width):
    ...
```

```python test
def test_wrap():
    """wraps at spaces"""
    assert wrap("the quick brown fox jumps", 10) == ["the quick", "brown fox", "jumps"]
    assert wrap("supercalifragilistic is long", 5) == ["supercalifragilistic", "is", "long"]
    assert wrap("", 5) == []
```

### 12. Flatten a dict

Flatten nested dicts into dotted keys: `{"a": {"b": 1, "c": {"d": 2}}, "e": 3}` becomes `{"a.b": 1, "a.c.d": 2, "e": 3}`.

```python starter
def flatten_dict(data, prefix=""):
    ...
```

```python test
def test_flatten():
    """dotted keys"""
    assert flatten_dict({"a": {"b": 1, "c": {"d": 2}}, "e": 3}) == {"a.b": 1, "a.c.d": 2, "e": 3}
    assert flatten_dict({}) == {}
```
