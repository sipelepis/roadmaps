# Sampling & bias

Draw fair samples from a stream, split a sample across strata, and reweight a biased sample.

## Who got sampled

An estimate is only as good as the way the sample was picked. Three problems come up again and again. Selection bias: the way you pick rows favors some of them, such as surveying only the people who visit your site. Non-response: you ask everyone, but the people who answer differ from those who do not. Survivorship: you look only at what is still around, such as the services that did not shut down, and miss the ones that did.

Simulate non-response. The population is 10,000 values spread evenly from 0 to 100, so its mean is about 50. A value `x` answers with probability `x / 100`, so larger values answer more often:

```python
import random
import statistics

rng = random.Random(11)
pop = [rng.random() * 100 for _ in range(10000)]
resp = [x for x in pop if rng.random() < x / 100]
for n in (100, 1000, len(resp)):
    print(n, round(statistics.fmean(resp[:n]), 2), round(statistics.fmean(pop[:n]), 2))
```

The population mean is `49.7`, and `4955` values respond. The first column is the sample size and the second is the mean of that many responders. The third is the mean of the first `n` values of the population, which is a fair sample because the population is in random order. The rows are `100 65.93 47.24`, `1000 66.32 50.75` and `4955 66.46 49.56`. The fair sample wobbles around 50 and tightens as it grows. The responders sit near 66 whatever the size. A biased sample does not get better with size: more rows only make you more sure of the wrong number.

## Simple random samples

A simple random sample of `k` items from `N` gives every subset of size `k` the same chance. Each item is in the sample with probability `k / N`. The standard library does it with `rng.sample(population, k)`, and `rng.shuffle(xs)` reorders a list in place so you can take its first `k` items. Both use only the generator you pass in, so a seed makes them repeatable on one Python version.

The exact items they return can change between Python versions, even for the same seed. Only `rng.random()` has a promise of staying the same. So check the properties of a sample and not its exact contents:

```python
s = random.Random(2).sample(range(100), 5)
print(len(s), len(set(s)), all(0 <= x < 100 for x in s))
```

This prints `5 5 True`: five items, no repeats, all in range. Sampling here is without replacement, so an item cannot appear twice. If you need a sample that every machine reproduces exactly, build it from `rng.random()` yourself, as the next section does.

## Sampling a stream

Sometimes you cannot hold the whole population: a log that is still growing, or a feed you read once. Reservoir sampling (Algorithm R, Vitter 1985) keeps a fair sample of size `k` from a stream of unknown length in one pass:

```python
def reservoir(stream, k, rng):
    res = []
    for i, item in enumerate(stream, 1):
        if i <= k:
            res.append(item)
        else:
            j = int(rng.random() * i)
            if j < k:
                res[j] = item
    return res
```

The first `k` items go straight in. The `i`-th item after that, counting from 1, picks a slot `j` from `0` to `i - 1`. If `j` is one of the `k` slots, the item takes it. The chance that the `i`-th item gets in at all is `k / i`, and that shrinks as the stream grows. At the end every item has been kept with probability `k / n`. `reservoir(range(20), 5, random.Random(4))` returns `[9, 8, 18, 17, 19]`.

You can check the claim by running it. Sample 3 of the numbers 0 to 9, 5,000 times, and count how often each number appears. Each should be in about 30% of the samples. With `random.Random(12)` the shares run from `0.2916` to `0.3078`.

## Stratified samples

When the population has groups, a simple random sample can miss a small group by chance. A stratified sample fixes the number of rows from each group, in proportion to its size, and samples inside each group. For a total of `n` rows, group `g` with size `size_g` out of `total` gets a quota of `n * size_g / total`. Quotas are rarely whole numbers.

Take groups of 7, 5 and 3 and a sample of `n = 4`. The quotas are `1.8667`, `1.3333` and `0.8`. Rounding each one gives 2, 1 and 1, which happens to add up to 4. It does not always: three equal groups with `n = 2` have quotas of `0.6667` each, every one rounds to 1, and the total is 3.

Largest-remainder rounding always adds up. Give every group the floor of its quota, then hand out the units still missing, one at a time, to the groups with the biggest fractional parts. For the 7, 5 and 3 groups, the floors are 1, 1 and 0, so two units remain. The remainders are `0.8667`, `0.3333` and `0.8`, so the first and third groups get them, and the result is 2, 1 and 1. Use `Fraction` from the standard library for the quotas, so a tie between two remainders is a real tie and not a rounding accident.

## Weights

Sometimes you cannot control who is in the sample, but you know the population. Then you give each row a weight. Two kinds of weights show up here.

Sampling weights make a draw favor some items. Keep a running total of the weights, draw a point `u` between 0 and the total, and find which item's range holds it. `bisect` finds that in a sorted list. For weights `[5, 3, 2]` the running totals are `[5, 8, 10]`. A `u` in `[0, 5)` lands on the first item, `[5, 8)` on the second and `[8, 10)` on the third:

```python
import bisect
import itertools

cum = list(itertools.accumulate([5, 3, 2]))
rng = random.Random(3)
picks = [['red', 'green', 'blue'][bisect.bisect_right(cum, rng.random() * cum[-1])] for _ in range(10000)]
print({c: picks.count(c) / 10000 for c in ('red', 'green', 'blue')})
```

This prints `{'red': 0.5054, 'green': 0.2893, 'blue': 0.2053}`, close to 0.5, 0.3 and 0.2. The standard library already has this as `rng.choices(items, weights=weights, k=...)`, which uses the same idea.

