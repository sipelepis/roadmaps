# SwiftData & files

An app that forgets everything when it is killed is a website with extra steps. Storage on iOS is not one thing: there is a database for your model objects, a plist for preferences, the file system for documents and caches, and the Keychain for anything secret. Picking the wrong one is the bug that survives a year — a password in `UserDefaults`, a 200MB cache in the folder that gets backed up to iCloud, a "single source of truth" that is really three.

This module is about choosing a store, evolving what is in it, and keeping one copy of the truth when the network disagrees with the disk.

## Where state actually lives

Every app gets a sandbox: a private directory tree nothing else can read. Inside it the folders mean different things to the system, and the meaning is enforced.

| What | Where | Backed up | Purged when low on space |
| --- | --- | --- | --- |
| Model objects | SwiftData / SQLite in Application Support | yes | no |
| Preferences | `UserDefaults` (a plist in Preferences) | yes | no |
| User documents | Documents | yes | no |
| Re-downloadable data | Caches | no | yes, at any time |
| Work in progress | `tmp` | no | yes, aggressively |
| Secrets | Keychain | yes (encrypted) | no |

Two rules follow from the table and cover most mistakes. Anything you can fetch again belongs in Caches, because iCloud should not be storing your thumbnails. Anything you cannot fetch again — the user's own writing — belongs in Documents or the database, because Caches can vanish between two launches and the system owes you no warning.

## SwiftData: models and the container

SwiftData turns a class into a persisted model with one macro. The class is a reference type on purpose: rows have identity, and two views looking at the same trip should see the same object.

```swift
import SwiftData

@Model
final class Trip {
    var name: String
    var startDate: Date
    var notes: String

    init(name: String, startDate: Date, notes: String = "") {
        self.name = name
        self.startDate = startDate
        self.notes = notes
    }
}
```

`@Model` rewrites every stored property into a persisted, observed one, so a view reading `trip.name` re-renders when it changes — the same `@Observable` machinery the models module used, applied for you.

The container is the database, and it is installed once on a scene:

```swift
@main
struct TripsApp: App {
    var body: some Scene {
        WindowGroup { TripList() }
            .modelContainer(for: Trip.self)
    }
}
```

Views then reach the context through the environment: `@Environment(\.modelContext) private var context`, and `context.insert(trip)` or `context.delete(trip)`. Saving is automatic on the main context, so you rarely call `context.save()` yourself; call it when you need the write to have happened before the next line.

## Queries

`@Query` is a live read. It runs the fetch, hands the view an array, and re-runs when the store changes underneath it.

```swift
@Query(sort: \Trip.startDate, order: .forward) private var trips: [Trip]

@Query(filter: #Predicate<Trip> { $0.notes.isEmpty == false },
       sort: \Trip.name) private var annotated: [Trip]
```

The filter is a `#Predicate`, not a closure: it is compiled into something the database can run, so the work happens in SQLite over the whole table rather than in Swift over an array you already loaded. That is also why the expressions you can write inside one are limited — if it does not compile, the query cannot be pushed down.

Sort and filter in the query, not in the view body. Fetching a thousand trips to show ten is a scrolling problem you will meet again in the performance module.

## Migrations

The model you ship is a schema, and the second version of your app has to open the first version's database. Adding a property with a default value, or a new optional, is a lightweight migration SwiftData infers. Renaming, splitting or re-typing a property is not, and needs a plan: a `VersionedSchema` per shipped shape and a `SchemaMigrationPlan` listing the stages between them.

```swift
enum TripsSchemaV1: VersionedSchema {
    static var versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] { [Trip.self] }
    // ...
}

enum TripsMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [TripsSchemaV1.self, TripsSchemaV2.self] }
    static var stages: [MigrationStage] { [.lightweight(fromVersion: TripsSchemaV1.self, toVersion: TripsSchemaV2.self)] }
}
```

