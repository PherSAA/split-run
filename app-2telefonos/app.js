'use strict';
// Phenom · Prueba con 2 teléfonos (VERSIÓN DE PRUEBA). Datos y llaves de ejemplo.
// Señalización manual WebRTC tomada de phenom-v1.7 (pack/unpack/gathered); sellado y piezas de app-llave-real.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const LS = { conf: 'phenom_2tel_confianza_v1', rev: 'phenom_2tel_revocadas_v1', vistos: 'phenom_2tel_nonces_v1', casos: 'phenom_2tel_casos_v1' };
const lget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d || []; } catch { return d || []; } };
const lset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 1600); };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const dormir = ms => new Promise(r => setTimeout(r, ms));
// Única conexión externa: STUN público de Google. Sin TURN.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ---------- Registro ----------
const LOG = []; let TX = 0, RX = 0;
const hora = () => { const d = new Date(); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
function log(m) { LOG.push(hora() + '  ' + m); $('#gLog').textContent = LOG.join('\n'); $('#gLog').scrollTop = 1e9; }
function pintarBytes() { $('#gTx').textContent = TX + ' bytes'; $('#gRx').textContent = RX + ' bytes'; }
function textoRegistro() {
  return ['Phenom · registro de prueba 2 teléfonos (versión de prueba)', 'Fecha: ' + new Date().toString(), 'Rol: ' + (ROL || 'sin elegir') + ' · llave ' + (YO ? YO.fp : '—'),
    'Navegador: ' + navigator.userAgent, 'Conexión: ' + $('#gEstado').textContent, 'Bytes enviados: ' + TX + ' · recibidos: ' + RX, '---', ...LOG].join('\n');
}
async function copiar(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado'); return true; }
  catch { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} a.remove(); toast(ok ? 'Copiado' : 'No se pudo copiar: selecciona el texto'); return ok; }
}

// ---------- Llave del teléfono (IndexedDB, privada NO exportable) ----------
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-2telefonos', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise(ok => { const r = db.transaction('k').objectStore('k').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise(ok => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }
const pubOf = async pk => { const j = await crypto.subtle.exportKey('jwk', pk); return { crv: j.crv, kty: j.kty, x: j.x, y: j.y }; };
const huella = async jwk => (await sha(canon(jwk))).slice(0, 16).match(/..../g).join(' ');
async function nuevaLlave() { const kp = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']); const jwk = await pubOf(kp.publicKey); return { kp, jwk, fp: await huella(jwk) }; }
let YO = null;
async function cargarLlave() {
  const kp = await idbGet('yo').catch(() => null);
  if (kp && kp.privateKey) { const jwk = await pubOf(kp.publicKey); YO = { kp, jwk, fp: await huella(jwk) }; }
  else { YO = await nuevaLlave(); await idbPut('yo', YO.kp).catch(() => {}); }
  $('#yoFp').textContent = YO.fp; return true;
}
async function firmar(obj, llave) { const h = await sha(canon(obj)); return { hash: h, firma: hex(await crypto.subtle.sign(SIG, llave.kp.privateKey, enc.encode(h))) }; }
async function firmaOk(jwk, firma, h) { try { const pk = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, ALG, true, ['verify']); return await crypto.subtle.verify(SIG, pk, unhex(firma), enc.encode(h)); } catch { return false; } }

