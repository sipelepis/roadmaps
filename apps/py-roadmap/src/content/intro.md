# What is Python?

Python is a general-purpose language built around one idea: code is read far more often than it is written. Its syntax uses indentation instead of braces, its standard library covers most everyday jobs, and the interpreter runs your code line by line with no compile step. That combination is why it shows up everywhere from data science to web backends to the scripts that glue a company together.

## Running Python

```python
print("Hello, world!")
```

Save that as `hello.py` and run `python hello.py`, or type it into the interactive prompt (`python` with no arguments) and see the result immediately. The prompt, called the REPL, is the fastest way to try an idea.

On this site the editor at the bottom of every module runs real CPython inside your browser through WebAssembly. Nothing to install.

## Indentation is syntax

Blocks are defined by indentation, not by braces. Four spaces per level is the convention.

```python
def greet(name):
    if name:
        print(f"Hello, {name}!")
    else:
        print("Hello, stranger.")
```

Mixing tabs and spaces is an error, and so is inconsistent indentation. Editors handle this for you once configured.

## Dynamic and strongly typed

Variables don't declare a type, but every value has one, and Python refuses to guess across types:

```python
count = 3
count = "three"    # fine: the name now points at a string
"3" + 3            # TypeError: can only concatenate str (not "int") to str
```

## Everything is an object

Numbers, strings, functions, classes, and modules are all objects with attributes and methods. `dir(x)` lists what an object can do, and `help(x)` shows its documentation.

## The Zen of Python

`import this` prints the guiding principles. The ones that matter most day to day: *explicit is better than implicit*, *simple is better than complex*, and *there should be one obvious way to do it*.

## How this roadmap works

Each module has an article, a playground, and exercises. Exercises come with tests written as `test_` functions that use plain `assert`. A problem passes when your code runs without error and every test passes.

```python playground
# Press Run (or Ctrl+Enter). Then change the name and run again.
name = "world"
print(f"Hello, {name}!")

for i in range(3):
    print("Python", i)
```

## Exercises

### 1. Say hello

Write `greet` so that `greet("Ada")` returns the string `"Hello, Ada!"`.

```python starter
def greet(name):
    ...
```

```python test
def test_greets_by_name():
    """greets by name"""
    assert greet("Ada") == "Hello, Ada!"

def test_returns_not_prints():
    """returns a string rather than printing it"""
    assert isinstance(greet("Bob"), str)
```

### 2. Sum a list

Write `total` so it returns the sum of a list of numbers, and `0` for an empty list. Try it with a loop first, then look up the built-in `sum`.

```python starter
def total(numbers):
    ...
```

```python test
def test_adds_numbers():
    """adds numbers"""
    assert total([1, 2, 3]) == 6

def test_empty_list():
    """empty list is 0"""
    assert total([]) == 0
```
