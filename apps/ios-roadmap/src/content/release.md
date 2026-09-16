# Shipping to the App Store

Shipping an iOS app is not `git push`. There is a certificate, a provisioning profile, an archive, an upload, a review by a human, and a release you cannot roll back. The last part is the one that changes how you work: once a version is live, the only way out is forward, through another review. Everything in this module exists because of that.

The good news is that it is all routine once you have done it twice. The parts worth real attention are the ones that decide how much damage a bad build can do: staged rollout, a kill switch, and crash reporting good enough to tell you within an hour that something is wrong.

## Shipping is a process, not a button

The path a build takes:

1. **Archive** a Release build in Xcode (Product → Archive), or `xcodebuild archive` in CI.
2. **Sign** it with a distribution certificate and a matching provisioning profile.
3. **Upload** to App Store Connect, where it is processed and scanned.
4. **TestFlight**: internal testers immediately, external testers after a light review.
5. **Submit** the version for App Review, with the metadata, screenshots and a note for the reviewer.
6. **Release**: immediately, on a date, or manually — and optionally as a phased release over seven days.

Steps 1 to 3 belong in CI as soon as you have done them by hand once. Steps 4 to 6 stay deliberate: they are decisions, not builds.

## Signing and provisioning

Code signing exists so the system can tell that an app is from you and has not been tampered with. Four things are involved, and confusing them is the usual cause of an afternoon lost:

- **Certificate** — proves who you are. Private key in your Keychain, certificate from Apple. Development and Distribution are different certificates.
- **App ID** — your bundle identifier, plus the capabilities it is allowed (push, iCloud, App Groups).
- **Provisioning profile** — ties a certificate, an App ID and (for development and ad-hoc) a list of device IDs. The device checks it at install time.
- **Entitlements** — what the app is actually asking for, compiled in. They must be a subset of what the profile allows, or the install fails.

Let Xcode manage signing automatically for development. For CI, use explicit signing with an App Store Connect API key, so a build does not depend on anyone's Keychain. The failures are legible once you know the vocabulary: "no profile matching" means the App ID or capabilities changed, "certificate not found" means the machine does not have the private key, and "entitlement not permitted" means you enabled a capability in Xcode but not in the portal.

## Versions and build numbers

Two numbers, and people mix them up constantly.

- `CFBundleShortVersionString` — the **marketing version**, like `2.4.0`. This is what users see. Each version you submit must be higher than the last released one.
- `CFBundleVersion` — the **build number**. Unique *within* a version, and it must increase with every upload, because App Store Connect rejects a duplicate immediately. A monotonically increasing integer from CI is the least painful scheme; the CI run number is right there.

So `2.4.0 (312)`, then `2.4.0 (313)` for the build that fixed the typo, then `2.5.0 (314)`. Notice the build number does not reset. Resetting per version is allowed and it makes "which build is this?" ambiguous in crash reports, which is exactly when you need it not to be.

## App Store Connect and TestFlight

App Store Connect holds the metadata (name, subtitle, description, keywords, screenshots), the privacy declarations, the pricing and the builds.

**TestFlight** distributes builds to testers before release. Internal testers — up to 100 members of your team — get a build as soon as it finishes processing, with no review. External testers — up to 10,000 — need a one-time review of the build, which is fast but not instant. Builds expire after 90 days.

Two things are worth being disciplined about. Write real "What to Test" notes: a tester who does not know what changed tests the home screen again. And treat TestFlight feedback as a channel you actually read, including the screenshots testers attach, because that is your only structured pre-release signal.

The **privacy declarations** are not paperwork you can guess at. What data you collect, whether it is linked to the user, whether it is used for tracking — and every third-party SDK contributes to that answer. A new analytics package can change your privacy label, which is one more reason to price dependencies honestly.

## App Review

A human runs your app. Most rejections come from a short list, and all of them are avoidable:

- **Crashes on launch**, usually because the reviewer's account or region hits a path you never ran.
- **A demo account that does not work**, or no account at all for a login-gated app. Provide credentials that work today, and a note explaining anything non-obvious.
- **Incomplete features**: placeholder content, a button that does nothing, "coming soon".
- **Payments outside In-App Purchase** for digital goods.
- **Permission prompts with no explanation** — every `NSCameraUsageDescription` and friend has to say why, in a sentence a user understands.
- **Missing privacy policy**, or an account you can create but cannot delete.

