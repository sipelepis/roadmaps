# Project & Gradle

An Android project is a Gradle build that happens to produce an APK. Before you write a single composable it is worth knowing what the files around your code are for: which one declares your dependencies, which one declares your app to the system, and what actually differs between the build you debug and the build you ship. Almost every "it works on my machine" story on Android starts in one of these files.

Gradle is a general build tool; the Android Gradle Plugin (AGP) teaches it what an app is. You configure both in Kotlin, in `.gradle.kts` files, which means the IDE can complete and type-check your build script the same way it does your app.

## What is in a project

A freshly generated project has more files than it has ideas. There are only a handful that matter:

```
MyApp/
├── settings.gradle.kts        which modules exist, and where plugins come from
├── build.gradle.kts           the root build: plugin versions, nothing else
├── gradle/
│   └── libs.versions.toml     the version catalog: every dependency, in one place
├── gradlew, gradlew.bat       the wrapper: the one true Gradle version
├── gradle/wrapper/            what version the wrapper downloads
└── app/
    ├── build.gradle.kts       the app module: SDK levels, build types, dependencies
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── kotlin/com/example/myapp/…
        │   └── res/            layouts you no longer write, but also strings, icons, themes
        ├── debug/              files that only exist in debug builds
        ├── test/               unit tests, run on your machine's JVM
        └── androidTest/        instrumented tests, run on a device
```

Never run `gradle` directly. Run `./gradlew`, the wrapper script: it downloads and uses exactly the Gradle version recorded in `gradle/wrapper/gradle-wrapper.properties`, so your build, your colleague's build and CI are the same build. `./gradlew assembleDebug` builds, `./gradlew test` runs the JVM tests, `./gradlew tasks` lists everything available.

## Modules

A module is a unit of compilation with its own `build.gradle.kts`. Every project has at least `:app`. `settings.gradle.kts` is the list:

```kotlin
rootProject.name = "MyApp"
include(":app")
include(":core:data")
```

Modules exist for two reasons. The honest one is build speed: Gradle compiles modules in parallel and skips the ones whose inputs have not changed, so a 30-second incremental build becomes a 5-second one. The other is that a module boundary is a boundary the compiler enforces — `:core:data` cannot accidentally reach into a screen it knows nothing about.

Start with one module. Split when the build gets slow or when a boundary keeps being crossed by accident, not before.

## The manifest

`AndroidManifest.xml` is how your app describes itself to the operating system: what it is allowed to do, and what can be started from outside.

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:name=".MyApplication"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.MyApp">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

The `intent-filter` above is what puts an icon in the launcher. `android:exported` says whether something outside your app may start this component; it is required on anything with an intent filter, and getting it wrong is a security bug, not a warning.

What you do *not* write here any more: `package`, `minSdkVersion`, `versionCode` and `versionName` all live in `build.gradle.kts` now, and AGP writes them into the manifest for you.

Your libraries have manifests too, and AGP merges them into yours. A library that needs `INTERNET` adds that permission to your app whether you asked or not, and a library with a higher `minSdk` than yours fails the build rather than silently raising it. `./gradlew :app:processDebugManifest` writes the merged result, with a report of which file every line came from, into `app/build/outputs/logs/`.

## Dependencies and the version catalog

Dependencies are declared in the module that uses them, and their versions in `gradle/libs.versions.toml` — the version catalog, which is the default in every new project:

```toml
[versions]
kotlin = "2.2.20"
composeBom = "2025.09.00"
coreKtx = "1.17.0"

[libraries]
androidx-core-ktx = { module = "androidx.core:core-ktx", version.ref = "coreKtx" }
androidx-compose-bom = { module = "androidx.compose:compose-bom", version.ref = "composeBom" }
androidx-compose-material3 = { module = "androidx.compose.material3:material3" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
```

An alias resolves to `group:artifact:version`. Note the last library: no version at all. That is deliberate — it comes from the Compose **BOM** (bill of materials), a special dependency whose only content is a table of versions that are known to work together. Declare the BOM once with `platform(...)` and every Compose artifact after it gets its version from the table:

```kotlin
dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.core.ktx)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
```

In the build script the dashes in an alias become dots: `androidx-core-ktx` is `libs.androidx.core.ktx`, and the IDE completes it.

The word in front matters. `implementation` puts a library on your compile and runtime classpath but hides it from modules that depend on you. `api` exposes it to them as well, which is slower to build and a promise you rarely mean to make. `testImplementation` is for JVM tests only, `androidTestImplementation` for on-device tests, and `debugImplementation` for things that must never ship — Compose's `ui-tooling`, which draws the previews, belongs here.

