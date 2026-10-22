# Confidence intervals & bootstrap

Put error bars on a mean or a rate, bootstrap any statistic, and check by simulation that a 95% interval covers 95% of the time.

## What an interval claims

Not written yet.

## Normal intervals for a mean

Not written yet.

## Intervals for a rate

Not written yet.

## The bootstrap

Not written yet.

## Checking coverage

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Normal CI for a mean

Write `mean_ci(xs, conf=0.95)`, which returns a tuple `(lo, hi)` of floats. The interval is the sample mean minus and plus `z * s / sqrt(n)`, where `n` is `len(xs)`, `s` is the sample standard deviation (divide the sum of squared deviations by `n - 1`), and `z = NormalDist().inv_cdf(1 - (1 - conf) / 2)`. If `xs` has fewer than 2 values, or `conf` is not strictly between 0 and 1, raise `ValueError`.

```python starter
import math
from statistics import NormalDist


def mean_ci(xs, conf=0.95):
    ...
```

```python test
def test_known_interval():
    """95 percent interval for a small sample"""
    lo, hi = mean_ci([4, 5, 6, 7, 8, 9, 10, 11])
    assert round(lo, 9) == 5.802621399
    assert round(hi, 9) == 9.197378601
    lo, hi = mean_ci([10, 12, 14, 16, 18])
    assert round(lo, 9) == 11.228192351
    assert round(hi, 9) == 16.771807649


def test_higher_confidence_is_wider():
    """99 percent is wider than 95 percent"""
    lo, hi = mean_ci([4, 5, 6, 7, 8, 9, 10, 11], 0.99)
    assert round(lo, 9) == 5.269266387
    assert round(hi, 9) == 9.730733613
    lo95, hi95 = mean_ci([4, 5, 6, 7, 8, 9, 10, 11])
    assert hi - lo > hi95 - lo95


def test_constant_data():
    """no spread gives a zero-width interval"""
    lo, hi = mean_ci([5.0, 5.0, 5.0])
    assert round(lo, 9) == 5.0
    assert round(hi, 9) == 5.0


def test_bad_input():
    """fewer than 2 values or a bad conf raises ValueError"""
    for args in (([5.0],), ([], ), ([1.0, 2.0, 3.0], 1.0), ([1.0, 2.0, 3.0], 0.0)):
        try:
            mean_ci(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'mean_ci{args} should have raised ValueError')
```

### 2. Wilson interval for a rate

Write `wilson(k, n, conf=0.95)`, which returns `(lo, hi)` for a rate of `k` successes in `n` trials. Let `p_hat = k / n` and `z` be as in the normal interval. The Wilson score interval has centre `(p_hat + z**2 / (2 * n)) / (1 + z**2 / n)` and half-width `z / (1 + z**2 / n) * sqrt(p_hat * (1 - p_hat) / n + z**2 / (4 * n**2))`. Return centre minus and plus half-width, clamped into `[0, 1]`. For 0 successes the lower bound is `0.0` and the upper bound stays above 0. If `n` is 0 or `k` is outside `0..n`, raise `ValueError`.

```python starter
import math
from statistics import NormalDist


def wilson(k, n, conf=0.95):
    ...
```

```python test
def test_known_intervals():
    """95 percent Wilson interval for a few counts"""
    lo, hi = wilson(8, 20)
    assert round(lo, 9) == 0.218806532
    assert round(hi, 9) == 0.613418499
    lo, hi = wilson(50, 100)
    assert round(lo, 9) == 0.40383153
    assert round(hi, 9) == 0.59616847


def test_zero_successes():
    """0 of n keeps a positive upper bound"""
    lo, hi = wilson(0, 10)
    assert round(lo, 9) == 0.0
    assert round(hi, 9) == 0.2775328


def test_mirror():
    """n of n mirrors 0 of n"""
    lo, hi = wilson(10, 10)
    assert round(lo, 9) == 0.7224672
    assert round(hi, 9) == 1.0
    lo, hi = wilson(7, 10)
    assert 0.0 <= lo < 0.7 < hi <= 1.0


def test_bad_input():
    """n of 0 or k outside 0 to n raises ValueError"""
    for args in ((0, 0), (11, 10), (-1, 10)):
        try:
            wilson(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'wilson{args} should have raised ValueError')
```

