# Errors

Go has no exceptions. A function that can fail returns an `error` as its last result, and the caller checks it right there with `if err != nil`.

## Errors are values

```go
n, err := strconv.Atoi("42x")
if err != nil {
	fmt.Println("bad input:", err)
	return
}
fmt.Println(n * 2)
```

`error` is a built-in interface with one method, `Error() string`. Any value with that method is an error; `nil` means success. When `err` is non-nil, treat the other results as meaningless unless the docs say otherwise.

The `if err != nil` block is not boilerplate to hide. It is where you decide what failure means here: return it, wrap it, retry, or fall back to a default. Code that reads top to bottom with an early return per failure is the Go style.

```go
func loadConfig(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	cfg, err := parse(data)
	if err != nil {
		return Config{}, err
	}
	return cfg, nil
}
```

## Making errors

```go
errors.New("empty input")                      // a fixed message
fmt.Errorf("user %d not found", id)            // a formatted message
```

Error strings start lowercase and have no trailing punctuation, because they get glued into longer messages: `load config: parse line 3: unexpected "}"`.

## Wrapping with `%w`

`fmt.Errorf` with the `%w` verb builds a new error that *wraps* the original. The message gains context and the cause stays inspectable.

```go
data, err := os.ReadFile(path)
if err != nil {
	return fmt.Errorf("load config %s: %w", path, err)
}
```

Use `%v` instead of `%w` when you want the text but deliberately hide the cause from callers. `errors.Join(err1, err2)` wraps several errors at once.

## Sentinel errors and `errors.Is`

A sentinel is a package-level error value that callers compare against. By convention its name starts with `Err`.

```go
var ErrNotFound = errors.New("not found")

func find(id int) (string, error) {
	if id != 1 {
		return "", fmt.Errorf("find %d: %w", id, ErrNotFound)
	}
	return "Ada", nil
}

_, err := find(7)
fmt.Println(err == ErrNotFound)          // false: it's wrapped
fmt.Println(errors.Is(err, ErrNotFound)) // true: Is unwraps the chain
```

Always use `errors.Is`, not `==`, so wrapping somewhere in the call chain doesn't break the check. Never compare `err.Error()` strings.

## Custom error types and `errors.As`

When callers need data about the failure, not just its identity, define a type with an `Error() string` method. A method is a function declared with a *receiver* before its name; the structs module covers them in full.

```go
type NotFoundError struct {
	Kind string
	ID   int
}

func (e NotFoundError) Error() string {
	return fmt.Sprintf("%s %d not found", e.Kind, e.ID)
}

err := fmt.Errorf("load: %w", NotFoundError{"user", 7})

var nf NotFoundError
if errors.As(err, &nf) {         // walks the chain, fills nf on a match
	fmt.Println("missing id", nf.ID)
}
```

`NotFoundError` is a *struct*, a type made of named fields. `NotFoundError{"user", 7}` builds one with the fields in order (`NotFoundError{Kind: "user", ID: 7}` names them), and `e.Kind` reads a field. Because the type has an `Error() string` method, a `NotFoundError` value can be returned wherever an `error` is expected.

`errors.As` needs a pointer to your variable (`&nf`) so it can write into it. Rule of thumb: sentinel when the caller only asks "was it this?", a type when they ask "what exactly went wrong?".

## Handle it once

Either handle an error (log it, fall back, retry) or return it with context. Doing both, logging and then returning, produces the same failure several times in your logs. Ignoring one needs an explicit `_`, which makes it visible in review:

```go
_ = file.Close() // deliberately ignored
```

## `panic`, `defer` and `recover`

`panic` stops normal execution and unwinds the stack, running deferred calls. Indexing past the end of a slice or dereferencing a nil pointer panics. Unrecovered, it crashes the program with a stack trace.

Deferred calls run even while a panic unwinds the stack, and inside a deferred function `recover()` stops the panic and returns its value.

```go
func safeDiv(a, b int) (q int, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered: %v", r)
		}
	}()
	return a / b, nil
}
```

The named result `err` is what lets the deferred function change the return value after the panic.

Panic is for bugs and impossible states, not for expected failures like bad input or a missing file. Libraries should not let panics escape to callers. The main legitimate uses of `recover` are at boundaries: an HTTP server recovering per request, or a worker that must not take the process down.

```go playground
package main

import (
	"errors"
	"fmt"
	"strconv"
)

var ErrNegative = errors.New("negative age")

func parseAge(s string) (int, error) {
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("parse age %q: %w", s, err)
	}
	if n < 0 {
		return 0, fmt.Errorf("parse age %d: %w", n, ErrNegative)
	}
	return n, nil
}

func main() {
	for _, s := range []string{"36", "abc", "-1"} {
		age, err := parseAge(s)
		switch {
		case errors.Is(err, ErrNegative):
			fmt.Println(s, "-> negative:", err)
		case errors.Is(err, strconv.ErrSyntax):
			fmt.Println(s, "-> not a number:", err)
		case err != nil:
			fmt.Println(s, "-> other error:", err)
		default:
			fmt.Println(s, "->", age)
		}
	}
}

// Try: change %w to %v in parseAge and watch errors.Is stop matching.
```

