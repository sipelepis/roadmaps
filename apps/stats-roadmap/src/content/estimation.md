# Likelihood & estimation

Pick the parameter that makes your data most likely, work in logs to stay finite, and see why variance divides by n - 1.

## Estimators

Not written yet.

## Likelihood

Not written yet.

## Log-likelihood

Not written yet.

## Maximum likelihood

Not written yet.

## Working in logs

Not written yet.

## Bias of the variance

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Bernoulli log-likelihood

Write `log_likelihood(flips, p)`. `flips` is a list of 0s and 1s and `p` is the probability of a 1. Return the log of the probability of seeing exactly these flips: add `math.log(p)` for each 1 and `math.log(1 - p)` for each 0. An empty list gives `0.0`. When a flip is impossible under `p`, a 1 with `p` of 0 or a 0 with `p` of 1, return `-math.inf` rather than letting `math.log(0)` raise. Raise `ValueError` when `p` is below 0 or above 1.

```python starter
import math


def log_likelihood(flips, p):
    ...
```

```python test
import math


def test_values():
    """the sum of the logs of each flip's probability"""
    assert round(log_likelihood([1, 0, 1, 1], 0.75), 9) == -2.249340578
    assert round(log_likelihood([1, 1, 0], 0.5), 9) == -2.079441542
    assert round(log_likelihood([0, 0, 0, 1, 0], 0.2), 9) == -2.502012118


def test_certain():
    """an empty list, or flips that p of 0 or 1 makes certain, give 0.0"""
    assert round(log_likelihood([], 0.3), 9) == 0.0
    assert round(log_likelihood([0, 0], 0.0), 9) == 0.0
    assert round(log_likelihood([1, 1], 1.0), 9) == 0.0


def test_impossible():
    """an impossible flip gives minus infinity"""
    assert log_likelihood([1, 0], 0.0) == -math.inf
    assert log_likelihood([0, 1, 1], 1.0) == -math.inf


def test_bad_p():
    """p outside 0 to 1 raises ValueError"""
    for p in (-0.1, 1.5):
        try:
            log_likelihood([1, 0], p)
        except ValueError:
            pass
        else:
            raise AssertionError(f'p of {p} should have raised ValueError')
```

### 2. MLE by grid search

Write `grid_mle(flips, steps=1000)`, which tries every `p = i / steps` for `i` from 1 to `steps - 1` and returns the one whose log-likelihood for `flips` is highest. Compute the log-likelihood inline with `math.log`, as in the previous exercise. Compute each `p` as `i / steps`, so the grid never reaches 0 or 1. When two values of `p` tie, return the smaller one.

Then write `closed_form_mle(flips)`, which returns the answer calculus gives: the number of 1s divided by the number of flips. Both functions raise `ValueError` for an empty list.

```python starter
import math


def grid_mle(flips, steps=1000):
    ...


def closed_form_mle(flips):
    ...
```

```python test
import random


def test_seven_of_ten():
    """7 ones in 10 flips gives 0.7 both ways"""
    flips = [1, 1, 1, 0, 1, 0, 1, 1, 0, 1]
    assert round(grid_mle(flips), 9) == 0.7
    assert round(closed_form_mle(flips), 9) == 0.7
    assert round(grid_mle([1, 0, 0]), 9) == 0.333
    assert round(closed_form_mle([1, 0, 0]), 9) == 0.333333333


def test_grid_edges():
    """the nearest step, never 0 or 1, and the smaller p on a tie"""
    assert round(grid_mle([1, 0, 0], steps=7), 9) == 0.285714286
    assert round(grid_mle([1, 1, 1, 1]), 9) == 0.999
    assert round(grid_mle([1, 1, 1, 1], steps=10), 9) == 0.9
    assert round(closed_form_mle([1, 1, 1, 1]), 9) == 1.0
    assert round(grid_mle([1, 0], steps=5), 9) == 0.4
    assert round(grid_mle([0, 1], steps=5), 9) == 0.4


def test_agree():
    """the grid and the closed form agree within one step"""
    rng = random.Random(4)
    for n in (13, 37, 61):
        flips = [1 if rng.random() < 0.37 else 0 for _ in range(n)]
        assert abs(grid_mle(flips) - closed_form_mle(flips)) <= 0.001


def test_empty():
    """an empty list raises ValueError"""
    for fn in (grid_mle, closed_form_mle):
        try:
            fn([])
        except ValueError:
            pass
        else:
            raise AssertionError(f'{fn.__name__}([]) should have raised ValueError')
```

### 3. logsumexp

Write `logsumexp(xs)`, which returns `log(exp(x1) + exp(x2) + ...)` without overflowing or underflowing. Take `m = max(xs)` and return `m + math.log(sum(math.exp(x - m) for x in xs))`. Every `x - m` is 0 or less, so no `exp` overflows, and the largest term is exactly 1, so the sum never underflows to 0. An empty list gives `-math.inf`, the log of an empty sum, and so does a list where every value is `-math.inf`.

```python starter
import math


def logsumexp(xs):
    ...
```

```python test
import math


def test_small_values():
    """the log of a sum of exps"""
    assert round(logsumexp([1, 2, 3]), 9) == 3.407605964
    assert round(logsumexp([0.5, -0.25, 2.0, -3.0]), 9) == 2.28913152
    assert round(logsumexp([0]), 9) == 0.0


def test_huge_and_tiny():
    """stays finite where exp overflows or underflows"""
    assert round(logsumexp([1000, 1000]), 9) == 1000.693147181
    assert round(logsumexp([-1000, -1000]), 9) == -999.306852819
    assert round(logsumexp([710, 709]), 9) == 710.313261688


def test_minus_infinity():
    """minus infinity is the log of 0"""
    assert logsumexp([]) == -math.inf
    assert logsumexp([-math.inf, -math.inf]) == -math.inf
    assert round(logsumexp([-math.inf, 0.0]), 9) == 0.0
    assert round(logsumexp([5, -math.inf]), 9) == 5.0
```

### 4. n versus n - 1

Write `simulate_bias(n, reps, rng)`. For each of `reps` repetitions, draw `n` values with `rng.random()`, which are uniform on `[0, 1)` with a true variance of 1/12, and take the sum of their squared deviations from their own mean. Dividing it by `n` gives one variance estimate and dividing it by `n - 1` gives the other. Return a tuple of two floats: the average of the divide-by-`n` estimates over all repetitions, then the average of the divide-by-`(n - 1)` estimates. Draw exactly `n * reps` values, in order. Raise `ValueError` when `n` is less than 2.

```python starter
def simulate_bias(n, reps, rng):
    ...
```

```python test
import random


def test_exact():
    """same seed, same averages"""
    got = simulate_bias(4, 3, random.Random(2))
    assert isinstance(got, tuple)
    assert round(got[0], 9) == 0.090063333
    assert round(got[1], 9) == 0.120084444


def test_bias():
    """dividing by n runs low by (n - 1) / n, dividing by n - 1 does not"""
    biased, unbiased = simulate_bias(5, 4000, random.Random(5))
    assert abs(biased - 0.0666667) < 0.0024
    assert abs(unbiased - 0.0833333) < 0.003
    assert round(biased / unbiased, 9) == 0.8


def test_small_n():
    """n below 2 raises ValueError"""
    for n in (1, 0):
        try:
            simulate_bias(n, 10, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError(f'n of {n} should have raised ValueError')
```
