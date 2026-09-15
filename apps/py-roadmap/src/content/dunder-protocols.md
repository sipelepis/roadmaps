# Dunder methods and protocols

Python's operators and built-ins are hooks. `len(x)` calls `x.__len__()`, `a + b` calls `a.__add__(b)`, `for` uses `__iter__`, `with` uses `__enter__` and `__exit__`. By implementing these "dunder" (double underscore) methods, your own classes plug into the language's syntax. A *protocol* is just the set of dunders a piece of syntax expects.

## Representation

```python
class Money:
    def __init__(self, cents, currency="EUR"):
        self.cents, self.currency = cents, currency

    def __repr__(self):                 # unambiguous, for developers
        return f"Money({self.cents}, {self.currency!r})"

    def __str__(self):                  # readable, for users; falls back to __repr__
        return f"{self.cents / 100:.2f} {self.currency}"
```

## Equality and hashing

```python
    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented           # let Python try the other side
        return (self.cents, self.currency) == (other.cents, other.currency)

    def __hash__(self):
        return hash((self.cents, self.currency))
```

Defining `__eq__` sets `__hash__` to `None`, so define both or the object stops working in sets.

## Ordering

Implement `__lt__` and use `functools.total_ordering` to fill in the rest:

```python
from functools import total_ordering

@total_ordering
class Version:
    def __lt__(self, other): ...
    def __eq__(self, other): ...
```

Tuples compare element by element, left to right, and a tuple that runs out first is the smaller one: `(1, 2) < (1, 10)` and `(1, 0) < (1, 0, 1)`. So comparing tuples of fields is the usual way to write `__lt__`.

## Arithmetic

```python
    def __add__(self, other):
        return Money(self.cents + other.cents, self.currency)
    def __mul__(self, factor):
        return Money(self.cents * factor, self.currency)
    def __rmul__(self, factor):        # 2 * money
        return self * factor
```

## Container protocol

```python
class Playlist:
    def __len__(self): return len(self._songs)
    def __getitem__(self, i): return self._songs[i]     # also enables iteration and slicing
    def __contains__(self, song): return song in self._songs
    def __iter__(self): return iter(self._songs)
```

## Callable and context manager

```python
class Multiplier:
    def __init__(self, n): self.n = n
    def __call__(self, x): return x * self.n

class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self
    def __exit__(self, exc_type, exc, tb):
        self.elapsed = time.perf_counter() - self.start
        return False        # don't swallow exceptions
```

`contextlib.contextmanager` turns a generator into a context manager with less ceremony; the Advanced module covers it.

## Duck typing

Python doesn't ask what an object *is*, only what it can *do*. If it has `__len__`, `len()` works. This is why protocols matter more than inheritance.

```python playground
class Vector:
    def __init__(self, *components):
        self.components = components

    def __repr__(self):
        return f"Vector{self.components}"

    def __len__(self):
        return len(self.components)

    def __getitem__(self, i):
        return self.components[i]

    def __add__(self, other):
        return Vector(*(a + b for a, b in zip(self, other)))

    def __mul__(self, k):
        return Vector(*(a * k for a in self))

    __rmul__ = __mul__

    def __eq__(self, other):
        return isinstance(other, Vector) and self.components == other.components

    def __abs__(self):
        return sum(a * a for a in self) ** 0.5

v = Vector(3, 4)
print(v + Vector(1, 1), 2 * v, abs(v), len(v), v[0])
print(v == Vector(3, 4), list(v))

# Try: v - Vector(1, 1). Which dunder is missing?
```

## Exercises

### 1. Money

Implement `Money(cents, currency)` with `__repr__` (`Money(150, 'EUR')`), `__str__` (`1.50 EUR`), value equality, hashing, and `__add__` for same-currency values (raise `ValueError` otherwise).

```python starter
class Money:
    def __init__(self, cents, currency="EUR"):
        self.cents = cents
        self.currency = currency
```

```python test
def test_repr_str():
    """repr and str"""
    m = Money(150)
    assert repr(m) == "Money(150, 'EUR')" and str(m) == "1.50 EUR"

def test_eq_hash_add():
    """equality, hashing, addition"""
    assert Money(1) == Money(1) and Money(1) != Money(2)
    assert len({Money(1), Money(1)}) == 1
    assert Money(1) + Money(2) == Money(3)
    try:
        Money(1, "EUR") + Money(1, "USD")
    except ValueError:
        return
    assert False
```

