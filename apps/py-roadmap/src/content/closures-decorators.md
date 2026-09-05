# Closures and decorators

Functions can be defined inside other functions and returned from them. The inner function remembers the variables of its enclosing scope, which is called a closure. A decorator is a closure with a convention: it takes a function and returns a replacement, and the `@` syntax applies it at definition time.

## Closures

```python
def make_multiplier(factor):
    def multiply(x):
        return x * factor      # factor is captured from the outer scope
    return multiply

double = make_multiplier(2)
double(5)                      # 10
```

Each call to `make_multiplier` creates a new `multiply` with its own `factor`. To *reassign* a captured variable, declare it `nonlocal`:

```python
def counter():
    count = 0
    def inc():
        nonlocal count
        count += 1
        return count
    return inc
```

## Decorators

```python
def log_calls(fn):
    def wrapper(*args, **kwargs):
        print(f"calling {fn.__name__}")
        return fn(*args, **kwargs)
    return wrapper

@log_calls
def add(a, b):
    return a + b
```

`@log_calls` is sugar for `add = log_calls(add)`. The wrapper takes `*args, **kwargs` so it works for any signature.

## `functools.wraps`

Without it, the decorated function's name and docstring are the wrapper's. Always use it:

```python
from functools import wraps

def log_calls(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        ...
    return wrapper
```

## Decorators with arguments

One more layer: a function that returns a decorator.

```python
def repeat(times):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(3)
def hello():
    print("hi")
```

## Decorators in the wild

`@property`, `@classmethod`, `@staticmethod`, `@functools.cache`, `@dataclass`, and every web framework's `@app.route`. Reading them as "apply this function to the definition" demystifies all of them.

## Stacking

```python
@a
@b
def f(): ...      # f = a(b(f)), the bottom one applies first
```

```python playground
from functools import wraps
import time

def timed(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = fn(*args, **kwargs)
        print(f"{fn.__name__} took {(time.perf_counter() - start) * 1000:.2f} ms")
        return result
    return wrapper

@timed
def slow_sum(n):
    """Sum the first n squares."""
    return sum(i * i for i in range(n))

print(slow_sum(100_000))
print(slow_sum.__name__, "-", slow_sum.__doc__)

# Try: remove @wraps and print slow_sum.__name__ again.
```

## Exercises

### 1. Counter factory

`make_counter()` returns a function that returns `1`, then `2`, then `3`, … on successive calls. Two counters are independent.

```python starter
def make_counter():
    ...
```

```python test
def test_counts():
    """counts up"""
    c = make_counter()
    assert (c(), c(), c()) == (1, 2, 3)

def test_independent():
    """counters are independent"""
    a, b = make_counter(), make_counter()
    a(); a()
    assert b() == 1
```

### 2. Memoize

Write a `memoize` decorator that caches results by positional arguments, so the wrapped function runs at most once per distinct input. Preserve the function's name with `functools.wraps`.

```python starter
def memoize(fn):
    ...
```

```python test
def test_caches():
    """calls the function once per input"""
    calls = []
    @memoize
    def square(n):
        """square it"""
        calls.append(n)
        return n * n
    assert square(4) == 16 and square(4) == 16 and square(5) == 25
    assert calls == [4, 5]

def test_wraps():
    """keeps the name and docstring"""
    @memoize
    def named():
        """doc"""
    assert named.__name__ == "named" and named.__doc__ == "doc"
```

### 3. Retry decorator with arguments

`retry(times)` returns a decorator that retries the function up to `times` attempts when it raises, re-raising the last error.

```python starter
def retry(times):
    ...
```

```python test
def test_retry():
    """retries until success"""
    calls = []
    @retry(3)
    def flaky():
        calls.append(1)
        if len(calls) < 2:
            raise RuntimeError("no")
        return "ok"
    assert flaky() == "ok" and len(calls) == 2

def test_gives_up():
    """re-raises after the last attempt"""
    @retry(2)
    def broken():
        raise ValueError("bad")
    try:
        broken()
    except ValueError:
        return
    assert False
```

### 4. Validate arguments

`positive` is a decorator that raises `ValueError` if any positional argument is not greater than zero, before calling the function.

```python starter
def positive(fn):
    ...
```

```python test
def test_passes_through():
    """calls through with valid args"""
    @positive
    def area(w, h):
        return w * h
    assert area(2, 3) == 6

def test_rejects():
    """rejects non-positive args"""
    @positive
    def area(w, h):
        return w * h
    try:
        area(2, 0)
    except ValueError:
        return
    assert False
```
