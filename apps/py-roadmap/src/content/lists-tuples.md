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
```

A classic mistake is `result = nums.sort()`, which leaves `result` as `None`. In-place methods return `None` by convention.

## Slicing and copying

Slices produce new lists. `nums[:]` or `list(nums)` is a shallow copy: the list is new but the elements are shared.

```python
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
sorted(items, key=lambda i: (-i.score, i.name))   # descending score, then name
```

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
