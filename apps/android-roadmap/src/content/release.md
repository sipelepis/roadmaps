# Shipping to Play

Releasing is the part of Android nobody teaches and everybody has to do. It is not one step but a chain: a build that is signed with the right key, shrunk by R8, versioned so that Play will accept it, uploaded to a track, handed to a small fraction of users first, and watched closely enough that you find out about a crash before your users tell you about it. Each link has a way of going wrong that is expensive and slow to undo, which is why this module is mostly rules rather than code.

## What a release actually is

An **Android App Bundle** (`.aab`), not an APK. You upload one bundle; Play generates the APKs each device actually needs — the right screen density, the right ABI, the right language — and signs them for you. Apps on Play have had to ship bundles since 2021, and the size saving over a universal APK is typically 15% or more.

The thing you build is therefore not the thing anybody installs. That gap is where two of the three classic release problems live: signing, and the fact that the code on the device has been through R8.

## Signing

Every APK that reaches a device is signed, and Android will only install an update signed by the same key as the version already there. Lose the key and you cannot update your app — ever, for that package name.

**Play App Signing** makes this survivable and you should use it. Play holds the *app signing key* and signs every APK it generates. You hold an *upload key*, which is the one you sign your bundle with, and which only proves to Play that the upload is from you. Lose the upload key and support can reset it; lose the app signing key and, if Play holds it, nothing happens at all.

```sh
keytool -genkeypair -v -keystore upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias upload
```

Keep the keystore out of the repository, keep the passwords out of the repository, and give CI both through secrets. A `keystore.properties` file in `.gitignore`, read from `build.gradle.kts`, is the usual arrangement — and a `signingConfig` with a hardcoded password is the usual leak.

## R8, shrinking and the mapping file

R8 does three things to your release build: **shrinks** (removes unreachable classes and methods), **optimises** (inlines, folds constants, removes dead branches), and **obfuscates** (renames what is left to `a`, `b`, `c`). `isShrinkResources = true` additionally drops unreferenced resources.

```kotlin
buildTypes {
    release {
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
}
```

What breaks is anything found by name rather than by reference: reflection, JSON deserialisation into a data class, a class named in the manifest or in XML, a JNI entry point. The symptom is a crash that only happens in release, usually `ClassNotFoundException` or a data class whose fields are all null. The fix is a `-keep` rule as narrow as you can make it. Most libraries ship their own rules through `consumerProguardFiles`, so you often need fewer than you fear.

The **mapping file** — `app/build/outputs/mapping/release/mapping.txt` — is what turns `a.b.c(SourceFile:1)` back into your class names. Upload it with the bundle (the Play Console does this automatically for bundles built by Gradle) and archive it per release. Without it a stack trace from production is unreadable, and mapping files are per build: rebuilding gives you a different one.

**Always install and run a release build before you ship it.** A smoke test of the shrunk, signed artifact catches the R8 problems that no debug build ever will.

## Build variants

Two axes. **Build types** are how it is built — `debug`, `release`, and often a `benchmark` type that is release-like but profileable. **Product flavours** are what is built — free and paid, or one per white-label customer.

```kotlin
buildTypes {
    debug {
        applicationIdSuffix = ".debug"
        versionNameSuffix = "-debug"
    }
    release {
        isMinifyEnabled = true
    }
}
```

`applicationIdSuffix` on debug is a small thing with a large payoff: the debug and release builds become different apps, so they install side by side and you can compare them on one device.

Point variants at different servers with `buildConfigField` or a resource per source set, never with a boolean that reads `BuildConfig.DEBUG` at runtime. The first is checked at build time and shrunk away; the second ships your staging URL to production.

## Versioning

Two numbers, and they do different jobs.

- `versionCode` — an integer. Play uses it and only it to decide what is newer. It must strictly increase; you cannot upload a bundle whose code is not higher than the highest you have ever uploaded to that track, and you can never reuse one, even for a build you rolled back.
- `versionName` — a string for humans. `"2.4.1"`. Play shows it, nothing depends on it.

