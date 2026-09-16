export interface Node { id: string; label: string; level: number; deps: string[] }

export const nodes: Node[] = [
  { id: 'intro', label: 'What is iOS?', level: 0, deps: [] },
  { id: 'project', label: 'Xcode & the app', level: 1, deps: ['intro'] },
  { id: 'swiftui-basics', label: 'Views & modifiers', level: 2, deps: ['project'] },
  { id: 'layout', label: 'Stacks & layout', level: 3, deps: ['swiftui-basics'] },
  { id: 'state', label: 'State & bindings', level: 3, deps: ['swiftui-basics'] },
  { id: 'lists', label: 'Lists & identity', level: 4, deps: ['layout', 'state'] },
  { id: 'styling', label: 'Design system', level: 4, deps: ['layout'] },
  { id: 'observation', label: 'Observable models', level: 4, deps: ['state'] },
  { id: 'navigation', label: 'Navigation', level: 5, deps: ['observation', 'lists'] },
  { id: 'forms', label: 'Forms & input', level: 5, deps: ['styling'] },
  { id: 'concurrency', label: 'Concurrency & MainActor', level: 5, deps: ['observation'] },
  { id: 'lifecycle', label: 'App lifecycle & scenes', level: 6, deps: ['navigation', 'concurrency'] },
  { id: 'networking', label: 'Networking', level: 6, deps: ['concurrency'] },
  { id: 'accessibility', label: 'Accessibility', level: 6, deps: ['forms'] },
  { id: 'persistence', label: 'SwiftData & files', level: 7, deps: ['networking'] },
  { id: 'dependencies', label: 'Dependencies & modules', level: 7, deps: ['lifecycle'] },
  { id: 'testing', label: 'Testing', level: 8, deps: ['dependencies', 'persistence'] },
  { id: 'performance', label: 'Performance', level: 8, deps: ['persistence', 'accessibility'] },
  { id: 'release', label: 'Shipping to the App Store', level: 9, deps: ['testing', 'performance'] },
  { id: 'practice', label: 'Practice problems', level: 10, deps: ['release'] },
]

const W = 960, NW = 176, NH = 46, ROW = 104

/** Layered DAG: level = row, nodes spread evenly across the row, bezier edges from each dep. */
export function renderGraph(done: Set<string>, next?: string): string {
  const rows = new Map<number, Node[]>()
  nodes.forEach(n => rows.set(n.level, [...(rows.get(n.level) ?? []), n]))
  const pos = new Map<string, { x: number; y: number }>()
  rows.forEach((row, level) => row.forEach((n, i) => pos.set(n.id, { x: (W / (row.length + 1)) * (i + 1) - NW / 2, y: level * ROW + 16 })))
  const H = (rows.size - 1) * ROW + NH + 32

  const edges = nodes.flatMap(n => n.deps.map(d => {
    const a = pos.get(d)!, b = pos.get(n.id)!
    const x1 = a.x + NW / 2, y1 = a.y + NH, x2 = b.x + NW / 2, y2 = b.y
    return `<path pathLength="1" style="--d:${n.level}" d="M${x1},${y1} C${x1},${y1 + ROW / 2} ${x2},${y2 - ROW / 2} ${x2},${y2}" class="${done.has(d) ? 'edge done' : 'edge'}"/>`
  }))
  const boxes = nodes.map(n => {
    const { x, y } = pos.get(n.id)!
    const cls = ['node', done.has(n.id) && 'done', n.id === next && 'next'].filter(Boolean).join(' ')
    return `<a href="#/${n.id}" class="${cls}" style="--d:${n.level}" aria-label="${n.label}${done.has(n.id) ? ', completed' : n.id === next ? ', up next' : ''}"><g transform="translate(${x},${y})">
      <rect width="${NW}" height="${NH}" rx="12"/>
      <text x="${NW / 2}" y="${NH / 2 + 1}" text-anchor="middle" dominant-baseline="middle">${n.label}</text>
      ${done.has(n.id) ? `<circle cx="${NW - 14}" cy="14" r="7"/><path d="M${NW - 17.5},14 l2.5,2.5 l5,-5" class="tick"/>` : ''}
    </g></a>`
  })
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="iOS learning roadmap">${edges.join('')}${boxes.join('')}</svg>`
}
