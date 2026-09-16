# Strings & runes

A Go string is an immutable sequence of bytes, almost always UTF-8 text. Indexing and `len` work on bytes; `range` decodes characters, which Go calls runes.

## Bytes, not characters

```go
s := "héllo"
len(s)    // 6: é takes two bytes in UTF-8
s[0]      // 104, a byte (uint8), not "h"
s[1]      // 195, the first byte of é
s[1:3]    // "é": slicing uses byte offsets too
s[0] = 'H' // compile error: strings are immutable
```

In TypeScript `"héllo".length` counts UTF-16 code units, in Python `len` counts code points. Go counts bytes. Byte offsets are fast and exact, but slicing in the middle of a multi-byte character gives you broken text.

## Runes

A `rune` is an `int32` holding one Unicode code point. Single quotes make a rune literal:

```go
var r rune = 'é'      // 233
fmt.Println(r)        // 233
fmt.Printf("%c %U\n", r, r) // é U+00E9
string(r)             // "é"
'a' + 1               // 98, which is 'b'
```

Count runes with `utf8.RuneCountInString(s)` from `unicode/utf8`, or convert: `[]rune(s)` copies the string into a slice of runes you can index and modify, and `string(runes)` turns it back. `[]byte(s)` does the same with bytes.

What a reader sees as one character can still be several runes: an emoji with a skin tone, or `e` followed by a combining accent. Runes are code points, not graphemes.

## range decodes UTF-8

A `for` loop with `range` over a string yields the *byte index* where each rune starts, and the rune itself:

```go
for i, r := range "héllo" {
	fmt.Println(i, string(r))
}
// 0 h
// 1 é
// 3 l   (index jumps: é used bytes 1 and 2)
// 4 l
// 5 o
```

A classic `for i := 0; i < len(s); i++` loop over `s[i]` walks bytes instead. Use it only for ASCII-only data. Invalid UTF-8 bytes come out of `range` as `U+FFFD`, the replacement character.

The `unicode` package classifies runes: `unicode.IsLetter`, `IsDigit`, `IsSpace`, `IsUpper`, `ToUpper`.

## Literals

```go
"tab\tnewline\n"                // interpreted: escapes work
`C:\path\no\escapes`            // raw: backticks, no escapes, can span lines
"a" + "b"                       // concatenation
"apple" < "banana"              // true: byte-wise comparison
```

## The strings package

```go
strings.Contains("seafood", "foo")      // true
strings.HasPrefix(s, "http")            // also HasSuffix
strings.Index("chicken", "ken")         // 4, or -1 if missing
strings.ToUpper("go")                   // "GO"
strings.ToLower("Go GO")                // "go go"
strings.TrimSpace("  hi \n")            // "hi"
strings.Trim("--hi--", "-")             // "hi"
strings.Replace(s, "a", "b", -1)        // -1 means all; also ReplaceAll
strings.Repeat("ab", 3)                 // "ababab"
strings.EqualFold("Go", "GO")           // true: case-insensitive equality
strings.Split("a,b,c", ",")             // []string{"a", "b", "c"}
strings.Fields("  a  b c ")             // []string{"a", "b", "c"}: splits on any whitespace
strings.Join([]string{"a", "b"}, "-")   // "a-b"
```

`strings.FieldsFunc(s, f)` is `Fields` with your own idea of a separator: it splits wherever `f(r)` is true for a rune, and drops the empty pieces, so runs of separators collapse on their own.

```go
sep := func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) }
strings.FieldsFunc("a1-b2--c", sep) // []string{"a1", "b2", "c"}
strings.FieldsFunc("!!!", sep)      // []string{}: no pieces at all
```

`Split` and `Fields` return a `[]string`, a slice of strings. The Arrays & slices module covers slices properly; for now, `range` over one gives you each element: `for _, part := range parts { ... }`.

These are functions, not methods. There is no `"abc".upper()`; you write `strings.ToUpper("abc")`.

## Numbers and text: strconv

```go
strconv.Itoa(42)                   // "42"
n, err := strconv.Atoi("42")       // 42, nil
_, err = strconv.Atoi("4x")        // err != nil
f, _ := strconv.ParseFloat("2.5", 64)
b, _ := strconv.ParseBool("true")
strconv.FormatInt(255, 2)          // "11111111"
strconv.Quote("hi\n")              // "\"hi\\n\""
```

Parsing can fail, so the parse functions return a value and an `error`. Go has no exceptions; you check the error right away and pass it up. The Errors module covers this pattern fully; for now it looks like this:

```go
n, err := strconv.Atoi(text)
if err != nil {
	return 0, err
}
```

## Building strings

Every `+` allocates a new string, so concatenating in a loop is quadratic. `strings.Builder` appends into a growing buffer:

```go
var b strings.Builder // the zero value is ready to use
for i := range 3 {
	b.WriteString("item")
	b.WriteByte(' ')
	b.WriteRune('→')
	fmt.Fprintf(&b, "%d;", i)
}
b.String() // "item →0;item →1;item →2;"
```

For a handful of pieces, `+` or `fmt.Sprintf` is fine.

