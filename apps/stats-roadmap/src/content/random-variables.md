# Random variables

Turn outcomes into numbers, compute expected values and variances, add random variables, and sample from any PMF.

## From outcomes to numbers

An outcome is a thing that happened: a card, a request, a customer. A random variable is a rule that turns each outcome into a number: the value of the die, the latency of the request, 1 if the customer churned and 0 if not. Once outcomes are numbers you can average them and add them.

The probability mass function, the PMF, lists each value with its probability. In Python it is a dict:

```python
from fractions import Fraction

die = {x: Fraction(1, 6) for x in range(1, 7)}
print(sum(die.values()))
```

This prints `1`. The probabilities must be non-negative and add to exactly 1, because something has to happen. Check this before you use a PMF: an empty one, or one that adds to 0.9, is a bug upstream. Allow a tolerance of `1e-9` for floats, since ten probabilities of `0.1` accumulate to `0.9999999999999999`. Fractions need no tolerance, which is another reason to use them for small cases.

A PMF can come from counting equally likely outcomes, as in Probability rules, or from data: count how often each value occurs and divide by the total.

## Expected value and variance

The expected value is the average you would get over many draws. Weight each value by its probability and add:

```
E[X] = sum of x * p(x)
```

For the die, `E[X] = (1 + 2 + 3 + 4 + 5 + 6) / 6 = 7/2`. No roll equals `3.5`. The expected value is a balance point, not a likely outcome.

The variance measures how far values land from `mu = E[X]`: `Var(X) = E[(X - mu) ** 2]`. A shortcut gives the same number: `Var(X) = E[X ** 2] - mu ** 2`. For the die, `E[X ** 2] = 91/6`, so `Var(X) = 91/6 - 49/4 = 35/12`. The standard deviation is the square root, `1.707825127659933`.

```python
mu = sum(x * p for x, p in die.items())
var = sum(p * (x - mu) ** 2 for x, p in die.items())
print(mu, var)
```

This prints `7/2 35/12`. Because the weights are `Fraction`, nothing rounds. Pass floats and you get floats. The same code works for either, as long as you never force a conversion.

You have seen `statistics.fmean` and `statistics.pvariance` on a list of data. A PMF is the same thing in compressed form, and the standard library has no function for it. `statistics.pvariance(range(1, 7))` gives `2.9166666666666665`, the float form of `35/12`, because a fair die is a list of six equally weighted values.

## Linearity of expectation

Expectation adds: `E[X + Y] = E[X] + E[Y]`. This holds even when X and Y depend on each other, and it is what makes expectations easy. The expected sum of two dice is `3.5 + 3.5 = 7`, with no table of 36 outcomes. Scaling works too: `E[a * X + b] = a * E[X] + b`. The variance is not so forgiving. `Var(X + Y) = Var(X) + Var(Y)` only when X and Y are independent.

A useful case: tries until the first success. Each try succeeds with probability `p`, and you retry until one does. The expected number of tries is `1 / p`. With `p = 0.25` that is 4. This is stated here, not derived. Check it by simulating:

```python
import random

rng = random.Random(5)
total = 0
for _ in range(20000):
    n = 1
    while rng.random() >= 0.25:
        n += 1
    total += n
print(total / 20000)
```

This prints `4.02255`. By linearity, a pipeline of jobs that each retry until success needs `1/p1 + 1/p2 + ...` tries in expectation. Three jobs with success rates 0.5, 0.25 and 0.1 need `2 + 4 + 10 = 16`.

A job with `p = 0` never succeeds, so the loop never ends and the expectation is infinite. Treat `p <= 0` as an error and raise `ValueError`.

## Sums of random variables

The sum of two dice is a new random variable. Its PMF is not the average of the two PMFs. For independent X and Y, every pair `(x, y)` has probability `p_x * p_y`, and it lands in the bucket `x + y`. Add those up:

```python
def convolve(pmf_x, pmf_y):
    out = {}
    for x, px in pmf_x.items():
        for y, py in pmf_y.items():
            out[x + y] = out.get(x + y, 0) + px * py
    return out

two = convolve(die, die)
print(len(two), two[7], two[2])
```

