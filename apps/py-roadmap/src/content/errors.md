# Errors and exceptions

Python signals failure by raising an exception, and it does so freely: a missing key, a bad conversion, an index past the end. The idiom is *easier to ask forgiveness than permission*: try the operation and handle the failure, rather than checking every precondition first.

## `try` / `except`

```python
try:
    value = int(text)
except ValueError:
    value = 0
```

Catch the *specific* exception. A bare `except:` or `except Exception:` swallows bugs like typos in variable names (`NameError`) along with the failure you meant to handle.

## Multiple handlers and the exception object

```python
try:
    result = data["count"] / total
except KeyError:
    result = None
except ZeroDivisionError as e:
    print("bad total:", e)
except (TypeError, ValueError) as e:
    raise
```

`raise` on its own re-raises the current exception with its traceback intact.

## `else` and `finally`

```python
try:
    f = open(path)
except FileNotFoundError:
    print("missing")
else:
    data = f.read()     # only if no exception
    f.close()
finally:
    print("done")       # always
```

Keep the `try` body small so you know which line can fail.

## Raising

```python
def withdraw(balance, amount):
    if amount > balance:
        raise ValueError(f"cannot withdraw {amount} from {balance}")
    return balance - amount
```

Use built-in exception types where they fit: `ValueError` for bad values, `TypeError` for wrong types, `KeyError`/`IndexError` for lookups, `RuntimeError` when nothing else fits.

## Custom exceptions

```python
class InsufficientFunds(ValueError):
    pass

class PaymentError(Exception):
    def __init__(self, message, code):
        super().__init__(message)
        self.code = code
```

`class Name(Base): pass` is all a custom exception needs: a new type that behaves exactly like `Base` but has its own name. (The Classes module explains `class` fully.) Subclass an existing type so callers can catch the general case. A module-level base exception (`class AppError(Exception)`) lets users of your library catch everything you raise in one clause.

## Chaining

`raise NewError("context") from e` links the cause so tracebacks show both. Inside an `except` block, a plain `raise NewError(...)` chains implicitly.

## The hierarchy

`BaseException` → `Exception` → most things. `KeyboardInterrupt` and `SystemExit` derive from `BaseException` directly, which is why `except Exception` doesn't stop Ctrl+C.

```python playground
def parse_age(text):
    try:
        age = int(text)
    except ValueError:
        raise ValueError(f"not a number: {text!r}") from None
    if age < 0:
        raise ValueError("age cannot be negative")
    return age

for raw in ["36", "abc", "-1"]:
    try:
        print(raw, "->", parse_age(raw))
    except ValueError as e:
        print(raw, "-> error:", e)
    finally:
        print("  (checked)")
```

## Exercises

### 1. Safe int

`safe_int(text, default=0)` returns the integer in `text`, or `default` if it can't be parsed. Use `try`/`except`, not string checks.

```python starter
def safe_int(text, default=0):
    ...
```

```python test
def test_parses():
    """parses valid input"""
    assert safe_int("42") == 42
    assert safe_int("-7") == -7
    assert safe_int(" 12 ") == 12

def test_default():
    """falls back on bad input"""
    assert safe_int("abc") == 0
    assert safe_int("", default=-1) == -1
    assert safe_int(None, default=5) == 5
    assert safe_int("3.5", default=-1) == -1
    assert safe_int("12abc") == 0

def test_default_only_on_failure():
    """a valid 0 is returned, not the default"""
    assert safe_int("0", default=99) == 0
    assert safe_int("5", default=99) == 5
```

