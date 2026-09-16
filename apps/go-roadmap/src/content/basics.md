# Variables & types

Go is statically typed, but type inference means you rarely write a type twice. Every variable starts at a well-defined zero value, and every conversion between types is explicit.

## Declaring variables

```go
var name string = "Ada" // full form
var age = 36            // type inferred: int
var score int           // no value: starts at the zero value, 0

count := 10             // short declaration, only inside functions
x, y := 1, 2            // several at once
x, y = y, x             // swap: the right side is evaluated first
```

`:=` declares and assigns. `=` only assigns to a variable that already exists. At package level (outside any function) you must use `var`.

`:=` needs at least one *new* name on the left. That rule is what lets you reuse `err` across calls:

```go
a, err := first()
b, err := second() // fine: b is new, err is reassigned
```

Declaring a local variable and never reading it is a compile error. Assign to the blank identifier `_` to discard a value on purpose: `_, err := f()`.

Gotcha: `:=` inside a nested block declares a *new* variable that hides the outer one for the rest of that block. The outer one never changes:

```go
n := 1
if true {
	n := 2      // a second n, not the first
	fmt.Println(n) // 2
}
fmt.Println(n)  // 1: the inner n is gone
```

The compiler will not warn you, because both variables are used. When you mean to assign to the outer variable, write `=`. This is the single most common cause of "my value didn't change".

## Zero values

There is no `undefined` and no uninitialized memory. A variable declared without a value holds its type's zero value:

| Type | Zero value |
| --- | --- |
| numbers | `0` |
| `string` | `""` |
| `bool` | `false` |
| pointers, slices, maps, channels, functions, interfaces | `nil` |

Idiomatic Go leans on this. A zero counter, an empty string, and (later) an empty struct are all ready to use without a constructor.

## Basic types

```go
var b bool = true
var s string = "héllo"   // immutable, UTF-8 bytes
var i int = 42           // 64 bits on every modern platform
var n int64 = 1 << 40    // also int8, int16, int32, uint, uint8 ... uint64
var f float64 = 3.14     // also float32
var c byte = 'A'         // byte is an alias for uint8
var r rune = 'é'         // rune is an alias for int32: one Unicode code point
```

Use `int` and `float64` unless you have a reason not to. Integer overflow wraps around silently at runtime: an `int8` variable holding `127` becomes `-128` after `x++`. Overflow in a constant expression, like `int8(127) + 1`, is a compile error instead.

Integer division truncates toward zero: `7 / 2` is `3` and `-7 / 2` is `-3`. You only get a fraction if an operand is a float.

## Operators

The operators are the ones you know from TypeScript and Python: `+ - * /`, `%` for the remainder, `== != < <= > >=` to compare, and `&&`, `||`, `!` to combine booleans.

```go
7 % 3            // 1
-7 % 3           // -1: the remainder takes the sign of the left side
n%2 == 0         // true when n is even
n > 0 && n < 10  // both must hold
"go" + "pher"    // "gopher": + also joins strings
1 << 10          // 1024: shift left by 10 bits

n += 5           // every arithmetic operator has an assigning form
n *= 2
n++              // add one; n-- subtracts one
```

## Constants and iota

Constants are computed at compile time. Untyped constants have arbitrary precision and take on a type only when used, so one constant can serve as both an `int` and a `float64`:

```go
const Pi = 3.14159
const Big = 1 << 100    // fine as long as it is never stored in an int

var radius float64 = 2
area := Pi * radius * radius
```

Go has no `enum` keyword. You declare a named type and a block of constants, and `iota` counts up from 0 in each `const` block:

```go
type Weekday int

const (
	Sunday Weekday = iota // 0
	Monday                // 1: the expression repeats with iota incremented
	Tuesday               // 2
)

const (
	_  = iota             // skip 0
	KB = 1 << (10 * iota) // 1 << 10
	MB                    // 1 << 20
)
```

## Conversions are always explicit

Go never converts between numeric types for you. Not even `int` to `float64`, and not even `int` to `int64`:

```go
count := 3
total := 10.0
avg := total / float64(count) // total / count does not compile
price := 3.99
whole := int(price)           // 3: truncates toward zero

var small int32 = 5
var big int64 = int64(small) + 1
```

