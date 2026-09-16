# Lists & lazy layouts

A `Column` composes every child it is given, whether or not any of them is on screen. That is fine for six rows and fatal for six thousand. `LazyColumn` and `LazyRow` compose only what is visible plus a little either side, recycling as you scroll — the Compose equivalent of `RecyclerView`, without the adapter, the view holder or the three files.

The API is small. The interesting part is what you tell it about identity: give each item a stable key and Compose can follow an item through insertions, deletions and reorderings, keeping its state and its position. Leave the key out and every item is identified by its index, which changes whenever the list does.

## LazyColumn and LazyRow

```kotlin
LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp),
) {
    items(contacts) { contact ->
        ContactRow(contact)
    }
}
```

The lambda is not a composable — it is a `LazyListScope` builder, which describes *what items exist*, and the framework composes the ones it needs. That distinction explains the rules around it: you cannot write an `if` around a `Text` in there, you write `if (…) item { Text(…) }`.

Note `contentPadding` rather than `Modifier.padding`. Padding on the modifier clips the scrolling content at the edges; `contentPadding` scrolls with it, so the last item can come all the way up past the bottom inset and then settle. It is the difference between a list that feels right under a navigation bar and one that does not.

`Arrangement.spacedBy(8.dp)` puts space between items without a `Spacer` in each one, and — unlike padding inside the item — the space is not part of the item's own tap target.

## items, item and itemsIndexed

```kotlin
LazyColumn {
    item { Header() }                                    // exactly one
    items(contacts, key = { it.id }) { ContactRow(it) }  // one per element
    itemsIndexed(contacts) { index, c -> Text("$index $c") }
    items(20) { index -> Placeholder(index) }            // n items by index
    item { Footer() }
}
```

`item` and `items` can be interleaved in any order, which is how a list gets a header, a body and a footer without a wrapper.

## Keys, and why identity matters

```kotlin
items(messages, key = { it.id }) { message -> MessageRow(message) }
```

Without a key, item 3 is "whatever is third". Insert something at the top and every item's identity shifts by one: Compose thinks item 3 *changed* rather than moved, so it recomposes all of them, any `remember` inside them is reassigned to the wrong item, and animations run backwards. With a key, item 3 is "the message with id 91" wherever it ends up.

What keys buy you:

- **State stays with its item.** A row with an expanded/collapsed toggle, a half-typed reply, or an in-flight animation keeps them when the list around it changes.
- **Scroll position is anchored.** Prepend ten older messages and the user keeps looking at the message they were reading, rather than being thrown ten rows down.
- **`animateItem()` works.** Item move, insert and remove animations need to know what moved.

The key must be unique across the list and stable across recompositions, and it must be something a `Bundle` can hold — an `Int`, a `Long`, a `String`. A database id is perfect. The index is not a key, and neither is `hashCode()` of a mutable object.

## Item types

`contentType` tells the framework which items can reuse each other's composition:

```kotlin
LazyColumn {
    items(rows, key = { it.id }, contentType = { it::class }) { row ->
        when (row) {
            is Row.Header -> HeaderRow(row)
            is Row.Entry -> EntryRow(row)
        }
    }
}
```

When a header scrolls off the top and an entry scrolls in at the bottom, Compose would otherwise try to reuse the header's composition slot for an entry and throw all of its structure away. Telling it the types are different lets it reuse like for like. It is a pure optimisation — the list is correct without it — and it matters as soon as your list has two visibly different kinds of row.

Modelling a mixed list as a `sealed interface` of row types, built by a plain function from your data, is the pattern worth copying. The composable then has one `when`, and the interesting logic is testable without a device.

## Sticky headers

```kotlin
LazyColumn {
    groups.forEach { (letter, names) ->
        stickyHeader(key = "header-$letter", contentType = "header") {
            Text(letter.toString(), modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface))
        }
        items(names, key = { it.id }, contentType = { "entry" }) { NameRow(it) }
    }
}
```

`stickyHeader` pins the current header to the top of the viewport until the next one pushes it out. Give it an opaque background — it floats over the content, and a transparent header shows the rows sliding underneath it.

## Scroll state and paging

`rememberLazyListState()` gives you the list's scroll position, and it is also how you load the next page:

