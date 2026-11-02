// Phenom · Pago en testnet (VERSIÓN DE PRUEBA). XRPL TESTNET, sin dinero real. Recibo firmado con ECDSA P-256 (mismo motor que app-facil).
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };
const LS = { conf: 'phenom_pago_confianza_v1', rev: 'phenom_pago_revocadas_v1', vistos: 'phenom_pago_nonces_v1', bandeja: 'phenom_pago_bandeja_v1', nombre: 'phenom_pago_nombre_v1' };
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
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open('phenom-pago', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
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

// ---------- XRPL testnet (xrpl.js local, se carga solo cuando hace falta) ----------
const SERVIDORES = ['wss://s.altnet.rippletest.net:51233', 'wss://testnet.xrpl-labs.com'];
const FAUCET = 'faucet.altnet.rippletest.net';
const EXPLORADOR = h => 'https://testnet.xrpl.org/transactions/' + h;
const SEM = 'phenom_pago_PRUEBA_semilla_testnet_v1', SEM_R = 'phenom_pago_PRUEBA_semilla_receptor_testnet_v1', RECIBOS = 'phenom_pago_recibos_v1';
let XL = null;
function cargarXRPL() { return XL || (XL = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'vendor/xrpl-latest-min.js'; s.onload = () => ok(window.xrpl); s.onerror = () => { XL = null; ko(new Error('no se pudo cargar xrpl.js')); }; document.head.append(s); })); }
async function conectar() {
  const x = await cargarXRPL(); let ult;
  for (const u of SERVIDORES) { const c = new x.Client(u, { connectionTimeout: 6000 }); try { await c.connect(); window.phenomPago.servidor = u; return c; } catch (e) { ult = e; try { await c.disconnect(); } catch {} } }
  throw ult || new Error('sin conexión');
}
function walletDe(k) { const s = localStorage.getItem(k); if (s) return xrpl.Wallet.fromSeed(s); const w = xrpl.Wallet.generate(); localStorage.setItem(k, w.seed); return w; } // semilla de PRUEBA: solo local, nunca se muestra
const txCampos = t => t.tx_json ? { ...t.tx_json, meta: t.meta, validated: t.validated, ledger_index: t.ledger_index, hash: t.hash } : t;
const baseDe = r => { const { memo_sha256, tx, ledger, red, ...b } = r; return b; };

// ---------- Pantallas ----------
function ver(s) { $$('[data-s]').forEach(x => x.hidden = x.dataset.s !== s); $('#atras').hidden = s === 'inicio'; scrollTo(0, 0); if (s === 'recibos') pintarRecibos(); if (s === 'ayuda') $('#aFp').textContent = YO ? YO.fp : ''; if (s === 'pagar') prepPagar(); }
$('#atras').onclick = () => ver('inicio');
$('#bPagar').onclick = () => ver('pagar'); $('#bRecibir').onclick = () => ver('recibir'); $('#bRecibos').onclick = () => ver('recibos'); $('#bAyuda').onclick = () => ver('ayuda');
$('#aBorrar').onclick = () => { if (confirm('¿Borrar la billetera de PRUEBA de este teléfono? (testnet, sin dinero real)')) { localStorage.removeItem(SEM); localStorage.removeItem(SEM_R); toast('Billetera de prueba borrada'); } };
async function prepPagar() {
  if (lget(LS.nombre, '')) $('#pNombre').value = lget(LS.nombre, '');
  if (!$('#pDest').value) { try { await cargarXRPL(); $('#pDest').value = xrpl.Wallet.generate().classicAddress; } catch { $('#pDestInfo').textContent = 'No se pudo preparar una dirección. Pega una dirección testnet.'; } }
}

