# Large numbers & the CLT

Why averages settle, how fast, why their spread follows sigma / sqrt(n), and when they never settle at all.

## The law of large numbers

Take the mean of more and more draws and it moves toward the true mean. Here the draws are uniform on `[0, 1)`, whose true mean is 0.5:

```python
import random

rng = random.Random(3)
xs = [rng.random() for _ in range(10000)]
for n in (10, 100, 1000, 10000):
    print(n, round(sum(xs[:n]) / n, 4))
```

The means of the first 10, 100, 1,000 and 10,000 draws are `0.3792`, `0.5411`, `0.4965` and `0.5005`, rounded to four places. They do not shrink in a straight line. The mean at 100 draws is further off than the mean at 1,000. What the law of large numbers promises is that the mean ends up as close as you like to the true mean if you wait long enough. It needs the true mean to exist. The last section shows a case where it does not.

## The sampling distribution

One mean is one sample. Repeat the experiment many times and keep each mean, and you get a list of means that has its own center and its own spread. That list is the sampling distribution of the mean. Here is a helper that builds it, with the same shape as the first exercise below:

```python
import statistics

def sample_means(draw, n, reps, rng):
    return [sum(draw(rng) for _ in range(n)) / n for _ in range(reps)]

rng = random.Random(1)
means = sample_means(lambda r: r.random(), 25, 2000, rng)
print(round(statistics.fmean(means), 4), round(statistics.stdev(means), 4))
```

This prints `0.5001 0.0571`. The 2,000 means of 25 draws center on the true mean, 0.5, and spread by about 0.057. A single uniform draw spreads by `sqrt(1 / 12)`, which is `0.2887`. The mean of 25 draws spreads by about five times less, and 5 is `sqrt(25)`.

## Standard error

The spread of the sampling distribution has a name, the standard error. For the mean of `n` draws from a population with standard deviation `sigma`:

```
SE = sigma / sqrt(n)
```

Check it against the simulation. Run the loop below and compare the two columns:

```python
import math

rng = random.Random(1)
for n in (25, 100, 400):
    means = sample_means(lambda r: r.random(), n, 2000, rng)
    print(n, round(statistics.stdev(means), 4), round(math.sqrt(1 / 12) / math.sqrt(n), 4))
```

