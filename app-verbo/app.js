(() => {
'use strict';
const C = window.PHENOM_APP_CONFIG || {};
const KP = 'phenom_app_perfil_v1', KS = 'phenom_app_sesion_v1'; // mismas claves que app-prueba/app-limpia
const $ = id => document.getElementById(id);
const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = t => { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 2200); };
const el = (t, x, c) => { const e = document.createElement(t); if (x != null) e.textContent = x; if (c) e.className = c; return e; };
const kv = (dl, rows) => { dl.textContent = ''; rows.forEach(([k, v]) => dl.append(el('dt', k), el('dd', v))); };
const S = crypto.subtle, te = new TextEncoder();
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await S.digest('SHA-256', typeof s === 'string' ? te.encode(s) : s));
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
// JSON canónico: claves ordenadas, para que la misma palabra dé siempre la misma huella
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const SIG = { name: 'ECDSA', hash: 'SHA-256' };
let KEY = null, PUBJWK = null; // clave de ejemplo creada en este navegador (no exportable la privada)

/* perfil + Google (igual que app-limpia) */
const DEMO = { name: 'Usuario Demo', email: 'demo@ejemplo.test', org: 'Bodega de ejemplo', tipo: 'bodega', barrio: 'Washington Heights', tel: '', fuente: 'demo' };
const perfil = () => get(KP) || {};
const guardarPerfil = p => set(KP, Object.assign(perfil(), p));
function b64uJson(s) { return JSON.parse(new TextDecoder().decode(unb64u(s))); }
// Solo decodifica para rellenar. NO verifica la firma de Google: eso lo debe hacer un servidor.
function onGoogleCredential(resp) {
  let d; try { d = b64uJson(String(resp.credential).split('.')[1]); } catch (e) { toast('No se pudo leer la respuesta de Google'); return; }
  guardarPerfil({ name: d.name || '', email: d.email || '', picture: d.picture || '', fuente: 'google-sin-verificar' });
  set(KS, { modo: 'google', t: Date.now() }); location.hash = '#inicio'; render();
}
function initGoogle() {
  const id = String(C.GOOGLE_CLIENT_ID || '').trim(); if (!id) return;
  $('btnGoogleTxt').textContent = 'Cargando Google…';
  const s = el('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => { try { google.accounts.id.initialize({ client_id: id, callback: onGoogleCredential }); $('btnGoogle').hidden = true; google.accounts.id.renderButton($('gsiSlot'), { theme: 'filled_black', shape: 'pill', text: 'continue_with', locale: 'es' }); } catch (e) { $('btnGoogleTxt').textContent = 'Google no disponible'; } };
  s.onerror = () => { $('btnGoogleTxt').textContent = 'Google no disponible (¿sin internet?)'; };
  document.head.append(s);
}

/* Sellador: palabra → sello (SHA-256 + firma ECDSA P-256) → verificación */
const FECHA = '2026-11-01';
const DOCS = {
  palabra: { titulo: 'Frase sellada', doc: () => ({ tipo: 'palabra', frase: $('frase').value, autor: perfil().name || 'anónimo', fecha: FECHA }),
    simple: d => '«' + d.frase + '» — ' + d.autor + ', ' + d.fecha + '.', tamper: d => { d.frase = d.frase.replace(/\.?$/, ' (cambiado).'); } },
  obra: { titulo: 'Informe de obra', doc: () => ({ tipo: 'informe-obra', empresa: 'Subcontratista de ejemplo', obra: 'Techo, edificio de ejemplo', fecha: FECHA, horas: 6, trabajo: 'Impermeabilización de 40 m² terminada', fotos: 'sin fotos en la demo' }),
    simple: d => d.empresa + ' trabajó ' + d.horas + ' horas el ' + d.fecha + ': ' + d.trabajo.toLowerCase() + '.', tamper: d => { d.horas = 9; } },
  garantia: { titulo: 'Garantía de techo', doc: () => ({ tipo: 'garantia-techo', contratista: 'Techos de ejemplo', cliente: 'Cliente de ejemplo', direccion: 'Dirección de ejemplo', terminado: FECHA, anos: 5, cubre: 'Filtraciones en el área reparada', antes: '[foto antes: pendiente]', despues: '[foto después: pendiente]' }),
    simple: d => d.contratista + ' garantiza ' + d.anos + ' años desde el ' + d.terminado + ': ' + d.cubre.toLowerCase() + '.', tamper: d => { d.anos = 10; } },
  arte: { titulo: 'Certificado de autenticidad', doc: () => ({ tipo: 'arte', titulo: $('arteTit').value, autor: perfil().name || 'anónimo', archivo: ARTE.nombre, bytes: ARTE.bytes, sha256_archivo: ARTE.hash, fecha: FECHA }),
    simple: d => '«' + d.titulo + '» de ' + d.autor + '. Archivo ' + d.archivo + ' con huella ' + d.sha256_archivo.slice(0, 12) + '….', tamper: d => { d.sha256_archivo = 'f'.repeat(64); }, need: () => ARTE.hash ? '' : 'Primero elige un archivo.' }
};
const ARTE = { nombre: '', bytes: 0, hash: '' };
const SE = {};
function montar(box) {
  const k = box.dataset.k, s = SE[k] = { doc: null, sello: null, estado: null }, id = x => k + x;
  box.innerHTML = '<p class="chip" id="' + id('Chip') + '">Sin sellar</p>' +
    '<div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-v="s">Simple</button><button role="tab" aria-selected="false" data-v="d">Detallado</button><button role="tab" aria-selected="false" data-v="b">En bruto</button></div>' +
    '<div class="view" data-p="s"></div><dl class="view kv" data-p="d" hidden></dl><div class="view" data-p="b" hidden><pre></pre></div>' +
    '<div class="acts"><button class="pill" data-a="seal">Sellar</button><button class="pill ghost" data-a="ver" disabled>Verificar</button><button class="lnk" data-a="tam" disabled>Cambiar un dato (prueba)</button></div>' +
    '<p class="muted">Huella SHA-256 y firma ECDSA P-256 hechas en tu navegador con una clave de ejemplo. Detecta cambios; no prueba identidad ante terceros.</p>';
  box.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { box.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); box.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== b.dataset.v); }));
  const D = DOCS[k];
  box.querySelector('[data-a=seal]').addEventListener('click', async () => {
    const need = D.need && D.need(); if (need) { toast(need); return; }
    s.doc = D.doc(); const h = await sha(canon(s.doc)); const sig = b64u(await S.sign(SIG, KEY.privateKey, te.encode(h)));
    s.sello = { sha256: h, firma: sig, alg: 'ECDSA P-256 / SHA-256' }; s.estado = null; s.recalc = null; draw(box); toast('Sellado');
  });
  box.querySelector('[data-a=ver]').addEventListener('click', async () => {
    s.recalc = await sha(canon(s.doc)); let firma = false;
    try { firma = await S.verify(SIG, KEY.publicKey, unb64u(s.sello.firma), te.encode(s.recalc)); } catch (e) { firma = false; }
    s.estado = s.recalc === s.sello.sha256 && firma; draw(box);
  });
  box.querySelector('[data-a=tam]').addEventListener('click', () => { D.tamper(s.doc); s.estado = null; s.recalc = null; draw(box); toast('Dato cambiado (prueba). Pulsa Verificar.'); });
  draw(box);
}
function draw(box) {
  const k = box.dataset.k, s = SE[k], D = DOCS[k], c = $(k + 'Chip');
  c.className = 'chip' + (s.estado === true ? ' ok' : s.estado === false ? ' bad' : '');
  c.textContent = s.estado === true ? 'Verificado ✓' : s.estado === false ? 'ROTA ✗ · no verificado' : s.sello ? 'Sellado · sin verificar' : 'Sin sellar';
  const p = box.querySelector('[data-p=s]'); p.textContent = '';
  p.append(el('p', s.doc ? D.simple(s.doc) : 'Pulsa Sellar para crear el ' + D.titulo.toLowerCase() + '.'));
  if (s.estado != null) p.append(el('p', s.estado ? 'Nadie lo cambió desde que se selló.' : 'Cambió después de sellarse.', 'muted'));
  kv(box.querySelector('[data-p=d]'), s.doc ? Object.entries(s.doc).map(([a, b]) => [a, String(b)]).concat([['SHA-256', s.sello.sha256.slice(0, 16) + '…'], ['Firma', s.sello.firma.slice(0, 16) + '…'], ['Estado', c.textContent]]) : []);
  box.querySelector('[data-p=b] pre').textContent = s.doc ? JSON.stringify({ documento: s.doc, canonico: canon(s.doc), sello: s.sello, recalculado: s.recalc || null, clave_publica: PUBJWK }, null, 2) : '—';
  box.querySelector('[data-a=ver]').disabled = box.querySelector('[data-a=tam]').disabled = !s.sello;
  if (k === 'palabra') { $('p1').className = 'on'; $('p2').className = s.sello ? 'on' : ''; $('p3').className = s.estado === true ? 'on' : ''; }
  window.phenomVerbo.estados[k] = s.estado;
}
$('arteFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  ARTE.nombre = f.name; ARTE.bytes = f.size; ARTE.hash = await sha(await f.arrayBuffer()); // se lee en el teléfono; no se sube
  toast('Huella del archivo: ' + ARTE.hash.slice(0, 12) + '…');
});

