(() => {
'use strict';
// Simulación de prueba. Ninguna petición sale del navegador. Sin relación con la MTA ni con OMNY.
const $ = id => document.getElementById(id);
const el = (t, x, c) => { const e = document.createElement(t); if (x != null) e.textContent = x; if (c) e.className = c; return e; };
const kv = (dl, rows) => { dl.textContent = ''; rows.forEach(([k, v]) => dl.append(el('dt', k), el('dd', v))); };
const toast = t => { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 2000); };
const te = new TextEncoder(), S = crypto.subtle;
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await S.digest('SHA-256', te.encode(s)));
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const BASE = Date.UTC(2026, 10, 2, 5, 0); // día simulado: 2 nov 2026, 00:00 hora de NY (UTC-5)
const hhmm = h => String(h).padStart(2, '0') + ':00';

/* estado */
const ST = { emisor: null, falso: null, pub: null, usados: {}, ultimoValido: null, cadena: [], subidos: 0, verif: null };
for (let h = 5; h <= 23; h++) { const o = el('option', hhmm(h)); o.value = h; if (h === 8) o.selected = true; $('hora').append(o); }
const ahora = () => BASE + Number($('hora').value) * 3600e3;

/* emisor: firma pases cortos sin datos personales */
async function emitir(key, expDelta) {
  const p = { v: 1, id: hex(crypto.getRandomValues(new Uint8Array(6))), exp: ahora() + expDelta, usos: 1 };
  const s = await S.sign(SIG, key, te.encode(JSON.stringify(p)));
  return { p, s: b64u(s) };
}
/* torniquete: solo tiene la clave pública; no necesita internet */
async function verificar(tok) {
  let firma = false;
  try { firma = await S.verify(SIG, ST.pub, unb64u(tok.s), te.encode(JSON.stringify(tok.p))); } catch (e) { firma = false; }
  if (!firma) return ['rechaza', 'Firma no válida (falsificado o alterado)'];
  if (tok.p.exp < ahora()) return ['rechaza', 'Pase caducado'];
  if ((ST.usados[tok.p.id] || 0) >= tok.p.usos) return ['rechaza', 'Pase ya usado (copia)'];
  ST.usados[tok.p.id] = (ST.usados[tok.p.id] || 0) + 1;
  return ['abre', 'Firma válida, vigente, primer uso'];
}
async function caso(c) {
  let tok;
  if (c === 'valido') tok = await emitir(ST.emisor.privateKey, 2 * 3600e3);
  if (c === 'caducado') tok = await emitir(ST.emisor.privateKey, -10 * 60e3);
  if (c === 'falso') tok = await emitir(ST.falso.privateKey, 2 * 3600e3);
  if (c === 'alterado') { tok = await emitir(ST.emisor.privateKey, -10 * 60e3); tok.p.exp += 24 * 3600e3; }
  if (c === 'copia') { if (!ST.ultimoValido) await tocar(await emitir(ST.emisor.privateKey, 2 * 3600e3), 'valido'); tok = JSON.parse(JSON.stringify(ST.ultimoValido)); }
  return tocar(tok, c);
}
async function tocar(tok, c) {
  const [res, motivo] = await verificar(tok);
  if (res === 'abre') ST.ultimoValido = tok;
  const prev = ST.cadena.length ? ST.cadena[ST.cadena.length - 1].hash : '0'.repeat(64);
  const r = { n: ST.cadena.length + 1, est: $('est').value, hora: hhmm($('hora').value), pase: tok.p.id, res, motivo, caso: c, prev };
  r.hash = await sha(canon(r)); r.token = tok;
  ST.cadena.push(r); ST.verif = null;
  return r;
}
const canon = r => r.prev + '|' + JSON.stringify([r.n, r.est, r.hora, r.pase, r.res, r.motivo]);
async function verificarCadena() {
  let prev = '0'.repeat(64);
  for (const r of ST.cadena) { if (r.prev !== prev || await sha(canon(Object.assign({}, r, { prev }))) !== r.hash) return r.n; prev = r.hash; }
  return 0;
}

