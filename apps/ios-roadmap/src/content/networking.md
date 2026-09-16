# Networking

Almost every screen in an app is a picture of something on a server, and almost every bug in an app is a case where the server said something the screen was not expecting. `URLSession` with `async`/`await` makes the happy path three lines; the rest of this module is the other paths — what a 404 means to the user, when to retry and when not to, what to do with a response that decodes to nonsense, and how to test any of it without a network.

## URLSession and async/await

```swift
let (data, response) = try await URLSession.shared.data(from: url)
```

That is the whole call. It suspends without blocking, it throws `URLError` for transport failures, and it is cancelled when the surrounding task is — so a `.task` that goes away takes its request with it.

`data(for:)` takes a `URLRequest` when you need headers, a method or a body:

```swift
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = try JSONEncoder().encode(body)
let (data, response) = try await URLSession.shared.data(for: request)
```

Build URLs with `URLComponents` and `URLQueryItem`, never by gluing strings together: a search for `pens & pads` has to arrive percent-encoded, and string interpolation will not do it for you.

`URLSession.shared` is fine to start with. A session of your own is for when you need configuration — timeouts, a cache, headers on every request — and it should be created once and held, not made per call.

## Codable DTOs

Decode into types that match the JSON, not into the types your app wants to use. These are *DTOs*: one property per field, names matching the wire, no logic.

```swift
struct ProductDTO: Decodable {
    let id: Int
    let displayName: String
    let priceCents: Int
    let salePriceCents: Int?
    let addedAt: Date
}
```

Configure the decoder once rather than writing `CodingKeys` by hand:

```swift
let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase   // display_name -> displayName
decoder.dateDecodingStrategy = .iso8601
```

An optional property is the right answer for a field the server may omit; a non-optional one is a promise that it never will, and decoding throws the moment that promise breaks. Make the choice deliberately, because "everything optional" moves the crash from one obvious place into a hundred `if let`s.

## From DTO to domain

The DTO is not the model your views should use. A separate mapping step is where the wire's oddities are dealt with once: two price fields becoming a price and an `isOnSale` flag, a name that needs trimming, a row that is a placeholder and should not be shown at all.

```swift
struct Product: Equatable, Identifiable {
    let id: Int
    let name: String
    let priceCents: Int
    let isOnSale: Bool
    let addedAt: Date
}
```

The reward is that everything above this line stops caring what the server's JSON looks like. A field renamed on the server changes the DTO and the mapper; a rename that reaches your views is a rename you will pay for in five files. That mapping is the first exercise.

## Status codes and errors

`URLSession` throws only for *transport* failures — no network, a timeout, a cancelled task. An HTTP 500 is a perfectly successful request with a disappointing answer, and if you do not look at the status code you will decode the error page as if it were your data.

```swift
guard let http = response as? HTTPURLResponse else { throw AppError.unknown }
if let problem = problem(with: http.statusCode) { throw problem }
```

So there are three quite different kinds of failure to fold into one type your views can switch over: the transport error (`URLError`), the status code, and a `DecodingError` from a response you could not read. Doing it once, in a function, means every screen says the same thing about the same problem. That is the second exercise.

Two details worth building in from the start. `URLError.cancelled` and `CancellationError` are *not* failures to show anybody — they mean the user moved on. And `error.localizedDescription` is written for developers; a user-facing message belongs on your own error type.

## Timeouts and retries

The default request timeout is 60 seconds, which is far too long for anything a person is waiting for. Set it on a configuration:

```swift
let config = URLSessionConfiguration.default
config.timeoutIntervalForRequest = 15    // no response at all for 15s
config.timeoutIntervalForResource = 60   // the whole transfer, including retries
```

Retry only what is worth retrying. A `404` will still be a `404` in two seconds; an `offline` or a `503` may well not be. And retry with **exponential backoff** — 100ms, then 200ms, then 400ms, capped — because a thousand phones retrying in lockstep is how a wobbling server becomes a dead one. That policy is the third exercise.

Cap the attempts. Three is usually right; the honest reason is that the fourth attempt is for you, not for the user, who left.