// ---------- Sellar y verificar (de app-llave-real) ----------
async function sellar(datos, llave) {
  const env = { app: 'phenom-2telefonos-prueba', datos, emisor: { fp: llave.fp, jwk: llave.jwk }, nonce: hex(crypto.getRandomValues(new Uint8Array(16))), ts: new Date().toISOString() };
  const f = await firmar(env, llave); return { env, hash: f.hash, firma: f.firma };
}
async function verificar(paq) {
  const r = { pasos: [], ok: false };
  const paso = (n, ok, d) => { r.pasos.push({ n, ok, d }); return ok; };
  const fin = m => (r.msg = m, r);
  const h = await sha(canon(paq.env));
  if (!paso('Huella del documento', h === paq.hash, h === paq.hash ? 'coincide' : 'no coincide: el documento cambió')) return fin('El documento cambió después de sellarse.');
  const fo = await firmaOk(paq.env.emisor.jwk, paq.firma, paq.hash);
  if (!paso('Firma', fo, fo ? 'válida' : 'no válida')) return fin('La firma no es válida.');
  const fp = await huella(paq.env.emisor.jwk);
  if (!paso('Huella de la llave', fp === paq.env.emisor.fp, fp)) return fin('La huella de la llave no corresponde.');
  if (lget(LS.rev).includes(fp)) { paso('Llave revocada', false, fp); return fin('Llave revocada: se rechaza.'); }
  paso('Llave revocada', true, 'no');
  if (!paso('Llave conocida', lget(LS.conf).some(x => x.fp === fp), fp)) return fin('Llave desconocida: no está en el llavero de este teléfono.');
  const vistos = lget(LS.vistos);
  if (!paso('Repetición (nonce)', !vistos.includes(paq.env.nonce), paq.env.nonce)) return fin('Repetición: este informe ya se recibió.');
  vistos.push(paq.env.nonce); lset(LS.vistos, vistos.slice(-500));
  r.ok = true; return fin('Todo coincide.');
}

// ---------- Piezas + huella raíz ----------
const TAM = 160;
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function partir(paq) {
  const b = enc.encode(JSON.stringify(paq)), piezas = [];
  for (let i = 0; i < b.length; i += TAM) { const p = b.slice(i, i + TAM); piezas.push({ i: piezas.length, d: btoa(String.fromCharCode(...p)), h: await sha(p) }); }
  return { id: hex(crypto.getRandomValues(new Uint8Array(8))), n: piezas.length, hashes: piezas.map(p => p.h), raiz: await sha(piezas.map(p => p.h).join('')), piezas };
}
async function armar(man, recib) {
  if (await sha(man.hashes.join('')) !== man.raiz) return { ok: false, msg: 'La huella raíz no coincide.' };
  const partes = [];
  for (let i = 0; i < man.n; i++) { const p = recib[i]; if (!p) return { ok: false, msg: 'Falta la pieza ' + (i + 1) }; const b = b64(p); if (await sha(b) !== man.hashes[i]) return { ok: false, msg: 'Pieza ' + (i + 1) + ' alterada' }; partes.push(b); }
  const all = new Uint8Array(partes.reduce((a, b) => a + b.length, 0)); let o = 0; partes.forEach(b => { all.set(b, o); o += b.length; });
  try { return { ok: true, paq: JSON.parse(dec.decode(all)) }; } catch { return { ok: false, msg: 'Las piezas no forman un informe.' }; }
}

