'use strict';
// Una célula verificadora. Corre en su propio Web Worker: su propia llave, su propio llavero
// y sus propios nonces vistos, en su propia base IndexedDB. No comparte estado con las otras.
const C = self.name || 'X';
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const huella = async jwk => (await sha(canon(jwk))).slice(0, 16).match(/..../g).join(' ');
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function db() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-quorum-celula-' + C, 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function get(k) { const d = await db(); return new Promise(ok => { const r = d.transaction('k').objectStore('k').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); }); }
async function put(k, v) { const d = await db(); return new Promise(ok => { const t = d.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }
let KP, JWK, FP;
const listo = (async () => {
  KP = await get('llave');
  if (!KP || !KP.privateKey) { KP = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']); await put('llave', KP); }
  const j = await crypto.subtle.exportKey('jwk', KP.publicKey); JWK = { crv: j.crv, kty: j.kty, x: j.x, y: j.y }; FP = await huella(JWK);
})();
async function revisar(m) {
  // 1) piezas y huella raíz
  if (await sha(m.man.hashes.join('')) !== m.man.raiz) return ['rechaza', 'huella raíz no coincide'];
  const partes = [];
  for (let i = 0; i < m.man.n; i++) { const p = m.piezas[i]; if (!p) return ['rechaza', 'falta la pieza ' + (i + 1)]; const b = b64(p); if (await sha(b) !== m.man.hashes[i]) return ['rechaza', 'pieza ' + (i + 1) + ' alterada']; partes.push(b); }
  const all = new Uint8Array(partes.reduce((a, b) => a + b.length, 0)); let o = 0; partes.forEach(b => { all.set(b, o); o += b.length; });
  const inf = JSON.parse(dec.decode(all));
  // 2) informe: huella, firma, llavero, revocación, nonce
  if (await sha(canon(inf.env)) !== inf.hash) return ['rechaza', 'el informe cambió después de sellarse', inf];
  let f = false; try { const k = await crypto.subtle.importKey('jwk', { ...inf.env.emisor.jwk, ext: true }, ALG, true, ['verify']); f = await crypto.subtle.verify(SIG, k, unhex(inf.firma), enc.encode(inf.hash)); } catch { f = false; }
  if (!f) return ['rechaza', 'firma del emisor no válida', inf];
  const fp = await huella(inf.env.emisor.jwk);
  if ((await get('revocadas') || []).includes(fp)) return ['rechaza', 'llave del emisor revocada', inf];
  if (!(await get('confianza') || []).includes(fp)) return ['rechaza', 'llave del emisor desconocida', inf];
  const vistos = await get('nonces') || [];
  if (vistos.includes(inf.env.nonce)) return ['rechaza', 'repetición: este informe ya se recibió', inf];
  vistos.push(inf.env.nonce); await put('nonces', vistos.slice(-500));
  return ['verifica', 'todo coincide', inf];
}
self.onmessage = async ({ data: m }) => {
  await listo;
  if (m.t === 'hola') return postMessage({ t: 'hola', celula: C, fp: FP, jwk: JWK });
  if (m.t === 'confiar') { const l = await get('confianza') || []; if (!l.includes(m.fp)) l.push(m.fp); await put('confianza', l); return postMessage({ t: 'ok', id: m.id }); }
  if (m.t === 'revocar') { const l = await get('revocadas') || []; if (!l.includes(m.fp)) l.push(m.fp); await put('revocadas', l); return postMessage({ t: 'ok', id: m.id }); }
  if (m.t === 'borrar') { await put('confianza', []); await put('revocadas', []); await put('nonces', []); return postMessage({ t: 'ok', id: m.id }); }
  if (m.t === 'verificar') {
    let [veredicto, motivo, inf] = await revisar(m);
    if (m.mentir) { veredicto = 'verifica'; motivo = 'MIENTE (prueba): vota verifica sin revisar'; }
    const voto = { celula: C, fp: FP, informe_hash: inf ? inf.hash : null, raiz: m.man.raiz, veredicto, motivo, ts: new Date().toISOString(), nonce: hex(crypto.getRandomValues(new Uint8Array(16))) };
    const h = await sha(canon(voto)); const firma = hex(await crypto.subtle.sign(SIG, KP.privateKey, enc.encode(h)));
    postMessage({ t: 'voto', id: m.id, voto, hash: h, firma });
  }
};