/* pantallas */
const SCREENS = ['ingreso', 'inicio', 'palabra', 'ofertas', 'obra', 'garantia', 'arte', 'llave', 'torniquete', 'plan', 'perfil', 'pedir'];
function render() {
  let h = (location.hash || '').slice(1);
  if (!get(KS)) h = 'ingreso'; else if (!SCREENS.includes(h) || h === 'ingreso') h = 'inicio';
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.dataset.screen !== h);
  menu(false); $('menuBtn').hidden = h === 'ingreso';
  if (h === 'inicio') { const n = (perfil().name || '').trim(); $('hola').textContent = 'Hola, ' + (n ? n.split(/\s+/)[0] : 'bienvenido'); }
  if (h === 'plan') renderPlan(); if (h === 'perfil') renderPerfil(); if (h === 'pedir') renderPedir();
  const t = document.querySelector('.screen:not([hidden]) h1'); if (t) document.title = t.textContent + ' · Phenom (prueba)';
  window.scrollTo(0, 0);
}
function menu(on) { $('nav').hidden = !on; $('menuBtn').setAttribute('aria-expanded', on); }
const FALTA = () => [
  ['Google Client ID', String(C.GOOGLE_CLIENT_ID || '').trim() ? 'Configurado' : 'Lo creas tú: 8 pasos en GOOGLE-ID-PASOS.md'],
  ['WhatsApp', String(C.WHATSAPP || '').trim() ? 'Configurado' : 'Falta el número en config.js'],
  ['Dominio', String(C.DOMINIO || '').trim() ? 'Configurado' : 'Hoy vive en phersaa.github.io'],
  ['Precios', 'Por definir'],
  ['Stripe (modo prueba)', String(C.STRIPE_TEST_BACKEND || '').trim() ? 'Configurado' : 'Desplegar el backend de prueba'],
  ['Revisión legal', C.REVISION_LEGAL === true ? 'Hecha' : 'Términos, privacidad y reembolsos son borradores'],
  ['LLC y EIN', 'Con un contador (CPA) o abogado'],
  ['Imagen og / apple-touch', 'Subir imágenes (PNG); hoy solo hay SVG'],
  ['Clave maestra de invitaciones', 'Pendiente (MASTER_PUBLIC_JWK = null)'],
  ['Teléfonos reales', 'Probar en iPhone y Android reales'],
  ['Pilotos', '2–3 delis o subcontratistas']
];
const HECHO = [['Deli v1.17', 'Caja ordenada, auditoría, P2P'], ['Sitio de prueba', 'Gotera con foto, borradores legales'], ['app-prueba / app-limpia', 'PWA, perfil, Llave'], ['Torniquete', 'Simulación con fuentes'], ['App Verbo', 'Palabra → Sello → Verificación']];
function renderPlan() { kv($('falta'), FALTA()); kv($('hecho'), HECHO); }
const F = { name: 'fName', email: 'fEmail', org: 'fOrg', tipo: 'fTipo', barrio: 'fBarrio', tel: 'fTel' };
function renderPerfil() {
  const p = perfil(); for (const k in F) $(F[k]).value = p[k] || '';
  $('fuente').textContent = 'Perfil · ' + (p.fuente === 'demo' ? 'demo de ejemplo' : p.fuente === 'google-sin-verificar' ? 'Google sin verificar' : 'escrito por ti');
  kv($('gEstado'), [['Google', String(C.GOOGLE_CLIENT_ID || '').trim() ? 'Client ID configurado' : 'Client ID pendiente']]);
}
function renderPedir() {
  const p = perfil(), m = { pName: p.name, pOrg: p.org, pTel: p.tel };
  for (const id in m) if (!$(id).value && m[id]) $(id).value = m[id];
  const num = String(C.WHATSAPP || '').replace(/\D/g, ''); $('btnWs').disabled = !num; $('btnWs').textContent = num ? 'Enviar por WhatsApp' : 'WhatsApp · número pendiente';
}