### 3. Bootstrap percentile CI

Write `bootstrap_ci(xs, B, rng, conf=0.95)`, which returns `(lo, hi)`. Make `B` resamples. For each, draw `n = len(xs)` indices with `int(rng.random() * n)`, one `rng.random()` per index and in order, and take the mean of the chosen values as `sum(resample) / n`. Sort the `B` means. Return the interpolated percentiles at `q = (1 - conf) / 2` and `1 - q`: the value at position `(B - 1) * q`, found by linear interpolation between the two neighbouring sorted means (the "inclusive" method). If `xs` is empty or `B` is below 2, raise `ValueError`.

```python starter
def bootstrap_ci(xs, B, rng, conf=0.95):
    ...
```

```python test
import random


def test_seeded_interval():
    """same seed gives the same 95 percent interval"""
    lo, hi = bootstrap_ci([2, 4, 4, 5, 7, 9], 200, random.Random(3))
    assert round(lo, 9) == 3.495833333
    assert round(hi, 9) == 7.170833333


def test_narrower_conf():
    """an 80 percent interval at the same seed"""
    lo, hi = bootstrap_ci([2, 4, 4, 5, 7, 9], 200, random.Random(3), 0.8)
    assert round(lo, 9) == 4.0
    assert round(hi, 9) == 6.666666667


def test_other_data():
    """a 90 percent interval on different data"""
    lo, hi = bootstrap_ci([10, 12, 9, 15, 11, 14, 13, 8], 500, random.Random(7), 0.9)
    assert round(lo, 9) == 10.25
    assert round(hi, 9) == 12.875


def test_constant_and_bad():
    """constant data collapses, and bad input raises ValueError"""
    lo, hi = bootstrap_ci([5, 5, 5], 50, random.Random(1))
    assert round(lo, 9) == 5.0
    assert round(hi, 9) == 5.0
    for xs, B in (([], 10), ([1, 2, 3], 1)):
        try:
            bootstrap_ci(xs, B, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError(f'bootstrap_ci({xs}, {B}) should have raised ValueError')
```

### 4. Coverage by simulation

Write `coverage(draw, true_value, ci_fn, n, reps, rng)`, which returns a float. Repeat `reps` times: build a sample `[draw(rng) for _ in range(n)]`, call `ci_fn(sample)` to get `(lo, hi)`, and count the rep when `lo <= true_value <= hi`. Return the count divided by `reps`. If `reps` is 0 or negative, raise `ValueError`.

```python starter
def coverage(draw, true_value, ci_fn, n, reps, rng):
    ...
```

```python test
import math
import random

SD = math.sqrt(1 / 12)


def draw_uniform(rng):
    return rng.random()


def known_sigma(z):
    def ci(xs):
        m = sum(xs) / len(xs)
        h = z * SD / math.sqrt(len(xs))
        return (m - h, m + h)
    return ci


def test_always_and_never():
    """an interval that always covers gives 1 and one that never does gives 0"""
    assert coverage(draw_uniform, 0.5, lambda xs: (0.0, 1.0), 5, 20, random.Random(1)) == 1.0
    assert coverage(draw_uniform, 0.5, lambda xs: (0.6, 0.7), 5, 20, random.Random(1)) == 0.0


def test_draw_count_and_bad_reps():
    """draw is called n times per rep, and reps of 0 raises ValueError"""
    calls = []

    def draw(rng):
        calls.append(1)
        return rng.random()

    coverage(draw, 0.5, lambda xs: (0.0, 1.0), 7, 11, random.Random(1))
    assert len(calls) == 77
    try:
        coverage(draw_uniform, 0.5, lambda xs: (0.0, 1.0), 5, 0, random.Random(1))
    except ValueError:
        pass
    else:
        raise AssertionError('reps of 0 should have raised ValueError')


def test_known_sigma_covers_about_95():
    """a known-sigma 95 percent interval covers about 95 percent"""
    got = coverage(draw_uniform, 0.5, known_sigma(1.96), 10, 2000, random.Random(11))
    assert 0.93 <= got <= 0.97


def test_narrow_interval_undercovers():
    """a deliberately narrow interval covers far less"""
    got = coverage(draw_uniform, 0.5, known_sigma(0.5), 10, 2000, random.Random(11))
    assert 0.335 <= got <= 0.425
```