Whatever the storage engine, the shape of the problem is the same and worth understanding on its own: you have data at version *n*, code that wants version *m*, and an ordered chain of small steps between them. Each step knows only how to go from one version to the next. If a step is missing, you have to fail loudly rather than open a database you cannot read — a half-migrated store is much worse than a refused launch.

## Codable and the shape of stored JSON

Not everything deserves a database. A draft, a cached response, a small list of saved searches — a `Codable` value written to a file is less machinery and easier to reason about.

The catch is that a JSON file on a user's disk is also a schema, with no migration system at all. Give the file a version number from the very first release. Then the reader is a `switch` on that number, and version 1 keeps working forever:

```swift
struct Envelope: Decodable {
    let schema: Int
}

let schema = try JSONDecoder().decode(Envelope.self, from: data).schema
```

Decode the envelope first, branch on the version, decode the rest with the matching type. Writing always produces the newest version.

## UserDefaults is for preferences

`UserDefaults` is a plist that loads into memory whole. It is right for small, user-facing choices: the selected tab, sort order, whether the tutorial was dismissed, a theme.

```swift
@AppStorage("sortOrder") private var sortOrder: SortOrder = .byDate
```

`@AppStorage` reads and writes a default and re-renders the view on change. It is not a database and not a cache: no lists of model objects, no images, no tokens. And it is not secure — a plist is plain text on disk.

Layering is the part people miss. A setting usually has a built-in default, sometimes a value pushed from a remote config, and sometimes an explicit user choice, and the effective value is the most specific one that exists. Keep those layers separate rather than overwriting the default, or you can never tell "the user chose dark" from "dark is what we ship".

```swift playground
import Foundation

// Three layers, most specific wins: shipped defaults, remote config, then the user's own choice.
let shipped = ["theme": "system", "fontSize": "medium", "haptics": "on"]
let remote = ["theme": "dark"]
let chosen = ["fontSize": "large"]

func effective(_ key: String) -> (value: String, source: String) {
    if let v = chosen[key] { return (v, "user") }
    if let v = remote[key] { return (v, "remote") }
    if let v = shipped[key] { return (v, "shipped") }
    return ("", "missing")
}

for key in shipped.keys.sorted() {
    let (value, source) = effective(key)
    print("\(key): \(value) (\(source))")
}

// Resetting is deleting the user's layer, not writing the default back over it.
print("after reset:", effective("fontSize"))
```

## Files and the sandbox

`FileManager` gives you the folders by name rather than by path:

```swift
let documents = URL.documentsDirectory
let caches = URL.cachesDirectory
let file = documents.appending(path: "drafts.json")
try data.write(to: file, options: .atomic)
```

`.atomic` writes to a temporary file and renames it, so a crash halfway through leaves the old file intact instead of a truncated one. Use it for anything you would be sad to lose.

Two details that only bite in production. Paths are not stable: the container directory changes between installs and launches, so store a filename and rebuild the URL, never persist an absolute path. And files can be excluded from backup with `URLResourceValues.isExcludedFromBackup` when they live outside Caches but still should not be uploaded.

For tests, none of this should be in the way. Put the file operations behind a small protocol — `read(name:)`, `write(_:name:)`, `remove(name:)` — and the logic above it can run against an in-memory dictionary in a millisecond.

## Caching with a lifetime

A cache is storage plus a rule for when the contents stop being true. The rule is almost always a time-to-live: keep the response, serve it for five minutes, fetch again after that.

Two things make a cache testable. The clock is an input, not a call to `Date()` buried inside; pass the current time in, or inject a clock. And expiry is separate from eviction: reading a stale entry returns nothing, while actually removing stale entries is a sweep you run when it suits you. Conflating them makes "how many things are we holding?" unanswerable.

## Keychain for secrets

Tokens, passwords, refresh tokens and keys go in the Keychain, which is encrypted at rest and tied to the device's passcode. The API is C-shaped and unpleasant:

```swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.trips",
    kSecAttrAccount as String: "refreshToken",
    kSecValueData as String: Data(token.utf8),
    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
]
SecItemAdd(query as CFDictionary, nil)
```

