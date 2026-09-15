/* Rust runtime: the official Rust Playground compiles and runs the code (it allows cross-origin POSTs).
   No DOM here, so verify.ts can import it under Node. */

export interface TestResult { name: string; ok: boolean; error?: string; logs?: string; expected?: string; actual?: string }
export interface RunResult { stdout: string; error: string | null; results: TestResult[] }

// ponytail: depends on the public playground being up and not rate-limiting us; self-host rust-playground if it bites.
async function execute(code: string, tests: boolean) {
  const res = await fetch('https://play.rust-lang.org/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'stable', mode: 'debug', edition: '2024', crateType: tests ? 'lib' : 'bin', tests, backtrace: false, code }),
  })
  if (!res.ok) throw new Error(`The Rust Playground answered ${res.status}. Try again in a moment.`)
  return await res.json() as { success: boolean; stdout: string; stderr: string }
}

// Cargo's own progress lines are noise next to rustc's diagnostics and the program's output.
const quiet = (s: string) => s.split('\n').filter(l => !/^\s*(Compiling|Finished|Running|Checking) |^error: (test failed|could not compile)|^warning: build failed|^warning: `playground` .* generated|^note: run with `RUST_BACKTRACE/.test(l)).join('\n').trim()

/** Test functions in source order; a `///` doc comment above one is its label. */
function testsIn(src: string) {
  return [...src.matchAll(/((?:^[ \t]*\/\/\/.*\n)*)(?:^[ \t]*#\[.*\]\n)*^[ \t]*fn (\w+)\(\)/gm)]
    .filter(m => /#\[test\]/.test(m[0]))
    .map(([, doc, name]) => ({ name, label: doc.replace(/^[ \t]*\/\/\/ ?/gm, '').trim().replace(/\s*\n\s*/g, ' ') || name.replace(/_/g, ' ') }))
}

/** Parse `cargo test` output: the pass/fail line per test, then each failure's captured stdout and panic message. */
function parse(out: string, tests: { name: string; label: string }[], offset: number): TestResult[] {
  const status = new Map([...out.matchAll(/^test tests::(\w+)(?: - should panic)? \.\.\. (ok|FAILED)$/gm)].map(m => [m[1], m[2] === 'ok']))
  const sections = new Map([...out.matchAll(/^---- tests::(\w+) stdout ----\n([\s\S]*?)(?=^---- |^failures:$)/gm)].map(m => [m[1], m[2]]))
  const line = (n: number) => n > offset ? `tests line ${n - offset}` : `line ${n}`
  return tests.map(({ name, label }) => {
    if (!status.has(name)) return { name: label, ok: false, error: 'did not run' }
    if (status.get(name)) return { name: label, ok: true }
    const [logs, panic = ''] = (sections.get(name) ?? '').split(/^thread '.*' (?:\(\d+\) )?panicked at /m)
    const at = panic.match(/^src\/lib\.rs:(\d+):\d+:\n/)
    const msg = quiet(at ? panic.slice(at[0].length) : panic)
    const res: TestResult = { name: label, ok: false, logs: logs.trimEnd(), error: (at ? `${line(+at[1])}: ` : '') + (msg.split('\n')[0] || 'failed') }
    const cmp = msg.match(/^ +left: (.*)\n +right: (.*)$/m)
    if (cmp) [res.actual, res.expected] = [cmp[1], cmp[2]]   // assert_eq!(actual, expected)
    return res
  })
}

/** Without tests: code is a program with fn main. With tests: code is a library, tests are #[test] fns inside mod tests. */
export async function run(code: string, tests = ''): Promise<RunResult> {
  try {
    if (!tests) {
      const r = await execute(code, false)
      return r.success ? { stdout: r.stdout, error: null, results: [] } : { stdout: r.stdout, error: quiet(r.stderr).replace(/^thread '.*?' (?:\(\d+\) )?panicked at src\/main\.rs:(\d+):\d+:\n/m, 'line $1: ') || 'the program failed', results: [] }
    }
    const head = `${code}\n\n#[cfg(test)]\nmod tests {\nuse super::*;\n`
    const r = await execute(`${head}${tests}\n}\n`, true)
    if (!/^running \d+ tests?$/m.test(r.stdout)) return { stdout: '', error: quiet(r.stderr) || 'the tests did not compile', results: [] }
    return { stdout: '', error: null, results: parse(r.stdout, testsIn(tests), head.split('\n').length - 1) }
  } catch (e) {
    return { stdout: '', error: e instanceof Error ? e.message : String(e), results: [] }
  }
}
