# Dataclasses

Most classes exist to hold a few fields. Writing `__init__`, `__repr__`, and `__eq__` for each one is boilerplate, and `@dataclass` generates them from the field annotations.

## The basics

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float = 0.0

p = Point(1.5)
p                    # Point(x=1.5, y=0.0)
p == Point(1.5, 0)   # True, compares fields
```

Fields are declared with type annotations; the types are not enforced at runtime, they define the field order and the constructor.

## Mutable defaults

A list default is the same mutable-default trap as with functions, and dataclasses refuse it. Use `field(default_factory=list)`:

```python
from dataclasses import dataclass, field

@dataclass
class Cart:
    items: list = field(default_factory=list)
```

## Frozen and ordered

```python
@dataclass(frozen=True)
class Version:
    major: int
    minor: int

v = Version(1, 2)
v.major = 3        # FrozenInstanceError
{v}                # hashable, so usable in sets and as dict keys

@dataclass(order=True)
class Task:
    priority: int
    name: str = field(compare=False)
```

`order=True` generates `<` and friends comparing fields in order. `compare=False` excludes a field from equality and ordering.

## `__post_init__`

Validation or derived fields go here:

```python
@dataclass
class Range:
    lo: int
    hi: int

    def __post_init__(self):
        if self.lo > self.hi:
            raise ValueError("lo must not exceed hi")
```

## Methods and properties

A dataclass is a normal class. Add methods, properties, and class methods as usual.

## Conversion

`dataclasses.asdict(obj)` and `astuple(obj)` produce plain data, recursively. `dataclasses.replace(obj, x=2)` returns a copy with some fields changed, which is the way to "modify" a frozen instance.

## `slots=True`

`@dataclass(slots=True)` (3.10+) stores fields in slots rather than a per-instance dict: less memory, faster attribute access, and no accidental new attributes.

## When to reach for something else

`NamedTuple` for tiny immutable records that must unpack like tuples; `TypedDict` when the data really is a dict (JSON); `attrs` or `pydantic` when you need validation or serialisation beyond the basics.

```python playground
from dataclasses import dataclass, field, asdict, replace

@dataclass(order=True)
class Task:
    priority: int
    title: str = field(compare=False)
    tags: list = field(default_factory=list, compare=False)

tasks = [Task(2, "write docs"), Task(1, "fix bug", ["urgent"]), Task(3, "refactor")]
for t in sorted(tasks):
    print(t)

done = replace(tasks[1], priority=9)
print(asdict(done))
print(tasks[1] == Task(1, "anything"))

# Try: tasks[0].priority = "high" — what happens on sorted(tasks)?
```

## Exercises

### 1. A simple record

Define a dataclass `Book` with `title` (str), `author` (str), and `year` (int, default `2000`). Instances with the same fields compare equal.

```python starter
from dataclasses import dataclass
```

```python test
def test_book():
    """fields, default and equality"""
    b = Book("Dune", "Herbert", 1965)
    assert (b.title, b.author, b.year) == ("Dune", "Herbert", 1965)
    assert Book("X", "Y").year == 2000
    assert Book("X", "Y") == Book("X", "Y")
    assert repr(Book("X", "Y")) == "Book(title='X', author='Y', year=2000)"
```

#### Uses
- [Dataclasses › The basics](#/dataclasses/the-basics)

#### Hints
- Put `@dataclass` above `class Book:` and list the fields as annotated names, like `title: str`.
- A default goes after the annotation (`year: int = 2000`). Fields with defaults must come after the ones without.

#### Tips
- The generated `__repr__` and `__eq__` are built from the fields, which is why the repr test passes with no extra code.

#### Docs
- [`dataclasses.dataclass`](https://docs.python.org/3/library/dataclasses.html#dataclasses.dataclass)

### 2. Default factory

`Playlist` has a `name` and a `songs` list that starts empty. `add(song)` appends and returns `self`. Two playlists must not share a list.

```python starter
from dataclasses import dataclass, field

@dataclass
class Playlist:
    ...
