# Testing

Testing is built into the toolchain: `go test` finds functions named `TestXxx` in `_test.go` files and runs them, with no framework to install. Go tests are plain code with `if` statements, and good Go design is mostly about making code easy to test that way.

## `go test`

```go
// file: slug_test.go, next to slug.go, same package
package text

import "testing"

func TestSlug(t *testing.T) {
	got := Slug("Hello, World")
	if got != "hello-world" {
		t.Errorf("Slug(%q) = %q, want %q", "Hello, World", got, "hello-world")
	}
}
```

```text
go test ./...                 # every package in the module
go test -run Slug -v ./text   # only tests matching a regexp, verbose
go test -race -cover ./...    # with the race detector and coverage
```

There are no assertion helpers in the standard library. `t.Errorf` records a failure and keeps going; `t.Fatalf` records it and stops this test. The message convention is `Func(input) = got, want want`, so a failure reads like a sentence.

`_test.go` files are excluded from normal builds. A test file can use `package text` to test internals, or `package text_test` to test only the exported API, the way a real caller would.

## Table-driven tests

The dominant Go style: one test, a slice of cases, a loop.

```go
func TestSlug(t *testing.T) {
	tests := []struct {
		name, in, want string
	}{
		{"simple", "Hello World", "hello-world"},
		{"punctuation", "Go, 1.26!", "go-1-26"},
		{"empty", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Slug(tt.in); got != tt.want {
				t.Errorf("Slug(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
```

`t.Run` makes each case a named subtest: failures report `TestSlug/punctuation`, and `go test -run TestSlug/empty` runs just one. Adding a case is one line, which is why this style wins.

## Helpers and cleanup

```go
func mustParse(t *testing.T, s string) int {
	t.Helper() // failures point at the caller's line, not this one
	n, err := strconv.Atoi(s)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	return n
}
```

`t.Cleanup(f)` registers teardown that runs when the test ends, and `t.TempDir()` gives you a directory that is deleted afterwards.

## Fakes through interfaces

Go has no mocking framework built in, and doesn't need one. Make your code depend on a small interface, and in tests pass a fake that satisfies it:

```go
type Mailer interface {
	Send(to, body string) error
}

func Welcome(m Mailer, user string) error {
	return m.Send(user, "welcome aboard")
}

// in the test file
type fakeMailer struct{ sent []string }

func (f *fakeMailer) Send(to, body string) error {
	f.sent = append(f.sent, to)
	return nil
}

func TestWelcome(t *testing.T) {
	f := &fakeMailer{}
	Welcome(f, "ada@example.com")
	if len(f.sent) != 1 {
		t.Fatalf("sent %d mails, want 1", len(f.sent))
	}
}
```

The same idea works for hidden dependencies like the clock or randomness. A test run at 11 p.m. can't check the 9 a.m. behavior of code that calls `time.Now()` directly; it can if the code takes a `func() time.Time`. Inject the dependency as a parameter or struct field and let production code pass the real one.

## Benchmarks, examples and fuzzing

```go
func BenchmarkSlug(b *testing.B) {
	for b.Loop() { // Go 1.24+: runs the body enough times to time it
		Slug("Hello, World")
	}
}

func ExampleSlug() {
	fmt.Println(Slug("Hello, World"))
	// Output: hello-world
}

func FuzzSlug(f *testing.F) {
	f.Add("Hello, World")
	f.Fuzz(func(t *testing.T, s string) {
		if strings.Contains(Slug(s), "--") {
			t.Errorf("Slug(%q) has a double dash", s)
		}
	})
}
```

`go test -bench .` runs benchmarks. Examples are compiled, run and checked against their `// Output:` comment, then shown in the package docs. `go test -fuzz FuzzSlug` feeds generated inputs to a fuzz test until it finds a failure.

## In this course

Exercises here run the same way: your code is one file, the tests are another file in the same package, and each `TestXxx` becomes a row in the results. `expect(t, got, want)` is a small helper this site adds; in your own projects you'd write the `if got != want` yourself or use `reflect.DeepEqual` or `slices.Equal`.

```go playground
package main

import (
	"fmt"
	"strings"
	"time"
)

// Greeter depends on a clock function instead of calling time.Now directly.
type Greeter struct {
	Now func() time.Time
}

func (g Greeter) Greet(name string) string {
	h := g.Now().Hour()
	switch {
	case h < 12:
		return "Good morning, " + name
	case h < 18:
		return "Good afternoon, " + name
	default:
		return "Good evening, " + name
	}
}

func main() {
	live := Greeter{Now: time.Now}
	fmt.Println(live.Greet("Ada"), "(real clock)")

	tests := []struct {
		hour int
		want string
	}{
		{9, "Good morning"},
		{14, "Good afternoon"},
		{21, "Good evening"},
	}
	for _, tt := range tests {
		fixed := func() time.Time { return time.Date(2026, 1, 1, tt.hour, 0, 0, 0, time.UTC) }
		got := Greeter{Now: fixed}.Greet("Ada")
		status := "ok"
		if !strings.HasPrefix(got, tt.want) {
			status = "FAIL"
		}
		fmt.Printf("%-4s %02d:00 -> %s\n", status, tt.hour, got)
	}
}

// Try: add a case for hour 12 and decide which greeting it should get.
```

