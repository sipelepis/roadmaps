# Error handling

Rust splits failure in two: bugs panic, and expected failures are values of type `Result`. This module is about making those values good: error types callers can match on, readable messages, and conversions that let `?` do the plumbing.

## Panic or `Result`?

A panic (`panic!`, `unwrap` on `None`, an index out of bounds, dividing by zero) unwinds the current thread, running destructors on the way out. If it's the main thread, the program ends. It's not an exception: there's no `try`/`catch` for it in normal code.

A `Result` hands the decision to the caller, and it's in the signature. In Python or TypeScript any call might throw and nothing tells you. In Rust, `fn load(path: &str) -> Result<Config, LoadError>` says exactly what can go wrong.

The rule of thumb: if a caller could reasonably want to handle it (bad input, missing file, network down), return a `Result`. If it means your program is wrong (an invariant you rely on doesn't hold), panic.

## An error enum

```rust
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError {
    Missing(String),
    BadPort(ParseIntError),
    OutOfRange(u32),
}
```

One variant per way the operation can fail, carrying whatever detail is useful. Where Python has an exception class hierarchy, Rust has a closed set that callers can `match` on, and the compiler tells them if they missed a case.

## `Display` and `std::error::Error`

```rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError {
    Missing(String),
    BadPort(ParseIntError),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::Missing(key) => write!(f, "missing key {key}"),
            ConfigError::BadPort(_) => write!(f, "port is not a number"),
        }
    }
}

impl Error for ConfigError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            ConfigError::BadPort(e) => Some(e),
            ConfigError::Missing(_) => None,
        }
    }
}
```

`Debug` is for developers, `Display` is the message for users and logs. The `Error` trait requires both and adds `source()`, the underlying cause, like Python's `raise ... from e`. Every method on `Error` has a default, so an empty `impl Error for ConfigError {}` is valid when there's no cause to report.

## `From` makes `?` convert

`?` on a `Result<_, ParseIntError>` inside a function returning `Result<_, ConfigError>` doesn't work out of the box:

```rust
#[derive(Debug)]
enum ConfigError { BadPort(std::num::ParseIntError) }

fn parse_port(s: &str) -> Result<u16, ConfigError> {
    let n: u16 = s.parse()?;    // error[E0277]: `?` couldn't convert the error to `ConfigError`
    Ok(n)
}
```

The error message is the hint. `?` doesn't just return the error; it returns `Err(From::from(e))`. Implement `From` and the conversion happens automatically:

```rust
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError { BadPort(ParseIntError) }

impl From<ParseIntError> for ConfigError {
    fn from(e: ParseIntError) -> Self {
        ConfigError::BadPort(e)
    }
}

fn parse_port(s: &str) -> Result<u16, ConfigError> {
    let n: u16 = s.parse()?;    // ParseIntError -> ConfigError
    Ok(n)
}
```

`From` is the right tool when one source error always maps to one variant. When the conversion needs context the source error doesn't have, like which key was bad, use `map_err` at the call site instead: `.map_err(|e| ConfigError::Invalid { key: key.to_string(), source: e })?`. A tuple variant is also a function, so `.map_err(ConfigError::BadPort)` works too.

## `Box<dyn Error>`

For applications, scripts and tests, defining an enum for every function is overkill. `Box<dyn Error>` holds any error at all:

```rust
use std::error::Error;

fn run(text: &str) -> Result<u32, Box<dyn Error>> {
    let n: u32 = text.parse()?;                          // ParseIntError -> Box<dyn Error>
    if n > 100 {
        return Err(format!("{n} is too big").into());   // String -> Box<dyn Error>
    }
    Ok(n)
}

println!("{:?}", run("7").ok());
println!("{}", run("700").unwrap_err());
```

The standard library implements `From<E> for Box<dyn Error>` for every error type, and for `String` and `&str`, so `?` and `.into()` just work. The cost: callers can't `match` on it. They can print it, or check for a specific type with `err.downcast_ref::<ParseIntError>()`.

`main` can return one too. `fn main() -> Result<(), Box<dyn Error>>` lets you use `?` in `main`; an `Err` prints its `Debug` form and exits with status 1.

## Libraries vs applications

Libraries return specific error enums, because their callers need to decide what to do. Applications mostly report errors, so `Box<dyn Error>` is fine. In real projects you'll see two crates everywhere: `thiserror` derives the `Display`, `Error` and `From` impls you wrote above, and `anyhow` is a nicer `Box<dyn Error>` that can attach context. The exercises here use only the standard library, which is what those crates generate anyway.

```rust playground
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError {
    Missing(&'static str),
    BadPort(ParseIntError),
    OutOfRange(u32),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::Missing(key) => write!(f, "missing {key}"),
            ConfigError::BadPort(_) => write!(f, "port is not a number"),
            ConfigError::OutOfRange(n) => write!(f, "port {n} is out of range"),
        }
    }
}

impl Error for ConfigError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            ConfigError::BadPort(e) => Some(e),
            _ => None,
        }
    }
}

impl From<ParseIntError> for ConfigError {
    fn from(e: ParseIntError) -> Self {
        ConfigError::BadPort(e)
    }
}

fn port(line: &str) -> Result<u16, ConfigError> {
    let value = line.strip_prefix("port=").ok_or(ConfigError::Missing("port"))?;
    let n: u32 = value.parse()?;
    if n == 0 || n > 65535 {
        return Err(ConfigError::OutOfRange(n));
    }
    Ok(n as u16)
}

fn main() {
    for line in ["port=8080", "host=example.com", "port=http", "port=70000"] {
        match port(line) {
            Ok(p) => println!("{line}: {p}"),
            Err(e) => {
                println!("{line}: error: {e}");
                if let Some(cause) = e.source() {
                    println!("    caused by: {cause}");
                }
            }
        }
    }
}

// Try: change `port` to return Result<u16, Box<dyn Error>>. What still compiles, and what can callers no longer do?
```

## Exercises

### 1. A bank error

Implement `Display` for `BankError`:

- `Insufficient { needed: 50, available: 20 }` prints `insufficient funds: need 50, have 20`
- `Locked` prints `account is locked`

Then write `withdraw`, which returns the new balance or the right error. A locked account fails even when the funds are there. When both errors apply, it's `Locked`.

```rust starter
use std::fmt;

#[derive(Debug, PartialEq)]
pub enum BankError {
    Insufficient { needed: u64, available: u64 },
    Locked,
}

impl fmt::Display for BankError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        todo!()
    }
}

pub fn withdraw(balance: u64, amount: u64, locked: bool) -> Result<u64, BankError> {
    todo!()
}
```

```rust test
/// returns the new balance
#[test]
fn withdraws() {
    assert_eq!(withdraw(100, 30, false), Ok(70));
    assert_eq!(withdraw(30, 30, false), Ok(0));
    assert_eq!(withdraw(5, 0, false), Ok(5));
}

/// rejects overdrafts, even by one
#[test]
fn insufficient() {
    assert_eq!(withdraw(20, 50, false), Err(BankError::Insufficient { needed: 50, available: 20 }));
    assert_eq!(withdraw(30, 31, false), Err(BankError::Insufficient { needed: 31, available: 30 }));
    assert_eq!(withdraw(0, 1, false), Err(BankError::Insufficient { needed: 1, available: 0 }));
}

/// a locked account always fails with Locked
#[test]
fn locked() {
    assert_eq!(withdraw(100, 1, true), Err(BankError::Locked));
    assert_eq!(withdraw(20, 50, true), Err(BankError::Locked));
}

/// readable messages
#[test]
fn messages() {
    assert_eq!(BankError::Insufficient { needed: 50, available: 20 }.to_string(), "insufficient funds: need 50, have 20");
    assert_eq!(BankError::Insufficient { needed: 7, available: 0 }.to_string(), "insufficient funds: need 7, have 0");
    assert_eq!(BankError::Locked.to_string(), "account is locked");
}
```

#### Uses
- [Error handling › `Display` and `std::error::Error`](#/errors/display-and-std-error-error)
- [Enums & match › `match`](#/enums/match)
- [Option & Result › Two ordinary enums](#/option-result/two-ordinary-enums)

#### Hints
- In `fmt`, `match self` with one arm per variant. The pattern `BankError::Insufficient { needed, available }` binds both fields for the `write!`.
- In `withdraw`, check `locked` first and return `Err(BankError::Locked)` early, then check the amount.
- The happy path is `Ok` of the new balance.

#### Tips
- Check `amount > balance` before subtracting: a `u64` can't go negative, so `20 - 50` would panic.
- Order the checks the way the spec words them. "When both errors apply, it's `Locked`" is a decision, not an accident, and the only way to honour it is to test `locked` first.
- `BankError::Locked.to_string()` works with no extra code once `Display` is implemented, which is what the `messages` test is really checking.
- The error variants carry the numbers rather than a pre-formatted message. That lets a caller `match` on `Insufficient { needed, .. }` and react, instead of parsing your English back out.

#### Docs
- [Rust by Example: Defining an error type](https://doc.rust-lang.org/rust-by-example/error/multiple_error_types/define_error_type.html)

### 2. `From` and `?`

`parse_sum(text)` adds up comma-separated integers such as `"1, 2, 3"`. Blank input (after trimming) is `SumError::Empty`. Any piece that doesn't parse as an `i64` is `SumError::BadNumber`. Implement `From<ParseIntError>` so a plain `?` after `parse` does the conversion.

```rust starter
use std::num::ParseIntError;

#[derive(Debug, PartialEq)]
pub enum SumError {
    Empty,
    BadNumber(ParseIntError),
}

impl From<ParseIntError> for SumError {
    fn from(e: ParseIntError) -> Self {
        todo!()
    }
}

pub fn parse_sum(text: &str) -> Result<i64, SumError> {
    todo!()
}
```

```rust test
/// sums the numbers
#[test]
fn sums() {
    assert_eq!(parse_sum("1,2,3"), Ok(6));
    assert_eq!(parse_sum(" 4 , -5 "), Ok(-1));
    assert_eq!(parse_sum("42"), Ok(42));
    assert_eq!(parse_sum("10,20,30,40"), Ok(100));
    assert_eq!(parse_sum("3000000000, 1"), Ok(3000000001));
}

/// blank input is Empty
#[test]
fn empty() {
    assert_eq!(parse_sum(""), Err(SumError::Empty));
    assert_eq!(parse_sum("   "), Err(SumError::Empty));
}

/// bad pieces convert through From
#[test]
fn bad_numbers() {
    assert!(matches!(parse_sum("1,x,3"), Err(SumError::BadNumber(_))));
    assert!(matches!(parse_sum("1,,2"), Err(SumError::BadNumber(_))));
    assert!(matches!(parse_sum("1,2,"), Err(SumError::BadNumber(_))));
    assert!(matches!(parse_sum("1.5"), Err(SumError::BadNumber(_))));
    let e: SumError = "x".parse::<i64>().unwrap_err().into();
    assert!(matches!(e, SumError::BadNumber(_)));
}

/// BadNumber keeps the error from the piece that failed
#[test]
fn keeps_the_error() {
    let x_error = "x".parse::<i64>().unwrap_err();
    assert_eq!(parse_sum("1, x"), Err(SumError::BadNumber(x_error)));
    let empty_error = "".parse::<i64>().unwrap_err();
    assert_eq!(parse_sum("1,,2"), Err(SumError::BadNumber(empty_error)));
}
```

#### Uses
- [Error handling › `From` makes `?` convert](#/errors/from-makes-convert)
- [Option & Result › Parsing text](#/option-result/parsing-text)
- [Option & Result › The `?` operator](#/option-result/the-operator)

#### Hints
- `from` only has to wrap the error in the right variant.
- Check `text.trim().is_empty()` first. Then loop over `text.split(',')`, trimming each piece before you parse it.
- Annotate the parsed value as `i64` so `parse` knows the type. The `?` after it converts a `ParseIntError` into a `SumError` through your `From` impl.

#### Tips
- `"1,,2"` splits into `"1"`, `""` and `"2"`, and `""` doesn't parse. That's why it's a `BadNumber` rather than skipped. `split` keeps empty pieces; `split_whitespace` is the one that drops them.
- `?` doesn't just return the error, it returns `Err(From::from(e))`. Your `From` impl is the only reason a bare `?` after `parse` compiles here at all.
- The `i64` annotation has to be somewhere: on the `let`, or as `parse::<i64>()`. Without it the compiler can't pick a number type and the error points at `parse`, not at the missing annotation.

#### Docs
- [std: From](https://doc.rust-lang.org/std/convert/trait.From.html)
- [Rust by Example: Other uses of `?`](https://doc.rust-lang.org/rust-by-example/error/multiple_error_types/reenter_question_mark.html)

### 3. Errors with a source

`get_number(pairs, key)` finds `key` in a list of `(key, value)` pairs and parses its value as an `i64`.

- Key not present: `ConfigError::Missing(key)`.
- Value doesn't parse: `ConfigError::Invalid { key, source }`, keeping the `ParseIntError`. A `From` impl can't know the key, so use `map_err`.

`Display` prints `missing key: <key>` and `invalid value for <key>`. `source()` returns the `ParseIntError` for `Invalid` and `None` for `Missing`. In a pattern, `..` skips the fields you don't name: `ConfigError::Invalid { key, .. }` binds only `key`.

```rust starter
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

#[derive(Debug, PartialEq)]
pub enum ConfigError {
    Missing(String),
    Invalid { key: String, source: ParseIntError },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        todo!()
    }
}

impl Error for ConfigError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        todo!()
    }
}

pub fn get_number(pairs: &[(&str, &str)], key: &str) -> Result<i64, ConfigError> {
    todo!()
}
```

```rust test
use std::error::Error;

const PAIRS: [(&str, &str); 4] = [("port", "8080"), ("retries", "lots"), ("timeout", "-30"), ("name", "")];

/// finds and parses the value
#[test]
fn finds_value() {
    assert_eq!(get_number(&PAIRS, "port"), Ok(8080));
    assert_eq!(get_number(&PAIRS, "timeout"), Ok(-30));
}

/// missing keys have no source
#[test]
fn missing() {
    let err = get_number(&PAIRS, "host").unwrap_err();
    assert_eq!(err, ConfigError::Missing("host".to_string()));
    assert_eq!(err.to_string(), "missing key: host");
    assert!(err.source().is_none());
    assert_eq!(get_number(&[], "port"), Err(ConfigError::Missing("port".to_string())));
}

/// invalid values keep the parse error as their source
#[test]
fn invalid() {
    let err = get_number(&PAIRS, "retries").unwrap_err();
    let source = "lots".parse::<i64>().unwrap_err();
    assert_eq!(err, ConfigError::Invalid { key: "retries".to_string(), source });
    assert_eq!(err.to_string(), "invalid value for retries");
    assert_eq!(err.source().unwrap().to_string(), "invalid digit found in string");
    let err = get_number(&PAIRS, "name").unwrap_err();
    assert_eq!(err.to_string(), "invalid value for name");
    assert_eq!(err.source().unwrap().to_string(), "cannot parse integer from empty string");
}

/// converts into Box<dyn Error>
#[test]
fn boxes() {
    let boxed: Box<dyn Error> = get_number(&PAIRS, "nope").unwrap_err().into();
    assert_eq!(boxed.to_string(), "missing key: nope");
    let boxed: Box<dyn Error> = get_number(&PAIRS, "retries").unwrap_err().into();
    assert_eq!(boxed.to_string(), "invalid value for retries");
    assert!(boxed.source().is_some());
}
```

#### Uses
- [Error handling › `Display` and `std::error::Error`](#/errors/display-and-std-error-error)
- [Error handling › `From` makes `?` convert](#/errors/from-makes-convert)
- [Variables & types › Tuples and arrays](#/basics/tuples-and-arrays)
- [Option & Result › Parsing text](#/option-result/parsing-text)
- [Option & Result › Working with `Option`](#/option-result/working-with-option)

#### Hints
- `fmt` and `source` are both a `match self`. For `Invalid`, `source()` returns `Some` of the stored error; for `Missing`, `None`.
- In `get_number`, loop over `pairs` and compare `pair.0 == key`. On a match, parse `pair.1` and return that result; after the loop, the key is missing.
- `map_err` builds the `Invalid` variant from the parse error. The key needs `to_string()` to become the owned `String` the variant stores.

#### Tips
- Keeping the parse error as `source` lets a caller print the whole chain, "invalid value for retries" caused by "invalid digit found in string", instead of losing the detail.
- This is the case `From` can't handle. A `From<ParseIntError>` impl only sees the error, and the key isn't in it, so the context has to be added at the call site with `map_err`.
- Each `Display` message says one thing and leaves the cause to `source()`. Folding the cause into the message instead gives you "invalid value for retries: invalid digit found in string" printed twice by anything that walks the chain.

#### Docs
- [std: Error::source](https://doc.rust-lang.org/std/error/trait.Error.html#method.source)

### 4. `Box<dyn Error>`

`total_age(text)` reads lines of `name:age` and returns the sum of the ages. Blank lines are skipped. Trim the age before parsing.

- A non-blank line without `:` fails with the message `line N: missing ':'`, where N counts every line from 1. Build it with `format!(...).into()`.
- An age that doesn't parse fails with the `ParseIntError` itself: just use `?`.

`text.lines().enumerate()` gives `(index, line)` pairs, with the index starting at 0. Destructure them in the loop header: `for (i, line) in text.lines().enumerate()`.

```rust starter
use std::error::Error;

pub fn total_age(text: &str) -> Result<u32, Box<dyn Error>> {
    todo!()
}
```

```rust test
use std::num::ParseIntError;

/// sums ages and skips blank lines
#[test]
fn sums() {
    assert_eq!(total_age("ada:36\nalan: 41").unwrap(), 77);
    assert_eq!(total_age("ada:36\n\ngrace:85\n").unwrap(), 121);
    assert_eq!(total_age("").unwrap(), 0);
    assert_eq!(total_age("x:5").unwrap(), 5);
    assert_eq!(total_age("ada:36\n   \nbob:1").unwrap(), 37);
}

/// reports the line with no colon
#[test]
fn missing_colon() {
    let err = total_age("ada:36\n\nalan").unwrap_err();
    assert_eq!(err.to_string(), "line 3: missing ':'");
    let err = total_age("alan\nada:36").unwrap_err();
    assert_eq!(err.to_string(), "line 1: missing ':'");
    let err = total_age("ada:36\ngrace 85\nalan").unwrap_err();
    assert_eq!(err.to_string(), "line 2: missing ':'");
}

/// keeps the original parse error
#[test]
fn parse_error() {
    let err = total_age("ada:old").unwrap_err();
    assert!(err.downcast_ref::<ParseIntError>().is_some());
    let err = total_age("ada:36\nbob:").unwrap_err();
    assert!(err.downcast_ref::<ParseIntError>().is_some());
    assert_eq!(err.to_string(), "cannot parse integer from empty string");
}
```

#### Uses
- [Error handling › `Box<dyn Error>`](#/errors/boxdyn-error)
- [Option & Result › Parsing text](#/option-result/parsing-text)
- [Option & Result › `let ... else`](#/option-result/let-else)
- [Reference › Iterators](#/reference/iterators)

#### Hints
- `continue` past lines that are empty after trimming.
- Split each line with `split_once(':')`. `let Some((_, age)) = ... else { ... };` either binds the age or lets you return the error.
- The message uses `i + 1`, since lines count from 1. `.into()` turns the `String` into a `Box<dyn Error>`.

#### Tips
- `?` boxes the `ParseIntError`, and the test still recovers it with `downcast_ref`. Boxing hides the type from the signature, not from the value.
- What you give up is `match`. A caller of a `Box<dyn Error>` can print it or guess at its type with `downcast_ref`, and that's it, which is why libraries return enums and applications mostly don't.
- `enumerate()` counts every line the iterator yields, blank ones included, so the index keeps step with the file. Skipping blanks before enumerating would report the wrong line number.
- `format!("line {}: missing ':'", i + 1).into()` needs the `.into()`: a `String` isn't a `Box<dyn Error>` until something converts it, and `?` only does that for you on the error path.

#### Docs
- [Rust by Example: Boxing errors](https://doc.rust-lang.org/rust-by-example/error/multiple_error_types/boxing_errors.html)
