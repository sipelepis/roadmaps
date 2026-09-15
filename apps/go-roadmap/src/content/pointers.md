# Pointers

A pointer holds the address of a variable, so code can read and change that variable from somewhere else. Go has real pointers like C, but with garbage collection and without pointer arithmetic, which removes most of the danger.

## & and *

```go
x := 10
p := &x         // p has type *int: "pointer to int"
fmt.Println(*p) // 10: *p reads the variable p points to
*p = 20         // writes through the pointer
fmt.Println(x)  // 20
```

`&` takes the address of a variable. `*` in a type (`*int`) means "pointer to"; `*` in front of a pointer value dereferences it. Two pointers are equal with `==` when they point to the same variable.

## nil

The zero value of any pointer type is `nil`. Dereferencing a nil pointer panics at runtime:

```go
var p *int     // nil
fmt.Println(p) // <nil>
*p = 1         // panic: invalid memory address or nil pointer dereference
```

Check before you dereference a pointer you did not create yourself: `if p != nil { ... }`. This is Go's null reference, and the compiler does not track it for you.

## Everything is passed by value

A function call copies every argument. For an `int` that means the function gets its own number, and changes do not reach the caller:

```go
func reset(n int) { n = 0 }      // changes the copy

func resetPtr(n *int) { *n = 0 } // changes the caller's variable

count := 5
reset(count)     // count is still 5
resetPtr(&count) // count is now 0
```

A pointer is a value too: `resetPtr` gets a copy of the address, but a copy of an address still leads to the same variable. There is no separate pass-by-reference mechanism in Go.

Slices and maps already contain pointers to their data internally, which is why a function can change a slice's elements without an explicit pointer. You rarely need `*[]int`; return the new slice instead.

## Creating values: new and &

`new(T)` allocates a zero-valued `T` and returns a pointer to it. Since Go 1.26 it also accepts an expression, which becomes the initial value:

```go
p := new(int)  // *int pointing at 0
q := new(42)   // *int pointing at 42 (Go 1.26+)
```

In practice you mostly write `&` on a variable or, in the next module, on a struct literal: `&Point{X: 1}`.

## Returning a pointer to a local is safe

In C, returning the address of a local variable is a bug. In Go it is normal:

```go
func newCounter() *int {
	n := 0
	return &n // n lives on as long as something points to it
}
```

The compiler's escape analysis moves `n` to the heap when it outlives the function, and the garbage collector frees it later. You never decide stack versus heap yourself.

## No pointer arithmetic

`p++` on a pointer does not compile. You cannot turn an integer into a pointer or step through memory (outside the `unsafe` package, which you should not need). A Go pointer always points at a valid variable or is `nil`.

## When to use a pointer

- **The function must change the caller's value.** The most common reason.
- **The value is large.** Copying a big struct on every call costs time; a pointer is one machine word.
- **You need "no value" as distinct from the zero value.** A `*int` can be `nil`, meaning absent, while an `int` can only be `0`. You will see this in optional JSON fields and config.

Otherwise, pass plain values. They are simpler to reason about, and small copies are cheap.

```go playground
package main

import "fmt"

func double(n *int) {
	*n *= 2
}

func describe(p *int) string {
	if p == nil {
		return "no value"
	}
	return fmt.Sprint("value ", *p)
}

func newScore(start int) *int {
	s := start
	return &s
}

func main() {
	x := 21
	double(&x)
	fmt.Println("x:", x)

	p := &x
	q := p
	*q = 7
	fmt.Println(x, *p, p == q)

	a, b := newScore(1), newScore(1)
	fmt.Println(*a == *b, a == b)

	var missing *int
	fmt.Println(describe(missing), "/", describe(a))
}

// Try: remove the nil check in describe and run it again.
```

## Exercises

### 1. Swap

`Swap(a, b)` exchanges the values of the two variables the pointers point to. Go's parallel assignment `x, y = y, x` works through pointers too.

```go starter
package main

func Swap(a, b *int) {
	// TODO
}
```

```go test
package main

import "testing"

// swaps two variables
func TestSwap(t *testing.T) {
	x, y := 1, 2
	Swap(&x, &y)
	expect(t, x, 2)
	expect(t, y, 1)
}

// swapping twice restores the originals
func TestSwapTwice(t *testing.T) {
	x, y := -5, 9
	Swap(&x, &y)
	Swap(&x, &y)
	expect(t, x, -5)
	expect(t, y, 9)
}
```

