# Navigation

Navigation Compose keeps one `NavHost` composable that swaps its content according to a **back stack** of destinations. You do not push screens onto a stack of activities any more; you tell a `NavController` where to go, it changes the stack, and the host recomposes. The interesting part is not the API, it is the model underneath: a list you push to, pop from, and occasionally rewrite.

## What navigation is

A `NavController` owns a list of back stack entries. Each entry is a destination plus its arguments, its own `ViewModel` store and its own saved state. `navigate(route)` appends an entry; the system back gesture pops the last one; when the last entry pops, the app leaves the screen entirely.

```kotlin
val navController = rememberNavController()
NavHost(navController = navController, startDestination = Feed) {
    composable<Feed> { FeedScreen(onOpen = { id -> navController.navigate(Detail(id)) }) }
    composable<Detail> { entry -> DetailScreen(entry.toRoute<Detail>().id) }
}
```

`rememberNavController()` survives recomposition, and the host restores its stack after a configuration change. One `NavHost` per area of the app is normal; nesting them is not.

## Routes as types

Routes used to be strings with `{placeholders}` in them, and half the bugs were typos. Since Navigation 2.8 a route is a `@Serializable` class, and the library does the encoding:

```kotlin
@Serializable object Feed
@Serializable data class Detail(val id: Long, val tab: String = "info")
```

`navigate(Detail(42))` is checked by the compiler. Inside the destination, `entry.toRoute<Detail>()` gives the instance back, defaults and all. Arguments should be small and identifying — an id, a filter, a tab. Never pass a whole object through a route: it ends up serialized into a URL, it goes stale, and the next screen should be asking a repository for fresh data anyway.

Underneath, that class still becomes a path pattern like `detail/{id}?tab={tab}`, which is why deep links work at all and why an argument has to be something a string can carry.

## The back stack

`navigate` alone always appends, which is how you get eleven copies of the same screen after eleven taps. The options block is how you rewrite the stack instead:

```kotlin
navController.navigate(Feed) {
    popUpTo(Home) { inclusive = false }   // pop everything above Home
    launchSingleTop = true                // don't re-add if it's already on top
}
```

`popUpTo` removes entries until the named destination is on top, `inclusive = true` removes that one too, and `launchSingleTop` skips the push when the destination is already the top entry. A login flow that should not be returnable to is `popUpTo(Login) { inclusive = true }`. `popBackStack()` pops by hand and returns `false` when there was nothing to pop.

## Nested graphs

A `navigation<Graph>(startDestination = …)` block groups destinations into a sub-graph with its own start. Groups are how a bottom bar keeps a separate stack per tab, and how a multi-step flow shares a `ViewModel` scoped to the group rather than to one screen.

The standard bottom-bar navigate is worth memorising, because it is not obvious:

```kotlin
navController.navigate(tab) {
    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
    launchSingleTop = true
    restoreState = true
}
```

`saveState`/`restoreState` are what make a tab remember its scroll position when you come back to it.

## Deep links

A deep link maps an external URI onto a destination, so a notification or a link in an email lands on the right screen with the right arguments:

```kotlin
composable<Detail>(
    deepLinks = listOf(navDeepLink<Detail>(basePath = "https://example.com/detail"))
)
```

The matching is pattern against path: literal segments must be equal, placeholder segments capture, and query parameters fill in optional arguments. The one thing to get right is the synthetic back stack — arriving from outside should still leave a sensible "up" destination, which the start destination of the graph gives you for free.

## Getting a result back

Navigating forward is easy; handing something back is where people reach for a shared singleton. Don't. The back stack entry above you can write into the one below it:

```kotlin
// in the picker, before popping
navController.previousBackStackEntry?.savedStateHandle?.set("picked", id)
navController.popBackStack()

// in the caller
val handle = navController.currentBackStackEntry?.savedStateHandle
val picked by handle!!.getStateFlow<Long?>("picked", null).collectAsStateWithLifecycle()
```

It is saved state, so it survives process death, and it is scoped to the entry, so it disappears with the screen. If two screens need to share a whole editing session rather than one value, scope a `ViewModel` to a nested graph instead.

