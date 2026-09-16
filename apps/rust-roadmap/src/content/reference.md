# Reference

A lookup page for the macros and standard-library calls the exercises use. It is not a step on the roadmap: nothing here has to be read in order, and nothing here replaces an article. Come when an exercise uses a name you haven't met, find the one line that says what it does, then go back. Every sample below was run on the Rust Playground, and the result shown is the result you get.

## How the tests work

Your code is compiled as a library, with no `fn main`. The tests go in a `#[cfg(test)] mod tests` beside it that starts with `use super::*`, so everything you write with `pub` is in scope.

```rust
pub fn double(x: i32) -> i32 {
    x * 2
}

#[cfg(test)]
mod tests {
    use super::*;

    /// doubles a number
    #[test]
    fn doubles() {
        assert_eq!(double(21), 42);
    }
}
```

- **`#[test]`** — marks a function as one test. It takes no arguments and returns nothing. Tests run in parallel, in no particular order. [docs](https://doc.rust-lang.org/book/ch11-01-writing-tests.html)
- **`/// a label`** — the doc comment above a `#[test]` is the name shown for it in the results panel here. Without one you get the function name with the underscores removed. [docs](https://doc.rust-lang.org/book/ch14-02-publishing.html#making-useful-documentation-comments)
- **`assert_eq!(left, right)`** — panics unless the two are equal, printing both. In these exercises the left side is your value and the right side is what's expected, which is why a failure reports `left: 4, right: 5`. Both sides need `Debug` for the message, and `PartialEq` to be compared. [docs](https://doc.rust-lang.org/std/macro.assert_eq.html)
- **`assert!(cond)`** — panics unless `cond` is `true`. `assert!(v.is_empty())` where there's nothing to compare against. `assert_ne!` is the "not equal" form. [docs](https://doc.rust-lang.org/std/macro.assert.html)
- **`#[should_panic]`** — put under `#[test]`, it flips the test: it passes only if the body panics. That's how "this input is a bug" is tested. [docs](https://doc.rust-lang.org/book/ch11-01-writing-tests.html#checking-for-panics-with-should_panic)
- **a panic ends that test** — the first failing assert stops the test function right there; later asserts in the same test never run. Other tests keep going, so fix the first reported failure first.
- **`println!` inside a test** — captured and shown with the failure, not lost. `dbg!(expr)` prints the expression, its value and its line, and gives the value back. [docs](https://doc.rust-lang.org/std/macro.dbg.html)

## Macros

A `!` means macro, not function: it expands into code at compile time, which is how these take any number of arguments and still check them.

- **`println!("{x} and {}", y)`** — prints a line to stdout. Names in `{}` are captured from scope; bare `{}` take the next argument. `print!` omits the newline, `eprintln!` writes to stderr. [docs](https://doc.rust-lang.org/std/macro.println.html)
- **`format!(...) -> String`** — same syntax, returns the text instead of printing it. `format!("{}:{}", "tea", 350)` is `"tea:350"`. [docs](https://doc.rust-lang.org/std/macro.format.html)
- **`write!(f, ...) -> fmt::Result`** — writes formatted text into a formatter or a `String`. The whole body of a `Display` impl is usually one `write!`. [docs](https://doc.rust-lang.org/std/macro.write.html)
- **`vec![a, b, c]` / `vec![x; n]`** — builds a `Vec`. `vec![0; 3]` is `[0, 0, 0]`. [docs](https://doc.rust-lang.org/std/macro.vec.html)
- **`todo!()`** — a placeholder body. It compiles anywhere, because its type is `!` ("never"), and panics when called. Starters use it; delete it when you write the body. `unimplemented!()` is the same with a different message. [docs](https://doc.rust-lang.org/std/macro.todo.html)
- **`panic!("msg")`** — ends the current thread with your message. `unreachable!()` is the "this can't happen" version. [docs](https://doc.rust-lang.org/std/macro.panic.html)
- **`matches!(value, pattern) -> bool`** — a `match` that answers yes or no. `matches!('e', 'a' | 'e' | 'i' | 'o' | 'u')` is `true`; `matches!(Some(3), None)` is `false`. [docs](https://doc.rust-lang.org/std/macro.matches.html)

## Option

`Option<T>` is `Some(T)` or `None`: a value that may be absent, with no `null` anywhere. [type docs](https://doc.rust-lang.org/std/option/enum.Option.html)

- **`unwrap(self) -> T`** — the value, or a panic on `None`. `Some(3).unwrap()` is `3`. Fine in tests and in code where `None` would be a bug; a `Result` is the answer everywhere else. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.unwrap)
- **`expect(self, msg) -> T`** — `unwrap` with your own panic message. Prefer it: the message says what you assumed. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.expect)
- **`unwrap_or(self, default) -> T`** — the value or a fallback. `None::<i32>.unwrap_or(0)` is `0`. The default is built even when it isn't used. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.unwrap_or)
- **`unwrap_or_else(self, f) -> T`** — same, but the closure runs only on `None`. `None::<i32>.unwrap_or_else(|| 40 + 2)` is `42`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.unwrap_or_else)
- **`unwrap_or_default(self) -> T`** — falls back to `T::default()`: `0`, `false`, `""`, an empty `Vec`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.unwrap_or_default)
- **`map(self, f) -> Option<U>`** — transforms the value if there is one. `Some("ada").map(|s| s.len())` is `Some(3)`; `None` stays `None`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.map)
- **`and_then(self, f) -> Option<U>`** — like `map` for a closure that itself returns an `Option`, flattening the result. `Some("rust").and_then(|w| w.chars().next())` is `Some('r')`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.and_then)
- **`filter(self, pred) -> Option<T>`** — keeps the value only if the test passes. The closure gets a `&T`, so compare `*n`. `Some(12).filter(|n| *n > 10)` is `Some(12)`, `Some(4).filter(|n| *n > 10)` is `None`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.filter)
- **`ok_or(self, err) -> Result<T, E>`** — turns `None` into an error. `Some(3).ok_or("missing")` is `Ok(3)`. `ok_or_else(|| ...)` builds the error lazily. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.ok_or)
- **`is_some() -> bool` / `is_none() -> bool`** — asks without taking. `Some(3).is_some()` is `true`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.is_some)
- **`as_ref(&self) -> Option<&T>`** — borrow the inside of an `Option` you only borrowed. `owned.as_ref().map(|s| s.len())` reads the `String` without moving it. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.as_ref)
- **`as_deref(&self) -> Option<&str>`** — `&Option<String>` to `Option<&str>` (and `Option<Vec<T>>` to `Option<&[T]>`). `config.host.as_deref().unwrap_or("anon")`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.as_deref)
- **`take(&mut self) -> Option<T>`** — moves the value out and leaves `None` behind. The standard trick for stealing a field out of `&mut self`. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#method.take)
- **`expr?`** — inside a function returning `Option`, unwraps `Some` or returns `None` from the whole function at once. [docs](https://doc.rust-lang.org/std/option/enum.Option.html#the-question-mark-operator-)

## Result

`Result<T, E>` is `Ok(T)` or `Err(E)`: an operation that can fail, with the failure in the signature. [type docs](https://doc.rust-lang.org/std/result/enum.Result.html)

- **`unwrap(self) -> T`** — the value, or a panic that prints the error. `"42".parse::<i32>().unwrap()` is `42`. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#method.unwrap)
- **`unwrap_err(self) -> E`** — the error, or a panic if it was `Ok`. Tests use it to inspect a failure: `"x".parse::<i32>().unwrap_err().to_string()` is `"invalid digit found in string"`. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#method.unwrap_err)
- **`ok(self) -> Option<T>`** — drops the error and keeps the value. `"7".parse::<i32>().ok()` is `Some(7)`. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#method.ok)
- **`unwrap_or(self, default) -> T`** — `"x".parse::<i32>().unwrap_or(0)` is `0`. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#method.unwrap_or)
- **`map(self, f) -> Result<U, E>`** — transforms the `Ok` side. `"21".parse::<i32>().map(|n| n * 2)` is `Ok(42)`. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#method.map)
- **`map_err(self, f) -> Result<T, F>`** — transforms the `Err` side, which is how you make two error types line up. `"x".parse::<i32>().map_err(|e| e.to_string())` is `Err("invalid digit found in string")`. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#method.map_err)
- **`is_ok() -> bool` / `is_err() -> bool`** — asks without taking. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#method.is_ok)
- **`expr?`** — unwraps `Ok`, or returns the `Err` from the whole function, converting it with `From` on the way. [docs](https://doc.rust-lang.org/std/result/enum.Result.html#the-question-mark-operator-)

## Strings and &str

`String` owns a growable UTF-8 buffer; `&str` borrows a view into one. Methods that return a piece of the original give `&str`; methods that build new text give `String`. [str docs](https://doc.rust-lang.org/std/primitive.str.html) · [String docs](https://doc.rust-lang.org/std/string/struct.String.html)

- **`to_string(&self) -> String`** — an owned copy. `"hi".to_string()` and `7.to_string()` (`"7"`). Every type with a `Display` impl has it, which is why it works on numbers, `char`s and your own types. [docs](https://doc.rust-lang.org/std/string/trait.ToString.html#tymethod.to_string)
- **`String::from(s) -> String`** — the same thing for a `&str`, spelled the other way round. `String::new()` is the empty one. [docs](https://doc.rust-lang.org/std/string/struct.String.html#method.from)
- **`as_str(&self) -> &str`** — borrow a `String` as a `&str`. `String::from("hello").as_str()` is `"hello"`. `&owned` does the same automatically wherever a `&str` is expected. [docs](https://doc.rust-lang.org/std/string/struct.String.html#method.as_str)
- **`push(&mut self, c: char)` / `push_str(&mut self, s: &str)`** — append one character, or some text. Starting from `"hi"`, `push('!')` then `push_str(" there")` gives `"hi! there"`. [docs](https://doc.rust-lang.org/std/string/struct.String.html#method.push)
- **`len(&self) -> usize`** — the length in **bytes**, not characters. `"héllo".len()` is `6`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.len)
- **`is_empty(&self) -> bool`** — `"".is_empty()` is `true`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.is_empty)
- **`chars(&self) -> impl Iterator<Item = char>`** — the Unicode scalar values. `"héllo".chars().count()` is `5`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.chars)
- **`char_indices(&self)`** — each `char` with its byte offset. `"héllo".char_indices().nth(1)` is `Some((1, 'é'))`. Those offsets are always safe to slice at. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.char_indices)
- **`bytes(&self)`** — the raw `u8`s. `"hi".bytes().next()` is `Some(104)`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.bytes)
- **`trim()` / `trim_start()` / `trim_end()`** — whitespace off both ends, or one. `"  hi  ".trim()` is `"hi"`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.trim)
- **`split(p)`** — an iterator of the pieces between separators; two separators in a row give an empty piece. `"a,b,,c".split(',')` yields four pieces. `p` can be a `char`, a `&str`, or a closure over `char`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.split)
- **`split_whitespace()`** — the words, with runs of whitespace skipped, so no empty pieces. `"one  two".split_whitespace()` yields two. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.split_whitespace)
- **`split_once(p) -> Option<(&str, &str)>`** — splits at the **first** match only. `"host=db".split_once('=')` is `Some(("host", "db"))`; `"host".split_once('=')` is `None`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.split_once)
- **`split_at(i) -> (&str, &str)`** — cuts at a byte index. `"hello world".split_at(5)` is `("hello", " world")`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.split_at)
- **`lines()`** — an iterator over the lines, without their newlines. `"x\ny".lines()` yields two. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.lines)
- **`find(p) -> Option<usize>`** — the byte index of the first match. `"hello".find('l')` is `Some(2)`, `"hello".find('z')` is `None`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.find)
- **`contains(p) -> bool` / `starts_with(p)` / `ends_with(p)`** — `"hello".contains("ell")` is `true`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.contains)
- **`strip_prefix(p) -> Option<&str>`** — the rest after a prefix, or `None` if it isn't there. `"port=80".strip_prefix("port=")` is `Some("80")`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.strip_prefix)
- **`replace(from, to) -> String`** — every occurrence. `"a-b".replace('-', "+")` is `"a+b"`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.replace)
- **`to_uppercase()` / `to_lowercase()` -> String** — full Unicode. `"Zoë".to_uppercase()` is `"ZOË"`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.to_uppercase)
- **`repeat(n) -> String`** — `"ab".repeat(3)` is `"ababab"`. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.repeat)
- **`parse::<T>() -> Result<T, T::Err>`** — text to a number or anything else with `FromStr`. The type has to be known, from the turbofish or from an annotation. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.parse)
- **`&s[a..b] -> &str`** — a slice by **byte** range, no copy. `&"hello world"[6..]` is `"world"`. Cutting through the middle of a multi-byte character panics. [docs](https://doc.rust-lang.org/std/primitive.str.html#method.get)
- **`[&str]::join(sep) -> String`** — glues pieces together. `["a", "b"].join("-")` is `"a-b"`; `concat()` is the same with no separator. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.join)