When two libraries ask for different versions of a third, Gradle does not fail: it picks the **highest** one and carries on. That is usually what you want and occasionally a surprise. `./gradlew :app:dependencies` prints the resolved graph, and marks each upgrade it made.

## Build types, flavours and variants

`app/build.gradle.kts` is where the app's identity and its build types live:

```kotlin
android {
    namespace = "com.example.myapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.myapp"
        minSdk = 24
        targetSdk = 36
        versionCode = 12
        versionName = "1.4.0"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { compose = true }
}
```

`namespace` is the package your `R` class and `BuildConfig` are generated into. `applicationId` is the identity Google Play and the device use — they start out the same and are free to differ. `minSdk` is the oldest Android you support, `targetSdk` the newest you have tested against and whose behaviour changes you accept, and `compileSdk` the API level you compile against, which should simply be the latest.

The `debug` build type gets `applicationIdSuffix = ".debug"` so the debug and release builds can sit on the same phone at once. The `release` build turns on **R8**, which shrinks, optimises and obfuscates: it deletes the code nothing calls, which is most of the code in most of your libraries. Anything reached only by reflection — a JSON model, say — needs a `proguard-rules.pro` keep rule, and the way you find out is that release crashes where debug did not. Build a release APK before you are in a hurry to ship one.

A **flavour** is a second axis (`free` and `paid`, or `staging` and `production`). Build type × flavour = **variant**, and each variant can have its own source set: code in `src/free/kotlin` is compiled only into the free variants.

```kotlin playground
// A tiny version catalog, resolved the way Gradle resolves one.
data class Library(val module: String, val versionRef: String?)

val versions = mapOf("coreKtx" to "1.17.0", "composeBom" to "2025.09.00", "okhttp" to "5.1.0")
val libraries = mapOf(
    "androidx-core-ktx" to Library("androidx.core:core-ktx", "coreKtx"),
    "androidx-compose-bom" to Library("androidx.compose:compose-bom", "composeBom"),
    "androidx-compose-material3" to Library("androidx.compose.material3:material3", null),
    "okhttp" to Library("com.squareup.okhttp3:okhttp", "okhttp"),
)

fun coordinate(alias: String): String? {
    val lib = libraries[alias] ?: return null
    val ref = lib.versionRef ?: return lib.module          // the BOM decides this one
    return versions[ref]?.let { "${lib.module}:$it" }
}

/** Gradle's default when two dependencies disagree: the highest version wins. */
fun highest(candidates: List<String>): String? =
    candidates.maxByOrNull { v -> v.split(".").map { it.toInt() } .let { p -> p[0] * 1_000_000L + p[1] * 1_000L + p[2] } }

fun main() {
    for (alias in listOf("androidx-core-ktx", "androidx-compose-material3", "okhttp", "retrofit")) {
        println("%-28s -> %s".format(alias, coordinate(alias) ?: "not in the catalog"))
    }
    println()
    // Two libraries want different versions of the same thing.
    val wanted = listOf("1.9.9", "1.10.0", "1.2.0")
    println("okio wanted at ${wanted.joinToString(", ")} -> Gradle resolves ${highest(wanted)}")
    println("note 1.10.0 beats 1.9.9: these are numbers, not decimals")
}
```

## Exercises

### 1. Resolve a catalog alias

`Catalog.coordinate(alias)` turns a version-catalog alias into the coordinate Gradle downloads. A library with a `versionRef` resolves to `"module:version"`. A library without one is managed by a BOM, so its coordinate is just the module. An alias that is not in the catalog, or one whose `versionRef` names a version that does not exist, resolves to `null`.

```kotlin starter
data class Library(val module: String, val versionRef: String?)

class Catalog(val versions: Map<String, String>, val libraries: Map<String, Library>) {
    fun coordinate(alias: String): String? {
        return libraries[alias]?.module
    }
}
```

