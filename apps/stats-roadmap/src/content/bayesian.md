# Bayesian updating

Start from a prior, update on data, read a credible interval, and estimate the chance that B beats A.

## Prior, likelihood, posterior

Before you see data you have some belief about a parameter. That is the prior. After the data you have an updated belief, the posterior. [Bayes rule](#/conditional/bayes-rule) turns one into the other.

Start small. A bag holds three coins, with heads rates 0.3, 0.5 and 0.7. You pull one out at random, flip it 10 times, and see 7 heads. Which coin is it?

```python
rates = [0.3, 0.5, 0.7]
prior = [1 / 3, 1 / 3, 1 / 3]
like = [t**7 * (1 - t) ** 3 for t in rates]
unnorm = [l * w for l, w in zip(like, prior)]
post = [u / sum(unnorm) for u in unnorm]
print(post)
```

The [likelihood](#/estimation/likelihood) of each coin is the chance of this exact run of 7 heads and 3 tails if that coin were the one: `t**7 * (1 - t)**3`. The number of orderings, `math.comb(10, 7)` from [Binomial counts](#/distributions/binomial-counts), is the same for every coin, so you can leave it out. Multiply each likelihood by its prior weight, then divide by the total so the weights sum to 1:

```
posterior_i = likelihood_i * prior_i / sum(likelihood_j * prior_j)
```

People say the posterior is proportional to likelihood times prior: equal up to a factor that is the same for every candidate. The sum on the bottom is the chance of the data, the denominator in Bayes rule. Here the posterior is `[0.023, 0.298, 0.679]`, rounded to three places. The 0.7 coin went from one in three to about 68%.

The prior matters. If you believe most bags hold fair coins and start from `[0.1, 0.8, 0.1]`, the same data give `[0.007, 0.773, 0.22]`. Choose the prior from what you knew before the data, never by tuning it afterwards.

## Updating on a grid

A real rate is not one of three values. Put a grid of candidates from 0 to 1 in steps of 0.01, and do the same thing at every point:

```python
def update(grid, prior, k, n):
    w = [p * t**k * (1 - t) ** (n - k) for t, p in zip(grid, prior)]
    total = sum(w)
    return [x / total for x in w]

grid = [i / 100 for i in range(101)]
flat = [1 / 101] * 101
post = update(grid, flat, 3, 10)
```

A flat prior gives every candidate the same weight. After 3 successes in 10 the posterior peaks at 0.3, the [maximum likelihood](#/estimation/maximum-likelihood) estimate `k / n`. Its mean, `sum(t * w for t, w in zip(grid, post))`, is `0.3333332967399787`, pulled a little toward one half. Python's `0 ** 0` is `1`, so the grid point 0 works when `k` is 0.

Data can arrive in batches. Use today's posterior as tomorrow's prior:

```python
two = update(grid, post, 5, 20)
once = update(grid, flat, 8, 30)
print(max(abs(a - b) for a, b in zip(two, once)))
```

The largest difference is `1.3877787807814457e-17`, which is float rounding. Updating on 3 of 10 and then 5 of 20 gives the same posterior as 8 of 30 in one go. The order and the batching do not matter.

A grid is simple and works for any prior, but its size multiplies with each parameter: 101 points for one rate, 10,201 for two, over a million for three. Past a few parameters people switch to sampling methods such as MCMC, in libraries like PyMC.

## The Beta-Binomial shortcut

For a rate with a Beta prior you can skip the grid. `Beta(a, b)` is a distribution on 0 to 1 whose shape follows `t**(a - 1) * (1 - t)**(b - 1)`. `Beta(1, 1)` is flat, the same as the flat grid prior. The update is two additions:

```
prior      Beta(a, b)
data       k successes in n trials
posterior  Beta(a + k, b + n - k)
mean       (a + k) / (a + b + n)
```

A flat prior and 8 of 30 give `Beta(9, 23)`, with mean `9 / 32`, which is `0.28125`. The 101-point grid gave `0.28124999999990374`. `rng.betavariate(a, b)` draws from a Beta, so you can check it a third way:

```python
import random
import statistics

rng = random.Random(1)
draws = [rng.betavariate(9, 23) for _ in range(10000)]
print(statistics.fmean(draws))
```

This prints `0.28124844371193947`.

A `Beta(a, b)` prior acts like `a` earlier successes and `b` earlier failures. Start from `Beta(2, 2)` and the same 8 of 30 give a mean of `(2 + 8) / (2 + 2 + 30)`, which is `0.29411764705882354`, a little closer to one half. With plenty of data, the prior's few extra counts stop mattering. The standard library can draw from a Beta but has no Beta CDF or quantile function. scipy has both, as `scipy.stats.beta(a, b)`.

## Credible intervals

The posterior is a whole distribution. To summarise it, take its central 95%: the range that leaves 2.5% of the posterior weight on each side. On a grid, walk from the left adding up weight, and note where the running total first reaches 2.5% and 97.5%. For the flat prior and 8 of 30, the 101-point grid gives 0.14 to 0.45. From the Beta draws, `statistics.quantiles` does it:

```python
cuts = statistics.quantiles(draws, n=40, method='inclusive')
print(cuts[0], cuts[-1])
```

This prints `0.14200023362841313` and `0.4459113991201943`. A 1,001-point grid agrees: 0.142 to 0.446.

Now read it: given the model and the flat prior, there is a 95% probability that the rate lies between 0.142 and 0.446. That is a probability statement about the parameter. A confidence interval is not one. It says how often its recipe covers the truth across repeated samples, and says nothing about the one interval you computed. The credible interval earns the stronger reading by assuming a prior.

With a flat prior and a fair amount of data the two often land close. The Wilson confidence interval for 8 of 30 runs from 0.142 to 0.444, rounded to three places. With little data or a strong prior they can differ a lot, and then the prior is doing the work.

## Comparing two rates

Two versions of a page: A converted 12 of 80 visitors and B converted 20 of 85. Flat priors give posteriors `Beta(13, 69)` for A and `Beta(21, 66)` for B. How likely is it that B's rate is higher? There is no neat formula, but drawing pairs answers it:

```python
rng = random.Random(1)
wins = 0
for _ in range(10000):
    a = rng.betavariate(13, 69)
    b = rng.betavariate(21, 66)
    wins += b > a
print(wins / 10000)
```

This prints `0.9096`. Seeds 2 to 5 give `0.9102`, `0.9161`, `0.9144` and `0.9114`, and a fine-grid calculation gives 0.914, rounded to three places. The answer is about 91%. A simulated share carries an error of about `sqrt(p * (1 - p) / draws)`, which is `0.002861817604250837` for 91% over 10,000 draws.

Treat the result as a band, not an exact number, for a second reason too. Python promises that `rng.random()` gives the same sequence for a seed on every version, but makes no such promise for `betavariate`, which is built from several draws. A test on it should check a range.

Read it as: given flat priors and the binomial model, there is about a 91% probability that B's rate is higher than A's. It says nothing about how much higher. For that, look at the draws of `b - a` themselves.

```python playground
import random
import statistics


def update(grid, prior, k, n):
    w = [p * t**k * (1 - t) ** (n - k) for t, p in zip(grid, prior)]
    total = sum(w)
    return [x / total for x in w]


k, n = 8, 30
grid = [i / 100 for i in range(101)]
flat = [1 / 101] * 101
post = update(grid, flat, k, n)
print('grid mean   ', sum(t * w for t, w in zip(grid, post)))
print('beta mean   ', (1 + k) / (1 + 1 + n))

rng = random.Random(1)
draws = [rng.betavariate(1 + k, 1 + n - k) for _ in range(5000)]
cuts = statistics.quantiles(draws, n=40, method='inclusive')
print('95% credible', round(cuts[0], 3), round(cuts[-1], 3))

a_k, a_n, b_k, b_n = 12, 80, 20, 85
wins = 0
for _ in range(5000):
    a = rng.betavariate(1 + a_k, 1 + a_n - a_k)
    b = rng.betavariate(1 + b_k, 1 + b_n - b_k)
    wins += b > a
print('P(B > A)    ', wins / 5000)

# Try: change 8 of 30 to 80 of 300 and watch the credible interval narrow.
```

## Exercises

### 1. Update a prior on a grid

Write `grid_posterior(grid, prior, k, n)`. `grid` is a list of candidate values `theta` for a success rate and `prior` is a list of weights of the same length. After seeing `k` successes in `n` trials, each posterior weight is proportional to `prior_i * theta_i ** k * (1 - theta_i) ** (n - k)`, where `0 ** 0` is `1`. Return the weights divided by their sum, as a list. If `grid` and `prior` differ in length, or every product is zero so the sum is zero, raise `ValueError`.

```python starter
def grid_posterior(grid, prior, k, n):
    ...
```

```python test
GRID = [0.0, 0.25, 0.5, 0.75, 1.0]
FLAT = [0.2, 0.2, 0.2, 0.2, 0.2]


def test_one_update():
    """1 success in 2 trials from a flat prior"""
    got = grid_posterior(GRID, FLAT, 1, 2)
    assert [round(v, 9) for v in got] == [0.0, 0.3, 0.4, 0.3, 0.0]


def test_uneven_prior():
    """a prior that favours the middle"""
    got = grid_posterior(GRID, [0.1, 0.2, 0.4, 0.2, 0.1], 2, 3)
    assert [round(v, 9) for v in got] == [0.0, 0.107142857, 0.571428571, 0.321428571, 0.0]


def test_two_batches_equal_one():
    """two batches of data give the same posterior as one"""
    first = grid_posterior(GRID, FLAT, 1, 2)
    both = grid_posterior(GRID, first, 2, 3)
    assert [round(v, 9) for v in both] == [0.0, 0.132352941, 0.470588235, 0.397058824, 0.0]
    once = grid_posterior(GRID, FLAT, 3, 5)
    assert [round(v, 9) for v in once] == [0.0, 0.132352941, 0.470588235, 0.397058824, 0.0]


def test_no_data_and_errors():
    """0 of 0 keeps the prior, and bad input raises ValueError"""
    got = grid_posterior(GRID, FLAT, 0, 0)
    assert [round(v, 9) for v in got] == [0.2, 0.2, 0.2, 0.2, 0.2]
    for grid, prior, k, n in (([0.0, 1.0], [1.0, 0.0], 1, 1), ([0.0, 0.5, 1.0], [0.5, 0.5], 1, 2)):
        try:
            grid_posterior(grid, prior, k, n)
        except ValueError:
            pass
        else:
            raise AssertionError('a zero total or a length mismatch should have raised ValueError')
```

#### Uses
- [Bayesian updating › Updating on a grid](#/bayesian/updating-on-a-grid)
- [Bayesian updating › Prior, likelihood, posterior](#/bayesian/prior-likelihood-posterior)
- [Likelihood & estimation › Likelihood](#/estimation/likelihood)

#### Hints
- Check the two lengths before you build anything.
- Pair each grid value with its prior weight using `zip`, and multiply the weight by `t ** k * (1 - t) ** (n - k)`. Python's `0 ** 0` is already `1`.
- Sum the products. If the sum is 0 raise, otherwise divide every product by it.

#### Tips
- Feed one call's output in as the next call's prior and you can update batch by batch. The tests check that this matches one big update.
- With large `n`, `t ** k` can underflow to 0 at every grid point. The fix is to work with log weights and subtract the largest before you exponentiate.

#### Docs
- [Python docs: `zip`](https://docs.python.org/3/library/functions.html#zip)

### 2. Beta-Binomial update

Write `beta_update(a, b, k, n)` and `beta_mean(a, b)`. A `Beta(a, b)` prior updated with `k` successes in `n` trials becomes `Beta(a + k, b + n - k)`, so `beta_update` returns the tuple `(a + k, b + n - k)`. `beta_mean` returns `a / (a + b)`. In `beta_update`, raise `ValueError` if `k > n` or if any of `a`, `b`, `k`, `n` is negative. With `k = n = 0` the prior comes back unchanged.

```python starter
def beta_update(a, b, k, n):
    ...


def beta_mean(a, b):
    ...
```

```python test
def test_update():
    """successes add to a and failures add to b"""
    assert beta_update(1, 1, 7, 10) == (8, 4)
    assert beta_update(2, 3, 5, 5) == (7, 3)


def test_no_data():
    """0 of 0 leaves the prior unchanged"""
    assert beta_update(2, 3, 0, 0) == (2, 3)


def test_mean():
    """the mean of a beta"""
    assert round(beta_mean(8, 4), 9) == 0.666666667
    assert round(beta_mean(3, 9), 9) == 0.25


def test_bad_input():
    """k above n or a negative input raises ValueError"""
    for args in ((1, 1, 11, 10), (-1, 1, 1, 2), (1, 1, 1, -2)):
        try:
            beta_update(*args)
        except ValueError:
            pass
        else:
            raise AssertionError(f'beta_update{args} should have raised ValueError')
```

#### Uses
- [Bayesian updating › The Beta-Binomial shortcut](#/bayesian/the-beta-binomial-shortcut)

#### Hints
- Successes add to `a` and failures, `n - k`, add to `b`.
- `min(a, b, k, n) < 0` checks all four for a negative value at once.
- Validate, then return the tuple `(a + k, b + n - k)`. The mean is one division.

#### Tips
- `beta_mean(*beta_update(a, b, k, n))` is the posterior mean `(a + k) / (a + b + n)` in one line.
- A `Beta(1, 1)` prior updated with `k` of `n` has mean `(k + 1) / (n + 2)`, which is Laplace's rule of succession.

#### Docs
- [Python docs: `random.Random.betavariate`](https://docs.python.org/3/library/random.html#random.betavariate)

### 3. Credible interval from the grid

Write `credible_interval(grid, post, mass=0.95)`, which returns a tuple `(lo, hi)` of values from `grid`. Walk along the grid keeping a running sum of `post` from the left. `lo` is the first grid value where the running sum reaches `(1 - mass) / 2`, and `hi` is the first grid value where it reaches `1 - (1 - mass) / 2`. If `post` does not sum to 1 within `1e-9`, raise `ValueError`.

```python starter
def credible_interval(grid, post, mass=0.95):
    ...
```

```python test
TENTHS = [i / 10 for i in range(11)]
BELL = [0.02, 0.03, 0.05, 0.1, 0.2, 0.2, 0.15, 0.1, 0.08, 0.05, 0.02]
QUARTERS = [0.0, 0.25, 0.5, 0.75, 1.0]
SKEW = [0.01, 0.04, 0.3, 0.45, 0.2]


def test_default_mass():
    """the central 95 percent of a bell-shaped posterior"""
    lo, hi = credible_interval(TENTHS, BELL)
    assert round(lo, 9) == 0.1
    assert round(hi, 9) == 0.9


def test_skewed_posterior():
    """a skewed posterior at 95 and 50 percent"""
    lo, hi = credible_interval(QUARTERS, SKEW)
    assert (round(lo, 9), round(hi, 9)) == (0.25, 1.0)
    lo, hi = credible_interval(QUARTERS, SKEW, 0.5)
    assert (round(lo, 9), round(hi, 9)) == (0.5, 0.75)


def test_point_mass():
    """all the weight on one value gives that value twice"""
    lo, hi = credible_interval(QUARTERS, [0.0, 0.0, 1.0, 0.0, 0.0])
    assert (round(lo, 9), round(hi, 9)) == (0.5, 0.5)


def test_not_normalised():
    """a posterior that does not sum to 1 raises ValueError"""
    try:
        credible_interval(QUARTERS, [0.1, 0.1, 0.1, 0.1, 0.1])
    except ValueError:
        pass
    else:
        raise AssertionError('a posterior summing to 0.5 should have raised ValueError')
```

#### Uses
- [Bayesian updating › Credible intervals](#/bayesian/credible-intervals)
- [Bayesian updating › Updating on a grid](#/bayesian/updating-on-a-grid)

#### Hints
- Check the sum first, with a tolerance: `abs(sum(post) - 1) > 1e-9`.
- Work out the two targets, `(1 - mass) / 2` and `1 - (1 - mass) / 2`, before the loop.
- Walk the grid and the weights together with a running total. Record the grid value the first time the total reaches each target, and only the first time.

#### Tips
- "Reaches" means `>=`. With a point mass the total jumps from 0 to 1 at one grid value, and both ends land there.
- The answer is always a grid value, so a coarse grid gives a coarse interval. Use more points for more precision.

#### Docs
- [Python docs: `itertools.accumulate`](https://docs.python.org/3/library/itertools.html#itertools.accumulate)

### 4. P(B beats A)

Write `prob_b_beats_a(a_succ, a_n, b_succ, b_n, draws, rng)`. Give each arm a `Beta(1 + k, 1 + n - k)` posterior, where `k` is its successes and `n` its trials. Make `draws` pairs. In each pair draw A first with `rng.betavariate(...)`, then B. Return the fraction of pairs in which B's draw is larger than A's. If `draws` is 0 or negative, raise `ValueError`.

```python starter
def prob_b_beats_a(a_succ, a_n, b_succ, b_n, draws, rng):
    ...
```

```python test
import random


def test_clear_winner():
    """B clearly better than A is about 93 percent"""
    got = prob_b_beats_a(30, 100, 40, 100, 4000, random.Random(1))
    assert 0.905 <= got <= 0.955


def test_equal_data():
    """equal data gives about one half"""
    got = prob_b_beats_a(50, 100, 50, 100, 4000, random.Random(1))
    assert 0.465 <= got <= 0.535


def test_swapping_arms():
    """a huge gap is near 1 one way and near 0 the other"""
    assert prob_b_beats_a(10, 100, 60, 100, 500, random.Random(2)) >= 0.99
    assert prob_b_beats_a(60, 100, 10, 100, 500, random.Random(2)) <= 0.01


class ScriptedRng:
    def __init__(self, values):
        self.values = list(values)
        self.calls = []

    def betavariate(self, alpha, beta):
        self.calls.append((alpha, beta))
        return self.values[len(self.calls) - 1]


def test_draw_pattern_and_ties():
    """A then B per pair from Beta(1 + k, 1 + n - k); a tie is not a win"""
    rng = ScriptedRng([0.2, 0.5, 0.6, 0.6, 0.7, 0.3, 0.1, 0.9, 0.4, 0.45])
    got = prob_b_beats_a(3, 10, 5, 10, 5, rng)
    assert rng.calls == [(4, 8), (6, 6)] * 5
    assert round(got, 9) == 0.6


def test_bad_draws():
    """draws of 0 raises ValueError"""
    try:
        prob_b_beats_a(5, 10, 6, 10, 0, random.Random(1))
    except ValueError:
        pass
    else:
        raise AssertionError('draws of 0 should have raised ValueError')
```

#### Uses
- [Bayesian updating › Comparing two rates](#/bayesian/comparing-two-rates)
- [Bayesian updating › The Beta-Binomial shortcut](#/bayesian/the-beta-binomial-shortcut)
- [Thinking in samples › Seeded randomness](#/samples/seeded-randomness)

#### Hints
- Each arm's posterior is `Beta(1 + k, 1 + n - k)`, from a flat prior.
- In each pair, draw A first and B second from the same `rng`, then compare.
- Count the pairs where B's draw is larger and divide by `draws`. Check `draws` before the loop.

#### Tips
- The result is a simulated share, so it moves with the seed. Its error is about `sqrt(p * (1 - p) / draws)`.
- Keep the draws of `b - a` if you also want to know how much better B is, not just how often.

#### Docs
- [Python docs: `random.Random.betavariate`](https://docs.python.org/3/library/random.html#random.betavariate)
