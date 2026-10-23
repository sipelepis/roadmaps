// Static oracle for the Akashi design system across the ten roadmap apps: the shared packages/akashi package,
// each app's thin identity stylesheet, index.html, editor theme, docs, and WCAG contrast of the token pairs.
// node --no-warnings scripts/check-design.ts [--self-test] [--dist] [--since <sha>] [group ...]
//   groups: package docs ts py rag go rust kotlin swift android ios stats (none = all twelve)
//   --self-test  run only the contrast self-test      --dist  also check built output (dist/) in every app group
//   --since <sha>  also check that each app's main.ts, graph.ts and motion.ts are untouched since <sha> (a branch-only
//                  invariant: leave it off once the work has merged, or any later edit to those files fails the check)
// Exit 0 = nothing failed, 1 = a check failed, 2 = usage error or failing self-test.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

let since = ''
const APPS = ['ts', 'py', 'rag', 'go', 'rust', 'kotlin', 'swift', 'android', 'ios', 'stats']
const ID: Record<string, { identity: string; ink: string; light: string; dark: string; mark?: string }> = {
  ts: { identity: '#3178c6', ink: '#ffffff', light: '#3178c6', dark: '#3178c6' },
  py: { identity: '#3776ab', ink: '#ffffff', light: '#3776ab', dark: '#ffd43b' },
  rag: { identity: '#7c3aed', ink: '#ffffff', light: '#7c3aed', dark: '#7c3aed', mark: '0.6rem' },
  go: { identity: '#007d9c', ink: '#ffffff', light: '#007d9c', dark: '#007d9c' },
  rust: { identity: '#b7410e', ink: '#ffffff', light: '#b7410e', dark: '#b7410e' },
  kotlin: { identity: '#7f52ff', ink: '#ffffff', light: '#7f52ff', dark: '#7f52ff' },
  swift: { identity: '#f05138', ink: '#191919', light: '#f05138', dark: '#f05138' },
  android: { identity: '#3ddc84', ink: '#191919', light: '#1c9c55', dark: '#3ddc84' },
  ios: { identity: '#0a84ff', ink: '#191919', light: '#0a84ff', dark: '#0a84ff' },
  stats: { identity: '#be185d', ink: '#ffffff', light: '#be185d', dark: '#d01a66', mark: '0.5rem' },
}
const OLD_VARS = ['bg', 'bg-2', 'panel', 'panel-2', 'border', 'border-strong', 'text', 'text-2', 'accent', 'accent-2', 'accent-ink', 'accent-hover', 'glow', 'cta-glow', 'selection', 'ring', 'shadow', 'display', 'body', 'mono', 'ease', 'r-sm', 'r-md', 'r-lg']
const oldVarRe = new RegExp(`var\\(\\s*--(?:${OLD_VARS.join('|')})\\s*[,)]`)
const OLD_HEX = ['158f5a', 'a86b00', 'd43d3d']

// ---------- contrast ----------
const toHex = (v: string | undefined): string | null => {
  const s = (v ?? '').trim().toLowerCase()
  if (s === 'white') return '#ffffff'
  if (s === 'black') return '#000000'
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map(c => c + c).join('')
  return null
}
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(toHex(a)!), lum(toHex(b)!)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// ---------- reporting ----------
let passed = 0, failed = 0
const tables: string[] = []
const say = (s: string) => console.log(s)
const ok = (g: string, what: string) => { passed++; say(`PASS ${g}: ${what}`) }
const bad = (g: string, what: string, d: string) => { failed++; say(`FAIL ${g}: ${what} (${d})`) }
const chk = (g: string, what: string, cond: boolean, detail = 'not satisfied') => (cond ? ok(g, what) : bad(g, what, detail))

const rd = (g: string, p: string): string => {
  try { return readFileSync(p, 'utf8') } catch { bad(g, `read ${p}`, 'missing or unreadable'); return '' }
}
const jd = (g: string, p: string): any => {
  const t = rd(g, p)
  if (!t) return {}
  try { return JSON.parse(t) } catch (e) { bad(g, `parse ${p}`, String((e as Error).message)); return {} }
}
const walk = (dir: string): string[] => {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter(e => e.isFile() && !e.parentPath.includes('node_modules')).map(e => join(e.parentPath, e.name))
  } catch { return [] }
}
const textFiles = (dir: string) => walk(dir).filter(f => !/\.(woff2?|png|jpe?g|gif|ico|ttf|otf|webp|wasm)$/i.test(f))
const readSafe = (f: string) => { try { return readFileSync(f, 'utf8') } catch { return '' } }

