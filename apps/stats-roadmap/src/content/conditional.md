# Conditional probability & Bayes

Condition on what you know, apply Bayes rule, and see why a test that catches 99% of cases is usually wrong about rare things.

## Conditioning shrinks the world

Learning something changes which outcomes are still possible. Roll two dice and ask for the probability that the sum is 8. Now someone tells you the first die is even. You throw away the outcomes where it is odd, and count again inside what is left.

```python
from fractions import Fraction
from itertools import product

dice = list(product(range(1, 7), repeat=2))
b = [o for o in dice if o[0] % 2 == 0]
a_and_b = [o for o in b if o[0] + o[1] == 8]
print(len(b), len(a_and_b), Fraction(len(a_and_b), len(b)))
```

This prints `18 3 1/6`. Without the hint, 5 of 36 outcomes sum to 8, which is `5/36`. With it, 3 of the 18 remaining outcomes do, which is `1/6`. The conditional probability of A given B is:

```
P(A | B) = P(A and B) / P(B) = count(A and B) / count(B)
```

Read `|` as "given". The world has shrunk to B, and you ask how much of it is A. If B never happens there is no world to look in, and the probability is undefined. Raise `ValueError`, do not return 0.

Order matters. `P(A | B)` and `P(B | A)` are different questions. In a table of 100 customers on a free plan, 30 of whom churned, and 42 churned customers in all, `P(churned | free) = 30 / 100 = 0.3`, while `P(free | churned) = 30 / 42 = 0.7142857142857143`. Most churners are on the free plan, but only 30% of free users churn.

## Independence

Events A and B are independent when learning B does not change A: `P(A | B) = P(A)`. Then the multiplication rule from the last module follows:

```
P(A and B) = P(A) * P(B)
```

With two dice, "the sum is 7" and "the first die is 6" are independent. `P(sum is 7) = 1/6`, and among the six outcomes with a first 6 exactly one sums to 7, so `P(sum is 7 | first is 6) = 1/6`. Whatever the first die shows, 7 stays one chance in six. The sum 8 and an even first die are not independent: you saw `5/36` against `1/6`.

Do not assume independence because it is convenient. Two requests to the same overloaded server are not independent: if one is slow, the other is likelier to be slow. Treat the independence of two things as a claim to check against the data, not a default.

## Bayes rule

You often know `P(B | A)` and want `P(A | B)`. Write the joint probability two ways, `P(A and B) = P(B | A) * P(A) = P(A | B) * P(B)`, and divide by `P(B)`:

```
P(A | B) = P(B | A) * P(A) / P(B)
```

`P(A)` is the prior: how likely A was before you looked. `P(A | B)` is the posterior: how likely it is after.

`P(B)` is often not given. Split B by whether A is true. This is the law of total probability:

```
P(B) = P(B | A) * P(A) + P(B | not A) * P(not A)
```

Put the two together and a medical test becomes a short function. With sensitivity `P(positive | has it)` and specificity `P(negative | does not have it)`, the chance of a positive among healthy people is `1 - specificity`.

## The base rate fallacy

A test is 99% sensitive and 95% specific, and 1% of people have the condition. You test positive. How likely is it that you have it? Most people say 95% or more. Count it instead. Take 10,000 people:

```python
n = 10_000
sick = n * 1 // 100
healthy = n - sick
true_pos = sick * 99 // 100
false_pos = healthy * 5 // 100
print(true_pos, false_pos, true_pos / (true_pos + false_pos))
```

This prints `99 495 0.16666666666666666`. Of the 100 sick people, 99 test positive. Of the 9,900 healthy people, 5% test positive by mistake, which is 495. Of the 594 positives, only 99 are sick. Bayes rule gives the same `0.166666667`, rounded to nine places.

The prior dominates because the condition is rare. A small false-positive rate applied to a huge healthy group still outnumbers a high hit rate applied to a tiny sick group. When something is rare, a positive result is much weaker evidence than the test's accuracy suggests. This is the base rate fallacy: ignoring the prior. It shows up in fraud flags, intrusion alerts and spam filters. If the base rate of what you hunt is 1 in 1,000, a 1% false-positive rate buries you in false alarms.

## Precision and recall

A classifier that predicts a yes or no gives four counts, the confusion matrix: true positives `tp` (predicted yes, was yes), false positives `fp` (predicted yes, was no), false negatives `fn` (predicted no, was yes) and true negatives `tn`.

```
precision = tp / (tp + fp)    = P(actual + | predicted +)
recall    = tp / (tp + fn)    = P(predicted + | actual +)
```

