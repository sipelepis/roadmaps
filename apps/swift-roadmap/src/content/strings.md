# Strings & characters

A Swift `String` is a collection of `Character`s, and a `Character` is whatever a reader would call one character — including an accented letter built from two scalars, or a family emoji built from seven. That choice makes `count` honest and makes integer indexing impossible, which is the one thing that surprises everybody arriving from another language.

## A String is a sequence of Characters

You can iterate a string the way you iterate an array, and build one from characters.

```swift
for character in "héllo" {
    print(character)          // h, é, l, l, o
}

let letters: [Character] = ["s", "w", "i", "f", "t"]
let word = String(letters)    // "swift"
let exclaimed = word + "!"
```

A `Character` is one extended grapheme cluster: everything Unicode says the reader sees as a single character. `"é"` written as `e` plus a combining accent is one `Character`, and compares equal to the precomposed `"é"`, because Swift compares strings by canonical equivalence rather than byte by byte.

Because a string is a collection, the collection methods apply to it. `reversed()` is the one you will reach for first, and it returns a *view*, not a `String`, so it needs wrapping:

```swift
String("abc".reversed())     // "cba"
"abc".reversed()             // a ReversedCollection<String>, not a String
Array("abc")                 // ["a", "b", "c"] as [Character]
```

## Counting characters, not bytes

`count` counts `Character`s. That is almost always the number you actually want, and almost never the number of bytes.

```swift
"hello".count            // 5
"héllo".count            // 5
"👋".count               // 1
"👨‍👩‍👧‍👦".count              // 1, one family, seven scalars
"👨‍👩‍👧‍👦".utf8.count         // 25 bytes
"👨‍👩‍👧‍👦".unicodeScalars.count // 7
```

Counting is O(n): the string has to walk its storage to work out where each character ends, so a string does not store its length. Use `isEmpty` rather than `count == 0` when all you want to know is whether there is anything there.

A string also offers `utf8`, `utf16` and `unicodeScalars` views for when you really do need code units — writing a file format, say. They are views onto the same storage, not copies.

## Indices are not integers

Because characters have different widths in memory, the fifth character is not at byte five, and `text[4]` does not compile. Positions are `String.Index` values you get from the string itself.

```swift
let text = "Swift"
let first = text[text.startIndex]                         // "S"
let second = text[text.index(after: text.startIndex)]     // "w"
let third = text[text.index(text.startIndex, offsetBy: 2)] // "i"
let last = text[text.index(before: text.endIndex)]        // "t"
```

`endIndex` is one past the last character, so subscripting it traps. Most of the time you avoid indices altogether: iterate the characters, or reach for `first`, `last`, `prefix(n)`, `suffix(n)`, `dropFirst()` and `dropLast()`, which take counts rather than positions.

Two sharp edges here. An index belongs to the string it came from: using one string's index on another compiles and then misbehaves or traps. And `offsetBy:` walks the string one character at a time, so `text[text.index(text.startIndex, offsetBy: i)]` inside a loop over `i` is quadratic — iterate the characters, or take `Array(text)` once, rather than indexing in a loop.

## Substrings are a view

Slicing a string gives a `Substring`, which shares the original's storage instead of copying it. That makes slicing cheap, and it is why you convert back with `String(...)` before storing a slice for long.

```swift
let sentence = "the quick brown fox"
let firstThree = sentence.prefix(3)          // Substring "the"
let rest = sentence.dropFirst(4)             // Substring "quick brown fox"
let kept = String(firstThree)                // a real String of its own
```

A `Substring` has almost the whole `String` API — `count`, `uppercased()`, `hasPrefix`, iteration — because both conform to `StringProtocol`. A function declared to take a `String` still needs the conversion.

## Searching and transforming

```swift
let title = "Swift Roadmap"
title.hasPrefix("Swift")        // true
title.hasSuffix("map")          // true
title.contains("Road")          // true
title.lowercased()              // "swift roadmap"
title.uppercased()              // "SWIFT ROADMAP"
title.isEmpty                   // false
```

