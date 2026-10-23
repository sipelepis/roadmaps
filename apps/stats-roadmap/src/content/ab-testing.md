# A/B tests

Size an A/B test before it starts, check the traffic split, correct for many metrics, and see what peeking costs.

## Decide before you look

An A/B test sends each user at random to the current version, A, or a new one, B, and compares one number between the two groups. The coin flip is what lets you credit B with a difference: everything else that affects users, from the weather to their browser, lands in both groups alike. The rest of the test is a set of choices, and you make them before any data comes in.

Write these down before the test starts:

- The primary metric: the one number that decides the test, such as the share of users who sign up. You can watch other metrics, but they do not decide.
- The significance level `alpha` and the power, both covered in [Errors and power](#/hypothesis-tests/errors-and-power).
- The smallest effect worth detecting. A lift too small to change any decision is not worth the users it takes to see it.
- The sample size per arm, which follows from the three above, and so how long the test runs.

Each choice made after looking is another chance to find noise. Pick whichever metric moved, stop on the day the result looked good, drop the users who behaved oddly, and a change that does nothing will show an effect far more often than `alpha` says. The last two sections of this page measure that cost for many metrics and for peeking.

The users in a test are a sample too. A test that runs only over a holiday week samples holiday users, the selection problem from [Who got sampled](#/sampling/who-got-sampled). Run whole weeks, so every day of the week is in the sample.

Kohavi, Tang and Xu, *Trustworthy Online Controlled Experiments* (Cambridge University Press, 2020), is a practical reference for running tests this way.

## Sample size

Two numbers from the [normal distribution](#/distributions/the-normal-distribution) set the size of a test:

```python
from statistics import NormalDist

z_alpha = NormalDist().inv_cdf(0.975)
z_beta = NormalDist().inv_cdf(0.8)
print(z_alpha, z_beta)
```

This prints `1.9599639845400536` and `0.8416212335729144`. `z_alpha` is the cutoff for a two-sided test at `alpha = 0.05`: 2.5% of the normal lies above it, the same multiplier as in [Normal intervals for a mean](#/intervals/normal-intervals-for-a-mean). `z_beta` belongs to 80% power: 80% of the normal lies below it. Rounded, they are the familiar 1.96 and 0.84. Both levels are conventions, the defaults most teams start from, not values that statistics hands you. [Errors and power](#/hypothesis-tests/errors-and-power) traces the 0.05 back to Fisher. Choose stricter ones when a false positive or a missed effect costs more.

For a baseline rate `p1` and a rate `p2` you hope to detect, the users needed in each arm are:

```
n per arm = (z_alpha + z_beta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2)) / (p1 - p2) ** 2
```

The top holds the spread of one 0/1 outcome in each arm, `p * (1 - p)`, as in [Intervals for a rate](#/intervals/intervals-for-a-rate). The bottom is the gap you want to see, squared. Round up, because you cannot recruit part of a user.

```python
import math

def n_per_arm(p1, p2, z_alpha=1.96, z_beta=0.84):
    top = (z_alpha + z_beta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))
    return top / (p1 - p2) ** 2

print(n_per_arm(0.20, 0.22), math.ceil(n_per_arm(0.20, 0.22)))
```

A lift from 20% to 22% gives `6499.360000000006`, so `6500` users per arm and 13,000 in all. At 1,000 users a day that is 13 days, which you round up to two full weeks. With the unrounded z values from above the answer is `6507`. Halve the gap, 20% to 21%, and you need `25551` per arm, `3.9309230769230767` times as many. The gap is squared on the bottom, so half the effect costs about four times the users.

Evan Miller's [rule of thumb](https://www.evanmiller.org/how-not-to-run-an-ab-test.html) is `16 * sigma ** 2 / delta ** 2`, where `sigma ** 2` is the variance of one outcome and `delta` is the gap. For a rate, `sigma ** 2` is `p1 * (1 - p1)`, and for the same lift the rule gives 6,400, rounded to a whole user. The 16 is `2 * (1.96 + 0.84) ** 2`, which is `15.679999999999998`, rounded up: one variance per arm, both about the same size.

## Sample ratio mismatch

A 50/50 split never comes out exactly even. Split 100,000 users five times:

```python
import random

rng = random.Random(1)
for _ in range(5):
    print(sum(rng.random() < 0.5 for _ in range(100000)))
```

Arm A gets `50040`, `49864`, `49958`, `49849` and `50075` users. The count in A is a [binomial count](#/distributions/binomial-counts) with `N = 100000` trials and a planned share `r = 0.5`, so its standard deviation is `sqrt(N * r * (1 - r))`, which is `158.11388300841898`. Gaps of a hundred or two are normal. A gap of a thousand is not.

Before you read any metric, check the observed split against the planned one. Measure the gap in standard deviations and turn it into a p-value:

```
z = (n_a - N * r) / sqrt(N * r * (1 - r))
p = 2 * (1 - NormalDist().cdf(abs(z)))
```

This is the chi-square goodness-of-fit test with one degree of freedom. With two arms, the chi-square statistic, the sum of `(observed - expected) ** 2 / expected` over both arms, equals `z ** 2` exactly, so the normal tail gives its p-value. scipy has the test as `scipy.stats.chisquare([n_a, n_b])`.

```python
def srm(n_a, n_b, r=0.5):
    N = n_a + n_b
    z = (n_a - N * r) / math.sqrt(N * r * (1 - r))
    return z * z, 2 * (1 - NormalDist().cdf(abs(z)))

print(srm(50600, 49400))
print(srm(506, 494))
```

50,600 against 49,400 gives a chi-square of `14.399999999999999` and a p-value of `0.00014780231033428848`. The same 50.6% share among 1,000 users, 506 against 494, gives `0.14400000000000002` and `0.7043364134884518`. A big test catches a small mismatch, because the expected wobble grows only like `sqrt(N)`.

Flag a mismatch when `p < 0.001`. That cutoff is a convention, not part of the test. Fabijan et al. ([KDD 2019](https://doi.org/10.1145/3292500.3330722)) describe the check with a chi-square test, and teams pick a strict cutoff such as 0.001 or 0.0005 because they run it on every test, and a loose one would raise false alarms all the time.

A mismatch means something other than the coin decided who got counted: a redirect that loses some B users, bots filtered out of one arm only, a crash in B before the event is logged. The users who went missing differ from the rest, so the two groups are no longer comparable. Do not read the metrics. Find the cause first.

## Many metrics at once

A test dashboard shows twenty metrics, and B changes none of them. When the null is true, a p-value is equally likely to land anywhere from 0 to 1, so `rng.random()` can stand in for one:

```python
rng = random.Random(4)
false_hits = [sum(rng.random() < 0.05 for _ in range(20)) for _ in range(2000)]
print(sum(false_hits) / 2000, sum(h > 0 for h in false_hits) / 2000)
```

Over 2,000 such tests, each shows `1.001` significant metrics on average, and `0.646` of them show at least one. Every one is a false positive. For `m` independent metrics at level `alpha`, the chance of at least one is:

```
P(at least one) = 1 - (1 - alpha) ** m
```

For 20 metrics that is `0.6415140775914581`. Real metrics are correlated, so the exact figure differs, but it stays far above 5%.

The chance of any false positive across the whole family of tests is the family-wise error rate. Bonferroni controls it by testing each of the `m` metrics at `alpha / m`. For 20 metrics that is `0.0025`, and `1 - (1 - 0.0025) ** 20` is `0.04883012474683324`, back under 5%. The price is power: a real effect now needs `p < 0.0025` to count.

Benjamini and Hochberg ([1995](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x)) control something looser, the false discovery rate: of the metrics you call significant, the expected share that are false. Sort the `m` p-values, find the largest rank `k` with `p_(k) <= k * q / m`, and reject the `k` smallest:

```python
p = [0.002, 0.009, 0.012, 0.021, 0.04, 0.3, 0.6, 0.8]
m, q = len(p), 0.05
print([x <= (k + 1) * q / m for k, x in enumerate(sorted(p))])
print([x < q / m for x in p])
```

The rank cutoffs, `k * 0.05 / 8`, are 0.00625, 0.0125, 0.01875, 0.025, 0.03125 and so on up to 0.05, rounded to five places. The first four sorted p-values pass and the fifth, 0.04, does not, so `k` is 4 and Benjamini-Hochberg rejects four. When a later rank passes, every smaller p-value is rejected with it, even one that failed its own cutoff. Bonferroni, at `0.05 / 8 = 0.00625`, rejects only the first. In Python libraries, statsmodels has `multipletests(p, method='fdr_bh')` and scipy has `scipy.stats.false_discovery_control`.

Use Bonferroni when one false positive is expensive. Use Benjamini-Hochberg when you screen many metrics for leads and can live with a few false ones. The cheapest fix is the one from the first section: a single primary metric, chosen in advance, needs no correction at all.

## The cost of peeking

The sample size from the second section assumes you look once, at the end. It is tempting to watch the p-value every day and stop as soon as it dips below 0.05. Simulate that on A/A tests, where both arms share one rate of 10%, so every positive is false. `z_p_value` is the pooled test from [The two-proportion z-test](#/hypothesis-tests/the-two-proportion-z-test):

```python
def z_p_value(k1, n1, k2, n2):
    pooled = (k1 + k2) / (n1 + n2)
    if pooled in (0, 1):
        return 1.0
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    z = (k1 / n1 - k2 / n2) / se
    return 2 * (1 - NormalDist().cdf(abs(z)))

def aa_p_values(n, step, rng, p=0.1):
    ka = kb = 0
    ps = []
    for i in range(1, n + 1):
        ka += rng.random() < p
        kb += rng.random() < p
        if i % step == 0:
            ps.append(z_p_value(ka, i, kb, i))
    return ps

rng = random.Random(6)
runs = [aa_p_values(1000, 50, rng) for _ in range(1000)]
for looks in (1, 2, 5, 10, 20):
    every = 20 // looks
    hits = sum(any(p < 0.05 for p in ps[every - 1::every]) for ps in runs)
    print(looks, hits / len(runs))
```

Each of the 1,000 A/A tests runs to 1,000 users per arm and records a p-value every 50 users. Looking once, at the end, `0.05` of the tests come out positive, as promised. Looking 2, 5, 10 and 20 times, evenly spaced, and stopping at the first `p < 0.05` gives `0.075`, `0.14`, `0.188` and `0.238`. Ten looks nearly quadruple the false positive rate. Evan Miller's [How Not To Run an A/B Test](https://www.evanmiller.org/how-not-to-run-an-ab-test.html) makes the same point. The p-value at each look is right for a test that looks once. Stopping at the first small one is a different test, and its error rate is the one in this table.

The looks share most of their users, so the rate climbs more slowly than `1 - 0.95 ** looks`. But it never stops climbing.

There are two ways out. Fix the sample size in advance and read the primary metric once, at the end. Watching along the way for bugs and for a sample ratio mismatch is fine. Or use a sequential method, built to look many times while keeping the overall rate at `alpha`. The bluntest one is Bonferroni over the looks: demand `p < 0.005` at each of 10 looks. On the same runs that gives `0.025`, safely under 5% but stricter than it needs to be, so it costs power. Group sequential designs and Miller's [simple sequential test](https://www.evanmiller.org/sequential-ab-testing.html) spend `alpha` across the looks more carefully.

```python playground
import math
import random
from statistics import NormalDist

N = NormalDist()


def sample_size(p1, p2, alpha=0.05, power=0.8):
    z_alpha = N.inv_cdf(1 - alpha / 2)
    z_beta = N.inv_cdf(power)
    return math.ceil((z_alpha + z_beta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2)) / (p1 - p2) ** 2)


def srm_p(n_a, n_b, r=0.5):
    total = n_a + n_b
    z = (n_a - total * r) / math.sqrt(total * r * (1 - r))
    return 2 * (1 - N.cdf(abs(z)))


def z_p_value(k1, n1, k2, n2):
    pooled = (k1 + k2) / (n1 + n2)
    if pooled in (0, 1):
        return 1.0
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    return 2 * (1 - N.cdf(abs((k1 / n1 - k2 / n2) / se)))


def aa_p_values(n, step, rng, p=0.1):
    ka = kb = 0
    ps = []
    for i in range(1, n + 1):
        ka += rng.random() < p
        kb += rng.random() < p
        if i % step == 0:
            ps.append(z_p_value(ka, i, kb, i))
    return ps


print('per arm, 20% -> 22%:', sample_size(0.20, 0.22))
print('per arm, 20% -> 21%:', sample_size(0.20, 0.21))
print('SRM p, 50600 vs 49400:', srm_p(50600, 49400))

rng = random.Random(6)
runs = [aa_p_values(200, 20, rng) for _ in range(300)]
print('one look  ', sum(ps[-1] < 0.05 for ps in runs) / len(runs))
print('ten looks ', sum(min(ps) < 0.05 for ps in runs) / len(runs))

# Try: power=0.9, a 90/10 split with r=0.9, or demand p < 0.005 at every look.
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

#### Uses
- [A/B tests › Sample size](#/ab-testing/sample-size)
- [Hypothesis tests › Errors and power](#/hypothesis-tests/errors-and-power)
- [Confidence intervals & bootstrap › Intervals for a rate](#/intervals/intervals-for-a-rate)

#### Hints
- Check the inputs first: equal rates, then each rate strictly between 0 and 1.
- The top of the formula is `(z_alpha + z_beta) ** 2` times the two 0/1 variances, `p * (1 - p)` for each rate. The bottom is the gap squared.
- Round the quotient up to a whole number of users.

#### Tips
- `math.ceil` already returns an `int`, so there is nothing to convert.
- The gap is squared, so swapping `p1` and `p2` gives the same size.
- `NormalDist().inv_cdf(0.975)` and `NormalDist().inv_cdf(0.8)` are the unrounded z values. Passing them in changes the answer by a few users.

#### Docs
- [Python docs: `math.ceil`](https://docs.python.org/3/library/math.html#math.ceil)
- [Python docs: `statistics.NormalDist.inv_cdf`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist.inv_cdf)
- [Evan Miller, How Not To Run an A/B Test](https://www.evanmiller.org/how-not-to-run-an-ab-test.html)

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

#### Uses
- [A/B tests › Sample ratio mismatch](#/ab-testing/sample-ratio-mismatch)
- [Common distributions › Binomial counts](#/distributions/binomial-counts)
- [Hypothesis tests › What a p-value is](#/hypothesis-tests/what-a-p-value-is)

#### Hints
- Check `N` and `ratio` before you divide or take a square root.
- `z` measures how many standard deviations `n_a` sits from the planned count `N * ratio`.
- Square `z` for the chi-square and double the normal tail beyond `abs(z)` for `p`. `is_srm` calls `srm_check` and compares its `p` with the threshold.

#### Tips
- With two arms the chi-square statistic is exactly `z * z`, so the normal tail is its p-value. `scipy.stats.chisquare([n_a, n_b])` gives the same numbers.
- `ratio` is the share planned for arm A. A 90/10 test needs `ratio=0.9`, or every run of it looks like a mismatch.

#### Docs
- [Python docs: `statistics.NormalDist.cdf`](https://docs.python.org/3/library/statistics.html#statistics.NormalDist.cdf)
- [Fabijan et al. (2019), Diagnosing Sample Ratio Mismatch in Online Controlled Experiments](https://doi.org/10.1145/3292500.3330722)

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


def test_p_exactly_on_its_cutoff():
    """a p-value equal to rank * q / m is rejected"""
    assert benjamini_hochberg([0.0625, 0.5, 0.9, 0.99], q=0.25) == [True, False, False, False]
    assert benjamini_hochberg([0.99, 0.01, 0.1875, 0.125], q=0.25) == [False, True, True, True]
    assert benjamini_hochberg([0.01, 0.02, 0.03, 0.25], q=0.25) == [True, True, True, True]

def test_edges():
    """an empty list and a single value"""
    assert benjamini_hochberg([]) == []
    assert benjamini_hochberg([0.001]) == [True]
    assert benjamini_hochberg([0.2]) == [False]
```

#### Uses
- [A/B tests › Many metrics at once](#/ab-testing/many-metrics-at-once)
- [Hypothesis tests › Errors and power](#/hypothesis-tests/errors-and-power)

#### Hints
- Sort the positions `0` to `m - 1` by their p-values, not the p-values themselves, so you can map each one back to its place in the input.
- Walk the sorted positions with a 1-based rank and remember the largest rank whose p-value passes `rank * q / m`. Do not stop at the first failure.
- Mark the first `k` sorted positions as rejected and leave the rest.

#### Tips
- `sorted` is stable, so `sorted(range(m), key=...)` keeps tied p-values in their input order.
- A later rank that passes rejects every smaller p-value too. In `[0.046, 0.015, 0.049, 0.018, 0.045]` the largest, 0.049, passes at rank 5, so all five are rejected.

#### Docs
- [Python docs: sort stability](https://docs.python.org/3/howto/sorting.html#sort-stability-and-complex-sorts)
- [Benjamini and Hochberg (1995), Controlling the False Discovery Rate](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x)

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

def test_exact_seeded_rates():
    """seeded runs reproduce the exact rates"""
    def r(*args, **kw):
        return tuple(round(v, 9) for v in false_positive_rates(*args, **kw))
    assert r(60, 6, 100, random.Random(1)) == (0.07, 0.18)
    assert r(60, 6, 100, random.Random(2)) == (0.05, 0.23)
    assert r(40, 4, 100, random.Random(3), p=0.3) == (0.03, 0.1)
    assert r(40, 5, 100, random.Random(4), p=0.8, alpha=0.1) == (0.08, 0.2)


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

#### Uses
- [A/B tests › The cost of peeking](#/ab-testing/the-cost-of-peeking)
- [Hypothesis tests › Errors and power](#/hypothesis-tests/errors-and-power)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- Check `looks` first. The users between looks are `n // looks`.
- In each test keep running counts for A and B. After user `i`, counting from 1, check whether `i` is a multiple of the step, and if so compute the p-value with `i` users in each arm.
- Remember whether any look fell below `alpha` and whether the last one did. Count each across the tests and divide by `reps`.

#### Tips
- Draw arm A before arm B for every user, one `rng.random()` each, or the seeded tests will not line up.
- With `looks=1` the only look is the last one, so the two rates are equal. That is a quick check of your loop.

#### Docs
- [Python docs: `random.Random`](https://docs.python.org/3/library/random.html#random.Random)
- [Evan Miller, How Not To Run an A/B Test](https://www.evanmiller.org/how-not-to-run-an-ab-test.html)
