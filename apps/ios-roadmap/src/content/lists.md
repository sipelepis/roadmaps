# Lists & identity

`List` is the workhorse of iOS: scrolling, cell reuse, separators, swipe actions, selection and editing, all from a `ForEach`. What makes it work — and what makes it go wrong — is identity. SwiftUI does not diff your rows by looking at them; it asks each one who it is, and then decides what was inserted, removed, moved or merely updated. Give it bad answers and you get rows that animate from nowhere, state that jumps between cells, and a table that rebuilds itself on every keystroke.

## `List` and `ForEach`

`List` is the container: a scrolling, platform-styled table. `ForEach` is the thing that turns a collection into views, and it works anywhere — inside a `List`, a `VStack`, a `LazyVGrid`.

```swift
List {
    Text("A fixed row")
    ForEach(items) { item in
        ItemRow(item: item)
    }
}
```

The shorthand `List(items) { item in … }` is the same thing with the `ForEach` written for you. Use the long form as soon as you need a header, a fixed row, or more than one section — mixing static rows and a `ForEach` in one `List` is perfectly normal.

`ForEach` is not a `for` loop. It is a view that keeps a collection and an id function, and SwiftUI calls its content closure only for the rows it actually needs.

## Identity is the whole game

Between one state and the next, SwiftUI has two arrays of rows and has to work out what happened. It does that by identity, not by position:

- an id in the new list but not the old was **inserted**;
- an id in the old list but not the new was **removed**;
- an id in both, at a different place, **moved**;
- an id in both, at the same place, with different content, was **updated in place**.

Only the last case keeps the row's view: same identity means the same `@State`, the same scroll position, the same in-flight animation. A row whose identity changes is a different row, and everything the old one held is gone. That is the mechanism behind almost every list bug, and the first exercise is exactly this calculation.

## What makes a good id

An id must be **stable** (the same item has the same id across reloads) and **unique** within the list. Conforming to `Identifiable` is the clean way to say so:

```swift
struct Task: Identifiable {
    let id: UUID
    var title: String
    var isDone: Bool
}
```

The shortcuts are where it goes wrong:

- `id: \.self` on a `String` array means the id *is* the text. Edit the text and the row is destroyed and recreated; two identical strings and you have two rows sharing one identity, which SwiftUI will warn you about and then render badly.
- The array index is stable only until something is inserted at the front, at which point every row below has changed identity and the whole list animates.
- A server id is the best answer when you have one. For rows created on device before the server has seen them, generate a `UUID` at creation and keep it.

`let id`, not `var id`. An id that can be reassigned is one that will be.

## Sections

`Section` groups rows under a header, and `List` styles the groups for you:

```swift
List {
    ForEach(groups, id: \.title) { group in
        Section(group.title) {
            ForEach(group.tasks) { task in TaskRow(task: task) }
        }
    }
}
```

Grouping is your job, not the list's: turn a flat array into sections in ordinary Swift, then render them. Doing it in a computed property — rather than keeping a separate grouped copy in `@State` — is the single-source-of-truth rule applied to a list.

Note the two ids at work: the sections have one, and the rows inside have their own. Both have to be stable, or a section reshuffle will take its rows' identities with it.

## Swipe actions and row buttons

`.swipeActions(edge:)` attaches buttons to a row:

```swift
.swipeActions(edge: .trailing) {
    Button("Delete", role: .destructive) { delete(task) }
}
```

A trailing `.destructive` button is the one a full swipe triggers. `.swipeActions(edge: .leading)` gives you the other side, and `allowsFullSwipe: false` turns off the gesture shortcut when the action is too dangerous to fire by accident.

`.onDelete` and `.onMove` are the older, list-level API, and they still earn their place: they wire up automatically with `EditButton`, which swipe actions do not.

Two rules that are easy to break. Anything you offer as a swipe must also be reachable another way — a swipe is invisible, and VoiceOver users reach it through the actions rotor only if you gave the button a real label. And a destructive action with no undo needs a confirmation.