// ---------- Pagar ----------
const PASOS = ['Conectando a XRPL testnet', 'Preparando billetera de PRUEBA', 'Pidiendo XRP de prueba al grifo (solo la primera vez)', 'Enviando el pago con la huella del recibo', 'Validado en el ledger', 'Recibo firmado'];
function prog(i, err) { $('#prog').innerHTML = PASOS.map((p, j) => `<li class="${j < i ? 'ok' : ''}">${j < i ? '✓ ' : j === i && !err ? '… ' : ''}${p}</li>`).join(''); $('#progErr').textContent = err || ''; $('#progReintentar').hidden = !err; }
let RECIBO_LINK = '', ULT = null;
$('#progReintentar').onclick = () => $('#fPagar').requestSubmit();
$('#fPagar').onsubmit = async e => {
  e.preventDefault(); const t0 = performance.now(); ver('progreso'); prog(0); let c, i = 0;
  const n = $('#pNombre').value.trim().slice(0, 24) || 'Pagador (prueba)'; lset(LS.nombre, n);
  try {
    await LISTO; c = await conectar(); prog(i = 1);
    const dest = $('#pDest').value.trim(), monto = String(Math.max(1, Math.min(100, Math.round(Number($('#pMonto').value) || 10))));
    if (!xrpl.isValidClassicAddress(dest)) throw new Error('La dirección del receptor no es válida.');
    const w = walletDe(SEM); if (w.classicAddress === dest) throw new Error('No puedes pagarte a ti mismo.');
    prog(i = 2); let saldo = 0; try { saldo = Number((await c.request({ command: 'account_info', account: w.classicAddress, ledger_index: 'validated' })).result.account_data.Balance) / 1e6; } catch {}
    if (saldo < Number(monto) + 5) await c.fundWallet(w, { faucetHost: FAUCET });
    prog(i = 3);
    const base = { de: { n, cuenta: w.classicAddress, firma_fp: YO.fp }, para: { n: $('#pPara').value.trim().slice(0, 24) || 'Receptor (prueba)', cuenta: dest }, monto, moneda: 'XRP testnet', concepto: $('#pConcepto').value.slice(0, 60), nonce: hex(crypto.getRandomValues(new Uint8Array(12))), fecha: new Date().toISOString() };
    const memo = await sha(canon(base));
    const tx = await c.autofill({ TransactionType: 'Payment', Account: w.classicAddress, Destination: dest, Amount: xrpl.xrpToDrops(monto), Memos: [{ Memo: { MemoType: xrpl.convertStringToHex('phenom/recibo-sha256'), MemoData: memo.toUpperCase() } }] });
    const res = txCampos((await c.submitAndWait(w.sign(tx).tx_blob)).result);
    if (res.meta.TransactionResult !== 'tesSUCCESS') throw new Error('El ledger respondió ' + res.meta.TransactionResult);
    prog(i = 5);
    const recibo = { ...base, memo_sha256: memo, tx: res.hash, ledger: res.ledger_index, red: 'testnet' };
    const f = await firmar(recibo, YO);
    RECIBO_LINK = BASE + '#r=' + await codificar({ k: 'recibo', r: recibo, jwk: { x: YO.jwk.x, y: YO.jwk.y }, hash: f.hash, firma: f.firma });
    reciboAdd({ id: res.hash, dir: 'pagado', monto, para: base.para.n, ts: base.fecha, estado: 'Pagado', hash: f.hash });
    const ms = Math.round(performance.now() - t0); window.phenomPago.ultimoPago = { tx: res.hash, ledger: res.ledger_index, ms, link: RECIBO_LINK, desde: w.classicAddress, para: dest };
    mostrar({ ok: true, big: 'Pagado ✓', msg: monto + ' XRP de prueba enviados a ' + base.para.n + ' en testnet (' + (ms / 1000).toFixed(1) + ' s). Comparte el recibo firmado.', recibo, pasos: [{ n: 'Resultado', ok: true, d: 'tesSUCCESS, validado' }], modo: 'pagador' });
  } catch (err) { prog(i, 'No se pudo: ' + (err && err.message || err) + '. Revisa tu internet y reintenta.'); window.phenomPago.error = String(err && err.message || err); }
  finally { try { c && await c.disconnect(); } catch {} }
};
$('#vCompartir').onclick = async () => toast('Recibo: ' + await compartir('Recibo de pago (TESTNET, prueba)', RECIBO_LINK, 'recibo-testnet.phenom'));
$('#vCopiar').onclick = () => copiar(RECIBO_LINK);
$('#vArchivo').onclick = () => descargar('recibo-testnet.phenom', RECIBO_LINK);

