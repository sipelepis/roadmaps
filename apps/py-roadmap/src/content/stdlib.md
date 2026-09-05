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
from itertools import chain, islice, groupby, product, combinations, accumulate

list(chain([1, 2], [3]))                    # [1, 2, 3]
list(islice(count(), 5))                    # first five of an infinite iterator
for key, grp in groupby(sorted(words, key=len), key=len): ...   # requires sorted input
list(product("ab", repeat=2))               # aa ab ba bb
list(combinations([1, 2, 3], 2))            # (1,2) (1,3) (2,3)
list(accumulate([1, 2, 3]))                 # running totals: 1 3 6
```

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
```

### 2. Running balance

`balances(transactions)` returns the running balance after each transaction using `itertools.accumulate`.

```python starter
def balances(transactions):
    ...
```

```python test
def test_running():
    """running totals"""
    assert balances([100, -30, 50]) == [100, 70, 120]
    assert balances([]) == []
```

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
```

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
```
