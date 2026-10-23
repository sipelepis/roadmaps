# Correlation & causation

Measure how two columns move together, rank-based and linear, and see how grouping can reverse a trend.

## Covariance

Two columns move together when, for the same row, one is above its mean exactly when the other is. Covariance measures that. For each row, multiply the two deviations from their means, then average with `n - 1`, the same convention as the sample variance in [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation):

```
cov(x, y) = sum((x_i - mean_x) * (y_i - mean_y)) / (n - 1)
```

```python
import statistics

xs = [1, 2, 3, 4, 5, 6]
ys = [2, 1, 4, 3, 7, 5]
print(statistics.covariance(xs, ys))
print(statistics.covariance([10 * x for x in xs], ys))
```

This prints `3.2` and then `32.0`. The sign is the direction: positive means they rise together, negative means one rises as the other falls. The size is not so easy to read. Multiply `x` by 10, say by switching meters to decimeters, and the covariance grows by 10 though the relationship did not change. Worked by hand: the products of deviations sum to 16, and `16 / 5 = 3.2`.

## Pearson correlation

Divide out the units and the size becomes readable. Pearson's correlation is the covariance divided by both standard deviations:

```
r = cov(x, y) / (sd_x * sd_y)
```

It always lies in `[-1, 1]`. At `1` the points sit on a rising straight line, at `-1` on a falling one, and near 0 there is no linear trend. Scaling either column leaves it alone.

```python
print(round(statistics.correlation(xs, ys), 9))
print(round(statistics.correlation([10 * x for x in xs], ys), 9))
```

Both print `0.791794655`. By hand, the sums are `16`, `17.5` and `23.333...`, and `16 / sqrt(17.5 * 23.333...)` is that number.

Two cautions. The word to remember is linear: a perfect curve can have an `r` well below 1, and a U shape can have `r` near 0 while `y` depends completely on `x`. And `r` is undefined when either column is constant, because its standard deviation is 0. A function should raise `ValueError` there.

## Rank correlation

Replace each value with its rank, 1 for the smallest, and take the Pearson correlation of the ranks. That is Spearman's correlation. It asks whether the order matches, not whether the points fall on a line, so any steadily rising curve scores 1.

Ties need a rule. Tied values share the average of the ranks they would have taken. In `[10, 20, 20, 30]` the two 20s would take ranks 2 and 3, so both get `2.5`, and the ranks are `[1.0, 2.5, 2.5, 4.0]`.

```python
x = list(range(1, 9))
y = [v ** 3 for v in x]
print(round(statistics.correlation(x, y), 3))
print(round(statistics.correlation(x, y, method='ranked'), 3))
```

This prints `0.932` and then `1.0`. The cubes always rise, so the order agrees perfectly, but they curve, so the straight-line score is lower. The `method='ranked'` option is in Python 3.12 and later, and does the ranking, ties included, for you. With ties the two scores can differ a lot: for `[1, 2, 2, 3, 5]` and `[2, 4, 3, 3, 9]` Pearson is `0.914853279` and Spearman is `0.763157895`.

## Correlation is not causation

A strong correlation says the columns move together. It does not say why. There are three common reasons besides "x causes y". Reverse causation: y causes x. A confounder: a third variable drives both. Chance: with few rows, unrelated columns correlate by luck.

A simulation makes the confounder concrete. Temperature drives both ice cream sales and swimming, and neither affects the other:

```python
import random

rng = random.Random(3)
temp = [rng.random() * 30 for _ in range(200)]
ice = [2 * t + 10 * rng.random() for t in temp]
swim = [3 * t + 10 * rng.random() for t in temp]
print(round(statistics.correlation(ice, swim), 3))
```

This prints `0.981`: ice cream and swimming look nearly locked together. Now hold temperature almost fixed, keeping only days between 14 and 16 degrees. There are 11 such days, and the correlation there is `-0.237`, close to nothing. Once the confounder is held still, the link disappears. Keeping a variable fixed to see what is left is the basic move for separating a cause from a confounder.

## Simpson's paradox

Sometimes a comparison that holds inside every group reverses when you pool the groups. Take two treatments, A and B, applied to small and large cases, with `(successes, trials)`:

```
small cases: A 9/10   = 0.9    B 80/100 = 0.8
large cases: A 30/100 = 0.3    B 2/10   = 0.2
```

