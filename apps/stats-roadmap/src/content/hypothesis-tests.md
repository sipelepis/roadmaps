# Hypothesis tests

Test a difference between two rates, read a p-value correctly, and measure false positives and power by simulation.

## Null and alternative

Not written yet.

## What a p-value is

Not written yet.

## The two-proportion z-test

Not written yet.

## Permutation tests

Not written yet.

## Errors and power

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Two-proportion z-test

Write `two_prop_z(k1, n1, k2, n2)`, which returns a tuple `(z, p)`. Arm 1 had `k1` successes in `n1` trials and arm 2 had `k2` in `n2`. Pool the arms: `p_pool = (k1 + k2) / (n1 + n2)` and `se = sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))`. Then `z = (k2 / n2 - k1 / n1) / se` and the two-sided `p = 2 * (1 - NormalDist().cdf(abs(z)))`. If `n1` or `n2` is 0, or the pooled rate is 0 or 1 so that `se` is 0, raise `ValueError`.

```python starter
import math
from statistics import NormalDist


def two_prop_z(k1, n1, k2, n2):
    ...
```

```python test
def test_known_cases():
    """z and p for two comparisons"""
    z, p = two_prop_z(30, 100, 45, 100)
    assert round(z, 9) == 2.19089023
    assert round(p, 9) == 0.028459737
    z, p = two_prop_z(200, 1000, 230, 1000)
    assert round(z, 9) == 1.632872213
    assert round(p, 9) == 0.102495875


def test_unequal_arms():
    """arms of different sizes"""
    z, p = two_prop_z(10, 50, 25, 80)
    assert round(z, 9) == 1.406884255
    assert round(p, 9) == 0.159461713


def test_swap_arms():
    """swapping the arms flips the sign of z and keeps p"""
    z1, p1 = two_prop_z(30, 100, 45, 100)
    z2, p2 = two_prop_z(45, 100, 30, 100)
    assert round(z2, 9) == -2.19089023
    assert round(z1 + z2, 9) == 0.0
    assert round(p1 - p2, 9) == 0.0


def test_bad_input():
    """an empty arm or a pooled rate of 0 or 1 raises ValueError"""
    for args in ((0, 0, 3, 10), (3, 10, 0, 0), (0, 10, 0, 10), (10, 10, 10, 10)):
        try:
            two_prop_z(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'two_prop_z{args} should have raised ValueError')
```

### 2. Permutation test

Write `perm_test(a, b, reps, rng)`, which returns a p-value. The observed difference is `sum(b) / len(b) - sum(a) / len(a)`. Each of the `reps` repetitions shuffles a copy of `a + b` with Fisher-Yates: for `i` from `len - 1` down to 1, set `j = int(rng.random() * (i + 1))` and swap items `i` and `j`. Take the first `len(a)` items as group A and the rest as group B and compute the same difference. Count the repetitions where `abs(diff) >= abs(observed) - 1e-9`. Return `(count + 1) / (reps + 1)`. If either group is empty, raise `ValueError`.

```python starter
def perm_test(a, b, reps, rng):
    ...
```

```python test
import random

A = [12, 15, 11, 14, 13, 16]
B = [16, 18, 15, 19, 17, 20]


def test_seeded_p():
    """a clear difference gives a small p at a fixed seed"""
    assert round(perm_test(A, B, 2000, random.Random(3)), 9) == 0.011494253
    assert round(perm_test(A, B, 2000, random.Random(8)), 9) == 0.010994503


def test_unequal_groups():
    """groups of different sizes"""
    got = perm_test([3, 5, 4], [9, 7, 8, 10, 6], 1000, random.Random(5))
    assert round(got, 9) == 0.038961039


def test_identical_groups():
    """identical groups give a p of 1"""
    assert round(perm_test([4, 4, 4], [4, 4, 4], 50, random.Random(1)), 9) == 1.0


def test_empty_group():
    """an empty group raises ValueError"""
    for a, b in (([], [1, 2]), ([1, 2], [])):
        try:
            perm_test(a, b, 10, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError('an empty group should have raised ValueError')
```

### 3. Type I error by simulation

Write `type_one_rate(n, reps, rng, alpha=0.05)`, which returns a float. Each of `reps` repetitions draws `n` uniforms with `rng.random()` (their true mean is `0.5` and their standard deviation is `sqrt(1 / 12)`) and computes `z = (mean - 0.5) / (math.sqrt(1 / 12) / math.sqrt(n))`. The test rejects when `2 * (1 - NormalDist().cdf(abs(z))) < alpha`. Return the fraction of repetitions that reject. If `reps` is 0 or negative, raise `ValueError`.

```python starter
import math
from statistics import NormalDist


def type_one_rate(n, reps, rng, alpha=0.05):
    ...
```

```python test
import random


def test_rate_near_alpha():
    """the false positive rate is near 5 percent"""
    got = type_one_rate(20, 2000, random.Random(5))
    assert 0.03 <= got <= 0.07


def test_seeded_rate():
    """same seed, same rejection count"""
    assert round(type_one_rate(20, 2000, random.Random(5)), 9) == 0.0545


def test_alpha_zero():
    """an alpha of 0 never rejects"""
    assert type_one_rate(20, 200, random.Random(2), alpha=0) == 0.0


def test_bad_reps():
    """reps of 0 raises ValueError"""
    try:
        type_one_rate(20, 0, random.Random(1))
    except ValueError:
        pass
    else:
        raise AssertionError('reps of 0 should have raised ValueError')
```

### 4. Power of a test

Write `power(delta, sigma, n, alpha=0.05)`, the power of a two-sided one-sample z-test, as a float. Let `zc = NormalDist().inv_cdf(1 - alpha / 2)` and `d = delta * math.sqrt(n) / sigma`. The power is `cdf(d - zc) + cdf(-d - zc)`, with `cdf` from `NormalDist()`. If `n` is 0 or negative, or `sigma` is 0 or negative, raise `ValueError`.

```python starter
import math
from statistics import NormalDist


def power(delta, sigma, n, alpha=0.05):
    ...
```

```python test
def test_standard_case():
    """a half-sigma effect with 32 samples is about 80 percent"""
    assert round(power(0.5, 1, 32), 9) == 0.807430419


def test_no_effect():
    """with no effect the power equals alpha"""
    assert round(power(0, 1, 10), 9) == 0.05
    assert round(power(0, 3, 10, alpha=0.1), 9) == 0.1


def test_grows_with_n():
    """more samples give more power"""
    small = power(0.5, 1, 8)
    big = power(0.5, 1, 64)
    assert round(small, 9) == 0.292988936
    assert round(big, 9) == 0.979326632
    assert small < power(0.5, 1, 32) < big


def test_other_alpha_and_errors():
    """a stricter alpha lowers power, and bad input raises ValueError"""
    assert round(power(1, 2, 16, alpha=0.01), 9) == 0.282367654
    for args in ((0.5, 1, 0), (0.5, 1, -4), (0.5, 0, 10), (0.5, -1, 10)):
        try:
            power(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'power{args} should have raised ValueError')
```
