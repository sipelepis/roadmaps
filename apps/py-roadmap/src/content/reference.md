# Reference

A lookup page for the built-ins, methods and standard library calls the articles and exercises use. It is not a step on the roadmap: skim it once, then come back when a name in an exercise is unfamiliar. Every entry has a signature, one line on what it does, a sample with its result, and a link to the official documentation.

## How the tests work

Every exercise is checked by plain Python. There is no test framework, no imports to learn.

```python
def test_greets_by_name():
    """greets by name"""
    assert greet("Ada") == "Hello, Ada!"
```

- **`assert <expression>`** — does nothing when the expression is true, raises `AssertionError` when it is false. That is the whole mechanism: a test passes when it runs to the end without raising. `assert 1 + 1 == 2` → nothing happens. [docs](https://docs.python.org/3/reference/simple_stmts.html#the-assert-statement)
- **`def test_...():`** — every function whose name starts with `test_` is run, in the order it appears. Your code and the tests share one namespace, so the tests can call the function you wrote by name.
- **the docstring** — the string on the first line of a test is its label in the results panel. It says what the test is checking, so read it first when one goes red.
- **`assert <expression>, "message"`** — the text after the comma is shown when the assertion fails. `assert False, "expected ValueError"` at the end of a test is the idiom for "this should have raised, and it didn't".

A test that expects an error is written with `try` / `except`, because there is no `assertRaises` here:

```python
try:
    withdraw(10, 30)
except InsufficientFunds:
    return          # reached the expected error: the test is done
assert False, "expected InsufficientFunds"
```

Some tests inspect your code rather than its results. They are not things you need to write:

- **`isinstance(x, T)`** — true when `x` is a `T` (or a subclass). `isinstance("a", str)` → `True`. Used to check you returned a string rather than printing it. [docs](https://docs.python.org/3/library/functions.html#isinstance)
- **`setattr(obj, "name", value)`** — the function form of `obj.name = value`, used when the attribute name is in a variable. `setattr(r, "width", -1)` → the same as `r.width = -1`. [docs](https://docs.python.org/3/library/functions.html#setattr)
- **`types.GeneratorType`** — the type of a generator object, so `isinstance(g, types.GeneratorType)` checks you wrote `yield` rather than building a list. [docs](https://docs.python.org/3/library/types.html#types.GeneratorType)
- **`linecache.getlines(name)` and `exec(source, namespace)`** — read your own file back and run it again in a fresh namespace, which is how a test simulates importing your code instead of running it. [docs](https://docs.python.org/3/library/functions.html#exec)
- **`typing.is_typeddict(X)` / `typing.is_protocol(X)`** — true when `X` was defined with `TypedDict` / `Protocol`. `is_typeddict(dict)` → `False`. [docs](https://docs.python.org/3/library/typing.html#typing.is_typeddict)

## Numbers

- **`abs(x)`** — distance from zero. `abs(-3.5)` → `3.5`. [docs](https://docs.python.org/3/library/functions.html#abs)
- **`round(x, n=None)`** — round to `n` decimals; with no `n` it returns an `int`. Halves go to the even neighbour, so `round(2.5)` → `2` and `round(3.5)` → `4`; `round(3.14159, 2)` → `3.14`. [docs](https://docs.python.org/3/library/functions.html#round)
- **`min(iterable)` / `max(iterable)`** — smallest and largest. `max([3, 9, 4])` → `9`. Both also take several arguments: `min(3, 9)` → `3`, and a `key=` function like `sorted`. [docs](https://docs.python.org/3/library/functions.html#max)
- **`sum(iterable, start=0)`** — adds numbers up. `sum([1, 2, 3])` → `6`, `sum([])` → `0`. [docs](https://docs.python.org/3/library/functions.html#sum)
- **`divmod(a, b)`** — quotient and remainder in one call. `divmod(17, 5)` → `(3, 2)`. [docs](https://docs.python.org/3/library/functions.html#divmod)
- **`pow(base, exp)`** — same as `base ** exp`. `pow(2, 10)` → `1024`. [docs](https://docs.python.org/3/library/functions.html#pow)
- **`int(x)` / `float(x)`** — convert. `int("42")` → `42`, `int(3.9)` → `3` (truncates toward zero), `float("2.5")` → `2.5`. `int("x")` raises `ValueError`. [docs](https://docs.python.org/3/library/functions.html#int)
- **`math.sqrt(x)`** — square root, as a float. `math.sqrt(16)` → `4.0`. [docs](https://docs.python.org/3/library/math.html#math.sqrt)
- **`math.hypot(*coords)`** — the straight-line length of a vector, i.e. the square root of the sum of squares. `math.hypot(3, 4)` → `5.0`, `math.hypot(1, 2, 2)` → `3.0`. [docs](https://docs.python.org/3/library/math.html#math.hypot)
- **`math.pi`, `math.inf`, `math.isclose(a, b)`** — the constant, positive infinity, and a tolerant `==` for floats. `math.isclose(0.1 + 0.2, 0.3)` → `True`. [docs](https://docs.python.org/3/library/math.html#math.isclose)
- **`math.floor(x)` / `math.ceil(x)`** — round down / up to an `int`. `math.floor(-1.2)` → `-2`, `math.ceil(1.2)` → `2`. [docs](https://docs.python.org/3/library/math.html#math.floor)
- **`math.gcd(a, b)` / `math.factorial(n)`** — greatest common divisor and factorial. `math.gcd(84, 36)` → `12`, `math.factorial(5)` → `120`. [docs](https://docs.python.org/3/library/math.html#math.gcd)

## Strings

Strings are immutable: every method returns a *new* string and leaves the original alone.

- **`s.lower()` / `s.upper()`** — change case. `"Ada".lower()` → `'ada'`. [docs](https://docs.python.org/3/library/stdtypes.html#str.lower)
- **`s.title()`** — capitalise the first letter of every word. `"user name".title()` → `'User Name'`; note `"x_y".title()` → `'X_Y'`. [docs](https://docs.python.org/3/library/stdtypes.html#str.title)
- **`s.strip(chars=None)`** — drop leading and trailing whitespace (or the given characters). `"  hi\n".strip()` → `'hi'`. `lstrip` and `rstrip` do one side. [docs](https://docs.python.org/3/library/stdtypes.html#str.strip)
- **`s.split(sep=None)`** — cut into a list. With no argument it splits on runs of whitespace and drops empties: `" a  b ".split()` → `['a', 'b']`. With a separator it keeps them: `"a__b".split("_")` → `['a', '', 'b']`. [docs](https://docs.python.org/3/library/stdtypes.html#str.split)
- **`sep.join(parts)`** — glue an iterable of strings together. `", ".join(["a", "b"])` → `'a, b'`, `"".join(["a", "b"])` → `'ab'`. The separator is the string you call it on. [docs](https://docs.python.org/3/library/stdtypes.html#str.join)
- **`s.replace(old, new)`** — every occurrence. `"hello".replace("l", "L")` → `'heLLo'`. [docs](https://docs.python.org/3/library/stdtypes.html#str.replace)
- **`s.find(sub)` / `s.index(sub)`** — position of the first occurrence. `"hello".find("l")` → `2`; `find` gives `-1` when it is missing, `index` raises `ValueError`. [docs](https://docs.python.org/3/library/stdtypes.html#str.find)
- **`s.count(sub)`** — how many non-overlapping times it appears. `"hello".count("l")` → `2`. [docs](https://docs.python.org/3/library/stdtypes.html#str.count)
- **`s.startswith(p)` / `s.endswith(p)`** — prefix and suffix tests. `"hello.py".endswith(".py")` → `True`. [docs](https://docs.python.org/3/library/stdtypes.html#str.startswith)
- **`s.isdigit()` / `s.isalpha()` / `s.isalnum()`** — true when the string is non-empty *and* every character is a digit / letter / either. `"80".isdigit()` → `True`, `"".isdigit()` → `False`, `"a1".isalnum()` → `True`, `"a 1".isalnum()` → `False`. [docs](https://docs.python.org/3/library/stdtypes.html#str.isdigit)
- **`s.splitlines()`** — split on line endings, without keeping them. `"a\nb\n".splitlines()` → `['a', 'b']`. [docs](https://docs.python.org/3/library/stdtypes.html#str.splitlines)
- **`ord(ch)` / `chr(n)`** — a character's Unicode code point, and back. `ord("a")` → `97`, `chr(97)` → `'a'`, `chr(ord("a") + 1)` → `'b'`. [docs](https://docs.python.org/3/library/functions.html#chr)
- **`s * n`** — repeat. `"ab" * 3` → `'ababab'`, and `"x" * 0` → `''`. [docs](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)
- **`f"{value:spec}"`** — format inline. `f"{3.14159:.2f}"` → `'3.14'`, `f"{'Ada':<6}|"` → `'Ada   |'`, `f"{42:>5}"` → `'   42'`. [docs](https://docs.python.org/3/library/string.html#format-specification-mini-language)
- **`repr(x)`** — the developer-facing text, with quotes kept on strings. `repr("hi")` is the four-character string `'hi'`, and `f"{name!r}"` does the same inside an f-string. [docs](https://docs.python.org/3/library/functions.html#repr)

## Sequences

Lists, tuples and strings share the indexing, slicing and membership operations. Only lists can be changed in place.

- **`len(x)`** — how many items. `len([1, 2, 3])` → `3`, `len("abc")` → `3`. [docs](https://docs.python.org/3/library/functions.html#len)
- **`x[i]`, `x[-1]`** — one item; negative counts from the end. `[1, 2, 3][-1]` → `3`. An index past the end raises `IndexError`.
- **`x[a:b:step]`** — a slice, as a new sequence. Out-of-range bounds clamp instead of raising. `"hello"[1:3]` → `'el'`, `[1, 2, 3][:2]` → `[1, 2]`, `"abc"[::-1]` → `'cba'`. [docs](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)
- **`item in x`** — membership; scans the whole sequence, so it is O(n) on a list. `3 in [1, 2, 3]` → `True`, `"ell" in "hello"` → `True`.
- **`list.append(item)`** — add one item to the end, in place. `nums.append(4)` → returns `None`. [docs](https://docs.python.org/3/library/stdtypes.html#mutable-sequence-types)
- **`list.pop(i=-1)`** — remove and return an item, last by default. `[1, 2, 3].pop()` → `3`; `[1, 2, 3].pop(0)` → `1`, which shifts everything else down. [docs](https://docs.python.org/3/library/stdtypes.html#mutable-sequence-types)
- **`list.insert(i, item)` / `list.remove(value)` / `list.clear()`** — insert at a position, delete the first match by value, empty the list. All return `None`, and all change the list every other name for it can see. [docs](https://docs.python.org/3/library/stdtypes.html#mutable-sequence-types)
- **`list.sort(key=None, reverse=False)`** — sort in place, returning `None`. `nums = [3, 1]; nums.sort()` leaves `nums` as `[1, 3]`. [docs](https://docs.python.org/3/library/stdtypes.html#list.sort)
- **`sorted(iterable, key=None, reverse=False)`** — a new sorted list from anything iterable. `sorted({3, 1, 2})` → `[1, 2, 3]`, `sorted(["bb", "a"], key=len)` → `['a', 'bb']`. Sorts are stable. [docs](https://docs.python.org/3/library/functions.html#sorted)
- **`reversed(seq)`** — a lazy reverse iterator. `list(reversed([1, 2, 3]))` → `[3, 2, 1]`. [docs](https://docs.python.org/3/library/functions.html#reversed)
- **`list(x)` / `tuple(x)`** — build one from any iterable; `list(x)` is also the shallow copy idiom. `list("abc")` → `['a', 'b', 'c']`. [docs](https://docs.python.org/3/library/functions.html#func-list)
- **`copy.deepcopy(x)`** — copy a nested structure all the way down, when a shallow copy is not enough. `copy.deepcopy([[1]])` → a new outer *and* inner list. [docs](https://docs.python.org/3/library/copy.html#copy.deepcopy)
- **`bisect.bisect_left(sorted_list, x)`** — where `x` belongs in a sorted list, found by binary search. `bisect.bisect_left([10, 20, 30], 20)` → `1`, and for a missing value `bisect.bisect_left([10, 30], 20)` → `1`. [docs](https://docs.python.org/3/library/bisect.html#bisect.bisect_left)

## Dictionaries and sets

- **`d[key]`** — look up; raises `KeyError` when the key is absent. [docs](https://docs.python.org/3/library/stdtypes.html#mapping-types-dict)
- **`d.get(key, default=None)`** — look up without raising. `{"a": 1}.get("b", 0)` → `0`. The counting idiom is `d[k] = d.get(k, 0) + 1`. [docs](https://docs.python.org/3/library/stdtypes.html#dict.get)
- **`d.setdefault(key, default)`** — return `d[key]`, inserting `default` first if the key is missing. The grouping idiom is `d.setdefault(k, []).append(v)`. [docs](https://docs.python.org/3/library/stdtypes.html#dict.setdefault)
- **`d.keys()` / `d.values()` / `d.items()`** — views over the keys, the values, and `(key, value)` pairs. `list({"a": 1}.items())` → `[('a', 1)]`. Iterating a dict directly gives its keys. [docs](https://docs.python.org/3/library/stdtypes.html#dict.items)
- **`d.update(other)`** — merge `other` in, in place; `{**a, **b}` and `a | b` build a new dict instead. Right-hand values win. [docs](https://docs.python.org/3/library/stdtypes.html#dict.update)
- **`d.pop(key, default)`** — remove a key and return its value. `{"a": 1}.pop("a")` → `1`. [docs](https://docs.python.org/3/library/stdtypes.html#dict.pop)
- **`dict.fromkeys(iterable)`** — a dict with those keys and `None` values; `list(dict.fromkeys(items))` deduplicates while keeping order. `list(dict.fromkeys("aabc"))` → `['a', 'b', 'c']`. [docs](https://docs.python.org/3/library/stdtypes.html#dict.fromkeys)
- **`set.add(item)` / `set.discard(item)`** — add one item, remove one without raising if it is absent. Both return `None`. [docs](https://docs.python.org/3/library/stdtypes.html#set)
- **`a & b`, `a | b`, `a - b`, `a <= b`** — intersection, union, difference, subset. `{1, 2} & {2, 3}` → `{2}`, `{1, 2} - {2}` → `{1}`. [docs](https://docs.python.org/3/library/stdtypes.html#set)
- **`hash(x)`** — the number a dict or set stores a key under. Only immutable values have one: `hash((1, 2))` works, `hash([1, 2])` raises `TypeError`. [docs](https://docs.python.org/3/library/functions.html#hash)
- **`collections.Counter(iterable)`** — a dict of counts. `Counter("aab")["a"]` → `2`, and `Counter("aab").most_common(1)` → `[('a', 2)]`. [docs](https://docs.python.org/3/library/collections.html#collections.Counter)
- **`collections.defaultdict(factory)`** — a dict that creates a missing value instead of raising. `d = defaultdict(list); d["k"].append(1)` → `{'k': [1]}`. [docs](https://docs.python.org/3/library/collections.html#collections.defaultdict)

## Iteration

- **`range(start, stop, step)`** — integers from `start` up to but not including `stop`. `list(range(5))` → `[0, 1, 2, 3, 4]`, `list(range(0, 10, 3))` → `[0, 3, 6, 9]`, `list(range(0))` → `[]`. [docs](https://docs.python.org/3/library/functions.html#func-range)
- **`enumerate(iterable, start=0)`** — pairs of `(index, item)`. `list(enumerate("ab", start=1))` → `[(1, 'a'), (2, 'b')]`. [docs](https://docs.python.org/3/library/functions.html#enumerate)
- **`zip(*iterables)`** — walk several iterables together, stopping at the shortest. `list(zip([1, 2], "ab"))` → `[(1, 'a'), (2, 'b')]`, and `list(zip(*[[1, 2], [3, 4]]))` → `[(1, 3), (2, 4)]`, which transposes. [docs](https://docs.python.org/3/library/functions.html#zip)
- **`any(iterable)` / `all(iterable)`** — is at least one / is every item truthy. `any([0, 3])` → `True`, `all([])` → `True` (an empty `all` is vacuously true). Both stop at the first decisive item. [docs](https://docs.python.org/3/library/functions.html#all)
- **`iter(x)` / `next(it, default)`** — get an iterator, and pull the next value from it. `next(iter([1, 2]))` → `1`; without a default, an exhausted iterator raises `StopIteration`. [docs](https://docs.python.org/3/library/functions.html#next)
- **`map(fn, iterable)` / `filter(fn, iterable)`** — lazy transform and lazy filter. `list(map(str, [1, 2]))` → `['1', '2']`. A comprehension is usually clearer. [docs](https://docs.python.org/3/library/functions.html#map)
- **`itertools.islice(iterable, n)`** — the first `n` items of any iterable, including an infinite one. `list(islice(count(), 3))` → `[0, 1, 2]`. [docs](https://docs.python.org/3/library/itertools.html#itertools.islice)
- **`itertools.accumulate(iterable, func=add)`** — running totals. `list(accumulate([1, 2, 3]))` → `[1, 3, 6]`. [docs](https://docs.python.org/3/library/itertools.html#itertools.accumulate)
- **`itertools.groupby(iterable, key=None)`** — `(key, group)` pairs for each run of *neighbouring* equal items, so sort first if you want one group per key. `[(k, list(g)) for k, g in groupby("aab")]` → `[('a', ['a', 'a']), ('b', ['b'])]`. [docs](https://docs.python.org/3/library/itertools.html#itertools.groupby)
- **`itertools.chain(*iterables)`** — one iterator over several. `list(chain([1], [2, 3]))` → `[1, 2, 3]`. [docs](https://docs.python.org/3/library/itertools.html#itertools.chain)

## Objects and attributes

- **`getattr(obj, "name", default)`** — read an attribute whose name is in a variable. `getattr(p, "x", 0)` → `p.x`, or `0` when there is none. [docs](https://docs.python.org/3/library/functions.html#getattr)
- **`setattr(obj, "name", value)` / `hasattr(obj, "name")`** — write one, and test for one. `setattr(p, "x", 1)` is `p.x = 1`; `hasattr(p, "x")` → `True`. [docs](https://docs.python.org/3/library/functions.html#setattr)
- **`type(x)`** — the object's class. `type(1)` → `<class 'int'>`. For "is it one of these?" prefer `isinstance`, which accepts subclasses and a tuple of types. [docs](https://docs.python.org/3/library/functions.html#type)
- **`dir(x)` / `help(x)`** — list what an object can do, and print its documentation. Both are for exploring at the prompt. [docs](https://docs.python.org/3/library/functions.html#dir)
- **`fn.__name__` / `fn.__doc__` / `fn.__annotations__`** — a function's name, docstring and type hints. `len.__name__` → `'len'`. A decorator that forgets `functools.wraps` replaces all three with the wrapper's. [docs](https://docs.python.org/3/library/stdtypes.html#definition.__name__)
- **`functools.wraps(fn)`** — the decorator that copies those attributes from the wrapped function onto the wrapper. [docs](https://docs.python.org/3/library/functools.html#functools.wraps)
- **`functools.cache` / `functools.lru_cache(maxsize=n)`** — remember results per argument tuple; arguments must be hashable. [docs](https://docs.python.org/3/library/functools.html#functools.cache)
- **`functools.total_ordering`** — fills in `<=`, `>` and `>=` from your `__eq__` and `__lt__`. [docs](https://docs.python.org/3/library/functools.html#functools.total_ordering)
- **`functools.singledispatch`** — one function with a version per type of its first argument; `fn.registry` maps the registered types. [docs](https://docs.python.org/3/library/functools.html#functools.singledispatch)

## Files and JSON

- **`open(path, mode="r", encoding=None)`** — open a file; use it with `with` so it is always closed. Modes: `"r"` read, `"w"` truncate and write, `"a"` append, `"x"` create-only. [docs](https://docs.python.org/3/library/functions.html#open)
- **`f.read()` / `f.write(text)` / `for line in f`** — whole file as one string, write a string (no newline is added for you), or iterate lazily one line at a time, newline included. [docs](https://docs.python.org/3/library/io.html#io.TextIOBase)
- **`Path(...)` and `/`** — build a path from parts. `Path("data") / "x.json"` → `PosixPath('data/x.json')`, and `.name`, `.stem`, `.suffix`, `.parent` take it apart. [docs](https://docs.python.org/3/library/pathlib.html#pathlib.PurePath)
- **`Path.read_text()` / `Path.write_text(s)`** — read or replace a whole small file in one call. `write_text` returns the number of characters written. [docs](https://docs.python.org/3/library/pathlib.html#pathlib.Path.read_text)
- **`Path.exists()` / `Path.is_file()`** — does it exist, and is it a regular file. [docs](https://docs.python.org/3/library/pathlib.html#pathlib.Path.exists)
- **`Path.unlink(missing_ok=False)`** — delete the file. `Path("app.log").unlink(missing_ok=True)` deletes it if it is there and does nothing if it isn't, which is how the tests start each run from a clean file. [docs](https://docs.python.org/3/library/pathlib.html#pathlib.Path.unlink)
- **`Path.glob(pattern)`** — matching paths in a directory. `list(Path(".").glob("*.json"))`. [docs](https://docs.python.org/3/library/pathlib.html#pathlib.Path.glob)
- **`json.dumps(obj, indent=None)` / `json.loads(text)`** — object to JSON text and back. `json.dumps({"a": 1})` → `'{"a": 1}'`, `json.loads('{"a": 1}')` → `{'a': 1}`. [docs](https://docs.python.org/3/library/json.html#json.dumps)
- **`json.dump(obj, f)` / `json.load(f)`** — the same, straight to and from an open file. Invalid JSON raises `json.JSONDecodeError`, which is a `ValueError`. [docs](https://docs.python.org/3/library/json.html#json.load)
- **`csv.DictReader(f)`** — iterate a CSV as dicts keyed by the header row, handling quotes and commas inside fields. Open the file with `newline=""`. Every value comes back as a string. [docs](https://docs.python.org/3/library/csv.html#csv.DictReader)

## Modules worth knowing

- **`math`** — `sqrt`, `hypot`, `floor`, `ceil`, `gcd`, `factorial`, `pi`, `inf`, `isclose`. See Numbers above. [docs](https://docs.python.org/3/library/math.html)
- **`random`** — `random.random()` → a float in `[0, 1)`, `random.choice(seq)`, `random.shuffle(seq)` (in place, returns `None`), `random.randint(a, b)` (inclusive at both ends). `rng = random.Random(seed)` gives you a private generator with the same methods, so seeding it does not disturb anyone else's `random.random()`. [docs](https://docs.python.org/3/library/random.html#random.Random)
- **`time`** — `time.perf_counter()` for measuring how long something took; `time.time()` is the wall clock and can jump when the system clock is adjusted. `time.sleep(seconds)` waits. [docs](https://docs.python.org/3/library/time.html#time.perf_counter)
- **`datetime`** — `date.today()`, `date(2024, 5, 6)`, `date.fromisoformat("2024-05-06")`, and `timedelta(days=1)` for arithmetic. Subtracting two dates gives a `timedelta`. [docs](https://docs.python.org/3/library/datetime.html)
- **`re`** — `re.findall(pattern, text)` returns every match as a list, `re.search` returns one match object or `None`, `re.sub(pattern, repl, text)` replaces. `\d` is a digit, `\w` a word character, `{4}` exactly four. `re.findall(r"\d+", "a1b22")` → `['1', '22']`. [docs](https://docs.python.org/3/library/re.html)
- **`collections`** — `Counter`, `defaultdict`, `deque`, `namedtuple`. See Dictionaries and sets above. [docs](https://docs.python.org/3/library/collections.html)
- **`itertools`** — `islice`, `accumulate`, `groupby`, `chain`, `count`, `product`, `combinations`. See Iteration above. [docs](https://docs.python.org/3/library/itertools.html)
- **`functools`** — `cache`, `wraps`, `partial`, `reduce`, `total_ordering`, `singledispatch`. See Objects and attributes above. [docs](https://docs.python.org/3/library/functools.html)
- **`contextlib`** — `@contextmanager` turns a generator into a `with`-block; `suppress(FileNotFoundError)` ignores one kind of error. [docs](https://docs.python.org/3/library/contextlib.html#contextlib.contextmanager)
- **`dataclasses`** — `@dataclass`, `field(default_factory=list)`, `asdict`, `replace`, `fields`. [docs](https://docs.python.org/3/library/dataclasses.html)
- **`typing`** — `TypedDict`, `Protocol`, `Literal`, `Any`, and the runtime checks `is_typeddict` and `is_protocol`. [docs](https://docs.python.org/3/library/typing.html)
- **`bisect`** — `bisect_left` and `insort` for keeping a list sorted without re-sorting it. [docs](https://docs.python.org/3/library/bisect.html)
- **`textwrap`** — `wrap(text, width)` and `dedent(text)`. [docs](https://docs.python.org/3/library/textwrap.html)
- **`sys`** — `sys.modules` maps every imported module by name, `sys.path` lists where imports are searched for. [docs](https://docs.python.org/3/library/sys.html)
