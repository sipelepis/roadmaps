# Confidence intervals & bootstrap

Put error bars on a mean or a rate, bootstrap any statistic, and check by simulation that a 95% interval covers 95% of the time.

## What an interval claims

An estimate on its own does not say how far off it might be. An interval does: it puts a low and a high value around the estimate. The interval comes from a recipe, and the confidence level is a promise about the recipe.

Watch the recipe work in a world where you know the truth. Each sample is 10 uniform numbers, whose true mean is 0.5. The spread of one uniform number is `sqrt(1 / 12)`, and here you treat it as known:

```python
import math
import random
from statistics import NormalDist

z = NormalDist().inv_cdf(0.975)
h = z * math.sqrt(1 / 12) / math.sqrt(10)
rng = random.Random(4)
for _ in range(20):
    m = sum(rng.random() for _ in range(10)) / 10
    print(round(m - h, 3), round(m + h, 3), m - h <= 0.5 <= m + h)
```

Nineteen of the 20 intervals contain 0.5. The eleventh, `(0.132, 0.49)`, misses. Run it for thousands of samples and the share of hits settles near 95%.

That is the whole claim. A 95% confidence interval comes from a procedure that covers the true value in 95% of repeated samples. Once you have computed one interval from your one sample, nothing about it is random any more. It either contains the true value or it does not, and you cannot tell which.

So the 95% belongs to the method, not to the one interval in front of you. The true mean is a fixed number, so it has no probability of being anywhere. Read an interval as "this range came from a method that covers the truth 95% of the time", never as a probability statement about the parameter. The module on Bayesian updating builds an interval that is one, at the price of a prior.

## Normal intervals for a mean

