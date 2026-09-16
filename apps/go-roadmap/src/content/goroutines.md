# Goroutines & channels

A goroutine is a function running concurrently with the rest of the program, and a channel is a typed pipe that goroutines use to hand values to each other. Both are built into the language, and they are cheap: a program can run hundreds of thousands of goroutines.

## `go`

```go
go fetch(url)            // starts fetch concurrently; go returns immediately
go func() {
	fmt.Println("in the background")
}()
```

There's no `async`/`await` and no coloured functions. Any function can be run with `go`, and blocking calls inside it (I/O, sleeps, channel operations) park only that goroutine while the runtime schedules others across your CPU cores.

`go` gives you no handle and no return value. If `main` returns, the program exits and every other goroutine is killed mid-flight. You have to wait for work explicitly, with a channel or a `sync.WaitGroup`.

## Channels

```go
ch := make(chan int) // unbuffered channel of ints

go func() {
	ch <- 42 // send: blocks until someone receives
}()

v := <-ch // receive: blocks until someone sends
fmt.Println(v)
```

An unbuffered channel is a rendezvous: the sender and receiver meet, the value passes, and both continue. That synchronizes the two goroutines as well as moving data.

A buffered channel has a queue. Sends block only when it's full; receives only when it's empty.

```go
jobs := make(chan string, 3)
jobs <- "a"
jobs <- "b" // no receiver needed yet: the buffer has room
fmt.Println(len(jobs), cap(jobs)) // 2 3
```

The zero value of a channel is `nil`, and sending to or receiving from a nil channel blocks forever. Always `make` them.

## `close` and `range`

The sender closes a channel to say "no more values". Receivers can then drain what's left and see the close.

```go
func count(n int) <-chan int {
	ch := make(chan int)
	go func() {
		defer close(ch)
		for i := 1; i <= n; i++ {
			ch <- i
		}
	}()
	return ch
}

for v := range count(3) { // stops when the channel is closed and empty
	fmt.Println(v)
}
```

Outside `range`, the two-value receive tells you whether the channel is done: `v, ok := <-ch` gives `ok == false` (and the zero value) once `ch` is closed and drained.

Rules: only the sender closes, never the receiver. Sending on a closed channel panics, and so does closing twice. You don't have to close every channel, only when a receiver needs to know the stream ended, as `range` does.

## Directional channel types

`chan<- int` is send-only and `<-chan int` is receive-only. A bidirectional `chan int` converts to either automatically. Use them in signatures to document and enforce who does what:

```go
func produce(out chan<- int) { out <- 1 }         // can only send
func consume(in <-chan int)  { fmt.Println(<-in) } // can only receive
```

A function that returns `<-chan T` and closes it when done, like `count` above, is the building block of Go pipelines.

## `sync.WaitGroup`

When you just need to wait for a group of goroutines, use a `WaitGroup`:

```go
var wg sync.WaitGroup
results := make([]int, len(inputs))
for i, in := range inputs {
	wg.Go(func() { // Go 1.25+: Add(1), run in a goroutine, Done() when it returns
		results[i] = work(in)
	})
}
wg.Wait() // blocks until every goroutine has finished
```

Older code writes `wg.Add(1)` before `go func() { defer wg.Done(); ... }()`. Each goroutine writes its own index of `results`, so there's no shared write to protect. Since Go 1.22, `i` and `in` are fresh variables in every iteration, so capturing them in the closure is safe.

## The deadlock you'll hit

```go
ch := make(chan int)
ch <- 1 // blocks forever: no other goroutine will ever receive
fmt.Println(<-ch)
```

```text
fatal error: all goroutines are asleep - deadlock!
```

The runtime detects it only when *every* goroutine is blocked. The quieter version is a goroutine leak: one goroutine stuck forever on a send nobody will receive, while the rest of the program runs on. Before starting a goroutine, know how it will end.

## Sharing memory

Two goroutines writing the same variable without synchronization is a data race, and the result is undefined, not just "slightly off". The Go proverb: *don't communicate by sharing memory; share memory by communicating*. Pass ownership of data through channels, or protect it with a mutex (next module). `go test -race` and `go run -race` find races for you.

