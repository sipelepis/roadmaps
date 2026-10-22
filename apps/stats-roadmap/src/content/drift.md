# Drift detection

Compare today's data with a reference window using PSI and the KS statistic, for numbers and for categories.

## What drift looks like

Not written yet.

## Bins from the reference

Not written yet.

## Population stability index

Not written yet.

## The KS statistic

Not written yet.

## Categorical drift

Not written yet.

```python playground
print("This module is not written yet.")
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
