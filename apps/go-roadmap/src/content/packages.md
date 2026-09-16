# Packages & modules

A package is a directory of `.go` files that compile together, and a module is a tree of packages versioned as a unit by a `go.mod` file. Visibility is decided by one rule: names that start with an uppercase letter are exported.

## Packages are directories

Every file starts with a `package` clause, and all files in one directory must share it. The package name is usually the last element of its import path.

```text
shop/
├── go.mod                 module example.com/shop
├── main.go                package main
├── cart/
│   ├── cart.go            package cart
│   └── cart_test.go       package cart
└── internal/
    └── pricing/
        └── pricing.go     package pricing
```

`package main` with a `func main()` builds an executable. Any other package name builds a library. There are no per-file modules like in JavaScript or Python: a function in `cart.go` can call an unexported helper in another file of the same directory without importing anything.

## Exported names

```go
package cart

type Cart struct {
	Items []Item // exported field
	owner string // unexported: invisible outside package cart
}

func New(owner string) *Cart { return &Cart{owner: owner} } // exported
func (c *Cart) total() int    { return 0 }                    // unexported method
```

That's the whole access control system: uppercase is public, lowercase is package-private. There's no `protected`, no `friend`, no per-file privacy. Unexported fields plus an exported constructor (`New`, `NewCart`) is how you protect invariants.

Callers always write the package name, so don't repeat it: `cart.New`, not `cart.NewCart`; `http.Server`, not `http.HTTPServer`.

## Imports

```go
import (
	"fmt"                  // standard library
	"strings"

	"example.com/shop/cart" // your module
	"github.com/google/uuid" // third party, recorded in go.mod

	crand "crypto/rand"    // alias to avoid a clash with math/rand
	_ "image/png"          // import only for its side effects (init)
)
```

An unused import is a compile error, like an unused variable. Your editor's `goimports` adds and removes them for you. Circular imports are also a compile error, which forces a layered design.

Watch out for shadowing: a variable called `url` or `strings` hides the package of the same name for the rest of that scope.

## go.mod

```text
module example.com/shop

go 1.26

require github.com/google/uuid v1.6.0
```

`go mod init example.com/shop` creates it. `go get github.com/google/uuid` adds a dependency, `go mod tidy` syncs `go.mod` and `go.sum` with what the code actually imports, and `go.sum` pins checksums. The module path doesn't have to be a real URL until you publish.

Commands take package paths: `go build ./...`, `go test ./cart`, `go run .`.

## internal/

A package under a directory named `internal` can only be imported by code rooted at the parent of `internal`. `example.com/shop/internal/pricing` is importable from `shop/cart` but not from any other module. It's the compiler-enforced way to share code across your packages without making it public API.

## Package-level variables and init

Package-level variables are initialized before `main` runs, in dependency order rather than source order:

```go
var total = price * qty // runs after price and qty, wherever they are declared
var price = 3
var qty = count()

func count() int { return 4 }
```

Then each `init()` function runs, in the order they appear in the file (a package may have several). Every imported package finishes initializing before yours starts.

```go
var sqrt2 float64

func init() {
	sqrt2 = math.Sqrt(2)
}
```

Use `init` sparingly: for computed tables, or for registration, the way `import _ "image/png"` registers a decoder with the `image` package. Hidden work at startup makes code hard to test. Prefer explicit setup in `main`, and never do I/O that can fail in `init`.

## Using the standard library

The standard library is large and consistent, and Go code leans on it instead of small third-party packages. Names read well with their package: `strings.Contains`, `strconv.Itoa`, `unicode.IsUpper`, `path.Join`.

