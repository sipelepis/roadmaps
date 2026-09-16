import dns from 'node:dns/promises'
import net from 'node:net'
console.log('lookup all:', await dns.lookup('api.kotlinlang.org', { all: true }))
for (const host of ['54.77.13.44']) {
  await new Promise(res => { const s = net.connect({ host, port: 443, timeout: 8000 }, () => { console.log('tcp ok', host); s.destroy(); res() }); s.on('timeout', () => { console.log('tcp TIMEOUT', host); s.destroy(); res() }); s.on('error', e => { console.log('tcp err', host, e.code); res() }) })
}
const r = await fetch('https://54.77.13.44/', { headers: { Host: 'api.kotlinlang.org' } }).catch(e => ({ err: e.cause?.code || e.message }))
console.log('fetch by ip:', r.err ?? r.status)
