import './style.css'
import { modules, type Problem } from './content'
import { nodes, renderGraph } from './graph'
import { enter, reveal, pop, count } from './motion'
import { mountEditor, run, disposeAll, colorize, onRunKey, syncEditorTheme, type TestResult } from './editor'

const app = document.getElementById('app')!
const GITHUB = 'https://github.com/sipelepis'
const CHARITY = { name: 'the Philippine Red Cross', url: 'https://redcross.org.ph/ways-to-donate/' }
const passedKey = (id: string, i: number) => `passed:${id}:${i}`
const draftKey = (id: string, i: number) => `draft:${id}:${i}`
const passed = (id: string, i: number) => !!localStorage.getItem(passedKey(id, i))
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

// Global exercise order = roadmap order.
const exercises = nodes.flatMap(n => modules[n.id].problems.map((p, i) => ({ id: n.id, i, p, label: n.label })))
const doneCount = (id: string) => modules[id].problems.filter((_, i) => passed(id, i)).length
const isDone = (id: string) => modules[id].problems.length > 0 && doneCount(id) === modules[id].problems.length
const nextModule = () => nodes.find(n => !isDone(n.id))
const status = (id: string, i: number) => passed(id, i) ? 'passed' : localStorage.getItem(draftKey(id, i)) ? 'attempted' : 'todo'

/* ---------- icons: one stroke family, drawn once ---------- */

const SPRITE = `<svg hidden xmlns="http://www.w3.org/2000/svg"><defs>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></symbol>
  <symbol id="i-dot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-right" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
  <symbol id="i-left" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></symbol>
  <symbol id="i-reset" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5"/></symbol>
  <symbol id="i-spin" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-8 8"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5V5.5M8 7h8"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></symbol>
  <symbol id="i-bulb" viewBox="0 0 24 24"><path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></symbol>
</defs></svg>`
const icon = (name: string) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`
const badge = (s: string) => ({
  passed: `<span class="badge passed">${icon('check')}Passed</span>`,
  attempted: `<span class="badge attempted">${icon('dot')}In progress</span>`,
  todo: `<span class="badge todo">To do</span>`,
})[s]!

/* ---------- shell ---------- */

function shell(active: string, body: string, side = '') {
  const done = exercises.filter(e => passed(e.id, e.i)).length
  const link = (href: string, key: string, text: string) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${text}</a>`
  app.innerHTML = `${SPRITE}
    <header class="nav">
      <a class="brand" href="#/" aria-label="Swift Roadmap home"><span class="mark">SW</span><span class="brand-name">Roadmap</span></a>
      <nav aria-label="Primary">${link('#/', 'home', 'Roadmap')}${link('#/learn', 'learn', 'Learn')}${link('#/exercises', 'exercises', 'Exercises')}${'reference' in modules ? link('#/reference', 'reference', 'Reference') : ''}</nav>
      <a class="pill" href="#/exercises" aria-label="${done} of ${exercises.length} exercises passed">${icon('check')}<span class="num">${done}</span><span class="sep">/</span><span class="num">${exercises.length}</span></a>
      <button class="theme" id="theme" aria-label="Switch between light and dark theme"><svg class="ic sun" aria-hidden="true"><use href="#i-sun"/></svg><svg class="ic moon" aria-hidden="true"><use href="#i-moon"/></svg></button>
    </header>
    <div class="layout${side ? ' with-side' : ''}">${side}<main id="main" tabindex="-1">${body}</main></div>
    <footer class="site-foot">
      <p>Free and open source, built by <a href="${GITHUB}" rel="me">@sipelepis</a> · <a href="${GITHUB}/roadmaps">Source on GitHub</a></p>
      <p class="charity">Learned something? Pay it forward: <a href="${CHARITY.url}">give to ${CHARITY.name}</a>.</p>
      <p class="love">mahal ko kayong lahat 😘</p>
    </footer>`
  document.getElementById('theme')!.onclick = () => {
    const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = t; localStorage.theme = t; syncEditorTheme()
  }
  const details = app.querySelector<HTMLDetailsElement>('.side details')
  if (details && matchMedia('(max-width: 900px)').matches) details.open = false
}

