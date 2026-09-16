import { editor, Uri, KeyMod, KeyCode, type IDisposable } from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

editor.defineTheme('rm-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#151a23', 'editorGutter.background': '#151a23' } })
editor.defineTheme('rm-light', { base: 'vs', inherit: true, rules: [], colors: { 'editor.background': '#eaeef4', 'editorGutter.background': '#eaeef4' } })
export const syncEditorTheme = () => editor.setTheme(document.documentElement.dataset.theme === 'light' ? 'rm-light' : 'rm-dark')
syncEditorTheme()
document.fonts.ready.then(() => editor.remeasureFonts())

let live: IDisposable[] = []
export const disposeAll = () => { live.forEach(d => d.dispose()); live = [] }

export function mountEditor(el: HTMLElement, value: string, name: string) {
  const model = editor.createModel(value, 'swift', Uri.parse(`file:///${name}.swift`))
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
  root.querySelectorAll('pre code').forEach(el => editor.colorize(el.textContent ?? '', 'swift', {}).then(html => { el.innerHTML = html }))
}

export { run, type TestResult } from './runtime'