Expedited review exists for genuine emergencies and is granted sparingly. Plan for a day, not an hour, and never ship a release that depends on review finishing by a particular time.

## Phased release

A phased release rolls a new version out to automatic-update users over seven days: roughly 1%, 2%, 5%, 10%, 20%, 50%, 100%. Anyone who goes to the App Store and taps Update still gets it immediately.

You can pause it at any point, and resume, and the whole thing is free. There is no reason not to use it for a normal release. What it buys you is time: at 1% a serious bug shows up in crash reporting before most of your users have seen it.

What it does not buy you is a rollback. Pausing stops the *spread*; the users who already updated keep the version they have. The only fix is a new build, through review, released as fast as you can.

```swift playground
import Foundation

// A phased release over seven days, against an install base that updates automatically.
let percentages = [1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0]
let installBase = 240_000

print("day  share    users     new today")
var previous = 0
for (index, percent) in percentages.enumerated() {
    let reached = Int(Double(installBase) * percent / 100)
    print(String(format: "%3d  %5.0f%%  %8d  %10d", index + 1, percent, reached, reached - previous))
    previous = reached
}

// The question the table answers: how long until enough people have it to trust the crash numbers?
let minimumSessions = 5_000
if let day = percentages.firstIndex(where: { Double(installBase) * $0 / 100 >= Double(minimumSessions) }) {
    print("\n\(minimumSessions) users reached on day \(day + 1) — before that, one crash is noise")
}
```

## Feature flags and the kill switch

Because you cannot roll back, the release you can control is the one where the risky part is behind a flag you own.

A remote flag, read at launch and cached, lets you turn off the new checkout flow without a new build. The rules that make it work: default to the *old* behaviour when the config cannot be fetched, keep the flag readable from one place in the code, and delete the flag once the feature has been on for everyone for a few weeks. A codebase where every feature from the last three years is still behind a flag has a combinatorial explosion of untested states.

This is also how you decouple releasing from launching. Ship the code dark, turn it on when marketing is ready, turn it off when it catches fire.

## Crash reporting and symbolication

A crash report from a device contains addresses, not function names. **Symbolication** turns `0x1045a2f18` into `TripListModel.load() + 142` using the **dSYM** — the debug symbol bundle produced alongside your build.

The mechanics that matter: dSYMs must be kept for every build you ship, and matched to the crash by UUID. If you use bitcode-free standard builds and let Xcode upload symbols, Xcode's Organizer symbolicates for you. Third-party reporters need the dSYM uploaded, which is a CI step that silently stops working the day someone changes the build settings — check that your last release actually has symbols before you need them.

What to watch after a release: the **crash-free session rate** and the **crash-free user rate**. Know the normal number for your app; a release is a comparison against that baseline, not against zero. And give it enough sessions to mean something — at 1% of users, three crashes is not a signal.

Xcode's Organizer also shows hangs, disk writes and energy from real users, and it is free and already collecting. It is the first place to look, and the one most teams forget they have.

## Exercises

### 1. Will App Store Connect take this build?

`review` checks a sequence of uploads in order and says what happens to each. An accepted upload becomes part of the history the later ones are checked against; a rejected one changes nothing.

The rules, checked in this order:

1. The version must be three dot-separated non-negative integers, or `.malformedVersion`.
2. The build number must be at least 1, or `.buildNotPositive`.
3. The version must not be lower than the highest version accepted so far, or `.versionWentBackwards(highest:)` carrying that version.
4. For a version that has been accepted before, the build must be strictly higher than the highest build already accepted *for that version*, or `.buildNotHigher(highest:)`.

Versions compare numerically per component, so `1.10.0` is higher than `1.9.0`.

```swift starter
struct Upload {
    let version: String
    let build: Int
}

enum Rejection: Equatable {
    case malformedVersion
    case buildNotPositive
    case versionWentBackwards(highest: String)
    case buildNotHigher(highest: Int)
}

enum UploadResult: Equatable {
    case accepted
    case rejected(Rejection)
}

func review(_ uploads: [Upload]) -> [UploadResult] {
    return uploads.map { _ in .accepted }
}
```

