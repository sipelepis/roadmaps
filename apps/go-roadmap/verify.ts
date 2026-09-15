// Checks content against the live Go Playground through the site's own runtime: every playground runs
// cleanly, every starter compiles but fails its tests, and with --solutions <dir> every <id>.<n>.go passes.
// npm run verify [-- src/content/maps.md ...] [-- --solutions ../solutions]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { marked, type Token, type Tokens } from 'marked'
import { run, type RunResult } from './src/runtime.ts'

const LANG = 'go', EXT = 'go'
const args = process.argv.slice(2)
const at = args.indexOf('--solutions')
const solutions = at >= 0 ? args.splice(at, 2)[1] : undefined
const files = args.length ? args : readdirSync('src/content').map(f => `src/content/${f}`)

let failures = 0
const fail = (where: string, why: string) => { failures++; console.log(`  ✗ ${where}: ${why}`) }
const summary = (r: RunResult) => r.error ?? r.results.filter(t => !t.ok).map(t => `${t.name} (${t.error})`).join('; ')

for (const file of files) {
  const id = file.match(/([^/]+)\.md$/)![1]
  const tokens = marked.lexer(readFileSync(file, 'utf8'))
  const block = (kind: string) => tokens.filter((t): t is Tokens.Code => t.type === 'code' && t.lang === `${LANG} ${kind}`).map(t => t.text)
  const cut = tokens.findIndex((t: Token) => t.type === 'heading' && t.depth === 2 && t.text === 'Exercises')
  const titles = tokens.slice(cut + 1).filter((t): t is Tokens.Heading => t.type === 'heading' && t.depth === 3).map(t => t.text)
  const [starters, tests, [play]] = [block('starter'), block('test'), block('playground')]
  console.log(`${id}: ${titles.length} exercises`)
  if (cut < 0 || !titles.length) fail(id, 'no ## Exercises section with ### problems')
  if (starters.length !== titles.length || tests.length !== titles.length) fail(id, `${titles.length} problems but ${starters.length} starters and ${tests.length} test blocks`)
  if (!play) fail(id, 'no playground block')
  else { const r = await run(play); if (r.error) fail(`${id} playground`, r.error) }
  for (let i = 0; i < titles.length && i < starters.length && i < tests.length; i++) {
    const name = `${id} #${i + 1} ${titles[i]}`
    const s = await run(starters[i], tests[i])
    if (s.error) fail(name, `starter does not compile: ${s.error}`)
    else if (!s.results.length) fail(name, 'no tests found')
    else if (s.results.every(t => t.ok)) fail(name, 'starter already passes every test')
    const path = `${solutions}/${id}.${i + 1}.${EXT}`
    if (!solutions) continue
    if (!existsSync(path)) { fail(name, `no solution at ${path}`); continue }
    const r = await run(readFileSync(path, 'utf8'), tests[i])
    if (r.error || !r.results.length || !r.results.every(t => t.ok)) fail(name, `solution fails: ${summary(r)}`)
  }
}
console.log(failures ? `\n${failures} problem(s)` : '\nall good')
process.exit(failures ? 1 : 0)
