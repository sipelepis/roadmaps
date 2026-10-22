# Error bars on evals

Treat an eval as a sample: standard errors, paired comparisons, clustered questions, and how many questions you need.

## An eval is a sample

Not written yet.

## Standard error of a score

Not written yet.

## Comparing two models

Not written yet.

## Clustered questions

Not written yet.

## How many questions

Not written yet.

## Small evals

Not written yet.

```python playground
print("This module is not written yet.")
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
