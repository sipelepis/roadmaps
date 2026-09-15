# Advanced patterns

You now have every building block. This module collects idioms that experienced Python programmers reach for: context managers from generators, structural pattern matching on data, `__slots__`, enums as state, and `functools` for caching and dispatch. None of them are exotic; all of them make code shorter and safer.

## `contextlib.contextmanager`

```python
from contextlib import contextmanager

@contextmanager
def changed_dir(path):
    old = os.getcwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(old)
```

Everything before `yield` is `__enter__`, everything after is `__exit__`. The `try/finally` guarantees cleanup on exceptions. `contextlib.suppress(FileNotFoundError)` and `contextlib.closing` are two ready-made ones.

## Structural pattern matching

```python
match event:
    case {"type": "click", "x": x, "y": y}:
        handle_click(x, y)
    case {"type": "key", "key": str(k)} if k.isalpha():
        handle_key(k)
    case Point(x=0, y=0):
        print("origin")
    case [first, *rest]:
        print(first, rest)
    case _:
        raise ValueError(event)
```

Patterns destructure dicts, sequences, and class instances, with guards. It replaces chains of `isinstance` and key checks.

## `functools.cache` and `lru_cache`

```python
@cache
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

Arguments must be hashable. `lru_cache(maxsize=128)` bounds memory. `cache_info()` reports hits and misses.

## `singledispatch`

Overloading by the type of the first argument:

```python
from functools import singledispatch

@singledispatch
def render(value):
    return str(value)

@render.register
def _(value: list):
    return ", ".join(render(v) for v in value)

@render.register
def _(value: dict):
    return "; ".join(f"{k}={render(v)}" for k, v in value.items())
```

## Enums for state

```python
from enum import Enum

class State(Enum):
    PENDING = "pending"
    DONE = "done"

State("done") is State.DONE     # parse from a value
```

Enum members are singletons, so compare with `is` or `==`; both work.

## `__slots__`

```python
class Point:
    __slots__ = ("x", "y")
```

No per-instance `__dict__`: smaller, faster, and typos in attribute names raise instead of silently creating a new attribute.

## Walrus operator

```python
if (n := len(data)) > 10:
    print(f"too many: {n}")

while chunk := f.read(4096):
    process(chunk)
```

Assign inside an expression when it removes a duplicated call.

## Keyword-only and positional-only, revisited

Design APIs with `*` so options are always named at call sites, and `/` where the parameter names are meaningless (`pow(base, exp, /)`).

```python playground
from contextlib import contextmanager
from functools import cache, singledispatch
from enum import Enum

@contextmanager
def tag(name):
    print(f"<{name}>")
    yield
    print(f"</{name}>")

with tag("ul"):
    with tag("li"):
        print("item")

@cache
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
print(fib(80), fib.cache_info().hits, "cache hits")

def area(shape):
    match shape:
        case {"kind": "circle", "r": r}:
            return 3.14159 * r * r
        case {"kind": "rect", "w": w, "h": h}:
            return w * h
        case _:
            raise ValueError(f"unknown shape {shape}")
print(area({"kind": "rect", "w": 2, "h": 3}))

# Try: give area() a shape it doesn't know.
```

## Exercises

### 1. Generator context manager

`timer(log)` is a context manager (built with `@contextmanager`) that appends the elapsed seconds (a float) to `log` when the block ends, even if it raises.

```python starter
from contextlib import contextmanager
import time
```

```python test
def test_timer():
    """appends elapsed time"""
    log = []
    with timer(log):
        pass
    assert len(log) == 1 and isinstance(log[0], float)

def test_timer_on_error():
    """still logs when the block raises"""
    log = []
    try:
        with timer(log):
            raise RuntimeError
    except RuntimeError:
        assert len(log) == 1
        return
    assert False
```

#### Uses
- [Advanced patterns › `contextlib.contextmanager`](#/advanced-patterns/contextlib-contextmanager)
- [Dunder methods and protocols › Callable and context manager](#/dunder-protocols/callable-and-context-manager)

#### Hints
- Write a generator function decorated with `@contextmanager`. Note `time.perf_counter()` before the `yield` and take the difference after it.
- If the block raises, code after a bare `yield` never runs. Put the `yield` inside `try` and the append in `finally`, like `changed_dir` in the article.

#### Tips
- `perf_counter` is the clock for measuring durations. `time.time()` follows the wall clock, which can jump when the system time is adjusted.

#### Docs
- [`contextlib.contextmanager`](https://docs.python.org/3/library/contextlib.html#contextlib.contextmanager)
- [`time.perf_counter`](https://docs.python.org/3/library/time.html#time.perf_counter)

### 2. Match on shapes

`describe(value)` uses `match` to return: `"origin"` for `(0, 0)`, `"on x axis"` for `(x, 0)`, `"on y axis"` for `(0, y)`, `"point"` for any other 2-tuple, `"empty"` for `[]`, `"list of <n>"` for other lists, and `"unknown"` for anything else.

```python starter
def describe(value):
    ...