Pick a scheme and encode it. `major * 10000 + minor * 100 + patch` turns `2.4.1` into `20401`, sorts correctly, stays readable, and leaves room for 99 of each. Deriving the code from the name means you cannot forget to bump it, and it makes "which build is this crash from" answerable.

Whatever you choose, the code must never go backwards. If you ship `20401` and then need an urgent fix, the fix is `20402`, not a rebuild of `20401`.

## The Play Console

Tracks, from the inside out. A build can be promoted along this chain without rebuilding.

1. **Internal testing** — up to 100 testers, available within minutes, no review wait to speak of. This is where every build should land first.
2. **Closed testing** — a named list or a Google Group. Where a beta programme lives.
3. **Open testing** — anyone who opts in from your store listing.
4. **Production** — everybody.

Production releases go through review, which takes hours to days and is longer for a new app or a sensitive permission. Plan for it; a hotfix is not instant.

Before the first production release you also need the things that have nothing to do with code: a store listing with screenshots, a privacy policy URL, the Data safety form, a content rating questionnaire, and a target SDK level that meets Play's current requirement — which rises every year and will block uploads when you miss it.

## Staged rollouts

Never give a new version to everyone at once. A **staged rollout** releases to a percentage of users, chosen by Play, sticky per device; the rest stay on the previous version until you raise the percentage.

A reasonable ladder is 1%, 5%, 10%, 20%, 50%, 100%, with at least a day between rungs and longer over a weekend. The percentages matter less than the discipline: at every rung you look at the numbers before you raise it.

Two escapes, and they are not the same. **Halting** a rollout stops new users getting the version; everyone who already has it keeps it. There is no un-shipping. Your only real fix is a new version with a higher `versionCode`, which is why the release checklist ends with "can we build and ship a fix in under two hours", not with "we are confident".

Because a rollout is sticky, the percentage is of users, not of sessions, and a 1% rollout on a small app can take a day to produce enough data to mean anything.

## Watching the release

**Android vitals** in the Play Console is the number that matters, because it is the one Play ranks you on: crash rate and ANR rate, measured per user, compared against a bad-behaviour threshold. Exceeding it demotes you in search and can get the app flagged.

**Crashlytics** or **Play's crash reporting** gives you the stack traces, grouped, with the version and device attached. Watch three things at each rung of a rollout:

- **Crash-free sessions or users** — as a rate, against the previous version, not against an absolute ideal. A drop from 99.8% to 99.4% is a serious regression even though both look fine.
- **New issues** — a crash that only exists in this version is worth more attention than a bigger one you have had for months.
- **Sample size** — a 100% crash rate over three sessions is noise. Decide in advance how many sessions you need before a number is allowed to make a decision.

And set the threshold before the rollout, not during it. In the middle of a release, every number looks acceptable if you squint.

```kotlin playground
// Everything a release decision needs, as arithmetic.
val STEPS = listOf(1, 5, 10, 20, 50, 100)

data class Version(val major: Int, val minor: Int, val patch: Int)

fun versionCode(v: Version) = v.major * 10000 + v.minor * 100 + v.patch

fun versionName(v: Version) = "${v.major}.${v.minor}.${v.patch}"

fun nextStep(currentPercent: Int): Int? = STEPS.firstOrNull { it > currentPercent }

fun crashFreeRate(sessions: Int, crashed: Int): Double =
    if (sessions == 0) 1.0 else (sessions - crashed).toDouble() / sessions

fun main() {
    listOf(Version(1, 0, 0), Version(1, 0, 9), Version(1, 10, 0), Version(2, 0, 0)).forEach {
        println("${versionName(it).padEnd(8)} -> ${versionCode(it)}")
    }

    val ladder = generateSequence(nextStep(0)) { nextStep(it) }.toList()
    println("rollout ladder: ${ladder.joinToString(" -> ") { "$it%" }}")

    val installBase = 250_000
    ladder.forEach { println("  $it%: about ${installBase.toLong() * it / 100} users") }

    println("100 sessions, 1 crash:      %.4f".format(crashFreeRate(100, 1)))
    println("50000 sessions, 120 crashes: %.4f".format(crashFreeRate(50_000, 120)))
    println("no sessions yet:             %.4f".format(crashFreeRate(0, 0)))
}
```