## Exercises

### 1. Pass the table

The tests are a table of cases. Implement `ParseBool` to pass all of them: it accepts `true`, `yes`, `on`, `1` and `false`, `no`, `off`, `0`, in any letter case and with surrounding spaces, tabs or newlines. Anything else returns `false` and an error wrapping `ErrNotBool`: `parse bool "maybe": not a boolean`.

Two tools help. `strings.TrimSpace(s)` removes surrounding spaces and `strings.ToLower(s)` lowercases. And a `switch` compares one value against its cases in order, where each case can list several values:

```go
switch day {
case "sat", "sun":
	return "weekend"
case "mon", "tue", "wed", "thu", "fri":
	return "weekday"
}
return "unknown" // no case matched
```

```go starter
package main

import "errors"

var ErrNotBool = errors.New("not a boolean")

func ParseBool(s string) (bool, error) {
	return false, nil // TODO
}
```

```go test
package main

import (
	"errors"
	"testing"
)

// passes every case in the table
func TestParseBool(t *testing.T) {
	tests := []struct {
		in      string
		want    bool
		wantErr bool
	}{
		{"true", true, false},
		{"YES", true, false},
		{" on ", true, false},
		{"1", true, false},
		{"false", false, false},
		{"No", false, false},
		{"off", false, false},
		{"0", false, false},
		{"maybe", false, true},
		{"", false, true},
		{"yes!", false, true},
		{"t", false, true},
		{"2", false, true},
		{"o n", false, true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got, err := ParseBool(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseBool(%q) error = %v, wantErr %v", tt.in, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("ParseBool(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

// errors wrap ErrNotBool and quote the input
func TestParseBoolError(t *testing.T) {
	_, err := ParseBool("maybe")
	if !errors.Is(err, ErrNotBool) {
		t.Fatalf("want ErrNotBool, got %v", err)
	}
	expect(t, err.Error(), `parse bool "maybe": not a boolean`)
	_, err = ParseBool("nah")
	if !errors.Is(err, ErrNotBool) {
		t.Fatalf("want ErrNotBool, got %v", err)
	}
	expect(t, err.Error(), `parse bool "nah": not a boolean`)
}

// any letter case, with spaces, tabs or newlines around it
func TestParseBoolNormalizes(t *testing.T) {
	for _, in := range []string{"TRUE", "TrUe", "\tyes", "On\n", " 1 "} {
		if got, err := ParseBool(in); !got || err != nil {
			t.Errorf("ParseBool(%q) = %v, %v; want true, nil", in, got, err)
		}
	}
	for _, in := range []string{"FALSE", "nO", "\tOFF\n", " 0 "} {
		if got, err := ParseBool(in); got || err != nil {
			t.Errorf("ParseBool(%q) = %v, %v; want false, nil", in, got, err)
		}
	}
}
```

