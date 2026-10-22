export const HARNESS = `
import sys, io, json, traceback, linecache, ast, pprint

_RM_OPS = {ast.Eq: '', ast.NotEq: '!= ', ast.Lt: '< ', ast.LtE: '<= ', ast.Gt: '> ', ast.GtE: '>= ',
         ast.Is: 'is ', ast.IsNot: 'is not ', ast.In: 'in ', ast.NotIn: 'not in '}

# Rewrites assert a == b to assert (_rm_actual := a) == (_rm_expected := b), so a failing
# assert can report both values without evaluating anything twice.
class __Capture(ast.NodeTransformer):
    def __init__(self):
        self.ops = {}  # line -> operator prefix for the expected side
    def visit_Assert(self, node):
        t = node.test
        if isinstance(t, ast.Compare) and len(t.ops) == 1:
            t.left = ast.NamedExpr(ast.Name('_rm_actual', ast.Store()), t.left)
            t.comparators[0] = ast.NamedExpr(ast.Name('_rm_expected', ast.Store()), t.comparators[0])
            for line in range(node.lineno, node.end_lineno + 1):
                self.ops[line] = _RM_OPS.get(type(t.ops[0]), '')
        return node

def __compared(e, ops):
    tb = e.__traceback__
    while tb.tb_next:
        tb = tb.tb_next
    loc = tb.tb_frame.f_locals
    if not isinstance(e, AssertionError) or tb.tb_frame.f_code.co_filename != 'tests.py' or tb.tb_lineno not in ops or '_rm_actual' not in loc:
        return {}
    show = lambda v: pprint.pformat(v, width=60)
    return {'expected': ops[tb.tb_lineno] + show(loc['_rm_expected']), 'actual': show(loc['_rm_actual'])}

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
            capture = __Capture()
            try:
                tree = ast.fix_missing_locations(capture.visit(ast.parse(tests, 'tests.py')))
                exec(compile(tree, 'tests.py', 'exec'), ns)
            except BaseException as e:
                error = 'in tests, ' + __fmt(e)
            for name, fn in list(ns.items()):
                if name.startswith('test_') and callable(fn):
                    sys.stdout = sys.stderr = log = io.StringIO()
                    try:
                        fn()
                        results.append({'name': __label(name, fn), 'ok': True, 'logs': log.getvalue()})
                    except BaseException as e:
                        results.append({'name': __label(name, fn), 'ok': False, 'error': __fmt(e), 'logs': log.getvalue(), **__compared(e, capture.ops)})
    finally:
        sys.stdout, sys.stderr = old_out, old_err
    return json.dumps({'stdout': out.getvalue(), 'error': error, 'results': results})
`

export interface TestResult { name: string; ok: boolean; error?: string; logs?: string; expected?: string; actual?: string }
export interface RunResult { stdout: string; error: string | null; results: TestResult[] }
