# Generics

Type parameters let one function or type work over many types while staying fully type-checked at compile time. Go's generics are deliberately modest: they are for containers and algorithms, not for replacing interfaces.

## Type parameters

```go
func Map[T, U any](s []T, f func(T) U) []U {
	out := make([]U, 0, len(s))
	for _, v := range s {
		out = append(out, f(v))
	}
	return out
}

lengths := Map([]string{"go", "rust"}, func(s string) int { return len(s) }) // [2 4]
```

Type parameters go in square brackets before the regular ones. Each has a *constraint*, here `any`. The compiler usually infers type arguments from the values you pass; you write them explicitly (`Map[string, int](...)`) only when it can't, such as when a type parameter appears only in the result.

## Constraints are interfaces

A constraint says what operations the function may use on `T`. With `any`, you can only assign, pass and return values. To use `<` or `+`, the constraint must allow it.

```go
func Max[T cmp.Ordered](a, b T) T { // cmp.Ordered: ints, floats, strings
	if a > b {
		return a
	}
	return b
}

func Index[T comparable](s []T, v T) int { // comparable: == and !=
	for i, x := range s {
		if x == v {
			return i
		}
	}
	return -1
}
```

`comparable` is built in and allows `==`; map keys need it. `cmp.Ordered` from the standard library allows `<`, `>` and friends.

## Type sets and `~`

Interfaces used as constraints can list types with `|`:

```go
type Number interface {
	~int | ~int64 | ~float64
}

func Sum[N Number](nums []N) N {
	var total N
	for _, n := range nums {
		total += n
	}
	return total
}

type Cents int64
Sum([]Cents{100, 250}) // works because of ~int64
```

`~int64` means "any type whose underlying type is `int64`", so your own named types like `Cents` qualify. Without the tilde, only `int64` itself does. An interface with a type list can only be used as a constraint, not as an ordinary variable type.

## The zero value of `T`

You can't write `nil` or `0` for an arbitrary `T`. Declare one:

```go
func First[T any](s []T) (T, bool) {
	var zero T
	if len(s) == 0 {
		return zero, false
	}
	return s[0], true
}
```

## Generic types

```go
type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(v T) { s.items = append(s.items, v) }

func (s *Stack[T]) Pop() (T, bool) {
	var zero T
	if len(s.items) == 0 {
		return zero, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}

var s Stack[string] // the type argument is required here
s.Push("a")
```

Methods use the type's parameters, written as `Stack[T]` in the receiver, but a method cannot declare new type parameters of its own. When you need one, write a top-level function instead.

## The standard library already has them

Before writing a helper, check `slices` and `maps`: `slices.Contains`, `slices.Index`, `slices.Sort`, `slices.Max`, `slices.Reverse`, `maps.Keys`, `maps.Clone`, and `slices.Sorted(maps.Keys(m))` for sorted keys.

## When not to use generics

- **When behavior differs by type, use an interface.** A function that calls `w.Write` should take an `io.Writer`, not a `[T io.Writer]`.
- **When there's only one type.** Write the concrete function; generalize when the second caller shows up.
- **Not to fake inheritance or overloading.** Go has neither, and generics won't bring them back.

A good test: generics fit when you'd otherwise copy the same code with only the element type changed, or reach for `any` and lose type safety.

```go playground
package main

import (
	"cmp"
	"fmt"
	"slices"
)

type Number interface {
	~int | ~int64 | ~float64
}

func Sum[N Number](nums []N) N {
	var total N
	for _, n := range nums {
		total += n
	}
	return total
}

func Filter[T any](s []T, keep func(T) bool) []T {
	var out []T
	for _, v := range s {
		if keep(v) {
			out = append(out, v)
		}
	}
	return out
}

type Pair[K comparable, V any] struct {
	Key K
	Val V
}

func MaxBy[T any, K cmp.Ordered](s []T, key func(T) K) T {
	return slices.MaxFunc(s, func(a, b T) int { return cmp.Compare(key(a), key(b)) })
}

type Cents int64

func main() {
	fmt.Println(Sum([]int{1, 2, 3}), Sum([]float64{0.5, 0.25}), Sum([]Cents{100, 250}))

	evens := Filter([]int{1, 2, 3, 4, 5, 6}, func(n int) bool { return n%2 == 0 })
	fmt.Println(evens)

	scores := []Pair[string, int]{{"ada", 90}, {"bob", 72}, {"cy", 95}}
	best := MaxBy(scores, func(p Pair[string, int]) int { return p.Val })
	fmt.Printf("%+v\n", best)
}

// Try: call Sum([]string{"a", "b"}) and read the constraint error.
```

