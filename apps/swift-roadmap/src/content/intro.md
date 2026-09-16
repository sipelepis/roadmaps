# What is Swift?

Swift is Apple's language for iOS, macOS, watchOS, and increasingly for servers and command-line tools. It is statically typed with heavy type inference, safe by default about nullability and memory, and fast, because it compiles ahead of time to native code through LLVM.

Every module here is an article, a playground you can edit and run, and exercises with real tests. Your code is compiled and run by a real `swiftc`, so this is the actual compiler with its actual error messages.

## Hello, Swift

A Swift file runs top to bottom. There is no required `main` function: statements at the top level of the file are the program.

```swift playground
let name = "Swift"
let version = 6.3

print("Hello from \(name) \(version)")
print("2 + 2 = \(2 + 2)")

let languages = ["Swift", "Kotlin", "Go"]
for language in languages {
    print("- \(language)")
}
```

`let` declares a constant, `var` declares a variable. Types are inferred, so `let name = "Swift"` is a `String` without your writing the type. String interpolation puts any value into a string with `\(...)`.

## Safety by default

Two decisions shape most Swift code. First, a value that may be missing has a different type: `String?` is not `String`, and the compiler makes you deal with the difference. Second, `struct` values are copied rather than shared, so passing one to a function cannot change the original behind your back.

```swift
var a = [1, 2, 3]
var b = a          // a copy, not a second name for the same array
b.append(4)        // a is still [1, 2, 3]
```

## Functions read like sentences

Swift function calls carry argument labels, which makes call sites read as prose. The label used at the call site can differ from the parameter name inside the function, and `_` removes it.

```swift
func greet(_ name: String, with greeting: String) -> String {
    "\(greeting), \(name)!"
}

greet("Ada", with: "Hello")
```

A function whose body is a single expression returns it without writing `return`.

## How the exercises are tested

Every exercise has two editors: the left one is yours, the right one holds the tests and is read-only. Both are compiled into one program, so read the tests — they are the real specification.

A test is a top-level function whose name begins with `test`, and the `///` comment above it is the label you see in the results:

```swift
/// greets a name
func testGreets() {
    expect(greet("Ada"), "Hello, Ada!")
    expect(greet("Ada").hasSuffix("!"), "should end with '!'")
}
```

`expect` comes in two shapes, and neither is something you declare — they are injected around your code.

- `expect(got, want)` compares two equal-able values. **The result you produced comes first.** When it fails, the panel says `expected:` for the second argument and `actual:` for the first.
- `expect(condition, "message")` takes a `Bool` and the message to show when it is false.

Two more things save a lot of confusion later. A test reports only its *first* failure, so work top down. And a crash — force-unwrapping a `nil`, indexing past the end of an array — is not a failed check but the whole program stopping, so the test that was running is blamed and every test after it says "did not run". One bad index can make four tests look broken.

The [Reference](#/reference/how-the-tests-work) page has the rest, including `async` tests and what the standard library calls used in the exercises do.

## What you will build here

The roadmap runs from variables through optionals, collections, closures, structs and classes, protocols and generics, to error handling, Codable, and async/await. Later modules assume the earlier ones, and the graph on the home page shows what each module builds on. The last module is a set of practice problems that mix everything.

## Exercises

### 1. Greet

`greet(name)` returns a greeting: `greet("Ada")` is `"Hello, Ada!"`. Use string interpolation.

```swift starter
func greet(_ name: String) -> String {
    return ""
}
```

```swift test
/// greets a name
func testGreets() {
    expect(greet("Ada"), "Hello, Ada!")
    expect(greet("Swift"), "Hello, Swift!")
}

/// the name goes in the middle, whatever it is
func testAnyName() {
    expect(greet(""), "Hello, !")
    expect(greet("Ada Lovelace"), "Hello, Ada Lovelace!")
}

/// nothing is lost around the name
func testExactShape() {
    let out = greet("X")
    expect(out.hasPrefix("Hello, "), "should start with 'Hello, '")
    expect(out.hasSuffix("!"), "should end with '!'")
    expect(out.count, 9)
}
```

#### Uses
- [What is Swift? › Hello, Swift](#/intro/hello-swift)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- String interpolation puts a value inside a string: `"Hello, \(name)!"`.
- The body is a single expression, so you can drop `return` entirely.

#### Tips
- `\(...)` takes any expression, not just a name: `"\(name.count) letters"` works.
- The test writes `expect(greet("Ada"), "Hello, Ada!")`: your result first, the expected value second. The wrong way round still compiles and only shows up as a failure message that reads backwards.
- `out.count` is 9 in the last test because `"Hello, X!"` is nine characters. `count` on a `String` counts characters, never bytes.

#### Docs
- [String interpolation](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/stringsandcharacters/#String-Interpolation)
- [Functions](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/)

### 2. Bigger of two

`larger(a, b)` returns the larger of two numbers, and `a` when they are equal.

```swift starter
func larger(_ a: Int, _ b: Int) -> Int {
    return 0
}
```

```swift test
/// picks the bigger number
func testPicksBigger() {
    expect(larger(5, 3), 5)
    expect(larger(3, 5), 5)
    expect(larger(100, 99), 100)
}

/// works with negatives and zero
func testNegatives() {
    expect(larger(-1, -4), -1)
    expect(larger(0, -7), 0)
    expect(larger(-7, 0), 0)
}

/// equal values return that value
func testEqual() {
    expect(larger(4, 4), 4)
    expect(larger(-2, -2), -2)
}
```

#### Uses
- [What is Swift? › Hello, Swift](#/intro/hello-swift)
- [What is Swift? › Functions read like sentences](#/intro/functions-read-like-sentences)
- [What is Swift? › How the exercises are tested](#/intro/how-the-exercises-are-tested)

#### Hints
- `if a > b { return a }` then `return b` is the direct version.
- Swift also has a ternary: `a > b ? a : b`, which fits on one line as the whole body.

#### Tips
- `max(a, b)` in the standard library does the same thing. Writing it by hand once is the point here.
- Watch the direction. `a > b ? a : b` is right; `a < b ? a : b` compiles, reads almost the same, and fails every test.
- Returning `a` on a tie is invisible for `Int`s, but it is still part of the contract. For a type where two equal values are distinguishable, which one you hand back matters.

#### Docs
- [Basic operators: Ternary conditional](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/basicoperators/#Ternary-Conditional-Operator)