```kotlin test
class CatalogTest {
    private val catalog = Catalog(
        versions = mapOf("coreKtx" to "1.17.0", "okhttp" to "5.1.0"),
        libraries = mapOf(
            "androidx-core-ktx" to Library("androidx.core:core-ktx", "coreKtx"),
            "okhttp" to Library("com.squareup.okhttp3:okhttp", "okhttp"),
            "androidx-compose-material3" to Library("androidx.compose.material3:material3", null),
            "dangling" to Library("com.example:thing", "nosuch"),
        ),
    )

    // a versionRef is looked up in [versions]
    @Test
    fun resolved() {
        assertEquals("androidx.core:core-ktx:1.17.0", catalog.coordinate("androidx-core-ktx"))
        assertEquals("com.squareup.okhttp3:okhttp:5.1.0", catalog.coordinate("okhttp"))
    }

    // no version means a BOM supplies it
    @Test
    fun bomManaged() {
        assertEquals("androidx.compose.material3:material3", catalog.coordinate("androidx-compose-material3"))
    }

    // unknown aliases and dangling refs resolve to nothing
    @Test
    fun missing() {
        assertNull("the alias is not in [libraries]", catalog.coordinate("retrofit"))
        assertNull("an empty alias is not in [libraries] either", catalog.coordinate(""))
        assertNull("the versionRef is not in [versions]", catalog.coordinate("dangling"))
    }
}
```