```swift test
/// a normal release train
func testTrain() {
    let uploads = [
        Upload(version: "2.4.0", build: 312),
        Upload(version: "2.4.0", build: 313),
        Upload(version: "2.5.0", build: 314),
    ]
    expect(review(uploads), [.accepted, .accepted, .accepted])
}

/// the same build twice
func testDuplicateBuild() {
    let uploads = [
        Upload(version: "2.4.0", build: 312),
        Upload(version: "2.4.0", build: 312),
        Upload(version: "2.4.0", build: 311),
        Upload(version: "2.4.0", build: 313),
    ]
    expect(review(uploads), [.accepted,
                             .rejected(.buildNotHigher(highest: 312)),
                             .rejected(.buildNotHigher(highest: 312)),
                             .accepted])
}

/// versions only go forwards
func testVersionsGoForwards() {
    let uploads = [
        Upload(version: "2.5.0", build: 1),
        Upload(version: "2.4.9", build: 2),
        Upload(version: "2.5.0", build: 2),
        Upload(version: "2.10.0", build: 3),
        Upload(version: "2.9.0", build: 4),
    ]
    expect(review(uploads), [.accepted,
                             .rejected(.versionWentBackwards(highest: "2.5.0")),
                             .accepted,
                             .accepted,
                             .rejected(.versionWentBackwards(highest: "2.10.0"))])
}

/// a new version starts its build numbering wherever it likes
func testNewVersionResets() {
    let uploads = [
        Upload(version: "1.0.0", build: 500),
        Upload(version: "1.1.0", build: 1),
        Upload(version: "1.1.0", build: 1),
    ]
    expect(review(uploads), [.accepted, .accepted,
                             .rejected(.buildNotHigher(highest: 1))])
}

/// rubbish in the version field
func testMalformed() {
    let uploads = [
        Upload(version: "2.4", build: 1),
        Upload(version: "v2.4.0", build: 1),
        Upload(version: "2.4.0-rc1", build: 1),
        Upload(version: "", build: 1),
    ]
    expect(review(uploads), [.rejected(.malformedVersion), .rejected(.malformedVersion),
                             .rejected(.malformedVersion), .rejected(.malformedVersion)])
}

/// build numbers start at one, and a rejection leaves no trace
func testBuildNumbers() {
    let uploads = [
        Upload(version: "1.0.0", build: 0),
        Upload(version: "1.0.0", build: -3),
        Upload(version: "bad", build: 0),
        Upload(version: "1.0.0", build: 1),
    ]
    expect(review(uploads), [.rejected(.buildNotPositive), .rejected(.buildNotPositive),
                             .rejected(.malformedVersion), .accepted])
}

/// nothing to review
func testEmpty() {
    expect(review([]), [])
}
```

