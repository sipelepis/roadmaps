# Practice problems

This module is practice only: ten self-contained problems of the kind an iOS app is actually made of — routing a deep link, paginating a feed, validating a form, queueing writes made offline, backing off a failed request, labelling a date for VoiceOver, prefetching with a bounded number of tasks, rate-limiting an API, and decoding a feed that has one bad row in it. Nothing new is taught here.

Every one of them is plain Swift, on purpose. This is the code that decides whether your app is correct; the SwiftUI on top of it is a rendering of these answers. Get these right and the screen is mostly layout.

## How to work

- Read the tests before the code. They are the specification, and they show the exact types expected.
- Get something compiling first, however clumsy. Then look for the version Swift wants.
- `print(...)` output shows up under a failing test, which is the fastest way to see what is happening.
- Every signature is given. Your job is the body.
- Two problems have tests that measure elapsed time or count concurrent work. A correct-but-sequential answer passes the value checks and fails those, on purpose.

## The shape of an answer

The playground below solves a warm-up: a tiny state machine driven by events, which is the shape of about half the problems below. Note that it is a pure function — `(state, event) -> state` — with no storage, no clock and no network anywhere near it. That is what makes it four lines to test and impossible to get subtly wrong at 3am.

```swift playground
enum SessionState: Equatable {
    case signedOut
    case signingIn
    case signedIn(user: String)
    case failed(String)
}

enum SessionEvent: Equatable {
    case tapSignIn
    case succeeded(user: String)
    case failed(reason: String)
    case signOut
}

func next(_ state: SessionState, _ event: SessionEvent) -> SessionState {
    switch (state, event) {
    case (.signedOut, .tapSignIn), (.failed, .tapSignIn): return .signingIn
    case (.signingIn, .succeeded(let user)): return .signedIn(user: user)
    case (.signingIn, .failed(let reason)): return .failed(reason)
    case (_, .signOut): return .signedOut
    default: return state           // anything else is an event that does not apply here
    }
}

var state = SessionState.signedOut
for event: SessionEvent in [.tapSignIn, .failed(reason: "offline"), .tapSignIn,
                            .succeeded(user: "ada"), .tapSignIn, .signOut] {
    let before = state
    state = next(state, event)
    print("\(before) + \(event) -> \(state)")
}
```

## Exercises

### 1. Route a deep link

`route(_:)` turns the path part of a deep link into the screen it should open.

`""` and `"/"` are `.home`. `"/trips/42"` is `.trip(id: "42")`, and `"/trips/42/photos/7"` is `.tripPhoto(tripID: "42", photoID: "7")`. `"/settings"` is `.settings(section: nil)`, and a `section` query item names the section: `"/settings?section=privacy"`. Other query items are ignored. A trailing slash never matters, an empty id is not a valid id, and anything else is `.unknown`.

```swift starter
enum Route: Equatable {
    case home
    case trip(id: String)
    case tripPhoto(tripID: String, photoID: String)
    case settings(section: String?)
    case unknown
}

func route(_ path: String) -> Route {
    return .home
}
```

```swift test
/// the root
func testHome() {
    expect(route(""), .home)
    expect(route("/"), .home)
}

/// a trip and one of its photos
func testTrips() {
    expect(route("/trips/42"), .trip(id: "42"))
    expect(route("/trips/42/"), .trip(id: "42"))
    expect(route("/trips/lisbon-2024"), .trip(id: "lisbon-2024"))
    expect(route("/trips/42/photos/7"), .tripPhoto(tripID: "42", photoID: "7"))
    expect(route("/trips/42/photos/7/"), .tripPhoto(tripID: "42", photoID: "7"))
}

/// settings, with and without a section
func testSettings() {
    expect(route("/settings"), .settings(section: nil))
    expect(route("/settings/"), .settings(section: nil))
    expect(route("/settings?section=privacy"), .settings(section: "privacy"))
    expect(route("/settings?utm=email&section=account"), .settings(section: "account"))
    expect(route("/settings?utm=email"), .settings(section: nil))
}

/// nothing that matches
func testUnknown() {
    expect(route("/trips"), .unknown)
    expect(route("/trips/"), .unknown)
    expect(route("/trips/42/photos"), .unknown)
    expect(route("/trips/42/photos/7/extra"), .unknown)
    expect(route("/profile"), .unknown)
    expect(route("/trips//photos/7"), .unknown)
}
```

