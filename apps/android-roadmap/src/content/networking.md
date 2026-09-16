# Networking

Almost every app is a client for something. The mechanics are well solved — Retrofit or Ktor over OkHttp, a serialization library, a suspend function per endpoint — and none of that is the hard part. The hard part is everything around the happy path: what the app shows when the server says 500, what it does with a field the backend forgot to send, and what happens when the train goes into a tunnel.

## The shape of a client

A modern client is three thin layers. An interface describing the endpoints, a client object configured once, and a repository that turns responses into something the rest of the app can use.

```kotlin
interface CartApi {
    @GET("cart")
    suspend fun cart(): List<ItemDto>

    @GET("items/{id}")
    suspend fun item(@Path("id") id: Long): ItemDto
}
```

Retrofit generates the implementation; the functions are `suspend` and they already move themselves off the main thread, so you do not wrap them in `withContext`. Ktor's `HttpClient` is the same idea with the call written out rather than annotated. Both sit on OkHttp, which is where timeouts, retries, caching, logging and authentication are configured — once, in one place, for the whole app.

The client is expensive to build and holds a connection pool and a thread pool. Build exactly one and share it, which in practice means letting dependency injection own it.

## Serialization

`kotlinx.serialization` is the default now: add the plugin, mark the class `@Serializable`, and the compiler writes the parser at build time — no reflection, small, fast, and it works with R8.

```kotlin
@Serializable
data class ItemDto(
    val id: Long,
    val name: String,
    @SerialName("price_cents") val priceCents: Int? = null,
    val tags: List<String> = emptyList(),
)
```

Two habits worth forming immediately. Give every field a default so a missing key is not a crash. And configure the parser to ignore what it does not know:

```kotlin
val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
```

A backend adding a field should never break a shipped app, and without `ignoreUnknownKeys` it does.

## DTO is not your model

The DTO mirrors the wire: nullable, snake_case, full of ids and flags and the occasional empty string that means "nothing". Your domain model is what the app wants: non-null, well named, with the invalid states already gone.

```kotlin
fun ItemDto.toItem(): Item? {
    val id = id ?: return null
    val name = name?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return Item(id = id, name = name, price = Money(priceCents ?: 0), tags = tags.orEmpty())
}
```

Mapping at the edge is the single highest-value habit in this module. Do it and every screen downstream works with values that cannot be null and cannot be nonsense, and the one place that has to cope with the backend's mood is a pure function you can test in milliseconds. Skip it and `dto.name ?: ""` spreads through the UI layer for the rest of the app's life.

A row that cannot be mapped is dropped, not crashed on — one bad item in a list of fifty should cost you that item, not the screen.

## Errors are data

An exception thrown out of a repository is a failure mode the UI has to guess about. Return the failure instead, as a value the screen can render:

```kotlin
sealed interface ApiError {
    data object Offline : ApiError
    data object Timeout : ApiError
    data class NotFound(val what: String) : ApiError
    data class Server(val code: Int) : ApiError
    data class Unexpected(val message: String) : ApiError
}
```

Then one wrapper turns the exception world into the value world:

```kotlin
suspend fun <T> safeCall(block: suspend () -> T): Result<T> =
    try { Result.success(block()) }
    catch (e: CancellationException) { throw e }
    catch (e: UnknownHostException) { Result.failure(ApiException(ApiError.Offline)) }
    catch (e: SocketTimeoutException) { Result.failure(ApiException(ApiError.Timeout)) }
```

`catch (e: CancellationException) { throw e }` first, always. Swallowing it turns a cancelled screen into a permanent spinner.

The classification matters because the *response* differs: offline deserves "you're offline" and an automatic retry when connectivity returns; a 404 deserves "this item is gone" and no retry at all; a 500 deserves "something went wrong on our side" and a retry button. One generic "Error" string for all of them is the laziest possible UX.

## Timeouts and retries

OkHttp's defaults are ten seconds each for connect, read and write, which is a very long time to stare at a spinner. Set them deliberately:

```kotlin
OkHttpClient.Builder()
    .connectTimeout(10.seconds.toJavaDuration())
    .readTimeout(15.seconds.toJavaDuration())
    .retryOnConnectionFailure(true)
    .build()
```