## Caching

`URLSession` already has an HTTP cache, and it honours the server's `Cache-Control` headers with no code from you. Before you write a cache, check whether the server is sending the headers to make the built-in one work.

Your own cache is for the things HTTP's is not: the last successful response kept so the screen has something to show while it refreshes, and images, which want an in-memory store with a size limit. Showing stale data with a quiet "updating" indicator beats showing a spinner over an empty screen, almost always.

The rule that keeps this honest: a cache entry needs a timestamp and a policy, or it is just a memory leak that occasionally lies.

## A seam for tests

None of the above is testable against a real server, and it should not be. Put a protocol between your screens and the network:

```swift
protocol ProductService: Sendable {
    func products(matching query: String) async throws -> [Product]
}
```

The real implementation wraps `URLSession`. A fake returns canned results — including the failures, which are the cases you can never reliably produce on demand against a live server. Screens and models depend on the protocol, so previews get the fake, tests get a fake that fails on the second call, and none of it needs a network.

This is the same shape as the exercises below: the retry policy takes a `Fetching` and knows nothing about HTTP, which is exactly why it can be tested here, with no network at all.

```swift playground
import Foundation

struct ProductDTO: Decodable {
    let id: Int
    let displayName: String
    let priceCents: Int
    let salePriceCents: Int?
    let addedAt: Date
}

struct Envelope: Decodable {
    let items: [ProductDTO]
}

struct Product: Equatable {
    let id: Int
    let name: String
    let priceCents: Int
    let isOnSale: Bool
}

let payload = """
{"items": [
  {"id": 1, "display_name": " Fountain pen ", "price_cents": 1250, "sale_price_cents": 999, "added_at": "2026-01-02T03:04:05Z"},
  {"id": 2, "display_name": "Notepad", "price_cents": 450, "added_at": "2026-01-03T00:00:00Z"}
]}
"""

let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase
decoder.dateDecodingStrategy = .iso8601

let dtos = try! decoder.decode(Envelope.self, from: Data(payload.utf8)).items
let products = dtos.map { dto in
    Product(id: dto.id,
            name: dto.displayName.trimmingCharacters(in: .whitespaces),
            priceCents: dto.salePriceCents ?? dto.priceCents,
            isOnSale: dto.salePriceCents != nil)
}
for product in products { print(product) }

// Three kinds of failure, one thing for the screen to switch over.
enum AppError: Equatable {
    case offline, timedOut, notFound, badData, unknown
    case server(Int)
}

func classify(_ error: Error) -> AppError {
    if let url = error as? URLError {
        switch url.code {
        case .notConnectedToInternet, .networkConnectionLost: return .offline
        case .timedOut: return .timedOut
        default: return .unknown
        }
    }
    if error is DecodingError { return .badData }
    return .unknown
}

print(classify(URLError(.notConnectedToInternet)), classify(URLError(.timedOut)))
do { _ = try decoder.decode(Envelope.self, from: Data(#"{"items": 3}"#.utf8)) }
catch { print(classify(error)) }

// Exponential backoff, capped: what a caller would actually wait.
func backoff(beforeAttempt attempt: Int) -> Duration {
    guard attempt > 1 else { return .zero }
    let ms = min(100 << (attempt - 2), 1000)
    return .milliseconds(ms)
}
print((1...6).map { "attempt \($0): \(backoff(beforeAttempt: $0))" }.joined(separator: ", "))
```

## Exercises

### 1. The wire is not your model

The server sends an envelope of products in its own shape. Write `products(from:)`, which decodes it and maps it into the app's `Product`.

- The decoder converts `snake_case` keys and reads ISO 8601 dates.
- `name` is `display_name` trimmed of whitespace.
- `priceCents` is `sale_price_cents` when that field is present, and `price_cents` otherwise. `isOnSale` says which happened.
- Rows whose trimmed `display_name` is empty are dropped — the server sends placeholders — and so are rows whose effective price is negative.
- Anything that does not decode at all throws.

