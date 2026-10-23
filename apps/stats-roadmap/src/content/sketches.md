# Counting at scale

Count frequencies and distinct items in fixed memory with Count-Min and HyperLogLog, and merge sketches across machines.

## Exact counting does not scale

To count how often each key appears, keep a dict of counts. To count distinct keys, keep a set. Both are exact, and both grow with the number of distinct keys, not with the number of events:

```python
import random

rng = random.Random(6)
stream = [f'user{int(rng.random() ** 3 * 10000)}' for _ in range(20000)]
counts = {}
for key in stream:
    counts[key] = counts.get(key, 0) + 1
print(len(stream), len(counts), max(counts.values()))
```

This prints `20000 6925 959`: 20,000 events, 6,925 distinct keys, and the busiest key seen 959 times. The dict holds 6,925 entries. With a billion distinct keys it holds a billion. A sketch is a small table of fixed size that you update as events arrive. You give up exactness. In return the memory does not depend on the number of distinct keys, and the size of the error is a number you choose in advance.

## Hashing you can reproduce

Both sketches turn a key into a number with a hash function. Python's built-in hash function is salted for every process, controlled by the `PYTHONHASHSEED` setting, so the same string hashes to a different number each time you start Python. A sketch built on it cannot be saved, shared or merged. Use a hash that gives the same answer everywhere.

```python
import hashlib
import zlib

print(zlib.crc32(b'apple'))
h = int.from_bytes(hashlib.blake2b(b'apple', digest_size=8).digest(), 'big')
print(h, h.bit_length())
```

`zlib.crc32` is fast and returns a 32-bit number, `2838417488` for `b'apple'`. `hashlib.blake2b` with `digest_size=8` returns 8 bytes, and `int.from_bytes(..., 'big')` turns them into a 64-bit integer, here `10812779455369817823`. Use `crc32` to pick a column, with `% width`, and the 64-bit one when you need the individual bits.

To get several independent hashes of one key, put a row number in front of it: `zlib.crc32(f'{row}:{key}'.encode())`. That is what the exercise code does.

## Count-Min sketch

A Count-Min sketch is a table of `d` rows and `w` columns of counters, all starting at 0. Each row has its own hash. To add a key, bump one counter in every row. To estimate a key's count, read its counter in every row and take the minimum:

```python
import zlib

def bucket(key, row, width):
    return zlib.crc32(f'{row}:{key}'.encode()) % width

def cm_add(sketch, key, count=1):
    for r, row in enumerate(sketch):
        row[bucket(key, r, len(row))] += count

def cm_estimate(sketch, key):
    return min(row[bucket(key, r, len(row))] for r, row in enumerate(sketch))
```

Other keys can land in the same counter, and then they add to it. So each counter is the key's true count plus some extras, and the minimum over rows is never below the true count. It never underestimates. It can overestimate, and taking the minimum keeps the overestimate small, because it takes only one row to be lucky.

