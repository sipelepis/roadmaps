# Reference

A lookup page, not a step on the roadmap. It collects the test API the exercises use from the very first one, Go's built-in functions, and the standard library calls that show up in exercises and their tests. Every entry has its signature, what it does, a tiny sample with its result, and a link to the official docs.

## How the tests here work

Each exercise is two files. Yours is a `package main` with no `func main`. The tests are a second file in the same package, and this site compiles both together and runs them with the real `testing` package on the Go Playground.

```go
package main

import "testing"

// greets ada
func TestGreetAda(t *testing.T) {
	expect(t, Greet("Ada"), "Hello, Ada!")
}
```

- **`func TestXxx(t *testing.T)`** is a test. `go test` (and this site) finds functions by that name and signature, in source order. `t` is the handle you report failures through.
- **The `//` comment directly above a test is its label.** That is the sentence you see next to the result on this site. It is not part of Go; the usual `go test` output shows the function name.
- **`t.Errorf(format, args...)`** records a failure and *keeps going*, so one test can report several problems. [`testing.T.Errorf`](https://pkg.go.dev/testing#T.Errorf)
- **`t.Fatalf(format, args...)`** records a failure and *stops this test* immediately. Use it when the rest of the test would be meaningless, like after a value came back nil. Other tests still run. [`testing.T.Fatalf`](https://pkg.go.dev/testing#T.Fatalf)
- **`t.Fatal(args...)`** and **`t.Error(args...)`** are the same two, without a format string. [`testing.T.Fatal`](https://pkg.go.dev/testing#T.Fatal)
- **`t.Run(name, f)`** runs `f` as a named subtest, which is how table-driven tests name their cases. [`testing.T.Run`](https://pkg.go.dev/testing#T.Run)
- **`t.Helper()`** marks a function as a helper, so a failure points at the caller's line instead of the helper's. [`testing.T.Helper`](https://pkg.go.dev/testing#T.Helper)

### `expect(t, got, want)`

`expect` is not part of Go. This site injects it into every exercise so the tests stay short:

```go
func expect[T any](t *testing.T, got, want T) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Errorf("not equal\nexpected: %#v\nactual:   %#v", want, got)
	}
}
```

Three things follow from that body:

- It compares with [`reflect.DeepEqual`](https://pkg.go.dev/reflect#DeepEqual), which walks slices, maps and structs. That is why `expect` can compare a whole `[]int` or `map[string]int` in one line, while plain `==` cannot.
- **A nil slice and an empty slice are not equal.** `reflect.DeepEqual([]int(nil), []int{})` is `false`. When a test wants "empty" without caring which, it checks `len(got) != 0` instead, and you will see both styles here.
- It calls `t.Errorf`, so a failed `expect` does not stop the test. The lines after it still run.

`got` and `want` must have the same type, because they share one type parameter. `expect(t, err, nil)` works because `nil` takes the type of `err`.

In your own projects there is no `expect`: you write the `if got != want { t.Errorf(...) }` yourself, or use `reflect.DeepEqual` or [`slices.Equal`](https://pkg.go.dev/slices#Equal).

### Panics

A panic inside one test fails only that test, with `panic: <value>` as the message; the remaining tests still run. That is this site's runner catching it with `recover`. Plain `go test` behaves differently: an unrecovered panic ends the whole run.

## Built-in functions

These need no import. They are described in [the `builtin` package docs](https://pkg.go.dev/builtin), which is documentation only, not a real package.

- [`len(v) int`](https://pkg.go.dev/builtin#len) — length of a string (in **bytes**), slice, array, map or channel buffer. `len("héllo")` is `6`, `len([]int{1, 2, 3})` is `3`.
- [`cap(v) int`](https://pkg.go.dev/builtin#cap) — capacity: how many elements fit before a slice reallocates, or a channel's buffer size. `cap(make([]int, 2, 10))` is `10`.
- [`make(T, ...)`](https://pkg.go.dev/builtin#make) — creates a slice, map or channel ready to use. `make([]int, 3)` is `[0 0 0]`, `make([]int, 0, 100)` is empty with room for 100, `make(map[string]int)` is an empty map, `make(chan int, 4)` is a channel with a buffer of 4.
- [`new(T) *T`](https://pkg.go.dev/builtin#new) — allocates a zero `T` and returns a pointer. `*new(int)` is `0`. In practice `&Point{}` is more common.
- [`append(s []T, vals ...T) []T`](https://pkg.go.dev/builtin#append) — returns `s` with the values added; **always assign the result**. `append([]int{1, 2}, 3)` is `[1 2 3]`, and `append(a, b...)` appends another slice. It works on a `nil` slice, so `var out []int` then `out = append(out, n)` is the standard way to build one.
- [`copy(dst, src []T) int`](https://pkg.go.dev/builtin#copy) — copies `min(len(dst), len(src))` elements and returns that count. With `dst := make([]int, 2)`, `copy(dst, []int{7, 8, 9})` returns `2` and leaves `dst` as `[7 8]`.
- [`delete(m, key)`](https://pkg.go.dev/builtin#delete) — removes a map entry, and does nothing if the key is missing. After `delete(m, "a")` on `{"a": 1, "b": 2}`, `m` is `{"b": 2}`.
- [`clear(v)`](https://pkg.go.dev/builtin#clear) — empties a map, or zeroes every element of a slice. `clear(m)` leaves `len(m)` at `0`.
- [`panic(v)`](https://pkg.go.dev/builtin#panic) — stops normal execution and unwinds, running deferred calls. For bugs and impossible states, not for expected failures.
- [`recover() any`](https://pkg.go.dev/builtin#recover) — inside a deferred function, stops the panic and returns its value; `nil` if there was no panic. With `defer func() { r = recover() }()` above `panic("boom")`, `r` ends up as `"boom"`. Anywhere but a deferred function it just returns `nil`.
- [`min(x, y, ...)`](https://pkg.go.dev/builtin#min) / [`max(x, y, ...)`](https://pkg.go.dev/builtin#max) — smallest and largest of any number of ordered arguments (Go 1.21+). `min(3, 1, 2)` is `1`, `max(3, 1, 2)` is `3`.

## strings

`import "strings"`. These are functions, not methods: there is no `"abc".upper()`.

- [`strings.ToLower(s) string`](https://pkg.go.dev/strings#ToLower) — lowercases every letter. `strings.ToLower("Go GO")` is `"go go"`.
- [`strings.ToUpper(s) string`](https://pkg.go.dev/strings#ToUpper) — uppercases every letter. `strings.ToUpper("go")` is `"GO"`.
- [`strings.TrimSpace(s) string`](https://pkg.go.dev/strings#TrimSpace) — removes leading and trailing whitespace, newlines and tabs included. `strings.TrimSpace("  hi\n")` is `"hi"`.
- [`strings.Trim(s, cutset) string`](https://pkg.go.dev/strings#Trim) — removes any of the given characters from both ends. `strings.Trim("--hi--", "-")` is `"hi"`.
- [`strings.TrimPrefix(s, p) string`](https://pkg.go.dev/strings#TrimPrefix) / [`TrimSuffix`](https://pkg.go.dev/strings#TrimSuffix) — removes that exact prefix or suffix if present. `strings.TrimPrefix("v1.2", "v")` is `"1.2"`.
- [`strings.Fields(s) []string`](https://pkg.go.dev/strings#Fields) — splits on any run of whitespace, dropping empty pieces. `strings.Fields("  a  b\tc ")` is `["a" "b" "c"]`.
- [`strings.FieldsFunc(s, f) []string`](https://pkg.go.dev/strings#FieldsFunc) — splits wherever `f(r)` is true for a rune, dropping empty pieces. With `f := func(r rune) bool { return r == '-' }`, `strings.FieldsFunc("a1-b2--c", f)` is `["a1" "b2" "c"]`.
- [`strings.Split(s, sep) []string`](https://pkg.go.dev/strings#Split) — splits on an exact separator, keeping empty pieces. `strings.Split("a,b,,c", ",")` is `["a" "b" "" "c"]`, and `strings.Split("", ",")` is `[""]`: one empty string, not zero.
- [`strings.Join(parts, sep) string`](https://pkg.go.dev/strings#Join) — the inverse of `Split`. `strings.Join([]string{"a", "b"}, "-")` is `"a-b"`.
- [`strings.Cut(s, sep) (before, after string, found bool)`](https://pkg.go.dev/strings#Cut) — splits once, at the **first** separator. `strings.Cut("k=v=w", "=")` is `"k", "v=w", true`.
- [`strings.Contains(s, sub) bool`](https://pkg.go.dev/strings#Contains) — `strings.Contains("seafood", "foo")` is `true`.
- [`strings.HasPrefix(s, p) bool`](https://pkg.go.dev/strings#HasPrefix) / [`HasSuffix`](https://pkg.go.dev/strings#HasSuffix) — `strings.HasPrefix("# note", "#")` is `true`.
- [`strings.Index(s, sub) int`](https://pkg.go.dev/strings#Index) — byte offset of the first match, or `-1`. `strings.Index("chicken", "ken")` is `4`.
- [`strings.ReplaceAll(s, old, new) string`](https://pkg.go.dev/strings#ReplaceAll) — `strings.ReplaceAll("a-b-c", "-", "+")` is `"a+b+c"`.
- [`strings.Repeat(s, n) string`](https://pkg.go.dev/strings#Repeat) — `strings.Repeat("ab", 3)` is `"ababab"`.
- [`strings.EqualFold(a, b) bool`](https://pkg.go.dev/strings#EqualFold) — case-insensitive equality. `strings.EqualFold("Go", "GO")` is `true`.
- [`strings.Builder`](https://pkg.go.dev/strings#Builder) — appends into a growing buffer, so building a string in a loop stays linear. The zero value is ready to use.

```go
var sb strings.Builder
sb.WriteString("n=")
sb.WriteRune('π')
fmt.Fprintf(&sb, " %d", 3)
sb.String() // "n=π 3"
```

- [`strings.NewReader(s) *strings.Reader`](https://pkg.go.dev/strings#NewReader) — turns a string into an `io.Reader`, which is how you feed a `bufio.Scanner` in a test.

## strconv

`import "strconv"`. `fmt` is for display; `strconv` converts precisely and reports errors.

- [`strconv.Atoi(s) (int, error)`](https://pkg.go.dev/strconv#Atoi) — string to int. `strconv.Atoi("42")` is `42, nil`. It does **not** skip spaces: `strconv.Atoi(" 5")` fails, so trim first.
- [`strconv.Itoa(n) string`](https://pkg.go.dev/strconv#Itoa) — int to its digits. `strconv.Itoa(42)` is `"42"`. Note `string(42)` is *not* `"42"`; it is the character with code point 42.
- [`strconv.ParseFloat(s, 64) (float64, error)`](https://pkg.go.dev/strconv#ParseFloat) — `strconv.ParseFloat("2.5", 64)` is `2.5, nil`.
- [`strconv.ParseBool(s) (bool, error)`](https://pkg.go.dev/strconv#ParseBool) — accepts `1`, `t`, `T`, `true`, `TRUE`, `True` and their false counterparts. `strconv.ParseBool("true")` is `true, nil`.
- [`strconv.FormatInt(n, base) string`](https://pkg.go.dev/strconv#FormatInt) — `strconv.FormatInt(255, 16)` is `"ff"`.
- [`strconv.Quote(s) string`](https://pkg.go.dev/strconv#Quote) — wraps a string in quotes and escapes it, the way Go source would. `strconv.Quote("hi\n")` is six characters long: a quote, `h`, `i`, a backslash, `n`, a quote. The `%q` verb does the same inside a format string.
- [`strconv.ErrSyntax`](https://pkg.go.dev/strconv#pkg-variables) — the sentinel every parse error wraps. `errors.Is(err, strconv.ErrSyntax)` is `true` for the error from `strconv.Atoi("4x")`, whose message is `strconv.Atoi: parsing "4x": invalid syntax`.

## slices, maps and cmp

`import "slices"`, `"maps"`, `"cmp"`. Generic helpers (Go 1.21+) that replace most hand-written loops. `slices.Sort`, `Reverse` and `Compact` work **in place**, so clone first if the caller's slice must stay untouched.

- [`slices.Sort(s)`](https://pkg.go.dev/slices#Sort) — sorts ascending, in place. `[3 1 2]` becomes `[1 2 3]`.
- [`slices.SortFunc(s, cmp)`](https://pkg.go.dev/slices#SortFunc) — sorts with your comparison, which returns negative, zero or positive. Sorting `["pear" "fig" "banana"]` with `func(a, b string) int { return cmp.Compare(len(a), len(b)) }` gives `["fig" "pear" "banana"]`. [`slices.SortStableFunc`](https://pkg.go.dev/slices#SortStableFunc) keeps equal elements in their original order.
- [`slices.Contains(s, v) bool`](https://pkg.go.dev/slices#Contains) — `slices.Contains([]int{1, 2, 3}, 2)` is `true`.
- [`slices.Index(s, v) int`](https://pkg.go.dev/slices#Index) — position, or `-1`. `slices.Index([]int{1, 2, 3}, 3)` is `2`.
- [`slices.Reverse(s)`](https://pkg.go.dev/slices#Reverse) — reverses in place. `[1 2 3]` becomes `[3 2 1]`.
- [`slices.Clone(s) []T`](https://pkg.go.dev/slices#Clone) — an independent copy, so sorting it leaves the original alone.
- [`slices.Equal(a, b) bool`](https://pkg.go.dev/slices#Equal) — element-wise comparison; slices cannot be compared with `==`. `slices.Equal([]int{1, 2}, []int{1, 2})` is `true`.
- [`slices.Compact(s) []T`](https://pkg.go.dev/slices#Compact) — drops **consecutive** duplicates and returns the shorter slice, so sort first. `slices.Compact([]int{1, 1, 2, 2, 2, 3})` is `[1 2 3]`.
- [`slices.Max(s)`](https://pkg.go.dev/slices#Max) / [`slices.Min(s)`](https://pkg.go.dev/slices#Min) — panic on an empty slice. `slices.Max([]int{1, 2, 3})` is `3`.
- [`slices.Delete(s, i, j) []T`](https://pkg.go.dev/slices#Delete) — removes `s[i:j]`, returns the shorter slice. `slices.Delete([]int{1, 2, 3, 4}, 1, 3)` is `[1 4]`.
- [`slices.Insert(s, i, vals...) []T`](https://pkg.go.dev/slices#Insert) — `slices.Insert([]int{1, 4}, 1, 2, 3)` is `[1 2 3 4]`.
- [`slices.Sorted(seq) []T`](https://pkg.go.dev/slices#Sorted) — collects an iterator into a sorted slice. With `ages := map[string]int{"bob": 30, "ada": 36}`, `slices.Sorted(maps.Keys(ages))` is `["ada" "bob"]`.
- [`maps.Keys(m)`](https://pkg.go.dev/maps#Keys) / [`maps.Values(m)`](https://pkg.go.dev/maps#Values) — iterators, not slices, which is why they are usually wrapped in `slices.Sorted` or `slices.Collect`.
- [`maps.Clone(m)`](https://pkg.go.dev/maps#Clone) — a shallow copy. Assigning a map does not copy it.
- [`cmp.Compare(x, y) int`](https://pkg.go.dev/cmp#Compare) — `-1`, `0` or `1`. `cmp.Compare(1, 2)` is `-1`, `cmp.Compare(2, 2)` is `0`.
- [`cmp.Or(vals...)`](https://pkg.go.dev/cmp#Or) — the first non-zero argument, which makes a multi-key sort one line. `cmp.Or(0, 0, -3, 5)` is `-3`.

## fmt and io

`import "fmt"`, `"io"`.

- [`fmt.Println(a...)`](https://pkg.go.dev/fmt#Println) — prints its arguments separated by spaces, then a newline.
- [`fmt.Printf(format, a...)`](https://pkg.go.dev/fmt#Printf) — prints with verbs; no newline unless you write `\n`.
- [`fmt.Sprintf(format, a...) string`](https://pkg.go.dev/fmt#Sprintf) — returns the string instead of printing. `fmt.Sprintf("%.2f", 6.666)` is `"6.67"`.
- [`fmt.Fprintf(w, format, a...) (int, error)`](https://pkg.go.dev/fmt#Fprintf) — writes to any `io.Writer`, including a `*strings.Builder`. `fmt.Fprintf(&b, "%s-%d", "go", 26)` writes `go-26` and returns `5`.
- [`fmt.Errorf(format, a...) error`](https://pkg.go.dev/fmt#Errorf) — builds an error; `%w` wraps a cause.
- [`io.WriteString(w, s) (int, error)`](https://pkg.go.dev/io#WriteString) — writes a string to a writer without converting to `[]byte` yourself. On a `*strings.Builder`, `io.WriteString(&w, "hi")` returns `2, nil` and leaves `"hi"` in the builder.
- [`io.Writer`](https://pkg.go.dev/io#Writer) — the one-method interface `Write(p []byte) (n int, err error)`. Files, network connections, `strings.Builder` and `bytes.Buffer` all satisfy it.

Verbs:

| verb | prints | example |
| --- | --- | --- |
| `%v` | the default format | `fmt.Sprintf("%v", user{"Ada", 36})` is `{Ada 36}` |
| `%+v` | structs with field names | `{Name:Ada Age:36}` |
| `%#v` | Go syntax | `main.user{Name:"Ada", Age:36}` |
| `%T` | the type | `fmt.Sprintf("%T", 3.5)` is `float64` |
| `%d` | an integer | `42` |
| `%s` | a string | `go` |
| `%q` | a quoted string | `fmt.Sprintf("%q", "hi")` is `"hi"`, quotes included |
| `%t` | a bool | `true` |
| `%f`, `%.2f` | a float, with N decimals | `6.67` (it rounds) |
| `%x`, `%b` | hex, binary | `fmt.Sprintf("%x %b", 255, 5)` is `ff 101` |
| `%c`, `%U` | a rune as a character, as a code point | `é`, `U+00E9` |
| `%-6s`, `%5d`, `%03d` | left-padded, right-padded, zero-padded | `fmt.Sprintf("%-6s|%5d|%03d", "go", 42, 7)` is `go    \|   42\|007` |
| `%w` | wraps an error (`fmt.Errorf` only) | see below |

## errors

`import "errors"`. An `error` is any value with an `Error() string` method; `nil` means success.

- [`errors.New(text) error`](https://pkg.go.dev/errors#New) — a fixed-message error. Package-level ones are sentinels, named `ErrSomething`. `errors.New("not found")`.
- [`fmt.Errorf("...: %w", err)`](https://pkg.go.dev/fmt#Errorf) — adds context and keeps the cause reachable. `fmt.Errorf("user %d: %w", 7, errNotFound)` has the message `user 7: not found`.
- [`errors.Is(err, target) bool`](https://pkg.go.dev/errors#Is) — walks the wrap chain looking for that exact error value. For the wrapped error above, `errors.Is(err, errNotFound)` is `true` while `err == errNotFound` is `false`. Always use `errors.Is`, never `==` and never a comparison of `Error()` strings.
- [`errors.As(err, &target) bool`](https://pkg.go.dev/errors#As) — walks the chain for an error of a particular *type* and fills your variable. After `_, err := strconv.Atoi("x")`, `var ne *strconv.NumError; errors.As(err, &ne)` is `true` and `ne.Num` is `"x"`. It needs a pointer to your variable.
- [`errors.Join(errs...) error`](https://pkg.go.dev/errors#Join) — combines several errors, skipping `nil`s, and returns `nil` when nothing is left. `errors.Join(errors.New("a"), nil, errors.New("b")).Error()` is `"a\nb"` — one error per line. `errors.Is` still finds any of them.

## time

`import "time"`. A [`time.Duration`](https://pkg.go.dev/time#Duration) is an `int64` of nanoseconds, so you write it by multiplying a constant: `2 * time.Second`, `50 * time.Millisecond`.

- [`time.Sleep(d)`](https://pkg.go.dev/time#Sleep) — pauses the current goroutine for at least `d`. `time.Sleep(20 * time.Millisecond)`. Other goroutines keep running.
- [`time.Now() time.Time`](https://pkg.go.dev/time#Now) — the current time.
- [`time.Since(t) time.Duration`](https://pkg.go.dev/time#Since) — how long since `t`; short for `time.Now().Sub(t)`. After `start := time.Now()` and a 20 ms sleep, `time.Since(start) >= 20*time.Millisecond` is `true`.
- [`time.After(d) <-chan Time`](https://pkg.go.dev/time#After) — a channel that receives once, after `d`. Its whole purpose is to bound a wait inside a `select`.
- [`time.Duration(n)`](https://pkg.go.dev/time#Duration) — converts a number of nanoseconds; `time.Duration(3) * time.Second` is three seconds. `(90 * time.Minute).String()` is `"1h30m0s"`, and `(1500 * time.Millisecond).Seconds()` is `1.5`.
- [`t.Format(layout) string`](https://pkg.go.dev/time#Time.Format) — layouts are written as the reference time *Mon Jan 2 15:04:05 MST 2006* would look. For `time.Date(2026, time.March, 5, 14, 30, 0, 0, time.UTC)`, `t.Format("2006-01-02 15:04")` is `"2026-03-05 14:30"` and `t.Format(time.RFC3339)` is `"2026-03-05T14:30:00Z"`.
- [`time.Parse(layout, s) (Time, error)`](https://pkg.go.dev/time#Parse) — the inverse, and it rejects impossible dates. `time.Parse("2006-01-02", "2026-12-25")` gives that date and `nil`.
- [`t.Add(d)`](https://pkg.go.dev/time#Time.Add) / [`t.Sub(u)`](https://pkg.go.dev/time#Time.Sub) — shift a time, and get the duration between two. `t.Add(90 * time.Minute).Sub(t)` is `90m0s`.
- [`t.AddDate(y, m, d)`](https://pkg.go.dev/time#Time.AddDate) — calendar arithmetic, month ends and leap years handled. `t.AddDate(0, 0, 1)` on 2026-03-05 gives 2026-03-06.
- [`t.Before(u)`](https://pkg.go.dev/time#Time.Before) / [`t.After(u)`](https://pkg.go.dev/time#Time.After) / [`t.Equal(u)`](https://pkg.go.dev/time#Time.Equal) — compare times with these, not with `==`.

## sync and sync/atomic

`import "sync"`, `"sync/atomic"`. Every zero value here is ready to use, and none of them may be copied once used — so put them in a struct and give it pointer receivers.

- [`sync.Mutex`](https://pkg.go.dev/sync#Mutex) — `mu.Lock()` … `mu.Unlock()` around the shared data. The `defer mu.Unlock()` right after the `Lock` is the habit, because it unlocks on every way out.
- [`sync.RWMutex`](https://pkg.go.dev/sync#RWMutex) — many `RLock` readers at once, or one `Lock` writer.
- [`sync.WaitGroup`](https://pkg.go.dev/sync#WaitGroup) — waits for a group of goroutines. [`wg.Go(f)`](https://pkg.go.dev/sync#WaitGroup.Go) (Go 1.25+) starts `f` in a goroutine and tracks it; `wg.Wait()` blocks until all of them return. Older code writes `wg.Add(1)` then `go func() { defer wg.Done(); ... }()`.

```go
var mu sync.Mutex
var wg sync.WaitGroup
total := 0
for range 100 {
	wg.Go(func() {
		mu.Lock()
		defer mu.Unlock()
		total++
	})
}
wg.Wait() // total is 100
```

- [`sync.Once`](https://pkg.go.dev/sync#Once) — `once.Do(f)` runs `f` exactly once however many goroutines call it; the rest wait for it to finish. Calling `once.Do` three times with a function that increments a counter leaves the counter at `1`.
- [`sync.OnceValue(f)`](https://pkg.go.dev/sync#OnceValue) — wraps `f` so its result is computed once and cached.
- [`atomic.Int32`](https://pkg.go.dev/sync/atomic#Int32), [`atomic.Int64`](https://pkg.go.dev/sync/atomic#Int64), [`atomic.Bool`](https://pkg.go.dev/sync/atomic#Bool) — a single counter or flag several goroutines can touch, with no mutex. The zero value is `0` / `false`.
  - `.Add(n)` adds and returns the **new** value: on a fresh `atomic.Int32`, `c.Add(1)` returns `1`. `c.Add(-1)` subtracts.
  - `.Load()` reads the current value, `.Store(v)` writes it. After `c.Store(5)`, `c.Load()` is `5`.
  - `.CompareAndSwap(old, new) bool` sets the value to `new` only if it is still `old`, and reports whether it did. With `c` at `5`, `c.CompareAndSwap(5, 9)` is `true` and leaves `9`; a following `c.CompareAndSwap(5, 11)` is `false` and changes nothing. A `for` loop around a failing CAS is how you do read-modify-write without a lock — that is what the "highest number of workers seen at once" helpers in these tests are doing.

## encoding/json

`import "encoding/json"`. Only exported (capitalized) fields are encoded; a struct tag changes the key, never the visibility.

```go
type Item struct {
	Name  string   `json:"name"`
	Price float64  `json:"price"`
	Tags  []string `json:"tags,omitempty"` // left out when empty
	Admin bool     `json:"-"`              // never encoded
}
```

- [`json.Marshal(v) ([]byte, error)`](https://pkg.go.dev/encoding/json#Marshal) — encodes. `json.Marshal(Item{Name: "pen", Price: 1.5, Admin: true})` is `{"name":"pen","price":1.5}`.
- [`json.Unmarshal(data, &v) error`](https://pkg.go.dev/encoding/json#Unmarshal) — decodes into the variable you pass the address of. Unknown keys are ignored: decoding `{"name":"tape","price":2,"extra":1}` into an `Item` gives `Name` `"tape"` and `Price` `2`.
- [`json.MarshalIndent(v, prefix, indent)`](https://pkg.go.dev/encoding/json#MarshalIndent) — pretty-prints. `json.MarshalIndent(map[string]int{"a": 1}, "", "  ")` is `{`, then `  "a": 1`, then `}`.
- Decoding into `any` gives `map[string]any`, `[]any`, `string`, `bool`, `nil` — and **`float64` for every number**. After decoding `{"n": 3}` into a `map[string]any`, the value is `3.0`, not `3`.
