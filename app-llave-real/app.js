'use strict';
// Phenom · La llave real (VERSIÓN DE PRUEBA). Todo ocurre en este navegador. Datos y llaves de ejemplo.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const LS = { conf: 'phenom_llave_confianza_v1', rev: 'phenom_llave_revocadas_v1', vistos: 'phenom_llave_nonces_v1', vistosR: 'phenom_llave_nonces_receptor_v1' };
const lget = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const lset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 1600); };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ---------- La llave: guardada en IndexedDB, privada NO exportable ----------
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-llave-real', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise(ok => { const r = db.transaction('k').objectStore('k').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise(ok => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }
const pubOf = async pk => { const j = await crypto.subtle.exportKey('jwk', pk); return { crv: j.crv, kty: j.kty, x: j.x, y: j.y }; };
const huella = async jwk => (await sha(canon(jwk))).slice(0, 16).match(/..../g).join(' ');
async function nuevaLlave() { const kp = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']); const jwk = await pubOf(kp.publicKey); return { kp, jwk, fp: await huella(jwk) }; }
let EMISOR = null;
async function cargarEmisor(forzar) {
  let kp = forzar ? null : await idbGet('emisor').catch(() => null);
  if (kp && kp.privateKey) { const jwk = await pubOf(kp.publicKey); EMISOR = { kp, jwk, fp: await huella(jwk) }; }
  else { EMISOR = await nuevaLlave(); await idbPut('emisor', EMISOR.kp).catch(() => {}); }
  const c = lget(LS.conf); if (!c.some(x => x.fp === EMISOR.fp)) { c.push({ fp: EMISOR.fp, jwk: EMISOR.jwk, nombre: 'Emisor de este dispositivo' }); lset(LS.conf, c); }
  pintarLlaves();
}

// ---------- Sellar ----------
async function sellar(datos, llave) {
  const env = { app: 'phenom-llave-real-prueba', datos, emisor: { fp: llave.fp, jwk: llave.jwk }, nonce: hex(crypto.getRandomValues(new Uint8Array(16))), ts: new Date().toISOString() };
  const h = await sha(canon(env));
  const sig = hex(await crypto.subtle.sign(SIG, llave.kp.privateKey, enc.encode(h)));
  return { env, hash: h, firma: sig };
}

// ---------- Verificar (receptor) ----------
async function verificar(paq, vistosKey) {
  const r = { pasos: [], ok: false };
  const paso = (n, ok, d) => { r.pasos.push({ n, ok, d }); return ok; };
  const h = await sha(canon(paq.env));
  if (!paso('Huella del documento', h === paq.hash, h === paq.hash ? 'coincide' : 'no coincide: el documento cambió')) return fin(r, 'El documento cambió después de sellarse.');
  let firmaOk = false;
  try { const pk = await crypto.subtle.importKey('jwk', { ...paq.env.emisor.jwk, ext: true }, ALG, true, ['verify']); firmaOk = await crypto.subtle.verify(SIG, pk, unhex(paq.firma), enc.encode(paq.hash)); } catch { firmaOk = false; }
  if (!paso('Firma', firmaOk, firmaOk ? 'válida' : 'no válida')) return fin(r, 'La firma no es válida.');
  const fp = await huella(paq.env.emisor.jwk);
  if (!paso('Huella de la llave', fp === paq.env.emisor.fp, fp)) return fin(r, 'La huella de la llave no corresponde.');
  if (lget(LS.rev).includes(fp)) { paso('Llave revocada', false, fp); return fin(r, 'Llave revocada: se rechaza.'); }
  paso('Llave revocada', true, 'no');
  if (!paso('Llave conocida', lget(LS.conf).some(x => x.fp === fp), fp)) return fin(r, 'Llave desconocida: no está en el llavero.');
  const vistos = lget(vistosKey);
  if (!paso('Repetición (nonce)', !vistos.includes(paq.env.nonce), paq.env.nonce)) return fin(r, 'Repetición: este paquete ya se recibió.');
  vistos.push(paq.env.nonce); lset(vistosKey, vistos.slice(-500));
  r.ok = true; return fin(r, 'Todo coincide.');
}
const fin = (r, m) => (r.msg = m, r);

// ---------- Teleport: piezas + huella raíz ----------
const TAM = 160;
async function partir(paq) {
  const b = enc.encode(JSON.stringify(paq)), piezas = [];
  for (let i = 0; i < b.length; i += TAM) { const p = b.slice(i, i + TAM); piezas.push({ i: piezas.length, d: btoa(String.fromCharCode(...p)), h: await sha(p) }); }
  return { id: hex(crypto.getRandomValues(new Uint8Array(8))), n: piezas.length, hashes: piezas.map(p => p.h), raiz: await sha(piezas.map(p => p.h).join('')), piezas };
}
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function armar(man, recibidas) {
  const r = await sha(man.hashes.join(''));
  if (r !== man.raiz) return { ok: false, msg: 'Huella raíz no coincide' };
  const partes = [];
  for (let i = 0; i < man.n; i++) { const p = recibidas[i]; if (!p) return { ok: false, msg: 'Falta la pieza ' + (i + 1) }; const b = b64(p.d); if (await sha(b) !== man.hashes[i]) return { ok: false, msg: 'Pieza ' + (i + 1) + ' alterada' }; partes.push(b); }
  const all = new Uint8Array(partes.reduce((a, b) => a + b.length, 0)); let o = 0; partes.forEach(b => { all.set(b, o); o += b.length; });
  return { ok: true, paq: JSON.parse(dec.decode(all)), raiz: r };
}
const bc = 'BroadcastChannel' in self ? new BroadcastChannel('phenom-llave-real') : null;

// ---------- Flujo ----------
let TIPO = 'obra', PAQ = null, MAN = null, RECIB = {}, RECIBIDO = null, ULT = null;
const ST = { enviadas: 0, perdidas: 0, reenviadas: 0 };
function elegir(t) {
  TIPO = t; $$('[data-tipo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tipo === t));
  $$('[data-solo]').forEach(d => d.hidden = d.dataset.solo !== t);
  $('#fTitulo').textContent = t === 'obra' ? 'Informe de obra.' : 'Garantía de techo.';
  $('#fTipoLbl').textContent = (t === 'obra' ? 'Informe de obra' : 'Certificado de garantía de techo') + ' · datos de ejemplo';
  reset();
}
function reset() { PAQ = MAN = RECIBIDO = null; RECIB = {}; $('#bEnviar').disabled = $('#bVerificar').disabled = true; $('#aCambiar').disabled = $('#aRepetir').disabled = $('#aRevocada').disabled = true; $('#envio').hidden = $('#res').hidden = true; $('#fEstado').textContent = 'Llena el formulario y pulsa Sellar.'; }
async function datosForm() {
  const fotos = [];
  for (const f of $('#fFotos').files) fotos.push({ nombre: f.name, bytes: f.size, sha256: await sha(await f.arrayBuffer()) });
  const v = id => $(id).value.trim();
  return TIPO === 'obra'
    ? { tipo: 'Informe de obra', obra: v('#oObra'), inspector: v('#oInsp'), avance: Number(v('#oAvance')), nota: v('#oNota'), fotos }
    : { tipo: 'Garantía de techo', cliente: v('#tCli'), trabajo: v('#tTrab'), anos: Number(v('#tAnos')), fecha: v('#tFecha'), fotos };
}
$('#bSellar').onclick = async () => {
  reset(); PAQ = await sellar(await datosForm(), EMISOR);
  $('#bEnviar').disabled = false; $('#aRevocada').disabled = false; $('#envio').hidden = false; $('#piezas').innerHTML = ''; $('#envInfo').textContent = 'Listo para enviar. Puedes cortar la conexión para probar.'; $('#bReenviar').hidden = true;
  $('#fEstado').textContent = 'Sellado. Huella ' + PAQ.hash.slice(0, 12) + '…  Ahora pulsa Enviar.'; toast('Sellado');
};
function pintarPiezas() {
  $('#piezas').innerHTML = MAN.piezas.map(p => `<span class="pz ${RECIB[p.i] ? 'ok' : (p.perdida ? 'lost' : '')} ${p.re ? 're' : ''}" data-i="${p.i}" title="Pieza ${p.i + 1}">${p.i + 1}</span>`).join('');
  const f = MAN.n - Object.keys(RECIB).length;
  $('#envInfo').textContent = `${MAN.n} piezas · enviadas ${ST.enviadas} · perdidas ${ST.perdidas} · reenviadas ${ST.reenviadas} · faltan ${f}`;
  $('#bReenviar').hidden = f === 0;
}
const pausa = ms => new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));
async function mandar(lista, re) {
  for (const p of lista) {
    ST.enviadas++; if (re) { ST.reenviadas++; p.re = true; }
    // Enlace simulado: con "Cortar conexión" se pierde 1 de cada 3 piezas (patrón fijo para poder probarlo).
    const pierde = $('#cortar').checked && p.i % 3 === 1;
    if (pierde) { p.perdida = true; ST.perdidas++; } else { p.perdida = false; RECIB[p.i] = { i: p.i, d: p.d }; bc && bc.postMessage({ t: 'pieza', id: MAN.id, p: { i: p.i, d: p.d } }); }
    pintarPiezas(); await pausa(60);
  }
  const f = MAN.n - Object.keys(RECIB).length;
  if (f === 0) { const a = await armar(MAN, RECIB); RECIBIDO = a.ok ? a.paq : null; $('#bVerificar').disabled = !a.ok; $('#aCambiar').disabled = $('#aRepetir').disabled = !a.ok; $('#fEstado').textContent = a.ok ? 'Llegaron todas las piezas. Huella raíz coincide. Pulsa Verificar.' : a.msg; }
  else $('#fEstado').textContent = `Faltan ${f} piezas. Pulsa "Reenviar solo las que faltan" (puedes apagar "Cortar conexión").`;
}
$('#bEnviar').onclick = async () => {
  MAN = await partir(PAQ); RECIB = {}; Object.assign(ST, { enviadas: 0, perdidas: 0, reenviadas: 0 });
  $('#envio').hidden = false; $('#res').hidden = true; $('#bVerificar').disabled = true;
  bc && bc.postMessage({ t: 'manifiesto', m: { id: MAN.id, n: MAN.n, hashes: MAN.hashes, raiz: MAN.raiz } });
  await mandar(MAN.piezas, false);
};
$('#bReenviar').onclick = () => mandar(MAN.piezas.filter(p => !RECIB[p.i]), true);
async function mostrar(paq, r) {
  ULT = { paq, r }; $('#res').hidden = false;
  const c = $('#resChip'); c.textContent = r.ok ? 'Verificado ✓' : 'ROTA ✗'; c.className = 'chip ' + (r.ok ? 'ok' : 'bad');
  const d = paq.env.datos;
  const resumen = d.tipo === 'Informe de obra' ? `${esc(d.inspector)} informa ${d.avance}% de avance en «${esc(d.obra)}».` : `${esc(d.cliente)}: ${d.anos} años de garantía desde ${esc(d.fecha)} · ${esc(d.trabajo)}.`;
  $('[data-p=s]').innerHTML = `<p>${resumen}</p><p class="muted">${esc(r.msg)}</p>`;
  $('[data-p=d]').innerHTML = '<dl class="kv">' + r.pasos.map(p => `<dt>${p.ok ? '✓' : '✗'} ${esc(p.n)}</dt><dd>${esc(p.d)}</dd>`).join('') + `<dt>Huella raíz</dt><dd>${MAN ? MAN.raiz : '—'}</dd><dt>Piezas</dt><dd>${MAN ? MAN.n : '—'}</dd></dl>`;
  $('[data-p=b]').innerHTML = '<pre>' + esc(JSON.stringify(paq, null, 2)) + '</pre>';
}
$('#bVerificar').onclick = async () => { const r = await verificar(RECIBIDO, LS.vistos); await mostrar(RECIBIDO, r); toast(r.ok ? 'Verificado' : 'Rechazado'); };
$('#aCambiar').onclick = async () => {
  const p = JSON.parse(JSON.stringify(RECIBIDO)); if (p.env.datos.tipo === 'Informe de obra') p.env.datos.avance = 100; else p.env.datos.anos = 10;
  await mostrar(p, await verificar(p, LS.vistos));
};
$('#aRepetir').onclick = async () => { const r1 = await verificar(RECIBIDO, LS.vistos); await mostrar(RECIBIDO, r1.ok ? await verificar(RECIBIDO, LS.vistos) : r1); };
$('#aDesconocida').onclick = async () => { const otra = await nuevaLlave(); const p = await sellar(await datosForm(), otra); await mostrar(p, await verificar(p, LS.vistos)); };
$('#aRevocada').onclick = async () => {
  const rv = lget(LS.rev); if (!rv.includes(EMISOR.fp)) rv.push(EMISOR.fp); lset(LS.rev, rv); pintarLlaves();
  const p = PAQ; await mostrar(p, await verificar(p, LS.vistos)); toast('Llave revocada');
};
$$('[role=tab]').forEach(t => t.onclick = () => { $$('[role=tab]').forEach(x => x.setAttribute('aria-selected', x === t)); $$('[data-p]').forEach(v => v.hidden = v.dataset.p !== t.dataset.t); });