Constants are the exception: `total / 2` works because `2` is untyped. They are also checked at compile time, so `int(3.99)` on a constant is an error rather than a silent truncation.

Converting an integer to `string` does not give you digits. `string(rune(65))` is `"A"`, the character with that code point. For decimal text use `strconv.Itoa(65)` or `fmt.Sprint(65)`.

## Printing with fmt

`Println` separates arguments with spaces. `Printf` takes a format string with verbs. `Sprintf` returns the string instead of printing it.

| Verb | Prints |
| --- | --- |
| `%v` | any value in its default format |
| `%+v` / `%#v` | with field names / as Go syntax |
| `%T` | the value's type |
| `%d` | integer |
| `%f`, `%.2f` | float, with 2 decimals |
| `%s`, `%q` | string, quoted string |
| `%t` | bool |
| `%x`, `%b` | hexadecimal, binary |
| `%5d`, `%-8s` | pad to width 5 (right-aligned), 8 (left-aligned) |

```go playground
package main

import "fmt"

type Size int

const (
	_       = iota
	KB Size = 1 << (10 * iota)
	MB
	GB
)

func main() {
	var n int
	var s string
	var ok bool
	fmt.Printf("zero values: %v %q %v\n", n, s, ok)

	x := 7
	fmt.Println("int division:", x/2, "float division:", float64(x)/2)

	fmt.Printf("%v %T\n", MB, MB)
	fmt.Printf("|%5d|%-8s|%.2f|%x|\n", 42, "go", 3.14159, 255)
	fmt.Println(string(rune(71)), string(rune(0x1F600)))
}

// Try: change float64(x)/2 to x/2.0, then to float64(x/2), and compare.
```

## Exercises

### 1. Celsius to Fahrenheit

`CToF(c)` converts a temperature: multiply by 9/5 and add 32. Watch out: `9/5` on its own is an integer expression.

```go starter
package main

func CToF(c float64) float64 {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// freezing point
func TestFreezing(t *testing.T) {
	expect(t, CToF(0), 32.0)
}

// boiling point
func TestBoiling(t *testing.T) {
	expect(t, CToF(100), 212.0)
}

// where the scales meet
func TestMinusForty(t *testing.T) {
	expect(t, CToF(-40), -40.0)
}

// everyday temperatures, fractions included
func TestEveryday(t *testing.T) {
	expect(t, CToF(10), 50.0)
	expect(t, CToF(25), 77.0)
	expect(t, CToF(37.5), 99.5)
	expect(t, CToF(-10), 14.0)
}
```

