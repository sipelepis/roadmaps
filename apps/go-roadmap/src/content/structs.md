# Structs & methods

Go has no classes. You group fields into a struct, attach methods to the type, and reuse behavior by embedding one struct in another instead of inheriting from it.

## Declaring and building structs

```go
type Point struct {
	X, Y int
}

a := Point{X: 1, Y: 2} // named fields: the normal way
b := Point{3, 4}       // positional: every field, in order; breaks when fields change
c := Point{X: 5}       // Y gets its zero value
var d Point            // {0 0}: the zero value is a usable struct
p := &Point{X: 1}      // pointer to a new Point

a.X = 10
p.Y = 7 // no -> operator: Go dereferences p for you
```

Fields that start with a capital letter are exported (visible to other packages); lowercase fields are private to the package. That is the only encapsulation Go has, and it works per package, not per type.

## Structs are values

Assigning a struct copies every field. So does passing one to a function:

```go
a := Point{1, 2}
b := a
b.X = 99
fmt.Println(a.X) // 1: a is untouched
```

In TypeScript or Python, `b = a` makes two names for one object. In Go you get two structs. If you want sharing, use a pointer: `b := &a`.

Structs whose fields are all comparable can be compared with `==`, field by field, and used as map keys.

For a one-off shape you can skip the type name. Anonymous structs are common in tests:

```go
pt := struct {
	Name string
	Age  int
}{"Ada", 36}
```

## Methods

A method is a function with a *receiver* written before its name:

```go
func (p Point) Dist() float64 {
	return math.Sqrt(float64(p.X*p.X + p.Y*p.Y))
}

type Celsius float64 // any named type in your package can have methods

func (c Celsius) Fahrenheit() float64 {
	return float64(c)*9/5 + 32
}

Point{3, 4}.Dist() // 5
```

There is no `this` or `self` keyword; you name the receiver, usually one or two letters of the type name.

## Value receivers and pointer receivers

A value receiver gets a copy of the struct. Changes to it vanish when the method returns. A pointer receiver gets the address and can modify the original:

```go
func (p Point) MoveBroken(dx int) { p.X += dx } // changes a copy
func (p *Point) Move(dx int)      { p.X += dx } // changes the caller's Point

pt := Point{1, 1}
pt.MoveBroken(5) // pt.X is still 1
pt.Move(5)       // pt.X is 6: Go takes &pt for you
```

Go inserts the `&` or `*` for you when calling methods on variables, so `pt.Move(5)` works on a `Point` and `p.Dist()` works on a `*Point`. The exception: a value that has no address, like `Point{1, 1}.Move(5)` or a map element, cannot call a pointer method.

Use a pointer receiver when the method changes the receiver or the struct is large. If any method of a type needs a pointer receiver, give all its methods pointer receivers, so the type behaves consistently.

## Constructors

Go has no constructor syntax. When the zero value is not enough, write a function named `NewThing` that returns a ready-to-use value, usually a pointer:

```go
type Stack struct {
	items []int
	limit int
}

func NewStack(limit int) *Stack {
	return &Stack{limit: limit}
}
```

Many types need no constructor at all. A design goal in Go is to make the zero value useful: a zero `strings.Builder`, `sync.Mutex` or `bytes.Buffer` works immediately.

## Embedding

Put a type in a struct without a field name and its fields and methods are *promoted* to the outer struct:

```go
type Animal struct {
	Name string
}

func (a Animal) Hello() string { return "I am " + a.Name }

type Dog struct {
	Animal // embedded: the field is also named Animal
	Breed  string
}

d := Dog{Animal: Animal{Name: "Rex"}, Breed: "collie"}
d.Name         // "Rex", promoted from Animal
d.Hello()      // "I am Rex"
d.Animal.Name  // the explicit path still works
```

This is composition, not inheritance. `Hello` still receives an `Animal`; it has no idea a `Dog` exists and cannot call methods that `Dog` defines. If `Dog` declares its own `Hello`, that one shadows the promoted method, and `d.Animal.Hello()` reaches the original. A `Dog` is also not an `Animal`: you cannot pass a `Dog` where an `Animal` is expected. Interfaces, the next module, are how Go does polymorphism.

## Printing structs

`%v` prints the fields, `%+v` adds their names, and `%#v` prints Go syntax. If a type has a method `String() string`, fmt uses it instead; Interfaces explains why that works.

```go playground
package main

import "fmt"

type Point struct {
	X, Y int
}

func (p Point) Add(q Point) Point {
	return Point{p.X + q.X, p.Y + q.Y}
}

func (p *Point) Scale(k int) {
	p.X *= k
	p.Y *= k
}

type Named struct {
	Point
	Label string
}

func main() {
	a := Point{X: 1, Y: 2}
	b := a
	b.X = 100
	fmt.Printf("%v %+v\n", a, b)

	a.Scale(3)
	fmt.Println(a, a.Add(Point{1, 1}), a == Point{3, 6})

	n := Named{Point: Point{7, 8}, Label: "home"}
	n.Scale(2)
	fmt.Printf("%+v x=%d\n", n, n.X)
	fmt.Printf("%#v\n", n)
}

// Try: change Scale to a value receiver (p Point) and see what a becomes.
```

