// Phenom · Fácil (VERSIÓN DE PRUEBA, datos de ejemplo). Mismo motor que app-sobre: ECDSA P-256 no exportable, piezas con huella, firma de raíz.
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const LS = { conf: 'phenom_facil_confianza_v1', rev: 'phenom_facil_revocadas_v1', vistos: 'phenom_facil_nonces_v1', bandeja: 'phenom_facil_bandeja_v1', nombre: 'phenom_facil_nombre_v1' };
const lget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? (d === undefined ? [] : d) : v; } catch { return d === undefined ? [] : d; } };
const lset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 1600); };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const dormir = ms => new Promise(r => setTimeout(r, ms));
const BASE = location.origin + location.pathname;

// ---------- Codificación compacta: z = comprimido (deflate-raw), j = sin comprimir; base64url ----------
const b64u = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function codificar(obj) {
  const j = enc.encode(JSON.stringify(obj));
  if (window.CompressionStream) { try { const cs = new Blob([j]).stream().pipeThrough(new CompressionStream('deflate-raw')); return 'z' + b64u(new Uint8Array(await new Response(cs).arrayBuffer())); } catch {} }
  return 'j' + b64u(j);
}
async function decodificar(code) {
  const raw = unb64u(code.slice(1));
  if (code[0] === 'z') { const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return JSON.parse(await new Response(ds).text()); }
  if (code[0] === 'j') return JSON.parse(dec.decode(raw));
  throw new Error('formato');
}
// Acepta un enlace completo, "#s=…", "s=…" o el contenido de un archivo .phenom.
function extraer(t) { t = String(t || '').trim().replace(/\s+/g, ''); const m = t.match(/(?:^|#)([sat])=([A-Za-z0-9_-]+)$/); return m ? { kind: m[1], code: m[2] } : null; }

// ---------- Llave del teléfono (IndexedDB, privada NO exportable) ----------
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-facil', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise(ok => { const r = db.transaction('k').objectStore('k').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise(ok => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }
const pubOf = async pk => { const j = await crypto.subtle.exportKey('jwk', pk); return { crv: j.crv, kty: j.kty, x: j.x, y: j.y }; };
const huella = async jwk => (await sha(canon(jwk))).slice(0, 16).match(/..../g).join(' ');
async function nuevaLlave() { const kp = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']); const jwk = await pubOf(kp.publicKey); return { kp, jwk, fp: await huella(jwk) }; }
let YO = null;
const nombre = () => lget(LS.nombre, '') || ('Teléfono ' + (YO ? YO.fp.slice(0, 4) : ''));
async function cargarLlave() {
  const kp = await idbGet('yo').catch(() => null);
  if (kp && kp.privateKey) { const jwk = await pubOf(kp.publicKey); YO = { kp, jwk, fp: await huella(jwk) }; }
  else { YO = await nuevaLlave(); await idbPut('yo', YO.kp).catch(() => {}); }
  return true;
}
async function firmar(obj, llave) { const h = await sha(canon(obj)); return { hash: h, firma: hex(await crypto.subtle.sign(SIG, llave.kp.privateKey, enc.encode(h))) }; }
async function firmaOk(jwk, firma, h) { try { const pk = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, ALG, true, ['verify']); return await crypto.subtle.verify(SIG, pk, unhex(firma), enc.encode(h)); } catch { return false; } }
async function copiar(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado'); return true; }
  catch { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} a.remove(); toast(ok ? 'Copiado' : 'Selecciona el texto y cópialo'); return ok; }
}
function descargar(nombreArch, texto) { const u = URL.createObjectURL(new Blob([texto], { type: 'application/octet-stream' })); const a = document.createElement('a'); a.href = u; a.download = nombreArch; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
async function compartir(titulo, link, archivo) {
  // 1) archivo por el menú del teléfono, 2) enlace por el menú, 3) copiar. (iOS Safari a veces no comparte archivos.)
  if (archivo && navigator.canShare) { const f = new File([link], archivo, { type: 'text/plain' }); if (navigator.canShare({ files: [f] })) { try { await navigator.share({ title: titulo, files: [f] }); return 'archivo'; } catch (e) { if (e.name === 'AbortError') return 'cancelado'; } } }
  if (navigator.share) { try { await navigator.share({ title: titulo, text: titulo, url: link }); return 'enlace'; } catch (e) { if (e.name === 'AbortError') return 'cancelado'; } }
  await copiar(link); return 'copiado';
}
const TAM = 160;
async function sellar(datos, llave, n) {
  const env = { app: 'phenom-sobre-prueba', datos, emisor: { fp: llave.fp, jwk: llave.jwk, n }, nonce: hex(crypto.getRandomValues(new Uint8Array(16))), ts: new Date().toISOString() };
  const f = await firmar(env, llave); return { env, hash: f.hash, firma: f.firma };
}
async function crearSobre(paq, llave) {
  const b = enc.encode(JSON.stringify(paq)), piezas = [], hashes = [];
  for (let i = 0; i < b.length; i += TAM) { const p = b.slice(i, i + TAM); piezas.push(btoa(String.fromCharCode(...p))); hashes.push(await sha(p)); }
  const raiz = await sha(hashes.join(''));
  const firma_raiz = hex(await crypto.subtle.sign(SIG, llave.kp.privateKey, enc.encode(raiz)));
  return { k: 'sobre', v: 1, id: hex(crypto.getRandomValues(new Uint8Array(8))), n: piezas.length, raiz, hashes, piezas, firma_raiz };
}

// ---------- Estado y pantallas ----------
LS.hint = 'phenom_facil_hint_v1';
let PANT = 'inicio', DESPUES = null;
function ver(s) {
  PANT = s; $$('[data-s]').forEach(x => x.hidden = x.dataset.s !== s); $('#atras').hidden = s === 'inicio' || s === 'nombre'; scrollTo(0, 0);
  if (s === 'inicio') { $('#hola').textContent = 'Hola, ' + nombre(); const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone; $('#iosHint').hidden = !(ios && !lget(LS.hint, false)); }
  if (s === 'envios') pintarEnvios();
  if (s === 'ayuda') { $('#aNombre').textContent = nombre(); $('#aFp').textContent = YO ? YO.fp : ''; pintarLlavero(); }
  if (s === 'nombre') setTimeout(() => $('#nNombre').focus(), 50);
  if (s === 'enviar') preparar();
}
$('#atras').onclick = () => ver('inicio');
$('#iosOk').onclick = () => { lset(LS.hint, true); $('#iosHint').hidden = true; };
$('#fNombre').onsubmit = e => { e.preventDefault(); const n = $('#nNombre').value.trim().slice(0, 24); if (!n) return; lset(LS.nombre, n); const f = DESPUES; DESPUES = null; f ? f() : ver('inicio'); };
$('#aCambiar').onclick = () => { $('#nNombre').value = nombre(); DESPUES = () => ver('ayuda'); ver('nombre'); };
$('#bEnviar').onclick = () => ver('enviar');
$('#bRecibir').onclick = () => ver('recibir');
$('#bEnvios').onclick = () => ver('envios');
$('#bAyuda').onclick = () => ver('ayuda');
$('#avanzado').onchange = () => { localStorage.setItem('phenom_facil_avz_v1', $('#avanzado').checked ? '1' : ''); aplicarAvz(); };
const avz = () => !!localStorage.getItem('phenom_facil_avz_v1');
function aplicarAvz() { $('#avanzado').checked = avz(); $('#avz').hidden = !avz(); $('#rAv').hidden = !avz() || !ULT; }

// ---------- Enviar: se sella por adelantado para que el botón abra el menú de compartir al instante ----------
let TIPO = 'obra', FOTO = null, LISTO_ENV = null, SOBRE = null, SOBRE_LINK = '';
function datosForm() {
  const d = TIPO === 'obra' ? { tipo: 'obra', obra: $('#oObra').value, avance: Number($('#oAvance').value), nota: $('#oNota').value, ejemplo: true }
    : { tipo: 'techo', cliente: $('#tCli').value, trabajo: $('#tTrab').value, anos: Number($('#tAnos').value), ejemplo: true };
  if (FOTO) d.foto = FOTO; return d;
}
function elegir(t) { TIPO = t; $$('[data-tipo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === t))); $$('[data-solo]').forEach(d => d.hidden = d.dataset.solo !== t); preparar(); }
$$('[data-tipo]').forEach(b => b.onclick = () => elegir(b.dataset.tipo));
function preparar() { LISTO_ENV = (async () => { await LISTO; const paq = await sellar(datosForm(), YO, nombre()); const s = await crearSobre(paq, YO); return { s, paq, link: BASE + '#s=' + await codificar(s) }; })(); }
$('#fEnviar').oninput = e => { if (e.target.id !== 'eFoto') preparar(); };
$('#eFoto').onchange = async () => {
  const f = $('#eFoto').files[0]; if (!f) { FOTO = null; return preparar(); }
  const h = await sha(await f.arrayBuffer()); FOTO = { sello: h, bytes: f.size, tipo: f.type || 'imagen' };
  $('#eFotoInfo').textContent = 'Foto lista (' + Math.round(f.size / 1024) + ' KB). No viaja: solo su sello.'; preparar();
};
let MODO = '';
$('#fEnviar').onsubmit = async e => {
  e.preventDefault(); const x = await LISTO_ENV; SOBRE = x.s; SOBRE_LINK = x.link;
  envioAdd({ id: SOBRE.id, dir: 'enviado', tipo: x.paq.env.datos.tipo, hash: x.paq.hash, raiz: SOBRE.raiz, ts: x.paq.env.ts, estado: 'Enviado' });
  MODO = await compartir('Envío Phenom (prueba) de ' + nombre(), SOBRE_LINK, 'envio-' + SOBRE.id + '.phenom');
  $('#eModo').textContent = { archivo: 'Se compartió como archivo.', enlace: 'Se compartió el enlace.', copiado: 'Tu teléfono no abrió el menú de compartir: el enlace quedó copiado. Pégalo en un chat o descarga el archivo.', cancelado: 'No se compartió. Toca «Compartir otra vez».' }[MODO] || '';
  window.phenomFacil.modo = MODO; ver('enviado'); preparar();
};
$('#eOtra').onclick = async () => { $('#eModo').textContent = 'Resultado: ' + await compartir('Envío Phenom (prueba) de ' + nombre(), SOBRE_LINK, 'envio-' + SOBRE.id + '.phenom'); };
$('#eCopiar').onclick = () => copiar(SOBRE_LINK);
$('#eArchivo').onclick = () => descargar('envio-' + SOBRE.id + '.phenom', SOBRE_LINK);

// ---------- Recibir ----------
let ULT = null, ACUSE = null, PEND = null;
const TIPOS = { obra: 'Informe de obra', techo: 'Garantía de techo' };
async function abrirTexto(t) {
  await LISTO; ver('res'); ['#rConfiar', '#rConfirmar'].forEach(s => $(s).hidden = true); ULT = null; ACUSE = null;
  const e = extraer(t);
  if (!e) return mostrar({ ok: false, big: 'No se reconoce', msg: 'Esto no es un envío de Phenom, o está incompleto. Pide que te lo manden otra vez.', pasos: [{ n: 'Formato', ok: false, d: 'no se reconoce' }] });
  let o; try { o = await decodificar(e.code); } catch { return mostrar({ ok: false, big: 'Llegó cortado ✗', msg: 'El enlace llegó incompleto (el chat lo cortó). Pide que te lo envíen como archivo.', pasos: [{ n: 'Completo', ok: false, d: e.code.length + ' caracteres, cortado' }] }); }
  if (e.kind === 's' && o.k === 'sobre') return abrirSobre(o, t);
  if (e.kind === 'a' && o.k === 'acuse') return abrirAcuse(o, t);
  mostrar({ ok: false, big: 'No se reconoce', msg: 'Contenido no reconocido.', pasos: [] });
}
function pedirConfianza(n, fp, jwk, t) {
  PEND = { n, fp, jwk, t }; $('#rConfiarQ').textContent = 'Es de ' + n + '. ¿Confiar?'; $('#rFp').textContent = fp; $('#rConfiar').hidden = false;
}
$('#rSi').onclick = () => { const c = lget(LS.conf); if (!c.some(x => x.fp === PEND.fp)) c.push({ fp: PEND.fp, jwk: PEND.jwk, n: PEND.n }); lset(LS.conf, c); abrirTexto(PEND.t); };
$('#rNo').onclick = () => ver('inicio');
async function abrirSobre(s, t) {
  const r = { pasos: [], ok: false, big: 'Cambió ✗' }; const paso = (n, ok, d) => { r.pasos.push({ n, ok, d }); return ok; };
  const fin = m => { r.msg = m; return terminar(s, r); };
  if (!paso('Lista de partes', await sha((s.hashes || []).join('')) === s.raiz && (s.hashes || []).length === s.n, s.n + ' partes')) return fin('La lista de partes fue alterada. Pide que te lo envíen otra vez como archivo.');
  const malas = [];
  for (let i = 0; i < s.n; i++) { const d = (s.piezas || [])[i]; let h = ''; try { h = d ? await sha(b64(d)) : ''; } catch {} if (h !== s.hashes[i]) { malas.push(i + 1); paso('Parte ' + (i + 1), false, d ? 'cambió' : 'falta'); } }
  if (malas.length) { r.malas = malas; return fin('La parte ' + malas.join(', ') + ' de ' + s.n + (malas.length > 1 ? ' cambiaron o faltan' : ' cambió o falta') + ' después de enviarse. Pide que te lo envíen otra vez como archivo.'); }
  paso('Partes', true, s.n + ' de ' + s.n);
  let paq; try { paq = JSON.parse(dec.decode(new Uint8Array(s.piezas.map(b64).reduce((a, b) => (a.push(...b), a), [])))); } catch { return fin('Las partes no forman un informe.'); }
  r.paq = paq; const env = paq.env;
  if (!paso('Contenido', await sha(canon(env)) === paq.hash, '')) return fin('El contenido cambió después de sellarse.');
  if (!paso('Firma', await firmaOk(env.emisor.jwk, paq.firma, paq.hash) && await firmaOk(env.emisor.jwk, s.firma_raiz, s.raiz), '')) return fin('El sello no es válido.');
  const fp = await huella(env.emisor.jwk);
  if (!paso('Código del sello', fp === env.emisor.fp, fp)) return fin('El sello no corresponde a quien dice enviarlo.');
  if (lget(LS.rev).includes(fp)) { paso('Bloqueado', false, fp); r.big = 'Rechazado ✗'; return fin('Bloqueaste a esta persona en Modo avanzado.'); }
  const c = lget(LS.conf).find(x => x.fp === fp);
  if (!c) { r.big = '¿Es de ' + (env.emisor.n || 'alguien') + '?'; r.wait = true; r.msg = 'El envío está completo y sellado. Es la primera vez que recibes algo de esta persona.'; mostrar(r); return pedirConfianza(String(env.emisor.n || 'Sin nombre').slice(0, 24), fp, env.emisor.jwk, t); }
  paso('Persona de confianza', true, c.n);
  const vistos = lget(LS.vistos), prev = lget(LS.envios).find(x => x.id === s.id && x.dir === 'recibido');
  if (vistos.includes(env.nonce)) { if (prev && prev.ok) { r.ok = true; r.big = 'Verificado ✓'; r.de = c.n; r.repe = true; return fin('Ya lo habías abierto antes. Sigue igual, de ' + c.n + '.'); } paso('Repetido', false, ''); r.big = 'Rechazado ✗'; return fin('Este envío ya se abrió en este teléfono.'); }
  vistos.push(env.nonce); lset(LS.vistos, vistos.slice(-500));
  r.ok = true; r.big = 'Verificado ✓'; r.de = c.n; return fin('Llegó completo, sin cambios y sellado por ' + c.n + '.');
}
function terminar(s, r) {
  ULT = { s, r }; mostrar(r); const p = r.paq;
  if (p && p.hash) {
    const prev = lget(LS.envios).find(x => x.id === s.id && x.dir === 'recibido');
    if (!(prev && prev.ok)) envioAdd({ id: s.id, dir: 'recibido', tipo: p.env.datos.tipo, hash: p.hash, raiz: s.raiz, ts: new Date().toISOString(), estado: r.ok ? 'Recibido' : 'Cambió', ok: r.ok, de: p.env.emisor.n });
    $('#rConfirmar').hidden = false; prepAcuse();
  }
  return r;
}
function mostrar(r) {
  $('#rBig').textContent = r.big; $('#rBig').className = 'verdict ' + (r.ok ? 'ok' : r.wait ? 'wait' : 'bad'); $('#rMsg').textContent = r.msg;
  const d = r.paq && r.paq.env && r.paq.env.datos;
  $('#rQue').textContent = d ? (d.tipo === 'techo' ? 'Garantía de techo · ' + d.cliente + ' · ' + d.anos + ' años' : 'Informe de obra · ' + d.obra + ' · ' + d.avance + '%') + (d.foto ? ' · con foto sellada' : '') + ' · datos de ejemplo' : '';
  $('[data-p=s]').innerHTML = `<p>${esc(r.msg)}</p>`;
  $('[data-p=d]').innerHTML = '<dl class="kv">' + r.pasos.map(p => `<dt>${p.ok ? '✓' : '✗'} ${esc(p.n)}</dt><dd>${esc(p.d)}</dd>`).join('') + '</dl>';
  $('[data-p=b]').innerHTML = `<pre>${esc(JSON.stringify({ resultado: r.pasos, contenido: r.paq || r.acuse || null }, null, 2))}</pre>`;
  $('#rAv').hidden = !avz();
  window.phenomFacil.ultimo = { ok: r.ok, big: r.big, msg: r.msg, malas: r.malas || [], wait: !!r.wait };
}
$$('[role=tab]').forEach(t => t.onclick = () => { $$('[role=tab]').forEach(x => x.setAttribute('aria-selected', String(x === t))); $$('.view').forEach(v => v.hidden = v.dataset.p !== t.dataset.t); });
$('#rAbrir').onclick = () => abrirTexto($('#rTexto').value);
$('#rArchivo').onchange = async () => { const f = $('#rArchivo').files[0]; if (!f) return; if (f.size > 2e6) return toast('Archivo demasiado grande'); const t = await f.text(); $('#rArchivo').value = ''; abrirTexto(t); };

// ---------- Confirmación (acuse firmado) ----------
let ACUSE_LISTO = null;
function prepAcuse() {
  const { s, r } = ULT, p = r.paq;
  ACUSE_LISTO = (async () => { const a = { k: 'acuse', v: 1, de: { n: nombre(), fp: YO.fp, jwk: { x: YO.jwk.x, y: YO.jwk.y } }, sobre_id: s.id, informe_hash: p.hash, raiz: s.raiz, veredicto: r.ok ? 'verificado' : 'rota', motivo: r.msg, nonce: hex(crypto.getRandomValues(new Uint8Array(12))), ts: new Date().toISOString() };
    const f = await firmar(a, YO); return BASE + '#a=' + await codificar({ k: 'acuse', acuse: a, hash: f.hash, firma: f.firma }); })();
}
$('#rConfirmar').onclick = async () => {
  if (!lget(LS.nombre, '')) { DESPUES = () => { ver('res'); prepAcuse(); }; return ver('nombre'); }
  ACUSE = await ACUSE_LISTO; window.phenomFacil.acuse = ACUSE;
  const m = await compartir('Confirmación Phenom (prueba) de ' + nombre(), ACUSE, 'confirmacion.phenom'); window.phenomFacil.modo = m;
  if (m !== 'cancelado') envioSet(ULT.s.id, 'recibido', x => x.estado = x.ok ? 'Confirmado' : 'Cambió');
  toast(m === 'copiado' ? 'Confirmación copiada: pégala en el chat' : m === 'cancelado' ? 'No se envió' : 'Confirmación compartida');
  if (m === 'copiado') descargar('confirmacion.phenom', ACUSE);
};
async function abrirAcuse(o, t) {
  const r = { pasos: [], ok: false, big: 'Confirmación no válida ✗', acuse: o.acuse }; const paso = (n, ok, d) => { r.pasos.push({ n, ok, d }); return ok; };
  const fin = m => (r.msg = m, mostrar(r), r);
  const a = o.acuse || {}, jwk = { crv: 'P-256', kty: 'EC', x: a.de && a.de.jwk.x, y: a.de && a.de.jwk.y };
  if (!paso('Contenido', await sha(canon(a)) === o.hash, '')) return fin('La confirmación cambió después de firmarse.');
  if (!paso('Firma', await firmaOk(jwk, o.firma, o.hash), '')) return fin('La firma de la confirmación no es válida.');
  const fp = await huella(jwk);
  if (!paso('Código del sello', fp === a.de.fp, fp)) return fin('El sello no corresponde.');
  const env = lget(LS.envios).find(x => x.dir === 'enviado' && x.hash === a.informe_hash && x.raiz === a.raiz);
  if (!paso('Es de un envío tuyo', !!env, '')) return fin('Esta confirmación no corresponde a nada enviado desde este teléfono.');
  if (lget(LS.rev).includes(fp)) { paso('Bloqueado', false, fp); return fin('Bloqueaste a esta persona.'); }
  const c = lget(LS.conf).find(x => x.fp === fp);
  if (!c) { r.big = '¿Es de ' + String(a.de.n).slice(0, 24) + '?'; r.wait = true; r.msg = 'Confirmación sellada de alguien nuevo.'; mostrar(r); return pedirConfianza(String(a.de.n || 'Sin nombre').slice(0, 24), fp, jwk, t); }
  if (a.veredicto !== 'verificado') { envioSet(env.id, 'enviado', x => x.estado = 'Cambió'); r.big = 'Le llegó cambiado ✗'; return fin(c.n + ' confirmó que lo recibió, pero le llegó cambiado: «' + a.motivo + '». Envíalo otra vez como archivo.'); }
  r.ok = true; r.big = 'Entregado y confirmado ✓';
  envioSet(env.id, 'enviado', x => { x.estado = 'Confirmado'; x.de = c.n; });
  return fin(c.n + ' recibió tu ' + (TIPOS[env.tipo] || 'envío').toLowerCase() + ' sin cambios y lo confirmó con su sello.');
}

// ---------- Mis envíos y personas ----------
function envioAdd(e) { const b = lget(LS.envios).filter(x => !(x.id === e.id && x.dir === e.dir)); b.unshift(e); lset(LS.envios, b.slice(0, 100)); }
function envioSet(id, dir, f) { const b = lget(LS.envios); const x = b.find(y => y.id === id && y.dir === dir); if (x) { f(x); lset(LS.envios, b); } }
function pintarEnvios() {
  const b = lget(LS.envios);
  $('#lista').innerHTML = b.length ? b.map(x => `<li><span>${x.dir === 'enviado' ? '↑' : '↓'} ${TIPOS[x.tipo] || 'Envío'}${x.de ? (x.dir === 'enviado' ? ' · a ' : ' · de ') + esc(x.de) : ''}<br><span class="muted">${esc(new Date(x.ts).toLocaleString('es'))}</span></span><span class="est ${esc(x.estado)}">${esc(x.estado)}</span></li>`).join('') : '<li class="muted">Todavía nada.</li>';
}
function pintarLlavero() {
  const c = lget(LS.conf), rv = lget(LS.rev);
  $('#llavero').innerHTML = c.length ? c.map(x => `<li><span>${esc(x.n)}<br><span class="muted">${esc(x.fp)}</span></span>${rv.includes(x.fp) ? '<span class="est Cambió">Bloqueado</span>' : `<button class="lnk" data-rev="${esc(x.fp)}">Bloquear</button>`}</li>`).join('') : '<li class="muted">Nadie todavía.</li>';
  $$('[data-rev]').forEach(b => b.onclick = () => { lset(LS.rev, [...lget(LS.rev), b.dataset.rev]); pintarLlavero(); });
}

// ---------- Arranque ----------
LS.envios = 'phenom_facil_envios_v1';
window.phenomFacil = { sha, canon, codificar, decodificar, ultimo: null, modo: '', acuse: '', link: () => SOBRE_LINK, yo: () => YO && YO.fp };
const LISTO = cargarLlave(); window.phenomFacil.listo = LISTO;
function ir() {
  const raw = location.hash;
  if (/^#[sa]=/.test(raw)) { history.replaceState(null, '', BASE); abrirTexto(raw); return; }
  ver(lget(LS.nombre, '') ? 'inicio' : 'nombre');
}
addEventListener('hashchange', ir);
aplicarAvz(); ir();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
