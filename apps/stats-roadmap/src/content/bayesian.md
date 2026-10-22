# Bayesian updating

Start from a prior, update on data, read a credible interval, and estimate the chance that B beats A.

## Prior, likelihood, posterior

Not written yet.

## Updating on a grid

Not written yet.

## The Beta-Binomial shortcut

Not written yet.

## Credible intervals

Not written yet.

## Comparing two rates

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Update a prior on a grid

Write `grid_posterior(grid, prior, k, n)`. `grid` is a list of candidate values `theta` for a success rate and `prior` is a list of weights of the same length. After seeing `k` successes in `n` trials, each posterior weight is proportional to `prior_i * theta_i ** k * (1 - theta_i) ** (n - k)`, where `0 ** 0` is `1`. Return the weights divided by their sum, as a list. If `grid` and `prior` differ in length, or every product is zero so the sum is zero, raise `ValueError`.

```python starter
def grid_posterior(grid, prior, k, n):
    ...
```

```python test
GRID = [0.0, 0.25, 0.5, 0.75, 1.0]
FLAT = [0.2, 0.2, 0.2, 0.2, 0.2]


def test_one_update():
    """1 success in 2 trials from a flat prior"""
    got = grid_posterior(GRID, FLAT, 1, 2)
    assert [round(v, 9) for v in got] == [0.0, 0.3, 0.4, 0.3, 0.0]


def test_uneven_prior():
    """a prior that favours the middle"""
    got = grid_posterior(GRID, [0.1, 0.2, 0.4, 0.2, 0.1], 2, 3)
    assert [round(v, 9) for v in got] == [0.0, 0.107142857, 0.571428571, 0.321428571, 0.0]


def test_two_batches_equal_one():
    """two batches of data give the same posterior as one"""
    first = grid_posterior(GRID, FLAT, 1, 2)
    both = grid_posterior(GRID, first, 2, 3)
    assert [round(v, 9) for v in both] == [0.0, 0.132352941, 0.470588235, 0.397058824, 0.0]
    once = grid_posterior(GRID, FLAT, 3, 5)
    assert [round(v, 9) for v in once] == [0.0, 0.132352941, 0.470588235, 0.397058824, 0.0]


def test_no_data_and_errors():
    """0 of 0 keeps the prior, and bad input raises ValueError"""
    got = grid_posterior(GRID, FLAT, 0, 0)
    assert [round(v, 9) for v in got] == [0.2, 0.2, 0.2, 0.2, 0.2]
    for grid, prior, k, n in (([0.0, 1.0], [1.0, 0.0], 1, 1), ([0.0, 0.5, 1.0], [0.5, 0.5], 1, 2)):
        try:
            grid_posterior(grid, prior, k, n)
        except ValueError:
            pass
        else:
            raise AssertionError('a zero total or a length mismatch should have raised ValueError')
```

### 2. Beta-Binomial update

Write `beta_update(a, b, k, n)` and `beta_mean(a, b)`. A `Beta(a, b)` prior updated with `k` successes in `n` trials becomes `Beta(a + k, b + n - k)`, so `beta_update` returns the tuple `(a + k, b + n - k)`. `beta_mean` returns `a / (a + b)`. In `beta_update`, raise `ValueError` if `k > n` or if any of `a`, `b`, `k`, `n` is negative. With `k = n = 0` the prior comes back unchanged.

```python starter
def beta_update(a, b, k, n):
    ...


def beta_mean(a, b):
    ...
```

```python test
def test_update():
    """successes add to a and failures add to b"""
    assert beta_update(1, 1, 7, 10) == (8, 4)
    assert beta_update(2, 3, 5, 5) == (7, 3)


def test_no_data():
    """0 of 0 leaves the prior unchanged"""
    assert beta_update(2, 3, 0, 0) == (2, 3)


def test_mean():
    """the mean of a beta"""
    assert round(beta_mean(8, 4), 9) == 0.666666667
    assert round(beta_mean(3, 9), 9) == 0.25


def test_bad_input():
    """k above n or a negative input raises ValueError"""
    for args in ((1, 1, 11, 10), (-1, 1, 1, 2), (1, 1, 1, -2)):
        try:
            beta_update(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'beta_update{args} should have raised ValueError')
```