// ---------- Mostrar ----------
function mostrar(r) {
  ver('recibo'); $('#vBig').textContent = r.big; $('#vBig').className = 'verdict ' + (r.ok ? 'ok' : r.warn ? 'warn' : 'bad'); $('#vMsg').textContent = r.msg;
  const R = r.recibo;
  $('#vKv').innerHTML = R ? `<dt>De</dt><dd>${esc(R.de.n)}</dd><dt>Para</dt><dd>${esc(R.para.n)}</dd><dt>Monto</dt><dd>${esc(R.monto)} ${esc(R.moneda)}</dd><dt>Concepto</dt><dd>${esc(R.concepto)}</dd><dt>Transacción</dt><dd>${esc(String(R.tx).slice(0, 16))}…</dd><dt>Ledger</dt><dd>${esc(R.ledger)}</dd><dt>Fecha</dt><dd>${esc(new Date(R.fecha).toLocaleString('es'))}</dd>` : '';
  $('#vExp').hidden = !(R && /^[0-9A-F]{64}$/.test(R.tx)); if (R) $('#vExp').href = EXPLORADOR(R.tx);
  $('#vPasos').innerHTML = (r.pasos || []).map(p => `<dt>${p.ok ? '✓' : '✗'} ${esc(p.n)}</dt><dd>${esc(p.d)}</dd>`).join('') + (R ? `<dt>Cuenta pagadora</dt><dd>${esc(R.de.cuenta)}</dd><dt>Cuenta receptora</dt><dd>${esc(R.para.cuenta)}</dd><dt>Huella en el Memo</dt><dd>${esc(R.memo_sha256)}</dd><dt>Hash de la transacción</dt><dd>${esc(R.tx)}</dd>` : '');
  const pag = r.modo === 'pagador'; ['#vCompartir', '#vCopiar', '#vArchivo'].forEach(s => $(s).hidden = !pag); $('#vConfirmar').hidden = r.modo !== 'receptor';
  window.phenomPago.ultimo = { ok: r.ok, big: r.big, msg: r.msg, warn: !!r.warn, pasos: r.pasos };
}

