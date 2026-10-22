# Hypothesis tests

Test a difference between two rates, read a p-value correctly, and measure false positives and power by simulation.

## Null and alternative

Two versions of a signup page. On A, 40 of 200 visitors signed up, a rate of 0.2. On B, 55 of 200 did, a rate of 0.275. B looks better by 0.075. But as [Samples and populations](#/samples/samples-and-populations) showed, two samples from the same rate rarely match. Is 0.075 more than noise?

A test makes the question precise. The null hypothesis says there is no difference: both pages have the same rate, and the gap you saw is sampling noise. The alternative says the rates differ. A test statistic is a number that measures how far the data sit from what the null predicts. Here it is the difference in rates, B minus A. Under the null it is 0 on average, and the further it lands from 0, the worse the data fit the null.

So build the world the null describes and see what differences it produces. If both pages share one rate, your estimate of it is the pooled rate, `(40 + 55) / (200 + 200)`, which is `0.2375`:

```python
import random

k1, n1, k2, n2 = 40, 200, 55, 200
observed = k2 / n2 - k1 / n1
pool = (k1 + k2) / (n1 + n2)
rng = random.Random(1)
diffs = []
for _ in range(10000):
    a = sum(rng.random() < pool for _ in range(n1))
    b = sum(rng.random() < pool for _ in range(n2))
    diffs.append(b / n2 - a / n1)
print(sum(abs(d) >= abs(observed) - 1e-9 for d in diffs) / len(diffs))
```

In this null world, a difference at least as large as 0.075, in either direction, came up in `0.0878` of the 10,000 runs. `observed` prints as `0.07500000000000001`, and the `- 1e-9` stops that float noise from deciding whether a tie counts.

## What a p-value is

That share is a p-value. The [American Statistical Association's 2016 statement](https://www.amstat.org/asa/files/pdfs/P-ValueStatement.pdf) defines it as the probability, computed assuming the null hypothesis and its model are true, of a statistic at least as extreme as the one observed. A small p-value says data like yours would be unusual if the null were true. That is all it says.

Three misreadings are common, and all three are wrong:

- It is not the probability that the null hypothesis is true. A p-value of 0.0878 does not mean an 8.78% chance that the two pages convert equally. The calculation started by assuming the null is true, so it cannot also tell you how likely the null is. That question needs a prior, which is the Bayesian route.
- It is not the probability that the result is due to chance. "Due to chance" is the null again, so this is the first misreading in other words.
- It is not an effect size. Compare 40,000 of 200,000 with 41,000 of 200,000. The difference is half a percentage point, `0.004999999999999977` as Python prints it, and the p-value from the next section is `8.336190918289965e-05`. A tiny effect with huge samples gives a tiny p-value, and a large effect with small samples can give a large one. Report the difference itself, with an interval as in [Intervals for a rate](#/intervals/intervals-for-a-rate).

Counting both directions makes this a two-sided test, which is the default when you would act on a difference either way. Counting only B ahead gives `0.0437` for the same runs.

## The two-proportion z-test

The simulation took 10,000 runs. [The central limit theorem](#/clt/the-central-limit-theorem) gives a shortcut. Under the null, the difference in rates is close to normal, centred on 0, with a [standard error](#/clt/standard-error) built from the pooled rate:

```
p_pool = (k1 + k2) / (n1 + n2)
se     = sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
z      = (k2 / n2 - k1 / n1) / se
p      = 2 * (1 - NormalDist().cdf(abs(z)))
```

`z` counts how many standard errors the observed difference sits from 0. `1 - cdf(abs(z))` is the share of the [normal distribution](#/distributions/the-normal-distribution) beyond `abs(z)` on one side, and doubling it counts both sides.

```python
import math
from statistics import NormalDist

se = math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2))
z = observed / se
print(se, z, 2 * (1 - NormalDist().cdf(abs(z))))
```

For the two pages, `se` is `0.042555111326373005`, `z` is `1.7624204863381403`, and the p-value is `0.07799827984931706`. The simulation gave 0.0878. The gap is not simulation error. Adding up the exact binomial probabilities of every pair of counts gives 0.0883, rounded to four places, so the z-test is the one that is off. The counts are whole numbers, so many simulated differences land exactly on 0.075 and count as ties. Count only strictly larger differences and the simulation gives `0.0686`. The smooth normal curve falls between the two. With larger samples the gap shrinks. In Python libraries, statsmodels has `proportions_ztest`.

## Permutation tests

The z-test needs a formula for the standard error. A permutation test needs none. If the null is true, the labels A and B mean nothing, and any value could have come from either group. So shuffle the labels many times and see how big the difference gets by chance alone.

Here are task times in minutes with an old tool, `a`, and a new one, `b`:

```python
a = [14.2, 12.8, 15.1, 13.6, 16.0, 14.9, 13.3]
b = [12.1, 11.5, 13.0, 12.4, 11.8, 13.4]

def shuffle(xs, rng):
    for i in range(len(xs) - 1, 0, -1):
        j = int(rng.random() * (i + 1))
        xs[i], xs[j] = xs[j], xs[i]
```

The observed difference, mean of `b` minus mean of `a`, is `-1.904761904761905`. Pool the 13 values, shuffle, call the first 7 group A and the other 6 group B, and recompute the difference. This is the Fisher-Yates shuffle: each step picks a position from 0 to `i` and swaps it into place `i`, so every ordering is equally likely. `rng.shuffle(xs)` does the same job but draws its numbers differently, so the exercise writes the loop out and drives it with `rng.random()`, which pins the result for a seed.

With 5,000 shuffles from `random.Random(2)`, 40 gave a difference at least as large in size as the observed one. The p-value is `(40 + 1) / (5000 + 1)`, which is `0.008198360327934412`. The `+ 1` on top and bottom counts the real labelling as one of the shuffles, which it is. It also keeps the p-value above 0, because a finite number of shuffles cannot show that something is rarer than 1 in `reps + 1`.

There are only `math.comb(13, 6)`, which is `1716`, ways to split these 13 values into groups of 7 and 6. Checking every split gives exactly 12 at least as extreme, a p-value of `0.006993006993006993`, and the shuffles land close to it. With bigger groups the number of splits explodes, and random shuffles are the practical route. scipy has `scipy.stats.permutation_test`.

## Errors and power

A test ends in a decision: reject the null when `p < alpha`. There are two ways to be wrong:

- A type I error rejects a null that is true, a false positive. When the null is true, a well-built test rejects at rate `alpha`.
- A type II error keeps a null that is false, a false negative. Its rate is called beta, and power is `1 - beta`: the chance the test detects an effect of a given size.

`alpha = 0.05` is a convention, not a law. It goes back to Fisher, who wrote in 1925 that the 1-in-20 point was ["convenient to take ... as a limit"](https://psychclassics.yorku.ca/Fisher/Methods/chap3.htm) for judging significance. Choose `alpha` before you see the data, from what a false positive would cost.

Check both error rates by simulation. Here is a z-test for a mean of 0 with a known sigma of 1:

```python
def rejects(xs, sigma, alpha=0.05):
    n = len(xs)
    z = (sum(xs) / n) / (sigma / math.sqrt(n))
    return 2 * (1 - NormalDist().cdf(abs(z))) < alpha

rng = random.Random(3)
print(sum(rejects([rng.gauss(0, 1) for _ in range(50)], 1) for _ in range(4000)) / 4000)
```

With the null true, it rejects in `0.05225` of 4,000 runs, close to 0.05. Reseed with `random.Random(3)` and draw from a true mean of 0.3 instead, and it rejects in `0.56025`. That is the power for an effect of 0.3 sigma with 50 values: the test misses a real effect about 44% of the time.

Power has a formula too. With `zc = NormalDist().inv_cdf(1 - alpha / 2)` and `d = delta * sqrt(n) / sigma`, the number of standard errors between the true effect and 0:

```
power = cdf(d - zc) + cdf(-d - zc)
```

For `delta = 0.3`, `sigma = 1` and `n = 50` it gives `0.564116025431004`, close to the simulated 0.56025. Power grows with `n`: 0.269 at 20, 0.851 at 100 and 0.989 at 200, rounded to three places. Reaching 80% at this effect takes `((zc + NormalDist().inv_cdf(0.8)) / 0.3) ** 2`, which is `87.20977482610098`, so 88 values. A stricter `alpha` of 0.01 at `n = 50` cuts power to `0.32473259130887333`.

Work out the sample size before you run a test. A test with power below 50% misses a real effect more often than it finds one, and its "not significant" says little about whether an effect exists. An interval says more.

```python playground
import math
import random
from statistics import NormalDist

N = NormalDist()


def two_prop_z(k1, n1, k2, n2):
    pool = (k1 + k2) / (n1 + n2)
    se = math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2))
    z = (k2 / n2 - k1 / n1) / se
    return z, 2 * (1 - N.cdf(abs(z)))


def power(delta, sigma, n, alpha=0.05):
    zc = N.inv_cdf(1 - alpha / 2)
    d = delta * math.sqrt(n) / sigma
    return N.cdf(d - zc) + N.cdf(-d - zc)


def rejection_rate(mean, n, reps, rng, alpha=0.05):
    # Rejecting when p < alpha is the same as abs(z) > zc.
    zc = N.inv_cdf(1 - alpha / 2)
    hits = 0
    for _ in range(reps):
        m = sum(rng.gauss(mean, 1) for _ in range(n)) / n
        hits += abs(m * math.sqrt(n)) > zc
    return hits / reps


print('z-test', two_prop_z(40, 200, 55, 200))
rng = random.Random(3)
print('type I rate', rejection_rate(0.0, 50, 2000, rng))
for n in (20, 50, 100):
    print('n', n, 'power by formula', round(power(0.3, 1, n), 3), 'by simulation', rejection_rate(0.3, n, 2000, rng))

# Try: alpha=0.01, or an effect of 0.5 instead of 0.3.
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

#### Uses
- [Hypothesis tests › The two-proportion z-test](#/hypothesis-tests/the-two-proportion-z-test)
- [Hypothesis tests › Null and alternative](#/hypothesis-tests/null-and-alternative)
- [Common distributions › The normal distribution](#/distributions/the-normal-distribution)

#### Hints
- Check for an empty arm before you divide by `n1` or `n2`.
- Compute the pooled rate and `se`. If `se` is 0, the pooled rate was 0 or 1, so raise.
- `z` is the difference in rates over `se`. The two-sided p-value doubles the normal tail beyond `abs(z)`.

#### Tips
- Swapping the arms flips the sign of `z` but keeps `p`, because a two-sided test counts both directions.
- `NormalDist().cdf` is the share of a standard normal at or below a value. `1 - cdf(abs(z))` is one tail.

#### Docs
- [Python docs: `statistics.NormalDist.cdf`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist.cdf)
- [ASA statement on p-values (2016)](https://www.amstat.org/asa/files/pdfs/P-ValueStatement.pdf)

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

#### Uses
- [Hypothesis tests › Permutation tests](#/hypothesis-tests/permutation-tests)
- [Hypothesis tests › What a p-value is](#/hypothesis-tests/what-a-p-value-is)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- Compute the observed difference once, before any shuffling.
- Shuffle a fresh copy of `a + b` each rep, so every shuffle starts from the same order. Run `i` from `len - 1` down to 1, one `rng.random()` per step.
- After each shuffle, split at `len(a)`, compute the difference the same way, and count it when its size is at least the observed size. Then apply `(count + 1) / (reps + 1)`.

#### Tips
- `rng.shuffle` would also work as a shuffle, but it draws its numbers differently, so it would not match the seeded tests.
- Identical groups give a p-value of 1: every shuffle ties the observed difference of 0.

#### Docs
- [Python docs: `random.Random.random`](https://docs.python.org/3/library/random.html#random.random)
- [Python docs: `random.shuffle`](https://docs.python.org/3/library/random.html#random.shuffle)

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

#### Uses
- [Hypothesis tests › Errors and power](#/hypothesis-tests/errors-and-power)
- [Large numbers & the CLT › Standard error](#/clt/standard-error)

#### Hints
- Check `reps` first. The standard error, `math.sqrt(1 / 12) / math.sqrt(n)`, is the same every rep, so compute it once.
- Each rep draws `n` values with `rng.random()`, takes their mean, and turns it into `z`.
- Reject when the two-sided p-value is below `alpha`, count the rejections, and divide by `reps`.

#### Tips
- With `alpha` of 0 nothing is ever below it, so the rate is 0. That is a quick check of the comparison's direction.
- The rate lands near `alpha` but not on it: 2,000 reps carry a simulation error of about half a percentage point.

#### Docs
- [Python docs: `statistics.NormalDist.cdf`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist.cdf)

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

#### Uses
- [Hypothesis tests › Errors and power](#/hypothesis-tests/errors-and-power)
- [Confidence intervals & bootstrap › Normal intervals for a mean](#/intervals/normal-intervals-for-a-mean)

#### Hints
- Validate `n` and `sigma` before you take a square root or divide.
- `zc` is the same multiplier a confidence interval uses. `d` is the true effect measured in standard errors.
- Add the two normal tails: one at `d - zc` and one at `-d - zc`.

#### Tips
- With no effect, `d` is 0 and the two tails add up to `alpha`. The tests check exactly that.
- The second tail is the chance of rejecting in the wrong direction. It is tiny unless the effect is small.

#### Docs
- [Python docs: `statistics.NormalDist`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist)
- [Fisher (1925), Statistical Methods for Research Workers, chapter 3](https://psychclassics.yorku.ca/Fisher/Methods/chap3.htm)
