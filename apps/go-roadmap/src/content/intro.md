# What is Go?

Go is a small, statically typed, compiled language with garbage collection, built at Google for large codebases and networked services. It deliberately leaves features out so that any Go code you open reads like the code you write.

## Why Go looks the way it does

Go was designed by people tired of slow builds and clever code. The result trades expressiveness for predictability:

- **Compiled to one static binary.** No runtime to install, no `node_modules`, no virtualenv. `go build` gives you a file you can copy to a server and run.
- **Fast compiles.** Big projects build in seconds, so the edit-run loop feels like a scripting language.
- **Garbage collected.** You never free memory, but you do get real pointers and control over memory layout.
- **Concurrency built in.** Goroutines and channels are part of the language, not a library.
- **Small spec.** One loop keyword, no classes, no inheritance, no exceptions, no operator overloading. Generics exist but stay modest.

If you come from TypeScript or Python, expect to write a little more code and read a lot less cleverness.

## Hello, world

```go
package main

import "fmt"

func main() {
	fmt.Println("Hello, world")
}
```

Every Go file starts with a `package` clause. The package named `main` is special: it builds into a program, and its `func main()` is where execution starts. `import` pulls in other packages; `fmt` is the standard formatting and printing package.

Names are scoped by package and visibility is decided by case: `fmt.Println` is callable from outside `fmt` because it starts with a capital letter. A lowercase name like `fmt.newPrinter` is private to its package. There are no `public` or `export` keywords.

## The compiler is strict

Go refuses to compile code that other languages would only warn about:

```go
import "os" // error: "os" imported and not used

func main() {
	x := 5 // error: declared and not used: x
}
```

Unused imports and unused local variables are **compile errors**. This keeps code clean but surprises everyone at first. When you are experimenting, delete the line or assign to the blank identifier: `_ = x`.

## One format, no debates

`gofmt` (run as `go fmt`) rewrites your code into the one official style: tabs for indentation, aligned fields, braces on the same line. Every editor runs it on save. Nobody argues about style in Go, and you should not either.

Semicolons exist in the grammar, but the lexer inserts them at line ends, so you never type them. That is also why an opening brace must stay on the same line as `if`, `for` or `func`.

## The toolchain

The `go` command does everything; there is no separate build tool, test runner, or formatter to pick.

```text
go mod init example.com/hello   create a module (a project) with a go.mod file
go run .                        compile and run the package in this directory
go build                        produce a binary
go test ./...                   run all tests
go fmt ./...                    format everything
go vet ./...                    catch suspicious code the compiler allows
go get example.com/some/lib     add a dependency
```

## What is different from TypeScript and Python

| You are used to | In Go |
| --- | --- |
| `class`, `extends` | structs with methods, embedding instead of inheritance |
| `try` / `catch` | functions return an `error` value you check with `if err != nil` |
| `null` / `undefined` / `None` | zero values: `0`, `""`, `false`, and `nil` for pointers, slices, maps |
| `async` / `await` | goroutines (`go f()`) and channels; code stays synchronous-looking |
| duck typing / structural TS types | interfaces, satisfied implicitly by any type with the right methods |
| `npm` / `pip` | modules in `go.mod`, fetched by the `go` command |

## How the exercises here work

Each exercise gives you a file in `package main` without a `func main`. Tests call your functions directly and show what they expected next to what they got. Your job is to replace the `// TODO` stubs so every test passes. The code runs on the official Go Playground, so it is real Go.

You can read the tests from the first exercise on, so it is worth knowing their five moving parts now. The Testing module covers the subject properly much later; nothing here has to be memorized.

```go
package main

import "testing"

// greets ada
func TestGreetAda(t *testing.T) {
	expect(t, Greet("Ada"), "Hello, Ada!")
}
```

- `func TestXxx(t *testing.T)` is one test. Go finds them by that name and signature. `t` is the handle used to report failures.
- The `//` comment above a test is the label you see next to its result on this page.
- `expect(t, got, want)` is a small helper this site adds, not part of Go. It compares the two values and reports a failure when they differ. It compares *deeply*, so a whole slice, map or struct can be checked in one line.
- `t.Errorf("...", args)` records a failure and keeps going; `t.Fatalf` records one and stops that test. Tests you see using them directly are checking something `expect` cannot phrase.
- A panic fails only the test it happened in. The others still run.

[Reference › How the tests here work](#/reference/how-the-tests-here-work) has the full details, including why a nil slice and an empty slice count as different.

The runnable example below is a complete program. `fmt.Sprintf` works like `Println` but returns the string instead of printing it; `%s` is replaced by a string argument and `%d` by an integer.

```go playground
package main

import "fmt"

func greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func main() {
	fmt.Println(greet("Gopher"))
	fmt.Println("2 + 3 =", 2+3)
	fmt.Printf("%s was released in %d\n", "Go", 2009)
}

// Try: add `x := 1` inside main without using x, and read the compile error.
```

## Exercises

### 1. Hello, Go

Make `Greeting` return exactly `"Hello, Go!"`.

```go starter
package main

func Greeting() string {
	return "" // TODO
}
```

```go test
package main

import "testing"

// returns the greeting
func TestGreeting(t *testing.T) {
	expect(t, Greeting(), "Hello, Go!")
}
```

#### Uses
- [What is Go? › Hello, world](#/intro/hello-world)
- [What is Go? › How the exercises here work](#/intro/how-the-exercises-here-work)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- A function with a `string` result hands its value back with `return`.
- Replace the empty string `""` with the exact text, comma and exclamation mark included.

#### Tips
- `Greeting` starts with a capital letter, so it is exported: code in other packages could call it too.
- `expect` compares the two strings exactly. A trailing space or a missing `!` is a failure like any other, and the result panel shows both strings so you can spot the difference.

#### Docs
- [A Tour of Go: Packages](https://go.dev/tour/basics/1)
- [Tutorial: Get started with Go](https://go.dev/doc/tutorial/getting-started)

### 2. Greet by name

`Greet(name)` returns `"Hello, <name>!"`. Use `fmt.Sprintf` with the `%s` verb. You need to add `import "fmt"` at the top yourself, and Go will not let you import it without using it.

```go starter
package main

func Greet(name string) string {
	return "" // TODO: fmt.Sprintf("Hello, %s!", name)
}
```

```go test
package main

import "testing"

// greets ada
func TestGreetAda(t *testing.T) {
	expect(t, Greet("Ada"), "Hello, Ada!")
}

// greets gophers
func TestGreetGopher(t *testing.T) {
	expect(t, Greet("Gopher"), "Hello, Gopher!")
}

// keeps the whole name, spaces and accents included
func TestGreetFullName(t *testing.T) {
	expect(t, Greet("Ada Lovelace"), "Hello, Ada Lovelace!")
	expect(t, Greet("Zoë"), "Hello, Zoë!")
}
```

#### Uses
- [What is Go? › Hello, world](#/intro/hello-world)
- [What is Go? › The compiler is strict](#/intro/the-compiler-is-strict)
- [What is Go? › How the exercises here work](#/intro/how-the-exercises-here-work)

#### Hints
- Add `import "fmt"` on its own line under `package main`.
- `fmt.Sprintf` takes a format string and then the values to fill in. `%s` marks the spot where `name` goes.

#### Tips
- `Sprintf` returns the string. `Printf` prints it instead, which is not what a function returning a `string` wants.
- Three tests run here, each with its own name. They all call the same function, so one wrong character fails all three at once.

#### Docs
- [fmt.Sprintf](https://pkg.go.dev/fmt#Sprintf)
