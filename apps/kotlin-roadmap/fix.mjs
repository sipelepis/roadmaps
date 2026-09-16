import dns from 'node:dns'
import net from 'node:net'
dns.setDefaultResultOrder('ipv4first')
net.setDefaultAutoSelectFamily(false)
const body = JSON.stringify({args:'',files:[{name:'File.kt',text:'fun main(){println(41+1)}'}],confType:'java'})
try {
  const r = await fetch('https://api.kotlinlang.org/api/2.2.20/compiler/run?filename=File.kt', { method:'POST', headers:{'Content-Type':'application/json'}, body })
  console.log('OK', r.status, (await r.text()).slice(0, 120))
} catch (e) { console.log('FAILED', e.cause?.code ?? e.message) }
