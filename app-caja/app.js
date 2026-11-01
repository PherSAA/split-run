'use strict';
// Phenom · Caja (VERSIÓN DE PRUEBA). Cobros SIMULADOS: no mueve dinero. Firmado y sellado, NO cifrado.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const K = { libro: 'phenom_caja_libro_v1', plan: 'phenom_caja_plan_v1', pk: 'phenom_caja_passkey_v1' };
const CERO = '0'.repeat(64);
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 1600); };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const dinero = c => (c < 0 ? '-' : '') + '$' + Math.floor(Math.abs(c) / 100) + '.' + String(Math.abs(c) % 100).padStart(2, '0');
// "6.5" -> 650 centavos, sin usar decimales de coma flotante.
function centavos(s) { const m = String(s).trim().replace(',', '.').match(/^(\d{1,7})(?:\.(\d{0,2}))?$/); return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : null; }

// ---------- Llave (privada NO exportable, en IndexedDB) ----------
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-caja', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise(ok => { const r = db.transaction('k').objectStore('k').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise(ok => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }
const pubOf = async pk => { const j = await crypto.subtle.exportKey('jwk', pk); return { crv: j.crv, kty: j.kty, x: j.x, y: j.y }; };
const huella = async jwk => (await sha(canon(jwk))).slice(0, 16).match(/..../g).join(' ');
let LL = null;
async function cargarLlave() {
  let kp = await idbGet('emisor').catch(() => null);
  if (!kp || !kp.privateKey) { kp = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']); await idbPut('emisor', kp).catch(() => {}); }
  const jwk = await pubOf(kp.publicKey); LL = { kp, jwk, fp: await huella(jwk) };
  $('#cFp').textContent = $('#kFp').textContent = LL.fp;
}

// ---------- Libro encadenado (solo datos firmados + llave PÚBLICA) ----------
const leer = () => { try { return JSON.parse(localStorage.getItem(K.libro)) || { recibos: [] }; } catch { return { recibos: [] }; } };
const guardar = l => localStorage.setItem(K.libro, JSON.stringify(l));
async function cobrar(lineas, total) {
  const l = leer(); const prev = l.recibos.length ? l.recibos[l.recibos.length - 1].hash : CERO;
  const rec = { id: hex(crypto.getRandomValues(new Uint8Array(12))), n: l.recibos.length + 1, monto_centavos: total, moneda: 'USD', lineas, estado: 'SIMULADO — no mueve dinero', fecha: new Date().toISOString(), plan: PLAN, anterior: prev, nonce: hex(crypto.getRandomValues(new Uint8Array(16))), emisor: LL.fp };
  const hash = await sha(canon(rec)); const firma = hex(await crypto.subtle.sign(SIG, LL.kp.privateKey, enc.encode(hash)));
  const e = { rec, hash, firma }; l.llave_publica = l.llave_publica || LL.jwk; l.recibos.push(e); guardar(l); return e;
}
async function verRecibo(e, jwk) {
  const p = [];
  const h = await sha(canon(e.rec)); p.push(['Huella', h === e.hash]);
  let f = false; try { const k = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, ALG, true, ['verify']); f = await crypto.subtle.verify(SIG, k, unhex(e.firma), enc.encode(e.hash)); } catch { f = false; }
  p.push(['Firma', f]); return { ok: p.every(x => x[1]), p };
}
async function verLibro() {
  const l = leer(); let prev = CERO, total = 0, malo = null; const vistos = new Set();
  if (l.llave_publica && await huella(l.llave_publica) !== LL.fp) return { ok: false, malo: { n: '—', por: 'la llave pública guardada no es la de esta caja' }, total: 0, n: l.recibos.length };
  for (const e of l.recibos) {
    const r = await verRecibo(e, l.llave_publica || LL.jwk);
    const cadena = e.rec.anterior === prev, rep = vistos.has(e.rec.nonce); vistos.add(e.rec.nonce);
    if (!r.ok || !cadena || rep) { malo = { n: e.rec.n, por: !r.ok ? 'huella o firma no coincide' : !cadena ? 'cadena rota' : 'nonce repetido' }; break; }
    prev = e.hash; total += e.rec.monto_centavos;
  }
  return { ok: !malo, malo, total, n: l.recibos.length };
}

// ---------- Plan Normal / Pago (demo) ----------
let PLAN = localStorage.getItem(K.plan) || 'normal';
const qp = new URLSearchParams(location.search).get('plan'); if (qp === 'pago' || qp === 'normal') PLAN = qp;
function ponerPlan(p) {
  PLAN = p; localStorage.setItem(K.plan, p); document.body.classList.toggle('gold', p === 'pago');
  $$('[data-plan]').forEach(b => b.setAttribute('aria-pressed', b.dataset.plan === p));
  $('#planLbl').textContent = p === 'pago' ? 'Plan Pago (demo) · cobro simulado' : 'Plan Normal · cobro simulado';
  document.querySelector('meta[name=theme-color]').content = p === 'pago' ? '#0a0a0a' : '#000000';
}
$$('[data-plan]').forEach(b => b.onclick = () => ponerPlan(b.dataset.plan));

