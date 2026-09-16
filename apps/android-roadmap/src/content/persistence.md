# Room & DataStore

An app that only works when the network does is not an app, it is a website with a launcher icon. Storage is what makes the difference: notes that are there before the first byte arrives, a list that survives a flight, a setting that outlives an uninstall of the process. Android gives you two tools for it — **Room** for structured data you query, and **DataStore** for the handful of small values you would once have put in `SharedPreferences` — and one idea that matters more than either: the database, not the network, is the single source of truth.

## What goes where

The choice is easier than it looks, and getting it wrong is the usual cause of a slow app.

- **Room** — anything with rows: notes, messages, orders, cached responses. You want queries, indexes, relations and observable results.
- **DataStore** — a few dozen values at most: the selected theme, the sort order, whether onboarding is done. Typed with Protocol Buffers, or key-value with `Preferences`.
- **Files** — bytes you never query: images, exported PDFs, downloaded models. `context.filesDir` and `context.cacheDir`, where the second can be deleted by the system when storage runs low.
- **Nothing** — a value you can derive from something you already store. Derived state is the cheapest state.

Never keep credentials or tokens in plain DataStore. Those belong in `EncryptedSharedPreferences` or, better, the Android Keystore.

## Room: entities, DAOs and a database

Room is a compile-time-checked layer over SQLite. You describe three things and it generates the rest.

```kotlin
@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val body: String,
    val updatedAt: Long,
)

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE id = :id")
    suspend fun byId(id: Long): NoteEntity?

    @Upsert
    suspend fun upsert(note: NoteEntity)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun delete(id: Long)
}

@Database(entities = [NoteEntity::class], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun noteDao(): NoteDao
}
```

The SQL in `@Query` is parsed and checked when you compile, against the schema Room derived from your entities. A typo in a column name is a build error, not a crash on a customer's phone. That alone is worth the annotation processor.

Every DAO function that touches the database must either be `suspend` or return an observable type. Room refuses to run blocking queries on the main thread, and it is right to.

## Queries that return a Flow

A DAO function returning `Flow<List<NoteEntity>>` re-emits whenever any row in the tables it reads changes. You collect it once and the screen stays correct forever — no manual refresh after an insert, no "reload on resume".

```kotlin
class NoteRepository(private val dao: NoteDao, private val api: NoteApi) {
    val notes: Flow<List<Note>> = dao.observeAll().map { rows -> rows.map(NoteEntity::toNote) }

    suspend fun refresh() {
        api.fetchNotes().forEach { dao.upsert(it.toEntity()) }
    }
}
```

Notice what `refresh` returns: nothing. It writes to the database and stops. The screen finds out because the flow emits again. This is the shape the rest of this article keeps coming back to.

## Mapping rows to your own types

Do not let `NoteEntity` reach the UI. The entity is a description of a table — it has a `0` default on its primary key, it stores time as a `Long` because SQLite has no date type, and it changes when the schema changes. The screen wants a `Note`, with whatever shape suits the screen.

The mapping is the seam. A one-to-many query joins and therefore repeats: five tags on one note come back as five rows with the same note in them. Folding those rows back into one object per note is ordinary list code, and because it is ordinary list code you can test it in a millisecond. Exercise 4 is exactly that.

## Migrations

A database in your emulator is disposable. A database on a phone is somebody's data, and version 2 of your app has to open the file version 1 wrote. Bump `version` in `@Database` and give Room a `Migration` for each step.

```kotlin
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
    }
}

Room.databaseBuilder(context, AppDatabase::class.java, "app.db")
    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
    .build()
```

Three rules that will save you an incident:

1. **One migration per version step.** Room walks 1 → 2 → 3; it does not invent a shortcut unless you hand it one. Write them small, in order, and never edit a migration you have already shipped.
2. **Export the schema.** Set `room.schemaLocation` and commit the generated JSON. It is what `MigrationTestHelper` uses to open an old database and run your migration against it for real.
3. **`fallbackToDestructiveMigration()` deletes the user's data.** It is fine before your first release and nowhere after it.

