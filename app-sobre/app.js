'use strict';
// Phenom · Sobre (VERSIÓN DE PRUEBA). Envío asíncrono: el informe sellado viaja como sobre (enlace, archivo o QR).
// Sin peticiones externas. Código de sellado, piezas y verificación tomado de app-llave-real / app-2telefonos.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const LS = { conf: 'phenom_sobre_confianza_v1', rev: 'phenom_sobre_revocadas_v1', vistos: 'phenom_sobre_nonces_v1', bandeja: 'phenom_sobre_bandeja_v1', nombre: 'phenom_sobre_nombre_v1' };
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
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-sobre', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
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
  $('#yoFp').textContent = YO.fp; await pintarTarjeta(); return true;
}
async function firmar(obj, llave) { const h = await sha(canon(obj)); return { hash: h, firma: hex(await crypto.subtle.sign(SIG, llave.kp.privateKey, enc.encode(h))) }; }
async function firmaOk(jwk, firma, h) { try { const pk = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, ALG, true, ['verify']); return await crypto.subtle.verify(SIG, pk, unhex(firma), enc.encode(h)); } catch { return false; } }

// ---------- Compartir ----------
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
// QR: un cuadro si cabe cómodo; si no, QR animado de varios cuadros "PHQ1|i|n|trozo".
const QR1 = 900, TROZO = 400; let anim = {};
const cuadros = t => { const n = Math.ceil(t.length / TROZO), r = []; for (let i = 0; i < n; i++) r.push(`PHQ1|${i + 1}|${n}|` + t.slice(i * TROZO, (i + 1) * TROZO)); return r; };
function mostrarQR(canvas, info, texto) {
  clearInterval(anim[canvas.id]);
  if (texto.length <= QR1) { PhenomQR.draw(canvas, texto); if (info) info.textContent = 'QR de un cuadro.'; return 1; }
  const f = cuadros(texto); let i = 0; const pinta = () => { PhenomQR.draw(canvas, f[i]); if (info) info.textContent = `QR animado: cuadro ${i + 1} de ${f.length} (necesita leer todos; solo con cámara compatible).`; i = (i + 1) % f.length; };
  pinta(); anim[canvas.id] = setInterval(pinta, 700); return f.length;
}
function unirCuadros(lista) { const m = {}; let n = 0; for (const s of lista) { const p = s.match(/^PHQ1\|(\d+)\|(\d+)\|(.*)$/s); if (!p) continue; n = +p[2]; m[+p[1]] = p[3]; } if (!n) return null; for (let i = 1; i <= n; i++) if (m[i] === undefined) return { faltan: n - Object.keys(m).length, n }; return { texto: [...Array(n).keys()].map(i => m[i + 1]).join(''), n }; }

// ---------- Tarjeta ----------
let MI_TARJETA = '';
async function pintarTarjeta() {
  $('#tNombre').value = nombre(); $('#tFp').textContent = YO.fp;
  MI_TARJETA = BASE + '#t=' + await codificar({ k: 'tarjeta', v: 1, n: nombre(), jwk: { x: YO.jwk.x, y: YO.jwk.y } });
  $('#tLink').value = MI_TARJETA; mostrarQR($('#tQr'), null, MI_TARJETA);
}
$('#tNombre').onchange = () => { lset(LS.nombre, $('#tNombre').value.trim().slice(0, 24)); pintarTarjeta(); };
$('#tCompartir').onclick = () => compartir('Mi tarjeta Phenom (prueba)', MI_TARJETA, null);
$('#tCopiar').onclick = () => copiar(MI_TARJETA);
let TARJ = null;
async function abrirTarjeta(o) {
  const jwk = { crv: 'P-256', kty: 'EC', x: o.jwk.x, y: o.jwk.y }; const fp = await huella(jwk);
  TARJ = { fp, jwk, n: String(o.n || 'Sin nombre').slice(0, 24) };
  $('#oTNombre').textContent = TARJ.n; $('#oTFp').textContent = fp; $('#oTarjeta').hidden = false;
  const ya = lget(LS.conf).some(x => x.fp === fp); $('#oConfiar').textContent = ya ? 'Ya confías ✓' : 'Confiar'; $('#oConfiar').disabled = ya || fp === YO.fp;
  if (fp === YO.fp) $('#oTNombre').textContent += ' (es tu propia tarjeta)';
}
$('#oConfiar').onclick = () => { const c = lget(LS.conf); if (TARJ && !c.some(x => x.fp === TARJ.fp)) { c.push(TARJ); lset(LS.conf, c); lset(LS.rev, lget(LS.rev).filter(f => f !== TARJ.fp)); } $('#oConfiar').textContent = 'Ya confías ✓'; $('#oConfiar').disabled = true; toast('Agregado al llavero'); pintarLlavero(); };

