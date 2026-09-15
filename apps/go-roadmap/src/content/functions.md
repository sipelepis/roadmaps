# Functions

Go functions can return several values, take a variable number of arguments, and be passed around as values and closures. What they cannot do is just as telling: no default parameters, no keyword arguments, no overloading.

## Declaring functions

```go
func add(a int, b int) int {
	return a + b
}

func scale(x, y, factor float64) (float64, float64) { // share the type across params
	return x * factor, y * factor
}
```

Types come *after* names, for parameters and for the result. When consecutive parameters share a type you write it once. A function without a result type returns nothing; there is no implicit `undefined` or `None`.

Arguments are always passed by value: the function gets a copy. The Pointers module shows how to let a function change the caller's variable.

## Multiple return values

Returning more than one value is built into the language, not a tuple in disguise. It is how Go reports failure: the last result is an `error`, or a `bool` named `ok`.

```go
func divide(a, b float64) (float64, bool) {
	if b == 0 {
		return 0, false
	}
	return a / b, true
}

q, ok := divide(10, 4) // 2.5 true
_, ok = divide(1, 0)   // ignore a result with _
```

You must receive all results or none: `q := divide(10, 4)` does not compile.

## Named results

Results can have names. They start at their zero values, document what each result means, and a bare `return` returns their current values:

```go
func minMax(a, b int) (lo, hi int) {
	lo, hi = a, b
	if lo > hi {
		lo, hi = hi, lo
	}
	return // same as return lo, hi
}
```

Bare returns hurt readability in anything longer than a few lines. Name results for documentation; prefer `return lo, hi` anyway.

## Variadic functions

The last parameter can take any number of arguments. Inside the function it is a slice (`[]int` here), which you walk with `for ... range`:

```go
func sum(nums ...int) int {
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

sum()        // 0
sum(1, 2, 3) // 6

nums := []int{4, 5}
sum(nums...) // spread an existing slice with ...
```

`fmt.Println(a ...any)` is variadic, which is why it takes anything. Go has no default parameter values; a variadic tail or an options struct fills that gap.

## Functions are values

A function has a type, like `func(int) int`, and can be stored, passed and returned:

```go
func apply(f func(int) int, x int) int {
	return f(x)
}

double := func(x int) int { return x * 2 } // function literal
apply(double, 4)                            // 8

type Transform func(int) int // name the type when it repeats
```

The zero value of a function type is `nil`. Calling a nil function panics. Functions can be compared only to `nil`, not to each other.

## Closures

A function literal can use variables from the scope around it. It captures the *variable*, not a snapshot of its value, so changes are visible both ways:

```go
func counter() func() int {
	n := 0
	return func() int {
		n++
		return n
	}
}

next := counter()
next() // 1
next() // 2
other := counter()
other() // 1: a separate n
```

`n` outlives the call to `counter` because the closure still refers to it. Go's garbage collector keeps it alive; you do not manage that memory.

## defer and named results

A deferred closure runs after the `return` statement has set the results, so it can still change named results. That is how cleanup code attaches an error to the return value:

```go
func tripled() (n int) {
	defer func() { n *= 3 }()
	return 2 // n = 2, then the deferred func makes it 6
}
```

```go playground
package main

import "fmt"

func stats(nums ...int) (lo, hi, total int) {
	if len(nums) == 0 {
		return 0, 0, 0
	}
	lo, hi = nums[0], nums[0]
	for _, n := range nums {
		lo = min(lo, n)
		hi = max(hi, n)
		total += n
	}
	return lo, hi, total
}

func makeMultiplier(factor int) func(int) int {
	return func(x int) int { return x * factor }
}

func main() {
	lo, hi, total := stats(4, 8, 15, 16, 23, 42)
	fmt.Println(lo, hi, total)

	scores := []int{7, 3, 9}
	fmt.Println(stats(scores...))

	triple := makeMultiplier(3)
	fmt.Println(triple(5), makeMultiplier(10)(5))

	count := 0
	inc := func() { count++ }
	inc()
	inc()
	fmt.Println("count:", count)
}

// Try: call stats() with no arguments, then remove the len check and call it again.
```

## Exercises

### 1. Quotient and remainder

`DivMod(a, b)` returns the quotient and the remainder of `a / b`. Use named results. Note how Go rounds negative division: toward zero, and the remainder takes the sign of `a`.

```go starter
package main

func DivMod(a, b int) (q, r int) {
	return // TODO
}
```

```go test
package main

import "testing"

// positive numbers
func TestPositive(t *testing.T) {
	q, r := DivMod(17, 5)
	expect(t, q, 3)
	expect(t, r, 2)
}

// negative dividend rounds toward zero
func TestNegative(t *testing.T) {
	q, r := DivMod(-7, 2)
	expect(t, q, -3)
	expect(t, r, -1)
}

// exact division
func TestExact(t *testing.T) {
	q, r := DivMod(12, 4)
	expect(t, q, 3)
	expect(t, r, 0)
}
```

