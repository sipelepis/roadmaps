# Arrays & slices

Arrays in Go have a fixed length that is part of their type, so you rarely use them directly. Slices are the everyday list type: a small view onto an array, and the source of Go's most famous aliasing gotcha.

## Arrays are values

```go
var a [3]int              // [0 0 0]
b := [3]string{"x", "y", "z"}
c := [...]int{1, 2, 3}    // length counted by the compiler
len(a)                    // 3

d := c                    // copies all three elements
d[0] = 99                 // c is unchanged
c == [3]int{1, 2, 3}      // true: arrays compare element by element
```

`[3]int` and `[4]int` are different, incompatible types. Assigning an array or passing it to a function copies every element, unlike arrays in TypeScript or lists in Python.

## Slices

A slice is a three-word descriptor: a pointer into a backing array, a length, and a capacity (how far the backing array extends past the start of the slice).

```go
s := []int{1, 2, 3}        // literal: no length inside the brackets
z := make([]int, 3)        // [0 0 0], len 3
buf := make([]int, 0, 100) // empty, but room for 100 before reallocating
len(s), cap(buf)           // 3, 100
s[0] = 10                  // index and assign like an array
s[5]                       // runtime panic: index out of range
```

There is no negative indexing. The last element is `s[len(s)-1]`.

## nil slices

The zero value of a slice is `nil`: length 0, capacity 0, no backing array. It is fully usable: `len`, `range` and `append` all work on it.

```go
var names []string // nil
len(names)         // 0
names = append(names, "ada")
```

`[]string{}` is an empty slice that is not nil. They behave the same almost everywhere, so check emptiness with `len(s) == 0`, not `s == nil`. Slices cannot be compared with `==` except against `nil`; use `slices.Equal`.

## append

`append` returns a slice. Always assign the result, usually back to the same variable:

```go
s = append(s, 4)
s = append(s, 5, 6)
s = append(s, other...) // append another slice
```

If there is spare capacity, `append` writes into the existing backing array. If not, it allocates a bigger array (roughly doubling), copies, and returns a slice pointing at the new one. Code that forgets `s = ` works until the day capacity runs out.

## Slicing shares memory

`s[low:high]` makes a new slice over the same backing array, from `low` up to but not including `high`. Either bound can be left out: `s[:2]`, `s[2:]`, `s[:]`.

```go
a := []int{1, 2, 3, 4}
b := a[1:3] // [2 3], shares a's array
b[0] = 20   // a is now [1 20 3 4]
```

This is where the gotcha lives. `b` has length 2 but capacity 3 (it can see `a[3]`), so appending to `b` writes into `a`:

```go
a := []int{1, 2, 3, 4}
b := a[:2]          // [1 2], cap 4
b = append(b, 99)   // fits in capacity, no reallocation
fmt.Println(a)      // [1 2 99 4]
```

A full slice expression `a[low:high:max]` caps the capacity at `max - low`. With `b := a[:2:2]`, the next `append` must reallocate, and `a` stays untouched. When you need independent data, copy it.

## copy and Clone

```go
dst := make([]int, len(src))
n := copy(dst, src) // copies min(len(dst), len(src)) elements, returns that count

c := slices.Clone(src) // the one-liner
```

## range gives you copies

```go
for i, v := range nums {
	v *= 2        // changes the copy only
	nums[i] *= 2  // changes the slice
}
```

## Slices and functions

A function that receives a slice gets a copy of the descriptor, not of the elements. Writes to `s[i]` are visible to the caller. An `append` inside the function is not: the caller's slice still has its old length. That is why functions that grow a slice return it, like `append` itself.

## Two-dimensional slices

A slice of slices. Each row must be allocated on its own:

```go
grid := make([][]int, rows)
for i := range grid {
	grid[i] = make([]int, cols)
}
grid[1][2] = 5
```

Rows can have different lengths; nothing forces a rectangle.

## The slices package

The standard `slices` package (Go 1.21+) has the helpers you would expect on an array type:

