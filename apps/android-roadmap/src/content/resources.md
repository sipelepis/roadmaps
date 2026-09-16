# Resources & config

An Android app does not run in one configuration. It runs in the user's language, at the user's font size, on a screen of some density, in light or dark, in a window of some width, left-to-right or right-to-left — and all of that can change while the app is open. Resources are how you write one app that is correct in all of them: you name a value, the system picks the right one for the current configuration, and your code never asks which configuration it is.

## Why nothing is hardcoded

Every user-visible string, dimension, colour and drawable belongs in `res/`, referenced by id. `stringResource(R.string.cart_title)` instead of `"Your cart"`, `16.dp` instead of `16`, `MaterialTheme.colorScheme.surface` instead of `Color(0xFFFFFFFF)`.

This is not bureaucracy. A hardcoded string cannot be translated, a hardcoded pixel is the wrong size on half the devices, and a hardcoded colour is unreadable in dark mode. The rule of thumb: if a human reads it, or a designer measures it, it is a resource.

```kotlin
Text(
    text = stringResource(R.string.greeting, user.firstName),
    modifier = Modifier.padding(horizontal = dimensionResource(R.dimen.gutter)),
)
```

The one honest exception is a value with no meaning outside the code — a spacer between two icons, an animation's tag. Resources for those cost more than they return.

## Strings, formatting and plurals

`strings.xml` holds the text. Arguments go in as positional format specifiers, never string concatenation:

```xml
<string name="greeting">Hello, %1$s!</string>
<string name="score">%1$s scored %2$d points</string>
```

Positional (`%1$s`) rather than bare (`%s`) matters: a translator may need the arguments in a different order, and only the numbered form lets them move.

Counts are worse than they look. English has two forms and it is tempting to write `if (n == 1) "item" else "items"`. Polish has four, Arabic six, Japanese one. That is what `plurals` is for:

```xml
<plurals name="items_in_cart">
    <item quantity="one">%d item</item>
    <item quantity="other">%d items</item>
</plurals>
```

```kotlin
val label = pluralStringResource(R.plurals.items_in_cart, count, count)
```

The `count` is passed twice on purpose: once to select the form, once to be formatted into it. The category names — `zero`, `one`, `two`, `few`, `many`, `other` — are grammatical categories from CLDR, not numbers. In Polish `few` covers 2, 3, 4, 22, 23 and 24 but not 12, 13 or 14. Your job is to supply the English forms and let the translation supply the rest.

Numbers and dates are the same story: format them for a locale rather than building them by hand. `NumberFormat`, `DateTimeFormatter.ofLocalizedDate` and `String.format(locale, …)` all know that a thousands separator can be a dot, a comma, a space or nothing.

## Qualifiers and configuration

A resource directory can carry qualifiers, and the system picks the best-matching folder for the current configuration at lookup time:

```
res/values/strings.xml          the default, always present
res/values-fr/strings.xml       French
res/values-fr-rCA/strings.xml   French as spoken in Canada
res/values-night/colors.xml     dark mode
res/values-w600dp/dimens.xml    windows at least 600dp wide
res/drawable-xxhdpi/logo.png    a denser screen
```

The unqualified folder is the fallback and must be complete: anything missing there is a crash waiting for the one configuration you did not think about. Qualifiers are evaluated in a fixed precedence — locale beats screen size beats density — and the more specific folder wins among the ones that match.

Two rules save a lot of grief. Keep the qualifiers to the ones you genuinely need, because every one multiplies the combinations you cannot test. And never branch on the configuration in code when a qualifier will do it declaratively.

## Density, dp, sp and px

A **px** is one physical pixel and is never the unit you want. A **dp** is a density-independent pixel: one dp is one px on a 160dpi screen, and the system scales it elsewhere, so `48.dp` is roughly the same physical size on every device. The conversion is `px = dp × density`, where `density` is `dpi / 160`.

Densities are grouped into buckets — mdpi 1×, hdpi 1.5×, xhdpi 2×, xxhdpi 3×, xxxhdpi 4× — which is why bitmap assets ship once per bucket. Vector drawables sidestep the whole problem and should be the default for icons.

**sp** is dp multiplied again by the user's font scale setting, and it is the unit for text, only for text. Someone who has set their font to 200% has done that deliberately; a `TextStyle` in dp ignores them. In Compose, `16.sp` and `Modifier.padding(16.dp)` is the correct pairing, and a layout that assumes text will never grow will break for exactly the people who need it most.

