# Counting at scale

Count frequencies and distinct items in fixed memory with Count-Min and HyperLogLog, and merge sketches across machines.

## Exact counting does not scale

Not written yet.

## Hashing you can reproduce

Not written yet.

## Count-Min sketch

Not written yet.

## HyperLogLog

Not written yet.

## Merging sketches

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Count-Min add and estimate

A Count-Min sketch is a table of `depth` rows with `width` counters each. Write `cm_new(width, depth)`, which returns that table as a list of `depth` lists of `width` zeros, each row its own list. Raise `ValueError` when `width` or `depth` is less than 1.

Write `cm_add(sketch, key, count=1)`, which adds `count` to one counter in every row: row `r` uses column `bucket(key, r, width)`, where `width` is the length of a row. It changes `sketch` in place and returns `None`. Write `cm_estimate(sketch, key)`, which returns the smallest of the key's counters across the rows, an `int`. An empty sketch estimates 0 for every key. The starter gives you `bucket`, which uses `zlib.crc32` so every machine agrees on the columns.

```python starter
import zlib


def bucket(key, row, width):
    return zlib.crc32(f'{row}:{key}'.encode()) % width


def cm_new(width, depth):
    ...


def cm_add(sketch, key, count=1):
    ...


def cm_estimate(sketch, key):
    ...
```

```python test
def test_new():
    """a fresh table of zeros estimates 0"""
    s = cm_new(4, 3)
    assert s == [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    s[0][1] = 9
    assert s[1][1] == 0
    assert cm_estimate(cm_new(8, 2), 'anything') == 0


def test_add():
    """one counter per row goes up by count"""
    s = cm_new(5, 2)
    for key in ['a', 'b', 'a', 'c']:
        cm_add(s, key)
    assert s == [[1, 0, 2, 1, 0], [3, 0, 0, 1, 0]]
    assert [cm_estimate(s, k) for k in ['a', 'b', 'c']] == [2, 1, 1]
    s = cm_new(8, 3)
    cm_add(s, 'apple', 5)
    cm_add(s, 'pear', 2)
    cm_add(s, 'fig')
    assert [cm_estimate(s, k) for k in ['apple', 'pear', 'fig', 'kiwi']] == [5, 2, 1, 0]


def test_never_under():
    """on a skewed stream estimates are never below the truth"""
    s = cm_new(16, 3)
    true = {}
    for i in range(50):
        key = f'k{i}'
        true[key] = 200 // (i + 1)
        for _ in range(true[key]):
            cm_add(s, key)
    for key, count in true.items():
        assert cm_estimate(s, key) >= count
    assert [cm_estimate(s, k) for k in ['k0', 'k1', 'k5', 'k20', 'k49', 'zz']] == [215, 115, 39, 46, 15, 15]


def test_bad_shape():
    """width or depth below 1 raises ValueError"""
    for width, depth in ((0, 3), (4, 0)):
        try:
            cm_new(width, depth)
        except ValueError:
            pass
        else:
            raise AssertionError(f'cm_new({width}, {depth}) should have raised ValueError')
```

### 2. Size a Count-Min

Write `cm_size(eps, delta)`, which returns a tuple `(width, depth)` for a Count-Min sketch whose estimates overshoot by at most `eps` times the stream's total count, with probability at least `1 - delta`. Use `width = math.ceil(math.e / eps)` and `depth = math.ceil(math.log(1 / delta))`, both `int`. Raise `ValueError` when `eps` is 0 or less, or when `delta` is not strictly between 0 and 1.

```python starter
import math


def cm_size(eps, delta):
    ...
```

```python test
def test_sizes():
    """width from eps and depth from delta"""
    assert cm_size(0.001, 0.01) == (2719, 5)
    assert cm_size(0.01, 0.001) == (272, 7)
    assert cm_size(0.05, 0.2) == (55, 2)


def test_loose():
    """a loose bound still rounds up"""
    assert cm_size(0.5, 0.5) == (6, 1)
    assert cm_size(0.003, 0.05) == (907, 3)


def test_bad_inputs():
    """eps of 0 or less, or delta outside 0 to 1, raises ValueError"""
    for eps, delta in ((0, 0.01), (-0.1, 0.01), (0.01, 0), (0.01, 1), (0.01, 1.5)):
        try:
            cm_size(eps, delta)
        except ValueError:
            pass
        else:
            raise AssertionError(f'cm_size({eps}, {delta}) should have raised ValueError')
```

### 3. HyperLogLog

HyperLogLog keeps `m = 2 ** b` small registers. Write `hll_new(b)`, which returns a list of `m` zeros, and raises `ValueError` unless `b` is from 4 to 16.

Write `hll_add(regs, h, b)`, where `h` is a 64-bit hash of a key, such as `h64(key)` from the starter. The top `b` bits pick the register: `index = h >> (64 - b)`. The other `64 - b` bits are `rest = h & ((1 << (64 - b)) - 1)`, and the rank is the position of their first 1 bit counted from the left, `rank = (64 - b) - rest.bit_length() + 1`, which is `65 - b` when `rest` is 0. Set `regs[index]` to the larger of its current value and `rank`. It changes `regs` in place and returns `None`.