Retry the failures that might go away — a timeout, a dropped connection, a 503, a 429 — with exponential backoff and jitter. Never retry a 400, a 401 or a 404: the answer will be the same every time, and retrying a non-idempotent `POST` can charge someone twice. Cap the total attempts, and cap the total time, because the user is waiting.

## Caching

OkHttp has an HTTP cache, and it is free if the server sends the headers:

```kotlin
OkHttpClient.Builder()
    .cache(Cache(File(context.cacheDir, "http"), 10L * 1024 * 1024))
    .build()
```

`Cache-Control: max-age=300` means a response may be reused without asking for five minutes. `no-cache` means "reuse it only after revalidating" — an `ETag` or `If-Modified-Since` request that usually comes back `304 Not Modified` and costs almost nothing. `no-store` means never write it down at all, which is what you want for anything private.

The HTTP cache handles freshness. It does not make the app work offline — that is a database, which is the next module's subject. The division is worth stating: the HTTP cache saves requests, a local database is the source of truth the UI reads from.

```kotlin playground
import kotlinx.coroutines.*
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

// The failure the screen renders, not the exception the socket threw.
data class Failure(val message: String, val retryable: Boolean)

sealed interface Outcome<out T> {
    data class Ok<T>(val value: T) : Outcome<T>
    data class Failed(val failure: Failure) : Outcome<Nothing>
}

suspend fun <T> safeCall(block: suspend () -> T): Outcome<T> = try {
    Outcome.Ok(block())
} catch (e: CancellationException) {
    throw e                                     // never swallow this one
} catch (e: UnknownHostException) {
    Outcome.Failed(Failure("You appear to be offline", retryable = false))
} catch (e: SocketTimeoutException) {
    Outcome.Failed(Failure("The server took too long", retryable = true))
} catch (e: IOException) {
    Outcome.Failed(Failure("Could not reach the server", retryable = true))
} catch (e: IllegalStateException) {
    Outcome.Failed(Failure(e.message ?: "Something went wrong", retryable = false))
}

fun main() = runBlocking {
    val calls: List<Pair<String, suspend () -> String>> = listOf(
        "happy path" to { delay(20); "{\"id\":1,\"name\":\"Pen\"}" },
        "aeroplane mode" to { throw UnknownHostException("api.example.com") },
        "slow server" to { throw SocketTimeoutException("read timed out") },
        "tunnel" to { throw IOException("unexpected end of stream") },
        "http 404" to { throw IllegalStateException("That item no longer exists") },
    )

    for ((label, call) in calls) {
        when (val out = safeCall(call)) {
            is Outcome.Ok -> println("%-16s ok       %s".format(label, out.value))
            is Outcome.Failed -> println(
                "%-16s failed   %-30s retry: %s".format(label, out.failure.message, out.failure.retryable)
            )
        }
    }
}
```

## Exercises

### 1. Map the wire onto the app

`ItemDto` is what the backend sends: everything nullable, because it is. `Item` is what the app wants: nothing nullable that the UI would have to think about.

`toItem(dto)` returns the mapped item, or `null` when the row cannot be trusted:

- `id` must be present and greater than zero.
- `name` must be present and not blank; the mapped name is trimmed.
- `priceCents` must be present and not negative; the mapped `price` is it formatted as `"$12.34"` — always two decimal places, no thousands separator.
- `imageUrl` is kept as-is when it is a non-blank string, and becomes `null` when it is missing or blank.
- `tags` become a list with each tag trimmed, the blank ones dropped, and the original order kept; a missing list becomes an empty one.

`toItems(dtos)` maps a whole response and silently drops the rows that did not map.

```kotlin starter
data class ItemDto(
    val id: Long? = null,
    val name: String? = null,
    val priceCents: Int? = null,
    val imageUrl: String? = null,
    val tags: List<String>? = null,
)

data class Item(
    val id: Long,
    val name: String,
    val price: String,
    val imageUrl: String?,
    val tags: List<String>,
)

fun toItem(dto: ItemDto): Item? = Item(0, "", "$0.00", null, emptyList())

fun toItems(dtos: List<ItemDto>): List<Item> = emptyList()
```