## char

A `char` is one Unicode scalar value, four bytes, written `'a'`. It is not a one-character string. [docs](https://doc.rust-lang.org/std/primitive.char.html)

- **`to_ascii_uppercase(self) -> char`** — uppercases `a`–`z` and leaves everything else alone: `'a'` becomes `'A'`, but `'é'` stays `'é'`. [docs](https://doc.rust-lang.org/std/primitive.char.html#method.to_ascii_uppercase)
- **`to_uppercase(self) -> impl Iterator<Item = char>`** — the full Unicode version, an iterator because one letter can uppercase to several. `'ß'.to_uppercase().collect::<String>()` is `"SS"`. [docs](https://doc.rust-lang.org/std/primitive.char.html#method.to_uppercase)
- **`to_digit(radix) -> Option<u32>`** — the numeric value of a digit character. `'7'.to_digit(10)` is `Some(7)`, `'x'.to_digit(10)` is `None`. [docs](https://doc.rust-lang.org/std/primitive.char.html#method.to_digit)
- **`is_alphabetic()` / `is_ascii_digit()` / `is_whitespace()` / `is_numeric()`** — classification. `'é'.is_alphabetic()` is `true`, `'\t'.is_whitespace()` is `true`. [docs](https://doc.rust-lang.org/std/primitive.char.html#method.is_alphabetic)
- **`to_string(self) -> String`** — `'x'.to_string()` is `"x"`. Handy with `repeat`: `c.to_string().repeat(n)`. [docs](https://doc.rust-lang.org/std/primitive.char.html#method.to_string)

## Vec and slices

`Vec<T>` owns a growable array; `&[T]` borrows a view of part of one. Almost every read-only method below lives on the slice, so it works on both. [Vec docs](https://doc.rust-lang.org/std/vec/struct.Vec.html) · [slice docs](https://doc.rust-lang.org/std/primitive.slice.html)

- **`push(&mut self, x)`** — appends one element at the end. [docs](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.push)
- **`pop(&mut self) -> Option<T>`** — removes and returns the last element, `None` if empty. With `push`, that's a stack. [docs](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.pop)
- **`len() -> usize` / `is_empty() -> bool`** — how many, and whether none. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.len)
- **`first() -> Option<&T>` / `last() -> Option<&T>`** — the ends, as `Option` because the slice may be empty. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.last)
- **`last_mut() -> Option<&mut T>`** — the last element, writable: `if let Some(last) = v.last_mut() { *last = 30; }`. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.last_mut)
- **`get(i) -> Option<&T>`** — indexing that says "not there" instead of panicking. `v.get(99)` is `None`, while `v[99]` panics. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.get)
- **`contains(&x) -> bool`** — linear search for a value. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.contains)
- **`remove(i) -> T` / `insert(i, x)`** — take out or put in at a position, shifting everything after it (O(n)). `swap_remove(i)` is O(1) but moves the last element into the hole. [docs](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.remove)
- **`to_vec(&self) -> Vec<T>`** — copies a slice into an owned `Vec` you can sort or push to. Needs `T: Clone`. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.to_vec)
- **`sort(&mut self)`** — ascending, stable, needs `T: Ord`. Tuples sort by their first element, then the second. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.sort)
- **`sort_by(&mut self, f)`** — sorts with a comparator returning `Ordering`. `v.sort_by(|a, b| b.cmp(a))` is descending. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.sort_by)
- **`sort_by_key(&mut self, f)`** — sorts by something computed from each item. `words.sort_by_key(|w| w.len())`. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.sort_by_key)
- **`retain(&mut self, pred)`** — keeps only the elements that pass, in place. `nums.retain(|n| n % 2 == 0)` turns `[1, 2, 3, 4]` into `[2, 4]`. [docs](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.retain)
- **`dedup(&mut self)`** — collapses *neighbouring* duplicates only: `[1, 1, 2, 2, 1]` becomes `[1, 2, 1]`. Sort first if you want it global. [docs](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.dedup)
- **`truncate(n)` / `extend(iter)`** — cut down to `n` elements, or append all of another sequence. [docs](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.truncate)
- **`iter()` / `iter_mut()` / `into_iter()`** — yields `&T`, `&mut T`, or `T` while consuming the `Vec`. `for x in &v`, `for x in &mut v` and `for x in v` are the same three. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.iter)
- **`chunks(n) -> impl Iterator<Item = &[T]>`** — consecutive blocks of `n`, the last one possibly shorter. `[1,2,3,4,5].chunks(2)` yields `[1,2]`, `[3,4]`, `[5]`. A size of 0 panics. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.chunks)
- **`windows(n)`** — every overlapping run of `n`. `[1,2,3].windows(2)` yields `[1,2]`, `[2,3]`. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.windows)
- **`chunk_by(f) -> impl Iterator<Item = &[T]>`** — splits wherever the closure says two neighbours don't belong together. `[1,1,2,3,3].chunk_by(|a, b| a == b)` yields `[1,1]`, `[2]`, `[3,3]`. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.chunk_by)
- **`split_at(i) -> (&[T], &[T])`** — one slice in two. `[1,2,3,4].split_at(2)` is `([1,2], [3,4])`; `split_at_mut` gives two independent `&mut` halves. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.split_at)
- **`as_ptr() -> *const T`** — the raw address of the first element. Only used here with `std::ptr::eq`, to check a result borrows from the input rather than copying it. [docs](https://doc.rust-lang.org/std/primitive.slice.html#method.as_ptr)

## HashMap, HashSet and friends

Hash collections need keys that are `Eq + Hash`; the B-tree ones need `Ord` and stay sorted. [HashMap docs](https://doc.rust-lang.org/std/collections/struct.HashMap.html)

- **`insert(k, v) -> Option<V>`** — adds or replaces, returning the old value if there was one. It takes ownership of both key and value. [docs](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.insert)
- **`get(&k) -> Option<&V>`** — a lookup that can miss. A `&str` works to look up a `String` key. `m["k"]` reads it directly but panics when missing. [docs](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.get)
- **`entry(k).or_insert(v) -> &mut V`** — finds the slot once, fills it if empty, and hands back a mutable reference either way. `*counts.entry("a").or_insert(0) += 1` counts one occurrence. [docs](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.entry)
- **`entry(k).or_default() -> &mut V`** — the same with `V::default()`, which makes grouping one line: `by_len.entry(w.len()).or_default().push(w)`. [docs](https://doc.rust-lang.org/std/collections/hash_map/enum.Entry.html#method.or_default)
- **`remove(&k) -> Option<V>` / `contains_key(&k) -> bool` / `len()` / `is_empty()`** — the rest of the basics. [docs](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.remove)
- **`keys()` / `values()` / `iter()`** — iterate the map. `for (k, v) in &m` yields pairs. **The order is arbitrary and changes between runs**, so never let output depend on it. [docs](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.keys)
- **`HashSet::insert(x) -> bool`** — `true` if the value is new, `false` if it was already there, which answers "have I seen this?" in one call. [docs](https://doc.rust-lang.org/std/collections/struct.HashSet.html#method.insert)
- **`BTreeMap`** — the same API, kept sorted by key. `{"zed": 1, "amy": 2}` prints as `{"amy": 2, "zed": 1}`. Use it when the output order matters. [docs](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html)
- **`VecDeque`** — `push_back` / `push_front` / `pop_front` / `pop_back`, all cheap. A queue, where `Vec::remove(0)` would be O(n). [docs](https://doc.rust-lang.org/std/collections/struct.VecDeque.html)
- **`BinaryHeap`** — `push` and `pop` always give the largest item. Wrap items in `std::cmp::Reverse` to get the smallest instead. [docs](https://doc.rust-lang.org/std/collections/struct.BinaryHeap.html)

## Iterators

Adapters are lazy: they build a new iterator and do nothing until a consumer pulls items through. [trait docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html)

Adapters, which return another iterator:

- **`map(f)`** — transforms each item. `[1,2,3].iter().map(|x| x * 2)` collects to `[2, 4, 6]`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.map)
- **`filter(pred)`** — keeps the items that pass. The closure gets the item *by reference*, so over `v.iter()` it sees a `&&T` and needs `*x` or a `|&&x|` pattern. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.filter)
- **`filter_map(f)`** — map and filter in one: the closure returns an `Option` and the `None`s are dropped. `["1","x","3"].iter().filter_map(|s| s.parse::<i32>().ok())` gives `[1, 3]`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.filter_map)
- **`enumerate()`** — pairs each item with its index from 0. `for (i, line) in text.lines().enumerate()`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.enumerate)
- **`zip(other)`** — pairs items with another sequence and stops at the shorter one. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.zip)
- **`rev()` / `skip(n)` / `take(n)`** — backwards, drop the first `n`, keep the first `n`. `(1..6).skip(2).take(2)` gives `[3, 4]`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.rev)
- **`take_while(pred)`** — stops at the first item that fails. `[1,2,9,3]` with `|x| *x < 5` gives `[1, 2]`, not `[1, 2, 3]`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.take_while)
- **`flat_map(f)` / `chain(other)`** — flatten a sequence per item, or run two iterators back to back. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.flat_map)
- **`copied()` / `cloned()`** — turn an iterator of `&T` into one of `T`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.copied)
- **`peekable()`** — adds `peek()`, which looks at the next item without consuming it. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.peekable)