/* pantallas */
const SCREENS = ['inicio', 'torniquete', 'cadena', 'toque', 'zonas', 'limites', 'investigacion'];
function render() {
  let h = (location.hash || '').slice(1); if (!SCREENS.includes(h)) h = 'inicio';
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.dataset.screen !== h);
  menu(false);
  if (h === 'torniquete') drawCola(); if (h === 'cadena') drawCadena(); if (h === 'toque') drawToque(); if (h === 'zonas') drawZonas();
  const t = document.querySelector('.screen:not([hidden]) h1'); document.title = (t ? t.textContent : 'Torniquete') + ' · simulación';
  window.scrollTo(0, 0);
}
function menu(on) { $('nav').hidden = !on; $('menuBtn').setAttribute('aria-expanded', on); }
function gate(r) {
  $('gate').className = 'gate ' + (r.res === 'abre' ? 'ok' : 'bad');
  $('gateTxt').textContent = r.res === 'abre' ? 'Abre ✓' : 'Rechazado ✗';
  $('gateWhy').textContent = r.motivo + ' · toque #' + r.n + ' anotado en la cadena';
}
function drawCola() {
  const pend = ST.cadena.length - ST.subidos;
  kv($('cola'), [['Toques', String(ST.cadena.length)], ['Pendientes de subir', String(pend)], ['Conexión', navigator.onLine ? 'En línea' : 'Sin internet: el torniquete sigue verificando']]);
}
function drawCadena() {
  const c = $('chChip');
  c.className = 'chip' + (ST.verif === 0 ? ' ok' : ST.verif ? ' bad' : '');
  c.textContent = !ST.cadena.length ? 'Sin toques' : ST.verif === 0 ? 'Verificado ✓ · ' + ST.cadena.length + ' toques' : ST.verif ? 'ROTA ✗ en el toque #' + ST.verif : 'Sin verificar';
  const ol = $('log'); ol.textContent = '';
  ST.cadena.slice(-12).reverse().forEach(r => { const li = el('li'); const a = el('span', '#' + r.n + ' ' + r.est.replace('Estación ', '') + ' ' + r.hora + ' · ' + (r.res === 'abre' ? 'abre' : 'rechaza')); li.append(a, el('code', r.hash.slice(0, 10) + '…')); ol.append(li); });
  $('btnTamper').disabled = !ST.cadena.length;
}
let vista = 'simple';
function drawToque() {
  const r = ST.cadena[ST.cadena.length - 1], s = $('vSimple'); s.textContent = '';
  if (!r) { $('tTitle').textContent = 'Sin toques todavía'; s.append(el('p', 'Ve al torniquete y toca un pase.')); kv($('vDet'), []); $('tJson').textContent = '—'; return; }
  $('tTitle').textContent = 'Toque #' + r.n + (r.res === 'abre' ? ' · abrió' : ' · rechazado');
  s.append(el('p', 'En ' + r.est + ' a las ' + r.hora + ', el torniquete ' + (r.res === 'abre' ? 'abrió' : 'no abrió') + ': ' + r.motivo.toLowerCase() + '.'));
  s.append(el('p', 'El pase no lleva nombre ni tarjeta, solo un número al azar.', 'muted'));
  kv($('vDet'), [['Estación', r.est], ['Hora', r.hora], ['Pase', r.pase], ['Vence', new Date(r.token.p.exp).toISOString().slice(11, 16) + ' UTC'], ['Usos', String(r.token.p.usos)], ['Resultado', r.res], ['Motivo', r.motivo], ['Anterior', r.prev.slice(0, 16) + '…'], ['Huella', r.hash.slice(0, 16) + '…']]);
  $('tJson').textContent = JSON.stringify({ toque: { n: r.n, est: r.est, hora: r.hora, pase: r.pase, res: r.res, motivo: r.motivo, prev: r.prev, hash: r.hash }, pase: r.token }, null, 2);
}
function zonas() {
  const m = {};
  ST.cadena.forEach(r => { const k = r.est + '|' + r.hora; m[k] = m[k] || { est: r.est, hora: r.hora, tot: 0, rech: 0 }; m[k].tot++; if (r.res === 'rechaza') m[k].rech++; });
  return Object.values(m).filter(z => z.rech).sort((a, b) => b.rech - a.rech || a.hora.localeCompare(b.hora));
}
function drawZonas() {
  const z = zonas(), box = $('zonas'); box.textContent = '';
  if (!z.length) { box.append(el('p', 'Sin rechazos todavía. Genera toques de ejemplo en el torniquete.', 'muted')); return; }
  const t = el('table'), hd = el('tr'); ['Estación', 'Hora', 'Rechazos', 'Toques', ''].forEach(x => hd.append(el('th', x))); t.append(hd);
  z.slice(0, 8).forEach(x => { const tr = el('tr'); const hot = x.rech >= 3; [x.est.replace('Estación ', ''), x.hora, String(x.rech), String(x.tot), hot ? 'Revisar' : ''].forEach((v, i) => tr.append(el('td', v, i === 4 && hot ? 'hot' : ''))); t.append(tr); });
  box.append(t);
}

