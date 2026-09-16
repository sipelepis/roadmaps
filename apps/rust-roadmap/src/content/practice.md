# Practice problems

This module is practice only: twelve small, self-contained problems of the kind you meet in interviews, scripts and code review. Nothing new is introduced; the point is fluency with ownership, iterators, error types and lifetimes working together.

## Tips

- Read the tests before writing code. They are the specification, and they show the exact types expected.
- Get it compiling first with the simplest thing that works, even a `for` loop with `clone()`. Then look for the idiomatic version: an iterator chain, the `entry` API, `sort_by_key`, `?`.
- When the borrow checker objects, read the whole message. It usually names the exact line where the borrow starts and the line where the conflict happens.
- `println!` and `dbg!(expr)` output shows up in the results for failing tests, which is the fastest way to see what's going on.
- Signatures are given. Where a function returns a reference, the signature already says which input it borrows from; your job is the body.

The playground below is scratch space. It solves a warm-up problem, two sum, to show the shape: a `HashMap` from value to index, one pass, `Option` for "not found".

```rust playground
use std::collections::HashMap;

/// Indices of the two numbers that add up to `target`, if any.
fn two_sum(nums: &[i32], target: i32) -> Option<(usize, usize)> {
    let mut seen: HashMap<i32, usize> = HashMap::new();
    for (i, &n) in nums.iter().enumerate() {
        if let Some(&j) = seen.get(&(target - n)) {
            return Some((j, i));
        }
        seen.insert(n, i);
    }
    None
}

fn main() {
    println!("{:?}", two_sum(&[2, 7, 11, 15], 9));   // Some((0, 1))
    println!("{:?}", two_sum(&[3, 2, 4], 6));        // Some((1, 2))
    println!("{:?}", two_sum(&[1, 2], 10));          // None

    assert_eq!(two_sum(&[5, 5], 10), Some((0, 1)));
    println!("all checks passed");
}

// Try: paste a practice problem's signature here and poke at it with println! before running its tests.
```

## Exercises

### 1. Top words

