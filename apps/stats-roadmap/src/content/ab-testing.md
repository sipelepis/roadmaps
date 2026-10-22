# A/B tests

Size an A/B test before it starts, check the traffic split, correct for many metrics, and see what peeking costs.

## Decide before you look

Not written yet.

## Sample size

Not written yet.

## Sample ratio mismatch

Not written yet.

## Many metrics at once

Not written yet.

## The cost of peeking

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Sample size per arm

Write `sample_size(p1, p2, z_alpha=1.96, z_beta=0.84)`, which returns the number of users each arm needs, as an `int`. It is `math.ceil((z_alpha + z_beta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2)) / (p1 - p2) ** 2)`. Here `p1` is the baseline conversion rate and `p2` the rate you hope to detect. The defaults are a 5% significance level (two-sided) and 80% power. Raise `ValueError` when `p1 == p2`, because the formula would divide by zero, and when either rate is not strictly between 0 and 1.

```python starter
import math

def sample_size(p1, p2, z_alpha=1.96, z_beta=0.84):
    ...
```

```python test
def test_anchor():
    """a lift from 10% to 12%"""
    assert sample_size(0.10, 0.12) == 3834
    assert sample_size(0.12, 0.10) == 3834
    assert sample_size(0.20, 0.25) == 1090

def test_halving_the_gap():
    """half the gap needs about four times the users"""
    assert sample_size(0.10, 0.11) == 14732
    assert 3.7 < sample_size(0.10, 0.11) / sample_size(0.10, 0.12) < 4.0

def test_other_z_values():
    """a stricter level and more power need more users"""
    assert sample_size(0.30, 0.35, z_alpha=2.58, z_beta=1.28) == 2608
    assert isinstance(sample_size(0.30, 0.35), int)

def test_bad_rates():
    """equal rates or a rate outside 0 to 1 raise ValueError"""
    for args in [(0.1, 0.1), (0.0, 0.1), (0.1, 1.0), (1.2, 0.5)]:
        try:
            sample_size(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{args} should have raised ValueError')
```

### 2. Sample ratio mismatch

Write `srm_check(n_a, n_b, ratio=0.5)`, which returns `(chi2, p)` as a tuple of two floats, and `is_srm(n_a, n_b, ratio=0.5, threshold=0.001)`, which returns a `bool`. `ratio` is the share of traffic planned for arm A. Let `N = n_a + n_b` and `z = (n_a - N * ratio) / math.sqrt(N * ratio * (1 - ratio))`. Then `chi2 = z * z` and `p = 2 * (1 - NormalDist().cdf(abs(z)))`. `is_srm` is `True` when `p < threshold`. Raise `ValueError` when `N` is 0 and when `ratio` is not strictly between 0 and 1.

```python starter
import math
from statistics import NormalDist

def srm_check(n_a, n_b, ratio=0.5):
    ...

def is_srm(n_a, n_b, ratio=0.5, threshold=0.001):
    ...
```

```python test
def test_values():
    """chi-square and p-value for a few splits"""
    chi2, p = srm_check(50150, 49850)
    assert round(chi2, 9) == 0.9
    assert round(p, 9) == 0.342781711
    chi2, p = srm_check(51000, 49000)
    assert round(chi2, 9) == 40.0
    assert f"{p:.3g}" == "2.54e-10"
    chi2, p = srm_check(9100, 900, ratio=0.9)
    assert round(chi2, 9) == 11.111111111
    assert f"{p:.6g}" == "0.000858121"

def test_flags():
    """a clear mismatch is flagged and a balanced split is not"""
    assert is_srm(51000, 49000) is True
    assert is_srm(50150, 49850) is False
    assert is_srm(5060, 4940) is False

def test_planned_split_and_threshold():
    """the planned ratio and the threshold both matter"""
    assert is_srm(9040, 960) is True
    assert is_srm(9040, 960, ratio=0.9) is False
    assert is_srm(9100, 900, ratio=0.9) is True
    assert is_srm(10200, 9800) is False
    assert is_srm(10200, 9800, threshold=0.01) is True

def test_bad_input():
    """no users or a ratio outside 0 to 1 raises ValueError"""
    for args in [(0, 0), (100, 100, 0.0), (100, 100, 1.0)]:
        try:
            srm_check(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{args} should have raised ValueError')
```

