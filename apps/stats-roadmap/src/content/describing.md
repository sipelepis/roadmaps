# Describing data

Summarise a column with a center, a spread, percentiles and a histogram, and compute them in one pass over a stream.

## Center: mean and median

A column of numbers is too long to read, so you summarise it. The first summary is a center: one number that stands for the whole column.

```python
data = [2, 4, 4, 4, 5, 5, 7, 9]
mean = sum(data) / len(data)
print(mean)
```

This prints `5.0`. The mean is the sum divided by the count. Every value pulls on it, so one wild value drags it.

The median is the middle value of the sorted data. With an even count there are two middle values, and the median is their mean. Sort a copy so the caller's list stays as it was:

```python
s = sorted(data)
n = len(s)
print((s[n // 2 - 1] + s[n // 2]) / 2)
```

That prints `4.5`. Now add one wild value. For `[1, 2, 3, 100]` the median is `2.5` and the mean is `26.5`. For `[1, 2, 3, 10000]` the median is still `2.5`. The median ignores how far out a value sits, only that it is out. That makes it the safer center for things like request latency, where a few slow calls would wreck a mean.

Both are undefined on an empty list. Raise `ValueError` instead of returning `0`, because a `0` would look like a real answer.

## Spread: variance and standard deviation

Two columns can share a center and still differ. Spread says how far values sit from it. Take each value's distance from the mean, square it so that distances above and below do not cancel, and average the squares. For `data` the squared distances add up to `32.0`.

```python
m = sum(data) / len(data)
print(sum((x - m) ** 2 for x in data))
```

Dividing by `n` gives `4.0`. Dividing by `n - 1` gives `4.571428571428571`. The second is the sample variance, and it is the one to use when the column is a sample of something bigger. A sample sits closer to its own mean than to the true mean, so dividing by `n` runs low. Dividing by `n - 1` corrects that. The module Likelihood & estimation, later on, shows why with a simulation under Bias of the variance. For now, take `n - 1` as the rule.

The standard deviation is the square root of the variance, `2.138089935299395` here. It is back in the units of your data, so a column of milliseconds has a standard deviation in milliseconds.

You need at least two values. With one value `n - 1` is zero, and there is no spread to estimate. Raise `ValueError`.

## Percentiles and quartiles

The pth percentile is the value that p percent of the data sits at or below. Quartiles are the 25th, 50th and 75th percentiles, called Q1, Q2 (the median) and Q3. The interquartile range is `IQR = Q3 - Q1`, a spread that one wild value cannot move.

Sort the data. For a fraction `q` between 0 and 1, find the position `h = (n - 1) * q`, counting from 0. If `h` lands between two items, step part of the way from the lower to the upper one:

```python
s = sorted(data)
q = 0.25
h = (len(s) - 1) * q
i = int(h)
print(h, s[i] + (h - i) * (s[i + 1] - s[i]))
```

`h` is `1.75` and the answer is `4.0`. This is inclusive linear interpolation: `q = 0` gives the minimum and `q = 1` gives the maximum. When `i` is already the last index there is no next item, so return `s[i]`.

Statistics packages disagree on the details. `statistics.quantiles(data, n=4, method='inclusive')` uses the rule above and gives `[4.0, 4.5, 5.5]`. The default `method='exclusive'` gives `[4.0, 4.5, 6.5]`, because it treats the data as a sample from a wider range and reaches further out. When you compare two tools, check which rule each one uses.

## Histograms

A histogram counts how many values fall in each of several equal-width bins over `[lo, hi]`. The bin of `x` is the number of bin widths it sits above `lo`:

```python
index = int((x - lo) * bins / (hi - lo))
```

Multiply before you divide, so that exact inputs stay exact. A value equal to `hi` would get index `bins`, one past the end, so it goes in the last bin. Values outside `[lo, hi]` are not counted.

For the integers 0 to 10 in 5 bins over `[0, 10]` the counts are `[2, 2, 2, 2, 3]`, and the last bin holds 8, 9 and 10. Print one bar per bin to see the shape:

```
[0, 2)   ##
[2, 4)   ##
[4, 6)   ##
[6, 8)   ##
[8, 10]  ###
```