#### Uses
- [Project & Gradle › Dependencies and the version catalog](#/project/dependencies-and-the-version-catalog)
- [What is Android? › Two kinds of exercise](#/intro/two-kinds-of-exercise)

#### Hints
- Two lookups, either of which can fail: the alias in `libraries`, then the `versionRef` in `versions`.
- `?: return null` after the first lookup handles the unknown alias; `?: return lib.module` after reading `versionRef` handles the BOM case.
- `versions[ref]?.let { "${lib.module}:$it" }` gives you the resolved coordinate or `null` in one expression.

#### Tips
- The three outcomes are genuinely different: a missing alias is a typo, a missing version is a broken catalog, and no `versionRef` at all is normal for anything a BOM manages.
- Gradle fails the build on a dangling `version.ref` rather than guessing. Returning `null` here is the same decision, expressed in a function.
- The dashes in `androidx-core-ktx` become dots in `libs.androidx.core.ktx`. It is the same alias; only the syntax changes.

#### Docs
- [Migrate your build to version catalogs](https://developer.android.com/build/migrate-to-catalogs)
- [Add build dependencies](https://developer.android.com/build/dependencies)

### 2. Highest version wins

When two dependencies ask for different versions of the same library, Gradle resolves the conflict by taking the highest. `highest(versions)` returns the highest of a list of dotted numeric versions, comparing segment by segment as numbers — so `"1.10.0"` beats `"1.9.9"`. Versions can have different numbers of segments, and a missing segment counts as zero, so `"2"`, `"2.0"` and `"2.0.0"` are the same version. On a tie, return the one that appeared first. An empty list has no answer: return `null`.

```kotlin starter
fun highest(versions: List<String>): String? {
    return versions.maxOrNull()
}
```

```kotlin test
class HighestTest {
    // segments are numbers, not decimals
    @Test
    fun numeric() {
        assertEquals("1.10.0", highest(listOf("1.9.9", "1.10.0")))
        assertEquals("1.10.0", highest(listOf("1.10.0", "1.9.9")))
        assertEquals("10.0.0", highest(listOf("2.0.0", "10.0.0", "9.14.3")))
    }

    // different lengths, missing segments are zero
    @Test
    fun lengths() {
        assertEquals("2.0.1", highest(listOf("2", "2.0.1")))
        assertEquals("1.17.0", highest(listOf("1.17.0", "1.17")))
        assertEquals("1.2.3.4", highest(listOf("1.2.3", "1.2.3.4")))
    }

    // ties keep the first, and nothing has no answer
    @Test
    fun edges() {
        assertEquals("2.0", highest(listOf("2.0", "2.0.0", "2")))
        assertEquals("5.1.0", highest(listOf("5.1.0")))
        assertNull("no candidates, no resolution", highest(listOf()))
    }
}
```

#### Uses
- [Project & Gradle › Dependencies and the version catalog](#/project/dependencies-and-the-version-catalog)
- [Project & Gradle › Modules](#/project/modules)
- [Reference › Sorting and picking](#/reference/sorting-and-picking)

#### Hints
- Turn each version into a list of numbers: `v.split(".").map { it.toInt() }`.
- To compare two lists of different lengths, walk the indices of the longer one and read the shorter with `getOrElse(i) { 0 }`.
- `maxWithOrNull(comparator)` keeps the first of equal elements, which is exactly the tie rule you need.

#### Tips
- String comparison is the bug this exercise exists to show: `"1.9.9" > "1.10.0"` is true for strings and wrong for versions.
- Real Gradle also understands `1.0.0-alpha01` and ranges like `[1.0, 2.0)`. Numbers only is enough to see the rule.
- `./gradlew :app:dependencies` prints every version it bumped, with the original beside it. It is the first place to look when a library behaves like a different version than the one you declared.

#### Docs
- [Understand dependency resolution](https://developer.android.com/build/dependency-resolution)

### 3. Merge the manifests

AGP merges every library's manifest into your app's. `merge(app, libraries)` models two of its rules. The effective `minSdk` is the highest anyone requires, because a library compiled for API 26 cannot run on API 24. Permissions are the union of everyone's, each appearing once, in the order they were first seen — the app's own first, then each library's in turn.

```kotlin starter
data class Manifest(val minSdk: Int, val permissions: List<String>)

fun merge(app: Manifest, libraries: List<Manifest>): Manifest {
    return app
}
```

```kotlin test
class MergeTest {
    // a library's permissions end up in your app
    @Test
    fun permissionsUnion() {
        val app = Manifest(24, listOf("INTERNET"))
        val analytics = Manifest(24, listOf("ACCESS_NETWORK_STATE"))
        assertEquals(
            Manifest(24, listOf("INTERNET", "ACCESS_NETWORK_STATE")),
            merge(app, listOf(analytics)),
        )
    }

    // each permission appears once, in first-seen order
    @Test
    fun deduplicated() {
        val app = Manifest(24, listOf("INTERNET", "CAMERA"))
        val libs = listOf(Manifest(24, listOf("CAMERA", "VIBRATE")), Manifest(24, listOf("INTERNET", "VIBRATE")))
        assertEquals(listOf("INTERNET", "CAMERA", "VIBRATE"), merge(app, libs).permissions)
        assertEquals(listOf<String>(), merge(Manifest(21, listOf()), listOf()).permissions)
    }

    // the highest minSdk wins, whoever asked for it
    @Test
    fun minSdk() {
        assertEquals(26, merge(Manifest(24, listOf()), listOf(Manifest(26, listOf()))).minSdk)
        assertEquals(24, merge(Manifest(24, listOf()), listOf(Manifest(21, listOf()))).minSdk)
        assertEquals(31, merge(Manifest(24, listOf()), listOf(Manifest(26, listOf()), Manifest(31, listOf()))).minSdk)
        assertEquals(24, merge(Manifest(24, listOf()), listOf()).minSdk)
    }
}
```

#### Uses
- [Project & Gradle › The manifest](#/project/the-manifest)
- [Project & Gradle › Build types, flavours and variants](#/project/build-types-flavours-and-variants)

#### Hints
- Build the permission list in one pass with a `LinkedHashSet`, which keeps insertion order and drops repeats, then call `toList()`.
- `(listOf(app) + libraries)` gives you every manifest in the right order, app first.
- `maxOf` over the same sequence gives the effective `minSdk`; remember it must work when `libraries` is empty.

#### Tips
- Real AGP *fails* on a library whose `minSdk` is higher than yours, with a suggestion to raise yours. Taking the max is the same information without the error message.
- A library quietly adding a permission is a real event: users see the permission on the store listing, and a `tools:node="remove"` in your manifest is how you take it back.
- The merged manifest is a build output you can read. Open `app/build/outputs/logs/manifest-merger-debug-report.txt` when something is in there that you never wrote.

#### Docs
- [Merge multiple manifest files](https://developer.android.com/build/manage-manifests)
- [App manifest overview](https://developer.android.com/guide/topics/manifest/manifest-intro)

### 4. A project with a catalog and a second module

Create a project and take charge of its build files: move a dependency into the version catalog, add a `:core` module, and depend on it from `:app`. Nothing is marked here — work the checklist, then compare with the solution.

#### Build it
- A new **Empty Activity** project that runs on an emulator or device.
- `gradle/libs.versions.toml` holds every version; no version literal is left in any `build.gradle.kts` dependency line.
- A second module, `:core`, declared in `settings.gradle.kts` and applying the `com.android.library` plugin.
- A data class or function in `:core`, used from a composable in `:app` via `implementation(project(":core"))`.
- `./gradlew :app:assembleDebug` succeeds from the command line, not just from the IDE.
- `./gradlew :app:dependencies` shows `project :core` in the debug compile classpath.

```kotlin solution
// settings.gradle.kts
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "MyApp"
include(":app")
include(":core")

// gradle/libs.versions.toml
// [versions]
// agp = "8.13.0"
// kotlin = "2.2.20"
// coreKtx = "1.17.0"
// composeBom = "2025.09.00"
//
// [libraries]
// androidx-core-ktx = { module = "androidx.core:core-ktx", version.ref = "coreKtx" }
// androidx-compose-bom = { module = "androidx.compose:compose-bom", version.ref = "composeBom" }
// androidx-compose-material3 = { module = "androidx.compose.material3:material3" }
// androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "activityCompose" }
//
// [plugins]
// android-application = { id = "com.android.application", version.ref = "agp" }
// android-library = { id = "com.android.library", version.ref = "agp" }
// kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
// kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }

// core/build.gradle.kts
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.example.myapp.core"
    compileSdk = 36
    defaultConfig { minSdk = 24 }
}

// core/src/main/kotlin/com/example/myapp/core/Greeting.kt
package com.example.myapp.core

data class Person(val name: String)

fun greet(person: Person): String = "Hello, ${person.name}"

// app/build.gradle.kts
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.myapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.myapp"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }
    buildFeatures { compose = true }
}

dependencies {
    implementation(project(":core"))
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
}
```

#### Uses
- [Project & Gradle › Modules](#/project/modules)
- [Project & Gradle › Dependencies and the version catalog](#/project/dependencies-and-the-version-catalog)
- [Project & Gradle › What is in a project](#/project/what-is-in-a-project)

#### Hints
- File → New → New Module → Android Library gives you a `:core` module with its `build.gradle.kts` and its `include` line already written.
- A library module has no `applicationId` and no launcher activity. If Studio generated one, you picked the wrong template.
- `alias(libs.plugins.android.library)` in `plugins {}` is how a catalog entry under `[plugins]` is applied.
- After editing any build file, Studio shows a "Sync Now" bar. Nothing you changed exists until you click it.

#### Tips
- Keep the root `build.gradle.kts` almost empty. Plugin *versions* belong there (or in the catalog); configuration belongs in the module that needs it.
- `implementation(project(":core"))` means `:app` sees `:core`, but anything depending on `:app` does not. That is the default you want.
- If the Gradle sync fails with "plugin not found", the plugin is missing from `pluginManagement.repositories` in `settings.gradle.kts`, not from your module.

#### Docs
- [Configure your build](https://developer.android.com/build)
- [Create an Android library](https://developer.android.com/studio/projects/android-library)

### 5. A release build that actually runs

A debug build hides problems a release build finds. Configure the release build type properly, build it, and install it on a device beside the debug one.

#### Build it
- A `release` build type with `isMinifyEnabled = true` and `isShrinkResources = true`.
- A debug build type with `applicationIdSuffix = ".debug"`, so both builds can be installed at once.
- A keystore created from Studio (Build → Generate Signed App Bundle / APK), with the `signingConfig` read from a `local.properties` entry or an environment variable — never a password committed to git.
- `./gradlew :app:assembleRelease` produces an APK, and `adb install -r` puts it on the device.
- The release build launches and every screen you wrote still works.
- `app/build/outputs/mapping/release/mapping.txt` exists — that is the file that turns an obfuscated crash report back into names.

```kotlin solution
// app/build.gradle.kts
import java.util.Properties

val keystoreProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.example.myapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.myapp"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        create("release") {
            storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { compose = true }
}
```

#### Uses
- [Project & Gradle › Build types, flavours and variants](#/project/build-types-flavours-and-variants)
- [Project & Gradle › What is in a project](#/project/what-is-in-a-project)
- [What is Android? › The tools](#/intro/the-tools)

#### Hints
- The Build Variants panel on the left of Studio switches which variant Run installs. Switch it to `release` and press Run.
- `local.properties` is generated by Studio and is already in `.gitignore`. That makes it the usual home for a keystore path and passwords on your own machine; CI uses environment variables instead.
- If the release build crashes on launch and debug does not, R8 removed something. Read the stack trace through `retrace` with `mapping.txt` before guessing at keep rules.

#### Tips
- Upload `mapping.txt` with every release. Play Console does it automatically from an app bundle; without it, every crash report is unreadable.
- `isShrinkResources` needs `isMinifyEnabled`, because it decides which resources to drop from the code R8 kept.
- Keep the keystore itself backed up somewhere safe. Losing it once meant losing the ability to update the app; Play App Signing now protects you from that, which is a good reason to enrol.

#### Docs
- [Shrink, obfuscate, and optimize your app](https://developer.android.com/build/shrink-code)
- [Sign your app](https://developer.android.com/studio/publish/app-signing)
