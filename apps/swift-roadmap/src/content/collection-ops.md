# Collection operations

Swift's collections come with a large set of methods that take a closure: `map`, `filter`, `reduce`, `sorted`, `first(where:)` and a few dozen more. Between them they replace most hand-written loops with a line that says what you want rather than how to walk the array. They are defined on `Sequence` and `Collection`, so the same methods work on arrays, sets, dictionaries, ranges and string characters.

Almost all of them return a *new* collection and leave the original alone. That is why they read well in a chain, and why you can call them on a `let`.

## map

`map` applies a closure to every element and returns the results, in the same order and the same number:

```swift
let words = ["swift", "go", "rust"]
words.map { $0.count }              // [5, 2, 4]
words.map { $0.uppercased() }       // ["SWIFT", "GO", "RUST"]
```

The result type follows the closure, so mapping `[String]` with a closure returning `Int` gives `[Int]`. A key path is often shorter than a closure: `words.map(\.count)`.

## filter

`filter` keeps the elements for which the closure returns `true`, in their original order:

```swift
words.filter { $0.count > 3 }       // ["swift", "rust"]
(1...10).filter { $0 % 3 == 0 }     // [3, 6, 9]
```

Filtering an array always gives an array, even when nothing matches — then it is empty, not `nil`.

## reduce

`reduce` folds a collection down to a single value. It takes a starting value and a closure receiving the running result and the next element:

```swift
[1, 2, 3, 4].reduce(0) { running, n in running + n }    // 10
[1, 2, 3, 4].reduce(1, *)                               // 24
words.reduce("") { $0 + $1 }                            // "swiftgorust"
```

The starting value is what comes back for an empty collection, which is how `reduce` avoids ever needing an optional. Pick it so that it does not disturb the operation: 0 for a sum, 1 for a product, `""` for concatenation.

`reduce(into:)` is the version for building a collection. It hands the closure the accumulator `inout`, so nothing is copied on each step:

```swift
["a", "b", "a"].reduce(into: [String: Int]()) { counts, word in
    counts[word, default: 0] += 1
}                                                       // ["a": 2, "b": 1]
```

## compactMap and flatMap

`compactMap` maps and then throws away the `nil`s, unwrapping the rest. It is the standard way to convert a list where some elements might not convert:

```swift
["1", "two", "3"].compactMap { Int($0) }    // [1, 3]
```

`flatMap` maps each element to a collection and concatenates the results, flattening one level:

```swift
[[1, 2], [3], []].flatMap { $0 }            // [1, 2, 3]
["a b", "c"].flatMap { $0.split(separator: " ") }
```

## Sorting

`sorted()` returns a sorted copy of a collection of `Comparable` elements. `sorted(by:)` takes a closure that answers "should the first come before the second?":

```swift
words.sorted()                              // ["go", "rust", "swift"]
words.sorted { $0.count < $1.count }        // ["go", "rust", "swift"]
words.sorted { $0 > $1 }                    // ["swift", "rust", "go"]
```

For several keys at once, compare tuples, which compare left to right:

```swift
words.sorted { ($0.count, $0) < ($1.count, $1) }
```

`sort()` is the in-place version and needs a `var`. Swift's sort is **not** stable, so equal elements can come out in any order — if ties matter, put the tie-breaker in the comparison rather than hoping.

## Finding things

```swift
words.first { $0.hasPrefix("r") }       // Optional("rust")
words.firstIndex(of: "go")              // Optional(1)
words.contains("go")                    // true
words.contains { $0.count > 4 }         // true
words.allSatisfy { !$0.isEmpty }        // true
words.min()                             // Optional("go")
words.max { $0.count < $1.count }       // Optional("swift")
```

Anything that might not find an answer returns an optional, and anything that can answer for an empty collection returns a `Bool`. Note that `allSatisfy` on an empty collection is `true`, and `contains` is `false`.

`min(by:)` and `max(by:)` take the same "comes before" closure as `sorted(by:)`. When several elements tie they return *an* extreme one, not a promised one — as with sorting, if which of the tied elements you get matters, put the tie-breaker into the comparison rather than relying on it.

## Grouping

`Dictionary(grouping:by:)` builds a dictionary from a key closure, with every element that produced the same key collected into an array:

```swift
Dictionary(grouping: words, by: { $0.count })
// [5: ["swift"], 2: ["go"], 4: ["rust"]]
```

For counting rather than collecting, the subscript with a default is the idiom:

```swift
var counts: [String: Int] = [:]
for w in ["a", "b", "a"] { counts[w, default: 0] += 1 }
```

