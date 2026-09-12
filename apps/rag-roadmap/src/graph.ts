export interface Node { id: string; label: string; level: number; deps: string[] }

export const nodes: Node[] = [
  { id: 'what-is-rag', label: 'What RAG actually is', level: 0, deps: [] },
  { id: 'documents', label: 'Documents to text', level: 1, deps: ['what-is-rag'] },
  { id: 'ocr', label: 'OCR: pages as pictures', level: 2, deps: ['documents'] },
  { id: 'cleaning', label: 'Cleaning extracted text', level: 2, deps: ['documents'] },
  { id: 'chunking', label: 'Chunking', level: 3, deps: ['cleaning'] },
  { id: 'metadata', label: 'Structure & metadata', level: 3, deps: ['cleaning'] },
  { id: 'embeddings', label: 'Embeddings', level: 4, deps: ['chunking'] },
  { id: 'vector-store', label: 'Storing vectors', level: 5, deps: ['embeddings'] },
  { id: 'keyword-search', label: 'Keyword search & BM25', level: 5, deps: ['chunking'] },
  { id: 'retrieval', label: 'Retrieval', level: 6, deps: ['vector-store', 'keyword-search'] },
  { id: 'prompting', label: 'Grounded prompts', level: 7, deps: ['retrieval'] },
  { id: 'reranking', label: 'Reranking & diversity', level: 7, deps: ['retrieval'] },
  { id: 'evaluation', label: 'Evaluating retrieval', level: 7, deps: ['retrieval'] },
  { id: 'safety', label: 'Injection & limits', level: 8, deps: ['prompting'] },
  { id: 'production', label: 'At 10 million documents', level: 8, deps: ['reranking', 'evaluation'] },
  { id: 'ocr-pipeline', label: 'Build the OCR → RAG pipeline', level: 8, deps: ['ocr', 'metadata', 'prompting'] },
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
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RAG and OCR learning roadmap">${edges.join('')}${boxes.join('')}</svg>`
}