Wrap it once in a small type with `save`, `load` and `delete`, behind a protocol so the rest of the app never sees `kSec` anything. Choose the accessibility deliberately: `kSecAttrAccessibleWhenUnlocked` is the safe default, `...AfterFirstUnlock` is what a background refresh needs, and `...ThisDeviceOnly` keeps the item off other devices via backups.

Keychain items survive app deletion. That surprises users who "reinstall to log out", so clear your items on first launch after an install if that is not the behaviour you want.

## Offline-first and a single source of truth

Offline-first means the UI reads from local storage and never waits for the network. The network is a thing that *updates* local storage; the view does not know it exists.

```
network → (decode) → local store → @Query → view
```

That gives you instant launches, working aeroplanes and one place to look when the screen is wrong. The price is merging: two copies of a record diverge, and something has to decide. The usual scheme is last-write-wins on a timestamp, with a deletion recorded as a tombstone — a record marked deleted rather than a row that simply vanished. Without tombstones a delete on one device looks exactly like a record the other device has not seen yet, and gets resurrected on every sync.

Whatever the rule, write it down as a pure function over two lists of records. It is the single most testable piece of a sync engine, and the one most likely to be wrong.

## Exercises

### 1. A cache that goes stale

`TTLCache` keeps values under string keys for `ttl` seconds. The current time is always passed in, never read from the clock inside.

An entry is fresh while `now - storedAt` is strictly less than `ttl`; at exactly `ttl` it is stale. `value(for:now:)` returns `nil` for a stale or missing key but leaves it in place. `purge(now:)` is the sweep that actually removes stale entries, and `storedCount` is how many entries are physically held — fresh or not. Storing under an existing key replaces the value and restarts its clock.

```swift starter
struct TTLCache<Value> {
    let ttl: TimeInterval
    private var entries: [String: (value: Value, storedAt: Date)] = [:]

    init(ttl: TimeInterval) {
        self.ttl = ttl
    }

    var storedCount: Int { entries.count }

    mutating func store(_ value: Value, for key: String, now: Date) {
    }

    func value(for key: String, now: Date) -> Value? {
        return nil
    }

    mutating func purge(now: Date) {
    }
}
```

```swift test
let t0 = Date(timeIntervalSince1970: 1_000)
func at(_ seconds: TimeInterval) -> Date { t0.addingTimeInterval(seconds) }

/// a fresh value comes back
func testFresh() {
    var cache = TTLCache<String>(ttl: 60)
    cache.store("hello", for: "greeting", now: t0)
    expect(cache.value(for: "greeting", now: t0), "hello")
    expect(cache.value(for: "greeting", now: at(59)), "hello")
    expect(cache.storedCount, 1)
}

/// the ttl is exclusive at the boundary
func testExpiry() {
    var cache = TTLCache<String>(ttl: 60)
    cache.store("hello", for: "greeting", now: t0)
    expect(cache.value(for: "greeting", now: at(60)), nil)
    expect(cache.value(for: "greeting", now: at(600)), nil)
    expect(cache.storedCount, 1)
}

/// missing keys, and other types of value
func testMissing() {
    var cache = TTLCache<Int>(ttl: 5)
    expect(cache.value(for: "nothing", now: t0), nil)
    cache.store(7, for: "seven", now: t0)
    expect(cache.value(for: "seven", now: at(1)), 7)
    expect(cache.value(for: "nothing", now: at(1)), nil)
}

/// storing again restarts the clock
func testOverwrite() {
    var cache = TTLCache<String>(ttl: 10)
    cache.store("old", for: "k", now: t0)
    cache.store("new", for: "k", now: at(9))
    expect(cache.value(for: "k", now: at(18)), "new")
    expect(cache.value(for: "k", now: at(19)), nil)
    expect(cache.storedCount, 1)
}

/// purge removes only what is stale
func testPurge() {
    var cache = TTLCache<String>(ttl: 10)
    cache.store("a", for: "a", now: t0)
    cache.store("b", for: "b", now: at(8))
    cache.purge(now: at(12))
    expect(cache.storedCount, 1)
    expect(cache.value(for: "a", now: at(12)), nil)
    expect(cache.value(for: "b", now: at(12)), "b")
    cache.purge(now: at(100))
    expect(cache.storedCount, 0)
}
```