Both are conditional probabilities, with different conditions. Precision says: of the alarms, how many were real? That is the posterior from the last section. Recall says: of the real ones, how many did you catch? That is the sensitivity. With `tp = 40`, `fp = 10`, `fn = 20` and `tn = 930`, precision is `0.8` and recall is `0.6666666666666666`.

Either denominator can be 0. A model that never predicts yes has `tp + fp = 0`, and a dataset with no real positives has `tp + fn = 0`. Here, return `0.0` and say so in the docs. Otherwise a nightly evaluation run dies on a `ZeroDivisionError` in the middle of a report.

```python playground
from fractions import Fraction
from itertools import product

dice = list(product(range(1, 7), repeat=2))
b = [o for o in dice if o[0] % 2 == 0]
print(Fraction(sum(o[0] + o[1] == 8 for o in b), len(b)))


def posterior(prev, sens, spec):
    pos = sens * prev + (1 - spec) * (1 - prev)
    return sens * prev / pos


for prev in (0.5, 0.1, 0.01, 0.001):
    print(prev, round(posterior(prev, 0.99, 0.95), 4))

tp, fp, fn, tn = 40, 10, 20, 930
print(tp / (tp + fp), tp / (tp + fn))

# Try: raise the specificity to 0.999 and see what a 1% prevalence does.
```

## Exercises

### 1. P(A|B) from a count table

Write `p_given(table, a, b) -> float`. `table` maps `(a_value, b_value)` to a count. Return the count where `A = a` and `B = b`, divided by the total count where `B = b`. A pair missing from the table counts as 0. If the total for `B = b` is 0, raise `ValueError`.

```python starter
def p_given(table, a, b):
    ...
```

```python test
TABLE = {
    ('churned', 'free'): 30, ('stayed', 'free'): 70,
    ('churned', 'pro'): 10, ('stayed', 'pro'): 90,
    ('churned', 'team'): 2, ('stayed', 'team'): 48,
}


def test_churn_by_plan():
    """probability of churn within each plan"""
    assert round(p_given(TABLE, 'churned', 'free'), 9) == 0.3
    assert round(p_given(TABLE, 'churned', 'pro'), 9) == 0.1
    assert round(p_given(TABLE, 'churned', 'team'), 9) == 0.04
    assert round(p_given(TABLE, 'stayed', 'free'), 9) == 0.7


def test_order_matters():
    """P(A|B) is not P(B|A)"""
    flipped = {(b, a): n for (a, b), n in TABLE.items()}
    assert round(p_given(TABLE, 'churned', 'free'), 9) == 0.3
    assert round(p_given(flipped, 'free', 'churned'), 9) == 0.714285714


def test_missing_pair():
    """a pair that never occurs has probability 0"""
    table = {('churned', 'free'): 3, ('stayed', 'free'): 7, ('stayed', 'pro'): 5}
    assert p_given(table, 'churned', 'pro') == 0.0


def test_b_never_happens():
    """conditioning on something that never occurs raises ValueError"""
    for table, b in ((TABLE, 'enterprise'), ({}, 'free'), ({('churned', 'free'): 0}, 'free')):
        try:
            p_given(table, 'churned', b)
        except ValueError:
            pass
        else:
            raise AssertionError(f'p_given on {b!r} with no cases should have raised ValueError')
```

