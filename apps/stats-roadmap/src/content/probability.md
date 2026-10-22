# Probability rules

Count outcomes exactly with fractions, use the complement to answer at-least-one questions, and check every answer by simulation.

## Counting outcomes

The sample space is the list of everything that can happen. An event is a subset of it: the outcomes you care about. When every outcome is equally likely, the probability of an event is a count:

```
P(event) = favourable outcomes / total outcomes
```

Two dice have 36 outcomes. `itertools.product` lists them:

```python
from itertools import product

dice = list(product(range(1, 7), repeat=2))
print(len(dice), dice[:3])
print(sum(a + b == 7 for a, b in dice))
```

That prints `36`, then `[(1, 1), (1, 2), (1, 3)]`, then `6`. Six of the 36 outcomes sum to 7, so the probability is 6/36.

Do not divide with `/` yet. `6 / 36` is the float `0.16666666666666666`, and a float answer hides that the truth is exactly one sixth. `fractions.Fraction(6, 36)` reduces itself to `Fraction(1, 6)`. Use fractions while you count, and switch to floats only for the last step, when you need a decimal.

Counting only works when the outcomes are equally likely. The eleven sums 2 to 12 are not: 7 can happen six ways and 2 only one. List the dice, not the sums.

## Rules of probability

Three rules cover most problems. Each one is checkable by counting.

The complement: the probability that A does not happen is `P(not A) = 1 - P(A)`. The probability of not rolling a 6 on one die is `1 - 1/6 = 5/6`.

Addition: `P(A or B) = P(A) + P(B) - P(A and B)`. You subtract the overlap because adding counts it twice. For two dice, let A be "the first die is 6" and B be "the second die is 6". Each has probability 1/6, and both together have probability 1/36. So `P(A or B) = 1/6 + 1/6 - 1/36 = 11/36`. Counting the 36 outcomes agrees: 11 of them have a 6 on at least one die. When A and B cannot both happen, the overlap is 0 and the rule is just `P(A) + P(B)`. A sum of 7 and doubles never coincide, so `P(sum is 7 or doubles) = 1/6 + 1/6 = 1/3`.

Multiplication: when two events do not affect each other, they are independent, and `P(A and B) = P(A) * P(B)`. Two dice are independent, so the chance of two 6s is `1/6 * 1/6 = 1/36`. Do not use this when one event changes the other. The next module, Conditional probability & Bayes, covers that case.

## The complement trick

"At least one" is hard to count directly: one, or two, or three, and so on. Its complement is a single case, "none". So:

```
P(at least one) = 1 - P(none)
```

If each of 3 retries succeeds with probability 0.9, all three fail with probability `0.1 ** 3`, and the chance that at least one succeeds is `1 - 0.001 = 0.999`. If each of 20 shards has a 1% chance of failing during a job, all 20 survive with probability `0.99 ** 20 = 0.8179069375972308`. The chance that at least one fails is `0.18209306240276923`, about 18%. Small risks add up faster than they look.

The same move solves the birthday problem. How likely is it that two of `k` people share a birthday, with 365 equally likely days? "Some pair matches" is awkward. "Nobody matches" is a product: the second person avoids one date, the third avoids two, and so on.

```
P(no match) = 365/365 * 364/365 * 363/365 * ...   (k factors)
```

For `k = 23`, `1 - P(no match)` is `0.507297234`, rounded to nine places. Twenty-three people is already a better-than-even bet that two share a birthday. For `k = 10` it is `0.116948178`, and for `k = 50` it is `0.97037358`.

## Simulate to check

You can check an exact answer, or estimate one you cannot work out, by simulating. Run the experiment many times with a seeded generator, and count how often the event happens. The fraction is the estimate.

```python
import random

def two_dice_sum_7(rng):
    return int(rng.random() * 6) + 1 + int(rng.random() * 6) + 1 == 7

rng = random.Random(3)
trials = 10000
print(sum(two_dice_sum_7(rng) for _ in range(trials)) / trials)
```

The exact answer is 1/6, about `0.16667`. This run prints `0.1705`. With `random.Random(3)` the estimate after 100, 1,000, 10,000 and 100,000 trials is `0.19`, `0.182`, `0.1705` and `0.1664`, which is `0.0233`, `0.0153`, `0.0038` and `0.0003` from the truth. The gap shrinks like `1 / sqrt(trials)`, the same rule you saw in Running proportions. Ten times the trials makes the error about three times smaller.

Simulation does not replace the exact answer. It tells you when your exact answer is wrong: if your formula says 0.25 and a 100,000-trial simulation says 0.1664, one of them has a bug. Seed the generator and pass `rng` in, so that a rerun reproduces the same estimate.

Two checks apply to every function here. With no outcomes there is nothing to divide by, so raise `ValueError`. With `trials <= 0` you cannot estimate anything, so raise `ValueError` as well. A count of `n = 0` attempts gives probability `0.0` of ever succeeding.

