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

#### Uses
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)

#### Hints
- Check the highest band first: `if score >= 90`, then `elif score >= 80`, and so on down.
- Once one branch runs, the rest are skipped, so each check only needs a lower bound. `else` catches everything below 70.

#### Tips
- A chained comparison like `80 <= score < 90` also works, but ordered `elif`s make the upper bounds unnecessary.

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
```

#### Uses
- [Control flow › `while`](#/control-flow/while)
- [Control flow › `if` / `elif` / `else`](#/control-flow/if-elif-else)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- You don't know in advance how many steps it takes, so loop with `while n != 1:` and count as you go.
- `n % 2 == 0` tests for even. Halve with `n // 2` so `n` stays an int.

#### Tips
- `n / 2` gives a float (`3.0`). It happens to work here, but `//` keeps integers integers.

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

def test_none_when_unique():
    """None when everything is unique"""
    assert first_duplicate([1, 2, 3]) is None
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

#### Docs
- [Python tutorial: `for` statements](https://docs.python.org/3/tutorial/controlflow.html#for-statements)
- [Python tutorial: `else` clauses on loops](https://docs.python.org/3/tutorial/controlflow.html#else-clauses-on-loops)