#### Uses
- [Conditional probability & Bayes › Conditioning shrinks the world](#/conditional/conditioning-shrinks-the-world)

#### Hints
- Add up the counts of every pair whose second item equals `b`. That is `count(B = b)`.
- If that total is 0, raise `ValueError` before dividing.
- The numerator is the count for the exact pair `(a, b)`. `table.get((a, b), 0)` gives 0 for a missing pair.
- Divide the numerator by the total. You are staying inside the rows where `B = b`.

#### Tips
- A table of counts is the same as a contingency table. Dividing by a row total is what "conditioning" means in practice.
- Divide by the total of the whole table instead and you get `P(A and B)`, a different number.

#### Docs
- [Python docs: `dict.get`](https://docs.python.org/3/library/stdtypes.html#dict.get)

### 2. Bayes for a test

Write `posterior(prevalence, sensitivity, specificity) -> float`: the probability that someone has the condition, given a positive test. It is `sensitivity * prevalence / (sensitivity * prevalence + (1 - specificity) * (1 - prevalence))`. If the probability of a positive test is 0, which happens when prevalence is 0 and specificity is 1, raise `ValueError`.

```python starter
def posterior(prevalence, sensitivity, specificity):
    ...
```

```python test
def test_rare_condition():
    """a 99% sensitive, 95% specific test on a 1% condition"""
    assert round(posterior(0.01, 0.99, 0.95), 9) == 0.166666667


def test_even_odds():
    """with prevalence 0.5 the test is much more convincing"""
    assert round(posterior(0.5, 0.9, 0.8), 9) == 0.818181818


def test_nobody_has_it():
    """prevalence 0 with a leaky test gives 0.0"""
    assert posterior(0.0, 0.99, 0.9) == 0.0


def test_impossible_positive():
    """a perfect test on a condition nobody has cannot come back positive"""
    try:
        posterior(0.0, 0.99, 1.0)
    except ValueError:
        pass
    else:
        raise AssertionError('a positive that cannot happen should have raised ValueError')
```

#### Uses
- [Conditional probability & Bayes › Bayes rule](#/conditional/bayes-rule)
- [Conditional probability & Bayes › The base rate fallacy](#/conditional/the-base-rate-fallacy)

#### Hints
- First compute the chance of a positive test: `sensitivity * prevalence + (1 - specificity) * (1 - prevalence)`.
- If that is 0 there is nothing to condition on. Raise `ValueError`.
- The posterior is the true-positive part, `sensitivity * prevalence`, divided by the chance of a positive.
- This is Bayes rule with the law of total probability in the denominator.

#### Tips
- Try `posterior(0.001, 0.99, 0.99)`. Even a test that is 99% sensitive and 99% specific, on a 1-in-1,000 condition, is mostly false alarms.
- Counting 10,000 people, as in the article, gives the same answer without the formula.

#### Docs
- [Python docs: `fractions`](https://docs.python.org/3/library/fractions.html)

### 3. Precision and recall

Write three functions. `confusion(actual, predicted) -> dict` takes two equal-length lists of bools and returns `{'tp': ..., 'fp': ..., 'fn': ..., 'tn': ...}` with the four counts. `precision(cm) -> float` is `tp / (tp + fp)` and `recall(cm) -> float` is `tp / (tp + fn)`, each reading a dict like the one `confusion` returns. When a denominator is 0, return `0.0`. If the two lists differ in length, `confusion` raises `ValueError`.

```python starter
def confusion(actual, predicted):
    ...


def precision(cm):
    ...


def recall(cm):
    ...
```

```python test
ACTUAL = [True, True, True, False, False, False, False, True]
PREDICTED = [True, True, False, True, False, False, False, False]


def test_counts():
    """the four cells of the confusion matrix"""
    assert confusion(ACTUAL, PREDICTED) == {'tp': 2, 'fp': 1, 'fn': 2, 'tn': 3}


def test_precision_recall():
    """rounded precision and recall"""
    cm = confusion(ACTUAL, PREDICTED)
    assert round(precision(cm), 9) == 0.666666667
    assert round(recall(cm), 9) == 0.5
    big = {'tp': 40, 'fp': 10, 'fn': 20, 'tn': 930}
    assert round(precision(big), 9) == 0.8
    assert round(recall(big), 9) == 0.666666667


def test_empty_denominators():
    """no predicted positives or no real positives gives 0.0"""
    assert precision({'tp': 0, 'fp': 0, 'fn': 3, 'tn': 1}) == 0.0
    assert recall({'tp': 0, 'fp': 2, 'fn': 0, 'tn': 5}) == 0.0
    never = confusion([True, False], [False, False])
    assert precision(never) == 0.0
    assert recall(never) == 0.0


def test_length_mismatch():
    """lists of different lengths raise ValueError"""
    try:
        confusion([True, False], [True])
    except ValueError:
        pass
    else:
        raise AssertionError('lists of different length should have raised ValueError')
```

#### Uses
- [Conditional probability & Bayes › Precision and recall](#/conditional/precision-and-recall)
- [Conditional probability & Bayes › Conditioning shrinks the world](#/conditional/conditioning-shrinks-the-world)

#### Hints
- Check the lengths first. Then walk both lists together with `zip`.
- Each pair falls in exactly one cell: both true is `tp`, predicted only is `fp`, actual only is `fn`, neither is `tn`.
- Start from a dict with all four keys at 0 and add 1 to the right one.
- In `precision` and `recall`, compute the denominator first and return `0.0` if it is 0.

#### Tips
- Precision falls when you flag too much, recall falls when you flag too little. Moving a threshold trades one for the other.
- A high precision on a rare class can still hide a poor recall, so look at both.

#### Docs
- [Python docs: `zip`](https://docs.python.org/3/library/functions.html#zip)
