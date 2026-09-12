import { editor, Uri, KeyMod, KeyCode, type IDisposable } from 'monaco-editor'
import { getTypeScriptWorker, typescriptDefaults, ScriptTarget, ModuleKind, type Diagnostic } from 'monaco-editor/languages/features/typescript/register.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'

self.MonacoEnvironment = {
  getWorker: (_id, label) => (label === 'typescript' || label === 'javascript' ? new TsWorker() : new EditorWorker()),
}

// Test harness typings visible to every editor + test block.
const HARNESS_DTS = `
declare function test(name: string, fn: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
  toEqual(expected: unknown): void
  toBeTruthy(): void
  toBeFalsy(): void
  toThrow(message?: string): void
}
/** Type-level assertion: \`type _ = Expect<Equal<A, B>>\` fails to compile when A and B differ. */
type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
`

typescriptDefaults.setCompilerOptions({
  target: ScriptTarget.ES2020,
  module: ModuleKind.ESNext,
  moduleDetection: 3, // force: every editor is its own module, no global collisions between editors on one page
  strict: true,
})
typescriptDefaults.addExtraLib(HARNESS_DTS, 'file:///harness.d.ts')
editor.defineTheme('rm-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#151a23', 'editorGutter.background': '#151a23' } })
editor.defineTheme('rm-light', { base: 'vs', inherit: true, rules: [], colors: { 'editor.background': '#eaeef4', 'editorGutter.background': '#eaeef4' } })
export const syncEditorTheme = () => editor.setTheme(document.documentElement.dataset.theme === 'light' ? 'rm-light' : 'rm-dark')
syncEditorTheme()
document.fonts.ready.then(() => editor.remeasureFonts())

let live: IDisposable[] = []
export const disposeAll = () => { live.forEach(d => d.dispose()); live = [] }

export function mountEditor(el: HTMLElement, value: string, name: string) {
  const model = editor.createModel(value, 'typescript', Uri.parse(`file:///${name}.ts`))
  const ed = editor.create(el, {
    model, fontSize: 14, fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace", fontLigatures: true, minimap: { enabled: false }, automaticLayout: true, fixedOverflowWidgets: true,
    scrollBeyondLastLine: false, lineNumbersMinChars: 3, padding: { top: 12, bottom: 12 }, tabSize: 2,
    scrollbar: { alwaysConsumeMouseWheel: false },
  })
  const fit = () => { el.style.height = Math.min(600, Math.max(160, ed.getContentHeight())) + 'px' }
  ed.onDidContentSizeChange(fit); fit()
  live.push(ed, model)
  return ed
}

const flatten = (m: Diagnostic['messageText']): string =>
  typeof m === 'string' ? m : [m.messageText, ...(m.next ?? []).map(flatten)].join(' ')

let n = 0
/** Type-check + emit a source string in a throwaway model. */
export async function compile(source: string) {
  const uri = Uri.parse(`file:///__run${n++}.ts`)
  const model = editor.createModel(source, 'typescript', uri)
  try {
    const client = await (await getTypeScriptWorker())(uri)
    const f = uri.toString()
    const [syn, sem, out] = await Promise.all([client.getSyntacticDiagnostics(f), client.getSemanticDiagnostics(f), client.getEmitOutput(f)])
    const errors = [...syn, ...sem].map(d => `line ${model.getPositionAt(d.start ?? 0).lineNumber}: ${flatten(d.messageText)}`)
    return { js: out.outputFiles[0]?.text ?? '', errors }
  } finally { model.dispose() }
}

type Out = (line: string, kind?: string) => void
const show = (v: unknown) => typeof v === 'string' ? v : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
const fakeConsole = (out: Out) => new Proxy({}, { get: (_, level) => (...a: unknown[]) => out(a.map(show).join(' '), String(level)) })

interface Harness { test(name: string, fn: () => unknown): void; expect(actual: unknown): Record<string, (e?: unknown) => void> }
type TestResult = { name: string; ok: boolean; error?: string }

const fail = (msg: string) => { throw new Error(msg) }
const harness = (queue: { name: string; fn: () => unknown }[]): Harness => ({
  test: (name, fn) => queue.push({ name, fn }),
  expect: (actual: unknown) => ({
    toBe: e => Object.is(actual, e) || fail(`expected ${show(e)}, got ${show(actual)}`),
    toEqual: e => JSON.stringify(actual) === JSON.stringify(e) || fail(`expected ${show(e)}, got ${show(actual)}`), // ponytail: key-order-sensitive deep equal
    toBeTruthy: () => actual || fail(`expected truthy, got ${show(actual)}`),
    toBeFalsy: () => !actual || fail(`expected falsy, got ${show(actual)}`),
    toThrow: (msg) => {
      try { (actual as () => void)() } catch (e) {
        if (msg && !String((e as Error).message).includes(String(msg))) fail(`expected error containing "${msg}", got "${(e as Error).message}"`)
        return
      }
      fail('expected function to throw')
    },
  }),
})

/** Run emitted JS as an ES module. console + test/expect are injected as module-scoped bindings. */
export async function run(js: string, out: Out): Promise<TestResult[]> {
  const queue: { name: string; fn: () => unknown }[] = []
  const g = globalThis as unknown as Record<string, unknown>
  g.__play = { console: fakeConsole(out), ...harness(queue) }
  const url = URL.createObjectURL(new Blob([`const { console, test, expect } = globalThis.__play;\n${js}`], { type: 'text/javascript' }))
  try { await import(/* @vite-ignore */ url) } catch (e) { out(`Uncaught ${(e as Error).name}: ${(e as Error).message}`, 'error') } finally { URL.revokeObjectURL(url) }
  const results: TestResult[] = []
  for (const t of queue) {
    try { await t.fn(); results.push({ name: t.name, ok: true }) } catch (e) { results.push({ name: t.name, ok: false, error: (e as Error).message }) }
  }
  return results
}

/** Syntax-highlight every <pre><code> under root with Monaco's tokenizer. */
export function colorize(root: ParentNode) {
  root.querySelectorAll('pre code').forEach(el => editor.colorize(el.textContent ?? '', 'typescript', {}).then(html => { el.innerHTML = html }))
}

/** Ctrl/Cmd+Enter runs the editor's action. */
export const onRunKey = (ed: editor.IStandaloneCodeEditor, fn: () => void) => ed.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, fn)
