# Standard library tour

Go's standard library covers most everyday work: text, numbers, sorting, time, JSON, I/O. Knowing a dozen packages well removes most reasons to reach for a dependency.

## `strings`

```go
strings.Fields("  a b\tc ")               // ["a" "b" "c"]: split on any whitespace
strings.Split("a,b,,c", ",")               // ["a" "b" "" "c"]
before, after, ok := strings.Cut("k=v", "=") // "k" "v" true
strings.TrimSpace("  hi\n")                // "hi"
strings.TrimPrefix("v1.2", "v")            // "1.2"
strings.HasPrefix("# note", "#")           // true; HasSuffix checks the end
strings.ToLower("Go GO")                   // "go go"; ToUpper goes the other way
strings.EqualFold("Go", "GO")              // true: case-insensitive compare
strings.ReplaceAll("a-b-c", "-", "+")      // "a+b+c"
strings.Repeat("ab", 3)                    // "ababab"
```

Strings are immutable, so building one with `+=` in a loop copies every time. Use a `strings.Builder`:

```go
var sb strings.Builder
for i := range 3 {
	fmt.Fprintf(&sb, "line %d\n", i)
}
sb.String()
```

`&sb` passes the builder's address, so `Fprintf` appends to your `sb` rather than to a copy. `sb.WriteString(s)` and `sb.WriteRune(r)` add text directly.

## `strconv`

`fmt` is for display; `strconv` converts between strings and numbers precisely and reports errors.

```go
n, err := strconv.Atoi("42")              // string -> int
f, err := strconv.ParseFloat("2.5", 64)   // string -> float64
b, err := strconv.ParseBool("true")
s := strconv.Itoa(42)                     // int -> string
s = strconv.FormatInt(255, 16)            // "ff"
s = strconv.Quote("tab\there")            // "\"tab\\there\""
```

`string(65)` is `"A"`, the rune with that code point, not `"65"`. `go vet` warns about it. Use `strconv.Itoa`.

## `slices`, `maps` and `sort`

```go
nums := []int{3, 1, 2}
slices.Sort(nums)                          // [1 2 3], in place
slices.Contains(nums, 2)                   // true
i, found := slices.BinarySearch(nums, 3)   // 2 true
slices.Reverse(nums)
slices.Max(nums)                           // 3; panics on an empty slice

words := []string{"banana", "kiwi", "apple"}
slices.SortFunc(words, func(a, b string) int {
	return cmp.Or(cmp.Compare(len(a), len(b)), strings.Compare(a, b)) // by length, then alphabetically
})

ages := map[string]int{"bob": 30, "ada": 36}
keys := slices.Sorted(maps.Keys(ages))     // ["ada" "bob"]: map order is random
```

A comparison function returns negative, zero or positive. `cmp.Or` returns its first non-zero argument, which makes multi-key sorts one line. `slices.SortStableFunc` keeps equal elements in their original order. The older `sort` package (`sort.Ints`, `sort.Slice`) is still everywhere in existing code.

## `time`

Go formats times with a *reference time* instead of `%Y-%m-%d` codes: Monday, January 2, 2006 at 15:04:05 in zone MST. Write the layout the way that moment should look.

```go
t := time.Date(2026, time.March, 5, 14, 30, 0, 0, time.UTC)
t.Format("2006-01-02")              // "2026-03-05"
t.Format("Mon Jan 2, 3:04 PM")      // "Thu Mar 5, 2:30 PM"
t.Format(time.RFC3339)              // "2026-03-05T14:30:00Z"

d, err := time.Parse("2006-01-02", "2026-12-25")
t.AddDate(0, 1, 0)                  // one month later
later := t.Add(90 * time.Minute)
later.Sub(t)                        // 1h30m0s, a time.Duration
t.Before(later)                     // true; compare with Equal, not ==
```

The numbers are fixed: `01` is the month, `02` the day, `15` the 24-hour hour, `2006` the year. `time.Duration` is an `int64` of nanoseconds that prints nicely.

The clock and the stopwatch are three more calls. You write a duration by multiplying a constant, never as a bare number of nanoseconds:

```go
start := time.Now()             // the current time
time.Sleep(50 * time.Millisecond) // pause this goroutine; others keep running
time.Since(start)                 // 50ms or a little more: short for time.Now().Sub(start)

2 * time.Second                 // also Nanosecond, Microsecond, Millisecond, Minute, Hour
time.Duration(n) * time.Second  // when n is a variable: convert, then multiply
(90 * time.Minute).String()     // "1h30m0s"
(1500 * time.Millisecond).Seconds() // 1.5
```