const sidebar = (current: string) => `<aside class="side"><details open><summary>Modules<span class="side-progress num">${nodes.filter(n => isDone(n.id)).length}/${nodes.length}</span></summary><ol>${nodes.map(n => {
  const m = modules[n.id]
  const cls = [isDone(n.id) && 'done', n.id === current && 'current'].filter(Boolean).join(' ')
  return `<li class="${cls}"><a href="#/${n.id}"${n.id === current ? ' aria-current="page"' : ''}>${n.label}</a><span class="num">${doneCount(n.id)}/${m.problems.length}</span></li>`
}).join('')}</ol></details></aside>`

/* ---------- problems (shared by module page and exercise page) ---------- */

function problemHtml(id: string, i: number, p: Problem, showTitle = true) {
  const stat = `<span class="status" id="status-${i}">${badge(status(id, i))}</span>`
  return `<section class="problem" aria-labelledby="ph-${i}">
    ${showTitle ? `<h3 id="ph-${i}">${p.title} ${stat}</h3>` : `<div class="problem-status">${stat}</div>`}
    <div class="desc">${p.html}</div>
    ${p.uses.length ? `<p class="uses"><span>Uses</span>${p.uses.join('')}</p>` : ''}
    ${tray(p)}
    <div class="editor" id="ed-${i}"></div>
    <div class="bar">
      <button class="primary" data-run="${i}">${icon('play')}<span>Run tests</span></button>
      <button data-reset="${i}">${icon('reset')}<span>Reset</span></button>
      <kbd>Ctrl</kbd><kbd>Enter</kbd>
      <details class="tests"><summary>Show tests</summary><pre><code>${esc(p.tests)}</code></pre></details>
    </div>
    <ul class="results" id="res-${i}" aria-live="polite"></ul>
  </section>`
}

/** Hints open one at a time (CSS hides a hint until the previous one is open); tips and docs are plain lists. */
function tray(p: Problem) {
  if (!p.hints.length && !p.tips.length && !p.docs.length) return ''
  const n = (k: number, w: string) => k ? `${k} ${w}${k === 1 ? '' : 's'}` : ''
  const list = (title: string, xs: string[]) => xs.length ? `<section><h4>${title}</h4><ul>${xs.map(x => `<li>${x}</li>`).join('')}</ul></section>` : ''
  const body = `${p.hints.length ? `<section><h4>Hints</h4><ol class="hints">${p.hints.map((h, i) => `<li><details><summary>Hint ${i + 1}</summary><div>${h}</div></details></li>`).join('')}</ol></section>` : ''}${list('Tips', p.tips)}${list('Docs', p.docs)}`
  return `<details class="tray"><summary>${icon('bulb')}<span>Hints and tips</span><small>${[n(p.hints.length, 'hint'), n(p.tips.length, 'tip'), n(p.docs.length, 'doc')].filter(Boolean).join(' · ')}</small></summary>
    <div class="tray-body">${body.replace(/<a href="(https?:)/g, '<a target="_blank" rel="noopener" href="$1')}</div></details>`
}

/** Scroll to an article section (#/<module>/<slug>) and flash it so the eye lands on it. */
function section(id: string) {
  const h = document.getElementById(`s-${id}`)
  if (!h) return
  h.scrollIntoView()
  h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash')
}

const lines = (s: string) => { const n = s.trimEnd().split('\n').length; return `${n} line${n === 1 ? '' : 's'}` }

/** Collapsible panel under a test result. Text goes in via textContent: it is whatever the learner's code produced. */
function panel(title: string, blocks: [label: string, text: string][], open = false) {
  const d = document.createElement('details'); d.className = 'more'; d.open = open
  d.innerHTML = `<summary>${title}</summary>`
  for (const [label, text] of blocks) {
    if (label) { const k = document.createElement('span'); k.className = `k ${label.toLowerCase()}`; k.textContent = label; d.append(k) }
    const pre = document.createElement('pre'); pre.textContent = text; d.append(pre)
  }
  return d
}