// ---------- Verificar recibo ----------
async function abrirTexto(t) {
  await LISTO; const e = (String(t || '').trim().replace(/\s+/g, '').match(/(?:^|#)([ra])=([A-Za-z0-9_-]+)$/) || []);
  if (!e[1]) return mostrar({ ok: false, big: 'No se reconoce', msg: 'Esto no es un recibo de Phenom o está incompleto.' });
  let o; try { o = await decodificar(e[2]); } catch { return mostrar({ ok: false, big: 'Llegó cortado ✗', msg: 'El enlace llegó incompleto. Pide que te lo envíen como archivo.' }); }
  if (e[1] === 'r' && o.k === 'recibo') return verificarRecibo(o);
  if (e[1] === 'a' && o.k === 'acuse') return abrirAcuse(o);
  mostrar({ ok: false, big: 'No se reconoce', msg: 'Contenido no reconocido.' });
}
async function verificarRecibo(o) {
  const R = o.r || {}, pasos = [], paso = (n, ok, d) => (pasos.push({ n, ok, d: d || '' }), ok);
  const jwk = { crv: 'P-256', kty: 'EC', x: o.jwk && o.jwk.x, y: o.jwk && o.jwk.y }, fp = await huella(jwk);
  const mal = m => mostrar({ ok: false, big: 'Cambió ✗', msg: m, recibo: R.de ? R : null, pasos });
  if (!paso('Contenido del recibo', await sha(canon(R)) === o.hash)) return mal('El recibo cambió después de firmarse.');
  if (!paso('Firma del recibo', await firmaOk(jwk, o.firma, o.hash), 'código ' + fp)) return mal('La firma del recibo no es válida.');
  if (!paso('Firma de quien pagó', R.de && R.de.firma_fp === fp, fp)) return mal('La firma no corresponde a quien dice pagar.');
  if (!paso('Huella del Memo', await sha(canon(baseDe(R))) === R.memo_sha256)) return mal('La huella del recibo no coincide con sus datos.');
  if (R.red !== 'testnet') return mal('Este recibo no es de testnet.');
  ULT = { o, R };
  let c, t;
  try { c = await conectar(); t = txCampos((await c.request({ command: 'tx', transaction: R.tx })).result); }
  catch (err) {
    try { c && await c.disconnect(); } catch {}
    const nf = /txnNotFound|not found/i.test(String(err && (err.data && err.data.error || err.message)));
    if (nf) { paso('Pago en testnet', false, 'no existe'); return mal('La firma es válida, pero ese pago no existe en testnet (o la testnet se reinició).'); }
    paso('Pago en testnet', false, 'sin conexión: no comprobado');
    reciboAdd({ id: R.tx, dir: 'recibido', monto: R.monto, de: R.de.n, ts: new Date().toISOString(), estado: 'Solo firma', hash: o.hash });
    return mostrar({ ok: false, warn: true, big: 'Firma válida · pago sin comprobar', msg: 'Sin conexión: se verificó SOLO la firma del recibo, NO el pago en el ledger de testnet. Vuelve a abrirlo con internet.', recibo: R, pasos, modo: 'receptor' });
  }
  try { await c.disconnect(); } catch {}
  const memo = ((t.Memos || [])[0] || {}).Memo || {};
  const da = t.meta && t.meta.delivered_amount;
  const ch = [['Validado en el ledger', t.validated === true], ['Resultado tesSUCCESS', t.meta && t.meta.TransactionResult === 'tesSUCCESS'], ['Es un pago', t.TransactionType === 'Payment'],
    ['Cuenta pagadora', t.Account === R.de.cuenta], ['Cuenta receptora', t.Destination === R.para.cuenta], ['Monto entregado', da === String(Math.round(Number(R.monto) * 1e6))],
    ['Huella en el Memo', String(memo.MemoData || '').toLowerCase() === R.memo_sha256], ['Ledger', Number(t.ledger_index) === Number(R.ledger)]];
  const malos = ch.filter(([n, ok]) => !paso(n, ok)).map(x => x[0].toLowerCase());
  if (malos.length) return mal('La firma es válida, pero el pago en testnet no coincide: ' + malos.join(', ') + '.');
  const mio = localStorage.getItem(SEM_R) && xrpl.Wallet.fromSeed(localStorage.getItem(SEM_R)).classicAddress === R.para.cuenta;
  reciboAdd({ id: R.tx, dir: 'recibido', monto: R.monto, de: R.de.n, ts: new Date().toISOString(), estado: 'Verificado', hash: o.hash });
  mostrar({ ok: true, big: 'Verificado ✓', msg: 'Firma válida y el pago de ' + R.monto + ' XRP de prueba está validado en testnet, con la huella del recibo en el Memo.' + (mio ? ' Llegó a tu billetera de prueba.' : ''), recibo: R, pasos, modo: 'receptor' });
}
$('#vConfirmar').onclick = async () => {
  const { o, R } = ULT; const st = (window.phenomPago.ultimo || {}).ok ? 'verificado' : 'solo_firma';
  const a = { k: 'acuse', v: 1, de: { n: lget(LS.nombre, '') || R.para.n, fp: YO.fp, jwk: { x: YO.jwk.x, y: YO.jwk.y } }, recibo_hash: o.hash, tx: R.tx, veredicto: st, nonce: hex(crypto.getRandomValues(new Uint8Array(12))), ts: new Date().toISOString() };
  const f = await firmar(a, YO); const L = BASE + '#a=' + await codificar({ k: 'acuse', acuse: a, hash: f.hash, firma: f.firma }); window.phenomPago.acuse = L;
  const m = await compartir('Confirmación de recibo (TESTNET, prueba)', L, 'confirmacion-testnet.phenom'); if (m === 'copiado') descargar('confirmacion-testnet.phenom', L);
  reciboSet(R.tx, 'recibido', x => x.estado = 'Confirmado'); toast(m === 'cancelado' ? 'No se envió' : 'Confirmación lista');
};
async function abrirAcuse(o) {
  const a = o.acuse || {}, pasos = [], paso = (n, ok, d) => (pasos.push({ n, ok, d: d || '' }), ok);
  const jwk = { crv: 'P-256', kty: 'EC', x: a.de && a.de.jwk.x, y: a.de && a.de.jwk.y };
  const mal = m => mostrar({ ok: false, big: 'Confirmación no válida ✗', msg: m, pasos });
  if (!paso('Contenido', await sha(canon(a)) === o.hash)) return mal('La confirmación cambió después de firmarse.');
  if (!paso('Firma', await firmaOk(jwk, o.firma, o.hash), await huella(jwk))) return mal('La firma de la confirmación no es válida.');
  const x = lget(RECIBOS).find(y => y.dir === 'pagado' && y.id === a.tx && y.hash === a.recibo_hash);
  if (!paso('Es de un recibo tuyo', !!x)) return mal('No corresponde a ningún recibo emitido desde este teléfono.');
  reciboSet(a.tx, 'pagado', y => y.estado = a.veredicto === 'verificado' ? 'Confirmado' : 'Confirmado (solo firma)');
  mostrar({ ok: true, big: 'Recibo confirmado ✓', msg: a.de.n + ' firmó que recibió tu recibo' + (a.veredicto === 'verificado' ? ' y verificó el pago en testnet.' : ', pero lo verificó sin conexión (solo la firma).'), pasos });
}
$('#rAbrir').onclick = () => abrirTexto($('#rTexto').value);
$('#rArchivo').onchange = async () => { const f = $('#rArchivo').files[0]; if (!f) return; const t = await f.text(); $('#rArchivo').value = ''; abrirTexto(t); };
$('#rDirCrear').onclick = async () => { try { await cargarXRPL(); $('#rDir').textContent = walletDe(SEM_R).classicAddress; } catch { toast('No se pudo cargar'); } };
$('#rDirCopiar').onclick = () => $('#rDir').textContent.startsWith('r') && copiar($('#rDir').textContent);

// ---------- Mis recibos ----------
const RANGO = { 'Solo firma': 1, Verificado: 2, Confirmado: 3 };
function reciboAdd(e) { const prev = lget(RECIBOS).find(x => x.id === e.id && x.dir === e.dir); if (prev && (RANGO[prev.estado] || 0) > (RANGO[e.estado] || 0)) return; const b = lget(RECIBOS).filter(x => !(x.id === e.id && x.dir === e.dir)); b.unshift(e); lset(RECIBOS, b.slice(0, 100)); }
function reciboSet(id, dir, f) { const b = lget(RECIBOS); const x = b.find(y => y.id === id && y.dir === dir); if (x) { f(x); lset(RECIBOS, b); } }
function pintarRecibos() { const b = lget(RECIBOS); $('#lista').innerHTML = b.length ? b.map(x => `<li><span>${x.dir === 'pagado' ? '↑ Pagado a ' + esc(x.para) : '↓ De ' + esc(x.de)} · ${esc(x.monto)} XRP testnet<br><span class="muted">${esc(new Date(x.ts).toLocaleString('es'))}</span></span><span class="est ${/Confirmado|Verificado/.test(x.estado) ? 'Confirmado' : ''}">${esc(x.estado)}</span></li>`).join('') : '<li class="muted">Todavía nada.</li>'; }

// ---------- Arranque ----------
window.phenomPago = { sha, canon, codificar, decodificar, ultimo: null, SERVIDORES, firmar: o => firmar(o, YO), yo: () => YO && { fp: YO.fp, x: YO.jwk.x, y: YO.jwk.y } };
const LISTO = cargarLlave(); window.phenomPago.listo = LISTO;
function ir() { const h = location.hash; if (/^#[ra]=/.test(h)) { history.replaceState(null, '', BASE); abrirTexto(h); return; } ver('inicio'); }
addEventListener('hashchange', ir); ir();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
