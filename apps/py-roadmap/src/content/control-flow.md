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
    assert grade(79) == "C"
    assert grade(70) == "C"
    assert grade(69) == "F"

def test_inside_bands():
    """scores inside each band"""
    assert grade(95) == "A"
    assert grade(85) == "B"
    assert grade(75) == "C"
    assert grade(50) == "F"

def test_extremes():
    """top and bottom scores"""
    assert grade(100) == "A"
    assert grade(0) == "F"
```

#### Uses
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)

#### Hints
- Check the highest band first: `if score >= 90`, then `elif score >= 80`, and so on down.
- Once one branch runs, the rest are skipped, so each check only needs a lower bound. `else` catches everything below 70.

#### Tips
- A chained comparison like `80 <= score < 90` also works, but ordered `elif`s make the upper bounds unnecessary.
- Write the bands in descending order. Starting from `if score >= 70: return "C"` makes every score above 70 a `"C"`, and the later branches unreachable.
- The boundary values are where grading code goes wrong. `>=` includes the boundary, `>` excludes it, and `grade(90)` is the test that catches the mix-up.

#### Docs
- [Python tutorial: `if` statements](https://docs.python.org/3/tutorial/controlflow.html#if-statements)

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
    assert collatz(97) == 118

def test_powers_of_two():
    """powers of two only halve"""
    assert collatz(2) == 1
    assert collatz(16) == 4
    assert collatz(1024) == 10

def test_odd_start():
    """odd numbers triple and add one"""
    assert collatz(3) == 7
    assert collatz(7) == 16
```

#### Uses
- [Control flow › `while`](#/control-flow/while)
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- You don't know in advance how many steps it takes, so loop with `while n != 1:` and count as you go.
- `n % 2 == 0` tests for even. Halve with `n // 2` so `n` stays an int.

#### Tips
- `n / 2` gives a float (`3.0`). It happens to work here, but `//` keeps integers integers, and float arithmetic on big values eventually loses precision.
- Count the steps in a separate variable and return it after the loop. `collatz(1)` never enters the loop, so it returns `0` for free.
- A `while` loop that never changes `n` runs forever and freezes the page. If Run stops responding, that is usually why.

#### Docs
- [Language reference: The `while` statement](https://docs.python.org/3/reference/compound_stmts.html#the-while-statement)

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
    assert first_duplicate([5, 2, 2, 5]) == 2
    assert first_duplicate(["b", "a", "b"]) == "b"

def test_none_when_unique():
    """None when everything is unique"""
    assert first_duplicate([1, 2, 3]) is None
    assert first_duplicate([7]) is None
    assert first_duplicate([]) is None

def test_repeat_anywhere():
    """finds repeats that are side by side or far apart"""
    assert first_duplicate([1, 1]) == 1
    assert first_duplicate([9, 8, 7, 6, 9]) == 9
    assert first_duplicate([0, 1, 0]) == 0
```

#### Uses
- [Control flow › `for` iterates over things](#/control-flow/for-iterates-over-things)
- [Control flow › `else` on loops](#/control-flow/else-on-loops)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- Keep a list of the values you've already seen. It starts empty.
- For each item: if it's already `in` that list, it's your answer. Otherwise append it.
- If the loop finishes without finding one, return `None`.

#### Tips
- `in` on a list checks every element, which gets slow on big inputs. Dicts and sets introduces a faster tool for "have I seen this?".
- Returning the item as soon as you see it a second time is what makes it the *first* duplicate. Collecting all duplicates and returning one at the end gives a different answer.
- `return None` at the end is optional — a function that falls off the end returns `None` anyway — but writing it says you meant it.

#### Docs
- [Python tutorial: `for` statements](https://docs.python.org/3/tutorial/controlflow.html#for-statements)
- [Python tutorial: `else` clauses on loops](https://docs.python.org/3/tutorial/controlflow.html#else-clauses-on-loops)