```go playground
package main

import (
	"fmt"
	"sync"
)

func generate(words ...string) <-chan string {
	out := make(chan string)
	go func() {
		defer close(out)
		for _, w := range words {
			out <- w
		}
	}()
	return out
}

func lengths(in <-chan string) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for w := range in {
			out <- len(w)
		}
	}()
	return out
}

func main() {
	for n := range lengths(generate("go", "rust", "zig")) {
		fmt.Println("length", n)
	}

	var wg sync.WaitGroup
	squares := make([]int, 5)
	for i := range 5 {
		wg.Go(func() { squares[i] = i * i })
	}
	wg.Wait()
	fmt.Println(squares)
}

// Try: remove the defer close(out) in lengths and read the error.
```

## Exercises

### 1. A generator

`Generate(n)` returns a channel that yields `1, 2, …, n` and is then closed, so callers can `range` over it. Start a goroutine that sends and closes; return the channel right away.

```go starter
package main

func Generate(n int) <-chan int {
	ch := make(chan int)
	// TODO: send 1..n from a goroutine, then close
	close(ch)
	return ch
}
```

```go test
package main

import "testing"

// yields 1..n in order
func TestGenerate(t *testing.T) {
	var got []int
	for v := range Generate(5) {
		got = append(got, v)
	}
	expect(t, got, []int{1, 2, 3, 4, 5})
	got = nil
	for v := range Generate(100) {
		got = append(got, v)
	}
	expect(t, len(got), 100)
	expect(t, got[0], 1)
	expect(t, got[99], 100)
}

// closes the channel when done
func TestGenerateCloses(t *testing.T) {
	ch := Generate(1)
	v, ok := <-ch
	expect(t, v, 1)
	expect(t, ok, true)
	_, ok = <-ch
	expect(t, ok, false)
}

// n = 0 closes right away
func TestGenerateEmpty(t *testing.T) {
	for v := range Generate(0) {
		t.Fatalf("unexpected value %d", v)
	}
}
```