#### Uses
- [Shipping to the App Store › Versions and build numbers](#/release/versions-and-build-numbers)
- [Shipping to the App Store › App Store Connect and TestFlight](#/release/app-store-connect-and-testflight)

#### Hints
- Split the version on `"."` and map each field through `Int.init`; it is malformed unless there are exactly three fields and all three are numbers that are not negative.
- Turn those three numbers into a tuple `(Int, Int, Int)`. Tuples of `Comparable` values compare lexicographically, so `(2, 10, 0) > (2, 9, 0)` is the comparison you want — an `[Int]` would not compile, because `Array` is not `Comparable`.
- Keep two pieces of state as you walk the uploads: the highest accepted version, and a `[String: Int]` from version string to the highest build accepted for it.
- Check the rules in the order the description gives, and only update the state when you accept.

#### Tips
- The order of the checks is part of the specification, because an upload can break more than one rule at a time. `testBuildNumbers` has a build of 0 *and* an unparseable version, and only one answer is right.
- Comparing the components numerically is why `1.10.0 > 1.9.0` works. Comparing the strings gives the opposite answer, and that is a real bug that has shipped in real release scripts.
- App Store Connect really does enforce this, and it will tell you at the end of a ten-minute upload. A one-line CI check before the upload is worth writing.

#### Docs
- [Setting the version number and build string](https://developer.apple.com/documentation/xcode/setting-the-version-number-and-build-string)
- [Uploading builds to App Store Connect](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)

### 2. Who is in the rollout

A staged rollout needs to decide, on the device, whether this user is in the new cohort — with no server call, the same answer every launch, and a cohort that only grows as the percentage does.

`bucket(_:)` maps a user id to a number in `0..<100`, using a hash that does not change between launches. `isEnabled(for:percent:)` is `true` when the user's bucket is below `percent`. At 0 nobody is in; at 100 everybody is.

```swift starter
func bucket(_ userID: String) -> Int {
    return 0
}

func isEnabled(for userID: String, percent: Int) -> Bool {
    return false
}
```

```swift test
let ids = (0..<2_000).map { "user-\($0)" }

/// buckets are in range and stable
func testBucketRange() {
    for id in ids.prefix(200) {
        let b = bucket(id)
        expect(b >= 0 && b < 100, "bucket for \(id) was \(b)")
    }
    expect(bucket("user-1"), bucket("user-1"))
    expect(bucket(""), bucket(""))
}

/// the extremes
func testExtremes() {
    for id in ids.prefix(100) {
        expect(isEnabled(for: id, percent: 0), false)
        expect(isEnabled(for: id, percent: 100), true)
    }
}

/// the same user gets the same answer every time
func testDeterministic() {
    let answers = ids.prefix(50).map { isEnabled(for: $0, percent: 25) }
    for _ in 0..<5 {
        expect(ids.prefix(50).map { isEnabled(for: $0, percent: 25) }, Array(answers))
    }
}

/// the cohort only grows
func testMonotonic() {
    for id in ids.prefix(300) {
        for percent in stride(from: 0, through: 90, by: 10) {
            if isEnabled(for: id, percent: percent) {
                expect(isEnabled(for: id, percent: percent + 10),
                       "\(id) was in at \(percent)% but not at \(percent + 10)%")
            }
        }
    }
}

/// roughly the share you asked for
func testDistribution() {
    for percent in [10, 50, 90] {
        let count = ids.filter { isEnabled(for: $0, percent: percent) }.count
        let share = Double(count) / Double(ids.count) * 100
        expect(abs(share - Double(percent)) < 6,
               "\(percent)% rollout reached \(String(format: "%.1f", share))% of users")
    }
}

/// different ids land in different buckets
func testSpread() {
    let buckets = Set(ids.prefix(500).map { bucket($0) })
    expect(buckets.count > 50, "500 ids only produced \(buckets.count) distinct buckets")
}
```

#### Uses
- [Shipping to the App Store › Phased release](#/release/phased-release)
- [Shipping to the App Store › Feature flags and the kill switch](#/release/feature-flags-and-the-kill-switch)

#### Hints
- FNV-1a is six lines and stable: start from `1469598103934665603`, then for each byte of `userID.utf8`, XOR it in and multiply by `1099511628211`. Use `&*` and `&^`-free plain `^` so the multiply wraps instead of trapping.
- `Int(hash % 100)` on a `UInt64` gives you the bucket without any sign trouble.
- `isEnabled` is then `bucket(userID) < percent`, which gives you the monotonic property for free.

#### Tips
- `hashValue` and `Hasher` are seeded randomly per process in Swift. They are excellent for dictionaries and useless here: the same user would be in the cohort on one launch and out on the next.
- `bucket(userID) < percent` is what makes the cohort grow rather than shuffle. Anything that re-randomises per percentage would move users *out* of the new feature as you rolled it further out, which is the worst possible bug to debug.
- Real rollouts hash the user id *and* the flag name together, so two 10% experiments do not land on the same 10% of users. That is one more component in the same hash.

#### Docs
- [Releasing an app in phases](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases)
- [Remote configuration and feature flags](https://developer.apple.com/documentation/foundation/userdefaults)

### 3. Is this release healthy?

After a release goes out you watch the crash-free session rate and compare it against the baseline you had before. `verdict` turns the numbers into one of three decisions.

With fewer than `minimumSessions` sessions there is not enough evidence: `.wait`. Otherwise compute the crash-free rate as a percentage for the new version and for the baseline. If the new rate has dropped by more than 1.0 percentage point, `.halt`. If it has dropped by more than 0.2, `.pause`. Otherwise `.proceed`. A version with no crashes at all in enough sessions always proceeds.

```swift starter
struct Health {
    let sessions: Int
    let crashes: Int
}

enum Verdict: Equatable {
    case wait
    case proceed
    case pause
    case halt
}

func crashFreeRate(_ health: Health) -> Double {
    return 0
}

func verdict(new: Health, baseline: Health, minimumSessions: Int) -> Verdict {
    return .proceed
}
```

```swift test
func close(_ got: Double, _ want: Double) {
    expect(abs(got - want) < 0.0001, "expected \(want), got \(got)")
}

/// the rate itself
func testRate() {
    close(crashFreeRate(Health(sessions: 1_000, crashes: 0)), 100)
    close(crashFreeRate(Health(sessions: 1_000, crashes: 10)), 99)
    close(crashFreeRate(Health(sessions: 200, crashes: 1)), 99.5)
    close(crashFreeRate(Health(sessions: 0, crashes: 0)), 100)
}

/// not enough data yet
func testWait() {
    let baseline = Health(sessions: 100_000, crashes: 200)
    expect(verdict(new: Health(sessions: 10, crashes: 5), baseline: baseline, minimumSessions: 5_000), .wait)
    expect(verdict(new: Health(sessions: 4_999, crashes: 0), baseline: baseline, minimumSessions: 5_000), .wait)
    expect(verdict(new: Health(sessions: 0, crashes: 0), baseline: baseline, minimumSessions: 1), .wait)
}

/// as healthy as before, or healthier
func testProceed() {
    let baseline = Health(sessions: 100_000, crashes: 500)   // 99.5%
    expect(verdict(new: Health(sessions: 10_000, crashes: 50), baseline: baseline, minimumSessions: 5_000), .proceed)
    expect(verdict(new: Health(sessions: 10_000, crashes: 0), baseline: baseline, minimumSessions: 5_000), .proceed)
    expect(verdict(new: Health(sessions: 10_000, crashes: 69), baseline: baseline, minimumSessions: 5_000), .proceed)
}

/// a small regression is worth pausing for
func testPause() {
    let baseline = Health(sessions: 100_000, crashes: 500)   // 99.5%
    expect(verdict(new: Health(sessions: 10_000, crashes: 80), baseline: baseline, minimumSessions: 5_000), .pause)
    expect(verdict(new: Health(sessions: 10_000, crashes: 140), baseline: baseline, minimumSessions: 5_000), .pause)
}

/// a big one means stop
func testHalt() {
    let baseline = Health(sessions: 100_000, crashes: 500)   // 99.5%
    expect(verdict(new: Health(sessions: 10_000, crashes: 200), baseline: baseline, minimumSessions: 5_000), .halt)
    expect(verdict(new: Health(sessions: 50_000, crashes: 5_000), baseline: baseline, minimumSessions: 5_000), .halt)
}

/// a shaky baseline moves the bar, it does not remove it
func testShakyBaseline() {
    let baseline = Health(sessions: 100_000, crashes: 5_000) // 95%
    expect(verdict(new: Health(sessions: 10_000, crashes: 500), baseline: baseline, minimumSessions: 5_000), .proceed)
    expect(verdict(new: Health(sessions: 10_000, crashes: 590), baseline: baseline, minimumSessions: 5_000), .pause)
    expect(verdict(new: Health(sessions: 10_000, crashes: 700), baseline: baseline, minimumSessions: 5_000), .halt)
}
```

#### Uses
- [Shipping to the App Store › Crash reporting and symbolication](#/release/crash-reporting-and-symbolication)
- [Shipping to the App Store › Phased release](#/release/phased-release)

#### Hints
- `crashFreeRate` is `(1 - crashes/sessions) * 100`, with zero sessions treated as 100 so it never divides by zero.
- The drop is `crashFreeRate(baseline) - crashFreeRate(new)`; a negative drop means the new build is better.
- Check `.wait` first, then `.halt`, then `.pause`, then `.proceed` — the order is the priority.

#### Tips
- Comparing against the baseline rather than against 100% is the whole point. An app that normally sits at 99.5% and is now at 99.4% is fine; one that was at 99.98% and is now at 99.4% has a serious new bug, and an absolute threshold would treat those the same.
- The minimum sample size is not bureaucracy. At 1% rollout early on, a handful of sessions on one broken device can look like a catastrophic regression.
- These thresholds are a starting point. Pick yours from your own history — the number that would have caught the last bad release and would not have stopped the last five good ones.

#### Docs
- [Diagnosing issues with the Xcode Organizer](https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs)
- [Analyzing crash reports](https://developer.apple.com/documentation/xcode/analyzing-a-crash-report)

### 4. Symbolicate an address

A crash report has an address; the dSYM has a table of symbols. `symbolicate` finds the symbol that contains the address and formats it the way a crash report does.

Each `Symbol` starts at `address` and covers `size` bytes, so it contains everything from `address` up to but not including `address + size`. The table arrives in no particular order. An address inside a symbol gives `"name + offset"`, and an offset of zero still prints `"name + 0"`. An address before the first symbol, past the last, or in a gap between two, gives `nil`.

```swift starter
struct Symbol {
    let name: String
    let address: Int
    let size: Int
}

func symbolicate(_ address: Int, in table: [Symbol]) -> String? {
    return nil
}
```

```swift test
let table = [
    Symbol(name: "TripListModel.load()", address: 0x2000, size: 0x100),
    Symbol(name: "main", address: 0x1000, size: 0x40),
    Symbol(name: "TripStore.save(_:)", address: 0x3000, size: 0x80),
]

/// inside a symbol
func testInside() {
    expect(symbolicate(0x2000, in: table), "TripListModel.load() + 0")
    expect(symbolicate(0x2042, in: table), "TripListModel.load() + 66")
    expect(symbolicate(0x20FF, in: table), "TripListModel.load() + 255")
    expect(symbolicate(0x1000, in: table), "main + 0")
    expect(symbolicate(0x3001, in: table), "TripStore.save(_:) + 1")
}

/// the byte after a symbol belongs to nobody
func testBoundaries() {
    expect(symbolicate(0x1040, in: table), nil)
    expect(symbolicate(0x2100, in: table), nil)
    expect(symbolicate(0x3080, in: table), nil)
    expect(symbolicate(0x307F, in: table), "TripStore.save(_:) + 127")
}

/// outside the image entirely
func testOutside() {
    expect(symbolicate(0x0, in: table), nil)
    expect(symbolicate(0xFFF, in: table), nil)
    expect(symbolicate(0x9999, in: table), nil)
    expect(symbolicate(0x2000, in: []), nil)
}

/// symbols that touch, with no gap
func testAdjacent() {
    let packed = [
        Symbol(name: "b", address: 16, size: 16),
        Symbol(name: "a", address: 0, size: 16),
        Symbol(name: "c", address: 32, size: 1),
    ]
    expect(symbolicate(15, in: packed), "a + 15")
    expect(symbolicate(16, in: packed), "b + 0")
    expect(symbolicate(32, in: packed), "c + 0")
    expect(symbolicate(33, in: packed), nil)
}

/// a zero-sized symbol contains nothing
func testZeroSized() {
    let odd = [Symbol(name: "stub", address: 100, size: 0),
               Symbol(name: "real", address: 100, size: 8)]
    expect(symbolicate(100, in: odd), "real + 0")
    expect(symbolicate(107, in: odd), "real + 7")
    expect(symbolicate(108, in: odd), nil)
}
```

#### Uses
- [Shipping to the App Store › Crash reporting and symbolication](#/release/crash-reporting-and-symbolication)
- [Shipping to the App Store › Shipping is a process, not a button](#/release/shipping-is-a-process-not-a-button)

#### Hints
- `table.first { address >= $0.address && address < $0.address + $0.size }` is the whole search.
- The offset is `address - symbol.address`, and the string is `"\(symbol.name) + \(offset)"`.
- A symbol with `size` of 0 can never satisfy `address < $0.address + 0`, so the rule handles it with no special case.

#### Tips
- Half-open ranges — start included, end excluded — are what make adjacent symbols work without an off-by-one. `0x1000..<0x1040` and `0x1040..<0x1080` tile perfectly; two closed ranges would both claim `0x1040`.
- A linear scan is fine for a test and wrong for a real symbolicator, which has hundreds of thousands of symbols per image and sorts once, then binary searches. The interesting part is the same either way.
- Real symbolication also has to subtract the image's load address, because ASLR moves the image on every launch. The crash report records the slide so the subtraction is possible — which is why a report without its `Binary Images` section cannot be symbolicated at all.

#### Docs
- [Adding identifiable symbol names to a crash report](https://developer.apple.com/documentation/xcode/adding-identifiable-symbol-names-to-a-crash-report)
- [Interpreting a crash report](https://developer.apple.com/documentation/xcode/interpreting-the-json-format-of-a-crash-report)

### 5. Take it all the way to TestFlight

Get a real build signed, uploaded and into a tester's hands, and set the release up so a bad version can be stopped.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- An App ID and an app record in App Store Connect matching your bundle identifier exactly.
- The marketing version set in the target's settings and the build number wired to something that always increases — a CI run number, or an `agvtool`/build-phase bump. Two uploads in a row must not need a manual edit.
- A Release archive (Product → Archive) that validates cleanly, distributed to App Store Connect. Note how long processing takes; it is not instant.
- The build available to at least one internal TestFlight tester, with real **What to Test** notes describing what changed and what to look at.
- The version submitted for review with: screenshots at the required sizes, an accurate privacy declaration covering every SDK, and — if anything is behind a login — a working demo account plus a reviewer note.
- **Phased release** turned on for the version, and the page in App Store Connect where you would pause it located *before* you need it.
- The dSYM for the uploaded build archived somewhere you can find it in six months, and a crash from a TestFlight build symbolicated in the Xcode Organizer to prove the chain works.

```swift solution
// ExportOptions.plist — what `xcodebuild -exportArchive` needs for an App Store upload.
// Keep it in the repo; passing these as flags is how CI builds drift from local ones.

<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>ABCDE12345</string>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>manual</string>
    <key>destination</key>
    <string>upload</string>
</dict>
</plist>

// The two commands, with an App Store Connect API key so nothing depends on a Keychain.

xcodebuild archive \
  -project Trips.xcodeproj \
  -scheme Trips \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/Trips.xcarchive \
  CURRENT_PROJECT_VERSION=$CI_RUN_NUMBER \
  -allowProvisioningUpdates

xcodebuild -exportArchive \
  -archivePath build/Trips.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist \
  -authenticationKeyPath "$HOME/private_keys/AuthKey_$KEY_ID.p8" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID"

// Keep the symbols. This is the part people discover is broken during an incident.
cp -R build/Trips.xcarchive/dSYMs artifacts/dSYMs-$CI_RUN_NUMBER
```

#### Uses
- [Shipping to the App Store › Signing and provisioning](#/release/signing-and-provisioning)
- [Shipping to the App Store › App Store Connect and TestFlight](#/release/app-store-connect-and-testflight)
- [Shipping to the App Store › App Review](#/release/app-review)
- [Shipping to the App Store › Phased release](#/release/phased-release)

#### Hints
- Xcode's Organizer window (Window → Organizer) is where archives live; Distribute App walks the same path the command line takes.
- `CURRENT_PROJECT_VERSION` is the build setting behind `CFBundleVersion`, so passing it on the command line is enough to bump a build from CI.
- If validation fails on missing icons or an invalid entitlement, fix it in the project rather than in the export step — the archive is what gets shipped.

#### Tips
- Do the whole path by hand once, slowly, before automating it. Automating a process you have not performed produces CI that fails in ways you cannot read.
- The reviewer note is free and it works. "The camera screen needs a QR code; here is one to scan: [link]" removes an entire class of rejection.
- Turn phased release on by default and find the pause button while nothing is wrong. During an incident, the last thing you want to be doing is learning a console.

#### Docs
- [Distributing your app for beta testing and releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [TestFlight](https://developer.apple.com/testflight/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Uploading symbols for your app](https://developer.apple.com/documentation/xcode/building-your-app-to-include-debugging-information)
