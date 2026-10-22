# Large numbers & the CLT

Why averages settle, how fast, why their spread follows sigma / sqrt(n), and when they never settle at all.

## The law of large numbers

Not written yet.

## The sampling distribution

Not written yet.

## Standard error

Not written yet.

## The central limit theorem

Not written yet.

## When averages do not settle

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Standard error

Write `standard_error(sigma, n)`, which returns `sigma / sqrt(n)`: how far the mean of `n` draws typically lands from the true mean, when the population's standard deviation is `sigma`. Raise `ValueError` when `n` is 0 or less.

Then write `standard_error_of(xs)`, which estimates the same thing from data when you do not know `sigma`. Take the sample standard deviation of `xs`, dividing the sum of squared deviations from the mean by `len(xs) - 1`, and return it divided by `sqrt(len(xs))`. Raise `ValueError` when `xs` has fewer than 2 values.

```python starter
import math


def standard_error(sigma, n):
    ...


def standard_error_of(xs):
    ...
```

```python test
def test_known_sigma():
    """sigma over the square root of n"""
    assert round(standard_error(2.0, 7), 9) == 0.755928946
    assert round(standard_error(15, 9), 9) == 5.0
    assert round(standard_error(0.3, 50), 9) == 0.042426407


def test_from_data():
    """estimated from data with the n - 1 standard deviation"""
    assert round(standard_error_of([3.1, 2.7, 4.0, 3.6, 2.9]), 9) == 0.237907545
    assert round(standard_error_of([10, 12, 9, 15, 11, 13]), 9) == 0.881917104


def test_bad_n():
    """n of 0 or less raises ValueError"""
    for n in (0, -4):
        try:
            standard_error(1.0, n)
        except ValueError:
            pass
        else:
            raise AssertionError(f'n of {n} should have raised ValueError')


def test_too_few_values():
    """fewer than two values raises ValueError"""
    for xs in ([], [5.0]):
        try:
            standard_error_of(xs)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{xs} should have raised ValueError')
```

### 2. Simulate the sampling distribution

Write `sample_means(draw, n, reps, rng)`. `draw` is a function that takes `rng` and returns one value. For each of `reps` repetitions, call `draw(rng)` `n` times, in order, and record the mean of those `n` values. Return the list of `reps` means in the order you made them. Raise `ValueError` when `n` or `reps` is 0 or less.

The list is a sampling distribution: how the mean of `n` draws varies from one sample to the next. Its standard deviation should come out close to `sigma / sqrt(n)`.

```python starter
def sample_means(draw, n, reps, rng):
    ...
```

```python test
import random
import statistics


def test_order():
    """each mean uses the next n draws, in order"""
    seen = []

    def counter(rng):
        seen.append(len(seen))
        return seen[-1]

    got = sample_means(counter, 3, 4, random.Random(1))
    assert [round(v, 9) for v in got] == [1.0, 4.0, 7.0, 10.0]
    assert len(seen) == 12


def test_first_mean():
    """the first mean is the average of the first 25 draws"""
    means = sample_means(lambda rng: rng.random(), 25, 2000, random.Random(2))
    assert len(means) == 2000
    assert round(means[0], 9) == 0.500895892


def test_spread():
    """means of 25 uniform draws centre on 0.5 and spread by about 0.0577"""
    means = sample_means(lambda rng: rng.random(), 25, 2000, random.Random(2))
    assert abs(statistics.fmean(means) - 0.5) < 0.0055
    assert abs(statistics.stdev(means) - 0.057735) < 0.004


def test_bad_sizes():
    """n or reps of 0 or less raises ValueError"""
    for n, reps in ((0, 5), (5, 0), (-1, 5)):
        try:
            sample_means(lambda rng: rng.random(), n, reps, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError(f'n={n}, reps={reps} should have raised ValueError')
```

### 3. n for a target margin

Write `n_for_margin(sigma, margin, conf=0.95)`, which returns the smallest whole sample size whose margin of error `z * sigma / sqrt(n)` is at most `margin`. Here `z = NormalDist().inv_cdf(1 - (1 - conf) / 2)`, using `NormalDist` from the `statistics` module, which is about 1.96 when `conf` is 0.95. Solve for `n` and round up: return `math.ceil((z * sigma / margin) ** 2)`, an `int`. Raise `ValueError` when `margin` is 0 or less, or when `conf` is not strictly between 0 and 1.

```python starter
import math
from statistics import NormalDist


def n_for_margin(sigma, margin, conf=0.95):
    ...
```

```python test
def test_default_conf():
    """95% by default, rounded up to a whole sample"""
    got = n_for_margin(15, 2)
    assert isinstance(got, int)
    assert got == 217
    assert n_for_margin(3.5, 0.25) == 753


def test_half_margin():
    """halving the margin needs about four times the sample"""
    assert n_for_margin(15, 1) == 865


def test_other_conf():
    """a higher confidence needs a bigger sample"""
    assert n_for_margin(10, 1, 0.99) == 664
    assert n_for_margin(1, 0.1, 0.9) == 271
    assert n_for_margin(4, 0.5, conf=0.8) == 106


def test_bad_inputs():
    """a margin of 0 or less, or conf outside 0 to 1, raises ValueError"""
    for args in ((15, 0), (15, -2), (15, 2, 0.0), (15, 2, 1.0), (15, 2, 1.5)):
        try:
            n_for_margin(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'n_for_margin{args} should have raised ValueError')
```

### 4. A mean that will not settle

Write `running_means(xs)`, which returns a list the same length as `xs` where item `i` is the mean of the first `i + 1` values. An empty list gives `[]`.

Then write `cauchy(rng)`, which returns one draw from the standard Cauchy distribution: `math.tan(math.pi * (rng.random() - 0.5))`. Call `rng.random()` exactly once per draw. The Cauchy distribution has no mean, so the law of large numbers does not hold for it: its running mean keeps jumping however long you run it, while its median stays put.

```python starter
import math


def running_means(xs):
    ...


def cauchy(rng):
    ...
```

```python test
import random
import statistics


def test_running_means():
    """the mean of each prefix"""
    got = running_means([1, 2, 2, 7])
    assert [round(v, 9) for v in got] == [1.0, 1.5, 1.666666667, 3.0]
    assert running_means([]) == []


def test_cauchy_draw():
    """one rng.random() per Cauchy draw"""
    rng = random.Random(1)
    x = cauchy(rng)
    assert f'{x:.9g}' == '-2.22660117'
    cauchy(rng)
    twice = random.Random(1)
    twice.random()
    twice.random()
    assert rng.getstate() == twice.getstate()


def test_never_settles():
    """late on, the Cauchy running mean still jumps and a uniform one does not"""
    rng = random.Random(21)
    c = running_means([cauchy(rng) for _ in range(20000)])[10000:]
    other = random.Random(22)
    u = running_means([other.random() for _ in range(20000)])[10000:]
    assert max(c) - min(c) > 1.0
    assert max(u) - min(u) < 0.05


def test_median():
    """the median of Cauchy draws stays near 0"""
    rng = random.Random(21)
    xs = [cauchy(rng) for _ in range(20000)]
    assert abs(statistics.median(xs)) < 0.05
```
