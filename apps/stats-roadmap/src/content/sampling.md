# Sampling & bias

Draw fair samples from a stream, split a sample across strata, and reweight a biased sample.

## Who got sampled

Not written yet.

## Simple random samples

Not written yet.

## Sampling a stream

Not written yet.

## Stratified samples

Not written yet.

## Weights

Not written yet.

```python playground
print("This module is not written yet.")
```

## Exercises

### 1. Reservoir sampling

Write `reservoir(stream, k, rng)`, which returns a uniform random sample of `k` items from `stream` in one pass, without knowing how long the stream is (Algorithm R). `stream` can be any iterable, including a generator you can read only once. Keep the first `k` items in a list `res` without drawing anything. For each item after those, let `i` be its position counting from 1, so the first such item has `i = k + 1`. Draw `j = int(rng.random() * i)` and set `res[j] = item` when `j < k`. That is exactly one `rng.random()` per item after the first `k`. Return `res`. When the stream has fewer than `k` items, return all of them in order and draw nothing. Raise `ValueError` when `k` is less than 1.

```python starter
def reservoir(stream, k, rng):
    ...
```

```python test
import random


def test_exact_sample():
    """same seed, same sample, from a range or a generator"""
    assert reservoir(range(20), 5, random.Random(4)) == [9, 8, 18, 17, 19]
    assert reservoir((x * x for x in range(12)), 4, random.Random(9)) == [121, 1, 25, 9]


def test_draws():
    """one draw per item after the first k, none for a short stream"""
    rng = random.Random(2)
    assert reservoir(iter('abcdefghij'), 3, rng) == ['g', 'b', 'c']
    other = random.Random(2)
    for _ in range(7):
        other.random()
    assert rng.getstate() == other.getstate()
    rng = random.Random(3)
    assert reservoir([4, 1, 7], 5, rng) == [4, 1, 7]
    assert rng.getstate() == random.Random(3).getstate()


def test_bad_k():
    """k below 1 raises ValueError"""
    for k in (0, -2):
        try:
            reservoir([1, 2, 3], k, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError(f'k of {k} should have raised ValueError')


def test_uniform():
    """each of 10 items lands in a sample of 3 about 30% of the time"""
    rng = random.Random(12)
    counts = [0] * 10
    for _ in range(5000):
        for x in reservoir(range(10), 3, rng):
            counts[x] += 1
    for c in counts:
        assert abs(c / 5000 - 0.3) < 0.03
```

### 2. Stratified allocation

Write `allocate(sizes, n)`. `sizes` maps each stratum to its population size, and `n` is the total sample size to split across the strata in proportion to size. Return a dict with the same keys whose values are whole numbers adding up to exactly `n`. Use largest remainders. Stratum `g` has the exact quota `Fraction(n * sizes[g], total)`, where `total` is the sum of all the sizes. Give each stratum the floor of its quota, then hand out the units still left over one at a time, to the strata with the largest fractional remainders. When remainders tie, the stratum that comes first in `sizes` goes first. With `n = 0` every stratum gets 0. Raise `ValueError` when the sizes add up to 0.

```python starter
import math
from fractions import Fraction


def allocate(sizes, n):
    ...
```

```python test
def test_proportional():
    """parts follow the sizes"""
    assert allocate({'north': 7, 'south': 5, 'east': 3}, 4) == {'north': 2, 'south': 1, 'east': 1}
    assert allocate({'s1': 17, 's2': 29, 's3': 8, 's4': 46}, 33) == {'s1': 6, 's2': 9, 's3': 3, 's4': 15}


def test_ties():
    """equal remainders go to the stratum listed first"""
    assert allocate({'a': 3, 'b': 1, 'c': 1}, 3) == {'a': 2, 'b': 1, 'c': 0}
    assert allocate({'c': 1, 'b': 1, 'a': 3}, 3) == {'c': 1, 'b': 0, 'a': 2}
    assert allocate({'web': 640, 'app': 250, 'kiosk': 110}, 50) == {'web': 32, 'app': 13, 'kiosk': 5}


def test_sums_to_n():
    """the parts always add up to n"""
    sizes = {'s1': 17, 's2': 29, 's3': 8, 's4': 46}
    for n in range(40):
        assert sum(allocate(sizes, n).values()) == n


def test_zero():
    """n of 0 gives zeros and a total size of 0 raises ValueError"""
    assert allocate({'a': 2, 'b': 5}, 0) == {'a': 0, 'b': 0}
    try:
        allocate({'a': 0, 'b': 0}, 5)
    except ValueError:
        pass
    else:
        raise AssertionError('a total size of 0 should have raised ValueError')
```

### 3. Weighted pick