#### Uses
- [Goroutines & channels › `go`](#/goroutines/go)
- [Goroutines & channels › `close` and `range`](#/goroutines/close-and-range)
- [Goroutines & channels › Directional channel types](#/goroutines/directional-channel-types)
- [Reference › Built-in functions](#/reference/built-in-functions)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- Move the `close(ch)` into a `go func() { ... }()` and send the numbers from a loop inside it.
- Start the goroutine with `defer close(ch)`, so the close always comes after the last send.

#### Tips
- Returning `ch` as `<-chan int` means callers can only receive from it. Only `Generate` can send or close.
- `Generate` must return before anything has been sent. The channel is unbuffered, so if you sent from `Generate` itself the first send would block and no caller would ever get the channel back.

#### Docs
- [Go spec: Close](https://go.dev/ref/spec#Close)
- [Effective Go: Channels](https://go.dev/doc/effective_go#channels)

### 2. A pipeline stage

`Square(in)` reads numbers from `in` until it's closed, sends each one squared on the channel it returns, and closes that channel when `in` is exhausted.

```go starter
package main

func Square(in <-chan int) <-chan int {
	out := make(chan int)
	// TODO: a goroutine that ranges over in and closes out
	close(out)
	return out
}
```

```go test
package main

import "testing"

func feedForTest(nums ...int) <-chan int {
	ch := make(chan int, len(nums))
	for _, n := range nums {
		ch <- n
	}
	close(ch)
	return ch
}

// squares every value in order
func TestSquare(t *testing.T) {
	var got []int
	for v := range Square(feedForTest(1, 2, 3, -4)) {
		got = append(got, v)
	}
	expect(t, got, []int{1, 4, 9, 16})
}

// stages compose
func TestSquareTwice(t *testing.T) {
	var got []int
	for v := range Square(Square(feedForTest(2, 3))) {
		got = append(got, v)
	}
	expect(t, got, []int{16, 81})
}

// an empty input closes the output
func TestSquareEmpty(t *testing.T) {
	for v := range Square(feedForTest()) {
		t.Fatalf("unexpected value %d", v)
	}
}

// keeps up with a sender that sends one value at a time
func TestSquareUnbuffered(t *testing.T) {
	in := make(chan int)
	go func() {
		for i := range 50 {
			in <- i
		}
		close(in)
	}()
	var got []int
	for v := range Square(in) {
		got = append(got, v)
	}
	expect(t, len(got), 50)
	expect(t, got[7], 49)
	expect(t, got[49], 2401)
}
```

#### Uses
- [Goroutines & channels › `close` and `range`](#/goroutines/close-and-range)
- [Goroutines & channels › Directional channel types](#/goroutines/directional-channel-types)
- [Reference › Built-in functions](#/reference/built-in-functions)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- Same shape as `Generate`: a goroutine that owns `out` and starts with `defer close(out)`.
- `for v := range in` ends by itself once `in` is closed and drained.

#### Tips
- Close `out`, never `in`. Only the sender closes, and `Square` only receives from `in`.
- Because `Square` returns immediately, `Square(Square(ch))` builds a two-stage pipeline that runs concurrently. A version that drained `in` before returning would still work here, but would hold the whole stream in memory.

#### Docs
- [Go blog: Pipelines and cancellation](https://go.dev/blog/pipelines)

### 3. Run calls concurrently

`FetchAll(urls, fetch)` calls `fetch` once per URL and returns the results in the same order as `urls`. The starter works, but one call at a time. Make the calls run concurrently: start one goroutine per URL, have each write its own index of the result slice, and wait for all of them with a `sync.WaitGroup`.

The test's `fetch` waits until every call has started, so a sequential version fails it.

```go starter
package main

func FetchAll(urls []string, fetch func(string) string) []string {
	out := make([]string, len(urls))
	for i, u := range urls {
		out[i] = fetch(u) // TODO: one goroutine per call
	}
	return out
}
```

```go test
package main

import (
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// barrierFetch returns a fetch func whose calls wait until n calls are in flight.
func barrierFetch(n int, overlapped *atomic.Bool) func(string) string {
	var started atomic.Int32
	all := make(chan struct{})
	var once sync.Once
	return func(url string) string {
		if int(started.Add(1)) == n {
			once.Do(func() { close(all) })
			return strings.ToUpper(url)
		}
		select {
		case <-all: // another call arrived while this one was waiting
			overlapped.Store(true)
		case <-time.After(200 * time.Millisecond):
		}
		return strings.ToUpper(url)
	}
}

// keeps results in input order
func TestFetchAllOrder(t *testing.T) {
	var ok atomic.Bool
	urls := []string{"a.com", "b.com", "c.com", "d.com"}
	expect(t, FetchAll(urls, barrierFetch(1, &ok)), []string{"A.COM", "B.COM", "C.COM", "D.COM"})
}

// calls overlap in time
func TestFetchAllConcurrent(t *testing.T) {
	var overlapped atomic.Bool
	urls := []string{"a", "b", "c", "d", "e"}
	FetchAll(urls, barrierFetch(len(urls), &overlapped))
	if !overlapped.Load() {
		t.Fatal("the fetch calls ran one at a time")
	}
}

// later URLs finish first, but each result still lands at its URL's index
func TestFetchAllMany(t *testing.T) {
	var urls, want []string
	for i := range 100 {
		urls = append(urls, strconv.Itoa(i))
		want = append(want, strconv.Itoa(i)+"!")
	}
	slowFirst := func(u string) string {
		n, _ := strconv.Atoi(u)
		time.Sleep(time.Duration(100-n) * 20 * time.Microsecond)
		return u + "!"
	}
	expect(t, FetchAll(urls, slowFirst), want)
	expect(t, len(FetchAll(nil, slowFirst)), 0)
}
```

#### Uses
- [Goroutines & channels › `sync.WaitGroup`](#/goroutines/sync-waitgroup)
- [Goroutines & channels › `go`](#/goroutines/go)
- [Functions › Closures](#/functions/closures)
- [Reference › sync and sync/atomic](#/reference/sync-and-sync-atomic)
- [Reference › time](#/reference/time)

#### Hints
- Declare `var wg sync.WaitGroup` (import `sync`) and wrap the loop body in `wg.Go(func() { ... })`.
- Call `wg.Wait()` after the loop, before returning `out`.

#### Tips
- Goroutines writing to *different* indexes of one slice is safe. Appending to a shared slice from several goroutines is not.
- `out` is allocated at full length before any goroutine starts, so every index already exists. That is what removes the need for a lock.
- The closure captures `i` and `u` from the loop. Since Go 1.22 each iteration gets fresh copies, so the goroutines do not all end up on the last URL.

#### Docs
- [sync.WaitGroup.Go](https://pkg.go.dev/sync#WaitGroup.Go)

### 4. Fan-in

`Merge(a, b)` forwards every value from both input channels onto one output channel, in whatever order they arrive, and closes the output once *both* inputs are closed. Use one goroutine per input and a `sync.WaitGroup`, plus one more goroutine that waits and then closes the output.

```go starter
package main

func Merge(a, b <-chan int) <-chan int {
	out := make(chan int)
	// TODO
	close(out)
	return out
}
```

```go test
package main

import (
	"slices"
	"testing"
	"time"
)

func filledForTest(nums ...int) <-chan int {
	ch := make(chan int, len(nums))
	for _, n := range nums {
		ch <- n
	}
	close(ch)
	return ch
}

// receives every value from both inputs
func TestMerge(t *testing.T) {
	var got []int
	for v := range Merge(filledForTest(1, 3, 5), filledForTest(2, 4)) {
		got = append(got, v)
	}
	slices.Sort(got)
	expect(t, got, []int{1, 2, 3, 4, 5})
}

// works when one side is empty
func TestMergeOneEmpty(t *testing.T) {
	var got []int
	for v := range Merge(filledForTest(), filledForTest(7, 8)) {
		got = append(got, v)
	}
	slices.Sort(got)
	expect(t, got, []int{7, 8})
}

// waits for the slower input
func TestMergeSlow(t *testing.T) {
	slow := make(chan int)
	go func() {
		for i := range 3 {
			slow <- 10 + i
		}
		close(slow)
	}()
	var got []int
	for v := range Merge(filledForTest(1), slow) {
		got = append(got, v)
	}
	slices.Sort(got)
	expect(t, got, []int{1, 10, 11, 12})
}

// both inputs empty closes the output
func TestMergeBothEmpty(t *testing.T) {
	for v := range Merge(filledForTest(), filledForTest()) {
		t.Fatalf("unexpected value %d", v)
	}
}

// forwards from b while a is still open and quiet
func TestMergeNotInTurn(t *testing.T) {
	a, b := make(chan int), make(chan int)
	out := Merge(a, b)
	select {
	case b <- 1:
	case <-time.After(time.Second):
		t.Fatal("Merge is not reading b while a is still open")
	}
	expect(t, <-out, 1)
	a <- 2
	expect(t, <-out, 2)
	close(a)
	close(b)
	_, ok := <-out
	expect(t, ok, false)
}
```

#### Uses
- [Goroutines & channels › `sync.WaitGroup`](#/goroutines/sync-waitgroup)
- [Goroutines & channels › `close` and `range`](#/goroutines/close-and-range)
- [Goroutines & channels › The deadlock you'll hit](#/goroutines/the-deadlock-youll-hit)
- [Reference › slices, maps and cmp](#/reference/slices-maps-and-cmp)
- [Reference › How the tests here work](#/reference/how-the-tests-here-work)

#### Hints
- One `wg.Go` per input, each ranging over its channel and sending every value on to `out`.
- Don't call `wg.Wait()` in `Merge` itself: nobody is receiving from `out` yet, so the forwarders would block forever. Wait in one more goroutine, then `close(out)` there.

#### Tips
- `out` may only be closed after both forwarders finish. Closing it while one of them still sends panics.
- The tests sort what they received before comparing, because a merge has no defined order. Any test that asserted an order here would be flaky.

#### Docs
- [Go blog: Pipelines and cancellation](https://go.dev/blog/pipelines)