```go playground
package main

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

var greeting = prefix + name // initialized after prefix and name

var prefix = "Hello, "
var name = strings.ToUpper("gopher")

var digits int

func init() {
	for _, r := range "Go 1.26 shipped in 2026" {
		if unicode.IsDigit(r) {
			digits++
		}
	}
}

func main() {
	fmt.Println(greeting)
	fmt.Println("digits counted in init:", digits)

	n, err := strconv.Atoi("12a")
	fmt.Println(n, err)

	before, after, found := strings.Cut("key=value", "=")
	fmt.Println(before, after, found)
}

// Try: add a second func init() that prints something, and note when it runs.
```

## Exercises

### 1. Slugs from the standard library

`Slug(title)` turns a title into a URL slug: lowercase words joined by `-`, where anything that isn't a letter or digit separates words.

`Slug("  Hello, World! Go 1.26 ")` is `"hello-world-go-1-26"`.

Everything you need is in the standard library: `strings.ToLower`, `strings.FieldsFunc(s, f)` (splits `s` wherever `f(r)` is true for a rune `r`, dropping empty pieces), `strings.Join(parts, "-")`, and `unicode.IsLetter` / `unicode.IsDigit`.

```go starter
package main

func Slug(title string) string {
	return "" // TODO
}
```

```go test
package main

import "testing"

// lowercases and joins words with dashes
func TestSlugBasic(t *testing.T) {
	expect(t, Slug("Hello World"), "hello-world")
	expect(t, Slug("  Hello, World! Go 1.26 "), "hello-world-go-1-26")
}

// collapses runs of separators
func TestSlugSeparators(t *testing.T) {
	expect(t, Slug("a -- b__c...d"), "a-b-c-d")
	expect(t, Slug("Crème Brûlée"), "crème-brûlée")
	expect(t, Slug("!!!"), "")
}

// single words, digits and empty input
func TestSlugEdges(t *testing.T) {
	expect(t, Slug("Go"), "go")
	expect(t, Slug("v2 Release"), "v2-release")
	expect(t, Slug("  --Trim me--  "), "trim-me")
	expect(t, Slug(""), "")
}
```

