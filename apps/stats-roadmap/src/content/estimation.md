# Likelihood & estimation

Pick the parameter that makes your data most likely, work in logs to stay finite, and see why variance divides by n - 1.

## Estimators

An estimator is a rule that turns a sample into a guess at a population value. The sample mean is an estimator of the population mean. Two questions tell you how good a rule is. Bias: if you could repeat the sample forever, does the average of the guesses land on the truth? Spread: how much do the guesses vary from sample to sample?

Take the top of a uniform range. The truth is 1. Each sample is 5 draws from `[0, 1)`. One rule says the top is the biggest draw. Another scales that up by `6 / 5`:

```python
import random
import statistics

rng = random.Random(4)
biggest = [max(rng.random() for _ in range(5)) for _ in range(5000)]
scaled = [m * 6 / 5 for m in biggest]
for name, est in (('max', biggest), ('scaled', scaled)):
    print(name, round(statistics.fmean(est), 4), round(statistics.stdev(est), 4))
```

The output is `max 0.8342 0.1414` and `scaled 1.0011 0.1697`. The biggest draw is always at most the truth, so on average it falls short: its bias is `0.8342 - 1 = -0.1658`. The scaled rule has a bias of `0.0011`, which is noise. It pays for that with more spread, `0.1697` against `0.1414`. A smaller bias does not always mean a smaller error.

## Likelihood

Say you flipped a coin 10 times and saw 7 heads, and you want to know its heads rate `p`. For any `p` you can ask how probable these exact flips would have been. For `k` heads in `n` flips that is:

```
L(p) = p^k * (1 - p)^(n - k)
```

This is the likelihood of `p`. It is a function of the parameter, with the data held fixed:

```python
k, n = 7, 10
for p in (0.3, 0.5, 0.7):
    print(p, round(p ** k * (1 - p) ** (n - k), 6))
```

This prints `0.3 7.5e-05`, `0.5 0.000977` and `0.7 0.002224`. A rate of 0.7 makes seven heads about 30 times more likely than a rate of 0.3 does. A likelihood is not the probability that `p` is right. The values do not add up to 1 over `p`. Only the comparison between them means anything.

## Log-likelihood

Real data has thousands of flips, and a product of thousands of probabilities falls below the smallest float. `0.5 ** 1100` prints `0.0`, even though the real number is not zero. Sum logs instead of multiplying, because `ln(a * b) = ln(a) + ln(b)`:

```
log L(p) = k * ln(p) + (n - k) * ln(1 - p)
```

For 7 heads in 10 flips, `7 * math.log(0.7) + 3 * math.log(0.3)` is `-6.1086`. For 1,100 flips that all have probability 0.5, the log is `1100 * math.log(0.5)`, which is `-762.4619`: a fine, ordinary float. Because the log goes up when the likelihood goes up, the best `p` is the same either way.

Watch the edges. `math.log(0)` raises `ValueError: math domain error`. An impossible flip, such as a head when `p` is 0, should give minus infinity, which is the log of 0 in float terms. Check for it yourself and return `-math.inf`.

## Maximum likelihood

The maximum likelihood estimate, or MLE, is the parameter with the highest likelihood. You can find it with no theory at all, by trying a grid of values and keeping the best:

```python
import math

flips = [1, 1, 1, 0, 1, 0, 1, 1, 0, 1]
k, n = sum(flips), len(flips)
grid = [i / 1000 for i in range(1, 1000)]
print(max(grid, key=lambda p: k * math.log(p) + (n - k) * math.log(1 - p)))
```

This prints `0.7`. That is the number of 1s over the number of flips, `k / n`. For a Bernoulli rate the grid and the formula agree, and the formula is the answer to remember. Two more results, stated here without proof and checked by the exercises and your own experiments. For a normal distribution, the MLE of the mean is the sample mean. The MLE of its variance divides the squared deviations by `n`, not `n - 1`. For `[3.1, 2.7, 4.0, 3.6, 2.9]` the mean is `3.26`, and dividing by `n` gives `0.2264`, which is `statistics.pvariance`. Dividing by `n - 1` gives `0.283`, which is `statistics.variance`. The last section shows which is better.