## DataStore for preferences

`SharedPreferences` has a blocking API, silently swallows write errors, and its `commit()` on the main thread is a classic ANR. DataStore replaces it with a `Flow` and suspending writes.

```kotlin
private val SORT_KEY = stringPreferencesKey("sort_order")

val sortOrder: Flow<SortOrder> = context.dataStore.data
    .map { prefs -> SortOrder.valueOf(prefs[SORT_KEY] ?: SortOrder.NEWEST.name) }

suspend fun setSortOrder(order: SortOrder) {
    context.dataStore.edit { prefs -> prefs[SORT_KEY] = order.name }
}
```

`edit` is atomic and transactional: the read-modify-write cannot interleave with another one. Read the value with a default at the point of reading, as above, so a fresh install and a corrupted key behave the same way.

## Offline-first and the single source of truth

Offline-first is one rule applied without exception: **the UI reads from the database, and only the database writes come from the network.**

```
network → repository → database → Flow → ViewModel → screen
```

Nothing on that line lets a response go straight to the screen. It costs you one indirection and buys you a great deal: the first frame has data, a failed refresh leaves the screen intact, two screens showing the same note can never disagree, and rotation is free.

A write goes the other way, and this is where apps get interesting. Write locally first so the interface responds immediately, mark the row as unsynced, and let a background worker push it. If the push fails, the row is still there and still marked. If the push succeeds, clear the flag. When both sides changed, you have a conflict and you need a rule — last write wins by timestamp is the usual one, and it needs a tiebreaker for the case where the timestamps match. Exercise 2 makes you write that rule down.

## Cache invalidation

Stored data goes stale. Three questions decide how you handle it.

**How long is it good for?** Give a cached row the time it was written and treat it as missing past a time-to-live. A currency rate lives for a minute; a country list lives for a week.

**Who says it changed?** If the server can tell you — an ETag, a `Last-Modified`, a push message — believe it and skip the transfer. `If-None-Match` returning `304` is a refresh that costs almost nothing.

**When do you throw it away?** On sign-out, on a schema change, and when a size limit is hit. An unbounded cache is a slow storage leak: it never crashes, it just makes the device a little worse every week.

```kotlin playground
// A TTL cache and an offline-first merge — the two pieces of persistence that are pure Kotlin.
data class Note(val id: Long, val title: String, val updatedAt: Long)

class Cache<K, V>(private val ttlMs: Long) {
    private val entries = LinkedHashMap<K, Pair<V, Long>>()
    fun put(key: K, value: V, nowMs: Long) { entries[key] = value to nowMs }
    fun get(key: K, nowMs: Long): V? {
        val (value, storedAt) = entries[key] ?: return null
        if (nowMs - storedAt >= ttlMs) { entries.remove(key); return null }
        return value
    }
    fun size() = entries.size
}

/** Last write wins; when the clocks agree, the server does. */
fun merge(local: List<Note>, remote: List<Note>): List<Note> {
    val byId = local.associateBy { it.id }.toMutableMap()
    for (r in remote) {
        val l = byId[r.id]
        if (l == null || r.updatedAt >= l.updatedAt) byId[r.id] = r
    }
    return byId.values.sortedBy { it.id }
}

fun main() {
    val cache = Cache<Long, Note>(ttlMs = 1_000)
    cache.put(1, Note(1, "Milk", 0), nowMs = 0)
    println(cache.get(1, nowMs = 999)?.title)      // still fresh
    println(cache.get(1, nowMs = 1_000)?.title)    // expired, and dropped
    println("entries left: ${cache.size()}")

    val local = listOf(Note(1, "Milk (edited here)", 50), Note(2, "Bread", 10))
    val remote = listOf(Note(1, "Milk", 40), Note(2, "Bread (edited there)", 99), Note(3, "Jam", 5))
    merge(local, remote).forEach { println("${it.id}: ${it.title} @${it.updatedAt}") }

    val tie = merge(listOf(Note(9, "mine", 7)), listOf(Note(9, "theirs", 7)))
    println("tie goes to: ${tie.single().title}")
}
```