#### Uses
- [Packages & modules › Using the standard library](#/packages/using-the-standard-library)
- [Packages & modules › Imports](#/packages/imports)
- [Functions › Functions are values](#/functions/functions-are-values)
- [Strings & runes › The strings package](#/strings/the-strings-package)

#### Hints
- Lowercase the whole title first, then split it into words.
- `strings.FieldsFunc` wants a `func(r rune) bool` that returns `true` for separators: a rune that is neither a letter nor a digit.
- Join the pieces with `"-"`. `FieldsFunc` already dropped the empty ones, so runs of separators collapse on their own.

#### Tips
- `unicode.IsLetter` knows about accents, so `Crème` stays one word. A check like `r >= 'a' && r <= 'z'` would split it.
- Lowercase before splitting, not after. Then the separator function never has to think about case, and neither does `Join`.
- `FieldsFunc` drops empty pieces, so `"a -- b"` collapses on its own and `"!!!"` gives no pieces at all. That is the empty-slug case handled for free.

#### Docs
- [strings.FieldsFunc](https://pkg.go.dev/strings#FieldsFunc)
- [unicode.IsLetter](https://pkg.go.dev/unicode#IsLetter)

### 2. Parse once, in init

`ParseVersion(v)` splits a `"major.minor.patch"` string into three ints.

- If there aren't exactly three dot-separated parts, return `ErrBadVersion` wrapped with the input: `version "1.2": bad version`. `strings.Cut(s, ".")` returns the text before and after the first dot plus whether it found one.
- If a part isn't a number, wrap the `strconv.Atoi` error: `version "1.x.3": strconv.Atoi: parsing "x": invalid syntax`.

Then write an `init` function that parses the package-level `Version` into `Major`, `Minor` and `Patch`, and panics if that fails: a malformed constant is a programmer error, which is what panic is for.

```go starter
package main

import "errors"

const Version = "1.4.12"

var ErrBadVersion = errors.New("bad version")

var Major, Minor, Patch int

func ParseVersion(v string) (major, minor, patch int, err error) {
	// TODO
	return 0, 0, 0, nil
}

// TODO: func init() that fills Major, Minor and Patch from Version
```

```go test
package main

import (
	"errors"
	"strconv"
	"testing"
)

// parses three numbers
func TestParseVersion(t *testing.T) {
	a, b, c, err := ParseVersion("2.10.0")
	expect(t, []int{a, b, c}, []int{2, 10, 0})
	expect(t, err, nil)
	a, b, c, err = ParseVersion("0.7.123")
	expect(t, []int{a, b, c}, []int{0, 7, 123})
	expect(t, err, nil)
}

// rejects the wrong number of parts
func TestParseVersionParts(t *testing.T) {
	for _, v := range []string{"1.2", "1", "", "1.2.3.4", "1.2.3."} {
		if _, _, _, err := ParseVersion(v); !errors.Is(err, ErrBadVersion) {
			t.Fatalf("ParseVersion(%q): want ErrBadVersion, got %v", v, err)
		}
	}
	_, _, _, err := ParseVersion("1.2")
	expect(t, err.Error(), `version "1.2": bad version`)
	_, _, _, err = ParseVersion("1.2.3.4")
	expect(t, err.Error(), `version "1.2.3.4": bad version`)
}

// wraps the Atoi error, whichever part is bad
func TestParseVersionNumber(t *testing.T) {
	for _, v := range []string{"1.x.3", "a.2.3", "1.2.z", "1..3"} {
		if _, _, _, err := ParseVersion(v); !errors.Is(err, strconv.ErrSyntax) {
			t.Fatalf("ParseVersion(%q): want an error wrapping strconv.ErrSyntax, got %v", v, err)
		}
	}
	_, _, _, err := ParseVersion("1.x.3")
	expect(t, err.Error(), `version "1.x.3": strconv.Atoi: parsing "x": invalid syntax`)
	_, _, _, err = ParseVersion("1.2.z")
	expect(t, err.Error(), `version "1.2.z": strconv.Atoi: parsing "z": invalid syntax`)
}

// init filled the package-level vars
func TestInitRan(t *testing.T) {
	expect(t, []int{Major, Minor, Patch}, []int{1, 4, 12})
}
```

#### Uses
- [Packages & modules › Package-level variables and init](#/packages/package-level-variables-and-init)
- [Packages & modules › Using the standard library](#/packages/using-the-standard-library)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)
- [Errors › `panic`, `defer` and `recover`](#/errors/panic-defer-and-recover)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- Cut twice: the first `strings.Cut(v, ".")` gives the major part and the rest, the second splits the rest into minor and patch. If either cut finds no dot, there are too few parts.
- Too many parts means the patch piece still contains a dot. A third `strings.Cut` on it must find none.
- In `init`, assign to the package-level variables with `=`, not `:=`. Declare `err` first with `var err error`.

#### Tips
- `Major, Minor, Patch, err := ParseVersion(Version)` inside `init` compiles, but it declares new local variables that hide the package-level ones, which stay 0.
- `init` runs before any test, so the last test really only checks that you wrote one at all.

#### Docs
- [strings.Cut](https://pkg.go.dev/strings#Cut)
- [Effective Go: The init function](https://go.dev/doc/effective_go#init)

### 3. A registry filled by init

This is the pattern behind `import _ "image/png"`: packages register themselves in a table during `init`, and callers look them up by name. The table is a map, Go's built-in hash table. The maps module covers it in full; here you only need to store and look up:

```go
ages := map[string]int{}
ages["ada"] = 36     // store 36 under the key "ada"
n, ok := ages["bob"] // look up: ok is false (and n is 0) when the key is missing
```

- `Register(name, fn)` adds a codec. Registering the same name twice is a programmer error: `panic` with a message like `codec "upper" registered twice`.
- `Encode(name, s)` runs the named codec on `s`. An unknown name returns `ErrUnknownCodec` wrapped as `codec "rot13": unknown codec`.
- Add two `init` functions: one registers `"upper"` using `strings.ToUpper` (a function value, no call), the other registers `"lower"` using `strings.ToLower`.

```go starter
package main

import "errors"

var ErrUnknownCodec = errors.New("unknown codec")

var codecs = map[string]func(string) string{}

func Register(name string, fn func(string) string) {
	// TODO
}

func Encode(name, s string) (string, error) {
	// TODO
	return "", nil
}
```

```go test
package main

import (
	"errors"
	"testing"
)

// init registered upper and lower
func TestBuiltinCodecs(t *testing.T) {
	s, err := Encode("upper", "Go")
	expect(t, s, "GO")
	expect(t, err, nil)
	s, err = Encode("lower", "Go")
	expect(t, s, "go")
	expect(t, err, nil)
	s, _ = Encode("upper", "hello, world")
	expect(t, s, "HELLO, WORLD")
}

// unknown names return ErrUnknownCodec
func TestUnknownCodec(t *testing.T) {
	_, err := Encode("rot13", "Go")
	if !errors.Is(err, ErrUnknownCodec) {
		t.Fatalf("want ErrUnknownCodec, got %v", err)
	}
	expect(t, err.Error(), `codec "rot13": unknown codec`)
	_, err = Encode("base64", "Go")
	if !errors.Is(err, ErrUnknownCodec) {
		t.Fatalf("want ErrUnknownCodec, got %v", err)
	}
	expect(t, err.Error(), `codec "base64": unknown codec`)
}

// Register adds new codecs
func TestRegister(t *testing.T) {
	Register("twice", func(s string) string { return s + s })
	s, err := Encode("twice", "ab")
	expect(t, s, "abab")
	expect(t, err, nil)
	Register("first", func(s string) string { return s[:1] })
	s, _ = Encode("first", "xyz")
	expect(t, s, "x")
}

// panics reports whether f panicked.
func panics(f func()) (didPanic bool) {
	defer func() { didPanic = recover() != nil }()
	f()
	return false
}

// registering a name twice panics
func TestRegisterDuplicate(t *testing.T) {
	if !panics(func() { Register("upper", func(s string) string { return s }) }) {
		t.Error(`want a panic for registering "upper" again`)
	}
	if panics(func() { Register("echo", func(s string) string { return s }) }) {
		t.Fatal(`registering a new name panicked`)
	}
	if !panics(func() { Register("echo", func(s string) string { return s }) }) {
		t.Error(`want a panic for registering "echo" twice`)
	}
}
```

#### Uses
- [Packages & modules › Package-level variables and init](#/packages/package-level-variables-and-init)
- [Functions › Functions are values](#/functions/functions-are-values)
- [Errors › Wrapping with `%w`](#/errors/wrapping-with-w)
- [Errors › `panic`, `defer` and `recover`](#/errors/panic-defer-and-recover)
- [Strings & runes › The strings package](#/strings/the-strings-package)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- `Register` looks the name up first with the two-value form. If it's already there, `panic` with a message built by `fmt.Sprintf` and `%q`; otherwise store `fn`.
- `Encode` does the same lookup. A missing name returns `ErrUnknownCodec` wrapped with `%w`; a found one is simply called, `fn(s)`.
- Pass `strings.ToUpper` without parentheses: you're handing over the function, not calling it.

#### Tips
- Every `init` runs before `main` and before any test, so the built-in codecs are registered by the time anything calls `Encode`.
- `strings.ToUpper` already has the type `func(string) string`, so it drops straight into the map with no wrapper function around it.
- Registration panics rather than returning an error on purpose: a duplicate name is a mistake in the program's own source, not a bad input.

#### Docs
- [Effective Go: The init function](https://go.dev/doc/effective_go#init)
- [Effective Go: Maps](https://go.dev/doc/effective_go#maps)
