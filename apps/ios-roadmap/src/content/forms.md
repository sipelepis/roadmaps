# Forms & input

A form is where an app stops showing things and starts asking for them, and it is where most of an app's fiddly detail lives: which keyboard appears, where the cursor goes next, when an error is allowed to shout at you, what happens on the third tap of a submit button. SwiftUI gives you `Form`, `TextField` and `@FocusState` for the plumbing; the judgement — what counts as valid, when to say so — is ordinary Swift, and that is the part tested on this page.

## Form and its sections

`Form` is a container that renders its children as platform-styled rows: grouped, inset, with the right separators and spacing for iOS without you asking. Inside a `NavigationStack` it gets a title and a toolbar.

```swift
Form {
    Section("You") {
        TextField("Name", text: $name)
        TextField("Email", text: $email)
    }
    Section {
        Toggle("Email me offers", isOn: $optIn)
    } footer: {
        Text("You can change this later in Settings.")
    }
}
```

A `Section` is not decoration. It groups fields that belong together, and its footer is the natural home for the sentence explaining a rule *before* the user breaks it. `LabeledContent` is the row for a value the user cannot edit here.

Use `Form` rather than a `VStack` of fields whenever the screen is a form. You get keyboard avoidance, scroll-to-focused-field and the system's own spacing, none of which is worth rebuilding.

## TextField and the keyboard

A `TextField` is bound to a `String`. Everything else about it is modifiers, and they matter more than they look:

```swift
TextField("Email", text: $email)
    .keyboardType(.emailAddress)
    .textContentType(.emailAddress)
    .textInputAutocapitalization(.never)
    .autocorrectionDisabled()
    .submitLabel(.next)
```

`keyboardType` chooses the layout — `.emailAddress` puts `@` on the main keyboard, `.numberPad` removes the letters entirely. `textContentType` is the one people forget: it is what lets iOS offer the saved password, the one-time code from a text message, or the user's own address. Filling it in costs one line and removes most of the typing from your sign-up screen.

`textInputAutocapitalization(.never)` and `autocorrectionDisabled()` belong on anything that is not prose. An autocapitalised email address is a support ticket.

For multi-line text, `TextField("Notes", text: $notes, axis: .vertical)` grows as you type; `SecureField` is the masked one; `TextEditor` is the big free-form box.

## Focus

`@FocusState` is a binding to *which field is focused*, which makes "move to the next field" something you can write down.

```swift
enum Field { case name, email, password }

@FocusState private var focus: Field?

TextField("Name", text: $name).focused($focus, equals: .name)
```

Setting `focus = .email` moves the cursor; setting `focus = nil` dismisses the keyboard. `.onSubmit { }` on the form fires when the user taps the return key, and together with `.submitLabel(.next)` that is the whole "next field" chain:

```swift
.onSubmit {
    switch focus {
    case .name: focus = .email
    case .email: focus = .password
    default: submit()
    }
}
```

The other thing focus is for is failure: after a rejected submit, put the cursor in the first field that is wrong. Scrolling a user to their mistake is worth more than the message next to it.

## Validating

Validation is a pure function from the form's values to an error message, or `nil` if the field is fine. Keeping it a function — not a method on a view, not a scattering of `if`s inside `body` — is what makes it testable and what stops the same rule being written twice with two different answers.

```swift
func error(for field: Field, in form: SignUp) -> String? {
    switch field {
    case .name:
        return form.name.trimmingCharacters(in: .whitespaces).isEmpty ? "Enter your name" : nil
    ...
    }
}
```

Write the message the user will read, not a code. "Use at least 8 characters" tells someone what to do; "invalid password" tells them off.

A field with more than one rule should return the *first* failure in a sensible order — length before content — so the message changes as the user makes progress rather than listing everything at once.

## When to show an error

An empty form is invalid, and telling someone that before they have typed anything is hostile. The rule that works:

- while a field is being typed in, show nothing;
- when the user leaves a field, show that field's error;
- when the user tries to submit, show every error and move focus to the first one.

So a form needs two extra pieces of state beyond the values: which fields have been *touched* (left at least once) and whether a submit has been *attempted*. Both are ordinary properties, and the logic over them is the second exercise.

Validity and visibility are different questions. A field can be invalid and silent. Keep them separate in the model and the screen almost writes itself.

## Masking as you type