## Exercises

### 1. A cache with a time to live

`TtlCache` holds values that go stale. `put` stores a value with the moment it was written, and `get` hands it back only while it is still young enough. The clock is a parameter rather than a call to `System.currentTimeMillis()`, which is the whole reason this is testable at all.

An entry is stale once `nowMs - storedAt` reaches `ttlMs` — a TTL of 1000 means the value is good at 999 and gone at 1000. A `get` that finds a stale entry removes it, so `size()` drops. Putting the same key again replaces the value *and* the timestamp.

```kotlin starter
class TtlCache<K, V>(private val ttlMs: Long) {
    fun put(key: K, value: V, nowMs: Long) {
    }

    fun get(key: K, nowMs: Long): V? = null

    fun size(): Int = 0
}
```

```kotlin test
class TtlCacheTest {
    // a fresh value comes straight back
    @Test
    fun fresh() {
        val cache = TtlCache<String, Int>(1000)
        cache.put("a", 1, nowMs = 0)
        assertEquals(1, cache.get("a", nowMs = 0))
        assertEquals(1, cache.get("a", nowMs = 999))
        assertEquals(1, cache.size())
        assertNull(cache.get("missing", nowMs = 0))
    }

    // the moment the ttl is reached, it is gone
    @Test
    fun expires() {
        val cache = TtlCache<String, Int>(1000)
        cache.put("a", 1, nowMs = 0)
        assertNull(cache.get("a", nowMs = 1000))
        assertNull(cache.get("a", nowMs = 5000))
        assertEquals("a stale entry is dropped, not kept", 0, cache.size())
    }

    // writing again restarts the clock for that key
    @Test
    fun refreshed() {
        val cache = TtlCache<String, Int>(1000)
        cache.put("a", 1, nowMs = 0)
        cache.put("a", 2, nowMs = 900)
        assertEquals(2, cache.get("a", nowMs = 1500))
        assertNull(cache.get("a", nowMs = 1900))
    }

    // keys are independent
    @Test
    fun manyKeys() {
        val cache = TtlCache<String, String>(100)
        cache.put("a", "x", nowMs = 0)
        cache.put("b", "y", nowMs = 50)
        assertEquals(2, cache.size())
        assertNull(cache.get("a", nowMs = 120))
        assertEquals("y", cache.get("b", nowMs = 120))
        assertEquals(1, cache.size())
    }
}
```

