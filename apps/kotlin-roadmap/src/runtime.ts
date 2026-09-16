/* Kotlin runtime: the official Kotlin Playground API compiles and runs the code (it allows cross-origin POSTs).
   /compiler/run runs a program; /compiler/test runs JUnit tests and reports each one separately.
   No DOM here, so verify.ts can import it under Node. */

export interface TestResult { name: string; ok: boolean; error?: string; logs?: string; expected?: string; actual?: string }
export interface RunResult { stdout: string; error: string | null; results: TestResult[] }

// ponytail: pinned version, public API. Bump when the playground drops it; self-host kotlin-compiler-server if it bites.
const VERSION = '2.2.20'
const FILE = 'File.kt'

interface Err { interval: { start: { line: number; ch: number } }; message: string; severity: 'ERROR' | 'WARNING' | 'INFO' }
interface Frame { className: string; methodName: string; fileName: string; lineNumber: number }
interface Exc { message: string; fullName: string; stackTrace: Frame[]; cause?: Exc }
interface Case { methodName: string; status: 'OK' | 'FAIL' | 'ERROR'; output: string; exception: Exc | null; comparisonFailure: { message: string; expected: string; actual: string } | null }
interface Reply { errors: Record<string, Err[]>; exception: Exc | null; text?: string; testResults?: Record<string, Case[]> }

async function post(path: string, files: { name: string; text: string }[], confType: string) {
  const res = await fetch(`https://api.kotlinlang.org/api/${VERSION}/compiler/${path}?filename=${FILE}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args: '', files, confType }),
  })
  if (!res.ok) throw new Error(`The Kotlin Playground answered ${res.status}. Try again in a moment.`)
  return await res.json() as Reply
}

/* We send one file: a header of imports, then the learner's code, then the tests. Kotlin only allows imports at
   the top of a file, so the tests' own imports move into the header and leave a blank line behind, which keeps
   every later line where the learner wrote it. `head` is how many lines the header added. */
interface Layout { head: number; split: number }

function assemble(code: string, tests: string) {
  const hoisted = new Set(['import org.junit.Test', 'import org.junit.Assert.*'])
  const body = tests.replace(/^[ \t]*import[ \t]+[^\n]+$/gm, line => { hoisted.add(line.trim()); return '' })
  const header = [...hoisted].join('\n') + '\n\n'
  return { source: header + code + '\n\n' + body, head: header.split('\n').length - 1, split: code.split('\n').length + 1 }
}

/** The API reports 0-based lines of the file we sent; turn them back into the learner's two editors. */
const place = (line: number, { head, split }: Layout) => {
  const n = line - head                                           // 0-based line of the learner's own text
  return n < split ? `line ${n + 1}` : `tests line ${n - split + 1}`
}

const compileErrors = (r: Reply, at: Layout) =>
  (r.errors[FILE] ?? []).filter(e => e.severity === 'ERROR')
    .map(e => `${place(e.interval.start.line, at)}: ${e.message}`).join('\n')

/** An exception, named the way Kotlin prints it, with the deepest frame in the learner's own file. */
function fromException(e: Exc, at: Layout): string {
  const name = e.fullName.replace(/^.*\./, '')
  const frame = e.stackTrace?.find(f => f.fileName === FILE)
  const head = e.message ? `${name}: ${e.message}` : name
  return frame ? `${place(frame.lineNumber - 1, at)}: ${head}` : head
}

/** Test functions in source order; the `//` comment right above one is its label. */
function testsIn(src: string) {
  return [...src.matchAll(/(?:^[ \t]*\/\/ *(.+)\n)?^[ \t]*@Test[ \t]*\n?[ \t]*fun[ \t]+`?([^`(\s]+)`?[ \t]*\(/gm)]
    .map(([, doc, name]) => ({ name, label: doc?.trim() || name.replace(/[_`]+/g, ' ').trim() }))
}

/** JUnit results keyed by class; match them back to the labels, in the order the tests are written. */
function collect(results: Record<string, Case[]>, tests: { name: string; label: string }[], at: Layout): TestResult[] {
  const byName = new Map<string, Case>()
  for (const cases of Object.values(results ?? {})) for (const c of cases) byName.set(c.methodName, c)
  return tests.map(({ name, label }) => {
    const c = byName.get(name)
    if (!c) return { name: label, ok: false, error: 'did not run' }
    const res: TestResult = { name: label, ok: c.status === 'OK', logs: c.output?.trimEnd() || undefined }
    if (res.ok) return res
    if (c.comparisonFailure) {
      res.expected = c.comparisonFailure.expected
      res.actual = c.comparisonFailure.actual
      res.error = c.comparisonFailure.message
    } else if (c.exception) {
      res.error = fromException(c.exception, at)
    } else {
      res.error = 'failed'
    }
    return res
  })
}

/** Without tests: run the program, which needs a `fun main`. With tests: code plus a file of @Test functions. */
export async function run(code: string, tests = ''): Promise<RunResult> {
  try {
    if (!tests) {
      const solo: Layout = { head: 0, split: Infinity }
      const r = await post('run', [{ name: FILE, text: code }], 'java')
      const errors = compileErrors(r, solo)
      if (errors) return { stdout: '', error: errors, results: [] }
      const out = (r.text ?? '').replace(/<outStream>([\s\S]*?)<\/outStream>/g, '$1').replace(/<errStream>([\s\S]*?)<\/errStream>/g, '$1')
      return { stdout: out, error: r.exception ? fromException(r.exception, solo) : null, results: [] }
    }
    const list = testsIn(tests)
    const { source, head, split } = assemble(code, tests)
    const at: Layout = { head, split }
    const r = await post('test', [{ name: FILE, text: source }], 'junit')
    const errors = compileErrors(r, at)
    if (errors) return { stdout: '', error: errors, results: [] }
    if (r.exception) return { stdout: '', error: fromException(r.exception, at), results: [] }
    if (!r.testResults) return { stdout: '', error: 'the playground ran no tests', results: [] }
    return { stdout: '', error: null, results: collect(r.testResults, list, at) }
  } catch (e) {
    return { stdout: '', error: e instanceof Error ? e.message : String(e), results: [] }
  }
}
