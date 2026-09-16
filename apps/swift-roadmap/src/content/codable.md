# Codable & JSON

`Codable` is Swift's answer to serialisation: mark a type `Codable` and the compiler writes the conversion to and from JSON for you, field by field, with full type checking. There is no reflection at runtime and no dictionary of `Any` to sift through — a decode either produces the type you asked for or throws an error telling you which key was wrong.

It is a good demonstration of generics and error handling working together. `decode(_:from:)` is generic over the type you want, and everything that can go wrong arrives as a `DecodingError` you can catch and inspect.

## Codable is two protocols

`Codable` is a type alias for `Encodable & Decodable`. Conform to both by writing `Codable`, or to just one when data only flows one way.

```swift
struct User: Codable {
    let id: Int
    let name: String
}
```

The compiler synthesises the conformance as long as every stored property is itself `Codable`. `Int`, `String`, `Double`, `Bool`, `Date`, `Data`, arrays, dictionaries, optionals and any `Codable` type you wrote all qualify. A `RawRepresentable` enum with a `String` or `Int` raw value gets it too, just by adding `Codable` to its declaration.

## Encoding and decoding

`JSONEncoder` and `JSONDecoder` do the work, and both speak `Data` rather than `String`.

```swift
let data = try JSONEncoder().encode(User(id: 1, name: "Ada"))
let text = String(decoding: data, as: UTF8.self)

let back = try JSONDecoder().decode(User.self, from: Data(text.utf8))
```

`Data(text.utf8)` and `String(decoding:as:)` are the two conversions you will write constantly. `decode(_:from:)` needs the type as its first argument — `User.self` — because the return type is what tells it what to build.

Keys in the JSON that the type does not declare are ignored, so an API adding a field will not break your decoder.

## CodingKeys

When the JSON names do not match your property names, declare a nested enum called `CodingKeys` conforming to `CodingKey`, with a `String` raw value for each property whose name differs.

```swift
struct User: Codable {
    let id: Int
    let fullName: String

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
    }
}
```

Declaring `CodingKeys` replaces the synthesised one, so **every** property you want encoded must appear as a case. A property left out of the enum is skipped entirely, which is how you exclude something from the JSON — but it then needs a default value, or the decoder has nothing to give it.

For an API that is snake_case throughout, `decoder.keyDecodingStrategy = .convertFromSnakeCase` handles the whole thing without an enum.

## Missing keys and defaults

An optional property is allowed to be missing: a `String?` decodes to `nil` when its key is absent or explicitly `null`. A non-optional property is required, and its absence throws.

For a non-optional property with a sensible default, write `init(from:)` yourself and reach for `decodeIfPresent`:

```swift
init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    host = try c.decodeIfPresent(String.self, forKey: .host) ?? "localhost"
    port = try c.decodeIfPresent(Int.self, forKey: .port) ?? 8080
}
```

`decodeIfPresent` returns `nil` for an absent key and for a `null`, but still throws when the key is there with the wrong type — a typo in the data is not silently defaulted away.

## Nested types and arrays

Nesting needs no extra work. A `Codable` type containing other `Codable` types, arrays of them, or dictionaries keyed by `String` all encode and decode as you would expect, and the top level can be an array just as easily as an object.

```swift
struct Item: Codable { let name: String; let cents: Int }
struct Order: Codable { let id: Int; let items: [Item] }

let orders = try JSONDecoder().decode([Order].self, from: data)
```

## When decoding fails

Every failure is a `DecodingError`, and its cases carry enough to write a useful message:

- `.keyNotFound(key, context)` — a required key was absent. `key.stringValue` is its name.
- `.typeMismatch(type, context)` — the value was there but the wrong shape.
- `.valueNotFound(type, context)` — a `null` where a non-optional was expected.
- `.dataCorrupted(context)` — the bytes were not valid JSON, or an enum's raw value was not one of its cases.

Each `context` has a `codingPath`, the chain of keys leading to the problem, which is what makes a nested failure findable.