`firstIndex(of:)` returns an optional `String.Index`, since the character may not be there. Foundation adds more, such as `replacingOccurrences(of:with:)` and `trimmingCharacters(in:)`, and those need `import Foundation` — which the exercises here already have.

## Splitting and joining

`split(separator:)` breaks a string into `Substring`s, and `joined(separator:)` puts a sequence of strings back together.

```swift
let csv = "a,b,,c"
csv.split(separator: ",")                              // ["a", "b", "c"]
csv.split(separator: ",", omittingEmptySubsequences: false)  // ["a", "b", "", "c"]

let words = "the quick  brown".split(separator: " ")   // ["the", "quick", "brown"]
words.joined(separator: "-")                           // "the-quick-brown"
```

By default `split` drops empty pieces, which is exactly what you want for splitting a sentence into words: runs of spaces, and spaces at either end, disappear on their own. Pass `omittingEmptySubsequences: false` when the empty fields matter, as they do in CSV.

## Building strings

```swift
var report = "Totals"
report += ":"
report.append(" ")
report += String(repeating: "=", count: 6)

let name = "Ada", score = 92
let line = "\(name) scored \(score)%, \(score >= 90 ? "top" : "fair") band"

let block = """
    first line
    second line
    """

let path = #"C:\Users\ada"#      // raw: \U is not an escape here
```

A multiline literal is delimited by `"""` on their own lines, and the indentation of the closing delimiter is stripped from every line. Interpolation takes any expression, including a ternary or a function call. Appending in a loop is fine: a `String` keeps spare capacity like an array does.

## Character properties

A `Character` answers questions about itself, which saves comparing against ranges of letters.

```swift
let c: Character = "7"
c.isNumber          // true
c.isLetter          // false
c.isWhitespace      // false
c.isUppercase       // false
c.wholeNumberValue  // Optional(7)
c.lowercased()      // "7" — a String, because lowercasing can change the length
```

`lowercased()` and `uppercased()` on a `Character` return a `String`, not a `Character`: uppercasing `ß` gives `SS`, two characters from one.

```swift playground
let sentence = "the quick brown fox jumps"

let words = sentence.split(separator: " ")
print("\(words.count) words, \(sentence.count) characters")
print("reversed: \(words.reversed().joined(separator: " "))")

var initials = ""
for word in words { initials += word.prefix(1).uppercased() }
print("initials: \(initials)")

let mixed = "héllo 👋 wörld"
print("\(mixed) is \(mixed.count) characters but \(mixed.utf8.count) bytes")

var letters = 0, spaces = 0
for character in mixed {
    if character.isLetter { letters += 1 }
    if character.isWhitespace { spaces += 1 }
}
print("\(letters) letters, \(spaces) spaces")

let bar = String(repeating: "=", count: sentence.count)
print(bar)

// Try: print `mixed[0]` and read the error the compiler gives you.
```

## Exercises

### 1. Words backwards

`reversedWords(_:)` returns the sentence with its words in the opposite order, separated by single spaces. Runs of spaces and spaces at either end collapse, so `"  a  b  "` comes back as `"b a"`. A sentence with no words comes back empty.

```swift starter
func reversedWords(_ sentence: String) -> String {
    return sentence
}
```

```swift test
/// reverses the word order
func testReverses() {
    expect(reversedWords("the quick brown fox"), "fox brown quick the")
    expect(reversedWords("hello world"), "world hello")
}

/// collapses extra spaces
func testSpaces() {
    expect(reversedWords("  a  b  "), "b a")
    expect(reversedWords(" one two "), "two one")
}

/// nothing to reverse
func testEmpty() {
    expect(reversedWords(""), "")
    expect(reversedWords("   "), "")
    expect(reversedWords("alone"), "alone")
}

/// leaves the words themselves alone
func testKeepsWords() {
    expect(reversedWords("héllo wörld 👋"), "👋 wörld héllo")
    expect(reversedWords("a,b c,d"), "c,d a,b")
}
```

