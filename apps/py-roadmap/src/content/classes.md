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

The assignment in `__init__` (`self.radius = radius`) goes through the setter too, so the check covers construction as well as later changes. A property with no setter is read-only: `Circle(1).area = 5` raises `AttributeError`. And `raise ValueError(...)` stops the setter with an error, which is how it rejects a bad value.

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

By default `==` compares identity. Define `__eq__` (and `__hash__` if instances go in sets or dict keys) to compare by value:

```python
class Coin:
    def __init__(self, value):
        self.value = value

    def __eq__(self, other):             # called for coin == other
        return self.value == other.value

Coin(5) == Coin(5)    # True
Coin(5) != Coin(1)    # True, != uses __eq__ and flips the answer
```

Dataclasses, a later module, generate these for you.

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

#### Uses
- [Classes › Defining a class](#/classes/defining-a-class)
- [Classes › Properties](#/classes/properties)
- [Functions › Defining and calling](#/functions/defining-and-calling)

#### Hints
- `__init__(self, start=0)` stores the count on the instance. Use a name like `_value`, since `value` will be the property.
- `increment` adds one to that attribute and ends with `return self`, which is what lets the calls chain.
- Put `@property` on a `value` method that returns the stored count, and give it no setter.

#### Tips
- The leading underscore in `_value` tells readers "internal". The property is the public way in.

#### Docs
- [Built-in functions: `property`](https://docs.python.org/3/library/functions.html#property)

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

#### Uses
- [Classes › Properties](#/classes/properties)
- [Classes › Defining a class](#/classes/defining-a-class)

#### Hints
- Give `width` and `height` each a `@property` getter and a matching `@width.setter` / `@height.setter`, like `radius` in the article.
- Each setter checks the value, raises `ValueError` when it's `<= 0`, and otherwise stores it on an underscore attribute (`self._width`).
- In `__init__`, assign `self.width = width`, not `self._width`, so construction goes through the setter. `area` is a read-only property that multiplies the two.

#### Tips
- Storing the real value under a different name matters: a setter that does `self.width = value` calls itself forever.

#### Docs
- [Built-in functions: `property`](https://docs.python.org/3/library/functions.html#property)

### 3. Alternative constructor

Give `Point` a `from_string` classmethod that parses `"3,4"` into `Point(3, 4)`, and a `distance_to` method that returns the straight-line distance. Points with the same coordinates should compare equal.

To take the text apart, `"3,4".split(",")` gives the list `["3", "4"]`.

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

#### Uses
- [Classes › Class and static methods](#/classes/class-and-static-methods)
- [Classes › Equality](#/classes/equality)
- [Variables and types › Conversions](#/variables-types/conversions)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- In `from_string(cls, text)`, split on the comma, unpack into two names, convert each with `int()`, and `return cls(x, y)`.
- The distance is the square root of `dx ** 2 + dy ** 2`. Raising to the power `0.5` takes a square root.
- `__eq__(self, other)` returns `True` when both `x` and `y` match. `!=` then works on its own.

#### Tips
- Return `cls(...)`, not `Point(...)`, so a subclass calling `from_string` gets an instance of the subclass.

#### Docs
- [Built-in functions: `classmethod`](https://docs.python.org/3/library/functions.html#classmethod)
- [Data model: `__eq__` and other rich comparisons](https://docs.python.org/3/reference/datamodel.html#object.__eq__)

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

#### Uses
- [Classes › Inheritance](#/classes/inheritance)
- [Classes › Defining a class](#/classes/defining-a-class)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- `describe` belongs on `Shape` and works for every subclass: build the string from `self.name` and `self.area()` with an f-string.
- Each subclass sets its own class attribute `name`, stores its size in `__init__`, and overrides `area()`.
- `round(value, 2)` rounds to two decimals. A circle's area is `math.pi * radius ** 2`.

#### Tips
- `round(9, 2)` stays the int `9`, which is why the square reads `"area 9"` and not `"area 9.0"`.

#### Docs
- [Python tutorial: Inheritance](https://docs.python.org/3/tutorial/classes.html#inheritance)
- [Built-in functions: `round`](https://docs.python.org/3/library/functions.html#round)