```swift
do {
    _ = try JSONDecoder().decode(User.self, from: data)
} catch DecodingError.keyNotFound(let key, _) {
    print("missing \(key.stringValue)")
} catch {
    print("bad data: \(error)")
}
```

## Formatting the output

JSON objects have no defined key order, and `JSONEncoder` does not promise one — so never compare encoded JSON to a string literal unless you have asked for an order.

```swift
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]        // alphabetical, and therefore stable
encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
```

Comparing *decoded values* is the more robust habit; `.sortedKeys` is for when you really do need the text, as in a snapshot or a cache key.

The same applies inside your data, not only at the top level. A `[String: Int]` property encodes its pairs in the dictionary's own hash order, which can differ between runs of the same program — so a round-trip test that compares strings will pass on your machine and fail in CI unless `.sortedKeys` is set. An array's order, by contrast, is always preserved.

```swift playground
import Foundation

struct Item: Codable, Equatable {
    let name: String
    let cents: Int
}

enum Status: String, Codable {
    case paid, pending
}

struct Order: Codable, Equatable {
    let id: Int
    let placedBy: String
    let status: Status
    let items: [Item]

    enum CodingKeys: String, CodingKey {
        case id
        case placedBy = "placed_by"
        case status
        case items
    }
}

let json = """
[
  {"id": 1, "placed_by": "Ada", "status": "paid",
   "items": [{"name": "coffee", "cents": 350}, {"name": "cake", "cents": 500}]},
  {"id": 2, "placed_by": "Grace", "status": "pending",
   "items": [{"name": "tea", "cents": 275}], "note": "ignored, not declared"}
]
"""

let orders = try JSONDecoder().decode([Order].self, from: Data(json.utf8))
for order in orders {
    let total = order.items.reduce(0) { $0 + $1.cents }
    print("#\(order.id) \(order.placedBy) \(order.status.rawValue): \(total)c")
}

// Round trip: encode, decode, compare the values rather than the text.
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
let data = try encoder.encode(orders[1])
print(String(decoding: data, as: UTF8.self))
print("round trip equal:", try JSONDecoder().decode(Order.self, from: data) == orders[1])

// Failures arrive as DecodingError, with the key that was missing.
do {
    _ = try JSONDecoder().decode(Item.self, from: Data(#"{"name": "coffee"}"#.utf8))
} catch DecodingError.keyNotFound(let key, let context) {
    print("missing \(key.stringValue) at path \(context.codingPath.map(\.stringValue))")
}
```

## Exercises

### 1. Names that do not match

The API sends `full_name` and `email_address`; the Swift type uses `fullName` and `emailAddress`. Finish `User.CodingKeys` so `decodeUser` reads that JSON, and configure the encoder in `encodeUser` so its output has keys in alphabetical order. Keys in the JSON that `User` does not declare are ignored.

```swift starter
struct User: Codable, Equatable {
    let id: Int
    let fullName: String
    let emailAddress: String

    enum CodingKeys: String, CodingKey {
        case id
        case fullName
        case emailAddress
    }
}

func decodeUser(_ json: String) throws -> User {
    try JSONDecoder().decode(User.self, from: Data(json.utf8))
}

func encodeUser(_ user: User) throws -> String {
    let encoder = JSONEncoder()
    return String(decoding: try encoder.encode(user), as: UTF8.self)
}
```