```kotlin
val listState = rememberLazyListState()

LaunchedEffect(listState) {
    snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
        .distinctUntilChanged()
        .collect { lastVisible -> if (shouldLoadMore(lastVisible, items.size)) viewModel.loadMore() }
}
```

`snapshotFlow` turns a state read into a `Flow`, so you observe the scroll in a coroutine instead of recomposing on every frame of it. Reading `listState.firstVisibleItemIndex` directly in a composable body subscribes that composable to a value that changes sixty times a second — the classic reason a list stutters.

Load the next page *before* the user reaches the end, by a prefetch distance of a few items, so the data is there when they arrive. Guard it with "am I already loading" and "is there anything left", or a fast scroll fires five requests for the same page. For anything more than a simple append, the Paging 3 library handles placeholders, retries, refresh and the loading states for you.

## What not to do

- **Never nest two scrollables on the same axis.** A `LazyColumn` inside a `Column` with `verticalScroll` is a crash or an infinite-height measure, depending on the day. Flatten it: the outer content becomes `item { }` blocks in the one lazy list.
- **`fillMaxHeight()` on a child of a `LazyColumn`** has no meaning: the constraint it fills is infinite.
- **Do not build the list inside the composable.** `items(all.filter { it.done })` creates a new list every recomposition, which makes it unstable and kills skipping. Compute it in the ViewModel.
- **Keys must be unique.** Duplicate keys throw at runtime, and the crash arrives weeks later, from the one user whose data has two rows with the same id.

```kotlin playground
// The two list problems that are pure Kotlin: grouping a flat list into rows, and diffing it by key.
data class Contact(val id: Long, val name: String)

sealed interface Row {
    data class Header(val letter: Char) : Row
    data class Entry(val contact: Contact) : Row
}

fun rows(contacts: List<Contact>): List<Row> {
    val out = mutableListOf<Row>()
    var letter: Char? = null
    for (contact in contacts.sortedBy { it.name.lowercase() }) {
        val first = contact.name.firstOrNull()?.uppercaseChar()?.takeIf { it.isLetter() } ?: '#'
        if (first != letter) {
            out += Row.Header(first)
            letter = first
        }
        out += Row.Entry(contact)
    }
    return out
}

fun main() {
    val contacts = listOf(
        Contact(1, "Ada Lovelace"), Contact(2, "grace hopper"),
        Contact(3, "Barbara Liskov"), Contact(4, "8th Street Cafe"), Contact(5, "Alan Turing"),
    )
    for (row in rows(contacts)) when (row) {
        is Row.Header -> println("── ${row.letter} ─────────────")
        is Row.Entry -> println("   ${row.contact.name}")
    }

    // Now somebody renames one contact, deletes another, and adds a new one.
    val after = listOf(
        Contact(1, "Ada Lovelace"), Contact(3, "Barbara Liskov"),
        Contact(5, "Alan Turing"), Contact(6, "Margaret Hamilton"),
    )
    val before = contacts.associateBy { it.id }
    val now = after.associateBy { it.id }
    println("\nadded:   ${after.filter { it.id !in before }.map { it.name }}")
    println("removed: ${contacts.filter { it.id !in now }.map { it.name }}")
    println("changed: ${after.filter { before[it.id]?.name?.let { old -> old != it.name } == true }.map { it.name }}")
    println("\nwith key = { it.id } that is three animations; without it, five rows that all 'changed'")
}
```

## Exercises

### 1. Diff by key

A keyed list can tell what actually happened between two versions of itself. `diff(old, new)` reports three things: the ids that are new, the ids that are gone, and the ids present in both whose content differs. Ids are unique within a list. Report `added` and `updated` in the order they appear in `new`, and `removed` in the order they appeared in `old`.

```kotlin starter
data class Item(val id: Long, val label: String)
data class Diff(val added: List<Long>, val removed: List<Long>, val updated: List<Long>)

fun diff(old: List<Item>, new: List<Item>): Diff {
    return Diff(new.map { it.id }, old.map { it.id }, listOf())
}
```

