import { marked, type Token, type Tokens } from 'marked'

const files = import.meta.glob('./content/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface Problem { title: string; html: string; starter: string; tests: string }
export interface Module { id: string; title: string; summary: string; html: string; playground: string; problems: Problem[] }

const isH = (t: Token, depth: number, text?: string): t is Tokens.Heading => t.type === 'heading' && t.depth === depth && (!text || t.text === text)
const isCode = (t: Token, lang: string): t is Tokens.Code => t.type === 'code' && t.lang === lang

// Article = everything before "## Exercises". Each "### ..." after it is a problem
// with a ```ts starter``` and a ```ts test``` block. ```ts playground``` in the article feeds the live editor.
function parse(id: string, md: string): Module {
  const tokens = marked.lexer(md)
  const cut = tokens.findIndex(t => isH(t, 2, 'Exercises'))
  const body = cut < 0 ? tokens : tokens.slice(0, cut)
  const problems: Problem[] = []
  let cur: { p: Problem; tokens: Token[] } | undefined
  for (const t of cut < 0 ? [] : tokens.slice(cut + 1)) {
    if (isH(t, 3)) { cur = { p: { title: marked.parseInline(t.text) as string, html: '', starter: '', tests: '' }, tokens: [] }; problems.push(cur.p) }
    else if (!cur) continue
    else if (isCode(t, 'ts starter')) cur.p.starter = t.text
    else if (isCode(t, 'ts test')) cur.p.tests = t.text
    else { cur.tokens.push(t); cur.p.html = marked.parser(cur.tokens) }
  }
  return {
    id,
    title: marked.parseInline(body.find(t => isH(t, 1))?.text ?? id) as string,
    summary: (body.find((t): t is Tokens.Paragraph => t.type === 'paragraph')?.text ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, ''),
    html: marked.parser(body.filter(t => !isH(t, 1) && !isCode(t, 'ts playground'))),
    playground: body.find(t => isCode(t, 'ts playground'))?.text ?? '',
    problems,
  }
}

export const modules: Record<string, Module> = Object.fromEntries(
  Object.entries(files).map(([path, md]) => { const id = path.match(/([^/]+)\.md$/)![1]; return [id, parse(id, md)] }),
)
