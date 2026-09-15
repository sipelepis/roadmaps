# Practice problems

This module is practice only: classic small problems that mix slices, maps, strings, errors, generics and concurrency. Apart from a short note on runes below, nothing new is introduced; the point is fluency with what the previous modules covered, in the order you like.

## Tips

- Read the tests first. They are the specification, including edge cases like empty input.
- Start with the plain version: a loop, a map, a slice used as a stack. Reach for `slices`, `maps` and `strings` helpers once it works.
- `fmt.Println` inside your code shows up under the test that ran it, which is the fastest way to debug.
- Watch for the Go-specific traps: a `nil` slice versus an empty one, map iteration order being random, bytes versus runes in strings, and a goroutine that never finishes.

## Strings, bytes and runes

A Go string is a sequence of UTF-8 bytes, so `len("é")` is `2` and `s[i]` is a single byte. A character is a *rune*, the `rune` type from Variables & types. Two ways to work in runes:

```go
for i, r := range "héllo" { // range over a string decodes one rune at a time
	fmt.Println(i, string(r)) // i is the byte offset: 0 1 3 4 5
}

rs := []rune("héllo") // convert to a slice of runes: len(rs) is 5
rs[1]                 // 'é'
string(rs)            // back to a string: "héllo"
```

`string(r)` turns one rune into a one-character string. To build a longer string piece by piece, use a `strings.Builder` from the Standard library tour.

```go playground
package main

import (
	"fmt"
	"slices"
	"strings"
)

// isPalindrome ignores case and anything that isn't a letter.
func isPalindrome(s string) bool {
	var letters []rune
	for _, r := range strings.ToLower(s) {
		if r >= 'a' && r <= 'z' {
			letters = append(letters, r)
		}
	}
	rev := slices.Clone(letters)
	slices.Reverse(rev)
	return slices.Equal(letters, rev)
}

func main() {
	for _, s := range []string{"A man, a plan, a canal: Panama", "gopher", ""} {
		fmt.Printf("%-32q %v\n", s, isPalindrome(s))
	}
}

// Try: make it work for accented letters with unicode.IsLetter.
```

## Exercises

### 1. Balanced brackets

`Balanced(s)` reports whether every `(`, `[` and `{` in `s` is closed by the matching bracket in the right order. Other characters are ignored. A slice works as a stack: `append` to push, `s[:len(s)-1]` to pop.

```go starter
package main

func Balanced(s string) bool {
	return false // TODO
}
```

```go test
package main

import "testing"

// accepts balanced input
func TestBalancedTrue(t *testing.T) {
	for _, s := range []string{"", "()", "({[]})", "a(b)c[d]{e}", "(()())"} {
		if !Balanced(s) {
			t.Errorf("Balanced(%q) = false, want true", s)
		}
	}
}

// rejects mismatched, unclosed and early closers
func TestBalancedFalse(t *testing.T) {
	for _, s := range []string{"(]", "((", ")(", "{[}]", "]", "(()"} {
		if Balanced(s) {
			t.Errorf("Balanced(%q) = true, want false", s)
		}
	}
}
```