`time.Sleep` is fine in tests and demos. In real code, waiting on a channel or a context beats sleeping a guessed amount of time.

## `encoding/json`

JSON maps onto structs, types made of named fields: `User{Name: "Ada"}` builds one, and fields you leave out get their zero value. Struct tags, the backquoted strings after a field, set the JSON key and options. Only exported (capitalized) fields are encoded.

```go
type User struct {
	Name   string   `json:"name"`
	Email  string   `json:"email,omitempty"` // left out when empty
	Admin  bool     `json:"-"`               // never encoded
	Groups []string `json:"groups"`
}

data, err := json.Marshal(User{Name: "Ada", Groups: []string{"dev"}})
// {"name":"Ada","groups":["dev"]}

var u User
err = json.Unmarshal([]byte(`{"name":"Grace","extra":1}`), &u) // unknown keys are ignored
```

`Unmarshal` takes a pointer, `&u`, the address of your variable, so it can fill it in; the decoded fields are then read as `u.Name`. Decoding into `any` gives `map[string]any`, `[]any`, `string`, `bool`, `nil` and, for every number, `float64`. `json.MarshalIndent` pretty-prints.

## `bufio.Scanner`

`bufio.Scanner` reads input line by line from any reader: a file, stdin, or a string via `strings.NewReader`.

```go
sc := bufio.NewScanner(strings.NewReader("one\ntwo\nthree"))
for sc.Scan() {
	fmt.Println(sc.Text()) // the line, without the newline
}
if err := sc.Err(); err != nil {
	return err
}
```

`sc.Split(bufio.ScanWords)` switches it to words. Lines longer than 64 KB need `sc.Buffer` to raise the limit.

## `fmt` verbs

| verb | prints | example |
| --- | --- | --- |
| `%v` | default format | `{Ada 36}` |
| `%+v` | structs with field names | `{Name:Ada Age:36}` |
| `%#v` | Go syntax | `main.User{Name:"Ada", Age:36}` |
| `%T` | the type | `main.User` |
| `%q` | quoted string | `"hi\n"` |
| `%x` | hex | `ff` |
| `%6.2f` | width 6, 2 decimals | `  3.14` |
| `%-8s` / `%8s` | left / right aligned | `ab      ` |
| `%03d` | zero padded | `007` |

`fmt.Sprintf` returns the string, `fmt.Fprintf` writes to any writer, and `fmt.Errorf` builds errors.

```go playground
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"
)

type Entry struct {
	Level string    `json:"level"`
	When  time.Time `json:"when"`
}

const log = `INFO start
WARN disk 80%
INFO tick
ERROR disk full`

func main() {
	counts := map[string]int{}
	sc := bufio.NewScanner(strings.NewReader(log))
	for sc.Scan() {
		level, _, _ := strings.Cut(sc.Text(), " ")
		counts[level]++
	}
	for _, level := range slices.Sorted(maps.Keys(counts)) {
		fmt.Printf("%-6s %2d\n", level, counts[level])
	}

	e := Entry{Level: "WARN", When: time.Date(2026, 3, 5, 14, 30, 0, 0, time.UTC)}
	data, _ := json.Marshal(e)
	fmt.Println(string(data))
	fmt.Println(e.When.Format("Monday 2 January 2006, 15:04"))
	fmt.Printf("%+v\n", e)
}

// Try: change the date layout to "Jan 2 '06 at 3pm".
```

## Exercises

### 1. Parse key=value pairs

`ParseKV("a=1, b=2,c = 3")` returns `map[string]int{"a": 1, "b": 2, "c": 3}`. Split on commas, `strings.Cut` each pair on `=`, trim spaces around keys and values, and convert values with `strconv.Atoi`.

- An empty (or all-space) input returns an empty map and no error.
- A pair without `=` returns an error: `pair "x": missing =`.
- A bad number wraps the `Atoi` error: `pair "b=two": strconv.Atoi: parsing "two": invalid syntax`.

```go starter
package main

func ParseKV(s string) (map[string]int, error) {
	return nil, nil // TODO
}
```

