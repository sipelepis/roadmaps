# Maps

A map is Go's built-in hash table: `map[K]V` maps keys of one type to values of another. Missing keys read as the zero value, a nil map panics on write, and iteration order is deliberately random.

## Creating and using maps

```go
ages := map[string]int{"ada": 36, "alan": 41} // literal
scores := make(map[string]int)               // empty, ready to write
scores["ada"] = 90                           // add or overwrite
n := scores["ada"]                           // 90
len(scores)                                  // 1
delete(scores, "ada")                        // no-op if the key is missing
clear(ages)                                  // remove every entry
```

Both the key type and the value type are fixed. There is no `Map` object with methods; `len`, `delete` and `clear` are built-in functions.

## Missing keys and comma-ok

Reading a key that is not there does not throw. It returns the zero value of the value type:

```go
scores := map[string]int{"ada": 90}
scores["bob"] // 0
```

That is convenient and ambiguous: did Bob score 0, or is he missing? The two-value form tells you:

```go
if s, ok := scores["bob"]; ok {
	fmt.Println("bob scored", s)
} else {
	fmt.Println("no score for bob")
}
```

`ok` is `true` only if the key exists. This "comma-ok" shape shows up again with type assertions and channels.

The zero-value rule makes two common idioms one line each:

```go
counts := map[string]int{}
for _, w := range words {
	counts[w]++ // missing key reads as 0
}

byFirst := map[byte][]string{}
for _, w := range words {
	byFirst[w[0]] = append(byFirst[w[0]], w) // missing key reads as a nil slice
}
```

## nil maps

The zero value of a map type is `nil`. A nil map behaves like an empty map for reading, `len`, `delete` and `range`, but writing to it panics:

```go
var m map[string]int
fmt.Println(m["x"], len(m)) // 0 0
m["x"] = 1                  // panic: assignment to entry in nil map
```

This bites when a map lives inside a struct or is declared with `var`. Initialize with `make` or a literal before you write.

## Iteration order is random

```go
for name, age := range ages {
	fmt.Println(name, age)
}
for name := range ages { // keys only
	fmt.Println(name)
}
```

The order is unspecified, and the runtime randomizes it on purpose so no code can depend on it. Run the same loop twice and you may get two orders. When order matters, sort the keys first:

```go
names := slices.Sorted(maps.Keys(ages))
for _, name := range names {
	fmt.Println(name, ages[name])
}
```

`maps.Keys` returns an iterator rather than a slice; `slices.Sorted` collects it into a sorted slice. Confusingly, `fmt.Println(m)` prints a map with sorted keys, so printed output looks ordered even though `range` is not.

Deleting entries while ranging over a map is safe. Entries added during the loop may or may not be visited.

## Keys must be comparable

Any type that supports `==` can be a key: numbers, strings, booleans, pointers, arrays, and structs made of those. Slices, maps and functions cannot. To key by a pair of values, use an array like `[2]int` or a small struct.

## Maps are references

A map value is a pointer to the underlying table. Assigning a map or passing it to a function does not copy the entries:

```go
a := map[string]int{"x": 1}
b := a
b["x"] = 99 // a["x"] is 99 too
c := maps.Clone(a) // an independent copy
```

A function that receives a map can add and delete entries, and the caller will see them. Maps are also not safe for concurrent writes; the concurrency modules show how to guard them.

## Sets

Go has no set type. Use a map with throwaway values:

```go
seen := map[string]bool{}
seen["go"] = true
if seen["go"] { // missing keys read as false, so this reads nicely
	fmt.Println("seen it")
}

set := map[string]struct{}{}  // struct{} takes zero bytes
set["go"] = struct{}{}
_, ok := set["go"]
```

`map[T]bool` reads better; `map[T]struct{}` saves memory and makes it impossible to store `false` by accident. Both are common.

## The maps package

```go
maps.Keys(m)          // iterator over keys (Go 1.23+)
maps.Values(m)        // iterator over values
maps.Clone(m)         // shallow copy
maps.Equal(a, b)      // same keys and values
maps.Copy(dst, src)   // copy all entries of src into dst
maps.DeleteFunc(m, func(k string, v int) bool { return v == 0 })
```

