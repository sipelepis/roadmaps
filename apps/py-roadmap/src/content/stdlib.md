# Standard library tour

Python ships with a library large enough that many programs need nothing else. This module walks through the modules you'll reach for weekly, with the idiomatic one-liner for each. Knowing these by name saves you from re-implementing them badly.

## `collections`

```python
from collections import Counter, defaultdict, deque, namedtuple

Counter("mississippi").most_common(2)       # [('i', 4), ('s', 4)]
groups = defaultdict(list); groups["k"].append(1)
q = deque(maxlen=3); q.append(1)            # bounded queue, O(1) at both ends
Point = namedtuple("Point", "x y")
```

## `itertools`

```python
from itertools import chain, count, islice, groupby, product, combinations, accumulate

list(chain([1, 2], [3]))                    # [1, 2, 3]
list(islice(count(), 5))                    # first five of an infinite iterator
for key, grp in groupby(sorted(words, key=len), key=len): ...   # requires sorted input
list(product("ab", repeat=2))               # aa ab ba bb
list(combinations([1, 2, 3], 2))            # (1,2) (1,3) (2,3)
list(accumulate([1, 2, 3]))                 # running totals: 1 3 6
```

`groupby` walks its input and yields `(key, group)` pairs, starting a new group whenever the key changes, so it groups *neighbouring* equal items: `groupby("aabaa")` gives groups for `aa`, `b`, `aa`. Sort first when you want one group per key. Each group is an iterator; `list(group)` shows it.

## `functools`

```python
from functools import cache, partial, reduce

@cache
def fib(n): return n if n < 2 else fib(n - 1) + fib(n - 2)

square = partial(pow, exp=2)
reduce(lambda a, b: a * b, [1, 2, 3, 4])    # 24
```

## `datetime`

```python
from datetime import date, datetime, timedelta

today = date.today()
date(2024, 3, 1) - date(2024, 2, 1)         # timedelta(days=29)
datetime(2024, 1, 31) + timedelta(days=1)
date.fromisoformat("2024-05-06").strftime("%d %b %Y")   # '06 May 2024'
```

Use timezone-aware datetimes (`datetime.now(timezone.utc)`) for anything stored or compared.

## `re`

```python
import re

re.findall(r"\d+", "a1b22c333")             # ['1', '22', '333']
m = re.search(r"(\w+)@(\w+)\.com", text); m.group(1)
re.sub(r"\s+", " ", text)
pattern = re.compile(r"^[A-Z]{2}\d{4}$")   # compile when reused
```

## `math`, `statistics`, `random`

```python
math.floor, math.ceil, math.isclose(a, b), math.inf
statistics.mean, median, stdev
random.choice(seq), random.sample(seq, k), random.shuffle(seq)
```

## `enum`

```python
from enum import Enum, auto

class Color(Enum):
    RED = auto()
    GREEN = auto()

Color.RED.name, Color["GREEN"], list(Color)
```

## Others worth knowing

`string.ascii_letters`, `textwrap.dedent`, `heapq` (priority queues), `bisect` (binary search), `copy.deepcopy`, `secrets` (tokens), `hashlib`, `uuid`, `logging`, `argparse`, `subprocess`, `shutil`, `tempfile`, `unittest`.

```python playground
from collections import Counter, defaultdict
from itertools import groupby
from datetime import date, timedelta
import re

log = """2024-05-01 ERROR disk full
2024-05-01 INFO started
2024-05-02 ERROR timeout
2024-05-02 ERROR disk full"""

levels = Counter(re.findall(r"\b(ERROR|INFO)\b", log))
print(levels)

by_day = defaultdict(list)
for line in log.splitlines():
    day, level, *msg = line.split()
    by_day[day].append(" ".join(msg))
print(dict(by_day))

start = date(2024, 5, 1)
print([str(start + timedelta(days=i)) for i in range(3)])

# Try: find the most common error message with Counter.
```

## Exercises

### 1. Top words

`top_words(text, n)` returns the `n` most common words (lowercased, punctuation stripped) as `(word, count)` tuples, using `collections.Counter`. Ties break alphabetically.