## Working in logs

Log-likelihoods are often added up inside a bigger calculation, and sometimes you need the log of a sum of likelihoods: `log(exp(a) + exp(b) + ...)`. The direct way breaks. `math.exp(1000)` raises `OverflowError: math range error`, and `math.exp(-1000)` underflows to `0.0`, so the log of the sum fails with a domain error.

Pull out the largest value `m` first:

```
logsumexp(xs) = m + ln(sum(exp(x - m)))    with m = max(xs)
```

Every `x - m` is 0 or less, so nothing overflows, and the biggest term is `exp(0) = 1`, so the sum is at least 1 and never underflows. The result is the same as the direct formula wherever the direct formula works:

```python
def logsumexp(xs):
    m = max(xs)
    return m + math.log(sum(math.exp(x - m) for x in xs))

print(logsumexp([1, 2, 3]), logsumexp([1000, 1000]), logsumexp([-1000, -1000]))
```

This prints `3.4076059644443806 1000.6931471805599 -999.3068528194401`. The last two are `1000 + ln 2` and `-1000 + ln 2`, which are right and could not be computed the direct way. In numpy and scipy this function is `scipy.special.logsumexp`.

## Bias of the variance

Divide the squared deviations from the sample mean by `n` and the result is too small on average. The sample mean sits closer to the sample's own values than the true mean does, so the deviations from it are a bit too small. The shortfall has a clean size: on average the divide-by-`n` estimate is `(n - 1) / n` times the true variance. Dividing by `n - 1` fixes it.

Check it on uniform draws, whose true variance is `1 / 12 = 0.0833`. With samples of 5, the divide-by-`n` estimate should average `4 / 5` of that, `0.0667`:

```python
def simulate_bias(n, reps, rng):
    a = b = 0.0
    for _ in range(reps):
        xs = [rng.random() for _ in range(n)]
        m = sum(xs) / n
        ss = sum((x - m) ** 2 for x in xs)
        a += ss / n
        b += ss / (n - 1)
    return a / reps, b / reps

print(simulate_bias(5, 4000, random.Random(5)))
```

The two averages are `0.0665` and `0.0831`, rounded to four places. The first is close to `0.0667` and the second is close to `0.0833`. Their ratio is exactly `0.8`, because both use the same squared deviations and differ only by the factor `n / (n - 1)`. The fix is called Bessel's correction, and `statistics.variance` and `statistics.stdev` use it. The correction matters most for small samples. At `n = 100` the factor is 0.99.

