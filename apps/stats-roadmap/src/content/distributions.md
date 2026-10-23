# Common distributions

The binomial, Poisson, exponential and normal distributions, and the questions each one answers.

## Binomial counts

Run `n` independent trials, each succeeding with probability `p`, and count the successes. That count follows a binomial distribution. Ten fair coin flips, counting heads, is `n = 10`, `p = 0.5`.

The probability of exactly `k` successes has three parts. Choose which `k` of the `n` trials succeed, which can be done in `math.comb(n, k)` ways. Each success has probability `p`, and each failure `1 - p`:

```
P(X = k) = comb(n, k) * p^k * (1 - p)^(n - k)
```

```python
import math

n, p = 10, 0.5
pmf = [math.comb(n, k) * p**k * (1 - p)**(n - k) for k in range(n + 1)]
print(round(pmf[3], 9), sum(pmf))
```

This prints `0.1171875 1.0`. `comb(10, 3)` is 120, and `0.5**10` is `1/1024`, so the answer is `120/1024`. The probabilities over all `k` add to 1, as they must. Compute the mean and variance from the table, as in [Random variables › Expected value and variance](#/random-variables/expected-value-and-variance), and you get `5.0` and `2.5`. They match the closed forms:

```
mean     = n * p            = 10 * 0.5       = 5.0
variance = n * p * (1 - p)  = 10 * 0.5 * 0.5 = 2.5
```

Outside the range `0..n` the probability is 0. Ask for the chance of 11 heads in 10 flips and the answer is `0.0`, not an error. The probability of at most `k` successes, the cdf, is the sum of the pmf from 0 to `k`.

## Poisson rates

Count events in a fixed window when they arrive independently at an average rate `lam` per window: requests per minute, errors per hour. That count follows a Poisson distribution:

```
P(X = k) = exp(-lam) * lam^k / k!
```

Its mean and its variance are both `lam`. A rate of 2 per window gives `P(X = 3) = 0.180447044`, rounded to nine places.

Big `k` breaks the formula as written. `150.0 ** 200` overflows a float, and so does `math.factorial(200)` once you convert it. Work in logs, where the huge terms become sums of moderate ones: `math.lgamma(k + 1)` is `log(k!)`, so

```python
def poisson_pmf(k, lam):
    return math.exp(k * math.log(lam) - lam - math.lgamma(k + 1))

print(poisson_pmf(200, 150.0))
```

prints `1.5038027878284683e-05` with no error. Building the term iteratively, each from the one before it with `p_k = p_(k-1) * lam / k`, works too.

Alerts need the upper tail. The chance of seeing at least `k` events is `P(X >= k) = 1 - P(X <= k - 1)`. If the normal rate is 4 per window and you alert on 10 or more, the false alarm rate is `P(X >= 10) = 0.008132`. Alert on 9 and it is `0.021363`. To keep false alarms at or below 1% you set the threshold at 10, the smallest `k` whose tail is at most 0.01.

Computing a tail as `1 - sum` loses digits when the tail is tiny, because it subtracts two numbers close to 1. Down to about `1e-12` that is fine. Below it, add up the upper terms directly instead.

## Exponential waits

If events arrive as a Poisson process with rate `lam`, the wait between two events is exponential, with mean `1 / lam`. A rate of 2 per minute means a wait of half a minute on average.

You can draw a wait from a uniform random number with the inverse transform. Take `u = rng.random()`, which is in `[0, 1)`, and compute

```
wait = -ln(1 - u) / lam
```

`1 - u` is in `(0, 1]`, so the log is always defined. Using exactly one `rng.random()` per wait keeps the sequence reproducible.

```python
import random

rng = random.Random(1)
waits = [-math.log(1 - rng.random()) / 2.0 for _ in range(10000)]
print(round(waits[0], 9), round(sum(waits) / len(waits), 4))
```

This prints `0.072145532 0.4998`. The first wait is 0.07 minutes, and the mean of 10,000 waits is `0.4998`, close to `1 / 2.0 = 0.5`.

The exponential has one odd property: it is memoryless. A wait that has already lasted one minute is no more likely to end soon than a fresh one. Among the waits above that exceeded 1.0, the share that exceeded 1.5 was `0.3788`. The share of all waits above 0.5 was `0.3641`. The exact value for both is `exp(-1) = 0.3679`. There is no "due" event in a Poisson process.

## The normal distribution

The normal distribution is the bell curve. It has two parameters, the mean `mu` and the standard deviation `sigma`. The standard library has it as `statistics.NormalDist(mu, sigma)`, with `pdf` for the density, `cdf` for the probability of being at or below a value, `inv_cdf` for the reverse, and `zscore`:

```
z = (x - mu) / sigma
```

A score of 130 on a scale with `mu = 100` and `sigma = 15` is two standard deviations up, `z = 2.0`. Its percentile is `NormalDist(100, 15).cdf(130)`, which is `0.977249868`. About 97.7% of the population is below it.

The 68-95-99.7 rule says how much falls within 1, 2 and 3 standard deviations of the mean. Computed from the cdf and rounded to four places, they are `0.6827`, `0.9545` and `0.9973`. Going the other way, `NormalDist().inv_cdf(0.975)` is `1.959963985`, about 1.96. That is where the familiar 95% interval comes from, because 2.5% is left in each tail.

A `sigma` of 0 or below is not a normal distribution. `NormalDist` raises an error for it, and your own functions should raise `ValueError`.

```python playground
import math
import random
from statistics import NormalDist

n, p = 10, 0.5
pmf = [math.comb(n, k) * p**k * (1 - p)**(n - k) for k in range(n + 1)]
mean = sum(k * q for k, q in enumerate(pmf))
var = sum((k - mean)**2 * q for k, q in enumerate(pmf))
print('binomial', round(pmf[3], 9), sum(pmf), mean, var)


def poisson_pmf(k, lam):
    return math.exp(k * math.log(lam) - lam - math.lgamma(k + 1))


print('poisson', round(poisson_pmf(3, 2.0), 9), poisson_pmf(200, 150.0))
for k in (9, 10):
    print('P(X >=', k, ') =', round(1 - sum(poisson_pmf(i, 4.0) for i in range(k)), 6))

rng = random.Random(1)
waits = [-math.log(1 - rng.random()) / 2.0 for _ in range(10000)]
print('waits', round(waits[0], 9), round(sum(waits) / len(waits), 4))

d = NormalDist(100, 15)
print('normal', round(d.cdf(130), 9), round(NormalDist().inv_cdf(0.975), 9), d.zscore(130))

# Try: change the Poisson rate and see where the 1% threshold moves.
```

## Exercises

### 1. Binomial PMF

Write `binom_pmf(k, n, p)`, the probability of exactly `k` successes in `n` trials, as `math.comb(n, k) * p ** k * (1 - p) ** (n - k)`. Return `0.0` when `k < 0` or `k > n`. Write `binom_cdf(k, n, p)`, the probability of `k` successes or fewer: the sum of `binom_pmf(i, n, p)` for `i` from 0 to `k`. It is `0.0` for `k < 0` and `1.0` once `k >= n`. The cases `p = 0` and `p = 1` must work with no special code beyond that.

```python starter
import math


def binom_pmf(k, n, p):
    ...


def binom_cdf(k, n, p):
    ...
```

```python test
def test_pmf():
    """exact counts"""
    assert round(binom_pmf(3, 10, 0.5), 9) == 0.1171875
    assert round(binom_pmf(2, 5, 0.3), 9) == 0.3087


def test_cdf():
    """probability of k or fewer"""
    assert round(binom_cdf(3, 10, 0.5), 9) == 0.171875
    assert round(binom_cdf(2, 6, 0.4), 9) == 0.54432
    assert round(binom_cdf(10, 5, 0.3), 9) == 1.0
    assert binom_cdf(-1, 5, 0.3) == 0.0


def test_out_of_range():
    """k outside 0 to n has probability 0"""
    assert binom_pmf(-1, 5, 0.3) == 0.0
    assert binom_pmf(6, 5, 0.3) == 0.0


def test_certain_cases():
    """p of 0 and p of 1"""
    assert binom_pmf(0, 4, 0.0) == 1.0
    assert binom_pmf(2, 4, 0.0) == 0.0
    assert binom_pmf(4, 4, 1.0) == 1.0
    assert binom_pmf(3, 4, 1.0) == 0.0
```

#### Uses
- [Common distributions › Binomial counts](#/distributions/binomial-counts)
- [Random variables › Expected value and variance](#/random-variables/expected-value-and-variance)

#### Hints
- Return `0.0` for out-of-range `k` first. Then the formula is one line.
- `math.comb(n, k)` is the number of ways to choose which trials succeed.
- For the cdf, add up `binom_pmf(i, n, p)` for `i` in `range(0, k + 1)`.
- Cap the loop at `n`, so a `k` above `n` stops adding terms and the total stays at 1.

#### Tips
- `0.0 ** 0` is `1.0` in Python, which is what makes the `p = 0` case come out right.
- To compare floats in a test, round them. A cdf summed term by term can differ from the true value in the last digit.

#### Docs
- [Python docs: `math.comb`](https://docs.python.org/3/library/math.html#math.comb)

### 2. Poisson tail for alerts

Write `poisson_pmf(k, lam)`, `poisson_tail(k, lam)` and `alert_threshold(lam, max_false_alarm)`. `poisson_pmf` is `exp(-lam) * lam ** k / k!`, and it must not overflow: `poisson_pmf(200, 150.0)` has to return a float, so compute it with `math.lgamma` or build it term by term. It is `0.0` for `k < 0`. `poisson_tail(k, lam)` is `P(X >= k)`, which is `1 - sum of poisson_pmf(i, lam) for i < k`, and `1.0` for `k <= 0`. `alert_threshold` returns the smallest integer `k` with `poisson_tail(k, lam) <= max_false_alarm`. Raise `ValueError` if `lam <= 0`, and also if `max_false_alarm` is not strictly between 0 and 1. The tests use tails above `1e-5`, where `1 - sum` keeps enough digits.

```python starter
import math


def poisson_pmf(k, lam):
    ...


def poisson_tail(k, lam):
    ...


def alert_threshold(lam, max_false_alarm):
    ...
```

```python test
def test_pmf():
    """small terms, and a big k that must not overflow"""
    assert f'{poisson_pmf(0, 2.0):.9g}' == '0.135335283'
    assert f'{poisson_pmf(3, 2.0):.9g}' == '0.180447044'
    assert f'{poisson_pmf(10, 4.0):.9g}' == '0.00529247668'
    assert f'{poisson_pmf(200, 150.0):.9g}' == '1.50380279e-05'
    assert poisson_pmf(-1, 2.0) == 0.0


def test_tail():
    """probability of k or more events"""
    assert f'{poisson_tail(5, 2.0):.9g}' == '0.0526530173'
    assert f'{poisson_tail(1, 3.0):.9g}' == '0.950212932'
    assert poisson_tail(0, 2.0) == 1.0
    assert poisson_tail(-3, 2.0) == 1.0


def test_thresholds():
    """smallest k whose tail is at most the allowed rate"""
    assert alert_threshold(4.0, 0.01) == 10
    assert alert_threshold(10.0, 0.001) == 22
    assert alert_threshold(2.0, 0.05) == 6
    assert alert_threshold(20.0, 0.01) == 32


def test_bad_inputs():
    """a rate of 0 or a rate limit outside 0 to 1 raises"""
    for call in (lambda: poisson_pmf(1, 0.0), lambda: poisson_tail(1, -1.0),
                 lambda: alert_threshold(0.0, 0.01), lambda: alert_threshold(4.0, 0.0)):
        try:
            call()
        except ValueError:
            pass
        else:
            raise AssertionError('a bad rate should have raised ValueError')
    for bad in (1.0, 1.5):
        try:
            alert_threshold(4.0, bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f'max_false_alarm of {bad} should have raised ValueError')
```

#### Uses
- [Common distributions › Poisson rates](#/distributions/poisson-rates)
- [Random variables › Expected value and variance](#/random-variables/expected-value-and-variance)

#### Hints
- `lam ** k` overflows for large `k`, so work in logs: `log(pmf) = k * log(lam) - lam - lgamma(k + 1)`, then `exp` it.
- The tail is one minus the pmf summed over `i` in `range(k)`.
- Guard `k <= 0` before summing, so the tail is exactly `1.0`.
- For `alert_threshold`, start at `k = 0` and count up while the tail is still above `max_false_alarm`. Return the first `k` that is at or below it.

#### Tips
- `1 - sum` subtracts two numbers near 1, so a tail below about `1e-12` is mostly rounding noise. For those, sum the upper terms `pmf(k) + pmf(k + 1) + ...` until they are negligible.
- A float 0.0 for the tail is a real answer for a tiny tail, but it can hide how small it is. Say which you want before you trust it in an alert.

#### Docs
- [Python docs: `math.lgamma`](https://docs.python.org/3/library/math.html#math.lgamma)

### 3. Exponential waits

Write `exp_wait(lam, rng)`, which returns one wait drawn by the inverse transform: `-math.log(1 - rng.random()) / lam`. Call `rng.random()` exactly once per call. Raise `ValueError` if `lam <= 0`.

```python starter
import math


def exp_wait(lam, rng):
    ...
```

```python test
import random


def test_first_waits():
    """the first three waits for a seed"""
    rng = random.Random(1)
    got = [exp_wait(2.0, rng) for _ in range(3)]
    assert [round(v, 9) for v in got] == [0.072145532, 0.940078133, 0.721484463]


def test_one_draw():
    """each call uses exactly one random number"""
    rng = random.Random(5)
    exp_wait(1.0, rng)
    ref = random.Random(5)
    ref.random()
    assert rng.getstate() == ref.getstate()


def test_mean_wait():
    """the mean of many waits is close to 1 over the rate"""
    rng = random.Random(7)
    waits = [exp_wait(0.5, rng) for _ in range(20000)]
    mean = sum(waits) / len(waits)
    assert 1.94 < mean < 2.06


def test_bad_rate():
    """a rate of 0 or below raises ValueError"""
    for lam in (0.0, -1.0):
        try:
            exp_wait(lam, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError('a non-positive rate should have raised ValueError')
```

#### Uses
- [Common distributions › Exponential waits](#/distributions/exponential-waits)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- Check `lam` first, before you draw anything.
- Draw `u = rng.random()` once. It is in `[0, 1)`, so `1 - u` is never 0.
- The wait is `-math.log(1 - u) / lam`.

#### Tips
- The standard deviation of an exponential wait equals its mean, so 20,000 waits at rate 0.5 have a mean that is within about 0.014 of 2.0 one time in three. The test band is more than four times that wide.
- The standard library has a built-in exponential draw, but it is the formula here that you should know and be able to check.

#### Docs
- [Python docs: `math.log`](https://docs.python.org/3/library/math.html#math.log)
- [Python docs: `random.Random`](https://docs.python.org/3/library/random.html)

### 4. Normal z and percentiles

Write `z_score(x, mu, sigma)`, which returns `(x - mu) / sigma`. Write `percentile_of(x, mu, sigma)`, the probability that a normal draw is at or below `x`, and `value_at(q, mu, sigma)`, the value with probability `q` below it. Use `statistics.NormalDist`. Raise `ValueError` if `sigma <= 0`.

```python starter
from statistics import NormalDist


def z_score(x, mu, sigma):
    ...


def percentile_of(x, mu, sigma):
    ...


def value_at(q, mu, sigma):
    ...
```

```python test
def test_z():
    """standard deviations from the mean"""
    assert round(z_score(130, 100, 15), 9) == 2.0
    assert round(z_score(85, 100, 15), 9) == -1.0


def test_percentile():
    """cdf at a value"""
    assert round(percentile_of(130, 100, 15), 9) == 0.977249868
    assert round(percentile_of(40, 50, 10), 9) == 0.158655254
    assert round(percentile_of(100, 100, 15), 9) == 0.5


def test_value_at():
    """inverse of the cdf"""
    assert round(value_at(0.975, 0, 1), 9) == 1.959963985
    assert round(value_at(0.975, 100, 15), 6) == 129.39946
    assert round(value_at(0.5, 100, 15), 9) == 100.0


def test_bad_sigma():
    """a sigma of 0 or below raises ValueError"""
    for f in (lambda: z_score(1, 0, 0), lambda: percentile_of(1, 0, -1), lambda: value_at(0.5, 0, 0)):
        try:
            f()
        except ValueError:
            pass
        else:
            raise AssertionError('a non-positive sigma should have raised ValueError')
```

#### Uses
- [Common distributions › The normal distribution](#/distributions/the-normal-distribution)
- [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)

#### Hints
- `z_score` is one line of arithmetic. Check `sigma` first.
- `NormalDist(mu, sigma)` builds the distribution. Its `cdf(x)` is the percentile.
- `inv_cdf(q)` is the reverse of `cdf`, for `q` strictly between 0 and 1.
- Raise `ValueError` yourself when `sigma <= 0`, before you build the distribution.

#### Tips
- `NormalDist().inv_cdf(0.975)` is about 1.96, and a z-score of 2 is about the 97.7th percentile.
- `cdf` and `inv_cdf` undo each other, which makes a quick sanity check: `percentile_of(value_at(q, mu, sigma), mu, sigma)` should be `q`.

#### Docs
- [Python docs: `statistics.NormalDist`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist)