## Locales and language

The user has an ordered list of preferred languages, not one language. Android 13 added per-app language preferences on top of that, so your app's locale can differ from the system's. Either way, the framework walks the user's list against the locales you ship and picks the first workable match, falling back to your default resources when nothing fits.

That means shipping `values-fr` is enough for a French-Canadian user: the language matches even though the region does not. It also means `Locale.getDefault()` in the middle of your business logic is a trap — a string formatted at startup keeps the locale it was formatted with, long after the user changed theirs.

Declare the languages you actually support with `resourceConfigurations` (or `androidResources.localeFilters` in newer AGP) so library translations you never reviewed do not leak into the app.

## Right-to-left

Arabic, Hebrew, Persian and Urdu lay out from the right. Compose handles it if you let it: use `start`/`end` rather than `left`/`right`, and they mirror automatically.

```kotlin
Modifier.padding(start = 16.dp, end = 8.dp)     // mirrors
Modifier.absolutePadding(left = 16.dp)          // does not — almost always a bug
```

`Row` reverses its children, `Icons.AutoMirrored.*` flip, and text alignment follows the text's own direction. What does not mirror by itself: a custom `Canvas`, a hand-rolled drawable of an arrow, and any layout that positions things by absolute offset. Test with `LocalLayoutDirection provides LayoutDirection.Rtl` in a preview, or "Force RTL layout direction" in developer options, before a user finds it for you.

```kotlin playground
import java.util.Locale
import java.text.NumberFormat

// Formatting is a locale decision, not a string decision. Same numbers, four sets of conventions.
fun row(tag: String, locale: Locale): String {
    val n = NumberFormat.getNumberInstance(locale).format(1234567.89)
    val pct = NumberFormat.getPercentInstance(locale).format(0.075)
    val made = String.format(locale, "%.1f km", 12.5)
    return "%-8s %-14s %-8s %s".format(tag, n, pct, made)
}

// Language codes whose scripts run right to left. The layout mirrors; the numbers do not.
val rtl = setOf("ar", "he", "fa", "ur")

fun main() {
    println("%-8s %-14s %-8s %s".format("locale", "number", "percent", "formatted"))
    listOf("en-US", "de-DE", "fr-FR", "ar-EG").forEach {
        println(row(it, Locale.forLanguageTag(it)))
    }

    println()
    listOf("en", "ar", "de", "he").forEach {
        println("$it lays out ${if (it in rtl) "right to left" else "left to right"}")
    }

    println()
    // What a hardcoded concatenation costs you: one sentence that cannot be translated or pluralised.
    val count = 1
    println("wrong: You have " + count + " item" + (if (count == 1) "" else "s"))
    println("right: a <plurals> entry, and every language supplies its own forms")
}
```

## Exercises

### 1. One is not the only special number

`pluralCategory(language, count)` returns the CLDR grammatical category a count falls into, as `"one"`, `"few"`, `"many"` or `"other"`. Three languages, and everything else follows the English rule:

- `"en"` — `"one"` for exactly 1, `"other"` for everything else, including 0.
- `"ja"` — `"other"` always. Japanese does not inflect for number.
- `"pl"` — `"one"` for exactly 1; `"few"` when the last digit is 2, 3 or 4 **and** the last two digits are not 12, 13 or 14; `"many"` for everything else, including 0.

`quantityString(forms, language, count)` then picks `forms[category]`, falling back to `forms["other"]` when that language's form is missing, and replaces every `%d` in it with the count. Counts are never negative.

```kotlin starter
fun pluralCategory(language: String, count: Int): String = "other"

fun quantityString(forms: Map<String, String>, language: String, count: Int): String =
    forms["other"].orEmpty()
```