```swift test
/// reads the API's key names
func testDecodes() {
    let json = #"{"id": 1, "full_name": "Ada Lovelace", "email_address": "ada@example.com"}"#
    expect(try? decodeUser(json), User(id: 1, fullName: "Ada Lovelace", emailAddress: "ada@example.com"))

    let other = #"{"id": 7, "full_name": "Grace", "email_address": "g@x.io"}"#
    expect(try? decodeUser(other), User(id: 7, fullName: "Grace", emailAddress: "g@x.io"))
}

/// undeclared keys are ignored, missing ones are not
func testExtraAndMissing() {
    let extra = #"{"id": 2, "full_name": "Alan", "email_address": "a@x.io", "nickname": "Al"}"#
    expect(try? decodeUser(extra), User(id: 2, fullName: "Alan", emailAddress: "a@x.io"))
    expect(try? decodeUser(#"{"id": 3, "full_name": "Alan"}"#), nil)
    expect(try? decodeUser(#"{}"#), nil)
}

/// writes the API's key names, in alphabetical order
func testEncodes() {
    let user = User(id: 1, fullName: "Ada", emailAddress: "ada@example.com")
    expect(try? encodeUser(user), #"{"email_address":"ada@example.com","full_name":"Ada","id":1}"#)

    let other = User(id: 42, fullName: "Grace Hopper", emailAddress: "g@x.io")
    expect(try? encodeUser(other), #"{"email_address":"g@x.io","full_name":"Grace Hopper","id":42}"#)
}

/// what it writes, it can read back
func testRoundTrip() {
    let user = User(id: 9, fullName: "Barbara Liskov", emailAddress: "b@x.io")
    expect(try? decodeUser(try encodeUser(user)), user)
    let minimal = User(id: 0, fullName: "", emailAddress: "")
    expect(try? decodeUser(try encodeUser(minimal)), minimal)
}
```

