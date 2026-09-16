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

There is also a [Reference](#/reference) page listing the built-ins, methods and standard library calls used across the roadmap, each with a one-line description and an example. Look a name up there when an exercise uses one you haven't met.

## Reading the tests

The tests are ordinary Python, and reading them is the fastest way to understand what a problem wants.

```python
def test_greets_by_name():
    """greets by name"""
    assert greet("Ada") == "Hello, Ada!"
```

- `assert something` does nothing when `something` is true and raises `AssertionError` when it is false. A test passes by running to the end without raising.
- Every function named `test_...` is run in order. Your code and the tests share one namespace, so a test can call the function you just wrote.
- The string on the first line of the function is its docstring. It is the label shown next to the test in the results panel, so it tells you what failed.
- `assert False, "expected an error"` at the end of a test is the idiom for "this line should never be reached".

A few tests check *how* you answered, not just what came back. `isinstance(value, str)` is `True` when `value` is a string, so `assert isinstance(greet("Bob"), str)` is a test making sure you returned text rather than printing it. [Reference › How the tests work](#/reference/how-the-tests-work) covers the rest of these.

## Functions and `return`

Every exercise hands you a function to finish. `def` names a block of code, the names in parentheses are its parameters, and `return` sends a value back to whoever called it:

```python
def double(n):
    return n * 2

def label(name):
    return f"Name: {name}"   # f-string: {name} is replaced by its value

double(21)       # 42
label("Ada")     # 'Name: Ada'
```

The tests call your function and check what it returns, so `return` the answer. Printing it isn't the same thing. The Functions module covers the rest.

## `if` and `for`

These two carry most early exercises. The Control flow module goes deeper.

```python
def sign(n):
    if n > 0:
        return "positive"
    elif n < 0:
        return "negative"
    else:
        return "zero"

total = 0
for n in [4, 5, 6]:
    total += n            # short for total = total + n; 15 after the loop

evens = []
for n in range(0, 10, 2):
    evens.append(n)       # [0, 2, 4, 6, 8] after the loop
```

- Compare with `==`, `!=`, `<`, `<=`, `>`, `>=`, and combine conditions with `and`, `or`, `not`.
- `x in items` is `True` when the list (or string) contains `x`.
- `for` runs its block once per item of a list, string, or other collection. `range(5)` counts 0 to 4; `range(start, stop, step)` sets all three.
- Starting with `total = 0` or `result = []` and updating it inside the loop builds most answers.
- `return` inside a loop ends the whole function straight away.

Some loops are already written for you as built-in functions, which you call instead of looping:

```python
sum([4, 5, 6])      # 15   adds the numbers; sum([]) is 0
len([4, 5, 6])      # 3    how many items (also works on a string)
min([4, 5, 6])      # 4
max([4, 5, 6])      # 6
sorted([6, 4, 5])   # [4, 5, 6]   a new sorted list
```

Write the loop yourself the first time to see what it does, then reach for the built-in. [Reference › Iteration](#/reference/iteration) lists the rest.

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
    assert greet("Grace") == "Hello, Grace!"

def test_returns_not_prints():
    """returns a string rather than printing it"""
    assert isinstance(greet("Bob"), str)
    assert greet("Bob") == "Hello, Bob!"

def test_keeps_name_as_given():
    """keeps the name exactly as given"""
    assert greet("ada lovelace") == "Hello, ada lovelace!"
    assert greet("X") == "Hello, X!"
```

#### Uses
- [What is Python? › Functions and `return`](#/intro/functions-and-return)
- [What is Python? › Reading the tests](#/intro/reading-the-tests)

#### Hints
- Replace the `...` with a `return` statement. The tests check the value that comes back, not what gets printed.
- An f-string drops a variable into text: `f"...{name}..."`.

#### Tips
- A function that only calls `print` still returns `None`. Tests can only see returned values.
- `"Hello, " + name + "!"` works just as well. f-strings win once there is more than one value to insert.
- The exclamation mark and the comma are part of the expected text. Compare your output character by character when a test fails on something that looks right.

#### Docs
- [Python tutorial: Defining functions](https://docs.python.org/3/tutorial/controlflow.html#defining-functions)
- [Python tutorial: Formatted string literals](https://docs.python.org/3/tutorial/inputoutput.html#formatted-string-literals)

### 2. Sum a list

Write `total` so it returns the sum of a list of numbers, and `0` for an empty list. Write it with a loop first. Then try the built-in `sum(numbers)`, which does the same job in one call.

```python starter
def total(numbers):
    ...
```

```python test
def test_adds_numbers():
    """adds numbers"""
    assert total([1, 2, 3]) == 6
    assert total([10, 20, 30, 40]) == 100

def test_empty_list():
    """empty list is 0"""
    assert total([]) == 0

def test_single_and_negative():
    """handles one number and negative numbers"""
    assert total([7]) == 7
    assert total([5, -8, 1]) == -2

def test_decimals():
    """adds decimals too"""
    assert total([0.5, 0.25]) == 0.75
    assert total([1.5, 2, 3]) == 6.5
```

#### Uses
- [What is Python? › `if` and `for`](#/intro/if-and-for)
- [What is Python? › Functions and `return`](#/intro/functions-and-return)

#### Hints
- Keep a running total that starts at `0`, and add each number to it in a `for` loop.
- Return the total after the loop, not inside it. An empty list skips the loop, so you get `0` for free.

#### Tips
- `sum(numbers)` is the one-liner. Writing the loop once shows you what it does for you.
- Put `return total` after the loop, lined up with the `for`. Indented one level further it sits *inside* the loop and returns after the first number.
- `total = 0` before the loop is what makes the empty list return `0` rather than raising. Starting from the first item instead would need a special case.

#### Docs
- [Python tutorial: `for` statements](https://docs.python.org/3/tutorial/controlflow.html#for-statements)
- [Built-in functions: `sum`](https://docs.python.org/3/library/functions.html#sum)