/* Split Run (misma raíz que v1.5) */
const SR = { parts: [], hs: [], root: '', got: [] };
const srSt = (t, c) => { $('srSt').textContent = t; $('srSt').className = 'chip ' + (c || ''); };
const srDraw = () => kv($('srPieces'), SR.parts.map((p, i) => ['Pieza ' + (i + 1), SR.got[i] === null ? '— perdida' : '"' + SR.got[i] + '" #' + SR.hs[i].slice(0, 8)]));
$('srSplit').addEventListener('click', async () => { const m = $('srMsg').value || ' ', L = Math.ceil(m.length / 4); SR.parts = [0, 1, 2, 3].map(i => m.slice(i * L, (i + 1) * L)); SR.hs = await Promise.all(SR.parts.map(x => sha(x))); SR.root = await sha(SR.hs.join('')); SR.got = SR.parts.slice(); srDraw(); ['srDrop', 'srAlter', 'srResend', 'srVerify'].forEach(i => $(i).disabled = false); srSt('Raíz ' + SR.root.slice(0, 12) + '…'); });
$('srDrop').addEventListener('click', () => { const i = SR.got.findIndex(g => g !== null); if (i < 0) return; SR.got[i] = null; srDraw(); srSt('Se perdió la pieza ' + (i + 1), 'bad'); });
$('srAlter').addEventListener('click', () => { const i = SR.got.findIndex(g => g !== null); if (i < 0) return; SR.got[i] += '!'; srDraw(); srSt('Pieza ' + (i + 1) + ' alterada (prueba)', 'bad'); });
$('srResend').addEventListener('click', async () => { const fix = []; for (let i = 0; i < 4; i++) if (SR.got[i] === null || await sha(SR.got[i]) !== SR.hs[i]) { SR.got[i] = SR.parts[i]; fix.push(i + 1); } srDraw(); srSt(fix.length ? 'Reenviadas solo: ' + fix.join(', ') : 'No faltaba nada'); });
$('srVerify').addEventListener('click', async () => { if (SR.got.some(g => g === null)) { srSt('Falta una pieza', 'bad'); window.phenomVerbo.split = 'falta'; return; } const r = await sha((await Promise.all(SR.got.map(x => sha(x)))).join('')), ok = r === SR.root; srSt(ok ? 'Íntegro ✓' : 'Alterado ✗', ok ? 'ok' : 'bad'); window.phenomVerbo.split = ok ? 'ok' : 'alterado'; });

