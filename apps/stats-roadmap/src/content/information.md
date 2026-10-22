# Entropy, cross-entropy & KL

Entropy, cross-entropy and KL divergence in nats, softmax that never overflows, and perplexity from token log-probabilities.

## Surprise

Not written yet.

## Entropy

Not written yet.

## Cross-entropy

Not written yet.

## KL divergence

Not written yet.

## Softmax and temperature

Not written yet.

## Perplexity

Not written yet.

```python playground
print("This module is not written yet.")
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
