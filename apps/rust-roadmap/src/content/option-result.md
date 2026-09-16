# Option & Result

Rust has no `null` and no exceptions. A value that might be missing is an `Option<T>`, an operation that might fail returns a `Result<T, E>`, and a small set of methods plus the `?` operator make both pleasant to use.

## Two ordinary enums

```rust
enum Option<T> { Some(T), None }
enum Result<T, E> { Ok(T), Err(E) }
```

Both are in the prelude, so you write `Some(3)` and `Err(e)` without imports. The standard library returns them everywhere:

```rust
let n: Result<i32, std::num::ParseIntError> = "42".parse();
let first: Option<&i32> = [1, 2, 3].first();
let at: Option<usize> = "hello".find('l');
```

The point is that the type forces the question. An `Option<i32>` is not an `i32`, so you can't forget the missing case:

```rust
let x: Option<i32> = Some(1);
let y = x + 1;     // error[E0369]: cannot add `{integer}` to `Option<i32>`
```

In TypeScript `number | undefined` gives you something similar, but only if strict mode is on and nobody reaches for `!`. Here there's no way around it except deciding what `None` means.

## Parsing text

Many of the `Option`s and `Result`s you'll meet first come from reading text. These are the `&str` methods this module's examples and exercises use:

```rust
"  8080 ".trim();              // "8080": whitespace removed from both ends
"8080".parse::<u16>();         // Ok(8080): parse into the type named in ::<>
"http".parse::<u16>();         // Err(..): not a number
"70000".parse::<u16>();        // Err(..): too big for a u16
"host=db".split_once('=');     // Some(("host", "db")): split at the first '='
"host".split_once('=');        // None
"".is_empty();                 // true
```

`parse` can produce any number type, so it needs to be told which one: with `::<u16>`, or through an annotation such as `let port: u16 = text.parse()...`. For integers its error type is `std::num::ParseIntError`.

A few methods produce a sequence of pieces rather than one value. A `for` loop walks them:

```rust
for piece in "1, 2, 3".split(',') {}           // "1", " 2", " 3"
for word in " ada  lovelace ".split_whitespace() {}   // "ada", "lovelace"
for line in "one\ntwo".lines() {}              // "one", "two"
```

## `match` is the long form

```rust
fn describe(n: Option<i32>) -> String {
    match n {
        Some(v) => format!("got {v}"),
        None => "nothing".to_string(),
    }
}
```

Everything below is shorthand for a `match` like this. Most of it takes a closure: `|x| x * 2` is an inline function with parameter `x`, and `|| 0` takes no parameters. The Closures & iterators module covers them properly.

## Working with `Option`

```rust
let name: Option<&str> = Some("ada");
let len = name.map(|s| s.len());              // Some(3)
let shown = name.unwrap_or("anonymous");      // "ada"
let big = Some(12).filter(|n| *n > 10);       // Some(12)

let missing: Option<i32> = None;
let a = missing.unwrap_or(0);                 // 0
let b = missing.unwrap_or_default();          // 0, from i32::default()
let c = missing.unwrap_or_else(|| 40 + 2);    // 42, closure only runs on None

let word: Option<&str> = Some("rust");
let first = word.and_then(|w| w.chars().next());   // Some('r')
```

- `map` transforms the value inside, if there is one.
- `filter` keeps the value only if the closure returns `true`. It hands the closure a reference to the value, `&T`, so the closure can look without taking it; `*n` reads the value behind the reference.
- `and_then` is for a transform that itself returns an `Option`. With `map` you'd get `Option<Option<char>>`; `and_then` flattens it.
- `unwrap_or(v)` evaluates `v` even when it isn't needed. For anything costly, like a `format!` or an allocation, use `unwrap_or_else(|| ...)`.
- `as_deref()` turns `&Option<String>` into `Option<&str>`. You need it when the `Option` lives in a struct you've only borrowed: `config.name.as_deref().unwrap_or("anon")`.
- `as_ref()` is the general form: `&Option<T>` becomes `Option<&T>`, so you can look inside an `Option` you don't own without moving the value out of it.
- `is_some()` and `is_none()` answer the question without taking anything. They're for conditions and assertions; when you want the value, `if let` or `match` gets it in the same step.
- `take()` on a `&mut Option<T>` moves the value out and leaves `None` behind. That's how you steal a field out of `&mut self`, which would otherwise leave the struct half-empty.

## Working with `Result`

```rust
let doubled = "21".parse::<i32>().map(|n| n * 2);            // Ok(42)
let fallback = "x".parse::<i32>().unwrap_or(0);              // 0
let as_text = "x".parse::<i32>().map_err(|e| e.to_string()); // Err("invalid digit found in string")
let maybe = "7".parse::<i32>().ok();                         // Some(7), error dropped
let needed = Some(3).ok_or("missing");                       // Ok(3)
```

