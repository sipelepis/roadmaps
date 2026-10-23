# Drift detection

Compare today's data with a reference window using PSI and the KS statistic, for numbers and for categories.

## What drift looks like

A model learns from one period's data and then runs on later data. If the later data look different, its predictions can go wrong without a single error message. Drift detection compares a current window of data with a reference window, such as the training data or last month's, and puts a number on how far apart they are.

Here are four windows of 1,000 values: the reference, a second window from the same distribution, one whose mean moved up by 5, and one whose spread grew by half.

```python
import random
import statistics

rng = random.Random(1)
ref = [rng.gauss(50, 10) for _ in range(1000)]
same = [rng.gauss(50, 10) for _ in range(1000)]
moved = [rng.gauss(55, 10) for _ in range(1000)]
wider = [rng.gauss(50, 15) for _ in range(1000)]
for xs in (ref, same, moved, wider):
    print(round(statistics.fmean(xs), 2), round(statistics.stdev(xs), 2))
```

The means and standard deviations, rounded to two places, are `49.87 10.04`, `50.5 10.03`, `54.87 9.79` and `50.22 14.79`. The window called `same` has no drift at all, and its mean still differs from the reference by more than half a unit. Two samples from one population never match, as [Samples and populations](#/samples/samples-and-populations) showed, so every drift score has a noise floor.

Two kinds of drift matter. Data drift is a change in the inputs: the centre moves, the spread grows, the shape changes, a new category appears, a column fills up with nulls (see [Profile before you trust](#/data-quality/profile-before-you-trust)). Concept drift is a change in the relation between the inputs and the outcome: the inputs look the same, but they now go with different answers. You cannot see concept drift in the inputs alone. It needs labels, and it shows up as a rising error rate. This page is about data drift.

A mean and a standard deviation caught both changes here. They miss changes in shape, though, and one outlier can drag them, as in [z-scores and masking](#/data-quality/z-scores-and-masking). The rest of the page compares whole distributions.

## Bins from the reference

Cut the reference into bins and count how many values from each window land in each bin. Take the edges from the reference deciles, so each bin holds a tenth of it:

```python
import bisect

edges = statistics.quantiles(ref, n=10, method='inclusive')

def counts(xs, edges):
    c = [0] * (len(edges) + 1)
    for x in xs:
        c[bisect.bisect_right(edges, x)] += 1
    return c

print([round(e, 1) for e in edges])
for xs in (ref, same, moved, wider):
    print(counts(xs, edges))
```

The nine edges, rounded to one place, are `[36.9, 41.2, 44.8, 47.6, 49.9, 52.2, 55.6, 58.4, 62.6]`. The reference puts exactly 100 values in each of the 10 bins. The other windows give:

```
same   [85, 97, 110, 103, 77, 81, 125, 99, 112, 111]
moved  [32, 54, 73, 71, 70, 88, 145, 119, 139, 209]
wider  [176, 92, 92, 88, 63, 62, 82, 62, 83, 200]
```

The moved window drains the low bins and piles into the high ones. The wider window piles into both end bins. Even `same` swings from 77 to 125.

`bisect_right(edges, x)` counts the edges at or below `x`, and that count is the bin number. A value equal to an edge goes in the bin on its right. The first and last bins have no outer edge, so a value beyond anything in the reference still lands somewhere. The `inclusive` method interpolates between data points as in [Percentiles and quartiles](#/describing/percentiles-and-quartiles).

Why quantile edges? Ten equal-width bins across the range of the reference give counts of `[13, 26, 68, 144, 206, 212, 175, 107, 37, 12]`. The end bins hold about 1% each, so a handful of values swings their share a lot, and the next section divides by those shares. Quantile bins give every bin the same expected share. Compute the edges once, from the reference, and keep them. Edges recomputed from each new window would move with the drift and hide it.

## Population stability index

The population stability index turns two lists of bin shares into one number. Start with four bins:

```python
import math

e = [0.25, 0.25, 0.25, 0.25]
a = [0.1, 0.2, 0.3, 0.4]
terms = [(y - x) * math.log(y / x) for x, y in zip(e, a)]
print([round(t, 4) for t in terms], sum(terms))
```

`e` holds the expected share of each bin, from the reference, and `a` the actual share, from the current window. The terms are `[0.1374, 0.0112, 0.0091, 0.0705]`, rounded to four places, and the PSI is their sum, `0.22821740957339182`:

```
PSI = sum((a_i - e_i) * ln(a_i / e_i))
```

`a - e` and `ln(a / e)` always have the same sign, so no term is negative, and PSI is 0 only when the shares match. The first bin, which fell from 25% to 10%, adds the most.

PSI is [KL divergence](#/information/kl-divergence) counted both ways. Multiply out each term and the sum splits into `sum(a * ln(a / e)) + sum(e * ln(e / a))`, which is `KL(a || e) + KL(e || a)`. Here those are `0.1064401352862232` and `0.12177727428716867`, which add up to the same PSI, up to float rounding. KL on its own is not symmetric. PSI is, so it does not matter which window you call expected.

Now the windows. Turn counts into shares, and give a share of 0 a small epsilon, because `ln(0)` is undefined:

```python
def psi(ec, ac, eps=1e-4):
    te, ta = sum(ec), sum(ac)
    pairs = [(x / te or eps, y / ta or eps) for x, y in zip(ec, ac)]
    return sum((a - e) * math.log(a / e) for e, a in pairs)

rc = counts(ref, edges)
for xs in (same, moved, wider):
    print(round(psi(rc, counts(xs, edges)), 4))
```

PSI is `0.0217` for `same`, `0.2497` for `moved` and `0.1753` for `wider`, rounded to four places. Do not renormalise after the swap. With an empty bin, the epsilon decides the answer: reference counts `[30, 30, 40]` against current counts `[45, 55, 0]` give `3.5291441681856046` with an epsilon of `1e-4` and `1.6510167042132389` with `0.01`. Report the epsilon with the PSI, or use bins wide enough never to empty.

The usual reading is: below 0.1 stable, 0.1 to 0.25 a moderate shift, above 0.25 a major one. These cutoffs are a convention from credit scoring, and they come with no stated error rate. Yurdakul and Naranjo, in [Statistical properties of the population stability index](http://www.stat.wmich.edu/naranjo/PSI.pdf), show that with no shift at all, PSI behaves like `(1 / N + 1 / M)` times a chi-square with `B - 1` degrees of freedom, for windows of `N` and `M` values and `B` bins. So the cutoff you need depends on the window sizes. Check it: draw 200 windows from the reference distribution itself and score each one.

```python
rng = random.Random(2)
for size in (100, 1000):
    scores = [psi(rc, counts([rng.gauss(50, 10) for _ in range(size)], edges)) for _ in range(200)]
    print(size, statistics.fmean(scores), sum(s >= 0.1 for s in scores) / 200)
```

Windows of 100 average `0.10288985481097943`, and `0.45` of them score 0.1 or more: the convention calls almost half of them drifted although nothing changed. Windows of 1,000 average `0.017189601393527845`, and none reach 0.1. A chi-square with 9 degrees of freedom averages 9, so the approximation predicts `(1 / 1000 + 1 / 100) * 9`, about 0.099, and `(1 / 1000 + 1 / 1000) * 9`, which is 0.018. Notice also that `moved`, a shift of half a standard deviation, scored just under the 0.25 line.

## The KS statistic

PSI depends on the bins. The two-sample Kolmogorov-Smirnov statistic needs none. It compares empirical distribution functions: `F(x)` is the share of a sample at or below `x`.

```python
a = sorted([1, 4, 6, 9])
b = sorted([3, 5, 7, 8, 10, 12])
for x in sorted(set(a + b)):
    fa = bisect.bisect_right(a, x) / len(a)
    fb = bisect.bisect_right(b, x) / len(b)
    print(x, fa, round(fb, 3), round(abs(fa - fb), 3))
```

Each `F` is a staircase that steps up at its own sample's values. The largest gap is at 6, where `F_a` is `0.75` and `F_b` is `0.333`, a gap of `0.417`, all rounded to three places. That gap is the KS statistic:

```
D = max over x of |F_a(x) - F_b(x)|
```

Both staircases are flat between observed values, so the gap can only change at one of them, and checking every value in either sample is enough. `D` runs from 0, for identical samples, to 1, for samples that do not overlap.

Against the reference, `D` is 0.049 for `same`, 0.215 for `moved` and 0.113 for `wider`, rounded to three places. A wider spread pushes values into the tails, where `F` changes slowly, so `wider` scores about half of `moved`. PSI with quantile bins weighs every bin alike and puts the two closer together.

`D` is also a test statistic. With no drift and large windows of `n` and `m` values, `D` exceeds `1.358 * sqrt((n + m) / (n * m))` in about 5% of samples. The 1.358 is `sqrt(-ln(0.025) / 2)`, rounded. For two windows of 1,000 the cutoff is 0.061, rounded to three places: `same` stays under it and the other two are far above. For two windows of 100,000 it is 0.006, and a shift too small to matter will clear it. This is the warning from [What a p-value is](#/hypothesis-tests/what-a-p-value-is): with big windows, report `D` itself, not only whether it passed. scipy has the test as `scipy.stats.ks_2samp(a, b)`, which returns `D` and a p-value.

## Categorical drift

Labels have no order, so there is no KS statistic and there are no quantiles. Count each label instead and compare the shares with PSI, one bin per category:

```python
import collections

ref_dev = ['desktop'] * 500 + ['mobile'] * 300 + ['tablet'] * 200
cur_dev = ['desktop'] * 450 + ['mobile'] * 300 + ['tablet'] * 200 + ['tv'] * 50
r, c = collections.Counter(ref_dev), collections.Counter(cur_dev)
cats = sorted(set(r) | set(c))
print(cats, r['tv'], c['tv'])
print(psi([r[k] for k in cats], [c[k] for k in cats]))
```

The first line prints `['desktop', 'mobile', 'tablet', 'tv'] 0 50`. The union of both sides covers a category that appears on only one of them, and a `Counter` returns 0 for a label it never saw, with no `KeyError`. Sort the union: a set of strings can come out in a different order on each run, and a fixed order keeps the sum, float rounding and all, the same every time.

Shares are counts over the list's length, and a share of 0 becomes the epsilon, as before. `tv` has an expected share of `0.0001` and an actual share of `0.05`, so its term is `0.3101089441112673`. `desktop` fell from 0.5 to 0.45 and adds `0.0052680257828913125`. `mobile` and `tablet` add 0. The PSI is `0.31537696989415864`, a major shift by the convention, and nearly all of it is the new category.

That is usually what you want to hear about: a value the model never saw in training. But a column with many rare values, such as free text or ids, gets a large term for every new one. Check its distinct count first, as in [Profile before you trust](#/data-quality/profile-before-you-trust), and group rare labels into one `other` bin before you compare.

```python playground
import bisect
import collections
import math
import random
import statistics


def counts(xs, edges):
    c = [0] * (len(edges) + 1)
    for x in xs:
        c[bisect.bisect_right(edges, x)] += 1
    return c


def psi(ec, ac, eps=1e-4):
    te, ta = sum(ec), sum(ac)
    pairs = [(x / te or eps, y / ta or eps) for x, y in zip(ec, ac)]
    return sum((a - e) * math.log(a / e) for e, a in pairs)


def ks(a, b):
    sa, sb = sorted(a), sorted(b)
    return max(abs(bisect.bisect_right(sa, x) / len(sa) - bisect.bisect_right(sb, x) / len(sb)) for x in sa + sb)


rng = random.Random(1)
ref = [rng.gauss(50, 10) for _ in range(1000)]
edges = statistics.quantiles(ref, n=10, method='inclusive')
rc = counts(ref, edges)
for name, mu, sigma in (('same', 50, 10), ('moved', 55, 10), ('wider', 50, 15)):
    cur = [rng.gauss(mu, sigma) for _ in range(1000)]
    print(name, 'PSI', round(psi(rc, counts(cur, edges)), 4), 'KS', round(ks(ref, cur), 3))

ref_dev = ['desktop'] * 500 + ['mobile'] * 300 + ['tablet'] * 200
cur_dev = ['desktop'] * 450 + ['mobile'] * 300 + ['tablet'] * 200 + ['tv'] * 50
r, c = collections.Counter(ref_dev), collections.Counter(cur_dev)
cats = sorted(set(r) | set(c))
print('category PSI', psi([r[k] for k in cats], [c[k] for k in cats]))

# Try: windows of 100 instead of 1000, or a shift of 2 instead of 5.
```

## Exercises

### 1. Bin by reference quantiles

Write `quantile_edges(ref, bins)`, which returns the `bins - 1` inner edges as a list of floats: `statistics.quantiles(ref, n=bins, method='inclusive')`. Raise `ValueError` when `bins < 2` or when `ref` has fewer than 2 values. Write `bin_counts(xs, edges)`, which returns a list of `len(edges) + 1` counts. A value `x` goes in bin `bisect.bisect_right(edges, x)`, so a value equal to an edge goes in the bin on its right. An empty `xs` gives all zeros.

```python starter
import bisect
import statistics

def quantile_edges(ref, bins):
    ...

def bin_counts(xs, edges):
    ...
```

```python test
def test_edges():
    """edges from the reference quantiles"""
    ref = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    assert [round(v, 9) for v in quantile_edges(ref, 4)] == [3.25, 5.5, 7.75]
    assert [round(v, 9) for v in quantile_edges(ref, 2)] == [5.5]
    assert [round(v, 9) for v in quantile_edges([2, 4, 6, 8], 2)] == [5.0]

def test_counts():
    """values land in the bin their edges give"""
    edges = [3.25, 5.5, 7.75]
    assert bin_counts([0, 3, 4, 5, 6, 8, 11, 7.75], edges) == [2, 2, 1, 3]

def test_value_on_an_edge_goes_right():
    """a value equal to an edge goes in the bin on its right"""
    assert bin_counts([5.5], [3.25, 5.5, 7.75]) == [0, 0, 1, 0]
    assert bin_counts([3.25, 7.75], [3.25, 5.5, 7.75]) == [0, 1, 0, 1]

def test_empty_and_bad_input():
    """an empty sample gives zeros and bad bins raise ValueError"""
    assert bin_counts([], [3.25, 5.5, 7.75]) == [0, 0, 0, 0]
    for ref, bins in [([1, 2, 3], 1), ([3], 4), ([], 4)]:
        try:
            quantile_edges(ref, bins)
        except ValueError:
            pass
        else:
            raise AssertionError(f'ref={ref}, bins={bins} should have raised ValueError')
```

#### Uses
- [Drift detection › Bins from the reference](#/drift/bins-from-the-reference)
- [Describing data › Percentiles and quartiles](#/describing/percentiles-and-quartiles)

#### Hints
- Check `bins` and the length of `ref` yourself, then hand the work to `statistics.quantiles`.
- `bin_counts` starts from a list of zeros, one longer than `edges`.
- For each value, `bisect.bisect_right(edges, x)` is the index of its bin. Add one there.

#### Tips
- `statistics.quantiles` accepts `n=1`, and since Python 3.13 it accepts a single data point, so it will not raise for every bad input on its own.
- `bisect_right` counts the edges at or below `x`, which is why a value on an edge goes right.

#### Docs
- [Python docs: `statistics.quantiles`](https://docs.python.org/3/library/statistics.html#statistics.quantiles)
- [Python docs: `bisect.bisect_right`](https://docs.python.org/3/library/bisect.html#bisect.bisect_right)

### 2. PSI with an epsilon

Write `psi(expected_counts, actual_counts, eps=1e-4)`, which returns the population stability index as a float. Turn each list of counts into shares by dividing by its own total. A share of 0 becomes `eps`, and you do not renormalise afterwards. Then `PSI = sum((a - e) * math.log(a / e))` over the bins, where `e` and `a` are the expected and actual shares. Raise `ValueError` when either total is 0 or when the lists have different lengths. An empty bin must not crash it. Write `psi_label(value)`, which returns `'stable'` below 0.1, `'moderate'` below 0.25 and `'major'` otherwise.

```python starter
import math

def psi(expected_counts, actual_counts, eps=1e-4):
    ...

def psi_label(value):
    ...
```

```python test
def test_identical_is_zero():
    """identical counts give a PSI of 0"""
    assert round(psi([5, 5], [5, 5]), 9) == 0.0
    assert round(psi([0, 10, 4], [0, 10, 4]), 9) == 0.0

def test_values():
    """PSI for a few shifts"""
    assert round(psi([50, 30, 20], [30, 40, 30]), 9) == 0.171479843
    assert round(psi([500, 300, 200], [30, 40, 30]), 9) == 0.171479843
    assert round(psi([250, 250, 250, 250], [240, 260, 255, 245]), 9) == 0.001000454
    assert round(psi([70, 20, 10], [10, 20, 70]), 9) == 2.335092179
    assert round(psi([900, 100], [800, 200]), 9) == 0.081093022

def test_empty_bin():
    """an empty bin uses eps instead of crashing"""
    assert round(psi([50, 50, 0], [40, 30, 30]), 9) == 2.525589113
    assert round(psi([40, 30, 30], [50, 50, 0]), 9) == 2.525589113
    assert round(psi([50, 50, 0], [40, 30, 30], eps=0.01), 9) == 1.110826721

def test_labels():
    """stable, moderate and major"""
    assert psi_label(0.001) == 'stable'
    assert psi_label(0.05) == 'stable'
    assert psi_label(0.17) == 'moderate'
    assert psi_label(0.4) == 'major'
    assert psi_label(0.1) == 'moderate'
    assert psi_label(0.25) == 'major'

def test_bad_input():
    """a total of 0 or different lengths raise ValueError"""
    for e, a in [([0, 0], [1, 1]), ([1, 1], [0, 0]), ([1, 2, 3], [1, 2])]:
        try:
            psi(e, a)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{e} and {a} should have raised ValueError')
```

#### Uses
- [Drift detection › Population stability index](#/drift/population-stability-index)
- [Entropy, cross-entropy & KL › KL divergence](#/information/kl-divergence)

#### Hints
- Check the lengths and both totals before you divide.
- Turn each count into a share of its own list's total, and swap a share of 0 for `eps`.
- Add `(a - e) * math.log(a / e)` over the bins. `psi_label` compares the value with 0.1, then with 0.25.

#### Tips
- `share or eps` swaps exactly a share of 0 for `eps`, because `0.0` is falsy.
- Only shares matter, so multiplying every count by the same number leaves PSI unchanged.
- PSI is symmetric: swapping the two lists gives the same value.

#### Docs
- [Python docs: `math.log`](https://docs.python.org/3/library/math.html#math.log)
- [Yurdakul and Naranjo, Statistical properties of the population stability index](http://www.stat.wmich.edu/naranjo/PSI.pdf)

### 3. Two-sample KS statistic

Write `ks_statistic(a, b)`, which returns the largest gap between the two empirical distribution functions as a float. For a sample `s`, `F(x) = bisect.bisect_right(sorted(s), x) / len(s)`, the share of values at or below `x`. `D` is the maximum of `|F_a(x) - F_b(x)|` over every value `x` that appears in `a` or in `b`. Raise `ValueError` when either sample is empty.

```python starter
import bisect

def ks_statistic(a, b):
    ...
```

```python test
def test_identical_and_disjoint():
    """identical samples give 0 and disjoint ones give 1"""
    assert round(ks_statistic([1, 2, 3], [3, 2, 1]), 9) == 0.0
    assert round(ks_statistic([1, 2, 3], [4, 5]), 9) == 1.0
    assert round(ks_statistic([4, 5], [1, 2, 3]), 9) == 1.0

def test_ties_across_samples():
    """values shared by both samples"""
    assert round(ks_statistic([1.5, 2.5, 2.5, 4, 7], [2.5, 3, 3, 6, 8, 9]), 9) == 0.433333333
    assert round(ks_statistic([1, 2, 2, 3, 5, 8], [2, 3, 3, 4, 9, 10, 11, 12]), 9) == 0.5

def test_symmetric():
    """swapping the samples does not change D"""
    a, b = [1.5, 2.5, 2.5, 4, 7], [2.5, 3, 3, 6, 8, 9]
    assert round(ks_statistic(b, a), 9) == 0.433333333

def test_empty():
    """an empty sample raises ValueError"""
    for a, b in [([], [1.0]), ([1.0], [])]:
        try:
            ks_statistic(a, b)
        except ValueError:
            pass
        else:
            raise AssertionError('an empty sample should have raised ValueError')
```

#### Uses
- [Drift detection › The KS statistic](#/drift/the-ks-statistic)
- [Drift detection › Bins from the reference](#/drift/bins-from-the-reference)

#### Hints
- Raise on an empty sample first, then sort each sample once.
- For each value in either sample, `F` for a sample is `bisect_right` over its sorted copy, divided by its length.
- `D` is the largest absolute gap between the two `F` values over all those points.

#### Tips
- Sorting once and bisecting keeps it fast: no need to count by hand at every point.
- `scipy.stats.ks_2samp(a, b)` returns the same `D`, plus a p-value.

#### Docs
- [Python docs: `bisect`](https://docs.python.org/3/library/bisect.html)
- [Python docs: `max`](https://docs.python.org/3/library/functions.html#max)

### 4. Categorical drift

Write `category_psi(ref, cur, eps=1e-4)`, which returns the PSI between two lists of category labels. Count each list with `collections.Counter`. The categories are `sorted(set(ref) | set(cur))`. Each category's share is its count over the list's length, and a category with a count of 0 gets `eps`. Then `PSI = sum((a - e) * math.log(a / e))` as in the last exercise, where `e` is the reference share and `a` the current one. Raise `ValueError` when either list is empty.

```python starter
import collections
import math

def category_psi(ref, cur, eps=1e-4):
    ...
```

```python test
REF = ['a'] * 50 + ['b'] * 30 + ['c'] * 20

def test_values():
    """PSI for shifted category shares"""
    assert round(category_psi(REF, ['a'] * 30 + ['b'] * 40 + ['c'] * 30), 9) == 0.171479843
    assert round(category_psi(REF, ['a'] * 60 + ['b'] * 30 + ['c'] * 10), 9) == 0.087546874
    assert round(category_psi(REF, REF), 9) == 0.0

def test_new_category():
    """a category missing from one side uses eps"""
    cur = ['a'] * 30 + ['b'] * 30 + ['c'] * 20 + ['d'] * 20
    assert round(category_psi(REF, cur), 9) == 1.621585526
    assert category_psi(REF, cur) > category_psi(REF, ['a'] * 30 + ['b'] * 40 + ['c'] * 30)
    gone = ['a'] * 50 + ['b'] * 50
    assert round(category_psi(REF, gone), 9) == 1.621585526
    assert round(category_psi(gone, REF), 9) == 1.621585526

def test_order_does_not_matter():
    """reversing the lists gives the same PSI"""
    cur = ['a'] * 30 + ['b'] * 40 + ['c'] * 30
    assert round(category_psi(REF[::-1], cur[::-1]), 9) == 0.171479843

def test_empty():
    """an empty list raises ValueError"""
    for ref, cur in [([], ['a']), (['a'], [])]:
        try:
            category_psi(ref, cur)
        except ValueError:
            pass
        else:
            raise AssertionError('an empty list should have raised ValueError')
```

#### Uses
- [Drift detection › Categorical drift](#/drift/categorical-drift)
- [Drift detection › Population stability index](#/drift/population-stability-index)

#### Hints
- Raise on an empty list, then build a `Counter` for each side.
- Loop over the sorted union of the labels. Each share is the label's count over its list's length, with `eps` for a count of 0.
- Add up the same PSI terms as in the last exercise.

#### Tips
- A `Counter` returns 0 for a label it has not seen, so a category missing from one side needs no special case.
- Sorting the union fixes the order of the sum, so the result is the same on every run.

#### Docs
- [Python docs: `collections.Counter`](https://docs.python.org/3/library/collections.html#collections.Counter)
- [Python docs: `sorted`](https://docs.python.org/3/library/functions.html#sorted)
