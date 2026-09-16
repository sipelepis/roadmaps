# Variables and types

A variable in Python is a name bound to an object. Assignment never copies; it points the name at a value. That single mental model explains most of the surprises beginners hit with mutable data later on.

## The core types

```python
age = 36              # int, unbounded size
ratio = 0.75          # float
name = "Ada"          # str
active = True         # bool (a subclass of int: True == 1)
nothing = None        # NoneType, the "no value" singleton
```

`type(x)` tells you what something is. `isinstance(x, int)` is the way to check in code.

## Numbers

```python
7 / 2      # 3.5   true division always gives a float
7 // 2     # 3     floor division
7 % 2      # 1     remainder
2 ** 10    # 1024  power
round(2.675, 2)   # 2.67, floats are binary fractions; use decimal for money
```

Integers never overflow. `10 ** 100` is just a bigger int.

Two sharp edges worth knowing now. `//` floors, which means it rounds *down*, not toward zero, so negatives surprise people. And `%` takes the sign of the divisor:

```python
-7 // 2    # -4, not -3
-7 % 2     # 1, never negative for a positive divisor
7 // -2    # -4
int(-7 / 2)   # -3, because int() truncates instead
```

Floats are binary fractions, so decimal values that look exact often aren't:

```python
0.1 + 0.2 == 0.3          # False
0.1 + 0.2                 # 0.30000000000000004
math.isclose(0.1 + 0.2, 0.3)   # True, the right way to compare floats
```

## Strings

Strings are immutable sequences of Unicode characters. Every "modification" returns a new string.

```python
s = "python"
s.upper()          # 'PYTHON'
s[0]               # 'p'
s[-1]              # 'n'
s[1:4]             # 'yth'
len(s)             # 6
f"{s} {len(s)}"    # 'python 6'  formatted string literal
```

The Strings module goes deeper. For now, f-strings are how you build text.

## Truthiness

Every object is truthy or falsy. Falsy: `False`, `None`, `0`, `0.0`, `""`, and empty containers (`[]`, `{}`, `set()`). Everything else is truthy.

```python
items = []
if not items:
    print("nothing to do")
```

## Conversions

```python
int("42")        # 42
float("2.5")     # 2.5
str(3.0)         # '3.0'
int(3.99)        # 3, truncates toward zero
bool("false")    # True! any non-empty string is truthy
```

`int("abc")` raises `ValueError`. Conversions never guess.

## Multiple assignment

```python
a, b = 1, 2
a, b = b, a        # swap
x = y = 0          # both names point to the same 0
```

## Names, not boxes

```python
a = [1, 2]
b = a              # same list, two names
b.append(3)
a                  # [1, 2, 3]
```

Ints and strings are immutable, so this never bites you with them. Lists and dicts are mutable, so it does. Copy explicitly when you need a separate object: `b = list(a)`.

## Same value or same object

`==` asks whether two objects have the same *value*. `is` asks whether they are the same *object*, the one thing assignment shares.

```python
a = [1, 2]
b = [1, 2]
a == b        # True, equal contents
a is b        # False, two separate lists

n = 1000
m = int("1000")
n == m        # True, same value
n is m        # False, two int objects that happen to be equal
```

Use `is` only for the singletons `None`, `True` and `False` — `if value is None:` is the idiom — and `==` for everything else. Comparing numbers or strings with `is` sometimes appears to work, because Python reuses small ints and short literals, and then fails on a value that isn't shared.

```python playground
price = 19.99
quantity = 3
subtotal = price * quantity

print(f"{quantity} x {price} = {subtotal:.2f}")
print(type(subtotal))

a = b = []
a.append("shared")
print(b)          # both names see the same list

# Try: is 0.1 + 0.2 == 0.3? Print both sides.
```

## Exercises

### 1. Convert and compute

`celsius_to_fahrenheit` receives the temperature as a *string* (as if read from user input) and returns a float using `F = C * 9/5 + 32`.

```python starter
def celsius_to_fahrenheit(text):
    ...
```

```python test
def test_converts():
    """converts a numeric string"""
    assert celsius_to_fahrenheit("100") == 212.0
    assert celsius_to_fahrenheit("-40") == -40.0
    assert celsius_to_fahrenheit("0") == 32.0
    assert celsius_to_fahrenheit("25") == 77.0

def test_decimal_input():
    """accepts a decimal string"""
    assert celsius_to_fahrenheit("37.5") == 99.5
    assert celsius_to_fahrenheit("-17.5") == 0.5

def test_returns_float():
    """returns a float"""
    assert isinstance(celsius_to_fahrenheit("0"), float)
    assert isinstance(celsius_to_fahrenheit("100"), float)
```

