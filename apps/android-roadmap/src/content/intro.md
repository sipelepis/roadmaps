# What is Android?

Android is a Linux-based operating system whose apps you write in Kotlin, and whose user interface you now build with Jetpack Compose: you describe what the screen should look like for the current state, and the framework works out what to redraw. This roadmap covers the platform, not the language. If Kotlin itself is new, read the Kotlin Roadmap first; here we assume you can read a data class, a lambda and a coroutine.

Every module is an article, a playground you can edit and run, and exercises. The exercises come in two kinds, and it is worth knowing which is which before you start.

## Two kinds of exercise

Most of what makes an app correct is ordinary Kotlin: what the state is, when to show a spinner, which items to keep, how to turn a response into something the screen can use. That code is compiled and run here by the official Kotlin Playground, with real tests, exactly like the other roadmaps.

The screens themselves are different. Compose needs the Android toolchain and a device or emulator, and no browser can give you that. So a screen is a **build task**: the problem tells you what to build, a checklist tells you what "done" looks like, and a reference solution is one click away when you want to compare. Nothing marks it for you. That is honest, and it is also how the job works — you look at the screen and decide whether it is right.

```kotlin playground
// Ordinary Kotlin, the kind an Android app is mostly made of: this runs right here.
data class Item(val id: Long, val name: String, val qty: Int)

sealed interface CartState {
    data object Loading : CartState
    data class Ready(val items: List<Item>) : CartState
    data class Failed(val message: String) : CartState
}

fun badge(state: CartState): String = when (state) {
    is CartState.Loading -> "…"
    is CartState.Failed -> "!"
    is CartState.Ready -> state.items.sumOf { it.qty }.let { if (it > 99) "99+" else it.toString() }
}

fun main() {
    val cart = CartState.Ready(listOf(Item(1, "Pen", 2), Item(2, "Pad", 3)))
    println(badge(CartState.Loading))
    println(badge(cart))
    println(badge(CartState.Ready(List(40) { Item(it.toLong(), "x", 3) })))
    println(badge(CartState.Failed("offline")))
}
```

## What an app is made of

An Android app is a set of components the system can start, declared in `AndroidManifest.xml`. In a modern Compose app there is usually exactly one that matters: a single `Activity` that hosts your whole interface.

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AppTheme { CartScreen() } }
    }
}
```

`setContent` hands the window to Compose. Everything from there down is composable functions.

## The tools

**Android Studio** is the IDE: emulator, layout inspector, profiler and the Gradle integration. **Gradle** builds the app and resolves dependencies. **The emulator** runs a virtual device; a physical phone with USB debugging is faster and more honest about performance. You will need Studio installed for the build tasks in this roadmap; the logic exercises need nothing but this page.

## What you will build here

The roadmap runs from a project and its Gradle files through composables, state, lists, navigation and theming, then into the parts that make an app real: lifecycle, coroutines, networking, storage, dependency injection, accessibility, testing, performance and shipping to Play. The graph on the home page shows what each module builds on.

## Exercises

### 1. Cart badge

`badge(state)` returns what the little number on the cart icon should say: `"…"` while loading, `"!"` when it failed, otherwise the total quantity across the items. A total above 99 shows as `"99+"`, and an empty cart shows `"0"`.

```kotlin starter
data class Item(val id: Long, val name: String, val qty: Int)

sealed interface CartState {
    data object Loading : CartState
    data class Ready(val items: List<Item>) : CartState
    data class Failed(val message: String) : CartState
}

fun badge(state: CartState): String {
    return ""
}
```

```kotlin test
class BadgeTest {
    // loading and failure have their own marks
    @Test
    fun nonReady() {
        assertEquals("…", badge(CartState.Loading))
        assertEquals("!", badge(CartState.Failed("offline")))
        assertEquals("!", badge(CartState.Failed("500")))
    }

    // the total counts quantities, not lines
    @Test
    fun totals() {
        assertEquals("5", badge(CartState.Ready(listOf(Item(1, "Pen", 2), Item(2, "Pad", 3)))))
        assertEquals("2", badge(CartState.Ready(listOf(Item(1, "Pen", 2)))))
        assertEquals("0", badge(CartState.Ready(emptyList())))
    }

    // ninety-nine is the last number you see
    @Test
    fun capped() {
        assertEquals("99", badge(CartState.Ready(listOf(Item(1, "Pen", 99)))))
        assertEquals("99+", badge(CartState.Ready(listOf(Item(1, "Pen", 100)))))
        assertEquals("99+", badge(CartState.Ready(List(40) { Item(it.toLong(), "x", 3) })))
    }
}
```

#### Uses
- [What is Android? › Two kinds of exercise](#/intro/two-kinds-of-exercise)
- [Reference › Assertions](#/reference/assertions)

#### Hints
- `when (state)` over a sealed interface is exhaustive, so the compiler tells you if you forget a case.
- `sumOf { it.qty }` adds up a property across the list. An empty list sums to `0`.
- Compare the total to `99` before turning it into a string.

#### Tips
- This is the kind of logic worth keeping out of a composable: it is pure, it is testable in milliseconds, and the screen just displays what it returns.
- `data object Loading` has no state of its own, so every reference to it is the same instance.

#### Docs
- [Sealed classes and interfaces](https://kotlinlang.org/docs/sealed-classes.html)
- [Compose: state and Jetpack Compose](https://developer.android.com/develop/ui/compose/state)

### 2. Your first screen

Create a new project in Android Studio (**Empty Activity**, which gives you a Compose app) and make its screen show a title and the cart badge from exercise 1 next to a shopping-cart icon. Run it on the emulator.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A new project from the **Empty Activity** template, running on an emulator or device.
- A composable `CartBadge(state: CartState)` that shows `badge(state)` as text.
- The `badge` logic lives in its own file, not inside the composable.
- The screen shows an `Icon` and the badge beside it, laid out with a `Row`.
- The app still builds after you change the state to `Loading` and back.

```kotlin solution
// MainActivity.kt
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                CartScreen(CartState.Ready(listOf(Item(1, "Pen", 2), Item(2, "Pad", 3))))
            }
        }
    }
}

@Composable
fun CartScreen(state: CartState) {
    Column(modifier = Modifier.padding(24.dp)) {
        Text("Your cart", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(16.dp))
        CartBadge(state)
    }
}

@Composable
fun CartBadge(state: CartState) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Default.ShoppingCart, contentDescription = "Cart")
        Spacer(Modifier.width(8.dp))
        Text(badge(state))
    }
}
```

#### Uses
- [What is Android? › What an app is made of](#/intro/what-an-app-is-made-of)
- [What is Android? › The tools](#/intro/the-tools)
- [Reference › Compose](#/reference/compose)

#### Hints
- File → New → New Project → Empty Activity. Accept the defaults; Studio generates a Compose app with a `MainActivity`.
- `setContent { }` in `onCreate` is where your composables go.
- `Icons.Default.ShoppingCart` needs `androidx.compose.material.icons.Icons`. Studio's import suggestion (Alt+Enter) adds it for you.

#### Tips
- Give `Icon` a real `contentDescription`. A screen reader reads it aloud, and an icon without one is invisible to the people who most need the label.
- The first build downloads a lot of Gradle and takes minutes. The second takes seconds.
- Use the `@Preview` annotation on a composable to see it without running the whole app.

#### Docs
- [Create a project in Android Studio](https://developer.android.com/studio/projects/create-project)
- [Compose: your first composable](https://developer.android.com/develop/ui/compose/documentation)
