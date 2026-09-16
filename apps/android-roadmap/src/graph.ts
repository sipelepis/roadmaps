export interface Node { id: string; label: string; level: number; deps: string[] }

export const nodes: Node[] = [
  { id: 'intro', label: 'What is Android?', level: 0, deps: [] },
  { id: 'project', label: 'Project & Gradle', level: 1, deps: ['intro'] },
  { id: 'compose-basics', label: 'Composable functions', level: 2, deps: ['project'] },
  { id: 'layout', label: 'Layout & modifiers', level: 3, deps: ['compose-basics'] },
  { id: 'state', label: 'State & recomposition', level: 3, deps: ['compose-basics'] },
  { id: 'lists', label: 'Lists & lazy layouts', level: 4, deps: ['layout', 'state'] },
  { id: 'theming', label: 'Material theming', level: 4, deps: ['layout'] },
  { id: 'viewmodel', label: 'ViewModel & UI state', level: 4, deps: ['state'] },
  { id: 'navigation', label: 'Navigation', level: 5, deps: ['viewmodel', 'lists'] },
  { id: 'resources', label: 'Resources & config', level: 5, deps: ['theming'] },
  { id: 'coroutines', label: 'Coroutines on Android', level: 5, deps: ['viewmodel'] },
  { id: 'lifecycle', label: 'Lifecycle & saved state', level: 6, deps: ['navigation', 'coroutines'] },
  { id: 'networking', label: 'Networking', level: 6, deps: ['coroutines'] },
  { id: 'accessibility', label: 'Accessibility', level: 6, deps: ['resources'] },
  { id: 'persistence', label: 'Room & DataStore', level: 7, deps: ['networking'] },
  { id: 'di', label: 'Dependency injection', level: 7, deps: ['lifecycle'] },
  { id: 'testing', label: 'Testing', level: 8, deps: ['di', 'persistence'] },
  { id: 'performance', label: 'Performance', level: 8, deps: ['persistence', 'accessibility'] },
  { id: 'release', label: 'Shipping to Play', level: 9, deps: ['testing', 'performance'] },
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
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Android learning roadmap">${edges.join('')}${boxes.join('')}</svg>`
}
