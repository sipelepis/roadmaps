# Material theming

A theme is a small set of decisions — these colours, this type scale, these corner radii — made once and read everywhere. Material 3 gives you the vocabulary: `primary` and `onPrimary` rather than purple and white, `bodyLarge` rather than 16sp, `shapes.medium` rather than 12dp. Every component you did not write reads the same vocabulary, which is why swapping a colour scheme changes a whole app and not just the parts you remembered.

The rule that follows from it is short: a hardcoded colour in a composable is a bug in waiting. It will be wrong in dark mode, wrong under dynamic colour, and invisible to whoever is asked to rebrand the app next year.

## What MaterialTheme holds

```kotlin
MaterialTheme(
    colorScheme = darkColorScheme(),
    typography = AppTypography,
    shapes = AppShapes,
) {
    App()
}
```

`MaterialTheme` puts three objects into `CompositionLocal`s — values that flow implicitly down the composition instead of being passed as parameters. Anything below it can read them:

```kotlin
Text(
    text = "Total",
    style = MaterialTheme.typography.titleMedium,
    color = MaterialTheme.colorScheme.onSurface,
    modifier = Modifier
        .background(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.shapes.medium)
        .padding(8.dp),
)
```

Nesting a second `MaterialTheme` inside the first overrides the values for that subtree only — the idiomatic way to give one screen, or one card, a different scheme.

## Colour roles

A Material 3 colour scheme is not a palette of brand colours; it is a set of *roles*, and they come in pairs. For every surface-ish role there is a matching `on` role with guaranteed contrast against it:

| Role | For | Draw on it with |
| --- | --- | --- |
| `primary` | the most prominent action | `onPrimary` |
| `primaryContainer` | a softer emphasis of the same colour | `onPrimaryContainer` |
| `secondary`, `tertiary` | accents, less emphasis | `onSecondary`, `onTertiary` |
| `surface` | cards, sheets, the background of most things | `onSurface` |
| `surfaceVariant` | a distinguished surface | `onSurfaceVariant` |
| `background` | behind everything | `onBackground` |
| `error`, `errorContainer` | what went wrong | `onError`, `onErrorContainer` |
| `outline`, `outlineVariant` | borders and dividers | — |

Use a pair together and contrast is handled for you in both light and dark. Reach past the pair — white text on `surfaceVariant` because it looked fine on your screen — and you have made a decision that only holds for one scheme.

Material 3 also replaced the old shadow-based elevation with **tonal elevation**: a raised surface is tinted with `primary` rather than given a drop shadow, so `Surface(tonalElevation = 3.dp)` changes colour, not depth. That is why a `Card` in dark mode looks lighter than the background rather than darker.

## Light, dark and dynamic

You define two schemes and choose between them:

```kotlin
private val LightColors = lightColorScheme(
    primary = Color(0xFF6750A4),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEADDFF),
    onPrimaryContainer = Color(0xFF21005D),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF381E72),
    primaryContainer = Color(0xFF4F378B),
    onPrimaryContainer = Color(0xFFEADDFF),
)
```

Dark is not light with the colours inverted. The roles swap tone: a light scheme's `primary` is dark enough for white text on it, a dark scheme's `primary` is light enough for dark text. Generate both with the Material Theme Builder rather than by hand.

**Dynamic colour** derives a whole scheme from the user's wallpaper. It is available from Android 12 (API 31) and must be guarded:

```kotlin
val colorScheme = when {
    dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
        if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    darkTheme -> DarkColors
    else -> LightColors
}
```

Dynamic colour is a genuinely nice default for a personal app and the wrong default for a brand. Offer it as a setting, and remember that your brand colour is gone entirely when it is on.

Whether "dark" means dark is three inputs, not one: what the system is doing (`isSystemInDarkTheme()`), what the user chose in your app's own setting if you have one, and whether dynamic colour is both supported and enabled. Get that ladder right once, in the theme, and no screen ever thinks about it again.

## Typography

```kotlin
val AppTypography = Typography(
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp,
    ),
)
```

Material 3's scale has fifteen styles in five groups — `display`, `headline`, `title`, `body`, `label` — each in `Large`, `Medium` and `Small`. Pick by *role*, not by size: a section title is `titleMedium` even on the one screen where you wish it were smaller.

Font sizes are in `sp`, which scales with the user's font size setting; everything else is in `dp`, which does not. Use `sp` for text and only for text, never fix the height of a container around scaling text, and test at `fontScale = 2f`.

## Shapes

```kotlin
val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(28.dp),
)
```

