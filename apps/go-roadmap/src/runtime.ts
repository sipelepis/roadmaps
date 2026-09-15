/* Go runtime: the official Go Playground compiles and runs the code (it allows cross-origin POSTs).
   No DOM here, so verify.ts can import it under Node. */

export interface TestResult { name: string; ok: boolean; error?: string; logs?: string; expected?: string; actual?: string }
export interface RunResult { stdout: string; error: string | null; results: TestResult[] }

// ponytail: depends on the public playground being up and not rate-limiting us; self-host play's sandbox if it bites.
async function compile(body: string) {
  const res = await fetch('https://play.golang.org/compile', { method: 'POST', body: new URLSearchParams({ version: '2', body }) })
  if (!res.ok) throw new Error(`The Go Playground answered ${res.status}. Try again in a moment.`)
  return await res.json() as { Errors: string; Events: { Message: string; Kind: 'stdout' | 'stderr' }[] | null; Status: number }
}

// "./main.go:5:2: msg" -> "line 5:2: msg", and tests.go -> "tests line …", so errors point at the right editor.
const where = (s: string) => s.replace(/^# .*\n/gm, '').replace(/(?:\.\/)?(main|tests)\.go:(\d+(?::\d+)?)/g, (_, f, l) => f === 'tests' ? `tests line ${l}` : `line ${l}`).trimEnd()

// A panic or deadlock prints a goroutine dump; keep the message and the deepest line of the learner's code.
function trace(s: string) {
  const at = s.match(/\/(main|tests|prog)\.go:(\d+)/)
  const head = s.split('\n\ngoroutine ')[0].trimEnd()
  return at ? `${at[1] === 'tests' ? 'tests line' : 'line'} ${at[2]}: ${head}` : where(head)
}

/** Test functions in source order; the `//` comment right above one is its label. */
function testsIn(src: string) {
  return [...src.matchAll(/(?:^\/\/ *(.+)\n)?^func (Test\w*)\(t \*testing\.T\)/gm)]
    .map(([, doc, name]) => ({ name, label: doc?.trim() || name.slice(4).replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ').toLowerCase() || name }))
}

// A main that runs the tests verbosely through testing.Main. guard turns a panic into a failure of that
// test alone instead of killing the run; expect is the equality helper every test file can call.
const harness = (names: string[]) => `package main

import (
	"fmt"
	"os"
	"reflect"
	"testing"
)

func expect[T any](t *testing.T, got, want T) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Errorf("not equal\\nexpected: %#v\\nactual:   %#v", want, got)
	}
}

func guard(f func(*testing.T)) func(*testing.T) {
	return func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Error("panic: " + fmt.Sprint(r))
			}
		}()
		f(t)
	}
}

func main() {
	os.Args = []string{os.Args[0], "-test.v"}
	testing.Main(func(string, string) (bool, error) { return true, nil }, []testing.InternalTest{${names.map(n => `{"${n}", guard(${n})}`).join(', ')}}, nil, nil)
}
`

/** Parse `-test.v` output: logs are what a test printed, the error is its first t.Error message. */
function parse(out: string, tests: { name: string; label: string }[]): TestResult[] {
  const seen = new Map<string, { ok: boolean; logs: string[]; errs: string[] }>()
  let cur: { ok: boolean; logs: string[]; errs: string[] } | undefined
  // A Print without a newline leaves the runner's marker glued to the end of the learner's line.
  for (const line of out.replace(/(?<!^|\n)(=== RUN|--- (?:PASS|FAIL): | {4}\w+\.go:\d+: )/g, '\n$1').split('\n')) {
    let m
    if ((m = line.match(/^=== RUN\s+(\w+)$/))) seen.set(m[1], cur = { ok: false, logs: [], errs: [] })
    else if ((m = line.match(/^--- (PASS|FAIL): (\w+) /))) { const r = seen.get(m[2]); if (r) r.ok = m[1] === 'PASS'; cur = undefined }
    else if (!cur || /^\s*(=== (RUN|PAUSE|CONT)|--- (PASS|FAIL|SKIP))/.test(line)) continue
    else if ((m = line.match(/^\s+(\w+\.go:\d+): (.*)$/))) cur.errs.push(`${m[1]}: ${m[2]}`)
    else if (/^\s{8}/.test(line) && cur.errs.length) cur.errs[cur.errs.length - 1] += '\n' + line.trim()
    else cur.logs.push(line)
  }
  return tests.map(({ name, label }) => {
    const r = seen.get(name)
    if (!r) return { name: label, ok: false, error: 'did not run' }
    const res: TestResult = { name: label, ok: r.ok, logs: r.logs.join('\n') }
    if (r.ok) return res
    const msg = r.errs[0] ?? 'failed'
    const cmp = msg.match(/\nexpected: ([\s\S]*)\nactual: +([\s\S]*)$/)
    if (cmp) [res.expected, res.actual] = [cmp[1], cmp[2]]
    res.error = where(msg.replace(/^zz_harness\.go:\d+: /, '').split('\n')[0])
    return res
  })
}

/** Without tests: run the program. With tests: code is a package main without func main, tests is a Go file of Test functions. */
export async function run(code: string, tests = ''): Promise<RunResult> {
  try {
    const list = testsIn(tests)
    const body = tests ? `-- main.go --\n${code}\n-- tests.go --\n${tests}\n-- zz_harness.go --\n${harness(list.map(t => t.name))}` : code
    const r = await compile(body)
    if (r.Errors) return { stdout: '', error: where(r.Errors), results: [] }
    const out = (r.Events ?? []).filter(e => e.Kind === 'stdout').map(e => e.Message).join('')
    const err = (r.Events ?? []).filter(e => e.Kind === 'stderr').map(e => e.Message).join('').trimEnd()
    if (!tests) return { stdout: out, error: err ? trace(err) : r.Status ? `exit status ${r.Status}` : null, results: [] }
    return { stdout: '', error: err ? trace(err) : null, results: parse(out, list) }
  } catch (e) {
    return { stdout: '', error: e instanceof Error ? e.message : String(e), results: [] }
  }
}
