# Modules and imports

A module is a `.py` file. A package is a folder of them with an `__init__.py`. Everything at the top level of a file is the module's namespace, and `import` is how one file uses another. The playground here is a single file, so this module is more reading than typing; the exercises focus on what you *can* do in one file: the standard library and `__name__`.

## Importing

```python
import math
math.sqrt(16)

from math import sqrt, pi
from collections import Counter as C

import os.path                     # submodule
from . import sibling              # relative import inside a package
```

Prefer `import module` and qualified names for clarity, `from module import name` for a handful of frequently used names. Never `from module import *` outside the REPL; it hides where names come from.

## What happens on import

The module's code runs *once*, top to bottom, and the resulting namespace is cached in `sys.modules`. A second `import` anywhere in the program returns the cached module. That is why module-level code should define things, not do things.

## `if __name__ == "__main__":`

When a file is run directly, its `__name__` is `"__main__"`. When imported, it's the module name. The guard lets a file be both a library and a script:

```python
def main():
    ...

if __name__ == "__main__":
    main()
```

## Packages

```
myapp/
  __init__.py
  models.py
  services/
    __init__.py
    billing.py
```

`from myapp.services import billing` works when `myapp`'s parent directory is on `sys.path`, which it is when you run from there or install the package.

## Where modules come from

`sys.path` lists the directories searched: the script's directory, then `PYTHONPATH`, then the installed site-packages. Third-party packages are installed into a *virtual environment* (`python -m venv .venv`) so projects don't share dependencies:

```
python -m venv .venv
source .venv/bin/activate      # .venv\Scripts\activate on Windows
pip install requests
```

`pyproject.toml` declares a project's dependencies; tools like `uv` and `pip` read it.

## The standard library

The reason to learn what's in it is that it's already installed everywhere. A few modules every Python programmer should recognise:

| Module | For |
| --- | --- |
| `math`, `statistics`, `random` | numbers |
| `datetime`, `time` | dates and clocks |
| `json`, `csv` | data formats |
| `pathlib`, `os`, `shutil` | files and paths |
| `re` | regular expressions |
| `collections`, `itertools`, `functools` | data structures and iteration helpers |
| `dataclasses`, `typing`, `enum` | modelling data |
| `unittest`, `logging`, `argparse` | testing, logs, CLIs |

```python playground
import math
import random
from collections import Counter

random.seed(42)
rolls = [random.randint(1, 6) for _ in range(20)]
print(rolls)
print(Counter(rolls).most_common(2))
print(math.gcd(84, 36), math.factorial(5))

print(__name__)      # "__main__" here, the module name when imported

# Try: import this
```

## Exercises

### 1. Use the standard library

`hypotenuse(a, b)` returns the length of the hypotenuse using the `math` module (`math.hypot` or `math.sqrt`).

```python starter
def hypotenuse(a, b):
    ...
```

```python test
def test_hypot():
    """3-4-5 triangle"""
    assert hypotenuse(3, 4) == 5.0

def test_uses_math():
    """the math module is imported"""
    import sys
    assert "math" in sys.modules
```

#### Uses
- [Modules and imports › Importing](#/modules/importing)

#### Hints
- `import math` at the top of your code, then call its functions as `math.name(...)`.
- `math.hypot(a, b)` computes the hypotenuse directly; `math.sqrt(a ** 2 + b ** 2)` works too.

#### Tips
- `math.hypot` takes any number of coordinates: `math.hypot(1, 2, 2)` is `3.0`.

#### Docs
- [Library reference: `math.hypot`](https://docs.python.org/3/library/math.html#math.hypot)

### 2. Main guard

Write `main()` so that it appends `"ran"` to `LOG`, and call it under a `__name__ == "__main__"` guard. In this playground the file runs as `__main__`, so the guard fires, but the tests also check that `main` exists as an importable function.

```python starter
LOG = []
```

```python test
def test_main_ran():
    """main ran under the guard"""
    assert LOG == ["ran"]

def test_main_callable():
    """main is a reusable function"""
    main()
    assert LOG == ["ran", "ran"]
```

#### Uses
- [Modules and imports › `if __name__ == "__main__":`](#/modules/if-name-main)
- [Functions › Scope](#/functions/scope)

#### Hints
- Define `main()` with a one-line body that appends `"ran"` to `LOG`.
- Below it, at the top level, add the `if __name__ == "__main__":` guard and call `main()` inside it.

#### Tips
- `main` can append to `LOG` without `global`, because it changes the list rather than rebinding the name.

#### Docs
- [Library reference: `__main__`, idiomatic usage](https://docs.python.org/3/library/__main__.html#idiomatic-usage)

### 3. Random with a seed

`shuffled_deck(seed)` returns the 52 cards `"2H"`, `"3H"`, … `"AS"` (ranks `2`–`10`, `J`, `Q`, `K`, `A`; suits `H`, `D`, `C`, `S`) shuffled with `random.Random(seed)` so the order is reproducible. `rng = random.Random(seed)` gives you a random generator of your own, and `rng.shuffle(cards)` shuffles a list in place (it returns `None`).

```python starter
def shuffled_deck(seed):
    ...
```

```python test
def test_deck():
    """52 unique cards"""
    deck = shuffled_deck(1)
    assert len(deck) == 52 and len(set(deck)) == 52
    assert "10S" in deck and "AH" in deck

def test_reproducible():
    """same seed, same order; different seed, different order"""
    assert shuffled_deck(7) == shuffled_deck(7)
    assert shuffled_deck(7) != shuffled_deck(8)
```

#### Uses
- [Modules and imports › Importing](#/modules/importing)
- [Control flow › `for` iterates over things](#/control-flow/for-iterates-over-things)

#### Hints
- Build the deck with two nested loops, one over ranks and one over suits, appending `rank + suit` each time.
- Write the ranks out as a list of strings, `"10"` included, so every card is plain string concatenation.
- Then shuffle the list with your own `random.Random(seed)` and return it.

#### Tips
- A private `random.Random(seed)` leaves the shared generator behind `random.random()` alone, unlike `random.seed(...)`.

#### Docs
- [Library reference: `random.Random`](https://docs.python.org/3/library/random.html#random.Random)
- [Library reference: `random.shuffle`](https://docs.python.org/3/library/random.html#random.shuffle)
