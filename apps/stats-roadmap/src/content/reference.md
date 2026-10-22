# Reference

Everything the exercises lean on, in one place: the standard library calls, the notation, every formula with a worked number, and how the tests work.

Every sample here was run. The `->` shows what the expression actually evaluates to. This is a lookup page, not a step: skim it once, then come back when an exercise uses something you have not met.

## The standard library

Only the Python standard library is used on this roadmap. Each entry says what the call does and shows one run. The links go to docs.python.org.

### Randomness

- **`random.Random(seed)`** builds a generator with its own state. Call it `rng` and pass it into every function that needs randomness. The same seed gives the same sequence. ``random.Random(1).random() -> 0.13436424411240122`` and a second `random.Random(1)` start over. [docs](https://docs.python.org/3/library/random.html#random.Random)
- **`rng.random()`** returns a float in `[0, 1)`: at least 0, always below 1. It is the one call whose sequence Python promises not to change between versions, so the tests hard-code values built from it. ``[round(random.Random(1).random(), 4), round(random.Random(2).random(), 4)] -> [0.1344, 0.956]``. [docs](https://docs.python.org/3/library/random.html#random.random)
- **`rng.betavariate(a, b)`** draws one number on 0 to 1 from a Beta(a, b) distribution. Its exact values are not promised across versions, so a test on it checks a range. ``0 < random.Random(1).betavariate(9, 23) < 1 -> True``. [docs](https://docs.python.org/3/library/random.html#random.betavariate)
- **`rng.getstate()`** returns the generator's internal state. Two generators with equal states give equal futures, which is how a test checks that your function drew nothing from `rng`. ``random.Random(7).getstate() == random.Random(7).getstate() -> True``. [docs](https://docs.python.org/3/library/random.html#random.getstate)
- **`rng.choices`, `rng.sample`, `rng.shuffle`, `rng.gauss`, `rng.expovariate`** draw weighted picks, a sample without replacement, an in-place shuffle, a normal number and an exponential number. Their exact outputs can change between Python versions, so the tests check properties or tolerance bands for them. ``sorted(random.Random(2).sample(range(5), 5)) -> [0, 1, 2, 3, 4]``. [docs](https://docs.python.org/3/library/random.html)

### The statistics module

- **`statistics.fmean(data)`** is the mean as a float. ``statistics.fmean([2, 4, 4, 4, 5, 5, 7, 9]) -> 5.0``. It raises `StatisticsError` on an empty list. [docs](https://docs.python.org/3/library/statistics.html#statistics.fmean)
- **`statistics.median(data)`** is the middle value, or the mean of the two middle values. ``statistics.median([1, 2, 3, 100]) -> 2.5``. [docs](https://docs.python.org/3/library/statistics.html#statistics.median)
- **`statistics.variance(data)` and `statistics.stdev(data)`** are the sample versions, dividing by `n - 1`. They need at least two values. ``statistics.variance([2, 4, 4, 4, 5, 5, 7, 9]) -> 4.571428571428571`` and ``statistics.stdev([2, 4, 4, 4, 5, 5, 7, 9]) -> 2.138089935299395``. [docs](https://docs.python.org/3/library/statistics.html#statistics.variance)
- **`statistics.pvariance(data)`** divides by `n`, for when you hold the whole population or want the maximum likelihood estimate. ``statistics.pvariance([2, 4, 4, 4, 5, 5, 7, 9]) -> 4``. [docs](https://docs.python.org/3/library/statistics.html#statistics.pvariance)
- **`statistics.quantiles(data, n=4, method=...)`** returns the `n - 1` cut points that split the data into `n` equal parts. The default `method='exclusive'` treats the data as a sample from a wider range and reaches further out. `method='inclusive'` interpolates between the data points, so the minimum and maximum are the ends. ``statistics.quantiles([2, 4, 4, 4, 5, 5, 7, 9], n=4, method='inclusive') -> [4.0, 4.5, 5.5]`` against ``statistics.quantiles([2, 4, 4, 4, 5, 5, 7, 9], n=4) -> [4.0, 4.5, 6.5]``. The tests ask for `inclusive`. [docs](https://docs.python.org/3/library/statistics.html#statistics.quantiles)
- **`statistics.correlation(x, y)`** is Pearson's r. ``round(statistics.correlation([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 5]), 9) -> 0.791794655``. With `method='ranked'` (Python 3.12 and later) it ranks both columns first, ties sharing the average rank, which gives Spearman's correlation. ``statistics.correlation([1, 2, 3, 4], [1, 8, 27, 64], method='ranked') -> 1.0``. [docs](https://docs.python.org/3/library/statistics.html#statistics.correlation)
- **`statistics.covariance(x, y)`** is the sample covariance, dividing by `n - 1`. ``statistics.covariance([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 5]) -> 3.2``. [docs](https://docs.python.org/3/library/statistics.html#statistics.covariance)
- **`statistics.linear_regression(x, y)`** returns the least-squares `slope` and `intercept`. ``tuple(statistics.linear_regression([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])) -> (0.6, 2.2)``. It raises `StatisticsError` when every `x` is the same. [docs](https://docs.python.org/3/library/statistics.html#statistics.linear_regression)
- **`statistics.NormalDist(mu, sigma)`** is a normal distribution. `.cdf(x)` is the probability of being at or below `x`, `.inv_cdf(p)` is the reverse, `.zscore(x)` is `(x - mu) / sigma`, and `.pdf(x)` is the density. ``round(statistics.NormalDist(100, 15).cdf(130), 9) -> 0.977249868``, ``round(statistics.NormalDist().inv_cdf(0.975), 9) -> 1.959963985``, ``statistics.NormalDist(100, 15).zscore(130) -> 2.0``, ``round(statistics.NormalDist().pdf(0), 9) -> 0.39894228``. With no arguments it is the standard normal, `mu = 0`, `sigma = 1`. [docs](https://docs.python.org/3/library/statistics.html#statistics.NormalDist)

### The math module

- **`math.sqrt(x)`** is the square root. ``math.sqrt(0.3 * 0.7 / 100) -> 0.0458257569495584``. [docs](https://docs.python.org/3/library/math.html#math.sqrt)
- **`math.log(x)`** is the natural logarithm, base *e*. `math.log(0)` raises `ValueError: math domain error`, so check for zero first. ``round(math.log(2.5), 6) -> 0.916291``. `math.log2(x)` is base 2, for bits. [docs](https://docs.python.org/3/library/math.html#math.log)
- **`math.exp(x)`** is *e* to the power `x`. `math.exp(1000)` raises `OverflowError`. ``round(math.exp(1), 9) -> 2.718281828``. [docs](https://docs.python.org/3/library/math.html#math.exp)
- **`math.ceil(x)` and `math.floor(x)`** round up and down to a whole number. ``math.ceil(6499.36) -> 6500`` and ``math.floor(1.75) -> 1``. Use `ceil` for a sample size, because you cannot recruit part of a user. [docs](https://docs.python.org/3/library/math.html#math.ceil)
- **`math.comb(n, k)`** is the number of ways to choose `k` of `n`. ``math.comb(10, 3) -> 120``. [docs](https://docs.python.org/3/library/math.html#math.comb)
- **`math.lgamma(x)`** is the log of the gamma function, and `math.lgamma(k + 1)` is `log(k!)` without overflow. ``round(math.lgamma(6), 9) -> 4.787491743`` is `log(120)`. [docs](https://docs.python.org/3/library/math.html#math.lgamma)
- **`math.tan(x)`, `math.pi`, `math.e`** are the tangent and the two constants. The Cauchy draw is `math.tan(math.pi * (u - 0.5))`. ``round(math.tan(math.pi * (0.75 - 0.5)), 9) -> 1.0``, ``math.pi -> 3.141592653589793``, ``math.e -> 2.718281828459045``. [docs](https://docs.python.org/3/library/math.html#math.tan)
- **`math.inf`** is positive infinity, and `-math.inf` is the log-likelihood of an impossible outcome. ``-math.inf < -1e308 -> True``. [docs](https://docs.python.org/3/library/math.html#math.inf)
- **`math.isclose(a, b, rel_tol=..., abs_tol=...)`** compares floats. The default `abs_tol` is 0, so anything compared with 0 needs one. ``math.isclose(0.1 + 0.2, 0.3) -> True``, ``math.isclose(0.0, 1e-12) -> False``, ``math.isclose(0.0, 1e-12, abs_tol=1e-9) -> True``. [docs](https://docs.python.org/3/library/math.html#math.isclose)
- **`math.erf(x)`** is the error function. `0.5 * (1 + math.erf(x / math.sqrt(2)))` is the standard normal cdf, the same number `NormalDist().cdf(x)` gives. ``round(0.5 * (1 + math.erf(1.96 / math.sqrt(2))), 6) -> 0.975002``. [docs](https://docs.python.org/3/library/math.html#math.erf)

### Exact arithmetic and iteration

- **`fractions.Fraction(a, b)`** is an exact ratio that reduces itself. ``fractions.Fraction(6, 36) -> 1/6``. Use it while you count, and switch to a float only at the end. `float(fractions.Fraction(1, 6))` gives ``float(fractions.Fraction(1, 6)) -> 0.16666666666666666``. [docs](https://docs.python.org/3/library/fractions.html)
- **`itertools.product(a, b)`** lists every pair, and `repeat=2` pairs a list with itself. ``len(list(itertools.product(range(1, 7), repeat=2))) -> 36``. [docs](https://docs.python.org/3/library/itertools.html#itertools.product)
- **`itertools.accumulate(xs)`** gives running totals. ``list(itertools.accumulate([5, 3, 2])) -> [5, 8, 10]``. [docs](https://docs.python.org/3/library/itertools.html#itertools.accumulate)
- **`bisect.bisect_right(sorted_list, x)`** counts the items at or below `x` in a sorted list, which is the position where `x` would go after any equal items. ``bisect.bisect_right([5, 8, 10], 7.5) -> 1``, ``bisect.bisect_right([5, 8, 10], 8) -> 2``. [docs](https://docs.python.org/3/library/bisect.html#bisect.bisect_right)
- **`collections.Counter(items)`** counts how often each item appears, and a missing key counts as 0 with no `KeyError`. ``collections.Counter('aab')['c'] -> 0``, ``dict(collections.Counter('aab')) -> {'a': 2, 'b': 1}``. [docs](https://docs.python.org/3/library/collections.html#collections.Counter)
- **`copy.deepcopy(x)`** copies a list or dict and everything inside it. A test uses it to keep a copy of an input before calling your function, then checks the input is unchanged. ``(lambda a: (lambda b: (b.append(9), a)[1])(copy.deepcopy(a)))([[1], [2]]) -> [[1], [2]]`` still prints the original, because the copy took the `append`. [docs](https://docs.python.org/3/library/copy.html#copy.deepcopy)

### Hashing

- **`zlib.crc32(data)`** is a fast 32-bit hash of bytes, the same on every machine. ``zlib.crc32(b'apple') -> 2838417488``. The built-in `hash` is salted per process, so sketches never use it. [docs](https://docs.python.org/3/library/zlib.html#zlib.crc32)
- **`hashlib.blake2b(data, digest_size=8)`** with `.digest()` gives 8 bytes of hash. ``hashlib.blake2b(b'apple', digest_size=8).hexdigest() -> 960eb5a047f5aedf``. [docs](https://docs.python.org/3/library/hashlib.html#hashlib.blake2b)
- **`int.from_bytes(b, 'big')`** reads bytes as one integer, most significant byte first. ``int.from_bytes(b'\x01\x00', 'big') -> 256``. [docs](https://docs.python.org/3/library/stdtypes.html#int.from_bytes)
- **`n.bit_length()`** is the number of bits needed for `n`, with 0 needing none. ``(1 << 59).bit_length() -> 60`` and ``(0).bit_length() -> 0``. It gives the rank in HyperLogLog. [docs](https://docs.python.org/3/library/stdtypes.html#int.bit_length)

### Built-ins and statements

- **`len(x)`** is how many items a list, dict or string holds. ``len([3, 1, 2]) -> 3``. [docs](https://docs.python.org/3/library/functions.html#len)
- **`sum(iterable)`** adds the items, and `True` counts as 1, which is how you count matches. ``sum(x > 3 for x in [1, 5, 2, 9]) -> 2``. [docs](https://docs.python.org/3/library/functions.html#sum)
- **`min(...)` and `max(...)`** are the smallest and largest item, optionally by a key. ``max([0.1, 0.7, 0.3]) -> 0.7``, ``max(range(1, 1000), key=lambda p: -abs(p - 700)) -> 700``. [docs](https://docs.python.org/3/library/functions.html#max)
- **`sorted(iterable)`** returns a new list in ascending order and leaves the original alone. It is stable: items that compare equal keep their input order, which is how ties resolve "first one wins". `reverse=True` still keeps equal items in input order. ``sorted([3, 1, 2]) -> [1, 2, 3]``, ``sorted([('a', 1), ('b', 1), ('c', 0)], key=lambda t: t[1], reverse=True) -> [('a', 1), ('b', 1), ('c', 0)]``. [docs](https://docs.python.org/3/library/functions.html#sorted)
- **`round(x, d)`** rounds to `d` places, and halves go to the even neighbour. ``round(0.1234567891, 9) -> 0.123456789``, ``round(2.5) -> 2``. [docs](https://docs.python.org/3/library/functions.html#round)
- **`abs(x)`** is the distance from zero. ``abs(-0.25) -> 0.25``. [docs](https://docs.python.org/3/library/functions.html#abs)
- **`zip(a, b)`** walks two sequences side by side, stopping at the shorter. ``list(zip([1, 2, 3], [4, 5, 6])) -> [(1, 4), (2, 5), (3, 6)]``. [docs](https://docs.python.org/3/library/functions.html#zip)
- **`enumerate(seq, start=0)`** pairs each item with a counter. ``list(enumerate(['a', 'b'], 1)) -> [(1, 'a'), (2, 'b')]``. [docs](https://docs.python.org/3/library/functions.html#enumerate)
- **`iter(x)`** turns a list or string into a one-shot iterator. A test passes `iter(...)` to a function that must read a stream once, in order, without `len` or indexing. ``list(iter('abc')) -> ['a', 'b', 'c']``. [docs](https://docs.python.org/3/library/functions.html#iter)
- **`isinstance(x, int)`** checks a type. Tests use it to insist on an `int`, a `tuple` or a `Fraction` rather than a float or a list. ``isinstance(3, int) -> True``, ``isinstance(3.0, int) -> False``. [docs](https://docs.python.org/3/library/functions.html#isinstance)
- **`tuple(iterable)`** makes a fixed-length, read-only sequence, and a function can return several values as one. ``tuple([0.6, 2.2]) -> (0.6, 2.2)``. [docs](https://docs.python.org/3/library/stdtypes.html#tuples)
- **`list.append(x)`** adds one item to the end, in place, and returns `None`, so `xs = xs.append(1)` throws your list away. ``(lambda xs: (xs.append(4), xs)[1])([1, 2, 3]) -> [1, 2, 3, 4]``. [docs](https://docs.python.org/3/tutorial/datastructures.html#more-on-lists)
- **`dict.items()`** gives the key and value pairs, for looping. ``list({'a': 0.5, 'b': 0.3}.items()) -> [('a', 0.5), ('b', 0.3)]``. [docs](https://docs.python.org/3/library/stdtypes.html#dict.items)
- **The `assert` statement** raises `AssertionError` when its condition is false, and does nothing when it is true. `assert 1 + 1 == 2` passes. `assert 1 + 1 == 3, 'message'` fails and shows the message. Every test is a handful of `assert` lines. [docs](https://docs.python.org/3/reference/simple_stmts.html#the-assert-statement)

## Notation

- **mu**, written as the Greek letter mu, is a population mean. **x-bar** is a sample mean, `sum(x) / n`.
- **sigma** is a population standard deviation, and **sigma^2** is its variance. **s** is the sample standard deviation, which divides by `n - 1`.
- **p-hat** is a proportion measured in a sample, `k / n`. **p** with no hat is the true rate.
- **P(A)** is the probability of event A, between 0 and 1. **P(A | B)** is the probability of A given that B happened, read the bar as "given".
- **E[X]** is the expected value of a random variable X: each value weighted by its probability and added up.
- **Var(X)** is the variance of X, `E[(X - mu) ** 2]`. Its square root is the standard deviation.
- **Sigma for sums**: the big Greek Sigma means add up the terms that follow, as `sum(...)` does in Python. `sum(x_i)` over `i = 1` to `n` is the Python `sum(xs)`.
- **ln** is the natural logarithm, `math.log` in Python. **exp** is its inverse, `math.exp`.
- **H(p)** is the entropy of a distribution p, `-sum(p_i * ln p_i)`, in nats.
- **H(p, q)** is the cross-entropy, `-sum(p_i * ln q_i)`: the average surprise when outcomes follow p and you score them with the model q.
- **KL(p || q)** is the Kullback-Leibler divergence from q to p, `H(p, q) - H(p)`. The two bars are part of the name, and the order matters.
- **SE** is the standard error, the spread of an estimate across repeated samples. **CI** is a confidence interval. **z** is a distance in standard deviations. **alpha** is the significance level.

## The formulas

Each formula is followed by one worked number. The left side of each `->` is a Python expression you can paste into `python3 -c 'print(...)'` after `import math, statistics, fractions`, and the right side is what it prints.

### Thinking in samples

Absolute error is `|estimate - truth|`. Relative error divides that by `|truth|`, and is undefined when the truth is 0. Error shrinks roughly like `1 / sqrt(n)`.

```
round(abs(0.34 - 0.3) / abs(0.3), 9) -> 0.133333333
round(1 / math.sqrt(100), 4) -> 0.1
```

### Describing data

Mean is `sum(x) / n`. Sample variance is `sum((x - mean) ** 2) / (n - 1)`, and the standard deviation is its square root. The sum of squared distances for `[2, 4, 4, 4, 5, 5, 7, 9]` is 32, so dividing by 7 gives the sample variance. The inclusive quantile for a fraction `q` sits at position `h = (n - 1) * q` of the sorted data, and is `s[i] + (h - i) * (s[i + 1] - s[i])` with `i = floor(h)`. The histogram bin of `x` over `[lo, hi]` is `int((x - lo) * bins / (hi - lo))`. Welford's one-pass update keeps `n`, `mean` and `m2`, and the variance is `m2 / (n - 1)`.

```
sum((x - 5.0) ** 2 for x in [2, 4, 4, 4, 5, 5, 7, 9]) / 7 -> 4.571428571428571
statistics.stdev([2, 4, 4, 4, 5, 5, 7, 9]) -> 2.138089935299395
(lambda s, q: s[int((len(s) - 1) * q)] + ((len(s) - 1) * q - int((len(s) - 1) * q)) * (s[int((len(s) - 1) * q) + 1] - s[int((len(s) - 1) * q)]))([2, 4, 4, 4, 5, 5, 7, 9], 0.75) -> 5.5
int((7 - 0) * 5 / (10 - 0)) -> 3
```

### Probability rules

With equally likely outcomes `P(event) = favourable / total`. Complement: `P(not A) = 1 - P(A)`. Addition: `P(A or B) = P(A) + P(B) - P(A and B)`. Multiplication for independent events: `P(A and B) = P(A) * P(B)`. At least one: `1 - P(none)`. Birthday: `P(no match) = 365/365 * 364/365 * ...`.

```
fractions.Fraction(6, 36) -> 1/6
fractions.Fraction(1, 6) + fractions.Fraction(1, 6) - fractions.Fraction(1, 36) -> 11/36
1 - 0.99 ** 20 -> 0.18209306240276923
round(1 - math.prod([(365 - i) / 365 for i in range(23)]), 9) -> 0.507297234
```

### Conditional probability and Bayes

`P(A | B) = P(A and B) / P(B)`. Bayes rule: `P(A | B) = P(B | A) * P(A) / P(B)`, where `P(B) = P(B | A) * P(A) + P(B | not A) * P(not A)`. Precision is `tp / (tp + fp)` and recall is `tp / (tp + fn)`. The example is a test with 99% sensitivity and 95% specificity for a condition with 1% prevalence.

```
fractions.Fraction(3, 18) -> 1/6
round(0.99 * 0.01 / (0.99 * 0.01 + (1 - 0.95) * (1 - 0.01)), 9) -> 0.166666667
40 / (40 + 10) -> 0.8
40 / (40 + 20) -> 0.6666666666666666
```

### Random variables

`E[X] = sum(x * p(x))`. `Var(X) = sum(p(x) * (x - mu) ** 2) = E[X ** 2] - mu ** 2`. `E[X + Y] = E[X] + E[Y]`, always. `Var(X + Y) = Var(X) + Var(Y)` for independent X and Y. Tries until the first success take `1 / p` in expectation. The PMF of a sum adds `p_x * p_y` into the bucket `x + y`.

```
sum(x * fractions.Fraction(1, 6) for x in range(1, 7)) -> 7/2
sum(fractions.Fraction(1, 6) * (x - fractions.Fraction(7, 2)) ** 2 for x in range(1, 7)) -> 35/12
1 / 0.25 -> 4.0
sum(fractions.Fraction(1, 36) for x in range(1, 7) for y in range(1, 7) if x + y == 7) -> 1/6
```

### Outliers and data quality

`IQR = Q3 - Q1`. The Tukey fences, by convention, are `Q1 - 1.5 * IQR` and `Q3 + 1.5 * IQR`. The z-score is `(x - mean) / sd` with the sample sd, and flagging `|z| > 3` is a convention. With `n` values no `|z|` can exceed `(n - 1) / sqrt(n)`, so on 10 values the convention can never fire. The median absolute deviation is `MAD = median(|x - median|)`, and the modified z-score is `0.6745 * (x - median) / MAD`, flagged at 3.5 by convention.

```
statistics.quantiles([12, 14, 13, 15, 14, 13, 12, 16, 15, 14, 13, 90], n=4, method='inclusive') -> [13.0, 14.0, 15.0]
13.0 - 1.5 * (15.0 - 13.0) -> 10.0
(10 - 1) / math.sqrt(10) -> 2.846049894151541
round(0.6745 * (500 - 10.0) / 1.0, 3) -> 330.505
```

### Common distributions

Binomial: `P(X = k) = comb(n, k) * p ** k * (1 - p) ** (n - k)`, with mean `n * p` and variance `n * p * (1 - p)`. Poisson: `P(X = k) = exp(-lam) * lam ** k / k!`, with mean and variance both `lam`, and in logs `exp(k * ln(lam) - lam - lgamma(k + 1))`. Exponential wait by inverse transform: `-ln(1 - u) / lam`. Normal: `z = (x - mu) / sigma`.

```
math.comb(10, 3) * 0.5 ** 3 * 0.5 ** 7 -> 0.1171875
round(math.exp(-2.0) * 2.0 ** 3 / math.factorial(3), 9) -> 0.180447044
math.exp(200 * math.log(150.0) - 150.0 - math.lgamma(201)) -> 1.5038027878284683e-05
round(-math.log(1 - 0.5) / 2.0, 9) -> 0.34657359
round(statistics.NormalDist(100, 15).cdf(130), 9) -> 0.977249868
```

### Correlation and causation

`cov(x, y) = sum((x_i - mean_x) * (y_i - mean_y)) / (n - 1)`. Pearson `r = cov(x, y) / (sd_x * sd_y)`, always between -1 and 1. Spearman is Pearson on the ranks. In a Simpson reversal, the pooled rate is total successes over total trials, not the mean of the group rates.

```
statistics.covariance([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 5]) -> 3.2
round(statistics.correlation([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 7, 5]), 9) -> 0.791794655
round(statistics.correlation([1, 2, 2, 3, 5], [2, 4, 3, 3, 9], method='ranked'), 9) -> 0.763157895
round(float(fractions.Fraction(9 + 30, 10 + 100)), 4) -> 0.3545
```

### Large numbers and the CLT

Standard error of a mean: `SE = sigma / sqrt(n)`, estimated by `s / sqrt(n)`. The sample size for a margin `m` at normal quantile `z` is `ceil((z * sigma / m) ** 2)`. The mean of `n` draws is close to normal when the variance is finite, and the mean of Cauchy draws never settles.

```
round(statistics.stdev([3.1, 2.7, 4.0, 3.6, 2.9]) / math.sqrt(5), 4) -> 0.2379
math.ceil((statistics.NormalDist().inv_cdf(0.975) * 15 / 2) ** 2) -> 217
round(math.sqrt(1 / 12) / math.sqrt(25), 4) -> 0.0577
round(math.tan(math.pi * (0.75 - 0.5)), 9) -> 1.0
```

### Sampling and bias

A simple random sample of `k` from `N` includes each item with probability `k / N`. Reservoir sampling keeps the `i`-th item with probability `k / i`. A stratum's quota is `n * size / total`, and largest-remainder rounding gives each stratum the floor and hands out the leftover units by fractional part. A post-stratification weight is population share divided by sample share, and the weighted mean is `sum(w * v) / sum(w)`.

```
5 / 100 -> 0.05
round(4 * 7 / 15, 4) -> 1.8667
round(0.4 / 0.7, 4) -> 0.5714
round((0.4 / 0.7 * (12 + 15 + 9 + 14 + 11 + 13 + 10) + 2.0 * (30 + 26 + 34)) / (7 * 0.4 / 0.7 + 3 * 2.0), 4) -> 22.8
```

### Least squares

`slope = cov(x, y) / var(x)` and `intercept = mean_y - slope * mean_x`. A residual is `y - (slope * x + intercept)`. `R^2 = 1 - SS_res / SS_tot`, which for one predictor is `r ** 2`.

```
statistics.covariance([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]) / statistics.variance([1, 2, 3, 4, 5]) -> 0.6
statistics.fmean([2, 4, 5, 4, 5]) - 0.6 * statistics.fmean([1, 2, 3, 4, 5]) -> 2.2
round(1 - 2.4 / 6.0, 6) -> 0.6
round(statistics.correlation([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]) ** 2, 6) -> 0.6
```

### Likelihood and estimation

For `k` successes in `n` trials, `L(p) = p ** k * (1 - p) ** (n - k)` and `log L(p) = k * ln(p) + (n - k) * ln(1 - p)`. The maximum likelihood estimate of a rate is `k / n`. The maximum likelihood variance divides by `n`, and Bessel's correction divides by `n - 1`, which makes the divide-by-`n` estimate too small by the factor `(n - 1) / n`. `logsumexp(xs) = m + ln(sum(exp(x - m)))` with `m = max(xs)`.

```
round(0.7 ** 7 * 0.3 ** 3, 6) -> 0.002224
7 * math.log(0.7) + 3 * math.log(0.3) -> -6.108643020548936
statistics.pvariance([3.1, 2.7, 4.0, 3.6, 2.9]) -> 0.2264
statistics.variance([3.1, 2.7, 4.0, 3.6, 2.9]) -> 0.283
(5 - 1) / 5 -> 0.8
3 + math.log(sum(math.exp(x - 3) for x in [1, 2, 3])) -> 3.4076059644443806
```

### Counting at scale

Count-Min width is `ceil(e / eps)` and depth is `ceil(ln(1 / delta))`, and an estimate is at most `eps * N` too high with probability at least `1 - delta`. In HyperLogLog the top `b` bits of a 64-bit hash pick the register, and the rank is `(64 - b) - rest.bit_length() + 1`. Linear counting for small estimates is `m * ln(m / zeros)`. The typical relative error is `1.04 / sqrt(m)`.

```
math.ceil(math.e / 0.01) -> 272
math.ceil(math.log(1 / 0.01)) -> 5
(1 << 63) >> (64 - 4) -> 8
(64 - 4) - (0).bit_length() + 1 -> 61
round(64 * math.log(64 / 10), 4) -> 118.8031
round(1.04 / math.sqrt(1024), 4) -> 0.0325
```

### Confidence intervals and bootstrap

Mean interval: `mean - z * s / sqrt(n)` to `mean + z * s / sqrt(n)`, with `z = NormalDist().inv_cdf(1 - alpha / 2)`. Wald for a rate: `p_hat +- z * sqrt(p_hat * (1 - p_hat) / n)`. Wilson: centre `(p_hat + z ** 2 / (2 * n)) / (1 + z ** 2 / n)` and half-width `z / (1 + z ** 2 / n) * sqrt(p_hat * (1 - p_hat) / n + z ** 2 / (4 * n ** 2))`. The bootstrap picks index `int(rng.random() * n)`, `B` times. The standard error of a simulated coverage `c` over `reps` runs is `sqrt(c * (1 - c) / reps)`.

```
statistics.NormalDist().inv_cdf(0.975) -> 1.9599639845400536
statistics.fmean([12.1, 9.8, 11.4, 10.6, 13.0, 10.2, 11.7, 12.5, 9.9, 11.3]) - statistics.NormalDist().inv_cdf(0.975) * statistics.stdev([12.1, 9.8, 11.4, 10.6, 13.0, 10.2, 11.7, 12.5, 9.9, 11.3]) / math.sqrt(10) -> 10.564012605410982
3 / 40 - statistics.NormalDist().inv_cdf(0.975) * math.sqrt(3 / 40 * (1 - 3 / 40) / 40) -> -0.006624323226237974
(lambda z, p, n: (p + z ** 2 / (2 * n)) / (1 + z ** 2 / n) - z / (1 + z ** 2 / n) * math.sqrt(p * (1 - p) / n + z ** 2 / (4 * n ** 2)))(statistics.NormalDist().inv_cdf(0.975), 3 / 40, 40) -> 0.025836025774588198
int(0.61 * 5) -> 3
math.sqrt(0.95 * 0.05 / 2000) -> 0.004873397172404482
```

### Entropy, cross-entropy and KL

Surprise is `-ln p` in nats, or `-log2 p` in bits. `H(p) = -sum(p_i * ln p_i)`. `H(p, q) = -sum(p_i * ln q_i)`. `KL(p || q) = sum(p_i * ln(p_i / q_i)) = H(p, q) - H(p)`. `softmax(z)_i = exp((z_i - max) / T) / sum(exp((z_j - max) / T))`. `perplexity = exp(-mean(log-probabilities))`.

```
-math.log(0.25) -> 1.3862943611198906
-sum(x * math.log(x) for x in [0.5, 0.25, 0.25]) -> 1.0397207708399179
-sum(a * math.log(b) for a, b in zip([0.5, 0.25, 0.25], [0.4, 0.4, 0.2])) -> 1.0895775270141412
sum(a * math.log(a / b) for a, b in zip([0.5, 0.25, 0.25], [0.4, 0.4, 0.2])) -> 0.04985675617422343
round(1 / sum(math.exp(v - 2.0) for v in [2.0, 1.0, 0.1]), 3) -> 0.659
math.exp(-statistics.fmean([-0.1, -2.3, -0.7, -1.2])) -> 2.9299929005337013
```

### Bayesian updating

Posterior is proportional to likelihood times prior, divided by the sum over the candidates. With a `Beta(a, b)` prior and `k` successes in `n` trials the posterior is `Beta(a + k, b + n - k)`, with mean `(a + k) / (a + b + n)`. A simulated share has error about `sqrt(p * (1 - p) / draws)`. A 95% credible interval, given the model and the prior, is the central 95% of the posterior.

```
round(0.7 ** 7 * 0.3 ** 3 / sum(t ** 7 * (1 - t) ** 3 for t in [0.3, 0.5, 0.7]), 3) -> 0.679
(1 + 8) / (1 + 1 + 30) -> 0.28125
(2 + 8) / (2 + 2 + 30) -> 0.29411764705882354
math.sqrt(0.91 * 0.09 / 10000) -> 0.002861817604250837
```

### Hypothesis tests

The pooled rate is `p_pool = (k1 + k2) / (n1 + n2)`. The standard error under the null is `se = sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))`, `z = (k2 / n2 - k1 / n1) / se`, and the two-sided p-value is `2 * (1 - NormalDist().cdf(abs(z)))`. A permutation p-value is `(count + 1) / (reps + 1)`. Power is `cdf(d - zc) + cdf(-d - zc)` with `d = delta * sqrt(n) / sigma` and `zc = inv_cdf(1 - alpha / 2)`. The sample size for a power is `((zc + inv_cdf(power)) / (delta / sigma)) ** 2`. The 0.05 for alpha is a convention.

```
math.sqrt(0.2375 * (1 - 0.2375) * (1 / 200 + 1 / 200)) -> 0.042555111326373005
(55 / 200 - 40 / 200) / math.sqrt(0.2375 * (1 - 0.2375) * (1 / 200 + 1 / 200)) -> 1.7624204863381403
2 * (1 - statistics.NormalDist().cdf(abs((55 / 200 - 40 / 200) / math.sqrt(0.2375 * (1 - 0.2375) * (1 / 200 + 1 / 200))))) -> 0.07799827984931706
(40 + 1) / (5000 + 1) -> 0.008198360327934412
(lambda N, d, zc: N.cdf(d - zc) + N.cdf(-d - zc))(statistics.NormalDist(), 0.3 * math.sqrt(50) / 1, statistics.NormalDist().inv_cdf(0.975)) -> 0.564116025431004
((statistics.NormalDist().inv_cdf(0.975) + statistics.NormalDist().inv_cdf(0.8)) / 0.3) ** 2 -> 87.20977482610098
```

### A/B tests

Users per arm: `(z_alpha + z_beta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2)) / (p1 - p2) ** 2`, rounded up. By convention `z_alpha` is 1.96 and `z_beta` is 0.84 for 80% power. Sample ratio mismatch: `z = (n_a - N * r) / sqrt(N * r * (1 - r))`, the chi-square is `z ** 2`, and flagging `p < 0.001` is a convention. Across `m` independent metrics, `P(at least one) = 1 - (1 - alpha) ** m`. Bonferroni tests each at `alpha / m`. Benjamini-Hochberg rejects the `k` smallest p-values for the largest rank `k` with `p_(k) <= k * q / m`.

```
(1.96 + 0.84) ** 2 * (0.2 * (1 - 0.2) + 0.22 * (1 - 0.22)) / (0.2 - 0.22) ** 2 -> 6499.360000000006
math.sqrt(100000 * 0.5 * (1 - 0.5)) -> 158.11388300841898
((50600 - 100000 * 0.5) / math.sqrt(100000 * 0.5 * (1 - 0.5))) ** 2 -> 14.399999999999999
1 - (1 - 0.05) ** 20 -> 0.6415140775914581
0.05 / 20 -> 0.0025
round(3 * 0.05 / 8, 5) -> 0.01875
```

### Drift detection

`PSI = sum((a_i - e_i) * ln(a_i / e_i))` over bins, with `e` the reference shares and `a` the current shares. It equals `KL(a || e) + KL(e || a)`. The cutoffs 0.1 and 0.25 are conventions from credit scoring. With no shift, PSI averages about `(1 / N + 1 / M) * (B - 1)` for windows of `N` and `M` values and `B` bins. The KS statistic is `D = max |F_a(x) - F_b(x)|`, and its 5% cutoff is `1.358 * sqrt((n + m) / (n * m))` with `1.358 = sqrt(-ln(0.025) / 2)`.

```
sum((y - x) * math.log(y / x) for x, y in zip([0.25, 0.25, 0.25, 0.25], [0.1, 0.2, 0.3, 0.4])) -> 0.22821740957339182
round((1 / 1000 + 1 / 100) * 9, 3) -> 0.099
math.sqrt(-math.log(0.025) / 2) -> 1.3581015157406195
round(1.358 * math.sqrt((1000 + 1000) / (1000 * 1000)), 3) -> 0.061
```

### Error bars on evals

`SE = s / sqrt(n)`, and for 0/1 scores about `sqrt(p * (1 - p) / n)`. The paired difference has `SE_paired = s_d / sqrt(n)`, and `variance(d) = variance(a) + variance(b) - 2 * covariance(a, b)`. With every question in its own cluster the clustered error is the naive one, and a cluster of `c` questions that always agree multiplies it by `sqrt(c)`. Questions needed: `ceil((z_alpha + z_beta) ** 2 * sd_diff ** 2 / delta ** 2)`. A Beta(11, 1) posterior has cdf `t ** 11`, so its 2.5% quantile is `0.025 ** (1 / 11)`.

```
math.sqrt(0.695 * 0.305 / 200) -> 0.03255572146336186
1.96 * math.sqrt(0.7 * 0.3 / 200) -> 0.06351125884439703
round(statistics.variance([1, 0, 1, 1, 0, 1]) + statistics.variance([1, 0, 0, 1, 0, 0]) - 2 * statistics.covariance([1, 0, 1, 1, 0, 1], [1, 0, 0, 1, 0, 0]), 9) -> 0.266666667
round(statistics.variance([0, 0, 1, 0, 0, 1]), 9) -> 0.266666667
round(math.sqrt(10), 9) -> 3.16227766
math.ceil(((1.96 + 0.84) * 0.4 / 0.02) ** 2) -> 3136
0.025 ** (1 / 11) -> 0.7150858470818455
```

## How the tests work

Each exercise has a block of tests that runs in your browser against the function you wrote. They are plain Python.

**Test functions and labels.** A test is a function whose name starts with `test_`, followed by a docstring that is the label you see in the results. The docstring is the plain-English statement of what the test checks, so when a test fails, read the label first.

```python
def test_extremes():
    """p of 0 is all zeros and p of 1 is all ones"""
    assert flips(5, 0.0, random.Random(3)) == [0, 0, 0, 0, 0]
```

**The `assert` statement and the Expected vs actual panel.** A line `assert a == b` passes silently when `a == b` is true and fails when it is not. When an assert fails, the panel shows the value the test expected next to the value your function returned, so you can see the difference.

**Seeded randomness.** A test that needs randomness builds its own generator, as in `random.Random(7)`, and passes it in as `rng`. The same seed gives the same draws, so the test can pin an exact answer. The one cross-version guarantee Python makes is that the `rng.random()` sequence for a seed does not change, so every hard-coded value on this roadmap is built from `rng.random()` alone and your function must call it in the order the exercise says.

**Property or band checks for everything else.** The results of `rng.choices`, `rng.sample`, `rng.shuffle`, `rng.gauss` and `rng.betavariate` can differ between Python versions, even for the same seed. A test on a function built from them checks a property, such as five items with no repeats all in range, or a tolerance band, such as a coverage between 0.93 and 0.97, and never an exact value.

**Comparing floats.** A test rounds a float to nine places before comparing, as in `round(got, 9) == 0.033333333`, and for a list it rounds each item. When a number is tiny or huge, a test formats it to nine significant digits instead, as in `f'{x:.9g}' == '1.50380279e-05'`. Never compare computed floats with `==` in your own code.

```python
assert round(0.1 + 0.2, 9) == 0.3
assert f'{1.5038027878284683e-05:.9g}' == '1.50380279e-05'
```

**Checking that a function raises.** The pattern is `try`, `except` and `else`. The call goes in the `try`. If it raises the right error, the `except` branch runs and the test passes. If it does not raise, the `else` branch runs and raises an `AssertionError`, which fails the test.

```python
def test_bad_p():
    """p outside 0 to 1 raises ValueError"""
    try:
        flips(3, 1.5, random.Random(1))
    except ValueError:
        pass
    else:
        raise AssertionError('p of 1.5 should have raised ValueError')
```

**Functions passed in as arguments.** Some exercises take a function as a parameter, with names like `fn`, `draw` and `ci_fn`. The test defines a small function, passes it in, and your code calls it. A `draw` takes `rng` and returns one value, and a `ci_fn` takes a sample and returns `(lo, hi)`. Call it exactly as the exercise describes, and do not assume anything else about it.

**Comments that name another exercise's function.** A test comment may say where a hard-coded value came from, such as `hll_new(4) after a0 to a29` in Counting at scale. That names a function from an earlier exercise, and the comment is there so you can see how the number was produced. Your answer does not need it, and the test does not call it.
