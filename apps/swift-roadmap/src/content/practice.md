# Practice problems

This module is practice only: eleven self-contained problems of the kind that turn up in interviews, small scripts and code review. Nothing new is taught here. The point is fluency with the pieces working together — extensions and generics for shape, `throws` and `Codable` for data that might be wrong, ARC for objects that should go away, and actors for work that happens at once.

## How to work

- Read the tests before the code. They are the real specification, and they show the exact types expected.
- Get something compiling first, even a clumsy `for` loop. Then look for the version Swift wants: an extension instead of a free function, `compactMap` instead of an `if let` inside a loop, `guard` instead of nesting.
- `print(...)` output shows up under a failing test, which is the fastest way to see what is happening.
- Every signature is given. Your job is the body, and occasionally one keyword on a property declaration.
- The concurrency problems have tests that measure elapsed time. A correct-but-sequential answer passes the value checks and fails those, on purpose.

The playground below is scratch space. It solves a warm-up — grouping words into anagram sets — to show the shape of a small Swift answer: a dictionary built with `reduce(into:)`, a computed key, and a deterministic sort at the end.

```swift playground
extension String {
    /// The letters of the word in sorted order, which is the same for every anagram of it.
    var anagramKey: String { String(lowercased().sorted()) }
}

func anagramGroups(_ words: [String]) -> [[String]] {
    let groups = words.reduce(into: [String: [String]]()) { result, word in
        result[word.anagramKey, default: []].append(word)
    }
    // A dictionary has no order, so sort before returning or the answer changes run to run.
    return groups.values.map { $0.sorted() }.sorted { $0[0] < $1[0] }
}

print(anagramGroups(["listen", "silent", "enlist", "google", "banana"]))
print(anagramGroups([]))
print(anagramGroups(["one"]))

// Try a practice problem's signature here and poke at it with print before running its tests.
```

## Exercises

### 1. Balanced brackets

Add `isBalanced` to `String`. It is `true` when every `(`, `[` and `{` is closed by the matching bracket in the right order. Any other character is ignored, and the empty string is balanced.

```swift starter
extension String {
    var isBalanced: Bool {
        return true
    }
}
```

```swift test
/// well-formed brackets
func testBalanced() {
    expect("()".isBalanced, true)
    expect("([{}])".isBalanced, true)
    expect("()[]{}".isBalanced, true)
    expect("".isBalanced, true)
}

/// wrong order or wrong kind
func testMismatched() {
    expect("(]".isBalanced, false)
    expect("([)]".isBalanced, false)
    expect("{[}]".isBalanced, false)
}

/// unclosed and unopened
func testUnclosed() {
    expect("(".isBalanced, false)
    expect(")".isBalanced, false)
    expect("(()".isBalanced, false)
    expect("())".isBalanced, false)
}

/// other characters are ignored
func testIgnoresOthers() {
    expect("a(b)c".isBalanced, true)
    expect("func f() { return [1] }".isBalanced, true)
    expect("no brackets here".isBalanced, true)
    expect("if (x { y)".isBalanced, false)
}
```