## Exercises

### 1. A version code you cannot get wrong

Derive both version numbers from one source so that bumping the name bumps the code.

`versionCode(version)` is `major * 10000 + minor * 100 + patch`. Every part must be in `0..99`, otherwise throw `IllegalArgumentException` with the message `"every version part must be 0..99"`. `versionName(version)` is the three parts joined by dots.

`parseVersionName(name)` is the inverse: exactly three dot-separated parts, each a number in `0..99`, or `null` for anything else — the wrong number of parts, something that is not a number, a negative, a part over 99.

```kotlin starter
data class Version(val major: Int, val minor: Int, val patch: Int)

fun versionCode(version: Version): Int = 1

fun versionName(version: Version): String = ""

fun parseVersionName(name: String): Version? = null
```

```kotlin test
class VersionTest {
    // the code packs the three parts, and sorts the way the name reads
    @Test
    fun codes() {
        assertEquals(10000, versionCode(Version(1, 0, 0)))
        assertEquals(20401, versionCode(Version(2, 4, 1)))
        assertEquals(11000, versionCode(Version(1, 10, 0)))
        assertEquals(0, versionCode(Version(0, 0, 0)))
        assertEquals(999999, versionCode(Version(99, 99, 99)))
    }

    // a newer version always has a bigger code
    @Test
    fun increasing() {
        val releases = listOf(
            Version(1, 0, 0), Version(1, 0, 1), Version(1, 0, 9), Version(1, 1, 0),
            Version(1, 10, 0), Version(2, 0, 0), Version(2, 0, 1),
        )
        val codes = releases.map(::versionCode)
        assertEquals(codes.sorted(), codes)
        assertEquals(releases.size, codes.distinct().size)
    }

    // names read the way people write them
    @Test
    fun names() {
        assertEquals("2.4.1", versionName(Version(2, 4, 1)))
        assertEquals("0.0.0", versionName(Version(0, 0, 0)))
        assertEquals(Version(2, 4, 1), parseVersionName("2.4.1"))
        assertEquals(Version(0, 10, 99), parseVersionName("0.10.99"))
    }

    // anything that is not three small numbers is not a version
    @Test
    fun rejected() {
        assertNull(parseVersionName("2.4"))
        assertNull(parseVersionName("2.4.1.7"))
        assertNull(parseVersionName("2.4.x"))
        assertNull(parseVersionName(""))
        assertNull(parseVersionName("2.-4.1"))
        assertNull(parseVersionName("2.4.100"))

        var message: String? = null
        try {
            versionCode(Version(1, 100, 0))
        } catch (e: IllegalArgumentException) {
            message = e.message
        }
        assertEquals("every version part must be 0..99", message)
    }
}
```

