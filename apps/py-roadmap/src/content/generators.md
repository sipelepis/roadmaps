# Iterators and generators

Everything Python loops over is an *iterable*, and `for` works by asking it for an *iterator* and calling `next()` until it's exhausted. Generators are the easy way to write your own: a function with `yield` produces values lazily, one at a time, keeping its place between calls.

## The protocol

```python
it = iter([1, 2, 3])
next(it)     # 1
next(it)     # 2
next(it)     # 3
next(it)     # StopIteration
```

`for x in xs:` is exactly this loop with the `StopIteration` handled. Any object with `__iter__` returning an object with `__next__` works.

## Generator functions

```python
def countdown(n):
    while n > 0:
        yield n
        n -= 1

for i in countdown(3):
    print(i)             # 3 2 1

list(countdown(3))       # [3, 2, 1]
```

Calling `countdown(3)` runs *no code*; it returns a generator object. Each `next()` runs until the next `yield`. When the function returns, the generator is done.

## Why lazy matters

```python
def read_lines(path):
    with open(path) as f:
        for line in f:
            yield line.rstrip("\n")

first_error = next(line for line in read_lines("huge.log") if "ERROR" in line)
```

Nothing after the first match is ever read. Generators let you process data larger than memory and stop early for free.

## Generators are single-use

```python
g = (x * x for x in range(3))
list(g)     # [0, 1, 4]
list(g)     # []  exhausted
```

If you need to iterate twice, make a list, or call the generator function again.

## Infinite generators

```python
def naturals():
    n = 0
    while True:
        yield n
        n += 1
```

Pair them with `itertools.islice`, `zip` (stops at the shortest), or a `break`.

## `yield from`

Delegates to another iterable, flattening one level:

```python
def walk(tree):
    yield tree.value
    for child in tree.children:
        yield from walk(child)
```

## Useful built-ins

`enumerate`, `zip`, `map`, `filter`, `reversed`, and `range` are all lazy. `itertools` (next in the Standard library module) has the rest: `chain`, `islice`, `groupby`, `product`, `accumulate`.

```python playground
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

from itertools import islice
print(list(islice(fibonacci(), 10)))

def evens(limit):
    for n in range(limit):
        if n % 2 == 0:
            yield n

e = evens(10)
print(next(e), next(e))
print(list(e))       # the rest
print(list(e))       # exhausted

# Try: find the first Fibonacci number above 1000 with next() and a generator expression.
```

## Exercises

### 1. Countdown

`countdown(n)` is a generator yielding `n`, `n-1`, … `1`.

```python starter
def countdown(n):
    ...
```

```python test
import types

def test_countdown():
    """yields n down to 1"""
    assert list(countdown(3)) == [3, 2, 1]
    assert list(countdown(0)) == []

def test_is_generator():
    """is a generator, not a list"""
    assert isinstance(countdown(3), types.GeneratorType)
```

### 2. Chunks, lazily

`chunks(iterable, size)` yields lists of at most `size` items from *any* iterable (including generators you can't index). The last chunk may be shorter.

```python starter
def chunks(iterable, size):
    ...
```

```python test
def test_chunks():
    """chunks a list"""
    assert list(chunks([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]

def test_generator_input():
    """works on a generator input"""
    assert list(chunks((i for i in range(4)), 3)) == [[0, 1, 2], [3]]
```

### 3. Infinite primes

`primes()` is an infinite generator of prime numbers: 2, 3, 5, 7, …

```python starter
def primes():
    ...
```

```python test
from itertools import islice

def test_first_primes():
    """first ten primes"""
    assert list(islice(primes(), 10)) == [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]

def test_lazy():
    """stops early without computing everything"""
    assert next(p for p in primes() if p > 100) == 101
```

### 4. Flatten nested lists

`flatten(nested)` yields every non-list element from arbitrarily nested lists, in order. Use recursion with `yield from`.

```python starter
def flatten(nested):
    ...
```

```python test
def test_flatten():
    """flattens any depth"""
    assert list(flatten([1, [2, [3, [4]], 5], []])) == [1, 2, 3, 4, 5]
```