#### Uses
- [Strings & characters › Splitting and joining](#/strings/splitting-and-joining)
- [Collections › Arrays](#/collections/arrays)

#### Hints
- `sentence.split(separator: " ")` gives the words and drops the empty pieces for you.
- `.reversed()` flips the order of any collection.
- `.joined(separator: " ")` turns the pieces back into one `String`, so the whole body is a single chain.

#### Tips
- The pieces are `Substring`s, and `joined` produces a `String` from them, so nothing needs converting by hand.
- `split(separator: " ")` already collapses runs of spaces and drops the ones at either end, which is the whole of the spacing test. Trimming first does the same job twice.

#### Docs
- [split(separator:)](https://developer.apple.com/documentation/swift/sequence/split(separator:maxsplits:omittingemptysubsequences:))

### 2. Initials

`initials(of:)` returns the first character of each word, uppercased, with nothing between them: `"ada lovelace"` gives `"AL"`. Words are separated by spaces, and extra spaces are ignored. A name with no words gives an empty string.

```swift starter
func initials(of name: String) -> String {
    return name
}
```

```swift test
/// one letter per word, uppercased
func testInitials() {
    expect(initials(of: "ada lovelace"), "AL")
    expect(initials(of: "Grace Brewster Murray Hopper"), "GBMH")
    expect(initials(of: "alan"), "A")
}

/// already uppercase names are unchanged
func testAlreadyUpper() {
    expect(initials(of: "Ada Lovelace"), "AL")
    expect(initials(of: "X Y"), "XY")
}

/// extra spaces are ignored
func testSpaces() {
    expect(initials(of: "  spaced   out "), "SO")
    expect(initials(of: ""), "")
    expect(initials(of: "    "), "")
}

/// characters that are not plain letters
func testNonLetters() {
    expect(initials(of: "émile zola"), "ÉZ")
    expect(initials(of: "🙂 bob"), "🙂B")
    expect(initials(of: "3 blind mice"), "3BM")
}
```

#### Uses
- [Strings & characters › Splitting and joining](#/strings/splitting-and-joining)
- [Strings & characters › Substrings are a view](#/strings/substrings-are-a-view)
- [Strings & characters › Character properties](#/strings/character-properties)

#### Hints
- Split into words, then take `word.prefix(1)` from each — the first character, without needing an index.
- `.uppercased()` on that gives a `String` you can add straight onto the answer.
- An emoji has no uppercase form, so uppercasing it changes nothing. That case needs no special handling.

#### Tips
- `word.first` would give you a `Character?` to unwrap. `prefix(1)` is empty rather than `nil` for an empty piece, which is one less thing to think about — and `split` never hands you an empty piece anyway.
- `"🙂".uppercased()` is `"🙂"`. Uppercasing something with no uppercase form is a no-op rather than an error, so the emoji test needs no branch of its own.

#### Docs
- [prefix(_:)](https://developer.apple.com/documentation/swift/collection/prefix(_:))

### 3. Palindromes

`isPalindrome(_:)` reports whether the text reads the same backwards, ignoring case and every character that is not a letter or a digit. So `"A man, a plan, a canal: Panama"` is a palindrome and `"race a car"` is not. Text with no letters or digits at all is trivially a palindrome.

```swift starter
func isPalindrome(_ text: String) -> Bool {
    return true
}
```

```swift test
/// plain palindromes
func testPlain() {
    expect(isPalindrome("racecar"), true)
    expect(isPalindrome("level"), true)
    expect(isPalindrome("swift"), false)
    expect(isPalindrome("ab"), false)
}

/// punctuation and spacing are ignored
func testPunctuation() {
    expect(isPalindrome("A man, a plan, a canal: Panama"), true)
    expect(isPalindrome("Was it a car or a cat I saw?"), true)
    expect(isPalindrome("race a car"), false)
}

/// case is ignored, digits are not
func testCaseAndDigits() {
    expect(isPalindrome("Noon"), true)
    expect(isPalindrome("12321"), true)
    expect(isPalindrome("0P"), false)
    expect(isPalindrome("1a1"), true)
}

/// accents and emoji
func testUnicode() {
    expect(isPalindrome("Été"), true)
    expect(isPalindrome("éa"), false)
    expect(isPalindrome("🙂 a 🙂"), true)
    expect(isPalindrome(""), true)
}
```

#### Uses
- [Strings & characters › Character properties](#/strings/character-properties)
- [Strings & characters › A String is a sequence of Characters](#/strings/a-string-is-a-sequence-of-characters)
- [Control flow › `for` and ranges](#/control-flow/for-and-ranges)

#### Hints
- First build a cleaned string: loop the characters and keep the ones where `character.isLetter || character.isNumber`.
- Lowercase as you go. `character.lowercased()` gives a `String`, which appends onto the cleaned one with `+=`.
- Then compare: `cleaned == String(cleaned.reversed())`. `reversed()` gives a collection of characters, so it needs wrapping back into a `String`.

#### Tips
- Because `Character` comparison is by canonical equivalence, an accented letter matches itself however it was composed, and `"É".lowercased()` is `"é"`. The Unicode case comes out right without any extra work.
- `Character.lowercased()` returns a `String`, so build the cleaned text with `+=` on a `String` rather than collecting `Character`s and converting at the end.
- `cleaned == String(cleaned.reversed())` allocates a second string. Walking two indices in from both ends does not, and is worth writing once — after the simple version passes.

#### Docs
- [Character](https://developer.apple.com/documentation/swift/character)

### 4. Wrap a paragraph

`wrapped(_:at:)` breaks text into lines no longer than `width` characters, filling each line with as many whole words as fit. Words are separated by spaces, and the single space between two words on the same line counts toward the width. A word longer than the width gets a line of its own rather than being cut. Text with no words gives no lines.

```swift starter
func wrapped(_ text: String, at width: Int) -> [String] {
    return [text]
}
```

```swift test
/// fills lines greedily
func testWraps() {
    expect(wrapped("the quick brown fox", at: 10), ["the quick", "brown fox"])
    expect(wrapped("the quick brown fox", at: 9), ["the quick", "brown fox"])
    expect(wrapped("one two three four", at: 8), ["one two", "three", "four"])
}

/// everything on one line when it fits
func testFits() {
    expect(wrapped("one two", at: 100), ["one two"])
    expect(wrapped("exact fit", at: 9), ["exact fit"])
    expect(wrapped("alone", at: 5), ["alone"])
}

/// words longer than the width keep their own line
func testLongWords() {
    expect(wrapped("hello", at: 3), ["hello"])
    expect(wrapped("a bb ccc", at: 1), ["a", "bb", "ccc"])
    expect(wrapped("tiny enormous tiny", at: 4), ["tiny", "enormous", "tiny"])
}

/// nothing to wrap
func testEmpty() {
    expect(wrapped("", at: 5), [])
    expect(wrapped("     ", at: 5), [])
}

/// width counts characters, not bytes
func testUnicode() {
    expect(wrapped("née fée", at: 7), ["née fée"])
    expect(wrapped("🙂🙂🙂 ab", at: 4), ["🙂🙂🙂", "ab"])
    expect(wrapped("héllo wörld", at: 5), ["héllo", "wörld"])
}
```

#### Uses
- [Strings & characters › Splitting and joining](#/strings/splitting-and-joining)
- [Strings & characters › Counting characters, not bytes](#/strings/counting-characters-not-bytes)
- [Collections › Adding and removing](#/collections/adding-and-removing)

#### Hints
- Split into words, then keep a `var current = ""` line and a `var lines: [String] = []`.
- For each word: if the current line is empty, start it with the word; otherwise it fits when `current.count + 1 + word.count <= width`, and if it does not, push the current line and start a new one with the word.
- Do not forget the last line after the loop — push it only when it is not empty, or the empty-text case gains a phantom line.

#### Tips
- `current.count` counts `Character`s, so an emoji counts as one and the accented tests pass without special handling. `utf8.count` would break both of them.
- The `+ 1` in `current.count + 1 + word.count <= width` is the space that will sit between them. Leaving it out produces lines exactly one character too long, which only the tight tests catch.

#### Docs
- [String](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/stringsandcharacters/)