#### Uses
- [Errors and exceptions › `try` / `except`](#/errors/try-except)
- [Errors and exceptions › Multiple handlers and the exception object](#/errors/multiple-handlers-and-the-exception-object)

#### Hints
- Put `return int(text)` inside a `try`, and return `default` from the `except`.
- `int("abc")` raises `ValueError`, but `int(None)` raises `TypeError`. One `except` can catch both with a tuple.

#### Tips
- Don't widen it to `except Exception`. That would hide real bugs along with the bad input.
- Keep only `int(text)` inside the `try`. Anything else you put there gets its errors swallowed by the same handler.
- `except (ValueError, TypeError):` needs the brackets. Without them, `except ValueError, TypeError:` is a syntax error in modern Python.

#### Docs
- [Python tutorial: Handling exceptions](https://docs.python.org/3/tutorial/errors.html#handling-exceptions)

### 2. Custom exception

Define `InsufficientFunds` as a subclass of `ValueError`, and make `withdraw` raise it (with a helpful message) when `amount` exceeds `balance`.

```python starter
def withdraw(balance, amount):
    ...
```

```python test
def test_withdraw():
    """returns the new balance"""
    assert withdraw(100, 30) == 70
    assert withdraw(20, 0) == 20

def test_whole_balance():
    """withdrawing the whole balance is allowed"""
    assert withdraw(50, 50) == 0
    assert withdraw(7, 7) == 0

def test_raises_custom():
    """raises InsufficientFunds, a ValueError"""
    try:
        withdraw(10, 30)
    except InsufficientFunds as e:
        assert isinstance(e, ValueError)
        return
    assert False, "expected InsufficientFunds"

def test_message():
    """the error carries a message"""
    try:
        withdraw(0, 1)
    except InsufficientFunds as e:
        assert str(e) != ""
        return
    assert False, "expected InsufficientFunds"
```

#### Uses
- [Errors and exceptions › Custom exceptions](#/errors/custom-exceptions)
- [Errors and exceptions › Raising](#/errors/raising)

#### Hints
- Define the exception above `withdraw`: `class InsufficientFunds(ValueError):` with `pass` as its body.
- In `withdraw`, raise it with a message when `amount > balance`. Otherwise return the new balance.

#### Tips
- Because it subclasses `ValueError`, callers that already catch `ValueError` keep working.
- The message you pass to the exception becomes `str(e)`. Include the numbers — "cannot withdraw 30 from 10" tells you far more in a log than "insufficient funds".
- An exception class with `pass` as its body still takes arguments, because it inherits `__init__` from `ValueError`. You only write an `__init__` when you want extra fields.

#### Docs
- [Python tutorial: User-defined exceptions](https://docs.python.org/3/tutorial/errors.html#user-defined-exceptions)
- [Python tutorial: Raising exceptions](https://docs.python.org/3/tutorial/errors.html#raising-exceptions)

### 3. Collect errors

`parse_all(texts)` converts every string to an int and returns `(values, errors)`: the successfully parsed values, and a list of the inputs that failed. One bad input must not stop the rest.

```python starter
def parse_all(texts):
    ...
```

```python test
def test_parse_all():
    """separates good and bad inputs"""
    assert parse_all(["1", "x", "3", ""]) == ([1, 3], ["x", ""])
    assert parse_all(["x", "10", "y", "-2"]) == ([10, -2], ["x", "y"])

def test_all_one_kind():
    """all good, all bad, or nothing at all"""
    assert parse_all(["4", "5"]) == ([4, 5], [])
    assert parse_all(["a", "b"]) == ([], ["a", "b"])
    assert parse_all([]) == ([], [])

def test_int_rules():
    """padded numbers parse, decimals are errors"""
    assert parse_all([" 7 ", "4.5"]) == ([7], ["4.5"])
    assert parse_all(["1e3", "08"]) == ([8], ["1e3"])
```

#### Uses
- [Errors and exceptions › `try` / `except`](#/errors/try-except)
- [Control flow › `for` iterates over things](#/control-flow/for-iterates-over-things)
- [Functions › Returning multiple values](#/functions/returning-multiple-values)

#### Hints
- Start two empty lists, then loop over the inputs.
- Put the `try` inside the loop, around the single conversion, so a failure only affects that one input.
- Append to the values list on success and to the errors list in the `except`, then return both.

#### Tips
- `int(" 7 ")` is `7`: `int` ignores surrounding whitespace, so padded numbers aren't errors.
- The `try` goes *inside* the loop. Wrapping the whole loop instead would stop at the first bad input, which is the behaviour this exercise exists to avoid.
- Collect the failing *input*, not the exception. Callers can almost always do more with `"4.5"` than with a `ValueError` object.

#### Docs
- [Python tutorial: Handling exceptions](https://docs.python.org/3/tutorial/errors.html#handling-exceptions)

### 4. Retry

`retry(fn, times)` calls `fn()` until it returns without raising, at most `times` attempts, and re-raises the last exception when every attempt fails.

```python starter
def retry(fn, times):
    ...
```

```python test
def test_retry_succeeds():
    """returns once fn succeeds"""
    calls = []
    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise RuntimeError("flaky")
        return "ok"
    assert retry(flaky, 5) == "ok"
    assert len(calls) == 3

def test_retry_gives_up():
    """re-raises after the last attempt"""
    calls = []
    def broken():
        calls.append(1)
        raise ValueError("nope")
    try:
        retry(broken, 2)
    except ValueError as e:
        assert str(e) == "nope"
        assert len(calls) == 2
        return
    assert False, "expected ValueError"

def test_first_try():
    """calls fn only once when it works straight away"""
    calls = []
    def works():
        calls.append(1)
        return 42
    assert retry(works, 3) == 42
    assert len(calls) == 1

def test_last_attempt():
    """the last allowed attempt can still succeed"""
    calls = []
    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise RuntimeError("flaky")
        return "ok"
    assert retry(flaky, 3) == "ok"
    assert len(calls) == 3

def test_raises_last_error():
    """re-raises the last exception, not an earlier one"""
    calls = []
    def broken():
        calls.append(1)
        raise ValueError(f"attempt {len(calls)}")
    try:
        retry(broken, 3)
    except ValueError as e:
        assert str(e) == "attempt 3"
        return
    assert False, "expected ValueError"
```

#### Uses
- [Errors and exceptions › Multiple handlers and the exception object](#/errors/multiple-handlers-and-the-exception-object)
- [Errors and exceptions › The hierarchy](#/errors/the-hierarchy)
- [Control flow › `for` iterates over things](#/control-flow/for-iterates-over-things)

#### Hints
- Loop `times` times with `range`, and `return fn()` inside a `try`. The first call that succeeds ends the function.
- `fn` could raise anything, so this is one place where `except Exception` is the right catch.
- On the last attempt, don't swallow the error: a bare `raise` inside the `except` re-raises it.

#### Tips
- The name in `except ... as e` is deleted when the block ends. To use the exception after the loop, copy it to another variable first.
- A bare `raise` inside `except` keeps the original traceback. `raise e` re-raises the same error but restarts the traceback at this line, which makes the real origin harder to find.
- `for attempt in range(times)` gives you the attempt number, so "is this the last one?" is `attempt == times - 1` rather than a separate counter.

#### Docs
- [Python tutorial: Handling exceptions](https://docs.python.org/3/tutorial/errors.html#handling-exceptions)