That prints `11 1/6 1/36`. There are 11 possible sums, 2 to 12. Seven is the likeliest at `1/6`, and 2 and 12 each come up with probability `1/36`. This operation is called convolution, and the loops above are all of it. It works for a pair of different PMFs, such as one die and one coin.

## Sampling from a PMF

To draw values with the probabilities in a PMF, use one uniform number. Lay the values end to end on `[0, 1)`, each taking a segment as long as its probability. The point `u = rng.random()` lands in one segment, and that segment's value is the draw.

Cumulative probabilities mark where each segment ends. `itertools.accumulate` builds them, and `bisect.bisect_right` finds the first cut point above `u`:

```python
from bisect import bisect_right
from itertools import accumulate

pmf = {'a': 0.5, 'b': 0.3, 'c': 0.2}
cum = list(accumulate(pmf.values()))
print(cum)
u = random.Random(1).random()
print(u, list(pmf)[bisect_right(cum, u)])
```

This prints `[0.5, 0.8, 1.0]`, then `0.13436424411240122 a`. The value is the first one whose cumulative probability is above `u`. This is inverse-CDF sampling. Values with probability 0 have a segment of length 0, so they are never chosen.

One edge case. Floats may add to `0.9999999999999999`. If `u` is above the last cumulative value, `bisect_right` runs off the end. Return the last value with a non-zero probability.

```python playground
import random
from bisect import bisect_right
from fractions import Fraction
from itertools import accumulate

die = {x: Fraction(1, 6) for x in range(1, 7)}


def expectation(pmf):
    return sum(x * p for x, p in pmf.items())


def variance(pmf):
    mu = expectation(pmf)
    return sum(p * (x - mu) ** 2 for x, p in pmf.items())


print(expectation(die), variance(die))


def convolve(a, b):
    out = {}
    for x, px in a.items():
        for y, py in b.items():
            out[x + y] = out.get(x + y, 0) + px * py
    return out


two = convolve(die, die)
print(len(two), two[7], expectation(two))


def sample_pmf(pmf, rng):
    values = list(pmf)
    cum = list(accumulate(pmf.values()))
    i = bisect_right(cum, rng.random())
    return values[min(i, len(values) - 1)]


pmf = {'a': 0.5, 'b': 0.3, 'c': 0.2}
rng = random.Random(1)
print([sample_pmf(pmf, rng) for _ in range(10)])

# Try: sample 20000 draws and count them. How close is each share to its probability?
```

## Exercises

### 1. Expectation and variance of a PMF

Write `expectation(pmf)` and `variance(pmf)`. `pmf` is a dict `{value: probability}`. `expectation` returns the sum of `x * p`, and `variance` returns the sum of `p * (x - mu) ** 2`. Both must work with float or `Fraction` probabilities, and return a `Fraction` when the probabilities are `Fraction`s. An empty `pmf`, or one whose probabilities do not add to 1 within `1e-9`, raises `ValueError`.

```python starter
def expectation(pmf):
    ...


def variance(pmf):
    ...
```

```python test
from fractions import Fraction

DIE = {x: Fraction(1, 6) for x in range(1, 7)}


def test_fair_die():
    """exact mean and variance of a fair die"""
    assert expectation(DIE) == Fraction(7, 2)
    assert variance(DIE) == Fraction(35, 12)
    assert isinstance(expectation(DIE), Fraction)
    assert isinstance(variance(DIE), Fraction)


def test_float_pmf():
    """a pmf with float probabilities"""
    pmf = {1: 0.2, 2: 0.3, 3: 0.5}
    assert round(expectation(pmf), 9) == 2.3
    assert round(variance(pmf), 9) == 0.61


def test_point_mass():
    """a value that always happens has no variance"""
    assert expectation({4: 1.0}) == 4.0
    assert variance({4: 1.0}) == 0.0


def test_bad_pmf():
    """empty or non-normalised pmfs raise ValueError"""
    for pmf in ({}, {1: 0.5, 2: 0.4}, {1: 0.5, 2: 0.5000001}):
        for f in (expectation, variance):
            try:
                f(pmf)
            except ValueError:
                pass
            else:
                raise AssertionError(f'{f.__name__}({pmf}) should have raised ValueError')
```

