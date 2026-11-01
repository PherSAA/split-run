'use strict';
// Phenom · Quórum 2 de 3 (VERSIÓN DE PRUEBA). Mismo dispositivo: 3 Web Workers aislados, no 3 teléfonos.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const huella = async jwk => (await sha(canon(jwk))).slice(0, 16).match(/..../g).join(' ');
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 1600); };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ---------- Llave del emisor (privada NO exportable, IndexedDB) ----------
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-quorum-emisor', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise(ok => { const r = db.transaction('k').objectStore('k').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise(ok => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }
let EM = null;
async function cargarEmisor() {
  let kp = await idbGet('emisor').catch(() => null);
  if (!kp || !kp.privateKey) { kp = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']); await idbPut('emisor', kp).catch(() => {}); }
  const j = await crypto.subtle.exportKey('jwk', kp.publicKey); const jwk = { crv: j.crv, kty: j.kty, x: j.x, y: j.y };
  EM = { kp, jwk, fp: await huella(jwk) }; $('#eFp').textContent = EM.fp;
}

// ---------- Las 3 células (Workers aislados) ----------
const CELS = ['A', 'B', 'C'], W = {}, GRUPO = {};
let seq = 0; const esperas = {};
function pedir(c, msg) { return new Promise(ok => { const id = ++seq; esperas[id] = ok; W[c].postMessage({ ...msg, id }); }); }
function crearCelula(c) {
  const w = new Worker('celula.js', { name: c });
  w.onmessage = ({ data: m }) => { if (m.t === 'hola') { GRUPO[c] = { celula: c, fp: m.fp, jwk: m.jwk }; $(`[data-c=${c}] [data-fp]`).textContent = m.fp.slice(0, 9); } if (m.id && esperas[m.id]) { esperas[m.id](m); delete esperas[m.id]; } };
  W[c] = w; return new Promise(ok => { const f = e => { if (e.data.t === 'hola') { w.removeEventListener('message', f); ok(); } }; w.addEventListener('message', f); w.postMessage({ t: 'hola' }); });
}
const todas = msg => Promise.all(CELS.map(c => pedir(c, msg)));

// ---------- Sellar y partir (como en app-llave-real) ----------
let TIPO = 'obra', PAQ = null, ACTA = null;
const DATOS = { obra: () => ({ tipo: 'Informe de obra', obra: 'Remodelación cocina · ejemplo', inspector: 'Inspector de ejemplo', avance: 60 }), techo: () => ({ tipo: 'Garantía de techo', cliente: 'Cliente de ejemplo', trabajo: 'Reparación de goteras · ejemplo', anos: 5, fecha: '2026-11-01' }) };
async function sellar() {
  const env = { app: 'phenom-quorum-prueba', datos: DATOS[TIPO](), emisor: { fp: EM.fp, jwk: EM.jwk }, nonce: hex(crypto.getRandomValues(new Uint8Array(16))), ts: new Date().toISOString() };
  const h = await sha(canon(env)); return { env, hash: h, firma: hex(await crypto.subtle.sign(SIG, EM.kp.privateKey, enc.encode(h))) };
}
async function partir(paq) {
  const b = enc.encode(JSON.stringify(paq)), piezas = [], hashes = [];
  for (let i = 0; i < b.length; i += 160) { const p = b.slice(i, i + 160); piezas.push(btoa(String.fromCharCode(...p))); hashes.push(await sha(p)); }
  return { man: { n: piezas.length, hashes, raiz: await sha(hashes.join('')) }, piezas };
}

// ---------- Votación y regla 2 de 3 ----------
const estado = (c, cls, t) => { const e = $(`[data-c=${c}]`); e.classList.remove('ok', 'no', 'down'); cls && e.classList.add(cls); e.querySelector('.st').textContent = t; };
async function contar(acta) {
  // Un voto cuenta si: es de una célula del grupo, su firma verifica y habla de ESTE informe y ESTA raíz.
  const detalle = []; let si = 0, no = 0;
  for (const v of acta.votos) {
    const g = acta.grupo.find(x => x.celula === v.voto.celula && x.fp === v.voto.fp);
    let ok = !!g && await sha(canon(v.voto)) === v.hash;
    if (ok) { try { const k = await crypto.subtle.importKey('jwk', { ...g.jwk, ext: true }, ALG, true, ['verify']); ok = await crypto.subtle.verify(SIG, k, unhex(v.firma), enc.encode(v.hash)); } catch { ok = false; } }
    const mismo = v.voto.informe_hash === acta.informe.hash && v.voto.raiz === acta.raiz;
    detalle.push({ celula: v.voto.celula, firma_ok: ok, veredicto: v.voto.veredicto });
    if (ok && mismo && v.voto.veredicto === 'verifica') si++; else if (ok) no++;
  }
  const valido = si >= 2 && detalle.every(d => d.firma_ok);
  return { valido, si, no, votos: acta.votos.length, detalle, texto: valido ? `Quórum 2 de 3 ✓ · ${si} verifican` : acta.votos.length < 2 ? `Sin quórum ✗ · solo ${acta.votos.length} célula(s) respondieron` : `Sin quórum ✗ · rechazado (${si} verifica, ${no} rechaza)` };
}
async function votar(paq) {
  $('#bEnviar').disabled = true;
  const { man, piezas } = await partir(paq);
  const votos = [];
  await Promise.all(CELS.map(async c => {
    const cel = $(`[data-c=${c}]`);
    if (cel.querySelector('[data-down]').checked) { estado(c, 'down', 'caída'); return; }
    estado(c, null, 'revisando…');
    const r = await pedir(c, { t: 'verificar', man, piezas, mentir: cel.querySelector('[data-miente]').checked });
    votos.push({ voto: r.voto, hash: r.hash, firma: r.firma });
    estado(c, r.voto.veredicto === 'verifica' ? 'ok' : 'no', r.voto.veredicto === 'verifica' ? 'votó ✓' : 'votó ✗');
  }));
  votos.sort((a, b) => a.voto.celula.localeCompare(b.voto.celula));
  ACTA = { formato: 'phenom-quorum-acta-v1', aviso: 'Versión de prueba · datos de ejemplo · mismo dispositivo, no son 3 teléfonos', regla: '2 de 3', informe: paq, raiz: man.raiz, piezas: man.n, grupo: CELS.map(c => GRUPO[c]), votos };
  const q = await contar(ACTA); ACTA.resultado = q.valido ? 'quorum' : 'sin-quorum';
  const ch = $('#qChip'); ch.textContent = q.valido ? 'Quórum 2 de 3 ✓' : 'Sin quórum ✗'; ch.className = 'chip ' + (q.valido ? 'ok' : 'bad');
  $('#qInfo').textContent = q.texto + ' · ' + votos.map(v => `${v.voto.celula}: ${v.voto.motivo}`).join(' · ');
  pintarActa(q); $('#bEnviar').disabled = false; window.phenomQuorum.ultimo = q;
  return q;
}
function pintarActa(q) {
  const c = $('#aChip'); c.textContent = q.valido ? 'Quórum 2 de 3 ✓' : 'Sin quórum ✗'; c.className = 'chip ' + (q.valido ? 'ok' : 'bad');
  const d = ACTA.informe.env.datos;
  $('[data-p=s]').innerHTML = `<p>${esc(d.tipo)}: ${q.valido ? 'aceptado por quórum' : 'no aceptado'}.</p><p class="muted">${esc(q.texto)}</p>`;
  $('[data-p=d]').innerHTML = '<dl class="kv">' + ACTA.grupo.map(g => { const v = ACTA.votos.find(x => x.voto.celula === g.celula); return `<dt>Célula ${g.celula}<br><span class="fp">${g.fp}</span></dt><dd>${v ? (v.voto.veredicto === 'verifica' ? '✓ verifica' : '✗ rechaza') + ' · ' + esc(v.voto.motivo) : 'caída · sin voto'}</dd>`; }).join('') + `<dt>Huella del informe</dt><dd>${ACTA.informe.hash}</dd><dt>Huella raíz</dt><dd>${ACTA.raiz} (${ACTA.piezas} piezas)</dd><dt>Emisor</dt><dd class="fp">${ACTA.informe.env.emisor.fp}</dd></dl>`;
  $('[data-p=b]').innerHTML = '<pre>' + esc(JSON.stringify(ACTA, null, 2)) + '</pre>';
  $('#bExport').disabled = false;
}
$('#bExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(ACTA, null, 2)], { type: 'application/json' })); a.download = 'acta-quorum.json'; document.body.appendChild(a); a.click(); a.remove(); };
$$('[role=tab]').forEach(t => t.onclick = () => { $$('[role=tab]').forEach(x => x.setAttribute('aria-selected', x === t)); $$('[data-p]').forEach(v => v.hidden = v.dataset.p !== t.dataset.t); });

// ---------- Botones ----------
const marcar = (down, miente) => CELS.forEach(c => { $(`[data-c=${c}] [data-down]`).checked = down.includes(c); $(`[data-c=${c}] [data-miente]`).checked = miente.includes(c); estado(c, null, 'en espera'); });
$('#bSellar').onclick = async () => { PAQ = await sellar(); $('#bEnviar').disabled = false; $('#qInfo').textContent = 'Informe sellado. Huella ' + PAQ.hash.slice(0, 12) + '… Pulsa Enviar al grupo.'; toast('Sellado'); };
$('#bEnviar').onclick = () => votar(PAQ);
const nuevo = async (down, miente) => { marcar(down, miente); PAQ = await sellar(); return votar(PAQ); };
$('#tUna').onclick = () => nuevo(['C'], []);
$('#tDos').onclick = () => nuevo(['B', 'C'], []);
$('#tMiente').onclick = async () => { marcar([], ['A']); PAQ = await sellar(); const p = JSON.parse(JSON.stringify(PAQ)); if (p.env.datos.avance !== undefined) p.env.datos.avance = 100; else p.env.datos.anos = 10; return votar(p); };
$('#tAlterar').onclick = async () => { marcar([], []); PAQ = await sellar(); const p = JSON.parse(JSON.stringify(PAQ)); if (p.env.datos.avance !== undefined) p.env.datos.avance = 100; else p.env.datos.anos = 10; return votar(p); };
$('#tRepetir').onclick = () => { if (!PAQ) return toast('Primero sella y envía'); marcar([], []); return votar(PAQ); };
$('#tRevocar').onclick = async () => { await todas({ t: 'revocar', fp: EM.fp }); return nuevo([], []); };
$('#tReset').onclick = async () => { await todas({ t: 'borrar' }); await todas({ t: 'confiar', fp: EM.fp }); marcar([], []); $('#qChip').textContent = 'Sin votación'; $('#qChip').className = 'chip'; toast('Restablecido'); };
$$('[data-tipo]').forEach(b => b.onclick = () => { TIPO = b.dataset.tipo; $$('[data-tipo]').forEach(x => x.setAttribute('aria-pressed', x === b)); });

$('#faltaLista').innerHTML = ['Probar las 3 células en 3 teléfonos reales (o 3 organizaciones distintas).', 'Recalcular en el servidor (recompute) para atrapar a 2 células de acuerdo para mentir.', 'Marcar a la célula que discrepa (reputación), como en quorum.md.', 'Lista de revocación compartida (hoy cada célula tiene la suya).', 'Revisión legal del acta.', 'Pilotos con 2–3 clientes.'].map(x => `<li><p>${x}</p></li>`).join('');

// ---------- Navegación ----------
function ir() { const h = (location.hash || '#grupo').slice(1); const s = $(`[data-screen="${h}"]`) ? h : 'grupo'; $$('[data-screen]').forEach(x => x.hidden = x.dataset.screen !== s); $('#nav').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); scrollTo(0, 0); }
addEventListener('hashchange', ir);
$('#menuBtn').onclick = () => { const n = $('#nav'); n.hidden = !n.hidden; $('#menuBtn').setAttribute('aria-expanded', String(!n.hidden)); };
ir();
window.phenomQuorum = { sha, canon, contar, acta: () => ACTA, listo: (async () => { await cargarEmisor(); await Promise.all(CELS.map(crearCelula)); await todas({ t: 'confiar', fp: EM.fp }); return true; })() };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