## Exercises

### 1. Map and Filter

Write `Map` (apply `f` to every element) and `Filter` (keep the elements where `keep` returns true). Both return a new slice and leave the input alone.

```go starter
package main

func Map[T, U any](s []T, f func(T) U) []U {
	return nil // TODO
}

func Filter[T any](s []T, keep func(T) bool) []T {
	return nil // TODO
}
```

```go test
package main

import (
	"strings"
	"testing"
)

// Map changes the element type
func TestMap(t *testing.T) {
	expect(t, Map([]int{1, 2, 3}, func(n int) int { return n * n }), []int{1, 4, 9})
	expect(t, Map([]string{"go", "zig"}, strings.ToUpper), []string{"GO", "ZIG"})
	expect(t, Map([]string{"a", "abc"}, func(s string) int { return len(s) }), []int{1, 3})
	expect(t, Map([]int{-1, 0, 2}, func(n int) bool { return n > 0 }), []bool{false, false, true})
}

// Filter keeps matching elements
func TestFilter(t *testing.T) {
	odd := func(n int) bool { return n%2 == 1 }
	expect(t, Filter([]int{1, 2, 3, 4, 5}, odd), []int{1, 3, 5})
	long := Filter([]string{"a", "abc", "ab", "abcd"}, func(s string) bool { return len(s) > 2 })
	expect(t, long, []string{"abc", "abcd"})
	even := func(n int) bool { return n%2 == 0 }
	expect(t, Filter([]int{1, 2, 3, 4, 5, 6}, even), []int{2, 4, 6})
	expect(t, Filter([]int{7, 8, 9}, func(int) bool { return true }), []int{7, 8, 9})
}

// the input is not modified
func TestInputUntouched(t *testing.T) {
	in := []int{1, 2, 3}
	Map(in, func(n int) int { return n * 10 })
	Filter(in, func(n int) bool { return n > 1 })
	expect(t, in, []int{1, 2, 3})
	expect(t, len(Filter(in, func(int) bool { return false })), 0)
	expect(t, len(Map([]int{}, func(n int) int { return n })), 0)
}
```