```kotlin test
class DiffTest {
    private val a = Item(1, "Ada")
    private val b = Item(2, "Barbara")
    private val c = Item(3, "Grace")

    // added and removed
    @Test
    fun membership() {
        assertEquals(Diff(listOf(3), listOf(), listOf()), diff(listOf(a, b), listOf(a, b, c)))
        assertEquals(Diff(listOf(), listOf(2), listOf()), diff(listOf(a, b), listOf(a)))
        assertEquals(Diff(listOf(1, 2), listOf(3), listOf()), diff(listOf(c), listOf(a, b)))
        assertEquals(Diff(listOf(), listOf(), listOf()), diff(listOf(a, b), listOf(a, b)))
    }

    // the same id with different content is an update, not a replacement
    @Test
    fun updates() {
        assertEquals(Diff(listOf(), listOf(), listOf(2)), diff(listOf(a, b), listOf(a, Item(2, "Barbara Liskov"))))
        assertEquals(listOf(1L, 2L), diff(listOf(a, b), listOf(Item(1, "A."), Item(2, "B."))).updated)
        assertEquals(listOf<Long>(), diff(listOf(a, b), listOf(b, a)).updated)
    }

    // reordering is not a change, and empty lists are not special
    @Test
    fun edges() {
        assertEquals(Diff(listOf(), listOf(), listOf()), diff(listOf(a, b, c), listOf(c, b, a)))
        assertEquals(Diff(listOf(1), listOf(), listOf()), diff(listOf(), listOf(a)))
        assertEquals(Diff(listOf(), listOf(1), listOf()), diff(listOf(a), listOf()))
        assertEquals(Diff(listOf(), listOf(), listOf()), diff(listOf(), listOf()))
        assertEquals(Diff(listOf(3), listOf(1), listOf(2)), diff(listOf(a, b), listOf(Item(2, "B"), c)))
    }
}
```