```kotlin test
class PluralTest {
    // English has exactly one special case
    @Test
    fun english() {
        assertEquals("one", pluralCategory("en", 1))
        assertEquals("other", pluralCategory("en", 0))
        assertEquals("other", pluralCategory("en", 2))
        assertEquals("other", pluralCategory("en", 21))
    }

    // Japanese has none, and an unknown language borrows English's
    @Test
    fun otherLanguages() {
        assertEquals("other", pluralCategory("ja", 1))
        assertEquals("other", pluralCategory("ja", 7))
        assertEquals("one", pluralCategory("sv", 1))
        assertEquals("other", pluralCategory("sv", 3))
    }

    // Polish: few is about the last digit, unless the last two digits say otherwise
    @Test
    fun polish() {
        assertEquals("one", pluralCategory("pl", 1))
        assertEquals("few", pluralCategory("pl", 2))
        assertEquals("few", pluralCategory("pl", 4))
        assertEquals("few", pluralCategory("pl", 22))
        assertEquals("few", pluralCategory("pl", 104))
        assertEquals("many", pluralCategory("pl", 5))
        assertEquals("many", pluralCategory("pl", 12))
        assertEquals("many", pluralCategory("pl", 14))
        assertEquals("many", pluralCategory("pl", 113))
        assertEquals("many", pluralCategory("pl", 0))
        assertEquals("many", pluralCategory("pl", 21))
    }

    // the form is chosen, then filled in
    @Test
    fun formatting() {
        val en = mapOf("one" to "%d item", "other" to "%d items")
        assertEquals("1 item", quantityString(en, "en", 1))
        assertEquals("7 items", quantityString(en, "en", 7))
        assertEquals("0 items", quantityString(en, "en", 0))
        assertEquals("1 items", quantityString(en, "ja", 1))
    }

    // a missing form falls back to other, never to an empty string
    @Test
    fun fallback() {
        val partial = mapOf("other" to "%d rzeczy")
        assertEquals("2 rzeczy", quantityString(partial, "pl", 2))
        val full = mapOf("one" to "%d rzecz", "few" to "%d rzeczy", "many" to "%d rzeczy", "other" to "%d rzeczy")
        assertEquals("1 rzecz", quantityString(full, "pl", 1))
        assertEquals("5 rzeczy", quantityString(full, "pl", 5))
    }
}
```