#### Uses
- [Dunder methods and protocols › Representation](#/dunder-protocols/representation)
- [Dunder methods and protocols › Equality and hashing](#/dunder-protocols/equality-and-hashing)
- [Dunder methods and protocols › Arithmetic](#/dunder-protocols/arithmetic)
- [Classes › Properties](#/classes/properties)

#### Hints
- `__repr__` and `__str__` are in the article almost as written: `!r` puts quotes around the currency, `:.2f` gives two decimals.
- Compare and hash the same tuple, `(self.cents, self.currency)`, so equal objects always hash equal.
- In `__add__`, raise `ValueError` when the currencies differ; otherwise return a new `Money` with the summed cents.

#### Tips
- `str(x)` falls back to `__repr__` when there's no `__str__`, which is why `__repr__` is the one to always write.

#### Docs
- [Data model: `__repr__`](https://docs.python.org/3/reference/datamodel.html#object.__repr__)
- [Data model: `__hash__`](https://docs.python.org/3/reference/datamodel.html#object.__hash__)

### 2. A sequence

`Deck` holds cards and supports `len(deck)`, `deck[i]`, slicing, iteration, and `"AS" in deck`, by implementing the sequence protocol on top of a private list.

```python starter
class Deck:
    def __init__(self, cards):
        self._cards = list(cards)
```

```python test
def test_sequence():
    """len, index, slice, iteration, membership"""
    d = Deck(["2H", "3H", "AS"])
    assert len(d) == 3 and d[0] == "2H" and d[-1] == "AS"
    assert d[1:] == ["3H", "AS"]
    assert list(d) == ["2H", "3H", "AS"] and "AS" in d and "KD" not in d
```

#### Uses
- [Dunder methods and protocols › Container protocol](#/dunder-protocols/container-protocol)
- [Dunder methods and protocols › Duck typing](#/dunder-protocols/duck-typing)

#### Hints
- `__len__` and `__getitem__` pass the work straight on to `self._cards`.
- A list already understands negative indexes and slices, so `self._cards[i]` covers `d[-1]` and `d[1:]` too.
- `__contains__` answers `in` by asking the list. Iteration comes free with `__getitem__`, or add `__iter__` to be explicit.

#### Tips
- Wrapping a private list like this is composition: a `Deck` *has* a list rather than *being* one, so you choose exactly what it exposes.

#### Docs
- [Data model: Emulating container types](https://docs.python.org/3/reference/datamodel.html#emulating-container-types)

### 3. Ordering

`Version("1.2.10")` compares numerically part by part, so `1.2.10 > 1.2.9`. Implement `__eq__` and `__lt__` and use `functools.total_ordering`.

```python starter
class Version:
    def __init__(self, text):
        self.parts = tuple(int(p) for p in text.split("."))
```

```python test
def test_ordering():
    """numeric ordering with all comparison operators"""
    assert Version("1.2.10") > Version("1.2.9")
    assert Version("1.0") < Version("1.0.1") and Version("2.0") >= Version("2.0")
    assert Version("1.0") == Version("1.0") and Version("1.0") != Version("1.1")
    assert sorted([Version("1.10"), Version("1.2")])[0] == Version("1.2")
```

#### Uses
- [Dunder methods and protocols › Ordering](#/dunder-protocols/ordering)
- [Dunder methods and protocols › Equality and hashing](#/dunder-protocols/equality-and-hashing)

#### Hints
- `self.parts` is already a tuple of ints, so both methods can compare `self.parts` with `other.parts`.
- Tuples compare element by element, which is exactly the numeric, part-by-part order you want.
- Put `@total_ordering` (from `functools`) above the class to get `<=`, `>` and `>=` from your two methods.

#### Tips
- Comparing the original strings would be wrong: `"1.2.10" < "1.2.9"` is `True`, because strings compare character by character.

#### Docs
- [`functools.total_ordering`](https://docs.python.org/3/library/functools.html#functools.total_ordering)
- [Data model: rich comparison methods](https://docs.python.org/3/reference/datamodel.html#object.__lt__)

### 4. Context manager

`Tracker` is a context manager that records `"enter"` and `"exit"` into `EVENTS`, and must record `"exit"` even when the block raises (without swallowing the exception).

```python starter
EVENTS = []

class Tracker:
    ...
```

```python test
def test_records():
    """records enter and exit"""
    EVENTS.clear()
    with Tracker():
        EVENTS.append("body")
    assert EVENTS == ["enter", "body", "exit"]

def test_exception_propagates():
    """exit runs, exception still raised"""
    EVENTS.clear()
    try:
        with Tracker():
            raise RuntimeError("boom")
    except RuntimeError:
        assert EVENTS == ["enter", "exit"]
        return
    assert False, "exception was swallowed"
```

#### Uses
- [Dunder methods and protocols › Callable and context manager](#/dunder-protocols/callable-and-context-manager)

#### Hints
- `__enter__(self)` appends `"enter"`. `__exit__(self, exc_type, exc, tb)` appends `"exit"`.
- `__exit__` runs even when the block raises. Returning `False` (or nothing) lets the exception carry on to the caller.

#### Tips
- Returning `True` from `__exit__` swallows the exception. That's rarely what you want, and it's what the second test checks you didn't do.

#### Docs
- [Data model: With statement context managers](https://docs.python.org/3/reference/datamodel.html#with-statement-context-managers)