```go test
package main

import (
	"errors"
	"strconv"
	"testing"
)

// parses pairs and trims spaces
func TestParseKV(t *testing.T) {
	m, err := ParseKV("a=1, b=2,c = 3")
	expect(t, m, map[string]int{"a": 1, "b": 2, "c": 3})
	expect(t, err, nil)
	m, _ = ParseKV("x=-7")
	expect(t, m, map[string]int{"x": -7})
	m, _ = ParseKV("  total =  42 ,n=0")
	expect(t, m, map[string]int{"total": 42, "n": 0})
}

// empty input is an empty map
func TestParseKVEmpty(t *testing.T) {
	m, err := ParseKV("  ")
	expect(t, err, nil)
	if m == nil || len(m) != 0 {
		t.Fatalf("want an empty, non-nil map, got %#v", m)
	}
}

// reports a missing = and bad numbers
func TestParseKVErrors(t *testing.T) {
	_, err := ParseKV("a=1, x")
	if err == nil {
		t.Fatal("want an error for a pair without =")
	}
	expect(t, err.Error(), `pair "x": missing =`)
	_, err = ParseKV(" key only , a=1")
	if err == nil {
		t.Fatal("want an error for a pair without =")
	}
	expect(t, err.Error(), `pair "key only": missing =`)
	_, err = ParseKV("a=1,b=two")
	if !errors.Is(err, strconv.ErrSyntax) {
		t.Fatalf("want an error wrapping strconv.ErrSyntax, got %v", err)
	}
	expect(t, err.Error(), `pair "b=two": strconv.Atoi: parsing "two": invalid syntax`)
	_, err = ParseKV("c=3.5")
	if !errors.Is(err, strconv.ErrSyntax) {
		t.Fatalf("want an error wrapping strconv.ErrSyntax, got %v", err)
	}
	expect(t, err.Error(), `pair "c=3.5": strconv.Atoi: parsing "3.5": invalid syntax`)
}
```