// ---------- naive css ----------
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
type Rule = { sel: string; body: string }
const rules = (css: string): Rule[] =>
  [...strip(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].slice(m[1].lastIndexOf(';') + 1).trim(), body: m[2] }))
const normSel = (s: string) => s.replace(/\s+/g, ' ').replace(/"/g, "'").trim()
const props = (css: string, dark: boolean): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const r of rules(css)) {
    const s = normSel(r.sel)
    if (s !== (dark ? ":root[data-theme='dark']" : ':root')) continue
    for (const m of r.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) out[m[1]] = m[2].trim()
  }
  return out
}
const resolve = (set: Record<string, string>, name: string): string | undefined => {
  const v = set[name]
  return v?.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, n) => set[n] ?? '')
}
const colors = (set: Record<string, string>, name: string): string[] => {
  const v = resolve(set, name)
  if (v === undefined) return []
  if (/gradient/i.test(v)) return (v.match(/#[0-9a-f]{3,8}/gi) ?? []).map(h => h.toLowerCase())
  const h = toHex(v)
  return h ? [h] : []
}
const has = (rs: Rule[], needle: RegExp, sel: (s: string) => boolean) => rs.some(r => needle.test(r.body) && sel(r.sel))

// ---------- contrast table ----------
const rowsFor = (title: string, g: string, theme: string, set: Record<string, string>, pairs: [string, string, number][]) => {
  const lines = [`contrast ${title}`]
  for (const [fg, bg, min] of pairs) {
    const f = colors(set, fg), b = colors(set, bg)
    if (!f.length || !b.length) { failed++; lines.push(`  ${theme} ${fg}/${bg} n/a FAIL`); continue }
    f.forEach((fh, i) => b.forEach((bh, j) => {
      const r = ratio(fh, bh)
      const label = `${fg}${f.length > 1 ? `[${i}]` : ''}/${bg}${b.length > 1 ? `[${j}]` : ''}`
      const pass = r >= min
      pass ? passed++ : failed++
      lines.push(`  ${theme} ${label} ${r.toFixed(2)} ${pass ? 'PASS' : 'FAIL'}`)
    }))
  }
  tables.push(lines.join('\n'))
}

// ---------- shared package state ----------
const P = 'packages/akashi'
const pkgLight = (app?: string) => ({
  ...props(readSafe(`${P}/tokens.css`), false), ...props(readSafe(`${P}/roadmap.css`), false),
  ...(app ? props(readSafe(`apps/${app}-roadmap/src/style.css`), false) : {}),
})
const pkgDark = (app?: string) => ({
  ...pkgLight(app), ...props(readSafe(`${P}/dark.css`), true),
  ...(app ? props(readSafe(`apps/${app}-roadmap/src/style.css`), true) : {}),
})

// ---------- self-test ----------
const selfTest = () => {
  const cases: [string, string, string][] = [['#ffffff', '#000000', '21.00'], ['#3178c6', '#fafafa', '4.34'], ['#3DDC84', '#ffffff', '1.78']]
  const got = cases.map(([a, b]) => ratio(a, b).toFixed(2))
  if (got.some((g, i) => g !== cases[i][2])) { say(`FAIL self-test (got ${got.join(', ')})`); process.exit(2) }
  say('PASS self-test')
}

// ---------- groups ----------
const pkgGroup = () => {
  const g = 'package'
  const pj = jd(g, `${P}/package.json`)
  const deps = pj.dependencies ?? {}
  chk(g, 'package.json name, private, exports, font dependencies',
    pj.name === '@roadmaps/akashi' && pj.private === true &&
    isDeepStrictEqual(pj.exports, { '.': './index.css', './roadmap.css': './roadmap.css' }) &&
    ['@fontsource/zen-kaku-gothic-new', '@fontsource/manrope', '@fontsource/dm-mono'].every(d => deps[d] === '^5.3.0'),
    `name=${pj.name} private=${pj.private} exports=${JSON.stringify(pj.exports)} deps=${JSON.stringify(deps)}`)

  for (const f of ['tokens.css', 'index.css']) {
    let buf: Buffer | null = null
    try { buf = readFileSync(`${P}/${f}`) } catch { bad(g, `${f} copied from viz design-system`, 'missing') ; continue }
    const nl = buf.indexOf(10)
    const first = buf.subarray(0, nl < 0 ? buf.length : nl).toString()
    chk(g, `${f} line 1 is a provenance comment`, first.startsWith('/*') && first.includes('personal/viz/packages/design-system'), `line 1: ${first.slice(0, 60)}`)
    const src = `${homedir()}/personal/viz/packages/design-system/${f}`
    if (!existsSync(src)) { say(`SKIP ${g}: ${f} matches viz source (no ${src})`); continue }
    chk(g, `${f} matches viz source after line 1`, nl >= 0 && buf.subarray(nl + 1).equals(readFileSync(src)), 'content differs')
  }

  const darkCss = rd(g, `${P}/dark.css`), roadCss = rd(g, `${P}/roadmap.css`)
  const dk = props(darkCss, true), lt = props(roadCss, false)
  const expectBlock = (name: string, got: Record<string, string>, scheme: string, want: Record<string, string | string[]>) => {
    const diffs: string[] = []
    if ((got['color-scheme'] ?? '') !== scheme && !new RegExp(`color-scheme\\s*:\\s*${scheme}`).test(name === 'dark' ? darkCss : roadCss)) diffs.push(`color-scheme not ${scheme}`)
    for (const [k, v] of Object.entries(want)) {
      const have = Array.isArray(v) ? colors(got, k) : (got[k] ?? '').trim().toLowerCase()
      if (!isDeepStrictEqual(have, v)) diffs.push(`${k}=${JSON.stringify(have)} want ${JSON.stringify(v)}`)
    }
    return diffs
  }
  const colorScheme = (css: string, sel: RegExp, scheme: string) =>
    rules(css).some(r => sel.test(normSel(r.sel)) && new RegExp(`color-scheme\\s*:\\s*${scheme}\\b`).test(r.body))
  const dd = expectBlock('dark', dk, 'dark', {
    '--paper': '#111111', '--surface': '#191919', '--ink': '#ededed', '--muted': '#9e9e9e', '--line': '#2b2b2b', '--lead': '#c2c2c2',
    '--secondary-heading': '#a6a6a6', '--mention-surface': '#262626', '--mention-text': '#ededed', '--hover-fill': '#222222',
    '--primary-gradient': ['#f4f4f4', '#dedede'], '--primary-gradient-hover': ['#ffffff', '#e8e8e8'], '--primary-ink': '#141414',
    '--line-strong': '#3d3d3d', '--nav-bg': '#111111d9', '--ok': '#3dd68c', '--ok-bg': '#15261d', '--warn': '#f5b942',
    '--warn-bg': '#2a2214', '--fail': '#ff6b6b', '--fail-bg': '#2c1a1a',
  }).filter(d => !d.startsWith('color-scheme'))
  if (!colorScheme(darkCss, /^:root\[data-theme='dark'\]$/, 'dark')) dd.push('color-scheme dark missing')
  chk(g, 'dark.css dark block has color-scheme dark and the exact dark tokens', !dd.length, dd.slice(0, 4).join('; '))

  const first = strip(roadCss).trim()
  chk(g, "roadmap.css starts with @import './dark.css';", /^@import\s+['"]\.\/dark\.css['"]\s*;/.test(first), first.slice(0, 40))
  const ld = expectBlock('road', lt, 'light', {
    '--primary-ink': '#ffffff', '--line-strong': '#bdbdbd', '--nav-bg': '#fafafad9', '--ok': '#137a4a', '--ok-bg': '#eaf5ef',
    '--warn': '#8a5a00', '--warn-bg': '#fbf3e3', '--fail': '#c0392b', '--fail-bg': '#fcecea',
  }).filter(d => !d.startsWith('color-scheme'))
  if (!colorScheme(roadCss, /^:root$/, 'light')) ld.push('color-scheme light missing')
  chk(g, 'roadmap.css :root has color-scheme light and the exact light tokens', !ld.length, ld.slice(0, 4).join('; '))

  const oldHit = OLD_VARS.filter(n => new RegExp(`var\\(\\s*--${n}\\s*[,)]`).test(roadCss))
  const oldStr = ['Bricolage', 'JetBrains', "'Inter'", 'radial-gradient', 'fonts.googleapis', 'fonts.gstatic'].filter(s => roadCss.includes(s))
  chk(g, 'roadmap.css uses no old variables, fonts or radial gradients', !oldHit.length && !oldStr.length && !!roadCss, [...oldHit.map(n => `var(--${n})`), ...oldStr].join(', ') || 'empty')

  const rs = rules(roadCss)
  const sels = (r: Rule) => r.sel.split(',').map(s => normSel(s))
  const accentOk = rs.filter(r => /var\(--identity-accent\)/.test(r.body)).every(r => ['.hero h1 em', '.node.next rect', '.side li.current'].some(n => r.sel.includes(n)))
  const accentAll = ['.hero h1 em', '.node.next rect', '.side li.current'].filter(n => !has(rs, /var\(--identity-accent\)/, s => s.includes(n)))
  const markRules = rs.filter(r => /var\(--identity(-ink)?\)/.test(r.body))
  const markOnly = markRules.every(r => sels(r).some(s => /(^|\s)\.mark$/.test(s)))
  const markBoth = markRules.some(r => /var\(--identity\)/.test(r.body)) && markRules.some(r => /var\(--identity-ink\)/.test(r.body))
  const shadowBad = rs.filter(r => [...r.body.matchAll(/box-shadow\s*:\s*([^;]+)/g)].some(m => m[1].trim() !== 'none') && !r.sel.includes('.side li.current'))
  chk(g, 'identity tokens appear only where allowed; box-shadow only on .side li.current',
    accentOk && !accentAll.length && markOnly && markBoth && !shadowBad.length && rs.length > 0,
    [!accentOk && 'identity-accent in a wrong rule', accentAll.length && `identity-accent missing in ${accentAll.join(', ')}`, !markOnly && 'identity/identity-ink outside .mark',
      !markBoth && '.mark lacks identity and identity-ink', shadowBad.length && `box-shadow in ${shadowBad.map(r => r.sel).join(' | ')}`].filter(Boolean).join('; '))

  const focusSel = (r: Rule, n: string) => sels(r).includes(n)
  const focusIdx = (n: string) => rs.reduce((last, r, i) => (focusSel(r, n) ? i : last), -1)
  const lastFocus = Math.max(...['.node:focus-visible rect', '.node.next:focus-visible rect', '.node.done:focus-visible rect'].map(focusIdx))
  const strokeLost = ['next', 'done'].filter(k => rs.some((r, i) => sels(r).includes(`.node.${k} rect`) && /(^|[;\s])stroke\s*:/.test(r.body) &&
    !(i < lastFocus || focusIdx(`.node.${k}:focus-visible rect`) >= 0)))
  chk(g, 'a focused graph node keeps its ink focus stroke over the next and done strokes', lastFocus >= 0 && !strokeLost.length,
    lastFocus < 0 ? 'no .node:focus-visible rect rule' : `.node.${strokeLost.join(', .node.')} rect stroke comes after and ties the focus rule`)
  chk(g, 'links inside .hint and .builds running text are underlined', rs.some(r => /text-decoration\s*:\s*underline/.test(r.body) && !r.sel.includes(':hover') && ['.hint a', '.builds a'].every(n => sels(r).includes(n))),
    'no non-hover text-decoration: underline rule for .hint a and .builds a')

  const prim = (name: string) => rs.filter(r => sels(r).includes(name))
  const primOk = (name: string) => {
    const rr = prim(name)
    return rr.length > 0 && rr.some(r => /background[^;]*var\(--primary-gradient\)/.test(r.body)) && rr.some(r => /(?<![-\w])color\s*:\s*var\(--primary-ink\)/.test(r.body))
  }
  chk(g, 'button.primary and .cta use primary-gradient and primary-ink', primOk('button.primary') && primOk('.cta'),
    `button.primary=${primOk('button.primary')} .cta=${primOk('.cta')}`)

  const stale = walk(P).filter(f => { const t = readSafe(f).toLowerCase(); return OLD_HEX.some(h => t.includes(h)) })
  chk(g, 'no legacy status hexes under packages/akashi', !stale.length, stale.join(', '))

  for (const [theme, set] of [['light', pkgLight()], ['dark', pkgDark()]] as const) {
    const pairs: [string, string, number][] = [
      ['--ink', '--paper', 4.5], ['--ink', '--surface', 4.5], ['--ink', '--hover-fill', 4.5], ['--muted', '--paper', 4.5], ['--muted', '--surface', 4.5],
      ['--lead', '--paper', 4.5], ['--lead', '--surface', 4.5], ['--lead', '--hover-fill', 4.5], ['--lead', '--mention-surface', 4.5],
      ['--mention-text', '--mention-surface', 4.5], ['--ok', '--paper', 4.5], ['--ok', '--surface', 4.5], ['--ok', '--ok-bg', 4.5],
      ['--warn', '--paper', 4.5], ['--warn', '--surface', 4.5], ['--warn', '--warn-bg', 4.5], ['--fail', '--paper', 4.5], ['--fail', '--surface', 4.5],
      ['--fail', '--fail-bg', 4.5], ['--primary-ink', '--primary-gradient', 4.5], ['--primary-ink', '--primary-gradient-hover', 4.5], ['--ink', '--paper', 3.0],
    ]
    rowsFor(`package ${theme}`, g, theme, set, pairs.map(([a, b, m]) => [a, b, m]))
  }

  const root = jd(g, 'package.json'), turbo = jd(g, 'turbo.json'), lock = jd(g, 'package-lock.json')
  chk(g, 'root workspaces include packages/* and check:design script', Array.isArray(root.workspaces) && root.workspaces.includes('packages/*') &&
    root.scripts?.['check:design'] === 'node --no-warnings scripts/check-design.ts', `workspaces=${JSON.stringify(root.workspaces)} script=${root.scripts?.['check:design']}`)
  const t = turbo.tasks ?? {}
  const inc = (x: any) => Array.isArray(x) && x.includes('$TURBO_DEFAULT$') && x.includes('$TURBO_ROOT$/packages/akashi/**')
  chk(g, 'turbo build/check inputs include akashi; build outputs dist/**', inc(t.build?.inputs) && inc(t.check?.inputs) && isDeepStrictEqual(t.build?.outputs, ['dist/**']),
    `build.inputs=${JSON.stringify(t.build?.inputs)} check.inputs=${JSON.stringify(t.check?.inputs)} outputs=${JSON.stringify(t.build?.outputs)}`)
  chk(g, 'package-lock links @roadmaps/akashi', !!lock.packages?.['packages/akashi'] && lock.packages?.['node_modules/@roadmaps/akashi']?.link === true, 'lock entries missing')
  chk(g, 'node_modules/@roadmaps/akashi is installed', existsSync('node_modules/@roadmaps/akashi/package.json'), 'run npm install')
}

const docsGroup = () => {
  const g = 'docs'
  const prods = APPS.map(a => `apps/${a}-roadmap/PRODUCT.md`)
  const stale = /Bricolage|JetBrains Mono|5ea3ff|Lit Blueprint|Cornflower|Blueprint Blue/i
  const design = rd(g, 'DESIGN.md'), dj = rd(g, '.impeccable/design.json')
  const hit = ['DESIGN.md', '.impeccable/design.json', ...prods].filter(f => stale.test(f === 'DESIGN.md' ? design : f.endsWith('.json') ? dj : readSafe(f)))
  chk(g, 'no pre-Akashi design vocabulary in DESIGN.md, design.json, PRODUCT.md', !hit.length, hit.join(', '))
  const low = design.toLowerCase()
  const needs = ['Zen Kaku Gothic New', 'Manrope', 'DM Mono', 'packages/akashi', '--identity', '--identity-ink', '--identity-accent', ...Object.values(ID).map(v => v.identity), '#1c9c55', '#d01a66']
  const miss = [...new Set(needs)].filter(n => !low.includes(n.toLowerCase()))
  chk(g, 'DESIGN.md documents fonts, package, identity tokens and hexes', !miss.length, `missing ${miss.join(', ')}`)
  let sv: unknown
  try { sv = JSON.parse(dj).schemaVersion } catch { /* reported below */ }
  chk(g, '.impeccable/design.json parses with schemaVersion 2', sv === 2, `schemaVersion=${String(sv)}`)
  const rm = rd(g, 'README.md')
  chk(g, 'README mentions packages/akashi and check:design, not the old deploy line', rm.includes('packages/akashi') && rm.includes('check:design') && !rm.includes('deploy it with `npx vercel deploy --prod`'), 'README text mismatch')
  for (const a of ['ts', 'py', 'go', 'rag', 'rust', 'stats']) {
    const line = readSafe(`apps/${a}-roadmap/PRODUCT.md`).split('\n').find(l => l.startsWith('- Brand mark:')) ?? ''
    const l = line.toLowerCase(), hex = ID[a].identity
    chk(g, `${a} PRODUCT.md brand mark names ${hex} on white`, l.includes(hex) && /\bwhite\b/.test(l) && (a !== 'py' || !l.includes('#3178c6')), line ? line.slice(0, 80) : 'no "- Brand mark:" line')
  }
}

const appGroup = (a: string, dist: boolean) => {
  const g = a, dir = `apps/${a}-roadmap`, want = ID[a]
  const pj = jd(g, `${dir}/package.json`)
  chk(g, "depends on @roadmaps/akashi '*'", pj.dependencies?.['@roadmaps/akashi'] === '*', `got ${pj.dependencies?.['@roadmaps/akashi']}`)

  const css = rd(g, `${dir}/src/style.css`)
  const stmts = strip(css).trim()
  chk(g, 'style.css imports the akashi package then roadmap.css first', /^@import\s+['"]@roadmaps\/akashi['"]\s*;\s*@import\s+['"]@roadmaps\/akashi\/roadmap\.css['"]\s*;/.test(stmts), stmts.slice(0, 60))
  const lp = props(css, false), dp = props(css, true)
  const light = pkgLight(a), dark = pkgDark(a)
  const eq = (x: string | undefined, y: string) => toHex(x) === y
  chk(g, `identity ${want.identity}, ink ${want.ink}, light accent ${want.light}`,
    eq(resolve(lp, '--identity'), want.identity) && eq(resolve(lp, '--identity-ink'), want.ink) && eq(resolve(light, '--identity-accent'), want.light),
    `identity=${lp['--identity']} ink=${lp['--identity-ink']} accent=${lp['--identity-accent']}`)
  const da = dp['--identity-accent'] === undefined ? undefined : resolve(dark, '--identity-accent')
  chk(g, `dark identity-accent ${want.dark}`, da !== undefined && eq(da, want.dark), da === undefined ? 'no dark block or --identity-accent' : `got ${da}`)
  if (want.mark) chk(g, `--mark-size ${want.mark}`, lp['--mark-size']?.trim() === want.mark, `got ${lp['--mark-size']}`)
  const lines = css.replace(/\n$/, '').split('\n').length
  const roomy = a === 'android' || a === 'ios'
  chk(g, `style.css is at most ${roomy ? 25 : 12} lines`, !!css && lines <= (roomy ? 25 : 12), `${lines} lines`)
  if (roomy) chk(g, '.checklist input uses accent-color: var(--ink)', has(rules(css), /accent-color\s*:\s*var\(--ink\)/, s => normSel(s) === '.checklist input' || s.split(',').some(x => normSel(x) === '.checklist input')), 'rule missing')
  const stale = [oldVarRe.test(css) && 'old variable', css.includes('Bricolage') && 'Bricolage', css.includes('JetBrains') && 'JetBrains'].filter(Boolean)
  chk(g, 'style.css has no old variables or fonts', !!css && !stale.length, stale.join(', '))

  rowsFor(`${a} app`, g, 'light', light, [['--identity-ink', '--identity', 4.5], ['--identity-accent', '--paper', 3.0], ['--identity-accent', '--surface', 3.0]])
  rowsFor(`${a} app`, g, 'dark', dark, [['--identity-accent', '--paper', 3.0], ['--identity-accent', '--surface', 3.0]])
  if (a === 'android') chk(g, 'android light accent is not #3ddc84', !!resolve(light, '--identity-accent') && !eq(resolve(light, '--identity-accent'), '#3ddc84'), `got ${light['--identity-accent']}`)
  if (a === 'stats') chk(g, 'stats dark accent is not #be185d', !!da && !eq(da, '#be185d'), `got ${da}`)

  const html = rd(g, `${dir}/index.html`)
  chk(g, 'index.html loads no Google Fonts', !!html && !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), 'fonts.googleapis/gstatic still referenced')
  let icon = ''
  try { icon = decodeURIComponent(/<link\s[^>]*rel=["']icon["'][^>]*>/.exec(html)?.[0].match(/href=["']([^"']*)["']/)?.[1] ?? '') } catch { /* leaves icon empty */ }
  const fillOf = (tag: string) => toHex(new RegExp(`<${tag}\\b[^>]*fill=['"]([^'"]+)['"]`).exec(icon)?.[1])
  chk(g, 'favicon rect is the identity, text is the identity ink', fillOf('rect') === want.identity && fillOf('text') === want.ink, `rect=${fillOf('rect')} text=${fillOf('text')}`)
  const boot = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('dataset.theme')) ?? ''
  chk(g, 'boot script handles light, dark and prefers-color-scheme: dark', /===\s*'light'/.test(boot) && /===\s*'dark'/.test(boot) && boot.includes('prefers-color-scheme: dark') && !boot.includes('localStorage.theme ||'), boot ? boot.slice(0, 70) : 'no inline theme script')
  chk(g, "boot script uses the stored value only when 'light' or 'dark', and a dark OS maps to 'dark', otherwise 'light'",
    /(\w+)\s*===\s*'light'\s*\|\|\s*\1\s*===\s*'dark'\s*\?\s*\1\s*:/.test(boot) &&
    /prefers-color-scheme:\s*dark\s*\)?['"]\s*\)\s*\.matches\s*\?\s*'dark'\s*:\s*'light'/.test(boot), boot ? boot.slice(0, 120) : 'no inline theme script')

  const ed = rd(g, `${dir}/src/editor.ts`)
  const must = ["\"'DM Mono', ui-monospace, Menlo, Consolas, monospace\"", `document.fonts.load('400 14px "DM Mono"')`, 'remeasureFonts', 'getComputedStyle',
    'editor.background', 'editorGutter.background', 'editor.foreground', 'editorLineNumber.activeForeground', 'editorCursor.foreground', 'editorLineNumber.foreground',
    'editor.lineHighlightBackground', 'editor.selectionBackground']
  const mustNot = ['#151a23', '#eaeef4', 'JetBrains', 'rm-dark', 'rm-light']
  const em = must.filter(s => !ed.includes(s)), en = mustNot.filter(s => ed.includes(s))
  chk(g, 'editor.ts uses DM Mono and computed-style Monaco theme', !!ed && !em.length && !en.length, [em.length && `missing ${em.join(' | ')}`, en.length && `still has ${en.join(', ')}`].filter(Boolean).join('; '))

  const pair = (key: string, val: string) => new RegExp(`['"]${key.replace('.', '\\.')}['"]\\s*:\\s*(?:${val})\\s*[,}\\n]`).test(ed)
  const SURF = "bg|token\\('--surface'\\)", INK = "ink|token\\('--ink'\\)"
  const pairs: [string, string][] = [['editor.background', SURF], ['editorGutter.background', SURF], ['editor.foreground', INK], ['editorLineNumber.activeForeground', INK],
    ['editorCursor.foreground', INK], ['editorLineNumber.foreground', "token\\('--muted'\\)"], ['editor.lineHighlightBackground', "token\\('--hover-fill'\\)"],
    ['editor.selectionBackground', "token\\('--mention-surface'\\)"]]
  const wrong = pairs.filter(([k, v]) => !pair(k, v)).map(([k]) => k)
  if (!/\bbg\s*=\s*token\('--surface'\)/.test(ed)) wrong.push('const bg = token(--surface)')
  if (!/\bink\s*=\s*token\('--ink'\)/.test(ed)) wrong.push('const ink = token(--ink)')
  chk(g, 'editor.ts maps each Monaco colour key to its Akashi token', !!ed && !wrong.length, `wrong or missing: ${wrong.join(', ')}`)
  chk(g, 'editor.ts token helper expands short hex (#rgb, #rgba)', /\^#\[0-9a-f\]\{3,4\}\$/i.test(ed), 'no #rgb/#rgba expansion')
  const fl = ed.indexOf(`document.fonts.load('400 14px "DM Mono"')`)
  const stmt = fl < 0 ? '' : ed.slice(fl, fl + ed.slice(fl + 1).search(/\n(?=\S)/) + 1 || undefined)
  const thenTwoArgs = (t: string) => {
    for (let i = t.indexOf('.then('); i >= 0; i = t.indexOf('.then(', i + 1)) {
      let d = 0
      for (let j = i + 5; j < t.length; j++) {
        if ('([{'.includes(t[j])) d++
        else if (')]}'.includes(t[j])) { if (--d === 0) break }
        else if (t[j] === ',' && d === 1) return true
      }
    }
    return false
  }
  chk(g, 'editor.ts document.fonts.load promise has a rejection handler', !!stmt && (/\.(catch|finally)\(/.test(stmt) || thenTwoArgs(stmt)), stmt ? 'no .catch, .finally or two-argument .then' : 'fonts.load statement missing')

  if (since) try {
    const changed = execFileSync('git', ['diff', '--name-only', since, '--', ...['main', 'graph', 'motion'].map(f => `${dir}/src/${f}.ts`)], { encoding: 'utf8' }).trim()
    chk(g, 'main.ts, graph.ts, motion.ts untouched', !changed, `changed: ${changed.split('\n').join(', ')}`)
  } catch (e) { bad(g, 'main.ts, graph.ts, motion.ts untouched', `git failed: ${(e as Error).message.split('\n')[0]}`) }

  const old = [...textFiles(`${dir}/src`), `${dir}/index.html`].filter(f => { const t = readSafe(f).toLowerCase(); return OLD_HEX.some(h => t.includes(h)) })
  chk(g, 'no legacy status hexes in src or index.html', !old.length, old.join(', '))

  if (dist) {
    const d = `${dir}/dist`
    if (!existsSync(`${d}/index.html`)) { bad(g, 'dist/index.html exists', 'build first'); return }
    ok(g, 'dist/index.html exists')
    const net = textFiles(d).filter(f => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(readSafe(f)))
    chk(g, 'dist loads no Google Fonts', !net.length, net.join(', '))
    const w = walk(`${d}/assets`).map(f => f.split('/').pop()!).filter(n => n.endsWith('.woff2'))
    const miss = ['zen-kaku-gothic-new', 'manrope', 'dm-mono'].filter(p => !w.some(n => n.startsWith(p)))
    chk(g, 'dist/assets bundles the three woff2 families', !miss.length, `missing ${miss.join(', ')}`)
  }
}

// ---------- main ----------
const argv = process.argv.slice(2)
const si = argv.indexOf('--since')
const sinceMissing = si >= 0 && (!argv[si + 1] || argv[si + 1].startsWith('--'))
if (si >= 0 && !sinceMissing) since = argv.splice(si + 1, 1)[0]
const flags = argv.filter(a => a.startsWith('--')), names = argv.filter(a => !a.startsWith('--'))
const groups = ['package', 'docs', ...APPS]
const unknown = [...(sinceMissing ? ['--since needs a sha'] : []), ...flags.filter(f => f !== '--self-test' && f !== '--dist' && f !== '--since'), ...names.filter(n => !groups.includes(n))]
if (unknown.length) {
  console.error(`usage: node --no-warnings scripts/check-design.ts [--self-test] [--dist] [--since <sha>] [${groups.join('|')} ...]  (unknown: ${unknown.join(', ')})`)
  process.exit(2)
}
selfTest()
if (flags.includes('--self-test')) process.exit(0)
const dist = flags.includes('--dist')
for (const g of names.length ? names : groups) {
  try { g === 'package' ? pkgGroup() : g === 'docs' ? docsGroup() : appGroup(g, dist) }
  catch (e) { bad(g, 'group ran', `exception: ${(e as Error).message}`) }
}
tables.forEach(t => say(t))
say(`${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