#### Uses
- [Practice problems › Strings, bytes and runes](#/practice/strings-bytes-and-runes)
- [Arrays & slices › append](#/slices/append)
- [Arrays & slices › Slicing shares memory](#/slices/slicing-shares-memory)
- [Control flow › switch](#/control-flow/switch)

#### Hints
- `range` over `s` and push every opening bracket onto the stack.
- On a closing bracket, the stack must be non-empty and its top must be the matching opener, or the answer is `false`. Then pop.
- At the end, the string is balanced only if the stack is empty again: `"(("` fails here.

#### Tips
- A small `map[rune]rune{')': '(', ']': '[', '}': '{'}` from closer to opener saves three near-identical branches.

#### Docs
- [Go spec: For statements with range clause](https://go.dev/ref/spec#For_range)

### 2. Run-length encoding

`RLE(s)` compresses runs of the same character into count plus character: `"aaabcc"` becomes `"3a1b2c"`. Work in runes, not bytes, so `"ééé"` becomes `"3é"`.

```go starter
package main

func RLE(s string) string {
	return "" // TODO
}
```

```go test
package main

import "testing"

// encodes runs
func TestRLE(t *testing.T) {
	expect(t, RLE("aaabcc"), "3a1b2c")
	expect(t, RLE("abc"), "1a1b1c")
	expect(t, RLE("zzzzzzzzzzzz"), "12z")
	expect(t, RLE(""), "")
}

// counts runes, not bytes
func TestRLEUnicode(t *testing.T) {
	expect(t, RLE("ééé"), "3é")
	expect(t, RLE("日日本"), "2日1本")
}
```

#### Uses
- [Practice problems › Strings, bytes and runes](#/practice/strings-bytes-and-runes)
- [Standard library tour › `strings`](#/stdlib/strings)
- [Standard library tour › `strconv`](#/stdlib/strconv)

#### Hints
- Convert with `[]rune(s)` so that `é` is one element, then walk the slice with an index.
- From position `i`, move a second index `j` forward while `rs[j] == rs[i]`. The run length is `j - i`.
- Write the count with `strconv.Itoa` and the rune with `sb.WriteRune`, then jump `i` to `j`.

#### Tips
- Counts can have several digits (`12z`), so a decoder would read digits until it hits the character.

#### Docs
- [strings.Builder](https://pkg.go.dev/strings#Builder)
- [Go spec: Conversions to and from a string type](https://go.dev/ref/spec#Conversions_to_and_from_a_string_type)

### 3. Group anagrams

`GroupAnagrams(words)` groups words that are anagrams of each other. Sort each group, and sort the groups by their first word. A good map key is the word's letters in sorted order.

```go starter
package main

func GroupAnagrams(words []string) [][]string {
	return nil // TODO
}
```

```go test
package main

import "testing"

// groups and sorts anagrams
func TestGroupAnagrams(t *testing.T) {
	words := []string{"eat", "tea", "tan", "ate", "nat", "bat"}
	expect(t, GroupAnagrams(words), [][]string{{"ate", "eat", "tea"}, {"bat"}, {"nat", "tan"}})
}

// single words and empty input
func TestGroupAnagramsEdges(t *testing.T) {
	expect(t, GroupAnagrams([]string{"go"}), [][]string{{"go"}})
	expect(t, len(GroupAnagrams(nil)), 0)
}
```

#### Uses
- [Practice problems › Strings, bytes and runes](#/practice/strings-bytes-and-runes)
- [Maps › Missing keys and comma-ok](#/maps/missing-keys-and-comma-ok)
- [Arrays & slices › The slices package](#/slices/the-slices-package)
- [Standard library tour › `slices`, `maps` and `sort`](#/stdlib/slices-maps-and-sort)

#### Hints
- For the key, convert the word to `[]rune`, `slices.Sort` it, and convert back with `string(...)`. Anagrams share that key.
- Collect a `map[string][]string` by appending each word to its key's group. Then move the groups into a `[][]string`, sorting each one.
- Order the groups with `slices.SortFunc`, comparing `a[0]` with `b[0]` using `strings.Compare` or `cmp.Compare`.

#### Tips
- Map iteration order is random, so the final sort of the groups is what makes the output stable.

#### Docs
- [slices.SortFunc](https://pkg.go.dev/slices#SortFunc)

### 4. Top words

`TopWords(text, k)` returns the `k` most frequent words in `text`, most frequent first, breaking ties alphabetically. Words are runs of letters, compared in lowercase. If there are fewer than `k` distinct words, return them all.

`strings.FieldsFunc(s, f)` splits `s` wherever `f(r)` returns `true` for a rune `r`, dropping empty pieces, and `unicode.IsLetter(r)` reports whether `r` is a letter.

```go starter
package main

func TopWords(text string, k int) []string {
	return nil // TODO
}
```

```go test
package main

import "testing"

// most frequent first
func TestTopWords(t *testing.T) {
	text := "the cat and the hat. The cat sat!"
	expect(t, TopWords(text, 2), []string{"the", "cat"})
}

// ties break alphabetically
func TestTopWordsTies(t *testing.T) {
	expect(t, TopWords("b a c b a c d", 3), []string{"a", "b", "c"})
}

// k larger than the vocabulary
func TestTopWordsSmall(t *testing.T) {
	expect(t, TopWords("Go, go, GO! stop", 10), []string{"go", "stop"})
	expect(t, len(TopWords("", 3)), 0)
}
```

#### Uses
- [Maps › Missing keys and comma-ok](#/maps/missing-keys-and-comma-ok)
- [Standard library tour › `slices`, `maps` and `sort`](#/stdlib/slices-maps-and-sort)
- [Arrays & slices › Slicing shares memory](#/slices/slicing-shares-memory)

#### Hints
- Lowercase the text, split it with `strings.FieldsFunc` on anything that isn't a letter, and count the words in a `map[string]int`.
- Get the keys with `slices.Sorted(maps.Keys(counts))`, then `slices.SortFunc` them by count, highest first. `cmp.Or` adds the alphabetical tie-break.
- Return at most `k` words: slice with `min(k, len(words))`.

#### Tips
- To sort from highest to lowest, swap the arguments: `cmp.Compare(counts[b], counts[a])`.

#### Docs
- [cmp.Or](https://pkg.go.dev/cmp#Or)
- [strings.FieldsFunc](https://pkg.go.dev/strings#FieldsFunc)

### 5. Merge intervals

`MergeIntervals(in)` merges overlapping or touching intervals and returns them sorted by start. `[2]int{start, end}` is a fixed-size array of two ints. Don't reorder the caller's slice; sort a copy (`slices.Clone`).

```go starter
package main

func MergeIntervals(in [][2]int) [][2]int {
	return nil // TODO
}
```

```go test
package main

import "testing"

// merges overlaps and touching ends
func TestMergeIntervals(t *testing.T) {
	expect(t, MergeIntervals([][2]int{{1, 3}, {2, 6}, {8, 10}, {15, 18}}), [][2]int{{1, 6}, {8, 10}, {15, 18}})
	expect(t, MergeIntervals([][2]int{{1, 4}, {4, 5}}), [][2]int{{1, 5}})
}

// handles unsorted and nested input
func TestMergeIntervalsUnsorted(t *testing.T) {
	expect(t, MergeIntervals([][2]int{{5, 7}, {1, 10}, {2, 3}}), [][2]int{{1, 10}})
	expect(t, MergeIntervals([][2]int{{9, 9}, {0, 1}}), [][2]int{{0, 1}, {9, 9}})
	expect(t, len(MergeIntervals(nil)), 0)
}

// leaves the input alone
func TestMergeIntervalsInput(t *testing.T) {
	in := [][2]int{{5, 6}, {1, 2}}
	MergeIntervals(in)
	expect(t, in, [][2]int{{5, 6}, {1, 2}})
}
```

#### Uses
- [Arrays & slices › Arrays are values](#/slices/arrays-are-values)
- [Arrays & slices › copy and Clone](#/slices/copy-and-clone)
- [Arrays & slices › The slices package](#/slices/the-slices-package)

#### Hints
- Clone the input, then `slices.SortFunc` the copy by start, comparing `a[0]` and `b[0]` with `cmp.Compare`.
- Walk the sorted intervals. If one starts at or before the end of the last merged interval, extend that end with `max`; otherwise append it as a new interval.

#### Tips
- `[2]int` is a value. `out[n-1][1] = ...` changes the element stored in `out`, but assigning to the loop variable's `iv[1]` would change only a copy.

#### Docs
- [slices.Clone](https://pkg.go.dev/slices#Clone)
- [slices.SortFunc](https://pkg.go.dev/slices#SortFunc)

### 6. Matrix multiply

`MatMul(a, b)` returns the matrix product of `a` (m×n) and `b` (n×p), an m×p matrix where each cell is the dot product of a row of `a` and a column of `b`. If the number of columns of `a` doesn't match the number of rows of `b`, return `ErrShape` wrapped with the sizes: `2x3 times 2x2: incompatible shapes`.

```go starter
package main

import "errors"

var ErrShape = errors.New("incompatible shapes")

func MatMul(a, b [][]int) ([][]int, error) {
	return nil, nil // TODO
}
```

```go test
package main

import (
	"errors"
	"testing"
)

// multiplies square matrices
func TestMatMulSquare(t *testing.T) {
	a := [][]int{{1, 2}, {3, 4}}
	b := [][]int{{5, 6}, {7, 8}}
	got, err := MatMul(a, b)
	expect(t, got, [][]int{{19, 22}, {43, 50}})
	expect(t, err, nil)
}

// multiplies rectangular matrices
func TestMatMulRect(t *testing.T) {
	a := [][]int{{1, 2, 3}}      // 1x3
	b := [][]int{{4}, {5}, {6}}  // 3x1
	got, _ := MatMul(a, b)
	expect(t, got, [][]int{{32}})
	got, _ = MatMul(b, a)
	expect(t, got, [][]int{{4, 8, 12}, {5, 10, 15}, {6, 12, 18}})
}

// rejects mismatched shapes
func TestMatMulShape(t *testing.T) {
	_, err := MatMul([][]int{{1, 2, 3}, {4, 5, 6}}, [][]int{{1, 2}, {3, 4}})
	if !errors.Is(err, ErrShape) {
		t.Fatalf("want ErrShape, got %v", err)
	}
	expect(t, err.Error(), "2x3 times 2x2: incompatible shapes")
}
```

#### Uses
- [Arrays & slices › Two-dimensional slices](#/slices/two-dimensional-slices)
- [Control flow › for, in all its forms](#/control-flow/for-in-all-its-forms)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)

#### Hints
- Sizes: `m` is `len(a)`, `n` is `len(a[0])` (guard against an empty `a`), `p` is `len(b[0])`. The shapes fit when `n == len(b)`.
- Allocate `m` rows of `p` zeros, then three nested loops add `a[i][k] * b[k][j]` into `out[i][j]`.

#### Tips
- Nothing forces a `[][]int` to be rectangular. This exercise trusts that every row is as long as the first; real code would check.

#### Docs
- [Effective Go: Two-dimensional slices](https://go.dev/doc/effective_go#two_dimensional_slices)

### 7. Generic queue

`Queue[T]` is first in, first out. `Push` adds to the back, `Pop` removes from the front (or returns the zero value and `false` when empty), and `Len` reports the size. The zero value must be ready to use.

```go starter
package main

type Queue[T any] struct {
	items []T
}

func (q *Queue[T]) Push(v T) {
	// TODO
}

func (q *Queue[T]) Pop() (T, bool) {
	var zero T
	return zero, false // TODO
}

func (q *Queue[T]) Len() int {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// first in, first out
func TestQueueFIFO(t *testing.T) {
	var q Queue[string]
	q.Push("a")
	q.Push("b")
	q.Push("c")
	expect(t, q.Len(), 3)
	v, ok := q.Pop()
	expect(t, v, "a")
	expect(t, ok, true)
	v, _ = q.Pop()
	expect(t, v, "b")
	expect(t, q.Len(), 1)
}

// interleaved pushes and pops
func TestQueueInterleaved(t *testing.T) {
	var q Queue[int]
	var got []int
	for i := range 10 {
		q.Push(i)
		q.Push(i + 100)
		v, _ := q.Pop()
		got = append(got, v)
	}
	expect(t, got, []int{0, 100, 1, 101, 2, 102, 3, 103, 4, 104})
	expect(t, q.Len(), 10)
}

// empty queue returns zero and false
func TestQueueEmpty(t *testing.T) {
	var q Queue[float64]
	v, ok := q.Pop()
	expect(t, v, 0.0)
	expect(t, ok, false)
}
```

#### Uses
- [Generics › Generic types](#/generics/generic-types)
- [Arrays & slices › append](#/slices/append)
- [Arrays & slices › Slicing shares memory](#/slices/slicing-shares-memory)

#### Hints
- `Push` appends to the back. The front is `q.items[0]`.
- `Pop` checks for empty, reads `q.items[0]`, then reslices with `q.items[1:]`.

#### Tips
- Setting `q.items[0]` to the zero value before reslicing lets the garbage collector reclaim whatever it pointed to.

#### Docs
- [Go tutorial: Getting started with generics](https://go.dev/doc/tutorial/generics)

### 8. LRU cache

An LRU cache holds at most `capacity` entries and, when full, evicts the least recently used one. Both `Get` and `Put` count as a use. `Put` on an existing key updates its value.

The simple version keeps the values in a map and the keys in a slice ordered from least to most recently used. On every use, move the key to the end of the slice (`slices.Index`, `slices.Delete`, then `append`); when the cache is full, evict the key at the front. That's O(n) per operation, which is fine at this size.

For O(1) operations, the classic design pairs the map with the standard `container/list`, a doubly linked list with `PushFront`, `MoveToFront`, `Back` and `Remove`. This course doesn't cover it, but its docs are short.

```go starter
package main

type LRU struct {
	// TODO: fields
}

func NewLRU(capacity int) *LRU {
	return &LRU{}
}

func (c *LRU) Get(key string) (int, bool) {
	return 0, false // TODO
}

func (c *LRU) Put(key string, val int) {
	// TODO
}
```

```go test
package main

import "testing"

// stores and retrieves
func TestLRUBasic(t *testing.T) {
	c := NewLRU(2)
	c.Put("a", 1)
	c.Put("b", 2)
	v, ok := c.Get("a")
	expect(t, v, 1)
	expect(t, ok, true)
	_, ok = c.Get("zzz")
	expect(t, ok, false)
}

// evicts the least recently used
func TestLRUEvicts(t *testing.T) {
	c := NewLRU(2)
	c.Put("a", 1)
	c.Put("b", 2)
	c.Get("a")    // a is now the most recent
	c.Put("c", 3) // evicts b
	_, ok := c.Get("b")
	expect(t, ok, false)
	v, _ := c.Get("a")
	expect(t, v, 1)
	v, _ = c.Get("c")
	expect(t, v, 3)
}

// updating a key refreshes it
func TestLRUUpdate(t *testing.T) {
	c := NewLRU(2)
	c.Put("a", 1)
	c.Put("b", 2)
	c.Put("a", 10) // update, a is most recent
	c.Put("c", 3)  // evicts b
	v, ok := c.Get("a")
	expect(t, v, 10)
	expect(t, ok, true)
	_, ok = c.Get("b")
	expect(t, ok, false)
}
```

#### Uses
- [Structs & methods › Constructors](#/structs/constructors)
- [Maps › nil maps](#/maps/nil-maps)
- [Maps › Missing keys and comma-ok](#/maps/missing-keys-and-comma-ok)
- [Arrays & slices › The slices package](#/slices/the-slices-package)

#### Hints
- Fields: the capacity, a `map[string]int` of values and a `[]string` of keys. `NewLRU` must create the map, or the first `Put` panics.
- Write a `touch(key)` method that removes `key` from the slice if it's there and appends it at the end. Call it on every `Get` hit and every `Put`.
- In `Put`, when the key is new and the map is already at capacity, delete the front key from the map and drop it from the slice first.

#### Tips
- `slices.Delete` returns the shorter slice. Assign it back, like `append`.

#### Docs
- [slices.Delete](https://pkg.go.dev/slices#Delete)
- [container/list](https://pkg.go.dev/container/list)

### 9. Flatten JSON

`FlattenJSON(data)` decodes a JSON object and flattens nested objects and arrays into dotted keys: `{"a": {"b": 1}, "tags": ["x", "y"]}` becomes `{"a.b": 1, "tags.0": "x", "tags.1": "y"}`. Leaf values keep the types `encoding/json` gives them when decoding into `any`, so numbers are `float64`. Return any decoding error.

Decode into a `map[string]any`, then recurse with a type switch on `map[string]any` and `[]any`.

```go starter
package main

func FlattenJSON(data []byte) (map[string]any, error) {
	return nil, nil // TODO
}
```

```go test
package main

import "testing"

// flattens nested objects and arrays
func TestFlattenJSON(t *testing.T) {
	got, err := FlattenJSON([]byte(`{"a": {"b": 1, "c": {"d": true}}, "tags": ["x", "y"], "e": null}`))
	expect(t, err, nil)
	expect(t, got, map[string]any{
		"a.b":    1.0,
		"a.c.d":  true,
		"tags.0": "x",
		"tags.1": "y",
		"e":      nil,
	})
}

// objects inside arrays
func TestFlattenJSONArrays(t *testing.T) {
	got, _ := FlattenJSON([]byte(`{"users": [{"name": "ada"}, {"name": "bob", "age": 30}]}`))
	expect(t, got, map[string]any{"users.0.name": "ada", "users.1.name": "bob", "users.1.age": 30.0})
}

// returns decoding errors
func TestFlattenJSONInvalid(t *testing.T) {
	if _, err := FlattenJSON([]byte(`[1, 2]`)); err == nil {
		t.Error("want an error for a top-level array")
	}
	if _, err := FlattenJSON([]byte(`{`)); err == nil {
		t.Error("want an error for invalid JSON")
	}
}
```

#### Uses
- [Standard library tour › `encoding/json`](#/stdlib/encoding-json)
- [Interfaces › Type assertions and type switches](#/interfaces/type-assertions-and-type-switches)
- [Maps › Maps are references](#/maps/maps-are-references)
- [Standard library tour › `strconv`](#/stdlib/strconv)

#### Hints
- Decode with `json.Unmarshal(data, &root)` into `var root map[string]any`. A top-level array fails right there, which is what the test wants.
- Write a recursive helper, `flatten(prefix string, v any, out map[string]any)`, around a type switch: recurse into `map[string]any` and `[]any`, and store anything else at `out[prefix]`.
- A child's key is `prefix + "." + key`, or just `key` at the top level. Array indexes become keys through `strconv.Itoa`.

#### Tips
- Maps are references, so the helper can fill `out` without returning it.

#### Docs
- [encoding/json.Unmarshal](https://pkg.go.dev/encoding/json#Unmarshal)
- [Go spec: Type switches](https://go.dev/ref/spec#Type_switches)

### 10. Fan-in sum

`SumAll(chans...)` receives from every channel until each is closed and returns the total. Read all the channels concurrently: one goroutine per channel, each sending its subtotal on a results channel (or adding under a mutex), and a `sync.WaitGroup` to know when they're done.

```go starter
package main

func SumAll(chans ...<-chan int) int {
	return 0 // TODO
}
```

```go test
package main

import "testing"

func produceForTest(nums ...int) <-chan int {
	ch := make(chan int)
	go func() {
		defer close(ch)
		for _, n := range nums {
			ch <- n
		}
	}()
	return ch
}

// sums values from every channel
func TestSumAll(t *testing.T) {
	expect(t, SumAll(produceForTest(1, 2, 3), produceForTest(10, 20), produceForTest(100)), 136)
}

// handles many channels and empty ones
func TestSumAllMany(t *testing.T) {
	var chans []<-chan int
	want := 0
	for i := range 50 {
		chans = append(chans, produceForTest(i, i))
		want += 2 * i
	}
	chans = append(chans, produceForTest())
	expect(t, SumAll(chans...), want)
	expect(t, SumAll(), 0)
}
```

#### Uses
- [Goroutines & channels › `sync.WaitGroup`](#/goroutines/sync-waitgroup)
- [Goroutines & channels › Channels](#/goroutines/channels)
- [Goroutines & channels › `close` and `range`](#/goroutines/close-and-range)
- [Select, sync & context › `sync.Mutex`](#/concurrency/sync-mutex)

#### Hints
- One `wg.Go` per channel, each adding up its channel with `for v := range ch`.
- Give the results channel a buffer of `len(chans)`, so every goroutine can send its subtotal without waiting. Then `wg.Wait()`, `close` it, and add up what's in it.

#### Tips
- With an unbuffered results channel, calling `wg.Wait()` before reading deadlocks: every goroutine is stuck on its send.

#### Docs
- [sync.WaitGroup.Go](https://pkg.go.dev/sync#WaitGroup.Go)

### 11. Parallel map

`ParallelMap(in, workers, f)` returns `f(in[i])` at index `i`, running at most `workers` calls of `f` at once. It's the worker pool from the concurrency module, made generic. The tests check the results, the upper bound, and that the workers really run in parallel.

```go starter
package main

func ParallelMap[T, U any](in []T, workers int, f func(T) U) []U {
	out := make([]U, len(in))
	for i, v := range in {
		out[i] = f(v) // TODO: run in parallel
	}
	return out
}
```

```go test
package main

import (
	"strconv"
	"sync/atomic"
	"testing"
	"time"
)

// peakTracker wraps f to record how many calls run at the same time.
func peakTracker[T, U any](f func(T) U) (func(T) U, *atomic.Int32) {
	var active, peak atomic.Int32
	return func(v T) U {
		now := active.Add(1)
		for {
			p := peak.Load()
			if now <= p || peak.CompareAndSwap(p, now) {
				break
			}
		}
		time.Sleep(10 * time.Millisecond)
		active.Add(-1)
		return f(v)
	}, &peak
}

// keeps results in input order
func TestParallelMapOrder(t *testing.T) {
	f, _ := peakTracker(strconv.Itoa)
	expect(t, ParallelMap([]int{5, 4, 3, 2, 1, 0}, 3, f), []string{"5", "4", "3", "2", "1", "0"})
	expect(t, len(ParallelMap([]int{}, 2, f)), 0)
}

// never exceeds the worker count
func TestParallelMapBound(t *testing.T) {
	f, peak := peakTracker(func(n int) int { return n })
	ParallelMap(make([]int, 20), 4, f)
	if p := peak.Load(); p > 4 {
		t.Fatalf("%d calls ran at once, want at most 4", p)
	}
}

// runs workers in parallel
func TestParallelMapParallel(t *testing.T) {
	f, peak := peakTracker(func(s string) int { return len(s) })
	got := ParallelMap([]string{"a", "bb", "ccc", "dddd", "e", "ff"}, 3, f)
	expect(t, got, []int{1, 2, 3, 4, 1, 2})
	expect(t, peak.Load(), int32(3))
}
```

#### Uses
- [Select, sync & context › Worker pools](#/concurrency/worker-pools)
- [Generics › Type parameters](#/generics/type-parameters)
- [Goroutines & channels › `close` and `range`](#/goroutines/close-and-range)

#### Hints
- It's `Process` from the concurrency module with `T` and `U` in place of `int`: send indexes on a channel and let `workers` goroutines receive them.
- Each worker writes `out[i] = f(in[i])`. Close the index channel after the last send, then `wg.Wait()`.

#### Tips
- Type parameters don't change the concurrency at all. The compiler just checks that `f` fits `in` and `out`.

#### Docs
- [Effective Go: Channels](https://go.dev/doc/effective_go#channels)
