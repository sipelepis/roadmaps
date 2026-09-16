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

def make_multiplier(n):
    return lambda x: x * n  # a new function that remembers n

triple = make_multiplier(3)
triple(5)                   # 15
```

`lambda` creates a small anonymous function for one expression. Anything longer deserves a `def`. A function can also build and return another function, and the returned one still sees the outer function's parameters. Closures & decorators explains how.

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
    assert greet("Bob") == "Hello, Bob!"

def test_options():
    """accepts greeting positionally and punctuation by keyword"""
    assert greet("Ada", "Hi", punctuation="?") == "Hi, Ada?"
    assert greet("Bob", "Hey", punctuation=".") == "Hey, Bob."

def test_one_option():
    """changes one option and keeps the other default"""
    assert greet("Bob", "Hey") == "Hey, Bob!"
    assert greet("Cy", punctuation="...") == "Hello, Cy..."
    assert greet("Di", greeting="Yo") == "Yo, Di!"

def test_keyword_only():
    """punctuation cannot be passed positionally"""
    try:
        greet("Ada", "Hi", "?")
    except TypeError:
        return
    assert False, "expected TypeError"
```

#### Uses
- [Functions › Defining and calling](#/functions/defining-and-calling)
- [Functions › Keyword-only and positional-only](#/functions/keyword-only-and-positional-only)

#### Hints
- Add `greeting="Hello"` as a second parameter with a default.
- A bare `*` in the parameter list makes everything after it keyword-only. Put `punctuation="!"` there.

#### Tips
- Keyword-only options keep call sites readable: `greet("Ada", punctuation="?")` says what the `"?"` is for.
- A parameter with a default can still be passed positionally *or* by name, which is why `greet("Bob", "Hey")` and `greet("Di", greeting="Yo")` both work.
- Defaults are read left to right, so every parameter after the first default needs one too. `def greet(name, greeting="Hello", *, punctuation="!")` is the only order that compiles.

#### Docs
- [Python tutorial: Default argument values](https://docs.python.org/3/tutorial/controlflow.html#default-argument-values)
- [Python tutorial: Keyword-only arguments](https://docs.python.org/3/tutorial/controlflow.html#keyword-only-arguments)

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
    assert average(10, 20, 30, 40) == 25

def test_keeps_fraction():
    """keeps the fractional part"""
    assert average(1, 2) == 1.5
    assert average(1, 2, 3, 4) == 2.5

def test_zero_average():
    """a zero average is 0, not None"""
    assert average(0) == 0
    assert average(-3, 3) == 0
    assert average(-3, 3) is not None

def test_none_for_empty():
    """None with no arguments"""
    assert average() is None
```

#### Uses
- [Functions › `*args` and `**kwargs`](#/functions/args-and-kwargs)
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)

#### Hints
- Change the signature to `average(*values)`. Inside the function, `values` is a tuple.
- An empty tuple is falsy, so `if not values:` catches the no-argument call.
- `sum(values) / len(values)` gives the mean.

#### Tips
- Return `None` explicitly for the empty case. Falling off the end also returns `None`, but saying it reads better.
- Guard first, then compute. `sum(values) / len(values)` on no arguments raises `ZeroDivisionError`, and the empty check is what stops it.
- `average(*[1, 2, 3])` passes a list as three arguments. The `*` at the call site is the mirror image of the `*` in the signature.

#### Docs
- [Python tutorial: Arbitrary argument lists](https://docs.python.org/3/tutorial/controlflow.html#arbitrary-argument-lists)

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
    empty = []
    assert append_to(5, empty) is empty
    assert empty == [5]

def test_earlier_results_untouched():
    """later calls don't change earlier results"""
    first = append_to("a")
    append_to("b")
    append_to("c", [9])
    assert first == ["a"]
    assert append_to("d") == ["d"]
```

#### Uses
- [Functions › Mutable default arguments](#/functions/mutable-default-arguments)

#### Hints
- The default `[]` is created once, when `def` runs, and every call shares it.
- Use `None` as the default and make a fresh list inside the function when `target is None`.

#### Tips
- Test `is None`, not truthiness. `if not target:` would also swap a caller's empty list for a new one, so their list would never see the append.
- The test uses `is`, not `==`, on purpose: `append_to(5, empty) is empty` checks you appended to the caller's list rather than to a copy of it.
- The same trap has the same fix everywhere: `{}`, `set()` and `[]` are all evaluated once at definition time. Only immutable defaults like `0`, `""` and `None` are safe to write directly.

#### Docs
- [Python tutorial: Default argument values](https://docs.python.org/3/tutorial/controlflow.html#default-argument-values)
- [Python FAQ: Why are default values shared between objects?](https://docs.python.org/3/faq/programming.html#why-are-default-values-shared-between-objects)

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

def test_reusable():
    """the returned function works on any input"""
    both = compose(lambda x: x + 1, lambda x: x * 2)
    assert both(0) == 1
    assert both(-3) == -5
    assert both(10) == 21

def test_any_functions():
    """works with any one-argument functions"""
    assert compose(str.upper, str.strip)("  hi ") == "HI"
    assert compose(len, str.split)("a b c") == 3
```

#### Uses
- [Functions › Functions are values](#/functions/functions-are-values)

#### Hints
- `compose` doesn't call `f` or `g` itself. It returns a new function.
- That new function takes one argument `x` and returns `f(g(x))`. A `lambda` is enough.

#### Tips
- A nested `def` inside `compose` works too, and gets a real name in tracebacks.
- `str.upper` and `len` can be passed straight in, because a method accessed on the class is an ordinary function whose first argument is the string.
- Order matters and reads backwards: `compose(f, g)(x)` is `f(g(x))`, so the *second* argument runs first. That is the mathematical convention, not an accident.
- `compose(inc, double)` returns a function; nothing is computed until you call it. Forgetting the second pair of brackets is the usual mistake.

#### Docs
- [Python tutorial: Lambda expressions](https://docs.python.org/3/tutorial/controlflow.html#lambda-expressions)
