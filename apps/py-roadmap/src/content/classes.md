# Classes

A class bundles data with the functions that operate on it. Python's classes are lightweight: no access modifiers, no interfaces, and attributes can be added at any time. What keeps them sane is convention, and this module is mostly about those conventions.

## Defining a class

```python
class Account:
    interest = 0.02                      # class attribute, shared

    def __init__(self, owner, balance=0):
        self.owner = owner               # instance attributes
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self

    def __repr__(self):
        return f"Account({self.owner!r}, {self.balance})"

acct = Account("Ada").deposit(50)
```

`self` is the instance, passed explicitly. `__init__` initialises; it doesn't construct (`__new__` does, and you almost never touch it). `__repr__` is what the REPL and debuggers show; always define it.

## Attribute access

Everything is public. A leading underscore (`_balance`) says "internal, don't rely on it". A double underscore (`__balance`) triggers name mangling to `_Account__balance`, which prevents accidental clashes in subclasses; it is not privacy.

## Properties

Turn a method into a computed attribute, or add validation to assignment, without changing the call sites:

```python
class Circle:
    def __init__(self, radius):
        self.radius = radius

    @property
    def area(self):
        return 3.14159 * self.radius ** 2

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("radius must be non-negative")
        self._radius = value
```

Start with a plain attribute. Add a property only when you need the logic; users won't notice the change.

## Class and static methods

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    @classmethod
    def from_fahrenheit(cls, f):        # alternative constructor
        return cls((f - 32) * 5 / 9)

    @staticmethod
    def is_valid(value):                # utility that needs no instance
        return value >= -273.15
```

## Inheritance

```python
class Animal:
    def speak(self):
        raise NotImplementedError

class Dog(Animal):
    def __init__(self, name):
        super().__init__()
        self.name = name
    def speak(self):
        return "woof"

isinstance(Dog("x"), Animal)   # True
```

Python supports multiple inheritance; keep hierarchies shallow and prefer composition (an object *has* another) over deep trees.

## Equality

By default `==` compares identity. Define `__eq__` (and `__hash__` if instances go in sets or dict keys) to compare by value. Dataclasses, a later module, generate these for you.

```python playground
class Stack:
    def __init__(self):
        self._items = []

    def push(self, item):
        self._items.append(item)
        return self

    def pop(self):
        if not self._items:
            raise IndexError("pop from empty stack")
        return self._items.pop()

    @property
    def size(self):
        return len(self._items)

    def __repr__(self):
        return f"Stack({self._items})"

s = Stack().push(1).push(2).push(3)
print(s, "size", s.size)
print(s.pop(), s.pop())
print(s)

# Try: s.size = 10
```

## Exercises

### 1. Counter class

`Counter` starts at `0` (or a given `start`), `increment()` adds one and returns `self` so calls chain, and `value` is a read-only property.

```python starter
class Counter:
    ...
```

```python test
def test_chain():
    """increments and chains"""
    assert Counter().increment().increment().value == 2

def test_start():
    """accepts a start value"""
    assert Counter(10).increment().value == 11

def test_read_only():
    """value cannot be assigned"""
    c = Counter()
    try:
        c.value = 5
    except AttributeError:
        return
    assert False, "expected AttributeError"
```

### 2. Validated property

`Rectangle(width, height)` with an `area` property. Assigning a negative or zero width or height raises `ValueError`, both in `__init__` and later.

```python starter
class Rectangle:
    ...
```

```python test
def test_area():
    """computes the area"""
    r = Rectangle(2, 3)
    assert r.area == 6
    r.width = 4
    assert r.area == 12

def test_validation():
    """rejects non-positive sizes"""
    for bad in [lambda: Rectangle(0, 1), lambda: Rectangle(1, -2)]:
        try:
            bad()
        except ValueError:
            continue
        assert False, "expected ValueError"
    r = Rectangle(1, 1)
    try:
        r.height = 0
    except ValueError:
        return
    assert False, "expected ValueError"
```

### 3. Alternative constructor

Give `Point` a `from_string` classmethod that parses `"3,4"` into `Point(3, 4)`, and a `distance_to` method. Points with the same coordinates should compare equal.

```python starter
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y
```

```python test
def test_from_string():
    """parses 'x,y'"""
    p = Point.from_string("3,4")
    assert (p.x, p.y) == (3, 4)

def test_distance_and_eq():
    """distance and value equality"""
    assert Point(0, 0).distance_to(Point(3, 4)) == 5.0
    assert Point(1, 2) == Point(1, 2)
    assert Point(1, 2) != Point(2, 1)
```

### 4. Inheritance

`Shape` defines `describe()` as `"<name> with area <area>"` using an `area()` method subclasses must provide. Implement `Square(side)` and `Circle(radius)` (use `math.pi`, and round the area to 2 decimals in `describe`).

```python starter
import math

class Shape:
    name = "shape"

    def area(self):
        raise NotImplementedError

    def describe(self):
        ...
```

```python test
def test_square():
    """square"""
    assert Square(3).area() == 9
    assert Square(3).describe() == "square with area 9"

def test_circle():
    """circle, rounded"""
    assert Circle(1).describe() == "circle with area 3.14"
    assert isinstance(Circle(1), Shape)
```