Some fields are easier to read grouped: a card number in fours, an expiry as `MM/YY`, a phone number in its local shape. The trick is that the mask is a pure function of the raw text, so you apply it on every change and write the result back:

```swift
.onChange(of: card) { _, new in
    let masked = formatCardNumber(new)
    if masked != card { card = masked }
}
```

The `if` matters: writing the same value back unconditionally is a loop waiting to happen. Strip everything that is not a digit rather than rejecting it, so a paste of `4242-4242-4242-4242` just works, and cap the length in the formatter so the field cannot hold something impossible.

## Submitting

A submit button has three states, and most bugs live between them: available, in flight, and unavailable. Disable it while a submit is running, always — otherwise the double tap makes two accounts.

Whether to disable it for an invalid form is a real choice. A permanently greyed-out button with no explanation is a dead end; letting the tap happen and then showing every error, with focus moved to the first one, tells the user what is wrong. Disable for *in flight*; validate on tap.

```swift
Button {
    submit()
} label: {
    if isSubmitting { ProgressView() } else { Text("Create account") }
}
.disabled(isSubmitting)
```

```swift playground
import Foundation

struct SignUp {
    var name = ""
    var email = ""
    var password = ""
}

func emailLooksRight(_ raw: String) -> Bool {
    let e = raw.trimmingCharacters(in: .whitespaces)
    let parts = e.split(separator: "@", omittingEmptySubsequences: false)
    guard parts.count == 2, !parts[0].isEmpty else { return false }
    let host = parts[1]
    return host.contains(".") && !host.hasPrefix(".") && !host.hasSuffix(".")
}

func error(for form: SignUp) -> String? {
    if form.name.trimmingCharacters(in: .whitespaces).isEmpty { return "Enter your name" }
    if form.email.trimmingCharacters(in: .whitespaces).isEmpty { return "Enter your email" }
    if !emailLooksRight(form.email) { return "That email does not look right" }
    if form.password.count < 8 { return "Use at least 8 characters" }
    return nil
}

// A mask is a pure function of the raw text, so it can be applied on every keystroke.
func formatCardNumber(_ raw: String) -> String {
    let d = Array(raw.filter { $0.isASCII && $0.isNumber }.prefix(16))
    return stride(from: 0, to: d.count, by: 4)
        .map { String(d[$0..<min($0 + 4, d.count)]) }
        .joined(separator: " ")
}

var form = SignUp()
for keystroke in ["", "Ada", "Ada|ada@", "Ada|ada@example.com", "Ada|ada@example.com|hunter2", "Ada|ada@example.com|hunter22"] {
    let parts = keystroke.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
    form = SignUp(name: parts.count > 0 ? parts[0] : "",
                  email: parts.count > 1 ? parts[1] : "",
                  password: parts.count > 2 ? parts[2] : "")
    print(error(for: form) ?? "ready to submit")
}

for typed in ["4", "42424", "4242424242424242", "4242-4242-4242-4242-9999"] {
    print(typed, "->", formatCardNumber(typed))
}
```

## Exercises

### 1. The rules, written once

Write `error(for:in:)`, which returns the message to show for one field of a sign-up form, or `nil` when the field is fine. Whitespace-only counts as empty, and an email is trimmed before it is judged.

- `.name` — empty: `"Enter your name"`.
- `.email` — empty: `"Enter your email"`. Otherwise it must be exactly one `@` with something before it, and a host after it that contains a `.` which is neither the first nor the last character of the host. Anything else: `"That email does not look right"`.
- `.password` — fewer than 8 characters: `"Use at least 8 characters"`. Otherwise, no digit anywhere: `"Add a number"`.
- `.confirmation` — empty: `"Repeat your password"`. Otherwise, not equal to the password: `"Those do not match"`.

The order inside a field matters: the length message comes before the digit one.

```swift starter
enum Field: Hashable, CaseIterable {
    case name, email, password, confirmation
}

struct SignUp {
    var name = ""
    var email = ""
    var password = ""
    var confirmation = ""
}

func error(for field: Field, in form: SignUp) -> String? {
    return nil
}
```