```python playground
import math
import random
import statistics


# Bias and spread of two estimators of the top of a uniform range (truth: 1).
rng = random.Random(4)
biggest = [max(rng.random() for _ in range(5)) for _ in range(5000)]
scaled = [m * 6 / 5 for m in biggest]
for name, est in (('max', biggest), ('scaled', scaled)):
    print(name, round(statistics.fmean(est), 4), round(statistics.stdev(est), 4))

# Likelihood for 7 heads in 10 flips, and the grid-search MLE.
k, n = 7, 10
for p in (0.3, 0.5, 0.7):
    print(p, round(p ** k * (1 - p) ** (n - k), 6))
grid = [i / 1000 for i in range(1, 1000)]
print(max(grid, key=lambda p: k * math.log(p) + (n - k) * math.log(1 - p)))
print(0.5 ** 1100, round(1100 * math.log(0.5), 4))


def logsumexp(xs):
    m = max(xs)
    return m + math.log(sum(math.exp(x - m) for x in xs))


print(logsumexp([1, 2, 3]), logsumexp([1000, 1000]), logsumexp([-1000, -1000]))


# Dividing by n versus n - 1.
def simulate_bias(n, reps, rng):
    a = b = 0.0
    for _ in range(reps):
        xs = [rng.random() for _ in range(n)]
        m = sum(xs) / n
        ss = sum((x - m) ** 2 for x in xs)
        a += ss / n
        b += ss / (n - 1)
    return a / reps, b / reps


print(simulate_bias(5, 4000, random.Random(5)))
data = [3.1, 2.7, 4.0, 3.6, 2.9]
print(statistics.pvariance(data), statistics.variance(data))

# Try: change 5 to 20 in simulate_bias and watch the two averages move together.
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

#### Uses
- [Likelihood & estimation › Log-likelihood](#/estimation/log-likelihood)
- [Likelihood & estimation › Likelihood](#/estimation/likelihood)

#### Hints
- Check `p` against 0 and 1 first and raise `ValueError` outside that range.
- Walk the flips. A 1 has probability `p`, a 0 has probability `1 - p`.
- If that probability is exactly 0, stop and return `-math.inf`. Calling `math.log(0)` would raise.
- Otherwise add `math.log(q)` to a running total that starts at `0.0`. An empty list never enters the loop and returns `0.0`.

#### Tips
- Adding logs of many probabilities stays finite where multiplying them would underflow to `0.0`.
- Check the impossible flip before taking the log, not after. The log of 0 is the error you are avoiding.

#### Docs
- [Python docs: `math.log`](https://docs.python.org/3/library/math.html#math.log)
- [Python docs: `math.inf`](https://docs.python.org/3/library/math.html#math.inf)

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

#### Uses
- [Likelihood & estimation › Maximum likelihood](#/estimation/maximum-likelihood)
- [Likelihood & estimation › Log-likelihood](#/estimation/log-likelihood)

#### Hints
- Raise `ValueError` for an empty list. Then count the 1s once as `k` and the flips as `n`.
- The log-likelihood of a `p` is `k * math.log(p) + (n - k) * math.log(1 - p)`. You do not need to loop over the flips for each `p`.
- Loop `i` from 1 to `steps - 1`, compute `p = i / steps`, and keep the best `p` so far.
- Replace the best only when the new value is strictly higher. Then a tie keeps the smaller `p`, which came first.
- `closed_form_mle` is `sum(flips) / len(flips)`.

#### Tips
- A strict `>` comparison is what makes ties go to the smaller `p`.
- The grid never reaches 0 or 1, so the logs never see 0. All-ones data lands on the last grid point.

#### Docs
- [Python docs: `math.log`](https://docs.python.org/3/library/math.html#math.log)

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

#### Uses
- [Likelihood & estimation › Working in logs](#/estimation/working-in-logs)

#### Hints
- Return `-math.inf` for an empty list.
- Find `m = max(xs)`. If `m` is minus infinity, every value is, so return `-math.inf`.
- Subtract `m` from each value before calling `math.exp`. Then no value is above 0.
- Add `m` back to the log of the sum.

#### Tips
- `exp(-math.inf)` is `0.0` in Python, so a minus infinity in the list simply drops out of the sum.
- Without the subtraction `math.exp(1000)` raises `OverflowError`, and `[-1000, -1000]` underflows to a log of 0.

#### Docs
- [Python docs: `math.exp`](https://docs.python.org/3/library/math.html#math.exp)
- [Python docs: `max`](https://docs.python.org/3/library/functions.html#max)

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

#### Uses
- [Likelihood & estimation › Bias of the variance](#/estimation/bias-of-the-variance)
- [Likelihood & estimation › Estimators](#/estimation/estimators)
- [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)

#### Hints
- Raise `ValueError` first when `n < 2`.
- Each repetition draws `n` values with `rng.random()` and finds their mean.
- The sum of squared deviations from that mean is shared by both estimates. Divide it once by `n` and once by `n - 1`.
- Keep two running totals, one per estimate, and divide each by `reps` at the end. Return them as a tuple.

#### Tips
- Because both estimates use the same sum, their ratio is always `(n - 1) / n`, whatever the draws.
- Use `statistics.pvariance` and `statistics.variance` to check one repetition by hand.

#### Docs
- [Python docs: `statistics.variance`](https://docs.python.org/3/library/statistics.html#statistics.variance)
- [Python docs: `statistics.pvariance`](https://docs.python.org/3/library/statistics.html#statistics.pvariance)
