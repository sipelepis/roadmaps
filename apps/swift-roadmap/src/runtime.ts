/* Swift runtime: Compiler Explorer compiles and runs the code with a real swiftc (it allows cross-origin POSTs).
   XCTest isn't available to a single file on Linux, so we append our own tiny runner that prints one line per test.
   No DOM here, so verify.ts can import it under Node. */

export interface TestResult { name: string; ok: boolean; error?: string; logs?: string; expected?: string; actual?: string }
export interface RunResult { stdout: string; error: string | null; results: TestResult[] }

// ponytail: pinned compiler on a public service. Bump the id when it ages out; self-host swiftc behind an endpoint if it bites.
const COMPILER = 'swift633'

interface Line { text: string }
interface Reply { code: number; didExecute?: boolean; stdout?: Line[]; stderr?: Line[]; buildResult?: { code: number; stderr?: Line[] } }

async function compile(source: string) {
  const res = await fetch(`https://godbolt.org/api/compiler/${COMPILER}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      source, compiler: COMPILER, lang: 'swift', allowStoreCodeDebug: false,
      options: { userArguments: '', executeParameters: { args: [], stdin: '' }, compilerOptions: { executorRequest: true, skipAsm: true }, filters: { execute: true } },
    }),
  })
  if (!res.ok) throw new Error(`The Swift compiler service answered ${res.status}. Try again in a moment.`)
  return await res.json() as Reply
}

const text = (lines?: Line[]) => (lines ?? []).map(l => l.text).join('\n')

/* We send one file: a two-line preamble, then the learner's code, then the tests and the runner. `head` is what
   the preamble added, so every reported line can go back to the editor the learner wrote it in. */
interface Layout { head: number; split: number }

/** We send one file, so map its lines back to the learner's two editors. */
const place = (line: number, { head, split }: Layout) => {
  const n = line - head
  return n <= split ? `line ${n}` : `tests line ${n - split}`
}

/** "<source>:12:5: error: msg" -> "tests line 3: error: msg", and drop the compiler's echo of the source line. */
const where = (s: string, at: Layout) => s
  .split('\n')
  .filter(l => !/^\s*[|^~]/.test(l) && !/^\s*\d+\s*\|/.test(l))
  .map(l => l.replace(/(?:<source>|[\w/]*example\.swift):(\d+):(?:\d+:)?\s*/g, (_, n) => `${place(Number(n), at)}: `))
  .join('\n').trimEnd()

/** A trap prints pages of backtrace. Keep the message and where in the learner's code it happened. */
function crashLine(stderr: string, at: Layout): string {
  const fatal = stderr.match(/(?:Fatal error|Precondition failed|Swift runtime failure)[^\n]*/)?.[0]
    ?? stderr.match(/\*\*\* Program crashed: ([^\n]*)/)?.[1] ?? 'the program stopped'
  const msg = fatal.replace(/^.*?(Fatal error|Precondition failed|Swift runtime failure)/, '$1').trim()
  const frame = [...stderr.matchAll(/example\.swift:(\d+)/g)].map(m => Number(m[1])).find(n => n - at.head <= at.split + 10_000)
  return frame ? `${place(frame, at)}: ${msg}` : msg
}

/** Test functions in source order; the `///` or `//` comment right above one is its label. `async` ones included. */
function testsIn(src: string) {
  return [...src.matchAll(/(?:^[ \t]*\/\/\/? *(.+)\n)?^[ \t]*func[ \t]+(test\w*)[ \t]*\([ \t]*\)/gm)]
    .map(([, doc, name]) => ({ name, label: doc?.trim() || name.slice(4).replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ').toLowerCase() || name }))
}

// expect is the equality helper every test can call; a test's failures are collected, so the first one is reported
// with expected vs actual. A trap (force unwrap, index out of range) ends the process, so later tests say so.
const harness = (tests: { name: string; label: string }[]) => `

// ---- test runner ----
enum __Harness { nonisolated(unsafe) static var failures: [String] = [] }


func expect<T: Equatable>(_ got: T, _ want: T) {
    if got != want { __Harness.failures.append("not equal\\nexpected: \\(want)\\nactual:   \\(got)") }
}

func expect(_ condition: Bool, _ message: String = "expected true") {
    if !condition { __Harness.failures.append(message) }
}

func __report(_ name: String, _ body: () async throws -> Void) async {
    __Harness.failures = []
    print("##START \\(name)")
    do { try await body() } catch { __Harness.failures.append("threw \\(error)") }
    if let first = __Harness.failures.first {
        print("##FAIL \\(name)")
        print(first)
        print("##END")
    } else {
        print("##PASS \\(name)")
    }
}

${tests.map(t => `await __report(${JSON.stringify(t.name)}, ${t.name})`).join('\n')}
`

/** Read the runner's markers. Anything a test printed itself lands in its logs. */
function parse(out: string, tests: { name: string; label: string }[]): TestResult[] {
  const seen = new Map<string, { ok: boolean; logs: string[]; error: string[] }>()
  let cur: { ok: boolean; logs: string[]; error: string[] } | undefined
  let failing: string[] | undefined
  for (const line of out.split('\n')) {
    let m
    if ((m = line.match(/^##START (\w+)$/))) { seen.set(m[1], cur = { ok: false, logs: [], error: [] }); failing = undefined }
    else if ((m = line.match(/^##PASS (\w+)$/))) { const r = seen.get(m[1]); if (r) r.ok = true; cur = undefined }
    else if ((m = line.match(/^##FAIL (\w+)$/))) failing = seen.get(m[1])?.error
    else if (line === '##END') { failing = undefined; cur = undefined }
    else if (failing) failing.push(line)
    else if (cur) cur.logs.push(line)
  }
  return tests.map(({ name, label }) => {
    const r = seen.get(name)
    if (!r) return { name: label, ok: false, error: 'did not run' }
    const res: TestResult = { name: label, ok: r.ok, logs: r.logs.join('\n') || undefined }
    if (r.ok) return res
    const msg = r.error.join('\n')
    const cmp = msg.match(/^not equal\nexpected: ([\s\S]*)\nactual: +([\s\S]*)$/)
    if (cmp) [res.expected, res.actual] = [cmp[1], cmp[2]]
    res.error = cmp ? 'not equal' : msg.split('\n')[0] || 'failed'
    return res
  })
}

// Unbuffered output, so a trap halfway through the run doesn't take the earlier results down with it.
const PREAMBLE = 'import Foundation\nsetvbuf(stdout, nil, _IONBF, 0)\n'

/** Without tests: run the program, which is top-level code. With tests: code plus a file of test functions. */
export async function run(code: string, tests = ''): Promise<RunResult> {
  try {
    const list = testsIn(tests)
    const at: Layout = { head: tests ? PREAMBLE.split('\n').length - 1 : 0, split: code.split('\n').length + 1 }
    const source = tests ? `${PREAMBLE}${code}\n\n${tests}\n${harness(list)}` : code
    const r = await compile(source)
    const build = r.buildResult
    if (build && build.code !== 0) return { stdout: '', error: where(text(build.stderr), at) || 'the code did not compile', results: [] }
    const out = text(r.stdout)
    const stderr = text(r.stderr)
    if (!tests) {
      const failed = r.code ? crashLine(stderr, at) : ''
      return { stdout: out, error: failed || where(stderr, at) || null, results: [] }
    }
    const results = parse(out, list)
    // A trap ends the process. Blame the test that had started but never reported; the rest never got their turn.
    if (r.code !== 0) {
      const started = [...out.matchAll(/^##START (\w+)$/gm)].map(m => m[1])
      const finished = new Set([...out.matchAll(/^##(?:PASS|FAIL) (\w+)$/gm)].map(m => m[1]))
      const stopped = started.find(n => !finished.has(n))
      const i = stopped ? list.findIndex(t => t.name === stopped) : -1
      if (i >= 0) results[i] = { ...results[i], ok: false, error: crashLine(stderr, at) }
      else return { stdout: '', error: crashLine(stderr, at), results }
    }
    return { stdout: '', error: null, results }
  } catch (e) {
    return { stdout: '', error: e instanceof Error ? e.message : String(e), results: [] }
  }
}