Consumers, which actually run the chain:

- **`collect::<C>()`** — builds a `Vec`, `String`, `HashMap`, anything. The type annotation decides. Collecting an iterator of `Result`s into `Result<Vec<_>, _>` stops at the first `Err`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.collect)
- **`sum::<T>()` / `count()`** — add them up, or count them. `(1..=10).filter(|n| n % 3 == 0).sum::<i32>()` is `18`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.sum)
- **`min()` / `max()`** — the smallest or largest item as an `Option`. Needs `Ord`, so not for `f64`. `[1,2,3].iter().max()` is `Some(&3)`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.max)
- **`max_by_key(f)` / `min_by_key(f)`** — extreme by something computed. `["a","bbb"].iter().max_by_key(|w| w.len())` is `Some(&"bbb")`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.max_by_key)
- **`fold(init, f)`** — runs an accumulator through every item. `[1,2,3].iter().fold(0, |acc, n| acc + n)` is `6`. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.fold)
- **`any(pred)` / `all(pred)`** — short-circuiting yes/no. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.any)
- **`find(pred) -> Option<T>` / `position(pred) -> Option<usize>`** — the first match, or where it is. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.find)
- **`next() -> Option<T>` / `nth(n)` / `last()`** — pull one item, the `n`th, or the final one. `next` needs a `mut` iterator, because it moves it forward. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#tymethod.next)
- **`for_each(f)`** — like a `for` loop; use it when the chain reads better than the loop. [docs](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.for_each)