`counts[w, default: 0] += 1` reads the value or 0, adds one, and writes it back — no optional handling, one lookup.

## Slices and prefixes

`prefix`, `suffix`, `dropFirst` and `dropLast` take part of a collection. They return a *slice*, which shares the original's storage and keeps its indices:

```swift
words.prefix(2)         // ["swift", "go"] as an ArraySlice
words.dropFirst()       // ["go", "rust"]
words.prefix { $0.count > 2 }   // ["swift"], stops at the first failure
```

Asking for more elements than there are is not an error: `words.prefix(99)` gives everything. Turn a slice back into an array with `Array(...)` when you need to store or return it.

## Chains and laziness

These methods compose, and each step allocates a new array:

```swift
let result = words.filter { $0.count > 2 }.map { $0.uppercased() }.sorted()
```

For a long chain over a big collection, `.lazy` makes the intermediate steps disappear: `words.lazy.filter { ... }.map { ... }` does no work until something asks for elements, and never builds the intermediate arrays. For the sizes most code deals with, the plain version is clearer and fast enough.

```swift playground
let words = ["swift", "go", "rust", "kotlin", "c", "python", "ruby"]

print(words.map(\.count))
print(words.filter { $0.count > 4 })
print("total letters:", words.reduce(0) { $0 + $1.count })

print(["1", "two", "3", "", "42"].compactMap { Int($0) })
print([[1, 2], [3], []].flatMap { $0 })

print(words.sorted())
print(words.sorted { $0.count < $1.count })
print(words.sorted { ($0.count, $0) < ($1.count, $1) })

print(words.first { $0.hasPrefix("r") } as Any)
print(words.contains("go"), words.allSatisfy { !$0.isEmpty }, [Int]().allSatisfy { $0 > 0 })
print(words.max { $0.count < $1.count } as Any)

let byLength = Dictionary(grouping: words, by: \.count)
for length in byLength.keys.sorted() {
    print("\(length): \(byLength[length]!.sorted())")
}

var counts: [Character: Int] = [:]
for c in "mississippi" { counts[c, default: 0] += 1 }
print(counts.sorted { ($0.value, $0.key) > ($1.value, $1.key) }.map { "\($0.key)\($0.value)" }.joined())

print(Array(words.prefix(3)), Array(words.suffix(2)), Array(words.dropFirst(5)))

// Try: sort by length descending, breaking ties alphabetically, with one tuple comparison.
```

## Exercises

### 1. Map and filter

Three one-line chains. None of them changes its argument.

- `squaresOfEvens(_:)` returns the squares of the even numbers, in the order they appeared.
- `longWords(_:minLength:)` returns the words with at least `minLength` characters, in order.
- `initials(_:)` returns the uppercased first letter of every word as a single `String`. Empty words contribute nothing.

```swift starter
func squaresOfEvens(_ values: [Int]) -> [Int] {
    return values
}

func longWords(_ words: [String], minLength: Int) -> [String] {
    return words
}

func initials(_ words: [String]) -> String {
    return ""
}
```

```swift test
/// keeps the evens and squares them, in order
func testSquaresOfEvens() {
    expect(squaresOfEvens([1, 2, 3, 4, 5, 6]), [4, 16, 36])
    expect(squaresOfEvens([6, 2, 4]), [36, 4, 16])
    expect(squaresOfEvens([-2, 0, 7]), [4, 0])
    expect(squaresOfEvens([]), [])
    expect(squaresOfEvens([1, 3, 5]), [])
}

/// the original array is untouched
func testNoMutation() {
    let values = [1, 2, 3, 4]
    _ = squaresOfEvens(values)
    expect(values, [1, 2, 3, 4])
    let words = ["a", "bbbb"]
    _ = longWords(words, minLength: 2)
    expect(words, ["a", "bbbb"])
}

/// minLength is inclusive
func testLongWords() {
    expect(longWords(["go", "swift", "rust", "c"], minLength: 4), ["swift", "rust"])
    expect(longWords(["go", "swift", "rust", "c"], minLength: 2), ["go", "swift", "rust"])
    expect(longWords(["go", "swift"], minLength: 99), [])
    expect(longWords([], minLength: 1), [])
    expect(longWords(["", "a"], minLength: 0), ["", "a"])
}

/// initials are uppercased and joined
func testInitials() {
    expect(initials(["portable", "network", "graphics"]), "PNG")
    expect(initials(["Rust", "is", "Fun"]), "RIF")
    expect(initials(["hello"]), "H")
    expect(initials([]), "")
    expect(initials(["", "ok", ""]), "O")
}
```