The bins matter. Too few hide a second peak, and too many turn the shape into noise.

## One pass over a stream

Sometimes the data is too big to hold, or arrives one value at a time. You still want a mean and a variance. Keep three numbers: the count, the mean so far and `m2`, the running sum of squared distances. Welford's update changes them for each new `x`:

```python
n += 1
d = x - mean
mean += d / n
m2 += d * (x - mean)
```

After the last value, the sample variance is `m2 / (n - 1)`. The obvious one-pass method keeps `sum(x)` and `sum(x * x)` and subtracts at the end. It breaks when the values are big but close together. For `[1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16]` the true variance is `30.0`. The sum of squares is so large that its low digits are lost, and the subtraction at the end returns `0.0`. Welford subtracts small distances instead, and returns `30.0`. This is catastrophic cancellation: subtracting two large, nearly equal numbers leaves only rounding noise.

## The statistics module

The standard library already has all of this. Use it once you know what it does:

```python
import statistics

print(statistics.fmean(data), statistics.median(data))
print(statistics.variance(data), statistics.stdev(data))
print(statistics.quantiles(data, n=4, method='inclusive'))
```

`fmean` is a fast float mean. `variance` and `stdev` are the sample versions, which divide by `n - 1`. `pvariance` and `pstdev` divide by `n` and are for when you hold the whole population. In numpy the same calls are `np.mean`, `np.median`, `np.var(x, ddof=1)` and `np.percentile`. Watch `ddof`: numpy divides by `n` unless you pass `ddof=1`.

```python playground
import statistics

data = [2, 4, 4, 4, 5, 5, 7, 9]
n = len(data)
mean = sum(data) / n
s = sorted(data)
median = (s[n // 2 - 1] + s[n // 2]) / 2
var = sum((x - mean) ** 2 for x in data) / (n - 1)
print("mine:    ", mean, median, var)
print("stdlib:  ", statistics.fmean(data), statistics.median(data), statistics.variance(data))
print("quartiles:", statistics.quantiles(data, n=4, method="inclusive"))

# A histogram with one bar per bin.
lo, hi, bins = 0, 10, 5
counts = [0] * bins
for x in range(11):
    counts[min(int((x - lo) * bins / (hi - lo)), bins - 1)] += 1
for i, c in enumerate(counts):
    print(f"[{i * 2}, {i * 2 + 2})", "#" * c)

# One pass, with big values close together.
big = [1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16]
cnt, mu, m2 = 0, 0.0, 0.0
for x in big:
    cnt += 1
    d = x - mu
    mu += d / cnt
    m2 += d * (x - mu)
naive = (sum(x * x for x in big) - sum(big) ** 2 / 4) / 3
print("welford:", m2 / (cnt - 1), "naive:", naive)

# Try: add 10000 to data and compare how far the mean and the median move.
```

## Exercises

### 1. Mean, median and sample variance

Write three functions. `mean(xs) -> float` returns the sum divided by the count. `median(xs) -> float` returns the middle value of a sorted copy, or the mean of the two middle values when the count is even. `sample_variance(xs) -> float` returns the sum of squared distances from the mean divided by `n - 1`. None of them may change `xs`. `mean` and `median` raise `ValueError` on an empty list. `sample_variance` raises `ValueError` for fewer than 2 values.

```python starter
def mean(xs):
    ...


def median(xs):
    ...


def sample_variance(xs):
    ...
```

```python test
def test_mean():
    """mean is the sum over the count"""
    assert mean([1, 2, 3, 4]) == 2.5
    assert mean([10]) == 10.0
    assert mean([-1, 1]) == 0.0


def test_median():
    """middle of a sorted copy, and the input is left alone"""
    xs = [3, 1, 2]
    assert median(xs) == 2
    assert xs == [3, 1, 2]
    assert median([4, 1, 3, 2]) == 2.5
    assert median([1, 2, 3, 100]) == 2.5


def test_variance():
    """sample variance divides by n - 1"""
    assert round(sample_variance([2, 4, 4, 4, 5, 5, 7, 9]), 9) == 4.571428571
    assert round(sample_variance([10, 20, 30]), 9) == 100.0
    assert round(sample_variance([5, 5, 5]), 9) == 0.0


def test_value_errors():
    """empty input and a single value raise ValueError"""
    for f, arg in ((mean, []), (median, []), (sample_variance, [1.0]), (sample_variance, [])):
        try:
            f(arg)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{f.__name__}({arg}) should have raised ValueError')
```

