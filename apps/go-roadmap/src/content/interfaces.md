# Interfaces

An interface is a set of method signatures, and a type satisfies it just by having those methods. There is no `implements` keyword, so the consumer defines the interface it needs and any type that fits can be passed in.

## Implicit satisfaction

```go
type Shape interface {
	Area() float64
}

type Rect struct{ W, H float64 }
type Circle struct{ R float64 }

func (r Rect) Area() float64   { return r.W * r.H }
func (c Circle) Area() float64 { return math.Pi * c.R * c.R }

func total(shapes []Shape) float64 {
	sum := 0.0
	for _, s := range shapes {
		sum += s.Area()
	}
	return sum
}

total([]Shape{Rect{2, 3}, Circle{1}})
```

`Rect` never mentions `Shape`. This is structural typing, like TypeScript's, but checked at compile time and based on methods only, never fields. To assert at compile time that a type satisfies an interface, write `var _ Shape = Rect{}`.

## Keep interfaces small

The standard library's most useful interfaces have one or two methods:

```go
type Reader interface { Read(p []byte) (n int, err error) }   // io.Reader
type Writer interface { Write(p []byte) (n int, err error) }  // io.Writer
type Stringer interface { String() string }                    // fmt.Stringer
type error interface { Error() string }                        // built in
```

Files, network connections, `strings.Reader`, `bytes.Buffer`, gzip streams and hash functions all implement `io.Reader` or `io.Writer`, so they plug into each other. A function that takes an `io.Writer` can write to a file, a buffer in a test, or an HTTP response without knowing which.

Small interfaces compose by embedding:

```go
type ReadWriter interface {
	Reader
	Writer
}
```

The Go proverb is *accept interfaces, return concrete types*. Define an interface where it is consumed, with only the methods that consumer calls. Don't write an interface next to its only implementation "for later".

## `fmt.Stringer`

Give a type a `String() string` method and `fmt.Println`, `%v` and `%s` use it:

```go
type Celsius float64

func (c Celsius) String() string { return fmt.Sprintf("%.1f°C", float64(c)) }

fmt.Println(Celsius(21.5)) // 21.5°C
```

Convert to the underlying type (`float64(c)`) inside `String`. Formatting `c` itself with `%v` would call `String` again, forever.

## Method sets: value vs pointer receivers

If a method has a pointer receiver, only the pointer type satisfies the interface:

```go
type Counter struct{ n int }

func (c *Counter) Write(p []byte) (int, error) { c.n += len(p); return len(p), nil }

var w io.Writer = &Counter{} // ok
var w2 io.Writer = Counter{} // compile error: Write has a pointer receiver
```

## Type assertions and type switches

An interface value holds a concrete type and a value of that type. A type assertion gets the concrete value back:

```go
var v any = "hello"

s := v.(string)       // panics if v is not a string
n, ok := v.(int)      // ok is false, n is 0: no panic
w, ok := v.(io.Writer) // you can assert to another interface too
```

A type switch branches on the dynamic type:

```go
func describe(v any) string {
	switch x := v.(type) {
	case nil:
		return "nil"
	case int:
		return fmt.Sprintf("int %d", x) // x is an int here
	case string, []byte:
		return fmt.Sprintf("text %v", x) // several types: x stays any
	case fmt.Stringer:
		return "stringer " + x.String()
	default:
		return fmt.Sprintf("other %T", x)
	}
}
```

Cases are tried in order, so put more specific interfaces first. `any` is an alias for `interface{}`, the empty interface every type satisfies. Use it when you really accept anything (like `fmt.Println` does), not to dodge the type system.

## The nil interface gotcha

An interface value is `nil` only when both its type and value are unset. A nil *pointer* stored in an interface is not a nil interface:

```go
type MyErr struct{}

func (*MyErr) Error() string { return "boom" }

func check() error {
	var p *MyErr // nil pointer
	return p     // interface holding (*MyErr, nil)
}

fmt.Println(check() == nil) // false
```

This bites most often with errors. Return a literal `nil` on success, never a typed nil pointer variable.