```python playground
import random
from fractions import Fraction
from itertools import product

dice = list(product(range(1, 7), repeat=2))


def prob(event, outcomes):
    return Fraction(sum(1 for o in outcomes if event(o)), len(outcomes))


print(prob(lambda o: o[0] + o[1] == 7, dice))
print(prob(lambda o: o[0] == 6 or o[1] == 6, dice))

# At least one 6 in two dice, by the complement.
print(1 - Fraction(5, 6) ** 2)

# Birthday problem for k people.
for k in (10, 23, 50):
    none = 1.0
    for i in range(k):
        none *= (365 - i) / 365
    print(k, round(1 - none, 9))


def sim(event, trials, rng):
    return sum(event(rng) for _ in range(trials)) / trials


def seven(rng):
    return int(rng.random() * 6) + 1 + int(rng.random() * 6) + 1 == 7


for t in (100, 1000, 10000):
    print(t, sim(seven, t, random.Random(3)))

# Try: change the seed and see how far 100 trials can wander.
```

## Exercises

### 1. Exact probability by enumeration

Write `prob(event, outcomes) -> Fraction`. `outcomes` is a list of equally likely outcomes, and `event` is a function that takes one outcome and returns `True` or `False`. Return the number of outcomes where `event` is true, divided by the total, as a `fractions.Fraction`. If `outcomes` is empty, raise `ValueError`.

```python starter
from fractions import Fraction


def prob(event, outcomes):
    ...
```

```python test
from itertools import product


def test_two_dice():
    """sum 7, doubles and an impossible sum"""
    dice = list(product(range(1, 7), repeat=2))
    assert prob(lambda o: o[0] + o[1] == 7, dice) == Fraction(1, 6)
    assert prob(lambda o: o[0] == o[1], dice) == Fraction(1, 6)
    assert prob(lambda o: o[0] + o[1] > 12, dice) == Fraction(0)


def test_three_coins():
    """at least two heads in three flips"""
    flips = list(product('HT', repeat=3))
    got = prob(lambda o: o.count('H') >= 2, flips)
    assert got == Fraction(1, 2)
    assert prob(lambda o: o == ('H', 'H', 'H'), flips) == Fraction(1, 8)


def test_returns_fraction():
    """the result is an exact Fraction in lowest terms"""
    got = prob(lambda n: n % 2 == 0, [1, 2, 3, 4, 5, 6])
    assert isinstance(got, Fraction)
    assert (got.numerator, got.denominator) == (1, 2)


def test_empty():
    """no outcomes raises ValueError"""
    try:
        prob(lambda o: True, [])
    except ValueError:
        pass
    else:
        raise AssertionError('an empty outcome list should have raised ValueError')
```