## Selection

A `List` with a selection binding manages it for you:

```swift
@State private var selection: Set<Task.ID> = []

List(tasks, selection: $selection) { task in
    TaskRow(task: task)
}
```

A `Set<ID>` binding gives multiple selection; a `Binding<ID?>` gives single selection. On iOS, multiple selection only appears in edit mode, which is what `EditButton()` toggles.

The part the framework does not do is keep the selection honest. Delete the selected rows and their ids stay in the set — stale entries that count towards "3 selected" and match nothing. Pruning the selection against the current items whenever either changes is the third exercise, and it is worth doing in one place rather than at every call site.

## Lists that stay fast

`List` is lazy and reuses rows, so a list of ten thousand items is fine as long as each row is cheap. The things that make it slow are usually yours:

- **Work in the row's `body`.** Date formatting, sorting, a `filter` over the whole array — anything done per row per frame. Compute it once, outside.
- **An unstable id.** If the identity churns, nothing can be reused and every scroll is a rebuild.
- **`ScrollView { LazyVStack { … } }` when you wanted a `List`.** It is lazy, but you lose reuse, swipe actions, selection and editing. Reach for it when you genuinely need a custom layout, not by default.
- **A whole-array copy per keystroke.** Filtering a large array in a computed property that the search field invalidates is O(n) per character; that is fine for hundreds and not for tens of thousands.

Measure before you rewrite. Instruments' SwiftUI template shows you which views are re-evaluating, which is usually a different answer from the one you guessed.

```swift playground
// What SwiftUI works out between two states of a list. Identity decides
// everything: same id means the same row, kept along with its state.
func diff(from old: [String], to new: [String]) -> (inserted: [String], removed: [String], moved: [String]) {
    let oldSet = Set(old), newSet = Set(new)
    let removed = old.filter { !newSet.contains($0) }
    let inserted = new.filter { !oldSet.contains($0) }
    let oldSurvivors = old.filter { newSet.contains($0) }
    let newSurvivors = new.filter { oldSet.contains($0) }
    let wasAt = Dictionary(uniqueKeysWithValues: oldSurvivors.enumerated().map { ($0.element, $0.offset) })
    let moved = newSurvivors.enumerated().filter { wasAt[$0.element] != $0.offset }.map(\.element)
    return (inserted, removed, moved)
}

func show(_ old: [String], _ new: [String]) {
    let d = diff(from: old, to: new)
    print("\(old) -> \(new)")
    print("   inserted \(d.inserted)  removed \(d.removed)  moved \(d.moved)")
}

show(["a", "b", "c"], ["a", "b", "c"])          // nothing happened
show(["a", "b", "c"], ["a", "b", "c", "d"])     // one insert, no moves
show(["a", "b", "c"], ["a", "c"])               // one delete, no moves
show(["a", "b", "c"], ["c", "a", "b"])          // everything shifted
show(["a", "b"], ["c", "d"])                    // a different list entirely

// Now the id-is-the-text trap: rename one row and it is not a rename at all.
show(["Buy milk", "Call mum"], ["Buy oat milk", "Call mum"])

// Try: make two rows share an id and see how the arithmetic stops making sense.
```

## Exercises

### 1. What changed?

Given the list before and the list after, work out what SwiftUI would animate.

`diff(from:to:)` compares two arrays of row ids:

- **removed**: ids in `old` and not in `new`, in the order they appear in `old`.
- **inserted**: ids in `new` and not in `old`, in the order they appear in `new`.
- **moved**: ids present in both, whose index *among the surviving ids* is different in the two lists. Report them in the order they appear in `new`.

Ids are unique within each list.

```swift starter
struct Changes: Equatable {
    var inserted: [String] = []
    var removed: [String] = []
    var moved: [String] = []
}

func diff(from old: [String], to new: [String]) -> Changes {
    return Changes()
}
```