## Numbers

Integer overflow is a bug, so the methods below make you say which behavior you meant. [i32 docs](https://doc.rust-lang.org/std/primitive.i32.html)

- **`checked_add(rhs) -> Option<T>`** — `None` instead of overflowing. `250u8.checked_add(10)` is `None`, `250u8.checked_add(5)` is `Some(255)`. Also `checked_sub`, `checked_mul`, `checked_div` (which catches divide-by-zero). [docs](https://doc.rust-lang.org/std/primitive.u8.html#method.checked_add)
- **`wrapping_add(rhs) -> T`** — wraps around. `250u8.wrapping_add(10)` is `4`. [docs](https://doc.rust-lang.org/std/primitive.u8.html#method.wrapping_add)
- **`saturating_add(rhs) -> T`** — clamps at the limit. `250u8.saturating_add(10)` is `255`. [docs](https://doc.rust-lang.org/std/primitive.u8.html#method.saturating_add)
- **`overflowing_add(rhs) -> (T, bool)`** — the wrapped value and whether it overflowed. `250u8.overflowing_add(10)` is `(4, true)`. [docs](https://doc.rust-lang.org/std/primitive.u8.html#method.overflowing_add)
- **`min(other)` / `max(other)`** — `3.min(7)` is `3`, `3.max(7)` is `7`. Floats have them too: `1.5_f64.max(2.5)` is `2.5`. [docs](https://doc.rust-lang.org/std/cmp/trait.Ord.html#method.min)
- **`abs()` / `pow(n)`** — `(-4i32).abs()` is `4`, `2i32.pow(10)` is `1024`. [docs](https://doc.rust-lang.org/std/primitive.i32.html#method.pow)
- **`div_ceil(rhs)`** — division rounded up. `7usize.div_ceil(2)` is `4`, where `7 / 2` is `3`. The usual way to get "how many chunks of size n". [docs](https://doc.rust-lang.org/std/primitive.usize.html#method.div_ceil)
- **`rem_euclid(rhs)`** — a remainder that is never negative. `(-7i32).rem_euclid(2)` is `1`, where `-7 % 2` is `-1`. [docs](https://doc.rust-lang.org/std/primitive.i32.html#method.rem_euclid)
- **`i32::MAX` / `u8::MIN` / `f64::sqrt`** — limits and float maths. `i32::MAX` is `2147483647`; `2.0_f64.sqrt()` is `1.4142135623730951`. [docs](https://doc.rust-lang.org/std/primitive.i32.html#associatedconstant.MAX)

## Box, Rc, RefCell and Weak

Smart pointers for the shapes plain ownership doesn't fit. [Rc docs](https://doc.rust-lang.org/std/rc/struct.Rc.html)

- **`Box::new(x) -> Box<T>`** — moves a value to the heap behind one pointer. `*boxed` reads it; method calls see through it. Needed for recursive types and `Box<dyn Trait>`. [docs](https://doc.rust-lang.org/std/boxed/struct.Box.html)
- **`Rc::new(x) -> Rc<T>`** — a value with several owners, freed when the last one goes. [docs](https://doc.rust-lang.org/std/rc/struct.Rc.html#method.new)
- **`Rc::clone(&rc) -> Rc<T>`** — bumps the counter; nothing is copied. Written this way, not `rc.clone()`, so readers can tell it's cheap. [docs](https://doc.rust-lang.org/std/rc/struct.Rc.html#method.clone)
- **`Rc::strong_count(&rc)` / `Rc::weak_count(&rc)` -> usize** — how many owners, and how many weak pointers. After one `Rc::clone`, the strong count is `2`. [docs](https://doc.rust-lang.org/std/rc/struct.Rc.html#method.strong_count)
- **`Rc::ptr_eq(&a, &b) -> bool`** — do these two point at the *same* value, rather than at equal values. [docs](https://doc.rust-lang.org/std/rc/struct.Rc.html#method.ptr_eq)
- **`Rc::try_unwrap(rc) -> Result<T, Rc<T>>`** — takes the value back out, but only when this is the last `Rc`; otherwise it hands the `Rc` back as the error. [docs](https://doc.rust-lang.org/std/rc/struct.Rc.html#method.try_unwrap)
- **`Rc::downgrade(&rc) -> Weak<T>`** — a pointer that does *not* keep the value alive, which is how you break a reference cycle. [docs](https://doc.rust-lang.org/std/rc/struct.Rc.html#method.downgrade)
- **`Weak::upgrade(&self) -> Option<Rc<T>>`** — `Some(rc)` while the value still exists, `None` once it's been dropped. `Weak::new()` is one that points at nothing. [docs](https://doc.rust-lang.org/std/rc/struct.Weak.html#method.upgrade)
- **`RefCell::borrow(&self)` / `borrow_mut(&self)`** — guards that act like `&T` and `&mut T`, so you can mutate through a shared reference. The usual rule still holds, but it's checked at runtime: two live borrows with one mutable **panics** instead of failing to compile. [docs](https://doc.rust-lang.org/std/cell/struct.RefCell.html#method.borrow_mut)
- **`RefCell::into_inner(self) -> T`** — takes the value out once nobody is borrowing it. [docs](https://doc.rust-lang.org/std/cell/struct.RefCell.html#method.into_inner)

## Threads and channels

Ownership crosses thread boundaries too, which is what makes a data race a compile error. [thread docs](https://doc.rust-lang.org/std/thread/)

- **`thread::spawn(f) -> JoinHandle<T>`** — runs a closure on a new OS thread. The closure must own everything it uses, so it nearly always needs `move`. [docs](https://doc.rust-lang.org/std/thread/fn.spawn.html)
- **`handle.join() -> Result<T, _>`** — waits for that thread and gives back what it returned; `Err` if it panicked. `.unwrap()` passes the panic on, which is usually what you want. [docs](https://doc.rust-lang.org/std/thread/struct.JoinHandle.html#method.join)
- **`thread::scope(|s| ...)`** — every thread spawned with `s.spawn` is joined before the scope returns, so those threads may borrow local data. The scope returns whatever its closure returns. [docs](https://doc.rust-lang.org/std/thread/fn.scope.html)
- **`mpsc::channel() -> (Sender<T>, Receiver<T>)`** — many senders, one receiver. [docs](https://doc.rust-lang.org/std/sync/mpsc/fn.channel.html)
- **`tx.send(v) -> Result<(), _>`** — moves the value into the channel; the sender can't touch it afterwards. `Err` means the receiver is gone. [docs](https://doc.rust-lang.org/std/sync/mpsc/struct.Sender.html#method.send)
- **`rx.recv() -> Result<T, _>` / `for v in rx`** — blocks until a message arrives, and ends once **every** `Sender` has been dropped. Forgetting to drop a spare sender is the classic hang. [docs](https://doc.rust-lang.org/std/sync/mpsc/struct.Receiver.html#method.recv)
- **`Arc::new(x)` / `Arc::clone(&a)`** — `Rc` with an atomic counter, so it can be shared across threads. Same methods, including `try_unwrap`. [docs](https://doc.rust-lang.org/std/sync/struct.Arc.html)
- **`mutex.lock() -> Result<MutexGuard<T>, _>`** — the only way to the data inside, unlocked automatically when the guard is dropped. The `Result` is for a poisoned lock (a thread panicked while holding it); `.unwrap()` is the usual answer. [docs](https://doc.rust-lang.org/std/sync/struct.Mutex.html#method.lock)
- **`mutex.into_inner() -> Result<T, _>`** — takes the data back out of a `Mutex` you own outright. [docs](https://doc.rust-lang.org/std/sync/struct.Mutex.html#method.into_inner)

## Ordering, comparing and mem

- **`a.cmp(&b) -> Ordering`** — `Less`, `Equal` or `Greater`, for `Ord` types. `3.cmp(&5)` is `Ordering::Less`. Swap the two sides to reverse the order. [docs](https://doc.rust-lang.org/std/cmp/trait.Ord.html#tymethod.cmp)
- **`a.partial_cmp(&b) -> Option<Ordering>`** — the version for types like `f64` where two values may not be comparable at all (`NaN`). [docs](https://doc.rust-lang.org/std/cmp/trait.PartialOrd.html#tymethod.partial_cmp)
- **`ordering.then_with(|| ...)`** — a tie-break: keeps the first result unless it was `Equal`, in which case it uses the closure's. [docs](https://doc.rust-lang.org/std/cmp/enum.Ordering.html#method.then_with)
- **`std::ptr::eq(a, b) -> bool`** — same address, not just equal contents. The tests use it to check you returned a reference into the input instead of a copy. [docs](https://doc.rust-lang.org/std/ptr/fn.eq.html)
- **`std::mem::take(&mut x) -> T`** — hands you the value and leaves `T::default()` in its place. `mem::take(&mut field)` gives you the finished `String` and an empty one to carry on with. [docs](https://doc.rust-lang.org/std/mem/fn.take.html)
- **`std::mem::swap(&mut a, &mut b)`** — exchanges two values, with no clone and no temporary. [docs](https://doc.rust-lang.org/std/mem/fn.swap.html)
- **`std::mem::replace(&mut x, new) -> T`** — like `take`, with a value of your choosing left behind. [docs](https://doc.rust-lang.org/std/mem/fn.replace.html)