Write `hll_estimate(regs)`, which returns the estimated number of distinct keys as a float. With `m = len(regs)`, take `alpha` as 0.673 when `m` is 16, 0.697 when `m` is 32, 0.709 when `m` is 64, and `0.7213 / (1 + 1.079 / m)` when `m` is 128 or more. The raw estimate is `E = alpha * m * m / sum(2.0 ** -r for r in regs)`. When `E <= 2.5 * m` and some registers are still 0, return `m * math.log(m / zeros)` instead, where `zeros` counts the registers that are 0. This small-range correction makes an empty sketch estimate `0.0`. Otherwise return `E`.

```python starter
import hashlib
import math


def h64(key):
    return int.from_bytes(hashlib.blake2b(key.encode(), digest_size=8).digest(), 'big')


def hll_new(b):
    ...


def hll_add(regs, h, b):
    ...


def hll_estimate(regs):
    ...
```

```python test
def test_new():
    """2 ** b zero registers, with b from 4 to 16"""
    assert hll_new(4) == [0] * 16
    assert len(hll_new(10)) == 1024
    for b in (3, 17):
        try:
            hll_new(b)
        except ValueError:
            pass
        else:
            raise AssertionError(f'b of {b} should have raised ValueError')


def test_add():
    """the top bits pick the register and the leading zeros set the rank"""
    regs = hll_new(4)
    hll_add(regs, 1 << 63, 4)
    assert regs[8] == 61
    hll_add(regs, (3 << 60) | (1 << 57), 4)
    assert regs[3] == 3
    hll_add(regs, (3 << 60) | (1 << 59), 4)
    assert regs[3] == 3
    hll_add(regs, (1 << 64) - 1, 4)
    hll_add(regs, 5, 4)
    assert regs == [58, 0, 0, 3, 0, 0, 0, 0, 61, 0, 0, 0, 0, 0, 0, 1]


def test_estimate():
    """alpha by size, and the small-range correction"""
    assert round(hll_estimate(hll_new(6)), 9) == 0.0
    assert round(hll_estimate([0] * 15 + [61]), 9) == 1.032616338
    assert round(hll_estimate([5] * 16), 9) == 344.576
    assert round(hll_estimate([4] * 32), 9) == 356.864
    assert round(hll_estimate([4] * 64), 9) == 726.016
    assert round(hll_estimate([3] * 1024), 9) == 5902.669892174


def test_distinct_keys():
    """20,000 distinct keys estimate within 13%, and repeats change nothing"""
    regs = hll_new(10)
    for i in range(20000):
        hll_add(regs, h64(f'item{i}'), 10)
    before = list(regs)
    for i in range(0, 20000, 7):
        hll_add(regs, h64(f'item{i}'), 10)
    assert regs == before
    assert abs(hll_estimate(regs) / 20000 - 1) < 0.13
```

### 4. Merge two sketches

Write `cm_merge(a, b)`, which returns a new Count-Min table where every counter is the sum of the two counters in the same place, and `hll_merge(a, b)`, which returns a new register list where every register is the larger of the two. Leave both inputs unchanged. Raise `ValueError` when the shapes differ: a different number of rows or a different row width for Count-Min, a different number of registers for HyperLogLog. A merged sketch is exactly the sketch you would have built from both streams together, which is why each machine can sketch its own share and send only the sketch.

```python starter
def cm_merge(a, b):
    ...


def hll_merge(a, b):
    ...
```

```python test
import copy


def test_cm_merge():
    """merging two Count-Min tables equals sketching both streams"""
    # cm_new(6, 2) after x y x z x, and after y w x y
    a = [[0, 0, 0, 4, 0, 1], [3, 0, 1, 0, 1, 0]]
    b = [[0, 0, 1, 3, 0, 0], [1, 0, 2, 0, 0, 1]]
    a0, b0 = copy.deepcopy(a), copy.deepcopy(b)
    assert cm_merge(a, b) == [[0, 0, 1, 7, 0, 1], [4, 0, 3, 0, 1, 1]]
    assert a == a0
    assert b == b0


def test_hll_merge():
    """merging two HyperLogLogs equals sketching the union"""
    # hll_new(4) after a0 to a29, and after a20 to a49
    a = [6, 1, 2, 1, 1, 3, 7, 0, 0, 1, 2, 1, 3, 2, 1, 2]
    b = [4, 3, 1, 2, 3, 0, 2, 0, 0, 3, 0, 0, 3, 0, 3, 2]
    a0, b0 = list(a), list(b)
    union = [6, 3, 2, 2, 3, 3, 7, 0, 0, 3, 2, 1, 3, 2, 3, 2]
    assert hll_merge(a, b) == union
    assert hll_merge(b, a) == union
    assert a == a0
    assert b == b0


def test_mismatched():
    """different shapes raise ValueError"""
    cases = [
        (cm_merge, [[0, 0, 0]], [[0, 0, 0], [0, 0, 0]]),
        (cm_merge, [[0, 0, 0], [0, 0, 0]], [[0, 0], [0, 0]]),
        (hll_merge, [0] * 16, [0] * 32),
    ]
    for merge, a, b in cases:
        try:
            merge(a, b)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{merge.__name__} of mismatched shapes should have raised ValueError')
```