`top_words(text, k)` returns the `k` most frequent words with their counts. Words are runs of letters (split on anything that isn't `char::is_alphabetic`), compared lowercase. Sort by count, highest first, then alphabetically. If there are fewer than `k` distinct words, return them all.

Two tools help. `split` also accepts a closure that decides which characters are separators, as in `text.split(|c: char| c == ';')`; two separators in a row produce an empty piece between them. And `v.sort_by(|a, b| ...)` sorts with a closure that compares two items and returns an `Ordering`, built with the same `cmp` and `then_with` you'd use in a hand-written `Ord`.

```rust starter
pub fn top_words(text: &str, k: usize) -> Vec<(String, usize)> {
    todo!()
}
```

```rust test
fn pairs(items: &[(&str, usize)]) -> Vec<(String, usize)> {
    items.iter().map(|(w, n)| (w.to_string(), *n)).collect()
}

/// most frequent first, ties alphabetical
#[test]
fn top_three() {
    let text = "The cat and the hat. The END, the end!";
    assert_eq!(top_words(text, 3), pairs(&[("the", 4), ("end", 2), ("and", 1)]));
    assert_eq!(top_words("a b c a b a", 2), pairs(&[("a", 3), ("b", 2)]));
}

/// fewer words than k
#[test]
fn fewer_than_k() {
    assert_eq!(top_words("b a b", 10), pairs(&[("b", 2), ("a", 1)]));
    assert!(top_words("...", 2).is_empty());
    assert!(top_words("a b c", 0).is_empty());
}

/// equal counts sort alphabetically
#[test]
fn ties() {
    assert_eq!(top_words("c b a", 2), pairs(&[("a", 1), ("b", 1)]));
    assert_eq!(top_words("z y y x z", 3), pairs(&[("y", 2), ("z", 2), ("x", 1)]));
}

/// anything that isn't a letter separates words, and letters can be non-ASCII
#[test]
fn separators() {
    assert_eq!(top_words("one2two3one", 5), pairs(&[("one", 2), ("two", 1)]));
    assert_eq!(top_words("Été, été!", 1), pairs(&[("été", 2)]));
}
```

#### Uses
- [Vec & HashMap › The entry API](#/collections/the-entry-api)
- [Traits › Implementing them by hand](#/traits/implementing-them-by-hand)
- [Closures & iterators › `collect` builds whatever you ask for](#/iterators/collect-builds-whatever-you-ask-for)
- [Strings & slices › Everyday string methods](#/strings/everyday-string-methods)
- [Vec & HashMap › Reading and cutting a slice](#/collections/reading-and-cutting-a-slice)

#### Hints
- Count first: split on non-letters, skip the empty pieces, and count each word's `to_lowercase()` in a `HashMap` with the entry API.
- Collect the map into a `Vec<(String, usize)>`, then `sort_by`: counts compared the other way round, then words in the normal order.
- Keep the first `k`: `into_iter().take(k).collect()`, or `truncate(k)` on the `Vec`.

#### Tips
- A `HashMap` has no order, so the sort has to settle every tie. Otherwise the output can change from run to run, and you get a test that fails once a fortnight.
- Splitting on "not a letter" leaves empty pieces between two separators, as in `"end, the"`. Skip them, or `""` becomes a word with a count of its own.
- `sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)))` says the whole rule in one line: counts descending, then words ascending. Note which side is reversed and which isn't.
- `k` larger than the number of words, and `k` of zero, both need to work. `take(k)` handles both without an `if`; `truncate(k)` does too.

#### Docs
- [std: slice::sort_by](https://doc.rust-lang.org/std/primitive.slice.html#method.sort_by)
- [std: str::split](https://doc.rust-lang.org/std/primitive.str.html#method.split)

### 2. Balanced brackets

Return `true` if every `(`, `[` and `{` is closed by the matching bracket in the right order. Other characters are ignored. A `Vec<char>` makes a good stack.

```rust starter
pub fn balanced(text: &str) -> bool {
    todo!()
}
```

```rust test
/// matching brackets
#[test]
fn balanced_inputs() {
    assert!(balanced("({[]})"));
    assert!(balanced(""));
    assert!(balanced("fn main() { let v = vec![1, 2]; }"));
    assert!(balanced("{[()()]}[]"));
    assert!(balanced("no brackets"));
}

/// mismatched, unclosed or out of order
#[test]
fn unbalanced_inputs() {
    assert!(!balanced("(]"));
    assert!(!balanced("(("));
    assert!(!balanced(")("));
    assert!(!balanced("{[}]"));
    assert!(!balanced("[(])"));
    assert!(!balanced("(()"));
}

/// a closer with nothing open
#[test]
fn stray_closer() {
    assert!(!balanced("]"));
    assert!(!balanced("())"));
    assert!(!balanced("a}"));
}
```

#### Uses
- [Enums & match › Patterns](#/enums/patterns)
- [Vec & HashMap › `Vec<T>`](#/collections/vect)
- [Strings & slices › UTF-8 and why you can't index](#/strings/utf-8-and-why-you-cant-index)

#### Hints
- Walk `text.chars()` and push every opening bracket onto the stack.
- On a closing bracket, work out which opener it needs, then `pop()` and compare. Anything but `Some(that opener)` means the text is unbalanced.
- At the end the stack must be empty, or something was left open.

#### Tips
- `Option<char>` compares with `==` and `!=` like any value, so the popped value needs no unwrapping: an empty stack gives `None`, which never equals `Some(opener)`. That one fact removes the special case for `"]"`.
- Two things make it unbalanced, and both are easy to forget: a closer that doesn't match, and openers still on the stack at the end. `"(()"` only fails the second check.
- `return false` the moment a closer doesn't match. Carrying on with a corrupted stack can accidentally come out balanced later.
- A `Vec<char>` is the stack here, not a counter. A single depth counter can't tell `"{[}]"` from `"{[]}"`, which is exactly what the `unbalanced_inputs` test checks.

#### Docs
- [std: Vec::pop](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.pop)

### 3. Run-length encoding

`rle_encode("aaabcc")` is `"3a1b2c"`: each run of the same character becomes its length and the character. `rle_decode` reverses it and returns `None` for malformed input: a character with no count before it, or a count with no character after it. Counts can have several digits. You can assume the original text contains no digits.

```rust starter
pub fn rle_encode(text: &str) -> String {
    todo!()
}

pub fn rle_decode(text: &str) -> Option<String> {
    todo!()
}
```

```rust test
/// encodes runs
#[test]
fn encodes() {
    assert_eq!(rle_encode("aaabcc"), "3a1b2c");
    assert_eq!(rle_encode("ééé!"), "3é1!");
    assert_eq!(rle_encode("a"), "1a");
    assert_eq!(rle_encode("abc"), "1a1b1c");
    assert_eq!(rle_encode(""), "");
}

/// counts runs, not totals, including long ones
#[test]
fn encodes_runs() {
    assert_eq!(rle_encode("aabaa"), "2a1b2a");
    assert_eq!(rle_encode(&"z".repeat(12)), "12z");
}

/// decodes, including multi-digit counts
#[test]
fn decodes() {
    assert_eq!(rle_decode("3a1b2c"), Some("aaabcc".to_string()));
    assert_eq!(rle_decode("1a1b1c"), Some("abc".to_string()));
    assert_eq!(rle_decode("12x"), Some("x".repeat(12)));
    assert_eq!(rle_decode("10a2b"), Some("a".repeat(10) + "bb"));
    assert_eq!(rle_decode(""), Some(String::new()));
}

/// rejects malformed input
#[test]
fn malformed() {
    assert_eq!(rle_decode("a"), None);
    assert_eq!(rle_decode("3a4"), None);
    assert_eq!(rle_decode("3"), None);
    assert_eq!(rle_decode("2ab"), None);
    assert_eq!(rle_decode("a2b"), None);
}

/// round trips
#[test]
fn round_trip() {
    let text = "wwwwhyyyy  not?";
    assert_eq!(rle_decode(&rle_encode(text)).as_deref(), Some(text));
    let text = "é".repeat(15) + "xy";
    assert_eq!(rle_decode(&rle_encode(&text)), Some(text));
}
```

#### Uses
- [Strings & slices › Building strings](#/strings/building-strings)
- [Strings & slices › Everyday string methods](#/strings/everyday-string-methods)
- [Option & Result › Working with `Result`](#/option-result/working-with-result)
- [Enums & match › `if let` and `let else`](#/enums/if-let-and-let-else)
- [Reference › char](#/reference/char)

#### Hints
- Encode: walk `text.chars()`, keeping the current character (an `Option<char>`, `None` at the start) and how many times it has repeated. When the character changes, write out the finished run. Don't forget the last run after the loop.
- Decode: collect digits into a `String` as you go. A non-digit ends a count: parse it (an empty count doesn't parse, which is the malformed case), append the character that many times, and start a fresh count.
- `c.to_string().repeat(n)` builds a run. Digits left over after the loop are a count with no character: `None`.

#### Tips
- Going through `chars()` everywhere, and never slicing bytes, is what makes `é` work like any other character.
- The last run has no character after it to trigger the flush. Writing it out after the loop is the step this exercise is really testing, and `"a"` is the test that catches it.
- Same on the decode side: digits left over when the input ends are a count with no character, which is `None`, not a silent success.
- An empty count doesn't parse, so `"a"` and `"a2b"` fall out as `None` from `parse` rather than needing a check of their own. Let the type do the work.
- Encode and decode are checked against each other in `round_trip`. When one of them is subtly wrong, that's usually the test that tells you which.

#### Docs
- [std: str::chars](https://doc.rust-lang.org/std/primitive.str.html#method.chars)
- [std: str::repeat](https://doc.rust-lang.org/std/primitive.str.html#method.repeat)

### 4. Merge intervals

Given `(start, end)` intervals in any order, merge the ones that overlap or touch and return the result sorted by start.

`intervals.to_vec()` copies the slice into a `Vec` you can sort, and `sort()` orders tuples by their first element, then by the second.

```rust starter
pub fn merge_intervals(intervals: &[(i32, i32)]) -> Vec<(i32, i32)> {
    todo!()
}
```

```rust test
/// merges overlaps
#[test]
fn merges() {
    assert_eq!(merge_intervals(&[(1, 3), (2, 6), (8, 10), (15, 18)]), vec![(1, 6), (8, 10), (15, 18)]);
    assert_eq!(merge_intervals(&[(1, 4), (4, 5)]), vec![(1, 5)]);
    assert_eq!(merge_intervals(&[(-5, -1), (-2, 0)]), vec![(-5, 0)]);
}

/// intervals that don't touch stay apart
#[test]
fn apart() {
    assert_eq!(merge_intervals(&[(1, 2), (3, 4)]), vec![(1, 2), (3, 4)]);
    assert_eq!(merge_intervals(&[(3, 4)]), vec![(3, 4)]);
}

/// unsorted and nested input
#[test]
fn unsorted() {
    assert_eq!(merge_intervals(&[(5, 7), (1, 10), (12, 13), (2, 3)]), vec![(1, 10), (12, 13)]);
    assert_eq!(merge_intervals(&[(4, 12), (2, 3), (1, 10)]), vec![(1, 12)]);
    assert_eq!(merge_intervals(&[(6, 8), (1, 2), (2, 6)]), vec![(1, 8)]);
    assert!(merge_intervals(&[]).is_empty());
}
```

#### Uses
- [Vec & HashMap › `Vec<T>`](#/collections/vect)
- [Vec & HashMap › Indexing vs `get`](#/collections/indexing-vs-get)
- [Vec & HashMap › Reading and cutting a slice](#/collections/reading-and-cutting-a-slice)
- [Enums & match › `if let` and `let else`](#/enums/if-let-and-let-else)

#### Hints
- Sort a copy first. After that, anything that can merge with an interval comes right after it.
- Walk the sorted intervals, building an output `Vec`. If an interval starts at or before the end of the last one in the output, extend that one; otherwise push it.
- Extend with `max`, not by overwriting the end: `(1, 10)` followed by `(2, 3)` must stay `(1, 10)`.

#### Tips
- `out.last_mut()` returns an `Option<&mut (i32, i32)>`, so `if let Some(last) = out.last_mut()` lets you change the last interval in place.
- Sorting first is what makes one pass enough: after it, anything that can merge with an interval is the very next one, so you never look backwards.
- `last.1 = last.1.max(end)`, never `last.1 = end`. `(1, 10)` followed by `(2, 3)` is nested, not extended, and the `unsorted` test has exactly that case.
- "Overlap or touch" means `start <= last.1`, not `<`. `(1, 4)` and `(4, 5)` merge into `(1, 5)`, which is the first test's second line.
- You can't sort `intervals` itself: it's a `&[...]`, borrowed. `to_vec()` gives you an owned copy to sort, and that's the whole reason it's there.

#### Docs
- [std: slice::sort](https://doc.rust-lang.org/std/primitive.slice.html#method.sort)
- [std: slice::last_mut](https://doc.rust-lang.org/std/primitive.slice.html#method.last_mut)

### 5. Anagram groups

Group words that are anagrams of each other. Each group is sorted, and the groups are sorted by their first word. A key of the word's sorted characters identifies a group.

```rust starter
pub fn anagram_groups(words: &[&str]) -> Vec<Vec<String>> {
    todo!()
}
```

```rust test
/// groups anagrams
#[test]
fn groups() {
    let words = ["eat", "tea", "tan", "ate", "nat", "bat"];
    assert_eq!(anagram_groups(&words), vec![vec!["ate", "eat", "tea"], vec!["bat"], vec!["nat", "tan"]]);
    let words = ["listen", "google", "silent", "gogole", "enlist"];
    assert_eq!(anagram_groups(&words), vec![vec!["enlist", "listen", "silent"], vec!["gogole", "google"]]);
}

/// same letters, but not the same counts or length
#[test]
fn not_anagrams() {
    assert_eq!(anagram_groups(&["aab", "abb"]), vec![vec!["aab"], vec!["abb"]]);
    assert_eq!(anagram_groups(&["ba", "abc", "ab"]), vec![vec!["ab", "ba"], vec!["abc"]]);
}

/// one word or none
#[test]
fn small() {
    assert_eq!(anagram_groups(&["solo"]), vec![vec!["solo"]]);
    assert_eq!(anagram_groups(&["zz", "b", "a"]), vec![vec!["a"], vec!["b"], vec!["zz"]]);
    assert!(anagram_groups(&[]).is_empty());
}
```

#### Uses
- [Vec & HashMap › The entry API](#/collections/the-entry-api)
- [Vec & HashMap › Three ways to loop](#/collections/three-ways-to-loop)
- [Closures & iterators › `collect` builds whatever you ask for](#/iterators/collect-builds-whatever-you-ask-for)

#### Hints
- The key: collect the word's `chars()` into a `Vec<char>`, `sort()` it, and collect it back into a `String`. Anagrams share a key.
- Group into a map from key to `Vec<String>` with `entry(key).or_default()`.
- Move the groups out of the map with a `for` loop, sort each one, push it into the result, then sort the result.

#### Tips
- A `Vec<String>` compares element by element, so a plain `sort()` on the list of groups orders them by their first word.
- Sort each group *before* sorting the list of groups, or you're ordering by whichever word happened to arrive first.
- Sorted characters make a key that anagrams share and non-anagrams don't, including `"aab"` against `"abb"`: same letters, different counts, different keys.
- `for (_, group) in map` moves the groups out of the map instead of cloning them. Iterating over `&map` would leave you with `&Vec<String>` and a clone per group.

#### Docs
- [std: slice::sort](https://doc.rust-lang.org/std/primitive.slice.html#method.sort)

### 6. Common prefix

Return the longest prefix shared by every word, as a slice of the first word. The signature ties the result to the strings, not to the slice holding them, so it can outlive that `Vec` (the last test depends on it). Compare by `char`, not by byte, so multi-byte letters aren't cut in half.

```rust starter
pub fn common_prefix<'a>(words: &[&'a str]) -> &'a str {
    todo!()
}
```

```rust test
/// shared prefix
#[test]
fn prefix() {
    assert_eq!(common_prefix(&["flower", "flow", "flight"]), "fl");
    assert_eq!(common_prefix(&["dog", "racecar"]), "");
    assert_eq!(common_prefix(&["solo"]), "solo");
    assert_eq!(common_prefix(&[]), "");
}

/// the shortest match across all the words wins
#[test]
fn shortest() {
    assert_eq!(common_prefix(&["abc", "abc"]), "abc");
    assert_eq!(common_prefix(&["abc", "ab"]), "ab");
    assert_eq!(common_prefix(&["abcd", "abcd", "ab", "abcd"]), "ab");
    assert_eq!(common_prefix(&["interview", "internet", "in"]), "in");
    assert_eq!(common_prefix(&["", "a"]), "");
}

/// multi-byte characters
#[test]
fn unicode() {
    assert_eq!(common_prefix(&["héllo", "hélp"]), "hél");
    assert_eq!(common_prefix(&["héllo", "hèllo"]), "h");
}

/// borrows from the strings, not the Vec
#[test]
fn outlives_vec() {
    let text = String::from("interview internet interval");
    let prefix;
    {
        let words: Vec<&str> = text.split(' ').collect();
        prefix = common_prefix(&words);
    }
    assert_eq!(prefix, "inter");
}
```

#### Uses
- [Lifetimes › Tie only what's related](#/lifetimes/tie-only-whats-related)
- [Strings & slices › UTF-8 and why you can't index](#/strings/utf-8-and-why-you-cant-index)
- [Strings & slices › Slicing by byte range](#/strings/slicing-by-byte-range)
- [Enums & match › `if let` and `let else`](#/enums/if-let-and-let-else)

#### Hints
- No words means `""`. Otherwise the answer is some prefix of the first word, so measure everything against it.
- Walk the first word with `char_indices()`, which gives each `char` with its byte offset, and count characters as you go. At each position, check that every other word has the same `char` there (`chars().nth(k)`).
- At the first mismatch, slice the first word up to that byte offset. If nothing mismatches, the whole first word is the prefix.

#### Tips
- `chars().nth(k)` walks from the start every time, which is quadratic in the word length. For words that's nothing; zipping the `chars()` of two words is the linear version.
- Compare characters, slice at byte offsets. `char_indices` gives you both at once, which is why it's the right loop here: `"héllo"` and `"hélp"` share three characters and four bytes.
- A word shorter than the prefix so far ends it too. `chars().nth(k)` returning `None` is that case, and it needs the same treatment as a mismatch.
- The signature is `&[&'a str] -> &'a str`, not `&'a [&str]`. The result borrows from the strings, not from the slice holding them, which is what lets it outlive the `Vec` in the last test.

#### Docs
- [std: str::char_indices](https://doc.rust-lang.org/std/primitive.str.html#method.char_indices)

### 7. Top k

`top_k(items, k)` returns the `k` largest items, largest first. Sorting a copy is fine. For a large input and small `k`, a `std::collections::BinaryHeap` of at most `k` items (wrapped in `std::cmp::Reverse` to make it a min-heap) avoids sorting everything.

```rust starter
pub fn top_k<T: Ord + Clone>(items: &[T], k: usize) -> Vec<T> {
    todo!()
}
```

```rust test
/// largest first
#[test]
fn numbers() {
    assert_eq!(top_k(&[5, 1, 9, 3, 7], 3), vec![9, 7, 5]);
    assert_eq!(top_k(&[2, 2, 1], 2), vec![2, 2]);
    assert_eq!(top_k(&[-1, -5, -3], 3), vec![-1, -3, -5]);
    assert_eq!(top_k(&[4, 8, 1, 8, 6], 2), vec![8, 8]);
}

/// any Ord type
#[test]
fn strings() {
    assert_eq!(top_k(&["pear", "apple", "zucchini"], 1), vec!["zucchini"]);
    assert_eq!(top_k(&["pear", "apple", "zucchini"], 2), vec!["zucchini", "pear"]);
}

/// k of zero, or larger than the input
#[test]
fn edges() {
    assert_eq!(top_k(&[1, 2], 0), Vec::<i32>::new());
    assert_eq!(top_k(&[1, 2], 5), vec![2, 1]);
    assert_eq!(top_k(&[3, 1, 2], 3), vec![3, 2, 1]);
    assert_eq!(top_k::<i32>(&[], 3), Vec::<i32>::new());
}
```

#### Uses
- [Traits › Deriving the standard traits](#/traits/deriving-the-standard-traits)
- [Closures & iterators › Adapters are lazy](#/iterators/adapters-are-lazy)
- [Generics & bounds › Bound syntax](#/generics/bound-syntax)
- [Vec & HashMap › Reading and cutting a slice](#/collections/reading-and-cutting-a-slice)

#### Hints
- Copy the slice into a `Vec` with `items.to_vec()` (the `Clone` bound is what allows that) and `sort()` it.
- Sorted ascending, the largest items are at the end: take them from the back with `into_iter().rev()`, then `take(k)` and `collect`.

#### Tips
- The heap version is O(n log k) instead of O(n log n): push each item as `Reverse(item)`, and `pop` whenever the heap holds more than `k`, which throws out the smallest.
- `k` bigger than the input isn't an error. `take(k)` simply yields fewer items, so `top_k(&[1, 2], 5)` gives both without a length check.
- `Ord + Clone` is the smallest pair of bounds that works: `Ord` to sort, `Clone` because the items are behind a `&[T]` and have to be copied out.
- Sort ascending then reverse, rather than writing a descending comparator. `sort()` uses the type's own order, and one less closure is one less place to get the direction backwards.

#### Docs
- [std: BinaryHeap as a min-heap](https://doc.rust-lang.org/std/collections/struct.BinaryHeap.html#min-heap)
- [std: slice::sort](https://doc.rust-lang.org/std/primitive.slice.html#method.sort)

### 8. Matrix operations

Matrices are `Vec`s of rows, and you can assume every row has the same length. `transpose` swaps rows and columns. `multiply` returns the matrix product, or `None` when the number of columns in `a` doesn't equal the number of rows in `b`.

```rust starter
pub fn transpose(m: &[Vec<i32>]) -> Vec<Vec<i32>> {
    todo!()
}

pub fn multiply(a: &[Vec<i32>], b: &[Vec<i32>]) -> Option<Vec<Vec<i32>>> {
    todo!()
}
```

```rust test
/// transposes
#[test]
fn transposes() {
    assert_eq!(transpose(&[vec![1, 2, 3], vec![4, 5, 6]]), vec![vec![1, 4], vec![2, 5], vec![3, 6]]);
    assert_eq!(transpose(&[vec![1, 2, 3]]), vec![vec![1], vec![2], vec![3]]);
    assert_eq!(transpose(&[vec![1], vec![2]]), vec![vec![1, 2]]);
    assert_eq!(transpose(&[vec![1, 2], vec![3, 4]]), vec![vec![1, 3], vec![2, 4]]);
    assert!(transpose(&[]).is_empty());
}

/// multiplies compatible matrices
#[test]
fn multiplies() {
    let a = vec![vec![1, 2], vec![3, 4]];
    let b = vec![vec![5, 6], vec![7, 8]];
    assert_eq!(multiply(&a, &b), Some(vec![vec![19, 22], vec![43, 50]]));
    let c = vec![vec![1, 2, 3], vec![4, 5, 6]];
    let d = vec![vec![1], vec![0], vec![2]];
    assert_eq!(multiply(&c, &d), Some(vec![vec![7], vec![16]]));
    let column = vec![vec![1], vec![2], vec![3]];
    let row = vec![vec![4, 5, 6]];
    assert_eq!(multiply(&row, &column), Some(vec![vec![32]]));
    assert_eq!(multiply(&column, &row), Some(vec![vec![4, 5, 6], vec![8, 10, 12], vec![12, 15, 18]]));
}

/// rejects mismatched shapes
#[test]
fn mismatched() {
    let a = vec![vec![1, 2], vec![3, 4]];
    let c = vec![vec![1, 2, 3], vec![4, 5, 6]];
    let d = vec![vec![1], vec![0], vec![2]];
    assert_eq!(multiply(&a, &d), None);
    assert_eq!(multiply(&c, &a), None);
    assert_eq!(multiply(&d, &d), None);
}
```

#### Uses
- [Vec & HashMap › Indexing vs `get`](#/collections/indexing-vs-get)
- [Vec & HashMap › `Vec<T>`](#/collections/vect)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- Shape first: `m.len()` rows, and `m[0].len()` columns when there is a row 0. Handle the empty matrix before you index it.
- `transpose`: for each column index `c`, build a new row out of `row[c]` from every row.
- `multiply`: the shapes fit when `a`'s column count equals `b.len()`. Entry `(i, j)` is the sum over `k` of `a[i][k] * b[k][j]`.

#### Tips
- `multiply` can reuse `transpose(b)`: then every entry pairs a row of `a` with a row of the transposed `b`, which reads nicely with `zip`.
- `m[0]` panics on an empty matrix, so check `m.is_empty()` before you ask about the columns. `transpose(&[])` is in the tests for that reason.
- The shapes fit when `a[0].len() == b.len()`, and nothing else. `multiply(&d, &d)` is in the tests because a matrix is rarely compatible with itself.
- `transpose` of an empty matrix is empty, but so is `transpose` of a matrix of empty rows, and the two aren't the same thing. Index sizes, not `Vec`s, is the way to keep that straight.

#### Docs
- [Rust book: Storing lists of values with vectors](https://doc.rust-lang.org/book/ch08-01-vectors.html)

### 9. A CSV state machine

`split_csv(line)` splits one CSV line into fields. Fields are separated by commas. A field wrapped in double quotes may contain commas, and inside quotes `""` stands for one `"`. A `"` that doesn't start a field is just a character. An empty line is one empty field.

Model it as a state machine: a small enum of states (in a plain field, inside quotes, just saw a quote inside quotes) and a `match` on `(state, c)` for each character. `std::mem::take(&mut field)` hands you the finished `String` and leaves an empty one in its place.

```rust starter
pub fn split_csv(line: &str) -> Vec<String> {
    todo!()
}
```

```rust test
/// plain fields
#[test]
fn plain() {
    assert_eq!(split_csv("a,b,c"), vec!["a", "b", "c"]);
    assert_eq!(split_csv("a,,"), vec!["a", "", ""]);
    assert_eq!(split_csv(",a"), vec!["", "a"]);
    assert_eq!(split_csv("solo"), vec!["solo"]);
    assert_eq!(split_csv(""), vec![""]);
}

/// quoted commas
#[test]
fn quoted() {
    assert_eq!(split_csv("1,\"Smith, Jane\",NY"), vec!["1", "Smith, Jane", "NY"]);
    assert_eq!(split_csv("a,\"b,c\""), vec!["a", "b,c"]);
    assert_eq!(split_csv("\"x\","), vec!["x", ""]);
    assert_eq!(split_csv("\"\",x"), vec!["", "x"]);
}

/// doubled quotes inside quotes
#[test]
fn escaped_quotes() {
    assert_eq!(split_csv("\"say \"\"hi\"\"\",ok"), vec!["say \"hi\"", "ok"]);
    assert_eq!(split_csv("\"\"\"\""), vec!["\""]);
}

/// a quote in the middle of a plain field is kept
#[test]
fn inner_quote() {
    assert_eq!(split_csv("5\" pipe,x"), vec!["5\" pipe", "x"]);
    assert_eq!(split_csv("a\"b,c\"d"), vec!["a\"b", "c\"d"]);
}
```

#### Uses
- [Enums & match › Simple enums](#/enums/simple-enums)
- [Enums & match › Patterns](#/enums/patterns)
- [Strings & slices › Building strings](#/strings/building-strings)

#### Hints
- Three states: plain field, inside quotes, and just saw a quote inside quotes. Keep the `state`, the current `field: String` and the finished `fields: Vec<String>`.
- For each char, `state = match (state, c) { ... }`: each arm does its side effect (push the char, or finish the field on a `,`) and evaluates to the next state.
- A `"` opens quotes only at the start of a field. After a quote inside quotes, another `"` is a literal quote and a `,` ends the field. After the loop, push the last field.

#### Tips
- Arms are tried top to bottom, so put the specific `(state, char)` pairs first and catch-alls like `(State::Quoted, c)` after them.
- `state = match (state, c) { ... }` makes every transition visible in one table, and the compiler checks you covered the whole thing. A tangle of `if`s and flags is the version that gets a rule wrong six months later.
- An empty line is one empty field, not zero fields, so the last field is always pushed after the loop — unconditionally, with no "if it isn't empty" guard.
- `mem::take(&mut field)` gives you the finished `String` and an empty one to carry on with, in one move and no allocation. `field.clone()` followed by `field.clear()` does the same thing twice as slowly.
- A `"` only opens a quoted field at the *start* of one. In the middle it's just a character, which is what `5" pipe` tests, and it's the rule most hand-written CSV splitters get wrong.

#### Docs
- [std: mem::take](https://doc.rust-lang.org/std/mem/fn.take.html)
- [Rust book: Patterns and matching](https://doc.rust-lang.org/book/ch19-00-patterns.html)

### 10. Parse a duration

`parse_duration(text)` reads durations like `"1h30m"` or `"45s"` and returns the total in seconds. The input is one or more groups of digits followed by a unit: `h`, `m` or `s`. Report problems with `DurationError`:

- `Empty` for an empty string
- `BadUnit(c)` for any character that isn't a digit or `h`/`m`/`s` (checked first)
- `MissingNumber` for a unit with no digits before it
- `MissingUnit` for digits at the end with no unit

```rust starter
#[derive(Debug, PartialEq)]
pub enum DurationError {
    Empty,
    BadUnit(char),
    MissingNumber,
    MissingUnit,
}

pub fn parse_duration(text: &str) -> Result<u64, DurationError> {
    todo!()
}
```

```rust test
/// adds up the groups
#[test]
fn parses() {
    assert_eq!(parse_duration("1h30m"), Ok(5400));
    assert_eq!(parse_duration("45s"), Ok(45));
    assert_eq!(parse_duration("2h5s"), Ok(7205));
    assert_eq!(parse_duration("90m"), Ok(5400));
}

/// any order, repeats and zero
#[test]
fn any_order() {
    assert_eq!(parse_duration("30m1h"), Ok(5400));
    assert_eq!(parse_duration("1h1m1s"), Ok(3661));
    assert_eq!(parse_duration("1h1h"), Ok(7200));
    assert_eq!(parse_duration("100s"), Ok(100));
    assert_eq!(parse_duration("0s"), Ok(0));
}

/// empty and bad units
#[test]
fn bad_input() {
    assert_eq!(parse_duration(""), Err(DurationError::Empty));
    assert_eq!(parse_duration("5x"), Err(DurationError::BadUnit('x')));
    assert_eq!(parse_duration("1h 30m"), Err(DurationError::BadUnit(' ')));
    assert_eq!(parse_duration("2H"), Err(DurationError::BadUnit('H')));
}

/// a bad unit is reported even with no number before it
#[test]
fn bad_unit_first() {
    assert_eq!(parse_duration("x"), Err(DurationError::BadUnit('x')));
    assert_eq!(parse_duration("1h-5m"), Err(DurationError::BadUnit('-')));
}

/// numbers and units must pair up
#[test]
fn unpaired() {
    assert_eq!(parse_duration("h"), Err(DurationError::MissingNumber));
    assert_eq!(parse_duration("1hm"), Err(DurationError::MissingNumber));
    assert_eq!(parse_duration("10"), Err(DurationError::MissingUnit));
    assert_eq!(parse_duration("1h30"), Err(DurationError::MissingUnit));
    assert_eq!(parse_duration("0"), Err(DurationError::MissingUnit));
}
```

#### Uses
- [Error handling › An error enum](#/errors/an-error-enum)
- [Strings & slices › UTF-8 and why you can't index](#/strings/utf-8-and-why-you-cant-index)
- [Enums & match › `match`](#/enums/match)
- [Option & Result › Two ordinary enums](#/option-result/two-ordinary-enums)
- [Reference › char](#/reference/char)

#### Hints
- Handle `""` first. Then walk `text.chars()`, keeping a running total and the number being read as an `Option<u64>`, where `None` means no digits yet.
- A digit (`c.to_digit(10)` is `Some(d)`) extends the number: the old value times 10, plus `d`. Anything else is a unit: `match` it to 3600, 60 or 1, and any other char is a `BadUnit`.
- At a unit, no number means `MissingNumber`; otherwise add number × scale to the total and reset the number to `None`. After the loop, a leftover number is `MissingUnit`.

#### Tips
- `to_digit` returns an `Option<u32>`, so convert with `d as u64` before mixing it with a `u64`.
- The error order in the description is the order of the checks in your code. `"1h-5m"` is a `BadUnit`, not a `MissingNumber`, because the character is rejected before anything asks whether a number came first.
- `Option<u64>` for "the number being read" distinguishes *no digits yet* from *the digit zero*. A plain `u64` starting at 0 makes `"0s"` and `"s"` look the same, and both tests exist.
- After the loop, a number still in hand means `MissingUnit`. That's the only thing the end of the string can tell you, and `"1h30"` is the test for it.
- `BadUnit(c)` carries the offending character, so the caller can say which one. An error type that only said "bad input" would be no better than a `bool`.

#### Docs
- [std: char::to_digit](https://doc.rust-lang.org/std/primitive.char.html#method.to_digit)

### 11. Increasing runs

Split a slice into its maximal strictly increasing runs, returned as sub-slices of the input: `[1, 2, 5, 3, 4, 1]` becomes `[1, 2, 5]`, `[3, 4]`, `[1]`. No copying: each run borrows from `values`. (There's a one-line standard library method for this; try it by hand with indexes first.)

```rust starter
pub fn increasing_runs(values: &[i32]) -> Vec<&[i32]> {
    todo!()
}
```

```rust test
/// splits into runs
#[test]
fn runs() {
    let v = [1, 2, 5, 3, 4, 1];
    assert_eq!(increasing_runs(&v), vec![&[1, 2, 5][..], &[3, 4][..], &[1][..]]);
    assert_eq!(increasing_runs(&[1, 2, 3]), vec![&[1, 2, 3][..]]);
    assert_eq!(increasing_runs(&[3, 2, 1]), vec![&[3][..], &[2][..], &[1][..]]);
    assert_eq!(increasing_runs(&[-4, -1, -7, 0]), vec![&[-4, -1][..], &[-7, 0][..]]);
}

/// equal neighbours start a new run
#[test]
fn strictly() {
    assert_eq!(increasing_runs(&[3, 3, 4]), vec![&[3][..], &[3, 4][..]]);
    assert_eq!(increasing_runs(&[1, 2, 2]), vec![&[1, 2][..], &[2][..]]);
}

/// one value is one run, none is no runs
#[test]
fn small() {
    assert_eq!(increasing_runs(&[5]), vec![&[5][..]]);
    assert!(increasing_runs(&[]).is_empty());
}

/// runs point into the input
#[test]
fn borrows() {
    let v = vec![9, 1, 2];
    let runs = increasing_runs(&v);
    assert!(std::ptr::eq(runs[1].as_ptr(), &v[1]));
    let w = vec![1, 2, 0, 5, 3];
    let runs = increasing_runs(&w);
    assert!(std::ptr::eq(runs[2].as_ptr(), &w[4]));
}
```

#### Uses
- [Strings & slices › Slices of arrays and Vecs](#/strings/slices-of-arrays-and-vecs)
- [Vec & HashMap › Reading and cutting a slice](#/collections/reading-and-cutting-a-slice)
- [Lifetimes › Elision: when you can leave them out](#/lifetimes/elision-when-you-can-leave-them-out)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- Remember where the current run started. A run ends at index `i` when `values[i] <= values[i - 1]`.
- Loop `i` over `1..values.len()`. When a run ends, push `&values[start..i]` and move `start` to `i`.
- After the loop, the last run is still open: push it too, unless the input was empty.

#### Tips
- The one-liner is `values.chunk_by(|a, b| a < b).collect()`: `chunk_by` keeps neighbours together while the closure says they belong together. Write it by hand first, then read that line and see the same rule.
- "Strictly increasing" makes `a < b` the test and equal neighbours a break: `[3, 3, 4]` is `[3]`, `[3, 4]`. `<=` would quietly merge them and only the `strictly` test would notice.
- The last run is still open when the loop ends, and pushing it is a separate step. Guard it on a non-empty input, or you push an empty slice for `&[]`.
- Nothing is copied: each run is a `&[i32]` into `values`, which is what the `borrows` test checks with `as_ptr`. Collecting into `Vec<Vec<i32>>` would pass the first three tests and fail that one.

#### Docs
- [Rust book: Other slices](https://doc.rust-lang.org/book/ch04-03-slices.html#other-slices)
- [std: slice::chunk_by](https://doc.rust-lang.org/std/primitive.slice.html#method.chunk_by)

### 12. A calculator

`eval(expr)` evaluates integer arithmetic with `+`, `-`, `*`, `/` and parentheses. `*` and `/` bind tighter than `+` and `-`, operators of equal precedence go left to right, `/` truncates, and whitespace is ignored. There's no unary minus. Errors:

- `UnexpectedEnd` when the input stops where a number or `)` was needed
- `Unexpected(c)` for a character that doesn't fit where it appears, including anything left over after a complete expression
- `DivideByZero`

A recursive-descent parser is the classic shape: one function per precedence level (`expr` handles `+ -`, `term` handles `* /`, `factor` handles a number or a parenthesized `expr`), all sharing the input and a position in it. A struct works well for that: the characters as a `Vec<char>` (`expr.chars().collect()`), an index `pos`, and a helper method that skips spaces and returns the next `char` as an `Option<char>` without moving past it. (The standard library's version of that helper is `Peekable`: `expr.chars().peekable()` is an iterator whose `peek()` looks at the next item without consuming it.)

```rust starter
#[derive(Debug, PartialEq)]
pub enum CalcError {
    UnexpectedEnd,
    Unexpected(char),
    DivideByZero,
}

pub fn eval(expr: &str) -> Result<i64, CalcError> {
    todo!()
}
```

```rust test
/// precedence and parentheses
#[test]
fn precedence() {
    assert_eq!(eval("1 + 2 * 3"), Ok(7));
    assert_eq!(eval("(1 + 2) * 3"), Ok(9));
    assert_eq!(eval(" 2*(3+(4-1)) "), Ok(12));
    assert_eq!(eval("42"), Ok(42));
    assert_eq!(eval("123 + 456"), Ok(579));
    assert_eq!(eval("2 * 3 + 4 * 5"), Ok(26));
    assert_eq!(eval("((((7))))"), Ok(7));
}

/// left to right
#[test]
fn associativity() {
    assert_eq!(eval("8 / 2 / 2"), Ok(2));
    assert_eq!(eval("10 - 4 - 3"), Ok(3));
    assert_eq!(eval("2 - 3 + 4"), Ok(3));
    assert_eq!(eval("100 / 10 * 3"), Ok(30));
    assert_eq!(eval("7 / 2"), Ok(3));
}

/// division truncates toward zero, even below zero
#[test]
fn truncates() {
    assert_eq!(eval("(1 - 8) / 2"), Ok(-3));
    assert_eq!(eval("1 - 7 / 2"), Ok(-2));
    assert_eq!(eval("0 / 5"), Ok(0));
}

/// division by zero
#[test]
fn divide_by_zero() {
    assert_eq!(eval("10 / (5 - 5)"), Err(CalcError::DivideByZero));
    assert_eq!(eval("1 + 4 / 0"), Err(CalcError::DivideByZero));
}

/// incomplete input
#[test]
fn unexpected_end() {
    assert_eq!(eval(""), Err(CalcError::UnexpectedEnd));
    assert_eq!(eval("   "), Err(CalcError::UnexpectedEnd));
    assert_eq!(eval("2 +"), Err(CalcError::UnexpectedEnd));
    assert_eq!(eval("3 *"), Err(CalcError::UnexpectedEnd));
    assert_eq!(eval("(1 + 2"), Err(CalcError::UnexpectedEnd));
    assert_eq!(eval("("), Err(CalcError::UnexpectedEnd));
}

/// characters out of place
#[test]
fn unexpected_chars() {
    assert_eq!(eval("2 $ 3"), Err(CalcError::Unexpected('$')));
    assert_eq!(eval("1 + 2)"), Err(CalcError::Unexpected(')')));
    assert_eq!(eval("2 3"), Err(CalcError::Unexpected('3')));
    assert_eq!(eval("* 2"), Err(CalcError::Unexpected('*')));
    assert_eq!(eval("2 + + 3"), Err(CalcError::Unexpected('+')));
    assert_eq!(eval("()"), Err(CalcError::Unexpected(')')));
    assert_eq!(eval("(2)3"), Err(CalcError::Unexpected('3')));
    assert_eq!(eval("1.5"), Err(CalcError::Unexpected('.')));
}

/// no unary minus
#[test]
fn no_unary_minus() {
    assert_eq!(eval("-3"), Err(CalcError::Unexpected('-')));
    assert_eq!(eval("2 * -3"), Err(CalcError::Unexpected('-')));
}
```

#### Uses
- [Error handling › An error enum](#/errors/an-error-enum)
- [Option & Result › The `?` operator](#/option-result/the-operator)
- [Structs & methods › Methods](#/structs/methods)
- [Enums & match › Patterns](#/enums/patterns)

#### Hints
- Write the helpers first: one that skips whitespace and returns `Some(next char)` or `None` at the end without moving past it, and one that moves past it.
- `factor`: a digit starts a number (keep reading digits), `(` starts a nested `expr` that must be followed by `)`, `None` is `UnexpectedEnd`, and anything else is `Unexpected(c)`.
- `term` reads a `factor`, then loops while the next char is `*` or `/`: move past it, read another `factor`, combine (checking for zero). `expr` is the same over `term` with `+` and `-`. After the top-level `expr`, any char left over is `Unexpected`.

#### Tips
- Each level calls the next tighter one, so `1 + 2 * 3` can't group wrongly: `term` has already consumed `2 * 3` by the time `expr` looks at the `+`.
- Left-to-right falls out of *looping* at each level rather than recursing into it. `term` calling itself after a `*` would give you right associativity, and `8 / 2 / 2` would be 8.
- Check for zero before dividing. `10 / 0` panics and the test wants `Err(DivideByZero)`, so the error has to be returned rather than caught.
- Don't forget the check after the top-level `expr`. Without it, `"2 3"` parses the `2`, stops happily, and returns `Ok(2)` instead of `Unexpected('3')`.
- `?` is what keeps this readable. Every helper returns `Result<i64, CalcError>` and every call site is one character, so the parsing logic isn't buried in error plumbing.

#### Docs
- [std: iter::Peekable](https://doc.rust-lang.org/std/iter/struct.Peekable.html)
