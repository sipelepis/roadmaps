# Least squares

Fit a line by least squares, read its residuals and R squared, and find the point that moves it most.

## Fitting a line

You have pairs `(x, y)` and want the line `y = slope * x + intercept` that sits closest to them. "Closest" has a precise meaning: the line that makes the sum of squared vertical gaps smallest. That is least squares. Deriving it takes calculus, so here the answer is stated:

```
slope     = cov(x, y) / var(x)
intercept = mean_y - slope * mean_x
```

The covariance and variance are the sample versions, with `n - 1`, from [Correlation & causation › Covariance](#/correlation/covariance). The line always passes through the point of means `(mean_x, mean_y)`, which is where the intercept formula comes from.

```python
import statistics

xs = [1, 2, 3, 4, 5]
ys = [2, 4, 5, 4, 5]
print(statistics.covariance(xs, ys), statistics.variance(xs))
print(statistics.linear_regression(xs, ys))
```

This prints `1.5 2.5` and then `LinearRegression(slope=0.6, intercept=2.2)`. By hand: the means are 3 and 4, the slope is `1.5 / 2.5 = 0.6`, and the intercept is `4 - 0.6 * 3 = 2.2`. Each extra unit of `x` goes with 0.6 more of `y`, on average.

If every `x` is the same, `var(x)` is 0 and there is no one best line, so the slope is undefined. A function should raise `ValueError`. Notice what the slope is not: it describes how `y` changes with `x` in this data. It does not say that changing `x` would change `y`; see [Correlation & causation › Correlation is not causation](#/correlation/correlation-is-not-causation).

## Residuals

A residual is what the line misses at one point:

```
residual = y - (slope * x + intercept)
```

A positive residual means the point is above the line. With the fit above the predictions are `2.8, 3.4, 4.0, 4.6, 5.2`, so the residuals are `[-0.8, 0.6, 1.0, -0.6, -0.2]`, rounded to one decimal. They add to 0. That is not luck: for a least-squares line with an intercept the residuals always sum to zero, up to float rounding.

```python
slope, intercept = statistics.linear_regression(xs, ys)
res = [y - (slope * x + intercept) for x, y in zip(xs, ys)]
print([round(r, 3) for r in res], round(sum(res), 9))
```

That prints `[-0.8, 0.6, 1.0, -0.6, -0.2] 0.0`. A sum of zero does not mean the fit is good. What you look for in the residuals is a pattern. Residuals that are a mix of positive and negative with no shape mean a straight line was a fair choice. Residuals that go positive, negative, positive as `x` increases mean the data curves and a line is the wrong shape, however high the correlation is.

## R squared

How much of the variation in `y` does the line explain? Compare the squared misses of the line with the squared misses of the simplest model, which predicts the mean of `y` everywhere:

```
SS_res = sum of squared residuals
SS_tot = sum((y - mean_y)^2)
R^2    = 1 - SS_res / SS_tot
```

`R^2 = 1` is a perfect fit. `R^2 = 0` means the line is no better than the mean. For the data above `SS_res` is `2.4` and `SS_tot` is `6.0`, so `R^2 = 1 - 2.4 / 6.0 = 0.6`.

```python
ss_res = sum(r * r for r in res)
my = statistics.fmean(ys)
ss_tot = sum((y - my) ** 2 for y in ys)
print(round(ss_res, 6), ss_tot, round(1 - ss_res / ss_tot, 6))
print(round(statistics.correlation(xs, ys), 4))
```

This prints `2.4 6.0 0.6` and then `0.7746`. For a line with one predictor, `R^2` equals `r^2`, the square of the Pearson correlation: `0.7746` squared is `0.6`. If `y` is constant, `SS_tot` is 0 and `R^2` is undefined, so raise `ValueError`.

`R^2` says how tightly the points hug the line. It does not say the line is the right shape or that `x` causes `y`.

## Influential points

Not every point pulls on the line equally. A point far from the others in `x` has leverage: the line has to swing toward it. To measure it, refit without each point in turn and see how far the slope moves.

```python
xs = [1, 2, 3, 4, 5, 6, 20]
ys = [3, 5, 6, 9, 10, 12, 15]
full = statistics.linear_regression(xs, ys).slope
for i in range(len(xs)):
    cut = statistics.linear_regression(xs[:i] + xs[i + 1:], ys[:i] + ys[i + 1:]).slope
    print(i, round(abs(cut - full), 4))
```

The first six points sit near a line with slope close to 2, and the seventh is far to the right at `x = 20` with a `y` that is too low for that line. The slope with all seven points is `0.548`. Removing each point moves it by `0.0738`, `0.0281`, `0.0139`, `0.0127`, `0.0076`, `0.0022`, and `1.2516` for the last one. Without it the slope jumps to `1.8`. One point out of seven decides the answer.

This leave-one-out check is the simple version of an idea with a name: Cook's distance combines a point's leverage and its residual into one number for how much the fit changes if that point is removed. Large values are worth investigating. The point may be a data error, or the most informative point you have. Either way you want to know it is there, and to look at the line with and without it.

```python playground
import statistics

xs = [1, 2, 3, 4, 5]
ys = [2, 4, 5, 4, 5]
slope, intercept = statistics.linear_regression(xs, ys)
res = [y - (slope * x + intercept) for x, y in zip(xs, ys)]
print('fit', slope, intercept)
print('residuals', [round(r, 3) for r in res], round(sum(res), 9))

my = statistics.fmean(ys)
ss_res = sum(r * r for r in res)
ss_tot = sum((y - my) ** 2 for y in ys)
print('R^2', round(1 - ss_res / ss_tot, 6), round(statistics.correlation(xs, ys) ** 2, 6))

xs = [1, 2, 3, 4, 5, 6, 20]
ys = [3, 5, 6, 9, 10, 12, 15]
full = statistics.linear_regression(xs, ys).slope
print('full slope', round(full, 3))
for i in range(len(xs)):
    cut = statistics.linear_regression(xs[:i] + xs[i + 1:], ys[:i] + ys[i + 1:]).slope
    print('without', i, round(cut, 4), round(abs(cut - full), 4))

# Try: raise the last y to about 37 so it falls near the other six, and rerun.
```

## Exercises

### 1. Least-squares line

Write `fit_line(xs, ys)`, which returns the tuple `(slope, intercept)` of the least-squares line, where `slope = cov(x, y) / var(x)` and `intercept = mean_y - slope * mean_x`. Raise `ValueError` if `xs` and `ys` have different lengths, if there are fewer than 2 points, or if every `x` is the same.

```python starter
def fit_line(xs, ys):
    ...
```

```python test
def test_known_fit():
    """rounded slope and intercept"""
    slope, intercept = fit_line([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])
    assert round(slope, 9) == 0.6
    assert round(intercept, 9) == 2.2
    slope, intercept = fit_line([0, 1, 2, 3], [1, 3, 2, 5])
    assert round(slope, 9) == 1.1
    assert round(intercept, 9) == 1.1


def test_exact_line():
    """points on a line give that line back"""
    slope, intercept = fit_line([0, 1, 2, 3], [-2, 1, 4, 7])
    assert round(slope, 9) == 3.0
    assert round(intercept, 9) == -2.0


def test_bad_inputs():
    """constant x, mismatched lengths and short input raise ValueError"""
    for xs, ys in (([2, 2, 2], [1, 2, 3]), ([1, 2, 3], [1, 2]), ([1], [1]), ([], [])):
        try:
            fit_line(xs, ys)
        except ValueError:
            pass
        else:
            raise AssertionError('bad input should have raised ValueError')
```

#### Uses
- [Least squares › Fitting a line](#/regression/fitting-a-line)
- [Correlation & causation › Covariance](#/correlation/covariance)

#### Hints
- Check the lengths and the count first.
- Compute `mean_x` and `mean_y`.
- The slope is the sum of `(x - mean_x) * (y - mean_y)` divided by the sum of `(x - mean_x) ** 2`. The `n - 1` cancels.
- If the sum of squared `x` deviations is 0, every `x` is the same: raise `ValueError`. Then the intercept is `mean_y - slope * mean_x`.

#### Tips
- Return a plain tuple `(slope, intercept)`, in that order.
- `statistics.linear_regression(xs, ys)` computes the same two numbers. Checking your function against it on a few inputs is a good habit once yours works.

#### Docs
- [Python docs: `statistics.linear_regression`](https://docs.python.org/3/library/statistics.html#statistics.linear_regression)

### 2. R squared

Write `r_squared(xs, ys, slope, intercept)`, which returns `1 - SS_res / SS_tot` for the line with the given slope and intercept. `SS_res` is the sum of `(y - (slope * x + intercept)) ** 2`, and `SS_tot` is the sum of `(y - mean_y) ** 2`. Raise `ValueError` if `y` is constant, because `SS_tot` is 0.

```python starter
def r_squared(xs, ys, slope, intercept):
    ...
```

```python test
def test_known_value():
    """slope and intercept given as literals"""
    assert round(r_squared([1, 2, 3, 4, 5], [2, 4, 5, 4, 5], 0.6, 2.2), 9) == 0.6


def test_perfect_fit():
    """points exactly on the line give 1"""
    assert round(r_squared([1, 2, 3], [3, 5, 7], 2.0, 1.0), 9) == 1.0


def test_mean_line():
    """a flat line at the mean explains nothing"""
    assert round(r_squared([1, 2, 3, 4, 5], [2, 4, 5, 4, 5], 0.0, 4.0), 9) == 0.0


def test_constant_y():
    """y with no spread raises ValueError"""
    try:
        r_squared([1, 2, 3], [4, 4, 4], 0.0, 4.0)
    except ValueError:
        pass
    else:
        raise AssertionError('constant y should have raised ValueError')
```

#### Uses
- [Least squares › R squared](#/regression/r-squared)
- [Least squares › Residuals](#/regression/residuals)

#### Hints
- Compute `mean_y` and `SS_tot` first. If `SS_tot` is 0, raise.
- For `SS_res`, use `zip(xs, ys)` to get each predicted value `slope * x + intercept`.
- The answer is `1 - ss_res / ss_tot`.

#### Tips
- This function takes the line as an argument, so it can score any line, not just the best one. A bad line can give a negative `R^2`.
- For the least-squares line with one predictor, the result should equal `statistics.correlation(xs, ys) ** 2`.

#### Docs
- [Python docs: `statistics.fmean`](https://docs.python.org/3/library/statistics.html#statistics.fmean)

### 3. Residuals and the most influential point

Write `residuals(xs, ys, slope, intercept)`, which returns `y - (slope * x + intercept)` for each point, in input order. Write `most_influential(xs, ys)`, which returns the index of the point whose removal changes the least-squares slope by the largest absolute amount. Ties go to the smallest index. Raise `ValueError` for fewer than 3 points. The starter gives you `fit(xs, ys)`, which returns `(slope, intercept)` using `statistics.linear_regression`. Assume removing one point never leaves every `x` the same.

```python starter
import statistics


def fit(xs, ys):
    return tuple(statistics.linear_regression(xs, ys))


def residuals(xs, ys, slope, intercept):
    ...


def most_influential(xs, ys):
    ...
```

```python test
import statistics


def test_residuals():
    """rounded residuals for a given line"""
    got = residuals([1, 2, 3, 4, 5], [2, 4, 5, 4, 5], 0.6, 2.2)
    assert [round(v, 9) for v in got] == [-0.8, 0.6, 1.0, -0.6, -0.2]


def test_residuals_sum_to_zero():
    """least-squares residuals add up to zero"""
    xs = [1, 2, 3, 4, 5, 6, 20]
    ys = [3, 5, 6, 9, 10, 12, 15]
    slope, intercept = statistics.linear_regression(xs, ys)
    assert abs(sum(residuals(xs, ys, slope, intercept))) < 1e-9


def test_far_out_x():
    """the point far to the side moves the slope most"""
    assert most_influential([1, 2, 3, 4, 5, 6, 20], [3, 5, 6, 9, 10, 12, 15]) == 6
    assert most_influential([20, 6, 5, 4, 3, 2, 1], [15, 12, 10, 9, 6, 5, 3]) == 0
    assert most_influential([1, 2, 3, 4, 5, 6, 7, 8], [10, 9, 8, 7, 6, 5, 4, -20]) == 7


def test_too_few_points():
    """fewer than 3 points raises ValueError"""
    try:
        most_influential([1, 2], [1, 2])
    except ValueError:
        pass
    else:
        raise AssertionError('2 points should have raised ValueError')
```

#### Uses
- [Least squares › Residuals](#/regression/residuals)
- [Least squares › Influential points](#/regression/influential-points)

#### Hints
- `residuals` is one comprehension over `zip(xs, ys)`.
- For `most_influential`, first get the slope of the full fit with `fit(xs, ys)[0]`.
- For each index `i`, drop that point from both lists and refit. Slicing `xs[:i] + xs[i + 1:]` leaves it out.
- Track the largest `abs(new_slope - full_slope)` and its index. Use a strict `>` when updating so the smallest index wins a tie.

#### Tips
- This is the leave-one-out idea behind Cook's distance, in its simplest form.
- Dropping a point from a list does not change the list you loop over, since slicing builds new lists.

#### Docs
- [Python docs: `statistics.linear_regression`](https://docs.python.org/3/library/statistics.html#statistics.linear_regression)