Components pick from this scale by role: buttons use `small`, cards use `medium`, dialogs and bottom sheets use `extraLarge`. Changing `medium` restyles every card in the app at once — which is the entire point of putting it in the theme rather than in the card.

## Contrast, and who it is for

Contrast ratio is a number between 1 (identical) and 21 (black on white), computed from the relative luminance of two colours. WCAG asks for at least **4.5:1** for normal text, **3:1** for large text and for the boundary of an interactive component. Android's own accessibility scanner checks the same thing.

The Material colour roles are built to pass, which is most of why they exist. You break them by mixing pairs, by drawing text over an image, or by adding a brand colour by hand — and none of those look wrong on a bright desk in a dark room, which is why the number matters more than your eye.

```kotlin playground
// Two theme decisions, made properly: which scheme to use, and what colour text goes on a surface.
enum class Setting { LIGHT, DARK, SYSTEM }
enum class Scheme { LIGHT, DARK, DYNAMIC_LIGHT, DYNAMIC_DARK }

fun scheme(setting: Setting, systemInDark: Boolean, dynamicAvailable: Boolean, dynamicEnabled: Boolean): Scheme {
    val dark = setting == Setting.DARK || (setting == Setting.SYSTEM && systemInDark)
    val dynamic = dynamicAvailable && dynamicEnabled
    return when {
        dynamic && dark -> Scheme.DYNAMIC_DARK
        dynamic -> Scheme.DYNAMIC_LIGHT
        dark -> Scheme.DARK
        else -> Scheme.LIGHT
    }
}

fun channels(hex: String) = Triple(
    hex.substring(1, 3).toInt(16), hex.substring(3, 5).toInt(16), hex.substring(5, 7).toInt(16),
)

fun luminance(hex: String): Double {
    val (r, g, b) = channels(hex)
    fun channel(v: Int): Double {
        val s = v / 255.0
        return if (s <= 0.03928) s / 12.92 else Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

fun contrast(a: String, b: String): Double {
    val la = luminance(a)
    val lb = luminance(b)
    return (maxOf(la, lb) + 0.05) / (minOf(la, lb) + 0.05)
}

fun main() {
    println("which scheme?")
    for (setting in Setting.entries) for (systemDark in listOf(false, true)) {
        val plain = scheme(setting, systemDark, dynamicAvailable = true, dynamicEnabled = false)
        val dynamic = scheme(setting, systemDark, dynamicAvailable = true, dynamicEnabled = true)
        println("  setting=%-6s system=%-5s -> %-6s   with dynamic colour -> %s".format(setting, systemDark, plain, dynamic))
    }

    println("\nwhich 'on' colour, and does it pass WCAG AA for body text (4.5:1)?")
    for (background in listOf("#6750A4", "#D0BCFF", "#EADDFF", "#808080")) {
        val onWhite = contrast(background, "#FFFFFF")
        val onBlack = contrast(background, "#000000")
        val best = if (onWhite >= onBlack) "white" else "black"
        val ratio = maxOf(onWhite, onBlack)
        println("  %s -> %-5s %5.2f:1  %s".format(background, best, ratio, if (ratio >= 4.5) "pass" else "FAIL"))
    }
}
```

## Exercises

### 1. Which scheme?

Every themed app makes this decision once, at the top. `scheme(setting, systemInDark, dynamicAvailable, dynamicEnabled)` returns the colour scheme to use. It is dark when the user chose dark, or when they chose to follow the system and the system is dark. It is dynamic when the device supports it — API 31 and up — *and* the user has it switched on. The two questions are independent, and there are four answers.

```kotlin starter
enum class Setting { LIGHT, DARK, SYSTEM }
enum class Scheme { LIGHT, DARK, DYNAMIC_LIGHT, DYNAMIC_DARK }

fun scheme(setting: Setting, systemInDark: Boolean, dynamicAvailable: Boolean, dynamicEnabled: Boolean): Scheme {
    return if (systemInDark) Scheme.DARK else Scheme.LIGHT
}
```