```go playground
package main

import (
	"fmt"
	"io"
	"os"
	"strings"
)

type Celsius float64

func (c Celsius) String() string { return fmt.Sprintf("%.1f°C", float64(c)) }

// upperWriter wraps any io.Writer and upper-cases what passes through.
type upperWriter struct{ w io.Writer }

func (u upperWriter) Write(p []byte) (int, error) {
	return u.w.Write([]byte(strings.ToUpper(string(p))))
}

func main() {
	fmt.Println(Celsius(21.5))

	var out io.Writer = upperWriter{os.Stdout}
	fmt.Fprintf(out, "hello, %s\n", "gopher")

	var sb strings.Builder
	io.Copy(upperWriter{&sb}, strings.NewReader("copied from a Reader"))
	fmt.Println(sb.String())

	for _, v := range []any{42, "hi", Celsius(-3), 3.5, nil} {
		switch x := v.(type) {
		case fmt.Stringer:
			fmt.Println("stringer:", x)
		case int, string:
			fmt.Println("int or string:", x)
		default:
			fmt.Printf("other: %T\n", x)
		}
	}
}

// Try: delete the String method and see how Println prints Celsius.
```

## Exercises

### 1. Stringer

`Money` stores an amount in cents. Give it a `String` method so it prints as dollars with two decimals: `1234` is `$12.34`, `5` is `$0.05`, and `-50` is `-$0.50`.

`%` is the remainder operator (`1234 % 100` is `34`), and a `0` in front of a width pads with zeros instead of spaces: `fmt.Sprintf("%02d", 5)` is `"05"`.

```go starter
package main

type Money int64

func (m Money) String() string {
	return "" // TODO
}
```

```go test
package main

import (
	"fmt"
	"testing"
)

// formats dollars and cents
func TestMoneyString(t *testing.T) {
	expect(t, Money(1234).String(), "$12.34")
	expect(t, Money(5).String(), "$0.05")
	expect(t, Money(100000).String(), "$1000.00")
	expect(t, Money(0).String(), "$0.00")
	expect(t, Money(7).String(), "$0.07")
}

// handles negative amounts
func TestMoneyNegative(t *testing.T) {
	expect(t, Money(-50).String(), "-$0.50")
	expect(t, Money(-1999).String(), "-$19.99")
	expect(t, Money(-5).String(), "-$0.05")
	expect(t, Money(-300).String(), "-$3.00")
}

// fmt uses String automatically
func TestMoneyFmt(t *testing.T) {
	expect(t, fmt.Sprint(Money(250)), "$2.50")
	expect(t, fmt.Sprintf("%v", []Money{1, 199}), "[$0.01 $1.99]")
}
```