#### Uses
- [Probability rules › Counting outcomes](#/probability/counting-outcomes)

#### Hints
- Count the outcomes where `event(o)` is true. `sum(1 for o in outcomes if event(o))` does it.
- Raise `ValueError` before dividing when `outcomes` is empty.
- Build `Fraction(count, len(outcomes))`. A `Fraction` reduces itself, so you do not have to.
- Do not use `/`. That would give a float, and the test wants an exact `Fraction`.

#### Tips
- You can pass any predicate: a lambda, or a named function.
- Enumeration only works for small spaces. For two dice it is 36 outcomes, for ten dice it is 60 million.

#### Docs
- [Python docs: `fractions`](https://docs.python.org/3/library/fractions.html)
- [Python docs: `itertools.product`](https://docs.python.org/3/library/itertools.html#itertools.product)

### 2. Birthday problem by complement

Write `p_shared_birthday(k, days=365) -> float`: the probability that at least two of `k` people share a birthday, out of `days` equally likely days. Compute `1 - product of (days - i) / days for i in range(k)`. For `k <= 1` return `0.0`. For `k > days` return `1.0`, since by then a repeat is certain.

```python starter
def p_shared_birthday(k, days=365):
    ...
```

```python test
def test_classic():
    """twenty-three people is a better-than-even bet"""
    assert round(p_shared_birthday(23), 9) == 0.507297234
    assert round(p_shared_birthday(10), 9) == 0.116948178
    assert round(p_shared_birthday(50), 9) == 0.97037358


def test_small_calendar():
    """two people and a two-day year"""
    assert p_shared_birthday(2, days=2) == 0.5
    assert round(p_shared_birthday(3, days=10), 9) == 0.28


def test_edges():
    """nobody or one person never shares, too many people always do"""
    assert p_shared_birthday(0) == 0.0
    assert p_shared_birthday(1) == 0.0
    assert p_shared_birthday(366) == 1.0
    assert p_shared_birthday(400) == 1.0
```

#### Uses
- [Probability rules › The complement trick](#/probability/the-complement-trick)
- [Probability rules › Rules of probability](#/probability/rules-of-probability)

#### Hints
- Work out "nobody shares" first. The person at index `i` must avoid the `i` dates already taken, so their factor is `(days - i) / days`.
- Multiply the factors in a loop over `range(k)`, starting from `1.0`.
- The answer is `1` minus that product.
- Return early for `k <= 1` and `k > days`, so the edge cases are explicit.

#### Tips
- The product shrinks fast. By `k = 23` it has dropped to just under one half.
- `math.perm(days, k) / days ** k` computes the same product in one call.

#### Docs
- [Python docs: `math.perm`](https://docs.python.org/3/library/math.html#math.perm)

### 3. At least one of n

Write two functions. `at_least_one(p, n) -> float` returns the probability that at least one of `n` independent tries, each with success probability `p`, succeeds: `1 - (1 - p) ** n`. With `n = 0` or `p = 0` the result is `0.0`. `attempts_needed(p, target) -> int` returns the smallest `n` for which `at_least_one(p, n) >= target`. It raises `ValueError` when `p <= 0` or when `target` is not strictly between 0 and 1.

```python starter
def at_least_one(p, n):
    ...


def attempts_needed(p, target):
    ...
```

```python test
def test_at_least_one():
    """known values of the complement"""
    assert round(at_least_one(0.1, 3), 9) == 0.271
    assert round(at_least_one(0.5, 4), 9) == 0.9375
    assert round(at_least_one(0.2, 5), 9) == 0.67232


def test_nothing_to_win():
    """no tries or no chance gives 0.0"""
    assert at_least_one(0.3, 0) == 0.0
    assert at_least_one(0.0, 10) == 0.0


def test_attempts_needed():
    """the first n that reaches the target"""
    assert attempts_needed(0.5, 0.9) == 4
    assert attempts_needed(0.1, 0.95) == 29
    assert attempts_needed(0.01, 0.5) == 69


def test_attempts_errors():
    """a chance of 0 or a target outside 0 to 1 raises ValueError"""
    for p, target in ((0.0, 0.5), (-0.1, 0.5), (0.5, 0.0), (0.5, 1.0), (0.5, 1.5)):
        try:
            attempts_needed(p, target)
        except ValueError:
            pass
        else:
            raise AssertionError(f'attempts_needed({p}, {target}) should have raised ValueError')
```

#### Uses
- [Probability rules › The complement trick](#/probability/the-complement-trick)
- [Probability rules › Rules of probability](#/probability/rules-of-probability)

#### Hints
- `at_least_one` is one line: the complement of "all `n` tries fail".
- For `attempts_needed`, validate `p` and `target` first.
- Start `n` at 1 and increase it until `at_least_one(p, n)` reaches `target`.
- A loop is enough. You can also solve it with `math.log` and round up, but then check your answer against the loop at the boundary.

#### Tips
- Rare events pile up: at `p = 0.01` you need 69 tries for even odds.
- `attempts_needed` is how you size a retry budget: how many tries buy you a 99.9% chance of getting through?

#### Docs
- [Python docs: `math.log`](https://docs.python.org/3/library/math.html#math.log)

### 4. Simulate and compare

Write `simulate(event, trials, rng) -> float`. `event` is a function that takes `rng` and returns `True` or `False`. Call `event(rng)` exactly `trials` times, in order, and return the fraction of calls that returned `True`. If `trials <= 0`, raise `ValueError`.

```python starter
def simulate(event, trials, rng):
    ...
```

```python test
import random


def seven(rng):
    return int(rng.random() * 6) + 1 + int(rng.random() * 6) + 1 == 7


def test_exact_for_seed():
    """the same seed gives the same estimate"""
    assert round(simulate(seven, 20000, random.Random(3)), 9) == 0.17035
    assert round(simulate(lambda r: r.random() < 0.5, 5, random.Random(3)), 9) == 0.4


def test_near_the_truth():
    """20,000 trials land within four standard errors of 1/6"""
    got = simulate(seven, 20000, random.Random(3))
    assert 0.155 <= got <= 0.178


def test_calls_event_each_trial():
    """event is called once per trial"""
    seen = []

    def event(rng):
        seen.append(rng.random())
        return True

    assert simulate(event, 4, random.Random(8)) == 1.0
    assert len(seen) == 4
    assert seen == [random.Random(8).random()] + seen[1:]


def test_bad_trials():
    """zero or negative trials raise ValueError"""
    for trials in (0, -5):
        try:
            simulate(seven, trials, random.Random(1))
        except ValueError:
            pass
        else:
            raise AssertionError(f'trials={trials} should have raised ValueError')
```

#### Uses
- [Probability rules › Simulate to check](#/probability/simulate-to-check)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- Raise `ValueError` for `trials <= 0` before you draw anything.
- Loop `trials` times, calling `event(rng)` once each time. Count the `True` results.
- Divide the count by `trials` at the end.
- Pass the same `rng` to every call. Do not build a new generator inside `simulate`.

#### Tips
- Because `event` takes `rng`, the same `simulate` works for dice, coins and any event you can write as a short function.
- A band of four standard errors is `4 * sqrt(p * (1 - p) / trials)`. For `p = 1/6` and 20,000 trials that is about 0.0105.

#### Docs
- [Python docs: `random.Random`](https://docs.python.org/3/library/random.html#random.Random)