#### Uses
- [Pointers › & and *](#/pointers/and)
- [Variables & types › Declaring variables](#/basics/declaring-variables)

#### Hints
- `*a` is the variable `a` points to. You can read it and assign to it.
- Parallel assignment evaluates the whole right side first, so a single line swaps the two without a temporary.

#### Tips
- `a, b = b, a` would only swap the function's own copies of the pointers; the caller would see nothing.

#### Docs
- [Go spec: Address operators](https://go.dev/ref/spec#Address_operators)
- [Go spec: Assignment statements](https://go.dev/ref/spec#Assignment_statements)

### 2. Value or fallback

`ValueOr(p, fallback)` returns the value `p` points to, or `fallback` when `p` is nil. It must not panic on nil, so check with an `if` first. Go's `if` works like TypeScript's, without parentheses around the condition and with braces always required: `if n < 0 { return 0 }`.

```go starter
package main

func ValueOr(p *int, fallback int) int {
	return fallback // TODO
}
```

```go test
package main

import "testing"

// nil uses the fallback
func TestNilFallback(t *testing.T) {
	expect(t, ValueOr(nil, 7), 7)
}

// a pointer wins over the fallback
func TestPointerValue(t *testing.T) {
	n := 3
	expect(t, ValueOr(&n, 7), 3)
}

// a pointer to zero is still a value
func TestPointerToZero(t *testing.T) {
	zero := 0
	expect(t, ValueOr(&zero, 7), 0)
}
```

#### Uses
- [Pointers › nil](#/pointers/nil)
- [Pointers › & and *](#/pointers/and)

#### Hints
- Compare `p` with `nil` first, and return the fallback in that branch.
- Past that check, dereferencing is safe: return `*p`.

#### Tips
- A pointer to `0` is not nil. It says "there is a value", even when that value is zero.

#### Docs
- [Go spec: If statements](https://go.dev/ref/spec#If_statements)

### 3. The larger one

`Larger(a, b)` returns whichever pointer points to the larger value: the pointer itself, not a copy of the number, so the caller can change the winner through it. A nil pointer counts as absent: if one is nil return the other, and if both are nil return nil. On a tie, return `a`. As in the last exercise you need `if`; `||` and `&&` combine conditions.

```go starter
package main

func Larger(a, b *int) *int {
	return nil // TODO
}
```

```go test
package main

import "testing"

// returns the pointer to the larger value
func TestLargerIdentity(t *testing.T) {
	x, y := 3, 8
	if got := Larger(&x, &y); got != &y {
		t.Errorf("expected the pointer to y, got %v", got)
	}
}

// the caller can update the winner
func TestUpdateThroughResult(t *testing.T) {
	x, y := 10, 4
	*Larger(&x, &y) = 0
	expect(t, x, 0)
	expect(t, y, 4)
}

// nil counts as absent
func TestLargerNil(t *testing.T) {
	x := -1
	if got := Larger(nil, &x); got != &x {
		t.Errorf("expected the pointer to x, got %v", got)
	}
	if got := Larger(&x, nil); got != &x {
		t.Errorf("expected the pointer to x, got %v", got)
	}
	if got := Larger(nil, nil); got != nil {
		t.Errorf("expected nil, got %v", got)
	}
}

// ties go to a
func TestLargerTie(t *testing.T) {
	x, y := 5, 5
	if got := Larger(&x, &y); got != &x {
		t.Errorf("expected the pointer to x on a tie")
	}
}
```

#### Uses
- [Pointers › nil](#/pointers/nil)
- [Pointers › & and *](#/pointers/and)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- Deal with nil first: if `a` is nil the answer is `b`, whatever `b` is. Then the same for `b`.
- With both non-nil, compare the values `*a` and `*b`, but return the pointers themselves.
- Ties go to `a`, so compare with `>=`, not `>`.

#### Tips
- `a == b` asks whether two pointers point at the same variable; `*a == *b` compares the values.

#### Docs
- [Go spec: Comparison operators](https://go.dev/ref/spec#Comparison_operators)

### 4. Shared totals

`Adder(total)` returns a function that adds its argument to the variable `total` points to. Several adders made from the same pointer all update the same variable.

```go starter
package main

func Adder(total *int) func(int) {
	return func(n int) {
		// TODO
	}
}
```

```go test
package main

import "testing"

// adds into the caller's variable
func TestAdder(t *testing.T) {
	sum := 0
	add := Adder(&sum)
	add(3)
	add(4)
	expect(t, sum, 7)
}

// adders share one total
func TestSharedTotal(t *testing.T) {
	sum := 100
	a, b := Adder(&sum), Adder(&sum)
	a(1)
	b(-11)
	expect(t, sum, 90)
}

// separate totals stay separate
func TestSeparateTotals(t *testing.T) {
	x, y := 0, 0
	Adder(&x)(5)
	Adder(&y)(2)
	expect(t, x, 5)
	expect(t, y, 2)
}
```

#### Uses
- [Pointers › & and *](#/pointers/and)
- [Pointers › Everything is passed by value](#/pointers/everything-is-passed-by-value)
- [Functions › Closures](#/functions/closures)

#### Hints
- The returned function is a closure, so it can use `total` from `Adder`'s parameters.
- Change the variable behind the pointer, not the pointer: `*total` goes on the left of `+=`.

#### Tips
- Each adder holds a copy of the same address, which is why adders made from one pointer share a total.

#### Docs
- [Go spec: Function literals](https://go.dev/ref/spec#Function_literals)