```swift test
/// names, trimmed
func testName() {
    expect(error(for: .name, in: SignUp()), "Enter your name")
    expect(error(for: .name, in: SignUp(name: "   ")), "Enter your name")
    expect(error(for: .name, in: SignUp(name: "Ada")), nil)
    expect(error(for: .name, in: SignUp(name: " Ada ")), nil)
}

/// emails that are fine
func testEmailGood() {
    expect(error(for: .email, in: SignUp(email: "ada@example.com")), nil)
    expect(error(for: .email, in: SignUp(email: "a@b.co")), nil)
    expect(error(for: .email, in: SignUp(email: "  ada@example.com  ")), nil)
    expect(error(for: .email, in: SignUp(email: "ada+shop@mail.example.com")), nil)
}

/// emails that are not
func testEmailBad() {
    expect(error(for: .email, in: SignUp()), "Enter your email")
    expect(error(for: .email, in: SignUp(email: "   ")), "Enter your email")
    let bad = "That email does not look right"
    expect(error(for: .email, in: SignUp(email: "ada")), bad)
    expect(error(for: .email, in: SignUp(email: "ada@")), bad)
    expect(error(for: .email, in: SignUp(email: "@example.com")), bad)
    expect(error(for: .email, in: SignUp(email: "ada@example")), bad)
    expect(error(for: .email, in: SignUp(email: "ada@.com")), bad)
    expect(error(for: .email, in: SignUp(email: "ada@example.")), bad)
    expect(error(for: .email, in: SignUp(email: "ada@@example.com")), bad)
}

/// passwords, length first
func testPassword() {
    expect(error(for: .password, in: SignUp()), "Use at least 8 characters")
    expect(error(for: .password, in: SignUp(password: "abc1")), "Use at least 8 characters")
    expect(error(for: .password, in: SignUp(password: "abcdefgh")), "Add a number")
    expect(error(for: .password, in: SignUp(password: "abcdefg1")), nil)
    expect(error(for: .password, in: SignUp(password: "1abcdefgh")), nil)
}

/// the confirmation only has to match
func testConfirmation() {
    expect(error(for: .confirmation, in: SignUp(password: "abcdefg1")), "Repeat your password")
    expect(error(for: .confirmation, in: SignUp(password: "abcdefg1", confirmation: "abcdefg2")), "Those do not match")
    expect(error(for: .confirmation, in: SignUp(password: "abcdefg1", confirmation: "abcdefg1")), nil)
    expect(error(for: .confirmation, in: SignUp(password: "short", confirmation: "short")), nil)
}
```