```kotlin test
class SchemeTest {
    // the user's choice beats the system's
    @Test
    fun setting() {
        assertEquals(Scheme.LIGHT, scheme(Setting.LIGHT, systemInDark = true, dynamicAvailable = false, dynamicEnabled = false))
        assertEquals(Scheme.DARK, scheme(Setting.DARK, systemInDark = false, dynamicAvailable = false, dynamicEnabled = false))
        assertEquals(Scheme.DARK, scheme(Setting.SYSTEM, systemInDark = true, dynamicAvailable = false, dynamicEnabled = false))
        assertEquals(Scheme.LIGHT, scheme(Setting.SYSTEM, systemInDark = false, dynamicAvailable = false, dynamicEnabled = false))
    }

    // dynamic colour needs both support and consent
    @Test
    fun dynamic() {
        assertEquals(Scheme.DYNAMIC_LIGHT, scheme(Setting.LIGHT, systemInDark = true, dynamicAvailable = true, dynamicEnabled = true))
        assertEquals(Scheme.DYNAMIC_DARK, scheme(Setting.DARK, systemInDark = false, dynamicAvailable = true, dynamicEnabled = true))
        assertEquals(Scheme.LIGHT, scheme(Setting.LIGHT, systemInDark = false, dynamicAvailable = false, dynamicEnabled = true))
        assertEquals(Scheme.DARK, scheme(Setting.DARK, systemInDark = false, dynamicAvailable = true, dynamicEnabled = false))
    }

    // the two decisions are independent
    @Test
    fun combinations() {
        assertEquals(Scheme.DYNAMIC_DARK, scheme(Setting.SYSTEM, systemInDark = true, dynamicAvailable = true, dynamicEnabled = true))
        assertEquals(Scheme.DYNAMIC_LIGHT, scheme(Setting.SYSTEM, systemInDark = false, dynamicAvailable = true, dynamicEnabled = true))
        assertEquals(Scheme.DARK, scheme(Setting.SYSTEM, systemInDark = true, dynamicAvailable = false, dynamicEnabled = true))
        assertEquals(Scheme.LIGHT, scheme(Setting.SYSTEM, systemInDark = false, dynamicAvailable = true, dynamicEnabled = false))
    }
}
```