A wins in both groups. Pool them and A has `39/110 = 0.3545` while B has `82/110 = 0.7455`: B wins. The reason is the group sizes. A was given mostly the hard, large cases, B mostly the easy ones, so each arm's pooled rate is mostly the rate of the group it got most of. This is Simpson's paradox, covered in many places, for example in [Harvard's Stat 110, Lecture 6](https://stat110.hsites.harvard.edu/youtube).

Neither answer is the right one on its own. The pooled rate answers a question about who got which cases, and the within-group rates answer a question about the treatment. Which you want depends on whether group membership is a confounder, and the data alone cannot say. To check for a reversal, compare exact rates as `fractions.Fraction` so that ties are real ties and not float noise. A group where an arm has 0 trials has no rate at all, and should raise `ValueError`.

```python playground
import random
import statistics
from fractions import Fraction

xs = [1, 2, 3, 4, 5, 6]
ys = [2, 1, 4, 3, 7, 5]
print('cov', statistics.covariance(xs, ys), statistics.covariance([10 * x for x in xs], ys))
print('pearson', round(statistics.correlation(xs, ys), 9))

x = list(range(1, 9))
y = [v ** 3 for v in x]
print('cubes', round(statistics.correlation(x, y), 3), round(statistics.correlation(x, y, method='ranked'), 3))
print('ties', round(statistics.correlation([1, 2, 2, 3, 5], [2, 4, 3, 3, 9]), 9),
      round(statistics.correlation([1, 2, 2, 3, 5], [2, 4, 3, 3, 9], method='ranked'), 9))

rng = random.Random(3)
temp = [rng.random() * 30 for _ in range(200)]
ice = [2 * t + 10 * rng.random() for t in temp]
swim = [3 * t + 10 * rng.random() for t in temp]
print('confounded', round(statistics.correlation(ice, swim), 3))
band = [(i, s) for t, i, s in zip(temp, ice, swim) if 14 < t < 16]
print('same weather', len(band), round(statistics.correlation([b[0] for b in band], [b[1] for b in band]), 3))

groups = {'small': {'A': (9, 10), 'B': (80, 100)}, 'large': {'A': (30, 100), 'B': (2, 10)}}
for name, arms in groups.items():
    print(name, {arm: float(Fraction(s, t)) for arm, (s, t) in arms.items()})
pooled = {arm: Fraction(sum(g[arm][0] for g in groups.values()), sum(g[arm][1] for g in groups.values())) for arm in 'AB'}
print('pooled', {arm: round(float(r), 4) for arm, r in pooled.items()})

# Try: change the small-case trials of A until the reversal goes away.
```

## Exercises

### 1. Pearson from scratch

Write `pearson(xs, ys)`, the Pearson correlation `cov(x, y) / (sd_x * sd_y)`. Use the sample versions, with `n - 1`, for all three. Return a float in `[-1, 1]`. Raise `ValueError` if the lists have different lengths, if there are fewer than 2 points, or if either list is constant, because the correlation is undefined then.

```python starter
import math


def pearson(xs, ys):
    ...
```

```python test
def test_known_value():
    """rounded correlation for a small table"""
    xs = [1, 2, 3, 4, 5, 6]
    ys = [2, 1, 4, 3, 7, 5]
    assert round(pearson(xs, ys), 9) == 0.791794655


def test_perfect_lines():
    """exact lines give plus or minus one"""
    assert round(pearson([1, 2, 3, 4], [3, 5, 7, 9]), 9) == 1.0
    assert round(pearson([1, 2, 3, 4], [9, 7, 5, 3]), 9) == -1.0


def test_scaling():
    """multiplying x by 10 changes nothing"""
    xs = [1, 2, 3, 4, 5, 6]
    ys = [2, 1, 4, 3, 7, 5]
    assert round(pearson([10 * x for x in xs], ys), 9) == 0.791794655


def test_bad_inputs():
    """mismatched, short or constant input raises ValueError"""
    for xs, ys in (([1, 2, 3], [1, 2]), ([1], [1]), ([], []), ([1, 2, 3], [4, 4, 4]), ([2, 2, 2], [1, 2, 3])):
        try:
            pearson(xs, ys)
        except ValueError:
            pass
        else:
            raise AssertionError('bad input should have raised ValueError')
```

#### Uses
- [Correlation & causation › Pearson correlation](#/correlation/pearson-correlation)
- [Correlation & causation › Covariance](#/correlation/covariance)

#### Hints
- Check the lengths and the count first.
- Compute both means. Then three sums: the products of deviations, and the squared deviations of each column.
- The `n - 1` in the covariance and in the two standard deviations cancels, so the ratio of the three sums gives the same answer.
- If either sum of squared deviations is 0, that column is constant: raise `ValueError`. Otherwise `r = sum_xy / sqrt(sum_xx * sum_yy)`.

#### Tips
- The result can land a hair outside `[-1, 1]` from rounding on a perfect line. Rounding in the test absorbs that.
- Once you have written it, `statistics.correlation(xs, ys)` computes the same thing.

#### Docs
- [Python docs: `statistics.correlation`](https://docs.python.org/3/library/statistics.html#statistics.correlation)
- [Python docs: `statistics.covariance`](https://docs.python.org/3/library/statistics.html#statistics.covariance)

### 2. Spearman with ties

Write `ranks(xs)`, which returns the 1-based rank of each value as floats in the input order. Tied values share the average of the ranks they would have taken. `ranks([])` is `[]`, and a list of all equal values of length `n` gives `(n + 1) / 2` everywhere. Write `spearman(xs, ys)`, the Pearson correlation of `ranks(xs)` and `ranks(ys)`, using `statistics.correlation`. Constant input raises `ValueError`.

```python starter
import statistics


def ranks(xs):
    ...


def spearman(xs, ys):
    ...
```

```python test
import statistics


def test_ranks_with_ties():
    """tied values share the average rank"""
    assert ranks([10, 20, 20, 30]) == [1.0, 2.5, 2.5, 4.0]
    assert ranks([30, 10, 20]) == [3.0, 1.0, 2.0]


def test_ranks_edges():
    """empty input and all-equal input"""
    assert ranks([]) == []
    assert ranks([5, 5, 5]) == [2.0, 2.0, 2.0]


def test_monotone_beats_pearson():
    """a rising curve scores 1 by rank and lower by line"""
    x = list(range(1, 9))
    y = [v ** 3 for v in x]
    assert round(spearman(x, y), 9) == 1.0
    assert round(statistics.correlation(x, y), 3) == 0.932
    assert round(spearman([1, 2, 3, 4], [40, 30, 20, 10]), 9) == -1.0


def test_spearman_with_ties():
    """rounded score when both columns have ties"""
    assert round(spearman([1, 2, 2, 3, 5], [2, 4, 3, 3, 9]), 9) == 0.763157895
```

#### Uses
- [Correlation & causation › Rank correlation](#/correlation/rank-correlation)
- [Correlation & causation › Pearson correlation](#/correlation/pearson-correlation)

#### Hints
- Sort the indices by value, not the values, so you can write each rank back to the right place.
- Walk through the sorted order and find each run of equal values.
- A run covering sorted positions `i` to `j` (0-based) gets the average rank `(i + j) / 2 + 1`.
- `spearman` is then one call: the Pearson correlation of the two rank lists.

#### Tips
- Do not compare floats with `==` in your own tests. The ranks here are exact halves, so comparing them is safe.
- `statistics.correlation(xs, ys, method='ranked')` does the ranking and the correlation together. Writing `ranks` yourself shows what it does.

#### Docs
- [Python docs: `sorted`](https://docs.python.org/3/library/functions.html#sorted)
- [Python docs: `statistics.correlation`](https://docs.python.org/3/library/statistics.html#statistics.correlation)

### 3. Spot Simpson's reversal

Write `simpson_reversal(groups)`. `groups` is a dict from group name to a dict with keys `'A'` and `'B'`, each a tuple `(successes, trials)`. Return `True` when one arm has the strictly higher success rate in every group and the strictly lower rate after pooling all groups, and `False` otherwise. Compare rates as `fractions.Fraction`, so ties are exact. Raise `ValueError` if an arm has 0 trials, or if `groups` is empty.

```python starter
from fractions import Fraction


def simpson_reversal(groups):
    ...
```

```python test
def test_reversal_found():
    """A wins every group and loses when pooled"""
    groups = {'small': {'A': (9, 10), 'B': (80, 100)}, 'large': {'A': (30, 100), 'B': (2, 10)}}
    assert simpson_reversal(groups) is True


def test_other_arm_reverses():
    """the same pattern with the arms swapped"""
    groups = {'small': {'B': (9, 10), 'A': (80, 100)}, 'large': {'B': (30, 100), 'A': (2, 10)}}
    assert simpson_reversal(groups) is True


def test_consistent_data():
    """A wins every group and wins pooled"""
    groups = {'small': {'A': (9, 10), 'B': (70, 100)}, 'large': {'A': (3, 10), 'B': (25, 100)}}
    assert simpson_reversal(groups) is False


def test_tie_in_a_group():
    """a tie inside a group is not a win"""
    groups = {'small': {'A': (8, 10), 'B': (80, 100)}, 'large': {'A': (3, 10), 'B': (2, 10)}}
    assert simpson_reversal(groups) is False


def test_zero_trials():
    """an arm with no trials raises ValueError"""
    try:
        simpson_reversal({'g': {'A': (0, 0), 'B': (1, 2)}})
    except ValueError:
        pass
    else:
        raise AssertionError('0 trials should have raised ValueError')
```

#### Uses
- [Correlation & causation › Simpson's paradox](#/correlation/simpsons-paradox)

#### Hints
- Loop over the groups. For each, turn each arm into a `Fraction(successes, trials)`.
- Keep two flags: A beat B in every group so far, and B beat A in every group so far. A tie makes both false.
- Keep running totals of successes and trials for each arm across all groups.
- After the loop compare the pooled fractions. A reversal is a clean sweep by one arm plus a strictly lower pooled rate for that same arm.

#### Tips
- Plain float division works on small data like this, but rates such as `1/3` and `2/6` are only equal because both round the same way. `Fraction` makes equal rates exactly equal, with no luck involved.
- Check the trial counts for 0 before you build the fraction, or `Fraction` raises `ZeroDivisionError` instead of the `ValueError` you want.

#### Docs
- [Python docs: `fractions.Fraction`](https://docs.python.org/3/library/fractions.html)
- [Harvard Stat 110, Lecture 6](https://stat110.hsites.harvard.edu/youtube)
