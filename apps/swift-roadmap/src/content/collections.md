# Collections

Swift has three collections in the standard library: `Array` for an ordered list, `Dictionary` for key–value lookup, and `Set` for unordered membership. All three are generic over what they hold, all three are structs with value semantics, and all three are the same collection protocol underneath, so what you learn about iterating one applies to the others.

## Arrays

An array holds values of one type in order. The type is `[Element]`, and a literal is usually all the compiler needs.

```swift
var scores = [10, 20, 30]         // [Int]
let names: [String] = []          // empty needs the type written down
let zeros = [Int](repeating: 0, count: 3)   // [0, 0, 0]

scores.count        // 3
scores.isEmpty      // false
scores[0]           // 10, indices start at zero
scores[1...2]       // [20, 30], a slice of the same elements
scores.contains(20) // true
```

Indices are checked at runtime: `scores[5]` on a three-element array does not return garbage or `nil`, it traps and stops the program. `scores.first` and `scores.last` are the safe way to peek at the ends — they hand back an optional, which is what the Optionals module is about.

## Adding and removing

A `var` array grows and shrinks; a `let` array cannot be touched after it is created.

```swift
var queue = ["a", "b"]
queue.append("c")               // ["a", "b", "c"]
queue += ["d", "e"]             // append a whole sequence
queue.insert("start", at: 0)    // ["start", "a", "b", "c", "d", "e"]
let removed = queue.remove(at: 1)   // "a", and the array closes the gap
queue.removeLast()              // traps on an empty array
queue.removeAll()
```

`append` is the cheap one: arrays keep spare capacity, so adding to the end is constant time on average, while inserting or removing at the front shifts everything after it.

## Dictionaries

A dictionary maps keys to values, with the type written `[Key: Value]`. Keys must be `Hashable`, which every basic type already is.

```swift
var ages = ["Ada": 36, "Grace": 45]
ages["Alan"] = 41               // adds
ages["Ada"] = 37                // replaces
ages["Grace"] = nil             // removes
ages.count                      // 2
ages.keys.sorted()              // ["Ada", "Alan"]
```

Looking a key up gives an optional, because the key may not be there. When you have a sensible default, the `default:` subscript skips the unwrapping entirely — and it is the trick that makes counting a one-liner:

```swift
var counts: [String: Int] = [:]
for word in ["a", "b", "a"] {
    counts[word, default: 0] += 1     // reads 0 when absent, writes back
}
// ["a": 2, "b": 1]
```

## Sets

A `Set` holds each value at most once and answers "is this in here?" in constant time. A set literal looks exactly like an array literal, so the type has to be written down.

```swift
var tags: Set<String> = ["swift", "ios"]
tags.insert("swift")        // already there, nothing changes
tags.contains("ios")        // true
tags.remove("ios")

let a: Set = [1, 2, 3]
let b: Set = [3, 4]
a.union(b)                  // [1, 2, 3, 4]
a.intersection(b)           // [3]
a.subtracting(b)            // [1, 2]
a.symmetricDifference(b)    // [1, 2, 4]
```

A set has no order at all: it will iterate in whatever order its hashing produced, and that order may differ between runs. When you need an ordered answer out of a set, sort it.

## Iterating

`for … in` walks any of them. An array yields elements, a set yields members, a dictionary yields `(key, value)` pairs that you can decompose in the loop header.

```swift
for score in [10, 20] { print(score) }

for (name, age) in ["Ada": 36] { print("\(name) is \(age)") }

for (index, letter) in ["a", "b"].enumerated() {
    print("\(index): \(letter)")     // 0: a, 1: b
}
```

`enumerated()` is how you get the position alongside the element, instead of looping over `0..<array.count` and subscripting. Iterating a dictionary or a set gives no guaranteed order; iterating an array always gives you its order.

## Sorting

`sorted()` returns a new sorted array and leaves the original alone; `sort()` sorts a `var` array in place. Both need the elements to be `Comparable`, which `Int`, `Double` and `String` all are.

```swift
let numbers = [3, 1, 2]
numbers.sorted()            // [1, 2, 3], numbers is untouched
numbers.sorted().reversed() // 3, 2, 1
Set([3, 1, 2]).sorted()     // [1, 2, 3], an Array now
["b", "A"].sorted()         // ["A", "b"], capitals sort before lowercase
```

Sorting by something other than the natural order takes a closure, `sorted(by:)`, which the Closures and Collection operations modules cover.

## Collections are values

All three are structs, so assigning one or passing it to a function copies it. Two variables never quietly share a collection the way they would in Python or JavaScript.

```swift
var a = [1, 2, 3]
var b = a
b.append(4)
// a is still [1, 2, 3]
```

The copy is lazy underneath — the buffer is shared until one side writes — so this costs nothing until it has to.

