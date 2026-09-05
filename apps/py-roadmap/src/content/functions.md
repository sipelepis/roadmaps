# Functions

Functions are the unit of reuse in Python, and the language gives them an unusually flexible calling convention: positional and keyword arguments, defaults, and variadic parameters. Getting comfortable with that convention is what makes the standard library's signatures readable.

## Defining and calling

```python
def area(width, height=1):
    """Return the area of a rectangle."""
    return width * height

area(3, 4)              # positional
area(width=3, height=4) # keyword
area(3)                 # default height
```

The string right after `def` is the docstring. `help(area)` prints it. A function without `return` returns `None`.

## Keyword-only and positional-only

```python
def connect(host, *, port=5432, timeout=10):   # everything after * is keyword-only
    ...

def divmod_(a, b, /):                           # everything before / is positional-only
    ...
```

Keyword-only parameters make call sites self-documenting for options.

## `*args` and `**kwargs`

```python
def log(*values, sep=" "):
    print(sep.join(str(v) for v in values))

def make(**fields):
    return dict(fields)

log(1, 2, 3)                   # values == (1, 2, 3)
make(name="x", size=3)         # fields == {'name': 'x', 'size': 3}

args = [1, 2]
kwargs = {"sep": "-"}
log(*args, **kwargs)           # unpacking at the call site
```

## Mutable default arguments

The default is evaluated *once*, when the function is defined:

```python
def add_item(item, items=[]):     # bug: one shared list for every call
    items.append(item)
    return items

def add_item(item, items=None):   # idiom
    if items is None:
        items = []
    items.append(item)
    return items
```

## Scope

Names assigned inside a function are local. Reading an outer name works; assigning to it creates a new local unless you declare `global` or `nonlocal`. Prefer returning values over mutating outer state.

## Functions are values

```python
def apply(fn, value):
    return fn(value)

apply(len, "abc")           # 3
apply(lambda x: x * 2, 4)   # 8
```

`lambda` creates a small anonymous function for one expression. Anything longer deserves a `def`.

## Returning multiple values

`return a, b` returns a tuple, and `x, y = f()` unpacks it.

```python playground
def stats(*numbers, precision=2):
    """Return (min, max, mean) of the given numbers."""
    mean = sum(numbers) / len(numbers)
    return min(numbers), max(numbers), round(mean, precision)

low, high, avg = stats(4, 8, 15, 16, 23, 42)
print(low, high, avg)
print(stats.__doc__)

def counter(items=None):
    items = [] if items is None else items
    items.append(len(items))
    return items

print(counter(), counter())

# Try: change the default to items=[] and call counter() twice.
```

## Exercises

### 1. Flexible greeting

`greet` takes a name, an optional `greeting` (default `"Hello"`), and a keyword-only `punctuation` (default `"!"`). It returns e.g. `"Hi, Ada?"`.

```python starter
def greet(name):
    ...
```

```python test
def test_defaults():
    """uses the defaults"""
    assert greet("Ada") == "Hello, Ada!"

def test_options():
    """accepts greeting positionally and punctuation by keyword"""
    assert greet("Ada", "Hi", punctuation="?") == "Hi, Ada?"

def test_keyword_only():
    """punctuation cannot be passed positionally"""
    try:
        greet("Ada", "Hi", "?")
    except TypeError:
        return
    assert False, "expected TypeError"
```

### 2. Variadic average

`average(*values)` returns the mean of any number of values, and `None` when called with no arguments.

```python starter
def average():
    ...
```

```python test
def test_average():
    """averages its arguments"""
    assert average(2, 4, 6) == 4
    assert average(5) == 5

def test_none_for_empty():
    """None with no arguments"""
    assert average() is None
```

### 3. Fix the shared default

`append_to` has the mutable-default bug. Fix it so each call without `target` gets a fresh list.

```python starter
def append_to(value, target=[]):
    target.append(value)
    return target
```

```python test
def test_fresh_list():
    """each call gets its own list"""
    assert append_to(1) == [1]
    assert append_to(2) == [2]

def test_explicit_target():
    """still appends to a given list"""
    lst = [0]
    assert append_to(1, lst) is lst
    assert lst == [0, 1]
```

### 4. Compose

`compose(f, g)` returns a new function that applies `g` first, then `f`.

```python starter
def compose(f, g):
    ...
```

```python test
def test_compose():
    """applies g then f"""
    inc = lambda x: x + 1
    double = lambda x: x * 2
    assert compose(inc, double)(5) == 11
    assert compose(double, inc)(5) == 12
```