## Exercises

### 1. Rectangle

Give `Rect` two methods: `Area()` returns width times height, and `Perimeter()` returns the distance around it.

```go starter
package main

type Rect struct {
	W, H float64
}

func (r Rect) Area() float64 {
	return 0 // TODO
}

func (r Rect) Perimeter() float64 {
	return 0 // TODO
}
```

```go test
package main

import "testing"

// area of a 3 by 4 rectangle, and others
func TestArea(t *testing.T) {
	expect(t, Rect{W: 3, H: 4}.Area(), 12.0)
	expect(t, Rect{W: 10, H: 1}.Area(), 10.0)
	expect(t, Rect{W: 1.5, H: 2}.Area(), 3.0)
}

// perimeter of a 3 by 4 rectangle, and others
func TestPerimeter(t *testing.T) {
	expect(t, Rect{W: 3, H: 4}.Perimeter(), 14.0)
	expect(t, Rect{W: 10, H: 1}.Perimeter(), 22.0)
	expect(t, Rect{W: 1.5, H: 2}.Perimeter(), 7.0)
}

// the zero rectangle
func TestZeroRect(t *testing.T) {
	var r Rect
	expect(t, r.Area(), 0.0)
	expect(t, r.Perimeter(), 0.0)
}
```

#### Uses
- [Structs & methods › Methods](#/structs/methods)
- [Structs & methods › Declaring and building structs](#/structs/declaring-and-building-structs)

#### Hints
- Inside a method the receiver `r` is the rectangle, so its fields are `r.W` and `r.H`.
- The perimeter is two widths plus two heights.

#### Tips
- Value receivers are right here: these methods only read the fields.
- `Rect{W: 3, H: 4}.Area()` calls a method on a value that has no address. That is allowed for a value receiver and would not compile for a pointer one.

#### Docs
- [Go spec: Method declarations](https://go.dev/ref/spec#Method_declarations)
- [A Tour of Go: Methods](https://go.dev/tour/methods/1)

### 2. Fix the counter

`Counter.Inc` is supposed to add one, but the count never moves. Find out why and fix it. Keep `Value` working, and make the receivers consistent.

```go starter
package main

type Counter struct {
	n int
}

func (c Counter) Inc() {
	c.n++
}

func (c Counter) Value() int {
	return c.n
}
```

```go test
package main

import "testing"

// increments a counter variable
func TestInc(t *testing.T) {
	var c Counter
	expect(t, c.Value(), 0)
	c.Inc()
	c.Inc()
	expect(t, c.Value(), 2)
	for range 10 {
		c.Inc()
	}
	expect(t, c.Value(), 12)
}

// works through a pointer
func TestIncPointer(t *testing.T) {
	c := &Counter{}
	c.Inc()
	expect(t, c.Value(), 1)
}

// a copy is a separate counter
func TestCopy(t *testing.T) {
	var c Counter
	c.Inc()
	snapshot := c
	c.Inc()
	expect(t, snapshot.Value(), 1)
	expect(t, c.Value(), 2)
}
```

#### Uses
- [Structs & methods › Value receivers and pointer receivers](#/structs/value-receivers-and-pointer-receivers)
- [Structs & methods › Structs are values](#/structs/structs-are-values)

#### Hints
- With `(c Counter)`, `Inc` receives a copy of the counter, and the copy is what goes up.
- Give `Inc` a pointer receiver. Then give `Value` one too, so all methods of the type agree.

#### Tips
- `snapshot := c` still copies the struct, whatever the receivers are. That is why the copy test keeps its own count.
- `var c Counter; c.Inc()` keeps working after the change: `c` is an addressable variable, so Go rewrites the call as `(&c).Inc()` for you.

#### Docs
- [Effective Go: Pointers vs. values](https://go.dev/doc/effective_go#pointers_vs_values)

### 3. Bank account

Finish the `Account` type. `NewAccount(owner)` returns a pointer to an account with a zero balance. `Deposit` ignores amounts of zero or less. `Withdraw` takes money out and returns `true`, or returns `false` and changes nothing if the amount is zero or less or more than the balance. You will need `if`, which works like TypeScript's without the parentheses, and braces are always required: `if n < 0 { return 0 }`. Combine conditions with `||`.

```go starter
package main

type Account struct {
	owner   string
	balance int
}

func NewAccount(owner string) *Account {
	return &Account{} // TODO: set the owner
}

func (a *Account) Owner() string {
	return a.owner
}

func (a *Account) Balance() int {
	return 0 // TODO
}

func (a *Account) Deposit(amount int) {
	// TODO
}

func (a *Account) Withdraw(amount int) bool {
	return false // TODO
}
```

```go test
package main

import "testing"

// a new account belongs to its owner and is empty
func TestNewAccount(t *testing.T) {
	a := NewAccount("ada")
	expect(t, a.Owner(), "ada")
	expect(t, a.Balance(), 0)
	expect(t, NewAccount("bob").Owner(), "bob")
}

// deposits add up
func TestDeposit(t *testing.T) {
	a := NewAccount("ada")
	a.Deposit(50)
	a.Deposit(25)
	a.Deposit(-10)
	expect(t, a.Balance(), 75)
}

// withdrawals take money out
func TestWithdraw(t *testing.T) {
	a := NewAccount("ada")
	a.Deposit(100)
	expect(t, a.Withdraw(30), true)
	expect(t, a.Balance(), 70)
	expect(t, a.Withdraw(70), true) // the whole balance is allowed
	expect(t, a.Balance(), 0)
}

// overdrafts and bad amounts are refused
func TestRefused(t *testing.T) {
	a := NewAccount("ada")
	a.Deposit(10)
	expect(t, a.Withdraw(11), false)
	expect(t, a.Withdraw(0), false)
	expect(t, a.Withdraw(-5), false)
	expect(t, a.Balance(), 10)
	a.Deposit(0)
	expect(t, a.Withdraw(10), true)
	expect(t, a.Withdraw(1), false)
	expect(t, a.Balance(), 0)
}

// each account keeps its own balance
func TestSeparateAccounts(t *testing.T) {
	a, b := NewAccount("ada"), NewAccount("bob")
	a.Deposit(40)
	b.Deposit(5)
	expect(t, b.Withdraw(6), false)
	expect(t, a.Balance(), 40)
	expect(t, b.Balance(), 5)
}
```

#### Uses
- [Structs & methods › Constructors](#/structs/constructors)
- [Structs & methods › Value receivers and pointer receivers](#/structs/value-receivers-and-pointer-receivers)
- [Structs & methods › Declaring and building structs](#/structs/declaring-and-building-structs)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- In `NewAccount`, set the `owner` field by name inside the struct literal.
- `Deposit` changes the balance only when the amount is positive.
- In `Withdraw`, refuse first: return `false` early for a bad amount or an overdraft. Only then subtract and return `true`.

#### Tips
- The fields are lowercase, so code in other packages can only reach them through these methods.
- `Withdraw` must leave the balance alone when it refuses. Returning `false` early, before any subtraction, is the way to make that impossible to get wrong.

#### Docs
- [Effective Go: Methods](https://go.dev/doc/effective_go#methods)

### 4. Embedding and shadowing

`Person.FullName` returns first and last name separated by a space. `Employee` embeds `Person` and declares its own `FullName`, which shadows the promoted one and returns the title first: `"Admiral Grace Hopper"`. `Badge` returns `"Grace Hopper, Admiral"`. Inside `Employee` methods, `e.Person.FullName()` reaches the embedded method.

```go starter
package main

type Person struct {
	First, Last string
}

func (p Person) FullName() string {
	return "" // TODO
}

type Employee struct {
	Person
	Title string
}

func (e Employee) FullName() string {
	return "" // TODO
}

func (e Employee) Badge() string {
	return "" // TODO
}
```

```go test
package main

import "testing"

var grace = Employee{Person: Person{First: "Grace", Last: "Hopper"}, Title: "Admiral"}
var ada = Employee{Person: Person{First: "Ada", Last: "Lovelace"}, Title: "Countess"}

// a person's full name
func TestPersonFullName(t *testing.T) {
	expect(t, Person{First: "Ada", Last: "Lovelace"}.FullName(), "Ada Lovelace")
	expect(t, Person{First: "Alan", Last: "Turing"}.FullName(), "Alan Turing")
}

// fields are promoted
func TestPromotedField(t *testing.T) {
	expect(t, grace.First, "Grace")
	expect(t, grace.Person.FullName(), "Grace Hopper")
}

// the employee's FullName shadows the person's
func TestShadowed(t *testing.T) {
	expect(t, grace.FullName(), "Admiral Grace Hopper")
	expect(t, ada.FullName(), "Countess Ada Lovelace")
}

// the badge uses the plain name
func TestBadge(t *testing.T) {
	expect(t, grace.Badge(), "Grace Hopper, Admiral")
	expect(t, ada.Badge(), "Ada Lovelace, Countess")
}
```

#### Uses
- [Structs & methods › Embedding](#/structs/embedding)
- [Structs & methods › Methods](#/structs/methods)
- [Variables & types › Operators](#/basics/operators)

#### Hints
- `Person.FullName` joins `p.First`, a space and `p.Last` with `+`.
- `Employee.FullName` puts the title in front of `e.Person.FullName()`. Calling plain `e.FullName()` there would call itself forever.
- `Badge` is the person's name, then `", "`, then the title.

#### Tips
- Embedding is not inheritance: `Person.FullName` can never call `Employee.FullName`, even on an employee.
- The embedded field is named after its type, so `e.Person` reaches it even though you never wrote a field name. That is what `e.Person.FullName()` uses to get past the shadowing.

#### Docs
- [Effective Go: Embedding](https://go.dev/doc/effective_go#embedding)
- [Go spec: Selectors](https://go.dev/ref/spec#Selectors)