#### Uses
- [Variables and types › Conversions](#/variables-types/conversions)
- [Variables and types › Numbers](#/variables-types/numbers)
- [What is Python? › Functions and `return`](#/intro/functions-and-return)

#### Hints
- The input is a string, so convert it first: `float(text)` turns `"100"` into `100.0`.
- Then apply the formula with ordinary arithmetic and return the result.

#### Tips
- `/` always gives a float, so `9 / 5` is `1.8` even with ints on both sides. That is what makes the result a float without any extra conversion.
- `float("37.5")` handles decimals, `int("37.5")` raises `ValueError`. Reach for `float` whenever the text might not be a whole number.
- Python follows the usual precedence, so `float(text) * 9 / 5 + 32` needs no brackets.

#### Docs
- [Built-in functions: `float`](https://docs.python.org/3/library/functions.html#float)

### 2. Describe a value

Write `describe(value)` returning one of `"empty"`, `"number"`, `"text"`, or `"other"`: numbers (int or float, but *not* bool) are `"number"`, strings are `"text"`, any falsy value that is not a number is `"empty"`, everything else is `"other"`.

```python starter
def describe(value):
    ...
```

```python test
def test_numbers():
    """numbers, including zero"""
    assert describe(0) == "number"
    assert describe(2.5) == "number"
    assert describe(-3) == "number"
    assert describe(0.0) == "number"

def test_text():
    """non-empty strings"""
    assert describe("hi") == "text"
    assert describe("0") == "text"
    assert describe(" ") == "text"

def test_empty():
    """falsy non-numbers are empty"""
    assert describe("") == "empty"
    assert describe(None) == "empty"
    assert describe([]) == "empty"
    assert describe({}) == "empty"
    assert describe(()) == "empty"

def test_other():
    """bools and everything else"""
    assert describe(True) == "other"
    assert describe([1]) == "other"
    assert describe({"a": 1}) == "other"
    assert describe([0]) == "other"
```

#### Uses
- [Variables and types › The core types](#/variables-types/the-core-types)
- [Variables and types › Truthiness](#/variables-types/truthiness)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- Use an `if` / `elif` chain of `isinstance` checks, plus `not value` for the falsy case. The order of the checks matters.
- `bool` is a subclass of `int`, so `isinstance(True, int)` is `True`. Rule out bools before you test for numbers.
- Test for numbers before falsiness, or `0` lands in `"empty"`.

#### Tips
- `isinstance` also takes a tuple of types: `isinstance(value, (int, float))` checks both at once.
- `type(value) is int` is the strict check that excludes `bool`, since `type(True)` is `bool`. It is also the one time `is` on a non-singleton is idiomatic.
- Four branches, four returns. An `if` chain that returns from each branch needs no `elif` at all, though `elif` makes the exclusivity obvious.

#### Docs
- [Built-in functions: `isinstance`](https://docs.python.org/3/library/functions.html#isinstance)
- [Library reference: Truth value testing](https://docs.python.org/3/library/stdtypes.html#truth-value-testing)

### 3. Independent copies

`make_pair` should return a list holding two *separate* empty lists, so that appending to one never changes the other.

```python starter
def make_pair():
    inner = []
    return [inner, inner]
```

```python test
def test_shape():
    """returns a list of two empty lists"""
    pair = make_pair()
    assert isinstance(pair, list)
    assert pair == [[], []]

def test_independent():
    """the two lists are independent"""
    pair = make_pair()
    pair[0].append(1)
    assert pair[0] == [1]
    assert pair[1] == []
    other = make_pair()
    other[1].append("x")
    assert other[0] == []

def test_fresh_each_call():
    """each call makes new lists"""
    first = make_pair()
    first[0].append(1)
    assert make_pair() == [[], []]
```

#### Uses
- [Variables and types › Names, not boxes](#/variables-types/names-not-boxes)
- [Variables and types › Same value or same object](#/variables-types/same-value-or-same-object)

#### Hints
- `[inner, inner]` holds the same list twice: two names for one object.
- Each slot needs its own list. Write two separate `[]` literals, or copy one with `list(inner)`.

#### Tips
- `[[]] * 2` has the same bug: `*` repeats references, not copies.
- `pair[0] == pair[1]` is `True` either way, because both are empty lists. Only `pair[0] is pair[1]` tells the two cases apart, which is why the test appends instead of comparing.
- `[[] for _ in range(2)]` is the version that scales: the `[]` is evaluated once per item.

#### Docs
- [Python FAQ: Why did changing list y also change list x?](https://docs.python.org/3/faq/programming.html#why-did-changing-list-y-also-change-list-x)