/* lote de ejemplo determinista (no son datos reales) */
async function lote() {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ests = ['Estación Norte', 'Estación Centro', 'Estación Sur', 'Estación Este'], casos = ['valido', 'valido', 'valido', 'caducado', 'copia', 'falso', 'alterado'];
  const e0 = $('est').value, h0 = $('hora').value;
  for (let i = 0; i < 40; i++) {
    const foco = rnd() < .3; $('est').value = foco ? 'Estación Centro' : ests[Math.floor(rnd() * 4)]; $('hora').value = foco ? 8 : 6 + Math.floor(rnd() * 14);
    await caso(foco && rnd() < .8 ? casos[3 + Math.floor(rnd() * 4)] : casos[Math.floor(rnd() * casos.length)]);
  }
  $('est').value = e0; $('hora').value = h0; gate(ST.cadena[ST.cadena.length - 1]); drawCola(); toast('40 toques de ejemplo anotados');
}

/* eventos */
$('menuBtn').addEventListener('click', () => menu($('nav').hidden));
addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
document.querySelectorAll('#casos button').forEach(b => b.addEventListener('click', async () => { const r = await caso(b.dataset.c); gate(r); drawCola(); }));
$('btnLote').addEventListener('click', lote);
$('btnSubir').addEventListener('click', () => { if (!navigator.onLine) { toast('Sin internet: el registro queda en cola'); return; } ST.subidos = ST.cadena.length; drawCola(); toast('Subida simulada: no se envía nada real'); });
$('btnVer').addEventListener('click', async () => { ST.verif = ST.cadena.length ? await verificarCadena() : null; drawCadena(); });
$('btnTamper').addEventListener('click', () => { const r = ST.cadena.find(x => x.res === 'rechaza') || ST.cadena[0]; if (!r) return; r.res = r.res === 'abre' ? 'rechaza' : 'abre'; ST.verif = null; drawCadena(); toast('Toque #' + r.n + ' cambiado (prueba). Pulsa Verificar.'); });
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { vista = b.dataset.v; document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); $('vSimple').hidden = vista !== 'simple'; $('vDet').hidden = vista !== 'detallado'; $('vBruto').hidden = vista !== 'bruto'; }));
addEventListener('hashchange', render); addEventListener('online', render); addEventListener('offline', render);

(async () => {
  ST.emisor = await S.generateKey(ALG, false, ['sign', 'verify']);
  ST.falso = await S.generateKey(ALG, false, ['sign', 'verify']);
  ST.pub = ST.emisor.publicKey; // lo único que el torniquete necesita
  window.T = { ST, caso, verificarCadena, zonas, listo: true };
})();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