```swift test
/// an unchanged list has nothing to animate
func testNoChange() {
    expect(diff(from: ["a", "b", "c"], to: ["a", "b", "c"]), Changes())
    expect(diff(from: [], to: []), Changes())
}

/// inserting keeps everyone else's identity
func testInsert() {
    expect(diff(from: ["a", "b"], to: ["a", "b", "c"]), Changes(inserted: ["c"]))
    expect(diff(from: [], to: ["a", "b"]), Changes(inserted: ["a", "b"]))
}

/// removing from the middle does not move what is left
func testRemove() {
    expect(diff(from: ["a", "b", "c"], to: ["a", "c"]), Changes(removed: ["b"]))
    expect(diff(from: ["a", "b"], to: []), Changes(removed: ["a", "b"]))
}

/// a reorder is reported in the new list's order
func testMove() {
    expect(diff(from: ["a", "b"], to: ["b", "a"]), Changes(moved: ["b", "a"]))
    expect(diff(from: ["a", "b", "c"], to: ["c", "a", "b"]), Changes(moved: ["c", "a", "b"]))
}

/// inserts and removes are not moves
func testInsertDoesNotCountAsMove() {
    expect(diff(from: ["a", "b"], to: ["z", "a", "b"]), Changes(inserted: ["z"]))
    expect(diff(from: ["a", "b", "c"], to: ["b", "c"]), Changes(removed: ["a"]))
}

/// a completely different list shares no identity at all
func testReplaced() {
    expect(diff(from: ["a", "b"], to: ["c", "d"]),
           Changes(inserted: ["c", "d"], removed: ["a", "b"]))
}

/// all three at once
func testEverything() {
    expect(diff(from: ["a", "b", "c", "d"], to: ["d", "b", "e"]),
           Changes(inserted: ["e"], removed: ["a", "c"], moved: ["d", "b"]))
}
```