```swift starter
struct ProductDTO: Decodable {
    let id: Int
    let displayName: String
    let priceCents: Int
    let salePriceCents: Int?
    let addedAt: Date
}

struct Envelope: Decodable {
    let items: [ProductDTO]
}

struct Product: Equatable {
    let id: Int
    let name: String
    let priceCents: Int
    let isOnSale: Bool
    let addedAt: Date
}

func products(from json: String) throws -> [Product] {
    return []
}
```

```swift test
let goodJSON = """
{"items": [
  {"id": 1, "display_name": " Fountain pen ", "price_cents": 1250, "sale_price_cents": 999, "added_at": "2026-01-02T03:04:05Z"},
  {"id": 2, "display_name": "Notepad", "price_cents": 450, "added_at": "2026-01-02T03:04:05Z"}
]}
"""

/// the ordinary case, mapped and trimmed
func testMapping() {
    let got = try? products(from: goodJSON)
    expect(got?.count, 2)
    expect(got?.first, Product(id: 1, name: "Fountain pen", priceCents: 999, isOnSale: true,
                               addedAt: Date(timeIntervalSince1970: 1767323045)))
    expect(got?.last, Product(id: 2, name: "Notepad", priceCents: 450, isOnSale: false,
                              addedAt: Date(timeIntervalSince1970: 1767323045)))
}

/// an empty envelope is not a failure
func testEmpty() {
    expect(try? products(from: #"{"items": []}"#), [])
}

/// placeholder rows are dropped
func testDropsJunk() {
    let json = """
    {"items": [
      {"id": 1, "display_name": "  ", "price_cents": 100, "added_at": "2026-01-02T03:04:05Z"},
      {"id": 2, "display_name": "", "price_cents": 100, "added_at": "2026-01-02T03:04:05Z"},
      {"id": 3, "display_name": "Ink", "price_cents": -5, "added_at": "2026-01-02T03:04:05Z"},
      {"id": 4, "display_name": "Ink", "price_cents": 700, "sale_price_cents": -1, "added_at": "2026-01-02T03:04:05Z"},
      {"id": 5, "display_name": "Ruler", "price_cents": 0, "added_at": "2026-01-02T03:04:05Z"}
    ]}
    """
    let got = try? products(from: json)
    expect(got?.map(\.id), [5])
    expect(got?.first?.priceCents, 0)
}

/// the sale price wins when it is there
func testSalePrice() {
    let json = """
    {"items": [
      {"id": 1, "display_name": "A", "price_cents": 500, "sale_price_cents": 500, "added_at": "2026-01-02T03:04:05Z"},
      {"id": 2, "display_name": "B", "price_cents": 500, "added_at": "2026-01-02T03:04:05Z"}
    ]}
    """
    let got = try? products(from: json)
    expect(got?.map(\.isOnSale), [true, false])
    expect(got?.map(\.priceCents), [500, 500])
}

/// nonsense throws rather than returning nothing
func testThrows() {
    expect(try? products(from: "not json"), nil)
    expect(try? products(from: #"{"items": 3}"#), nil)
    expect(try? products(from: #"{"items": [{"id": 1}]}"#), nil)
    expect(try? products(from: #"{"items": [{"id": 1, "display_name": "A", "price_cents": 1, "added_at": "yesterday"}]}"#), nil)
}
```

