import { editor, Uri, KeyMod, KeyCode, type IDisposable } from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

editor.defineTheme('py-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#151a23', 'editorGutter.background': '#151a23' } })
editor.setTheme('py-dark')
document.fonts.ready.then(() => editor.remeasureFonts())

let live: IDisposable[] = []
export const disposeAll = () => { live.forEach(d => d.dispose()); live = [] }

export function mountEditor(el: HTMLElement, value: string, name: string) {
  const model = editor.createModel(value, 'python', Uri.parse(`file:///${name}.py`))
  const ed = editor.create(el, {
    model, theme: 'py-dark', fontSize: 14, fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace", fontLigatures: true, minimap: { enabled: false }, automaticLayout: true,
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
// uncaught error, and one result per `test_*` function (its docstring is the label).
const HARNESS = `
import sys, io, json, traceback, linecache

def __label(name, fn):
    return (fn.__doc__ or name[5:].replace('_', ' ')).strip()

def __fmt(e):
    if isinstance(e, SyntaxError) and e.filename in ('main.py', 'tests.py'):
        return f'line {e.lineno}: SyntaxError: {e.msg}'
    frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename in ('main.py', 'tests.py')]
    where = f'line {frames[-1].lineno}: ' if frames else ''
    msg = str(e)
    if isinstance(e, AssertionError) and not msg and frames and frames[-1].line:
        msg = frames[-1].line.strip()
    return where + type(e).__name__ + (': ' + msg if msg else '')

def __run(code, tests):
    for name, src in (('main.py', code), ('tests.py', tests)):
        linecache.cache[name] = (len(src), None, src.splitlines(True), name)
    ns = {'__name__': '__main__'}
    out = io.StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    results, error = [], None
    try:
        try:
            exec(compile(code, 'main.py', 'exec'), ns)
        except BaseException as e:
            error = __fmt(e)
        if error is None and tests:
            try:
                exec(compile(tests, 'tests.py', 'exec'), ns)
            except BaseException as e:
                error = 'in tests, ' + __fmt(e)
            for name, fn in list(ns.items()):
                if name.startswith('test_') and callable(fn):
                    try:
                        fn()
                        results.append({'name': __label(name, fn), 'ok': True})
                    except BaseException as e:
                        results.append({'name': __label(name, fn), 'ok': False, 'error': __fmt(e)})
    finally:
        sys.stdout, sys.stderr = old_out, old_err
    return json.dumps({'stdout': out.getvalue(), 'error': error, 'results': results})
`

export interface RunResult { stdout: string; error: string | null; results: { name: string; ok: boolean; error?: string }[] }

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