```

```python test
def test_describe():
    """structural patterns"""
    assert describe((0, 0)) == "origin"
    assert describe((3, 0)) == "on x axis"
    assert describe((0, -2)) == "on y axis"
    assert describe((1, 1)) == "point"
    assert describe([]) == "empty"
    assert describe([1, 2, 3]) == "list of 3"
    assert describe("x") == "unknown"
```

#### Uses
- [Advanced patterns › Structural pattern matching](#/advanced-patterns/structural-pattern-matching)
- [Control flow › `match`](#/control-flow/match)

#### Hints
- The first matching `case` wins, so go from specific to general: `(0, 0)`, then `(x, 0)` and `(0, y)`, then `(x, y)`.
- Literal values in a pattern must be equal; plain names like `x` capture whatever is there.
- `case []:` matches only an empty sequence. For any other list, the class pattern `case list():` checks the type, and `len(value)` gives the count. `case _:` catches the rest.

#### Tips
- Sequence patterns match lists and tuples alike, so `describe([0, 0])` also says `"origin"`. A class pattern such as `tuple((0, 0))` is how to insist on a tuple when it matters.

#### Docs
- [Python tutorial: `match` statements](https://docs.python.org/3/tutorial/controlflow.html#match-statements)
- [Language reference: The `match` statement](https://docs.python.org/3/reference/compound_stmts.html#the-match-statement)

### 3. Memoised recursion

`ways(n)` counts the ways to climb `n` stairs taking 1 or 2 steps at a time (`ways(1)=1`, `ways(2)=2`, `ways(3)=3`). Use recursion with `functools.cache` so `ways(90)` is instant.

```python starter
from functools import cache

def ways(n):
    ...
```

```python test
def test_ways():
    """counts stair climbs"""
    assert [ways(n) for n in range(1, 6)] == [1, 2, 3, 5, 8]

def test_fast():
    """large n is fine thanks to caching"""
    assert ways(90) == 4660046610375530309
```

#### Uses
- [Advanced patterns › `functools.cache` and `lru_cache`](#/advanced-patterns/functools-cache-and-lru-cache)
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)

#### Hints
- Your last move was either 1 step or 2, so the ways to reach `n` are the ways to reach `n - 1` plus the ways to reach `n - 2`.
- The base cases stop the recursion: `ways(1)` is 1 and `ways(2)` is 2.
- Put `@cache` directly above `def ways`. Without it, `ways(90)` makes billions of calls.

#### Tips
- These are the Fibonacci numbers, shifted by one. A loop that keeps only the last two values also works, with no recursion and no cache.

#### Docs
- [`functools.cache`](https://docs.python.org/3/library/functools.html#functools.cache)

### 4. Single dispatch

`to_text(value)` renders: numbers as-is via `str`, strings quoted with double quotes, lists as comma-separated rendered items in brackets, and dicts as `key: value` pairs in braces, with keys and values both rendered by `to_text`. Separate items and pairs with `", "`. Use `functools.singledispatch`.

```python starter
from functools import singledispatch

@singledispatch
def to_text(value):
    return str(value)
```

```python test
def test_to_text():
    """dispatches on type"""
    assert to_text(3) == "3"
    assert to_text("hi") == '"hi"'
    assert to_text([1, "a"]) == '[1, "a"]'
    assert to_text({"k": [1]}) == '{"k": [1]}'
```

#### Uses
- [Advanced patterns › `singledispatch`](#/advanced-patterns/singledispatch)
- [Functions › `*args` and `**kwargs`](#/functions/args-and-kwargs)
- [Dicts and sets › Iterating](#/dicts-sets/iterating)

#### Hints
- Register one function per type with `@to_text.register` and an annotated parameter (`value: str`), as in the article. Numbers need nothing new: the base function already handles them.
- The list and dict versions call `to_text` on their contents, so nested values come out right.
- `", ".join(...)` glues the rendered parts together; add the brackets or braces around the result with `+`.

#### Tips
- In an f-string a literal brace is written twice: `f"{{{inner}}}"` gives `{`, then `inner`, then `}`. Plain `+` is often easier to read.

#### Docs
- [`functools.singledispatch`](https://docs.python.org/3/library/functools.html#functools.singledispatch)