[The central limit theorem](#/clt/the-central-limit-theorem) says the sample mean is close to normal, centred on the true mean, with a spread equal to the [standard error](#/clt/standard-error) `s / sqrt(n)`. About 95% of a normal lies within 1.96 standard deviations of its centre, which gives the recipe:

```
interval = mean - z * s / sqrt(n)  to  mean + z * s / sqrt(n)
z        = NormalDist().inv_cdf(1 - alpha / 2)
alpha    = 1 - conf
```

`inv_cdf(q)` returns the point with a share `q` of the [normal distribution](#/distributions/the-normal-distribution) below it. For 95%, alpha is 0.05, and you ask for the point with 97.5% below it, which leaves 2.5% in each tail:

```python
for conf in (0.90, 0.95, 0.99):
    print(conf, NormalDist().inv_cdf(1 - (1 - conf) / 2))
```

This prints `1.6448536269514715`, `1.9599639845400536` and `2.5758293035489`. More confidence costs a wider interval.

Here are ten measurements:

```python
xs = [12.1, 9.8, 11.4, 10.6, 13.0, 10.2, 11.7, 12.5, 9.9, 11.3]
n = len(xs)
m = sum(xs) / n
s = math.sqrt(sum((x - m) ** 2 for x in xs) / (n - 1))
h = z * s / math.sqrt(n)
print(m - h, m + h)
```

The mean is `11.25`, `s` is `1.1067971810589328`, the standard error is `0.35`, and the 95% interval runs from `10.564012605410982` to `11.935987394589018`. `s` divides by `n - 1`, as in [Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation), for the reason in [Bias of the variance](#/estimation/bias-of-the-variance). `statistics.stdev(xs)` gives the same `s`.

The recipe treats `s` as if it were the true spread. With few values `s` is itself noisy, and the interval comes out too narrow. The usual fix is a bigger multiplier from Student's t distribution with `n - 1` degrees of freedom: about 2.776 for 5 values, 2.262 for 10 and 2.045 for 30, rounded to three places, against 1.96. The standard library has no t distribution. In scipy it is `scipy.stats.t.ppf(0.975, n - 1)`. The exercise below uses `z` at every size, and [Checking coverage](#/intervals/checking-coverage) measures what that costs.

## Intervals for a rate

A rate is the mean of 0s and 1s, and the spread of one 0/1 value is `sqrt(p * (1 - p))`. Put those into the mean recipe and you get the Wald interval:

```python
def wald(k, n):
    p_hat = k / n
    h = z * math.sqrt(p_hat * (1 - p_hat) / n)
    return (p_hat - h, p_hat + h)
```

It breaks near 0 and 1. `wald(0, 20)` is `(0.0, 0.0)`: no successes means `p_hat` is 0, the spread is 0, and the interval claims the rate is exactly 0 after only 20 trials. `wald(3, 40)` has a lower bound of `-0.006624323226237974`, below any possible rate.

The Wilson score interval fixes both. It pulls the centre toward one half and keeps a positive width:

```
centre     = (p_hat + z**2 / (2 * n)) / (1 + z**2 / n)
half-width = z / (1 + z**2 / n) * sqrt(p_hat * (1 - p_hat) / n + z**2 / (4 * n**2))
```

For 0 of 20 it gives `0.0` to `0.1611251580528193`: you have seen no successes, but the rate could still be as high as about 16%. For 3 of 40 it gives `0.025836025774588198` to `0.19864233524310543`. Near the middle the two agree: 20 of 40 gives 0.345 to 0.655 with Wald and 0.352 to 0.648 with Wilson, rounded to three places. In Python libraries, statsmodels has `proportion_confint(k, n, method="wilson")`.

## The bootstrap

The median, a trimmed mean, a 90th percentile: most statistics have no simple formula for their spread. The bootstrap gets one by brute force. Treat your sample as a stand-in for the population, draw a new sample of the same size from it with replacement, and recompute the statistic. Do that `B` times, and the spread of the `B` results stands in for the spread you would see across real samples.

```python
def resample(xs, rng):
    n = len(xs)
    return [xs[int(rng.random() * n)] for _ in range(n)]

print(resample([10, 20, 30, 40, 50], random.Random(3)))
```

`int(rng.random() * n)` is a whole number from 0 to `n - 1`, each equally likely. This prints `[20, 30, 20, 40, 40]`: 20 and 40 came up twice, and 10 and 50 not at all. That is what "with replacement" means, and it is why each resample differs a little from the data.

Twelve response times in milliseconds, with one slow outlier:

```python
import statistics

times = [212, 180, 305, 198, 251, 190, 1240, 233, 175, 264, 221, 410]
rng = random.Random(1)
meds = sorted(statistics.median(resample(times, rng)) for _ in range(2000))
cuts = statistics.quantiles(meds, n=40, method='inclusive')
print(cuts[0], cuts[-1])
```

`statistics.quantiles(..., n=40)` returns the 39 cut points that split the data into 40 equal parts, so the first is the 2.5th percentile and the last is the 97.5th. The `inclusive` method interpolates as in [Percentiles and quartiles](#/describing/percentiles-and-quartiles). The median is `227.0`, and its 95% bootstrap interval runs from `194.0` to `284.5`. Reseed with `random.Random(1)` and do the same for the mean, and you get `214.58333333333334` to `552.175`. The outlier stretches the mean's interval far more than the median's.

The percentile bootstrap leans on the sample looking like the population. With a dozen values it tends to come out too narrow, and for the maximum it fails outright, because no resample can go past the largest value you saw.

## Checking coverage

Every recipe here promises 95% coverage, and you can check the promise. Pick a truth, simulate many samples from it, build an interval from each, and count how often the interval contains the truth.

```python
def coverage(n, mult, reps, rng):
    hits = 0
    for _ in range(reps):
        xs = [rng.gauss(10, 2) for _ in range(n)]
        m = sum(xs) / n
        h = mult * statistics.stdev(xs) / math.sqrt(n)
        hits += m - h <= 10 <= m + h
    return hits / reps

print(coverage(5, z, 10000, random.Random(1)))
```

The data are normal with mean 10, and each sample has 5 values. Over 10,000 samples the `z` interval covers `0.881` of the time, well short of 95%. With the t multiplier 2.776 it covers `0.9512`. With 30 values and `z` it covers `0.9392`, close enough that most people use `z` from there on.

Rates work the same way. Take a true rate of 0.05 and 30 trials per sample, where the number of successes `k` is how many of 30 draws of `rng.random() < 0.05` come up true. Seed `random.Random(2)` fresh for each method, and over 10,000 samples Wald covers `0.7738` and Wilson covers `0.9407`. Near 0 or 1, use Wilson.

A simulation has its own error. Coverage over `reps` samples is a proportion, so its standard error is `sqrt(c * (1 - c) / reps)`. For a true 95% over 2,000 reps that is `0.004873397172404482`, so a result anywhere from about 94% to 96% is consistent with 95%. That is why a coverage test checks a band, not an exact value.

```python playground
import math
import random
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)


def mean_ci(xs, mult=Z):
    n = len(xs)
    m = sum(xs) / n
    s = math.sqrt(sum((x - m) ** 2 for x in xs) / (n - 1))
    h = mult * s / math.sqrt(n)
    return m - h, m + h


def wald(k, n):
    p_hat = k / n
    h = Z * math.sqrt(p_hat * (1 - p_hat) / n)
    return p_hat - h, p_hat + h


def wilson(k, n):
    p_hat = k / n
    shrink = 1 + Z**2 / n
    centre = (p_hat + Z**2 / (2 * n)) / shrink
    half = Z / shrink * math.sqrt(p_hat * (1 - p_hat) / n + Z**2 / (4 * n**2))
    return max(0.0, centre - half), min(1.0, centre + half)


rng = random.Random(1)
reps = 2000
for n, mult in ((5, Z), (5, 2.776), (30, Z)):
    hits = 0
    for _ in range(reps):
        lo, hi = mean_ci([rng.gauss(10, 2) for _ in range(n)], mult)
        hits += lo <= 10 <= hi
    print('mean', n, round(mult, 3), hits / reps)

for name, ci in (('wald', wald), ('wilson', wilson)):
    hits = 0
    for _ in range(reps):
        k = sum(rng.random() < 0.05 for _ in range(30))
        lo, hi = ci(k, 30)
        hits += lo <= 0.05 <= hi
    print(name, hits / reps)

# Try: move the true rate from 0.05 toward 0.5, or raise the 30 trials, and watch Wald catch up.
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

#### Uses
- [Confidence intervals & bootstrap › Normal intervals for a mean](#/intervals/normal-intervals-for-a-mean)
- [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)
- [Large numbers & the CLT › Standard error](#/clt/standard-error)

#### Hints
- Check the length and `conf` first, before you divide by anything.
- The mean is `sum(xs) / n`. For `s`, add up the squared distances from the mean, divide by `n - 1`, and take the square root.
- Work out `z` from `conf`, then the half-width `z * s / math.sqrt(n)`, and return the mean minus and plus it.

#### Tips
- `statistics.stdev(xs)` returns the same `s`. Writing it once by hand shows you where the `n - 1` goes.
- With under about 30 values this interval is too narrow. The fix is a t multiplier, which needs scipy or a table.

#### Docs
- [Python docs: `statistics.NormalDist`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist)
- [Python docs: `statistics.stdev`](https://docs.python.org/3/library/statistics.html#statistics.stdev)

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

#### Uses
- [Confidence intervals & bootstrap › Intervals for a rate](#/intervals/intervals-for-a-rate)
- [Confidence intervals & bootstrap › Normal intervals for a mean](#/intervals/normal-intervals-for-a-mean)

#### Hints
- Validate `n` and `k` before computing `k / n`, so `n` of 0 never reaches the division.
- `z**2 / n` shows up in both the centre and the half-width. Compute it once.
- Build the centre and the half-width from the two formulas, then clamp with `max(0.0, ...)` and `min(1.0, ...)`.

#### Tips
- The clamp matters at 0 of `n`: the lower bound is 0 in exact arithmetic, but floats can land a hair below it.
- Wilson's centre is not `p_hat`. It sits between `p_hat` and one half, and the pull fades as `n` grows.

#### Docs
- [Python docs: `statistics.NormalDist.inv_cdf`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist.inv_cdf)
- [Wilson (1927), Probable inference, the law of succession, and statistical inference](https://doi.org/10.1080/01621459.1927.10502953)

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

#### Uses
- [Confidence intervals & bootstrap › The bootstrap](#/intervals/the-bootstrap)
- [Describing data › Percentiles and quartiles](#/describing/percentiles-and-quartiles)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- One resample is a list of `n` values, each `xs[int(rng.random() * n)]`. Draw the indices in order, one call each, or the seeded answers will not match.
- Collect the `B` means in a list and sort it once at the end.
- For a share `q`, the position is `(B - 1) * q`. Take the sorted values at the whole part and the next index, and move between them by the fractional part. Guard the top end, where there is no next index.

#### Tips
- For the 95% case, the first and last cut points of `statistics.quantiles(means, n=40, method='inclusive')` are the same two percentiles, up to float rounding.
- Swap `sum(resample) / n` for `statistics.median(resample)` and you have an interval for the median, with no new formula.

#### Docs
- [Python docs: `statistics.quantiles`](https://docs.python.org/3/library/statistics.html#statistics.quantiles)
- [Efron (1979), Bootstrap methods: another look at the jackknife](https://doi.org/10.1214/aos/1176344552)

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

#### Uses
- [Confidence intervals & bootstrap › Checking coverage](#/intervals/checking-coverage)
- [Confidence intervals & bootstrap › What an interval claims](#/intervals/what-an-interval-claims)

#### Hints
- One rep is three steps: build a sample of `n` draws, ask `ci_fn` for `(lo, hi)`, and check whether the truth sits inside.
- Pass the same `rng` to every `draw` call, so one seed fixes the whole run.
- Keep a count of the reps that cover, and divide by `reps` at the end. Check `reps` before the loop.

#### Tips
- Coverage is itself an estimate from a simulation. With 2,000 reps a true 95% shows up anywhere from about 94% to 96%.
- Test a recipe at the sizes you will use it at. An interval that covers 95% with 100 values can cover far less with 5.

#### Docs
- [Python docs: `random.Random`](https://docs.python.org/3/library/random.html)
