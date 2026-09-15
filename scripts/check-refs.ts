// Every exercise must say where its concepts are taught, and only point backwards: each "#### Uses" link has
// to land on a section of its own module or of a module it builds on in the graph. Also checks that every
// internal link (#/<module>/<section>) in articles resolves, and that each exercise has at least one hint.
// node scripts/check-refs.ts [apps/py-roadmap ...]
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const apps = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('apps').map(a => `apps/${a}`).filter(a => existsSync(`${a}/src/parse.ts`))
let bad = 0

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
  const problems: string[] = []
  const resolves = (href: string) => {
    const [m, s] = href.split('/')
    if (!(m in mods)) return `unknown module "${m}"`
    if (s && !mods[m].sections.includes(s)) return `no section "${s}" in ${m} (has: ${mods[m].sections.join(', ')})`
  }
  let exercises = 0, covered = 0
  for (const [id, md] of Object.entries(raw)) {
    for (const [, href] of md.matchAll(/\]\(#\/([^)\s]+)\)/g)) {
      if (href.startsWith('exercise/') || ['learn', 'exercises'].includes(href)) continue
      const why = resolves(href)
      if (why) problems.push(`${id}: link #/${href}: ${why}`)
    }
    const before = ancestors(id).add(id)
    mods[id].problems.forEach((p: { title: string; uses: string[]; hints: string[] }, i: number) => {
      exercises++
      const where = `${id} #${i + 1} ${p.title.replace(/<[^>]+>/g, '')}`
      const hrefs = p.uses.flatMap(u => [...u.matchAll(/href="#\/([^"]+)"/g)].map(m => m[1]))
      if (!hrefs.length) problems.push(`${where}: no "#### Uses" links`)
      if (!p.hints.length) problems.push(`${where}: no "#### Hints"`)
      if (hrefs.length && p.hints.length) covered++
      for (const href of hrefs) {
        const m = href.split('/')[0]
        if (!href.includes('/')) problems.push(`${where}: Uses link #/${href} should point at a section, not the whole module`)
        else if (m in mods && !before.has(m)) problems.push(`${where}: Uses #/${href}, but ${m} is not ${id} or a module it builds on`)
      }
    })
  }
  console.log(`${app}: ${covered}/${exercises} exercises have uses and hints${problems.length ? `, ${problems.length} problem(s)` : ''}`)
  problems.forEach(p => console.log(`  ✗ ${p}`))
  bad += problems.length
}
process.exit(bad ? 1 : 0)