```python starter
def top_words(text, n):
    ...
```

```python test
def test_top_words():
    """most common words, ties alphabetical"""
    text = "The cat. The dog! the bird, a cat"
    assert top_words(text, 2) == [("the", 3), ("cat", 2)]
    assert top_words("b a b a c", 3) == [("a", 2), ("b", 2), ("c", 1)]

def test_case_and_punctuation():
    """ignores case and punctuation"""
    assert top_words("Go, go, GO! Stop... stop? wait", 3) == [("go", 3), ("stop", 2), ("wait", 1)]

def test_tie_at_the_cut():
    """a tie at the cut-off keeps the alphabetically first"""
    assert top_words("d c b a d c", 2) == [("c", 2), ("d", 2)]
    assert top_words("z y x", 1) == [("x", 1)]

def test_short_input():
    """fewer words than n, or none"""
    assert top_words("x y x", 5) == [("x", 2), ("y", 1)]
    assert top_words("", 3) == []
```

#### Uses
- [Standard library tour › `collections`](#/stdlib/collections)
- [Standard library tour › `re`](#/stdlib/re)
- [Lists and tuples › Sorting with a key](#/lists-tuples/sorting-with-a-key)
- [Dicts and sets › Iterating](#/dicts-sets/iterating)
- [Reference › Strings](#/reference/strings)

#### Hints
- Lowercase the text with `text.lower()`, then pull out the words with `re.findall(r"\w+", ...)`, which skips spaces and punctuation.
- `Counter(words)` does the counting, and its `.items()` gives `(word, count)` pairs.
- `most_common` breaks ties by first appearance, not alphabetically. Sort the pairs yourself with a key like `(-count, word)` and slice off the first `n`.

#### Tips
- `\w` also matches digits and underscores. For letters only, use `[a-z]+` on the lowercased text.
- `most_common(n)` looks like the answer but orders ties by first appearance. Sorting the pairs yourself with `key=lambda kv: (-kv[1], kv[0])` is what makes the tie-break alphabetical.
- Slicing `[:n]` past the end is safe, so asking for more words than the text has needs no check.
- `Counter` is a dict subclass, so `.items()`, `.get()` and `in` all work on it as usual.

#### Docs
- [`collections.Counter`](https://docs.python.org/3/library/collections.html#collections.Counter)
- [`re.findall`](https://docs.python.org/3/library/re.html#re.findall)

### 2. Running balance

`balances(transactions)` returns the running balance after each transaction, as a list, using `itertools.accumulate`. The input list is left unchanged.

```python starter
def balances(transactions):
    ...
```

```python test
def test_running():
    """running totals"""
    assert balances([100, -30, 50]) == [100, 70, 120]
    assert balances([-10, -5, 20, 0.5]) == [-10, -15, 5, 5.5]

def test_short():
    """empty and single transactions"""
    assert balances([]) == []
    assert balances([42]) == [42]

def test_unchanged():
    """returns a new list and leaves the input alone"""
    data = [1, 2, 3]
    result = balances(data)
    assert result == [1, 3, 6]
    assert data == [1, 2, 3]
    assert type(result) is list
```

#### Uses
- [Standard library tour › `itertools`](#/stdlib/itertools)
- [Iterators and generators › Useful built-ins](#/generators/useful-built-ins)

#### Hints
- `from itertools import accumulate`. It yields the running totals of whatever you give it.
- It's lazy like the rest of `itertools`, so wrap it in `list(...)` to get a list back.

#### Tips
- `accumulate` takes an optional function: `accumulate(xs, max)` gives the running maximum instead of the running sum.
- `list(accumulate([]))` is `[]`, so the empty case needs no branch.
- `accumulate` reads its input without touching it, and `list(...)` builds a new list, which is how the "input unchanged" test passes for free.

#### Docs
- [`itertools.accumulate`](https://docs.python.org/3/library/itertools.html#itertools.accumulate)

### 3. Extract dates

`extract_dates(text)` returns every `YYYY-MM-DD` date in `text` as `datetime.date` objects, in order of appearance, using `re` and `date.fromisoformat`.

```python starter
def extract_dates(text):
    ...
```

```python test
from datetime import date

def test_dates():
    """finds ISO dates"""
    text = "from 2024-01-15 to 2024-02-01, not 2024-1-5"
    assert extract_dates(text) == [date(2024, 1, 15), date(2024, 2, 1)]
    assert extract_dates("2023-12-31") == [date(2023, 12, 31)]

def test_order_and_repeats():
    """keeps the order of appearance and repeats"""
    text = "2025-03-01 came after 1999-07-04, then 2025-03-01 again"
    assert extract_dates(text) == [date(2025, 3, 1), date(1999, 7, 4), date(2025, 3, 1)]

def test_none():
    """no dates gives an empty list"""
    assert extract_dates("no dates here") == []
    assert extract_dates("") == []
```

#### Uses
- [Standard library tour › `re`](#/stdlib/re)
- [Standard library tour › `datetime`](#/stdlib/datetime)
- [Comprehensions › List comprehensions](#/comprehensions/list-comprehensions)

#### Hints
- `\d{4}` matches exactly four digits. Build a pattern for four digits, a dash, two digits, a dash, two digits.
- `re.findall` returns the matching strings in order. Turn each one into a date with `date.fromisoformat` (`from datetime import date`).

#### Tips
- `2024-1-5` isn't matched because `\d{2}` needs two digits, which is what the test wants. Put `\b` at both ends of the pattern if dates might be glued to other digits.
- Write regex patterns as raw strings, `r"\d{4}"`. In a normal string `\d` is fine today but `\b` means backspace, and Python warns about the rest.
- Groups change what `findall` returns: with one `(...)` it hands back the group, not the whole match. Keep this pattern group-free, or use `re.finditer` and `m.group(0)`.
- `date.fromisoformat` raises `ValueError` on a real date that isn't valid, like `"2024-02-31"`. The regex checks shape, not meaning.

#### Docs
- [`re.findall`](https://docs.python.org/3/library/re.html#re.findall)
- [`date.fromisoformat`](https://docs.python.org/3/library/datetime.html#datetime.date.fromisoformat)

### 4. Group consecutive runs

`runs(values)` compresses consecutive repeats into `(value, count)` pairs with `itertools.groupby`: `"aaabcc"` becomes `[("a", 3), ("b", 1), ("c", 2)]`.

```python starter
def runs(values):
    ...
```

```python test
def test_runs():
    """run-length encodes"""
    assert runs("aaabcc") == [("a", 3), ("b", 1), ("c", 2)]
    assert runs([1, 1, 2, 1]) == [(1, 2), (2, 1), (1, 1)]
    assert runs("") == []

def test_single_run():
    """one long run, or one item"""
    assert runs([7, 7, 7, 7]) == [(7, 4)]
    assert runs("x") == [("x", 1)]

def test_alternating():
    """every change starts a new run"""
    assert runs("abab") == [("a", 1), ("b", 1), ("a", 1), ("b", 1)]
    assert runs([True, False, False, True]) == [(True, 1), (False, 2), (True, 1)]
```

#### Uses
- [Standard library tour › `itertools`](#/stdlib/itertools)
- [Comprehensions › List comprehensions](#/comprehensions/list-comprehensions)
- [Lists and tuples › Unpacking](#/lists-tuples/unpacking)

#### Hints
- With no `key`, `groupby(values)` yields one `(value, group)` pair per run of equal neighbours. No sorting here: the runs are the point.
- Each group is an iterator, not a list, so `len(group)` fails. `len(list(group))` counts it.
- A list comprehension over those pairs builds the answer.

#### Tips
- This is also why `groupby` needs sorted input when you want one group per key: it only ever compares neighbours.
- Each group is only valid until you advance to the next one. Consume it (`list(group)`, or `len(list(group))`) inside the loop; keeping the iterator for later gives you an empty one.
- `runs("")` yields nothing, so the empty case falls out of the comprehension with no special handling.

#### Docs
- [`itertools.groupby`](https://docs.python.org/3/library/itertools.html#itertools.groupby)
