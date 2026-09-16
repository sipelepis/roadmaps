# Strings

Text handling is where Python's batteries-included philosophy is most visible. Strings are immutable, so every method returns a new string, and the method set covers almost everything you'd otherwise write by hand.

## Slicing

```python
s = "hello world"
s[0]        # 'h'
s[-5:]      # 'world'
s[:5]       # 'hello'
s[::2]      # 'hlowrd'
s[::-1]     # 'dlrow olleh'  reversed
```

Slices never raise on out-of-range bounds; they clamp.

## Everyday methods

```python
"  padded  ".strip()            # 'padded'
"a,b,c".split(",")              # ['a', 'b', 'c']
", ".join(["a", "b"])           # 'a, b'
"hello".replace("l", "L")       # 'heLLo'
"Hello".lower(), "hello".title()
"hello".startswith("he")        # True
"hello".find("l")               # 2, or -1 if missing
"hello".count("l")              # 2
"42".isdigit(), "abc".isalpha()
"a1".isalnum()                  # True: a letter or a digit
"a 1".isalnum()                 # False: the space is neither
"".isdigit()                    # False: the empty string is never any of them
```

`split()` with no argument splits on any whitespace and drops empties, which is usually what you want.

Two gotchas. Every method here returns a *new* string, so `s.strip()` on its own does nothing — you have to use the result: `s = s.strip()`. And `"hello".replace("l", "L")` replaces every occurrence, not the first; pass a count as the third argument to limit it.

## Formatting

f-strings are the standard. The part after the colon is a format spec:

```python
name, total = "Ada", 1234.5
f"{name}: {total:.2f}"        # 'Ada: 1234.50'
f"{total:,}"                  # '1,234.5'
f"{name:>10}"                 # '       Ada'
f"{name:<10}|"                # 'Ada       |'
f"{total:>10.2f}"             # '   1234.50'
f"{0.256:.1%}"                # '25.6%'
f"{name=}"                    # "name='Ada'"  handy for debugging
```

A number before the precision is a minimum width. `>` right-aligns the value in that width and `<` left-aligns it, and they combine with a precision, as in `>10.2f`.

## Membership and comparison

```python
"ell" in "hello"     # True
"apple" < "banana"   # True, lexicographic by code point
```

## Characters and bytes

A `str` is a sequence of Unicode code points. `ord("A")` is `65`, `chr(65)` is `"A"`. Encoding to bytes is explicit: `"é".encode("utf-8")` gives `b'\xc3\xa9'`. You rarely need bytes until you touch files, sockets, or hashing.

## Multi-line and raw strings

```python
text = """line one
line two"""

path = r"C:\new\folder"     # raw: backslashes are literal
```

## Building strings efficiently

Concatenating in a loop with `+=` is quadratic. Collect pieces in a list and `join` once.

```python playground
sentence = "The quick brown fox jumps over the lazy dog"

words = sentence.split()
print(len(words), "words")
print(" ".join(w[::-1] for w in words))
print(sentence.title())

for word in sorted(words, key=len, reverse=True)[:3]:
    print(f"{word:<6} {len(word)}")

# Try: count how many times each vowel appears.
```

## Exercises

### 1. Palindrome

Return `True` if `text` reads the same forwards and backwards, ignoring case, spaces, and punctuation.

```python starter
def is_palindrome(text):
    ...
```

```python test
def test_simple():
    """plain words"""
    assert is_palindrome("racecar")
    assert is_palindrome("x")
    assert not is_palindrome("python")
    assert not is_palindrome("abca")

def test_ignores_noise():
    """ignores case, spaces and punctuation"""
    assert is_palindrome("A man, a plan, a canal: Panama")
    assert is_palindrome("RaceCar")
    assert is_palindrome("Was it a car or a cat I saw?")
    assert not is_palindrome("A man, a plan")

def test_digits_count():
    """digits are kept, not ignored"""
    assert is_palindrome("12321")
    assert is_palindrome("1 2, 21")
    assert not is_palindrome("123")
```

