# Practice problems

This module is practice only. Each problem is a small, self-contained function of the kind you meet in interviews, scripts, and code review. Almost nothing new is introduced (the odd small string tool is explained right in the problem that needs it); the point is fluency with what the previous modules covered. Solve them in whatever order you like.

## Tips

- Read the tests before writing code. They are the specification.
- Start with the simplest thing that passes, then look for the idiomatic version: a comprehension, a `Counter`, a `dict.get`, `sorted` with a key.
- `print()` inside your function shows up in the results panel, which is the fastest way to debug.
- Aim for clarity first. Most of these have a five-line solution.
- Strings join with `+`: `"ab" + "c"` is `"abc"`, and `s += "d"` adds to the end of `s`. For many pieces, collect them in a list and join once with `"".join(pieces)`.

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

#### Uses
- [Dicts and sets › Dict basics](#/dicts-sets/dict-basics)
- [Control flow › `for` iterates over things](#/control-flow/for-iterates-over-things)

#### Hints
- Checking every pair works but is slow. Walk the list once with `enumerate`, remembering each number's index in a dict.
- For each number `n`, the partner you need is `target - n`. If it's already in the dict, you have both indices.
- The dict holds the earlier index, so `(earlier, i)` is already in ascending order.

#### Tips
- Store the number *after* checking for its partner, so a number can never pair with itself.

#### Docs
- [Built-in functions: `enumerate`](https://docs.python.org/3/library/functions.html#enumerate)
- [Python tutorial: Dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)

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

#### Uses
- [Dicts and sets › Counting and grouping](#/dicts-sets/counting-and-grouping)
- [Lists and tuples › Lists](#/lists-tuples/lists)
- [Lists and tuples › Tuples](#/lists-tuples/tuples)

#### Hints
- Anagrams have the same letters, so they match once the letters are sorted: `sorted("tea")` is `['a', 'e', 't']`.
- A list can't be a dict key, but `tuple(sorted(word))` can. Group the words under that key with `setdefault(key, []).append(word)`.
- Sort each group, then sort the list of groups. Lists compare by their first item first, so that orders the groups by first word.

#### Tips
- `collections.defaultdict(list)` removes the `setdefault` call: `groups[key].append(word)`.

#### Docs
- [`dict.setdefault`](https://docs.python.org/3/library/stdtypes.html#dict.setdefault)
- [Sorting techniques: Sorting basics](https://docs.python.org/3/howto/sorting.html#sorting-basics)

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

#### Uses
- [Lists and tuples › Lists](#/lists-tuples/lists)
- [Dicts and sets › Dict basics](#/dicts-sets/dict-basics)
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [Variables and types › Truthiness](#/variables-types/truthiness)

#### Hints
- Use a list as a stack: push each opening bracket, and when a closing bracket arrives, the most recent opener must be its partner.
- A dict from closer to opener, `{")": "(", "]": "[", "}": "{"}`, turns "is this its partner?" into one lookup.
- Fail on a closer when the stack is empty or `pop()` hands back the wrong opener. At the end, the stack must be empty.

#### Tips
- Characters that aren't brackets are simply skipped, which is how `"a(b)c"` passes.

#### Docs
- [Python tutorial: Using lists as stacks](https://docs.python.org/3/tutorial/datastructures.html#using-lists-as-stacks)

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

#### Uses
- [Lists and tuples › Unpacking](#/lists-tuples/unpacking)
- [Control flow › `while`](#/control-flow/while)
- [Practice problems › Tips](#/practice/tips)

#### Hints
- Make a list of `(value, symbol)` pairs from largest to smallest, with the subtractive pairs as entries of their own: `(900, "CM")`, `(400, "CD")`, `(90, "XC")`, `(40, "XL")`, `(9, "IX")`, `(4, "IV")`.
- Go through the pairs in order. While `n` is at least the value, add the symbol to the result and subtract the value from `n`.

#### Tips
- With the subtractive pairs in the table, no special cases are needed: 1994 is M + CM + XC + IV.

#### Docs
- [Python tutorial: Looping techniques](https://docs.python.org/3/tutorial/datastructures.html#looping-techniques)

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

#### Uses
- [Lists and tuples › Sorting with a key](#/lists-tuples/sorting-with-a-key)
- [Lists and tuples › Lists](#/lists-tuples/lists)
- [Lists and tuples › Useful built-ins](#/lists-tuples/useful-built-ins)
- [Lists and tuples › Unpacking](#/lists-tuples/unpacking)

#### Hints
- Sort by start first. Then anything that overlaps an interval comes straight after it.
- Keep a result list. If an interval starts at or before the end of the last merged one, stretch that end with `max`; otherwise append the interval.
- `merged[-1]` is the last merged interval. Tuples can't be changed, so replace it with a new tuple.

#### Tips
- Touching intervals like `(1, 4)` and `(4, 5)` count as overlapping here, which is why the check is `<=` and not `<`.

#### Docs
- [Sorting techniques: Sorting basics](https://docs.python.org/3/howto/sorting.html#sorting-basics)
- [Built-in functions: `max`](https://docs.python.org/3/library/functions.html#max)

### 6. Caesar cipher

Shift letters by `k` positions, wrapping within the alphabet and preserving case. Leave non-letters unchanged.

Strings work like lists for this: `"c" in "abc"` is `True`, `"abc".index("c")` is `2`, and `"abc"[2]` is `"c"`.

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

#### Uses
- [Variables and types › Strings](#/variables-types/strings)
- [Variables and types › Numbers](#/variables-types/numbers)
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [Practice problems › Tips](#/practice/tips)

#### Hints
- Keep the alphabet in a string, `"abcdefghijklmnopqrstuvwxyz"`, and its `.upper()` version for capitals.
- For a letter, find its position with `.index`, add `k`, and wrap past `z` with `% 26`. The letter at the new position is the answer.
- Collect the shifted letters and the untouched characters in a list, and `"".join` it at the end.

#### Tips
- For a positive divisor, Python's `%` never gives a negative result: `(1 - 7) % 26` is `20`. That's why negative shifts wrap correctly too.
- The Strings module shows another route: `ord("a")` is `97` and `chr(97)` is `"a"`.

#### Docs
- [`str.index`](https://docs.python.org/3/library/stdtypes.html#str.index)
- [Common sequence operations](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)

### 7. Run-length decode

Decode strings like `"3a2b1c"` into `"aaabbc"`. Counts may have several digits.

Two string tools help: `"7".isdigit()` is `True` (and `"a".isdigit()` is `False`), and `"ab" * 3` is `"ababab"`.

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

#### Uses
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [Variables and types › Conversions](#/variables-types/conversions)
- [Variables and types › Strings](#/variables-types/strings)
- [Practice problems › Tips](#/practice/tips)

#### Hints
- Walk the text one character at a time. Digits are part of the count; anything else is the character to repeat.
- Collect digits in a string (`"1"`, then `"12"`) so multi-digit counts work. On a non-digit, repeat it `int(count)` times and reset the count to `""`.
- Build the answer with `+=`, or collect the pieces in a list and `"".join` them.

#### Tips
- The `re` module can do the splitting: `re.findall(r"(\d+)(\D)", text)` returns `(count, char)` pairs.

#### Docs
- [`str.isdigit`](https://docs.python.org/3/library/stdtypes.html#str.isdigit)
- [Common sequence operations](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)

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

#### Uses
- [Lists and tuples › Useful built-ins](#/lists-tuples/useful-built-ins)
- [Lists and tuples › Lists](#/lists-tuples/lists)
- [Comprehensions › Nested data](#/comprehensions/nested-data)

#### Hints
- One way: take the top row off, then turn what's left a quarter turn anticlockwise, so the next edge becomes the new top row. Repeat until nothing is left.
- `zip(*rows)` turns the remaining rows into columns, and reversing that list of columns completes the turn.
- `rows.pop(0)` removes and returns the first row. Copy the input first (`[list(r) for r in matrix]`) so the caller's matrix isn't changed.

#### Tips
- The index version keeps four boundaries (top, bottom, left, right) and walks each edge in turn. It's longer but copies nothing.

#### Docs
- [Built-in functions: `zip`](https://docs.python.org/3/library/functions.html#zip)

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

#### Uses
- [Lists and tuples › Useful built-ins](#/lists-tuples/useful-built-ins)
- [Dicts and sets › Sets](#/dicts-sets/sets)
- [Control flow › `while`](#/control-flow/while)
- [Variables and types › Strings](#/variables-types/strings)

#### Hints
- `zip(*words)` lines the words up column by column: all first letters together, then all second letters, stopping at the shortest word.
- A column belongs to the prefix while all its letters are the same, which is when `set(column)` has one item. `break` at the first column that doesn't.
- Count the matching columns, then slice that many letters off the first word: `words[0][:count]`.

#### Tips
- With an empty list, `zip(*words)` produces nothing, so the loop never runs and `""` comes out with no special case.

#### Docs
- [Built-in functions: `zip`](https://docs.python.org/3/library/functions.html#zip)

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

#### Uses
- [Control flow › `while`](#/control-flow/while)
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- Track the part of the list that could still hold `target` with two indices, `lo = 0` and `hi = len(items) - 1`.
- Loop while `lo <= hi` and look at the middle index, `(lo + hi) // 2`. Return it on a match; otherwise drop the half that can't contain `target`.
- If the middle item is smaller than `target`, the answer is to the right (`lo = mid + 1`); otherwise it's to the left (`hi = mid - 1`). Return `-1` after the loop.

#### Tips
- The standard library's `bisect` module does the halving for you: `bisect.bisect_left(items, target)` finds where `target` belongs.

#### Docs
- [`bisect`](https://docs.python.org/3/library/bisect.html#module-bisect)

### 11. Word wrap

Wrap `text` so that no line exceeds `width` characters, breaking only at spaces. Return the list of lines. Words longer than `width` go on their own line.

`split()` with no argument breaks text into words: `"the quick  fox".split()` is `["the", "quick", "fox"]`.

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

#### Uses
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [Lists and tuples › Lists](#/lists-tuples/lists)
- [Variables and types › Truthiness](#/variables-types/truthiness)
- [Practice problems › Tips](#/practice/tips)

#### Hints
- Split the text into words and build the current line in a string, one word at a time.
- A word fits if `len(line) + 1 + len(word) <= width` (the `1` is the space). If it doesn't, save the line and start a new one with that word.
- An empty line always takes the next word, however long it is. Remember to save the last line after the loop.

#### Tips
- The standard library has this built in: `textwrap.wrap(text, width, break_long_words=False)` passes these tests.

#### Docs
- [`str.split`](https://docs.python.org/3/library/stdtypes.html#str.split)
- [`textwrap.wrap`](https://docs.python.org/3/library/textwrap.html#textwrap.wrap)

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

#### Uses
- [Dicts and sets › Iterating](#/dicts-sets/iterating)
- [Dicts and sets › Merging and updating](#/dicts-sets/merging-and-updating)
- [Variables and types › The core types](#/variables-types/the-core-types)
- [Practice problems › Tips](#/practice/tips)

#### Hints
- Loop over `data.items()`. The full key for an entry is `prefix + key`.
- If the value is itself a dict (`isinstance(value, dict)`), call `flatten_dict` on it with `prefix + key + "."` as the prefix, and merge what comes back into your result with `.update()`.
- Otherwise, store the value under the full key.

#### Tips
- Recursion suits data nested to any depth: each call handles one level and hands the rest down.

#### Docs
- [Built-in functions: `isinstance`](https://docs.python.org/3/library/functions.html#isinstance)
- [`dict.update`](https://docs.python.org/3/library/stdtypes.html#dict.update)