#### Uses
- [Testing › Table-driven tests](#/testing/table-driven-tests)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)
- [Packages & modules › Using the standard library](#/packages/using-the-standard-library)
- [Standard library tour › `strings`](#/stdlib/strings)

#### Hints
- Normalize first: trim, then lowercase. After that, `" On "` and `"on"` are the same string.
- `switch` on the normalized string, with one case listing the four true words and one listing the four false words. Everything else ends up after the `switch`.
- The error quotes the input with `%q` and wraps `ErrNotBool` with `%w`.

#### Tips
- Each table row runs as a named subtest, so a failure shows up as `TestParseBool/YES` and points at exactly one case.
- Trim first, then lowercase. The other order works too, but only because `ToLower` leaves whitespace alone — do not rely on that with other normalizers.
- A `switch` with no `default` simply falls out the bottom, which is where the error case belongs. No `break` anywhere.

#### Docs
- [strings.TrimSpace](https://pkg.go.dev/strings#TrimSpace)
- [Go wiki: Table-driven tests](https://go.dev/wiki/TableDrivenTests)

### 2. Write a fake

`Greeting(store, id)` looks up a user's name through the `UserStore` interface. Real code would hit a database; tests use `FakeStore`, an in-memory map. A map is Go's built-in hash table (the maps module covers it): `name, ok := f[id]` looks up `id`, and `ok` is `false` when it isn't there. Implement:

- `FakeStore.Name`: return the name for `id`, or `ErrNotFound` (wrapped as `user 7: not found`) if it's missing.
- `Greeting`: `Hello, Ada!` on success, `Hello, stranger!` when the error is `ErrNotFound`, and `Hello!` for any other error.

```go starter
package main

import "errors"

var ErrNotFound = errors.New("not found")

type UserStore interface {
	Name(id int) (string, error)
}

// FakeStore is an in-memory UserStore for tests.
type FakeStore map[int]string

func (f FakeStore) Name(id int) (string, error) {
	return "", nil // TODO
}

func Greeting(s UserStore, id int) string {
	return "" // TODO
}
```

```go test
package main

import (
	"errors"
	"testing"
)

var _ UserStore = FakeStore{} // compile-time check

type brokenStoreForTest struct{}

func (brokenStoreForTest) Name(int) (string, error) { return "", errors.New("connection refused") }

// the fake returns names and ErrNotFound
func TestFakeStore(t *testing.T) {
	f := FakeStore{1: "Ada", 5: "Linus"}
	name, err := f.Name(1)
	expect(t, name, "Ada")
	expect(t, err, nil)
	name, _ = f.Name(5)
	expect(t, name, "Linus")
	_, err = f.Name(7)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
	expect(t, err.Error(), "user 7: not found")
	_, err = f.Name(42)
	expect(t, err.Error(), "user 42: not found")
}

// greets known and unknown users
func TestGreeting(t *testing.T) {
	f := FakeStore{1: "Ada", 2: "Grace"}
	expect(t, Greeting(f, 2), "Hello, Grace!")
	expect(t, Greeting(f, 1), "Hello, Ada!")
	expect(t, Greeting(f, 99), "Hello, stranger!")
	expect(t, Greeting(FakeStore{}, 1), "Hello, stranger!")
}

// other errors get a plain hello
func TestGreetingBrokenStore(t *testing.T) {
	expect(t, Greeting(brokenStoreForTest{}, 1), "Hello!")
}
```

#### Uses
- [Testing › Fakes through interfaces](#/testing/fakes-through-interfaces)
- [Errors › Sentinel errors and `errors.Is`](#/errors/sentinel-errors-and-errors-is)
- [Interfaces › Implicit satisfaction](#/interfaces/implicit-satisfaction)

#### Hints
- In `Name`, look `id` up with the two-value form. When `ok` is false, wrap `ErrNotFound` with `%d` for the id and `%w`.
- In `Greeting`, check `errors.Is(err, ErrNotFound)` before the general `err != nil`: a not-found error is non-nil too.

#### Tips
- `Greeting` only knows about `UserStore`, so the same function works with the fake in tests and with a database-backed store in production.
- `var _ UserStore = FakeStore{}` at the top of the test file is a compile-time check. If a method signature drifts, the file stops compiling instead of failing somewhere confusing later.

#### Docs
- [errors.Is](https://pkg.go.dev/errors#Is)

### 3. Inject the clock

`Shop.Status` should say `open` from 09:00 up to (not including) 17:00 on weekdays and `closed` otherwise. The starter calls `time.Now()` directly, so the tests can't control the time. Use the injected `Now` field instead. If `Now` is nil, fall back to `time.Now` so the zero `Shop{}` still works.

`t.Weekday()` returns a `time.Weekday` such as `time.Saturday`, and `t.Hour()` the hour.

```go starter
package main

import "time"

type Shop struct {
	Now func() time.Time
}

func (s Shop) Status() string {
	t := time.Now() // TODO: use s.Now
	if t.Weekday() == time.Saturday || t.Weekday() == time.Sunday {
		return "closed"
	}
	if t.Hour() >= 9 && t.Hour() < 17 {
		return "open"
	}
	return "closed"
}
```

```go test
package main

import (
	"testing"
	"time"
)

func clockAt(day, hour int) func() time.Time {
	// 2026-06-01 is a Monday
	return func() time.Time { return time.Date(2026, 6, day, hour, 30, 0, 0, time.UTC) }
}

// open during weekday hours
func TestShopOpen(t *testing.T) {
	expect(t, Shop{Now: clockAt(1, 9)}.Status(), "open")
	expect(t, Shop{Now: clockAt(3, 16)}.Status(), "open")
	expect(t, Shop{Now: clockAt(5, 12)}.Status(), "open") // Friday
}

// closed outside hours and on weekends
func TestShopClosed(t *testing.T) {
	expect(t, Shop{Now: clockAt(1, 8)}.Status(), "closed")
	expect(t, Shop{Now: clockAt(1, 17)}.Status(), "closed")
	expect(t, Shop{Now: clockAt(6, 11)}.Status(), "closed") // Saturday
	expect(t, Shop{Now: clockAt(7, 11)}.Status(), "closed") // Sunday
	expect(t, Shop{Now: clockAt(2, 0)}.Status(), "closed")
	expect(t, Shop{Now: clockAt(5, 23)}.Status(), "closed")
}

// the zero Shop uses the real clock
func TestShopZero(t *testing.T) {
	s := Shop{}.Status()
	if s != "open" && s != "closed" {
		t.Fatalf("got %q", s)
	}
}
```

#### Uses
- [Testing › Fakes through interfaces](#/testing/fakes-through-interfaces)
- [Functions › Functions are values](#/functions/functions-are-values)
- [Structs & methods › Declaring and building structs](#/structs/declaring-and-building-structs)

#### Hints
- Pick the clock first: `now := s.Now`, and if that is `nil`, use `time.Now` instead (the function itself, no parentheses).
- Then call `now()` where the starter calls `time.Now()`. The rest of the method stays as it is.

#### Tips
- Calling a nil function value panics, which is why the zero `Shop{}` needs the fallback.
- Injecting a `func() time.Time` rather than a `Clock` interface keeps this to one field. Reach for an interface when the dependency has more than one method.
- Call `s.Now()` once and keep the result. Calling it three times could straddle a second boundary, and in real code it means three clock reads per request.

#### Docs
- [time.Time.Weekday](https://pkg.go.dev/time#Time.Weekday)

### 4. Code a spy can check

`RemindAll(n, users)` sends `"reminder"` to every user through the `Notifier` interface. A failure for one user must not stop the others: collect the failures and return them combined with `errors.Join`. Wrap each failure with the user: `notify bob: mailbox full`.

`errors.Join(errs...)` skips `nil` arguments and returns `nil` when nothing is left, so you can grow the combined error one failure at a time: `err = errors.Join(err, next)`.

The tests pass in a *spy*, a fake that records the calls it received.

```go starter
package main

type Notifier interface {
	Notify(user, msg string) error
}

func RemindAll(n Notifier, users []string) error {
	return nil // TODO
}
```

```go test
package main

import (
	"errors"
	"testing"
)

type spyNotifier struct {
	calls []string
	fail  map[string]error
}

func (s *spyNotifier) Notify(user, msg string) error {
	s.calls = append(s.calls, user+":"+msg)
	return s.fail[user]
}

var errFullForTest = errors.New("mailbox full")

// notifies every user once
func TestRemindAll(t *testing.T) {
	spy := &spyNotifier{}
	err := RemindAll(spy, []string{"ada", "bob"})
	expect(t, err, nil)
	expect(t, spy.calls, []string{"ada:reminder", "bob:reminder"})
}

// keeps going after a failure
func TestRemindAllContinues(t *testing.T) {
	spy := &spyNotifier{fail: map[string]error{"bob": errFullForTest}}
	err := RemindAll(spy, []string{"ada", "bob", "cy"})
	expect(t, spy.calls, []string{"ada:reminder", "bob:reminder", "cy:reminder"})
	if !errors.Is(err, errFullForTest) {
		t.Fatalf("want an error wrapping errFullForTest, got %v", err)
	}
	expect(t, err.Error(), "notify bob: mailbox full")
}

// joins several failures
func TestRemindAllJoins(t *testing.T) {
	other := errors.New("unknown user")
	spy := &spyNotifier{fail: map[string]error{"ada": other, "cy": errFullForTest}}
	err := RemindAll(spy, []string{"ada", "bob", "cy"})
	if !errors.Is(err, other) || !errors.Is(err, errFullForTest) {
		t.Fatalf("want both errors joined, got %v", err)
	}
	expect(t, err.Error(), "notify ada: unknown user\nnotify cy: mailbox full")
}
```

#### Uses
- [Testing › Fakes through interfaces](#/testing/fakes-through-interfaces)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)
- [Functions › Variadic functions](#/functions/variadic-functions)

#### Hints
- Loop over `users` with `for _, u := range users` and call `n.Notify(u, "reminder")` for each, with no early return.
- Start from `var err error`. For each failure, wrap it with `%s` for the user and `%w` for the cause, and fold it in with `errors.Join`.

#### Tips
- `errors.Join` keeps every cause reachable, so `errors.Is` finds any of them. Its message puts each error on its own line.
- The spy records into a slice, so its `Notify` needs a pointer receiver and the test passes `&spyNotifier{}`. With a value receiver every call would append to a copy and `calls` would stay empty.
- `RemindAll` must not return early on the first failure. The "keeps going after a failure" test checks that every user was still notified.

#### Docs
- [errors.Join](https://pkg.go.dev/errors#Join)