```go
slices.Contains(s, 3)         // true or false
slices.Index(s, 3)            // position, or -1
slices.Sort(s)                // in place, ascending
slices.SortFunc(words, func(a, b string) int {
	return cmp.Compare(len(a), len(b)) // shortest first; cmp is a standard package
})
slices.Reverse(s)             // in place
slices.Max(s), slices.Min(s)  // panic on an empty slice
slices.Equal(a, b)            // element-wise comparison
slices.Compact(s)             // drop consecutive duplicates, returns the shorter slice
s = slices.Insert(s, 1, 42)   // insert at index 1
s = slices.Delete(s, 0, 2)    // remove s[0:2]
```

```go playground
package main

import (
	"fmt"
	"slices"
)

func main() {
	var s []int
	for i := range 10 {
		s = append(s, i)
		fmt.Printf("len=%d cap=%d\n", len(s), cap(s))
	}

	a := []int{1, 2, 3, 4}
	b := a[:2]
	b = append(b, 99)
	fmt.Println("a:", a, "b:", b)

	grid := make([][]string, 3)
	for i := range grid {
		grid[i] = make([]string, 3)
		for j := range grid[i] {
			grid[i][j] = "."
		}
	}
	grid[1][1] = "X"
	for _, row := range grid {
		fmt.Println(row)
	}

	words := []string{"pear", "fig", "apple", "fig"}
	slices.Sort(words)
	fmt.Println(slices.Compact(words), slices.Contains(words, "kiwi"))
}

// Try: change b := a[:2] to b := a[:2:2] and see whether a still changes.
```

## Exercises

### 1. Keep the evens

`Evens(nums)` returns a new slice with only the even numbers, in their original order. Start from a nil slice and `append`.

```go starter
package main

func Evens(nums []int) []int {
	return nil // TODO
}
```

```go test
package main

import "testing"

// keeps even numbers in order
func TestEvens(t *testing.T) {
	expect(t, Evens([]int{1, 2, 3, 4, 5, 6}), []int{2, 4, 6})
}

// negative numbers and zero are even too
func TestEvensNegative(t *testing.T) {
	expect(t, Evens([]int{-4, -3, 0, 7}), []int{-4, 0})
}

// no evens gives an empty result
func TestNoEvens(t *testing.T) {
	if got := Evens([]int{1, 3, 5}); len(got) != 0 {
		t.Errorf("expected an empty slice, got %v", got)
	}
}
```