#### Uses
- [Collection operations › map](#/collection-ops/map)
- [Collection operations › filter](#/collection-ops/filter)
- [Collection operations › compactMap and flatMap](#/collection-ops/compactmap-and-flatmap)
- [Closures › Letting the compiler do the work](#/closures/letting-the-compiler-do-the-work)
- [Reference › String and Character](#/reference/string-and-character)

#### Hints
- `squaresOfEvens` is `values.filter { ... }.map { ... }`.
- `longWords` compares `$0.count` with `minLength` using `>=`.
- `initials`: `word.first` is an `Optional<Character>`, so `compactMap { $0.first }` drops the empty words. `String(...)` turns a `[Character]` into a string, and `Character.uppercased()` returns a `String`.

#### Tips
- `words.map(\.count)` is the key-path form of `words.map { $0.count }`, and reads better when the closure only reads a property.
- Filter before you map. Mapping first squares the odd numbers too, and then nothing in the result tells you which ones to drop.
- `Character.uppercased()` returns a `String`, not a `Character`, because a case change can change the length. That is why `initials` ends in a `String` rather than a `[Character]`.

#### Docs
- [Sequence.map](https://developer.apple.com/documentation/swift/sequence/map(_:))
- [Sequence.filter](https://developer.apple.com/documentation/swift/sequence/filter(_:))

### 2. Reduce

- `total(_:)` sums a list of numbers; an empty list totals 0.
- `product(_:)` multiplies them; an empty list gives 1, the value that does not disturb a product.
- `longest(_:)` returns the longest word, or `nil` for an empty list. On a tie the earlier word wins.

```swift starter
func total(_ values: [Int]) -> Int {
    return 0
}

func product(_ values: [Int]) -> Int {
    return 0
}

func longest(_ words: [String]) -> String? {
    return words.first
}
```

```swift test
/// sums, including negatives and the empty list
func testTotal() {
    expect(total([1, 2, 3, 4]), 10)
    expect(total([-5, 5]), 0)
    expect(total([-1, -2]), -3)
    expect(total([7]), 7)
    expect(total([]), 0)
}

/// products, where an empty list is 1
func testProduct() {
    expect(product([2, 3, 4]), 24)
    expect(product([5]), 5)
    expect(product([]), 1)
    expect(product([2, 0, 9]), 0)
    expect(product([-2, 3]), -6)
}

/// the longest word
func testLongest() {
    expect(longest(["go", "swift", "rust"]), "swift")
    expect(longest(["kotlin"]), "kotlin")
    expect(longest(["a", "bb", "ccc", "dd"]), "ccc")
    expect(longest([]), nil)
    expect(longest([""]), "")
}

/// ties go to the earlier word
func testLongestTies() {
    expect(longest(["rust", "swig", "java"]), "rust")
    expect(longest(["a", "b", "c"]), "a")
    expect(longest(["short", "tiny", "equal"]), "short")
}
```

#### Uses
- [Collection operations › reduce](#/collection-ops/reduce)
- [Collection operations › Finding things](#/collection-ops/finding-things)

#### Hints
- `values.reduce(0, +)` and `values.reduce(1, *)` are the whole of the first two.
- `longest` can be `words.reduce(nil) { best, word in ... }`, keeping the current best and only replacing it on a strict `>`, which leaves the earlier word in place on a tie.
- A loop over the words with `var best: String? = nil` is the same idea written longer, and easier to read the first time.

#### Tips
- Whatever you pass as the starting value is the answer for an empty collection. That is the whole reason `product([])` is 1.
- `longest` cannot lean on `max(by:)`: it does not promise which of two equal elements it returns, and the tie test requires the earlier one.

#### Docs
- [Sequence.reduce](https://developer.apple.com/documentation/swift/sequence/reduce(_:_:))

### 3. compactMap and flatMap

- `parseAll(_:)` turns a list of strings into the numbers among them, dropping anything that is not a whole number, in order. `Int("42")` returns an `Int?`.
- `flatten(_:)` concatenates a list of arrays into one, in order.
- `allWords(_:)` splits each line on spaces and returns every non-empty word, in order. Several spaces in a row do not produce empty words.

```swift starter
func parseAll(_ items: [String]) -> [Int] {
    return []
}

func flatten(_ groups: [[Int]]) -> [Int] {
    return []
}

func allWords(_ lines: [String]) -> [String] {
    return lines
}
```

```swift test
/// keeps what parses, in order
func testParseAll() {
    expect(parseAll(["1", "two", "3"]), [1, 3])
    expect(parseAll(["-4", "0", "+5"]), [-4, 0, 5])
    expect(parseAll([]), [])
    expect(parseAll(["x", "", "3.5"]), [])
    expect(parseAll(["10", "9", "8"]), [10, 9, 8])
}

/// flattens one level, keeping order
func testFlatten() {
    expect(flatten([[1, 2], [3], []]), [1, 2, 3])
    expect(flatten([]), [])
    expect(flatten([[], []]), [])
    expect(flatten([[3], [2], [1]]), [3, 2, 1])
    expect(flatten([[1, 1], [1]]), [1, 1, 1])
}

/// splits lines into words
func testAllWords() {
    expect(allWords(["the quick brown", "fox"]), ["the", "quick", "brown", "fox"])
    expect(allWords(["one"]), ["one"])
    expect(allWords([]), [])
}

/// extra spaces do not become empty words
func testSpaces() {
    expect(allWords(["  a   b  "]), ["a", "b"])
    expect(allWords(["", " ", "c"]), ["c"])
    expect(allWords(["a b", ""]), ["a", "b"])
}
```

#### Uses
- [Collection operations › compactMap and flatMap](#/collection-ops/compactmap-and-flatmap)
- [Collection operations › map](#/collection-ops/map)
- [Reference › String and Character](#/reference/string-and-character)

#### Hints
- `parseAll` is `items.compactMap { Int($0) }`, since `Int(_:)` already returns `nil` for anything that is not a number.
- `flatten` is `groups.flatMap { $0 }`.
- `allWords`: `line.split(separator: " ")` already drops empty pieces, but yields `Substring`, so map each one with `String($0)`.

#### Tips
- `split(separator:omittingEmptySubsequences:)` can keep the empty pieces if you ever want them; the default drops them.
- `compactMap` is `map` plus dropping the `nil`s; `flatMap` is `map` plus one level of flattening. Two unrelated operations that ended up with similar names.

#### Docs
- [Sequence.compactMap](https://developer.apple.com/documentation/swift/sequence/compactmap(_:))
- [Sequence.flatMap](https://developer.apple.com/documentation/swift/sequence/flatmap(_:)-jo2y)

### 4. Sorting with a tie-breaker

- `byLengthThenAlphabetical(_:)` returns the words sorted by length, shortest first, and alphabetically among words of the same length. Swift's sort is not stable, so the tie-break has to be part of the comparison.
- `topN(_:_:)` returns the `n` largest numbers, largest first. If `n` is zero or negative the result is empty, and if `n` is bigger than the list you get the whole list sorted.

Neither changes its argument.

```swift starter
func byLengthThenAlphabetical(_ words: [String]) -> [String] {
    return words.sorted()
}

func topN(_ values: [Int], _ n: Int) -> [Int] {
    return values
}
```

```swift test
/// sorts by length first
func testByLength() {
    expect(byLengthThenAlphabetical(["kotlin", "go", "rust", "c"]), ["c", "go", "rust", "kotlin"])
    expect(byLengthThenAlphabetical([]), [])
    expect(byLengthThenAlphabetical(["solo"]), ["solo"])
}

/// same-length words go alphabetically
func testTieBreak() {
    expect(byLengthThenAlphabetical(["rust", "java", "ruby", "go"]), ["go", "java", "ruby", "rust"])
    expect(byLengthThenAlphabetical(["bb", "ba", "ab", "aa"]), ["aa", "ab", "ba", "bb"])
    expect(byLengthThenAlphabetical(["zz", "a", "yy", "b"]), ["a", "b", "yy", "zz"])
    expect(byLengthThenAlphabetical(["same", "same"]), ["same", "same"])
}

/// the largest n, largest first
func testTopN() {
    expect(topN([3, 1, 4, 1, 5, 9, 2, 6], 3), [9, 6, 5])
    expect(topN([3, 1, 4], 1), [4])
    expect(topN([-5, -1, -9], 2), [-1, -5])
    expect(topN([7, 7, 7], 2), [7, 7])
}

/// awkward values of n
func testTopNEdges() {
    expect(topN([3, 1, 4], 0), [])
    expect(topN([3, 1, 4], -2), [])
    expect(topN([3, 1, 4], 10), [4, 3, 1])
    expect(topN([], 3), [])
    expect(topN([], 0), [])
}

/// the arguments are left alone
func testNoMutation() {
    let words = ["bb", "a"]
    _ = byLengthThenAlphabetical(words)
    expect(words, ["bb", "a"])
    let values = [1, 9, 5]
    _ = topN(values, 2)
    expect(values, [1, 9, 5])
}
```

#### Uses
- [Collection operations › Sorting](#/collection-ops/sorting)
- [Collection operations › Slices and prefixes](#/collection-ops/slices-and-prefixes)

#### Hints
- Compare tuples to sort by two keys at once: `words.sorted { ($0.count, $0) < ($1.count, $1) }`.
- `topN` is a descending sort followed by `prefix(n)`, wrapped in `Array(...)` to get an array back.
- `prefix` copes with an `n` larger than the collection on its own, but a negative `n` traps, so clamp it with `max(0, n)`.

#### Tips
- A tuple comparison compares the first elements, and only looks at the second when the first are equal — exactly what a tie-breaker is.
- `prefix(n)` copes happily with an `n` larger than the collection but traps on a negative one. Only one of the two needs guarding.

#### Docs
- [Sequence.sorted(by:)](https://developer.apple.com/documentation/swift/sequence/sorted(by:))

### 5. Counting and grouping

- `wordFrequencies(_:)` counts how many times each word appears.
- `groupByFirstLetter(_:)` groups words by their first character, keeping each group in the order the words arrived. Empty words are skipped entirely.
- `mostCommon(_:)` returns the word that appears most often, or `nil` for an empty list. When several words tie, the alphabetically first of them wins.

```swift starter
func wordFrequencies(_ words: [String]) -> [String: Int] {
    return [:]
}

func groupByFirstLetter(_ words: [String]) -> [Character: [String]] {
    return [:]
}

func mostCommon(_ words: [String]) -> String? {
    return words.first
}
```

```swift test
/// counts each word
func testFrequencies() {
    expect(wordFrequencies(["a", "b", "a"]), ["a": 2, "b": 1])
    expect(wordFrequencies([]), [:])
    expect(wordFrequencies(["solo"]), ["solo": 1])
    expect(wordFrequencies(["x", "x", "x"]), ["x": 3])
    expect(wordFrequencies(["", ""]), ["": 2])
}

/// groups by first letter, in arrival order
func testGrouping() {
    expect(groupByFirstLetter(["ant", "bee", "ape"]), ["a": ["ant", "ape"], "b": ["bee"]])
    expect(groupByFirstLetter([]), [:])
    expect(groupByFirstLetter(["zebra"]), ["z": ["zebra"]])
    expect(groupByFirstLetter(["ba", "ab", "bb", "aa"]), ["b": ["ba", "bb"], "a": ["ab", "aa"]])
}

/// empty words are skipped, and case matters
func testGroupingEdges() {
    expect(groupByFirstLetter(["", "ant", ""]), ["a": ["ant"]])
    expect(groupByFirstLetter([""]), [:])
    expect(groupByFirstLetter(["Ant", "ant"]), ["A": ["Ant"], "a": ["ant"]])
}

/// the most common word
func testMostCommon() {
    expect(mostCommon(["a", "b", "a"]), "a")
    expect(mostCommon(["x"]), "x")
    expect(mostCommon([]), nil)
    expect(mostCommon(["c", "b", "b", "a", "a", "a"]), "a")
}

/// ties are broken alphabetically
func testMostCommonTies() {
    expect(mostCommon(["b", "a"]), "a")
    expect(mostCommon(["z", "y", "z", "y", "x"]), "y")
    expect(mostCommon(["dog", "cat", "dog", "cat", "emu"]), "cat")
}
```

#### Uses
- [Collection operations › Grouping](#/collection-ops/grouping)
- [Collection operations › reduce](#/collection-ops/reduce)
- [Collection operations › Sorting](#/collection-ops/sorting)

#### Hints
- `wordFrequencies`: a loop with `counts[word, default: 0] += 1`, or `words.reduce(into: [:]) { $0[$1, default: 0] += 1 }`.
- `groupByFirstLetter`: `Dictionary(grouping:by:)` needs a non-optional key, so filter the empty words out first, then group by `$0.first!` — or build the dictionary yourself with `groups[first, default: []].append(word)`.
- `mostCommon`: count first, then pick the winner. Sorting the pairs by `(-count, word)` and taking the first handles the tie rule in one comparison.

#### Tips
- `Dictionary(grouping:by:)` preserves the order of the elements within each group, which is what the arrival-order test checks.
- Sorting the counted pairs by `(-count, word)` puts the biggest count first *and* breaks ties alphabetically in a single comparison, because the negation reverses only the first element.

#### Docs
- [Dictionary(grouping:by:)](https://developer.apple.com/documentation/swift/dictionary/init(grouping:by:)-4s8m9)
- [Dictionary subscript with a default](https://developer.apple.com/documentation/swift/dictionary/subscript(_:default:))