function wireProblem(id: string, i: number, p: Problem) {
  const ed = mountEditor(document.getElementById(`ed-${i}`)!, localStorage.getItem(draftKey(id, i)) ?? p.starter, `${id}-ex${i}`)
  ed.onDidChangeModelContent(() => localStorage.setItem(draftKey(id, i), ed.getValue()))
  const list = document.getElementById(`res-${i}`)!
  const stat = document.getElementById(`status-${i}`)!
  const runBtn = app.querySelector<HTMLButtonElement>(`[data-run="${i}"]`)!
  app.querySelector<HTMLButtonElement>(`[data-reset="${i}"]`)!.onclick = () => { ed.setValue(p.starter); localStorage.removeItem(draftKey(id, i)); list.replaceChildren() }
  const runTests = async () => {
    if (runBtn.disabled) return
    runBtn.disabled = true
    runBtn.innerHTML = `${icon('spin')}<span>Compiling…</span>`
    list.replaceChildren()
    try {
      const { stdout, error, results } = await run(ed.getValue(), p.tests)
      const row = (ok: boolean, text: string, detail?: string, r?: TestResult) => {
        const li = document.createElement('li'); li.className = ok ? 'ok' : 'fail'
        li.innerHTML = `${icon(ok ? 'check' : 'x')}<span class="rt"></span>`
        li.querySelector('.rt')!.textContent = text
        if (detail) { const d = document.createElement('div'); d.className = 'detail'; d.textContent = detail; li.append(d) }
        if (r?.expected !== undefined) li.append(panel('Expected vs actual', [['Expected', r.expected], ['Actual', r.actual ?? '']], true))
        if (r?.logs) li.append(panel(`Console output (${lines(r.logs)})`, [['', r.logs.trimEnd()]]))
        list.append(li)
      }
      if (error) row(false, 'Error', error)
      results.forEach(r => row(r.ok, r.name, r.error, r))
      if (stdout) row(true, 'Output', stdout.trimEnd())
      const ok = !error && results.length > 0 && results.every(r => r.ok)
      ok ? localStorage.setItem(passedKey(id, i), '1') : localStorage.removeItem(passedKey(id, i))
      reveal(list.children)
      stat.innerHTML = badge(ok ? 'passed' : 'attempted')
      pop(stat.firstElementChild!)
      count(app.querySelector('.pill .num')!, exercises.filter(e => passed(e.id, e.i)).length)
    } finally {
      runBtn.disabled = false
      runBtn.innerHTML = `${icon('play')}<span>Run tests</span>`
    }
  }
  runBtn.onclick = runTests
  onRunKey(ed, runTests)
}

/* ---------- pages ---------- */

function home() {
  const done = nodes.filter(n => isDone(n.id)).length
  const next = nextModule()
  shell('home', `
    <section class="hero">
      <h1>Learn <em>Swift</em> the way it fits together.</h1>
      <p class="lead">${nodes.length} modules laid out by what they build on, each with an article, a live playground, and exercises with tests you solve right here in the browser. Real Swift, compiled by a real swiftc on Compiler Explorer. No install.</p>
      <div class="actions">
        <a class="cta" href="#/${next?.id ?? nodes[0].id}">${done ? `Continue with ${next?.label}` : 'Start the roadmap'}${icon('right')}</a>
        <a class="ghost" href="#/exercises">Browse ${exercises.length} exercises</a>
      </div>
      <p class="progress num">${done} of ${nodes.length} modules completed</p>
    </section>
    <section class="map" aria-label="Roadmap">${renderGraph(new Set(nodes.map(n => n.id).filter(isDone)), next?.id)}</section>`)
  const map = app.querySelector('.map')!
  map.scrollLeft = (map.scrollWidth - map.clientWidth) / 2
}

const STAGES: Record<number, string> = { 0: 'Foundations', 1: 'Foundations', 2: 'Foundations', 3: 'Core language', 4: 'Core language', 5: 'Types and values', 6: 'Types and values', 7: 'Idiomatic Swift', 8: 'Idiomatic Swift', 9: 'Concurrency', 10: 'In practice' }