// ---------- WebRTC: señalización manual (de phenom-v1.7) ----------
const b64e = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
async function pack(desc) { const j = enc.encode(JSON.stringify({ type: desc.type, sdp: desc.sdp })); if (window.CompressionStream) { const cs = new Blob([j]).stream().pipeThrough(new CompressionStream('deflate-raw')); return 'z' + b64e(new Uint8Array(await new Response(cs).arrayBuffer())); } return 'j' + b64e(j); }
async function unpack(s) { s = s.replace(/\s+/g, ''); const raw = b64(s.slice(1)); if (s[0] === 'z') { const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return JSON.parse(await new Response(ds).text()); } if (s[0] === 'j') return JSON.parse(dec.decode(raw)); throw new Error('código'); }
const gathered = pc => new Promise(r => { if (pc.iceGatheringState === 'complete') return r(); const f = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', f); r(); } }; pc.addEventListener('icegatheringstatechange', f); setTimeout(r, 5000); });
let ROL = null, PC = null, DC = null, PEER = null;
function estado(t, ok) { [$('#aEstado'), $('#bEstado')].forEach(e => { e.textContent = t; e.className = 'chip ' + (ok === true ? 'ok' : ok === false ? 'bad' : ''); }); $('#gEstado').textContent = t; }
function nuevaPC(rol) {
  if (PC) try { PC.close(); } catch {}
  ROL = rol; PEER = null; const pc = new RTCPeerConnection(ICE); PC = pc;
  log(`Nueva conexión como ${rol === 'emisor' ? 'A · Emisor' : 'B · Receptor'} · STUN ${ICE.iceServers[0].urls} · sin TURN`);
  pc.onicecandidate = e => { if (e.candidate) log('Candidato ICE: ' + (e.candidate.type || '?') + ' / ' + (e.candidate.protocol || '?')); else log('Fin de candidatos ICE'); };
  pc.onicegatheringstatechange = () => log('ICE recolección: ' + pc.iceGatheringState);
  pc.oniceconnectionstatechange = () => { log('ICE conexión: ' + pc.iceConnectionState); if (pc.iceConnectionState === 'failed') estado('Falló la conexión (¿red sin TURN?)', false); };
  pc.onconnectionstatechange = () => { log('Conexión: ' + pc.connectionState); if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') estado('Desconectado', false); };
  pc.ondatachannel = e => cablear(e.channel);
  return pc;
}
function cablear(dc) {
  DC = dc;
  dc.onopen = () => { log('Canal de datos abierto'); estado('Conectado ✓', true); enviar({ t: 'hola', rol: ROL, fp: YO.fp, jwk: YO.jwk }); if (ROL === 'emisor') pintarBotones(); };
  dc.onclose = () => { log('Canal de datos cerrado · enviados ' + TX + ' B · recibidos ' + RX + ' B'); estado('Desconectado', false); pintarBotones(); };
  dc.onerror = e => log('Error del canal: ' + (e.error && e.error.message || 'desconocido'));
  dc.onmessage = e => { RX += e.data.length; pintarBytes(); let m; try { m = JSON.parse(e.data); } catch { return log('Mensaje ilegible'); } recibir(m).catch(err => log('Error: ' + err.message)); };
}
const abierto = () => DC && DC.readyState === 'open';
function enviar(o) { if (!abierto()) return false; const s = JSON.stringify(o); DC.send(s); TX += s.length; pintarBytes(); return true; }
function mostrarQR(canvas, info, code) {
  try { const q = PhenomQR.draw(canvas, code); canvas.hidden = false; if (info) info.textContent = 'QR versión ' + q.version + ' · ' + code.length + ' caracteres.'; }
  catch { canvas.hidden = true; if (info) info.textContent = 'El código es muy largo para un QR: usa Copiar o Compartir.'; }
}
async function compartir(t) { if (navigator.share) { try { await navigator.share({ title: 'Código Phenom (prueba)', text: t }); return; } catch {} } copiar(t); }

// Emisor
$('#aCrear').onclick = async () => {
  const pc = nuevaPC('emisor'); cablear(pc.createDataChannel('phenom', { ordered: true }));
  estado('Creando código…'); $('#aCrear').disabled = true;
  await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
  const code = await pack(pc.localDescription); $('#aCod').value = code; $('#aOferta').hidden = false; $('#aCrear').disabled = false;
  mostrarQR($('#aQr'), $('#aQrInfo'), code); log('Código de conexión listo (' + code.length + ' caracteres)'); estado('Esperando respuesta de B');
};
$('#aConectar').onclick = async () => {
  if (!PC || ROL !== 'emisor') return toast('Primero crea el código');
  try { await PC.setRemoteDescription(await unpack($('#aResp').value)); log('Respuesta de B aplicada'); estado('Conectando…'); }
  catch (e) { log('Respuesta inválida: ' + e.message); estado('Respuesta inválida', false); }
};
$('#aCopiar').onclick = () => copiar($('#aCod').value);
$('#aCompartir').onclick = () => compartir($('#aCod').value);
// Receptor
$('#bResponder').onclick = async () => {
  const pc = nuevaPC('receptor');
  try { await pc.setRemoteDescription(await unpack($('#bCod').value)); } catch (e) { log('Código de A inválido'); return estado('Código inválido', false); }
  estado('Creando respuesta…'); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
  const code = await pack(pc.localDescription); $('#bResp').value = code; $('#bRespuesta').hidden = false;
  mostrarQR($('#bQr'), null, code); log('Código de respuesta listo (' + code.length + ' caracteres)'); estado('Esperando que A conecte');
};
$('#bCopiar').onclick = () => copiar($('#bResp').value);
$('#bCompartir').onclick = () => compartir($('#bResp').value);
// Escaneo con cámara solo si el navegador trae BarcodeDetector (sin librerías externas).
async function escanear(destino, info) {
  let st;
  try {
    const det = new BarcodeDetector({ formats: ['qr_code'] }), v = $('#bVideo');
    st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    destino.closest('section').append(v); v.hidden = false; v.srcObject = st; await v.play(); info.textContent = 'Apunta al QR…';
    for (let i = 0; i < 300; i++) { const c = await det.detect(v).catch(() => []); if (c.length) { destino.value = c[0].rawValue; info.textContent = 'QR leído ✓'; log('QR leído con la cámara'); break; } await dormir(150); }
    v.hidden = true;
  } catch (e) { info.textContent = 'No se pudo usar la cámara: pega el código.'; }
  if (st) st.getTracks().forEach(t => t.stop());
}
if ('BarcodeDetector' in window) { $('#bEscanear').hidden = $('#aEscanear').hidden = false; }
else $('#bScanInfo').textContent = 'Este navegador no lee QR con la cámara: pega el código que te compartieron.';
$('#bEscanear').onclick = () => escanear($('#bCod'), $('#bScanInfo'));
$('#aEscanear').onclick = () => escanear($('#aResp'), $('#aInfo'));

// ---------- Mensajes ----------
let TIPO = 'obra', PAQ = null, MAN = null, ACUSE = null;
let RMAN = null, RECIB = {}, RES = null, PRIMERO = true;
async function recibir(m) {
  if (m.t === 'hola') {
    PEER = { fp: await huella(m.jwk), jwk: m.jwk };
    if (PEER.fp !== m.fp) { log('Saludo con huella que no corresponde: ignorado'); PEER = null; return; }
    log('Saludo de ' + (m.rol === 'emisor' ? 'A' : 'B') + ' · llave ' + PEER.fp);
    if (ROL === 'emisor') $('#aPeerFp').textContent = PEER.fp;
    else { $('#bPeerFp').textContent = PEER.fp; $('#bConfiar').disabled = $('#bRevocar').disabled = false; }
    return;
  }
  if (ROL === 'emisor') {
    if (m.t === 'faltan') { log('B pide ' + m.lista.length + ' pieza(s): ' + m.lista.map(i => i + 1).join(', ')); await mandarPiezas(m.lista, false, true); enviar({ t: 'fin', id: MAN.id }); }
    if (m.t === 'acuse') await revisarAcuse(m);
    return;
  }
  if (m.t === 'man') {
    if (!RMAN || RMAN.id !== m.id) { RMAN = m; RECIB = {}; }
    log('Manifiesto: ' + m.n + ' piezas · raíz ' + m.raiz.slice(0, 12) + '…');
    $('#res').hidden = true; $('#bPedir').hidden = true; pintarRx();
  }
  if (m.t === 'pz' && RMAN && m.id === RMAN.id) {
    const ok = (await sha(b64(m.d))) === RMAN.hashes[m.i];
    if (ok) RECIB[m.i] = m.d; else log('Pieza ' + (m.i + 1) + ' con huella incorrecta: descartada');
    pintarRx();
  }
  if (m.t === 'fin' && RMAN && m.id === RMAN.id) {
    const faltan = faltantes();
    if (faltan.length) {
      log('Faltan ' + faltan.length + ' pieza(s)');
      if ($('#bAuto').checked) pedirFaltan(); else $('#bPedir').hidden = false;
      return;
    }
    await cerrarRx();
  }
}
const faltantes = () => [...Array(RMAN.n).keys()].filter(i => !RECIB[i]);
function pedirFaltan() { const l = faltantes(); $('#bPedir').hidden = true; if (enviar({ t: 'faltan', id: RMAN.id, lista: l })) log('Pedido a A: solo ' + l.length + ' pieza(s) que faltan'); }
$('#bPedir').onclick = pedirFaltan;
function pintarRx() {
  if (!RMAN) return; const n = Object.keys(RECIB).length;
  $('#bPiezas').innerHTML = [...Array(RMAN.n).keys()].map(i => `<span class="pz ${RECIB[i] ? 'ok' : 'lost'}">${i + 1}</span>`).join('');
  $('#bInfo').textContent = `${n} de ${RMAN.n} piezas recibidas.`;
}
async function cerrarRx() {
  const a = await armar(RMAN, RECIB); let r, paq = null;
  if (!a.ok) r = { ok: false, msg: a.msg, pasos: [{ n: 'Piezas', ok: false, d: a.msg }] };
  else { paq = a.paq; r = await verificar(paq); r.pasos.unshift({ n: 'Piezas y huella raíz', ok: true, d: RMAN.n + ' piezas · ' + RMAN.raiz.slice(0, 16) + '…' }); }
  RES = { r, paq, raiz: RMAN.raiz }; pintarRes(); log('Resultado: ' + (r.ok ? 'Verificado ✓' : 'ROTA ✗') + ' · ' + r.msg);
  const acuse = { app: 'phenom-2tel-acuse', receptor_fp: YO.fp, informe_hash: paq ? paq.hash : null, raiz: RMAN.raiz, veredicto: r.ok ? 'verificado' : 'rota', motivo: r.msg, nonce: hex(crypto.getRandomValues(new Uint8Array(12))), ts: new Date().toISOString() };
  const f = await firmar(acuse, YO); ACUSE = { acuse, ...f };
  if (enviar({ t: 'acuse', ...ACUSE })) { log('Acuse firmado enviado a A'); $('#bAcuse').textContent = 'Acuse firmado con la llave de este teléfono (' + YO.fp + ') y enviado a A.'; }
}
function pintarRes() {
  const { r, paq } = RES; $('#res').hidden = false;
  $('#resChip').textContent = r.ok ? 'Verificado ✓' : 'ROTA ✗'; $('#resChip').className = 'chip ' + (r.ok ? 'ok' : 'bad');
  const d = paq && paq.env && paq.env.datos;
  $('[data-p=s]').innerHTML = `<p>${r.ok ? 'El informe llegó completo, sin cambios y firmado por un emisor de confianza.' : 'No se puede confiar en este informe.'}</p><p class="muted">${esc(r.msg)}</p>` + (d ? `<p class="muted">${esc(d.tipo === 'techo' ? 'Garantía de techo · ' + d.cliente : 'Informe de obra · ' + d.obra)}</p>` : '');
  $('[data-p=d]').innerHTML = '<dl class="kv">' + r.pasos.map(p => `<dt>${p.ok ? '✓' : '✗'} ${esc(p.n)}</dt><dd>${esc(p.d)}</dd>`).join('') + '</dl>';
  $('[data-p=b]').innerHTML = `<pre>${esc(JSON.stringify({ resultado: r, raiz: RES.raiz, paquete: paq }, null, 2))}</pre>`;
}
$$('[role=tab]').forEach(t => t.onclick = () => { $$('[role=tab]').forEach(x => x.setAttribute('aria-selected', x === t)); $$('.view').forEach(v => v.hidden = v.dataset.p !== t.dataset.t); });
$('#bConfiar').onclick = () => { const c = lget(LS.conf); if (PEER && !c.some(x => x.fp === PEER.fp)) { c.push({ fp: PEER.fp, jwk: PEER.jwk }); lset(LS.conf, c); } log('Emisor ' + (PEER && PEER.fp) + ' agregado al llavero'); toast('Emisor de confianza'); };
$('#bRevocar').onclick = () => { const r = lget(LS.rev); if (PEER && !r.includes(PEER.fp)) { r.push(PEER.fp); lset(LS.rev, r); } log('Llave del emisor revocada en este teléfono'); toast('Llave revocada'); };

// ---------- Emisor: sellar, enviar, acuse ----------
function datosForm() {
  return TIPO === 'obra' ? { tipo: 'obra', obra: $('#oObra').value, avance: Number($('#oAvance').value), nota: $('#oNota').value, ejemplo: true }
    : { tipo: 'techo', cliente: $('#tCli').value, trabajo: $('#tTrab').value, anos: Number($('#tAnos').value), ejemplo: true };
}
function elegir(t) { TIPO = t; $$('[data-tipo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === t))); $$('[data-solo]').forEach(d => d.hidden = d.dataset.solo !== t); }
$$('[data-tipo]').forEach(b => b.onclick = () => elegir(b.dataset.tipo));
function pintarBotones() { $('#aEnviar').disabled = !(PAQ && abierto()); $('#aAlterar').disabled = $('#aRepetir').disabled = $('#aContinuar').disabled = !(PAQ && abierto() && MAN); }
$('#aSellar').onclick = async () => { PAQ = await sellar(datosForm(), YO); MAN = null; log('Informe sellado · huella ' + PAQ.hash.slice(0, 16) + '…'); $('#aInfo').textContent = 'Sellado. Huella ' + PAQ.hash.slice(0, 16) + '…'; pintarBotones(); };
async function mandarPiezas(lista, cortar, re) {
  for (const i of lista) {
    const p = MAN.piezas[i], el = $(`#aPiezas [data-i="${i}"]`);
    if (cortar && i % 3 === 1) { el.className = 'pz lost'; log('Pieza ' + (i + 1) + ' perdida (prueba: cortar conexión)'); continue; }
    if (!enviar({ t: 'pz', id: MAN.id, i, d: p.d })) { el.className = 'pz lost'; continue; }
    el.className = 'pz ok' + (re ? ' re' : ''); await dormir(25);
  }
}
async function enviarPaq(paq) {
  if (!abierto()) return toast('Sin conexión con B');
  ACUSE = null; $('#aAcuse').textContent = 'Esperando acuse…'; $('#aAcuse').className = 'chip'; $('#aAcuseInfo').textContent = '';
  MAN = await partir(paq); MAN.paq = paq;
  $('#aPiezas').innerHTML = MAN.piezas.map(p => `<span class="pz" data-i="${p.i}">${p.i + 1}</span>`).join('');
  enviar({ t: 'man', id: MAN.id, n: MAN.n, hashes: MAN.hashes, raiz: MAN.raiz });
  log('Enviando ' + MAN.n + ' piezas');
  await mandarPiezas(MAN.piezas.map(p => p.i), $('#aCortar').checked, false);
  enviar({ t: 'fin', id: MAN.id }); $('#aInfo').textContent = MAN.n + ' piezas enviadas.'; pintarBotones();
}
$('#aEnviar').onclick = () => enviarPaq(PAQ);
$('#aRepetir').onclick = () => enviarPaq(PAQ);
$('#aAlterar').onclick = () => { const p = JSON.parse(JSON.stringify(PAQ)); if (p.env.datos.tipo === 'obra') p.env.datos.avance = 100; else p.env.datos.anos = 10; log('Prueba: dato alterado después de sellar'); enviarPaq(p); };
$('#aDesconocida').onclick = async () => { const k = await nuevaLlave(); const p = await sellar(datosForm(), k); log('Prueba: firmado con llave desconocida ' + k.fp); enviarPaq(p); };
$('#aContinuar').onclick = () => { if (!MAN) return; enviar({ t: 'man', id: MAN.id, n: MAN.n, hashes: MAN.hashes, raiz: MAN.raiz }); enviar({ t: 'fin', id: MAN.id }); log('Continuar: B pedirá solo las piezas que le faltan'); };
async function revisarAcuse(m) {
  const pasos = [];
  const h = await sha(canon(m.acuse)); pasos.push(['huella', h === m.hash]);
  pasos.push(['llave de B', !!PEER && PEER.fp === m.acuse.receptor_fp]);
  pasos.push(['firma de B', !!PEER && await firmaOk(PEER.jwk, m.firma, m.hash)]);
  pasos.push(['mismo informe', !!MAN && m.acuse.raiz === MAN.raiz && m.acuse.informe_hash === MAN.paq.hash]);
  const ok = pasos.every(p => p[1]); ACUSE = { ...m, ok };
  $('#aAcuse').textContent = ok ? 'Acuse verificado ✓' : 'Acuse no válido ✗'; $('#aAcuse').className = 'chip ' + (ok ? 'ok' : 'bad');
  $('#aAcuseInfo').textContent = (ok ? 'B (' + m.acuse.receptor_fp + ') firmó que el informe llegó y su resultado fue: ' + (m.acuse.veredicto === 'verificado' ? 'Verificado ✓' : 'ROTA ✗') + ' · ' + m.acuse.motivo : 'Falló: ' + pasos.filter(p => !p[1]).map(p => p[0]).join(', '));
  log('Acuse de B: ' + (ok ? 'firma válida' : 'NO válido') + ' · veredicto ' + m.acuse.veredicto);
}

// ---------- Registro y guía ----------
$('#gCopiar').onclick = () => copiar(textoRegistro());
$('#gBorrar').onclick = () => { LOG.length = 0; TX = RX = 0; pintarBytes(); $('#gLog').textContent = ''; };
const CASOS = [['wifi', 'Los dos en la misma red wifi'], ['movil', 'Uno en wifi y otro con datos móviles'], ['avion', 'Modo avión a mitad del envío, reconectar y «Continuar envío»'], ['alterar', 'Alterar un dato: B debe mostrar ROTA ✗'], ['llave', 'Llave desconocida: B debe rechazarla']];
function pintarCasos() {
  const g = lget(LS.casos, {});
  $('#casos').innerHTML = CASOS.map(([k, t]) => `<div class="case"><p>${t}</p><label class="muted">Resultado<select data-caso="${k}"><option value="">Sin probar</option><option ${g[k] && g[k].r === 'funcionó' ? 'selected' : ''}>funcionó</option><option ${g[k] && g[k].r === 'falló' ? 'selected' : ''}>falló</option></select></label><label class="muted">Notas<textarea data-nota="${k}" rows="2">${esc(g[k] ? g[k].n : '')}</textarea></label></div>`).join('');
  $$('#casos select, #casos textarea').forEach(e => e.oninput = e.onchange = guardarCasos);
}
function guardarCasos() { const g = {}; CASOS.forEach(([k]) => g[k] = { r: $(`[data-caso=${k}]`).value, n: $(`[data-nota=${k}]`).value }); lset(LS.casos, g); }
const textoCasos = () => { const g = lget(LS.casos, {}); return 'Casos de prueba:\n' + CASOS.map(([k, t]) => `- ${t}: ${(g[k] && g[k].r) || 'sin probar'}${g[k] && g[k].n ? ' · ' + g[k].n : ''}`).join('\n'); };
$('#cCopiar').onclick = () => copiar(textoCasos() + '\n\n' + textoRegistro());

// ---------- Navegación ----------
function ir() {
  const h = (location.hash || '#inicio').slice(1); const s = $(`[data-screen="${h}"]`) ? h : 'inicio';
  $$('[data-screen]').forEach(x => x.hidden = x.dataset.screen !== s);
  $('#nav').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); scrollTo(0, 0);
}
addEventListener('hashchange', ir);
$('#menuBtn').onclick = () => { const n = $('#nav'); n.hidden = !n.hidden; $('#menuBtn').setAttribute('aria-expanded', String(!n.hidden)); };
ir(); pintarCasos(); pintarBytes();
window.phenom2tel = { ICE, sha, canon, LOG, listo: cargarLlave(), estado: () => ({ rol: ROL, dc: DC && DC.readyState, peer: PEER && PEER.fp, yo: YO && YO.fp, res: RES && { ok: RES.r.ok, msg: RES.r.msg }, acuse: ACUSE && { ok: ACUSE.ok, veredicto: ACUSE.acuse && ACUSE.acuse.veredicto }, recib: RMAN && Object.keys(RECIB).length, n: RMAN && RMAN.n, tx: TX, rx: RX }) };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