```go playground
package main

import (
	"fmt"
	"maps"
	"slices"
	"strings"
)

func main() {
	text := "the cat and the dog and the bird"
	counts := map[string]int{}
	for _, w := range strings.Fields(text) {
		counts[w]++
	}

	for _, w := range slices.Sorted(maps.Keys(counts)) {
		fmt.Printf("%-5s %s\n", w, strings.Repeat("#", counts[w]))
	}

	if n, ok := counts["fish"]; !ok {
		fmt.Println("no fish, n is", n)
	}

	stop := map[string]bool{"the": true, "and": true}
	maps.DeleteFunc(counts, func(w string, _ int) bool { return stop[w] })
	fmt.Println(counts, len(counts))

	for k := range counts {
		fmt.Print(k, " ")
	}
	fmt.Println("<- run again: this order can change")
}

// Try: replace counts := map[string]int{} with var counts map[string]int.
```

## Exercises

### 1. Word count

`WordCount(text)` returns how many times each word appears, ignoring case. You need two functions from the `strings` package (add `import "strings"`): `strings.Fields(text)` splits on any run of whitespace and returns the words as a `[]string`, so `strings.Fields(" a  b\n")` is `[]string{"a", "b"}`; `strings.ToLower("Go")` is `"go"`.

```go starter
package main

func WordCount(text string) map[string]int {
	return nil // TODO
}
```

```go test
package main

import "testing"

// counts each word
func TestWordCount(t *testing.T) {
	expect(t, WordCount("the cat and the hat"), map[string]int{"the": 2, "cat": 1, "and": 1, "hat": 1})
}

// ignores case and extra spaces
func TestWordCountCase(t *testing.T) {
	expect(t, WordCount("  Go go  GO\n"), map[string]int{"go": 3})
}

// empty text has no words
func TestWordCountEmpty(t *testing.T) {
	if got := WordCount(""); len(got) != 0 {
		t.Errorf("expected no words, got %v", got)
	}
}
```

