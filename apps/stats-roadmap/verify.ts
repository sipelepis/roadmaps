// Checks content against local python3 running the site's own test harness: every playground runs cleanly,
// every starter runs but fails its tests, and with --solutions <dir> every <id>.<n>.py passes under two hash seeds.
// npm run verify [-- src/content/samples.md ...] [-- --solutions ../../.solutions/stats-roadmap]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parse } from './src/parse.ts'
import { HARNESS, type RunResult } from './src/harness.ts'

const args = process.argv.slice(2)
const at = args.indexOf('--solutions')
const solutions = at >= 0 ? args.splice(at, 2)[1] : undefined
const files = args.length ? args : readdirSync('src/content').filter(f => f.endsWith('.md') && f !== 'reference.md').sort().map(f => `src/content/${f}`)

const DRIVER = `
import time
d = json.loads(sys.stdin.read())
t0 = time.perf_counter()
r = __run(d['code'], d['tests'])
print(json.dumps({'run': json.loads(r), 'ms': (time.perf_counter() - t0) * 1000}))
`

// -P and -s keep the working directory and user site off sys.path; never -I or -E, which would ignore PYTHONHASHSEED.
function py(code: string, tests = '', seed = '0'): RunResult & { ms: number } {
  const p = spawnSync('python3', ['-P', '-s', '-c', HARNESS + DRIVER], {
    input: JSON.stringify({ code, tests }), encoding: 'utf8', env: { ...process.env, PYTHONHASHSEED: seed }, timeout: 20000, maxBuffer: 1 << 26,
  })
  const broken = (error: string) => ({ stdout: '', error, results: [], ms: 0 })
  if (p.error || p.status !== 0) return broken(p.error ? ((p.error as NodeJS.ErrnoException).code === 'ETIMEDOUT' ? 'timed out' : p.error.message) : (p.stderr.trim().split('\n').pop() || 'python3 failed'))
  try { const o = JSON.parse(p.stdout); return { ...o.run, ms: o.ms } } catch { return broken(p.stderr.trim().split('\n').pop() || 'unparsable output') }
}

let failures = 0
const fail = (where: string, why: string) => { failures++; console.log(`  ✗ ${where}: ${why}`) }

for (const file of files) {
  const id = file.match(/([^/]+)\.md$/)![1]
  const m = parse(id, readFileSync(file, 'utf8'))
  console.log(`${id}: ${m.problems.length} exercises`)
  if (!m.playground) fail(id, 'no playground block')
  else { const r = py(m.playground); if (r.error !== null) fail(`${id} playground`, r.error) }
  if (!m.problems.length) fail(id, 'no ## Exercises section with ### problems')
  m.problems.forEach((p, i) => {
    const name = `${id} #${i + 1} ${p.title.replace(/<[^>]+>/g, '')}`
    if (!p.starter.trim() || !p.tests.trim()) return fail(name, 'empty starter or test block')
    const s = py(p.starter, p.tests)
    if (s.error !== null) fail(name, `starter does not run: ${s.error}`)
    else if (!s.results.length) fail(name, 'no tests found')
    else if (s.results.every(t => t.ok)) fail(name, 'starter already passes every test')
    if (!solutions) return
    const path = `${solutions}/${id}.${i + 1}.py`
    if (!existsSync(path)) return fail(name, `no solution at ${path}`)
    const code = readFileSync(path, 'utf8')
    for (const seed of ['0', '1']) {
      const r = py(code, p.tests, seed)
      if (r.error !== null) fail(name, `solution errors under PYTHONHASHSEED=${seed}: ${r.error}`)
      else if (!r.results.length) fail(name, `solution ran no tests under PYTHONHASHSEED=${seed}`)
      else if (!r.results.every(t => t.ok)) fail(name, `solution fails under PYTHONHASHSEED=${seed}: ${r.results.filter(t => !t.ok).map(t => `${t.name} (${t.error})`).join('; ')}`)
      else if (r.ms > 1000) fail(name, `solution too slow under PYTHONHASHSEED=${seed}: ${Math.round(r.ms)} ms`)
    }
  })
}
console.log(failures ? `\n${failures} problem(s)` : '\nall good')
process.exit(failures ? 1 : 0)