```swift playground
let words = ["pear", "fig", "pear", "plum", "fig", "pear"]

var counts: [String: Int] = [:]
for word in words {
    counts[word, default: 0] += 1
}

for name in counts.keys.sorted() {
    print("\(name): \(counts[name, default: 0])")
}

var seen: Set<String> = []
var unique: [String] = []
for word in words where !seen.contains(word) {
    seen.insert(word)
    unique.append(word)
}
print("first appearances: \(unique)")

let sweet: Set = ["fig", "plum", "date"]
print("sweet ones here: \(seen.intersection(sweet).sorted())")

for (index, word) in unique.enumerated() {
    print("\(index + 1). \(word)")
}

// Try: print `counts` directly and run it twice — the order of the pairs is not promised.
```

## Exercises

### 1. Count the words

`tally(_:)` counts how often each word appears and returns the counts as a dictionary. An empty list gives an empty dictionary. Words are compared exactly, so `"Fig"` and `"fig"` are two different words.

```swift starter
func tally(_ words: [String]) -> [String: Int] {
    return [:]
}
```

```swift test
/// counts repeated words
func testCounts() {
    expect(tally(["a", "b", "a"]), ["a": 2, "b": 1])
    expect(tally(["fig", "fig", "fig"]), ["fig": 3])
}

/// every word appears once in the result
func testDistinct() {
    expect(tally(["x", "y", "z"]), ["x": 1, "y": 1, "z": 1])
    expect(tally(["one"]), ["one": 1])
}

/// an empty list counts nothing
func testEmpty() {
    expect(tally([]), [:])
}

/// case matters
func testCaseSensitive() {
    expect(tally(["Fig", "fig", "Fig"]), ["Fig": 2, "fig": 1])
    expect(tally(["", "", "a"]), ["": 2, "a": 1])
}
```