#### Uses
- [Interfaces › `fmt.Stringer`](#/interfaces/fmt-stringer)
- [Structs & methods › Methods](#/structs/methods)
- [Variables & types › Basic types](#/basics/basic-types)
- [Variables & types › Printing with fmt](#/basics/printing-with-fmt)

#### Hints
- Integer division truncates, so `m / 100` is the dollars and `m % 100` the cents.
- Handle the sign first: if `m` is negative, remember a `"-"` and flip `m` to positive. Otherwise `-50 / 100` is `0` and the minus sign gets lost.
- `%02d` for the cents keeps `$0.05` from turning into `$0.5`.

#### Tips
- Don't format `m` with `%v` or `%s` inside `String`: fmt would call `String` again, forever. `%d` prints the plain number, or convert first with `int64(m)`.
- `Money(-50) / 100` is `0`, not `-1`: integer division truncates toward zero. That is exactly why the minus sign has to be taken off before the arithmetic.

#### Docs
- [fmt.Stringer](https://pkg.go.dev/fmt#Stringer)
- [fmt: Printing](https://pkg.go.dev/fmt#hdr-Printing)

### 2. Wrap an io.Writer

`CountingWriter` forwards everything written to it to `W` and adds the number of bytes written to `N`. Implement `Write` so it satisfies `io.Writer`: pass `p` to `W`, add the byte count `W` reports to `N`, and return what `W` returned.

```go starter
package main

import "io"

type CountingWriter struct {
	W io.Writer
	N int
}

func (c *CountingWriter) Write(p []byte) (int, error) {
	return 0, nil // TODO
}
```

```go test
package main

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
)

// forwards bytes and counts them
func TestCountingWriter(t *testing.T) {
	var sb strings.Builder
	cw := &CountingWriter{W: &sb}
	fmt.Fprintf(cw, "hello, %s", "world")
	io.WriteString(cw, "!")
	expect(t, sb.String(), "hello, world!")
	expect(t, cw.N, 13)
}

type failWriterForTest struct{}

func (failWriterForTest) Write(p []byte) (int, error) { return 2, errors.New("disk full") }

// passes through the inner writer's result
func TestCountingWriterError(t *testing.T) {
	cw := &CountingWriter{W: failWriterForTest{}}
	n, err := cw.Write([]byte("hello"))
	expect(t, n, 2)
	if err == nil || err.Error() != "disk full" {
		t.Fatalf("want the inner error, got %v", err)
	}
	expect(t, cw.N, 2)
}

// returns each write's count, keeps adding to N, and wraps another CountingWriter
func TestCountingWriterStacked(t *testing.T) {
	var sb strings.Builder
	inner := &CountingWriter{W: &sb}
	outer := &CountingWriter{W: inner, N: 100}
	n, err := outer.Write([]byte("abc"))
	expect(t, n, 3)
	expect(t, err, nil)
	n, _ = outer.Write([]byte(""))
	expect(t, n, 0)
	io.WriteString(outer, "defg")
	expect(t, sb.String(), "abcdefg")
	expect(t, inner.N, 7)
	expect(t, outer.N, 107)
}
```

#### Uses
- [Interfaces › Keep interfaces small](#/interfaces/keep-interfaces-small)
- [Interfaces › Method sets: value vs pointer receivers](#/interfaces/method-sets-value-vs-pointer-receivers)
- [Structs & methods › Value receivers and pointer receivers](#/structs/value-receivers-and-pointer-receivers)
- [Functions › Multiple return values](#/functions/multiple-return-values)
- [Reference › fmt and io](#/reference/fmt-and-io)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- `c.W` is itself an `io.Writer`, so `c.W.Write(p)` does the forwarding and hands you `n` and `err`.
- Add `n` to `c.N` even when `err` isn't `nil`: a writer can report some bytes written and an error at the same time.

#### Tips
- The pointer receiver matters. With `(c CountingWriter)`, `c.N += n` would update a copy and the caller's count would stay at 0.
- The test reaches your `Write` through `fmt.Fprintf` and `io.WriteString`, which only know `io.Writer`. Nothing declares that `*CountingWriter` implements it; having the method is the whole of it.

#### Docs
- [io.Writer](https://pkg.go.dev/io#Writer)

### 3. Type switch

`Describe(v)` returns a short description of any value:

| value | result |
| --- | --- |
| `nil` | `nil` |
| an `int` | `int 42` |
| a `string` | `string "hi"` (quoted, use `%q`) |
| an `error` | `error: <message>` |
| a `fmt.Stringer` | `stringer: <String()>` |
| a `[]int` | `3 ints` (its length) |
| anything else | its type from `%T`, e.g. `bool` |

Some errors also have a `String` method; check for `error` first.

```go starter
package main

func Describe(v any) string {
	return "" // TODO: switch x := v.(type)
}
```

```go test
package main

import (
	"errors"
	"testing"
)

type pointForTest struct{ X, Y int }

func (p pointForTest) String() string { return "point" }

type bothForTest struct{}

func (bothForTest) Error() string  { return "as error" }
func (bothForTest) String() string { return "as stringer" }

// basic types
func TestDescribeBasics(t *testing.T) {
	expect(t, Describe(nil), "nil")
	expect(t, Describe(42), "int 42")
	expect(t, Describe(-7), "int -7")
	expect(t, Describe("hi"), `string "hi"`)
	expect(t, Describe(`say "go"`), `string "say \"go\""`)
	expect(t, Describe([]int{1, 2, 3}), "3 ints")
	expect(t, Describe([]int{}), "0 ints")
}

// interfaces, error before Stringer
func TestDescribeInterfaces(t *testing.T) {
	expect(t, Describe(errors.New("boom")), "error: boom")
	expect(t, Describe(errors.New("disk full")), "error: disk full")
	expect(t, Describe(pointForTest{1, 2}), "stringer: point")
	expect(t, Describe(bothForTest{}), "error: as error")
}

// falls back to the type name
func TestDescribeDefault(t *testing.T) {
	expect(t, Describe(true), "bool")
	expect(t, Describe(3.5), "float64")
	expect(t, Describe(map[string]int{}), "map[string]int")
	expect(t, Describe(int64(5)), "int64")
	expect(t, Describe([]string{"a"}), "[]string")
}
```

#### Uses
- [Interfaces › Type assertions and type switches](#/interfaces/type-assertions-and-type-switches)
- [Interfaces › Keep interfaces small](#/interfaces/keep-interfaces-small)
- [Variables & types › Printing with fmt](#/basics/printing-with-fmt)
- [Reference › errors](#/reference/errors)

#### Hints
- In `switch x := v.(type)`, `x` already has each case's type, so `x.Error()`, `x.String()` and `len(x)` all work in their own cases.
- Cases are tried top to bottom: put `case error:` above `case fmt.Stringer:`.
- `%q` adds the quotes in the string case, and `%T` gives the type name in `default`.

#### Tips
- `case nil` matches only an interface with nothing in it, like `Describe(nil)`. A nil pointer stored in `any` still goes to its type's case.
- A case that lists several types leaves `x` as `any`, because there is no single type it could have. Only a one-type case gives you the concrete value.

#### Docs
- [Go spec: Type switches](https://go.dev/ref/spec#Type_switches)

### 4. The nil interface bug

`Check` is supposed to return `nil` for valid input, but callers report that `Check(5) != nil`. Find the typed-nil bug and fix it so valid input returns a true `nil`, while invalid input still returns a `*RangeError`.

```go starter
package main

import "fmt"

type RangeError struct{ N int }

func (e *RangeError) Error() string { return fmt.Sprintf("%d is out of range", e.N) }

func Check(n int) error {
	var err *RangeError
	if n < 0 || n > 10 {
		err = &RangeError{N: n}
	}
	return err
}
```

```go test
package main

import (
	"errors"
	"testing"
)

// valid input returns a nil error
func TestCheckValid(t *testing.T) {
	for _, n := range []int{5, 1, 9} {
		if err := Check(n); err != nil {
			t.Fatalf("Check(%d) = %#v, want a nil error", n, err)
		}
	}
}

// invalid input returns a *RangeError
func TestCheckInvalid(t *testing.T) {
	err := Check(11)
	var re *RangeError
	if !errors.As(err, &re) {
		t.Fatalf("want a *RangeError, got %v", err)
	}
	expect(t, re.N, 11)
	expect(t, err.Error(), "11 is out of range")
	err = Check(-3)
	if !errors.As(err, &re) {
		t.Fatalf("want a *RangeError, got %v", err)
	}
	expect(t, re.N, -3)
	expect(t, err.Error(), "-3 is out of range")
}

// 0 and 10 are in range, -1 and 11 are not
func TestCheckBounds(t *testing.T) {
	expect(t, Check(0), nil)
	expect(t, Check(10), nil)
	if Check(-1) == nil || Check(11) == nil {
		t.Fatal("want errors for -1 and 11")
	}
}
```

#### Uses
- [Interfaces › The nil interface gotcha](#/interfaces/the-nil-interface-gotcha)
- [Structs & methods › Declaring and building structs](#/structs/declaring-and-building-structs)
- [Reference › errors](#/reference/errors)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- `err` is a `*RangeError` variable. Returning it as an `error` puts the nil pointer inside a non-nil interface.
- Drop the variable: return `&RangeError{N: n}` straight from the failing branch, and a literal `nil` at the end.

#### Tips
- The same bug hides in helpers whose result type is a concrete pointer like `*RangeError`. Declare error results as `error`.
- The buggy value prints as `<nil>` but is not equal to `nil`, which is what makes it so hard to spot. `%#v` in the failure message shows the type that is hiding inside.

#### Docs
- [Go FAQ: Why is my nil error value not equal to nil?](https://go.dev/doc/faq#nil_error)