#### Uses
- [Room & DataStore › Cache invalidation](#/persistence/cache-invalidation)
- [Room & DataStore › What goes where](#/persistence/what-goes-where)

#### Hints
- A `MutableMap<K, ...>` holding both the value and the time it was stored is all the state you need. A `Pair<V, Long>` or a small private class both work.
- `get` needs an early return for the missing key, then a staleness check, then the value.
- "Stale" is `nowMs - storedAt >= ttlMs`. Using `>` instead passes three tests and fails one.

#### Tips
- Passing the time in is the difference between a test that runs in a millisecond and a test that sleeps for a second and still flakes on CI.
- Real caches also need a size limit; a TTL alone lets a cache grow forever if every key is asked for once.
- `LinkedHashMap` keeps insertion order, which is the first step towards the LRU eviction you will write in the Performance module.

#### Docs
- [Cache data in your app](https://developer.android.com/topic/performance/power/network/gather-data)
- [Data layer](https://developer.android.com/topic/architecture/data-layer)

### 2. Last write wins

The device edited a note offline. So did the server. `merge(local, remote)` decides what the database should now contain.

Every id that appears on either side appears in the result, sorted by `id` ascending. When an id is on both sides, keep the version with the larger `updatedAt`. When the two timestamps are equal, keep the **remote** one: clocks on phones are not to be trusted, and picking a side consistently is what stops two devices from flip-flopping forever.

```kotlin starter
data class Note(val id: Long, val title: String, val updatedAt: Long)

fun merge(local: List<Note>, remote: List<Note>): List<Note> = local
```

```kotlin test
class MergeTest {
    // whichever side changed last
    @Test
    fun newerWins() {
        val local = listOf(Note(1, "local", 50))
        val remote = listOf(Note(1, "remote", 40))
        assertEquals(listOf(Note(1, "local", 50)), merge(local, remote))
        assertEquals(listOf(Note(1, "remote", 60)), merge(local, listOf(Note(1, "remote", 60))))
    }

    // the server breaks a tie
    @Test
    fun ties() {
        val merged = merge(listOf(Note(7, "mine", 7)), listOf(Note(7, "theirs", 7)))
        assertEquals(listOf(Note(7, "theirs", 7)), merged)
    }

    // a note only one side knows about is kept
    @Test
    fun oneSided() {
        val local = listOf(Note(2, "only local", 1))
        val remote = listOf(Note(3, "only remote", 1))
        assertEquals(listOf(Note(2, "only local", 1), Note(3, "only remote", 1)), merge(local, remote))
        assertEquals(local, merge(local, emptyList()))
        assertEquals(remote, merge(emptyList(), remote))
        assertEquals(emptyList<Note>(), merge(emptyList(), emptyList()))
    }

    // the result is in id order whatever order the inputs were in
    @Test
    fun ordered() {
        val local = listOf(Note(30, "c", 1), Note(10, "a", 9))
        val remote = listOf(Note(20, "b", 1), Note(10, "a2", 1))
        assertEquals(listOf(10L, 20L, 30L), merge(local, remote).map { it.id })
        assertEquals("a", merge(local, remote).first().title)
    }
}
```

#### Uses
- [Room & DataStore › Offline-first and the single source of truth](#/persistence/offline-first-and-the-single-source-of-truth)
- [Room & DataStore › Cache invalidation](#/persistence/cache-invalidation)

#### Hints
- Start from the local side keyed by id: `local.associateBy { it.id }.toMutableMap()`.
- Walk the remote list and overwrite the entry when there is nothing local, or when `r.updatedAt >= l.updatedAt`. That single `>=` is the tiebreak rule.
- Finish with `.values.sortedBy { it.id }`.

#### Tips
- A merge rule you cannot state in one sentence is a merge rule you will get wrong. "Newest wins, server breaks ties" fits on a sticky note and in a test.
- Last-write-wins quietly discards one of the two edits. When that is unacceptable — a shared document, a bank balance — you need per-field merging or a conflict the user resolves.
- Real rows also carry a `deleted` flag rather than being removed, because a row that is gone locally is indistinguishable from a row that never arrived.

#### Docs
- [Build an offline-first app](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [Schedule tasks with WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager)

### 3. Migrations, one step at a time

Room walks a database from its current version to the one your code expects, one version at a time, and refuses to open it if a step is missing. Write that walk.

`migrate(columns, from, to, migrations)` returns the column list after every step from `from` to `to` has been applied. Migrating to the version you are already on changes nothing. Migrating downwards is not supported: throw `IllegalArgumentException` with the message `"cannot migrate down from $from to $to"`. A missing step throws `IllegalStateException` with the message `"no migration from $v to ${v + 1}"`, naming the first step that is missing. The list of migrations arrives in no particular order and may contain steps you do not need.

```kotlin starter
class Migration(val from: Int, val to: Int, val apply: (List<String>) -> List<String>)

fun migrate(columns: List<String>, from: Int, to: Int, migrations: List<Migration>): List<String> = columns
```

```kotlin test
class MigrationTest {
    private fun steps() = listOf(
        Migration(2, 3) { it + "pinned" },
        Migration(1, 2) { it + "updatedAt" },
        Migration(3, 4) { it.filter { c -> c != "body" } },
        Migration(7, 8) { it + "never used" },
    )

    // every step in version order, whatever order they were given in
    @Test
    fun walksUp() {
        val start = listOf("id", "title", "body")
        assertEquals(listOf("id", "title", "body", "updatedAt"), migrate(start, 1, 2, steps()))
        assertEquals(listOf("id", "title", "body", "updatedAt", "pinned"), migrate(start, 1, 3, steps()))
        assertEquals(listOf("id", "title", "updatedAt", "pinned"), migrate(start, 1, 4, steps()))
        assertEquals(listOf("id", "title", "body", "pinned"), migrate(start, 2, 3, steps()))
    }

    // already there
    @Test
    fun noop() {
        val start = listOf("id")
        assertEquals(start, migrate(start, 4, 4, steps()))
        assertEquals(start, migrate(start, 1, 1, emptyList()))
    }

    // a gap in the chain is loud
    @Test
    fun missingStep() {
        var message: String? = null
        try {
            migrate(listOf("id"), 1, 6, steps())
        } catch (e: IllegalStateException) {
            message = e.message
        }
        assertEquals("no migration from 4 to 5", message)
    }

    // downgrades are refused
    @Test
    fun downwards() {
        var message: String? = null
        try {
            migrate(listOf("id"), 3, 1, steps())
        } catch (e: IllegalArgumentException) {
            message = e.message
        }
        assertEquals("cannot migrate down from 3 to 1", message)
    }
}
```

#### Uses
- [Room & DataStore › Migrations](#/persistence/migrations)
- [Room & DataStore › Room: entities, DAOs and a database](#/persistence/room-entities-daos-and-a-database)

#### Hints
- `require(from <= to) { "cannot migrate down from $from to $to" }` throws `IllegalArgumentException` with exactly that message.
- Loop `for (v in from until to)` and look for the step with `it.from == v && it.to == v + 1`.
- `?: error("no migration from $v to ${v + 1}")` throws `IllegalStateException`. Keep the result in a `var` that each step replaces.

#### Tips
- `until` stops one short, which is what you want: going from 1 to 3 applies the steps starting at 1 and at 2.
- Room's real `Migration` has the same shape, with a `SupportSQLiteDatabase` where this one has a list of columns.
- Test migrations against a real old database with `MigrationTestHelper` and the exported schema JSON. A migration that compiles is not a migration that works.

#### Docs
- [Migrate your Room database](https://developer.android.com/training/data-storage/room/migrating-db-versions)
- [Test your database](https://developer.android.com/training/data-storage/room/testing-db)

### 4. Flatten a join

A note has many tags, so the query that fetches both joins and repeats: one row per tag, with the note's columns copied into each. The screen wants one object per note.

`mapRows(rows)` folds the rows back. There is one `NoteWithTags` per distinct `noteId`, in the order that id first appears in `rows`. Its `title` comes from the first row for that id. Its `tags` are the non-null `tagName`s for that id, in row order, with duplicates removed. A note with no tags at all comes back from SQL as a single row with a null tag, and must produce an empty tag list — not a list containing nothing useful.

```kotlin starter
data class NoteRow(val noteId: Long, val noteTitle: String, val tagName: String?)

data class NoteWithTags(val id: Long, val title: String, val tags: List<String>)

fun mapRows(rows: List<NoteRow>): List<NoteWithTags> = emptyList()
```

```kotlin test
class MapRowsTest {
    // repeated note columns collapse into one object
    @Test
    fun groups() {
        val rows = listOf(
            NoteRow(1, "Shopping", "home"),
            NoteRow(1, "Shopping", "urgent"),
            NoteRow(2, "Standup", "work"),
        )
        assertEquals(
            listOf(
                NoteWithTags(1, "Shopping", listOf("home", "urgent")),
                NoteWithTags(2, "Standup", listOf("work")),
            ),
            mapRows(rows),
        )
    }

    // a left join gives an untagged note one row with a null tag
    @Test
    fun untagged() {
        val rows = listOf(NoteRow(5, "Alone", null))
        assertEquals(listOf(NoteWithTags(5, "Alone", emptyList())), mapRows(rows))
        assertEquals(emptyList<NoteWithTags>(), mapRows(emptyList()))
    }

    // first appearance decides the order, and duplicates go
    @Test
    fun orderAndDuplicates() {
        val rows = listOf(
            NoteRow(9, "Nine", "b"),
            NoteRow(4, "Four", "a"),
            NoteRow(9, "Nine", "b"),
            NoteRow(9, "Nine", "a"),
            NoteRow(4, "Four", null),
        )
        val out = mapRows(rows)
        assertEquals(listOf(9L, 4L), out.map { it.id })
        assertEquals(listOf("b", "a"), out[0].tags)
        assertEquals(listOf("a"), out[1].tags)
    }
}
```

#### Uses
- [Room & DataStore › Mapping rows to your own types](#/persistence/mapping-rows-to-your-own-types)
- [Room & DataStore › Queries that return a Flow](#/persistence/queries-that-return-a-flow)

#### Hints
- `rows.groupBy { it.noteId }` gives a map whose keys are in first-appearance order, which is exactly the order the result needs.
- Inside `.map { (id, group) -> ... }`, the title is `group.first().noteTitle`.
- `group.mapNotNull { it.tagName }.distinct()` drops the nulls and the repeats in one line.

#### Tips
- Room can do this for you with `@Relation`, and you should usually let it. Writing it once tells you what `@Relation` is actually doing, and what it costs.
- `groupBy` on a `List` returns a `LinkedHashMap`, so the order is defined. `toMap()` on an unordered source is not.
- If the join is large, the repeated note columns are real bytes crossing the SQLite boundary. Two queries are sometimes cheaper than one join.

#### Docs
- [Define relationships between objects](https://developer.android.com/training/data-storage/room/relationships)
- [Accessing data using Room DAOs](https://developer.android.com/training/data-storage/room/accessing-data)

### 5. A notes app that works on a plane

Build the real thing: a Room database, a DataStore preference, and a screen that reads from the database and never from the network directly. Turn on airplane mode and the list must still be there.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- `room-runtime`, `room-ktx` and the KSP `room-compiler` in the app's Gradle file, with `ksp { arg("room.schemaLocation", "$projectDir/schemas") }` and the generated JSON committed.
- A `NoteEntity`, a `NoteDao` with an `observeAll(): Flow<List<NoteEntity>>` and a suspending `upsert`, and an `AppDatabase` at version 1.
- A repository that exposes `Flow<List<Note>>` mapped from entities, plus a `refresh()` that writes into the DAO and returns nothing.
- A screen collecting that flow with `collectAsStateWithLifecycle()`, showing the notes in a `LazyColumn`.
- Adding a note updates the list with no manual refresh anywhere in your code.
- A `Preferences` DataStore holding the sort order, read as a flow with a default, written from a suspending function.
- Bump the database to version 2 with a new column and a `Migration(1, 2)`; install the old version first, then the new one, and confirm your notes are still there.

```kotlin solution
// NoteEntity.kt
@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val body: String,
    val updatedAt: Long,
    val pinned: Boolean = false,   // added in version 2
)

// NoteDao.kt
@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<NoteEntity>>

    @Upsert
    suspend fun upsert(note: NoteEntity)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun delete(id: Long)
}

// AppDatabase.kt
@Database(entities = [NoteEntity::class], version = 2)
abstract class AppDatabase : RoomDatabase() {
    abstract fun noteDao(): NoteDao
}

val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
    }
}

fun buildDatabase(context: Context): AppDatabase =
    Room.databaseBuilder(context, AppDatabase::class.java, "notes.db")
        .addMigrations(MIGRATION_1_2)
        .build()

// Settings.kt
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")
private val SORT_KEY = stringPreferencesKey("sort_order")

enum class SortOrder { NEWEST, TITLE }

class Settings(private val context: Context) {
    val sortOrder: Flow<SortOrder> = context.dataStore.data
        .map { prefs -> prefs[SORT_KEY]?.let(SortOrder::valueOf) ?: SortOrder.NEWEST }

    suspend fun setSortOrder(order: SortOrder) {
        context.dataStore.edit { prefs -> prefs[SORT_KEY] = order.name }
    }
}

// NoteRepository.kt
class NoteRepository(private val dao: NoteDao, private val api: NoteApi, private val settings: Settings) {
    val notes: Flow<List<Note>> = combine(dao.observeAll(), settings.sortOrder) { rows, order ->
        val notes = rows.map { Note(it.id, it.title, it.body, it.updatedAt) }
        when (order) {
            SortOrder.NEWEST -> notes.sortedByDescending { it.updatedAt }
            SortOrder.TITLE -> notes.sortedBy { it.title.lowercase() }
        }
    }

    /** Writes to the database. The screen finds out because [notes] emits again. */
    suspend fun refresh() {
        api.fetchNotes().forEach { dao.upsert(NoteEntity(it.id, it.title, it.body, it.updatedAt)) }
    }
}

// NotesViewModel.kt
class NotesViewModel(private val repo: NoteRepository) : ViewModel() {
    val notes: StateFlow<List<Note>> = repo.notes
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun refresh() = viewModelScope.launch { runCatching { repo.refresh() } }
}

// NotesScreen.kt
@Composable
fun NotesScreen(viewModel: NotesViewModel) {
    val notes by viewModel.notes.collectAsStateWithLifecycle()
    LazyColumn {
        items(notes, key = { it.id }) { note ->
            ListItem(headlineContent = { Text(note.title) }, supportingContent = { Text(note.body) })
        }
    }
}
```

#### Uses
- [Room & DataStore › Room: entities, DAOs and a database](#/persistence/room-entities-daos-and-a-database)
- [Room & DataStore › DataStore for preferences](#/persistence/datastore-for-preferences)
- [Room & DataStore › Offline-first and the single source of truth](#/persistence/offline-first-and-the-single-source-of-truth)
- [Room & DataStore › Migrations](#/persistence/migrations)
- [Reference › Room and DataStore](#/reference/room-and-datastore)

#### Hints
- Room's annotation processor runs through KSP now, not kapt: `ksp("androidx.room:room-compiler:<version>")` in `dependencies`, with the `com.google.devtools.ksp` plugin applied.
- `by preferencesDataStore(name = "settings")` must be a property on `Context` at the top level of a file. Creating two DataStores with the same name crashes at runtime.
- To prove the migration works, install the app, add notes, then bump the version, add the migration, and run again over the top. Do not uninstall in between — uninstalling is what hides a broken migration.
- Android Studio's **App Inspection** window opens the live database on a running device, so you can see exactly what your DAO wrote.

#### Tips
- The moment you call `fallbackToDestructiveMigration()` to make a crash go away, you have chosen to delete your users' data. Fix the migration instead.
- `collectAsStateWithLifecycle()` stops collecting when the screen goes to the background. Plain `collectAsState()` does not, and keeps the database query alive behind a stack of other screens.
- Give `items` a stable `key`. Without it, a change at the top of the list rebuilds everything below it — the Performance module comes back to this.

#### Docs
- [Save data in a local database using Room](https://developer.android.com/training/data-storage/room)
- [DataStore](https://developer.android.com/topic/libraries/architecture/datastore)
- [Migrate from SharedPreferences to DataStore](https://developer.android.com/topic/libraries/architecture/datastore#datastore-typed-prefs)