// Líneas de producto (plan Pago)
const EJ = [['Café', 2, '2.50'], ['Pan', 1, '1.50'], ['Jugo', 1, '3.00'], ['Agua', 3, '1.00'], ['Galletas', 2, '0.75']];
let NL = 2;
function pintarLineas() {
  const box = $('#lineas'); const prev = $$('#lineas .lin').map(r => [...r.querySelectorAll('input')].map(i => i.value));
  box.querySelectorAll('.lin').forEach(x => x.remove());
  for (let i = 0; i < NL; i++) { const v = prev[i] || EJ[i]; const d = document.createElement('div'); d.className = 'lin';
    d.innerHTML = `<label>Producto<input value="${esc(v[0])}"></label><label>Cant.<input inputmode="numeric" value="${esc(v[1])}"></label><label>Precio<input inputmode="decimal" value="${esc(v[2])}"></label>`; box.appendChild(d); }
}
$('#lMas').onclick = () => { if (NL < 5) { NL++; pintarLineas(); } };
$('#lMenos').onclick = () => { if (NL > 2) { NL--; pintarLineas(); } };

// ---------- Passkey (WebAuthn real, opcional, plan Pago) ----------
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function waDisponible() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; } }
$('#bPasskey').onclick = async () => {
  if (!await waDisponible()) { $('#waNota').textContent = 'Este dispositivo o navegador no ofrece huella / Face ID para páginas web. La caja funciona igual sin este paso.'; return; }
  try {
    const c = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Phenom Caja (prueba)' }, user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'caja-demo', displayName: 'Caja demo' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }, timeout: 60000 } });
    localStorage.setItem(K.pk, b64u(c.rawId)); $('#waNota').textContent = 'Passkey registrada en este dispositivo. Probado solo en el emulador, no en un iPhone real.'; toast('Passkey registrada');
  } catch (e) { $('#waNota').textContent = 'No se registró la passkey (' + e.name + '). La caja funciona igual sin este paso.'; }
};
async function pedirHuella() {
  const id = localStorage.getItem(K.pk); if (!id) { $('#waNota').textContent = 'Primero registra una passkey.'; return false; }
  try { const a = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64u(id) }], userVerification: 'required', timeout: 60000 } }); return !!a; }
  catch (e) { $('#waNota').textContent = 'Huella / Face ID no confirmada (' + e.name + '). No se cobró.'; return false; }
}

// ---------- Caja ----------
let ULT = null;
$('#bCobrar').onclick = async () => {
  let lineas = [], total;
  if (PLAN === 'pago') {
    for (const r of $$('#lineas .lin')) { const [p, q, pr] = [...r.querySelectorAll('input')].map(i => i.value.trim()); const c = centavos(pr), n = parseInt(q, 10);
      if (!p || !(n >= 1 && n <= 999) || c === null) { toast('Revisa las líneas'); return; } lineas.push({ producto: p, cantidad: n, precio_centavos: c, subtotal_centavos: n * c }); }
    total = lineas.reduce((a, x) => a + x.subtotal_centavos, 0);
    if ($('#pideHuella').checked && !await pedirHuella()) { toast('No se cobró'); return; }
  } else { total = centavos($('#cMonto').value); if (total === null || total <= 0) { toast('Monto no válido'); return; } }
  ULT = await cobrar(lineas, total); await mostrar(ULT, await verRecibo(ULT, LL.jwk)); toast('Cobro simulado firmado'); pintarLibro();
};
async function mostrar(e, r) {
  $('#recibo').hidden = false; $('#rMonto').textContent = dinero(e.rec.monto_centavos);
  const c = $('#rChip'); c.textContent = r.ok ? 'Verificado ✓' : 'ROTA ✗'; c.className = 'chip ' + (r.ok ? 'ok' : 'bad');
  $('[data-p=s]').innerHTML = `<p>Recibo n.º ${e.rec.n} · ${dinero(e.rec.monto_centavos)}</p><p class="muted">${esc(e.rec.estado)} · ${esc(e.rec.fecha.slice(0, 16).replace('T', ' '))} UTC</p>` + (e.rec.lineas.length ? '<dl class="kv">' + e.rec.lineas.map(l => `<dt>${l.cantidad} × ${esc(l.producto)}</dt><dd>${dinero(l.subtotal_centavos)}</dd>`).join('') + '</dl>' : '');
  $('[data-p=d]').innerHTML = '<dl class="kv">' + [['ID', e.rec.id], ['Estado', e.rec.estado], ['Fecha', e.rec.fecha], ['Emisor', e.rec.emisor], ['Anterior', e.rec.anterior.slice(0, 16) + '…'], ['Huella', e.hash], ['Firma', e.firma.slice(0, 32) + '…']].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('') + r.p.map(([k, v]) => `<dt>${v ? '✓' : '✗'} ${k}</dt><dd>${v ? 'coincide' : 'no coincide'}</dd>`).join('') + '</dl>';
  $('[data-p=b]').innerHTML = '<pre>' + esc(JSON.stringify(e, null, 2)) + '</pre>';
}
$('#bVerRecibo').onclick = async () => ULT && mostrar(ULT, await verRecibo(ULT, LL.jwk));
$('#bAltRecibo').onclick = async () => { if (!ULT) return; const e = JSON.parse(JSON.stringify(ULT)); e.rec.monto_centavos += 10000; await mostrar(e, await verRecibo(e, LL.jwk)); };
$('#bPrint').onclick = () => window.print();
$$('[role=tab]').forEach(t => t.onclick = () => { $$('[role=tab]').forEach(x => x.setAttribute('aria-selected', x === t)); $$('[data-p]').forEach(v => v.hidden = v.dataset.p !== t.dataset.t); });