// ---------- Sellar y sobre ----------
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
let TIPO = 'obra', SOBRE = null, SOBRE_LINK = '';
function datosForm() {
  return TIPO === 'obra' ? { tipo: 'obra', obra: $('#oObra').value, avance: Number($('#oAvance').value), nota: $('#oNota').value, ejemplo: true }
    : { tipo: 'techo', cliente: $('#tCli').value, trabajo: $('#tTrab').value, anos: Number($('#tAnos').value), ejemplo: true };
}
function elegir(t) { TIPO = t; $$('[data-tipo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === t))); $$('[data-solo]').forEach(d => d.hidden = d.dataset.solo !== t); }
$$('[data-tipo]').forEach(b => b.onclick = () => elegir(b.dataset.tipo));
function metodos(len) {
  return [
    ['Enlace', len <= 2000 ? '✓ cabe bien en un chat' : len <= 8000 ? '⚠ largo: algunos chats lo cortan' : '✗ demasiado largo: usa el archivo'],
    ['Archivo .phenom', '✓ siempre (recomendado si el chat corta enlaces)'],
    ['QR', len <= QR1 ? '✓ un cuadro' : '⚠ animado de ' + Math.ceil(len / TROZO) + ' cuadros: solo con cámara compatible; si no, usa enlace o archivo'],
  ];
}
$('#eSellar').onclick = async () => {
  const paq = await sellar(datosForm(), YO, nombre()); SOBRE = await crearSobre(paq, YO);
  SOBRE_LINK = BASE + '#s=' + await codificar(SOBRE); SOBRE.paq = paq;
  const L = SOBRE_LINK.length, F = SOBRE_LINK.length;
  $('#eTam').innerHTML = `<dt>Piezas</dt><dd>${SOBRE.n}</dd><dt>Enlace</dt><dd>${L} caracteres</dd><dt>Archivo</dt><dd>${F} bytes</dd><dt>Huella</dt><dd>${paq.hash.slice(0, 16)}…</dd>`;
  $('#eMetodos').innerHTML = metodos(L).map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join('');
  $('#eLink').value = SOBRE_LINK; $('#eSobre').hidden = false; mostrarQR($('#eQr'), $('#eQrInfo'), SOBRE_LINK);
  bandejaAdd({ id: SOBRE.id, dir: 'enviado', tipo: paq.env.datos.tipo, hash: paq.hash, raiz: SOBRE.raiz, ts: paq.env.ts, estado: 'enviado', tam: L });
  $('#vEnviar').disabled = !abierto();
};
$('#eCompartir').onclick = async () => toast('Compartido: ' + await compartir('Sobre Phenom (prueba)', SOBRE_LINK, 'sobre-' + SOBRE.id + '.phenom'));
$('#eCopiar').onclick = () => copiar(SOBRE_LINK);
$('#eArchivo').onclick = () => descargar('sobre-' + SOBRE.id + '.phenom', SOBRE_LINK);

// ---------- Abrir ----------
let ULT = null, ACUSE_LINK = '';
async function abrirTexto(t, origen) {
  $('#oTarjeta').hidden = true; $('#res').hidden = true; $('#oAcuse').hidden = true; $('#oAcuseOut').hidden = true;
  const e = extraer(t);
  if (!e) return mostrar({ ok: false, chip: 'ROTA ✗', msg: 'No es un enlace de Phenom o está incompleto.', pasos: [{ n: 'Formato', ok: false, d: 'no se reconoce' }] });
  let o; try { o = await decodificar(e.code); } catch { return mostrar({ ok: false, chip: 'ROTA ✗', msg: 'Sobre incompleto: el enlace o el archivo está cortado o dañado (no se pudo leer).', pasos: [{ n: 'Sobre completo', ok: false, d: 'el contenido está cortado (' + e.code.length + ' caracteres)' }] }); }
  if (e.kind === 't' && o.k === 'tarjeta') return abrirTarjeta(o);
  if (e.kind === 's' && o.k === 'sobre') return abrirSobre(o, origen);
  if (e.kind === 'a' && o.k === 'acuse') return abrirAcuse(o);
  mostrar({ ok: false, chip: 'ROTA ✗', msg: 'Contenido no reconocido.', pasos: [] });
}
async function abrirSobre(s, origen) {
  const r = { pasos: [], ok: false, chip: 'ROTA ✗', tipo: 'sobre' }; const paso = (n, ok, d) => { r.pasos.push({ n, ok, d }); return ok; };
  const fin = (m, chip) => { r.msg = m; if (chip) r.chip = chip; return terminarSobre(s, r); };
  paso('Sobre completo', true, s.n + ' piezas');
  if (!paso('Huella raíz', await sha((s.hashes || []).join('')) === s.raiz && (s.hashes || []).length === s.n, s.raiz)) return fin('La lista de huellas fue alterada.');
  const malas = [];
  for (let i = 0; i < s.n; i++) {
    const d = (s.piezas || [])[i];
    if (!d) { malas.push(i + 1); paso('Pieza ' + (i + 1), false, 'falta'); continue; }
    let h = ''; try { h = await sha(b64(d)); } catch {}
    if (h !== s.hashes[i]) { malas.push(i + 1); paso('Pieza ' + (i + 1), false, 'alterada: su huella no coincide'); }
  }
  if (malas.length) { r.malas = malas; return fin('Pieza' + (malas.length > 1 ? 's ' : ' ') + malas.join(', ') + ' dañada' + (malas.length > 1 ? 's' : '') + ' o faltante' + (malas.length > 1 ? 's' : '') + '. Pide que te reenvíen el sobre como archivo.'); }
  paso('Piezas', true, s.n + ' de ' + s.n + ' con huella correcta');
  const all = new Uint8Array(s.piezas.map(b64).reduce((a, b) => (a.push(...b), a), []));
  let paq; try { paq = JSON.parse(dec.decode(all)); } catch { return fin('Las piezas no forman un informe.'); }
  r.paq = paq;
  const h = await sha(canon(paq.env));
  if (!paso('Huella del documento', h === paq.hash, h === paq.hash ? 'coincide' : 'el documento cambió')) return fin('El documento cambió después de sellarse.');
  if (!paso('Firma del documento', await firmaOk(paq.env.emisor.jwk, paq.firma, paq.hash), '')) return fin('La firma no es válida.');
  if (!paso('Firma de la huella raíz', await firmaOk(paq.env.emisor.jwk, s.firma_raiz, s.raiz), '')) return fin('La huella raíz no la firmó el emisor.');
  const fp = await huella(paq.env.emisor.jwk);
  if (!paso('Huella de la llave', fp === paq.env.emisor.fp, fp)) return fin('La huella de la llave no corresponde.');
  if (lget(LS.rev).includes(fp)) { paso('Llave revocada', false, fp); return fin('Llave revocada en tu llavero: se rechaza.', 'Rechazado ✗'); }
  paso('Llave revocada', true, 'no');
  const c = lget(LS.conf).find(x => x.fp === fp);
  if (!paso('Llave de confianza', !!c, c ? c.n : 'no está en tu llavero')) return fin('Llave desconocida: abre primero la tarjeta de ' + (paq.env.emisor.n || 'este emisor') + ' y toca Confiar.', 'Rechazado ✗');
  const vistos = lget(LS.vistos);
  if (!paso('Repetición (nonce)', !vistos.includes(paq.env.nonce), paq.env.nonce)) return fin('Repetición: este sobre ya se abrió en este teléfono.', 'Rechazado ✗');
  vistos.push(paq.env.nonce); lset(LS.vistos, vistos.slice(-500));
  r.ok = true; r.chip = 'Verificado ✓'; r.de = c.n; return fin('Todo coincide.');
}
function terminarSobre(s, r) {
  ULT = { s, r }; mostrar(r);
  const p = r.paq; $('#oAcuse').hidden = !(p && p.env && p.env.emisor);
  const prev = lget(LS.bandeja).find(x => x.id === s.id && x.dir === 'recibido');
  if (p && p.hash && !(prev && /verificado/.test(prev.estado))) bandejaAdd({ id: s.id, dir: 'recibido', tipo: p.env && p.env.datos && p.env.datos.tipo, hash: p.hash, raiz: s.raiz, ts: new Date().toISOString(), estado: r.ok ? 'abierto · verificado ✓' : 'abierto · ' + r.chip, de: p.env && p.env.emisor && p.env.emisor.n });
  return r;
}
function mostrar(r) {
  $('#res').hidden = false; $('#resChip').textContent = r.chip; $('#resChip').className = 'chip ' + (r.ok ? 'ok' : 'bad'); $('#resMsg').textContent = r.msg;
  const d = r.paq && r.paq.env && r.paq.env.datos;
  $('[data-p=s]').innerHTML = `<p>${r.ok ? (r.tipo === 'acuse' ? 'El otro teléfono firmó que recibió tu informe.' : 'El informe llegó completo, sin cambios y firmado por ' + esc(r.de) + '.') : 'No se puede confiar en esto.'}</p>` + (d ? `<p class="muted">${esc(d.tipo === 'techo' ? 'Garantía de techo · ' + d.cliente + ' · ' + d.anos + ' años' : 'Informe de obra · ' + d.obra + ' · ' + d.avance + '%')}</p>` : '');
  $('[data-p=d]').innerHTML = '<dl class="kv">' + r.pasos.map(p => `<dt>${p.ok ? '✓' : '✗'} ${esc(p.n)}</dt><dd>${esc(p.d)}</dd>`).join('') + '</dl>';
  $('[data-p=b]').innerHTML = `<pre>${esc(JSON.stringify({ resultado: { ok: r.ok, msg: r.msg, pasos: r.pasos }, contenido: r.paq || r.acuse || null }, null, 2))}</pre>`;
  window.phenomSobre.ultimo = { ok: r.ok, chip: r.chip, msg: r.msg, malas: r.malas || [] };
  return r;
}
$$('[role=tab]').forEach(t => t.onclick = () => { $$('[role=tab]').forEach(x => x.setAttribute('aria-selected', String(x === t))); $$('.view').forEach(v => v.hidden = v.dataset.p !== t.dataset.t); });
$('#oAbrir').onclick = () => abrirTexto($('#oTexto').value, 'pegado');
$('#oArchivo').onchange = async () => { const f = $('#oArchivo').files[0]; if (!f) return; if (f.size > 2e6) return toast('Archivo demasiado grande'); abrirTexto(await f.text(), 'archivo'); $('#oArchivo').value = ''; };

// ---------- Acuse ----------
$('#oCrearAcuse').onclick = async () => {
  const { s, r } = ULT; const p = r.paq;
  const a = { k: 'acuse', v: 1, de: { n: nombre(), fp: YO.fp, jwk: { x: YO.jwk.x, y: YO.jwk.y } }, sobre_id: s.id, informe_hash: p.hash, raiz: s.raiz, veredicto: r.ok ? 'verificado' : 'rota', motivo: r.msg, nonce: hex(crypto.getRandomValues(new Uint8Array(12))), ts: new Date().toISOString() };
  const f = await firmar(a, YO); ACUSE_LINK = BASE + '#a=' + await codificar({ k: 'acuse', acuse: a, hash: f.hash, firma: f.firma });
  $('#aLink').value = ACUSE_LINK; $('#oAcuseOut').hidden = false; mostrarQR($('#aQr'), null, ACUSE_LINK);
  bandejaSet(s.id, 'recibido', x => x.estado = x.estado.replace(/ · acuse creado$/, '') + ' · acuse creado');
};
$('#aCompartir').onclick = () => compartir('Acuse Phenom (prueba)', ACUSE_LINK, 'acuse.phenom');
$('#aCopiar').onclick = () => copiar(ACUSE_LINK);
$('#aArchivo').onclick = () => descargar('acuse.phenom', ACUSE_LINK);
async function abrirAcuse(o) {
  const r = { pasos: [], ok: false, chip: 'Acuse no válido ✗', tipo: 'acuse', acuse: o.acuse }; const paso = (n, ok, d) => { r.pasos.push({ n, ok, d }); return ok; };
  const fin = m => (r.msg = m, mostrar(r));
  const a = o.acuse || {}, jwk = { crv: 'P-256', kty: 'EC', x: a.de && a.de.jwk.x, y: a.de && a.de.jwk.y };
  if (!paso('Huella del acuse', await sha(canon(a)) === o.hash, '')) return fin('El acuse cambió después de firmarse.');
  if (!paso('Firma del receptor', await firmaOk(jwk, o.firma, o.hash), '')) return fin('La firma del acuse no es válida.');
  const fp = await huella(jwk);
  if (!paso('Huella de la llave', fp === a.de.fp, fp)) return fin('La huella no corresponde.');
  if (lget(LS.rev).includes(fp)) { paso('Llave revocada', false, fp); return fin('Esa llave está revocada en tu llavero.'); }
  const c = lget(LS.conf).find(x => x.fp === fp);
  if (!paso('Llave de confianza', !!c, c ? c.n : 'desconocida')) return fin('Firma válida, pero no confías en esa llave: abre su tarjeta y toca Confiar.');
  const env = lget(LS.bandeja).find(x => x.dir === 'enviado' && x.hash === a.informe_hash && x.raiz === a.raiz);
  if (!paso('Corresponde a un sobre enviado', !!env, a.informe_hash.slice(0, 16) + '…')) return fin('No corresponde a ningún sobre enviado desde este teléfono.');
  r.ok = true; r.chip = 'Acuse verificado ✓';
  bandejaSet(env.id, 'enviado', x => x.estado = 'acuse recibido · ' + (a.veredicto === 'verificado' ? 'Verificado ✓' : 'ROTA ✗') + ' (' + c.n + ')');
  return fin(c.n + ' firmó que abrió tu informe (' + a.informe_hash.slice(0, 16) + '…) y su resultado fue: ' + (a.veredicto === 'verificado' ? 'Verificado ✓' : 'ROTA ✗') + '.');
}

// ---------- Escanear QR (solo si el navegador trae BarcodeDetector) ----------
if ('BarcodeDetector' in window) $('#oEscanear').hidden = false;
else $('#oScanInfo').textContent = 'Este navegador no lee QR con la cámara: abre el enlace, pégalo o elige el archivo.';
$('#oEscanear').onclick = async () => {
  let st; const v = $('#oVideo'), info = $('#oScanInfo'), vistos = new Set();
  try {
    const det = new BarcodeDetector({ formats: ['qr_code'] }); st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    v.hidden = false; v.srcObject = st; await v.play(); info.textContent = 'Apunta al QR…';
    for (let i = 0; i < 600; i++) {
      const c = await det.detect(v).catch(() => []);
      for (const x of c) { const t = x.rawValue; if (!t.startsWith('PHQ1|')) { $('#oTexto').value = t; i = 1e9; break; } vistos.add(t); const u = unirCuadros([...vistos]); if (u && u.texto) { $('#oTexto').value = u.texto; i = 1e9; break; } if (u) info.textContent = `Cuadros leídos: ${u.n - u.faltan} de ${u.n}`; }
      await dormir(120);
    }
  } catch { info.textContent = 'No se pudo usar la cámara: pega el enlace o elige el archivo.'; }
  v.hidden = true; if (st) st.getTracks().forEach(t => t.stop());
  if ($('#oTexto').value) abrirTexto($('#oTexto').value, 'qr');
};

// ---------- Bandeja y llavero ----------
function bandejaAdd(e) { const b = lget(LS.bandeja).filter(x => !(x.id === e.id && x.dir === e.dir)); b.unshift(e); lset(LS.bandeja, b.slice(0, 100)); pintarBandeja(); }
function bandejaSet(id, dir, f) { const b = lget(LS.bandeja); const x = b.find(y => y.id === id && y.dir === dir); if (x) { f(x); lset(LS.bandeja, b); pintarBandeja(); } }
function pintarBandeja() {
  const b = lget(LS.bandeja);
  $('#bLista').innerHTML = b.length ? b.map(x => `<li data-id="${esc(x.id)}" data-dir="${x.dir}"><b>${x.dir === 'enviado' ? '↑ Enviado' : '↓ Recibido'} · ${x.tipo === 'techo' ? 'Garantía de techo' : 'Informe de obra'}${x.de ? ' · de ' + esc(x.de) : ''}</b><span class="estado">${esc(x.estado)}</span><br><span class="muted">${esc(new Date(x.ts).toLocaleString('es'))} · ${esc(x.hash.slice(0, 12))}…</span></li>`).join('') : '<li class="muted">Vacía.</li>';
}
$('#bBorrar').onclick = () => { lset(LS.bandeja, []); pintarBandeja(); };
function pintarLlavero() {
  const c = lget(LS.conf), rv = lget(LS.rev);
  $('#kLista').innerHTML = c.length ? c.map(x => `<li><b>${esc(x.n)}</b><span class="fp">${x.fp}</span> ${rv.includes(x.fp) ? '<span class="chip bad">revocada</span>' : `<button class="lnk" data-rev="${x.fp}" type="button">Revocar</button>`}</li>`).join('') : '<li class="muted">Aún no confías en nadie. Abre la tarjeta del otro teléfono.</li>';
  $$('[data-rev]').forEach(b => b.onclick = () => { const r = lget(LS.rev); r.push(b.dataset.rev); lset(LS.rev, r); pintarLlavero(); toast('Llave revocada'); });
}

// ---------- Conexión en vivo (opcional, misma wifi, sin servidores externos) ----------
const ICE = { iceServers: [] };
let PC = null, DC = null; const VLOG = [];
const vlog = m => { VLOG.push(new Date().toTimeString().slice(0, 8) + '  ' + m); $('#vLog').textContent = VLOG.join('\n'); };
const abierto = () => !!DC && DC.readyState === 'open';
const gathered = pc => new Promise(r => { if (pc.iceGatheringState === 'complete') return r(); const f = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', f); r(); } }; pc.addEventListener('icegatheringstatechange', f); setTimeout(r, 4000); });
function vEstado(t, ok) { $('#vEstado').textContent = t; $('#vEstado').className = 'chip ' + (ok === true ? 'ok' : ok === false ? 'bad' : ''); }
function nuevaPC() {
  if (PC) try { PC.close(); } catch {}
  const pc = new RTCPeerConnection(ICE); PC = pc;
  pc.oniceconnectionstatechange = () => { vlog('ICE: ' + pc.iceConnectionState);
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') { vEstado('Conexión perdida', false); $('#vInfo').textContent = 'Se perdió la conexión. Prueba «Reintentar sin código nuevo»; si no funciona, usa el Sobre (no necesita que estén conectados a la vez).'; }
    if (pc.iceConnectionState === 'connected') vEstado('Conectado ✓', true); };
  pc.ondatachannel = e => cablear(e.channel); return pc;
}
function cablear(dc) {
  DC = dc;
  dc.onopen = () => { vlog('Canal abierto'); vEstado('Conectado ✓', true); $('#vEnviar').disabled = !SOBRE_LINK; $('#vReintentar').disabled = false; $('#vInfo').textContent = ''; };
  dc.onclose = () => { vlog('Canal cerrado'); vEstado('Desconectado', false); $('#vEnviar').disabled = true; $('#vInfo').textContent = 'La conexión en vivo se cerró. Usa el Sobre: funciona aunque el otro teléfono esté apagado.'; };
  dc.onmessage = async e => { let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'link') { vlog('Recibido por conexión en vivo (' + m.link.length + ' caracteres)'); location.hash = '#abrir'; await abrirTexto(m.link, 'vivo'); }
    if (m.t === 'sdp') { // reintento: renegociación ICE por el mismo canal, sin código nuevo
      await PC.setRemoteDescription(m.d);
      if (m.d.type === 'offer') { await PC.setLocalDescription(await PC.createAnswer()); await gathered(PC); dc.send(JSON.stringify({ t: 'sdp', d: { type: 'answer', sdp: PC.localDescription.sdp } })); }
      vlog('Reintento ICE aplicado'); } };
}
const packV = d => codificar({ type: d.type, sdp: d.sdp });
$('#vCrear').onclick = async () => { const pc = nuevaPC(); cablear(pc.createDataChannel('phenom-sobre')); await pc.setLocalDescription(await pc.createOffer()); await gathered(pc); $('#vMio').value = await packV(pc.localDescription); vlog('Código creado: pásalo al otro teléfono'); vEstado('Esperando código del otro'); };
$('#vUsar').onclick = async () => {
  let d; try { d = await decodificar($('#vOtro').value.trim()); } catch { return vEstado('Código inválido', false); }
  if (d.type === 'offer') { const pc = nuevaPC(); await pc.setRemoteDescription(d); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc); $('#vMio').value = await packV(pc.localDescription); vlog('Respuesta creada: pásala al otro teléfono'); }
  else if (PC) { await PC.setRemoteDescription(d); vlog('Respuesta aplicada'); vEstado('Conectando…'); }
};
$('#vCopiar').onclick = () => copiar($('#vMio').value);
$('#vEnviar').onclick = () => { if (abierto() && SOBRE_LINK) { DC.send(JSON.stringify({ t: 'link', link: SOBRE_LINK })); vlog('Sobre enviado en vivo'); toast('Enviado'); } };
$('#vReintentar').onclick = async () => {
  if (!PC) return;
  if (!abierto()) { $('#vInfo').textContent = 'No se puede reintentar sin código: el canal ya se cerró. Usa el Sobre.'; return; }
  vlog('Reintentando (reinicio ICE por el mismo canal)…');
  await PC.setLocalDescription(await PC.createOffer({ iceRestart: true })); await gathered(PC);
  DC.send(JSON.stringify({ t: 'sdp', d: { type: 'offer', sdp: PC.localDescription.sdp } }));
  await dormir(6000); if (PC.iceConnectionState !== 'connected' && PC.iceConnectionState !== 'completed') $('#vInfo').textContent = 'El reintento no funcionó. Usa el Sobre.';
};

// ---------- Navegación y arranque ----------
function ir() {
  const raw = location.hash || '#inicio';
  if (/^#[sat]=/.test(raw)) { const t = raw; history.replaceState(null, '', BASE + '#abrir'); mostrarPantalla('abrir'); LISTO.then(() => abrirTexto(t, 'enlace')); return; }
  mostrarPantalla(raw.slice(1));
}
function mostrarPantalla(h) {
  const s = $(`[data-screen="${h}"]`) ? h : 'inicio';
  $$('[data-screen]').forEach(x => x.hidden = x.dataset.screen !== s);
  $('#nav').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); scrollTo(0, 0);
  if (s === 'bandeja') pintarBandeja(); if (s === 'llavero') pintarLlavero();
}
addEventListener('hashchange', ir);
$('#menuBtn').onclick = () => { const n = $('#nav'); n.hidden = !n.hidden; $('#menuBtn').setAttribute('aria-expanded', String(!n.hidden)); };
window.phenomSobre = { sha, canon, codificar, decodificar, cuadros, unirCuadros, ultimo: null, ICE, sobreLink: () => SOBRE_LINK, acuseLink: () => ACUSE_LINK, tarjeta: () => MI_TARJETA, yo: () => YO && YO.fp };
const LISTO = cargarLlave(); window.phenomSobre.listo = LISTO;
ir(); pintarBandeja(); pintarLlavero();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