function learn() {
  const groups = new Map<string, typeof nodes>()
  nodes.forEach(n => groups.set(STAGES[n.level], [...(groups.get(STAGES[n.level]) ?? []), n]))
  let idx = 0
  shell('learn', `
    <header class="page-head"><h1>Learn</h1><p class="lead">Every module in roadmap order. Each one builds on the ones above it, so read top to bottom the first time through.</p></header>
    ${[...groups].map(([stage, list]) => `<section class="stage">
      <h2>${stage}</h2>
      <ol class="module-list" style="counter-reset: mod ${idx}">${list.map(n => {
        idx++
        const m = modules[n.id]
        return `<li class="${isDone(n.id) ? 'done' : ''}"><a href="#/${n.id}">
          <span class="module-title">${n.label}</span>
          <span class="module-summary">${esc(m.summary)}</span>
          <span class="module-meta num">${isDone(n.id) ? `${icon('check')}Completed` : `${doneCount(n.id)} of ${m.problems.length} exercises`}</span>
        </a></li>`
      }).join('')}</ol>
    </section>`).join('')}`)
}

function exercisesPage() {
  const filter = new URLSearchParams(location.hash.split('?')[1] ?? '').get('f') ?? 'all'
  const labels: Record<string, string> = { all: 'All', todo: 'To do', attempted: 'In progress', passed: 'Passed' }
  const chips = Object.keys(labels).map(f => `<a class="chip" href="#/exercises?f=${f}"${f === filter ? ' aria-current="true"' : ''}>${labels[f]}</a>`).join('')
  const rows = nodes.map(n => {
    const list = modules[n.id].problems.map((p, i) => ({ p, i, s: status(n.id, i) })).filter(x => filter === 'all' || x.s === filter)
    if (!list.length) return ''
    return `<section class="ex-group"><h2><a href="#/${n.id}">${n.label}</a><span class="num">${doneCount(n.id)}/${modules[n.id].problems.length}</span></h2>
      <ol class="ex-list">${list.map(({ p, i, s }) => `<li><a href="#/exercise/${n.id}/${i}"><span class="ex-title">${p.title}</span>${badge(s)}</a></li>`).join('')}</ol></section>`
  }).join('')
  const empty: Record<string, string> = {
    todo: 'Every exercise has been started. Nice.',
    attempted: 'Nothing in progress. Open any exercise and edit the code to start one.',
    passed: 'No passed exercises yet. Solve one and it shows up here.',
  }
  const counts = { passed: exercises.filter(e => status(e.id, e.i) === 'passed').length, attempted: exercises.filter(e => status(e.id, e.i) === 'attempted').length }
  shell('exercises', `
    <header class="page-head"><h1>Exercises</h1><p class="lead num">${exercises.length} problems with test cases. ${counts.passed} passed, ${counts.attempted} in progress.</p><nav class="chips" aria-label="Filter">${chips}</nav></header>
    ${rows || `<p class="empty">${empty[filter] ?? 'Nothing here yet.'}</p>`}`)
}

