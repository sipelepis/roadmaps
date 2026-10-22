export interface Node { id: string; label: string; level: number; deps: string[] }

export const nodes: Node[] = [
  { id: 'samples', label: 'Thinking in samples', level: 0, deps: [] },
  { id: 'describing', label: 'Describing data', level: 1, deps: ['samples'] },
  { id: 'probability', label: 'Probability rules', level: 1, deps: ['samples'] },
  { id: 'conditional', label: 'Conditional probability & Bayes', level: 2, deps: ['probability'] },
  { id: 'random-variables', label: 'Random variables', level: 2, deps: ['probability', 'describing'] },
  { id: 'data-quality', label: 'Outliers & data quality', level: 2, deps: ['describing'] },
  { id: 'distributions', label: 'Common distributions', level: 3, deps: ['random-variables'] },
  { id: 'correlation', label: 'Correlation & causation', level: 3, deps: ['describing', 'conditional'] },
  { id: 'clt', label: 'Large numbers & the CLT', level: 4, deps: ['distributions'] },
  { id: 'sampling', label: 'Sampling & bias', level: 4, deps: ['random-variables'] },
  { id: 'regression', label: 'Least squares', level: 4, deps: ['correlation'] },
  { id: 'estimation', label: 'Likelihood & estimation', level: 5, deps: ['clt'] },
  { id: 'sketches', label: 'Counting at scale', level: 5, deps: ['sampling'] },
  { id: 'intervals', label: 'Confidence intervals & bootstrap', level: 6, deps: ['estimation'] },
  { id: 'information', label: 'Entropy, cross-entropy & KL', level: 6, deps: ['estimation'] },
  { id: 'bayesian', label: 'Bayesian updating', level: 6, deps: ['estimation', 'conditional'] },
  { id: 'hypothesis-tests', label: 'Hypothesis tests', level: 7, deps: ['intervals'] },
  { id: 'ab-testing', label: 'A/B tests', level: 8, deps: ['hypothesis-tests', 'sampling'] },
  { id: 'drift', label: 'Drift detection', level: 8, deps: ['data-quality', 'information', 'hypothesis-tests'] },
  { id: 'eval-stats', label: 'Error bars on evals', level: 9, deps: ['ab-testing', 'bayesian'] },
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
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Statistics and probability learning roadmap">${edges.join('')}${boxes.join('')}</svg>`
}