```kotlin test
class MappingTest {
    // a complete row maps straight across
    @Test
    fun complete() {
        val dto = ItemDto(7, "Fountain pen", 1234, "https://img/7.png", listOf("stationery", "gift"))
        assertEquals(
            Item(7, "Fountain pen", "$12.34", "https://img/7.png", listOf("stationery", "gift")),
            toItem(dto),
        )
    }

    // money is formatted, never rounded away
    @Test
    fun prices() {
        assertEquals("$0.00", toItem(ItemDto(1, "a", 0))?.price)
        assertEquals("$0.05", toItem(ItemDto(1, "a", 5))?.price)
        assertEquals("$0.50", toItem(ItemDto(1, "a", 50))?.price)
        assertEquals("$9.99", toItem(ItemDto(1, "a", 999))?.price)
        assertEquals("$1000.00", toItem(ItemDto(1, "a", 100000))?.price)
    }

    // the tidying up the UI should never have to do
    @Test
    fun tidies() {
        val dto = ItemDto(3, "  Pad  ", 100, "   ", listOf(" gift ", "", "  ", "new"))
        assertEquals(Item(3, "Pad", "$1.00", null, listOf("gift", "new")), toItem(dto))
        assertEquals(emptyList<String>(), toItem(ItemDto(3, "Pad", 100))?.tags)
        assertEquals(null, toItem(ItemDto(3, "Pad", 100, null))?.imageUrl)
    }

    // rows the app cannot use
    @Test
    fun rejects() {
        assertEquals(null, toItem(ItemDto(null, "Pad", 100)))
        assertEquals(null, toItem(ItemDto(0, "Pad", 100)))
        assertEquals(null, toItem(ItemDto(3, null, 100)))
        assertEquals(null, toItem(ItemDto(3, "   ", 100)))
        assertEquals(null, toItem(ItemDto(3, "Pad", null)))
        assertEquals(null, toItem(ItemDto(3, "Pad", -1)))
    }

    // one bad row costs you that row, not the screen
    @Test
    fun wholeResponse() {
        val response = listOf(
            ItemDto(1, "Pen", 250),
            ItemDto(null, "Broken", 100),
            ItemDto(2, "Pad", 1000),
            ItemDto(3, "  ", 100),
        )
        assertEquals(listOf(1L, 2L), toItems(response).map { it.id })
        assertEquals(listOf("$2.50", "$10.00"), toItems(response).map { it.price })
        assertEquals(emptyList<Item>(), toItems(emptyList()))
        assertEquals(emptyList<Item>(), toItems(listOf(ItemDto())))
    }
}
```

