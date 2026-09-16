import { parse } from './parse'

export type { Problem, Module } from './parse'

const files = import.meta.glob('./content/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const modules = Object.fromEntries(
  Object.entries(files).map(([path, md]) => { const id = path.match(/([^/]+)\.md$/)![1]; return [id, parse(id, md)] }),
)