// ---------- Receptor (otra pestaña, mismo dispositivo) ----------
let R = null;
bc && (bc.onmessage = async e => {
  if (location.hash !== '#receptor') return;
  const m = e.data;
  if (m.t === 'manifiesto') { R = { m: m.m, p: {} }; $('#rChip').textContent = 'Recibiendo…'; $('#rChip').className = 'chip'; $('#rBruto').textContent = ''; }
  if (m.t === 'pieza' && R && m.id === R.m.id) R.p[m.p.i] = m.p;
  if (!R) return;
  const k = Object.keys(R.p).length;
  $('#rPiezas').innerHTML = Array.from({ length: R.m.n }, (_, i) => `<span class="pz ${R.p[i] ? 'ok' : ''}">${i + 1}</span>`).join('');
  $('#rInfo').textContent = `Recibidas ${k} de ${R.m.n} piezas.`;
  if (k === R.m.n && !R.listo) {
    R.listo = true; const a = await armar(R.m, R.p);
    const v = a.ok ? await verificar(a.paq, LS.vistosR) : { ok: false, msg: a.msg };
    $('#rChip').textContent = v.ok ? 'Verificado ✓' : 'ROTA ✗'; $('#rChip').className = 'chip ' + (v.ok ? 'ok' : 'bad');
    $('#rInfo').textContent = `Recibidas ${k} de ${R.m.n} piezas. Huella raíz ${a.ok ? 'coincide' : 'NO coincide'}. ${v.msg}`;
    if (a.ok) $('#rBruto').textContent = JSON.stringify(a.paq.env.datos, null, 2);
  }
});