#### Uses
- [Standard library tour › `strings`](#/stdlib/strings)
- [Standard library tour › `strconv`](#/stdlib/strconv)
- [Maps › Creating and using maps](#/maps/creating-and-using-maps)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- Handle the empty case first: if `strings.TrimSpace(s)` is `""`, return an empty map, not `nil`.
- Loop over `strings.Split(s, ",")`, trim each pair, then `strings.Cut(pair, "=")`. A `false` third result means there was no `=`.
- Trim the key and the value separately before `strconv.Atoi`: `" 3"` doesn't parse.

#### Tips
- Put the trimmed pair in error messages, so they read `pair "x"` without stray spaces.
- An empty result must be a real empty map, not `nil`: the test rejects `nil` on purpose. `map[string]int{}` or `make(...)`, never `var m map[string]int`.

#### Docs
- [strings.Split](https://pkg.go.dev/strings#Split)
- [strings.Cut](https://pkg.go.dev/strings#Cut)

### 2. Dates and durations

`ShiftDate(date, days)` parses a `YYYY-MM-DD` date, moves it by `days` (negative goes back), and formats it like `Thu, Feb 29 2024`. Invalid dates return the error from `time.Parse`.

`Between(a, b)` parses two RFC 3339 timestamps (`time.RFC3339`) and returns how long after `a` the time `b` is, as a `time.Duration`.

```go starter
package main

import "time"

func ShiftDate(date string, days int) (string, error) {
	return "", nil // TODO
}

func Between(a, b string) (time.Duration, error) {
	return 0, nil // TODO
}
```

```go test
package main

import (
	"testing"
	"time"
)

// moves across month, year and leap day
func TestShiftDate(t *testing.T) {
	tests := []struct {
		date string
		days int
		want string
	}{
		{"2024-02-28", 1, "Thu, Feb 29 2024"},
		{"2023-12-31", 1, "Mon, Jan 1 2024"},
		{"2024-03-01", -1, "Thu, Feb 29 2024"},
		{"2026-01-15", 30, "Sat, Feb 14 2026"},
		{"2024-07-04", 0, "Thu, Jul 4 2024"},
		{"2024-01-01", -365, "Sun, Jan 1 2023"},
	}
	for _, tt := range tests {
		got, err := ShiftDate(tt.date, tt.days)
		if err != nil || got != tt.want {
			t.Errorf("ShiftDate(%q, %d) = %q, %v; want %q", tt.date, tt.days, got, err, tt.want)
		}
	}
}

// rejects invalid dates
func TestShiftDateInvalid(t *testing.T) {
	for _, bad := range []string{"2024-13-01", "2024-02-30", "yesterday"} {
		if _, err := ShiftDate(bad, 1); err == nil {
			t.Errorf("ShiftDate(%q): want an error", bad)
		}
	}
}

// measures durations, across time zones
func TestBetween(t *testing.T) {
	d, err := Between("2026-01-01T09:00:00Z", "2026-01-01T17:30:00Z")
	expect(t, d, 8*time.Hour+30*time.Minute)
	expect(t, err, nil)
	d, _ = Between("2026-01-01T12:00:00+02:00", "2026-01-01T12:00:00Z")
	expect(t, d, 2*time.Hour)
	d, _ = Between("2026-03-01T00:00:10Z", "2026-02-28T23:59:55Z")
	expect(t, d, -15*time.Second) // b before a
	if _, err := Between("noon", "2026-01-01T12:00:00Z"); err == nil {
		t.Error("want an error for a bad first timestamp")
	}
	if _, err := Between("2026-01-01T12:00:00Z", "tomorrow"); err == nil {
		t.Error("want an error for a bad second timestamp")
	}
}
```

#### Uses
- [Standard library tour › `time`](#/stdlib/time)
- [Errors › Errors are values](#/errors/errors-are-values)

#### Hints
- Layouts are the reference time written in your format: `"2006-01-02"` parses the input. For the output, write how Monday, January 2, 2006 would look in the `Thu, Feb 29 2024` shape.
- `t.AddDate(0, 0, days)` moves by whole days and takes care of month ends and leap years.
- `Between` parses both strings with `time.RFC3339` as the layout and subtracts with `Sub`.

#### Tips
- `time.Parse` rejects impossible dates such as `2024-02-30`, so validation comes for free.
- `b.Sub(a)` is `b` minus `a`, so a `b` that comes first gives a negative duration. That is the third case in the test, not an error to guard against.
- `AddDate(0, 0, days)` is calendar arithmetic. Adding `days * 24 * time.Hour` instead would drift across a daylight-saving change.

#### Docs
- [time.Time.Format](https://pkg.go.dev/time#Time.Format)
- [time.Parse](https://pkg.go.dev/time#Parse)

### 3. JSON with struct tags

A struct is a record type with named fields; `Item{Name: "pen", Price: 1.5}` builds one, and `it.Price` reads a field of an `Item` called `it`. `encoding/json` uses the field names as keys unless a tag says otherwise.

Add struct tags so an `Item` encodes as `{"name":"pen","price":1.5}`, with a `"tags"` key that is left out when there are no tags. Then write `Total(data)`, which decodes a JSON array of items and returns the sum of their prices, or the decoding error.

```go starter
package main

type Item struct {
	Name  string
	Price float64
	Tags  []string
}

func Total(data []byte) (float64, error) {
	return 0, nil // TODO: json.Unmarshal into a []Item
}
```

```go test
package main

import (
	"encoding/json"
	"testing"
)

// encodes with lowercase keys
func TestItemJSON(t *testing.T) {
	data, err := json.Marshal(Item{Name: "pen", Price: 1.5})
	expect(t, err, nil)
	expect(t, string(data), `{"name":"pen","price":1.5}`)
	data, _ = json.Marshal(Item{Name: "tape", Price: 2, Tags: []string{"office"}})
	expect(t, string(data), `{"name":"tape","price":2,"tags":["office"]}`)
	data, _ = json.Marshal(Item{Name: "gift", Tags: []string{}})
	expect(t, string(data), `{"name":"gift","price":0}`) // only tags is left out
}

// decodes and sums prices
func TestTotal(t *testing.T) {
	sum, err := Total([]byte(`[{"name":"a","price":2.5},{"name":"b","price":1,"tags":["x"]}]`))
	expect(t, sum, 3.5)
	expect(t, err, nil)
	sum, _ = Total([]byte(`[]`))
	expect(t, sum, 0.0)
	sum, _ = Total([]byte(`[{"name":"x","price":0.25},{"name":"y","price":0.5},{"name":"z","price":10}]`))
	expect(t, sum, 10.75)
}

// returns decoding errors
func TestTotalInvalid(t *testing.T) {
	if _, err := Total([]byte(`[{"name":"a","price":"free"}]`)); err == nil {
		t.Error("want an error for a string price")
	}
	if _, err := Total([]byte(`not json`)); err == nil {
		t.Error("want an error for invalid JSON")
	}
}
```

#### Uses
- [Standard library tour › `encoding/json`](#/stdlib/encoding-json)
- [Control flow › for, in all its forms](#/control-flow/for-in-all-its-forms)
- [Errors › Errors are values](#/errors/errors-are-values)

#### Hints
- Tags go in backquotes after each field's type, like `` `json:"name"` ``. The `Tags` field also needs `omitempty`.
- In `Total`, declare `var items []Item` and pass `&items` to `json.Unmarshal`. Return its error if there is one.
- Then add up `it.Price` in a `range` loop over `items`.

#### Tips
- `encoding/json` only sees exported (capitalized) fields. The tag changes the JSON key, never whether the field is visible.
- Only `Tags` gets `omitempty`. On `Price` it would make a price of `0` disappear from the output, which the third case of the first test would catch.

#### Docs
- [encoding/json.Marshal](https://pkg.go.dev/encoding/json#Marshal)
- [encoding/json.Unmarshal](https://pkg.go.dev/encoding/json#Unmarshal)

### 4. Scan a log and print a report

`LevelCounts(log)` reads `log` line by line with a `bufio.Scanner` over `strings.NewReader(log)`. It skips blank lines and lines starting with `#`, and counts the first word of every other line.

`Report(counts)` formats the counts one per line, sorted by level: the level left-aligned in 6 columns, then the count right-aligned in 3 (`"%-6s%3d\n"`).

```go starter
package main

func LevelCounts(log string) map[string]int {
	return nil // TODO
}

func Report(counts map[string]int) string {
	return "" // TODO
}
```

```go test
package main

import "testing"

const sampleLogForTest = `# service log
INFO started

WARN slow request
INFO tick
ERROR disk full
INFO tick
   
WARN retry`

// counts levels, skipping blanks and comments
func TestLevelCounts(t *testing.T) {
	expect(t, LevelCounts(sampleLogForTest), map[string]int{"INFO": 3, "WARN": 2, "ERROR": 1})
	expect(t, len(LevelCounts("")), 0)
	expect(t, len(LevelCounts("# only a comment\n\n")), 0)
}

// the first word counts even when indented or alone on its line
func TestLevelCountsWords(t *testing.T) {
	log := "  DEBUG indented\nDEBUG\n#INFO not counted\r\nFATAL bye\r\n"
	expect(t, LevelCounts(log), map[string]int{"DEBUG": 2, "FATAL": 1})
}

// formats a sorted, aligned report
func TestReport(t *testing.T) {
	got := Report(map[string]int{"WARN": 2, "INFO": 13, "ERROR": 1})
	expect(t, got, "ERROR   1\nINFO   13\nWARN    2\n")
	expect(t, Report(nil), "")
	expect(t, Report(map[string]int{"DEBUG": 100}), "DEBUG 100\n")
	got = Report(map[string]int{"e": 5, "b": 2, "d": 4, "a": 1, "f": 6, "c": 3})
	expect(t, got, "a       1\nb       2\nc       3\nd       4\ne       5\nf       6\n")
}
```

#### Uses
- [Standard library tour › `bufio.Scanner`](#/stdlib/bufio-scanner)
- [Standard library tour › `strings`](#/stdlib/strings)
- [Maps › Iteration order is random](#/maps/iteration-order-is-random)
- [Standard library tour › `fmt` verbs](#/stdlib/fmt-verbs)

#### Hints
- `strings.Fields(sc.Text())` splits a line into words and returns an empty slice for blank or all-space lines. `continue` past those, and past lines whose first word passes `strings.HasPrefix(word, "#")`.
- The level is the first word; count it in a map with `counts[level]++`.
- For `Report`, loop over `slices.Sorted(maps.Keys(counts))` and `fmt.Fprintf` each line into a `strings.Builder`.

#### Tips
- `sc.Text()` has no line ending, and the default line splitter also drops a `\r`, so Windows-style logs work too.
- `strings.Fields` returns no words for a blank line *and* for an all-spaces line, so one `len(words) == 0` check covers both.
- `Report` sorts the keys because map order is random. Without the sort it would pass locally and fail on the next run.

#### Docs
- [bufio.Scanner](https://pkg.go.dev/bufio#Scanner)
- [strings.Builder](https://pkg.go.dev/strings#Builder)
