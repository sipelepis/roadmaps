# Control flow

Go has one loop keyword, `for`, a `switch` that does not fall through, and `defer` for cleanup. There are no parentheses around conditions, braces are mandatory, and there is no ternary operator.

## if

```go
if n > 10 {
	fmt.Println("big")
} else if n > 5 {
	fmt.Println("medium")
} else {
	fmt.Println("small")
}
```

Conditions must be `bool`. There is no truthiness: `if n` and `if s` do not compile when `n` is an int and `s` a string. Write `if n != 0` and `if s != ""`.

An `if` can start with a short statement. Variables declared there are scoped to the `if` and all its `else` branches, and gone afterwards:

```go
if n := len(name); n > 3 {
	fmt.Println(n, "is long")
} else {
	fmt.Println(n, "is short")
}
// n does not exist here
```

You will see this constantly with errors: `if err := save(); err != nil { ... }`.

There is no `cond ? a : b`. Write the `if`, or assign a default first and override it.

## for, in all its forms

```go
for i := 0; i < 3; i++ { // classic three-part loop
	fmt.Println(i)
}

for n < 100 { // just a condition: this is Go's while
	n *= 2
}

for { // forever, until break or return
	if done() {
		break
	}
}

for i := range 3 { // i = 0, 1, 2 (Go 1.22+)
	fmt.Println(i)
}

for range 3 { // three times, no variable
	fmt.Println("hi")
}
```

`i++` is a statement, not an expression. You cannot write `x = i++` or `++i`.

`range` also walks slices, maps, strings, and channels, which later modules cover. Over a slice it yields index and element:

```go
for i, v := range []string{"a", "b"} {
	fmt.Println(i, v)
}
for _, v := range []string{"a", "b"} { // ignore the index with _
	fmt.Println(v)
}
```

A variable declared by a loop and never used is a compile error like any other, which is why `_` shows up so often in `range` loops.

`break` leaves the loop, `continue` skips to the next iteration.

### Each iteration gets a fresh variable

Since Go 1.22, the variables declared by a `for` loop are new on every iteration. A closure created inside the loop captures that iteration's value. Older Go shared one variable across the whole loop, which made closures and goroutines all see the last value, so you may still find `i := i` in older code. It is no longer needed.

## Labels

`break` and `continue` apply to the innermost loop. To affect an outer one, label it:

```go
outer:
	for i := range 3 {
		for j := range 3 {
			if i*j == 2 {
				break outer // leaves both loops
			}
			if j > i {
				continue outer // next i
			}
		}
	}
```

## switch

```go
switch day {
case "sat", "sun":
	fmt.Println("weekend")
case "fri":
	fmt.Println("almost")
default:
	fmt.Println("weekday")
}
```

Each case ends by itself: no `break` needed, and no accidental fall-through into the next case. If you really want to continue into the next case, write `fallthrough` as its last statement. Cases can list several values, and they do not have to be constants.

A `switch` with no value is a clean chain of conditions, the first `true` case wins:

```go
switch {
case score >= 90:
	grade = "A"
case score >= 80:
	grade = "B"
default:
	grade = "F"
}
```

Like `if`, a `switch` can start with a short statement: `switch n := count(); { ... }` or `switch n := count(); n { ... }`.

Gotcha: `break` inside a `switch` breaks out of the `switch`, not the loop around it. Use a labeled `break` to leave the loop.

## defer

`defer` schedules a call to run when the surrounding *function* returns, however it returns. It is Go's answer to `finally` and `with`:

```go
f, err := os.Open(path)
if err != nil {
	return err
}
defer f.Close() // runs when this function returns
```

Three rules:

- Deferred calls run in reverse order (last in, first out).
- The arguments are evaluated when `defer` runs, not when the call happens: `defer fmt.Println(i)` prints the value `i` had at that moment.
- Deferred calls run at function exit, not at the end of a block. A `defer` inside a loop piles up until the whole function returns.

```go playground
package main

import "fmt"

func label(n int) string {
	switch {
	case n%15 == 0:
		return "FizzBuzz"
	case n%3 == 0:
		return "Fizz"
	case n%5 == 0:
		return "Buzz"
	}
	return fmt.Sprint(n)
}

func main() {
	defer fmt.Println("deferred: printed last")

	for i := range 16 {
		if i == 0 {
			continue
		}
		fmt.Print(label(i), " ")
	}
	fmt.Println()

	for i := range 3 {
		defer fmt.Println("deferred", i)
	}

	n := 1
	for n < 100 {
		n *= 3
	}
	fmt.Println("first power of 3 over 100:", n)
}

// Try: add `fallthrough` at the end of the "Fizz" case and see what label(9) becomes.
```

## Exercises

### 1. FizzBuzz

`FizzBuzz(n)` returns `"Fizz"` for multiples of 3, `"Buzz"` for multiples of 5, `"FizzBuzz"` for multiples of both, and the number itself as a string otherwise. `strconv.Itoa(n)` or `fmt.Sprint(n)` turns an int into its digits.

```go starter
package main

func FizzBuzz(n int) string {
	return "" // TODO: a switch with no value reads well here
}
```

