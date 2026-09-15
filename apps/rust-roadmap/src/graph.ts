export interface Node { id: string; label: string; level: number; deps: string[] }

export const nodes: Node[] = [
  { id: 'intro', label: 'What is Rust?', level: 0, deps: [] },
  { id: 'basics', label: 'Variables & types', level: 1, deps: ['intro'] },
  { id: 'control-flow', label: 'Control flow', level: 2, deps: ['basics'] },
  { id: 'functions', label: 'Functions', level: 3, deps: ['control-flow'] },
  { id: 'ownership', label: 'Ownership', level: 4, deps: ['functions'] },
  { id: 'borrowing', label: 'Borrowing & references', level: 5, deps: ['ownership'] },
  { id: 'strings', label: 'Strings & slices', level: 6, deps: ['borrowing'] },
  { id: 'structs', label: 'Structs & methods', level: 6, deps: ['borrowing'] },
  { id: 'collections', label: 'Vec & HashMap', level: 7, deps: ['strings'] },
  { id: 'enums', label: 'Enums & match', level: 7, deps: ['structs'] },
  { id: 'modules', label: 'Modules & crates', level: 7, deps: ['structs'] },
  { id: 'option-result', label: 'Option & Result', level: 8, deps: ['enums'] },
  { id: 'traits', label: 'Traits', level: 8, deps: ['enums', 'modules'] },
  { id: 'errors', label: 'Error handling', level: 9, deps: ['option-result', 'traits'] },
  { id: 'generics', label: 'Generics & bounds', level: 9, deps: ['traits'] },
  { id: 'iterators', label: 'Closures & iterators', level: 9, deps: ['collections', 'traits'] },
  { id: 'lifetimes', label: 'Lifetimes', level: 10, deps: ['generics'] },
  { id: 'smart-pointers', label: 'Box, Rc & RefCell', level: 10, deps: ['generics'] },
  { id: 'concurrency', label: 'Threads & channels', level: 11, deps: ['smart-pointers', 'iterators'] },
  { id: 'practice', label: 'Practice problems', level: 11, deps: ['errors', 'iterators', 'lifetimes'] },
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
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rust learning roadmap">${edges.join('')}${boxes.join('')}</svg>`
}