#### Uses
- [Networking › Codable DTOs](#/networking/codable-dtos)
- [Networking › From DTO to domain](#/networking/from-dto-to-domain)

#### Hints
- Configure the decoder before you use it: `keyDecodingStrategy = .convertFromSnakeCase` and `dateDecodingStrategy = .iso8601`.
- `try JSONDecoder().decode(Envelope.self, from: Data(json.utf8))` — the `try` without a `?` is what makes the last test's failures come out of your function.
- Map first, then filter, or use `compactMap` and return `nil` for the rows to drop. The effective price is `dto.salePriceCents ?? dto.priceCents`.
- `isOnSale` is just `dto.salePriceCents != nil`; there is no need to compare the two numbers.

#### Tips
- `.convertFromSnakeCase` saves you a `CodingKeys` enum per type, and is the first thing to reach for. When one field does not follow the pattern, write `CodingKeys` for that type alone rather than abandoning the strategy.
- Dropping bad rows rather than throwing is a decision about what the screen should do. One placeholder row should not empty a catalogue — but it should be logged, because silence is how a server bug lives for a year.
- Keep `Product` free of anything `Decodable`. The moment the domain type conforms, someone will decode straight into it and the mapping layer quietly disappears.

#### Docs
- [JSONDecoder](https://developer.apple.com/documentation/foundation/jsondecoder)
- [Encoding and decoding custom types](https://developer.apple.com/documentation/foundation/encoding-and-decoding-custom-types)

### 2. One error type the screen can read

Fold the three kinds of failure into `AppError`, and give it the two things a view needs: what to say, and whether a retry button makes sense.

`classify(_:)` takes an error thrown by the session or the decoder:

- `URLError` with `.notConnectedToInternet`, `.networkConnectionLost` or `.dataNotAllowed`: `.offline`.
- `URLError` with `.timedOut`: `.timedOut`.
- `URLError` with `.cancelled`, or a `CancellationError`: `.cancelled`.
- any other `URLError`: `.unknown`.
- any `DecodingError`: `.badData`.
- anything else: `.unknown`.

`problem(with:)` takes an HTTP status code and returns the matching error, or `nil` when there is nothing wrong:

- `200` to `299`: `nil`. `401` or `403`: `.unauthorized`. `404`: `.notFound`. Any other code: `.server(code)`.

`isRetryable` is true for `.offline` and `.timedOut`, and for `.server(code)` when the code is `429` or `500` and above. `message` is the sentence the user sees; `.cancelled` has nothing to say, so its message is the empty string.

```swift starter
enum AppError: Error, Equatable {
    case offline
    case timedOut
    case cancelled
    case notFound
    case unauthorized
    case badData
    case unknown
    case server(Int)

    var isRetryable: Bool {
        return false
    }

    var message: String {
        return ""
    }
}

func classify(_ error: Error) -> AppError {
    return .unknown
}

func problem(with status: Int) -> AppError? {
    return .unknown
}
```

```swift test
/// transport failures
func testTransport() {
    expect(classify(URLError(.notConnectedToInternet)), .offline)
    expect(classify(URLError(.networkConnectionLost)), .offline)
    expect(classify(URLError(.dataNotAllowed)), .offline)
    expect(classify(URLError(.timedOut)), .timedOut)
    expect(classify(URLError(.cancelled)), .cancelled)
    expect(classify(CancellationError()), .cancelled)
    expect(classify(URLError(.badServerResponse)), .unknown)
}

/// a response we could not read, and anything else
func testOtherErrors() {
    struct Mystery: Error {}
    var decoding: Error = Mystery()
    do { _ = try JSONDecoder().decode([Int].self, from: Data(#"{"a": 1}"#.utf8)) }
    catch { decoding = error }
    expect(classify(decoding), .badData)
    expect(classify(Mystery()), .unknown)
}

/// status codes
func testStatus() {
    expect(problem(with: 200), nil)
    expect(problem(with: 201), nil)
    expect(problem(with: 299), nil)
    expect(problem(with: 401), .unauthorized)
    expect(problem(with: 403), .unauthorized)
    expect(problem(with: 404), .notFound)
    expect(problem(with: 400), .server(400))
    expect(problem(with: 429), .server(429))
    expect(problem(with: 500), .server(500))
    expect(problem(with: 503), .server(503))
}

/// what is worth a retry button
func testRetryable() {
    expect(AppError.offline.isRetryable, true)
    expect(AppError.timedOut.isRetryable, true)
    expect(AppError.server(500).isRetryable, true)
    expect(AppError.server(503).isRetryable, true)
    expect(AppError.server(429).isRetryable, true)
    expect(AppError.server(400).isRetryable, false)
    expect(AppError.server(404).isRetryable, false)
    expect(AppError.notFound.isRetryable, false)
    expect(AppError.unauthorized.isRetryable, false)
    expect(AppError.badData.isRetryable, false)
    expect(AppError.cancelled.isRetryable, false)
    expect(AppError.unknown.isRetryable, false)
}

/// every case says something, except the one that should not
func testMessages() {
    expect(AppError.cancelled.message, "")
    let cases: [AppError] = [.offline, .timedOut, .notFound, .unauthorized, .badData, .unknown, .server(500)]
    for error in cases {
        expect(!error.message.isEmpty, "\(error) has no message")
        expect(error.message.count > 8, "\(error) says only “\(error.message)”")
    }
}
```

#### Uses
- [Networking › Status codes and errors](#/networking/status-codes-and-errors)
- [Networking › URLSession and async/await](#/networking/urlsession-and-async-await)
- [Concurrency & MainActor › .task and cancellation](#/concurrency/task-and-cancellation)
- [Reference › URLs and networking types](#/reference/urls-and-networking-types)

#### Hints
- `if let url = error as? URLError { switch url.code { ... } }` — `URLError.Code` has a case for each of the names above, and `default` catches the rest.
- Check `error is CancellationError` too; a task cancelled before the request even started throws that rather than a `URLError`.
- `error is DecodingError` covers all four of its cases, so there is no need to match them individually.
- `problem(with:)` starts with `guard !(200..<300).contains(status) else { return nil }`, then a `switch` over the code.

#### Tips
- `.cancelled` existing as its own case is the whole point of this type. Lumped in with `.unknown`, every navigation away from a loading screen paints an error over a screen the user has already left.
- Write `message` for a person: "You appear to be offline" tells them what to do, `The operation couldn't be completed. (NSURLErrorDomain error -1009.)` does not — and that is exactly what `localizedDescription` gives you.
- `isRetryable` living on the error means the view never decides. `if error.isRetryable { Button("Try again") }` reads the same on every screen, and so does the app.

#### Docs
- [URLError](https://developer.apple.com/documentation/foundation/urlerror)
- [HTTPURLResponse](https://developer.apple.com/documentation/foundation/httpurlresponse)
- [DecodingError](https://developer.apple.com/documentation/swift/decodingerror)

### 3. Retry, but politely

Write the retry policy. `backoff(beforeAttempt:)` says how long to wait before attempt *n*: nothing before the first, 100ms before the second, and double each time, capped at one second. `load(using:maxAttempts:)` calls the client until it succeeds, sleeping that long between tries, retrying only errors whose `isRetryable` is true, and rethrowing the last error when it runs out of attempts.

```swift starter
enum LoadError: Error, Equatable {
    case offline
    case notFound
    case server(Int)

    var isRetryable: Bool {
        switch self {
        case .offline: return true
        case .notFound: return false
        case .server(let code): return code >= 500
        }
    }
}

protocol Fetching: Sendable {
    func fetch() async throws -> String
}

func backoff(beforeAttempt attempt: Int) -> Duration {
    return .zero
}

func load(using client: Fetching, maxAttempts: Int) async throws -> String {
    return try await client.fetch()
}
```

```swift test
actor FakeClient: Fetching {
    private var results: [Result<String, LoadError>]
    private(set) var calls = 0

    init(_ results: [Result<String, LoadError>]) {
        self.results = results
    }

    func fetch() async throws -> String {
        calls += 1
        let next = results.isEmpty ? Result<String, LoadError>.failure(.offline) : results.removeFirst()
        return try next.get()
    }
}

/// the schedule doubles and then stops growing
func testBackoff() {
    expect(backoff(beforeAttempt: 1), .zero)
    expect(backoff(beforeAttempt: 2), .milliseconds(100))
    expect(backoff(beforeAttempt: 3), .milliseconds(200))
    expect(backoff(beforeAttempt: 4), .milliseconds(400))
    expect(backoff(beforeAttempt: 5), .milliseconds(800))
    expect(backoff(beforeAttempt: 6), .milliseconds(1000))
    expect(backoff(beforeAttempt: 9), .milliseconds(1000))
}

/// a first try that works costs nothing
func testFirstTry() async {
    let client = FakeClient([.success("ok")])
    expect(try? await load(using: client, maxAttempts: 3), "ok")
    expect(await client.calls, 1)
}

/// keep going while the failures are worth retrying
func testRetriesUntilSuccess() async {
    let client = FakeClient([.failure(.offline), .failure(.server(503)), .success("ok")])
    expect(try? await load(using: client, maxAttempts: 4), "ok")
    expect(await client.calls, 3)
}

/// give up after the last attempt and rethrow
func testGivesUp() async {
    let client = FakeClient([.failure(.offline), .failure(.offline), .failure(.server(500))])
    var caught: LoadError?
    do { _ = try await load(using: client, maxAttempts: 3) } catch { caught = error as? LoadError }
    expect(caught, .server(500))
    expect(await client.calls, 3)
}

/// a permanent failure is not retried at all
func testPermanentFailure() async {
    let client = FakeClient([.failure(.notFound), .success("ok")])
    var caught: LoadError?
    do { _ = try await load(using: client, maxAttempts: 5) } catch { caught = error as? LoadError }
    expect(caught, .notFound)
    expect(await client.calls, 1)

    let refused = FakeClient([.failure(.server(400)), .success("ok")])
    expect(try? await load(using: refused, maxAttempts: 5), nil)
    expect(await refused.calls, 1)
}

/// it really waits between attempts
func testWaits() async {
    let client = FakeClient([.failure(.offline), .failure(.offline), .success("ok")])
    let start = ContinuousClock.now
    expect(try? await load(using: client, maxAttempts: 3), "ok")
    let elapsed = ContinuousClock.now - start
    expect(elapsed > .milliseconds(250), "100ms + 200ms of backoff should take about 300ms, took \(elapsed)")
}
```

#### Uses
- [Networking › Timeouts and retries](#/networking/timeouts-and-retries)
- [Networking › A seam for tests](#/networking/a-seam-for-tests)
- [Concurrency & MainActor › Structured and unstructured work](#/concurrency/structured-and-unstructured-work)
- [Reference › Concurrency](#/reference/concurrency)

#### Hints
- `backoff` is `guard attempt > 1 else { return .zero }`, then `min(100 << (attempt - 2), 1000)` milliseconds. The shift doubles; `min` is the cap.
- `load` is a loop over `1...maxAttempts`. Sleep `backoff(beforeAttempt: attempt)` first — it is `.zero` for the first one, so there is no special case to write.
- `do { return try await client.fetch() } catch { ... }` inside the loop. In the `catch`, rethrow immediately unless the error is a retryable `LoadError` *and* there are attempts left.
- `try? await Task.sleep(for: backoff(beforeAttempt: attempt))` keeps the sleep from adding an error of its own, and `Duration.zero` sleeps return at once.

#### Tips
- Retrying everything is worse than retrying nothing. A retried `404` is three times the latency for the same answer, and a retried `401` can lock an account.
- The cap on the delay matters as much as the doubling. Without it the eighth attempt waits 12 seconds, and by then the user has quit the app.
- A real client adds *jitter* — a small random amount on each delay — so that a thousand devices that failed together do not come back together. One line, and it is the line that stops a recovering server falling over again.

#### Docs
- [Task.sleep(for:tolerance:clock:)](https://developer.apple.com/documentation/swift/task/sleep(for:tolerance:clock:))
- [Duration](https://developer.apple.com/documentation/swift/duration)

### 4. The client behind the protocol

Build the real thing in Xcode: one `URLSession`, one configured decoder, status codes checked, errors classified, and a protocol so nothing above it knows any of that.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `ProductService` protocol with one `async throws` method, conforming to `Sendable`.
- An `APIClient` holding a `URLSession` built from a `URLSessionConfiguration` with `timeoutIntervalForRequest` set to 15 seconds, created once as a stored property rather than per call.
- A `JSONDecoder` configured once as a `static let`, with the snake-case and ISO 8601 strategies.
- The URL built with `URLComponents` and `URLQueryItem`, never by string interpolation, and an `Accept: application/json` header.
- The response cast to `HTTPURLResponse` and its status code run through `problem(with:)` before anything is decoded.
- A `catch` that turns a `DecodingError` into `.badData` and a `URLError` into its classified case, so the caller only ever sees an `AppError`.
- A `FakeProductService` with a settable `Result`, used by previews and tests, including at least one failing case.

```swift solution
// ProductService.swift
protocol ProductService: Sendable {
    func products(matching query: String) async throws -> [Product]
}

// APIClient.swift
struct APIClient: ProductService {
    let baseURL: URL
    private let session: URLSession

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = false
        self.session = URLSession(configuration: config)
    }

    func products(matching query: String) async throws -> [Product] {
        var components = URLComponents(
            url: baseURL.appending(path: "products"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [URLQueryItem(name: "q", value: query)]

        var request = URLRequest(url: components.url!)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw AppError.unknown }
            if let problem = problem(with: http.statusCode) { throw problem }
            let envelope = try Self.decoder.decode(Envelope.self, from: data)
            return envelope.items.compactMap(Product.init(dto:))
        } catch let error as AppError {
            throw error
        } catch {
            throw classify(error)
        }
    }
}

// FakeProductService.swift — previews and tests only.
struct FakeProductService: ProductService {
    var result: Result<[Product], AppError> = .success([
        Product(id: 1, name: "Fountain pen", priceCents: 999, isOnSale: true, addedAt: .now)
    ])
    var delay: Duration = .milliseconds(300)

    func products(matching query: String) async throws -> [Product] {
        try await Task.sleep(for: delay)
        return try result.get()
    }
}
```

#### Uses
- [Networking › URLSession and async/await](#/networking/urlsession-and-async-await)
- [Networking › Status codes and errors](#/networking/status-codes-and-errors)
- [Networking › A seam for tests](#/networking/a-seam-for-tests)
- [Networking › Timeouts and retries](#/networking/timeouts-and-retries)
- [Reference › URLs and networking types](#/reference/urls-and-networking-types)

#### Hints
- `catch let error as AppError { throw error }` before the general `catch` stops your own thrown status error being classified a second time as `.unknown`.
- A `static let` decoder is built once for the whole process. Making a `JSONDecoder` per request is not free, and it is the easy version of this mistake.
- `baseURL.appending(path:)` joins paths without you thinking about slashes, and `URLComponents` puts the query on safely.
- `URLSession(configuration:)` creates a session; hold it in a property. A session created per call also creates a connection pool per call.

#### Tips
- `waitsForConnectivity = false` is right for anything a person is waiting for: with it on, an offline request hangs until the network comes back rather than failing quickly enough to show "you appear to be offline".
- Keep `Product.init(dto:)` as a failable initialiser and use `compactMap`, so the "drop the placeholder rows" rule from exercise 1 lives in one place.
- The fake having a `delay` is what makes a preview show its loading state. A fake that returns instantly is a fake that never proves your spinner works.

#### Docs
- [URLSession](https://developer.apple.com/documentation/foundation/urlsession)
- [URLSessionConfiguration](https://developer.apple.com/documentation/foundation/urlsessionconfiguration)
- [Fetching website data into memory](https://developer.apple.com/documentation/foundation/fetching-website-data-into-memory)

### 5. A screen that survives a bad network

Build a list screen that behaves when the network does not: the last good results stay on screen, the error says something a person can act on, and the retry button only appears when retrying could help.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `@MainActor @Observable` model taking a `ProductService`, holding `products`, an optional `AppError` and an `isRefreshing` flag.
- A failed refresh that **keeps** the products already on screen rather than clearing them.
- An error banner at the top of the list showing `error.message`, with a "Try again" button shown only when `error.isRetryable`.
- `.cancelled` never shown at all.
- `ContentUnavailableView` for the first load failing with nothing to show, and `ProgressView` only when there is nothing on screen yet.
- `.task` for the first load and `.refreshable` for pull-to-refresh, both going through the same method.
- Previews for three states — loaded, offline with stale results, and a first load that failed — all driven by `FakeProductService`.

```swift solution
// CatalogueModel.swift
@MainActor
@Observable
final class CatalogueModel {
    private(set) var products: [Product] = []
    private(set) var error: AppError?
    private(set) var isRefreshing = false
    private(set) var hasLoadedOnce = false

    private let service: ProductService

    init(service: ProductService) {
        self.service = service
    }

    func refresh(query: String = "") async {
        isRefreshing = true
        defer {
            isRefreshing = false
            hasLoadedOnce = true
        }
        do {
            products = try await service.products(matching: query)
            error = nil
        } catch let failure as AppError {
            // Keep whatever is on screen; a failed refresh is not a reason to empty the list.
            error = failure == .cancelled ? nil : failure
        } catch {
            error = classify(error)
        }
    }
}

// CatalogueScreen.swift
struct CatalogueScreen: View {
    @State private var model: CatalogueModel

    init(service: ProductService) {
        _model = State(wrappedValue: CatalogueModel(service: service))
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Catalogue")
                .task { await model.refresh() }
                .refreshable { await model.refresh() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.products.isEmpty, let error = model.error, model.hasLoadedOnce {
            ContentUnavailableView {
                Label("Nothing to show", systemImage: "tray")
            } description: {
                Text(error.message)
            } actions: {
                if error.isRetryable {
                    Button("Try again") { Task { await model.refresh() } }
                }
            }
        } else if model.products.isEmpty && !model.hasLoadedOnce {
            ProgressView()
        } else {
            List {
                if let error = model.error {
                    Section {
                        banner(for: error)
                    }
                }
                ForEach(model.products) { product in
                    LabeledContent(product.name, value: price(product))
                }
            }
        }
    }

    @ViewBuilder
    private func banner(for error: AppError) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(error.message)
                    .font(.footnote)
                if error.isRetryable {
                    Button("Try again") { Task { await model.refresh() } }
                        .font(.footnote)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func price(_ product: Product) -> String {
        (Decimal(product.priceCents) / 100).formatted(.currency(code: "GBP"))
    }
}

#Preview("Loaded") {
    CatalogueScreen(service: FakeProductService())
}

#Preview("Offline, with stale results") {
    CatalogueScreen(service: FakeProductService(result: .failure(.offline)))
}

#Preview("Nothing found") {
    CatalogueScreen(service: FakeProductService(result: .failure(.notFound)))
}
```

#### Uses
- [Networking › Status codes and errors](#/networking/status-codes-and-errors)
- [Networking › Caching](#/networking/caching)
- [Networking › A seam for tests](#/networking/a-seam-for-tests)
- [Concurrency & MainActor › Async work in a view](#/concurrency/async-work-in-a-view)
- [Reference › URLs and networking types](#/reference/urls-and-networking-types)

#### Hints
- Assign `products` only on success. The `catch` touches `error` and nothing else, which is the whole "keep the stale results" behaviour.
- `hasLoadedOnce` separates "still loading for the first time" from "loaded, and there is genuinely nothing" — two states that look identical without it.
- Put the banner in its own `Section` at the top of the `List` so it scrolls with the content instead of covering it.
- `(Decimal(cents) / 100).formatted(.currency(code:))` turns an integer number of pennies into a localised price.

#### Tips
- Emptying the list on a failed refresh is the most common version of this screen and the worst: the user had something readable, pulled to refresh on a train, and now has nothing.
- Showing a retry button for a `404` teaches users that the button does not work. Gating it on `isRetryable` is one `if` and it keeps the button meaningful.
- Three previews of three failures cost about a minute and are the only cheap way to see the error states. Producing them against a real server means turning off wifi at the right moment.

#### Docs
- [ContentUnavailableView](https://developer.apple.com/documentation/swiftui/contentunavailableview)
- [refreshable(action:)](https://developer.apple.com/documentation/swiftui/view/refreshable(action:))
- [FormatStyle](https://developer.apple.com/documentation/foundation/formatstyle)