Write `weighted_pick(items, weights, rng)`, which returns one item from `items`, chosen with probability proportional to its weight in `weights`. Build the running totals with `cum = list(itertools.accumulate(weights))`, draw `u = rng.random() * cum[-1]`, and return `items[bisect.bisect_right(cum, u)]`. That is exactly one `rng.random()` per call, and an item with weight 0 is never picked. Raise `ValueError` when `items` is empty, when any weight is negative, or when the weights add up to 0.

```python starter
import bisect
import itertools


def weighted_pick(items, weights, rng):
    ...
```

```python test
import random


def test_exact_sequence():
    """same seed, same picks"""
    rng = random.Random(3)
    got = [weighted_pick(['red', 'green', 'blue'], [5, 3, 2], rng) for _ in range(12)]
    assert got == ['red', 'green', 'red', 'green', 'green', 'red', 'red', 'blue', 'red', 'red', 'blue', 'red']


def test_frequencies():
    """picked in proportion to the weights"""
    rng = random.Random(8)
    picks = [weighted_pick(['a', 'b', 'c'], [1, 2, 7], rng) for _ in range(20000)]
    assert abs(picks.count('a') / 20000 - 0.1) < 0.009
    assert abs(picks.count('b') / 20000 - 0.2) < 0.012
    assert abs(picks.count('c') / 20000 - 0.7) < 0.014


def test_zero_weight():
    """an item with weight 0 is never picked"""
    rng = random.Random(5)
    picks = [weighted_pick(['a', 'b', 'c', 'd'], [0, 4, 0, 1], rng) for _ in range(3000)]
    assert sorted(set(picks)) == ['b', 'd']


def test_bad_weights():
    """empty input, a negative weight or a total of 0 raises ValueError"""
    for items, weights in (([], []), (['a', 'b'], [2, -1]), (['a', 'b'], [0, 0])):
        try:
            weighted_pick(items, weights, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError(f'weights {weights} should have raised ValueError')
```

### 4. Post-stratification weights

Write `post_strat_weights(sample_counts, population_shares)`. `sample_counts` maps each group to how many rows of your sample fall in it, and `population_shares` maps each group to its share of the population, with the shares adding up to 1. Return a dict mapping each group in `population_shares` to the weight `population_shares[g] / (sample_counts[g] / total)`, where `total` is the sum of all the sample counts. A group your sample under-represents gets a weight above 1. Raise `ValueError` when a group with a population share has a sample count of 0, since no weight can stand in for rows you never saw.

Then write `weighted_mean(rows, weights)`. `rows` is a list of `(group, value)` pairs and `weights` maps each group to a weight. Return `sum(w * value) / sum(w)` over the rows, where `w` is the weight of the row's group.

```python starter
def post_strat_weights(sample_counts, population_shares):
    ...


def weighted_mean(rows, weights):
    ...
```

```python test
def test_weights():
    """population share over sample share"""
    got = post_strat_weights({'online': 70, 'store': 30}, {'online': 0.4, 'store': 0.6})
    assert {g: round(w, 9) for g, w in got.items()} == {'online': 0.571428571, 'store': 2.0}
    got = post_strat_weights({'a': 50, 'b': 30, 'c': 20}, {'a': 0.25, 'b': 0.35, 'c': 0.4})
    assert {g: round(w, 9) for g, w in got.items()} == {'a': 0.5, 'b': 1.166666667, 'c': 2.0}


def test_weighted_mean():
    """each row counts with its group's weight"""
    rows = [('a', 1.0), ('b', 4.0), ('a', 3.0)]
    assert round(weighted_mean(rows, {'a': 1, 'b': 2}), 9) == 3.0
    assert round(weighted_mean(rows, {'a': 0.5, 'b': 3}), 9) == 3.5


def test_corrected_mean():
    """reweighting moves the mean toward the population"""
    rows = [('online', v) for v in (12, 15, 9, 14, 11, 13, 10)] + [('store', v) for v in (30, 26, 34)]
    naive = weighted_mean(rows, {'online': 1, 'store': 1})
    corrected = weighted_mean(rows, post_strat_weights({'online': 7, 'store': 3}, {'online': 0.4, 'store': 0.6}))
    assert round(naive, 9) == 17.4
    assert round(corrected, 9) == 22.8
    assert round(corrected - naive, 9) == 5.4


def test_empty_group():
    """a group with a share but no sampled rows raises ValueError"""
    try:
        post_strat_weights({'online': 10, 'store': 0}, {'online': 0.5, 'store': 0.5})
    except ValueError:
        pass
    else:
        raise AssertionError('a group with no sampled rows should have raised ValueError')
```