#### Uses
- [Lists & identity › Identity is the whole game](#/lists/identity-is-the-whole-game)
- [Lists & identity › What makes a good id](#/lists/what-makes-a-good-id)

#### Hints
- Build `Set(old)` and `Set(new)` once. Every membership question is then O(1) and `filter` reads straight off the description.
- The survivors are `old.filter { newSet.contains($0) }` and `new.filter { oldSet.contains($0) }` — the same ids, two orders.
- Build a dictionary from id to its index in the old survivors, then keep the new survivors whose index does not match.
- `array.enumerated()` gives you `(offset, element)` pairs, which is exactly the comparison you need.

#### Tips
- Work `testEverything` out by hand before you code it. `a` and `c` are gone, `e` is new, and the survivors are `d, b` in the old order `b, d` — both indices changed, so both moved.
- This is the naive definition of "moved": every survivor whose index changed. A real diffing algorithm computes the longest common subsequence and reports only the minimum set of moves, so the shift of `["a","b","c"]` to `["c","a","b"]` would come back as one move, not three. Same information, a much nicer animation.
- The last playground line is the one worth remembering: with `id: \.self`, editing a row's text is an insert plus a delete, not an update. Everything that row held is thrown away, which is why a text field in it loses focus mid-word.

#### Docs
- [Identifiable](https://developer.apple.com/documentation/swift/identifiable)
- [ForEach](https://developer.apple.com/documentation/swiftui/foreach)

### 2. Group a flat list into sections

A `List` renders sections; deciding what they are is ordinary Swift. Turn a flat array into sections.

`sections(of:)` returns one section per distinct group name, sorted by title. Inside a section, the items keep the relative order they had in the input — items of the same group need not be adjacent there. An empty input has no sections, and no section is ever empty.

```swift starter
struct Item: Identifiable, Equatable {
    let id: Int
    let name: String
    let group: String
}

struct Section: Equatable {
    let title: String
    let items: [Item]
}

func sections(of items: [Item]) -> [Section] {
    return []
}
```

```swift test
let inbox = Item(id: 1, name: "Reply to Ada", group: "Inbox")
let later = Item(id: 2, name: "Read the RFC", group: "Later")
let inbox2 = Item(id: 3, name: "Book the room", group: "Inbox")
let archive = Item(id: 4, name: "Old receipt", group: "Archive")

/// nothing in, nothing out
func testEmpty() {
    expect(sections(of: []), [])
}

/// one group is one section
func testSingleGroup() {
    expect(sections(of: [inbox, inbox2]), [Section(title: "Inbox", items: [inbox, inbox2])])
}

/// sections come out sorted by title
func testSorted() {
    expect(sections(of: [later, archive]).map(\.title), ["Archive", "Later"])
    expect(sections(of: [inbox, later, archive]).map(\.title), ["Archive", "Inbox", "Later"])
}

/// items of a group need not be adjacent in the input
func testScattered() {
    let result = sections(of: [inbox, later, inbox2, archive])
    expect(result.map(\.title), ["Archive", "Inbox", "Later"])
    expect(result[1].items, [inbox, inbox2])
    expect(result[0].items, [archive])
    expect(result[2].items, [later])
}

/// the input order inside a section is preserved, not re-sorted
func testKeepsOrderWithinSection() {
    expect(sections(of: [inbox2, inbox])[0].items, [inbox2, inbox])
    expect(sections(of: [inbox, inbox2])[0].items, [inbox, inbox2])
}

/// every item lands in exactly one section
func testTotalIsPreserved() {
    let all = [inbox, later, inbox2, archive]
    expect(sections(of: all).reduce(0) { $0 + $1.items.count }, all.count)
    expect(sections(of: all).allSatisfy { !$0.items.isEmpty }, true)
}
```

#### Uses
- [Lists & identity › Sections](#/lists/sections)
- [Lists & identity › `List` and `ForEach`](#/lists/list-and-foreach)
- [Reference › Collections](#/reference/collections)

#### Hints
- `Set(items.map(\.group)).sorted()` gives you the section titles, in order, with no duplicates.
- Then one `map` over those titles, each one filtering the original array: the filter preserves the input order for free.
- `Dictionary(grouping:by:)` is the other route, and it is faster; its keys come out in no particular order, so you still have to sort them.
- No section can be empty because every title came from an item that has it.

#### Tips
- Sort the titles, do not trust the dictionary. `Dictionary` has no order at all, and a `List` whose sections shuffle between launches is a bug that only shows up on someone else's device.
- Notice this is a function of the items, so in a view it belongs in a computed property rather than a second `@State`. One source of truth, and the sections cannot go stale.
- Grouping by a display string is convenient and lossy. A section keyed by an enum or an id, with the title derived for display, survives localisation and renaming.

#### Docs
- [Section](https://developer.apple.com/documentation/swiftui/section)
- [Dictionary(grouping:by:)](https://developer.apple.com/documentation/swift/dictionary/init(grouping:by:))

### 3. Keep the selection honest

`List` keeps a `Set` of selected ids and will happily hold on to ids for rows that no longer exist. Write the piece that does not.

`apply(_:to:in:)` returns the new selection, and it has one invariant: the result never contains an id that is not in `items`, whatever the action was.

- `.toggle(id)` adds the id if it is not selected and removes it if it is — but only for an id that is actually in `items`.
- `.selectAll` selects every current item.
- `.clear` selects nothing.

`label(for:in:)` is the toolbar's title, counting only ids that are still real: `"Select Items"` for none, `"All Selected"` when every item is selected, and `"3 Selected"` otherwise.

```swift starter
struct Item: Identifiable, Equatable {
    let id: Int
    let name: String
}

enum SelectionAction {
    case toggle(Int)
    case selectAll
    case clear
}

func apply(_ action: SelectionAction, to selection: Set<Int>, in items: [Item]) -> Set<Int> {
    return selection
}

func label(for selection: Set<Int>, in items: [Item]) -> String {
    return "Select Items"
}
```

```swift test
let items = [Item(id: 1, name: "One"), Item(id: 2, name: "Two"), Item(id: 3, name: "Three")]

/// toggling adds and then removes
func testToggle() {
    expect(apply(.toggle(2), to: [], in: items), [2])
    expect(apply(.toggle(2), to: [2], in: items), [])
    expect(apply(.toggle(3), to: [1], in: items), [1, 3])
}

/// select all and clear
func testBulk() {
    expect(apply(.selectAll, to: [], in: items), [1, 2, 3])
    expect(apply(.selectAll, to: [2], in: items), [1, 2, 3])
    expect(apply(.clear, to: [1, 2, 3], in: items), [])
    expect(apply(.selectAll, to: [1], in: []), [])
}

/// an id that is not on screen cannot be selected
func testUnknownId() {
    expect(apply(.toggle(99), to: [1], in: items), [1])
    expect(apply(.toggle(99), to: [], in: items), [])
}

/// stale ids are dropped whatever the action was
func testPrunesStale() {
    expect(apply(.toggle(1), to: [1, 99], in: items), [])
    expect(apply(.toggle(2), to: [99], in: items), [2])
    expect(apply(.clear, to: [99], in: items), [])
    expect(apply(.selectAll, to: [99], in: items), [1, 2, 3])
}

/// the toolbar counts only what is really there
func testLabel() {
    expect(label(for: [], in: items), "Select Items")
    expect(label(for: [99], in: items), "Select Items")
    expect(label(for: [2], in: items), "1 Selected")
    expect(label(for: [1, 2, 99], in: items), "2 Selected")
    expect(label(for: [1, 2, 3], in: items), "All Selected")
    expect(label(for: [1, 2, 3, 99], in: items), "All Selected")
}

/// an empty list has nothing to select
func testEmptyList() {
    expect(label(for: [], in: []), "Select Items")
    expect(label(for: [1], in: []), "Select Items")
}
```

#### Uses
- [Lists & identity › Selection](#/lists/selection)
- [Lists & identity › Identity is the whole game](#/lists/identity-is-the-whole-game)
- [State & bindings › One source of truth](#/state/one-source-of-truth)
- [Reference › Collections](#/reference/collections)

#### Hints
- Build `let live = Set(items.map(\.id))` first, and intersect with it on the way out. One `.intersection(live)` at the end enforces the invariant for every action at once.
- `Set` has `insert`, `remove` and `contains`, and `symmetricDifference([id])` is a toggle in one call.
- For `label`, count `selection.intersection(live)` — never `selection.count`.
- "All Selected" needs the item count to be non-zero, or an empty list claims everything is selected.

#### Tips
- `testPrunesStale`'s first case is the bug in the wild: 1 and 99 are selected, you toggle 1 off, and a naive implementation leaves `[99]` behind — a selection of one row that does not exist, and a Delete button that deletes nothing while looking enabled.
- Doing the pruning once, at the end, rather than per action is what keeps this correct as actions get added. The invariant lives in one place instead of four.
- On iOS multiple selection only appears in edit mode. That is a presentation detail; the set is just as real when the list is not editing, which is why this logic does not mention edit mode at all.

#### Docs
- [List selection](https://developer.apple.com/documentation/swiftui/list/init(_:selection:rowcontent:)-6ttdp)
- [EditButton](https://developer.apple.com/documentation/swiftui/editbutton)

### 4. A sectioned task list with swipe actions

Build a grouped task list where each row can be completed or deleted with a swipe, and the grouping is derived rather than stored.

#### Build it
- A `Task` model conforming to `Identifiable` with a `let id: UUID`, not an index and not the title.
- `@State private var tasks: [Task]` as the only stored list state; the sections are a computed property.
- `List` containing a `ForEach` of sections, each a `Section` with a title and its own inner `ForEach`.
- A trailing `.swipeActions` with a `.destructive` Delete, and a leading one that toggles done, tinted green.
- Rows that visibly update in place when toggled — the row keeps its position and animates, rather than being removed and re-added.

```swift solution
// Task.swift
struct Task: Identifiable, Equatable {
    let id: UUID
    var title: String
    var list: String
    var isDone: Bool

    init(id: UUID = UUID(), title: String, list: String, isDone: Bool = false) {
        self.id = id
        self.title = title
        self.list = list
        self.isDone = isDone
    }

    static let samples = [
        Task(title: "Reply to Ada", list: "Inbox"),
        Task(title: "Book the room", list: "Inbox"),
        Task(title: "Read the RFC", list: "Later", isDone: true),
        Task(title: "Old receipt", list: "Archive"),
    ]
}

// TaskListScreen.swift
struct TaskListScreen: View {
    @State private var tasks = Task.samples

    // Derived, so it can never disagree with `tasks`.
    private var groups: [(title: String, tasks: [Task])] {
        Set(tasks.map(\.list)).sorted().map { title in
            (title: title, tasks: tasks.filter { $0.list == title })
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(groups, id: \.title) { group in
                    Section(group.title) {
                        ForEach(group.tasks) { task in
                            TaskRow(task: task)
                                .swipeActions(edge: .trailing) {
                                    Button("Delete", systemImage: "trash", role: .destructive) {
                                        delete(task)
                                    }
                                }
                                .swipeActions(edge: .leading) {
                                    Button(task.isDone ? "Undo" : "Done",
                                           systemImage: task.isDone ? "arrow.uturn.backward" : "checkmark") {
                                        toggle(task)
                                    }
                                    .tint(.green)
                                }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Tasks")
            .animation(.default, value: tasks)
        }
    }

    private func toggle(_ task: Task) {
        guard let index = tasks.firstIndex(where: { $0.id == task.id }) else { return }
        tasks[index].isDone.toggle()
    }

    private func delete(_ task: Task) {
        tasks.removeAll { $0.id == task.id }
    }
}

// TaskRow.swift
struct TaskRow: View {
    let task: Task

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: task.isDone ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(task.isDone ? Color.green : Color.secondary)
                .accessibilityHidden(true)
            Text(task.title)
                .strikethrough(task.isDone)
                .foregroundStyle(task.isDone ? Color.secondary : Color.primary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(task.isDone ? "\(task.title), done" : task.title)
    }
}

#Preview {
    TaskListScreen()
}
```

#### Uses
- [Lists & identity › Sections](#/lists/sections)
- [Lists & identity › Swipe actions and row buttons](#/lists/swipe-actions-and-row-buttons)
- [Lists & identity › What makes a good id](#/lists/what-makes-a-good-id)
- [State & bindings › One source of truth](#/state/one-source-of-truth)

#### Hints
- `ForEach(groups, id: \.title)` gives the sections an identity; the inner `ForEach(group.tasks)` uses `Task`'s own `id`.
- Mutate through the index — `tasks[index].isDone.toggle()` — so the array is the single source of truth and the row is updated rather than replaced.
- `Button("Delete", systemImage: "trash", role: .destructive) { … }` gets you the label, the icon and the red in one call.
- `.animation(.default, value: tasks)` needs `Task: Equatable`, which the synthesised conformance gives you.

#### Tips
- Try changing `Task`'s id to `var id: String { title }` and then toggling a task. The row's identity is unchanged, so nothing breaks — until you rename one, at which point the row is deleted and a different one appears. Identity bugs hide until the data changes in the one way you did not test.
- The swipe is invisible, so the delete has to exist somewhere a VoiceOver user can find it. Because these are real `Button`s with real labels, they land in the actions rotor automatically; a custom gesture would not.
- Deriving `groups` rather than storing it means there is no "regroup after edit" step to forget. It costs a sort per body call, which for a screenful of tasks is nothing.

#### Docs
- [swipeActions(edge:allowsFullSwipe:content:)](https://developer.apple.com/documentation/swiftui/view/swipeactions(edge:allowsfullswipe:content:))
- [Lists](https://developer.apple.com/documentation/swiftui/lists)

### 5. Multi-select and a bulk action

Add edit mode, multiple selection, and a delete that cannot leave a stale selection behind.

#### Build it
- `@State private var selection: Set<Message.ID> = []` and a `List(messages, selection: $selection)`.
- An `EditButton()` in the navigation bar; multiple selection appears only in edit mode.
- A bottom toolbar button showing the live count — "Delete 3" — and `.disabled` when nothing is selected.
- Deleting removes the selected messages *and* empties the selection, so nothing stale survives.
- A navigation title that switches to "Select Messages" / "2 Selected" / "All Selected" while editing.

```swift solution
// Message.swift
struct Message: Identifiable, Equatable {
    let id: UUID
    var sender: String
    var subject: String
    var isUnread: Bool

    init(id: UUID = UUID(), sender: String, subject: String, isUnread: Bool = false) {
        self.id = id
        self.sender = sender
        self.subject = subject
        self.isUnread = isUnread
    }

    static let samples = [
        Message(sender: "Ada", subject: "Analytical engine notes", isUnread: true),
        Message(sender: "Grace", subject: "Found an actual bug"),
        Message(sender: "Alan", subject: "On computable numbers", isUnread: true),
    ]
}

// InboxScreen.swift
struct InboxScreen: View {
    @State private var messages = Message.samples
    @State private var selection: Set<Message.ID> = []

    private var title: String {
        let live = selection.intersection(Set(messages.map(\.id)))
        if live.isEmpty { return "Select Messages" }
        if live.count == messages.count { return "All Selected" }
        return "\(live.count) Selected"
    }

    var body: some View {
        NavigationStack {
            List(messages, selection: $selection) { message in
                MessageRow(message: message)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    EditButton()
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("Delete \(selection.count)", role: .destructive) {
                        deleteSelected()
                    }
                    .disabled(selection.isEmpty)
                }
            }
        }
    }

    private func deleteSelected() {
        withAnimation {
            messages.removeAll { selection.contains($0.id) }
            // The framework will not do this for you.
            selection.removeAll()
        }
    }
}

// MessageRow.swift
struct MessageRow: View {
    let message: Message

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Circle()
                .fill(message.isUnread ? Color.accentColor : Color.clear)
                .frame(width: 8, height: 8)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(message.sender)
                    .font(.headline)
                Text(message.subject)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message.isUnread ? "Unread, \(message.sender), \(message.subject)"
                                             : "\(message.sender), \(message.subject)")
    }
}

#Preview {
    InboxScreen()
}
```

#### Uses
- [Lists & identity › Selection](#/lists/selection)
- [Lists & identity › `List` and `ForEach`](#/lists/list-and-foreach)
- [State & bindings › `@State` is storage the view does not own](#/state/state-is-storage-the-view-does-not-own)
- [Reference › Collections](#/reference/collections)
- [Reference › SwiftUI lists and navigation](#/reference/swiftui-lists-and-navigation)

#### Hints
- `Message.ID` is `UUID` because `Identifiable` gives you the associated type; writing `Set<Message.ID>` keeps it right if the id type ever changes.
- `EditButton()` needs a `NavigationStack` above it to appear, and it toggles the environment's edit mode for everything below.
- Delete and clear in the same `withAnimation` block, so the rows and the toolbar change together.
- Run it and delete a selection without the `selection.removeAll()`. The stale ids are the whole point of the exercise.

#### Tips
- The title's `intersection` is the same defensive step as the third exercise, and for the same reason: a count taken from the raw set is a count of ids, not of rows.
- `Button("Delete \(selection.count)", role: .destructive)` in a bottom bar is the system pattern, and `role:` rather than `.foregroundStyle(.red)` is what makes it red *and* announced as destructive.
- Real bulk deletes want a confirmation — `.confirmationDialog` — as soon as there is no undo. Three taps is not a lot to ask before "Delete 412".

#### Docs
- [Selecting list items](https://developer.apple.com/documentation/swiftui/list)
- [ToolbarItem](https://developer.apple.com/documentation/swiftui/toolbaritem)
