const body = JSON.stringify({args:'',files:[{name:'File.kt',text:'fun main(){println(1)}'}],confType:'java'})
const url = 'https://api.kotlinlang.org/api/2.2.20/compiler/run?filename=File.kt'
for (const [label, init] of [
  ['plain', { method:'POST', headers:{'Content-Type':'application/json'}, body }],
  ['with UA', { method:'POST', headers:{'Content-Type':'application/json','User-Agent':'Mozilla/5.0','Accept':'application/json'}, body }],
  ['GET root', {}],
]) {
  try { const r = await fetch(label === 'GET root' ? 'https://api.kotlinlang.org/' : url, init); console.log(label, r.status) }
  catch (e) { console.log(label, 'FAILED', e.message, '| cause:', e.cause?.code ?? e.cause?.name ?? e.cause?.message ?? JSON.stringify(e.cause)) }
}