```kotlin playground
// A route pattern is a path with {placeholders}. Type-safe routes hide this, but it is what they compile to.
fun render(pattern: String, args: Map<String, String>): String =
    pattern.split("/").joinToString("/") { seg ->
        if (seg.startsWith("{") && seg.endsWith("}")) args[seg.trim('{', '}')] ?: error("missing ${seg}") else seg
    }

fun main() {
    val detail = "detail/{id}/tab/{tab}"
    println(render(detail, mapOf("id" to "42", "tab" to "reviews")))
    println(render("feed", emptyMap()))

    // The stack is just a list. Everything the NavController does to it, you could do by hand.
    var stack = listOf("feed")
    fun show(what: String) = println("%-28s %s".format(what, stack))

    stack = stack + "detail/42";                       show("navigate(Detail(42))")
    stack = stack + "detail/42";                       show("navigate again")
    stack = stack.dropLastWhile { it != "feed" };      show("popUpTo(Feed)")
    stack = stack.dropLast(1);                         show("back")
    println("back from here would leave the app: ${stack.size == 1}")
}
```

## Exercises

### 1. Match a route

Before the type-safe wrapper existed, every destination was a pattern like `detail/{id}` and the library matched incoming paths against it. Write that matcher.

`matchRoute(pattern, path)` returns the arguments captured from `path`, or `null` when the path does not belong to this route. A segment wrapped in braces captures whatever is in that position; every other segment must be equal to its counterpart. The number of segments must match exactly, and an empty segment never satisfies a placeholder.

A pattern with no placeholders matches only itself, and returns an empty map.

```kotlin starter
fun matchRoute(pattern: String, path: String): Map<String, String>? {
    return emptyMap()
}
```

```kotlin test
class MatchRouteTest {
    // literal routes match themselves and nothing else
    @Test
    fun literals() {
        assertEquals(emptyMap<String, String>(), matchRoute("feed", "feed"))
        assertEquals(emptyMap<String, String>(), matchRoute("settings/about", "settings/about"))
        assertEquals(null, matchRoute("feed", "profile"))
        assertEquals(null, matchRoute("settings/about", "settings/legal"))
    }

    // placeholders capture one segment each
    @Test
    fun captures() {
        assertEquals(mapOf("id" to "42"), matchRoute("detail/{id}", "detail/42"))
        assertEquals(mapOf("id" to "42", "tab" to "reviews"), matchRoute("detail/{id}/tab/{tab}", "detail/42/tab/reviews"))
        assertEquals(mapOf("name" to "ada lovelace"), matchRoute("user/{name}", "user/ada lovelace"))
    }

    // the shapes have to line up
    @Test
    fun shape() {
        assertEquals(null, matchRoute("detail/{id}", "detail"))
        assertEquals(null, matchRoute("detail/{id}", "detail/42/extra"))
        assertEquals(null, matchRoute("detail/{id}", "item/42"))
        assertEquals(null, matchRoute("detail/{id}", "detail/42/"))
    }

    // a placeholder needs something to capture
    @Test
    fun emptySegments() {
        assertEquals(null, matchRoute("detail/{id}", "detail/"))
        assertEquals(null, matchRoute("detail/{id}/tab/{tab}", "detail//tab/reviews"))
    }
}
```

