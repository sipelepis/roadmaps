# Entropy, cross-entropy & KL

Entropy, cross-entropy and KL divergence in nats, softmax that never overflows, and perplexity from token log-probabilities.

## Surprise

An outcome you expected tells you little when it happens. One you thought unlikely tells you a lot. Surprise puts a number on that:

```
surprise(p) = -ln p      in nats
surprise(p) = -log2 p    in bits
```

```python
import math

for p in (0.5, 0.25, 0.01):
    print(p, -math.log(p), -math.log2(p))
```

A fair coin landing heads, probability 0.5, has a surprise of `0.6931471805599453` nats or `1.0` bit. Probability 0.25 gives `1.3862943611198906` nats or `2.0` bits: each halving of `p` adds one bit. Probability 0.01 gives `4.605170185988091` nats. A certain outcome has a surprise of 0, and an impossible one has no finite surprise at all.

Why a log? Independent events multiply their probabilities, as in [Rules of probability](#/probability/rules-of-probability). A log turns that product into a sum, so the surprise of two independent events is the sum of their surprises. It is the same move as [Working in logs](#/estimation/working-in-logs).

Nats use the natural log, which is what `math.log` gives and what machine learning libraries report. One nat is `1 / ln 2` bits, which is `1.4426950408889634`. Everything on this page is in nats.

## Entropy

Draw many outcomes from a distribution and average their surprise:

```python
import random

p = [0.5, 0.25, 0.25]
rng = random.Random(1)
draws = rng.choices(range(3), weights=p, k=10000)
print(sum(-math.log(p[x]) for x in draws) / len(draws))
```

This prints `1.03812653232463`. The long-run average is the entropy, the [expected value](#/random-variables/expected-value-and-variance) of the surprise:

```
H(p) = -sum(p_i * ln p_i)
```

For `[0.5, 0.25, 0.25]` that is `1.0397207708399179` nats, or `1.5` bits, and the sample average above lands close to it.

Entropy measures how hard the outcome is to predict. A fair coin has `0.6931471805599453`, a 0.9/0.1 coin has `0.3250829733914482`, and a 0.99/0.01 coin has `0.056001534354847345`. The more lopsided the distribution, the less entropy. Among `k` outcomes, the uniform distribution has the most, `ln k`, which is `1.3862943611198906` for 4 outcomes. A certain outcome has entropy 0.

An outcome with `p = 0` never happens, so it adds nothing, and the term `0 * ln 0` counts as 0. Python does not know that: `math.log(0)` raises `ValueError: math domain error`. Skip zero entries before you take the log. The standard library has no entropy function. In scipy it is `scipy.stats.entropy(p)`.

## Cross-entropy

Now say the outcomes follow `p`, but you score each one with a model `q`: you pay `-ln q_i` when outcome `i` happens. Score the same draws with `q = [0.4, 0.4, 0.2]`:

```python
q = [0.4, 0.4, 0.2]
print(sum(-math.log(q[x]) for x in draws) / len(draws))
```

This prints `1.0902013594766453`. The long-run average is the cross-entropy:

```
H(p, q) = -sum(p_i * ln q_i)
```

For these two it is `1.0895775270141412` nats, above the `1.0397207708399179` of `H(p)`. Cross-entropy is never less than the entropy of `p`, and it equals it only when `q` is `p`. A wrong model always costs extra surprise.

This is the classification loss. The true label puts all its weight on one class, so the sum keeps one term: `-ln q[true class]`. A model that gives the true class 0.8 pays `0.2231435513142097`. One that gives it 0.1 pays `2.3025850929940455`. Averaged over a dataset, this is the negative [log-likelihood](#/estimation/log-likelihood) of the labels per example, so minimising cross-entropy is [maximum likelihood](#/estimation/maximum-likelihood).

## KL divergence

The extra surprise from using `q` when the truth is `p` has its own name, the Kullback-Leibler divergence:

```
KL(p || q) = sum(p_i * ln(p_i / q_i)) = H(p, q) - H(p)
```

For the same `p` and `q`, `KL(p || q)` is `0.04985675617422343`, and `H(p, q) - H(p)` gives the same up to float rounding. Four facts to keep:

- It is 0 when `q` equals `p`, and positive otherwise.
- It is not symmetric. Here `KL(q || p)` is `0.054115320909768436`, so it is not a distance.
- It is infinite when some `q_i` is 0 where `p_i > 0`. A model that calls a real outcome impossible pays an unbounded price the first time it happens.
- With `p` fixed, `H(p)` is a constant, so minimising cross-entropy over `q` minimises KL. Training a model on cross-entropy pulls its distribution toward the data's. Chapter 3 of the [Deep Learning book](https://www.deeplearningbook.org/contents/prob.html) covers this.

`scipy.stats.entropy(p, q)` computes KL in nats.

## Softmax and temperature

A classifier outputs one raw score per class, called a logit. Softmax turns logits into probabilities:

```
softmax(z)_i = exp(z_i / T) / sum(exp(z_j / T))
```

`T` is the temperature, 1 by default. Computed as written, it fails on large logits: `math.exp(1000)` raises `OverflowError: math range error`. The fix is to subtract the largest logit from every logit first. That multiplies the top and the bottom by the same factor, so the answer does not change, and the largest exponential becomes `exp(0)`, which is 1. It is the log-sum-exp trick from [Working in logs](#/estimation/working-in-logs).

```python
def softmax(z, T=1.0):
    top = max(z)
    e = [math.exp((v - top) / T) for v in z]
    s = sum(e)
    return [x / s for x in e]

for T in (0.5, 1.0, 2.0):
    print(T, [round(v, 3) for v in softmax([2.0, 1.0, 0.1], T)])
```

At `T = 1` the logits `[2.0, 1.0, 0.1]` give `[0.659, 0.242, 0.099]`, rounded to three places. At `T = 0.5` they give `[0.864, 0.117, 0.019]`, and at `T = 2` they give `[0.502, 0.304, 0.194]`. Low temperature sharpens the distribution toward the top logit. High temperature flattens it toward uniform: the three entropies are 0.454, 0.847 and 1.026 nats, rounded to three places, climbing toward `ln 3`. This is the temperature setting on a language model, low for predictable text and high for varied text.

Only the differences between logits matter. `softmax([1000.0, 999.0, 998.1])` runs without overflow and gives the same probabilities as `[2.0, 1.0, 0.1]`, up to float rounding.

## Perplexity

A language model gives each token of a text a probability. Take the natural log of each, average, negate, and exponentiate:

```
perplexity = exp(-mean(log-probabilities))
```

The inside, `-mean(log-probabilities)`, is the cross-entropy per token, so perplexity is `exp` of the cross-entropy. It reads as a number of options. A model that gives every token probability 0.25 has perplexity `4.0`: it is as unsure as a fair choice among 4 tokens.

```python
import statistics

lp = [-0.1, -2.3, -0.7, -1.2]
print(math.exp(-statistics.fmean(lp)))
```

This prints `2.9299929005337013`: on these four tokens the model is about as unsure as a fair choice among 3. Add a fifth token it found unlikely, with a log-probability of -9.2, and the perplexity jumps to `14.87973172487283`. One confident mistake moves the average of logs a long way.

Lower is better, and the floor is 1, for a model that gave every token probability 1. Compare perplexities only on the same text with the same tokenizer, because a different split into tokens changes what is being averaged.

```python playground
import math


def entropy(p):
    return -sum(x * math.log(x) for x in p if x > 0)


def cross_entropy(p, q):
    return -sum(a * math.log(b) for a, b in zip(p, q) if a > 0)


def kl(p, q):
    return sum(a * math.log(a / b) for a, b in zip(p, q) if a > 0)


def softmax(z, T=1.0):
    top = max(z)
    e = [math.exp((v - top) / T) for v in z]
    s = sum(e)
    return [x / s for x in e]


p = [0.5, 0.25, 0.25]
q = [0.4, 0.4, 0.2]
print('H(p)     ', entropy(p))
print('H(p, q)  ', cross_entropy(p, q))
print('KL(p||q) ', kl(p, q))
print('KL(q||p) ', kl(q, p))

logits = [2.0, 1.0, 0.1]
for T in (0.25, 0.5, 1.0, 2.0, 10.0):
    probs = softmax(logits, T)
    print('T', T, [round(v, 3) for v in probs], 'entropy', round(entropy(probs), 3))

logprobs = [-0.1, -2.3, -0.7, -1.2]
print('perplexity', math.exp(-sum(logprobs) / len(logprobs)))

# Try: add 1000 to every logit, move q closer to p, or append -9.2 to logprobs.
```

## Exercises

### 1. Entropy in nats

Write `entropy(p)`, which takes a list of probabilities and returns the entropy in nats: `-sum(x * math.log(x))` over the entries, skipping any entry that is exactly `0` (an impossible outcome adds nothing). Raise `ValueError` if the list is empty, if any entry is negative, or if the entries do not sum to 1 within `1e-9`.

```python starter
import math


def entropy(p):
    ...
```

```python test
def test_uniform():
    """uniform distributions have entropy of log n"""
    assert round(entropy([0.5, 0.5]), 9) == 0.693147181
    assert round(entropy([0.25, 0.25, 0.25, 0.25]), 9) == 1.386294361


def test_skewed():
    """a skewed distribution has less entropy"""
    assert round(entropy([0.7, 0.2, 0.1]), 9) == 0.801818553


def test_certain():
    """a certain outcome has zero entropy and zeros are skipped"""
    assert round(entropy([1.0, 0.0]), 9) == 0.0
    assert round(entropy([0.0, 0.5, 0.5]), 9) == 0.693147181


def test_bad_input():
    """empty, negative or non-normalised input raises ValueError"""
    for p in ([], [-0.5, 1.5], [0.5, 0.4], [0.6, 0.6]):
        try:
            entropy(p)
        except ValueError:
            pass
        else:
            raise AssertionError(f'entropy({p}) should have raised ValueError')
```

#### Uses
- [Entropy, cross-entropy & KL › Entropy](#/information/entropy)
- [Entropy, cross-entropy & KL › Surprise](#/information/surprise)

#### Hints
- Validate first: empty, any negative entry, then the sum. Use `abs(sum(p) - 1) > 1e-9` for the sum, never `!=`.
- Each entry contributes `x * math.log(x)`. Leave out the entries that are exactly 0, because `math.log(0)` raises.
- Sum the contributions with a generator that filters out zeros, and negate the total.

#### Tips
- Use `math.log2` instead of `math.log` and you get bits. The two differ by a factor of `ln 2`.
- The tests check that a uniform distribution over 4 gives `ln 4`. That is the most any 4-outcome distribution can have.

#### Docs
- [Python docs: `math.log`](https://docs.python.org/3/library/math.html#math.log)

### 2. Cross-entropy and KL

Write `cross_entropy(p, q)` and `kl(p, q)`, each returning a float in nats. `cross_entropy` is `-sum(p_i * math.log(q_i))`. `kl` is `sum(p_i * math.log(p_i / q_i))`. In both, skip every entry where `p_i == 0`. If some `q_i == 0` while `p_i > 0`, return `math.inf`. If `p` and `q` have different lengths, raise `ValueError`.

```python starter
import math


def cross_entropy(p, q):
    ...


def kl(p, q):
    ...
```

```python test
import math


def test_known_values():
    """cross-entropy and KL for a small example"""
    p = [0.5, 0.25, 0.25]
    q = [0.25, 0.5, 0.25]
    assert round(cross_entropy(p, q), 9) == 1.213007566
    assert round(kl(p, q), 9) == 0.173286795
    assert round(kl(p, p), 9) == 0.0


def test_kl_is_not_symmetric():
    """kl(p, q) and kl(q, p) differ"""
    p = [0.7, 0.2, 0.1]
    q = [0.5, 0.3, 0.2]
    assert round(kl(p, q), 9) == 0.085122826
    assert round(kl(q, p), 9) == 0.09203285


def test_cross_entropy_splits():
    """cross-entropy is the entropy of p plus kl(p, q)"""
    p = [0.7, 0.2, 0.1]
    q = [0.5, 0.3, 0.2]
    assert round(cross_entropy(p, q) - kl(p, q), 9) == 0.801818553


def test_zeros():
    """zero in p is skipped and zero in q where p is positive is infinite"""
    assert round(kl([0.0, 1.0], [0.5, 0.5]), 9) == 0.693147181
    assert round(kl([1.0, 0.0], [1.0, 0.0]), 9) == 0.0
    assert kl([0.5, 0.5], [1.0, 0.0]) == math.inf
    assert cross_entropy([0.5, 0.5], [1.0, 0.0]) == math.inf


def test_length_mismatch():
    """different lengths raise ValueError"""
    for f in (cross_entropy, kl):
        try:
            f([0.5, 0.5], [1.0])
        except ValueError:
            pass
        else:
            raise AssertionError('different lengths should have raised ValueError')
```

#### Uses
- [Entropy, cross-entropy & KL › Cross-entropy](#/information/cross-entropy)
- [Entropy, cross-entropy & KL › KL divergence](#/information/kl-divergence)

#### Hints
- Check the lengths first. Then walk the pairs with `zip(p, q)`.
- For each pair: skip it when `p_i` is 0, return `math.inf` when `q_i` is 0, and otherwise add the term.
- Both functions have the same loop. Only the term differs: `-p_i * math.log(q_i)` for one, `p_i * math.log(p_i / q_i)` for the other.

#### Tips
- `kl(p, q)` should equal `cross_entropy(p, q)` minus the entropy of `p`. That is a quick check on your code.
- Return `math.inf` before you call `math.log(0)`, which would raise instead.

#### Docs
- [Python docs: `math.inf`](https://docs.python.org/3/library/math.html#math.inf)
- [Deep Learning, chapter 3: Probability and Information Theory](https://www.deeplearningbook.org/contents/prob.html)

### 3. Softmax with temperature

Write `softmax(logits, T=1.0)`, which returns a list of probabilities that sum to 1. Divide each logit by the temperature `T` and take `exp`, but first subtract `max(logits)` so a large logit cannot overflow. Each output is its exponential over the sum of all of them. An empty list returns `[]`. If `T` is 0 or negative, raise `ValueError`.

```python starter
import math


def softmax(logits, T=1.0):
    ...
```

```python test
def test_values():
    """softmax of 1, 2, 3"""
    got = softmax([1.0, 2.0, 3.0])
    assert [round(v, 9) for v in got] == [0.090030573, 0.244728471, 0.665240956]
    assert round(sum(got), 9) == 1.0


def test_temperature():
    """a low temperature sharpens and a high one flattens"""
    cold = softmax([1.0, 2.0, 3.0], 0.5)
    hot = softmax([1.0, 2.0, 3.0], 10)
    assert [round(v, 9) for v in cold] == [0.01587624, 0.117310428, 0.866813332]
    assert [round(v, 9) for v in hot] == [0.300609605, 0.332224994, 0.367165401]


def test_large_logits():
    """logits near 1000 do not overflow"""
    assert [round(v, 9) for v in softmax([1000.0, 1000.0])] == [0.5, 0.5]
    assert [round(v, 9) for v in softmax([1000.0, 999.0])] == [0.731058579, 0.268941421]


def test_edges():
    """empty gives empty and T of 0 or less raises ValueError"""
    assert softmax([]) == []
    for T in (0, -1.0):
        try:
            softmax([1.0, 2.0], T)
        except ValueError:
            pass
        else:
            raise AssertionError(f'T of {T} should have raised ValueError')
```

#### Uses
- [Entropy, cross-entropy & KL › Softmax and temperature](#/information/softmax-and-temperature)
- [Likelihood & estimation › Working in logs](#/estimation/working-in-logs)

#### Hints
- Check `T` before anything else, and return `[]` for an empty list before you call `max`.
- Subtract `max(logits)` from each logit, divide by `T`, then take `math.exp`. The largest term is then exactly 1.
- Divide each exponential by the sum of all of them.

#### Tips
- Subtracting the max changes nothing in exact arithmetic, because the same factor appears in every term and in the total.
- As `T` shrinks, softmax puts nearly all the weight on the largest logit. As `T` grows, it approaches uniform.

#### Docs
- [Python docs: `math.exp`](https://docs.python.org/3/library/math.html#math.exp)

### 4. Perplexity from token log-probs

Write `perplexity(logprobs)`, which takes the natural-log probability the model gave each token and returns `math.exp(-sum(logprobs) / len(logprobs))`. Raise `ValueError` if the list is empty or any log-prob is greater than 0, because a probability cannot exceed 1.

```python starter
import math


def perplexity(logprobs):
    ...
```

```python test
import math


def test_uniform_tokens():
    """four equally likely options give a perplexity of 4"""
    assert round(perplexity([math.log(0.25)] * 4), 9) == 4.0


def test_mixed():
    """a mixed list of log-probs"""
    assert round(perplexity([-1.0, -2.0, -3.0]), 9) == 7.389056099


def test_certain():
    """log-probs of 0 give a perplexity of 1"""
    assert round(perplexity([0.0, 0.0]), 9) == 1.0


def test_bad_input():
    """empty or positive log-probs raise ValueError"""
    for lp in ([], [-1.0, 0.5]):
        try:
            perplexity(lp)
        except ValueError:
            pass
        else:
            raise AssertionError(f'perplexity({lp}) should have raised ValueError')
```

#### Uses
- [Entropy, cross-entropy & KL › Perplexity](#/information/perplexity)
- [Entropy, cross-entropy & KL › Cross-entropy](#/information/cross-entropy)

#### Hints
- Check for an empty list and for any value above 0 first.
- The mean log-probability is `sum(logprobs) / len(logprobs)`. It is 0 or negative.
- Negate the mean, then pass it to `math.exp`.

#### Tips
- `-mean(logprobs)` is the cross-entropy per token. Perplexity is `exp` of it.
- A log-probability of exactly 0 means probability 1, which is allowed. Only values above 0 are impossible.

#### Docs
- [Python docs: `math.exp`](https://docs.python.org/3/library/math.html#math.exp)
- [Python docs: `statistics.fmean`](https://docs.python.org/3/library/statistics.html#statistics.fmean)
