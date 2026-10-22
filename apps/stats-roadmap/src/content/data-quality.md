# Outliers & data quality

Profile a table before you trust it, and flag outliers with Tukey fences and robust scores that one bad value cannot hide.

## Profile before you trust

Before you compute a mean or fit anything, look at the table itself. Three numbers per column catch most problems: how many rows there are, what share of each column is null, and how many distinct values it holds. A column that is 60% null or has one distinct value is not the column you thought you had.

The hard part is deciding what a null is. Real tables spell "missing" several ways, and all of these count here: the key is absent from the row, the value is `None`, the value is a string that is empty after `strip()`, or the value is a float NaN. NaN is the one that surprises people: it is the only float that is not equal to itself, so `x != x` is the test.

```python
nan = float('nan')
print(nan == nan, nan != nan)
```

This prints `False True`. Put the rules in one small predicate, then count:

```python
def is_null(v):
    return v is None or (isinstance(v, str) and not v.strip()) or v != v
```

The rate for a column is the number of null rows divided by the number of rows. A key that is missing from a row counts as null for that row. An empty table has no columns to report, so the profile is `{}`.

Distinct values come from `len(set(values))`, and `statistics.mode` gives the most common one. Both are cheap, and a column of ids with fewer distinct values than rows is a duplicate-key bug you want to hear about now.

## Tukey fences