### 3. Benjamini-Hochberg

Write `benjamini_hochberg(pvals, q=0.05)`, which returns a list of `bool` in the order of the input: `True` where the hypothesis is rejected. Sort the p-values ascending (a stable sort, so ties keep their input order). Let `m = len(pvals)`. Find the largest 1-based rank `k` with `p_(k) <= k * q / m`, where `p_(k)` is the k-th smallest p-value. Reject the `k` smallest p-values, including any whose own rank failed the test. If no rank passes, nothing is rejected. An empty list gives `[]`.

```python starter
def benjamini_hochberg(pvals, q=0.05):
    ...
```

```python test
def test_simple():
    """the smallest p-values are rejected"""
    assert benjamini_hochberg([0.001, 0.041, 0.031, 0.005, 0.2]) == [True, False, False, True, False]
    assert benjamini_hochberg([0.03, 0.2, 0.08, 0.011], q=0.1) == [True, False, False, True]

def test_later_rank_rescues_earlier_ones():
    """a passing rank rejects every smaller p-value too"""
    assert benjamini_hochberg([0.40, 0.02, 0.30, 0.024]) == [False, True, False, True]
    assert benjamini_hochberg([0.046, 0.015, 0.049, 0.018, 0.045]) == [True] * 5

def test_nothing_passes():
    """no rank passing rejects nothing"""
    assert benjamini_hochberg([0.2, 0.5, 0.03]) == [False, False, False]
    assert benjamini_hochberg([0.2, 0.3]) == [False, False]

def test_edges():
    """an empty list and a single value"""
    assert benjamini_hochberg([]) == []
    assert benjamini_hochberg([0.001]) == [True]
    assert benjamini_hochberg([0.2]) == [False]
```

### 4. What peeking costs

The starter gives you `z_p_value(k1, n1, k2, n2)`, the two-sided pooled two-proportion p-value for `k1` of `n1` against `k2` of `n2`. It returns `1.0` when the pooled rate is 0 or 1. Use it as given.

Write `false_positive_rates(n, looks, reps, rng, p=0.5, alpha=0.05)`, which returns `(single, peeking)` as two floats. Run `reps` A/A tests, where both arms convert with the same probability `p`. In each test, for each user `i` in `range(n)`, draw arm A first and then arm B, each as `rng.random() < p`. Look after every `n // looks` users per arm, with the last look at `n`. The single-look test uses only the last look. The peeking test is positive if any look has a p-value below `alpha`. Return the share of tests that are positive for each. Raise `ValueError` when `looks < 1` or `n` is not divisible by `looks`.

```python starter
import math
from statistics import NormalDist

def z_p_value(k1, n1, k2, n2):
    pooled = (k1 + k2) / (n1 + n2)
    if pooled in (0, 1):
        return 1.0
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    z = (k1 / n1 - k2 / n2) / se
    return 2 * (1 - NormalDist().cdf(abs(z)))

def false_positive_rates(n, looks, reps, rng, p=0.5, alpha=0.05):
    ...
```

```python test
import random

def test_peeking_never_less():
    """peeking finds at least as many false positives"""
    for seed in (1, 2):
        single, peeking = false_positive_rates(60, 6, 100, random.Random(seed))
        assert peeking >= single
    single, peeking = false_positive_rates(50, 1, 100, random.Random(5))
    assert peeking == single

def test_single_look_near_alpha():
    """one look keeps the false positive rate near 5%"""
    single, _ = false_positive_rates(100, 10, 400, random.Random(3))
    assert 0.01 <= single <= 0.10

def test_peeking_inflates():
    """ten looks give far more false positives than one"""
    _, peeking = false_positive_rates(100, 10, 400, random.Random(3))
    assert peeking >= 0.11

def test_bad_looks():
    """looks below 1 or not dividing n raises ValueError"""
    for n, looks in [(100, 0), (100, 7)]:
        try:
            false_positive_rates(n, looks, 5, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError(f'looks={looks} for n={n} should have raised ValueError')
```
