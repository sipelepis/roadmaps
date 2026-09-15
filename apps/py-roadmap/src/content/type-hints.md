# Type hints

Python stays dynamically typed, but since 3.5 you can annotate variables, parameters, and return values. The interpreter ignores the annotations; tools like `mypy`, `pyright`, and your editor use them to catch mistakes before you run anything and to power autocomplete. In a codebase of any size, hints are the difference between guessing what a function takes and knowing.

## Basics

```python
def greet(name: str, times: int = 1) -> str:
    return ("Hello, " + name) * times

count: int = 0
```

## Collections

```python
def mean(values: list[float]) -> float: ...
def index(names: list[str]) -> dict[str, int]: ...
def pair() -> tuple[int, str]: ...
def tags() -> set[str]: ...
```

Built-in generics work directly since 3.9. Prefer the abstract kinds for parameters (`Sequence`, `Mapping`, `Iterable` from `collections.abc`) so callers can pass tuples, generators, and custom types.

## Optional and union

```python
def find(items: list[str], target: str) -> int | None: ...
def load(source: str | bytes) -> dict: ...
```

`X | None` replaces the older `Optional[X]`. Checkers force you to handle the `None` case before using the value, which is exactly the class of bug that produces `AttributeError: 'NoneType' object has no attribute ...`.

## Callables and type aliases

```python
from collections.abc import Callable

Handler = Callable[[str, int], bool]

def register(name: str, handler: Handler) -> None: ...
```

## Generics

```python
def first[T](items: list[T]) -> T:       # 3.12 syntax
    return items[0]
```

Before 3.12: `from typing import TypeVar; T = TypeVar("T")`.

## `Any`, `object`, and `TypedDict`

- `Any` turns checking off for that value. Use sparingly.
- `object` accepts anything but lets you do nothing without a check.
- `TypedDict` describes the shape of a dict, useful for JSON:

```python
from typing import TypedDict

class User(TypedDict):
    id: int
    name: str
```

## Literal and Protocol

```python
from typing import Literal, Protocol

def align(where: Literal["left", "right"]) -> None: ...

class Drawable(Protocol):
    def draw(self) -> str: ...      # anything with a draw() method qualifies
```

Protocols make duck typing explicit: no inheritance required.

## Runtime introspection

Annotations are stored in `__annotations__`. Libraries like dataclasses, pydantic, and FastAPI read them to generate behaviour. The exercises below inspect them the same way, since the playground has no type checker.

```python playground
from collections.abc import Iterable

def total_length(words: Iterable[str]) -> int:
    return sum(len(w) for w in words)

def find(items: list[str], target: str) -> int | None:
    for i, item in enumerate(items):
        if item == target:
            return i
    return None

print(total_length(["a", "bb"]), total_length({"ccc"}))
print(find(["x", "y"], "y"), find(["x"], "z"))
print(find.__annotations__)

# Try: run total_length(3). Hints don't stop you; a checker would.
```

## Exercises

### 1. Annotate a function

Add hints to `clamp`: all three parameters and the return are `float`.

```python starter
def clamp(value, lo, hi):
    return max(lo, min(value, hi))
```

```python test
def test_works():
    """still clamps"""
    assert clamp(5, 0, 3) == 3

def test_annotations():
    """has float annotations"""
    assert clamp.__annotations__ == {"value": float, "lo": float, "hi": float, "return": float}
```

#### Uses
- [Type hints › Basics](#/type-hints/basics)

#### Hints
- Each parameter gets its type after a colon: `value: float`.
- The return type goes between the `)` and the final `:`, written `-> float`.

#### Tips
- `clamp(5, 0, 3)` passes ints and still works: annotations are never checked at runtime, and type checkers accept an `int` where a `float` is expected.

#### Docs
- [Glossary: function annotation](https://docs.python.org/3/glossary.html#term-function-annotation)

### 2. Optional return

`parse_port(text)` returns an `int` when `text` is a number between 1 and 65535, otherwise `None`. Annotate the return type as `int | None`.

To spot text that isn't a number before converting it, use `isdigit()`: `"8080".isdigit()` is `True`, while `"abc".isdigit()` and `"".isdigit()` are `False`.

```python starter
def parse_port(text):
    ...
```

```python test
def test_parse():
    """valid and invalid ports"""
    assert parse_port("8080") == 8080
    assert parse_port("0") is None
    assert parse_port("abc") is None

def test_annotation():
    """return is int | None"""
    assert parse_port.__annotations__["return"] == (int | None)
```

#### Uses
- [Type hints › Optional and union](#/type-hints/optional-and-union)
- [Variables and types › Conversions](#/variables-types/conversions)
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)

#### Hints
- Check `text.isdigit()` first and return `None` when it's false, so `int()` never sees letters.
- Convert with `int(text)`, then test the range with a chained comparison: `1 <= port <= 65535`.
- The return annotation is `-> int | None`.

#### Tips
- The other common approach is to call `int(text)` and catch the `ValueError` it raises for bad input. That's the Errors and exceptions module's territory.

#### Docs
- [`str.isdigit`](https://docs.python.org/3/library/stdtypes.html#str.isdigit)
- [Union types](https://docs.python.org/3/library/stdtypes.html#types-union)

### 3. TypedDict and a protocol

Define a `TypedDict` called `Movie` with `title: str` and `year: int`, and a `Protocol` called `HasTitle` with a `title` attribute of type `str`. Then implement `titles(items)` returning a list with the title of each item, which may be a `Movie` dict or any object with a `.title`.

A protocol lists attributes the same way a `TypedDict` lists keys: an annotated name in the class body, like `title: str`.

```python starter
from typing import TypedDict, Protocol
```

```python test
def test_typed_dict():
    """Movie is a TypedDict with the right keys"""
    assert Movie.__annotations__ == {"title": str, "year": int}
    m: Movie = {"title": "Alien", "year": 1979}
    assert m["title"] == "Alien"

def test_titles():
    """handles dicts and objects"""
    class Book:
        title = "Dune"
    assert titles([{"title": "Alien", "year": 1979}, Book()]) == ["Alien", "Dune"]
    assert "title" in HasTitle.__annotations__
```

#### Uses
- [Type hints › `Any`, `object`, and `TypedDict`](#/type-hints/any-object-and-typeddict)
- [Type hints › Literal and Protocol](#/type-hints/literal-and-protocol)
- [Variables and types › The core types](#/variables-types/the-core-types)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- `Movie` is shaped like the article's `User`: a class based on `TypedDict` with two annotated keys. `HasTitle` is a class based on `Protocol` whose body is just `title: str`.
- In `titles`, loop over the items and collect each title in a list.
- `isinstance(item, dict)` tells you whether to read `item["title"]` or `item.title`.

#### Tips
- `isinstance(item, Movie)` raises `TypeError`: at runtime a TypedDict is just a plain dict, so check for `dict` instead.

#### Docs
- [`typing.TypedDict`](https://docs.python.org/3/library/typing.html#typing.TypedDict)
- [`typing.Protocol`](https://docs.python.org/3/library/typing.html#typing.Protocol)
