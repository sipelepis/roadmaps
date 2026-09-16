# Select, sync & context

Channels and goroutines are the primitives; this module is the toolkit you build real programs with. `select` waits on several channels at once, `sync` has locks for shared state, and `context` carries cancellation and deadlines through a call tree.

## `select`

`select` blocks until one of its cases can proceed, then runs that case. If several are ready, it picks one at random.

```go
select {
case msg := <-messages:
	fmt.Println("got", msg)
case err := <-errs:
	fmt.Println("failed:", err)
case out <- next:
	fmt.Println("sent", next)
}
```

A `default` case makes it non-blocking: if nothing is ready, `default` runs immediately.

```go
select {
case jobs <- j:
default:
	fmt.Println("queue full, dropping", j)
}
```

A nil channel is never ready, so setting a channel variable to `nil` disables its case. That's the standard trick for merging channels that close at different times.

## Timeouts

`time.After(d)` returns a channel that receives once after `d`. Put it in a `select` to bound a wait:

```go
select {
case res := <-results:
	return res, nil
case <-time.After(2 * time.Second):
	return "", errors.New("timed out")
}
```

For repeated work, `time.NewTicker(d)` delivers on `ticker.C` every `d`; call `ticker.Stop()` when done.

## `sync.Mutex`

When goroutines share a map, a struct or a counter, guard it with a mutex. Keep the lock next to the data it protects and hold it as briefly as possible.

```go
type Cache struct {
	mu   sync.Mutex
	data map[string]string
}

func (c *Cache) Set(k, v string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[k] = v
}
```

The zero `Mutex` is unlocked and ready. Never copy a struct that contains one, so use pointer receivers; `go vet` catches copies. `sync.RWMutex` lets many readers hold `RLock` at once while writers take `Lock`. Concurrent writes to a plain map are not just a race: the runtime detects them and crashes with `fatal error: concurrent map writes`.

For a single counter, `sync/atomic` types like `atomic.Int64` are simpler than a mutex.

## `sync.Once`

`once.Do(f)` runs `f` exactly once, however many goroutines call it at the same time; the others wait until it finishes. `sync.OnceValue(f)` wraps a function so its result is computed once and cached:

```go
var config = sync.OnceValue(func() Config { return loadConfig() })

cfg := config() // loads on the first call only
```

## `context`

A `context.Context` carries a cancellation signal, and optionally a deadline, from a caller down to everything it starts. It is the first parameter of any function that blocks or does I/O, named `ctx`.

```go
func fetch(ctx context.Context, url string) (string, error) {
	select {
	case <-ctx.Done(): // closed when cancelled or the deadline passes
		return "", ctx.Err() // context.Canceled or context.DeadlineExceeded
	case body := <-download(url):
		return body, nil
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel() // always call cancel to release resources
	body, err := fetch(ctx, "https://go.dev")
	fmt.Println(body, err)
}
```

Cancelling a parent cancels every context derived from it. Cancellation is cooperative: nothing stops a goroutine for you. Long-running work must check `ctx.Done()` or pass `ctx` to calls that do. Don't store contexts in structs; pass them along.

## Worker pools

To bound concurrency, start a fixed number of workers reading from one jobs channel:

```go
jobs := make(chan int)
var wg sync.WaitGroup
for range workers {
	wg.Go(func() {
		for j := range jobs {
			process(j)
		}
	})
}
for _, j := range all {
	jobs <- j
}
close(jobs) // workers' range loops end
wg.Wait()
```

## First error wins

A common shape: run several tasks concurrently, stop the rest as soon as one fails, and report that first error. The `golang.org/x/sync/errgroup` package does this, and you can build it from the standard library: a `WaitGroup` to wait, `sync.Once` to keep only the first error, and `context.WithCancel` to tell the others to stop.

```go playground
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

func worker(ctx context.Context, id int, results chan<- string) {
	for step := 1; ; step++ {
		select {
		case <-ctx.Done():
			results <- fmt.Sprintf("worker %d stopped: %v", id, ctx.Err())
			return
		case <-time.After(time.Duration(20+id*30) * time.Millisecond):
			results <- fmt.Sprintf("worker %d step %d", id, step)
		}
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 130*time.Millisecond)
	defer cancel()

	results := make(chan string)
	var wg sync.WaitGroup
	for id := 1; id <= 2; id++ {
		wg.Go(func() { worker(ctx, id, results) })
	}
	go func() {
		wg.Wait()
		close(results)
	}()

	for r := range results {
		fmt.Println(r)
	}
	fmt.Println("all workers done")
}

// Try: raise the timeout to 300ms and count the extra steps.
```

