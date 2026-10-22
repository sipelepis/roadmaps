import { editor, Uri, KeyMod, KeyCode, type IDisposable } from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import { HARNESS, type RunResult } from './harness'
export type { TestResult, RunResult } from './harness'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

editor.defineTheme('rm-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#151a23', 'editorGutter.background': '#151a23' } })
editor.defineTheme('rm-light', { base: 'vs', inherit: true, rules: [], colors: { 'editor.background': '#eaeef4', 'editorGutter.background': '#eaeef4' } })
export const syncEditorTheme = () => editor.setTheme(document.documentElement.dataset.theme === 'light' ? 'rm-light' : 'rm-dark')
syncEditorTheme()
document.fonts.ready.then(() => editor.remeasureFonts())

let live: IDisposable[] = []
export const disposeAll = () => { live.forEach(d => d.dispose()); live = [] }

export function mountEditor(el: HTMLElement, value: string, name: string) {
  const model = editor.createModel(value, 'python', Uri.parse(`file:///${name}.py`))
  const ed = editor.create(el, {
    model, fontSize: 14, fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace", fontLigatures: true, minimap: { enabled: false }, automaticLayout: true, fixedOverflowWidgets: true,
    scrollBeyondLastLine: false, lineNumbersMinChars: 3, padding: { top: 12, bottom: 12 }, tabSize: 4, insertSpaces: true,
    scrollbar: { alwaysConsumeMouseWheel: false },
  })
  const fit = () => { el.style.height = Math.min(600, Math.max(160, ed.getContentHeight())) + 'px' }
  ed.onDidContentSizeChange(fit); fit()
  live.push(ed, model)
  return ed
}

/** Ctrl/Cmd+Enter runs the editor's action. */
export const onRunKey = (ed: editor.IStandaloneCodeEditor, fn: () => void) => ed.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, fn)

/** Syntax-highlight every <pre><code> under root with Monaco's tokenizer. */
export function colorize(root: ParentNode) {
  root.querySelectorAll('pre code').forEach(el => editor.colorize(el.textContent ?? '', 'python', {}).then(html => { el.innerHTML = html }))
}

/* ---------- Python runtime: Pyodide (CPython in WebAssembly), loaded from the CDN on first run ---------- */

interface Pyodide { runPython(code: string): unknown; globals: { get(name: string): (...args: string[]) => string } }
declare global { function loadPyodide(opts: { indexURL: string }): Promise<Pyodide> }

// Runs user code, then the test file, in one fresh namespace. Reports stdout, the first
// uncaught error, and one result per `test_*` function (its docstring is the label) with
// what it printed and, when an `assert a <op> b` fails, both sides as they were compared.
let runner: Promise<(code: string, tests: string) => string> | undefined
export let pythonReady = false
const python = () => runner ??= loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.6/full/' }).then(py => {
  py.runPython(HARNESS)
  pythonReady = true
  return py.globals.get('__run')
})

// ponytail: runs on the main thread, so an infinite loop freezes the tab; move Pyodide into a worker if that bites.
export async function run(code: string, tests = ''): Promise<RunResult> {
  return JSON.parse((await python())(code, tests))
}