#### Uses
- [Extensions › Extending types from the standard library](#/extensions/extending-types-from-the-standard-library)
- [Extensions › What an extension adds](#/extensions/what-an-extension-adds)
- [Reference › Array, Set and Dictionary](#/reference/array-set-and-dictionary)

#### Hints
- A `var stack: [Character] = []` is all the state you need: push on an opener, and on a closer check the top with `popLast()`.
- A dictionary from closer to opener — `[")": "(", "]": "[", "}": "{"]` — turns the matching into one lookup.
- At the end the stack has to be empty, otherwise something was never closed.

#### Tips
- Closing with an empty stack must fail immediately. `popLast()` returns `nil` there, so the check is the same one that catches a mismatch.
- Only the three bracket kinds matter and everything else is skipped. A `switch` with a `default: continue` says that more plainly than a chain of `if`s.

### 2. Roman numerals

Add two members to `Int`. `roman` renders a number between 1 and 3999 as a Roman numeral using the usual subtractive forms (`4` is `IV`, `900` is `CM`); any number outside that range gives `""`. `Int(roman:)` is a failable initializer that reads one back, and accepts a string only when it is exactly what `roman` would have produced — so `"IIII"` and `"iv"` are both `nil`.

```swift starter
extension Int {
    var roman: String {
        return ""
    }

    init?(roman text: String) {
        return nil
    }
}
```

```swift test
/// plain and subtractive forms
func testRoman() {
    expect(1.roman, "I")
    expect(3.roman, "III")
    expect(4.roman, "IV")
    expect(9.roman, "IX")
    expect(14.roman, "XIV")
    expect(40.roman, "XL")
}

/// the bigger machinery
func testBigRoman() {
    expect(400.roman, "CD")
    expect(1994.roman, "MCMXCIV")
    expect(2024.roman, "MMXXIV")
    expect(3999.roman, "MMMCMXCIX")
}

/// out of range
func testOutOfRange() {
    expect(0.roman, "")
    expect((-5).roman, "")
    expect(4000.roman, "")
}

/// reads a numeral back
func testParse() {
    expect(Int(roman: "I"), 1)
    expect(Int(roman: "IV"), 4)
    expect(Int(roman: "MCMXCIV"), 1994)
    expect(Int(roman: "MMMCMXCIX"), 3999)
}

/// anything not in canonical form is rejected
func testRejects() {
    expect(Int(roman: "IIII"), nil)
    expect(Int(roman: "iv"), nil)
    expect(Int(roman: ""), nil)
    expect(Int(roman: "ABC"), nil)
    expect(Int(roman: "VV"), nil)
}
```

#### Uses
- [Extensions › Adding initializers](#/extensions/adding-initializers)
- [Extensions › Extending types from the standard library](#/extensions/extending-types-from-the-standard-library)

#### Hints
- Keep the pairs in descending order, subtractive forms included: `[(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), ...]`. Then walk the list taking as many of each as fit.
- For the initializer, add up the letters the obvious way — a letter smaller than the one after it is subtracted — and then check the round trip.
- The round trip *is* the validation: parse to a number, and return `nil` unless `number.roman == text`. That rejects `"IIII"` and `"VV"` without any extra rules.

#### Tips
- `return nil` from a failable initializer on a value type is allowed at any point, before `self` has been set at all.
- The descending pair list is the whole algorithm, and the subtractive forms are four extra entries in it rather than special cases.

### 3. Read a config file

`parseConfig` turns the text of a config file into a dictionary. Lines are separated by `\n`. A blank line, or one whose first non-space character is `#`, is skipped. Every other line must contain an `=`: the key is what comes before the first one and the value is everything after it, both trimmed of surrounding spaces. A line with no `=`, or with an empty key, throws `.badLine` with the 1-based line number and the untrimmed line. A key that appears twice throws `.duplicateKey`. An empty value is fine.

```swift starter
enum ConfigError: Error, Equatable {
    case badLine(number: Int, text: String)
    case duplicateKey(String)
}

func parseConfig(_ text: String) throws -> [String: String] {
    return [:]
}
```

```swift test
func configFailure(_ text: String) -> ConfigError? {
    do { _ = try parseConfig(text); return nil } catch let e as ConfigError { return e } catch { return nil }
}

/// reads keys and values
func testReads() {
    expect(try? parseConfig("host=localhost\nport=8080"), ["host": "localhost", "port": "8080"])
    expect(try? parseConfig("a=1"), ["a": "1"])
    expect(try? parseConfig(""), [:])
}

/// blanks and comments are skipped
func testSkips() {
    expect(try? parseConfig("# a comment\nhost=x\n\n   \n  # indented comment\nport=1"),
           ["host": "x", "port": "1"])
    expect(try? parseConfig("#only a comment"), [:])
    expect(try? parseConfig("\n\n\n"), [:])
}

/// spaces around the parts are trimmed, and only the first = splits
func testTrimAndSplit() {
    expect(try? parseConfig("  host  =  local host  "), ["host": "local host"])
    expect(try? parseConfig("url=http://x/?a=1&b=2"), ["url": "http://x/?a=1&b=2"])
    expect(try? parseConfig("empty="), ["empty": ""])
}

/// bad lines are reported with their line number
func testBadLines() {
    expect(configFailure("host=x\nnonsense"), ConfigError.badLine(number: 2, text: "nonsense"))
    expect(configFailure("oops"), ConfigError.badLine(number: 1, text: "oops"))
    expect(configFailure("# c\n\n  =value"), ConfigError.badLine(number: 3, text: "  =value"))
}

/// a repeated key is an error
func testDuplicates() {
    expect(configFailure("a=1\nb=2\na=3"), ConfigError.duplicateKey("a"))
    expect(configFailure("a=1\na=1"), ConfigError.duplicateKey("a"))
    expect(configFailure("a=1\nb=2"), nil)
}
```

#### Uses
- [Error handling › Throwing](#/errors/throwing)
- [Error handling › Errors are values](#/errors/errors-are-values)
- [Strings & characters › Splitting and joining](#/strings/splitting-and-joining)
- [Strings & characters › Indices are not integers](#/strings/indices-are-not-integers)

#### Hints
- `text.split(separator: "\n", omittingEmptySubsequences: false).enumerated()` keeps the blank lines so the line numbers stay right.
- `line.firstIndex(of: "=")` gives the split point; `line[..<i]` and `line[line.index(after: i)...]` are the two halves.
- `trimmed` is `String(part).trimmingCharacters(in: .whitespaces)`, and the comment test is on the trimmed line's first character.

#### Tips
- The error carries the *untrimmed* line, so hold on to the original before you start trimming pieces off it.
- Split with `omittingEmptySubsequences: false`, or a blank line silently shifts every line number after it.
- `firstIndex(of: "=")` is what makes `url=http://x/?a=1&b=2` work. `split(separator: "=")` would cut that line into four.

### 4. First one that works

`firstSuccess` runs the closures in order and returns the result of the first one that does not throw. If every one throws, or the list is empty, it returns `nil`. It must stop as soon as something succeeds — the closures after that one are never called.

```swift starter
func firstSuccess<T>(_ attempts: [() throws -> T]) -> T? {
    return nil
}
```

```swift test
enum Nope: Error { case nope }

final class Calls {
    var count = 0
}

/// takes the first success
func testFirst() {
    expect(firstSuccess([{ 1 }, { 2 }]), 1)
    expect(firstSuccess([{ throw Nope.nope }, { 2 }, { 3 }]), 2)
    expect(firstSuccess([{ "a" }]), "a")
}

/// nothing works, or nothing to try
func testNone() {
    expect(firstSuccess([{ throw Nope.nope }, { throw Nope.nope }] as [() throws -> Int]), nil)
    expect(firstSuccess([] as [() throws -> Int]), nil)
    expect(firstSuccess([{ throw Nope.nope }] as [() throws -> String]), nil)
}

/// later attempts are not run
func testStopsEarly() {
    let calls = Calls()
    let attempts: [() throws -> Int] = [
        { calls.count += 1; throw Nope.nope },
        { calls.count += 1; return 7 },
        { calls.count += 1; return 8 },
    ]
    expect(firstSuccess(attempts), 7)
    expect(calls.count, 2)
}

/// every attempt runs when they all fail
func testRunsAll() {
    let calls = Calls()
    let attempts: [() throws -> Int] = [
        { calls.count += 1; throw Nope.nope },
        { calls.count += 1; throw Nope.nope },
        { calls.count += 1; throw Nope.nope },
    ]
    expect(firstSuccess(attempts), nil)
    expect(calls.count, 3)
}
```

#### Uses
- [Error handling › try? and try!](#/errors/try-and-try)
- [Generics › A function for any type](#/generics/a-function-for-any-type)

#### Hints
- `for attempt in attempts { if let value = try? attempt() { return value } }`, then `return nil`.
- `try?` is exactly the "I do not care why it failed" tool this needs.
- Returning from inside the loop is what gives you the "stops early" behaviour for free.

#### Tips
- `attempts.compactMap { try? $0() }.first` gives the right *value* and fails `testStopsEarly`, because `compactMap` runs every closure before `first` looks at anything.
- `try?` discards the error, which is exactly right here: the contract is "the first one that works", not "why the others did not".

### 5. Binary search

`binarySearch` finds `target` in an array that is already sorted in ascending order and contains no duplicates, and returns its index, or `nil` when it is not there. It works for any `Comparable` element.

```swift starter
func binarySearch<T: Comparable>(_ items: [T], _ target: T) -> Int? {
    return nil
}
```

```swift test
/// finds elements anywhere in the array
func testFinds() {
    let items = [1, 3, 5, 7, 9, 11]
    expect(binarySearch(items, 1), 0)
    expect(binarySearch(items, 7), 3)
    expect(binarySearch(items, 11), 5)
    expect(binarySearch([10, 20, 30], 20), 1)
}

/// reports the ones that are not there
func testMisses() {
    let items = [1, 3, 5, 7, 9, 11]
    expect(binarySearch(items, 0), nil)
    expect(binarySearch(items, 4), nil)
    expect(binarySearch(items, 12), nil)
}

/// tiny arrays
func testSmall() {
    expect(binarySearch([Int](), 1), nil)
    expect(binarySearch([5], 5), 0)
    expect(binarySearch([5], 4), nil)
    expect(binarySearch([1, 2], 2), 1)
}

/// any Comparable element, including negatives
func testOtherTypes() {
    expect(binarySearch(["ant", "bee", "cow"], "bee"), 1)
    expect(binarySearch(["ant", "bee", "cow"], "dog"), nil)
    expect(binarySearch([-9, -4, 0, 4], -4), 1)
    expect(binarySearch([-9, -4, 0, 4], -5), nil)
}

/// a large array is searched correctly at every index
func testLarge() {
    let items = (0..<1000).map { $0 * 3 }
    expect(binarySearch(items, 0), 0)
    expect(binarySearch(items, 1497), 499)
    expect(binarySearch(items, 2997), 999)
    expect(binarySearch(items, 1498), nil)
    expect((0..<1000).allSatisfy { binarySearch(items, $0 * 3) == $0 }, "every element should be found at its own index")
}
```

#### Uses
- [Generics › Constraints](#/generics/constraints)
- [Generics › A function for any type](#/generics/a-function-for-any-type)

#### Hints
- Two indices, `low = 0` and `high = items.count - 1`, and loop `while low <= high`.
- `let mid = (low + high) / 2`; compare `items[mid]` with `target` and move `low` or `high` past `mid`.
- `T: Comparable` is what makes `<` and `>` available. Without the constraint the body would not compile.

#### Tips
- The empty array is the case that catches an off-by-one: `high` starts at `-1`, so the loop must not run at all. Writing the condition as `low <= high` gets that right.
- `(low + high) / 2` is fine at these sizes. `low + (high - low) / 2` is the version that cannot overflow, and is worth knowing for the day the array is enormous.

### 6. Ring buffer

`RingBuffer` keeps at most `capacity` items. Appending when it is full drops the oldest one. `all` lists what it holds, oldest first, `count` is how many that is, and `isFull` says whether it is at capacity. A capacity of zero or less means nothing is ever stored. It is a struct, so a copy is independent of the original.

```swift starter
struct RingBuffer<Element> {
    let capacity: Int
    private var items: [Element] = []

    init(capacity: Int) {
        self.capacity = capacity
    }

    var all: [Element] { [] }
    var count: Int { 0 }
    var isFull: Bool { false }

    mutating func append(_ item: Element) {
    }
}
```

```swift test
/// holds what fits
func testUnderCapacity() {
    var b = RingBuffer<Int>(capacity: 3)
    expect(b.all, [])
    expect(b.count, 0)
    expect(b.isFull, false)
    b.append(1)
    b.append(2)
    expect(b.all, [1, 2])
    expect(b.count, 2)
    expect(b.isFull, false)
}

/// the oldest falls out
func testOverCapacity() {
    var b = RingBuffer<Int>(capacity: 3)
    for n in 1...5 { b.append(n) }
    expect(b.all, [3, 4, 5])
    expect(b.count, 3)
    expect(b.isFull, true)
    b.append(6)
    expect(b.all, [4, 5, 6])
}

/// degenerate capacities
func testEdgeCapacities() {
    var one = RingBuffer<String>(capacity: 1)
    one.append("a")
    one.append("b")
    expect(one.all, ["b"])
    expect(one.isFull, true)

    var none = RingBuffer<String>(capacity: 0)
    none.append("a")
    expect(none.all, [])
    expect(none.count, 0)
    expect(none.isFull, true)

    var negative = RingBuffer<Int>(capacity: -2)
    negative.append(1)
    expect(negative.all, [])
}

/// a copy goes its own way
func testValueSemantics() {
    var a = RingBuffer<Int>(capacity: 2)
    a.append(1)
    var b = a
    b.append(2)
    b.append(3)
    expect(a.all, [1])
    expect(b.all, [2, 3])
    a.append(9)
    expect(a.all, [1, 9])
    expect(b.all, [2, 3])
}
```

#### Uses
- [Generics › Generic types](#/generics/generic-types)
- [ARC & value semantics › Values copy, references share](#/memory/values-copy-references-share)
- [Collections › Adding and removing](#/collections/adding-and-removing)

#### Hints
- `all`, `count` and `isFull` are one line each over `items`; `isFull` is `items.count >= capacity`.
- `append` guards on `capacity > 0`, appends, and then drops from the front while there are too many: `if items.count > capacity { items.removeFirst() }`.
- A capacity of `0` is full from the start, which is what `testEdgeCapacities` expects.

#### Tips
- Nothing needs writing for the value-semantics test. `items` is an `Array`, so copying the struct copies the contents — and copy-on-write means the copy costs nothing until one of them is written to.
- A capacity of 0 is full from the start, and `append` must still do nothing. One guard on `capacity > 0` before the append covers both.
- `removeFirst()` shifts the whole array, which is fine at this size. A real ring buffer keeps a head index instead and never moves anything.

### 7. Path to the root

`TreeNode` links each child back to its parent, which as written leaks the whole tree. Fix the back link, then write `pathToRoot`, which returns the names from a node up to and including the root. A root on its own is a path of one.

```swift starter
final class TreeNode {
    nonisolated(unsafe) static var live = 0

    let name: String
    private(set) var children: [TreeNode] = []
    var parent: TreeNode?

    init(_ name: String) { self.name = name; TreeNode.live += 1 }
    deinit { TreeNode.live -= 1 }

    func add(_ child: TreeNode) {
        children.append(child)
        child.parent = self
    }
}

func pathToRoot(_ node: TreeNode) -> [String] {
    return []
}
```

```swift test
func sampleTree() -> TreeNode {
    let root = TreeNode("root")
    let mid = TreeNode("mid")
    let leaf = TreeNode("leaf")
    root.add(mid)
    mid.add(leaf)
    root.add(TreeNode("sibling"))
    return root
}

/// walks up from a leaf
func testPath() {
    TreeNode.live = 0
    do {
        let root = sampleTree()
        let leaf = root.children[0].children[0]
        expect(pathToRoot(leaf), ["leaf", "mid", "root"])
        expect(pathToRoot(root.children[0]), ["mid", "root"])
        expect(pathToRoot(root.children[1]), ["sibling", "root"])
    }
    expect(TreeNode.live, 0)
}

/// the root is a path of one
func testRootOnly() {
    TreeNode.live = 0
    do {
        let root = TreeNode("alone")
        expect(pathToRoot(root), ["alone"])
    }
    expect(TreeNode.live, 0)
}

/// a deep chain
func testDeep() {
    TreeNode.live = 0
    do {
        let root = TreeNode("n0")
        var tip = root
        for i in 1...5 {
            let next = TreeNode("n\(i)")
            tip.add(next)
            tip = next
        }
        expect(pathToRoot(tip), ["n5", "n4", "n3", "n2", "n1", "n0"])
    }
    expect(TreeNode.live, 0)
}

/// nothing is left behind after many trees
func testNoLeak() {
    TreeNode.live = 0
    do {
        for _ in 0..<20 {
            let root = sampleTree()
            _ = pathToRoot(root.children[0])
        }
    }
    expect(TreeNode.live, 0)
}
```

#### Uses
- [ARC & value semantics › Strong reference cycles](#/memory/strong-reference-cycles)
- [ARC & value semantics › weak](#/memory/weak)
- [ARC & value semantics › ARC counts references](#/memory/arc-counts-references)

#### Hints
- The parent already owns its children through `children`, so the link back should not keep it alive.
- `var current: TreeNode? = node`, then `while let node = current { names.append(node.name); current = node.parent }`.
- A `weak var` is automatically an `Optional`, which is exactly what that loop wants as its stopping condition.

#### Tips
- `pathToRoot` reads `parent` only while the tree is alive, so either `weak` or `unowned` would break the cycle here. `weak` is the safer habit: an `unowned` read after the parent has gone traps.
- A `weak var` is already an `Optional`, so `while let node = current { ... }` terminates at the root without any extra condition.

### 8. Totals from an invoice feed

`invoiceTotals` decodes a JSON array of invoices and returns a dictionary from each invoice's number to its total in cents — the sum of `quantity * unit_cents` over its lines. An invoice with no lines totals `0`, and an empty feed gives an empty dictionary. Malformed JSON, or a missing field, throws.

```swift starter
struct LineItem: Codable {
    let sku: String
    let quantity: Int
    let unitCents: Int
}

struct Invoice: Codable {
    let number: String
    let lines: [LineItem]
}

func invoiceTotals(_ json: String) throws -> [String: Int] {
    return [:]
}
```

```swift test
let feed = """
[
  {"number": "A-1", "lines": [
    {"sku": "coffee", "quantity": 2, "unit_cents": 350},
    {"sku": "cake", "quantity": 1, "unit_cents": 500}
  ]},
  {"number": "A-2", "lines": [
    {"sku": "tea", "quantity": 3, "unit_cents": 275}
  ]}
]
"""

/// totals each invoice
func testTotals() {
    expect(try? invoiceTotals(feed), ["A-1": 1200, "A-2": 825])
    expect(try? invoiceTotals(#"[{"number": "X", "lines": [{"sku": "s", "quantity": 4, "unit_cents": 25}]}]"#),
           ["X": 100])
}

/// empty feeds and empty invoices
func testEmpty() {
    expect(try? invoiceTotals("[]"), [:])
    expect(try? invoiceTotals(#"[{"number": "A", "lines": []}]"#), ["A": 0])
    expect(try? invoiceTotals(#"[{"number": "A", "lines": []}, {"number": "B", "lines": []}]"#), ["A": 0, "B": 0])
}

/// zero quantities and undeclared keys
func testQuantities() {
    expect(try? invoiceTotals(#"[{"number": "A", "lines": [{"sku": "s", "quantity": 0, "unit_cents": 999}]}]"#),
           ["A": 0])
    expect(try? invoiceTotals(#"[{"number": "A", "note": "ignored", "lines": [{"sku": "s", "quantity": 1, "unit_cents": 1}]}]"#),
           ["A": 1])
}

/// bad data throws
func testThrows() {
    expect(try? invoiceTotals(#"[{"number": "A"}]"#), nil)
    expect(try? invoiceTotals(#"[{"number": "A", "lines": [{"sku": "s", "quantity": 1}]}]"#), nil)
    expect(try? invoiceTotals("not json"), nil)
    expect(try? invoiceTotals(#"{"number": "A", "lines": []}"#), nil)
}
```

#### Uses
- [Codable & JSON › CodingKeys](#/codable/codingkeys)
- [Codable & JSON › Nested types and arrays](#/codable/nested-types-and-arrays)
- [Codable & JSON › Encoding and decoding](#/codable/encoding-and-decoding)

#### Hints
- `unitCents` does not match `unit_cents`, so `LineItem` needs a `CodingKeys` enum — and every property has to appear in it, not only the renamed one.
- Decode `[Invoice].self`, then build the dictionary with `reduce(into: [:])`.
- One invoice's total is `invoice.lines.reduce(0) { $0 + $1.quantity * $1.unitCents }`.

#### Tips
- `decoder.keyDecodingStrategy = .convertFromSnakeCase` would handle the whole feed without an enum. Writing the enum once is worth doing first, so you know what the strategy is doing for you.
- Every property has to appear in `CodingKeys`, not only `unitCents`. Listing one case is the mistake that makes `sku` and `quantity` vanish from the decode.

### 9. Normalise a contact

`normalize` reads one contact from JSON and writes it back out in a canonical form: `email_address` lowercased and defaulting to `""` when absent or `null`, `tags` sorted and defaulting to `[]`, and the output encoded with keys in alphabetical order — `email_address`, then `name`, then `tags`. A missing `name` throws.

```swift starter
struct Contact: Codable, Equatable {
    let name: String
    let emailAddress: String
    let tags: [String]
}

func normalize(_ json: String) throws -> String {
    return ""
}
```

```swift test
/// lowercases the address and sorts the tags
func testNormalises() {
    expect(try? normalize(#"{"name": "Ada", "email_address": "ADA@Example.COM", "tags": ["z", "a"]}"#),
           #"{"email_address":"ada@example.com","name":"Ada","tags":["a","z"]}"#)
    expect(try? normalize(#"{"name": "Grace", "email_address": "G@X.IO", "tags": []}"#),
           #"{"email_address":"g@x.io","name":"Grace","tags":[]}"#)
}

/// missing optional fields take their defaults
func testDefaults() {
    expect(try? normalize(#"{"name": "Alan"}"#),
           #"{"email_address":"","name":"Alan","tags":[]}"#)
    expect(try? normalize(#"{"name": "Alan", "tags": ["b", "a", "c"]}"#),
           #"{"email_address":"","name":"Alan","tags":["a","b","c"]}"#)
}

/// null counts as absent
func testNull() {
    expect(try? normalize(#"{"name": "Barbara", "email_address": null, "tags": null}"#),
           #"{"email_address":"","name":"Barbara","tags":[]}"#)
}

/// a missing name is an error
func testThrows() {
    expect(try? normalize(#"{"email_address": "a@b.c"}"#), nil)
    expect(try? normalize(#"{}"#), nil)
    expect(try? normalize("not json"), nil)
}
```

#### Uses
- [Codable & JSON › Missing keys and defaults](#/codable/missing-keys-and-defaults)
- [Codable & JSON › CodingKeys](#/codable/codingkeys)
- [Codable & JSON › Formatting the output](#/codable/formatting-the-output)

#### Hints
- Give `Contact` a `CodingKeys` with `case emailAddress = "email_address"`, and a custom `init(from:)` that uses `decodeIfPresent` with `?? ""` and `?? []`.
- The lowercasing and sorting can happen in `init(from:)`, so the decoded value is already canonical.
- `encoder.outputFormatting = [.sortedKeys]` is what makes the output comparable to a literal at all.

#### Tips
- Normalising during decoding keeps the rule in one place. The alternative — decode, then build a second corrected value — works too, and is easier to read when the rules get complicated.
- `JSONEncoder` writes compact JSON with no spaces after the colons, which is what the expected strings assume. Turning on `.prettyPrinted` while debugging and forgetting to remove it fails every test at once.

### 10. Double them all, concurrently

`slowDouble` takes about 30ms and refuses negative numbers. Write `doubledAll`, which returns one result per input **in input order**, runs them concurrently — ten inputs one at a time is far too slow for the last test — and throws if any input is negative.

```swift starter
enum MathError: Error {
    case negative(Int)
}

func slowDouble(_ n: Int) async throws -> Int {
    try? await Task.sleep(for: .milliseconds(30))
    guard n >= 0 else { throw MathError.negative(n) }
    return n * 2
}

func doubledAll(_ ns: [Int]) async throws -> [Int] {
    return []
}
```

```swift test
/// one result per input, in order
func testOrder() async {
    expect(try? await doubledAll([1, 2, 3]), [2, 4, 6])
    expect(try? await doubledAll([5, 0, 7]), [10, 0, 14])
    expect(try? await doubledAll([4]), [8])
}

/// nothing to do
func testEmpty() async {
    expect(try? await doubledAll([]), [])
}

/// a negative anywhere fails the whole call
func testThrows() async {
    expect(try? await doubledAll([-1]), nil)
    expect(try? await doubledAll([1, -2, 3]), nil)
    expect(try? await doubledAll([1, 2, -3]), nil)
    expect(try? await doubledAll([1, 2, 3]), [2, 4, 6])
}

/// ten at once, not ten in a row
func testConcurrent() async {
    let start = ContinuousClock.now
    let got = try? await doubledAll(Array(0..<10))
    let elapsed = ContinuousClock.now - start
    expect(got, (0..<10).map { $0 * 2 })
    expect(elapsed < .milliseconds(150), "took \(elapsed); ten 30ms calls in sequence would be about 300ms")
}
```

#### Uses
- [Concurrency › Task groups](#/concurrency/task-groups)
- [Concurrency › async and await](#/concurrency/async-and-await)

#### Hints
- `try await withThrowingTaskGroup(of: (Int, Int).self) { group in ... }` — the throwing group carries a child's error out for you.
- Add the index alongside the value: `group.addTask { (i, try await slowDouble(n)) }` for each `(i, n)` in `ns.enumerated()`.
- Collect with `for try await (i, value) in group` into an array you sized up front.

#### Tips
- When one child throws, the group cancels the others and rethrows. `doubledAll` is `throws`, so you catch nothing — the error simply leaves.
- `slowDouble` sleeps *before* it checks the sign, so even the failing case takes its 30ms. The timing test is about overlap, not about returning early.

### 11. A ledger that never goes negative

Finish the `Ledger` actor. `apply(amount)` adds `amount` to the balance and returns `true`, unless that would take the balance below zero, in which case it changes nothing, counts a rejection and returns `false`. `current()` is the balance and `rejectedCount()` is how many applications were refused. Hundreds of tasks call `apply` at once, so no update may be lost.

```swift starter
actor Ledger {
    private var balance: Int
    private var rejected = 0

    init(balance: Int) {
        self.balance = balance
    }

    func apply(_ amount: Int) -> Bool {
        return false
    }

    func current() -> Int {
        balance
    }

    func rejectedCount() -> Int {
        rejected
    }
}
```

```swift test
/// deposits and withdrawals one at a time
func testBasics() async {
    let ledger = Ledger(balance: 10)
    expect(await ledger.apply(5), true)
    expect(await ledger.current(), 15)
    expect(await ledger.apply(-15), true)
    expect(await ledger.current(), 0)
    expect(await ledger.apply(-1), false)
    expect(await ledger.current(), 0)
    expect(await ledger.rejectedCount(), 1)
}

/// 200 concurrent deposits all land
func testConcurrentDeposits() async {
    let ledger = Ledger(balance: 0)
    await withTaskGroup(of: Bool.self) { group in
        for _ in 0..<200 { group.addTask { await ledger.apply(1) } }
        for await _ in group {}
    }
    expect(await ledger.current(), 200)
    expect(await ledger.rejectedCount(), 0)
}

/// the balance stops at zero, whatever the order
func testFloor() async {
    let ledger = Ledger(balance: 100)
    await withTaskGroup(of: Bool.self) { group in
        for _ in 0..<200 { group.addTask { await ledger.apply(-1) } }
        for await _ in group {}
    }
    expect(await ledger.current(), 0)
    expect(await ledger.rejectedCount(), 100)
}

/// a busy mixed ledger stays exact
func testMixed() async {
    let ledger = Ledger(balance: 1000)
    await withTaskGroup(of: Bool.self) { group in
        for i in 0..<300 { group.addTask { await ledger.apply(i % 2 == 0 ? 2 : -1) } }
        for await _ in group {}
    }
    expect(await ledger.current(), 1150)
    expect(await ledger.rejectedCount(), 0)
}
```

#### Uses
- [Concurrency › Actors](#/concurrency/actors)
- [Concurrency › Task groups](#/concurrency/task-groups)
- [Concurrency › Sendable and isolation](#/concurrency/sendable-and-isolation)

#### Hints
- Inside the actor there is no `await` and no lock: `guard balance + amount >= 0 else { rejected += 1; return false }`.
- Then `balance += amount` and `return true`.
- Do not read the balance, suspend, and write it back. Keep the check and the update in one method with nothing awaited between them.

#### Tips
- `testMixed` starts at 1000 so the floor is never reached: 150 deposits of 2 and 150 withdrawals of 1 leave 1150 whatever order they run in. That makes the expected number exact even though the interleaving is not.
- Keep the check and the update in one actor method with no `await` between them. Reading the balance, suspending, and writing it back is the one race an actor cannot save you from.