## Exercises

### 1. A counter that's safe to share

`Counter` counts hits per key and is used from many goroutines at once. Guard the map with the mutex in `Inc` and `Value`. (An unguarded version can crash the whole run with `concurrent map writes`.)

`counts` is a map, Go's built-in hash table (the maps module covers it). `c.counts[key]` reads the count for `key`, which is `0` for a key that isn't there yet, and `c.counts[key]++` adds one to it.

```go starter
package main

import "sync"

type Counter struct {
	mu     sync.Mutex
	counts map[string]int
}

func NewCounter() *Counter {
	return &Counter{counts: map[string]int{}}
}

func (c *Counter) Inc(key string) {
	// TODO
}

func (c *Counter) Value(key string) int {
	return 0 // TODO
}
```

```go test
package main

import (
	"sync"
	"testing"
)

// counts sequential hits
func TestCounterBasic(t *testing.T) {
	c := NewCounter()
	c.Inc("a")
	c.Inc("a")
	c.Inc("b")
	expect(t, c.Value("a"), 2)
	expect(t, c.Value("b"), 1)
	expect(t, c.Value("missing"), 0)
	other := NewCounter()
	other.Inc("a")
	expect(t, other.Value("a"), 1) // each counter has its own counts
	expect(t, c.Value("a"), 2)
}

// no lost updates under concurrency
func TestCounterConcurrent(t *testing.T) {
	c := NewCounter()
	var wg sync.WaitGroup
	for g := range 100 {
		wg.Go(func() {
			for range 100 {
				c.Inc("hits")
				if g%2 == 0 {
					c.Inc("even")
				}
				_ = c.Value("hits")
			}
		})
	}
	wg.Wait()
	expect(t, c.Value("hits"), 10000)
	expect(t, c.Value("even"), 5000)
}

// many keys, each written by many goroutines
func TestCounterManyKeys(t *testing.T) {
	c := NewCounter()
	keys := []string{"a", "b", "c", "d", "e"}
	var wg sync.WaitGroup
	for range 100 {
		wg.Go(func() {
			for _, k := range keys {
				for range 20 {
					c.Inc(k)
				}
			}
		})
	}
	wg.Wait()
	for _, k := range keys {
		expect(t, c.Value(k), 2000)
	}
}
```