#### Uses
- [Strings › Everyday methods](#/strings/everyday-methods)
- [Strings › Slicing](#/strings/slicing)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- First build a cleaned-up copy: lowercase the text, then keep only its letters and digits.
- Loop over the characters and keep those where `ch.isalpha() or ch.isdigit()` is true.
- A string is a palindrome when it equals its own reverse, `s[::-1]`.

#### Tips
- `ch.isalnum()` checks for a letter or digit in one call, replacing the `isalpha() or isdigit()` pair.
- `"".join(kept)` turns the list of surviving characters back into a string. Comparing a list with its reverse works too, but the string reads better.
- Lowercase once, at the start. Lowercasing inside the comparison instead is easy to get half right.

#### Docs
- [Library reference: `str.isalpha`](https://docs.python.org/3/library/stdtypes.html#str.isalpha)
- [Library reference: Common sequence operations](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)

### 2. Snake to camel

Convert `snake_case_names` to `camelCase`. Leading and trailing underscores are removed, and repeated underscores count as one.

```python starter
def to_camel(name):
    ...
```

```python test
def test_converts():
    """converts snake_case"""
    assert to_camel("user_name") == "userName"
    assert to_camel("http_response_code") == "httpResponseCode"
    assert to_camel("x_y_z") == "xYZ"

def test_edge_cases():
    """handles stray underscores"""
    assert to_camel("__already") == "already"
    assert to_camel("a__b") == "aB"
    assert to_camel("user_name_") == "userName"
    assert to_camel("_private_value__") == "privateValue"

def test_single_word():
    """leaves a single word alone"""
    assert to_camel("name") == "name"
    assert to_camel("x") == "x"
```

#### Uses
- [Strings › Everyday methods](#/strings/everyday-methods)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- `name.split("_")` gives the pieces. Leading or doubled underscores leave empty strings in that list; skip them.
- Keep the first real word as it is, run every later one through `.title()`, and glue them together.

#### Tips
- `split("_")` with an explicit separator keeps empty pieces. Plain `split()` on whitespace drops them.
- `[p for p in name.split("_") if p]` throws the empty pieces away in one line, which handles the leading, trailing and doubled underscores together.
- `.title()` uppercases the first letter and lowercases the rest, so `"HTTP".title()` is `"Http"`. Use `p[0].upper() + p[1:]` when the rest of the word must survive.

#### Docs
- [Library reference: `str.split`](https://docs.python.org/3/library/stdtypes.html#str.split)
- [Library reference: `str.title`](https://docs.python.org/3/library/stdtypes.html#str.title)

### 3. Receipt lines

Given a list of `(name, price)` pairs, return a list of strings where the name is left-aligned in 12 characters and the price right-aligned in 8 with two decimals, e.g. `"Coffee          3.50"`. Each pair unpacks right in the loop header: `for name, price in items:` gives you both parts.

```python starter
def receipt_lines(items):
    ...
```

```python test
def test_format():
    """pads name and price"""
    lines = receipt_lines([("Coffee", 3.5), ("Bagel", 12)])
    assert lines == ["Coffee          3.50", "Bagel          12.00"]
    assert all(len(line) == 20 for line in lines)

def test_every_pair_in_order():
    """one line per pair, in order"""
    lines = receipt_lines([("Tea", 2), ("Cake", 4.25), ("Juice", 0.1)])
    assert lines == ["Tea             2.00", "Cake            4.25", "Juice           0.10"]
    assert receipt_lines([]) == []

def test_rounding_and_width():
    """rounds to two decimals and fills the width"""
    lines = receipt_lines([("Tea", 2.999), ("Sandwich", 1234.5), ("Hot chocolat", 4.25)])
    assert lines == ["Tea             3.00", "Sandwich     1234.50", "Hot chocolat    4.25"]
```

#### Uses
- [Strings › Formatting](#/strings/formatting)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- Start an empty list, loop over the pairs, and append one formatted line per pair.
- Two format specs do all the padding: `<` with a width for the name, and `>` with a width plus `.2f` for the price.
- Put the two fields side by side with no space between them. The widths add up to 20.

#### Tips
- The `f` in `.2f` also turns an int like `12` into `12.00`.
- A width is a *minimum*, not a maximum. `f"{'Hot chocolat':<12}"` fills exactly 12, but a longer name would push the line past 20 rather than being cut.
- `.2f` rounds rather than truncating, which is why `2.999` prints as `3.00`.

#### Docs
- [Library reference: Format specification mini-language](https://docs.python.org/3/library/string.html#format-specification-mini-language)