/* eventos */
$('menuBtn').addEventListener('click', () => menu($('nav').hidden));
addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
$('btnDemo').addEventListener('click', () => { if (!get(KP)) set(KP, DEMO); set(KS, { modo: 'demo', t: Date.now() }); location.hash = '#inicio'; render(); });
$('btnSalir').addEventListener('click', () => { localStorage.removeItem(KS); location.hash = '#ingreso'; render(); });
$('fPerfil').addEventListener('submit', e => { e.preventDefault(); const p = {}; for (const k in F) p[k] = $(F[k]).value.trim(); if (perfil().fuente !== 'google-sin-verificar') p.fuente = 'local'; guardarPerfil(p); $('perfilMsg').textContent = 'Guardado ✓'; });
$('btnBorrar').addEventListener('click', () => { if (!confirm('¿Borrar tu perfil y salir? Solo afecta a este teléfono.')) return; localStorage.removeItem(KP); localStorage.removeItem(KS); location.hash = '#ingreso'; render(); });
$('fPedido').addEventListener('submit', e => { e.preventDefault(); const num = String(C.WHATSAPP || '').replace(/\D/g, ''); if (!num) return; const t = [$('pTema').value + ' (app Verbo, prueba)', 'Nombre: ' + $('pName').value, 'Negocio: ' + $('pOrg').value, 'Tel: ' + $('pTel').value, 'Detalle: ' + $('pDet').value].join('\n'); const w = window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(t), '_blank'); if (w) w.opener = null; });
addEventListener('hashchange', render);
window.phenomVerbo = { onGoogleCredential, sha, canon, estados: {}, listo: false };
render(); initGoogle();
S.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']).then(async k => {
  KEY = k; PUBJWK = await S.exportKey('jwk', k.publicKey); delete PUBJWK.key_ops; delete PUBJWK.ext;
  document.querySelectorAll('.sello').forEach(montar); window.phenomVerbo.listo = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