#### Uses
- [Describing data › Center: mean and median](#/describing/center-mean-and-median)
- [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)

#### Hints
- The mean is `sum(xs) / len(xs)`. Check for an empty list first, so you raise `ValueError` rather than hit a `ZeroDivisionError`.
- For the median, `sorted(xs)` makes a copy. The middle index is `len(s) // 2`. With an even count, average that item and the one before it.
- Compute the mean first. Then add up `(x - m) ** 2` for every item and divide by `n - 1`, not `n`.
- Look at the variance test: it is the divisor that separates `4.571428571` from `4.0`.

#### Tips
- `statistics.fmean`, `statistics.median` and `statistics.variance` compute these. Writing them once shows you what each does.
- `xs.sort()` sorts in place and changes the caller's list. `sorted(xs)` does not.

#### Docs
- [Python docs: `statistics`](https://docs.python.org/3/library/statistics.html)

### 2. Percentile, inclusive method

Write `percentile(xs, q) -> float` for `q` between 0 and 1. Sort a copy. Let `h = (len(s) - 1) * q` and `i = floor(h)`. Return `s[i] + (h - i) * (s[i + 1] - s[i])`, or `s[i]` when `i` is the last index. This matches the cut points of `statistics.quantiles` with `method='inclusive'`. An empty list raises `ValueError`. A `q` below 0 or above 1 raises `ValueError`. One value returns that value for any `q`. Do not change `xs`.

```python starter
import math


def percentile(xs, q):
    ...
```

```python test
def test_cut_points():
    """known percentiles of an unsorted list"""
    xs = [7, 1, 9, 3, 5, 2, 8]
    assert round(percentile(xs, 0), 9) == 1.0
    assert round(percentile(xs, 0.25), 9) == 2.5
    assert round(percentile(xs, 0.5), 9) == 5.0
    assert round(percentile(xs, 0.9), 9) == 8.4
    assert round(percentile(xs, 1), 9) == 9.0


def test_even_count_and_single():
    """interpolation across an even count, and one value"""
    assert round(percentile([40, 10, 30, 20], 0.25), 9) == 17.5
    assert round(percentile([40, 10, 30, 20], 0.9), 9) == 37.0
    assert percentile([4], 0.3) == 4.0


def test_input_not_changed():
    """the caller's list keeps its order"""
    xs = [3, 1, 2]
    percentile(xs, 0.5)
    assert xs == [3, 1, 2]


def test_bad_input():
    """an empty list and q outside 0 to 1 raise ValueError"""
    for xs, q in (([], 0.5), ([1, 2, 3], 1.5), ([1, 2, 3], -0.1)):
        try:
            percentile(xs, q)
        except ValueError:
            pass
        else:
            raise AssertionError(f'percentile({xs}, {q}) should have raised ValueError')
```

#### Uses
- [Describing data › Percentiles and quartiles](#/describing/percentiles-and-quartiles)
- [Describing data › Center: mean and median](#/describing/center-mean-and-median)

#### Hints
- Validate first: an empty list, then `q`. Then sort a copy.
- `h = (len(s) - 1) * q` is a position counted from 0. `math.floor(h)` is the item at or below it.
- The fractional part `h - i` says how far to move from `s[i]` toward `s[i + 1]`.
- When `q` is 1, `i` is the last index and `s[i + 1]` does not exist. Return `s[i]` in that case.

#### Tips
- The median is the 0.5 percentile, so this function covers exercise 1's `median` as well.
- A single value has `len(s) - 1 == 0`, so `h` is 0 and `i` is the last index. No special case is needed.

#### Docs
- [Python docs: `statistics.quantiles`](https://docs.python.org/3/library/statistics.html#statistics.quantiles)

### 3. Histogram bins

Write `histogram(xs, lo, hi, bins) -> list[int]`. There are `bins` equal-width bins over `[lo, hi]`. The bin of `x` is `int((x - lo) * bins / (hi - lo))`, and `x == hi` goes in the last bin. Values below `lo` or above `hi` are ignored. `bins < 1` or `hi <= lo` raises `ValueError`. An empty `xs` gives `[0] * bins`.

```python starter
def histogram(xs, lo, hi, bins):
    ...
```

```python test
def test_integers():
    """eleven integers in five bins"""
    assert histogram(list(range(11)), 0, 10, 5) == [2, 2, 2, 2, 3]


def test_edges_and_outside():
    """hi lands in the last bin and outside values are ignored"""
    xs = [0.0, 0.24, 0.25, 0.5, 0.74, 0.75, 1.0, 1.5, -0.5]
    got = histogram(xs, 0, 1, 4)
    assert got == [2, 1, 2, 2]
    assert sum(got) == 7


def test_empty():
    """no data gives all zeros"""
    assert histogram([], 0, 1, 3) == [0, 0, 0]


def test_bad_arguments():
    """no bins or an empty range raise ValueError"""
    for args in (([1], 0, 10, 0), ([1], 5, 5, 3), ([1], 5, 2, 3)):
        try:
            histogram(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'histogram{args} should have raised ValueError')
```

#### Uses
- [Describing data › Histograms](#/describing/histograms)

#### Hints
- Check `bins` and the range before looping.
- Start with `[0] * bins`. Skip any `x` that is below `lo` or above `hi`.
- Compute the index as `int((x - lo) * bins / (hi - lo))`. Multiply first.
- For `x == hi` the index equals `bins`, one too far. Cap it with `min(index, bins - 1)`.

#### Tips
- Print `'#' * count` for each bin to see the shape, as in the article.
- `statistics` has no histogram function. In numpy it is `np.histogram`, and it makes the same last-bin choice.

#### Docs
- [Python docs: `int`](https://docs.python.org/3/library/functions.html#int)

### 4. One pass: Welford

Write `welford(xs) -> tuple` that returns `(n, mean, sample_variance)` after a single pass over any iterable, such as a generator. Use Welford's update, and divide `m2` by `n - 1` at the end. An empty input returns `(0, None, None)`. One value `x` returns `(1, x, None)`. Do not turn the input into a list: it may only be readable once.

```python starter
def welford(xs):
    ...
```

```python test
def test_small_list():
    """count, mean and variance of a small list"""
    n, mean, var = welford([2, 4, 4, 4, 5, 5, 7, 9])
    assert n == 8
    assert round(mean, 9) == 5.0
    assert round(var, 9) == 4.571428571


def test_generator():
    """a generator can only be read once"""
    n, mean, var = welford(x * 2 for x in range(1, 5))
    assert n == 4
    assert round(mean, 9) == 5.0
    assert round(var, 9) == 6.666666667


def test_large_close_values():
    """no cancellation when values are big and close together"""
    n, mean, var = welford([1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16])
    assert n == 4
    assert round(var, 6) == 30.0


def test_short_input():
    """empty and single-value input"""
    assert welford([]) == (0, None, None)
    assert welford(iter([3.5])) == (1, 3.5, None)
```

#### Uses
- [Describing data › One pass over a stream](#/describing/one-pass-over-a-stream)
- [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)

#### Hints
- Keep `n`, `mean` and `m2`, all starting at 0, and loop over `xs` once.
- For each `x`: `n += 1`, then `d = x - mean`, then `mean += d / n`, then `m2 += d * (x - mean)`. The last line uses the new mean.
- After the loop, handle `n == 0` and `n == 1` before you divide by `n - 1`.
- The method keeps only small distances from the running mean, which is why it avoids the cancellation that sums of squares suffer.

#### Tips
- Welford can also be run in parallel on chunks and merged. That is how big systems compute these numbers.
- `statistics.variance` gets the same `30.0` on this input. It uses exact fractions internally.

#### Docs
- [Python docs: `statistics.variance`](https://docs.python.org/3/library/statistics.html#statistics.variance)
- [Welford, "Note on a method for calculating corrected sums of squares and products" (1962)](https://doi.org/10.1080/00401706.1962.10490022)
