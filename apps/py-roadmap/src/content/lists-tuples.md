# Lists and tuples

Lists are Python's mutable, ordered, general-purpose sequence. Tuples are the immutable version. Both are used constantly, and the choice between them signals intent: a list is a collection that may change, a tuple is a fixed record.

## Lists

```python
nums = [3, 1, 2]
nums.append(4)          # [3, 1, 2, 4]
nums.insert(0, 0)       # [0, 3, 1, 2, 4]
nums.pop()              # 4, list is now [0, 3, 1, 2]
nums.remove(3)          # removes first 3 by value
nums.sort()             # in place, returns None!
sorted(nums)            # new sorted list, original untouched
nums.reverse(); nums[::-1]
len(nums); nums.index(2); 2 in nums
[1, 2] + [3, 4]         # [1, 2, 3, 4], a new list
```

A classic mistake is `result = nums.sort()`, which leaves `result` as `None`. In-place methods return `None` by convention.

## Slicing and copying

Slices produce new lists. `nums[:]` or `list(nums)` is a shallow copy: the list is new but the elements are shared.

```python
nums[-2:]                # the last two items
nums[:-2]                # everything except the last two
nums[1:3] = [10, 20]     # slice assignment replaces a range
del nums[0]
```

## Tuples

```python
point = (3, 4)
x, y = point             # unpacking
single = (5,)            # the comma makes the tuple, not the parentheses
point[0] = 1             # TypeError: tuples are immutable
```

Tuples can be dict keys and set members because they're hashable (as long as their contents are).

## Unpacking

```python
first, *rest = [1, 2, 3, 4]        # first=1, rest=[2, 3, 4]
*init, last = [1, 2, 3, 4]
for name, score in [("a", 1), ("b", 2)]:
    ...
```

## Sorting with a key

```python
people = [("Ada", 36), ("Bob", 25)]
sorted(people, key=lambda p: p[1])           # by age
sorted(words, key=str.lower)                 # case-insensitive
sorted(people, key=lambda p: (-p[1], p[0]))  # oldest first, then by name
```

`key` takes a function, calls it on every item, and sorts by what it returns. `lambda p: p[1]` is a one-line function: it takes `p` and returns `p[1]`. (The Functions module covers `lambda` in full.) When the key returns a tuple, items sort by its first element and ties fall through to the next one. Negating a number flips that part to descending.

Sorts are stable: equal keys keep their original order.

## Useful built-ins

`min`, `max`, `sum`, `any`, `all`, `enumerate`, `zip`, `reversed`. `zip(*pairs)` transposes a list of tuples.

## Nested lists

`[[0] * 3] * 2` creates two references to the *same* inner list. Use a comprehension: `[[0] * 3 for _ in range(2)]`.

```python playground
scores = [("Ada", 92), ("Bob", 78), ("Cy", 92), ("Di", 85)]

ranked = sorted(scores, key=lambda s: (-s[1], s[0]))
for rank, (name, score) in enumerate(ranked, start=1):
    print(f"{rank}. {name:<4} {score}")

names, values = zip(*scores)
print(names)
print(f"average {sum(values) / len(values):.1f}")

# Try: what does scores.sort() return?
```

## Exercises

### 1. Rotate

Return a *new* list with the elements rotated `k` places to the right. `rotate([1, 2, 3, 4], 1)` is `[4, 1, 2, 3]`. `k` may exceed the length. Don't modify the input.

```python starter
def rotate(items, k):
    ...
```

```python test
def test_rotates():
    """rotates right"""
    assert rotate([1, 2, 3, 4], 1) == [4, 1, 2, 3]
    assert rotate([1, 2, 3, 4], 6) == [3, 4, 1, 2]

def test_pure():
    """does not modify the input"""
    src = [1, 2, 3]
    rotate(src, 1)
    assert src == [1, 2, 3]
```

#### Uses
- [Lists and tuples › Slicing and copying](#/lists-tuples/slicing-and-copying)
- [Lists and tuples › Lists](#/lists-tuples/lists)
- [Variables and types › Numbers](#/variables-types/numbers)

#### Hints
- Rotating right by `k` moves the last `k` items to the front.
- `k % len(items)` brings a `k` that's bigger than the list back into range.
- Slice off the tail and the head, then join them with `+`. Slices are new lists, so the input stays untouched.

#### Tips
- `-0` is just `0`, so with `k` of 0, `items[-k:]` is the whole list and `items[:-k]` is empty. The rotation still comes out right.
- `k % len(items)` raises `ZeroDivisionError` on an empty list. Guard it if empty input matters.

#### Docs
- [Library reference: Common sequence operations](https://docs.python.org/3/library/stdtypes.html#common-sequence-operations)

### 2. Chunk

Split `items` into lists of at most `size` elements, keeping order. The last chunk may be shorter.

```python starter
def chunk(items, size):
    ...
```

```python test
def test_chunks():
    """splits into chunks"""
    assert chunk([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]

def test_empty():
    """empty input gives no chunks"""
    assert chunk([], 3) == []
```

#### Uses
- [Lists and tuples › Slicing and copying](#/lists-tuples/slicing-and-copying)
- [What is Python? › `if` and `for`](#/intro/if-and-for)

#### Hints
- Each chunk starts at a multiple of `size`: `0`, `size`, `2 * size`, … A `range` with a step gives you exactly those.
- `items[start:start + size]` is one chunk. Slices clamp at the end, so the short last chunk needs no special case.

#### Tips
- An empty list makes the `range` empty too, so `[]` comes back without an extra check.

#### Docs
- [Built-in functions: `range`](https://docs.python.org/3/library/functions.html#func-range)

### 3. Top scorers

`top(scores, n)` takes a list of `(name, score)` tuples and returns the names of the `n` highest scores, ties broken alphabetically.

```python starter
def top(scores, n):
    ...
```

```python test
def test_top():
    """highest scores first, ties alphabetical"""
    scores = [("Ada", 92), ("Bob", 78), ("Cy", 92), ("Di", 85)]
    assert top(scores, 2) == ["Ada", "Cy"]
    assert top(scores, 3) == ["Ada", "Cy", "Di"]
```

#### Uses
- [Lists and tuples › Sorting with a key](#/lists-tuples/sorting-with-a-key)
- [Lists and tuples › Unpacking](#/lists-tuples/unpacking)
- [Lists and tuples › Slicing and copying](#/lists-tuples/slicing-and-copying)

#### Hints
- Sort the pairs so the best score comes first and ties go alphabetically. One tuple key does both.
- Negate the score inside the key to get descending scores while names stay ascending.
- Slice the first `n` pairs off the sorted list, then loop over them and collect just the names.

#### Tips
- `reverse=True` would reverse the names on ties as well. Negating only the score avoids that.

#### Docs
- [Sorting HOWTO: Key functions](https://docs.python.org/3/howto/sorting.html#key-functions)