#### Uses
- [SwiftData & files › Caching with a lifetime](#/persistence/caching-with-a-lifetime)
- [SwiftData & files › Where state actually lives](#/persistence/where-state-actually-lives)
- [Reference › Dates and formatted values](#/reference/dates-and-formatted-values)

#### Hints
- `now.timeIntervalSince(storedAt)` is the age in seconds; fresh means that age is `< ttl`.
- `value(for:now:)` needs `guard let entry = entries[key] else { return nil }` and then the freshness check — it must not remove anything.
- `purge` is one line with `entries = entries.filter { ... }`, keeping the entries that are still fresh.

#### Tips
- Passing `now` in looks fussy until the first test: with a real `Date()` inside, "does it expire after a minute?" is a test that takes a minute.
- Reading and sweeping are different operations on purpose. A read that quietly deleted the entry would make `storedCount` depend on who looked at what, which is exactly the kind of cache that reports 0% memory use and still runs you out of it.

#### Docs
- [URLCache](https://developer.apple.com/documentation/foundation/urlcache)
- [Caching responses](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-ios-data-usage)

### 2. Run the migrations in order

A stored file is at some schema version and the app wants another. `migrate` walks from `from` to `to` one step at a time, applying the migration whose `from` matches the version it is currently on.

The array of migrations is not in any particular order, so pick by version rather than by position. Going backwards is refused with `.backwards`. A version with no migration leaving it is `.noPath(from:to:)`, where `from` is the version you got stuck on and `to` is the target. Migrating to the version you are already on changes nothing and succeeds, even with an empty list of migrations.

```swift starter
struct Migration {
    let from: Int
    let to: Int
    let apply: (inout [String: String]) -> Void
}

enum MigrationError: Error, Equatable {
    case backwards(from: Int, to: Int)
    case noPath(from: Int, to: Int)
}

func migrate(_ store: [String: String], from: Int, to: Int, using migrations: [Migration]) throws -> [String: String] {
    return store
}
```

```swift test
func step(_ from: Int, _ to: Int) -> Migration {
    Migration(from: from, to: to) { store in
        store["log", default: ""] += "\(from)>\(to);"
        store["v"] = "\(to)"
    }
}

func failure(_ from: Int, _ to: Int, _ migrations: [Migration]) -> MigrationError? {
    do { _ = try migrate([:], from: from, to: to, using: migrations); return nil }
    catch let e as MigrationError { return e }
    catch { return nil }
}

/// one step
func testSingle() {
    let got = try? migrate(["name": "trips"], from: 1, to: 2, using: [step(1, 2)])
    expect(got, ["name": "trips", "log": "1>2;", "v": "2"])
}

/// several steps, applied in version order whatever order they are listed in
func testChain() {
    let migrations = [step(3, 4), step(1, 2), step(2, 3)]
    let got = try? migrate([:], from: 1, to: 4, using: migrations)
    expect(got?["log"], "1>2;2>3;3>4;")
    expect(got?["v"], "4")
}

/// already there
func testNoop() {
    expect(try? migrate(["a": "b"], from: 3, to: 3, using: []), ["a": "b"])
    expect(try? migrate([:], from: 1, to: 1, using: [step(1, 2)]), [:])
}

/// a gap in the chain stops the whole migration
func testMissingStep() {
    expect(failure(1, 4, [step(1, 2), step(3, 4)]), MigrationError.noPath(from: 2, to: 4))
    expect(failure(1, 2, []), MigrationError.noPath(from: 1, to: 2))
    expect(failure(1, 3, [step(1, 2), step(2, 3)]), nil)
}

/// downgrades are refused before anything runs
func testBackwards() {
    expect(failure(4, 1, [step(1, 2)]), MigrationError.backwards(from: 4, to: 1))
    expect(failure(2, 1, []), MigrationError.backwards(from: 2, to: 1))
    let untouched = try? migrate(["log": "none"], from: 2, to: 1, using: [step(1, 2)])
    expect(untouched, nil)
}

/// a step that overshoots the target is still followed
func testOvershoot() {
    let got = try? migrate([:], from: 1, to: 3, using: [step(1, 3)])
    expect(got?["log"], "1>3;")
}
```

#### Uses
- [SwiftData & files › Migrations](#/persistence/migrations)
- [SwiftData & files › Codable and the shape of stored JSON](#/persistence/codable-and-the-shape-of-stored-json)
- [Reference › Collections](#/reference/collections)

#### Hints
- Keep a `var version = from` and a `var result = store`, and loop `while version < to`.
- Each turn of the loop is `guard let next = migrations.first(where: { $0.from == version }) else { throw .noPath(from: version, to: to) }`.
- `next.apply(&result)` mutates the dictionary in place, then `version = next.to`.

#### Tips
- Check `to < from` first and throw before touching the data. A migration that fails halfway has already written; a migration that refuses to start has not.
- Selecting the step by `from` rather than by array index is what makes the plan order-independent — and it is how `SchemaMigrationPlan` works too: you list the stages, the framework walks them.
- The loop condition `version < to` and a step that overshoots (1 → 3 when the target is 3) both work out. A step that overshoots *past* the target would loop forever with `!=`, which is why `<` is the safer comparison.

#### Docs
- [SchemaMigrationPlan](https://developer.apple.com/documentation/swiftdata/schemamigrationplan)
- [Adopting SwiftData for a Core Data app](https://developer.apple.com/documentation/coredata/adopting-swiftdata-for-a-core-data-app)

### 3. Read version 1, write version 2

Notes used to be stored as `{"schema": 1, "notes": [{"id": 3, "body": "..."}]}` — integer ids, a `body` field, no pinning. Version 2 is `{"schema": 2, "notes": [{"id": "3", "text": "...", "pinned": true}]}`.

`loadNotes` reads either version into today's `Note`. A v1 note's integer id becomes its decimal string and `pinned` is `false`. In v2, `pinned` may be missing and defaults to `false`. Any other schema number throws `.unsupportedSchema`, and anything that is not valid JSON of the expected shape throws too.

`saveNotes` always writes version 2, compact, with keys in alphabetical order: `{"notes":[{"id":"3","pinned":false,"text":"hi"}],"schema":2}`.

```swift starter
struct Note: Codable, Equatable {
    let id: String
    let text: String
    let pinned: Bool
}

enum StoreError: Error, Equatable {
    case unsupportedSchema(Int)
}

func loadNotes(_ json: String) throws -> [Note] {
    return []
}

func saveNotes(_ notes: [Note]) throws -> String {
    return ""
}
```

```swift test
let v1 = #"{"schema": 1, "notes": [{"id": 3, "body": "milk"}, {"id": 4, "body": "eggs"}]}"#
let v2 = #"{"schema": 2, "notes": [{"id": "3", "text": "milk", "pinned": true}]}"#

func loadFailure(_ json: String) -> StoreError? {
    do { _ = try loadNotes(json); return nil }
    catch let e as StoreError { return e }
    catch { return nil }
}

/// the old shape still opens
func testVersion1() {
    expect(try? loadNotes(v1), [Note(id: "3", text: "milk", pinned: false),
                                Note(id: "4", text: "eggs", pinned: false)])
    expect(try? loadNotes(#"{"schema": 1, "notes": []}"#), [])
}

/// the current shape, with pinned optional
func testVersion2() {
    expect(try? loadNotes(v2), [Note(id: "3", text: "milk", pinned: true)])
    expect(try? loadNotes(#"{"schema": 2, "notes": [{"id": "9", "text": "later"}]}"#),
           [Note(id: "9", text: "later", pinned: false)])
}

/// writing produces version 2, sorted and compact
func testSave() {
    expect(try? saveNotes([Note(id: "3", text: "hi", pinned: false)]),
           #"{"notes":[{"id":"3","pinned":false,"text":"hi"}],"schema":2}"#)
    expect(try? saveNotes([]), #"{"notes":[],"schema":2}"#)
}

/// what was written can be read back
func testRoundTrip() {
    let notes = [Note(id: "1", text: "a", pinned: true), Note(id: "2", text: "b", pinned: false)]
    let written = (try? saveNotes(notes)) ?? ""
    expect(try? loadNotes(written), notes)
    let upgraded = (try? loadNotes(v1)) ?? []
    expect(try? loadNotes((try? saveNotes(upgraded)) ?? ""), upgraded)
}

/// versions we cannot read, and data that is not ours
func testUnsupported() {
    expect(loadFailure(#"{"schema": 3, "notes": []}"#), StoreError.unsupportedSchema(3))
    expect(loadFailure(#"{"schema": 0, "notes": []}"#), StoreError.unsupportedSchema(0))
    expect(try? loadNotes("not json"), nil)
    expect(try? loadNotes(#"{"notes": []}"#), nil)
    expect(try? loadNotes(#"{"schema": 2, "notes": [{"id": "1"}]}"#), nil)
}
```

#### Uses
- [SwiftData & files › Codable and the shape of stored JSON](#/persistence/codable-and-the-shape-of-stored-json)
- [SwiftData & files › Files and the sandbox](#/persistence/files-and-the-sandbox)
- [Reference › Codable and JSON](#/reference/codable-and-json)

#### Hints
- Decode `struct Envelope: Decodable { let schema: Int }` first to learn the version, then decode again with the right payload type.
- Give each version its own private type: `struct V1Note: Decodable { let id: Int; let body: String }` and a v2 one with `let pinned: Bool?`.
- `encoder.outputFormatting = [.sortedKeys]` is what makes the output match the expected strings; without it the key order is undefined.

#### Tips
- The envelope decode is cheap and worth it: `JSONDecoder` reads the whole document either way, and having the version in hand before you commit to a type is what keeps the branches independent.
- Deciding the shape of version 1 *after* shipping it is not an option, so put `schema` in the file from day one even when there is only one version. The alternative is sniffing which keys are present, forever.
- `Note` here is the current model, not a version. Mapping old shapes into it at the boundary means the rest of the app never learns that version 1 existed.

#### Docs
- [Encoding and decoding custom types](https://developer.apple.com/documentation/foundation/encoding-and-decoding-custom-types)
- [JSONDecoder](https://developer.apple.com/documentation/foundation/jsondecoder)

### 4. Merge what the server says with what the disk says

Two lists of the same records, one from local storage and one from the server, both possibly stale. Produce the merged truth.

Every record has an `id`, a `text`, an `updatedAt` in seconds and a `deleted` flag. For an id in both lists, the higher `updatedAt` wins; on an exact tie the remote one wins, because the server is the tiebreaker. If the winner is a tombstone (`deleted == true`), the id is not in the result at all. If the winner is not a tombstone, the id is in the result even when the loser was a tombstone — a later edit resurrects a deleted record on purpose. The result is sorted by `id` ascending.

```swift starter
struct Record: Equatable {
    let id: String
    let text: String
    let updatedAt: Int
    let deleted: Bool

    init(id: String, text: String, updatedAt: Int, deleted: Bool = false) {
        self.id = id
        self.text = text
        self.updatedAt = updatedAt
        self.deleted = deleted
    }
}

func merge(local: [Record], remote: [Record]) -> [Record] {
    return local
}
```

```swift test
/// one side only
func testDisjoint() {
    let a = Record(id: "a", text: "local", updatedAt: 1)
    let b = Record(id: "b", text: "remote", updatedAt: 1)
    expect(merge(local: [a], remote: [b]), [a, b])
    expect(merge(local: [], remote: [b]), [b])
    expect(merge(local: [a], remote: []), [a])
    expect(merge(local: [], remote: []), [])
}

/// the newer edit wins, from either side
func testNewerWins() {
    let old = Record(id: "a", text: "old", updatedAt: 10)
    let new = Record(id: "a", text: "new", updatedAt: 20)
    expect(merge(local: [old], remote: [new]), [new])
    expect(merge(local: [new], remote: [old]), [new])
}

/// the server breaks a tie
func testTie() {
    let mine = Record(id: "a", text: "mine", updatedAt: 10)
    let theirs = Record(id: "a", text: "theirs", updatedAt: 10)
    expect(merge(local: [mine], remote: [theirs]), [theirs])
}

/// a winning tombstone removes the record
func testTombstoneWins() {
    let edit = Record(id: "a", text: "edited", updatedAt: 5)
    let gone = Record(id: "a", text: "", updatedAt: 9, deleted: true)
    expect(merge(local: [edit], remote: [gone]), [])
    expect(merge(local: [gone], remote: [edit]), [])
    expect(merge(local: [], remote: [gone]), [])
}

/// a later edit beats an older delete
func testResurrect() {
    let gone = Record(id: "a", text: "", updatedAt: 5, deleted: true)
    let edit = Record(id: "a", text: "back", updatedAt: 9)
    expect(merge(local: [gone], remote: [edit]), [edit])
    expect(merge(local: [edit], remote: [gone]), [edit])
}

/// a realistic sync, sorted by id
func testWholeSync() {
    let local = [
        Record(id: "b", text: "local b", updatedAt: 30),
        Record(id: "a", text: "local a", updatedAt: 10),
        Record(id: "d", text: "", updatedAt: 40, deleted: true),
    ]
    let remote = [
        Record(id: "a", text: "remote a", updatedAt: 20),
        Record(id: "c", text: "remote c", updatedAt: 5),
        Record(id: "d", text: "remote d", updatedAt: 35),
    ]
    expect(merge(local: local, remote: remote), [
        Record(id: "a", text: "remote a", updatedAt: 20),
        Record(id: "b", text: "local b", updatedAt: 30),
        Record(id: "c", text: "remote c", updatedAt: 5),
    ])
}
```

#### Uses
- [SwiftData & files › Offline-first and a single source of truth](#/persistence/offline-first-and-a-single-source-of-truth)
- [SwiftData & files › Where state actually lives](#/persistence/where-state-actually-lives)

#### Hints
- Build `var winners: [String: Record]` from `local`, then fold `remote` in: a remote record wins when there is no local one, or when `remote.updatedAt >= local.updatedAt`.
- `>=` rather than `>` is the whole tiebreak rule.
- At the end, `winners.values.filter { !$0.deleted }.sorted { $0.id < $1.id }`.

#### Tips
- Filter the tombstones out at the very end, not while merging. A tombstone has to take part in the comparison — dropping it early is exactly how deleted records come back.
- A dictionary has no order, so the sort at the end is not decoration: without it the same inputs give different output between runs and the test flickers.
- Last-write-wins needs clocks you trust. Real sync engines use the server's timestamp on both sides, or a version counter, because two devices with slightly wrong clocks will happily overwrite each other.

#### Docs
- [Syncing model data across devices](https://developer.apple.com/documentation/swiftdata/syncing-model-data-across-a-persons-devices)
- [Fetching data from a remote server](https://developer.apple.com/documentation/foundation/fetching-website-data-into-memory)

### 5. A SwiftData list that survives a relaunch

Build a trips screen backed by SwiftData: a model, a container on the app, a live query, and add and delete. Then quit the app and relaunch it to prove the data is really on disk.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `@Model final class Trip` with a name, a start date and notes.
- `.modelContainer(for: Trip.self)` on the `WindowGroup`, and nothing else that creates a container at runtime.
- A list driven by `@Query(sort: \Trip.startDate)`, not by a `@State` array the view maintains itself.
- An add button that inserts through `@Environment(\.modelContext)`, and swipe-to-delete that calls `context.delete`.
- Relaunching the app shows the same trips — check it in the simulator, not only in the preview.
- A `#Preview` using a `ModelConfiguration(isStoredInMemoryOnly: true)` container with two sample trips, so the preview never writes to the real store.

```swift solution
// Trip.swift
import Foundation
import SwiftData

@Model
final class Trip {
    var name: String
    var startDate: Date
    var notes: String

    init(name: String, startDate: Date, notes: String = "") {
        self.name = name
        self.startDate = startDate
        self.notes = notes
    }
}

// TripsApp.swift
import SwiftUI
import SwiftData

@main
struct TripsApp: App {
    var body: some Scene {
        WindowGroup {
            TripList()
        }
        .modelContainer(for: Trip.self)
    }
}

// TripList.swift
import SwiftUI
import SwiftData

struct TripList: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Trip.startDate, order: .forward) private var trips: [Trip]

    var body: some View {
        NavigationStack {
            List {
                ForEach(trips) { trip in
                    VStack(alignment: .leading) {
                        Text(trip.name)
                        Text(trip.startDate, format: .dateTime.day().month().year())
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete(perform: delete)
            }
            .navigationTitle("Trips")
            .overlay {
                if trips.isEmpty {
                    ContentUnavailableView("No trips yet", systemImage: "suitcase",
                                           description: Text("Tap + to plan one."))
                }
            }
            .toolbar {
                Button("Add trip", systemImage: "plus", action: add)
            }
        }
    }

    private func add() {
        context.insert(Trip(name: "New trip", startDate: .now))
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            context.delete(trips[index])
        }
    }
}

// TripList+Preview.swift
@MainActor
private let previewContainer: ModelContainer = {
    let container = try! ModelContainer(
        for: Trip.self,
        configurations: ModelConfiguration(isStoredInMemoryOnly: true)
    )
    container.mainContext.insert(Trip(name: "Lisbon", startDate: .now))
    container.mainContext.insert(Trip(name: "Oslo", startDate: .now.addingTimeInterval(86_400 * 30)))
    return container
}()

#Preview {
    TripList()
        .modelContainer(previewContainer)
}
```

#### Uses
- [SwiftData & files › SwiftData: models and the container](#/persistence/swiftdata-models-and-the-container)
- [SwiftData & files › Queries](#/persistence/queries)
- [SwiftData & files › Where state actually lives](#/persistence/where-state-actually-lives)
- [Reference › Observation, SwiftData and storage](#/reference/observation-swiftdata-and-storage)

#### Hints
- `@Model` only works on a `final class`, and every stored property must be a type SwiftData can persist.
- `@Query` needs a container in the environment. If the preview crashes on launch, it is because the container is missing, not because the query is wrong.
- `.onDelete(perform:)` hands you an `IndexSet` into the same array the `ForEach` is showing, so `trips[index]` is the object to delete.

#### Tips
- There is no "save" button here on purpose. The main context autosaves, and adding an explicit `try? context.save()` after every insert teaches the wrong habit — call it when you need the write to have landed, not as a reflex.
- An in-memory container for previews is the difference between a preview that seeds nice sample data and a preview that fills your real database with "New trip" every time you edit the file.
- Keep the query in the view that shows the list, not in a parent that passes an array down. `@Query` re-runs on store changes only where it is declared.

#### Docs
- [SwiftData](https://developer.apple.com/documentation/swiftdata)
- [Preserving your app's model data across launches](https://developer.apple.com/documentation/swiftdata/preserving-your-apps-model-data-across-launches)
- [Query](https://developer.apple.com/documentation/swiftdata/query)
