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

#### Uses
- [Iterators and generators › Generator functions](#/generators/generator-functions)
- [What is Python? › Functions and `return`](#/intro/functions-and-return)

#### Hints
- Any function with `yield` in its body is a generator. Instead of building a list, hand out one number at a time.
- Loop while `n > 0`: yield `n`, then take one off it.

#### Tips
- `countdown(0)` should yield nothing at all. A loop whose condition is false from the start gets that right for free.

#### Docs
- [Python tutorial: Generators](https://docs.python.org/3/tutorial/classes.html#generators)

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

#### Uses
- [Iterators and generators › The protocol](#/generators/the-protocol)
- [Iterators and generators › Generator functions](#/generators/generator-functions)
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [Variables and types › Truthiness](#/variables-types/truthiness)

#### Hints
- You can't slice or index a generator, but you can always `for` over it. Collect items into a list as they arrive.
- When that list holds `size` items, `yield` it and start a new empty list.
- After the loop, a partly filled list may be left over. Yield it only if it isn't empty.

#### Tips
- Start a new list with `chunk = []` rather than emptying the old one: the caller may still be holding the list you just yielded.

#### Docs
- [Glossary: iterable](https://docs.python.org/3/glossary.html#term-iterable)
- [Python tutorial: Generators](https://docs.python.org/3/tutorial/classes.html#generators)

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

#### Uses
- [Iterators and generators › Infinite generators](#/generators/infinite-generators)
- [Comprehensions › Generator expressions](#/comprehensions/generator-expressions)
- [Lists and tuples › Useful built-ins](#/lists-tuples/useful-built-ins)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- Start at `n = 2` and count up forever with `while True`, like `naturals()` in the article.
- Keep a list of the primes found so far. `n` is prime when none of them divides it evenly (`n % p` is never `0`).
- `all(...)` over a generator expression does that check in one line. `all` of an empty sequence is `True`, which is what lets `2` through.

#### Tips
- Only primes up to the square root of `n` can divide it, so you can stop checking there if you want it faster.

#### Docs
- [Python tutorial: Generators](https://docs.python.org/3/tutorial/classes.html#generators)
- [Built-in functions: `all`](https://docs.python.org/3/library/functions.html#all)

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

#### Uses
- [Iterators and generators › `yield from`](#/generators/yield-from)
- [Variables and types › The core types](#/variables-types/the-core-types)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- Loop over `nested`. Each item is either a list or a plain value, and `isinstance(item, list)` tells them apart.
- Yield plain values as they are.
- For a list, call `flatten(item)` and pass on everything it yields with `yield from`.

#### Tips
- An empty inner list yields nothing, so `[]` disappears without any special case.

#### Docs
- [Language reference: Yield expressions](https://docs.python.org/3/reference/expressions.html#yield-expressions)
