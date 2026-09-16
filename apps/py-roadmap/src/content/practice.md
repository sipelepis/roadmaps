# Practice problems

This module is practice only. Each problem is a small, self-contained function of the kind you meet in interviews, scripts, and code review. Almost nothing new is introduced (the odd small string tool is explained right in the problem that needs it); the point is fluency with what the previous modules covered. Solve them in whatever order you like.

## Tips

- Read the tests before writing code. They are the specification.
- Start with the simplest thing that passes, then look for the idiomatic version: a comprehension, a `Counter`, a `dict.get`, `sorted` with a key.
- `print()` inside your function shows up in the results panel, which is the fastest way to debug.
- Aim for clarity first. Most of these have a five-line solution.
- Strings join with `+`: `"ab" + "c"` is `"abc"`, and `s += "d"` adds to the end of `s`. For many pieces, collect them in a list and join once with `"".join(pieces)`.
- When a name in a problem is unfamiliar, the [Reference](#/reference) page has every built-in, method and standard library call these modules use, with an example each.
- Handle the empty input first. `[]`, `""` and `{}` are where most of these solutions break, and they are always in the tests.

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
    assert two_sum([1, 5, 9, 2, 8], 3) == (0, 3)

def test_no_self_pair():
    """never uses the same element twice"""
    assert two_sum([5, 3, 7], 10) == (1, 2)
    assert two_sum([3, 3], 6) == (0, 1)

def test_negatives_and_zero():
    """negative numbers and zero"""
    assert two_sum([-3, 4, 3, 90], 0) == (0, 2)
    assert two_sum([0, 4, 3, 0], 0) == (0, 3)
    assert two_sum([10, -2, 7], 5) == (1, 2)
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
- A repeated number overwrites its earlier index in the dict. That is harmless here because you check before storing, and `[3, 3]` still gives `(0, 1)`.
- The dict turns an O(n²) scan of every pair into one O(n) pass. "Remember what I've seen in a dict" is the move behind most of these problems.

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

def test_letter_counts():
    """same letters, same number of times"""
    assert anagram_groups(["aab", "abb", "bab", "baa"]) == [["aab", "baa"], ["abb", "bab"]]
    assert anagram_groups(["ab", "abc"]) == [["ab"], ["abc"]]

def test_order_and_edges():
    """sorted groups, single words, no words"""
    assert anagram_groups(["zoo", "cab", "abc"]) == [["abc", "cab"], ["zoo"]]
    assert anagram_groups(["solo"]) == [["solo"]]
    assert anagram_groups([]) == []
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
- `sorted("tea")` returns a *list*, which can't be a dict key. `tuple(sorted(word))` or `"".join(sorted(word))` both can.
- `sorted(groups.values())` sorts lists against each other, element by element, so the groups end up ordered by their first word with no key function.

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

def test_more_balanced():
    """siblings and nesting"""
    assert balanced("{[()()]}") and balanced("print(x[0])") and balanced("()[]{}")

def test_wrong_order():
    """interleaved pairs are not balanced"""
    assert not balanced("([)]") and not balanced("[(])") and not balanced("{(})")

def test_leftovers():
    """an extra opener or closer anywhere fails"""
    assert not balanced("())") and not balanced("(()") and not balanced(")")
    assert not balanced("[") and not balanced("a}b")
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
- Check the stack is non-empty *before* popping, or `")"` on its own raises `IndexError` instead of returning `False`.
- Returning `not stack` at the end covers both remaining cases: nothing left is balanced, anything left is not.

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

def test_subtractive():
    """every subtractive pair"""
    assert [to_roman(n) for n in [4, 9, 40, 90, 400, 900]] == ["IV", "IX", "XL", "XC", "CD", "CM"]
    assert to_roman(444) == "CDXLIV"

def test_more():
    """other values"""
    assert to_roman(1) == "I"
    assert to_roman(58) == "LVIII"
    assert to_roman(2024) == "MMXXIV"
    assert to_roman(3888) == "MMMDCCCLXXXVIII"
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
- The table must be in descending order of value. Take the largest symbol that still fits, every time, and the greedy choice is always right for Roman numerals.
- `while n >= value:` rather than `if`, so `MMM` for 3000 comes out of one table entry.

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

def test_unsorted():
    """input in any order"""
    assert merge_intervals([(8, 10), (1, 3), (2, 6)]) == [(1, 6), (8, 10)]
    assert merge_intervals([(5, 6), (1, 2)]) == [(1, 2), (5, 6)]

def test_contained_and_chains():
    """contained intervals and chains"""
    assert merge_intervals([(1, 10), (2, 3), (4, 5)]) == [(1, 10)]
    assert merge_intervals([(1, 2), (2, 3), (3, 4)]) == [(1, 4)]
    assert merge_intervals([(1, 5), (1, 2)]) == [(1, 5)]
    assert merge_intervals([(3, 4)]) == [(3, 4)]
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
- `max(last_end, end)` matters for a contained interval like `(1, 10)` then `(2, 3)`. Taking the new end unconditionally would shrink the merged range back to 3.
- Sorting first is what makes one pass enough: after it, anything that overlaps an interval is the next one along, so you never look backwards.

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

def test_capitals_wrap():
    """capitals wrap and stay capitals"""
    assert caesar("XYZ", 3) == "ABC"
    assert caesar("Zebra", 1) == "Afcsb"

def test_negative_and_large():
    """negative shifts and shifts past 26"""
    assert caesar("abc", -1) == "zab"
    assert caesar("abc", 29) == "def"
    assert caesar("Hi", 52) == "Hi"

def test_non_letters():
    """leaves everything else alone"""
    assert caesar("a1 b2!?", 1) == "b1 c2!?"
    assert caesar("123 ...", 5) == "123 ..."
```

#### Uses
- [Variables and types › Strings](#/variables-types/strings)
- [Variables and types › Numbers](#/variables-types/numbers)
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [Practice problems › Tips](#/practice/tips)
- [Reference › Strings](#/reference/strings)

#### Hints
- Keep the alphabet in a string, `"abcdefghijklmnopqrstuvwxyz"`, and its `.upper()` version for capitals.
- For a letter, find its position with `.index`, add `k`, and wrap past `z` with `% 26`. The letter at the new position is the answer.
- Collect the shifted letters and the untouched characters in a list, and `"".join` it at the end.

#### Tips
- For a positive divisor, Python's `%` never gives a negative result: `(1 - 7) % 26` is `20`. That's why negative shifts wrap correctly too.
- The other route is arithmetic on code points: `ord("a")` is `97` and `chr(97)` is `"a"`, so a letter shifts with `chr((ord(ch) - ord("a") + k) % 26 + ord("a"))`. Same idea, no alphabet string.
- Handle upper and lower case with the same code by picking which alphabet to look in, rather than writing the shift twice.

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

def test_multi_digit():
    """counts of any length, anywhere"""
    assert rle_decode("10a2b") == "a" * 10 + "bb"
    assert rle_decode("1a10b1c") == "a" + "b" * 10 + "c"
    assert rle_decode("100z") == "z" * 100

def test_repeats():
    """the same letter can come back"""
    assert rle_decode("2a1b2a") == "aabaa"
    assert rle_decode("2A1b") == "AAb"
```

#### Uses
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [Variables and types › Conversions](#/variables-types/conversions)
- [Variables and types › Strings](#/variables-types/strings)
- [Practice problems › Tips](#/practice/tips)
- [Reference › Strings](#/reference/strings)

#### Hints
- Walk the text one character at a time. Digits are part of the count; anything else is the character to repeat.
- Collect digits in a string (`"1"`, then `"12"`) so multi-digit counts work. On a non-digit, repeat it `int(count)` times and reset the count to `""`.
- Build the answer with `+=`, or collect the pieces in a list and `"".join` them.

#### Tips
- The `re` module can do the splitting: `re.findall(r"(\d+)(\D)", text)` returns `(count, char)` pairs.
- Accumulating the digits as *text* and converting once is what makes `"12x"` twelve rather than one then two. Converting each digit as you meet it loses the tens.
- Resetting the count to `""` after each character is the step that's easy to forget, and `"2a1b2a"` is the test that catches it.

#### Docs
- [`str.isdigit`](https://docs.python.org/3/library/stdtypes.html#str.isdigit)
- [Common sequence operations](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)

### 8. Matrix spiral

Return the elements of a matrix in clockwise spiral order. Don't change the input matrix.

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

def test_bigger():
    """4x4 and wide matrices"""
    m = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
    assert spiral(m) == [1, 2, 3, 4, 8, 12, 16, 15, 14, 13, 9, 5, 6, 7, 11, 10]
    assert spiral([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]) == [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]

def test_thin():
    """a single row, column, or cell"""
    assert spiral([[1, 2, 3]]) == [1, 2, 3]
    assert spiral([[1], [2], [3]]) == [1, 2, 3]
    assert spiral([[5]]) == [5]

def test_unchanged():
    """leaves the input alone"""
    m = [[1, 2], [3, 4]]
    assert spiral(m) == [1, 2, 4, 3]
    assert m == [[1, 2], [3, 4]]
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
- `rows.pop(0)` needs its own outer list, or the caller's matrix loses its rows. `[list(r) for r in matrix]` copies a level deeper than strictly necessary, which is the cheap way to stop worrying about it.
- `zip(*rows)` gives tuples, and the result is built from fresh objects either way, so the original rows are never touched after the first turn.

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

def test_every_word_counts():
    """a word in the middle can cut the prefix"""
    assert common_prefix(["abcd", "xbcd", "abce"]) == ""
    assert common_prefix(["cart", "care", "cow", "cab"]) == "c"

def test_whole_word():
    """the prefix can be a whole word"""
    assert common_prefix(["ab", "abc"]) == "ab"
    assert common_prefix(["same", "same"]) == "same"
    assert common_prefix(["solo"]) == "solo"
    assert common_prefix(["", "a"]) == ""
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
- `zip` stopping at the shortest word is doing real work here: the prefix can never be longer than the shortest word, and you get that bound for free.
- `len(set(column)) == 1` is the "all the same" test. `set` on a tuple of characters is cheap, and it reads better than comparing every element to the first.

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

def test_every_position():
    """finds the first, last and every item between"""
    for items in [[1, 3, 5, 7, 9], [2, 4, 6, 8], [42]]:
        for i, value in enumerate(items):
            assert binary_search(items, value) == i, (items, value)

def test_missing():
    """-1 below, above and between the items"""
    items = [10, 20, 30, 40]
    for target in [5, 15, 25, 35, 45]:
        assert binary_search(items, target) == -1, target
    assert binary_search([42], 41) == -1 and binary_search([42], 43) == -1

def test_logarithmic():
    """few comparisons on a big input"""
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
- [Reference › Sequences](#/reference/sequences)

#### Hints
- Track the part of the list that could still hold `target` with two indices, `lo = 0` and `hi = len(items) - 1`.
- Loop while `lo <= hi` and look at the middle index, `(lo + hi) // 2`. Return it on a match; otherwise drop the half that can't contain `target`.
- If the middle item is smaller than `target`, the answer is to the right (`lo = mid + 1`); otherwise it's to the left (`hi = mid - 1`). Return `-1` after the loop.

#### Tips
- The standard library's `bisect` module does the halving for you: `bisect.bisect_left(items, target)` finds where `target` belongs — but it returns an insertion point, so you still have to check that `items[i] == target` before calling it a hit.
- `lo <= hi`, not `lo < hi`. With `<` the loop exits one step early and misses a target sitting alone in the final slot, which is what the single-item tests catch.
- Every branch must shrink the range. `lo = mid` instead of `mid + 1` loops forever on a two-element list, and the page stops responding rather than failing a test.

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

def test_exact_width():
    """a line may be exactly width long, counting the space"""
    assert wrap("aaa bbb", 7) == ["aaa bbb"]
    assert wrap("aaa bbb", 6) == ["aaa", "bbb"]

def test_long_word_between():
    """a long word gets its own line, even between short ones"""
    assert wrap("a bbbbbbbb c", 3) == ["a", "bbbbbbbb", "c"]
    assert wrap("ab cdefgh ij", 4) == ["ab", "cdefgh", "ij"]

def test_one_line():
    """short text stays on one line"""
    assert wrap("one two three", 50) == ["one two three"]
    assert wrap("word", 4) == ["word"]
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
- The `+ 1` for the space only applies when the line already has something on it. An empty line takes the word whatever its length, which is what puts a long word on its own line.
- Don't forget the last line. A loop that only saves a line when the *next* word doesn't fit drops whatever is still in hand when the words run out.

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

def test_deep():
    """any depth, several branches"""
    assert flatten_dict({"x": {"y": {"z": {"w": 1}}}}) == {"x.y.z.w": 1}
    data = {"db": {"host": "h", "port": 5432}, "app": {"debug": {"on": True}}}
    assert flatten_dict(data) == {"db.host": "h", "db.port": 5432, "app.debug.on": True}

def test_other_values():
    """non-dict values are kept as they are"""
    data = {"tags": ["x", "y"], "owner": None, "meta": {"size": [1, 2]}}
    assert flatten_dict(data) == {"tags": ["x", "y"], "owner": None, "meta.size": [1, 2]}
    assert flatten_dict({"a": 1, "b": "two"}) == {"a": 1, "b": "two"}
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
- An empty dict as a value disappears entirely, because recursing into it returns nothing to merge. Whether that is right depends on the format you are flattening for.
- Only dicts are opened up. A list value is stored as it is, so `{"tags": ["x"]}` keeps its list rather than becoming `tags.0`.
- `prefix=""` is a safe default because strings are immutable. A mutable default here would be the usual bug.

#### Docs
- [Built-in functions: `isinstance`](https://docs.python.org/3/library/functions.html#isinstance)
- [`dict.update`](https://docs.python.org/3/library/stdtypes.html#dict.update)