#### Uses
- [Material theming › Light, dark and dynamic](#/theming/light-dark-and-dynamic)
- [Material theming › What MaterialTheme holds](#/theming/what-materialtheme-holds)

#### Hints
- Work out two booleans first — `dark` and `dynamic` — then a four-branch `when`.
- `dark` is `setting == Setting.DARK || (setting == Setting.SYSTEM && systemInDark)`. The `LIGHT` setting ignores the system entirely.
- A `when { … }` with no subject reads better than nested `if`s for four cases; put the dynamic branches first so the dark ones are unambiguous.

#### Tips
- `systemInDark` comes from `isSystemInDarkTheme()`, which is itself Compose state — the theme recomposes when the user flips the system switch, with no work from you.
- Three settings rather than a `Boolean` is deliberate: "follow the system" is a different answer from "light", and an app with a two-state toggle cannot express it.
- `dynamicAvailable` is a version check in real code (`Build.VERSION.SDK_INT >= Build.VERSION_CODES.S`). Keeping it a parameter is what makes this decision testable at all.

#### Docs
- [Material 3 theming in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [Dynamic color](https://developer.android.com/develop/ui/views/theming/dynamic-colors)

### 2. Read a colour

`Color(0xFF6750A4)` is an ARGB literal, and a designer's hand-off is a string. `parseArgb(hex)` turns `"#RRGGBB"` (fully opaque, alpha `255`) or `"#AARRGGBB"` into its four channels, accepting upper or lower case, and returns `null` for anything else — a missing `#`, the wrong number of digits, a stray letter. `toHex(color)` goes back the other way, always in the eight-digit form, upper case.

```kotlin starter
data class Argb(val a: Int, val r: Int, val g: Int, val b: Int)

fun parseArgb(hex: String): Argb? {
    return Argb(255, 0, 0, 0)
}

fun toHex(color: Argb): String {
    return "#000000"
}
```

```kotlin test
class ColorTest {
    // six digits mean fully opaque
    @Test
    fun sixDigits() {
        assertEquals(Argb(255, 103, 80, 164), parseArgb("#6750A4"))
        assertEquals(Argb(255, 103, 80, 164), parseArgb("#6750a4"))
        assertEquals(Argb(255, 255, 255, 255), parseArgb("#FFFFFF"))
        assertEquals(Argb(255, 0, 0, 0), parseArgb("#000000"))
    }

    // eight digits carry the alpha
    @Test
    fun eightDigits() {
        assertEquals(Argb(255, 103, 80, 164), parseArgb("#FF6750A4"))
        assertEquals(Argb(128, 0, 0, 0), parseArgb("#80000000"))
        assertEquals(Argb(0, 255, 255, 255), parseArgb("#00ffffff"))
        assertEquals("#FF6750A4", toHex(Argb(255, 103, 80, 164)))
        assertEquals("#80000000", toHex(Argb(128, 0, 0, 0)))
        assertEquals("#FF6750A4", toHex(parseArgb("#6750A4")!!))
    }

    // anything else is not a colour
    @Test
    fun rejects() {
        assertNull("no hash", parseArgb("6750A4"))
        assertNull("five digits", parseArgb("#6750A"))
        assertNull("not hex", parseArgb("#GGGGGG"))
        assertNull("nothing", parseArgb(""))
        assertNull("just a hash", parseArgb("#"))
        assertNull("too many digits", parseArgb("#FF6750A400"))
    }
}
```

#### Uses
- [Material theming › Colour roles](#/theming/colour-roles)
- [Material theming › Light, dark and dynamic](#/theming/light-dark-and-dynamic)
- [Reference › Strings](#/reference/strings)

#### Hints
- Guard the shape first: it must start with `#`, and its remaining length must be 6 or 8.
- `"6750A4".toIntOrNull(16)` parses a hex string and gives `null` on a bad digit — do it per two-character slice, or once over the whole thing, and let the `null` fall through.
- `"%02X".format(value)` produces two upper-case hex digits with a leading zero when needed, which is what `toHex` needs four of.

#### Tips
- The eight-digit form is alpha-**first**, the same order as the `0xFF6750A4` literal you write in Kotlin. CSS puts alpha last, which is a good way to spend twenty minutes on a colour that is nearly invisible.
- `parseArgb` returning `null` rather than throwing is the right shape for something parsing data from outside your code — a theme file, a server-driven palette, a deep link.
- `Color(0xFF6750A4)` needs all eight digits. `Color(0x6750A4)` compiles and gives you a colour with alpha `0x00` — completely transparent, and a bug that looks like "my text disappeared".

#### Docs
- [Color in Compose](https://developer.android.com/develop/ui/compose/graphics/color)
- [Material 3 color schemes](https://developer.android.com/develop/ui/compose/designsystems/material3#color-schemes)

### 3. Enough contrast?

A colour role pair is only useful if you can check it. `contrastRatio(a, b)` returns the WCAG contrast ratio between two `"#RRGGBB"` colours, rounded to two decimal places: convert each channel to a linear value, weight them into a relative luminance, then divide the lighter plus `0.05` by the darker plus `0.05`. `bestOnColor(background)` returns whichever of `"#FFFFFF"` and `"#000000"` has the higher ratio against the background, preferring white on a tie. The `channels` function is written for you.

```kotlin starter
/** The red, green and blue channels of a "#RRGGBB" colour, each 0..255. Written for you. */
fun channels(hex: String): Triple<Int, Int, Int> = Triple(
    hex.substring(1, 3).toInt(16),
    hex.substring(3, 5).toInt(16),
    hex.substring(5, 7).toInt(16),
)

fun contrastRatio(a: String, b: String): Double {
    return 1.0
}

fun bestOnColor(background: String): String {
    return "#000000"
}
```

```kotlin test
class ContrastTest {
    // the two ends of the scale
    @Test
    fun extremes() {
        assertEquals(21.0, contrastRatio("#000000", "#FFFFFF"), 0.01)
        assertEquals(21.0, contrastRatio("#FFFFFF", "#000000"), 0.01)
        assertEquals(1.0, contrastRatio("#FFFFFF", "#FFFFFF"), 0.01)
        assertEquals(1.0, contrastRatio("#6750A4", "#6750A4"), 0.01)
    }

    // real Material colours
    @Test
    fun material() {
        assertEquals(6.44, contrastRatio("#6750A4", "#FFFFFF"), 0.01)
        assertEquals(3.26, contrastRatio("#6750A4", "#000000"), 0.01)
        assertEquals(12.32, contrastRatio("#D0BCFF", "#000000"), 0.01)
        assertEquals(16.29, contrastRatio("#EADDFF", "#000000"), 0.01)
        assertEquals(5.32, contrastRatio("#808080", "#000000"), 0.01)
    }

    // which "on" colour to draw with
    @Test
    fun onColor() {
        assertEquals("#FFFFFF", bestOnColor("#6750A4"))
        assertEquals("#000000", bestOnColor("#D0BCFF"))
        assertEquals("#000000", bestOnColor("#EADDFF"))
        assertEquals("#000000", bestOnColor("#808080"))
        assertEquals("#FFFFFF", bestOnColor("#000000"))
        assertEquals("#000000", bestOnColor("#FFFFFF"))
    }
}
```

#### Uses
- [Material theming › Contrast, and who it is for](#/theming/contrast-and-who-it-is-for)
- [Material theming › Colour roles](#/theming/colour-roles)
- [Reference › Numbers](#/reference/numbers)

#### Hints
- One channel, linearised: `if (s <= 0.03928) s / 12.92 else Math.pow((s + 0.055) / 1.055, 2.4)`, where `s` is the channel divided by `255.0`.
- Relative luminance weights them `0.2126 * r + 0.7152 * g + 0.0722 * b` — green dominates, because eyes do.
- Round with `Math.round(ratio * 100) / 100.0`, and remember the ratio puts the *lighter* colour on top, so use `maxOf` and `minOf` rather than assuming an order.

#### Tips
- 4.5:1 is the bar for body text, 3:1 for large or bold text and for the outline of a control. `#808080` on white is 3.95 — fine for a heading, not for a paragraph, and a very common mistake in a "subtle" secondary text colour.
- `bestOnColor` is a crude version of what generating a Material scheme does for you. It is worth having in a test when you add a brand colour by hand.
- Contrast is not the whole of colour accessibility: never use colour as the only signal, because the ratio can be perfect and the meaning still invisible to someone who cannot tell red from green.

#### Docs
- [Accessibility in Compose](https://developer.android.com/develop/ui/compose/accessibility)
- [Material 3 accessibility and colour](https://developer.android.com/develop/ui/compose/designsystems/material3#color-schemes)

### 4. A theme of your own

Build the app's theme: two hand-made colour schemes, dynamic colour offered as a setting, a type scale and a shape scale, applied from the activity. Not marked here — work the checklist, then compare with the solution.

#### Build it
- `AppTheme(darkTheme: Boolean = isSystemInDarkTheme(), dynamicColor: Boolean = true, content: @Composable () -> Unit)`.
- Light and dark schemes built with `lightColorScheme(...)` and `darkColorScheme(...)`, with at least `primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`, `surface` and `onSurface` set.
- Dynamic colour guarded by `Build.VERSION.SDK_INT >= Build.VERSION_CODES.S`, with `dynamicLightColorScheme(context)` and `dynamicDarkColorScheme(context)`.
- A `Typography` with at least one style changed from the default, and `Shapes` with the five sizes.
- `MainActivity` calls `enableEdgeToEdge()` and wraps `setContent` in `AppTheme`.
- The app looks right with the system in light mode, in dark mode, and with dynamic colour on a device running Android 12 or later.
- Nothing outside the theme file mentions a `Color(0x…)`.

```kotlin solution
// ui/theme/Theme.kt
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LightColors = lightColorScheme(
    primary = Color(0xFF6750A4),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEADDFF),
    onPrimaryContainer = Color(0xFF21005D),
    surface = Color(0xFFFEF7FF),
    onSurface = Color(0xFF1D1B20),
    surfaceVariant = Color(0xFFE7E0EC),
    onSurfaceVariant = Color(0xFF49454F),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF381E72),
    primaryContainer = Color(0xFF4F378B),
    onPrimaryContainer = Color(0xFFEADDFF),
    surface = Color(0xFF141218),
    onSurface = Color(0xFFE6E0E9),
    surfaceVariant = Color(0xFF49454F),
    onSurfaceVariant = Color(0xFFCAC4D0),
)

private val AppTypography = Typography(
    titleLarge = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    bodyLarge = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp,
    ),
)

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        shapes = AppShapes,
        content = content,
    )
}

// MainActivity.kt
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AppTheme {
                App()
            }
        }
    }
}
```

#### Uses
- [Material theming › What MaterialTheme holds](#/theming/what-materialtheme-holds)
- [Material theming › Light, dark and dynamic](#/theming/light-dark-and-dynamic)
- [Material theming › Typography](#/theming/typography)
- [Material theming › Shapes](#/theming/shapes)
- [Reference › Material theming](#/reference/material-theming)

#### Hints
- The [Material Theme Builder](https://m3.material.io/theme-builder) takes one seed colour and gives you both complete schemes as Kotlin. Paste them rather than inventing forty colours.
- `LocalContext.current` is how a composable reaches the `Context` that `dynamicLightColorScheme` needs.
- Dynamic colour cannot be seen in a preview — previews have no wallpaper. Check it on a device or an API 31+ emulator with a colourful wallpaper set.
- `enableEdgeToEdge()` is required from Android 15, where the system draws behind the bars whether you asked or not. Handle the insets in your scaffolds.

#### Tips
- Keep the theme in its own package (`ui/theme`) and keep the colour values `private` to it. If a screen can reach `LightColors`, one day a screen will.
- `MaterialTheme` is not the only way to carry design values. For anything Material has no role for — a gradient, a brand illustration colour — add your own `CompositionLocal` beside it rather than hardcoding.
- Pass `darkTheme` and `dynamicColor` as parameters with defaults, so the previews can force a particular combination.

#### Docs
- [Material 3 theming](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [Edge-to-edge display](https://developer.android.com/develop/ui/views/layout/edge-to-edge)

### 5. A component with no colours in it

Take a component — a status card, a price row, whatever your app needs — and build it so that every colour, size and corner comes from the theme. Then prove it by looking at it in four themes at once.

#### Build it
- A composable with no `Color(0x…)`, no `.dp` corner radius and no `.sp` font size anywhere in it.
- Every colour a role pair used together: text on `surface` is `onSurface`, text on `primaryContainer` is `onPrimaryContainer`.
- An emphasis state (selected, error, whatever suits) expressed by swapping *roles*, not by darkening a colour.
- Corners from `MaterialTheme.shapes`, text styles from `MaterialTheme.typography`.
- Four previews: light, dark, `fontScale = 2f`, and one wrapped in a second `MaterialTheme` with a completely different `primary` to prove the component followed it.
- The component is still legible in all four, with nothing clipped at the large font scale.

```kotlin solution
// StatusCard.kt
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Composable
fun StatusCard(
    title: String,
    detail: String,
    isError: Boolean,
    modifier: Modifier = Modifier,
) {
    val container = if (isError) {
        MaterialTheme.colorScheme.errorContainer
    } else {
        MaterialTheme.colorScheme.primaryContainer
    }
    val onContainer = if (isError) {
        MaterialTheme.colorScheme.onErrorContainer
    } else {
        MaterialTheme.colorScheme.onPrimaryContainer
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = container, contentColor = onContainer),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                text = detail,
                style = MaterialTheme.typography.bodyMedium,
                color = onContainer.copy(alpha = 0.8f),
            )
        }
    }
}

@Preview(name = "light", showBackground = true)
@Preview(name = "dark", showBackground = true, uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES)
@Preview(name = "large text", showBackground = true, fontScale = 2f)
@Composable
private fun StatusCardPreview() {
    AppTheme(dynamicColor = false) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StatusCard("All synced", "Last updated a minute ago", isError = false)
            StatusCard("Sync failed", "We will try again shortly", isError = true)
        }
    }
}

@Preview(name = "another brand", showBackground = true)
@Composable
private fun StatusCardOtherThemePreview() {
    MaterialTheme(
        colorScheme = MaterialTheme.colorScheme.copy(
            primaryContainer = Color(0xFFCDE5CF),
            onPrimaryContainer = Color(0xFF0B2010),
        ),
    ) {
        StatusCard("All synced", "The component followed the theme", isError = false, modifier = Modifier.padding(16.dp))
    }
}
```

#### Uses
- [Material theming › Colour roles](#/theming/colour-roles)
- [Material theming › Shapes](#/theming/shapes)
- [Material theming › Contrast, and who it is for](#/theming/contrast-and-who-it-is-for)
- [Composable functions › Previews](#/compose-basics/previews)

#### Hints
- `CardDefaults.cardColors(containerColor = …, contentColor = …)` sets both halves of the pair at once, and `contentColor` is inherited by the `Text`s inside, so most of them need no `color` at all.
- The "another brand" preview only works if the component reads `MaterialTheme.colorScheme` at composition time — which it does, because a `CompositionLocal` is read where it is used, not where it is defined.
- Search the file for `Color(` and `0xFF` before you call it done. The only match should be in the preview.
- `fontScale = 2f` is where a `Row` with fixed heights falls apart. Let text decide the height.

#### Tips
- `onContainer.copy(alpha = 0.8f)` is the acceptable form of "a bit dimmer" — it stays a function of the theme's colour rather than a new colour. Material 3 would rather you used a different role, but for secondary text within a container this is common and safe.
- A component that reads the theme is a component someone else can drop into a different app. That is the actual return on the discipline.
- Screenshot-testing the previews catches theme regressions a person never would. Paparazzi and Roborazzi both do it without a device.

#### Docs
- [Material 3 components](https://developer.android.com/develop/ui/compose/components)
- [Custom design systems in Compose](https://developer.android.com/develop/ui/compose/designsystems/custom)