// ---------- Libro ----------
async function pintarLibro() {
  const l = leer(), v = await verLibro();
  $('#lTotal').textContent = dinero(v.total);
  $('#lLista').innerHTML = l.recibos.slice().reverse().map(e => `<li><p>n.º ${e.rec.n} · ${dinero(e.rec.monto_centavos)}</p><p class="muted">${esc(e.rec.fecha.slice(0, 16).replace('T', ' '))} UTC · ${e.hash.slice(0, 12)}…</p></li>`).join('');
  return v;
}
$('#bVerLibro').onclick = async () => {
  const v = await pintarLibro(); const c = $('#lChip');
  c.textContent = v.ok ? 'Verificado ✓' : 'ROTA ✗'; c.className = 'chip ' + (v.ok ? 'ok' : 'bad');
  $('#lInfo').textContent = v.ok ? `${v.n} recibos, cadena completa. El total sale del libro verificado.` : `Recibo n.º ${v.malo.n}: ${v.malo.por}. Total contado hasta antes de ese recibo.`;
};
$('#bAltLibro').onclick = () => { const l = leer(); if (!l.recibos.length) return toast('El libro está vacío'); l.recibos[0].rec.monto_centavos += 10000; guardar(l); toast('Recibo n.º 1 alterado'); $('#bVerLibro').click(); };
$('#bBorrar').onclick = () => { localStorage.removeItem(K.libro); $('#lChip').textContent = 'Sin verificar'; $('#lChip').className = 'chip'; $('#lInfo').textContent = ''; pintarLibro(); toast('Libro borrado'); };
$('#bExport').onclick = () => {
  const l = leer(); const out = { formato: 'phenom-caja-libro-v1', aviso: 'Prueba: cobros SIMULADOS, no mueven dinero. Firmado y sellado, no cifrado.', llave_publica: l.llave_publica || LL.jwk, huella_llave: LL.fp, algoritmo: 'ECDSA P-256 / SHA-256 sobre JSON canónico (claves ordenadas); la firma es sobre el texto hex de la huella', recibos: l.recibos };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); a.download = 'libro-caja-firmado.json'; document.body.appendChild(a); a.click(); a.remove();
};

// ---------- Qué falta ----------
$('#faltaLista').innerHTML = ['Pagos reales: backend de Stripe (hoy todo es simulado).', 'Precios de los planes: por definir.', 'Probar passkey en iPhone y Android reales.', 'Verificar la passkey en un servidor (hoy solo se usa como paso local).', 'Respaldo de la llave y del libro.', 'Cifrado del libro en el teléfono (hoy no está cifrado).', 'Revisión legal y contable de los recibos.', 'Clientes piloto (2–3).'].map(x => `<li><p>${x}</p></li>`).join('');

// ---------- Navegación ----------
function ir() {
  const h = (location.hash || '#caja').slice(1); const s = $(`[data-screen="${h}"]`) ? h : 'caja';
  $$('[data-screen]').forEach(x => x.hidden = x.dataset.screen !== s);
  $('#nav').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); scrollTo(0, 0);
  if (s === 'libro' && LL) pintarLibro();
}
addEventListener('hashchange', ir);
$('#menuBtn').onclick = () => { const n = $('#nav'); n.hidden = !n.hidden; $('#menuBtn').setAttribute('aria-expanded', String(!n.hidden)); };
ponerPlan(PLAN); pintarLineas(); ir();
window.phenomCaja = { sha, canon, leer, verLibro, listo: cargarLlave().then(() => pintarLibro()).then(() => true) };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