The rows are `25 0.0571 0.0577`, `100 0.0294 0.0289` and `400 0.0139 0.0144`. Each time `n` grows by four, the error halves. Four times the data buys half the error, which is the rule of thumb from [Running proportions](#/samples/running-proportions) made exact.

You rarely know `sigma`. Replace it with the sample standard deviation `s`, the one that divides by `n - 1` (see [Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)), and `s / sqrt(n)` is the estimated standard error. For `[3.1, 2.7, 4.0, 3.6, 2.9]` the mean is `3.26`, `statistics.stdev` gives `0.532`, and the standard error is `0.2379`. The standard library has `statistics.stdev`, so you only divide by `math.sqrt(len(xs))`.

You can turn the formula around. To have a margin of error `m` at a confidence level with normal quantile `z`, you need `n` of at least `(z * sigma / m) ** 2`. For 95% confidence `z` is `NormalDist().inv_cdf(0.975)`, which is `1.96`. With `sigma = 15` and `m = 2` the product is `216.082`, so `math.ceil` gives `217` draws. Cut the margin to 1 and the answer is `865`, about four times as many.

## The central limit theorem

The sampling distribution has a spread. The central limit theorem says it also has a shape: for large `n`, the mean of `n` draws is close to normally distributed, whatever distribution the draws come from, as long as that distribution has a finite variance. Exponential waits are lopsided, with a mean of 1 and a long right tail. Their means are not. Here are 2,000 means of 30 exponential draws:

```python
rng = random.Random(7)
means = sample_means(lambda r: r.expovariate(1.0), 30, 2000, rng)
print(round(statistics.fmean(means), 3), round(statistics.stdev(means), 4))
```

The mean of the means is `0.995` and their spread is `0.1842`, against the `1 / sqrt(30) = 0.1826` the standard error formula predicts. Group the means into bins of width 0.1 and print one `#` for every 10 of them, and the bell shape shows:

```
 0.5 #
 0.6 #######
 0.7 ##################
 0.8 ####################################
 0.9 ###########################################
 1.0 ####################################
 1.1 #############################
 1.2 ###############
 1.3 ######
 1.4 ###
```

It leans a little to the right, because 30 draws is not infinity. Raise `n` and the lean goes away. 95.05% of these means land within `1.96` standard errors of their center, close to the 95% a [normal distribution](#/distributions/the-normal-distribution) gives. This is why a confidence interval built from a mean works even when the data is not normal.

## When averages do not settle

Both results above need something from the source: a mean for the law of large numbers, a finite variance for the CLT. Heavy tails can break that. The Cauchy distribution has tails so heavy that its mean does not exist. You draw from it with `math.tan(math.pi * (u - 0.5))`, where `u` is uniform:

```python
import math

rng = random.Random(21)
xs = [math.tan(math.pi * (rng.random() - 0.5)) for _ in range(20000)]
total = 0
for i, x in enumerate(xs, 1):
    total += x
    if i in (100, 1000, 10000, 20000):
        print(i, round(total / i, 4), round(statistics.median(xs[:i]), 4))
```

Each row is the draw count, the running mean and the running median: `100 1.6044 -0.0101`, `1000 0.3857 0.0029`, `10000 -0.841 -0.0158` and `20000 16.0312 0.0015`. The median sits near 0 from the start. The mean does not settle: after 20,000 draws a single huge value pushed it to 16. Between draw 10,000 and draw 20,000 the running mean ranged from `-0.8437` to `29.5550`. More data does not help, because one extreme draw can outweigh all the others. When the data has heavy tails, report the median, or a trimmed mean, instead.

```python playground
import math
import random
import statistics


def sample_means(draw, n, reps, rng):
    return [sum(draw(rng) for _ in range(n)) / n for _ in range(reps)]


# The sampling distribution: the spread of the mean shrinks like 1 / sqrt(n).
rng = random.Random(1)
for n in (25, 100, 400):
    means = sample_means(lambda r: r.random(), n, 2000, rng)
    print(n, round(statistics.stdev(means), 4), round(math.sqrt(1 / 12) / math.sqrt(n), 4))

# The CLT: means of exponential draws, which are lopsided, look like a bell.
rng = random.Random(7)
means = sample_means(lambda r: r.expovariate(1.0), 30, 2000, rng)
lo, width = 0.4, 0.1
counts = [0] * 14
for v in means:
    i = int((v - lo) / width)
    if 0 <= i < 14:
        counts[i] += 1
for i, c in enumerate(counts):
    print(f'{lo + i * width:4.1f} ' + '#' * (c // 10))

# Cauchy draws: the running median settles, the running mean does not.
rng = random.Random(21)
xs = [math.tan(math.pi * (rng.random() - 0.5)) for _ in range(20000)]
for i in (100, 1000, 10000, 20000):
    print(i, round(sum(xs[:i]) / i, 4), round(statistics.median(xs[:i]), 4))

# Try: swap in rng.random() for the exponential draw, or change n.
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

#### Uses
- [Large numbers & the CLT › Standard error](#/clt/standard-error)
- [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)

#### Hints
- `standard_error` is one line: `sigma` divided by `math.sqrt(n)`. Check `n` first.
- For `standard_error_of`, find the mean, then add up the squared distances from it.
- Divide that sum by `len(xs) - 1`, not `len(xs)`, and take the square root. That is the sample standard deviation.
- Divide the standard deviation by `math.sqrt(len(xs))`. Check `len(xs) < 2` before any division.

#### Tips
- `statistics.stdev(xs)` is the same n - 1 standard deviation. Write it by hand once, then use the library.
- With one value there is no spread to measure, which is why fewer than 2 values is an error.

#### Docs
- [Python docs: `statistics.stdev`](https://docs.python.org/3/library/statistics.html#statistics.stdev)
- [Python docs: `math.sqrt`](https://docs.python.org/3/library/math.html#math.sqrt)

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

#### Uses
- [Large numbers & the CLT › The sampling distribution](#/clt/the-sampling-distribution)
- [Random variables › Sums of random variables](#/random-variables/sums-of-random-variables)

#### Hints
- One mean is `sum(draw(rng) for _ in range(n)) / n`.
- Build the outer list with a comprehension that repeats that `reps` times.
- Validate `n` and `reps` before the first draw.
- The order of draws matters: do not generate all the values first and then reshape them differently. A nested comprehension draws them in the order the test expects.

#### Tips
- Pass `rng` through to `draw` instead of creating a generator inside, so one seed controls the whole run.
- Compare `statistics.stdev` of the result with `standard_error(sigma, n)` from the first exercise.

#### Docs
- [Python docs: `statistics.fmean`](https://docs.python.org/3/library/statistics.html#statistics.fmean)

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


def test_exact_z():
    """z comes from the inverse normal CDF, not a rounded 1.96 or a table"""
    assert n_for_margin(100, 1) == 38415
    assert n_for_margin(100, 1, 0.975) == 50239


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

#### Uses
- [Large numbers & the CLT › Standard error](#/clt/standard-error)
- [Common distributions › The normal distribution](#/distributions/the-normal-distribution)

#### Hints
- Check `margin` and `conf` first, and raise `ValueError` before you compute anything.
- `NormalDist().inv_cdf(q)` returns the value with area `q` below it. For a two-sided level you want `q = 1 - (1 - conf) / 2`.
- Solve `z * sigma / sqrt(n) <= margin` for `n`: `sqrt(n)` must be at least `z * sigma / margin`, so `n` must be at least that value squared.
- Round up with `math.ceil`, because a sample of 216.08 is not a sample size.

#### Tips
- Rounding down would leave the margin slightly too big, so the answer is always the ceiling.
- Halving `margin` multiplies the result by about 4, as the standard error formula says.

#### Docs
- [Python docs: `statistics.NormalDist.inv_cdf`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist.inv_cdf)
- [Python docs: `math.ceil`](https://docs.python.org/3/library/math.html#math.ceil)

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

#### Uses
- [Large numbers & the CLT › The law of large numbers](#/clt/the-law-of-large-numbers)
- [Large numbers & the CLT › When averages do not settle](#/clt/when-averages-do-not-settle)

#### Hints
- Keep a running total and divide it by how many values you have added so far.
- `enumerate(xs, 1)` gives that count along with each value.
- `cauchy` is one expression, and it must call `rng.random()` once.
- To see the effect, run `running_means` on a few thousand Cauchy draws and on the same number of `rng.random()` draws, then compare the last stretch of each.

#### Tips
- A single huge Cauchy draw can drag the running mean far from 0, and it takes a very long time to wash out.
- The median of the same draws stays near 0. Use it when the data has heavy tails.

#### Docs
- [Python docs: `enumerate`](https://docs.python.org/3/library/functions.html#enumerate)
- [Python docs: `statistics.median`](https://docs.python.org/3/library/statistics.html#statistics.median)