#### Uses
- [Codable & JSON › CodingKeys](#/codable/codingkeys)
- [Codable & JSON › Encoding and decoding](#/codable/encoding-and-decoding)
- [Codable & JSON › Formatting the output](#/codable/formatting-the-output)

#### Hints
- A case whose name already matches needs no raw value: `case id` is fine, `case fullName = "full_name"` is not optional.
- The same enum drives both directions, so fixing it fixes `decodeUser` and `encodeUser` at once.
- Alphabetical order comes from `encoder.outputFormatting = [.sortedKeys]`, set before the call to `encode`.

#### Tips
- `#"..."#` is a raw string: inside it, `"` needs no backslash, which is what makes JSON literals readable in Swift.
- `.sortedKeys` has to be set on the encoder *before* `encode` is called. Setting it afterwards changes nothing, and the failure then looks like a key-name problem.

#### Docs
- [Encoding and decoding custom types](https://developer.apple.com/documentation/foundation/archives-and-serialization/encoding-and-decoding-custom-types)
- [JSONEncoder.OutputFormatting](https://developer.apple.com/documentation/foundation/jsonencoder/outputformatting-swift.struct)

### 2. Settings with defaults

`Settings` must decode from JSON where any key may be absent. A missing key — or one whose value is `null` — takes its default: `host` is `"localhost"`, `port` is `8080`, `debug` is `false`. A key that is present with the wrong type is still an error and must throw.

```swift starter
struct Settings: Codable, Equatable {
    var host: String
    var port: Int
    var debug: Bool

    enum CodingKeys: String, CodingKey {
        case host, port, debug
    }

    init(host: String = "localhost", port: Int = 8080, debug: Bool = false) {
        self.host = host
        self.port = port
        self.debug = debug
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        host = try c.decode(String.self, forKey: .host)
        port = try c.decode(Int.self, forKey: .port)
        debug = try c.decode(Bool.self, forKey: .debug)
    }
}

func loadSettings(_ json: String) throws -> Settings {
    try JSONDecoder().decode(Settings.self, from: Data(json.utf8))
}
```

```swift test
/// everything supplied
func testAllPresent() {
    expect(try? loadSettings(#"{"host": "example.com", "port": 443, "debug": true}"#),
           Settings(host: "example.com", port: 443, debug: true))
    expect(try? loadSettings(#"{"host": "a", "port": 1, "debug": false}"#),
           Settings(host: "a", port: 1, debug: false))
}

/// nothing supplied
func testAllDefaults() {
    expect(try? loadSettings(#"{}"#), Settings())
    expect(try? loadSettings(#"{"unrelated": 1}"#), Settings(host: "localhost", port: 8080, debug: false))
}

/// one key at a time
func testPartial() {
    expect(try? loadSettings(#"{"port": 9000}"#), Settings(host: "localhost", port: 9000, debug: false))
    expect(try? loadSettings(#"{"host": "h"}"#), Settings(host: "h", port: 8080, debug: false))
    expect(try? loadSettings(#"{"debug": true}"#), Settings(host: "localhost", port: 8080, debug: true))
}

/// null counts as absent
func testNull() {
    expect(try? loadSettings(#"{"host": null, "port": null, "debug": null}"#), Settings())
    expect(try? loadSettings(#"{"host": null, "port": 22}"#), Settings(host: "localhost", port: 22, debug: false))
}

/// the wrong type is still an error
func testWrongType() {
    expect(try? loadSettings(#"{"port": "nine thousand"}"#), nil)
    expect(try? loadSettings(#"{"debug": 1}"#), nil)
    expect(try? loadSettings(#"not json at all"#), nil)
}
```

#### Uses
- [Codable & JSON › Missing keys and defaults](#/codable/missing-keys-and-defaults)
- [Codable & JSON › Encoding and decoding](#/codable/encoding-and-decoding)

#### Hints
- Swap each `decode` for `decodeIfPresent` and supply the default with `??`.
- `decodeIfPresent(Int.self, forKey: .port)` is an `Int?`: `nil` for absent and for `null`, and it still throws on a wrong type.
- Leave the memberwise `init` alone — the tests use it to build the expected values.

#### Tips
- `Settings()` with no arguments is the all-defaults value, because every parameter of the memberwise initializer has a default. That is why `testAllDefaults` can be written so briefly.
- `decodeIfPresent` returns `nil` for an absent key *and* for an explicit `null`, which is why the null test needs no extra work — and it still throws for a key that is present with the wrong type, which is the other half of the specification.

#### Docs
- [decodeIfPresent](https://developer.apple.com/documentation/swift/keyeddecodingcontainer/decodeifpresent(_:forkey:)-4ptr)

### 3. Which key was missing?

`missingKeyName(_:)` tries to decode a `Record` and returns the name of the key the decoder complained was absent, or `nil` when the JSON decodes successfully **or** when it fails for any other reason — a wrong type, or text that is not JSON at all.

```swift starter
struct Record: Codable {
    let name: String
    let score: Int
    let tags: [String]
}

func missingKeyName(_ json: String) -> String? {
    return nil
}
```

```swift test
/// names the absent key
func testMissing() {
    expect(missingKeyName(#"{"score": 1, "tags": []}"#), "name")
    expect(missingKeyName(#"{"name": "a", "tags": []}"#), "score")
    expect(missingKeyName(#"{"name": "a", "score": 1}"#), "tags")
}

/// nothing missing means nil
func testComplete() {
    expect(missingKeyName(#"{"name": "a", "score": 1, "tags": ["x"]}"#), nil)
    expect(missingKeyName(#"{"name": "", "score": 0, "tags": []}"#), nil)
    expect(missingKeyName(#"{"name": "a", "score": 1, "tags": [], "extra": true}"#), nil)
}

/// other failures are not missing keys
func testOtherFailures() {
    expect(missingKeyName(#"{"name": 1, "score": 1, "tags": []}"#), nil)
    expect(missingKeyName(#"{"name": "a", "score": "high", "tags": []}"#), nil)
    expect(missingKeyName("not json at all"), nil)
    expect(missingKeyName(""), nil)
}

/// an empty object is still a missing key
func testEmptyObject() {
    expect(missingKeyName(#"{}"#), "name")
}
```

#### Uses
- [Codable & JSON › When decoding fails](#/codable/when-decoding-fails)
- [Codable & JSON › Encoding and decoding](#/codable/encoding-and-decoding)

#### Hints
- Wrap the decode in `do { ... return nil }` and catch the one case you care about: `catch DecodingError.keyNotFound(let key, _)`.
- `key.stringValue` is the name as it appeared in the JSON.
- A second, bare `catch { return nil }` handles everything else — and the compiler insists on it, because a `do` must cover every error.

#### Tips
- `missingKeyName` is not `throws`, so every path out of the `do` has to produce a `String?`. That is the whole exercise: turning a thrown error into a value.
- Catch `DecodingError.keyNotFound` by pattern. Catching everything and then testing `error as? DecodingError` works too, and is three lines longer for the same answer.

#### Docs
- [DecodingError](https://developer.apple.com/documentation/swift/decodingerror)

### 4. Total of the paid orders

`paidTotal(_:)` decodes a JSON array of orders and returns the sum of `cents` over the items of every order whose status is `paid`. An empty array totals `0`, an order with no items contributes `0`, and a status the `Status` enum does not know about makes the whole decode throw.

```swift starter
struct Item: Codable, Equatable {
    let name: String
    let cents: Int
}

enum Status: String, Codable {
    case paid, pending, cancelled
}

struct Order: Codable, Equatable {
    let id: Int
    let status: Status
    let items: [Item]
}

func paidTotal(_ json: String) throws -> Int {
    return 0
}
```

```swift test
let twoOrders = """
[
  {"id": 1, "status": "paid", "items": [{"name": "coffee", "cents": 350}, {"name": "cake", "cents": 500}]},
  {"id": 2, "status": "pending", "items": [{"name": "tea", "cents": 275}]}
]
"""

/// only paid orders count
func testPaidOnly() {
    expect(try? paidTotal(twoOrders), 850)
    expect(try? paidTotal(#"[{"id": 1, "status": "paid", "items": [{"name": "x", "cents": 99}]}]"#), 99)
}

/// nothing to add up
func testEmpty() {
    expect(try? paidTotal("[]"), 0)
    expect(try? paidTotal(#"[{"id": 1, "status": "paid", "items": []}]"#), 0)
    expect(try? paidTotal(#"[{"id": 1, "status": "cancelled", "items": [{"name": "x", "cents": 99}]}]"#), 0)
}

/// several paid orders add together
func testManyPaid() {
    let json = """
    [
      {"id": 1, "status": "paid", "items": [{"name": "a", "cents": 100}]},
      {"id": 2, "status": "cancelled", "items": [{"name": "b", "cents": 1000}]},
      {"id": 3, "status": "paid", "items": [{"name": "c", "cents": 25}, {"name": "d", "cents": 5}]}
    ]
    """
    expect(try? paidTotal(json), 130)
}

/// an unknown status is a decoding failure
func testUnknownStatus() {
    expect(try? paidTotal(#"[{"id": 1, "status": "refunded", "items": []}]"#), nil)
    expect(try? paidTotal(#"[{"id": 1, "items": []}]"#), nil)
    expect(try? paidTotal("{}"), nil)
}
```

#### Uses
- [Codable & JSON › Nested types and arrays](#/codable/nested-types-and-arrays)
- [Codable & JSON › Codable is two protocols](#/codable/codable-is-two-protocols)
- [Codable & JSON › When decoding fails](#/codable/when-decoding-fails)

#### Hints
- The top level is an array, so decode `[Order].self`.
- `orders.filter { $0.status == .paid }` then sum the items: `.flatMap(\.items).reduce(0) { $0 + $1.cents }`.
- Nothing needs to be caught here — `paidTotal` is `throws`, so `try` on the decode lets the failure through to the caller.

#### Tips
- `Status` gets its `Codable` conformance from being a `String`-backed enum, and a raw value with no matching case is reported as `DecodingError.dataCorrupted`. You get validation of the whole vocabulary for free.
- The top level is an array, so the type argument is `[Order].self`. Passing `Order.self` throws a `typeMismatch` that reads confusingly until you spot it.

#### Docs
- [RawRepresentable and Codable](https://developer.apple.com/documentation/swift/rawrepresentable)