## Exercises

### 1. Sentinel error

`Divide(a, b)` returns `a / b`, or the sentinel `ErrDivByZero` when `b` is zero. Return `0` alongside the error.

```go starter
package main

import "errors"

var ErrDivByZero = errors.New("division by zero")

func Divide(a, b int) (int, error) {
	// TODO: return ErrDivByZero when b is 0
	return 0, nil
}
```

```go test
package main

import (
	"errors"
	"testing"
)

// divides normally
func TestDivide(t *testing.T) {
	q, err := Divide(7, 2)
	expect(t, q, 3)
	expect(t, err, nil)
}

// returns ErrDivByZero for b == 0
func TestDivideByZero(t *testing.T) {
	q, err := Divide(1, 0)
	if !errors.Is(err, ErrDivByZero) {
		t.Fatalf("want ErrDivByZero, got %v", err)
	}
	expect(t, q, 0)
}
```

#### Uses
- [Errors › Sentinel errors and `errors.Is`](#/errors/sentinel-errors-and-errors-is)
- [Functions › Multiple return values](#/functions/multiple-return-values)

#### Hints
- Check `b` before you divide: an integer division by zero panics.
- When `b` is `0`, return `0` and the sentinel; otherwise return the quotient and `nil`.

#### Tips
- Return the sentinel itself, not a copy made with `errors.New`. Callers match it with `errors.Is`, which keeps working even if you later wrap it with context.

#### Docs
- [errors.New](https://pkg.go.dev/errors#New)
- [Effective Go: Errors](https://go.dev/doc/effective_go#errors)

### 2. Wrap with context

`ParsePort(s)` converts `s` to a port number between 1 and 65535. `strconv.Atoi(s)` returns `(int, error)`.

- If `Atoi` fails, wrap its error: `port "abc": strconv.Atoi: parsing "abc": invalid syntax` (use `%q` for the input and `%w` for the cause).
- If the number is out of range, wrap `ErrOutOfRange`: `port 70000: out of range`.

```go starter
package main

import "errors"

var ErrOutOfRange = errors.New("out of range")

func ParsePort(s string) (int, error) {
	// TODO
	return 0, nil
}
```

```go test
package main

import (
	"errors"
	"strconv"
	"testing"
)

// parses a valid port
func TestParsePortValid(t *testing.T) {
	p, err := ParsePort("8080")
	expect(t, p, 8080)
	expect(t, err, nil)
}

// wraps the Atoi error with %w
func TestParsePortSyntax(t *testing.T) {
	_, err := ParsePort("abc")
	if !errors.Is(err, strconv.ErrSyntax) {
		t.Fatalf("want an error wrapping strconv.ErrSyntax, got %v", err)
	}
	expect(t, err.Error(), `port "abc": strconv.Atoi: parsing "abc": invalid syntax`)
}

// wraps ErrOutOfRange with the number
func TestParsePortRange(t *testing.T) {
	for _, s := range []string{"0", "70000", "-1"} {
		if _, err := ParsePort(s); !errors.Is(err, ErrOutOfRange) {
			t.Fatalf("ParsePort(%q): want ErrOutOfRange, got %v", s, err)
		}
	}
	_, err := ParsePort("70000")
	expect(t, err.Error(), "port 70000: out of range")
}
```

#### Uses
- [Errors › Errors are values](#/errors/errors-are-values)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)
- [Variables & types › Printing with fmt](#/basics/printing-with-fmt)

#### Hints
- Call `strconv.Atoi(s)` first and return early if it fails. Add `"fmt"` and `"strconv"` to the imports.
- `fmt.Errorf` with `%q` for `s` and `%w` for the error keeps the original error inside the new one.
- The range check is `n < 1 || n > 65535`. That message uses `%d` for the number, not `%q`.

#### Tips
- Don't repeat what the cause already says. `Atoi`'s error text already reads `strconv.Atoi: parsing "abc": invalid syntax`, so you only add the `port "abc": ` prefix.

#### Docs
- [fmt.Errorf](https://pkg.go.dev/fmt#Errorf)
- [strconv.Atoi](https://pkg.go.dev/strconv#Atoi)

### 3. Custom error type

`ValidationError` carries the field that failed and why. Make its `Error()` return `"<field>: <reason>"`.

`Validate(name, age)` returns a `ValidationError` for field `"name"` with reason `"required"` when the name is empty, or field `"age"` with reason `"must be 0-150"` when the age is out of range. Otherwise it returns `nil`.

`Register(name, age)` calls `Validate` and wraps any failure as `register: <err>` with `%w`, so callers can still reach the `ValidationError` with `errors.As`.

```go starter
package main

type ValidationError struct {
	Field  string
	Reason string
}

func (e ValidationError) Error() string {
	return "" // TODO
}

func Validate(name string, age int) error {
	return nil
}

func Register(name string, age int) error {
	return nil
}
```

```go test
package main

import (
	"errors"
	"testing"
)

// valid input returns nil
func TestValidateOK(t *testing.T) {
	expect(t, Validate("Ada", 36), nil)
}

// reports the failing field
func TestValidateFields(t *testing.T) {
	var ve ValidationError
	if !errors.As(Validate("", 36), &ve) {
		t.Fatal("want a ValidationError for an empty name")
	}
	expect(t, ve, ValidationError{"name", "required"})
	if !errors.As(Validate("Ada", 200), &ve) {
		t.Fatal("want a ValidationError for age 200")
	}
	expect(t, ve.Error(), "age: must be 0-150")
}

// errors.As sees through the wrap
func TestRegisterWraps(t *testing.T) {
	err := Register("Ada", -1)
	var ve ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("want a wrapped ValidationError, got %v", err)
	}
	expect(t, ve.Field, "age")
	expect(t, err.Error(), "register: age: must be 0-150")
	expect(t, Register("Ada", 36), nil)
}
```

#### Uses
- [Errors › Custom error types and `errors.As`](#/errors/custom-error-types-and-errors-as)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)
- [Errors › Errors are values](#/errors/errors-are-values)

#### Hints
- `Error()` only formats the two fields, `e.Field` and `e.Reason`, with `": "` between them. `fmt.Sprintf` with two `%s` verbs does it.
- `Validate` can return a `ValidationError{...}` value directly as its `error`: the type has an `Error()` method, so it is one.
- In `Register`, wrap with `%w` only when `Validate` returned an error, and return `nil` otherwise.

#### Tips
- Return a literal `nil` for success. An empty `ValidationError{}` is still a non-nil error, just with an odd message.

#### Docs
- [errors.As](https://pkg.go.dev/errors#As)

### 4. Recover at the boundary

`SafeCall(f)` runs `f` and turns a panic into an error instead of crashing. Use a named `err` result, `defer` and `recover()`.

- If the panic value is itself an `error`, wrap it: `fmt.Errorf("recovered: %w", e)`, so `errors.Is` still works. Check with `e, ok := r.(error)`: this *type assertion* asks "is this value an error?", setting `ok` to `true` and `e` to the error if it is (the interfaces module explains it in full).
- Otherwise format it: `fmt.Errorf("recovered: %v", r)`.
- If `f` returns normally, return `nil`.

```go starter
package main

func SafeCall(f func()) (err error) {
	// TODO: recover from a panic in f
	f()
	return nil
}
```

```go test
package main

import (
	"errors"
	"testing"
)

var errBoomForTest = errors.New("boom")

// returns nil when f does not panic
func TestSafeCallOK(t *testing.T) {
	ran := false
	expect(t, SafeCall(func() { ran = true }), nil)
	expect(t, ran, true)
}

// turns a panic value into an error
func TestSafeCallString(t *testing.T) {
	err := SafeCall(func() { panic("disk on fire") })
	if err == nil {
		t.Fatal("want an error")
	}
	expect(t, err.Error(), "recovered: disk on fire")
}

// wraps a panicked error with %w
func TestSafeCallError(t *testing.T) {
	err := SafeCall(func() { panic(errBoomForTest) })
	if !errors.Is(err, errBoomForTest) {
		t.Fatalf("want an error wrapping errBoomForTest, got %v", err)
	}
}

// catches runtime panics too
func TestSafeCallRuntime(t *testing.T) {
	err := SafeCall(func() {
		var xs []int
		_ = xs[3]
	})
	if err == nil {
		t.Fatal("want an error for an index out of range")
	}
}
```

#### Uses
- [Errors › `panic`, `defer` and `recover`](#/errors/panic-defer-and-recover)
- [Functions › defer and named results](#/functions/defer-and-named-results)

#### Hints
- Put a `defer func() { ... }()` before the call to `f()`. Inside it, `r := recover()` is `nil` unless `f` panicked.
- Assign to the named result `err` inside the deferred function. That value is what the caller receives.
- When `r` isn't `nil`, the type assertion picks the branch: `%w` for an error, `%v` for anything else.

#### Tips
- `recover` only stops a panic when it's called directly inside a deferred function. Anywhere else it just returns `nil`.

#### Docs
- [Effective Go: Recover](https://go.dev/doc/effective_go#recover)
- [Go spec: Handling panics](https://go.dev/ref/spec#Handling_panics)