#### Uses
- [Select, sync & context › `sync.Mutex`](#/concurrency/sync-mutex)
- [Structs & methods › Value receivers and pointer receivers](#/structs/value-receivers-and-pointer-receivers)

#### Hints
- Both methods start with `c.mu.Lock()` followed by `defer c.mu.Unlock()`.
- `Value` needs the lock too: reading a map while another goroutine writes to it is also a data race.

#### Tips
- `defer` unlocks on every way out of the method, including a panic. Keep the locked part short.
- `c.counts[key]++` is a read and a write. Without the lock two goroutines can both read 4 and both store 5, and one increment simply disappears.
- `Counter` holds a `sync.Mutex`, so it must never be copied. That is the real reason every method takes `*Counter`.

#### Docs
- [sync.Mutex](https://pkg.go.dev/sync#Mutex)

### 2. Receive with a timeout

`Receive(ch, timeout)` returns the next value from `ch`. If `ch` is closed, return `ErrClosed`. If nothing arrives within `timeout`, return `ErrTimeout`. Use `select` with `time.After`, and the two-value receive `v, ok := <-ch` to spot a closed channel.

```go starter
package main

import (
	"errors"
	"time"
)

var (
	ErrTimeout = errors.New("timeout")
	ErrClosed  = errors.New("channel closed")
)

func Receive(ch <-chan string, timeout time.Duration) (string, error) {
	// TODO
	return "", nil
}
```

```go test
package main

import (
	"errors"
	"testing"
	"time"
)

// returns a ready value
func TestReceiveValue(t *testing.T) {
	ch := make(chan string, 1)
	ch <- "hello"
	v, err := Receive(ch, time.Second)
	expect(t, v, "hello")
	expect(t, err, nil)
	empty := make(chan string, 1)
	empty <- "" // an empty string is still a value
	v, err = Receive(empty, time.Second)
	expect(t, v, "")
	expect(t, err, nil)
}

// waits for a value sent later
func TestReceiveLater(t *testing.T) {
	ch := make(chan string)
	go func() {
		time.Sleep(10 * time.Millisecond)
		ch <- "late"
		time.Sleep(100 * time.Millisecond)
		ch <- "later"
	}()
	v, err := Receive(ch, time.Second)
	expect(t, v, "late")
	expect(t, err, nil)
	v, err = Receive(ch, time.Second)
	expect(t, v, "later")
	expect(t, err, nil)
}

// gives up after the timeout it was given
func TestReceiveTimeout(t *testing.T) {
	ch := make(chan string)
	start := time.Now()
	_, err := Receive(ch, 50*time.Millisecond)
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("want ErrTimeout, got %v", err)
	}
	_, err = Receive(ch, 20*time.Millisecond)
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("want ErrTimeout, got %v", err)
	}
	if waited := time.Since(start); waited > 500*time.Millisecond {
		t.Fatalf("two short timeouts took %v", waited)
	}
}

// reports a closed channel
func TestReceiveClosed(t *testing.T) {
	ch := make(chan string)
	close(ch)
	_, err := Receive(ch, time.Second)
	if !errors.Is(err, ErrClosed) {
		t.Fatalf("want ErrClosed, got %v", err)
	}
}
```

#### Uses
- [Select, sync & context › `select`](#/concurrency/select)
- [Select, sync & context › Timeouts](#/concurrency/timeouts)
- [Goroutines & channels › `close` and `range`](#/goroutines/close-and-range)
- [Reference › time](#/reference/time)
- [Reference › errors](#/reference/errors)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- One `select` with two cases: a receive from `ch`, and a receive from `time.After(timeout)`.
- A `select` case can use the two-value receive, `case v, ok := <-ch:`. `ok` is `false` once `ch` is closed.

#### Tips
- A closed channel is always ready to receive from, so the closed case wins at once instead of waiting out the timeout.
- Call `time.After(timeout)` inside the `select`, so each call gets its own fresh timer. A timer created once outside would already be half spent on the second call.
- The tests check that the error wraps `ErrTimeout` with `errors.Is`, so returning the sentinel itself is enough; wrapping it with context would also pass.

#### Docs
- [time.After](https://pkg.go.dev/time#After)
- [Go spec: Select statements](https://go.dev/ref/spec#Select_statements)

### 3. Worker pool

`Process(jobs, workers, fn)` returns `fn(jobs[i])` at index `i` for every job, running at most `workers` calls of `fn` at the same time. Start `workers` goroutines that read job indexes from a channel, and write each result to its own slot in the output slice.

The starter is correct but sequential. The tests check both the upper bound and that the workers actually run in parallel.

```go starter
package main

func Process(jobs []int, workers int, fn func(int) int) []int {
	out := make([]int, len(jobs))
	for i, j := range jobs {
		out[i] = fn(j) // TODO: use a pool of workers
	}
	return out
}
```

```go test
package main

import (
	"sync/atomic"
	"testing"
	"time"
)

// tracker returns fn wrapped to record how many calls run at once.
func tracker(fn func(int) int) (func(int) int, *atomic.Int32) {
	var active, peak atomic.Int32
	return func(n int) int {
		now := active.Add(1)
		for {
			p := peak.Load()
			if now <= p || peak.CompareAndSwap(p, now) {
				break
			}
		}
		time.Sleep(10 * time.Millisecond)
		active.Add(-1)
		return fn(n)
	}, &peak
}

// results line up with jobs
func TestProcessResults(t *testing.T) {
	fn, _ := tracker(func(n int) int { return n * n })
	expect(t, Process([]int{1, 2, 3, 4, 5, 6, 7}, 3, fn), []int{1, 4, 9, 16, 25, 36, 49})
	expect(t, Process([]int{10, -3, 7}, 8, fn), []int{100, 9, 49}) // more workers than jobs
	expect(t, len(Process(nil, 2, fn)), 0)
}

// never runs more than workers at once
func TestProcessBound(t *testing.T) {
	fn, peak := tracker(func(n int) int { return n })
	Process(make([]int, 20), 4, fn)
	if p := peak.Load(); p > 4 {
		t.Fatalf("%d calls ran at once, want at most 4", p)
	}
}

// uses all the workers
func TestProcessParallel(t *testing.T) {
	fn, peak := tracker(func(n int) int { return n })
	Process(make([]int, 12), 3, fn)
	expect(t, peak.Load(), int32(3))
}
```

#### Uses
- [Select, sync & context › Worker pools](#/concurrency/worker-pools)
- [Goroutines & channels › `close` and `range`](#/goroutines/close-and-range)
- [Goroutines & channels › `sync.WaitGroup`](#/goroutines/sync-waitgroup)
- [Reference › sync and sync/atomic](#/reference/sync-and-sync-atomic)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- Make an unbuffered `chan int` for job indexes and start `workers` goroutines that each `range` over it.
- Each worker does `out[i] = fn(jobs[i])`. After sending every index, `close` the channel so the workers' loops end, then `wg.Wait()`.

#### Tips
- Sending indexes instead of values lets every worker write straight into its own slot, so the results stay in order with no locking.
- `workers` can exceed `len(jobs)`. The extra goroutines find the channel closed, their `range` ends immediately, and nothing special is needed.
- Close the index channel *after* the last send and *before* `wg.Wait()`. Forgetting the close leaves every worker parked on an empty channel and the whole run deadlocks.

#### Docs
- [Effective Go: Channels](https://go.dev/doc/effective_go#channels)

### 4. First error cancels the rest

`RunAll(ctx, tasks...)` runs every task in its own goroutine and waits for all of them. It returns the first error any task returns, or `nil` if all succeed. As soon as one task fails, cancel the context passed to the others so they can stop early.

Derive a cancellable context with `context.WithCancel(ctx)`, give that to every task, keep only the first error with a `sync.Once`, and `defer cancel()`.

```go starter
package main

import "context"

func RunAll(ctx context.Context, tasks ...func(context.Context) error) error {
	// TODO
	return nil
}
```

```go test
package main

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

var errFailForTest = errors.New("task failed")

// waitOrGiveUp blocks until ctx is cancelled (true) or a second passes (false).
func waitOrGiveUp(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return true
	case <-time.After(time.Second):
		return false
	}
}

// all tasks run; nil when all succeed
func TestRunAllOK(t *testing.T) {
	var ran atomic.Int32
	task := func(context.Context) error { ran.Add(1); return nil }
	expect(t, RunAll(context.Background(), task, task, task), nil)
	expect(t, ran.Load(), int32(3))
}

// returns the first error and cancels the others
func TestRunAllCancels(t *testing.T) {
	var cancelled atomic.Int32
	slow := func(ctx context.Context) error {
		if waitOrGiveUp(ctx) {
			cancelled.Add(1)
			return ctx.Err()
		}
		return nil
	}
	fail := func(context.Context) error { return errFailForTest }
	err := RunAll(context.Background(), slow, fail, slow)
	if !errors.Is(err, errFailForTest) {
		t.Fatalf("want errFailForTest, got %v", err)
	}
	expect(t, cancelled.Load(), int32(2))
}

// waits for every task before returning
func TestRunAllWaits(t *testing.T) {
	var done atomic.Bool
	task := func(context.Context) error {
		time.Sleep(50 * time.Millisecond)
		done.Store(true)
		return nil
	}
	RunAll(context.Background(), task)
	expect(t, done.Load(), true)
}

// a later error does not replace the first one
func TestRunAllFirstError(t *testing.T) {
	errLate := errors.New("late failure")
	fast := func(context.Context) error { return errFailForTest }
	late := func(context.Context) error {
		time.Sleep(20 * time.Millisecond)
		return errLate
	}
	err := RunAll(context.Background(), late, fast, late)
	if !errors.Is(err, errFailForTest) {
		t.Fatalf("want the first error, errFailForTest, got %v", err)
	}
}

// respects an already-cancelled parent
func TestRunAllParent(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := RunAll(ctx, func(ctx context.Context) error {
		if waitOrGiveUp(ctx) {
			return ctx.Err()
		}
		return nil
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("want context.Canceled, got %v", err)
	}
}
```

#### Uses
- [Select, sync & context › First error wins](#/concurrency/first-error-wins)
- [Select, sync & context › `context`](#/concurrency/context)
- [Select, sync & context › `sync.Once`](#/concurrency/sync-once)
- [Goroutines & channels › `sync.WaitGroup`](#/goroutines/sync-waitgroup)
- [Reference › errors](#/reference/errors)
- [Reference › sync and sync/atomic](#/reference/sync-and-sync-atomic)

#### Hints
- `ctx, cancel := context.WithCancel(ctx)` works like `WithTimeout` without the deadline. `defer cancel()`, and give this new `ctx` to every task.
- Run each task with `wg.Go`. When one returns a non-nil error, `once.Do` a function that saves it and calls `cancel()`.
- After `wg.Wait()`, return the saved error, which is still `nil` if nothing failed.

#### Tips
- Calling `cancel` more than once is safe, so the `defer` and the call on failure don't conflict.
- Several goroutines write the shared error variable, but only from inside `once.Do`, which runs one of them and makes the others wait. That is what keeps it safe without a mutex.
- Give the tasks the *derived* context, not the one you were handed. Passing the original through means cancelling changes nothing and the "cancels the others" test hangs until its own timeout.

#### Docs
- [context.WithCancel](https://pkg.go.dev/context#WithCancel)
- [sync.Once](https://pkg.go.dev/sync#Once)