### 3. Credible interval from the grid

Write `credible_interval(grid, post, mass=0.95)`, which returns a tuple `(lo, hi)` of values from `grid`. Walk along the grid keeping a running sum of `post` from the left. `lo` is the first grid value where the running sum reaches `(1 - mass) / 2`, and `hi` is the first grid value where it reaches `1 - (1 - mass) / 2`. If `post` does not sum to 1 within `1e-9`, raise `ValueError`.

```python starter
def credible_interval(grid, post, mass=0.95):
    ...
```

```python test
TENTHS = [i / 10 for i in range(11)]
BELL = [0.02, 0.03, 0.05, 0.1, 0.2, 0.2, 0.15, 0.1, 0.08, 0.05, 0.02]
QUARTERS = [0.0, 0.25, 0.5, 0.75, 1.0]
SKEW = [0.01, 0.04, 0.3, 0.45, 0.2]


def test_default_mass():
    """the central 95 percent of a bell-shaped posterior"""
    lo, hi = credible_interval(TENTHS, BELL)
    assert round(lo, 9) == 0.1
    assert round(hi, 9) == 0.9


def test_skewed_posterior():
    """a skewed posterior at 95 and 50 percent"""
    lo, hi = credible_interval(QUARTERS, SKEW)
    assert (round(lo, 9), round(hi, 9)) == (0.25, 1.0)
    lo, hi = credible_interval(QUARTERS, SKEW, 0.5)
    assert (round(lo, 9), round(hi, 9)) == (0.5, 0.75)


def test_point_mass():
    """all the weight on one value gives that value twice"""
    lo, hi = credible_interval(QUARTERS, [0.0, 0.0, 1.0, 0.0, 0.0])
    assert (round(lo, 9), round(hi, 9)) == (0.5, 0.5)


def test_not_normalised():
    """a posterior that does not sum to 1 raises ValueError"""
    try:
        credible_interval(QUARTERS, [0.1, 0.1, 0.1, 0.1, 0.1])
    except ValueError:
        pass
    else:
        raise AssertionError('a posterior summing to 0.5 should have raised ValueError')
```

### 4. P(B beats A)

Write `prob_b_beats_a(a_succ, a_n, b_succ, b_n, draws, rng)`. Give each arm a `Beta(1 + k, 1 + n - k)` posterior, where `k` is its successes and `n` its trials. Make `draws` pairs. In each pair draw A first with `rng.betavariate(...)`, then B. Return the fraction of pairs in which B's draw is larger than A's. If `draws` is 0 or negative, raise `ValueError`.

```python starter
def prob_b_beats_a(a_succ, a_n, b_succ, b_n, draws, rng):
    ...
```

```python test
import random


def test_clear_winner():
    """B clearly better than A is about 93 percent"""
    got = prob_b_beats_a(30, 100, 40, 100, 4000, random.Random(1))
    assert 0.905 <= got <= 0.955


def test_equal_data():
    """equal data gives about one half"""
    got = prob_b_beats_a(50, 100, 50, 100, 4000, random.Random(1))
    assert 0.465 <= got <= 0.535


def test_swapping_arms():
    """a huge gap is near 1 one way and near 0 the other"""
    assert prob_b_beats_a(10, 100, 60, 100, 500, random.Random(2)) >= 0.99
    assert prob_b_beats_a(60, 100, 10, 100, 500, random.Random(2)) <= 0.01


def test_bad_draws():
    """draws of 0 raises ValueError"""
    try:
        prob_b_beats_a(5, 10, 6, 10, 0, random.Random(1))
    except ValueError:
        pass
    else:
        raise AssertionError('draws of 0 should have raised ValueError')
```