Cormode and Muthukrishnan ([2005](https://www.cs.ox.ac.uk/people/graham.cormode/pubs/html/CormodeMuthukrishnan04CMJalg.html)) showed how to size it. For a stream with `N` events in total, width `w = ceil(e / eps)` and depth `d = ceil(ln(1 / delta))` give an estimate that is at most `eps * N` too high, with probability at least `1 - delta`. For `eps = 0.01` and `delta = 0.01` that is `w = 272` and `d = 5`, which is 1,360 counters.

Run it on the stream above. The three busiest keys have true counts `959`, `248` and `156`, and estimates `997`, `288` and `195`. Over all 6,925 keys the overestimates run from `17` to `91`, always positive and always below the bound `eps * N = 200`.

## HyperLogLog

Counting distinct keys needs a different trick. Hash each key to 64 bits. A hash that starts with 10 zero bits is rare: about one in 1,024. So if the longest run of leading zeros you have seen is long, you have probably seen a lot of distinct keys. One register gives a noisy answer. HyperLogLog uses `m = 2 ** b` registers and averages them.

The top `b` bits of the hash pick a register. In the other `64 - b` bits, find the position of the first 1 bit counted from the left, which is the rank. The register keeps the largest rank it has seen. A hash of `1 << 63` with `b = 4` goes to register 8, the other 60 bits are all zero, and the rank is `61`. A repeated key has the same hash, the same register and the same rank, so repeats change nothing.

To estimate, combine the registers. With `M` the register values:

```
estimate = alpha_m * m^2 / sum(2^-M)
```

The constant `alpha_m` corrects a bias. The exercise gives it for each size. When the estimate is small, no more than `2.5 * m`, and some registers are still 0, the formula does badly, so use linear counting instead: `m * ln(m / zeros)`, where `zeros` is the number of empty registers. Flajolet and colleagues ([2007](https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf)) give the full method. The typical relative error is about `1.04 / sqrt(m)`.

Count 20,000 distinct keys with three sizes of sketch. With `b = 6`, 64 registers, the estimate is `19310`, off by `-3.45%`, against a typical error of `13%`. With `b = 10`, 1,024 registers, it is `20102`, off by `0.51%`, against `3.25%`. With `b = 14`, 16,384 registers, it is `20094`, off by `0.47%`, against `0.81%`. Each register is a small integer, so 16,384 of them take far less room than 20,000 keys do. These are single runs, so a result can land on either side of its typical error. The error falls as the registers grow.

## Merging sketches

Sketches merge, so each machine can sketch its own share of the data and send only the sketch. Two Count-Min sketches with the same shape and the same hashes merge by adding cells. Each counter is the sum of the events that landed there on either machine, which is what one sketch fed both streams would hold. Two HyperLogLog sketches with the same number of registers merge by taking the larger value in each register. A register keeps the largest rank among all the keys it saw, so the larger of two maxima is the maximum over the union.

Split the stream from the first section into two halves, sketch each, and merge. The merged Count-Min table equals the table built from the whole stream, and so do the merged HyperLogLog registers. Overlap is not double-counted by HyperLogLog. With `b = 10`, keys `a0` to `a29` estimate `29.42`, keys `a20` to `a49` estimate `27.36`, and the merged 1,024 registers estimate `48.11`, against a true union of 50.

```python playground
import hashlib
import math
import random
import zlib


def bucket(key, row, width):
    return zlib.crc32(f'{row}:{key}'.encode()) % width


def cm_new(width, depth):
    return [[0] * width for _ in range(depth)]


def cm_add(sketch, key, count=1):
    for r, row in enumerate(sketch):
        row[bucket(key, r, len(row))] += count


def cm_estimate(sketch, key):
    return min(row[bucket(key, r, len(row))] for r, row in enumerate(sketch))


def cm_merge(a, b):
    return [[x + y for x, y in zip(ra, rb)] for ra, rb in zip(a, b)]


def h64(key):
    return int.from_bytes(hashlib.blake2b(key.encode(), digest_size=8).digest(), 'big')


def hll_add(regs, h, b):
    index = h >> (64 - b)
    rest = h & ((1 << (64 - b)) - 1)
    regs[index] = max(regs[index], (64 - b) - rest.bit_length() + 1)


def hll_estimate(regs):
    m = len(regs)
    alpha = {16: 0.673, 32: 0.697, 64: 0.709}.get(m) or 0.7213 / (1 + 1.079 / m)
    e = alpha * m * m / sum(2.0 ** -r for r in regs)
    zeros = regs.count(0)
    return m * math.log(m / zeros) if e <= 2.5 * m and zeros else e


rng = random.Random(6)
stream = [f'user{int(rng.random() ** 3 * 10000)}' for _ in range(20000)]
counts = {}
for key in stream:
    counts[key] = counts.get(key, 0) + 1
print(len(stream), len(counts), max(counts.values()))

# Count-Min: width ceil(e / 0.01) = 272, depth ceil(ln(1 / 0.01)) = 5.
whole = cm_new(272, 5)
for key in stream:
    cm_add(whole, key)
over = [cm_estimate(whole, k) - c for k, c in counts.items()]
print(min(over), max(over), 'bound', 0.01 * len(stream))
for key in sorted(counts, key=counts.get, reverse=True)[:3]:
    print(key, counts[key], cm_estimate(whole, key))

# HyperLogLog on 20,000 distinct keys.
for b in (6, 10, 14):
    regs = [0] * (1 << b)
    for i in range(20000):
        hll_add(regs, h64(f'item{i}'), b)
    est = hll_estimate(regs)
    print(b, round(est), round(est / 20000 - 1, 4), round(1.04 / math.sqrt(1 << b), 4))

# Merging: sketch each half, add the cells, compare with the whole.
left, right = cm_new(272, 5), cm_new(272, 5)
for key in stream[:10000]:
    cm_add(left, key)
for key in stream[10000:]:
    cm_add(right, key)
print(cm_merge(left, right) == whole)

# Try: shrink the width to 64 and watch the overestimates grow.
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

#### Uses
- [Counting at scale › Count-Min sketch](#/sketches/count-min-sketch)
- [Counting at scale › Hashing you can reproduce](#/sketches/hashing-you-can-reproduce)

#### Hints
- `cm_new` builds `depth` rows. Write `[[0] * width for _ in range(depth)]` so each row is its own list, and check `width` and `depth` first.
- In `cm_add`, the width is `len(sketch[0])`. Loop over the rows with their numbers using `enumerate`.
- For row `r`, the column is `bucket(key, r, width)`. Add `count` to that counter.
- `cm_estimate` reads the same counter in every row and returns the smallest with `min`.

#### Tips
- Do not build the table as `[[0] * width] * depth`. That repeats one list `depth` times, and a bump to one row shows up in all of them.
- A counter can only be too high, never too low, so the minimum is the safest read.

#### Docs
- [Python docs: `zlib.crc32`](https://docs.python.org/3/library/zlib.html#zlib.crc32)
- [Cormode and Muthukrishnan: An Improved Data Stream Summary, the Count-Min Sketch](https://www.cs.ox.ac.uk/people/graham.cormode/pubs/html/CormodeMuthukrishnan04CMJalg.html)

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

#### Uses
- [Counting at scale › Count-Min sketch](#/sketches/count-min-sketch)

#### Hints
- Check the inputs first: `eps` must be above 0, and `delta` strictly between 0 and 1.
- The width is `e` divided by `eps`, rounded up. `math.e` is the constant.
- The depth is the natural log of `1 / delta`, rounded up. `math.log` is the natural log.
- Return the two numbers as a tuple, width first.

#### Tips
- A smaller `eps` makes the table wider, and a smaller `delta` makes it deeper. The depth grows slowly, since it is a log.
- Both sizes are whole counters, so always round up.

#### Docs
- [Python docs: `math.ceil`](https://docs.python.org/3/library/math.html#math.ceil)
- [Python docs: `math.e`](https://docs.python.org/3/library/math.html#math.e)

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
    assert len(hll_new(16)) == 65536
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

#### Uses
- [Counting at scale › HyperLogLog](#/sketches/hyperloglog)
- [Counting at scale › Hashing you can reproduce](#/sketches/hashing-you-can-reproduce)

#### Hints
- `hll_new` checks that `b` is from 4 to 16, then returns `2 ** b` zeros.
- In `hll_add`, get `index` with a right shift of `64 - b`, and get `rest` by masking off the low `64 - b` bits.
- The rank counts leading zeros of `rest` within `64 - b` bits, plus one. `int.bit_length` gives you the zeros: `(64 - b) - rest.bit_length() + 1`.
- Keep the larger of the old register value and the new rank.
- For the estimate, pick `alpha` by `m`, compute the raw `E`, count the zero registers, and switch to linear counting when `E <= 2.5 * m` and there is at least one zero.

#### Tips
- When `rest` is 0, `bit_length` is 0 and the rank comes out as `65 - b`, the biggest possible.
- Linear counting is also what makes an empty sketch return `0.0`: `m * log(m / m)`.

#### Docs
- [Python docs: `int.bit_length`](https://docs.python.org/3/library/stdtypes.html#int.bit_length)
- [Flajolet et al.: HyperLogLog, the analysis of a near-optimal cardinality estimation algorithm](https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf)

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

#### Uses
- [Counting at scale › Merging sketches](#/sketches/merging-sketches)
- [Counting at scale › Exact counting does not scale](#/sketches/exact-counting-does-not-scale)

#### Hints
- Compare shapes first and raise `ValueError` if they differ. For Count-Min compare the number of rows and then each row's width. For HyperLogLog compare the lengths.
- Build the result from new lists. Do not write into `a` or `b`.
- For Count-Min, add the counters in the same position: a nested comprehension over `zip(a, b)` and then over each pair of rows.
- For HyperLogLog, take `max` of each pair of registers.

#### Tips
- Merging is only valid when both sketches used the same hashes. The shape check catches a size mismatch, but not a different hash.
- Merging is the same operation whichever order you use: addition and `max` are both symmetric.

#### Docs
- [Python docs: `zip`](https://docs.python.org/3/library/functions.html#zip)