`ok()` goes from `Result` to `Option`; `ok_or(e)` and `ok_or_else(|| e)` go the other way. `map_err` changes the error type, which you'll do constantly to make errors line up. `is_ok()` and `is_err()` ask without taking.

`unwrap_err()` is `unwrap` the other way round: it gives you the error and panics on an `Ok`. You'll mostly see it in tests, where it's the way to inspect a failure:

```rust
let e = "x".parse::<i32>().unwrap_err();
println!("{e}");                  // invalid digit found in string
println!("{}", "".parse::<i32>().unwrap_err());  // cannot parse integer from empty string
```

## The `?` operator

```rust
fn add(a: &str, b: &str) -> Result<i32, std::num::ParseIntError> {
    let x = a.trim().parse::<i32>()?;
    let y = b.trim().parse::<i32>()?;
    Ok(x + y)
}
```

`expr?` means: if it's `Ok(v)`, the expression is `v`; if it's `Err(e)`, return `Err(e)` from this function right now. It's Go's `if err != nil { return err }` in one character, and it works on `Option` too, returning `None` early.

The function must return a matching type:

```rust
fn main() {
    let n: i32 = "5".parse()?;   // error[E0277]: the `?` operator can only be used in a function that returns `Result` or `Option`
}
```

You also can't use `?` on an `Option` inside a function that returns `Result`. Convert first with `.ok_or(...)?`. When the error types differ, `map_err` them into one; the Error handling module shows how `From` lets `?` convert automatically.

## `let ... else`

When you want to bind a value or bail out, `let`-`else` keeps the happy path unindented:

```rust
fn parse_kv(line: &str) -> Option<(&str, i32)> {
    let Some((key, value)) = line.split_once('=') else {
        return None;
    };
    let value = value.trim().parse().ok()?;
    Some((key.trim(), value))
}
```

The `else` block must leave: `return`, `break`, `continue` or panic.

## When `unwrap` and `expect` are fine

`unwrap()` returns the value or panics. `expect("msg")` does the same with your message. A panic kills the current thread with an error and a line number. That's fine in:

- tests, where a panic is a failure report;
- quick scripts and examples;
- cases where failure means a bug in your program, not bad input: `"127.0.0.1".parse::<IpAddr>().expect("literal is a valid IP")`.

Anything that depends on user input, files or the network should return a `Result` instead. Prefer `expect` over `unwrap` so the panic says what you assumed.

```rust playground
fn parse_setting(line: &str) -> Result<(String, u16), String> {
    let (key, value) = line
        .split_once('=')
        .ok_or_else(|| format!("no '=' in {line:?}"))?;
    let port: u16 = value
        .trim()
        .parse()
        .map_err(|e| format!("bad value {:?}: {e}", value.trim()))?;
    Ok((key.trim().to_string(), port))
}

fn main() {
    for line in ["port = 8080", "port 8080", "port = 99999", "port = http"] {
        match parse_setting(line) {
            Ok((key, value)) => println!("{key} -> {value}"),
            Err(e) => println!("error: {e}"),
        }
    }

    let nickname: Option<&str> = None;
    println!("{}", nickname.map(|s| s.len()).unwrap_or(0));
}

// Try: "port = 0" parses fine as a u16. Reject it with an Err before the final Ok.
```

## Exercises

### 1. Parse a port

`parse_port(text)` returns the port number in `text` (after trimming whitespace) if it's a valid, non-zero `u16`. Anything else is `None`. Parsing into `u16` already rejects negatives and values above 65535; `.ok()` and `.filter(...)` do the rest.

```rust starter
pub fn parse_port(text: &str) -> Option<u16> {
    todo!()
}
```

```rust test
/// parses valid ports
#[test]
fn valid_ports() {
    assert_eq!(parse_port("8080"), Some(8080));
    assert_eq!(parse_port(" 443 "), Some(443));
    assert_eq!(parse_port("65535"), Some(65535));
}

/// rejects zero, garbage and out-of-range numbers
#[test]
fn invalid_ports() {
    assert_eq!(parse_port("0"), None);
    assert_eq!(parse_port("http"), None);
    assert_eq!(parse_port("70000"), None);
    assert_eq!(parse_port("-1"), None);
}

/// the smallest and one past the largest port, and blank text
#[test]
fn edges() {
    assert_eq!(parse_port("1"), Some(1));
    assert_eq!(parse_port("\t22\n"), Some(22));
    assert_eq!(parse_port("65536"), None);
    assert_eq!(parse_port(""), None);
    assert_eq!(parse_port("   "), None);
}
```