```go playground
package main

import (
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"
)

func main() {
	s := "Go é 日本"
	fmt.Println(len(s), "bytes,", utf8.RuneCountInString(s), "runes")

	for i, r := range s {
		fmt.Printf("%d:%c ", i, r)
	}
	fmt.Println()

	fmt.Println(s[0], s[3:5], string([]rune(s)[5]))

	words := strings.Fields("  the quick  brown fox ")
	fmt.Println(len(words), strings.Join(words, "_"))

	var b strings.Builder
	for i := range 5 {
		b.WriteString(strconv.Itoa(i * i))
		b.WriteByte(',')
	}
	fmt.Println(strings.TrimSuffix(b.String(), ","))

	if _, err := strconv.Atoi("12a"); err != nil {
		fmt.Println("error:", err)
	}
}

// Try: print s[3:4] and see what half of é looks like.
```

## Exercises

### 1. Bytes and runes

`Lengths(s)` returns two numbers: how many bytes the string takes and how many runes it contains.

```go starter
package main

func Lengths(s string) (bytes, runes int) {
	return 0, 0 // TODO
}
```

```go test
package main

import "testing"

// ascii: bytes and runes agree
func TestASCII(t *testing.T) {
	b, r := Lengths("hello")
	expect(t, b, 5)
	expect(t, r, 5)
	b, r = Lengths("")
	expect(t, b, 0)
	expect(t, r, 0)
}

// an accent takes two bytes
func TestAccent(t *testing.T) {
	b, r := Lengths("héllo")
	expect(t, b, 6)
	expect(t, r, 5)
	b, r = Lengths("café crème")
	expect(t, b, 12)
	expect(t, r, 10)
}

// cjk takes three bytes per rune
func TestCJK(t *testing.T) {
	b, r := Lengths("日本")
	expect(t, b, 6)
	expect(t, r, 2)
}

// an emoji takes four bytes
func TestEmoji(t *testing.T) {
	b, r := Lengths("😀")
	expect(t, b, 4)
	expect(t, r, 1)
	b, r = Lengths("Go 😀 日本")
	expect(t, b, 14)
	expect(t, r, 7)
}
```

