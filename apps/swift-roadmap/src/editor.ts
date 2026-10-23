import { editor, Uri, KeyMod, KeyCode, type IDisposable } from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

/** Monaco accepts only #rrggbb[aa]; minified CSS shortens tokens (#fff) and a browser may resolve them to rgb(). */
const token = (name: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (/^#[0-9a-f]{3,4}$/i.test(v)) return '#' + [...v.slice(1)].map(c => c + c).join('')
  const m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i)
  if (!m) return v
  const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  const a = m[4] === undefined ? '' : hex(+m[4] * (m[5] ? 2.55 : 255))
  return '#' + hex(+m[1]) + hex(+m[2]) + hex(+m[3]) + a
}
/** Monaco needs resolved colours, so the theme is rebuilt from the Akashi tokens on every theme change. */
export const syncEditorTheme = () => {
  const dark = document.documentElement.dataset.theme === 'dark'
  const name = dark ? 'akashi-dark' : 'akashi-light'
  const bg = token('--surface'), ink = token('--ink')
  editor.defineTheme(name, {
    base: dark ? 'vs-dark' : 'vs', inherit: true, rules: [],
    colors: {
      'editor.background': bg, 'editorGutter.background': bg,
      'editor.foreground': ink, 'editorLineNumber.activeForeground': ink, 'editorCursor.foreground': ink,
      'editorLineNumber.foreground': token('--muted'),
      'editor.lineHighlightBackground': token('--hover-fill'),
      'editor.selectionBackground': token('--mention-surface'),
    },
  })
  editor.setTheme(name)
}
syncEditorTheme()
document.fonts.load('400 14px "DM Mono"').then(() => editor.remeasureFonts(), () => {})

let live: IDisposable[] = []
export const disposeAll = () => { live.forEach(d => d.dispose()); live = [] }

export function mountEditor(el: HTMLElement, value: string, name: string) {
  const model = editor.createModel(value, 'swift', Uri.parse(`file:///${name}.swift`))
  const ed = editor.create(el, {
    model, fontSize: 14, fontFamily: "'DM Mono', ui-monospace, Menlo, Consolas, monospace", fontLigatures: true, minimap: { enabled: false }, automaticLayout: true, fixedOverflowWidgets: true,
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
  root.querySelectorAll('pre code').forEach(el => editor.colorize(el.textContent ?? '', 'swift', {}).then(html => { el.innerHTML = html }))
}

export { run, type TestResult } from './runtime'