#### Uses
- [Forms & input › Validating](#/forms/validating)
- [Forms & input › Form and its sections](#/forms/form-and-its-sections)

#### Hints
- `form.name.trimmingCharacters(in: .whitespaces)` gives you the trimmed value; `.isEmpty` on the result is the empty check.
- For the email, `e.split(separator: "@", omittingEmptySubsequences: false)` must give exactly two pieces. That one flag is what makes `"ada@"` and `"@example.com"` fail instead of quietly looking fine.
- `host.contains(".") && !host.hasPrefix(".") && !host.hasSuffix(".")` is the whole host rule.
- `form.password.contains(where: \.isNumber)` is the digit check, and it runs *after* the length check.

#### Tips
- Do not reach for a regular expression here. A real email regex is unreadable and still wrong; the only test that proves an address exists is sending a mail to it. A cheap shape check that rejects obvious typos is the honest amount of validation.
- Returning the message rather than a `Bool` keeps the rule and its wording in one place. Two places is how a form ends up saying "invalid" in one screen and "Enter your name" in another.
- `CaseIterable` on `Field` is there for the next exercise: it gives you a fixed order to walk the fields in.

#### Docs
- [TextField](https://developer.apple.com/documentation/swiftui/textfield)
- [trimmingCharacters(in:)](https://developer.apple.com/documentation/foundation/nsstring/trimmingcharacters(in:))

### 2. When the error is allowed to speak

A field can be invalid and silent. `FormState` decides what the user actually sees. `errors` is handed to it — assume the previous exercise produced it.

- `visibleError(for:)` returns that field's error, but only once the field has been *blurred* or a submit has been attempted. Before that it is `nil`, whatever `errors` says.
- `blur(_:)` marks a field as left.
- `attemptSubmit()` records the attempt — which reveals every error from then on — and returns whether the form can go.
- `canSubmit` is true when there are no errors at all.
- `firstInvalidField` is the field to move focus to after a rejected submit: the first one with an error, in `Field.allCases` order.

```swift starter
enum Field: Hashable, CaseIterable {
    case name, email, password, confirmation
}

struct FormState {
    var errors: [Field: String] = [:]
    private(set) var touched: Set<Field> = []
    private(set) var didAttemptSubmit = false

    var canSubmit: Bool {
        return false
    }

    var firstInvalidField: Field? {
        return nil
    }

    mutating func blur(_ field: Field) {
    }

    mutating func attemptSubmit() -> Bool {
        return false
    }

    func visibleError(for field: Field) -> String? {
        return nil
    }
}
```

```swift test
/// nothing is said while the user is still typing
func testSilentAtFirst() {
    var state = FormState()
    state.errors = [.name: "Enter your name", .email: "Enter your email"]
    expect(state.visibleError(for: .name), nil)
    expect(state.visibleError(for: .email), nil)
    expect(state.canSubmit, false)
    expect(state.didAttemptSubmit, false)
}

/// leaving a field reveals that field, and only that field
func testBlur() {
    var state = FormState()
    state.errors = [.name: "Enter your name", .email: "Enter your email"]
    state.blur(.name)
    expect(state.visibleError(for: .name), "Enter your name")
    expect(state.visibleError(for: .email), nil)
    expect(state.touched, [.name])
    state.blur(.email)
    expect(state.visibleError(for: .email), "Enter your email")
    expect(state.touched, [.name, .email])
}

/// a blurred field that is fine still says nothing
func testBlurredAndValid() {
    var state = FormState()
    state.errors = [.email: "That email does not look right"]
    state.blur(.name)
    state.blur(.password)
    expect(state.visibleError(for: .name), nil)
    expect(state.visibleError(for: .password), nil)
    expect(state.visibleError(for: .email), nil)
}

/// a rejected submit reveals everything
func testAttemptSubmit() {
    var state = FormState()
    state.errors = [.email: "That email does not look right", .password: "Add a number"]
    expect(state.attemptSubmit(), false)
    expect(state.didAttemptSubmit, true)
    expect(state.visibleError(for: .email), "That email does not look right")
    expect(state.visibleError(for: .password), "Add a number")
    expect(state.visibleError(for: .name), nil)
}

/// a clean form goes
func testCanSubmit() {
    var state = FormState()
    expect(state.canSubmit, true)
    expect(state.firstInvalidField, nil)
    expect(state.attemptSubmit(), true)
    expect(state.didAttemptSubmit, true)
    expect(state.visibleError(for: .name), nil)
}

/// focus lands on the first bad field in declaration order
func testFirstInvalid() {
    var state = FormState()
    state.errors = [.password: "Add a number", .email: "Enter your email"]
    expect(state.firstInvalidField, .email)
    state.errors = [.confirmation: "Those do not match"]
    expect(state.firstInvalidField, .confirmation)
    state.errors = [.name: "Enter your name", .confirmation: "Those do not match"]
    expect(state.firstInvalidField, .name)
}
```

#### Uses
- [Forms & input › When to show an error](#/forms/when-to-show-an-error)
- [Forms & input › Focus](#/forms/focus)
- [Forms & input › Validating](#/forms/validating)
- [Reference › Collections](#/reference/collections)

#### Hints
- `visibleError` is one condition: `guard touched.contains(field) || didAttemptSubmit else { return nil }`, then `errors[field]`.
- `blur` is `touched.insert(field)`, and a `Set` makes the repeat insert harmless.
- `canSubmit` is `errors.isEmpty`. `attemptSubmit` sets the flag and then returns it.
- `Field.allCases.first { errors[$0] != nil }` walks the fields in the order the enum declares them.

#### Tips
- Keeping "is it wrong" and "should we say so" apart is the whole exercise. A single `showError` flag per field looks simpler and then cannot answer "what happens on submit".
- `attemptSubmit` returning `Bool` lets the caller be one line: `if state.attemptSubmit() { save() } else { focus = state.firstInvalidField }`.
- `errors` being handed in, rather than computed inside, means this type has no opinion about your rules and can be tested against any of them.

#### Docs
- [FocusState](https://developer.apple.com/documentation/swiftui/focusstate)
- [Set](https://developer.apple.com/documentation/swift/set)

### 3. A mask you apply on every keystroke

Two formatters for a payment screen. Both take whatever is currently in the field — which may be a paste, may contain punctuation, may be far too long — and return what the field should show.

`formatCardNumber` keeps only the digits, caps them at 16, and groups them in fours separated by single spaces. `formatExpiry` keeps only the digits, caps them at 4, and once there are more than two inserts a `/` after the month. Both return `""` for input with no digits in it at all.

```swift starter
func formatCardNumber(_ raw: String) -> String {
    return raw
}

func formatExpiry(_ raw: String) -> String {
    return raw
}
```

```swift test
/// grouping as the digits arrive
func testCardGrouping() {
    expect(formatCardNumber(""), "")
    expect(formatCardNumber("4"), "4")
    expect(formatCardNumber("4242"), "4242")
    expect(formatCardNumber("42425"), "4242 5")
    expect(formatCardNumber("424242424242"), "4242 4242 4242")
    expect(formatCardNumber("4242424242424242"), "4242 4242 4242 4242")
}

/// a paste full of punctuation, and far too many digits
func testCardCleaning() {
    expect(formatCardNumber("4242-4242-4242-4242"), "4242 4242 4242 4242")
    expect(formatCardNumber("4242 4242 4242 4242"), "4242 4242 4242 4242")
    expect(formatCardNumber("42424242424242429999"), "4242 4242 4242 4242")
    expect(formatCardNumber("no digits here"), "")
    expect(formatCardNumber("4a2b4c2d"), "4242")
}

/// applying the mask to its own output changes nothing
func testCardIdempotent() {
    let once = formatCardNumber("4242424242424242")
    expect(formatCardNumber(once), once)
    expect(formatCardNumber(formatCardNumber("42425")), "4242 5")
}

/// the expiry slash appears on the third digit
func testExpiry() {
    expect(formatExpiry(""), "")
    expect(formatExpiry("1"), "1")
    expect(formatExpiry("12"), "12")
    expect(formatExpiry("122"), "12/2")
    expect(formatExpiry("1226"), "12/26")
    expect(formatExpiry("12/26"), "12/26")
    expect(formatExpiry("122699"), "12/26")
}

/// deleting backwards through the slash keeps working
func testExpiryDeleting() {
    expect(formatExpiry("12/"), "12")
    expect(formatExpiry("1"), "1")
    expect(formatExpiry("//"), "")
    expect(formatExpiry("ab"), "")
}
```

#### Uses
- [Forms & input › Masking as you type](#/forms/masking-as-you-type)
- [Forms & input › TextField and the keyboard](#/forms/textfield-and-the-keyboard)
- [Reference › Strings and text](#/reference/strings-and-text)

#### Hints
- Start both with the same step: `raw.filter { $0.isASCII && $0.isNumber }`, then `.prefix(16)` or `.prefix(4)` to cap it.
- For the groups, put the digits in an `Array` and walk it: `stride(from: 0, to: d.count, by: 4)` gives the start of each group, and `String(d[$0..<min($0 + 4, d.count)])` is the group. `joined(separator: " ")` puts them together.
- The expiry is `guard d.count > 2 else { return d }`, then `"\(d.prefix(2))/\(d.dropFirst(2))"`.

#### Tips
- `testCardIdempotent` is the test that saves you in the real app. The formatter runs on the text it produced last keystroke, so a formatter that is not stable on its own output loops or eats characters.
- `isASCII && isNumber` rather than plain `isNumber`: `isNumber` is true for `٤` and `Ⅷ` too, and a card field that accepts those has a problem further down.
- Never *reject* a character — strip it. Users paste card numbers with dashes, spaces and non-breaking spaces, and every one of those should work.

#### Docs
- [Character](https://developer.apple.com/documentation/swift/character)
- [onChange(of:initial:_:)](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)-8wgw9)

### 4. The sign-up form

Build the screen the last three exercises were for: a `Form` with real keyboards, a focus chain, errors that appear at the right moment, and a submit button that cannot fire twice.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `Form` inside a `NavigationStack`, with the fields grouped into `Section`s and a footer explaining the password rule.
- `keyboardType`, `textContentType`, `textInputAutocapitalization` and `autocorrectionDisabled` set correctly on each field; `SecureField` for the two password fields.
- `@FocusState private var focus: Field?` with `.focused($focus, equals:)` on every field, `.submitLabel(.next)` on all but the last, and `.onSubmit` walking the chain.
- Blurring a field reveals only that field's error: an `.onChange(of: focus)` that calls `blur` on the field being left.
- An error row under a field that shows `visibleError(for:)` when it is non-`nil`, in `.footnote` and `.red`, and takes no space when it is `nil`.
- A submit button that validates on tap, moves focus to `firstInvalidField` when the form is rejected, and is disabled — showing a `ProgressView` — while a submit is in flight.
- A `#Preview`.

```swift solution
// SignUpScreen.swift
struct SignUpScreen: View {
    @State private var form = SignUp()
    @State private var state = FormState()
    @State private var isSubmitting = false
    @FocusState private var focus: Field?

    var body: some View {
        NavigationStack {
            Form {
                Section("You") {
                    TextField("Name", text: $form.name)
                        .textContentType(.name)
                        .focused($focus, equals: .name)
                        .submitLabel(.next)
                    errorRow(.name)

                    TextField("Email", text: $form.email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                    errorRow(.email)
                }

                Section {
                    SecureField("Password", text: $form.password)
                        .textContentType(.newPassword)
                        .focused($focus, equals: .password)
                        .submitLabel(.next)
                    errorRow(.password)

                    SecureField("Repeat password", text: $form.confirmation)
                        .textContentType(.newPassword)
                        .focused($focus, equals: .confirmation)
                        .submitLabel(.done)
                    errorRow(.confirmation)
                } footer: {
                    Text("At least 8 characters, including a number.")
                }

                Section {
                    Button(action: submit) {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Create account")
                        }
                    }
                    .disabled(isSubmitting)
                }
            }
            .navigationTitle("Sign up")
            .onChange(of: form) { _, _ in revalidate() }
            .onChange(of: focus) { previous, _ in
                if let previous { state.blur(previous) }
            }
            .onSubmit(advance)
        }
    }

    @ViewBuilder
    private func errorRow(_ field: Field) -> some View {
        if let message = state.visibleError(for: field) {
            Text(message)
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }

    private func revalidate() {
        state.errors = Dictionary(uniqueKeysWithValues: Field.allCases.compactMap { field in
            error(for: field, in: form).map { (field, $0) }
        })
    }

    private func advance() {
        switch focus {
        case .name: focus = .email
        case .email: focus = .password
        case .password: focus = .confirmation
        default: submit()
        }
    }

    private func submit() {
        revalidate()
        guard state.attemptSubmit() else {
            focus = state.firstInvalidField
            return
        }
        focus = nil
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            try? await Task.sleep(for: .seconds(1))   // stand-in for the real call
        }
    }
}

// SignUp has to be Equatable for .onChange(of: form) to work.
extension SignUp: Equatable {}

#Preview {
    SignUpScreen()
}
```

#### Uses
- [Forms & input › Form and its sections](#/forms/form-and-its-sections)
- [Forms & input › TextField and the keyboard](#/forms/textfield-and-the-keyboard)
- [Forms & input › Focus](#/forms/focus)
- [Forms & input › Submitting](#/forms/submitting)
- [Reference › SwiftUI text input and forms](#/reference/swiftui-text-input-and-forms)

#### Hints
- `.focused($focus, equals: .email)` ties one field to one case of your `Field` enum; the `@FocusState` property is optional so that `nil` means "keyboard down".
- `.onChange(of: focus) { previous, _ in ... }` gives you the field being *left*, which is exactly the blur event SwiftUI does not otherwise expose.
- A `@ViewBuilder` function returning nothing at all in the `nil` case is how you get a row that costs no space when there is no error.
- `.onSubmit(advance)` passes the method as the closure — there is no need to write `{ advance() }`.

#### Tips
- Do not disable the button for an invalid form. A greyed-out control with no explanation is the most common dead end in an app; validating on tap and jumping to the first mistake tells the user what to do instead.
- `.disabled(isSubmitting)` is not optional. Without it the impatient double-tap creates two accounts, and that bug only appears on a slow network, which is never where you are testing.
- `textContentType(.newPassword)` is what lets iOS offer to generate and save a strong password. `.password` on a sign-in screen and `.newPassword` on a sign-up one are different for a reason.

#### Docs
- [Form](https://developer.apple.com/documentation/swiftui/form)
- [focused(_:equals:)](https://developer.apple.com/documentation/swiftui/view/focused(_:equals:))
- [onSubmit(of:_:)](https://developer.apple.com/documentation/swiftui/view/onsubmit(of:_:))

### 5. The payment fields

Build a short payment form around the masks from exercise 3: a number pad, text that reformats itself as it is typed, and a way to get the keyboard back down.

This one is not marked here. Work through the checklist, then open the reference solution and compare.

#### Build it
- A `Form` with a card number field, an expiry field and a CVC field, each with `.keyboardType(.numberPad)`.
- `.textContentType(.creditCardNumber)` on the card field so iOS can offer a scanned or saved card.
- `.onChange(of:)` on the card and expiry fields applying `formatCardNumber` / `formatExpiry` and writing back **only when the value actually changed**.
- `.font(.body.monospacedDigit())` on the number fields so the digits stop jittering as groups appear.
- A `.keyboard`-placed toolbar with a Done button that sets `focus = nil`, because a number pad has no return key.
- A CVC field capped at 4 digits with its own mask, and `.submitLabel` left alone since there is nothing to submit to.
- A `#Preview`.

```swift solution
// PaymentScreen.swift
struct PaymentScreen: View {
    private enum Field {
        case card, expiry, cvc
    }

    @State private var card = ""
    @State private var expiry = ""
    @State private var cvc = ""
    @FocusState private var focus: Field?

    var body: some View {
        NavigationStack {
            Form {
                Section("Card") {
                    TextField("Card number", text: $card)
                        .keyboardType(.numberPad)
                        .textContentType(.creditCardNumber)
                        .font(.body.monospacedDigit())
                        .focused($focus, equals: .card)
                        .onChange(of: card) { _, new in
                            let masked = formatCardNumber(new)
                            if masked != card { card = masked }
                        }

                    HStack {
                        TextField("MM/YY", text: $expiry)
                            .keyboardType(.numberPad)
                            .font(.body.monospacedDigit())
                            .focused($focus, equals: .expiry)
                            .onChange(of: expiry) { _, new in
                                let masked = formatExpiry(new)
                                if masked != expiry { expiry = masked }
                            }

                        Divider()

                        TextField("CVC", text: $cvc)
                            .keyboardType(.numberPad)
                            .font(.body.monospacedDigit())
                            .focused($focus, equals: .cvc)
                            .onChange(of: cvc) { _, new in
                                let digits = String(new.filter { $0.isASCII && $0.isNumber }.prefix(4))
                                if digits != cvc { cvc = digits }
                            }
                    }
                } footer: {
                    Text("We never see your card details.")
                }
            }
            .navigationTitle("Payment")
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focus = nil }
                }
            }
        }
    }
}

#Preview {
    PaymentScreen()
}
```

#### Uses
- [Forms & input › Masking as you type](#/forms/masking-as-you-type)
- [Forms & input › TextField and the keyboard](#/forms/textfield-and-the-keyboard)
- [Forms & input › Focus](#/forms/focus)

#### Hints
- `.onChange(of: card) { _, new in ... }` hands you the new value; compare the masked version against the current state before assigning, or the write triggers another change.
- `ToolbarItemGroup(placement: .keyboard)` puts controls in the bar above the keyboard. A `Spacer()` before the button pushes it to the trailing edge.
- `focus = nil` dismisses the keyboard, because the `@FocusState` property is an `Optional`.
- A number pad has no return key at all, so `.onSubmit` never fires for these fields — the toolbar button is not decoration.

#### Tips
- Monospaced digits are the difference between a card number that reformats calmly and one that jumps sideways on every fourth keystroke. `.monospacedDigit()` changes only the figures, so the placeholder text still looks normal.
- Test the paste path by hand in the simulator: copy `4242-4242-4242-4242` and paste it into the field. A formatter that only handles single keystrokes will not survive it.
- Resist validating the card here. Length and shape are a keyboard concern; whether the card works is the payment provider's answer, and guessing it locally only produces false rejections.

#### Docs
- [keyboardType(_:)](https://developer.apple.com/documentation/swiftui/view/keyboardtype(_:))
- [textContentType(_:)](https://developer.apple.com/documentation/swiftui/view/textcontenttype(_:)-ufdv)
- [ToolbarItemGroup](https://developer.apple.com/documentation/swiftui/toolbaritemgroup)
