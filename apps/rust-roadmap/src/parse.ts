import { marked, type Token, type Tokens } from 'marked'

/* Pure markdown -> module parsing, no Vite or DOM, so scripts/check-refs.ts can import it under Node. */

const LANG = 'rust'

export interface Problem { title: string; html: string; starter: string; tests: string; uses: string[]; hints: string[]; tips: string[]; docs: string[] }
export interface Module { id: string; title: string; summary: string; html: string; playground: string; sections: string[]; problems: Problem[] }

/** Heading html -> anchor. Any page links to a section as #/<module>/<slug>; the heading's id is s-<slug>. */
export const slug = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#?\w+;/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

marked.use({ renderer: { heading({ tokens, depth }) { const text = this.parser.parseInline(tokens); return `<h${depth} id="s-${slug(text)}">${text}</h${depth}>\n` } } })

const isH = (t: Token, depth: number, text?: string): t is Tokens.Heading => t.type === 'heading' && t.depth === depth && (!text || t.text === text)
const isCode = (t: Token, kind: string): t is Tokens.Code => t.type === 'code' && t.lang === `${LANG} ${kind}`
const items = (t: Tokens.List) => t.items.map(i => marked.parseInline(i.text) as string)

// Article = everything before "## Exercises". Each "### ..." after it is a problem with a ```<lang> starter```
// and a ```<lang> test``` block, then optional "#### Uses" (links to the sections it relies on), "#### Hints",
// "#### Tips" and "#### Docs" lists. ```<lang> playground``` in the article feeds the live editor.
export function parse(id: string, md: string): Module {
  const tokens = marked.lexer(md)
  const cut = tokens.findIndex(t => isH(t, 2, 'Exercises'))
  const body = cut < 0 ? tokens : tokens.slice(0, cut)
  const problems: Problem[] = []
  let cur: { p: Problem; tokens: Token[] } | undefined
  let list: 'uses' | 'hints' | 'tips' | 'docs' | undefined
  for (const t of cut < 0 ? [] : tokens.slice(cut + 1)) {
    if (isH(t, 3)) { cur = { p: { title: marked.parseInline(t.text) as string, html: '', starter: '', tests: '', uses: [], hints: [], tips: [], docs: [] }, tokens: [] }; problems.push(cur.p); list = undefined }
    else if (!cur) continue
    else if (isCode(t, 'starter')) cur.p.starter = t.text
    else if (isCode(t, 'test')) cur.p.tests = t.text
    else if (isH(t, 4) && /^(uses|hints|tips|docs)$/i.test(t.text)) list = t.text.toLowerCase() as typeof list
    else if (list) { if (t.type === 'list') cur.p[list].push(...items(t as Tokens.List)) }
    else { cur.tokens.push(t); cur.p.html = marked.parser(cur.tokens) }
  }
  return {
    id,
    title: marked.parseInline(body.find(t => isH(t, 1))?.text ?? id) as string,
    summary: (body.find((t): t is Tokens.Paragraph => t.type === 'paragraph')?.text ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, ''),
    html: marked.parser(body.filter(t => !isH(t, 1) && !isCode(t, 'playground'))),
    playground: body.find(t => isCode(t, 'playground'))?.text ?? '',
    sections: body.filter((t): t is Tokens.Heading => t.type === 'heading' && t.depth > 1).map(t => slug(marked.parseInline(t.text) as string)),
    problems,
  }
}