// ---------- Llaves ----------
function pintarLlaves() {
  if (!EMISOR) return;
  const rev = lget(LS.rev).includes(EMISOR.fp);
  $('#fFp').textContent = $('#kFp').textContent = EMISOR.fp;
  $('#kEstado').textContent = rev ? 'Revocada' : 'Activa · de confianza en este dispositivo';
  $('#kLista').innerHTML = lget(LS.conf).map(x => `<li><p class="fp">${x.fp}</p><p class="muted">${esc(x.nombre)}${lget(LS.rev).includes(x.fp) ? ' · revocada' : ''}</p></li>`).join('');
}
$('#kExport').onclick = () => { const p = $('#kPub'); p.hidden = false; p.textContent = JSON.stringify(EMISOR.jwk, null, 2); };
$('#kRevocar').onclick = () => { const rv = lget(LS.rev); if (!rv.includes(EMISOR.fp)) rv.push(EMISOR.fp); lset(LS.rev, rv); pintarLlaves(); toast('Llave revocada'); };
$('#kNueva').onclick = async () => { await cargarEmisor(true); reset(); toast('Llave nueva creada'); };

// ---------- Qué falta ----------
const FALTA = ['Probar entre dos teléfonos (WebRTC o servidor de relevo): no probado.', 'Respaldo y recuperación de la llave si se pierde el teléfono.', 'Lista de revocación compartida entre dispositivos (hoy es local).', 'Intercambio de llaves públicas en persona o por código QR.', 'Fotos reales de obra y techo con clientes piloto (2–3).', 'Revisión legal del valor del informe y del certificado.', 'Google Client ID y número de WhatsApp.', 'Dominio propio.', 'Precios: por definir.', 'Pagos: backend de Stripe (no hay pagos reales).', 'Clave maestra de invitaciones (hoy null).'];
const HECHO = ['Llave por emisor creada en el navegador (privada no exportable).', 'Llavero con revocación y rechazo de llaves desconocidas.', 'Anti-repetición con nonce.', 'Envío por piezas con huella raíz y reenvío solo de las que faltan.', 'Recepción en una segunda pestaña (mismo dispositivo).', 'Informe de obra y garantía de techo sellados.'];
$('#faltaLista').innerHTML = FALTA.map(x => `<li><p>${x}</p></li>`).join('');
$('#hechoLista').innerHTML = HECHO.map(x => `<li><p>${x}</p></li>`).join('');

// ---------- Navegación ----------
function ir() {
  const h = (location.hash || '#inicio').slice(1); const s = $(`[data-screen="${h}"]`) ? h : 'inicio';
  $$('[data-screen]').forEach(x => x.hidden = x.dataset.screen !== s);
  $('#nav').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); scrollTo(0, 0);
}
addEventListener('hashchange', ir);
$('#menuBtn').onclick = () => { const n = $('#nav'); n.hidden = !n.hidden; $('#menuBtn').setAttribute('aria-expanded', String(!n.hidden)); };
$$('#inicio [data-tipo], [data-screen=inicio] [data-tipo]').forEach(b => b.addEventListener('click', () => { location.hash = '#flujo'; }));
$$('[data-tipo]').forEach(b => b.addEventListener('click', () => elegir(b.dataset.tipo)));
ir(); elegir('obra');
window.phenomLlave = { sha, canon, ST, listo: cargarEmisor().then(() => true), estado: () => ({ man: MAN && { n: MAN.n, raiz: MAN.raiz }, ult: ULT && { ok: ULT.r.ok, msg: ULT.r.msg, hash: ULT.paq.hash, env: ULT.paq.env } }) };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
