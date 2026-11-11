'use strict';
window.Sello = (() => {
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(String(h).match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
function idb(name) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
const pubOf = async pk => { const j = await crypto.subtle.exportKey('jwk', pk); return { crv: j.crv, kty: j.kty, x: j.x, y: j.y }; };
const huella = async jwk => (await sha(canon(jwk))).slice(0, 16).match(/..../g).join(' ');
async function nuevaLlave() {
  const kp = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']);
  const jwk = await pubOf(kp.publicKey);
  return { kp, jwk, fp: await huella(jwk) };
}
// Una transacción elige un único sello incluso al abrir dos pestañas por primera vez.
async function llavePersistente(dbn) {
  const db = await idb(dbn);
  try {
    const read = db.transaction('k').objectStore('k').get('yo');
    let kp = await new Promise((ok, fail) => {
      read.onsuccess = () => ok(read.result);
      read.onerror = () => fail(read.error);
    });
    if (!kp) {
      const candidate = (await nuevaLlave()).kp;
      kp = await new Promise((ok, fail) => {
        const tx = db.transaction('k', 'readwrite');
        const store = tx.objectStore('k');
        const current = store.get('yo');
        let chosen;
        current.onsuccess = () => {
          chosen = current.result || candidate;
          if (!current.result) store.add(chosen, 'yo');
        };
        tx.oncomplete = () => ok(chosen);
        tx.onabort = () => fail(tx.error || new Error('No se pudo guardar el sello.'));
      });
    }
    const jwk = await pubOf(kp.publicKey);
    return { kp, jwk, fp: await huella(jwk) };
  } finally { db.close(); }
}
async function firmar(obj, llave) {
  const h = await sha(canon(obj));
  return { hash: h, firma: hex(await crypto.subtle.sign(SIG, llave.kp.privateKey, enc.encode(h))) };
}
async function firmaOk(jwk, firma, h) {
  try {
    const pk = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, ALG, true, ['verify']);
    return await crypto.subtle.verify(SIG, pk, unhex(firma), enc.encode(h));
  } catch { return false; }
}

return { enc, hex, unhex, sha, canon, SIG, huella, nuevaLlave, llavePersistente, firmar, firmaOk };
})();