#### Uses
- [Arrays & slices › nil slices](#/slices/nil-slices)
- [Arrays & slices › append](#/slices/append)
- [Control flow › if](#/control-flow/if)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- `var out []int` gives you a nil slice that `append` is happy to grow.
- `range` over `nums` and append only the numbers where `n%2 == 0`. Always assign the result: `out = append(out, n)`.

#### Tips
- `-3 % 2` is `-1`, not `1`, so test for even with `== 0` rather than for odd with `== 1`.

#### Docs
- [builtin: append](https://pkg.go.dev/builtin#append)

### 2. Sorted and unique

`SortedUnique(nums)` returns the distinct values of `nums` in ascending order. It must not reorder the caller's slice: `slices.Sort` works in place, so sort a copy. `slices.Compact` then drops the neighbours that repeat.

```go starter
package main

func SortedUnique(nums []int) []int {
	return nil // TODO
}
```

```go test
package main

import "testing"

// sorts and removes duplicates
func TestSortedUnique(t *testing.T) {
	expect(t, SortedUnique([]int{3, 1, 3, 2, 1}), []int{1, 2, 3})
}

// leaves the input alone
func TestInputUntouched(t *testing.T) {
	in := []int{5, 4, 5}
	SortedUnique(in)
	expect(t, in, []int{5, 4, 5})
}

// empty in, empty out
func TestSortedUniqueEmpty(t *testing.T) {
	if got := SortedUnique(nil); len(got) != 0 {
		t.Errorf("expected an empty slice, got %v", got)
	}
}
```

#### Uses
- [Arrays & slices › copy and Clone](#/slices/copy-and-clone)
- [Arrays & slices › The slices package](#/slices/the-slices-package)

#### Hints
- `slices.Clone(nums)` gives you a copy that you are free to sort. Add `import "slices"`.
- Sort the copy, then return what `slices.Compact` returns: it hands back a shorter slice rather than changing the length of yours.

#### Tips
- `slices.Compact` only removes *neighbouring* duplicates, which is why sorting comes first.

#### Docs
- [slices.Compact](https://pkg.go.dev/slices#Compact)
- [slices.Sort](https://pkg.go.dev/slices#Sort)

### 3. Chunks without aliasing

`Chunk(nums, size)` splits `nums` into consecutive pieces of `size` elements; the last one may be shorter. `size` is always at least 1. The chunks can share memory with `nums`, but appending to one chunk must not overwrite the next chunk or `nums` itself. Plain `nums[i:j]` gets this wrong; the full slice expression `nums[i:j:j]` gets it right.

```go starter
package main

func Chunk(nums []int, size int) [][]int {
	return nil // TODO
}
```

```go test
package main

import "testing"

// splits into pieces with a short tail
func TestChunks(t *testing.T) {
	expect(t, Chunk([]int{1, 2, 3, 4, 5}, 2), [][]int{{1, 2}, {3, 4}, {5}})
}

// one chunk when size covers everything
func TestOneChunk(t *testing.T) {
	expect(t, Chunk([]int{1, 2, 3}, 3), [][]int{{1, 2, 3}})
}

// empty input gives no chunks
func TestNoChunks(t *testing.T) {
	if got := Chunk(nil, 2); len(got) != 0 {
		t.Errorf("expected no chunks, got %v", got)
	}
}

// appending to a chunk does not clobber its neighbour
func TestChunkAliasing(t *testing.T) {
	nums := []int{1, 2, 3, 4, 5}
	c := Chunk(nums, 2)
	if len(c) != 3 {
		t.Fatalf("expected 3 chunks, got %v", c)
	}
	c[0] = append(c[0], 99)
	expect(t, c[1], []int{3, 4})
	expect(t, nums, []int{1, 2, 3, 4, 5})
}
```

#### Uses
- [Arrays & slices › Slicing shares memory](#/slices/slicing-shares-memory)
- [Arrays & slices › Two-dimensional slices](#/slices/two-dimensional-slices)
- [Control flow › for, in all its forms](#/control-flow/for-in-all-its-forms)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- Use a classic `for` loop whose post statement is `i += size`, so `i` lands on the start of each chunk.
- A chunk ends at `i + size`, but never past `len(nums)`. Clamp the end with an `if`.
- Append `nums[i:end:end]` to the result. The third index caps the capacity, so appending to that chunk has to copy.

#### Tips
- `s[i:j:k]` has length `j - i` and capacity `k - i`.

#### Docs
- [Go spec: Slice expressions](https://go.dev/ref/spec#Slice_expressions)

### 4. Transpose a matrix

`Transpose(m)` turns rows into columns: a matrix with `r` rows and `c` columns becomes one with `c` rows and `r` columns, where `out[j][i] == m[i][j]`. Every row of `m` has the same length. Allocate each output row with `make`.

```go starter
package main

func Transpose(m [][]int) [][]int {
	return nil // TODO
}
```

```go test
package main

import "testing"

// two rows become three
func TestTranspose(t *testing.T) {
	m := [][]int{{1, 2, 3}, {4, 5, 6}}
	expect(t, Transpose(m), [][]int{{1, 4}, {2, 5}, {3, 6}})
}

// a row becomes a column
func TestRowToColumn(t *testing.T) {
	expect(t, Transpose([][]int{{7, 8}}), [][]int{{7}, {8}})
}

// transposing twice gives the original back
func TestTwice(t *testing.T) {
	m := [][]int{{1, 2}, {3, 4}, {5, 6}}
	expect(t, Transpose(Transpose(m)), m)
}

// empty matrix
func TestTransposeEmpty(t *testing.T) {
	if got := Transpose(nil); len(got) != 0 {
		t.Errorf("expected an empty matrix, got %v", got)
	}
}
```

#### Uses
- [Arrays & slices › Two-dimensional slices](#/slices/two-dimensional-slices)
- [Control flow › if](#/control-flow/if)

#### Hints
- The output has `len(m[0])` rows, each `len(m)` long. `make` the outer slice, then each row.
- Two nested `range` loops visit every cell; the assignment is the `out[j][i] == m[i][j]` rule from the description.
- An empty `m` has no `m[0]`, so return early before you read it.

#### Tips
- Indexing past the end panics at run time; the compiler cannot catch `m[0]` on an empty slice.

#### Docs
- [Effective Go: Two-dimensional slices](https://go.dev/doc/effective_go#two_dimensional_slices)