Post-stratification weights correct a sample whose mix is wrong. Say 70 of 100 respondents are online customers, but online customers are 40% of the population and store customers are 60%. A group's weight is its population share divided by its sample share: `0.4 / 0.7 = 0.5714` for online and `0.6 / 0.3 = 2.0` for store. Store rows count double and online rows count about half. The weighted mean is `sum(w * value) / sum(w)`. For seven online values and three store values, the plain mean is `17.4` and the weighted mean is `22.8`. The store values are higher, and the weights give them the share they have in the population.

```python playground
import bisect
import itertools
import random
import statistics

# Non-response bias: a bigger sample of responders stays wrong.
rng = random.Random(11)
pop = [rng.random() * 100 for _ in range(10000)]
resp = [x for x in pop if rng.random() < x / 100]
print('population mean', round(statistics.fmean(pop), 2))
for n in (100, 1000, len(resp)):
    print(n, round(statistics.fmean(resp[:n]), 2), round(statistics.fmean(pop[:n]), 2))


def reservoir(stream, k, rng):
    res = []
    for i, item in enumerate(stream, 1):
        if i <= k:
            res.append(item)
        else:
            j = int(rng.random() * i)
            if j < k:
                res[j] = item
    return res


print(reservoir(range(20), 5, random.Random(4)))

# Weighted picks with running totals.
cum = list(itertools.accumulate([5, 3, 2]))
rng = random.Random(3)
names = ['red', 'green', 'blue']
picks = [names[bisect.bisect_right(cum, rng.random() * cum[-1])] for _ in range(10000)]
print({c: picks.count(c) / 10000 for c in names})

# Post-stratification: weight = population share / sample share.
weights = {'online': 0.4 / 0.7, 'store': 0.6 / 0.3}
rows = [('online', v) for v in (12, 15, 9, 14, 11, 13, 10)] + [('store', v) for v in (30, 26, 34)]
print(sum(v for _, v in rows) / len(rows))
print(sum(weights[g] * v for g, v in rows) / sum(weights[g] for g, _ in rows))

# Try: make responders answer with probability (x / 100) ** 2 and watch the bias grow.
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

#### Uses
- [Sampling & bias › Sampling a stream](#/sampling/sampling-a-stream)
- [Sampling & bias › Simple random samples](#/sampling/simple-random-samples)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- Validate `k` first. Then walk the stream with `enumerate(stream, 1)` so you have the item and its position `i` counting from 1.
- While `i <= k`, just append. No draw.
- After that, draw once: `j = int(rng.random() * i)`. Replace `res[j]` only when `j < k`.
- Never call `len` on the stream or turn it into a list. It may be a generator you can read only once.

#### Tips
- The draw is made for every item after the first `k`, even when `j` turns out to be too large to use. The test counts those draws.
- Memory stays at `k` items however long the stream is.

#### Docs
- [Python docs: `enumerate`](https://docs.python.org/3/library/functions.html#enumerate)
- [Vitter 1985: Random Sampling with a Reservoir](https://doi.org/10.1145/3147.3165)

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

#### Uses
- [Sampling & bias › Stratified samples](#/sampling/stratified-samples)
- [Probability rules › Counting outcomes](#/probability/counting-outcomes)

#### Hints
- Check that the sizes add up to more than 0 before anything else.
- Work out each stratum's quota as `Fraction(n * size, total)`. Fractions keep ties exact.
- Start every stratum at `math.floor(quota)`. The amount `n - sum(floors)` is how many units are left.
- Rank the strata by fractional remainder, largest first. Python's sort is stable, so equal remainders keep the order of `sizes`. Give one unit to each of the first strata in that order.

#### Tips
- Float quotas can make two equal remainders look different. That is why the quotas are `Fraction`s.
- Sorting by `-(quota - floor)` keeps the tie order without any extra key.

#### Docs
- [Python docs: `fractions.Fraction`](https://docs.python.org/3/library/fractions.html)
- [Python docs: sorting stability](https://docs.python.org/3/howto/sorting.html#sort-stability-and-complex-sorts)

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

#### Uses
- [Sampling & bias › Weights](#/sampling/weights)
- [Random variables › Sampling from a PMF](#/random-variables/sampling-from-a-pmf)

#### Hints
- Raise `ValueError` for an empty `items`, any negative weight, or a total of 0 before you draw.
- `itertools.accumulate(weights)` gives the running totals. The last one is the total.
- Draw `u = rng.random() * cum[-1]`, which is a point between 0 and the total.
- `bisect.bisect_right(cum, u)` returns the index of the first running total above `u`. That index picks the item.

#### Tips
- `bisect_right` rather than `bisect_left` is why a weight-0 item can never be chosen: its range is empty.
- `rng.choices(items, weights)` does the same job in one call, but build it once by hand to see how.

#### Docs
- [Python docs: `bisect.bisect_right`](https://docs.python.org/3/library/bisect.html#bisect.bisect_right)
- [Python docs: `itertools.accumulate`](https://docs.python.org/3/library/itertools.html#itertools.accumulate)

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

#### Uses
- [Sampling & bias › Weights](#/sampling/weights)
- [Sampling & bias › Who got sampled](#/sampling/who-got-sampled)

#### Hints
- Add up `sample_counts` to get `total`. A group's sample share is `sample_counts[g] / total`.
- Loop over `population_shares`. For each group, raise `ValueError` if its sample count is 0 or missing, then store `share / sample_share`.
- For `weighted_mean`, add up `weights[group] * value` over the rows, and add up the weights of the same rows. Divide the first by the second.
- Use the weight of each row's own group, once per row, so a group with more rows counts more.

#### Tips
- The weights are built so that the weighted sample mix matches the population mix.
- A very large weight means a thin group. Few rows carry a lot of influence, so the estimate gets noisy.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)
