export interface Node { id: string; label: string; level: number; deps: string[] }

export const nodes: Node[] = [
  { id: 'intro', label: 'What is TypeScript?', level: 0, deps: [] },
  { id: 'basic-types', label: 'Basic types', level: 1, deps: ['intro'] },
  { id: 'functions', label: 'Functions', level: 2, deps: ['basic-types'] },
  { id: 'objects', label: 'Objects & interfaces', level: 2, deps: ['basic-types'] },
  { id: 'arrays-tuples', label: 'Arrays & tuples', level: 2, deps: ['basic-types'] },
  { id: 'unions', label: 'Unions & literals', level: 3, deps: ['objects'] },
  { id: 'enums', label: 'Enums', level: 3, deps: ['basic-types'] },
  { id: 'narrowing', label: 'Narrowing', level: 4, deps: ['unions'] },
  { id: 'classes', label: 'Classes', level: 4, deps: ['objects', 'functions'] },
  { id: 'generics', label: 'Generics', level: 4, deps: ['functions', 'arrays-tuples'] },
  { id: 'keyof-typeof', label: 'keyof, typeof, T[K]', level: 5, deps: ['generics', 'unions'] },
  { id: 'utility-types', label: 'Utility types', level: 5, deps: ['generics'] },
  { id: 'modules', label: 'Modules', level: 5, deps: ['classes'] },
  { id: 'async-types', label: 'Async & Promises', level: 5, deps: ['functions', 'generics'] },
  { id: 'conditional-types', label: 'Conditional types', level: 6, deps: ['keyof-typeof'] },
  { id: 'mapped-types', label: 'Mapped types', level: 6, deps: ['keyof-typeof', 'utility-types'] },
  { id: 'template-literal-types', label: 'Template literal types', level: 7, deps: ['mapped-types'] },
  { id: 'advanced-patterns', label: 'Advanced patterns', level: 8, deps: ['conditional-types', 'template-literal-types', 'narrowing'] },
  { id: 'runtime-validation', label: 'Validating unknown data', level: 8, deps: ['narrowing', 'async-types'] },
  { id: 'type-puzzles', label: 'Type-level puzzles', level: 8, deps: ['conditional-types', 'mapped-types', 'template-literal-types'] },
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
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TypeScript learning roadmap">${edges.join('')}${boxes.join('')}</svg>`
}
