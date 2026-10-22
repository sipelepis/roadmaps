# Error bars on evals

Treat an eval as a sample: standard errors, paired comparisons, clustered questions, and how many questions you need.

## An eval is a sample

An eval scores a model on a fixed set of questions and reports one number, such as 69.5% correct. But the questions are a sample. They are some of the questions you could have written to test the same skill, and a different set would give a different score. Simulate a model that gets 70% of all possible questions right, and give it five different sets of 200:

```python
import random

for seed in range(5):
    rng = random.Random(seed)
    print(sum(rng.random() < 0.7 for _ in range(200)) / 200)
```

The scores are `0.695`, `0.71`, `0.69`, `0.695` and `0.68`. Same model, same skill, three points apart, only because the questions changed. This is [Samples and populations](#/samples/samples-and-populations) again: the questions are the sample, all the questions you could have asked are the population, and the score is an estimate of the model's accuracy on that population.

So an eval score needs an error bar, like any other estimate. Miller makes this case in [Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640) (2024) and works out the formulas on this page. Without the error bar you cannot tell whether a two-point lead on a leaderboard is a better model or a luckier set of questions.

## Standard error of a score

The score is a mean over questions, so its standard error is the one from [Standard error](#/clt/standard-error):

```python
import math
import statistics
from statistics import NormalDist

rng = random.Random(3)
scores = [1 if rng.random() < 0.7 else 0 for _ in range(200)]
m = statistics.fmean(scores)
se = statistics.stdev(scores) / math.sqrt(len(scores))
z = NormalDist().inv_cdf(0.975)
print(m, se, m - z * se, m + z * se)
```

```
SE     = s / sqrt(n)
95% CI = mean - 1.96 * SE  to  mean + 1.96 * SE
```

`s` is the sample standard deviation of the per-question scores. For 0/1 scores it is close to `sqrt(p * (1 - p))`, so `SE` is about `sqrt(p * (1 - p) / n)`. Graded scores, such as partial credit from 0 to 1, use `s` as it is.

Here the score is `0.695` and `SE` is `0.03263741725420572`. The shortcut gives `0.03255572146336186`, and the small gap is `n` against `n - 1`. The 95% interval runs from `0.6310318376333506` to `0.7589681623666493`, so report the score as 69.5% ± 6.4 points. It is the [normal interval for a mean](#/intervals/normal-intervals-for-a-mean), and it makes the same claim as in [What an interval claims](#/intervals/what-an-interval-claims): the recipe covers the true accuracy for about 95% of question sets.

The error shrinks like `1 / sqrt(n)`. At 70% accuracy, the half-width `1.96 * SE` is `0.06351125884439703` for 200 questions and `0.02008402350128081` for 2,000. Ten times the questions make the error bar a little over three times narrower.

## Comparing two models

Two models, A and B, answer the same 500 questions. Some questions are easy for both and some are hard for both:

```python
rng = random.Random(5)
a, b = [], []
for _ in range(500):
    easy = rng.random() < 0.6
    pa, pb = (0.95, 0.9) if easy else (0.35, 0.25)
    a.append(1 if rng.random() < pa else 0)
    b.append(1 if rng.random() < pb else 0)

n = len(a)
d = [x - y for x, y in zip(a, b)]
se_paired = statistics.stdev(d) / math.sqrt(n)
se_unpaired = math.sqrt(statistics.variance(a) / n + statistics.variance(b) / n)
print(statistics.fmean(a), statistics.fmean(b), statistics.fmean(d))
print(se_paired, se_unpaired)
```

A scores `0.708` and B `0.664`, a difference of `0.044`. Treat the two scores as independent samples, and the standard error of the difference is `0.02934966448890383`. But they are not independent: they share the questions. Take each question's difference, `d_i = a_i - b_i`, and the standard error of their mean instead:

```
SE_paired   = s_d / sqrt(n)
SE_unpaired = sqrt(s_a ** 2 / n + s_b ** 2 / n)
```

`SE_paired` is `0.02165793462601014`, about three quarters of the unpaired one. The reason is one line of algebra: `variance(d) = variance(a) + variance(b) - 2 * covariance(a, b)`. When both models find the same questions hard, the covariance is positive, and pairing subtracts it. Here `statistics.correlation(a, b)` is `0.45579307481901093`.

The smaller error changes the verdict. The z statistic, the difference over its standard error, is `2.031587995798921` paired and `1.4991653487771552` unpaired, which give two-sided p-values of `0.04219538296287295` and `0.13383074194951794`. An unpaired test, like [The two-proportion z-test](#/hypothesis-tests/the-two-proportion-z-test), throws the pairing away and some of the evidence with it. When two models answer the same questions, compare them question by question.

## Clustered questions

Questions often come in groups: several questions about one passage, several test cases for one function. Questions that share a source tend to be right or wrong together, so 200 of them carry less information than 200 independent ones.

```python
rng = random.Random(8)
sc, cl = [], []
for passage in range(50):
    p = 0.9 if rng.random() < 0.5 else 0.3
    for _ in range(4):
        sc.append(1 if rng.random() < p else 0)
        cl.append(passage)
```

That is 50 passages with 4 questions each. Half the passages are easy, and each of their questions is right 90% of the time. The other half are hard, at 30%. The clustered standard error adds up the deviations inside each cluster first, and squares the sums:

```
SE_clustered = sqrt(sum over clusters of (sum within the cluster of (s_i - mean)) ** 2) / n
```

```python
n = len(sc)
mean = sum(sc) / n
sums = {}
for s, c in zip(sc, cl):
    sums[c] = sums.get(c, 0) + s - mean
naive = math.sqrt(sum((s - mean) ** 2 for s in sc)) / n
clustered = math.sqrt(sum(v * v for v in sums.values())) / n
print(mean, naive, clustered)
```

With every question in its own cluster, each cluster sum is a single deviation, and the formula falls back to `sqrt(sum((s_i - mean) ** 2)) / n`. That is the naive standard error with `n` in place of `n - 1`. Here the mean is `0.53`, the naive error is `0.03529164207004259` and the clustered one is `0.04829078587059855`, 1.37 times larger, rounded to two places. Inside a cluster, deviations of the same sign add up before they are squared, so agreement within clusters inflates the error.

How much depends on how strongly each cluster agrees. In the extreme case, 20 passages of 10 questions where each passage is all right or all wrong, the clustered error is `sqrt(10)` times the naive one, `3.1622776601683786` times: the 200 questions carry the information of 20. Miller (2024) recommends the clustered error whenever questions share a source. Ignore it and the error bars come out too narrow.

## How many questions

Turn the paired error around to plan an eval. To detect a difference `delta` between two models at the usual 5% level with 80% power, you need:

```
n = (z_alpha + z_beta) ** 2 * sd_diff ** 2 / delta ** 2
```

questions, rounded up, where `sd_diff` is the standard deviation of the per-question differences `d_i`. It is the formula from [Sample size](#/ab-testing/sample-size), with the paired spread in place of the two variances. Miller (2024) gives a version with extra terms for when you sample several answers to each question.

```python
print(math.ceil(((1.96 + 0.84) * 0.4 / 0.02) ** 2))
```

To detect a 2-point difference with `sd_diff = 0.4`, you need `3136` questions. Halve the difference and you need about four times as many.

`sd_diff` comes from a pilot: run both models on a few hundred questions and take `statistics.stdev` of the differences. For 0/1 scores each `d_i` is -1, 0 or 1, so when the mean difference is small, `sd_diff` is about the square root of the share of questions where the models disagree. Disagreeing on 20% gives about `0.4472135954999579`. In the simulation from Comparing two models, they disagree on `0.236` of the questions and `sd_diff` is `0.4842861407600516`. A 2-point difference then needs `4597` questions. The unpaired version, with `variance(a) + variance(b)` in place of `sd_diff ** 2`, asks for `8442`. Pairing nearly halves the eval.

## Small evals

Every interval so far leans on the central limit theorem, and the CLT needs enough questions. Bowyer, Aitchison and Ivanova argue in [Don't use the CLT in LLM evals with fewer than a few hundred datapoints](https://arxiv.org/html/2503.01747v2) (2025) that below a few hundred questions the CLT interval covers the truth too rarely. At the edges it fails outright:

```python
def clt(k, n):
    p = k / n
    h = z * math.sqrt(p * (1 - p) / n)
    return p - h, p + h

print(clt(10, 10), clt(18, 20))
```

10 of 10 correct gives `(1.0, 1.0)`: an interval of zero width, as if ten questions proved the model perfect. 18 of 20 gives `0.7685216189135129` to `1.0314783810864872`, past 100%. This is the Wald interval from [Intervals for a rate](#/intervals/intervals-for-a-rate), with the same failures.

The paper recommends two fixes for right-or-wrong scores. The first is the Wilson interval:

```python
def wilson(k, n):
    p = k / n
    shrink = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / shrink
    half = z / shrink * math.sqrt(p * (1 - p) / n + z**2 / (4 * n**2))
    return centre - half, centre + half

print(wilson(10, 10), wilson(18, 20))
```

10 of 10 gives `0.7224672001371109` to `1.0`, and 18 of 20 gives `0.6989663547715128` to `0.9721335187862319`. The second is a Beta posterior, from [The Beta-Binomial shortcut](#/bayesian/the-beta-binomial-shortcut). A flat prior and 10 of 10 give `Beta(11, 1)`. Its CDF is `t ** 11`, so its quantiles have a closed form, and the 95% [credible interval](#/bayesian/credible-intervals) runs from `0.025 ** (1 / 11)`, which is `0.7150858470818455`, to `0.975 ** (1 / 11)`, which is `0.9977010277861857`. For other counts, draw with `rng.betavariate` and take `statistics.quantiles`, as the Bayesian module does.

Check them by simulation, as in [Checking coverage](#/intervals/checking-coverage). Take a model with a true accuracy of 95%, 40 questions per eval and 2,000 evals drawn with `random.Random(9)`. The CLT interval covers 0.95 in `0.8635` of them, and Wilson in `0.954`. Below a few hundred questions, use Wilson or a Beta posterior. Each costs one line more.

```python playground
import math
import random
import statistics
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)


def score_ci(scores):
    m = statistics.fmean(scores)
    se = statistics.stdev(scores) / math.sqrt(len(scores))
    return round(m, 3), round(m - Z * se, 3), round(m + Z * se, 3)


def clustered_se(scores, clusters):
    n = len(scores)
    mean = sum(scores) / n
    sums = {}
    for s, c in zip(scores, clusters):
        sums[c] = sums.get(c, 0) + s - mean
    return math.sqrt(sum(v * v for v in sums.values())) / n


def wilson(k, n):
    p = k / n
    shrink = 1 + Z**2 / n
    centre = (p + Z**2 / (2 * n)) / shrink
    half = Z / shrink * math.sqrt(p * (1 - p) / n + Z**2 / (4 * n**2))
    return round(centre - half, 3), round(centre + half, 3)


# 100 passages of 4 questions; a passage is easy or hard for both models.
rng = random.Random(5)
a, b, clusters = [], [], []
for passage in range(100):
    easy = rng.random() < 0.6
    pa, pb = (0.95, 0.9) if easy else (0.35, 0.25)
    for _ in range(4):
        a.append(1 if rng.random() < pa else 0)
        b.append(1 if rng.random() < pb else 0)
        clusters.append(passage)

n = len(a)
d = [x - y for x, y in zip(a, b)]
print('A', score_ci(a), 'B', score_ci(b))
print('difference ', statistics.fmean(d))
print('SE paired  ', statistics.stdev(d) / math.sqrt(n))
print('SE unpaired', math.sqrt(statistics.variance(a) / n + statistics.variance(b) / n))
print('SE of A, naive', statistics.stdev(a) / math.sqrt(n), 'clustered', clustered_se(a, clusters))
print('questions for a 2-point gap', math.ceil(((1.96 + 0.84) * statistics.stdev(d) / 0.02) ** 2))
print('10 of 10, Wilson', wilson(10, 10))

# Try: 10 questions per passage, or make the hard passages harder for B only.
```

## Exercises

### 1. Score with SE and 95% CI

Write `score_ci(scores, z=1.96)`, which returns the tuple `(mean, se, lo, hi)` of four floats. `se` is the sample standard deviation (dividing by `n - 1`) over `math.sqrt(n)`. `lo` and `hi` are `mean - z * se` and `mean + z * se`. Do not clip them to the range of the scores. Raise `ValueError` when there are fewer than 2 scores. If every score is the same, `se` is `0.0` and the interval has zero width.

```python starter
import math

def score_ci(scores, z=1.96):
    ...
```

```python test
def test_pass_fail_scores():
    """a 0/1 eval of ten questions"""
    mean, se, lo, hi = score_ci([1, 1, 1, 1, 1, 1, 1, 0, 0, 0])
    assert round(mean, 9) == 0.7
    assert round(se, 9) == 0.152752523
    assert round(lo, 9) == 0.400605055
    assert round(hi, 9) == 0.999394945

def test_graded_scores():
    """graded scores and another z"""
    got = score_ci([0.5, 1.0, 0.0, 0.75, 0.25, 1.0, 0.5, 0.75])
    assert [round(v, 9) for v in got] == [0.59375, 0.124440713, 0.349846202, 0.837653798]
    got = score_ci([1, 1, 1, 1, 1, 1, 1, 0, 0, 0], z=2.58)
    assert [round(v, 9) for v in got] == [0.7, 0.152752523, 0.30589849, 1.09410151]

def test_no_spread():
    """all correct gives a standard error of 0 and no width"""
    mean, se, lo, hi = score_ci([1, 1, 1, 1, 1])
    assert round(mean, 9) == 1.0
    assert se == 0.0
    assert round(lo, 9) == 1.0
    assert round(hi, 9) == 1.0

def test_too_few_scores():
    """fewer than two scores raises ValueError"""
    for scores in [[], [1]]:
        try:
            score_ci(scores)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{scores} should have raised ValueError')
```

#### Uses
- [Error bars on evals › Standard error of a score](#/eval-stats/standard-error-of-a-score)
- [Large numbers & the CLT › Standard error](#/clt/standard-error)
- [Confidence intervals & bootstrap › Normal intervals for a mean](#/intervals/normal-intervals-for-a-mean)

#### Hints
- Raise for fewer than 2 scores before you divide by `n - 1`.
- The sample standard deviation divides the squared deviations from the mean by `n - 1`. `se` is that over `math.sqrt(n)`.
- The interval is `mean - z * se` to `mean + z * se`. Return all four numbers, unclipped.

#### Tips
- `statistics.stdev(scores)` gives the same standard deviation in one call.
- Scores that are all equal give `se` of 0 and an interval of zero width. That is the small-eval failure from the article, and the test checks it on purpose.

#### Docs
- [Python docs: `statistics.stdev`](https://docs.python.org/3/library/statistics.html#statistics.stdev)
- [Python docs: `math.sqrt`](https://docs.python.org/3/library/math.html#math.sqrt)

### 2. Paired difference

Write `paired_diff(a, b)`, which compares two models scored on the same questions. It returns `(mean_diff, se_paired, se_unpaired)`. With `d_i = a_i - b_i`, `mean_diff` is the mean of `d`, `se_paired` is the sample standard deviation of `d` over `math.sqrt(n)`, and `se_unpaired` is `math.sqrt(sd(a) ** 2 / n + sd(b) ** 2 / n)`. Every standard deviation divides by `n - 1`. Raise `ValueError` when the lists have different lengths or fewer than 2 items.

```python starter
import math

def paired_diff(a, b):
    ...
```

```python test
A = [1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0]
B = [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0]

def test_values():
    """difference and both standard errors"""
    got = paired_diff(A, B)
    assert [round(v, 9) for v in got] == [0.166666667, 0.112366644, 0.210218741]

def test_pairing_shrinks_the_error():
    """correlated scores give a smaller paired error"""
    _, se_paired, se_unpaired = paired_diff(A, B)
    assert se_paired < se_unpaired

def test_direction():
    """swapping the models flips the sign only"""
    got = paired_diff(B, A)
    assert [round(v, 9) for v in got] == [-0.166666667, 0.112366644, 0.210218741]

def test_bad_input():
    """different lengths or fewer than two items raise ValueError"""
    for a, b in [([1, 0, 1], [1, 0]), ([1], [0]), ([], [])]:
        try:
            paired_diff(a, b)
        except ValueError:
            pass
        else:
            raise AssertionError(f'{a} and {b} should have raised ValueError')
```

#### Uses
- [Error bars on evals › Comparing two models](#/eval-stats/comparing-two-models)
- [Large numbers & the CLT › Standard error](#/clt/standard-error)

#### Hints
- Check that the lists have the same length and at least 2 items.
- Write one small helper for the standard deviation with `n - 1`, and use it three times: on the differences, on `a` and on `b`.
- The paired error is the standard deviation of the differences over `math.sqrt(n)`. The unpaired one adds the two variances over `n` under one square root.

#### Tips
- `statistics.stdev` and `statistics.variance` both divide by `n - 1`, so either can stand in for your helper.
- Swapping the models flips the sign of the difference and leaves both errors alone.

#### Docs
- [Python docs: `statistics.variance`](https://docs.python.org/3/library/statistics.html#statistics.variance)
- [Python docs: `zip`](https://docs.python.org/3/library/functions.html#zip)

### 3. Clustered standard error

Write `clustered_se(scores, clusters)`, which returns the standard error of the mean score when questions come in clusters, as a float. `clusters[i]` is the cluster id of question `i`. With `mean = sum(scores) / n`, add up `s_i - mean` within each cluster to get one sum per cluster. Then `SE = math.sqrt(sum of the squared cluster sums) / n`. Raise `ValueError` when the lists have different lengths or are empty.

```python starter
import math

def clustered_se(scores, clusters):
    ...
```

```python test
SC = [1, 1, 0, 1, 0, 0, 1, 1]

def test_each_question_its_own_cluster():
    """singleton clusters give sqrt(sum of squared deviations) over n"""
    assert round(clustered_se(SC, list(range(8))), 9) == 0.171163299

def test_ids_need_not_be_contiguous():
    """members of a cluster can be spread through the list"""
    assert round(clustered_se(SC, ['p', 'q', 'p', 'q', 'p', 'q', 'p', 'q']), 9) == 0.088388348

def test_clustering_raises_the_error():
    """questions that agree inside a cluster give a larger error"""
    scores = [1] * 25 + [0] * 25 + [1] * 25 + [0] * 25
    clusters = ['a'] * 25 + ['b'] * 25 + ['c'] * 25 + ['d'] * 25
    assert round(clustered_se(scores, clusters), 9) == 0.25
    assert round(clustered_se(scores, list(range(100))), 9) == 0.05

def test_bad_input():
    """different lengths or empty input raise ValueError"""
    for scores, clusters in [([1, 0, 1], ['a', 'b']), ([], [])]:
        try:
            clustered_se(scores, clusters)
        except ValueError:
            pass
        else:
            raise AssertionError('bad input should have raised ValueError')
```

#### Uses
- [Error bars on evals › Clustered questions](#/eval-stats/clustered-questions)
- [Error bars on evals › Standard error of a score](#/eval-stats/standard-error-of-a-score)

#### Hints
- Check the lengths, then compute the overall mean once.
- Keep a dict from cluster id to a running sum of `s - mean`. `dict.get(c, 0)` starts a new cluster at 0.
- Square each cluster's sum, add the squares, take the square root and divide by `n`.

#### Tips
- Cluster ids can be anything hashable: numbers, strings, tuples. They do not need to be next to each other in the list.
- With every question in its own cluster you get the naive error, with `n` in place of `n - 1`. That is a quick check.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)
- [Miller (2024), Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640)

### 4. How many questions

Write `questions_needed(delta, sd_diff, z_alpha=1.96, z_beta=0.84)`, which returns the number of questions as an `int`. `delta` is the score difference you want to detect and `sd_diff` is the standard deviation of the per-question differences between the two models. The answer is `math.ceil(((z_alpha + z_beta) * sd_diff / delta) ** 2)`. Raise `ValueError` when `delta <= 0` or `sd_diff <= 0`.

```python starter
import math

def questions_needed(delta, sd_diff, z_alpha=1.96, z_beta=0.84):
    ...
```

```python test
def test_anchor():
    """detect a 3 point difference"""
    assert questions_needed(0.03, 0.5) == 2178
    assert questions_needed(0.05, 0.4) == 502
    assert isinstance(questions_needed(0.03, 0.5), int)

def test_halving_delta():
    """half the difference needs about four times the questions"""
    assert questions_needed(0.015, 0.5) == 8712
    assert 3.9 < questions_needed(0.015, 0.5) / questions_needed(0.03, 0.5) < 4.1

def test_other_z_values():
    """a stricter level and more power need more questions"""
    assert questions_needed(0.03, 0.5, z_alpha=2.58, z_beta=1.28) == 4139

def test_bad_input():
    """a delta or spread of 0 or below raises ValueError"""
    for delta, sd in [(0, 0.5), (-0.03, 0.5), (0.03, 0), (0.03, -0.5)]:
        try:
            questions_needed(delta, sd)
        except ValueError:
            pass
        else:
            raise AssertionError(f'delta={delta}, sd_diff={sd} should have raised ValueError')
```

#### Uses
- [Error bars on evals › How many questions](#/eval-stats/how-many-questions)
- [A/B tests › Sample size](#/ab-testing/sample-size)
- [Hypothesis tests › Errors and power](#/hypothesis-tests/errors-and-power)

#### Hints
- Raise when `delta` or `sd_diff` is 0 or below.
- Multiply the sum of the z values by `sd_diff`, divide by `delta`, and square.
- Round up to a whole number of questions.

#### Tips
- The ratio is squared, so half the difference needs about four times the questions.
- `NormalDist().inv_cdf(0.975)` and `NormalDist().inv_cdf(0.8)` give the unrounded z values if you want them.

#### Docs
- [Python docs: `math.ceil`](https://docs.python.org/3/library/math.html#math.ceil)
- [Miller (2024), Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640)