#### Uses
- [Collections › Dictionaries](#/collections/dictionaries)
- [Collections › Iterating](#/collections/iterating)

#### Hints
- Start from `var counts: [String: Int] = [:]`. The empty literal needs the type written out.
- Inside the loop, `counts[word, default: 0] += 1` handles the first sighting and every later one the same way.
- Without the `default:` subscript you would have to unwrap the optional the plain subscript returns.

#### Tips
- This is the standard way to count anything in Swift, and it works for any `Hashable` key: characters, numbers, enum cases.
- `counts[word, default: 0] += 1` is one lookup, not a read followed by a write. That is why it beats `counts[word] = (counts[word] ?? 0) + 1`.

#### Docs
- [Dictionaries](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/collectiontypes/#Dictionaries)

### 2. First appearances

`uniqueInOrder(_:)` removes repeats but keeps the order the values first appeared in: `[3, 1, 3, 2, 1]` becomes `[3, 1, 2]`. An empty list stays empty.

```swift starter
func uniqueInOrder(_ items: [Int]) -> [Int] {
    return items
}
```

```swift test
/// keeps the first of each repeat
func testRepeats() {
    expect(uniqueInOrder([3, 1, 3, 2, 1]), [3, 1, 2])
    expect(uniqueInOrder([1, 1, 2, 2, 3, 3]), [1, 2, 3])
}

/// leaves a list with no repeats alone
func testNoRepeats() {
    expect(uniqueInOrder([1, 2, 3]), [1, 2, 3])
    expect(uniqueInOrder([9, 4, 7]), [9, 4, 7])
}

/// order is first appearance, not sorted order
func testOrder() {
    expect(uniqueInOrder([5, 1, 5, 0, 1]), [5, 1, 0])
    expect(uniqueInOrder([0, -1, 0, -1, 5]), [0, -1, 5])
}

/// empty and all-the-same lists
func testEdges() {
    expect(uniqueInOrder([]), [])
    expect(uniqueInOrder([7, 7, 7]), [7])
    expect(uniqueInOrder([42]), [42])
}
```

#### Uses
- [Collections › Sets](#/collections/sets)
- [Collections › Arrays](#/collections/arrays)
- [Collections › Iterating](#/collections/iterating)

#### Hints
- Keep two things: a `Set<Int>` of what you have already seen, and the `[Int]` you are building.
- For each item, if the set does not contain it, insert it and append it to the result.
- `insert` returns whether it actually inserted, so `if seen.insert(item).inserted { … }` does both steps at once.

#### Tips
- Checking `result.contains(item)` instead of a set also works, but it rescans the whole result every time. The set makes each check constant time.
- `seen.insert(item)` returns `(inserted:memberAfterInsert:)`, so `if seen.insert(item).inserted` records and tests in one line. Ignoring the return value is valid Swift and quietly keeps every duplicate.

#### Docs
- [Sets](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/collectiontypes/#Sets)

### 3. Tags in common

`commonTags(_:_:)` returns the tags that appear in both lists, each one once, sorted alphabetically. Either list may contain repeats or be empty.

```swift starter
func commonTags(_ first: [String], _ second: [String]) -> [String] {
    return first
}
```

```swift test
/// the overlap, sorted
func testOverlap() {
    expect(commonTags(["swift", "ios", "ui"], ["ui", "swift", "tv"]), ["swift", "ui"])
    expect(commonTags(["z", "a", "m"], ["m", "z", "a"]), ["a", "m", "z"])
}

/// no overlap gives nothing
func testNoOverlap() {
    expect(commonTags(["a", "b"], ["c", "d"]), [])
    expect(commonTags(["a"], []), [])
    expect(commonTags([], ["a"]), [])
}

/// repeats appear once
func testRepeats() {
    expect(commonTags(["a", "a", "b"], ["a", "a"]), ["a"])
    expect(commonTags(["x", "x"], ["x", "y", "x"]), ["x"])
}

/// the result is sorted, not in input order
func testSorted() {
    expect(commonTags(["ui", "swift", "api"], ["api", "swift", "ui"]), ["api", "swift", "ui"])
    expect(commonTags(["B", "a"], ["a", "B"]), ["B", "a"])
}
```

#### Uses
- [Collections › Sets](#/collections/sets)
- [Collections › Sorting](#/collections/sorting)

#### Hints
- `Set(first)` builds a set from an array, and drops the repeats for you.
- `Set(first).intersection(second)` is the overlap; `intersection` happily takes any sequence, so the second one need not be a set.
- A set has no order, so finish with `.sorted()` to get the array back in the promised order.

#### Tips
- `"B"` sorts before `"a"` because the comparison is on Unicode scalar values, where every capital letter comes before every lowercase one.
- `intersection` takes any sequence, not only another `Set`, so only one of the two arguments needs converting.

#### Docs
- [Set operations](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/collectiontypes/#Performing-Set-Operations)

### 4. Rotate a list

`rotated(_:by:)` moves every element `n` places toward the front, wrapping the ones that fall off round to the back: `[1, 2, 3, 4, 5]` rotated by 2 is `[3, 4, 5, 1, 2]`. A rotation larger than the list wraps round again, a negative rotation goes the other way, and an empty list rotates to an empty list.

```swift starter
func rotated(_ items: [Int], by n: Int) -> [Int] {
    return items
}
```

```swift test
/// rotates toward the front
func testRotates() {
    expect(rotated([1, 2, 3, 4, 5], by: 2), [3, 4, 5, 1, 2])
    expect(rotated([1, 2, 3, 4, 5], by: 1), [2, 3, 4, 5, 1])
}

/// a full turn changes nothing
func testFullTurn() {
    expect(rotated([1, 2, 3, 4, 5], by: 0), [1, 2, 3, 4, 5])
    expect(rotated([1, 2, 3, 4, 5], by: 5), [1, 2, 3, 4, 5])
    expect(rotated([1, 2, 3, 4, 5], by: 10), [1, 2, 3, 4, 5])
}

/// rotations bigger than the list wrap round
func testWraps() {
    expect(rotated([1, 2, 3, 4, 5], by: 7), [3, 4, 5, 1, 2])
    expect(rotated([1, 2, 3], by: 100), [2, 3, 1])
}

/// negative rotations go the other way
func testNegative() {
    expect(rotated([1, 2, 3, 4, 5], by: -1), [5, 1, 2, 3, 4])
    expect(rotated([1, 2, 3, 4, 5], by: -6), [5, 1, 2, 3, 4])
    expect(rotated([1, 2, 3], by: -4), [3, 1, 2])
}

/// empty and single-element lists
func testSmall() {
    expect(rotated([], by: 3), [])
    expect(rotated([], by: 0), [])
    expect(rotated([42], by: 4), [42])
    expect(rotated([42], by: -4), [42])
}
```

#### Uses
- [Collections › Arrays](#/collections/arrays)
- [Collections › Adding and removing](#/collections/adding-and-removing)
- [Variables & types › Integer division and remainder](#/basics/integer-division-and-remainder)

#### Hints
- Return early when `items.isEmpty`: every approach here divides by the count, and `% 0` traps.
- `n % count` brings any rotation into range, but stays negative for a negative `n`. `((n % count) + count) % count` makes it a positive shift that means the same thing.
- Then build the result: element `i` of the answer is `items[(i + shift) % count]`.

#### Tips
- Slices can do it in one line once the shift is normalised: `Array(items[shift...] + items[..<shift])`. Reading it back as an `Array` matters, because adding two slices gives you a slice.
- `% 0` traps, so the empty-list guard is load-bearing rather than defensive.
- A negative `n` is where most attempts break: `-1 % 5` is `-1` in Swift, not `4`. That is what the `+ count) % count` dance is for.

#### Docs
- [Array](https://developer.apple.com/documentation/swift/array)