An outlier is a value far from the rest of the column. "Far" needs a ruler that a single bad value cannot stretch. The quartiles are such a ruler: Q1 and Q3 are the 25th and 75th percentiles, and the interquartile range is `IQR = Q3 - Q1`. See [Describing data › Percentiles and quartiles](#/describing/percentiles-and-quartiles).

Tukey's fences put a gate on each side:

```
lower fence = Q1 - 1.5 * IQR
upper fence = Q3 + 1.5 * IQR
```

A value outside the fences is flagged. The 1.5 is a convention, not a law: it is the multiplier John Tukey proposed for box plots, and the [NIST handbook](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm) describes it that way. A multiplier of 3 flags only the far-out values.

```python
import statistics

xs = [12, 14, 13, 15, 14, 13, 12, 16, 15, 14, 13, 90]
q1, _, q3 = statistics.quantiles(xs, n=4, method='inclusive')
print(q1, q3, q3 - q1)
```

This prints `13.0 15.0 2.0`. The fences are `13 - 3 = 10.0` and `15 + 3 = 18.0`, so `90` is flagged and nothing else is. Pass `method='inclusive'` so the quartiles are interpolated between data points the way most spreadsheets do it. Tools use different quartile methods, so the same data can give slightly different fences elsewhere. That is one more reason to call 1.5 a convention.

## z-scores and masking

The other familiar ruler is the z-score. It says how many standard deviations a value sits from the mean:

```
z = (x - mean) / sd
```

Use the sample standard deviation, the one with `n - 1`. A common rule is to flag `|z| > 3`. That 3 is a convention too, and the [NIST handbook](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm) discusses where it comes from and where it fails.

It fails because the outlier is part of the data that sets the ruler. One huge value drags the mean toward itself and blows up the standard deviation, and its own z-score shrinks. This is masking. There is a hard ceiling: with `n` values, no `|z|` can exceed `(n - 1) / sqrt(n)`. For 10 values that ceiling is `2.846`, so `|z| > 3` can never fire, however wild the data.

```python
ten = [10, 11, 9, 10, 12, 10, 11, 9, 10, 500]
mean, sd = statistics.fmean(ten), statistics.stdev(ten)
print(round(max(abs(x - mean) / sd for x in ten), 6))
```

This prints `2.846`. The value `500` is fifty times the others and still scores `2.846`, below 3. Put the same 500 among 100 values and its z is `9.896`, because the ceiling is `9.9` there. The rule works on large samples and silently stops working on small ones.

## Robust scores with the median

The fix is a ruler built from the median, which one bad value cannot move. The median absolute deviation is:

```
MAD = median(|x - median|)
```

The modified z-score rescales it so it reads like a z-score:

```
M = 0.6745 * (x - median) / MAD
```

The flag `|M| > 3.5` is a convention. Iglewicz and Hoaglin proposed it, and the [NIST page](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm) cites it. On the same ten values the median is `10.0` and the MAD is `1.0`, so `500` scores `M = 330.505` and every other value scores at most `1.349` in absolute terms. The outlier no longer hides.

```python
med = statistics.median(ten)
mad = statistics.median(abs(x - med) for x in ten)
print(med, mad, round(0.6745 * (500 - med) / mad, 3))
```

This prints `10.0 1.0 330.505`. There is a catch: when more than half the values are equal, the MAD is 0 and the score divides by zero. The score is undefined there, so a function should raise `ValueError` and say so rather than return infinities. Constant input has the same problem for the standard deviation in `z`.

```python playground
import statistics

xs = [12, 14, 13, 15, 14, 13, 12, 16, 15, 14, 13, 90]
q1, _, q3 = statistics.quantiles(xs, n=4, method='inclusive')
iqr = q3 - q1
print('fences', q1 - 1.5 * iqr, q3 + 1.5 * iqr)
print('tukey', [x for x in xs if x < q1 - 1.5 * iqr or x > q3 + 1.5 * iqr])

ten = [10, 11, 9, 10, 12, 10, 11, 9, 10, 500]
mean, sd = statistics.fmean(ten), statistics.stdev(ten)
print('max |z|', round(max(abs(x - mean) / sd for x in ten), 6))

med = statistics.median(ten)
mad = statistics.median(abs(x - med) for x in ten)
print('modified z of 500', round(0.6745 * (500 - med) / mad, 3))

# Try: add a second 500 to `ten` and watch both scores.
```

## Exercises

### 1. Null rate per column

Write `null_rates(rows)`. `rows` is a list of dicts. The columns are the union of all keys, in the order each key is first seen. For each column return the share of rows where the value is null: the key is missing from the row, the value is `None`, the value is a string that is empty after `strip()`, or the value is a float NaN (`x != x`). The rate is `nulls / len(rows)`. Return a dict from column to rate. For `[]` return `{}`.

```python starter
def null_rates(rows):
    ...
```

```python test
def test_rates_and_order():
    """rates per column in first-seen order"""
    rows = [
        {'id': 1, 'age': 34, 'city': 'north'},
        {'id': 2, 'age': None, 'city': '   '},
        {'id': 3, 'age': float('nan'), 'city': 'south', 'email': 'a@x.test'},
        {'id': 4, 'age': 29},
    ]
    got = null_rates(rows)
    assert list(got) == ['id', 'age', 'city', 'email']
    assert [round(v, 9) for v in got.values()] == [0.0, 0.5, 0.5, 0.75]


def test_what_counts_as_null():
    """none, blank, whitespace, nan and a missing key count; zero does not"""
    rows = [{'a': None}, {'a': ''}, {'a': ' \t'}, {'a': float('nan')}, {}, {'a': 0}, {'a': 'x'}, {'a': 0.0}]
    assert round(null_rates(rows)['a'], 9) == 0.625


def test_thirds():
    """one null in three rows"""
    got = null_rates([{'v': 1}, {'v': None}, {'v': 3}])
    assert round(got['v'], 9) == 0.333333333


def test_empty():
    """no rows gives an empty dict"""
    assert null_rates([]) == {}
```

#### Uses
- [Outliers & data quality › Profile before you trust](#/data-quality/profile-before-you-trust)

#### Hints
- Collect the columns first with a loop over the rows and their keys. A dict remembers insertion order, so `setdefault` keeps first-seen order.
- Write a small `is_null(value)` predicate, and treat a missing key as null by looking the key up with `row.get(col)`.
- NaN is the only value where `v != v` is true. Check for `None` and strings first, so the comparison only ever sees real values.
- For each column, `sum(is_null(row.get(col)) for row in rows) / len(rows)`.

#### Tips
- `0` and `0.0` are real values, not nulls. Test with `is None`, not with truthiness.
- Whitespace-only strings are the quiet ones: `'  '` is truthy until you call `strip()`.

#### Docs
- [Python docs: `str.strip`](https://docs.python.org/3/library/stdtypes.html#str.strip)
- [Python docs: `dict.setdefault`](https://docs.python.org/3/library/stdtypes.html#dict.setdefault)

### 2. Tukey fences

Write `tukey_outliers(xs, k=1.5)`. Compute `Q1` and `Q3` with `statistics.quantiles(xs, n=4, method='inclusive')`, which returns three cut points: use the first and the last. Let `IQR = Q3 - Q1`. Return the values below `Q1 - k * IQR` or above `Q3 + k * IQR`, in their input order. A column with no spread gives `[]`. Raise `ValueError` for fewer than 2 values.

```python starter
import statistics


def tukey_outliers(xs, k=1.5):
    ...
```

```python test
def test_default_fences():
    """values past the 1.5 fences, in input order"""
    xs = [10, 12, 11, 13, 12, 11, 10, 12, 14, 13, 19, 95]
    assert tukey_outliers(xs) == [19, 95]
    assert tukey_outliers([95, 12, 11, 13, 19, 12, 10, 14, 12, 11, 13, 10]) == [95, 19]


def test_wider_k_flags_fewer():
    """k of 3 keeps only the far value"""
    xs = [10, 12, 11, 13, 12, 11, 10, 12, 14, 13, 19, 95]
    assert tukey_outliers(xs, k=3) == [95]


def test_low_side():
    """a low outlier is flagged too"""
    xs = [-10, -12, -11, -13, -12, -11, -10, -12, -14, -13, -19, -95]
    assert tukey_outliers(xs) == [-19, -95]


def test_no_spread_and_too_short():
    """a constant column has none; fewer than two values raises"""
    assert tukey_outliers([5, 5, 5, 5]) == []
    for bad in ([], [7]):
        try:
            tukey_outliers(bad)
        except ValueError:
            pass
        else:
            raise AssertionError('fewer than 2 values should have raised ValueError')
```

#### Uses
- [Outliers & data quality › Tukey fences](#/data-quality/tukey-fences)
- [Describing data › Percentiles and quartiles](#/describing/percentiles-and-quartiles)

#### Hints
- `quartiles = statistics.quantiles(xs, n=4, method='inclusive')` gives `[Q1, median, Q3]`.
- Compute `iqr`, then the two fences, once, before you look at any value.
- Return a list comprehension over `xs` so the order stays the input order.
- Guard `len(xs) < 2` yourself at the top. Newer Python versions changed what `quantiles` does on one value, so do not rely on it.

#### Tips
- A constant column has `IQR = 0`, so both fences equal the value and nothing is strictly outside them.
- Quartile methods differ between tools, so do not expect another library's fences to match to the last digit.

#### Docs
- [Python docs: `statistics.quantiles`](https://docs.python.org/3/library/statistics.html#statistics.quantiles)
- [NIST: Tukey outlier rule](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm)

### 3. Modified z-scores

Write `modified_z(xs)` and `robust_outliers(xs, threshold=3.5)`. `modified_z` returns `0.6745 * (x - median) / MAD` for each value, as a list of floats in input order, where `MAD` is the median of `|x - median|`. `robust_outliers` returns the values whose absolute score is above `threshold`, in input order. When `MAD` is 0 the score is undefined, so both functions raise `ValueError`. An empty list gives `[]` from `modified_z`.

```python starter
import statistics


def modified_z(xs):
    ...


def robust_outliers(xs, threshold=3.5):
    ...
```

```python test
XS = [10, 11, 12, 12, 13, 14, 100]


def test_scores():
    """rounded modified z for each value"""
    got = modified_z(XS)
    assert [round(v, 9) for v in got] == [-1.349, -0.6745, 0.0, 0.0, 0.6745, 1.349, 59.356]


def test_outliers():
    """only the far value passes 3.5"""
    assert robust_outliers(XS) == [100]
    assert robust_outliers(XS, threshold=1.0) == [10, 14, 100]


def test_mad_zero_raises():
    """more than half equal values makes the score undefined"""
    for f in (modified_z, robust_outliers):
        try:
            f([5, 5, 5, 5, 9])
        except ValueError:
            pass
        else:
            raise AssertionError('a MAD of 0 should have raised ValueError')


def test_empty():
    """no values, no scores"""
    assert modified_z([]) == []
```

#### Uses
- [Outliers & data quality › Robust scores with the median](#/data-quality/robust-scores-with-the-median)
- [Describing data › Center: mean and median](#/describing/center-mean-and-median)

#### Hints
- Compute `med = statistics.median(xs)` first.
- The MAD is the median of the list of distances from `med`. It is itself a median, so call `statistics.median` again.
- Check for a MAD of 0 before you divide, and raise `ValueError` with a message that says why.
- `robust_outliers` can reuse `modified_z` and pair each score with its value using `zip`.

#### Tips
- Raising from `modified_z` means `robust_outliers` raises for free, with no second check.
- The constant 0.6745 makes the MAD comparable to a standard deviation when the data is roughly normal.

#### Docs
- [Python docs: `statistics.median`](https://docs.python.org/3/library/statistics.html#statistics.median)
- [NIST: detection of outliers](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm)

### 4. When z-scores miss

Write `z_scores(xs)` and `z_outliers(xs, threshold=3.0)`. `z_scores` returns `(x - mean) / sd` for each value in input order, using the sample standard deviation (with `n - 1`). `z_outliers` returns the values with `|z| > threshold`, in input order. Raise `ValueError` for constant input, where the standard deviation is 0. An empty list gives `[]` from `z_scores`. The tests show the masking effect: a huge value among ten is not flagged, and the same value among a hundred is.

```python starter
import statistics


def z_scores(xs):
    ...


def z_outliers(xs, threshold=3.0):
    ...
```

```python test
def test_scores():
    """z with the sample standard deviation"""
    assert [round(v, 9) for v in z_scores([1, 2, 3])] == [-1.0, 0.0, 1.0]
    assert [round(v, 9) for v in z_scores([2, 4, 4, 6])] == [-1.224744871, 0.0, 0.0, 1.224744871]


def test_masking_among_ten():
    """one huge value among ten hides itself"""
    ten = [10, 11, 9, 10, 12, 10, 11, 9, 10, 500]
    assert z_outliers(ten) == []
    assert round(max(abs(z) for z in z_scores(ten)), 9) == 2.846000094


def test_flagged_among_a_hundred():
    """the same value among a hundred is flagged"""
    big = [10 + (i % 5) for i in range(99)] + [500]
    assert z_outliers(big) == [500]


def test_constant_raises():
    """a standard deviation of 0 makes z undefined"""
    try:
        z_scores([4, 4, 4])
    except ValueError:
        pass
    else:
        raise AssertionError('constant input should have raised ValueError')
```

#### Uses
- [Outliers & data quality › z-scores and masking](#/data-quality/z-scores-and-masking)
- [Describing data › Spread: variance and standard deviation](#/describing/spread-variance-and-standard-deviation)

#### Hints
- You need the mean and the sample standard deviation of the whole list, outlier included. That is exactly what causes the masking.
- `statistics.stdev` is the sample version with `n - 1`. `statistics.pstdev` is the other one, so check which you called.
- If the standard deviation is 0, raise `ValueError` before dividing.
- `z_outliers` pairs each value with its score using `zip` and keeps those with `abs(z) > threshold`.

#### Tips
- With `n` values `|z|` can never exceed `(n - 1) / sqrt(n)`. For ten values that is about 2.846, so the 3.0 rule cannot fire at all.
- When you suspect masking, run the robust score from the last exercise on the same data and compare.

#### Docs
- [Python docs: `statistics.stdev`](https://docs.python.org/3/library/statistics.html#statistics.stdev)
- [NIST: detection of outliers](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm)