#### Uses
- [What is iOS? › Two kinds of exercise](#/intro/two-kinds-of-exercise)
- [Dependencies & modules › Protocol seams](#/dependencies/protocol-seams)
- [Reference › SwiftUI lists and navigation](#/reference/swiftui-lists-and-navigation)

#### Hints
- Split the string on `"?"` first: the head is the path, the tail (if any) is the query.
- `path.split(separator: "/")` drops the empty pieces at each end for you, so `"/trips/42/"` gives `["trips", "42"]` — but it also collapses `"//"`, so check for an empty component yourself if you split with `omittingEmptySubsequences: false`.
- Swift cannot bind values inside an array pattern, so switch on `components.count` with `where` clauses: `case 2 where components[0] == "trips"`, `case 4 where components[0] == "trips" && components[2] == "photos"`.
- For the query, split on `"&"` then on `"="` and look for the `section` key.

#### Tips
- Switching on the component count first is what makes this fail safely: an extra component does not match any case and falls through to `.unknown` rather than being quietly ignored.
- Returning `.unknown` rather than crashing or defaulting to `.home` matters for links: a URL from an old version of the app, or from a typo in an email, should land somewhere harmless and not pretend to be the home screen.
- `URLComponents` would parse the query for you, and in a real app it should — it handles percent-encoding, which hand-rolled splitting does not.

#### Docs
- [Defining a custom URL scheme for your app](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)
- [URLComponents](https://developer.apple.com/documentation/foundation/urlcomponents)

### 2. Paginate without duplicates

A feed loads a page at a time and appends what it gets. Servers being what they are, pages overlap.

`append(page:)` adds the posts whose ids are not already in the feed, keeping the existing order and the first version of any id — a post that is already there is not updated and not moved. A page with fewer posts than `pageSize`, including an empty one, means the server has nothing more: `isExhausted` becomes `true` and stays true.

```swift starter
struct Post: Equatable {
    let id: String
    let title: String
}

struct Feed: Equatable {
    let pageSize: Int
    private(set) var posts: [Post] = []
    private(set) var isExhausted = false

    init(pageSize: Int) {
        self.pageSize = pageSize
    }

    mutating func append(page: [Post]) {
    }
}
```

```swift test
func page(_ ids: [Int]) -> [Post] {
    ids.map { Post(id: "\($0)", title: "post \($0)") }
}

/// a full page keeps the feed open
func testFirstPage() {
    var feed = Feed(pageSize: 3)
    feed.append(page: page([1, 2, 3]))
    expect(feed.posts, page([1, 2, 3]))
    expect(feed.isExhausted, false)
}

/// overlapping pages do not duplicate
func testOverlap() {
    var feed = Feed(pageSize: 3)
    feed.append(page: page([1, 2, 3]))
    feed.append(page: page([3, 4, 5]))
    expect(feed.posts, page([1, 2, 3, 4, 5]))
    expect(feed.isExhausted, false)
}

/// the first version of a post wins, and it does not move
func testFirstWins() {
    var feed = Feed(pageSize: 2)
    feed.append(page: [Post(id: "1", title: "original"), Post(id: "2", title: "two")])
    feed.append(page: [Post(id: "3", title: "three"), Post(id: "1", title: "edited")])
    expect(feed.posts, [Post(id: "1", title: "original"),
                        Post(id: "2", title: "two"),
                        Post(id: "3", title: "three")])
}

/// duplicates inside one page, and exhaustion counts what the server sent
func testDuplicatesWithinAPage() {
    var feed = Feed(pageSize: 4)
    feed.append(page: page([1, 1, 2, 2]))
    expect(feed.posts, page([1, 2]))
    expect(feed.isExhausted, false)
}

/// a short page is the end
func testExhausted() {
    var feed = Feed(pageSize: 3)
    feed.append(page: page([1, 2, 3]))
    expect(feed.isExhausted, false)
    feed.append(page: page([4, 5]))
    expect(feed.isExhausted, true)
    expect(feed.posts, page([1, 2, 3, 4, 5]))
}

/// an empty first page, and exhaustion is permanent
func testEmptyAndSticky() {
    var feed = Feed(pageSize: 3)
    feed.append(page: [])
    expect(feed.posts, [])
    expect(feed.isExhausted, true)
    feed.append(page: page([1, 2, 3]))
    expect(feed.posts, page([1, 2, 3]))
    expect(feed.isExhausted, true)
}
```

#### Uses
- [Performance › Lists, identity and diffing](#/performance/lists-identity-and-diffing)
- [SwiftData & files › Offline-first and a single source of truth](#/persistence/offline-first-and-a-single-source-of-truth)

#### Hints
- Keep a `Set<String>` of the ids you already have, or derive it each time with `Set(posts.map(\.id))` — the feed is small enough that either is fine.
- Walk the page in order, appending only when the id is new, and insert the id into the set as you go so duplicates *within* the page are caught too.
- `isExhausted` is `isExhausted || page.count < pageSize`, so it never goes back to `false`.

#### Tips
- Deciding exhaustion from the page the server sent, rather than from how many new posts you kept, is what stops a fully-overlapping page from ending the feed early.
- Keeping the first version of a post is the choice that keeps the list stable while the user is scrolling. Replacing it is defensible too — but then a row's content changes under the user's thumb, and you have to decide what that does to the scroll position.
- This little struct is the whole reason a list screen can be simple: the view just renders `posts` and shows a spinner while `!isExhausted`.

#### Docs
- [Loading and displaying a large data feed](https://developer.apple.com/documentation/foundation/loading-and-displaying-a-large-data-feed)

### 3. Validate a sign-up form

`errors(_:)` returns one message per invalid field, keyed by field name, and `canSubmit(_:)` is whether the form is ready.

Report only the first failing rule for a field, in the order listed:

- `email`: empty gives `"Email is required"`; otherwise it must contain an `@` with something before it, and a `.` somewhere after the `@`, or `"Enter a valid email"`.
- `password`: empty gives `"Password is required"`; fewer than 8 characters gives `"Password must be at least 8 characters"`.
- `confirmation`: anything other than an exact match for the password gives `"Passwords do not match"`, and only when the password itself has no error.
- `terms`: not accepted gives `"You must accept the terms"`.

```swift starter
struct SignUpForm {
    var email = ""
    var password = ""
    var confirmation = ""
    var acceptedTerms = false
}

func errors(_ form: SignUpForm) -> [String: String] {
    return [:]
}

func canSubmit(_ form: SignUpForm) -> Bool {
    return true
}
```

```swift test
func valid() -> SignUpForm {
    SignUpForm(email: "ada@example.com", password: "correcthorse",
               confirmation: "correcthorse", acceptedTerms: true)
}

/// a good form has nothing to say
func testValid() {
    expect(errors(valid()), [:])
    expect(canSubmit(valid()), true)
}

/// an empty form complains about everything except the confirmation
func testEmpty() {
    expect(errors(SignUpForm()), ["email": "Email is required",
                                  "password": "Password is required",
                                  "terms": "You must accept the terms"])
    expect(canSubmit(SignUpForm()), false)
}

/// email shapes
func testEmail() {
    var form = valid()
    form.email = "ada"
    expect(errors(form), ["email": "Enter a valid email"])
    form.email = "ada@example"
    expect(errors(form), ["email": "Enter a valid email"])
    form.email = "@example.com"
    expect(errors(form), ["email": "Enter a valid email"])
    form.email = "ada@mail.example.co.uk"
    expect(errors(form), [:])
}

/// password length, and the confirmation that follows it
func testPassword() {
    var form = valid()
    form.password = "short"
    form.confirmation = "short"
    expect(errors(form), ["password": "Password must be at least 8 characters"])
    form.password = "longenough"
    form.confirmation = "longenoug"
    expect(errors(form), ["confirmation": "Passwords do not match"])
    form.confirmation = ""
    expect(errors(form), ["confirmation": "Passwords do not match"])
}

/// no confirmation error while the password itself is wrong
func testNoCascade() {
    var form = valid()
    form.password = ""
    form.confirmation = "anything"
    expect(errors(form), ["password": "Password is required"])
    expect(canSubmit(form), false)
}

/// the terms are their own field
func testTerms() {
    var form = valid()
    form.acceptedTerms = false
    expect(errors(form), ["terms": "You must accept the terms"])
    expect(canSubmit(form), false)
}
```

#### Uses
- [Testing › What is worth testing](#/testing/what-is-worth-testing)
- [What is iOS? › Two kinds of exercise](#/intro/two-kinds-of-exercise)

#### Hints
- Build a `var result: [String: String] = [:]` and add to it; the field name is the key.
- For the email: find the index of the first `@`, require something before it, and require a `.` in what comes after it.
- Write the password rules first and only check the confirmation when `result["password"] == nil`.
- `canSubmit` is `errors(form).isEmpty` — one line, and it cannot drift out of step with the messages.

#### Tips
- One error per field is a product decision as much as a code one. Showing "required" and "too short" and "does not match" on an empty form is three ways of saying the same thing, and users read none of them.
- `canSubmit` deriving from `errors` rather than repeating the rules is the whole trick. Two copies of a validation rule are two rules, and one of them will be wrong by the next sprint.
- Real email validation is a losing game — the only test that counts is sending a message to it. `@` with a dot after it rejects typos without rejecting anyone's actual address.

#### Docs
- [TextField](https://developer.apple.com/documentation/swiftui/textfield)
- [Validating user input](https://developer.apple.com/design/human-interface-guidelines/text-fields)

### 4. Squash the offline queue

While the app was offline it recorded every edit. Before sending them, collapse the queue so each record is written once.

Group the operations by id. The result keeps the position of each id's **first** operation, and what that position holds depends on the sequence:

- If the last operation for an id is a `delete`, and the first was a `create`, the record never existed on the server: drop it entirely.
- If the last operation is a `delete` otherwise, the result is that `delete`.
- If the first operation is a `create`, the result is a `create` carrying the **latest** text.
- Otherwise the result is an `update` carrying the latest text — including when a `delete` was followed by a `create`, because the server still has the record.

```swift starter
enum Operation: Equatable {
    case create(id: String, text: String)
    case update(id: String, text: String)
    case delete(id: String)
}

func coalesce(_ operations: [Operation]) -> [Operation] {
    return operations
}
```

```swift test
/// nothing to squash
func testPassThrough() {
    expect(coalesce([]), [])
    expect(coalesce([.update(id: "a", text: "one")]), [.update(id: "a", text: "one")])
    expect(coalesce([.create(id: "a", text: "one"), .update(id: "b", text: "two")]),
           [.create(id: "a", text: "one"), .update(id: "b", text: "two")])
}

/// a create and its edits are one create
func testCreateThenEdits() {
    expect(coalesce([.create(id: "a", text: "one"),
                     .update(id: "a", text: "two"),
                     .update(id: "a", text: "three")]),
           [.create(id: "a", text: "three")])
}

/// repeated edits are one update
func testEditsCollapse() {
    expect(coalesce([.update(id: "a", text: "one"),
                     .update(id: "a", text: "two")]),
           [.update(id: "a", text: "two")])
}

/// created then deleted never happened
func testCreatedThenDeleted() {
    expect(coalesce([.create(id: "a", text: "one"),
                     .update(id: "a", text: "two"),
                     .delete(id: "a")]),
           [])
    expect(coalesce([.update(id: "b", text: "keep"),
                     .create(id: "a", text: "one"),
                     .delete(id: "a")]),
           [.update(id: "b", text: "keep")])
}

/// edited then deleted is a delete
func testEditedThenDeleted() {
    expect(coalesce([.update(id: "a", text: "one"),
                     .delete(id: "a")]),
           [.delete(id: "a")])
}

/// deleted then created again is an update
func testDeletedThenCreated() {
    expect(coalesce([.delete(id: "a"),
                     .create(id: "a", text: "back")]),
           [.update(id: "a", text: "back")])
}

/// order follows each id's first appearance
func testOrder() {
    let queue: [Operation] = [
        .update(id: "c", text: "c1"),
        .create(id: "a", text: "a1"),
        .update(id: "c", text: "c2"),
        .update(id: "b", text: "b1"),
        .update(id: "a", text: "a2"),
        .delete(id: "b"),
    ]
    expect(coalesce(queue), [.update(id: "c", text: "c2"),
                             .create(id: "a", text: "a2"),
                             .delete(id: "b")])
}
```

#### Uses
- [SwiftData & files › Offline-first and a single source of truth](#/persistence/offline-first-and-a-single-source-of-truth)
- [SwiftData & files › Where state actually lives](#/persistence/where-state-actually-lives)

#### Hints
- Give `Operation` a computed `id` in an extension — every case has one, and the rest of the code gets much shorter.
- Collect the ids in order of first appearance into an array, and the operations per id into a `[String: [Operation]]`.
- Then map each id to at most one operation, using its first and last operations and the latest text you saw for it.
- Return `compactMap`'s result, so the "never happened" case can return `nil`.

#### Tips
- Sending three writes for one record is not just slow, it is a correctness problem: each one can fail separately, and now you have to reason about a record that is half-updated on the server.
- The delete-then-create case is the one everyone gets wrong. From the server's point of view the record is still there, so a second `create` would be a conflict — the queue has to translate it.
- Keeping the position of the *first* operation makes the result deterministic and keeps related edits roughly in the order the user made them, which matters if the server applies them one at a time.

#### Docs
- [Performing tasks in the background](https://developer.apple.com/documentation/backgroundtasks)

### 5. Back off properly

A failed request should be retried, and retried more slowly each time, and eventually given up on.

`backoff(retries:base:factor:cap:)` returns the delay in milliseconds before each retry: the first waits `base`, and each one after is `factor` times the previous, never more than `cap`. `retries` of zero or less gives an empty list, and a `base` above the cap is itself capped. It must not overflow, however many retries are asked for.

```swift starter
func backoff(retries: Int, base: Int, factor: Int, cap: Int) -> [Int] {
    return []
}
```

```swift test
/// doubling up to a ceiling
func testDoubling() {
    expect(backoff(retries: 8, base: 100, factor: 2, cap: 5_000),
           [100, 200, 400, 800, 1_600, 3_200, 5_000, 5_000])
}

/// a few small cases
func testSmall() {
    expect(backoff(retries: 1, base: 250, factor: 3, cap: 10_000), [250])
    expect(backoff(retries: 3, base: 1, factor: 10, cap: 10_000), [1, 10, 100])
    expect(backoff(retries: 0, base: 100, factor: 2, cap: 5_000), [])
    expect(backoff(retries: -2, base: 100, factor: 2, cap: 5_000), [])
}

/// a factor of one is a fixed delay
func testFixedDelay() {
    expect(backoff(retries: 4, base: 500, factor: 1, cap: 5_000), [500, 500, 500, 500])
}

/// the cap applies from the first delay
func testBaseOverCap() {
    expect(backoff(retries: 3, base: 9_000, factor: 2, cap: 5_000), [5_000, 5_000, 5_000])
}

/// forty retries must not overflow
func testNoOverflow() {
    let delays = backoff(retries: 40, base: 100, factor: 4, cap: 30_000)
    expect(delays.count, 40)
    expect(delays.allSatisfy { $0 <= 30_000 }, "every delay is capped")
    expect(delays.last, 30_000)
    expect(delays.prefix(3), [100, 400, 1_600])
}

/// a huge factor is capped immediately
func testHugeFactor() {
    expect(backoff(retries: 3, base: 1_000, factor: 1_000_000, cap: 2_000),
           [1_000, 2_000, 2_000])
}
```

#### Uses
- [Performance › Measure, then fix](#/performance/measure-then-fix)
- [Shipping to the App Store › Crash reporting and symbolication](#/release/crash-reporting-and-symbolication)

#### Hints
- Keep a running `var delay = min(base, cap)` and append it, then compute the next one from it.
- Cap *before* multiplying again: once `delay` is at the cap, the next one is the cap too, and nothing ever grows large enough to overflow.
- `pow` and `Int` do not mix well here — an exponential built from the previous value is both simpler and safe.

#### Tips
- `base * Int(pow(Double(factor), Double(i)))` is the obvious answer and it traps on `testNoOverflow`, because 100 × 4³⁹ does not fit in an `Int`. Clamping each step is what keeps it finite.
- Real backoff adds **jitter** — a random fraction of the delay — so that ten thousand phones that failed at the same moment do not retry at the same moment. It is left out here only because a test cannot check a random number easily.
- Capping matters more than the curve. An uncapped exponential reaches "retry in four hours", which to a user is indistinguishable from the app being broken.

#### Docs
- [URLSession retry behaviour](https://developer.apple.com/documentation/foundation/urlsession)

### 6. Say when it happened

VoiceOver reads the label, not the dot; a relative date has to be a sentence. `timeAgo(_:)` turns an age in seconds into that sentence.

Under a minute is `"just now"`, and so is any negative age — a clock slightly ahead should not say "in 3 seconds". Under an hour it is minutes, under a day hours, under a week days, and beyond that weeks. Everything rounds down, the singular is used for exactly one, and anything from 52 weeks is `"over a year ago"`.

```swift starter
func timeAgo(_ seconds: Int) -> String {
    return "just now"
}
```

```swift test
/// the first minute
func testJustNow() {
    expect(timeAgo(0), "just now")
    expect(timeAgo(59), "just now")
    expect(timeAgo(-10), "just now")
}

/// minutes
func testMinutes() {
    expect(timeAgo(60), "1 minute ago")
    expect(timeAgo(119), "1 minute ago")
    expect(timeAgo(120), "2 minutes ago")
    expect(timeAgo(3_599), "59 minutes ago")
}

/// hours
func testHours() {
    expect(timeAgo(3_600), "1 hour ago")
    expect(timeAgo(7_199), "1 hour ago")
    expect(timeAgo(7_200), "2 hours ago")
    expect(timeAgo(86_399), "23 hours ago")
}

/// days
func testDays() {
    expect(timeAgo(86_400), "1 day ago")
    expect(timeAgo(172_800), "2 days ago")
    expect(timeAgo(604_799), "6 days ago")
}

/// weeks
func testWeeks() {
    expect(timeAgo(604_800), "1 week ago")
    expect(timeAgo(1_209_600), "2 weeks ago")
    expect(timeAgo(604_800 * 51), "51 weeks ago")
}

/// long enough ago that the number stops helping
func testOverAYear() {
    expect(timeAgo(604_800 * 52), "over a year ago")
    expect(timeAgo(604_800 * 300), "over a year ago")
}
```

#### Uses
- [What is iOS? › Two kinds of exercise](#/intro/two-kinds-of-exercise)
- [Testing › What is worth testing](#/testing/what-is-worth-testing)

#### Hints
- Work down from the largest unit, or up from the smallest — either works, as long as each branch returns.
- Integer division rounds down already: `seconds / 3_600` is the whole hours.
- One small helper removes the plural duplication: `func unit(_ n: Int, _ name: String) -> String { "\(n) \(name)\(n == 1 ? "" : "s") ago" }`.

#### Tips
- The negative case is not hypothetical. Device clocks disagree with servers, and a timestamp a few seconds in the future is normal — "in -3 seconds ago" has shipped more than once.
- `RelativeDateTimeFormatter` does this properly, in every language, and is what you should use in an app. Writing it once is about seeing every boundary: 59, 60, 119, 120 are where the bugs are.
- VoiceOver reads exactly this string, so it has to make sense out of context. "2h" is fine to look at and unpleasant to listen to.

#### Docs
- [RelativeDateTimeFormatter](https://developer.apple.com/documentation/foundation/relativedatetimeformatter)
- [Accessibility labels](https://developer.apple.com/documentation/swiftui/view/accessibilitylabel(_:)-1d7jv)

### 7. Recent searches

A search field remembers what was typed before. `RecentSearches` keeps them newest first, without duplicates, and without growing forever.

`record(_:)` trims whitespace from the term and ignores it if nothing is left. A term already in the list — comparing case-insensitively — moves to the front and takes the new spelling. When the list is over `limit`, the oldest fall off the end. A `limit` of zero or less keeps nothing at all.

```swift starter
struct RecentSearches: Equatable {
    let limit: Int
    private(set) var items: [String] = []

    init(limit: Int) {
        self.limit = limit
    }

    mutating func record(_ term: String) {
    }

    mutating func clear() {
    }
}
```

```swift test
/// newest first
func testOrder() {
    var recents = RecentSearches(limit: 5)
    recents.record("lisbon")
    recents.record("oslo")
    recents.record("rome")
    expect(recents.items, ["rome", "oslo", "lisbon"])
}

/// repeating a search moves it up and takes the new spelling
func testMoveToFront() {
    var recents = RecentSearches(limit: 5)
    recents.record("lisbon")
    recents.record("oslo")
    recents.record("Lisbon")
    expect(recents.items, ["Lisbon", "oslo"])
    recents.record("OSLO")
    expect(recents.items, ["OSLO", "Lisbon"])
}

/// whitespace is trimmed and empty terms are ignored
func testTrimming() {
    var recents = RecentSearches(limit: 5)
    recents.record("  lisbon  ")
    recents.record("")
    recents.record("   ")
    recents.record("\n\t")
    expect(recents.items, ["lisbon"])
}

/// the oldest fall off
func testLimit() {
    var recents = RecentSearches(limit: 3)
    for term in ["a", "b", "c", "d", "e"] {
        recents.record(term)
    }
    expect(recents.items, ["e", "d", "c"])
}

/// a limit of zero keeps nothing
func testNoLimit() {
    var zero = RecentSearches(limit: 0)
    zero.record("lisbon")
    expect(zero.items, [])

    var negative = RecentSearches(limit: -1)
    negative.record("lisbon")
    expect(negative.items, [])
}

/// clearing
func testClear() {
    var recents = RecentSearches(limit: 3)
    recents.record("a")
    recents.record("b")
    recents.clear()
    expect(recents.items, [])
    recents.record("c")
    expect(recents.items, ["c"])
}
```

#### Uses
- [SwiftData & files › UserDefaults is for preferences](#/persistence/userdefaults-is-for-preferences)
- [Performance › Memory, and what never goes away](#/performance/memory-and-what-never-goes-away)
- [Reference › Collections](#/reference/collections)

#### Hints
- `term.trimmingCharacters(in: .whitespacesAndNewlines)` first, then `guard !trimmed.isEmpty`.
- Remove any existing match with `items.removeAll { $0.lowercased() == trimmed.lowercased() }` before inserting at the front.
- `if items.count > limit { items.removeLast(items.count - limit) }` trims the tail, and a `guard limit > 0` at the top handles the degenerate case.

#### Tips
- Remove-then-insert is much easier to get right than find-and-move, and at this size the cost is irrelevant.
- Taking the new spelling is the friendlier behaviour: the user just typed "OSLO", and showing them "oslo" looks like the app corrected them.
- This list belongs in `UserDefaults` — it is small, it is a preference, and losing it is not a disaster. The cap is what keeps it a preference rather than a database.

#### Docs
- [UserDefaults](https://developer.apple.com/documentation/foundation/userdefaults)
- [Searchable](https://developer.apple.com/documentation/swiftui/view/searchable(text:placement:prompt:)-4dmlq)

### 8. Prefetch, but not all at once

A gallery prefetches the images just off screen. Firing five hundred requests at once is worse than firing none: the network queues, the important ones wait behind the rest, and memory spikes.

`prefetch(_:limit:tracker:)` fetches every id and returns the results **in input order**, with at most `limit` fetches in flight at any moment. The `Tracker` actor is already written and counts how many are running at once, so the tests can check the limit is real.

```swift starter
actor Tracker {
    private(set) var peak = 0
    private var current = 0

    func begin() {
        current += 1
        peak = max(peak, current)
    }

    func end() {
        current -= 1
    }
}

func slowFetch(_ id: Int, tracker: Tracker) async -> String {
    await tracker.begin()
    try? await Task.sleep(for: .milliseconds(30))
    await tracker.end()
    return "item-\(id)"
}

func prefetch(_ ids: [Int], limit: Int, tracker: Tracker) async -> [String] {
    return []
}
```

```swift test
/// results come back in the order they were asked for
func testOrder() async {
    let tracker = Tracker()
    expect(await prefetch([3, 1, 2], limit: 2, tracker: tracker),
           ["item-3", "item-1", "item-2"])
    expect(await prefetch([], limit: 2, tracker: Tracker()), [])
    expect(await prefetch([7], limit: 4, tracker: Tracker()), ["item-7"])
}

/// everything is fetched exactly once
func testAll() async {
    let tracker = Tracker()
    let got = await prefetch(Array(0..<9), limit: 3, tracker: tracker)
    expect(got, (0..<9).map { "item-\($0)" })
}

/// the limit is respected
func testLimit() async {
    let tracker = Tracker()
    _ = await prefetch(Array(0..<9), limit: 3, tracker: tracker)
    let peak = await tracker.peak
    expect(peak <= 3, "at most 3 fetches at once, saw \(peak)")
    expect(peak > 1, "nothing ran concurrently at all, peak was \(peak)")
}

/// a limit larger than the work is not a problem
func testSmallJob() async {
    let tracker = Tracker()
    _ = await prefetch([1, 2], limit: 10, tracker: tracker)
    let peak = await tracker.peak
    expect(peak <= 2, "only two fetches exist, saw \(peak)")
}

/// three waves of three, not nine in a row
func testTiming() async {
    let start = ContinuousClock.now
    _ = await prefetch(Array(0..<9), limit: 3, tracker: Tracker())
    let elapsed = ContinuousClock.now - start
    expect(elapsed < .milliseconds(250),
           "took \(elapsed); nine 30ms fetches in sequence would be about 270ms")
}
```

#### Uses
- [Performance › The main-thread rule](#/performance/the-main-thread-rule)
- [Performance › Images cost more than they look](#/performance/images-cost-more-than-they-look)

#### Hints
- `await withTaskGroup(of: (Int, String).self) { group in ... }` and carry the index alongside each result.
- Start by adding the first `min(limit, ids.count)` tasks. Then, for every result you take out of the group with `for await`, add the next id if there is one.
- Collect into a `[Int: String]` or a pre-sized array, then read it back in index order.
- `limit` needs a floor of 1, or a `limit` of zero adds nothing and the loop never starts.

#### Tips
- "Add one when one finishes" is the whole pattern, and it is the same shape whether the limit is 3 or 300. A `TaskGroup` gives it to you without a semaphore.
- The peak check is what makes this test honest. Without it, `for id in ids { group.addTask { ... } }` — everything at once — passes both the order test and the timing test.
- In a real prefetcher you would also cancel: when the user scrolls away, the tasks for rows that are no longer near the viewport should stop. A task group cancels its children when it is cancelled, which is most of the work.

#### Docs
- [Task groups](https://developer.apple.com/documentation/swift/taskgroup)
- [Concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/)

### 9. A rate limiter that many tasks share

The API allows a burst and then a steady rate. `RateLimiter` is an actor so that a hundred tasks asking at once cannot get more than the bucket holds.

It is a token bucket: it starts full with `capacity` tokens and gains `refillPerSecond` tokens for every second that passes, never exceeding `capacity`. `allow(now:)` takes one token and returns `true` if there was at least one, and returns `false` without taking anything if there was not. Time only ever moves forwards; a `now` earlier than the last one adds nothing.

```swift starter
actor RateLimiter {
    private let capacity: Double
    private let refillPerSecond: Double
    private var tokens: Double
    private var lastRefill: Date

    init(capacity: Int, refillPerSecond: Double, start: Date) {
        self.capacity = Double(capacity)
        self.refillPerSecond = refillPerSecond
        self.tokens = Double(capacity)
        self.lastRefill = start
    }

    func allow(now: Date) -> Bool {
        return true
    }

    func available(now: Date) -> Int {
        return 0
    }
}
```

```swift test
let t0 = Date(timeIntervalSince1970: 1_000)
func at(_ seconds: Double) -> Date { t0.addingTimeInterval(seconds) }

/// the burst, then nothing
func testBurst() async {
    let limiter = RateLimiter(capacity: 3, refillPerSecond: 1, start: t0)
    expect(await limiter.allow(now: t0), true)
    expect(await limiter.allow(now: t0), true)
    expect(await limiter.allow(now: t0), true)
    expect(await limiter.allow(now: t0), false)
    expect(await limiter.available(now: t0), 0)
}

/// tokens come back with time
func testRefill() async {
    let limiter = RateLimiter(capacity: 3, refillPerSecond: 1, start: t0)
    for _ in 0..<3 { _ = await limiter.allow(now: t0) }
    expect(await limiter.allow(now: at(0.5)), false)
    expect(await limiter.allow(now: at(1)), true)
    expect(await limiter.allow(now: at(1)), false)
    expect(await limiter.allow(now: at(3.5)), true)
    expect(await limiter.allow(now: at(3.5)), true)
    expect(await limiter.allow(now: at(3.5)), false)
}

/// the bucket does not overflow
func testCap() async {
    let limiter = RateLimiter(capacity: 3, refillPerSecond: 1, start: t0)
    expect(await limiter.available(now: at(600)), 3)
    for _ in 0..<3 { _ = await limiter.allow(now: at(600)) }
    expect(await limiter.allow(now: at(600)), false)
}

/// a slower refill rate
func testSlowRefill() async {
    let limiter = RateLimiter(capacity: 2, refillPerSecond: 0.5, start: t0)
    expect(await limiter.allow(now: t0), true)
    expect(await limiter.allow(now: t0), true)
    expect(await limiter.allow(now: at(1)), false)
    expect(await limiter.allow(now: at(2)), true)
}

/// a clock that goes backwards adds nothing
func testBackwards() async {
    let limiter = RateLimiter(capacity: 2, refillPerSecond: 1, start: t0)
    _ = await limiter.allow(now: at(10))
    _ = await limiter.allow(now: at(10))
    expect(await limiter.allow(now: t0), false)
    expect(await limiter.allow(now: at(5)), false)
    expect(await limiter.allow(now: at(11)), true)
}

/// two hundred tasks at once still only get the bucket
func testConcurrent() async {
    let limiter = RateLimiter(capacity: 5, refillPerSecond: 0, start: t0)
    let allowed = await withTaskGroup(of: Bool.self) { group -> Int in
        for _ in 0..<200 { group.addTask { await limiter.allow(now: t0) } }
        var count = 0
        for await ok in group {
            if ok { count += 1 }
        }
        return count
    }
    expect(allowed, 5)
}
```

#### Uses
- [Testing › Testing async code](#/testing/testing-async-code)
- [Dependencies & modules › Protocol seams](#/dependencies/protocol-seams)
- [Reference › Concurrency](#/reference/concurrency)

#### Hints
- Write one private `refill(now:)` that both methods call first: `let elapsed = max(0, now.timeIntervalSince(lastRefill))`, add `elapsed * refillPerSecond`, clamp to `capacity`, and set `lastRefill = max(lastRefill, now)`.
- `allow` is then `guard tokens >= 1 else { return false }`, `tokens -= 1`, `return true`.
- `available` is `Int(tokens)`, which rounds down — half a token is not a request.

#### Tips
- The actor is doing real work here: `testConcurrent` fails immediately on a class, because two hundred tasks can all read `tokens` as 5 before any of them writes 4.
- Taking `now` as an argument rather than calling `Date()` is what makes every one of these tests instant and exact. It is the same trick as the injected clock, applied to an actor.
- `max(lastRefill, now)` rather than `lastRefill = now` is what stops a clock that jumps backwards from banking free tokens later.

#### Docs
- [Actors](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/#Actors)
- [Actor](https://developer.apple.com/documentation/swift/actor)

### 10. One bad row should not lose the feed

The server sends a page of trips and one of them has a null where a string should be. Losing the other nineteen because of it is the wrong behaviour.

`decodeFeed` decodes `{"trips": [...]}` and returns the trips that decoded, in order, along with how many were skipped. An element of the wrong shape — a missing field, a wrong type, or something that is not an object — is skipped and counted. JSON that is not an object with a `trips` array throws.

```swift starter
struct Trip: Codable, Equatable {
    let id: String
    let name: String
    let days: Int
}

struct FeedResult: Equatable {
    let trips: [Trip]
    let skipped: Int
}

func decodeFeed(_ json: String) throws -> FeedResult {
    return FeedResult(trips: [], skipped: 0)
}
```

```swift test
let good = """
{"trips": [
  {"id": "1", "name": "Lisbon", "days": 4},
  {"id": "2", "name": "Oslo", "days": 7}
]}
"""

let mixed = """
{"trips": [
  {"id": "1", "name": "Lisbon", "days": 4},
  {"id": "2", "name": null, "days": 7},
  {"id": "3", "days": 2},
  {"id": "4", "name": "Rome", "days": "many"},
  "not even an object",
  {"id": "5", "name": "Kyoto", "days": 3}
]}
"""

/// a clean page
func testGood() {
    expect(try? decodeFeed(good),
           FeedResult(trips: [Trip(id: "1", name: "Lisbon", days: 4),
                              Trip(id: "2", name: "Oslo", days: 7)],
                      skipped: 0))
}

/// the good rows survive
func testMixed() {
    expect(try? decodeFeed(mixed),
           FeedResult(trips: [Trip(id: "1", name: "Lisbon", days: 4),
                              Trip(id: "5", name: "Kyoto", days: 3)],
                      skipped: 4))
}

/// empty is not an error
func testEmpty() {
    expect(try? decodeFeed(#"{"trips": []}"#), FeedResult(trips: [], skipped: 0))
}

/// extra keys are ignored, as usual
func testExtraKeys() {
    expect(try? decodeFeed(#"{"page": 2, "trips": [{"id": "1", "name": "A", "days": 1, "note": "x"}]}"#),
           FeedResult(trips: [Trip(id: "1", name: "A", days: 1)], skipped: 0))
}

/// everything skipped
func testAllBad() {
    expect(try? decodeFeed(#"{"trips": [1, 2, 3]}"#), FeedResult(trips: [], skipped: 3))
}

/// a response that is not a feed at all
func testThrows() {
    expect(try? decodeFeed("not json"), nil)
    expect(try? decodeFeed("{}"), nil)
    expect(try? decodeFeed(#"{"trips": "none"}"#), nil)
    expect(try? decodeFeed("[]"), nil)
}
```

#### Uses
- [SwiftData & files › Codable and the shape of stored JSON](#/persistence/codable-and-the-shape-of-stored-json)
- [Testing › What is worth testing](#/testing/what-is-worth-testing)

#### Hints
- Wrap the element type: `struct Lenient: Decodable { let trip: Trip?; init(from decoder: any Decoder) throws { trip = try? Trip(from: decoder) } }`.
- Because `Lenient` never throws, decoding `[Lenient]` succeeds even when an element is rubbish — and the array decoder keeps its place.
- Decode `struct Page: Decodable { let trips: [Lenient] }`, then `compactMap` the trips and count the `nil`s.
- The count is `page.trips.count - kept.count`.

#### Tips
- `try?` inside `init(from:)` is the whole trick, and it is one of the few places where swallowing an error is right: the caller gets the count, so nothing is silently lost.
- In production you would log what failed rather than only counting it — one skipped row is a curiosity, forty percent skipped is an incident.
- The opposite policy is also defensible: fail the whole page, because partial data is a lie. Which is right depends on the screen, and the only wrong answer is not having decided.

#### Docs
- [Decodable](https://developer.apple.com/documentation/swift/decodable)
- [Encoding and decoding custom types](https://developer.apple.com/documentation/foundation/encoding-and-decoding-custom-types)