#### Uses
- [Networking › DTO is not your model](#/networking/dto-is-not-your-model)
- [Networking › Serialization](#/networking/serialization)

#### Hints
- `val id = dto.id ?: return null` at the top of the function is the pattern: validate and unwrap in the same line, early-return on anything missing.
- `takeIf { it.isNotEmpty() }` turns a trimmed-but-empty string into `null`, which chains straight into `?: return null`.
- `"$%d.%02d".format(cents / 100, cents % 100)` formats the price; `mapNotNull` in `toItems` drops the rows that returned `null`.

#### Tips
- Money as an `Int` of cents, never a `Double`. `0.1 + 0.2` is not `0.3` and a rounding error in a price is a support ticket.
- This function is where the backend's inconsistencies go to die. One pure, tested function, and no screen downstream ever writes `?: ""` again.
- `mapNotNull` silently dropping rows is right for a list and wrong for a detail screen — there, a `null` should become an error state, not an empty page.

#### Docs
- [kotlinx.serialization on Android](https://developer.android.com/kotlin/ktx#serialization)
- [Data layer architecture](https://developer.android.com/topic/architecture/data-layer)

### 2. Say what actually went wrong

A screen that says "Error" for everything is a screen that cannot help anybody. Turn the two kinds of failure — an exception from the transport, and a status code from the server — into one sealed type the UI can render, and say which of them are worth retrying.

`classify(code)` maps an HTTP status: `null` for anything in `200..299`, and otherwise `Unauthorized` for 401 and 403, `NotFound` for 404, `Timeout` for 408, `RateLimited` for 429, `Client(code)` for anything else in `400..499`, `Server(code)` for `500..599`, and `Unexpected` (with the code as its message) for everything else, including redirects and nonsense.

`classify(e)` maps a `Throwable`: `Offline` for `UnknownHostException`, `Timeout` for `SocketTimeoutException`, `Connection` for any other `IOException`, and `Unexpected` (with the exception's message, or `"unknown"` when it has none) for anything else.

`isRetryable(error)` is `true` for `Timeout`, `Connection`, `Server` and `RateLimited`, and `false` for everything else — including `Offline`, which needs the network back rather than another attempt.

```kotlin starter
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

sealed interface ApiError {
    data object Offline : ApiError
    data object Timeout : ApiError
    data object Connection : ApiError
    data object NotFound : ApiError
    data object Unauthorized : ApiError
    data object RateLimited : ApiError
    data class Client(val code: Int) : ApiError
    data class Server(val code: Int) : ApiError
    data class Unexpected(val message: String) : ApiError
}

fun classify(code: Int): ApiError? = ApiError.Unexpected("$code")

fun classify(e: Throwable): ApiError = ApiError.Unexpected("unknown")

fun isRetryable(error: ApiError): Boolean = true
```

```kotlin test
class ClassifyTest {
    // success is not an error
    @Test
    fun success() {
        assertEquals(null, classify(200))
        assertEquals(null, classify(201))
        assertEquals(null, classify(204))
        assertEquals(null, classify(299))
    }

    // the status codes worth naming
    @Test
    fun named() {
        assertEquals(ApiError.Unauthorized, classify(401))
        assertEquals(ApiError.Unauthorized, classify(403))
        assertEquals(ApiError.NotFound, classify(404))
        assertEquals(ApiError.Timeout, classify(408))
        assertEquals(ApiError.RateLimited, classify(429))
    }

    // the rest, by range
    @Test
    fun ranges() {
        assertEquals(ApiError.Client(400), classify(400))
        assertEquals(ApiError.Client(422), classify(422))
        assertEquals(ApiError.Server(500), classify(500))
        assertEquals(ApiError.Server(503), classify(503))
        assertEquals(ApiError.Unexpected("301"), classify(301))
        assertEquals(ApiError.Unexpected("0"), classify(0))
        assertEquals(ApiError.Unexpected("600"), classify(600))
    }

    // what the transport throws
    @Test
    fun exceptions() {
        assertEquals(ApiError.Offline, classify(java.net.UnknownHostException("api.example.com")))
        assertEquals(ApiError.Timeout, classify(java.net.SocketTimeoutException("read timed out")))
        assertEquals(ApiError.Connection, classify(java.io.IOException("unexpected end of stream")))
        assertEquals(ApiError.Unexpected("bad json"), classify(IllegalStateException("bad json")))
        assertEquals(ApiError.Unexpected("unknown"), classify(RuntimeException()))
    }

    // try again, or don't
    @Test
    fun retryable() {
        assertTrue(isRetryable(ApiError.Timeout))
        assertTrue(isRetryable(ApiError.Connection))
        assertTrue(isRetryable(ApiError.RateLimited))
        assertTrue(isRetryable(ApiError.Server(503)))
        assertFalse(isRetryable(ApiError.Offline))
        assertFalse(isRetryable(ApiError.NotFound))
        assertFalse(isRetryable(ApiError.Unauthorized))
        assertFalse(isRetryable(ApiError.Client(400)))
        assertFalse(isRetryable(ApiError.Unexpected("bad json")))
    }
}
```

#### Uses
- [Networking › Errors are data](#/networking/errors-are-data)
- [Networking › Timeouts and retries](#/networking/timeouts-and-retries)
- [Reference › Result and runCatching](#/reference/result-and-runcatching)

#### Hints
- `when (code) { in 200..299 -> null; 401, 403 -> …; in 400..499 -> … }` — a `when` on ranges, with the named codes listed before the ranges that contain them.
- `SocketTimeoutException` is a subclass of `IOException`, so it has to be matched first; a `when (e) { is IOException -> … }` before it would swallow it.
- `isRetryable` is a `when (error) { is ApiError.Server, ApiError.Timeout, … -> true; else -> false }`.

#### Tips
- Order in a `when` is order of evaluation. Exception hierarchies punish getting it backwards, and the compiler will not warn you.
- 429 should really be retried after the delay in its `Retry-After` header. Carrying that number in the `RateLimited` case is the natural next step.
- `data object` gives you equality for free, which is why these tests can compare errors with `assertEquals`. A plain `class` would compare by identity and fail every one.

#### Docs
- [Handle network errors](https://developer.android.com/training/basics/network-ops/reading-network-state)
- [Data layer: exposing errors](https://developer.android.com/topic/architecture/data-layer#expose-errors)

### 3. Read the Cache-Control header

Before you write a single line of caching code, the server has probably already told you what to do. Parse its instructions and follow them.

`parseCacheControl(header)` reads a `Cache-Control` value — a comma-separated list of directives, each either a bare word or `name=value`, in any case and with any amount of whitespace — into a `CachePolicy`. Recognise `max-age`, `stale-while-revalidate`, `no-cache` and `no-store`; ignore everything else. A directive whose value is not a number is treated as absent.

`decide(policy, ageSeconds)` returns what to do with a stored response of that age:

- `"network"` if the policy says `no-store`, or if there is no `max-age` at all;
- `"revalidate"` if the policy says `no-cache`;
- `"cache"` if the response is younger than `max-age`;
- `"revalidate"` if it is older than `max-age` but still within `max-age + stale-while-revalidate`;
- `"network"` otherwise.

```kotlin starter
data class CachePolicy(
    val maxAge: Long? = null,
    val staleWhileRevalidate: Long? = null,
    val noCache: Boolean = false,
    val noStore: Boolean = false,
)

fun parseCacheControl(header: String): CachePolicy = CachePolicy()

fun decide(policy: CachePolicy, ageSeconds: Long): String = "network"
```

```kotlin test
class CacheControlTest {
    // the ordinary header
    @Test
    fun parses() {
        assertEquals(CachePolicy(maxAge = 300), parseCacheControl("max-age=300"))
        assertEquals(CachePolicy(maxAge = 300), parseCacheControl("public, max-age=300"))
        assertEquals(
            CachePolicy(maxAge = 300, staleWhileRevalidate = 60),
            parseCacheControl("max-age=300, stale-while-revalidate=60"),
        )
        assertEquals(CachePolicy(noStore = true), parseCacheControl("no-store"))
        assertEquals(CachePolicy(maxAge = 0, noCache = true), parseCacheControl("no-cache, max-age=0"))
    }

    // servers are untidy
    @Test
    fun tolerant() {
        assertEquals(CachePolicy(maxAge = 300), parseCacheControl("  Max-Age = 300 , Public "))
        assertEquals(CachePolicy(noStore = true, noCache = true), parseCacheControl("NO-STORE,no-cache"))
        assertEquals(CachePolicy(), parseCacheControl(""))
        assertEquals(CachePolicy(), parseCacheControl("max-age=soon"))
        assertEquals(CachePolicy(), parseCacheControl("immutable, s-maxage=99"))
    }

    // fresh enough to use as it is
    @Test
    fun fresh() {
        val policy = CachePolicy(maxAge = 300)
        assertEquals("cache", decide(policy, 0))
        assertEquals("cache", decide(policy, 299))
        assertEquals("network", decide(policy, 300))
        assertEquals("network", decide(policy, 1_000))
    }

    // stale, but usable while we check
    @Test
    fun stale() {
        val policy = CachePolicy(maxAge = 300, staleWhileRevalidate = 60)
        assertEquals("cache", decide(policy, 299))
        assertEquals("revalidate", decide(policy, 300))
        assertEquals("revalidate", decide(policy, 359))
        assertEquals("network", decide(policy, 360))
    }

    // the directives that overrule the arithmetic
    @Test
    fun overrides() {
        assertEquals("network", decide(CachePolicy(maxAge = 300, noStore = true), 0))
        assertEquals("revalidate", decide(CachePolicy(maxAge = 300, noCache = true), 0))
        assertEquals("network", decide(CachePolicy(), 0))
        assertEquals("network", decide(CachePolicy(staleWhileRevalidate = 60), 0))
    }
}
```

#### Uses
- [Networking › Caching](#/networking/caching)
- [Reference › Strings](#/reference/strings)

#### Hints
- `header.split(",")` then, for each piece, `substringBefore("=").trim().lowercase()` is the name and `substringAfter("=", "").trim()` is the value.
- `value.toLongOrNull()` is the "treat a non-number as absent" rule in one call.
- `decide` is a `when { … }` chain written in exactly the order the rules are listed above; the order is the whole exercise.

#### Tips
- OkHttp implements all of this already. Writing it once is how you stop treating the HTTP cache as magic and start reading the headers your backend actually sends.
- `stale-while-revalidate` is the directive that makes an app feel instant: show what you have, refresh behind it, update when the answer arrives.
- If the server sends no caching headers at all, nothing is cached, and no amount of client configuration changes that. The fix is a conversation with the backend team, not a `CacheInterceptor`.

#### Docs
- [OkHttp caching](https://square.github.io/okhttp/features/caching/)
- [Optimize network data usage](https://developer.android.com/topic/performance/network-xfer)

### 4. A real client, end to end

Build the networking layer for a list screen against a public JSON API of your choice: Gradle dependencies, one client, one API interface, DTOs, a mapper and a repository that returns a `Result`.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- `retrofit`, `okhttp`, `kotlinx-serialization-json` and the Retrofit converter in the module's Gradle file, plus the `kotlin("plugin.serialization")` plugin and the `INTERNET` permission in the manifest.
- One `OkHttpClient` and one `Retrofit`, built once, with explicit connect and read timeouts.
- `Json { ignoreUnknownKeys = true }`, so a new field on the server cannot crash the app.
- An API interface whose functions are `suspend` and whose return types are DTOs.
- DTOs with `@SerialName` where the wire name differs, and a default for every optional field.
- A repository that calls the API, maps DTOs to domain models, and returns `Result<List<Item>>` — never throwing past its own boundary, and rethrowing `CancellationException`.
- Delete the network permission and confirm the failure is an error state rather than a crash.

```kotlin solution
// build.gradle.kts (app)
// plugins { kotlin("plugin.serialization") version "2.2.20" }
// dependencies {
//     implementation("com.squareup.retrofit2:retrofit:2.11.0")
//     implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
//     implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
//     implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
// }
//
// AndroidManifest.xml: <uses-permission android:name="android.permission.INTERNET" />

// Network.kt
private val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}

private val okHttp = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.SECONDS)
    .addInterceptor(HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
    })
    .build()

val retrofit: Retrofit = Retrofit.Builder()
    .baseUrl("https://api.example.com/")
    .client(okHttp)
    .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
    .build()

// CartApi.kt
interface CartApi {
    @GET("items")
    suspend fun items(@Query("page") page: Int = 1): List<ItemDto>
}

@Serializable
data class ItemDto(
    val id: Long? = null,
    val name: String? = null,
    @SerialName("price_cents") val priceCents: Int? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    val tags: List<String> = emptyList(),
)

// ItemRepository.kt
class ItemRepository(
    private val api: CartApi,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    suspend fun items(): Result<List<Item>> = withContext(io) {
        try {
            Result.success(api.items().mapNotNull(::toItem))
        } catch (e: CancellationException) {
            throw e
        } catch (e: IOException) {
            Result.failure(e)
        } catch (e: HttpException) {
            Result.failure(e)
        }
    }
}
```

#### Uses
- [Networking › The shape of a client](#/networking/the-shape-of-a-client)
- [Networking › Serialization](#/networking/serialization)
- [Networking › DTO is not your model](#/networking/dto-is-not-your-model)
- [Reference › Networking](#/reference/networking)

#### Hints
- The Retrofit serialization converter is `json.asConverterFactory("application/json".toMediaType())` from `com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter`.
- Retrofit throws `HttpException` for a non-2xx response and `IOException` for a transport failure; returning `Response<T>` instead gives you the code without an exception.
- Keep the `Retrofit` instance in one place and pass the generated API into the repository's constructor. That one decision is what makes the repository testable.

#### Tips
- Turn the logging interceptor's body logging off in release builds. It is the easiest way to print somebody's auth token into logcat.
- A `MockWebServer` in your tests is worth the ten minutes it takes to set up: real serialization, real status codes, no network.
- If the API needs authentication, an OkHttp `Interceptor` adds the header once for every call, and an `Authenticator` handles the refresh. Doing it per endpoint is how one gets forgotten.

#### Docs
- [Connect to the network](https://developer.android.com/develop/connectivity/network-ops/connecting)
- [Network security configuration](https://developer.android.com/privacy-and-security/security-config)

### 5. Show the cached copy, then the fresh one

Build a list screen that is useful before the network answers and honest about what it is showing: the last known data appears immediately, a refresh runs behind it, and a banner says when what you are looking at is stale or the refresh failed.

#### Build it
- The UI state carries the items, a `isRefreshing` flag and an optional `staleReason` — all three at once, because that is genuinely the state.
- Cached items are shown on first composition, before any network call resolves.
- A pull-to-refresh gesture (`PullToRefreshBox`) triggers the refresh and shows the indicator while it runs.
- A failed refresh with cached data shows a dismissible banner, not a full-screen error; a failed refresh with no data shows the full-screen error with a retry.
- The error text differs for offline, not-found and server failures, using the classifier from exercise 2.
- Turning aeroplane mode on and pulling to refresh shows the offline message and keeps the list on screen.

```kotlin solution
// FeedUiState.kt
data class FeedUiState(
    val items: List<Item> = emptyList(),
    val isRefreshing: Boolean = false,
    val staleReason: String? = null,
)

// FeedViewModel.kt
class FeedViewModel(private val repo: ItemRepository) : ViewModel() {
    private val _state = MutableStateFlow(FeedUiState())
    val state: StateFlow<FeedUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, staleReason = null) }
            repo.items()
                .onSuccess { items -> _state.update { it.copy(items = items, isRefreshing = false) } }
                .onFailure { e ->
                    _state.update {
                        it.copy(isRefreshing = false, staleReason = message(classify(e)))
                    }
                }
        }
    }

    fun dismissBanner() = _state.update { it.copy(staleReason = null) }
}

@Composable
private fun message(error: ApiError): String = when (error) {
    ApiError.Offline -> stringResource(R.string.error_offline)
    ApiError.Timeout, ApiError.Connection -> stringResource(R.string.error_slow)
    ApiError.NotFound -> stringResource(R.string.error_gone)
    else -> stringResource(R.string.error_generic)
}

// FeedScreen.kt
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(viewModel: FeedViewModel = viewModel(), modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = viewModel::refresh,
        modifier = modifier.fillMaxSize(),
    ) {
        when {
            state.items.isEmpty() && state.staleReason != null ->
                ErrorState(message = state.staleReason!!, onRetry = viewModel::refresh)

            else -> Column {
                state.staleReason?.let { reason ->
                    StaleBanner(text = reason, onDismiss = viewModel::dismissBanner)
                }
                LazyColumn(Modifier.fillMaxSize()) {
                    items(state.items, key = { it.id }) { item ->
                        ListItem(
                            headlineContent = { Text(item.name) },
                            trailingContent = { Text(item.price) },
                        )
                    }
                }
            }
        }
    }
}
```

#### Uses
- [Networking › Errors are data](#/networking/errors-are-data)
- [Networking › Caching](#/networking/caching)

#### Hints
- `MutableStateFlow.update { it.copy(…) }` is the safe way to change one field of a state object; assigning to `.value` from two coroutines loses updates.
- `PullToRefreshBox` lives in `androidx.compose.material3` and takes `isRefreshing` and `onRefresh` directly.
- Deciding between banner and full-screen error is one condition: is there anything to show behind the banner?

#### Tips
- "Stale data plus a quiet banner" beats "spinner over an empty screen" almost every time. The exception is anything where being out of date is dangerous — a balance, a boarding pass, a dose.
- The `staleReason` being a `String?` is fine for a small app; carrying the `ApiError` and resolving it to a string in the composable keeps the `ViewModel` free of resources, and is the version to grow into.
- A refresh that fails should never wipe what is on screen. That is surprisingly easy to do by accident when the state is a sealed interface with a single `Failed` case.

#### Docs
- [Offline-first apps](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [Pull to refresh](https://developer.android.com/develop/ui/compose/components/pull-to-refresh)
