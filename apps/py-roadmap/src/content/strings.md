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
```

`split()` with no argument splits on any whitespace and drops empties, which is usually what you want.

## Formatting

f-strings are the standard. The part after the colon is a format spec:

```python
name, total = "Ada", 1234.5
f"{name}: {total:.2f}"        # 'Ada: 1234.50'
f"{total:,}"                  # '1,234.5'
f"{name:>10}"                 # '       Ada'
f"{0.256:.1%}"                # '25.6%'
f"{name=}"                    # "name='Ada'"  handy for debugging
```

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
    assert not is_palindrome("python")

def test_ignores_noise():
    """ignores case, spaces and punctuation"""
    assert is_palindrome("A man, a plan, a canal: Panama")
```

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

def test_edge_cases():
    """handles stray underscores"""
    assert to_camel("__already") == "already"
    assert to_camel("a__b") == "aB"
```

### 3. Receipt lines

Given a list of `(name, price)` pairs, return a list of strings where the name is left-aligned in 12 characters and the price right-aligned in 8 with two decimals, e.g. `"Coffee          3.50"`.

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
```