#### Uses
- [Random variables › From outcomes to numbers](#/random-variables/from-outcomes-to-numbers)
- [Random variables › Expected value and variance](#/random-variables/expected-value-and-variance)

#### Hints
- Check the PMF first: it must not be empty, and `abs(sum(pmf.values()) - 1)` must be at most `1e-9`.
- `expectation` is `sum(x * p for x, p in pmf.items())`. Do not convert to `float`, or a `Fraction` input would not stay exact.
- For `variance`, get `mu` from `expectation` and add up `p * (x - mu) ** 2`.
- Validation lives in one place if `variance` calls `expectation`, so it cannot be skipped.

#### Tips
- `Fraction` plus `int` stays a `Fraction`, so the sum of a `Fraction` PMF needs no special case.
- The shortcut `E[X ** 2] - mu ** 2` gives the same variance. Beware that with floats it can cancel badly when `mu` is large.

#### Docs
- [Python docs: `fractions`](https://docs.python.org/3/library/fractions.html)

### 2. Expected retries

Write `expected_attempts(ps) -> float` and `attempts_until_success(p, rng) -> int`. `expected_attempts` takes a list of success probabilities, one per job that retries until it succeeds, and returns the sum of `1 / p`. `attempts_until_success` draws `rng.random()` until a draw is below `p`, and returns how many draws it took. Any `p <= 0` raises `ValueError` in both.

```python starter
def expected_attempts(ps):
    ...


def attempts_until_success(p, rng):
    ...
```

```python test
import random


def test_expected_attempts():
    """one over p, added up across jobs"""
    assert round(expected_attempts([0.5, 0.25, 0.1]), 9) == 16.0
    assert round(expected_attempts([0.2, 0.4]), 9) == 7.5
    assert expected_attempts([1.0]) == 1.0


def test_exact_attempts():
    """a fixed seed gives a fixed count"""
    assert attempts_until_success(0.25, random.Random(9)) == 3
    assert attempts_until_success(0.25, random.Random(3)) == 1
    assert attempts_until_success(1.0, random.Random(3)) == 1


def test_mean_attempts():
    """20,000 runs at p = 0.25 average about 4"""
    rng = random.Random(5)
    runs = [attempts_until_success(0.25, rng) for _ in range(20000)]
    assert 3.9 <= sum(runs) / len(runs) <= 4.1


def test_bad_p():
    """a chance of 0 or below raises ValueError"""
    for call in (lambda: expected_attempts([0.5, 0.0]),
                 lambda: expected_attempts([-0.2]),
                 lambda: attempts_until_success(0.0, random.Random(1)),
                 lambda: attempts_until_success(-0.5, random.Random(1))):
        try:
            call()
        except ValueError:
            pass
        else:
            raise AssertionError('a p of 0 or below should have raised ValueError')
```

#### Uses
- [Random variables › Linearity of expectation](#/random-variables/linearity-of-expectation)
- [Probability rules › Simulate to check](#/probability/simulate-to-check)

#### Hints
- Check every `p` before you do anything else. A `p` of 0 would make a loop that never ends.
- `expected_attempts` is a sum of `1 / p`, one term per job.
- `attempts_until_success` counts draws. Draw once, count it, and stop when the draw is below `p`.
- A `while` loop that draws and increments a counter is enough. Draw exactly once per attempt.

#### Tips
- The test accepts a mean from 3.9 to 4.1. At 20,000 runs the standard error is about 0.025, so that band is 4 standard errors wide on each side.
- Linearity is why the jobs add up even when they share a server and are not independent.

#### Docs
- [Python docs: `random.Random.random`](https://docs.python.org/3/library/random.html#random.Random.random)

### 3. PMF of a sum

Write `convolve(pmf_x, pmf_y) -> dict`: the PMF of `X + Y` for independent `X` and `Y`. For every pair of values `(x, y)`, add `p_x * p_y` into the entry for `x + y`. If either input is empty, return `{}`.

```python starter
def convolve(pmf_x, pmf_y):
    ...
```

```python test
from fractions import Fraction


def test_two_dice():
    """the sum of two Fraction dice"""
    die = {x: Fraction(1, 6) for x in range(1, 7)}
    got = convolve(die, die)
    assert len(got) == 11
    assert got[7] == Fraction(1, 6)
    assert got[2] == Fraction(1, 36)
    assert sum(got.values()) == 1


def test_float_pmf():
    """two float pmfs, compared after rounding"""
    got = convolve({0: 0.3, 1: 0.7}, {0: 0.6, 1: 0.4})
    assert {k: round(v, 9) for k, v in got.items()} == {0: 0.18, 1: 0.54, 2: 0.28}


def test_different_values():
    """the two pmfs need not share values"""
    got = convolve({0: 0.5, 10: 0.5}, {1: 0.5, 2: 0.5})
    assert {k: round(v, 9) for k, v in got.items()} == {1: 0.25, 2: 0.25, 11: 0.25, 12: 0.25}


def test_empty():
    """an empty pmf gives an empty result"""
    assert convolve({}, {1: 1.0}) == {}
    assert convolve({1: 1.0}, {}) == {}
```

#### Uses
- [Random variables › Sums of random variables](#/random-variables/sums-of-random-variables)

#### Hints
- Start from an empty dict for the result.
- Two loops, one over each PMF, visit every pair `(x, y)`.
- Under the key `x + y`, add `p_x * p_y` to whatever is already there. `out.get(x + y, 0)` handles a key you have not met.
- An empty input means the loops never run, so the result is already `{}`.

#### Tips
- Different pairs can land in the same bucket: that is why you add rather than assign.
- Convolving a PMF with itself `n` times gives the PMF of a sum of `n` independent copies.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)

### 4. Inverse-CDF sampling

Write `sample_pmf(pmf, rng)`. It makes exactly one call to `rng.random()`, takes cumulative probabilities over the values in dict insertion order, and returns the first value whose cumulative probability is above `u`. If float rounding leaves `u` above the last cumulative value, return the last value that has non-zero probability. A value with probability 0 is never returned.

```python starter
from bisect import bisect_right
from itertools import accumulate


def sample_pmf(pmf, rng):
    ...
```

```python test
import random

PMF = {'a': 0.5, 'b': 0.3, 'c': 0.2}


def test_exact_sequence():
    """ten draws from a fixed seed"""
    rng = random.Random(1)
    assert [sample_pmf(PMF, rng) for _ in range(10)] == ['a', 'c', 'b', 'a', 'a', 'a', 'b', 'b', 'a', 'a']


def test_one_draw_per_call():
    """each call uses exactly one random number"""
    used = random.Random(4)
    sample_pmf(PMF, used)
    spare = random.Random(4)
    spare.random()
    assert used.getstate() == spare.getstate()


def test_frequencies():
    """20,000 draws land near the probabilities"""
    rng = random.Random(7)
    counts = {k: 0 for k in PMF}
    for _ in range(20000):
        counts[sample_pmf(PMF, rng)] += 1
    assert 0.485 <= counts['a'] / 20000 <= 0.515
    assert 0.285 <= counts['b'] / 20000 <= 0.315
    assert 0.185 <= counts['c'] / 20000 <= 0.215


def test_zero_and_rounding():
    """a zero-probability value is never returned, even past the last cut point"""
    rng = random.Random(2)
    assert {sample_pmf({1: 0.5, 2: 0.0, 3: 0.5}, rng) for _ in range(2000)} == {1, 3}

    class Top:
        def random(self):
            return 0.9999999999999999

    tenths = {i: 0.1 for i in range(10)}
    tenths[10] = 0.0
    assert sample_pmf(tenths, Top()) == 9
```

#### Uses
- [Random variables › Sampling from a PMF](#/random-variables/sampling-from-a-pmf)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- Make a list of the values and a list of cumulative probabilities. `itertools.accumulate` over `pmf.values()` gives the second.
- Draw `u = rng.random()` once, before anything else that could depend on it.
- `bisect_right(cum, u)` is the index of the first cumulative value above `u`.
- If that index equals `len(values)`, rounding left `u` past the end. Pick the last value whose probability is above 0.

#### Tips
- The standard library has `rng.choices(values, weights)` for this. Writing it yourself shows what it does with each `u`.
- Using `bisect_right` rather than `bisect_left` is what keeps a zero-probability value from being chosen when `u` lands exactly on a cut point.

#### Docs
- [Python docs: `bisect`](https://docs.python.org/3/library/bisect.html)
- [Python docs: `itertools.accumulate`](https://docs.python.org/3/library/itertools.html#itertools.accumulate)
