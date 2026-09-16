// Checks content against the live Kotlin Playground through the site's own runtime: every playground runs
// cleanly, every starter compiles but fails its tests, and with --solutions <dir> every <id>.<n>.kt passes.
// npm run verify [-- src/content/collections.md ...] [-- --solutions ../solutions]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import dns from 'node:dns'
import net from 'node:net'
import { run, type RunResult } from './src/runtime.ts'
import { parse } from './src/parse.ts'

// Node only: on a NAT64 network it picks the synthesized IPv6 address and hangs. Browsers fall back by themselves.
dns.setDefaultResultOrder('ipv4first')
net.setDefaultAutoSelectFamily(false)

const EXT = 'kt'
const args = process.argv.slice(2)
const at = args.indexOf('--solutions')
const solutions = at >= 0 ? args.splice(at, 2)[1] : undefined
const files = args.length ? args : readdirSync('src/content').map(f => `src/content/${f}`)

let failures = 0
const fail = (where: string, why: string) => { failures++; console.log(`  ✗ ${where}: ${why}`) }
const summary = (r: RunResult) => r.error ?? r.results.filter(t => !t.ok).map(t => `${t.name} (${t.error})`).join('; ')

for (const file of files) {
  const id = file.match(/([^/]+)\.md$/)![1]
  // parse pairs each block with its own problem, which matters here: a build task has neither starter nor test,
  // so collecting the code blocks by kind and indexing them would silently shift every later exercise.
  const { problems, playground: play } = parse(id, readFileSync(file, 'utf8'))
  const tasks = problems.filter(p => !p.tests).length
  console.log(`${id}: ${problems.length} exercises${tasks ? ` (${tasks} built in the IDE)` : ''}`)
  if (!problems.length) fail(id, 'no ## Exercises section with ### problems')
  if (!play) fail(id, 'no playground block')
  else { const r = await run(play); if (r.error) fail(`${id} playground`, r.error) }
  for (const [i, p] of problems.entries()) {
    const name = `${id} #${i + 1} ${p.title.replace(/<[^>]+>/g, '')}`
    if (!p.starter && !p.tests) {
      if (!p.checklist.length) fail(name, 'build task with no "#### Build it" checklist')
      if (!p.solution) fail(name, 'build task with no reference solution block')
      continue
    }
    if (!p.starter || !p.tests) { fail(name, 'has a starter or tests but not both'); continue }
    const s = await run(p.starter, p.tests)
    if (s.error) fail(name, `starter does not compile: ${s.error}`)
    else if (!s.results.length) fail(name, 'no tests found')
    else if (s.results.every(t => t.ok)) fail(name, 'starter already passes every test')
    const path = `${solutions}/${id}.${i + 1}.${EXT}`
    if (!solutions) continue
    if (!existsSync(path)) { fail(name, `no solution at ${path}`); continue }
    const r = await run(readFileSync(path, 'utf8'), p.tests)
    if (r.error || !r.results.length || !r.results.every(t => t.ok)) fail(name, `solution fails: ${summary(r)}`)
  }
}
console.log(failures ? `\n${failures} problem(s)` : '\nall good')
process.exit(failures ? 1 : 0)