#### Uses
- [Shipping to Play › Versioning](#/release/versioning)
- [Shipping to Play › Build variants](#/release/build-variants)

#### Hints
- `require(listOf(major, minor, patch).all { it in 0..99 }) { "every version part must be 0..99" }` covers the validation in one line.
- `name.split(".")` then check `size == 3`; `toIntOrNull()` turns a bad part into `null` without throwing.
- `mapNotNull { it.toIntOrNull() }` followed by a size check is a neat way to reject a part that did not parse.

#### Tips
- The reason the multipliers are 10000 and 100 rather than 1000 and 10 is room: two digits per part means 99 patches before you have to think about it.
- Some teams append a build number or an ABI offset to the code. Play's only requirement is that it strictly increases, and `Int.MAX_VALUE` is 2,100,000,000, so there is plenty of space — but a code you cannot read is a code you will misread during an incident.
- Reading the version name from one place and computing the code from it means the two can never disagree, which is worth more than any clever scheme.

#### Docs
- [Version your app](https://developer.android.com/studio/publish/versioning)
- [Configure build variants](https://developer.android.com/build/build-variants)

### 2. The rollout ladder

A staged rollout climbs a fixed set of percentages. Write the arithmetic.

`nextStep(percent)` is the smallest step strictly greater than `percent`, or `null` when there is none. `remainingSteps(percent)` is every step still ahead, in order. `usersAt(percent, installBase)` is how many people that rung reaches, rounded down. A percentage outside `0..100` throws `IllegalArgumentException` with the message `"percent must be 0..100"`; a negative install base throws one with the message `"installBase must not be negative"`.

```kotlin starter
val STEPS = listOf(1, 5, 10, 20, 50, 100)

fun nextStep(percent: Int): Int? = 100

fun remainingSteps(percent: Int): List<Int> = STEPS

fun usersAt(percent: Int, installBase: Int): Int = installBase
```

```kotlin test
class RolloutTest {
    // one rung at a time
    @Test
    fun climbing() {
        assertEquals(1, nextStep(0))
        assertEquals(5, nextStep(1))
        assertEquals(10, nextStep(5))
        assertEquals(50, nextStep(20))
        assertEquals(100, nextStep(50))
        assertNull(nextStep(100))
    }

    // a percentage that is not a rung still advances sensibly
    @Test
    fun offLadder() {
        assertEquals(10, nextStep(7))
        assertEquals(100, nextStep(99))
        assertEquals(listOf(20, 50, 100), remainingSteps(11))
        assertEquals(STEPS, remainingSteps(0))
        assertEquals(emptyList<Int>(), remainingSteps(100))
    }

    // how many people that is
    @Test
    fun reach() {
        assertEquals(2500, usersAt(1, 250_000))
        assertEquals(125_000, usersAt(50, 250_000))
        assertEquals(250_000, usersAt(100, 250_000))
        assertEquals(0, usersAt(0, 250_000))
        assertEquals(9, usersAt(1, 999))
        assertEquals(0, usersAt(5, 0))
    }

    // nonsense in, exception out
    @Test
    fun rejected() {
        val messages = mutableListOf<String?>()
        for (call in listOf({ nextStep(101) }, { remainingSteps(-1) }, { usersAt(200, 10) })) {
            try {
                call()
            } catch (e: IllegalArgumentException) {
                messages.add(e.message)
            }
        }
        assertEquals(List(3) { "percent must be 0..100" }, messages)

        var negative: String? = null
        try {
            usersAt(10, -1)
        } catch (e: IllegalArgumentException) {
            negative = e.message
        }
        assertEquals("installBase must not be negative", negative)
    }
}
```

#### Uses
- [Shipping to Play › Staged rollouts](#/release/staged-rollouts)
- [Shipping to Play › The Play Console](#/release/the-play-console)

#### Hints
- `STEPS.firstOrNull { it > percent }` is the whole of `nextStep`, and `STEPS.filter { it > percent }` is the whole of `remainingSteps`.
- Validate first in all three, with `require(percent in 0..100) { "percent must be 0..100" }`.
- `installBase.toLong() * percent / 100` avoids overflow on a large base; integer division already rounds down.

#### Tips
- The `9` in `usersAt(1, 999)` is the point of rounding down: promising 1% and reaching 10 people is worse than reaching 9.
- Play picks who is in the rollout and keeps them there. You cannot choose the users, and a device that has the new version does not go back when you halt.
- The ladder is arbitrary; the pause between rungs is not. A crash that only affects one manufacturer needs a day of traffic to show up.

#### Docs
- [Prepare and roll out a release](https://developer.android.com/studio/publish)
- [Upload your app bundle](https://developer.android.com/studio/publish/upload-bundle)

### 3. Should this rollout continue?

Turn the release meeting into a function. Given where the rollout is and what the numbers say, decide.

`crashFreeRate(sessions, crashed)` is the fraction of sessions that did not crash, and is `1.0` when there are no sessions at all.

`decide(percent, sessions, crashed, minCrashFreeRate)` applies four rules **in this order**:

1. Fewer than `MIN_SESSIONS` sessions — you know nothing yet, so `Hold`.
2. A crash-free rate below `minCrashFreeRate` — `Halt`.
3. Already at 100% with a healthy rate — `Done`.
4. Otherwise `Advance` to the next rung.

A `percent` outside `0..100` throws `IllegalArgumentException` with the message `"percent must be 0..100"`.

```kotlin starter
const val MIN_SESSIONS = 500

val STEPS = listOf(1, 5, 10, 20, 50, 100)

/** Given: the next rung of the ladder, or null at the top. */
fun nextStep(percent: Int): Int? = STEPS.firstOrNull { it > percent }

sealed interface Decision {
    data class Advance(val toPercent: Int) : Decision
    data object Hold : Decision
    data object Halt : Decision
    data object Done : Decision
}

fun crashFreeRate(sessions: Int, crashed: Int): Double = 1.0

fun decide(percent: Int, sessions: Int, crashed: Int, minCrashFreeRate: Double): Decision = Decision.Hold
```

```kotlin test
class DecisionTest {
    // the rate
    @Test
    fun rate() {
        assertEquals(0.99, crashFreeRate(100, 1), 0.0001)
        assertEquals(1.0, crashFreeRate(100, 0), 0.0001)
        assertEquals(0.0, crashFreeRate(3, 3), 0.0001)
        assertEquals(1.0, crashFreeRate(0, 0), 0.0001)
        assertEquals(0.9976, crashFreeRate(50_000, 120), 0.0001)
    }

    // too early to say
    @Test
    fun notEnoughData() {
        assertEquals(Decision.Hold, decide(1, 3, 3, 0.995))
        assertEquals(Decision.Hold, decide(1, 499, 0, 0.995))
        assertEquals(Decision.Hold, decide(100, 0, 0, 0.995))
    }

    // healthy enough to climb
    @Test
    fun advancing() {
        assertEquals(Decision.Advance(5), decide(1, 1000, 2, 0.995))
        assertEquals(Decision.Advance(20), decide(10, 20_000, 40, 0.995))
        assertEquals(Decision.Advance(100), decide(50, 100_000, 100, 0.995))
    }

    // bad enough to stop
    @Test
    fun halting() {
        assertEquals(Decision.Halt, decide(5, 1000, 20, 0.995))
        assertEquals(Decision.Halt, decide(50, 100_000, 600, 0.995))
        assertEquals(Decision.Halt, decide(100, 100_000, 600, 0.995))
        assertEquals(Decision.Advance(10), decide(5, 1000, 5, 0.995))
    }

    // the top of the ladder, and nonsense
    @Test
    fun finished() {
        assertEquals(Decision.Done, decide(100, 100_000, 100, 0.995))

        var message: String? = null
        try {
            decide(101, 100_000, 0, 0.995)
        } catch (e: IllegalArgumentException) {
            message = e.message
        }
        assertEquals("percent must be 0..100", message)
    }
}
```

#### Uses
- [Shipping to Play › Watching the release](#/release/watching-the-release)
- [Shipping to Play › Staged rollouts](#/release/staged-rollouts)
- [Testing › Test the state, not the screen](#/testing/test-the-state-not-the-screen)

#### Hints
- `(sessions - crashed).toDouble() / sessions` — the `toDouble()` has to come before the division or you get integer division and a rate of 0 or 1.
- Write the four rules as four early returns in the order given. Anything cleverer will get one of the boundary tests wrong.
- `nextStep(percent)` returning `null` is exactly the "already at the top" case, so rule 3 and rule 4 are one `?:`.

#### Tips
- `decide(5, 1000, 5, 0.995)` is the boundary: a rate of exactly the minimum is acceptable. Deciding whether your threshold is `<` or `<=` before the incident is the point of writing it down.
- `MIN_SESSIONS` exists because percentages lie about small samples. Three sessions and three crashes may be one tester with a broken device.
- A rule this simple can run automatically from the Play Developer API. The value is not the automation, it is that everyone agreed on the numbers while nothing was on fire.

#### Docs
- [Android vitals](https://developer.android.com/topic/performance/vitals)
- [Crashes and ANRs](https://developer.android.com/topic/performance/vitals/crash)

### 4. Sign it, shrink it, run it

Take your app from a debug build to a signed, shrunk release bundle that you have actually installed and used.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- An upload keystore created with `keytool`, stored outside the repository, with its path and passwords in a `keystore.properties` file that is in `.gitignore`.
- A `signingConfigs { create("release") }` block reading from that file, and `signingConfig` set on the release build type.
- `isMinifyEnabled = true` and `isShrinkResources = true` on release.
- `versionCode` and `versionName` computed from one source, not typed twice.
- `./gradlew bundleRelease` producing an `.aab`, and `./gradlew assembleRelease` producing an APK you install on a device with `adb install -r`.
- Every screen of the release build opened and used. Anything that crashes here and not in debug is an R8 problem: fix it with the narrowest `-keep` rule that works.
- `app/build/outputs/mapping/release/mapping.txt` located, and one obfuscated stack trace deobfuscated with `retrace`.
- A debug build with `applicationIdSuffix = ".debug"` installed alongside the release build on the same device.

```kotlin solution
// keystore.properties (git-ignored, never committed)
// storeFile=/Users/you/keys/upload.jks
// storePassword=...
// keyAlias=upload
// keyPassword=...

// app/build.gradle.kts
import java.util.Properties

val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.example.notes"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.notes"
        minSdk = 24
        targetSdk = 36
        versionName = "2.4.1"
        versionCode = versionName!!.split(".").map(String::toInt)
            .let { (major, minor, patch) -> major * 10000 + minor * 100 + patch }
    }

    signingConfigs {
        create("release") {
            keystoreProperties.getProperty("storeFile")?.let { storeFile = file(it) }
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }
}

// app/proguard-rules.pro
// # Keep the models kotlinx.serialization looks up reflectively.
// -keepclassmembers class com.example.notes.data.** {
//     *** Companion;
// }
// -keepclasseswithmembers class com.example.notes.data.** {
//     kotlinx.serialization.KSerializer serializer(...);
// }
//
// # Keep line numbers so a stack trace can be retraced, but hide the file names.
// -keepattributes SourceFile,LineNumberTable
// -renamesourcefileattribute SourceFile
```

#### Uses
- [Shipping to Play › Signing](#/release/signing)
- [Shipping to Play › R8, shrinking and the mapping file](#/release/r8-shrinking-and-the-mapping-file)
- [Shipping to Play › Build variants](#/release/build-variants)
- [Shipping to Play › Versioning](#/release/versioning)

#### Hints
- `keytool` ships with the JDK. Studio's **Build → Generate Signed App Bundle** will create the keystore for you if you would rather not use the command line.
- Guard the properties file with `if (file.exists())` so a fresh clone can still build a debug variant without the keystore.
- `-keepattributes SourceFile,LineNumberTable` is what keeps line numbers in a shrunk build; without it every frame says line 0.
- `$ANDROID_HOME/cmdline-tools/latest/bin/retrace mapping.txt trace.txt` turns an obfuscated stack trace back into names.

#### Tips
- Test the release build on a device before you upload it, every time. R8 failures are invisible until then and embarrassing afterwards.
- A `-keep class **` rule makes the crash go away and undoes most of what R8 is for. Narrow the rule until the app still works and the APK is still small.
- Back the upload keystore up somewhere other than the laptop it was made on. With Play App Signing this is recoverable; without it, it is not.

#### Docs
- [Sign your app](https://developer.android.com/studio/publish/app-signing)
- [Shrink, obfuscate and optimize your app](https://developer.android.com/build/shrink-code)
- [About Android App Bundles](https://developer.android.com/guide/app-bundle)

### 5. Ship it, and watch it

Put the bundle on Play, give it to a few people, and set up the instruments you will need when something goes wrong at 1%.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A Play Console developer account, an app created, and Play App Signing enabled on the first upload.
- The store listing filled in enough to publish: title, short and full description, screenshots, feature graphic, privacy policy URL.
- The **Data safety** form and the content rating questionnaire completed honestly.
- `targetSdk` at the level Play currently requires — check the deadline in the console, not from memory.
- The bundle uploaded to **internal testing**, installed from Play by at least one tester who is not you.
- A crash reporter wired up (Crashlytics or Play's own), and one deliberate crash triggered from the internal build so you can see it arrive, deobfuscated.
- A production release created with a staged rollout at 1%, and a written note of the threshold at which you would halt it.
- The Play Console's release dashboard and Android vitals opened and understood before you need them.
- Practised the halt: find the button, know what it does and what it does not undo.

```kotlin solution
// There is very little code in this one. The two pieces worth writing down:

// 1. A release check that runs in CI before anything is uploaded.
// .github/workflows/release.yml
//   - run: ./gradlew testReleaseUnitTest lintRelease
//   - run: ./gradlew bundleRelease
//   - uses: actions/upload-artifact@v4
//     with:
//       name: mapping
//       path: app/build/outputs/mapping/release/mapping.txt

// 2. The decision rule from exercise 3, written into the release notes template
//    so that every rollout is judged the same way:
//
//    Version:            2.4.1 (20401)
//    Rollout:            1% -> 5% -> 10% -> 20% -> 50% -> 100%, min 24h per rung
//    Minimum sessions:   500 before any decision
//    Halt if:            crash-free sessions < 99.5%, or any new issue above 0.1% of sessions
//    Fix path:           2.4.2 (20402), built from the release branch, internal track first

// Crashlytics setup, for the record: the plugin, the dependency, and a single call.
@HiltAndroidApp
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseCrashlytics.getInstance().setCustomKey("build_type", BuildConfig.BUILD_TYPE)
    }
}

// Forcing one crash, from a debug-only screen, to prove the pipeline works end to end:
@Composable
fun DebugTools() {
    Button(onClick = { throw RuntimeException("Test crash from the debug menu") }) {
        Text("Crash the app")
    }
}
```

#### Uses
- [Shipping to Play › The Play Console](#/release/the-play-console)
- [Shipping to Play › Staged rollouts](#/release/staged-rollouts)
- [Shipping to Play › Watching the release](#/release/watching-the-release)
- [Shipping to Play › What a release actually is](#/release/what-a-release-actually-is)

#### Hints
- The first upload is the one that decides Play App Signing. Opting in later is possible but more work; opt in now.
- Internal testing links take a few minutes to become installable, and testers must accept the invitation with the same Google account they use on the device.
- Deobfuscated Crashlytics traces need the mapping file uploaded; the Gradle plugin does it automatically for release builds, but only if `mappingFileUploadEnabled` is on.
- A "deliberate crash" must happen in a build that has the crash reporter configured for release, not in a debug build with reporting disabled.

#### Tips
- Do the whole chain once with an app nobody uses. The first release is where you discover the two-day review, the missing privacy policy and the rejected screenshot sizes — better on a throwaway than on a launch date.
- Write the halt threshold down *before* the rollout starts. During one, every number looks survivable.
- Keep the release branch alive after you ship. The fix for a 1% rollout is a cherry-pick onto that branch, not a rebuild of an unrelated main.

#### Docs
- [Publish your app](https://developer.android.com/studio/publish)
- [Android vitals](https://developer.android.com/topic/performance/vitals)
- [Meet Google Play's target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
