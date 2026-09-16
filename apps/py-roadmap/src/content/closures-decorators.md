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

A closure captures the *variable*, not its value at the time, which is the classic trap when you build functions in a loop:

```python
fns = []
for i in range(3):
    fns.append(lambda: i)

[f() for f in fns]      # [2, 2, 2], not [0, 1, 2]
```

All three closures share the one `i`, and by the time they run it is `2`. Bind the value with a default argument, which is evaluated at definition time:

```python
fns = [lambda i=i: i for i in range(3)]
[f() for f in fns]      # [0, 1, 2]
```

`functools.partial(fn, i)` does the same job with less sleight of hand.

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

## Raising and catching in a wrapper

A wrapper runs before and after the real function, so it's the natural place to reject bad input or react when the call fails. `raise` stops with an error; `try` / `except` catches one:

```python
def no_negatives(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        for a in args:
            if a < 0:
                raise ValueError(f"negative argument: {a}")   # stop here, fn never runs
        try:
            return fn(*args, **kwargs)
        except ZeroDivisionError:
            print("division failed")
            raise                                             # re-raise the same error
    return wrapper
```

If anything in the `try` block raises a matching error, Python jumps to the `except` block instead of crashing. `except Exception:` matches any ordinary error. A bare `raise` inside `except` sends the caught error on to the caller unchanged. The Errors and exceptions module covers all of this in depth.

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
    d = make_counter()
    assert [d() for _ in range(10)] == [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

def test_independent():
    """counters are independent"""
    a, b = make_counter(), make_counter()
    a(); a()
    assert b() == 1
    assert a() == 3
    assert b() == 2

def test_new_counter_keeps_old():
    """a new counter doesn't reset an old one"""
    a = make_counter()
    a(); a()
    b = make_counter()
    assert b() == 1
    assert a() == 3
```

#### Uses
- [Closures and decorators › Closures](#/closures-decorators/closures)
- [Functions › Scope](#/functions/scope)

#### Hints
- Keep the count in a local variable of `make_counter`, and define an inner function that adds one to it and returns it.
- The inner function reassigns the count, so it needs `nonlocal`. Return the inner function itself, not the result of calling it.

#### Tips
- Each call to `make_counter()` runs its body again and makes a fresh count, which is why two counters never interfere.
- Without `nonlocal`, `count += 1` makes `count` a local of the inner function and fails with `UnboundLocalError` — it reads a name it is also assigning.
- `nonlocal` is only needed to *rebind*. A closure over a list could `append` to it with no declaration at all, since that mutates rather than reassigns.

#### Docs
- [Language reference: The `nonlocal` statement](https://docs.python.org/3/reference/simple_stmts.html#nonlocal)

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

def test_several_args():
    """keys the cache on all the arguments"""
    calls = []
    @memoize
    def power(base, exp):
        calls.append((base, exp))
        return base ** exp
    assert power(2, 3) == 8 and power(3, 2) == 9 and power(2, 5) == 32
    assert power(2, 3) == 8
    assert calls == [(2, 3), (3, 2), (2, 5)]

def test_falsy_results():
    """caches results like 0 and False too"""
    calls = []
    @memoize
    def is_even(n):
        calls.append(n)
        return n % 2 == 0
    assert is_even(3) is False and is_even(3) is False
    assert is_even(0) is True and is_even(0) is True
    assert calls == [3, 0]

def test_separate_caches():
    """each decorated function has its own cache"""
    @memoize
    def double(n):
        return n * 2
    @memoize
    def triple(n):
        return n * 3
    assert double(3) == 6 and triple(3) == 9

def test_wraps():
    """keeps the name and docstring"""
    @memoize
    def named():
        """doc"""
    assert named.__name__ == "named" and named.__doc__ == "doc"
```

#### Uses
- [Closures and decorators › Decorators](#/closures-decorators/decorators)
- [Closures and decorators › `functools.wraps`](#/closures-decorators/functools-wraps)
- [Functions › `*args` and `**kwargs`](#/functions/args-and-kwargs)
- [Dicts and sets › Dict basics](#/dicts-sets/dict-basics)

#### Hints
- Create a dict inside `memoize` but outside the wrapper, so one cache lives as long as the decorated function.
- The wrapper takes `*args`. `args` is a tuple, so it works as a dict key as it is.
- If the key isn't in the cache, call `fn(*args)` and store the result; then return the stored value. Add `@wraps(fn)` to the wrapper (`from functools import wraps`).

#### Tips
- Only hashable arguments can be keys: calling it with a list raises `TypeError`. The built-in `functools.cache` has the same limit.
- Use `if key not in cache:` rather than `if not cache.get(key):`. A cached `0`, `False` or `None` is a real result, and the truthiness version would recompute it every time — which is what one of the tests checks.
- An unbounded cache is a memory leak with good manners. `functools.lru_cache(maxsize=1000)` is the version to reach for on anything long-running.

#### Docs
- [`functools.wraps`](https://docs.python.org/3/library/functools.html#functools.wraps)

### 3. Retry decorator with arguments

`retry(times)` returns a decorator that retries the function up to `times` attempts when it raises, re-raising the last error. The wrapped function takes the same arguments as the original.

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

def test_first_try():
    """no retries when the first attempt works"""
    calls = []
    @retry(5)
    def fine():
        calls.append(1)
        return 42
    assert fine() == 42 and len(calls) == 1

def test_gives_up():
    """re-raises the last error after exactly `times` attempts"""
    calls = []
    @retry(3)
    def broken():
        calls.append(1)
        raise ValueError(f"attempt {len(calls)}")
    try:
        broken()
    except ValueError as e:
        assert str(e) == "attempt 3"
        assert len(calls) == 3
        return
    assert False, "expected ValueError"

def test_single_attempt():
    """retry(1) tries once"""
    calls = []
    @retry(1)
    def broken():
        calls.append(1)
        raise KeyError("k")
    try:
        broken()
    except KeyError:
        assert len(calls) == 1
        return
    assert False, "expected KeyError"

def test_arguments():
    """passes arguments through"""
    @retry(2)
    def add(a, b):
        return a + b
    assert add(2, 3) == 5
    assert add(2, b=10) == 12
```

#### Uses
- [Closures and decorators › Decorators with arguments](#/closures-decorators/decorators-with-arguments)
- [Closures and decorators › Raising and catching in a wrapper](#/closures-decorators/raising-and-catching-in-a-wrapper)
- [Control flow › `for` iterates over things](#/control-flow/for-iterates-over-things)

#### Hints
- Three layers, like `repeat` in the article: `retry(times)` returns a decorator, and the decorator returns a wrapper.
- In the wrapper, loop `times` times and `try` to `return fn(*args, **kwargs)`. A success leaves the function right away.
- In `except Exception:`, re-raise with a bare `raise` only on the last attempt. On earlier attempts do nothing and let the loop go round again.

#### Tips
- Real retry helpers usually wait between attempts and retry only errors worth retrying, like timeouts. A typo in your code won't fix itself on the third try.
- `@retry(3)` calls `retry(3)` first and applies the result. That extra pair of brackets is the difference between a decorator and a decorator factory, and forgetting them passes the function in as `times`.
- The wrapper must forward `**kwargs` as well as `*args`, or `add(2, b=10)` in the last test fails with a `TypeError`.

#### Docs
- [Python tutorial: Handling exceptions](https://docs.python.org/3/tutorial/errors.html#handling-exceptions)

### 4. Validate arguments

`positive` is a decorator that raises `ValueError` if any positional argument is not greater than zero, before calling the function. Keyword arguments are passed through to the function.

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
    assert area(0.5, 4) == 2.0
    assert area(2, h=3) == 6

def test_rejects():
    """rejects zero or negative args in any position"""
    @positive
    def area(w, h):
        return w * h
    for args in [(2, 0), (0, 2), (-1, 3), (3, -1), (-2, -3)]:
        try:
            area(*args)
        except ValueError:
            continue
        assert False, f"expected ValueError for area{args}"

def test_before_call():
    """checks before the function runs"""
    calls = []
    @positive
    def total(*nums):
        calls.append(nums)
        return sum(nums)
    assert total(1, 2, 3) == 6
    try:
        total(1, -2, 3)
    except ValueError:
        assert calls == [(1, 2, 3)]
        return
    assert False, "expected ValueError"
```

#### Uses
- [Closures and decorators › Decorators](#/closures-decorators/decorators)
- [Closures and decorators › Raising and catching in a wrapper](#/closures-decorators/raising-and-catching-in-a-wrapper)
- [Comprehensions › Generator expressions](#/comprehensions/generator-expressions)

#### Hints
- The wrapper takes `*args, **kwargs` and checks `args` before it calls `fn`.
- `any(...)` over a generator expression tells you whether at least one argument is `<= 0`. If so, `raise ValueError(...)`.
- Otherwise, return `fn(*args, **kwargs)` as usual.

#### Tips
- Only positional arguments are checked, so `area(w=0, h=3)` slips through. Checking `kwargs.values()` as well would close that gap.
- Raise before `fn` is called, not after. The last test records every call the function receives and expects the rejected one to be missing entirely.
- `any(a <= 0 for a in args)` short-circuits at the first bad value, so the message should name that value: `next(a for a in args if a <= 0)` gets it back for the error text.

#### Docs
- [Python tutorial: Raising exceptions](https://docs.python.org/3/tutorial/errors.html#raising-exceptions)
- [Built-in functions: `any`](https://docs.python.org/3/library/functions.html#any)