#### Uses
- [Functions › Named results](#/functions/named-results)
- [Variables & types › Basic types](#/basics/basic-types)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- On two ints, `/` gives the quotient and `%` gives the remainder.
- Named results are ordinary variables: assign `q` and `r`, and the bare `return` hands them back. `return` with both values works too.

#### Tips
- For any `b != 0`, `q*b + r == a` holds. That is a quick way to check the signs.

#### Docs
- [Go spec: Arithmetic operators](https://go.dev/ref/spec#Arithmetic_operators)
- [Effective Go: Named result parameters](https://go.dev/doc/effective_go#named-results)

### 2. Maximum of at least one

`MaxOf(first, rest...)` returns the largest of its arguments. Requiring `first` makes calling it with no arguments a compile error rather than a runtime problem. Loop over `rest` with `for _, n := range rest` and keep the larger value with the built-in `max(a, b)`.

```go starter
package main

func MaxOf(first int, rest ...int) int {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// a single argument
func TestSingle(t *testing.T) {
	expect(t, MaxOf(3), 3)
}

// several arguments
func TestSeveral(t *testing.T) {
	expect(t, MaxOf(1, 9, 4), 9)
	expect(t, MaxOf(-5, -2, -8), -2)
}

// a spread slice
func TestSpread(t *testing.T) {
	nums := []int{4, 8, 2}
	expect(t, MaxOf(1, nums...), 8)
}
```

#### Uses
- [Functions › Variadic functions](#/functions/variadic-functions)

#### Hints
- There is always at least one value, so start with `best := first`.
- For each `n` in `rest`, replace `best` with `max(best, n)`. Return `best` after the loop.

#### Tips
- `max` and `min` are built in since Go 1.21 and accept any number of arguments of one ordered type.

#### Docs
- [Go spec: Min and max](https://go.dev/ref/spec#Min_and_max)
- [Go spec: Passing arguments to ... parameters](https://go.dev/ref/spec#Passing_arguments_to_..._parameters)

### 3. Independent counters

`NewCounter()` returns a function. Each call to that function returns the next number, starting at 1. Two counters must not share their count.

```go starter
package main

func NewCounter() func() int {
	return func() int {
		return 0 // TODO: keep state in a variable outside this literal
	}
}
```

```go test
package main

import "testing"

// counts up from one
func TestCountsUp(t *testing.T) {
	next := NewCounter()
	expect(t, next(), 1)
	expect(t, next(), 2)
	expect(t, next(), 3)
}

// counters are independent
func TestIndependent(t *testing.T) {
	a, b := NewCounter(), NewCounter()
	a()
	a()
	expect(t, b(), 1)
	expect(t, a(), 3)
}
```

#### Uses
- [Functions › Closures](#/functions/closures)

#### Hints
- Declare the count in `NewCounter`, before the `return`, not inside the function literal.
- The literal adds one to that variable and returns it. Every call to `NewCounter` creates a new variable, so counters stay apart.

#### Tips
- A closure captures the variable itself, not a copy of its value, which is why the count survives between calls.

#### Docs
- [Go spec: Function literals](https://go.dev/ref/spec#Function_literals)

### 4. Pipeline

`Pipeline(fs...)` returns one function that runs its input through every function in `fs`, left to right. With no functions it returns its input unchanged.

```go starter
package main

func Pipeline(fs ...func(int) int) func(int) int {
	return func(x int) int {
		return x // TODO: apply each f in order
	}
}
```

```go test
package main

import "testing"

// no functions is the identity
func TestEmptyPipeline(t *testing.T) {
	expect(t, Pipeline()(7), 7)
}

// applies left to right
func TestOrder(t *testing.T) {
	inc := func(x int) int { return x + 1 }
	double := func(x int) int { return x * 2 }
	expect(t, Pipeline(inc, double)(5), 12)
	expect(t, Pipeline(double, inc)(5), 11)
}

// the same function can repeat
func TestRepeat(t *testing.T) {
	double := func(x int) int { return x * 2 }
	expect(t, Pipeline(double, double, double)(1), 8)
}
```

#### Uses
- [Functions › Variadic functions](#/functions/variadic-functions)
- [Functions › Functions are values](#/functions/functions-are-values)
- [Functions › Closures](#/functions/closures)

#### Hints
- Inside the returned function, `fs` is a `[]func(int) int` you can `range` over.
- Feed each result into the next function: reassign `x` on every step, then return it.

#### Tips
- With no functions the loop runs zero times, so the identity case needs no special code.

#### Docs
- [Go spec: Function types](https://go.dev/ref/spec#Function_types)