#### Uses
- [Resources & config › Strings, formatting and plurals](#/resources/strings-formatting-and-plurals)

#### Hints
- `count % 10` is the last digit and `count % 100` is the last two; the Polish rule needs both.
- `when (language) { … else -> … }` with the English rule in the `else` branch covers `"en"` and every unlisted language at once.
- `forms[category] ?: forms["other"]` is the fallback, and `.replace("%d", count.toString())` is the substitution.

#### Tips
- These are exactly the rules `pluralStringResource` applies for you. You write the `<plurals>` entry; the platform picks the form. The only way to get it wrong is to do the choosing yourself in Kotlin.
- "Zero" is a grammatical category in Arabic, not a convenient place to put "no items". If you want a distinct empty-state sentence, make it its own string.
- Passing the count twice — once to select, once to format — looks redundant until you meet a language where the selected form does not mention the number at all.

#### Docs
- [String resources: quantity strings](https://developer.android.com/guide/topics/resources/string-resource#Plurals)
- [Localize your app](https://developer.android.com/guide/topics/resources/localization)

### 2. dp, sp and the pixels underneath

Three small conversions that the framework does constantly and that you need to be able to do in your head.

- `dpToPx(dp, density)` converts density-independent pixels to physical ones: `dp × density`, rounded the way the framework rounds it — add `0.5` and truncate towards zero, so `11.4` becomes `11` and `11.5` becomes `12`. Density is never negative and `dp` is never negative here.
- `spToPx(sp, density, fontScale)` is the same thing multiplied by the user's font scale, so text grows when they ask it to.
- `densityBucket(dpi)` names the bucket a screen falls into: below 140 `"ldpi"`, below 200 `"mdpi"`, below 280 `"hdpi"`, below 400 `"xhdpi"`, below 560 `"xxhdpi"`, and `"xxxhdpi"` at 560 and above.

```kotlin starter
fun dpToPx(dp: Float, density: Float): Int = dp.toInt()

fun spToPx(sp: Float, density: Float, fontScale: Float): Int = sp.toInt()

fun densityBucket(dpi: Int): String = "mdpi"
```

```kotlin test
class SizingTest {
    // at mdpi one dp is one px, by definition
    @Test
    fun baseline() {
        assertEquals(16, dpToPx(16f, 1f))
        assertEquals(48, dpToPx(48f, 1f))
        assertEquals(0, dpToPx(0f, 3f))
    }

    // denser screens use more pixels for the same physical size
    @Test
    fun scaled() {
        assertEquals(32, dpToPx(16f, 2f))
        assertEquals(48, dpToPx(16f, 3f))
        assertEquals(144, dpToPx(48f, 3f))
        assertEquals(24, dpToPx(16f, 1.5f))
    }

    // rounding is half up, not truncation
    @Test
    fun rounding() {
        assertEquals(11, dpToPx(7.6f, 1.5f))
        assertEquals(12, dpToPx(8f, 1.5f))
        assertEquals(1, dpToPx(0.4f, 1.5f))
        assertEquals(20, dpToPx(10.2f, 2f))
    }

    // text also answers to the user's font scale
    @Test
    fun textScales() {
        assertEquals(32, spToPx(16f, 2f, 1f))
        assertEquals(48, spToPx(16f, 2f, 1.5f))
        assertEquals(64, spToPx(16f, 2f, 2f))
        assertEquals(26, spToPx(16f, 1f, 1.6f))
    }

    // buckets, including their edges
    @Test
    fun buckets() {
        assertEquals("ldpi", densityBucket(120))
        assertEquals("mdpi", densityBucket(160))
        assertEquals("mdpi", densityBucket(199))
        assertEquals("hdpi", densityBucket(200))
        assertEquals("hdpi", densityBucket(240))
        assertEquals("xhdpi", densityBucket(320))
        assertEquals("xxhdpi", densityBucket(480))
        assertEquals("xxhdpi", densityBucket(559))
        assertEquals("xxxhdpi", densityBucket(560))
        assertEquals("xxxhdpi", densityBucket(640))
    }
}
```

#### Uses
- [Resources & config › Density, dp, sp and px](#/resources/density-dp-sp-and-px)

#### Hints
- `(dp * density + 0.5f).toInt()` is literally how the platform rounds; `toInt()` truncates, and the `+ 0.5f` turns that into rounding half up.
- `spToPx` is `dpToPx` with one extra factor. Call it rather than repeating the arithmetic.
- A `when { dpi < 140 -> … }` chain reads better than nested `if`s and matches the way the boundaries are written above.

#### Tips
- `density` is `dpi / 160`, so the 1×, 1.5×, 2×, 3×, 4× of the buckets and the dpi numbers are the same fact twice.
- The moment you write a number in px in app code, you have written a bug for some device. `.dp` and `.sp` are one character each.
- Font scale can exceed 2× on modern Android with non-linear scaling. Test at the maximum, not at 100%.

#### Docs
- [Support different pixel densities](https://developer.android.com/training/multiscreen/screendensities)
- [Compose: density and units](https://developer.android.com/develop/ui/compose/designsystems/custom)

### 3. Which translation does this user get?

Android matches the user's ordered list of preferred locales against the ones your app actually ships. `resolveLocale(preferred, supported, fallback)` returns the tag from `supported` that would be used, or `fallback` when nothing matches.

Walk `preferred` in order, and for each one try three things before moving on to the next preference:

1. an exact match, ignoring case (`"fr-FR"` matching `"fr-fr"`);
2. the bare language (`"fr-CA"` matching a supported `"fr"`);
3. any supported tag with the same language, in the order `supported` lists them (`"fr-CA"` matching a supported `"fr-FR"`).

The result is always spelled the way `supported` spells it. Tags are either `"xx"` or `"xx-YY"`.

```kotlin starter
fun resolveLocale(preferred: List<String>, supported: List<String>, fallback: String): String =
    fallback
```

```kotlin test
class LocaleTest {
    private val shipped = listOf("en", "fr-FR", "de", "pt-BR")

    // an exact match, whatever the casing
    @Test
    fun exact() {
        assertEquals("de", resolveLocale(listOf("de"), shipped, "en"))
        assertEquals("fr-FR", resolveLocale(listOf("fr-FR"), shipped, "en"))
        assertEquals("fr-FR", resolveLocale(listOf("fr-fr"), shipped, "en"))
        assertEquals("pt-BR", resolveLocale(listOf("PT-br"), shipped, "en"))
    }

    // the language alone is enough
    @Test
    fun byLanguage() {
        assertEquals("de", resolveLocale(listOf("de-AT"), shipped, "en"))
        assertEquals("fr-FR", resolveLocale(listOf("fr-CA"), shipped, "en"))
        assertEquals("fr-FR", resolveLocale(listOf("fr"), shipped, "en"))
        assertEquals("en", resolveLocale(listOf("en-GB"), shipped, "de"))
    }

    // preference order decides, not the order of the supported list
    @Test
    fun ordering() {
        assertEquals("de", resolveLocale(listOf("es", "de", "fr-FR"), shipped, "en"))
        assertEquals("fr-FR", resolveLocale(listOf("it", "fr-CA", "de"), shipped, "en"))
        assertEquals("pt-BR", resolveLocale(listOf("pt-PT", "de"), shipped, "en"))
    }

    // nothing fits, so the default resources are used
    @Test
    fun fallsBack() {
        assertEquals("en", resolveLocale(listOf("ja", "ko"), shipped, "en"))
        assertEquals("en", resolveLocale(emptyList(), shipped, "en"))
        assertEquals("en", resolveLocale(listOf("de"), emptyList(), "en"))
    }
}
```

#### Uses
- [Resources & config › Locales and language](#/resources/locales-and-language)
- [Resources & config › Qualifiers and configuration](#/resources/qualifiers-and-configuration)
- [Reference › Strings](#/reference/strings)

#### Hints
- Normalise once: `tag.lowercase()` for comparison, but return the original spelling from `supported`.
- The language part is `tag.substringBefore("-")`.
- `preferred.firstNotNullOfOrNull { … } ?: fallback` gives you "first preference that resolves", with the three attempts inside the lambda.

#### Tips
- This is why shipping `values-fr` covers Canada, Belgium and Switzerland. Add `values-fr-rCA` only when the wording genuinely differs.
- The third rule — falling back to a different region of the same language — is why a Brazilian user can end up reading European Portuguese, and why `pt-BR` and `pt-PT` are worth separating when you ship both.
- The user's list is ordered for a reason. Picking "the first of my locales that the user might accept" instead of "the first of the user's locales that I support" gets this backwards, and is a surprisingly common bug.

#### Docs
- [Per-app language preferences](https://developer.android.com/guide/topics/resources/app-languages)
- [Localization: how resources are resolved](https://developer.android.com/guide/topics/resources/multilingual-support)

### 4. A screen with nothing hardcoded

Build a small "library" screen — a title, a count of borrowed books, a due date and a button — in which no user-visible string, size or colour appears as a literal in Kotlin. Then translate it into one other language and look at it.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- Every visible string comes from `stringResource` or `pluralStringResource`; grep your composable for `"` and find nothing but resource ids.
- The book count uses a `<plurals>` entry with `one` and `other`, and reads correctly at 0, 1 and 5.
- The greeting takes the user's name as a positional argument (`%1$s`), formatted by the resource, not by string templates.
- The due date is formatted with `DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)`, not with a hand-written pattern.
- A `values-de` (or any second language) `strings.xml` with every id translated, and a `@Preview(locale = "de")` that shows it.
- Text sizes are `sp`, spacing is `dp`, and shared spacing values live in `dimens.xml`.

```kotlin solution
// res/values/strings.xml
// <string name="library_title">Your library</string>
// <string name="greeting">Hello, %1$s</string>
// <string name="due">Due %1$s</string>
// <string name="renew">Renew all</string>
// <plurals name="borrowed">
//     <item quantity="one">%d book borrowed</item>
//     <item quantity="other">%d books borrowed</item>
// </plurals>
//
// res/values/dimens.xml
// <dimen name="gutter">16dp</dimen>
// <dimen name="row_gap">8dp</dimen>

@Composable
fun LibraryScreen(
    userName: String,
    borrowed: Int,
    dueDate: LocalDate,
    onRenew: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val formatter = remember { DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM) }
    Column(
        modifier = modifier.padding(dimensionResource(R.dimen.gutter)),
        verticalArrangement = Arrangement.spacedBy(dimensionResource(R.dimen.row_gap)),
    ) {
        Text(
            text = stringResource(R.string.library_title),
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(
            text = stringResource(R.string.greeting, userName),
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            text = pluralStringResource(R.plurals.borrowed, borrowed, borrowed),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(text = stringResource(R.string.due, dueDate.format(formatter)))
        Button(onClick = onRenew) { Text(stringResource(R.string.renew)) }
    }
}

@Preview(locale = "de", showBackground = true)
@Composable
private fun LibraryPreviewGerman() {
    AppTheme {
        LibraryScreen(
            userName = "Ada",
            borrowed = 3,
            dueDate = LocalDate.of(2026, 5, 1),
            onRenew = {},
        )
    }
}
```

#### Uses
- [Resources & config › Why nothing is hardcoded](#/resources/why-nothing-is-hardcoded)
- [Resources & config › Strings, formatting and plurals](#/resources/strings-formatting-and-plurals)

#### Hints
- `stringResource(R.string.greeting, userName)` passes format arguments; `pluralStringResource(R.plurals.borrowed, count, count)` passes the count twice.
- `dimensionResource(R.dimen.gutter)` returns a `Dp`, so it drops straight into `Modifier.padding`.
- `@Preview(locale = "de")` renders the composable with that locale without touching your device settings.

#### Tips
- Lint's `HardcodedText` check finds the strings you missed. Turn it into an error in your Gradle lint config and it stays fixed.
- `remember { DateTimeFormatter… }` matters: building a formatter on every recomposition is pure waste, and it is the kind of waste that only shows up in a scroll.
- Give translators a `<!-- comment -->` above any string whose meaning is ambiguous out of context. "Order" is a verb and a noun, and they cannot see your screen.

#### Docs
- [String resources](https://developer.android.com/guide/topics/resources/string-resource)
- [Compose: resources in Compose](https://developer.android.com/develop/ui/compose/resources)

### 5. Make it survive Arabic and 200% text

Take the screen from exercise 4 and make it correct in a right-to-left locale and at the largest font scale the system offers. This is a debugging exercise: turn the settings on and fix what breaks.

#### Build it
- Every `padding`, `align` and `Arrangement` uses `start`/`end`, never `left`/`right` or `absolutePadding`.
- Any directional icon uses `Icons.AutoMirrored.*`, and any custom arrow is mirrored under `LocalLayoutDirection`.
- A preview that wraps the screen in `CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl)` and one with `@Preview(fontScale = 2f)`.
- Nothing is clipped or overlapping at `fontScale = 2f`: rows that can overflow become `Column`s, or wrap, or scroll.
- No `Text` has a fixed `height`, and no button is sized so that its label truncates when it grows.
- "Force RTL layout direction" in developer options, on a real device, shows a mirrored but correct screen.

```kotlin solution
@Composable
fun DueRow(
    dueDate: String,
    onRenew: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Vertical arrangement at large font scales: the row would collide long before 200%.
    val compact = LocalDensity.current.fontScale < 1.5f
    val content: @Composable () -> Unit = {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
        )
        Text(
            text = stringResource(R.string.due, dueDate),
            modifier = Modifier.padding(start = 8.dp),
        )
        TextButton(onClick = onRenew) { Text(stringResource(R.string.renew)) }
    }

    if (compact) {
        Row(
            modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) { content() }
    } else {
        Column(
            modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) { content() }
    }
}

@Preview(name = "RTL", locale = "ar")
@Composable
private fun DueRowRtl() {
    AppTheme {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            DueRow(dueDate = "١ مايو ٢٠٢٦", onRenew = {})
        }
    }
}

@Preview(name = "Huge text", fontScale = 2f)
@Composable
private fun DueRowHugeText() {
    AppTheme { DueRow(dueDate = "1 May 2026", onRenew = {}) }
}
```

#### Uses
- [Resources & config › Right-to-left](#/resources/right-to-left)
- [Resources & config › Density, dp, sp and px](#/resources/density-dp-sp-and-px)

#### Hints
- `Modifier.padding(horizontal = …)` and `padding(start = …, end = …)` already mirror; it is `absolutePadding` and `Alignment.Absolute.*` that do not.
- `LocalDensity.current.fontScale` tells you how much the user has scaled text, if you need to change the layout rather than just let it grow.
- `@Preview` takes `locale` and `fontScale` parameters, so both cases are one build away.

#### Tips
- Setting a `locale = "ar"` preview does not mirror the layout on its own in every tooling version; providing `LocalLayoutDirection` explicitly makes the preview honest.
- The cheapest RTL bug to avoid is `Row` plus `absoluteOffset`. The cheapest text-scale bug to avoid is a fixed-height button.
- A screen that survives 200% text usually survives translation into German too — both are "this string got much longer than the mock".

#### Docs
- [Bidirectional text and RTL support](https://developer.android.com/training/basics/supporting-devices/languages)
- [Compose: support different text sizes](https://developer.android.com/develop/ui/compose/accessibility/key-steps)