#### Uses
- [Option & Result › Parsing text](#/option-result/parsing-text)
- [Option & Result › Working with `Result`](#/option-result/working-with-result)
- [Option & Result › Working with `Option`](#/option-result/working-with-option)
- [Option & Result › `match` is the long form](#/option-result/match-is-the-long-form)

#### Hints
- Three steps: trim, parse into a `u16`, then throw away both the error and the zero.
- `text.trim().parse::<u16>()` is a `Result`; `.ok()` turns it into an `Option<u16>`.
- `.filter(...)` with a closure that checks the port isn't `0` finishes it. The closure gets a `&u16`, so compare `*p`.

#### Tips
- Picking `u16` does the range check for you: `"70000"` and `"-1"` simply fail to parse. The tightest type is often the cheapest validation.
- `filter`'s closure gets a `&u16`, not a `u16`, because `filter` must not consume the value it might hand back. Write `|p| *p != 0`.
- Order the chain so each step narrows: trim, parse, drop the error, drop zero. `parse` on untrimmed text fails on `" 443 "`, and no amount of filtering afterwards recovers it.

#### Docs
- [std: str::parse](https://doc.rust-lang.org/std/primitive.str.html#method.parse)
- [std: Option::filter](https://doc.rust-lang.org/std/option/enum.Option.html#method.filter)

### 2. Defaults

`address(config)` formats `host:port`, using `"localhost"` when `host` is `None` and `80` when `port` is `None`. You only have a `&Config`, so you can't move the `String` out: `config.host.unwrap_or(...)` fails with `cannot move out of config.host`. Borrow it with `as_deref()`.

```rust starter
pub struct Config {
    pub host: Option<String>,
    pub port: Option<u16>,
}

pub fn address(config: &Config) -> String {
    todo!()
}
```

```rust test
/// uses both values when present
#[test]
fn both_present() {
    let c = Config { host: Some("example.com".to_string()), port: Some(8443) };
    assert_eq!(address(&c), "example.com:8443");
    let c = Config { host: Some("10.0.0.7".to_string()), port: Some(22) };
    assert_eq!(address(&c), "10.0.0.7:22");
}

/// falls back to localhost without a host
#[test]
fn default_host() {
    assert_eq!(address(&Config { host: None, port: Some(3000) }), "localhost:3000");
    assert_eq!(address(&Config { host: None, port: Some(443) }), "localhost:443");
    assert_eq!(address(&Config { host: None, port: None }), "localhost:80");
}

/// falls back to port 80 without a port
#[test]
fn default_port() {
    assert_eq!(address(&Config { host: Some("db".to_string()), port: None }), "db:80");
    assert_eq!(address(&Config { host: Some("example.com".to_string()), port: None }), "example.com:80");
}
```

#### Uses
- [Option & Result › Working with `Option`](#/option-result/working-with-option)
- [Structs & methods › Defining and creating](#/structs/defining-and-creating)

#### Hints
- Work out the host and the port separately, then `format!` them with a `:` between.
- `config.host.as_deref()` is an `Option<&str>`, so `.unwrap_or("localhost")` fits it.
- `Option<u16>` is `Copy`, so `config.port.unwrap_or(80)` needs no `as_deref`.

#### Tips
- `config.host.clone().unwrap_or(...)` also compiles, but it copies the string just to read it. That's the clone-as-a-crutch pattern: it makes the error go away without answering the question the error asked.
- `Option<u16>` is `Copy`, so `unwrap_or(80)` takes it by value and the struct is untouched. `Option<String>` isn't, which is the whole reason the two fields need different treatment.
- `as_deref()` is `as_ref()` plus a deref: `&Option<String>` becomes `Option<&str>`, and the `"localhost"` literal fits straight into `unwrap_or`.

#### Docs
- [std: Option::as_deref](https://doc.rust-lang.org/std/option/enum.Option.html#method.as_deref)

### 3. Initials with `?`

`initials(name)` returns the uppercase first letter of the first word followed by the uppercase first letter of the last word: `"ada lovelace"` gives `"AL"`. A name with fewer than two words gives `None`. Use `?` on each `Option` rather than `match`. `name.split_whitespace()` gives the words; its `.next()` and `.last()` return `Option<&str>`, and `.chars().next()` returns the first `char`. `c.to_ascii_uppercase()` uppercases a `char`.

```rust starter
pub fn initials(name: &str) -> Option<String> {
    todo!()
}
```

```rust test
/// first and last word
#[test]
fn two_or_more_words() {
    assert_eq!(initials("ada lovelace"), Some("AL".to_string()));
    assert_eq!(initials("Grace Brewster Hopper"), Some("GH".to_string()));
    assert_eq!(initials("  alan   turing "), Some("AT".to_string()));
}

/// skips every middle word
#[test]
fn many_words() {
    assert_eq!(initials("john ronald reuel tolkien"), Some("JT".to_string()));
    assert_eq!(initials("x y"), Some("XY".to_string()));
}

/// needs at least two words
#[test]
fn too_short() {
    assert_eq!(initials("Plato"), None);
    assert_eq!(initials("  plato  "), None);
    assert_eq!(initials(""), None);
    assert_eq!(initials("   "), None);
}
```

#### Uses
- [Option & Result › The `?` operator](#/option-result/the-operator)
- [Option & Result › Parsing text](#/option-result/parsing-text)

#### Hints
- Keep the words in a variable: `let mut words = name.split_whitespace();`. It must be `mut` because `next()` moves it forward.
- `words.next()?` is the first word, and `words.last()?` the last of the words left after it, so a one-word name returns `None` right there.
- Take each word's first letter with `.chars().next()?`, then build the `String` from the two uppercased `char`s and wrap it in `Some`.

#### Tips
- `?` on an `Option` returns `None` early, the same way it returns an `Err` early from a function returning `Result`.
- `words` has to be `mut`. `next()` takes `&mut self` because it moves the iterator forward; that's also why `words.last()` afterwards sees only what's left, which is exactly what makes a one-word name return `None`.
- `to_ascii_uppercase` on a `char` returns a `char`, so both initials can go straight into one `format!`. The Unicode `to_uppercase` returns an iterator instead, which would need collecting.

#### Docs
- [Rust book: Where the `?` operator can be used](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html#where-the--operator-can-be-used)

### 4. Sum a pair

`sum_pair(text)` takes `"a,b"` and returns the sum of the two integers (spaces around each number are allowed). Errors are strings:

- no comma: `Err("missing comma")`
- a side that isn't an `i32`: `Err("bad number: <that side, trimmed>")`, checking the left side first.

`text.split_once(',')` returns `Option<(&str, &str)>`. Combine `ok_or`, `map_err` and `?`.

```rust starter
pub fn sum_pair(text: &str) -> Result<i32, String> {
    todo!()
}
```

```rust test
/// adds two numbers
#[test]
fn adds() {
    assert_eq!(sum_pair("3,4"), Ok(7));
    assert_eq!(sum_pair(" 10 , -2 "), Ok(8));
    assert_eq!(sum_pair("0,0"), Ok(0));
    assert_eq!(sum_pair("-5,-6"), Ok(-11));
}

/// reports a missing comma
#[test]
fn missing_comma() {
    assert_eq!(sum_pair("34"), Err("missing comma".to_string()));
    assert_eq!(sum_pair("3 4"), Err("missing comma".to_string()));
    assert_eq!(sum_pair(""), Err("missing comma".to_string()));
}

/// reports the first bad number
#[test]
fn bad_numbers() {
    assert_eq!(sum_pair("3, x "), Err("bad number: x".to_string()));
    assert_eq!(sum_pair("a,b"), Err("bad number: a".to_string()));
    assert_eq!(sum_pair(" 1.5 ,2"), Err("bad number: 1.5".to_string()));
    assert_eq!(sum_pair("3,"), Err("bad number: ".to_string()));
    assert_eq!(sum_pair("3000000000,1"), Err("bad number: 3000000000".to_string()));
}
```

#### Uses
- [Option & Result › Parsing text](#/option-result/parsing-text)
- [Option & Result › Working with `Result`](#/option-result/working-with-result)
- [Option & Result › The `?` operator](#/option-result/the-operator)

#### Hints
- Split first: `split_once(',')` gives an `Option`, and `ok_or(...)?` turns `None` into your error and returns it.
- Trim both sides before parsing, and keep the trimmed text around: the error message needs it.
- `map_err` swaps the parse error for your own `String`, then `?` returns it. A closure that ignores its argument is written `|_| ...`.

#### Tips
- The error type is `String`, so `ok_or("missing comma")` alone is a `&str` and won't fit. Add `.to_string()`.
- Trim once and keep the result in a variable. The error message has to show the trimmed text, so parsing `value.trim()` and then reporting `value` gives `"bad number:  x "` instead of `"bad number: x"`.
- `?` after `map_err` is what makes this read top to bottom: each line either produces a value or leaves the function. Nesting `match`es would say the same thing three levels deep.

#### Docs
- [std: str::split_once](https://doc.rust-lang.org/std/primitive.str.html#method.split_once)
- [std: Result::map_err](https://doc.rust-lang.org/std/result/enum.Result.html#method.map_err)