#### Uses
- [Strings & runes › Bytes, not characters](#/strings/bytes-not-characters)
- [Strings & runes › Runes](#/strings/runes)

#### Hints
- `len(s)` counts bytes.
- `utf8.RuneCountInString(s)` counts runes. Add `import "unicode/utf8"`, then return both numbers, bytes first, separated by a comma.

#### Tips
- `len([]rune(s))` gives the same rune count, but copies the whole string to get it.
- Return them in the order the signature declares. Named results are documentation, not a safety net: `return runes, bytes` compiles just as happily.

#### Docs
- [utf8.RuneCountInString](https://pkg.go.dev/unicode/utf8#RuneCountInString)

### 2. Reverse by runes

`Reverse(s)` returns the string with its characters in reverse order. Reversing bytes would mangle anything outside ASCII, so work rune by rune: `range` over the string hands you one rune at a time, and `string(r)` turns a rune back into a string you can join with `+`.

```go starter
package main

func Reverse(s string) string {
	return s // TODO
}
```

```go test
package main

import "testing"

// reverses ascii
func TestReverseASCII(t *testing.T) {
	expect(t, Reverse("abc"), "cba")
	expect(t, Reverse("abcd"), "dcba")
	expect(t, Reverse("Go is fun"), "nuf si oG")
}

// keeps multi-byte characters intact
func TestReverseUnicode(t *testing.T) {
	expect(t, Reverse("héllo"), "olléh")
	expect(t, Reverse("日本語"), "語本日")
	expect(t, Reverse("a😀b"), "b😀a")
}

// empty and short
func TestReverseShort(t *testing.T) {
	expect(t, Reverse(""), "")
	expect(t, Reverse("x"), "x")
	expect(t, Reverse("ab"), "ba")
}
```

#### Uses
- [Strings & runes › range decodes UTF-8](#/strings/range-decodes-utf-8)
- [Strings & runes › Runes](#/strings/runes)
- [Strings & runes › Literals](#/strings/literals)

#### Hints
- Start from an empty result string and `range` over `s`, ignoring the byte index with `_`.
- Put each new rune in *front* of what you have so far, not behind it.

#### Tips
- Every `+` copies the string, so this gets slow on long text. Once you know slices, converting to `[]rune` and swapping from both ends is the faster way.
- `string(r)` on a rune gives its character. The same conversion on a count would give the character with that code point, which is why digits need `strconv.Itoa`.

#### Docs
- [Go spec: For statements with range clause](https://go.dev/ref/spec#For_range)

### 3. Run-length encoding

`Encode(s)` replaces each run of identical characters with the character followed by the length of the run: `"aaabcc"` becomes `"a3b1c2"`. Work on runes, not bytes, and build the result with a `strings.Builder`.

You need an `if` to notice where a run ends. It works like TypeScript's, without parentheses around the condition and with braces always required:

```go
if count > 9 {
	fmt.Println("long run")
} else {
	fmt.Println("short run")
}
```

```go starter
package main

func Encode(s string) string {
	return "" // TODO
}
```

```go test
package main

import "testing"

// encodes runs
func TestRuns(t *testing.T) {
	expect(t, Encode("aaabcc"), "a3b1c2")
	expect(t, Encode("abc"), "a1b1c1")
	expect(t, Encode("x"), "x1")
}

// a character that comes back starts a new run
func TestRepeatedRuns(t *testing.T) {
	expect(t, Encode("aabaa"), "a2b1a2")
	expect(t, Encode("abab"), "a1b1a1b1")
}

// long runs use several digits
func TestLongRun(t *testing.T) {
	expect(t, Encode("zzzzzzzzzzzz"), "z12")
	expect(t, Encode("qqqqqqqqqqr"), "q10r1")
}

// counts runes, not bytes
func TestUnicodeRuns(t *testing.T) {
	expect(t, Encode("héé"), "h1é2")
	expect(t, Encode("日日日本"), "日3本1")
	expect(t, Encode("😀😀"), "😀2")
}

// empty input
func TestEmptyEncode(t *testing.T) {
	expect(t, Encode(""), "")
}
```

#### Uses
- [Strings & runes › range decodes UTF-8](#/strings/range-decodes-utf-8)
- [Strings & runes › Building strings](#/strings/building-strings)
- [Strings & runes › Numbers and text: strconv](#/strings/numbers-and-text-strconv)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- As you `range`, remember the previous rune and how many times in a row you have seen it.
- When the rune changes, write the previous rune and its count to the builder, then start a new run at 1.
- The last run never sees a change, so write it after the loop, but only if the input was not empty.

#### Tips
- `b.WriteRune(rune(count))` would write the character with that code point. Use `strconv.Itoa(count)` for digits.
- You need to know whether there *is* a previous rune yet. A `count` of 0 marks the first iteration, and lets the "write the last run" step after the loop skip an empty input for free.

#### Docs
- [strings.Builder](https://pkg.go.dev/strings#Builder)
- [Go spec: If statements](https://go.dev/ref/spec#If_statements)

### 4. Sum a CSV line

`SumCSV(s)` adds up comma-separated integers such as `"4, 5 ,6"`, ignoring spaces around each number. If any field is not a number, return the error from `strconv.Atoi`. An empty field, like the middle one in `"1,,2"`, is not a number. An empty input sums to 0. Careful: `strings.Split("", ",")` returns one empty string, not zero strings.

```go starter
package main

func SumCSV(s string) (int, error) {
	return 0, nil // TODO
}
```

```go test
package main

import (
	"strconv"
	"testing"
)

// sums the fields
func TestSum(t *testing.T) {
	n, err := SumCSV("1,2,3")
	expect(t, n, 6)
	expect(t, err, nil)
	n, err = SumCSV("42")
	expect(t, n, 42)
	expect(t, err, nil)
}

// trims spaces around numbers
func TestSpaces(t *testing.T) {
	n, err := SumCSV(" 4, 5 ,6 ")
	expect(t, n, 15)
	expect(t, err, nil)
	n, err = SumCSV("  10  ")
	expect(t, n, 10)
	expect(t, err, nil)
}

// negative numbers
func TestNegatives(t *testing.T) {
	n, err := SumCSV("10,-3")
	expect(t, n, 7)
	expect(t, err, nil)
	n, err = SumCSV("-1, -2")
	expect(t, n, -3)
	expect(t, err, nil)
}

// reports a bad field, empty fields included
func TestBadField(t *testing.T) {
	for _, s := range []string{"1,x,3", "1,,2", "5,", "1.5"} {
		if _, err := SumCSV(s); err == nil {
			t.Errorf("SumCSV(%q): expected an error, got nil", s)
		}
	}
}

// the error is the one strconv.Atoi gives
func TestAtoiError(t *testing.T) {
	_, err := SumCSV("1, x ,3")
	_, want := strconv.Atoi("x")
	expect(t, err, want)
}

// empty input is zero
func TestEmptyCSV(t *testing.T) {
	n, err := SumCSV("")
	expect(t, n, 0)
	expect(t, err, nil)
}
```

#### Uses
- [Strings & runes › The strings package](#/strings/the-strings-package)
- [Strings & runes › Numbers and text: strconv](#/strings/numbers-and-text-strconv)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- `strings.Split(s, ",")` gives the fields. `range` over them and `strings.TrimSpace` each one before `strconv.Atoi`.
- Return the error the moment `Atoi` reports one, with the `if err != nil` shape from the strconv section.
- Check for `""` first, before splitting, and return `0, nil` right there.

#### Tips
- `strconv.Atoi(" 5")` fails: it does not skip spaces for you, which is why the trim matters.
- The last test compares your error with the one `strconv.Atoi("x")` produces, so return `Atoi`'s error unchanged here. Wrapping it with `%w` would be better style in real code and would fail this test.

#### Docs
- [strings.Split](https://pkg.go.dev/strings#Split)
- [strconv.Atoi](https://pkg.go.dev/strconv#Atoi)