#### Uses
- [Variables & types › Basic types](#/basics/basic-types)
- [Variables & types › Operators](#/basics/operators)
- [Variables & types › Constants and iota](#/basics/constants-and-iota)

#### Hints
- `c` is already a `float64`. Start the expression with it and every step stays floating point.
- Multiply by 9 first, then divide by 5, then add 32. Written as `(9/5)` on its own, the division happens between two integers and gives `1`.

#### Tips
- Untyped constants like `9`, `5` and `32` take the type of the value they meet, so this needs no conversions at all.
- `c*9/5 + 32` gives 212 for 100; `c*(9/5) + 32` gives 132. The parentheses make `9/5` a division of two untyped *integer* constants, which is 1.

#### Docs
- [Go spec: Constant expressions](https://go.dev/ref/spec#Constant_expressions)

### 2. Average of three

`Average(a, b, c)` returns the mean of three integers as a `float64`, without losing the fraction.

```go starter
package main

func Average(a, b, c int) float64 {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// whole result
func TestWholeAverage(t *testing.T) {
	expect(t, Average(1, 2, 3), 2.0)
	expect(t, Average(4, 4, 7), 5.0)
}

// keeps the fraction
func TestFractionalAverage(t *testing.T) {
	expect(t, Average(1, 2, 2), 5.0/3.0)
	expect(t, Average(0, 0, 1), 1.0/3.0)
	expect(t, Average(10, 20, 31), 61.0/3.0)
}

// negative numbers
func TestNegativeAverage(t *testing.T) {
	expect(t, Average(-1, -2, 0), -1.0)
	expect(t, Average(-1, -2, -2), -5.0/3.0)
}
```

#### Uses
- [Variables & types › Basic types](#/basics/basic-types)
- [Variables & types › Conversions are always explicit](#/basics/conversions-are-always-explicit)

#### Hints
- `a + b + c` is an `int`, and an `int` divided by 3 has already lost its fraction.
- Convert the sum to `float64` *before* you divide.

#### Tips
- `float64((a + b + c) / 3)` converts too late: the integer division has already truncated.
- The `3` needs no conversion. It is an untyped constant, so it becomes a `float64` the moment it meets one.

#### Docs
- [Go spec: Conversions](https://go.dev/ref/spec#Conversions)

### 3. Size units with iota

Rewrite the constant block so `KB` is 1024, `MB` is 1024 KB, and `GB` is 1024 MB, using `iota` rather than typing the numbers.

```go starter
package main

const (
	_  = iota
	KB = 0 // TODO: 1 << (10 * iota)
	MB = 0
	GB = 0
)
```

```go test
package main

import "testing"

// a kilobyte is 1024 bytes
func TestKB(t *testing.T) {
	expect(t, KB, 1024)
}

// a megabyte is 1024 kilobytes
func TestMB(t *testing.T) {
	expect(t, MB, 1024*1024)
	expect(t, MB, 1024*KB)
}

// a gigabyte is 1024 megabytes
func TestGB(t *testing.T) {
	expect(t, GB, 1024*1024*1024)
	expect(t, GB, 1024*MB)
}
```

#### Uses
- [Variables & types › Constants and iota](#/basics/constants-and-iota)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- In a `const` block, `iota` is 0 on the first line and goes up by one on every line.
- Write the expression once, on the `KB` line. Lines after it with no `=` repeat that expression with the next `iota`, so delete their `= 0`.

#### Tips
- `1 << n` is 2 to the power `n`, so each extra 10 in the shift multiplies by 1024.
- `iota` counts *lines* in the `const` block, not the ones you assign. The `_` line uses up 0, which is why `KB` lands on `iota == 1`.

#### Docs
- [Go spec: Iota](https://go.dev/ref/spec#Iota)
- [Effective Go: Constants](https://go.dev/doc/effective_go#constants)

### 4. Receipt line

`Line(item, qty, price)` formats one line of a receipt: quantity, item, unit price and total, prices with two decimals. For example `Line("apple", 3, 0.5)` is `"3 x apple @ 0.50 = 1.50"`. Use `fmt.Sprintf` and remember that `qty` is an `int`.

```go starter
package main

func Line(item string, qty int, price float64) string {
	return "" // TODO
}
```

```go test
package main

import "testing"

// three apples
func TestApples(t *testing.T) {
	expect(t, Line("apple", 3, 0.5), "3 x apple @ 0.50 = 1.50")
	expect(t, Line("egg", 12, 0.25), "12 x egg @ 0.25 = 3.00")
	expect(t, Line("green tea", 1, 4), "1 x green tea @ 4.00 = 4.00")
}

// rounds to cents, after multiplying
func TestRounding(t *testing.T) {
	expect(t, Line("coffee", 2, 3.333), "2 x coffee @ 3.33 = 6.67")
	expect(t, Line("pen", 4, 0.126), "4 x pen @ 0.13 = 0.50")
}

// zero quantity
func TestZeroQty(t *testing.T) {
	expect(t, Line("tea", 0, 2), "0 x tea @ 2.00 = 0.00")
	expect(t, Line("cake", 0, 3.75), "0 x cake @ 3.75 = 0.00")
}
```

#### Uses
- [Variables & types › Printing with fmt](#/basics/printing-with-fmt)
- [Variables & types › Conversions are always explicit](#/basics/conversions-are-always-explicit)
- [What is Go? › How the exercises here work](#/intro/how-the-exercises-here-work)

#### Hints
- One `fmt.Sprintf` call does it (remember `import "fmt"`): `%d` for the quantity, `%s` for the item, `%.2f` for each price.
- The total is quantity times price, but `qty` is an `int`. Convert it with `float64(qty)` before multiplying.

#### Tips
- `%.2f` rounds rather than truncates: 6.666 prints as `6.67`.
- Each verb rounds on its own, so a line need not add up. `Line("pen", 4, 0.126)` prints the unit price as `0.13` and the total as `0.50`, because the total rounds `0.504`.

#### Docs
- [fmt: Printing](https://pkg.go.dev/fmt#hdr-Printing)