#### Uses
- [Navigation › Routes as types](#/navigation/routes-as-types)

#### Hints
- Split both strings on `"/"` and compare the lists. If the sizes differ, nothing can match.
- A placeholder segment is one that `startsWith("{")` and `endsWith("}")`; `trim('{', '}')` gives you the name.
- Build the map as you walk the pairs, and `return null` the moment a literal disagrees.

#### Tips
- `"detail/42/".split("/")` is `["detail", "42", ""]` — three segments, not two. Trailing slashes are a classic source of "why doesn't my deep link work".
- Returning `null` for "no match" rather than an empty map is what lets the caller try the next pattern in the graph.
- The real `NavController` does this once per destination at registration time and matches a compiled pattern; the shape of the answer is the same.

#### Docs
- [Navigation with Compose](https://developer.android.com/develop/ui/compose/navigation)
- [Type-safe routes](https://developer.android.com/guide/navigation/design/type-safety)

### 2. Rewrite the back stack

`navigate(stack, route, popUpTo, inclusive, launchSingleTop)` returns the stack that a `NavController` would have after the call. The rules, in the order the library applies them:

1. If `popUpTo` is given and that route is somewhere in the stack, pop entries until it is on top; if `inclusive` is true, pop it as well. If it is not in the stack at all, the whole option is ignored.
2. Then, if `launchSingleTop` is true and the route is already the top entry, add nothing.
3. Otherwise append the route.

`back(stack)` pops the top entry and returns the new stack, or `null` when there was only one entry left — the point at which the system back gesture leaves the app.

```kotlin starter
fun navigate(
    stack: List<String>,
    route: String,
    popUpTo: String? = null,
    inclusive: Boolean = false,
    launchSingleTop: Boolean = false,
): List<String> = stack + route

fun back(stack: List<String>): List<String>? = stack
```

```kotlin test
class BackStackTest {
    // plain navigation appends, every time
    @Test
    fun appends() {
        assertEquals(listOf("feed", "detail"), navigate(listOf("feed"), "detail"))
        assertEquals(listOf("feed", "detail", "detail"), navigate(listOf("feed", "detail"), "detail"))
        assertEquals(listOf("feed"), navigate(emptyList(), "feed"))
    }

    // single top only skips when it is already on top
    @Test
    fun singleTop() {
        assertEquals(listOf("feed", "detail"), navigate(listOf("feed", "detail"), "detail", launchSingleTop = true))
        assertEquals(listOf("detail", "feed", "detail"), navigate(listOf("detail", "feed"), "detail", launchSingleTop = true))
        assertEquals(listOf("feed"), navigate(emptyList(), "feed", launchSingleTop = true))
    }

    // popUpTo cuts the stack down before pushing
    @Test
    fun popping() {
        assertEquals(listOf("home", "c"), navigate(listOf("home", "a", "b"), "c", popUpTo = "home"))
        assertEquals(listOf("c"), navigate(listOf("home", "a", "b"), "c", popUpTo = "home", inclusive = true))
        assertEquals(listOf("home", "a", "c"), navigate(listOf("home", "a", "b"), "c", popUpTo = "a"))
        assertEquals(listOf("home", "a", "b", "c"), navigate(listOf("home", "a", "b"), "c", popUpTo = "nowhere"))
    }

    // the login trick: pop yourself and land somewhere unreturnable
    @Test
    fun loginFlow() {
        assertEquals(listOf("home"), navigate(listOf("login"), "home", popUpTo = "login", inclusive = true))
        assertEquals(listOf("home"), navigate(listOf("home", "a"), "home", popUpTo = "home", launchSingleTop = true))
    }

    // back pops, and says when there is nothing left to pop to
    @Test
    fun backwards() {
        assertEquals(listOf("feed"), back(listOf("feed", "detail")))
        assertEquals(listOf("feed", "detail"), back(listOf("feed", "detail", "settings")))
        assertEquals(null, back(listOf("feed")))
        assertEquals(null, back(emptyList()))
    }
}
```

#### Uses
- [Navigation › The back stack](#/navigation/the-back-stack)

#### Hints
- `indexOfLast { it == popUpTo }` finds the entry to pop back to; `-1` means "not in the stack", which is the ignore case.
- Popping back to index `i` keeps `stack.take(i + 1)`; inclusive keeps `stack.take(i)`.
- Check `launchSingleTop` against the *popped* stack's last entry, not the original one — the fourth test depends on that order.

#### Tips
- The order matters and it is the order the real library uses: pop first, then decide whether the push is redundant. Swap them and the login case quietly grows a duplicate.
- `popUpTo` naming a destination that is not on the stack is silently ignored rather than an error, which is convenient and occasionally baffling.
- `popBackStack()` returning `false` is the real API's version of `back` returning `null`: nothing was popped, so you probably want to finish the activity.

#### Docs
- [Navigate with options](https://developer.android.com/guide/navigation/use-graph/navigate)
- [Back stack and up navigation](https://developer.android.com/guide/navigation/backstack)

### 3. Land the right deep link

An incoming URI has to be tried against every registered pattern until one fits. `resolveDeepLink(patterns, uri)` returns the pattern that matched and the arguments it produced, or `null` when nothing matches.

The `uri` may carry a query string. Everything before `?` is matched against the pattern exactly as in exercise 1; everything after it is split on `&` into `key=value` pairs and merged into the arguments. A pair with no `=`, an empty key or an empty value is ignored, and a query key never collides with a path argument in the tests. Patterns are tried in order, and the first one that matches wins.

```kotlin starter
fun resolveDeepLink(patterns: List<String>, uri: String): Pair<String, Map<String, String>>? {
    return null
}
```

```kotlin test
class DeepLinkTest {
    private val routes = listOf("shop/cart", "shop/item/{id}", "shop/{section}", "user/{name}/posts/{postId}")

    // the first pattern that fits wins
    @Test
    fun ordering() {
        assertEquals("shop/cart" to emptyMap<String, String>(), resolveDeepLink(routes, "shop/cart"))
        assertEquals("shop/item/{id}" to mapOf("id" to "9"), resolveDeepLink(routes, "shop/item/9"))
        assertEquals("shop/{section}" to mapOf("section" to "sale"), resolveDeepLink(routes, "shop/sale"))
        assertEquals("shop/{section}" to mapOf("section" to "item"), resolveDeepLink(routes, "shop/item"))
    }

    // query parameters become arguments too
    @Test
    fun query() {
        assertEquals(
            "shop/item/{id}" to mapOf("id" to "9", "tab" to "reviews"),
            resolveDeepLink(routes, "shop/item/9?tab=reviews"),
        )
        assertEquals(
            "shop/cart" to mapOf("ref" to "email", "campaign" to "spring"),
            resolveDeepLink(routes, "shop/cart?ref=email&campaign=spring"),
        )
        assertEquals(
            "user/{name}/posts/{postId}" to mapOf("name" to "ada", "postId" to "3"),
            resolveDeepLink(routes, "user/ada/posts/3"),
        )
    }

    // junk in the query is dropped, not fatal
    @Test
    fun messyQuery() {
        assertEquals("shop/cart" to emptyMap<String, String>(), resolveDeepLink(routes, "shop/cart?"))
        assertEquals("shop/cart" to emptyMap<String, String>(), resolveDeepLink(routes, "shop/cart?broken&=x&empty="))
        assertEquals("shop/cart" to mapOf("ok" to "1"), resolveDeepLink(routes, "shop/cart?broken&ok=1"))
    }

    // nothing fits
    @Test
    fun unmatched() {
        assertEquals(null, resolveDeepLink(routes, "admin/panel"))
        assertEquals(null, resolveDeepLink(routes, "shop/item/9/reviews"))
        assertEquals(null, resolveDeepLink(emptyList(), "shop/cart"))
    }
}
```

#### Uses
- [Navigation › Deep links](#/navigation/deep-links)
- [Navigation › Routes as types](#/navigation/routes-as-types)
- [Reference › Strings](#/reference/strings)

#### Hints
- `uri.substringBefore("?")` is the path and `uri.substringAfter("?", "")` is the query, with no null handling needed.
- The path half is exercise 1 again. Write `matchRoute` next to this function and call it.
- `query.split("&")` then `it.split("=")` gives the pairs; keep only the ones with exactly two parts and neither part empty.

#### Tips
- `firstNotNullOfOrNull { }` over the patterns gives you "first match wins" in one expression.
- Registration order really does decide which destination gets the link, so put the specific patterns before the greedy ones — `shop/item/{id}` before `shop/{section}`.
- The real `navDeepLink` also matches scheme and host; dropping them here changes nothing about the interesting part, which is the path.

#### Docs
- [Create a deep link for a destination](https://developer.android.com/guide/navigation/design/deep-link)

### 4. A two-screen app

Build a list-and-detail app with type-safe routes: tapping a row opens the detail screen for that item, the back gesture returns to the list with its scroll position intact.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- `kotlinx-serialization` and `androidx.navigation:navigation-compose` in the module's Gradle file.
- Two `@Serializable` route types: an object for the list and a `data class` carrying the item's id for the detail.
- One `NavHost` with a `composable<…>` for each, the list as the start destination.
- The detail screen reads its id with `entry.toRoute<…>()` and is given the id, not the whole item.
- The back gesture and a top-bar back button both return to the list; `popBackStack()` for the button.
- Tapping the same row twice in quick succession does not put two detail screens on the stack (`launchSingleTop = true`).

```kotlin solution
// Routes.kt
@Serializable
object ItemList

@Serializable
data class ItemDetail(val id: Long)

// AppNavigation.kt
@Composable
fun AppNavigation(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = ItemList) {
        composable<ItemList> {
            ItemListScreen(
                onOpen = { id -> navController.navigate(ItemDetail(id)) { launchSingleTop = true } },
            )
        }
        composable<ItemDetail> { entry ->
            val route: ItemDetail = entry.toRoute()
            ItemDetailScreen(id = route.id, onBack = { navController.popBackStack() })
        }
    }
}

@Composable
fun ItemListScreen(onOpen: (Long) -> Unit, viewModel: ItemListViewModel = viewModel()) {
    val items by viewModel.items.collectAsStateWithLifecycle()
    LazyColumn {
        items(items, key = { it.id }) { item ->
            ListItem(
                headlineContent = { Text(item.name) },
                modifier = Modifier.clickable { onOpen(item.id) },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemDetailScreen(id: Long, onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Item $id") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Text("Details for $id", modifier = Modifier.padding(padding))
    }
}
```

#### Uses
- [Navigation › Routes as types](#/navigation/routes-as-types)
- [Navigation › What navigation is](#/navigation/what-navigation-is)

#### Hints
- `rememberNavController()` belongs at the top of your navigation composable, and is passed down, not looked up.
- `composable<ItemDetail> { entry -> entry.toRoute<ItemDetail>() }` is how the arguments come back out.
- The detail screen should take `id: Long` and callbacks, not a `NavController`. That keeps it previewable and testable.

#### Tips
- `Icons.AutoMirrored.Filled.ArrowBack` flips itself in right-to-left locales; the old `Icons.Filled.ArrowBack` does not.
- Screens that never touch the `NavController` are the ones you can put in a `@Preview`. Hoist navigation into lambdas at the graph.
- `LazyColumn` restores its scroll position on the way back because the list entry's saved state is still on the stack. Recreating the `NavHost` is what loses it.

#### Docs
- [Navigation with Compose](https://developer.android.com/develop/ui/compose/navigation)
- [Type safety in Navigation Compose](https://developer.android.com/guide/navigation/design/type-safety)

### 5. Tabs that remember where they were

Add a bottom navigation bar with three tabs, each a nested graph with its own back stack. Switching away from a tab and back returns you to exactly where you were, including scroll position, and the back gesture from any tab's start destination returns to the first tab rather than leaving the app on the second press.

#### Build it
- Three `@Serializable` graph objects and, inside each, its own destinations.
- `navigation<TabGraph>(startDestination = …) { … }` blocks inside the `NavHost`, with the first tab's graph as the host's start destination.
- A `Scaffold` with a `NavigationBar` of three `NavigationBarItem`s, each with an icon and a label.
- The selected item is derived from `navController.currentBackStackEntryAsState()`, not from a separate `var selectedTab`.
- Tab taps navigate with `popUpTo(graph.findStartDestination().id) { saveState = true }`, `launchSingleTop = true` and `restoreState = true`.
- Scroll a list in tab one, visit tab two, come back: the scroll position is where you left it.

```kotlin solution
// Tabs.kt
@Serializable object FeedGraph
@Serializable object Feed
@Serializable data class Post(val id: Long)

@Serializable object SearchGraph
@Serializable object Search

@Serializable object ProfileGraph
@Serializable object Profile

data class Tab(val route: Any, val label: String, val icon: ImageVector)

val tabs = listOf(
    Tab(FeedGraph, "Feed", Icons.Default.Home),
    Tab(SearchGraph, "Search", Icons.Default.Search),
    Tab(ProfileGraph, "Profile", Icons.Default.Person),
)

@Composable
fun MainScaffold(navController: NavHostController = rememberNavController()) {
    val entry by navController.currentBackStackEntryAsState()
    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach { tab ->
                    val selected = entry?.destination?.hierarchy?.any { it.hasRoute(tab.route::class) } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = FeedGraph,
            modifier = Modifier.padding(padding),
        ) {
            navigation<FeedGraph>(startDestination = Feed) {
                composable<Feed> { FeedScreen(onOpenPost = { navController.navigate(Post(it)) }) }
                composable<Post> { entry -> PostScreen(id = entry.toRoute<Post>().id) }
            }
            navigation<SearchGraph>(startDestination = Search) {
                composable<Search> { SearchScreen() }
            }
            navigation<ProfileGraph>(startDestination = Profile) {
                composable<Profile> { ProfileScreen() }
            }
        }
    }
}
```

#### Uses
- [Navigation › Nested graphs](#/navigation/nested-graphs)
- [Navigation › The back stack](#/navigation/the-back-stack)
- [Reference › Navigation](#/reference/navigation)

#### Hints
- `entry?.destination?.hierarchy` walks a destination and its parent graphs, so a post inside the feed graph still marks the Feed tab as selected.
- `hasRoute(FeedGraph::class)` is the type-safe way to ask "is this that destination?"; comparing route strings is the old way.
- Without `saveState`/`restoreState` the tab is rebuilt from scratch every time, which is exactly the bug the checklist's last line is looking for.

#### Tips
- `contentDescription = null` on the tab icon is correct here: the `NavigationBarItem`'s label already names it, and a second announcement is noise.
- A tab bar with per-tab back stacks is the one place `popUpTo` with `saveState` earns its complexity. Everywhere else, prefer the plain version.
- Deriving the selection from the back stack rather than a `var` means the system back gesture also moves the highlight. A separate variable drifts out of sync the first time it is used.

#### Docs
- [Nested navigation graphs](https://developer.android.com/guide/navigation/design/nested-graphs)
- [Navigation bar](https://developer.android.com/develop/ui/compose/components/navigation-bar)