#### Uses
- [Generics › Type parameters](#/generics/type-parameters)
- [Arrays & slices › append](#/slices/append)
- [Functions › Functions are values](#/functions/functions-are-values)

#### Hints
- Start each function with an empty result slice and `append` to it inside a `for _, v := range s` loop.
- `Map` appends `f(v)` for every element; `Filter` appends `v` only when `keep(v)` is true.

#### Tips
- `make([]U, 0, len(s))` preallocates for `Map`, whose output is exactly as long as its input. `Filter` can't know its length ahead of time, so a nil slice is a fine start.
- Inference reads the function you pass: `Map([]string{...}, strings.ToUpper)` needs no explicit type arguments, because `strings.ToUpper` is already a `func(string) string`.

#### Docs
- [Go tutorial: Getting started with generics](https://go.dev/doc/tutorial/generics)

### 2. Constraints

`Sum` adds up any slice whose element type is in `Number`, including named types like `Celsius`. `MaxOf` returns the largest element and `true`, or the zero value and `false` for an empty slice. Don't use `slices.Max`; it panics on empty input.

```go starter
package main

import "cmp"

type Number interface {
	~int | ~int64 | ~float64
}

func Sum[N Number](nums []N) N {
	var total N
	// TODO
	return total
}

func MaxOf[T cmp.Ordered](xs []T) (T, bool) {
	var zero T
	// TODO
	return zero, false
}
```

```go test
package main

import "testing"

type celsiusForTest float64

// sums ints, floats and named types
func TestSum(t *testing.T) {
	expect(t, Sum([]int{1, 2, 3, 4}), 10)
	expect(t, Sum([]float64{0.5, 0.25}), 0.75)
	expect(t, Sum([]celsiusForTest{20, 1.5}), celsiusForTest(21.5))
	expect(t, Sum([]int64{}), int64(0))
}

// finds the max of ordered types
func TestMaxOf(t *testing.T) {
	n, ok := MaxOf([]int{3, 9, -2, 9, 4})
	expect(t, n, 9)
	expect(t, ok, true)
	s, ok := MaxOf([]string{"pear", "apple", "zucchini", "fig"})
	expect(t, s, "zucchini")
	expect(t, ok, true)
	neg, _ := MaxOf([]int{-5, -3, -8})
	expect(t, neg, -3)
	first, _ := MaxOf([]int{7, 1, 2})
	expect(t, first, 7)
	last, _ := MaxOf([]float64{1.5, 2.5, 9.75})
	expect(t, last, 9.75)
	one, ok := MaxOf([]celsiusForTest{-40})
	expect(t, one, celsiusForTest(-40))
	expect(t, ok, true)
}

// empty input returns zero and false
func TestMaxOfEmpty(t *testing.T) {
	f, ok := MaxOf([]float64{})
	expect(t, f, 0.0)
	expect(t, ok, false)
	s, ok := MaxOf([]string(nil))
	expect(t, s, "")
	expect(t, ok, false)
}
```

#### Uses
- [Generics › Type sets and `~`](#/generics/type-sets-and)
- [Generics › Constraints are interfaces](#/generics/constraints-are-interfaces)
- [Generics › The zero value of `T`](#/generics/the-zero-value-of-t)

#### Hints
- `Sum` is a plain loop: `total += n` compiles because every type in `Number` supports `+`.
- For `MaxOf`, return `zero, false` when `len(xs) == 0`. Otherwise start from `xs[0]` and keep whichever is larger with `>`.

#### Tips
- Don't start the maximum at `0`: for `[-5, -3, -8]` it would wrongly win. Start from the first element.
- `var total N` and `var zero T` are the only way to name a zero of an unknown type. There is no `N(0)` that works for every member of the constraint.
- `MaxOf` is `slices.Max` with the panic traded for a `bool`. That comma-ok shape is the Go convention for "there may be nothing here".

#### Docs
- [cmp.Ordered](https://pkg.go.dev/cmp#Ordered)
- [Go spec: General interfaces](https://go.dev/ref/spec#General_interfaces)

### 3. Generic stack

Implement `Stack[T]`: `Push` adds to the top, `Pop` removes and returns the top (or the zero value and `false` when empty), `Peek` returns the top without removing it, and `Len` reports the size. The zero value `Stack[T]{}` must be ready to use.

```go starter
package main

type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(v T) {
	// TODO
}

func (s *Stack[T]) Pop() (T, bool) {
	var zero T
	return zero, false // TODO
}

func (s *Stack[T]) Peek() (T, bool) {
	var zero T
	return zero, false // TODO
}

func (s *Stack[T]) Len() int {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// last in, first out
func TestStackLIFO(t *testing.T) {
	var s Stack[int]
	s.Push(1)
	s.Push(2)
	s.Push(3)
	expect(t, s.Len(), 3)
	v, ok := s.Pop()
	expect(t, v, 3)
	expect(t, ok, true)
	v, _ = s.Pop()
	expect(t, v, 2)
	expect(t, s.Len(), 1)
}

// Peek does not remove
func TestStackPeek(t *testing.T) {
	var s Stack[string]
	s.Push("a")
	s.Push("b")
	top, ok := s.Peek()
	expect(t, top, "b")
	expect(t, ok, true)
	expect(t, s.Len(), 2)
}

// empty stack returns zero and false
func TestStackEmpty(t *testing.T) {
	var s Stack[string]
	v, ok := s.Pop()
	expect(t, v, "")
	expect(t, ok, false)
	_, ok = s.Peek()
	expect(t, ok, false)
	s.Push("x")
	s.Pop()
	_, ok = s.Pop()
	expect(t, ok, false)
	expect(t, s.Len(), 0)
}

// interleaved pushes and pops, many values
func TestStackMixed(t *testing.T) {
	var s Stack[float64]
	s.Push(1)
	s.Push(2)
	v, _ := s.Pop()
	expect(t, v, 2.0)
	s.Push(3)
	top, _ := s.Peek()
	expect(t, top, 3.0)
	for i := range 100 {
		s.Push(float64(i))
	}
	expect(t, s.Len(), 102)
	for i := 99; i >= 0; i-- {
		v, _ = s.Pop()
		if v != float64(i) {
			t.Fatalf("Pop() = %v, want %v", v, float64(i))
		}
	}
	v, _ = s.Pop()
	expect(t, v, 3.0)
	v, _ = s.Pop()
	expect(t, v, 1.0)
	expect(t, s.Len(), 0)
}
```

#### Uses
- [Generics › Generic types](#/generics/generic-types)
- [Arrays & slices › append](#/slices/append)
- [Arrays & slices › Slicing shares memory](#/slices/slicing-shares-memory)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- The top of the stack is the end of the slice, `s.items[len(s.items)-1]`.
- `Pop` is `Peek` plus shrinking the slice with `s.items[:len(s.items)-1]`. Check for an empty stack first.

#### Tips
- A nil `items` slice needs no setup: `len` is 0 and `append` allocates on first use, which is why `Stack[T]{}` works without a constructor.
- `Pop` is `Peek` plus a reslice. Writing it that way keeps the empty check in one place instead of two.
- All four methods take `*Stack[T]`, even `Len` and `Peek` which only read. Mixing value and pointer receivers on one type is what makes `var s Stack[int]` behave differently from `&Stack[int]{}`.

#### Docs
- [Go spec: Type parameter declarations](https://go.dev/ref/spec#Type_parameter_declarations)

### 4. GroupBy and sorted keys

`GroupBy` puts each item in a bucket named by `key(item)`, keeping the items' original order within each bucket. `SortedKeys` returns a map's keys in ascending order; `slices.Sorted(maps.Keys(m))` does it in one line.

```go starter
package main

import "cmp"

func GroupBy[T any, K comparable](items []T, key func(T) K) map[K][]T {
	return nil // TODO
}

func SortedKeys[K cmp.Ordered, V any](m map[K]V) []K {
	return nil // TODO
}
```

```go test
package main

import "testing"

// groups by the key function
func TestGroupBy(t *testing.T) {
	words := []string{"apple", "avocado", "banana", "blueberry", "cherry"}
	byFirst := GroupBy(words, func(w string) byte { return w[0] })
	expect(t, byFirst, map[byte][]string{
		'a': {"apple", "avocado"},
		'b': {"banana", "blueberry"},
		'c': {"cherry"},
	})
	byLen := GroupBy([]string{"go", "c", "rust", "zig", "d"}, func(w string) int { return len(w) })
	expect(t, byLen[1], []string{"c", "d"})
	expect(t, len(byLen), 4)
}

// keeps input order inside a group
func TestGroupByOrder(t *testing.T) {
	parity := GroupBy([]int{5, 2, 7, 4, 1}, func(n int) bool { return n%2 == 0 })
	expect(t, parity[false], []int{5, 7, 1})
	expect(t, parity[true], []int{2, 4})
}

// returns keys in ascending order
func TestSortedKeys(t *testing.T) {
	expect(t, SortedKeys(map[string]int{"pear": 1, "apple": 2, "fig": 3}), []string{"apple", "fig", "pear"})
	expect(t, SortedKeys(map[int]bool{3: true, -1: false, 2: true}), []int{-1, 2, 3})
	many := map[float64]string{9.5: "", 2: "", -1: "", 7: "", 0: "", 3.25: "", 100: "", -50: ""}
	expect(t, SortedKeys(many), []float64{-50, -1, 0, 2, 3.25, 7, 9.5, 100})
	expect(t, len(SortedKeys(map[string]int{})), 0)
}
```

#### Uses
- [Generics › Type parameters](#/generics/type-parameters)
- [Maps › Missing keys and comma-ok](#/maps/missing-keys-and-comma-ok)
- [Maps › Iteration order is random](#/maps/iteration-order-is-random)

#### Hints
- Make the result map before the loop with `make(map[K][]T)`: writing to a nil map panics.
- For each item, compute `k := key(item)`. A missing key reads as a nil slice, so appending to `out[k]` and storing the result back works for new and existing buckets alike.
- `SortedKeys` is the one-liner from the description; import `maps` and `slices`.

#### Tips
- `GroupBy` only needs `comparable` for `K`, because map keys are compared with `==`. `SortedKeys` needs the stronger `cmp.Ordered` so it can sort them.
- `make` before the loop means `GroupBy` hands back a real empty map for empty input, not a nil one. `expect` compares deeply and tells the two apart.

#### Docs
- [slices.Sorted](https://pkg.go.dev/slices#Sorted)
- [maps.Keys](https://pkg.go.dev/maps#Keys)