```go test
package main

import "testing"

// plain numbers stay numbers
func TestNumbers(t *testing.T) {
	expect(t, FizzBuzz(1), "1")
	expect(t, FizzBuzz(7), "7")
}

// multiples of 3 and 5
func TestFizzAndBuzz(t *testing.T) {
	expect(t, FizzBuzz(9), "Fizz")
	expect(t, FizzBuzz(10), "Buzz")
}

// multiples of both
func TestFizzBuzz(t *testing.T) {
	expect(t, FizzBuzz(15), "FizzBuzz")
	expect(t, FizzBuzz(45), "FizzBuzz")
}
```

#### Uses
- [Control flow › switch](#/control-flow/switch)
- [Variables & types › Operators](#/basics/operators)
- [Variables & types › Conversions are always explicit](#/basics/conversions-are-always-explicit)

#### Hints
- `n%3 == 0` is true when `n` is a multiple of 3.
- In a `switch` with no value the first true case wins, so test "multiple of both" (a multiple of 15) before the single ones.
- For plain numbers, `strconv.Itoa(n)` gives the digits. Add `import "strconv"`.

#### Tips
- `string(n)` compiles, but it gives the character with code point `n`, not its digits.

#### Docs
- [Go spec: Switch statements](https://go.dev/ref/spec#Switch_statements)
- [strconv.Itoa](https://pkg.go.dev/strconv#Itoa)

### 2. Sum of multiples

`SumMultiples(limit)` returns the sum of every number from 1 up to, but not including, `limit` that is divisible by 3 or 5.

```go starter
package main

func SumMultiples(limit int) int {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// below ten: 3 + 5 + 6 + 9
func TestBelowTen(t *testing.T) {
	expect(t, SumMultiples(10), 23)
}

// below a thousand
func TestBelowThousand(t *testing.T) {
	expect(t, SumMultiples(1000), 233168)
}

// nothing below one
func TestEmptyRange(t *testing.T) {
	expect(t, SumMultiples(1), 0)
}
```

#### Uses
- [Control flow › for, in all its forms](#/control-flow/for-in-all-its-forms)
- [Control flow › if](#/control-flow/if)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- `for i := range limit` visits 0 up to `limit - 1`, which is exactly the range you need.
- Add a number to a running total when it divides by 3 *or* by 5. `||` joins the two tests in one `if`.

#### Tips
- Two separate `if`s would add 15, 30, 45 ... twice. One condition with `||` counts them once.

#### Docs
- [Go spec: For statements](https://go.dev/ref/spec#For_statements)

### 3. Collatz steps

Starting from `n`, repeatedly halve it if it is even, or replace it with `3n + 1` if it is odd, until it reaches 1. `CollatzSteps(n)` returns how many steps that takes. You do not know the count in advance, so this is a `for` with only a condition.

```go starter
package main

func CollatzSteps(n int) int {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// one is already there
func TestOne(t *testing.T) {
	expect(t, CollatzSteps(1), 0)
}

// six takes eight steps
func TestSix(t *testing.T) {
	expect(t, CollatzSteps(6), 8)
}

// twenty-seven wanders for a while
func TestTwentySeven(t *testing.T) {
	expect(t, CollatzSteps(27), 111)
}
```

#### Uses
- [Control flow › for, in all its forms](#/control-flow/for-in-all-its-forms)
- [Control flow › if](#/control-flow/if)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- Keep a `steps` counter and loop `for n != 1`.
- Inside, an `if` / `else` on `n%2 == 0` picks the next value of `n`. Count one step per trip round the loop.

#### Tips
- A parameter is an ordinary local variable, so you can change `n` directly.

#### Docs
- [Effective Go: For](https://go.dev/doc/effective_go#for)

### 4. Counting primes

`CountPrimes(n)` returns how many primes are less than or equal to `n`. For each candidate, try divisors in an inner loop; as soon as one divides it, `continue` the *outer* loop with a label. A number `c` only needs divisors `d` with `d*d <= c`.

```go starter
package main

func CountPrimes(n int) int {
	count := 0
	// TODO: a labeled outer loop over candidates, an inner loop over divisors
	return count
}
```

```go test
package main

import "testing"

// nothing below two
func TestSmall(t *testing.T) {
	expect(t, CountPrimes(0), 0)
	expect(t, CountPrimes(1), 0)
	expect(t, CountPrimes(2), 1)
}

// primes up to ten: 2 3 5 7
func TestTen(t *testing.T) {
	expect(t, CountPrimes(10), 4)
}

// primes up to one hundred and ten thousand
func TestLarger(t *testing.T) {
	expect(t, CountPrimes(100), 25)
	expect(t, CountPrimes(10000), 1229)
}
```

#### Uses
- [Control flow › Labels](#/control-flow/labels)
- [Control flow › for, in all its forms](#/control-flow/for-in-all-its-forms)

#### Hints
- Outer loop: candidates `c` from 2 up to and including `n`. Inner loop: divisors `d` from 2 while `d*d <= c`.
- Put a label such as `next:` on the line before the outer `for`. When `c%d == 0`, `continue next` jumps to the next candidate.
- Reaching the line after the inner loop means no divisor was found, so `c` is prime: count it there.

#### Tips
- A plain `continue` in the inner loop would only move on to the next divisor.

#### Docs
- [Go spec: Continue statements](https://go.dev/ref/spec#Continue_statements)