#### Uses
- [Lists & lazy layouts › Keys, and why identity matters](#/lists/keys-and-why-identity-matters)
- [State & recomposition › State that Compose can see](#/state/state-that-compose-can-see)
- [Reference › Collection operations](#/reference/collection-operations)

#### Hints
- `old.associateBy { it.id }` and the same for `new` give you two maps to look things up in.
- `added` is `new.filter { it.id !in oldById }.map { it.id }`; `removed` is the mirror image over `old`.
- `updated` is the ids in both maps where the two items are not equal — comparing the whole `Item` with `!=` is enough, since a data class compares its fields.

#### Tips
- The last assertion is the whole point: one list becoming another is usually a small number of real changes, and a keyed list can show exactly those. Without keys it is "five rows changed".
- Reordering producing an empty diff is why keys let `animateItem()` move a row instead of fading out one and fading in another.
- `associateBy` silently keeps the last of two items with the same key. In a `LazyColumn` a duplicate key throws instead, which is the better failure.

#### Docs
- [Lists and grids: item keys](https://developer.android.com/develop/ui/compose/lists#item-keys)
- [Animate item changes](https://developer.android.com/develop/ui/compose/lists#item-animations)

### 2. Rows with headers

A list with sticky headers is a flat list of two kinds of row, and building it is a plain function. `rows(contacts)` sorts the contacts case-insensitively by name and emits a `Header` every time the first letter changes, followed by an `Entry` for each contact. The header letter is the name's first character in upper case; a name that does not start with a letter — a number, a symbol, an empty string — goes under `'#'`.

```kotlin starter
data class Contact(val id: Long, val name: String)

sealed interface Row {
    data class Header(val letter: Char) : Row
    data class Entry(val contact: Contact) : Row
}

fun rows(contacts: List<Contact>): List<Row> {
    return contacts.map { Row.Entry(it) }
}
```

```kotlin test
class RowsTest {
    private val ada = Contact(1, "Ada")
    private val alan = Contact(2, "alan")
    private val barbara = Contact(3, "Barbara")

    // one header per letter, in sorted order, case-insensitively
    @Test
    fun headers() {
        assertEquals(
            listOf(Row.Header('A'), Row.Entry(ada), Row.Entry(alan), Row.Header('B'), Row.Entry(barbara)),
            rows(listOf(barbara, ada, alan)),
        )
        assertEquals(listOf(Row.Header('A'), Row.Entry(ada)), rows(listOf(ada)))
    }

    // anything that is not a letter is filed under #
    @Test
    fun nonLetters() {
        val cafe = Contact(4, "8th Street Cafe")
        val blank = Contact(5, "")
        assertEquals(
            listOf(Row.Header('#'), Row.Entry(blank), Row.Entry(cafe), Row.Header('A'), Row.Entry(ada)),
            rows(listOf(ada, cafe, blank)),
        )
    }

    // nothing to group
    @Test
    fun empty() {
        assertEquals(listOf<Row>(), rows(listOf()))
        assertEquals(2, rows(listOf(ada)).size)
        assertEquals(1, rows(listOf(ada, alan)).count { it is Row.Header })
    }
}
```

#### Uses
- [Lists & lazy layouts › Sticky headers](#/lists/sticky-headers)
- [Lists & lazy layouts › Item types](#/lists/item-types)
- [Composable functions › Keeping logic out of composables](#/compose-basics/keeping-logic-out-of-composables)

#### Hints
- Sort first: `contacts.sortedBy { it.name.lowercase() }`, so the grouping is one pass over sorted names.
- The letter for one name: `name.firstOrNull()?.uppercaseChar()?.takeIf { it.isLetter() } ?: '#'`.
- Keep the previous letter in a `var letter: Char? = null` and emit a header whenever the new one differs. `null` to start makes the first row always a header.

#### Tips
- Sorting by `lowercase()` rather than `Char.uppercaseChar()` on the first letter alone keeps `"Ada"` and `"alan"` in a sensible order within their group.
- `'#'` sorting before the letters falls out of the sort, not out of a special case — lowercased digits and symbols come before letters in this ordering.
- Building a `List<Row>` rather than a `Map<Char, List<Contact>>` is what lets the composable be one `when` over one `items(...)`, with one key space and one `contentType`.

#### Docs
- [Sticky headers](https://developer.android.com/develop/ui/compose/lists#sticky-headers)
- [Content type](https://developer.android.com/develop/ui/compose/lists#content-type)

### 3. When to load the next page

`shouldLoadMore` is the decision behind every infinite list, and getting it wrong means either a stutter at the bottom or five requests for the same page. It says yes when the last visible item is within `prefetchDistance` of the end of what has been loaded — and only if a load is not already running, the server has not said there is nothing left, something is actually visible, and something is actually loaded.

```kotlin starter
fun shouldLoadMore(
    lastVisibleIndex: Int,
    loadedCount: Int,
    prefetchDistance: Int,
    isLoading: Boolean,
    endReached: Boolean,
): Boolean {
    return lastVisibleIndex >= loadedCount - 1
}
```

```kotlin test
class LoadMoreTest {
    // within the prefetch distance of the end
    @Test
    fun nearTheEnd() {
        assertEquals(false, shouldLoadMore(13, 20, 5, false, false))
        assertEquals(true, shouldLoadMore(14, 20, 5, false, false))
        assertEquals(true, shouldLoadMore(19, 20, 5, false, false))
        assertEquals(true, shouldLoadMore(19, 20, 0, false, false))
        assertEquals(false, shouldLoadMore(18, 20, 0, false, false))
    }

    // already loading, or nothing left to load
    @Test
    fun guards() {
        assertEquals(false, shouldLoadMore(19, 20, 5, true, false))
        assertEquals(false, shouldLoadMore(19, 20, 5, false, true))
        assertEquals(false, shouldLoadMore(19, 20, 5, true, true))
    }

    // nothing visible, or nothing loaded
    @Test
    fun emptyList() {
        assertEquals(false, shouldLoadMore(-1, 0, 5, false, false))
        assertEquals(false, shouldLoadMore(-1, 20, 5, false, false))
        assertEquals(false, shouldLoadMore(0, 0, 5, false, false))
        assertEquals(true, shouldLoadMore(0, 1, 5, false, false))
    }
}
```

#### Uses
- [Lists & lazy layouts › Scroll state and paging](#/lists/scroll-state-and-paging)
- [Lists & lazy layouts › LazyColumn and LazyRow](#/lists/lazycolumn-and-lazyrow)
- [State & recomposition › derivedStateOf](#/state/derivedstateof)
- [Reference › Lists and lazy layouts](#/reference/lists-and-lazy-layouts)

#### Hints
- Deal with the four "no" cases first, each as its own early `return false`: loading, end reached, `lastVisibleIndex < 0`, `loadedCount == 0`.
- The remaining condition is one comparison: `lastVisibleIndex >= loadedCount - 1 - prefetchDistance`.
- Check it against the numbers in the first test: 20 items and a prefetch of 5 means index 14 triggers, index 13 does not.

#### Tips
- `loadedCount == 0` returning false is deliberate. The first page is loaded by the screen appearing, not by a scroll — otherwise an empty list requests page two.
- The `isLoading` guard has to be on state that updates *before* the request goes out, or a fast scroll fires several times before the first response comes back.
- Observing this from `snapshotFlow { … }.distinctUntilChanged()` rather than from the composable body keeps the scroll off the recomposition path entirely.

#### Docs
- [Paging library overview](https://developer.android.com/topic/libraries/architecture/paging/v3-overview)
- [Respond to scroll position](https://developer.android.com/develop/ui/compose/lists#react-to-scroll-position)

### 4. A contact list that keeps its place

Build the grouped contact list from exercise 2 as a real `LazyColumn`: sticky letter headers, keys on every row, and an expandable row whose state survives the list changing under it. Not marked here — work the checklist, then compare with the solution.

#### Build it
- One `LazyColumn` over the `List<Row>` your `rows()` function produces — not a `Column` inside a scroll, and not one `items` call per group.
- `key = ` on every item: `"header-A"` for headers and the contact's id for entries, so the two kinds never collide.
- `contentType = ` distinguishing headers from entries.
- Headers pinned with `stickyHeader`, with an opaque background so rows do not show through.
- Each entry expands on tap to reveal a detail line, with the expanded flag remembered per row.
- Removing a contact from the top of the list leaves an expanded row further down still expanded — the check that your keys are real.
- `contentPadding` rather than `Modifier.padding` for the space at the top and bottom of the list.

```kotlin solution
// ContactList.kt
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ContactList(contacts: List<Contact>, modifier: Modifier = Modifier) {
    val rows = rows(contacts)        // the pure function from exercise 2
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
    ) {
        items(
            items = rows,
            key = { row ->
                when (row) {
                    is Row.Header -> "header-${row.letter}"
                    is Row.Entry -> row.contact.id
                }
            },
            contentType = { row -> if (row is Row.Header) "header" else "entry" },
        ) { row ->
            when (row) {
                is Row.Header -> LetterHeader(row.letter)
                is Row.Entry -> ContactItem(row.contact)
            }
        }
    }
}

@Composable
private fun LetterHeader(letter: Char, modifier: Modifier = Modifier) {
    Text(
        text = letter.toString(),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)   // opaque: it floats over the rows
            .padding(horizontal = 16.dp, vertical = 4.dp),
    )
}

@Composable
private fun ContactItem(contact: Contact, modifier: Modifier = Modifier) {
    var expanded by rememberSaveable(contact.id) { mutableStateOf(false) }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded }
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Text(text = contact.name, style = MaterialTheme.typography.bodyLarge)
        if (expanded) {
            Text(
                text = "id ${contact.id}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
```

#### Uses
- [Lists & lazy layouts › Keys, and why identity matters](#/lists/keys-and-why-identity-matters)
- [Lists & lazy layouts › Item types](#/lists/item-types)
- [Lists & lazy layouts › Sticky headers](#/lists/sticky-headers)
- [Layout & modifiers › Order changes what you see](#/layout/order-changes-what-you-see)

#### Hints
- `stickyHeader` needed `@OptIn(ExperimentalFoundationApi::class)` for a long time; on current Compose Foundation it is stable, and the IDE will tell you which you have.
- To use `stickyHeader` you need the groups, not the flat list, so either iterate the groups in the `LazyListScope` or keep the flat list and draw headers as ordinary items. Both are legitimate; the flat list keeps one key space.
- Prefixing header keys with a string keeps them from colliding with numeric contact ids. Two items with the same key crash the list.
- `rememberSaveable(contact.id)` re-keys the remembered flag to the contact, so a recycled composition slot never shows another contact's expanded state.

#### Tips
- Test the keys by deleting a contact above an expanded row. If the wrong row collapses, an index is being used as identity somewhere.
- `Modifier.clickable` before the padding again: a row whose tap target stops at the text is a row that feels broken.
- `contentType` is worth adding the moment there are two kinds of row, and costs one lambda.

#### Docs
- [Lists and grids](https://developer.android.com/develop/ui/compose/lists)
- [LazyColumn](https://developer.android.com/reference/kotlin/androidx/compose/foundation/lazy/package-summary#LazyColumn(androidx.compose.ui.Modifier,androidx.compose.foundation.lazy.LazyListState,androidx.compose.foundation.layout.PaddingValues,kotlin.Boolean,androidx.compose.foundation.layout.Arrangement.Vertical,androidx.compose.ui.Alignment.Horizontal,androidx.compose.foundation.gestures.FlingBehavior,kotlin.Boolean,kotlin.Function1))

### 5. An endless list

Wire the paging decision from exercise 3 to a real list: watch the scroll position, load the next page before the user gets there, and show a footer while it loads.

#### Build it
- `rememberLazyListState()`, passed to the `LazyColumn` as its `state`.
- A `LaunchedEffect` with `snapshotFlow { … }`, `distinctUntilChanged()` and `collect`, observing the last visible item index — no scroll state read in the composable body.
- The `collect` calls your `shouldLoadMore(...)` and asks the ViewModel to load; the composable itself makes no decisions.
- A footer `item { }` showing a `CircularProgressIndicator` while loading, and an end-of-list message when everything has been loaded.
- Scrolling fast to the bottom fires exactly one request per page — log each request and check.
- Every row still has a stable key.

```kotlin solution
// FeedList.kt
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun FeedList(
    items: List<Item>,
    isLoading: Boolean,
    endReached: Boolean,
    onLoadMore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberLazyListState()

    LaunchedEffect(listState, items.size, isLoading, endReached) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .distinctUntilChanged()
            .collect { lastVisible ->
                if (shouldLoadMore(lastVisible, items.size, prefetchDistance = 5, isLoading, endReached)) {
                    onLoadMore()
                }
            }
    }

    LazyColumn(state = listState, modifier = modifier.fillMaxSize()) {
        items(items = items, key = { it.id }) { item ->
            Text(
                text = item.label,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }
        if (isLoading) {
            item(key = "loading", contentType = "footer") {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
        } else if (endReached) {
            item(key = "end", contentType = "footer") {
                Text(
                    text = "That is everything",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                )
            }
        }
    }
}
```

#### Uses
- [Lists & lazy layouts › Scroll state and paging](#/lists/scroll-state-and-paging)
- [Lists & lazy layouts › What not to do](#/lists/what-not-to-do)
- [State & recomposition › Unidirectional data flow](#/state/unidirectional-data-flow)

#### Hints
- `snapshotFlow` is in `androidx.compose.runtime`; `distinctUntilChanged` is a `kotlinx.coroutines.flow` operator, not a Compose one.
- The `LaunchedEffect` keys decide when the collector restarts. Keying it on `items.size` restarts the flow after each page arrives, which is what makes the next decision use the new count.
- The footer must be a separate `item { }` inside the lazy scope, never a composable after the `LazyColumn` — that one would sit below the screen forever.
- Log every `onLoadMore()` call. Two log lines for one page is the bug this exercise is about.

#### Tips
- Everything above is presentation: the list does not know what a page is, and the ViewModel does not know what is visible. That line is what keeps both testable.
- Once this works by hand you have earned Paging 3, which does the same job with placeholders, retry and refresh — and which is a lot of machinery to adopt before you have felt the problem.
- `visibleItemsInfo.lastOrNull()?.index` counts the footer as an item too. Either subtract it or compare against the full item count; being off by one here means loading one screen too late.

#### Docs
- [Respond to scroll position](https://developer.android.com/develop/ui/compose/lists#react-to-scroll-position)
- [Paging with Compose](https://developer.android.com/topic/libraries/architecture/paging/v3-paged-data#display-paged-data)