function modulePage(id: string) {
  const m = modules[id]
  const idx = nodes.findIndex(n => n.id === id)
  const next = nodes.filter(n => n.deps.includes(id))
  const prev = nodes[idx].deps
  shell('learn', `
    <p class="crumbs"><a href="#/learn">Learn</a><span>/</span><span class="num">Module ${idx + 1} of ${nodes.length}</span></p>
    <header class="title"><h1>${m.title}</h1>${prev.length ? `<p class="builds">Builds on ${prev.map(p => `<a href="#/${p}">${modules[p].title}</a>`).join(', ')}</p>` : ''}</header>
    <article class="prose">${m.html}</article>
    ${m.playground ? `<section class="play" aria-labelledby="play-h">
      <h2 id="play-h">Try it</h2>
      <p class="hint">Edit the code and run it. Output and errors show below.</p>
      <div class="editor" id="play"></div>
      <div class="bar"><button class="primary" id="run">${icon('play')}<span>Run</span></button><kbd>Ctrl</kbd><kbd>Enter</kbd></div>
      <pre class="out" id="play-out" aria-live="polite"></pre>
    </section>` : ''}
    ${m.problems.length ? `<section class="exercises" aria-labelledby="ex-h"><h2 id="ex-h">Exercises</h2><p class="hint">Solve each problem so its tests pass. Your code is saved in this browser. <a href="#/exercises">All exercises</a></p>
      ${m.problems.map((p, i) => problemHtml(id, i, p)).join('')}</section>` : ''}
    <footer class="next">${next.length ? `<span class="next-label">Next up</span>${next.map(n => `<a href="#/${n.id}">${n.label}${icon('right')}</a>`).join('')}` : '<span class="next-label">You reached the end of the roadmap.</span><a href="#/exercises">Review your exercises' + icon('right') + '</a>'}</footer>`, sidebar(id))
  colorize(app)

  if (m.playground) {
    const ed = mountEditor(document.getElementById('play')!, m.playground, `${id}-play`)
    const pre = document.getElementById('play-out')!
    const btn = document.getElementById('run') as HTMLButtonElement
    const runPlay = async () => {
      if (btn.disabled) return
      btn.disabled = true
      pre.replaceChildren()
      const print = (text: string, kind = 'log') => { const s = document.createElement('span'); s.className = kind; s.textContent = text + '\n'; pre.append(s) }
      print('Compiling…', 'muted')
      try {
        const { stdout, error } = await run(ed.getValue())
        pre.replaceChildren()
        if (stdout) print(stdout.trimEnd())
        if (error) print(error, 'error')
        if (!pre.childNodes.length) print('Ran without output. Add a fmt.Println to see something here.', 'muted')
      } finally { btn.disabled = false }
    }
    btn.onclick = runPlay
    onRunKey(ed, runPlay)
  }
  m.problems.forEach((p, i) => wireProblem(id, i, p))
}

function exercisePage(id: string, i: number) {
  const p = modules[id].problems[i]
  const at = exercises.findIndex(e => e.id === id && e.i === i)
  const prev = exercises[at - 1], next = exercises[at + 1]
  shell('exercises', `
    <p class="crumbs"><a href="#/exercises">Exercises</a><span>/</span><a href="#/${id}">${modules[id].title}</a><span>/</span><span class="num">${i + 1} of ${modules[id].problems.length}</span></p>
    <header class="title"><h1 id="ph-${i}">${p.title}</h1><p class="builds">${icon('book')}Stuck? <a href="#/${id}">Read the ${modules[id].title} article</a></p></header>
    <div class="exercises single">${problemHtml(id, i, p, false)}</div>
    <footer class="next pager">
      ${prev ? `<a href="#/exercise/${prev.id}/${prev.i}">${icon('left')}<span><b>${prev.p.title}</b><small>${prev.label}</small></span></a>` : '<span></span>'}
      ${next ? `<a class="right" href="#/exercise/${next.id}/${next.i}"><span><b>${next.p.title}</b><small>${next.label}</small></span>${icon('right')}</a>` : '<span></span>'}
    </footer>`, sidebar(id))
  colorize(app)
  wireProblem(id, i, p)
}

/* The reference appendix: a lookup page, not a step on the roadmap, so it has no graph node and no exercises. */
function referencePage() {
  const m = modules['reference']
  shell('reference', `
    <header class="title"><h1>${m.title}</h1></header>
    <article class="prose">${m.html}</article>`, sidebar(''))
  colorize(app)
}

let shown = ''
function route() {
  const [, a = '', b = '', c = ''] = location.hash.split('?')[0].split('/')
  // Another section of the module already on screen: scroll, don't rebuild the page and its editors.
  if (b && a in modules && shown === a) return section(b)
  disposeAll()
  shown = a in modules ? a : ''
  if (a === 'learn') learn()
  else if (a === 'reference' && 'reference' in modules) referencePage()
  else if (a === 'exercises') exercisesPage()
  else if (a === 'exercise' && b in modules && modules[b].problems[+c]) exercisePage(b, +c)
  else if (a in modules) modulePage(a)
  else home()
  window.scrollTo(0, 0)
  enter(app.querySelector('main')!)
  if (b && shown) section(b)
}
addEventListener('hashchange', route)
route()
