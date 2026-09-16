// Every function an exercise leans on should be described somewhere the learner has already been: an article of
// its own module, an article it builds on, or the reference appendix. This prints what isn't, so gaps get noticed.
// It reports rather than fails: the matching is textual, so a name the prose mentions in passing counts as covered,
// and a helper a test defines for itself can still show up. Read it, don't gate on it.
// node scripts/check-taught.ts [apps/py-roadmap ...]
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const apps = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('apps').map(a => `apps/${a}`).filter(a => existsSync(`${a}/src/parse.ts`))

// Names an exercise declares for itself are its own business, not something the roadmap owes it.
const DECLARED = /(?:^|\s)(?:def|func|function|fun|fn|class|struct|enum|interface|protocol|type|impl|let|var|val|const)\s+([A-Za-z_]\w*)/g

for (const app of apps) {
  const { parse } = await import(`../${app}/src/parse.ts`)
  const { nodes } = await import(`../${app}/src/graph.ts`) as { nodes: { id: string; deps: string[] }[] }
  const dir = `${app}/src/content`
  const raw = Object.fromEntries(readdirSync(dir).map(f => [f.replace(/\.md$/, ''), readFileSync(`${dir}/${f}`, 'utf8')]))
  const mods = Object.fromEntries(Object.entries(raw).map(([id, md]) => [id, parse(id, md)]))
  const deps = new Map(nodes.map(n => [n.id, n.deps]))
  const ancestors = (id: string, seen = new Set<string>()): Set<string> => {
    for (const d of deps.get(id) ?? []) if (!seen.has(d)) { seen.add(d); ancestors(d, seen) }
    return seen
  }
  // The appendix is reachable from everywhere, so whatever it documents counts as covered.
  const appendix = raw['reference'] ?? ''
  const article = (id: string) => (raw[id] ?? '').split('\n## Exercises')[0]

  const gaps: string[] = []
  let exercises = 0
  for (const id of nodes.map(n => n.id)) {
    const covered = [...ancestors(id).add(id)].map(article).join('\n') + '\n' + appendix
    mods[id].problems.forEach((p: { title: string; starter: string; tests: string; html: string; hints: string[] }, i: number) => {
      exercises++
      const text = [p.starter, p.tests, p.html, p.hints.join('\n')].join('\n')
      const own = new Set([...text.matchAll(DECLARED)].map(m => m[1]))
      const used = new Set<string>()
      for (const m of text.matchAll(/\.([a-zA-Z_]\w*)\s*[(<]/g)) used.add(m[1])
      for (const m of text.matchAll(/\b([a-z][a-zA-Z_0-9]*)\s*\(/g)) used.add(m[1])
      const missing = [...used].filter(n => !own.has(n) && !covered.includes(n))
      if (missing.length) gaps.push(`${id} #${i + 1} ${p.title.replace(/<[^>]+>/g, '')}: ${missing.join(', ')}`)
    })
  }
  const label = appendix ? '' : ' (no reference appendix yet)'
  console.log(`${app}: ${exercises - gaps.length}/${exercises} exercises use only what the learner has seen${label}`)
  gaps.forEach(g => console.log(`  · ${g}`))
}