```

```python test
def test_independent_lists():
    """each playlist owns its list"""
    a, b = Playlist("a"), Playlist("b")
    a.add("song 1").add("song 2")
    assert a.songs == ["song 1", "song 2"] and b.songs == []
```

#### Uses
- [Dataclasses › Mutable defaults](#/dataclasses/mutable-defaults)
- [Dataclasses › Methods and properties](#/dataclasses/methods-and-properties)
- [Classes › Defining a class](#/classes/defining-a-class)

#### Hints
- `name: str` needs no default. `songs` needs a new list for every instance: `field(default_factory=list)`.
- `add` is an ordinary method. Append to `self.songs` and `return self` so the calls chain.

#### Tips
- `songs: list = []` is refused with a `ValueError` as soon as the class is defined. That's the dataclass catching the shared-default bug for you.

#### Docs
- [Dataclasses: Mutable default values](https://docs.python.org/3/library/dataclasses.html#mutable-default-values)
- [`dataclasses.field`](https://docs.python.org/3/library/dataclasses.html#dataclasses.field)

### 3. Frozen and hashable

`Money(amount: int, currency: str)` is frozen. Define `__add__` so two `Money` of the same currency add up, and raise `ValueError` for mismatched currencies.

`a + b` calls `a.__add__(b)`, so a method named `__add__` is what makes `+` work on your class:

```python
def __add__(self, other):      # inside the class; self is the left side, other the right
    return ...                 # a new object holding the sum
```

```python starter
from dataclasses import dataclass
```

```python test
def test_frozen():
    """cannot be modified, can be a set member"""
    m = Money(5, "EUR")
    try:
        m.amount = 6
    except Exception:
        pass
    else:
        assert False, "expected an error"
    assert len({Money(1, "EUR"), Money(1, "EUR")}) == 1

def test_add():
    """adds same-currency money"""
    assert Money(5, "EUR") + Money(7, "EUR") == Money(12, "EUR")
    try:
        Money(1, "EUR") + Money(1, "USD")
    except ValueError:
        return
    assert False
```

#### Uses
- [Dataclasses › Frozen and ordered](#/dataclasses/frozen-and-ordered)
- [Dataclasses › `__post_init__`](#/dataclasses/post-init)
- [Classes › Defining a class](#/classes/defining-a-class)

#### Hints
- `@dataclass(frozen=True)` blocks assignment and makes instances hashable, which covers the first test.
- In `__add__`, compare the two `currency` values first and `raise ValueError(...)` if they differ.
- Return a new `Money` with the summed `amount`. A frozen instance can't be changed in place anyway.

#### Tips
- A frozen dataclass gets a `__hash__` built from its fields. That's safe only because the fields can't change once the object is in a set.

#### Docs
- [Dataclasses: Frozen instances](https://docs.python.org/3/library/dataclasses.html#frozen-instances)
- [Data model: `__add__` and the other numeric methods](https://docs.python.org/3/reference/datamodel.html#object.__add__)

### 4. Validate in `__post_init__`

`Temperature(celsius: float)` raises `ValueError` below absolute zero (−273.15) and exposes a `fahrenheit` property.

```python starter
from dataclasses import dataclass
```

```python test
def test_fahrenheit():
    """converts"""
    assert Temperature(100).fahrenheit == 212.0

def test_validates():
    """rejects impossible temperatures"""
    try:
        Temperature(-300)
    except ValueError:
        return
    assert False
```

#### Uses
- [Dataclasses › `__post_init__`](#/dataclasses/post-init)
- [Classes › Properties](#/classes/properties)

#### Hints
- `__post_init__` runs right after the generated `__init__`. Check `self.celsius` there and raise `ValueError` when it's below `-273.15`.
- `fahrenheit` is a `@property` that works out `celsius * 9 / 5 + 32`.

#### Tips
- A derived value like `fahrenheit` belongs in a property, not a field, so it can never disagree with `celsius`.

#### Docs
- [Dataclasses: Post-init processing](https://docs.python.org/3/library/dataclasses.html#post-init-processing)