#### Uses
- [Maps › Creating and using maps](#/maps/creating-and-using-maps)
- [Maps › Missing keys and comma-ok](#/maps/missing-keys-and-comma-ok)
- [Maps › nil maps](#/maps/nil-maps)

#### Hints
- Start from an empty map, `map[string]int{}`, not a nil one: you are about to write to it.
- `range` over the words and add one to the entry for each lowercased word. A missing key reads as 0, so `++` just works.

#### Tips
- Lowercase the key, not the whole text afterwards: the map only ever sees what you index it with.

#### Docs
- [strings.Fields](https://pkg.go.dev/strings#Fields)
- [Effective Go: Maps](https://go.dev/doc/effective_go#maps)

### 2. Group by length

`GroupByLen(words)` maps each word length to the words of that length, in the order they appear in the input.

```go starter
package main

func GroupByLen(words []string) map[int][]string {
	return nil // TODO
}
```

```go test
package main

import "testing"

// groups by length, keeping order
func TestGroupByLen(t *testing.T) {
	got := GroupByLen([]string{"go", "rust", "c", "zig", "java", "js"})
	want := map[int][]string{1: {"c"}, 2: {"go", "js"}, 3: {"zig"}, 4: {"rust", "java"}}
	expect(t, got, want)
}

// repeated words stay repeated
func TestGroupRepeats(t *testing.T) {
	expect(t, GroupByLen([]string{"ab", "ab"}), map[int][]string{2: {"ab", "ab"}})
}
```

#### Uses
- [Maps › Missing keys and comma-ok](#/maps/missing-keys-and-comma-ok)
- [Arrays & slices › append](#/slices/append)

#### Hints
- The value type is `[]string`, and a missing key reads as a nil slice, which `append` accepts.
- `append` to the group for `len(w)` and store the result back under the same key.

#### Tips
- `len(w)` counts bytes, so it only matches the number of letters for ASCII words.

#### Docs
- [builtin: append](https://pkg.go.dev/builtin#append)

### 3. Common items

`Common(a, b)` returns the strings that appear in both slices, each once, sorted. Build a set from one slice with a map, then check the other against it. `slices.Sort` puts the result in order.

```go starter
package main

func Common(a, b []string) []string {
	return nil // TODO
}
```

```go test
package main

import "testing"

// finds shared items, sorted and unique
func TestCommon(t *testing.T) {
	expect(t, Common([]string{"x", "y", "z", "y"}, []string{"z", "w", "y", "y"}), []string{"y", "z"})
}

// order of arguments does not matter
func TestCommonSymmetric(t *testing.T) {
	a := []string{"pear", "fig", "kiwi"}
	b := []string{"kiwi", "plum", "pear"}
	expect(t, Common(a, b), Common(b, a))
	expect(t, Common(a, b), []string{"kiwi", "pear"})
}

// nothing in common
func TestNothingCommon(t *testing.T) {
	if got := Common([]string{"a"}, []string{"b"}); len(got) != 0 {
		t.Errorf("expected nothing in common, got %v", got)
	}
}
```

#### Uses
- [Maps › Sets](#/maps/sets)
- [Maps › Creating and using maps](#/maps/creating-and-using-maps)
- [Arrays & slices › The slices package](#/slices/the-slices-package)

#### Hints
- Put every string from `a` into a `map[string]bool`.
- Walk `b` and keep each string the set contains. So it is kept only once, `delete` it from the set as you keep it.
- Sort the result with `slices.Sort` before returning it.

#### Tips
- Missing keys read as `false`, so testing a `map[string]bool` set needs no comma-ok.

#### Docs
- [Go spec: Map types](https://go.dev/ref/spec#Map_types)
- [slices.Sort](https://pkg.go.dev/slices#Sort)

### 4. Top N

`TopN(counts, n)` returns the `n` keys with the highest counts, highest first. Ties go alphabetically. If `n` is larger than the map, return every key. Map iteration is random, so collect the keys and sort them with `slices.SortFunc`, whose comparison function returns a negative number when `a` should come before `b`. `cmp.Compare(x, y)` from the `cmp` package (`import "cmp"`) returns -1, 0 or 1.

```go starter
package main

func TopN(counts map[string]int, n int) []string {
	return nil // TODO
}
```

```go test
package main

import "testing"

// highest counts first
func TestTopN(t *testing.T) {
	counts := map[string]int{"go": 5, "rust": 3, "zig": 9, "c": 1}
	expect(t, TopN(counts, 2), []string{"zig", "go"})
}

// ties are alphabetical
func TestTopNTies(t *testing.T) {
	counts := map[string]int{"b": 2, "a": 2, "d": 2, "c": 7}
	expect(t, TopN(counts, 3), []string{"c", "a", "b"})
}

// n larger than the map returns everything
func TestTopNAll(t *testing.T) {
	counts := map[string]int{"x": 1, "y": 2}
	expect(t, TopN(counts, 10), []string{"y", "x"})
}
```

#### Uses
- [Maps › Iteration order is random](#/maps/iteration-order-is-random)
- [Arrays & slices › The slices package](#/slices/the-slices-package)
- [Arrays & slices › Slicing shares memory](#/slices/slicing-shares-memory)
- [Control flow › if](#/control-flow/if)

#### Hints
- Collect the keys into a slice first: `range` and `append`, or `slices.Sorted(maps.Keys(counts))`.
- In the comparison, compare counts with the arguments swapped (`b`'s count first) to get highest first. Only when that gives 0, compare the keys themselves.
- Cut the result with `keys[:n]`, but only when `n` is smaller than `len(keys)`.

#### Tips
- `if c := cmp.Compare(...); c != 0 { return c }` keeps the tie-break readable.

#### Docs
- [slices.SortFunc](https://pkg.go.dev/slices#SortFunc)
- [cmp.Compare](https://pkg.go.dev/cmp#Compare)
