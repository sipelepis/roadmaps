# Control flow

Python has the usual branching and looping constructs, with a few conveniences the language leans on heavily: iterating directly over collections, `else` clauses on loops, and `match` for structural patterns.

## `if` / `elif` / `else`

```python
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "C"
```

Comparisons chain: `0 <= x < 10` means what it says. `and`, `or`, `not` are the boolean operators, and they short-circuit.

The conditional expression is Python's ternary: `label = "even" if n % 2 == 0 else "odd"`.

## `for` iterates over things

You don't loop over indices; you loop over the items.

```python
for fruit in ["apple", "pear"]:
    print(fruit)

for i, fruit in enumerate(["apple", "pear"], start=1):
    print(i, fruit)

for i in range(5):        # 0..4
    ...
```

`range(start, stop, step)` produces integers lazily. `zip` walks several sequences together.

## `while`

```python
attempts = 0
while attempts < 3:
    attempts += 1
```

`break` exits the loop, `continue` skips to the next iteration. A `while True:` with a `break` inside is the idiom for "loop until something happens".

## `else` on loops

The `else` block runs when the loop finishes *without* hitting `break`. It reads as "no break":

```python
for user in users:
    if user.name == target:
        break
else:
    print("not found")
```

## `match`

Since 3.10, `match` compares a value against patterns, unpacking as it goes:

```python
match command.split():
    case ["go", direction]:
        move(direction)
    case ["quit"]:
        return
    case _:
        print("unknown command")
```

It shines with tuples, dicts, and class instances. For plain equality checks a dict lookup or `if` chain is simpler.

## `pass`

An empty block is a syntax error. `pass` is the explicit no-op placeholder.

```python playground
def fizzbuzz(n):
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)

fizzbuzz(15)

for n in [2, 3, 4, 5, 6, 7, 8, 9]:
    for d in range(2, n):
        if n % d == 0:
            break
    else:
        print(n, "is prime")
```

## Exercises

### 1. Grade

Return `"A"` for 90 and above, `"B"` for 80–89, `"C"` for 70–79, and `"F"` below that.

```python starter
def grade(score):
    ...
```

```python test
def test_boundaries():
    """handles the boundaries"""
    assert grade(90) == "A"
    assert grade(89) == "B"
    assert grade(80) == "B"
    assert grade(70) == "C"
    assert grade(69) == "F"
```

### 2. Collatz steps

Starting from `n`, repeatedly apply: if even, halve it; if odd, triple it and add one. Return how many steps it takes to reach `1`. `collatz(1)` is `0`.

```python starter
def collatz(n):
    ...
```

```python test
def test_known_values():
    """known sequence lengths"""
    assert collatz(1) == 0
    assert collatz(6) == 8
    assert collatz(27) == 111
```

### 3. First duplicate

Return the first value that appears a second time while scanning `items` left to right, or `None` if there are no duplicates. Use a loop with `break`, or a loop `else`.

```python starter
def first_duplicate(items):
    ...
```

```python test
def test_finds_first_repeat():
    """returns the first repeated value"""
    assert first_duplicate([3, 1, 4, 1, 5, 3]) == 1

def test_none_when_unique():
    """None when everything is unique"""
    assert first_duplicate([1, 2, 3]) is None
```
