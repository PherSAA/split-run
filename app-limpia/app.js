(() => {
'use strict';
const C = window.PHENOM_APP_CONFIG || {};
const KP = 'phenom_app_perfil_v1', KS = 'phenom_app_sesion_v1'; // mismas claves que app-prueba: comparten perfil
const $ = id => document.getElementById(id);
const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = t => { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 2200); };
const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
const kv = (dl, rows) => { dl.textContent = ''; rows.forEach(([k, v]) => dl.append(el('dt', k), el('dd', v))); };

/* perfil */
const DEMO = { name: 'Usuario Demo', email: 'demo@ejemplo.test', org: 'Bodega de ejemplo', tipo: 'bodega', barrio: 'Washington Heights', tel: '', idioma: 'es', fuente: 'demo' };
const perfil = () => get(KP) || {};
const guardarPerfil = p => set(KP, Object.assign(perfil(), p));

/* Google (solo si hay CLIENT ID en config.js) */
function b64uJson(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)))); }
// Solo decodifica para rellenar. NO verifica la firma: eso lo debe hacer un servidor.
function onGoogleCredential(resp) {
  let d; try { d = b64uJson(String(resp.credential).split('.')[1]); } catch (e) { toast('No se pudo leer la respuesta de Google'); return; }
  guardarPerfil({ name: d.name || '', email: d.email || '', picture: d.picture || '', fuente: 'google-sin-verificar' });
  set(KS, { modo: 'google', t: Date.now() }); location.hash = '#inicio'; render();
}
function initGoogle() {
  const id = String(C.GOOGLE_CLIENT_ID || '').trim(); if (!id) return;
  $('btnGoogleTxt').textContent = 'Cargando Google…';
  const s = el('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => { try { google.accounts.id.initialize({ client_id: id, callback: onGoogleCredential }); $('btnGoogle').hidden = true; google.accounts.id.renderButton($('gsiSlot'), { theme: 'filled_black', shape: 'pill', text: 'continue_with', locale: 'es' }); $('authNote').textContent = 'Aviso: solo se leen nombre, correo y foto para rellenar formularios. Sin verificación en servidor todavía.'; } catch (e) { $('btnGoogleTxt').textContent = 'Google no disponible'; } };
  s.onerror = () => { $('btnGoogleTxt').textContent = 'Google no disponible (¿sin internet?)'; };
  document.head.append(s);
}

/* pantallas */
const SCREENS = ['ingreso', 'inicio', 'recibo', 'deli', 'obra', 'llave', 'plan', 'perfil', 'pedir'];
function render() {
  let h = (location.hash || '').slice(1);
  if (!get(KS)) h = 'ingreso'; else if (!SCREENS.includes(h) || h === 'ingreso') h = 'inicio';
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.dataset.screen !== h);
  menu(false); $('menuBtn').hidden = h === 'ingreso';
  if (h === 'inicio') renderInicio(); if (h === 'plan') renderPlan(); if (h === 'perfil') renderPerfil(); if (h === 'pedir') renderPedir(); if (h === 'recibo') rDraw();
  window.scrollTo(0, 0);
  const t = document.querySelector('.screen:not([hidden]) h1'); if (t) document.title = t.textContent + ' · Phenom (prueba)';
}
function menu(on) { $('nav').hidden = !on; $('menuBtn').setAttribute('aria-expanded', on); }
function renderInicio() {
  const p = perfil(), n = (p.name || '').trim();
  $('hola').textContent = 'Hola, ' + (n ? n.split(/\s+/)[0] : 'bienvenido');
  kv($('estado'), [['Modo', 'Prueba · datos de ejemplo'], ['Conexión', navigator.onLine ? 'En línea' : 'Sin internet (funciona igual)'], ['Perfil', p.fuente === 'demo' ? 'Demo' : p.fuente === 'google-sin-verificar' ? 'Google (sin verificar)' : 'Local'], ['Google ID', String(C.GOOGLE_CLIENT_ID || '').trim() ? 'Configurado' : 'Pendiente · lo creas tú']]);
}
const PLAN = {
  hecho: [['Antes de v1', 'La llave y Split Run'], ['v1.1–v1.3', 'Envío verificado con huella'], ['v1.4–v1.6', 'Verificadores 2 de 3 y Split Run'], ['v1.7–v1.9', 'P2P e invitaciones firmadas'], ['v1.10–v1.13', 'Phenom Deli: caja, inventario, auditoría'], ['v1.14–v1.16', 'Vistas claras, Stripe modo prueba, ofertas'], ['v1.17', 'Deli ordenado'], ['App limpia', 'Este diseño (prueba)']],
  prueba: [['Pagos', 'Stripe modo prueba, sin cobros reales'], ['Sitio', 'Términos y privacidad (borradores)'], ['Apps', 'app-prueba y app-limpia']],
  falta: [['Empresa', 'LLC y EIN'], ['Web', 'Dominio propio'], ['Legal', 'Revisión de un abogado'], ['Pagos', 'Pagos reales'], ['Campo', 'Pruebas con clientes reales']]
};
function renderPlan() { kv($('hecho'), PLAN.hecho); kv($('prueba'), PLAN.prueba); kv($('falta'), PLAN.falta); }
const F = { name: 'fName', email: 'fEmail', org: 'fOrg', tipo: 'fTipo', barrio: 'fBarrio', tel: 'fTel' };
function renderPerfil() { const p = perfil(); for (const k in F) $(F[k]).value = p[k] || ''; $('fuente').textContent = 'Perfil · ' + (p.fuente === 'demo' ? 'demo de ejemplo' : p.fuente === 'google-sin-verificar' ? 'Google sin verificar' : 'escrito por ti'); }
function renderPedir() {
  const p = perfil(), m = { pName: p.name, pOrg: p.org, pTel: p.tel, pBarrio: p.barrio };
  for (const id in m) if (!$(id).value && m[id]) $(id).value = m[id];
  const num = String(C.WHATSAPP || '').replace(/\D/g, ''); $('btnWs').disabled = !num; $('btnWs').textContent = num ? 'Enviar por WhatsApp' : 'WhatsApp · número pendiente';
}

/* recibo verificado: SHA-256 con WebCrypto */
const te = new TextEncoder();
const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s))), b => b.toString(16).padStart(2, '0')).join('');
const usd = c => '$' + (c / 100).toFixed(2);
const EJ = {
  deli: () => ({ tipo: 'venta-deli', negocio: 'Bodega de ejemplo', fecha: '2026-11-01T09:30:00-05:00', items: [{ n: 'Café', c: 2, p: 175 }, { n: 'Sándwich de huevo', c: 1, p: 550 }, { n: 'Agua', c: 1, p: 125 }], total: 1025, pago: 'efectivo (ejemplo)' }),
  obra: () => ({ tipo: 'informe-obra', negocio: 'Subcontratista de ejemplo', fecha: '2026-11-01T09:30:00-05:00', items: [{ n: 'Foto techo antes', c: 1, p: 0 }, { n: 'Foto techo después', c: 1, p: 0 }, { n: 'Horas trabajadas', c: 6, p: 0 }], total: 0, nota: 'Impermeabilización terminada (ejemplo)' })
};
const R = { kind: 'deli', doc: EJ.deli(), sello: null, estado: null, vista: 'simple' };
const canon = d => JSON.stringify(d, Object.keys(d).concat(['n', 'c', 'p']).filter((k, i, a) => a.indexOf(k) === i));
function rDraw() {
  const d = R.doc, deli = d.tipo === 'venta-deli';
  $('rTitle').textContent = deli ? 'Venta Deli' : 'Informe de obra';
  $('rTipo').textContent = deli ? 'Usar informe de obra' : 'Usar venta Deli';
  const c = $('rChip'); c.className = 'chip' + (R.estado === true ? ' ok' : R.estado === false ? ' bad' : '');
  c.textContent = R.estado === true ? 'Verificado ✓' : R.estado === false ? 'No verificado ✗' : R.sello ? 'Sellado · sin verificar' : 'Sin sellar';
  const s = $('vSimple'); s.textContent = '';
  s.append(el('p', deli ? d.negocio + ' vendió ' + d.items.map(i => i.n.toLowerCase() + ' ×' + i.c).join(', ') + ' por ' + usd(d.total) + '.' : d.negocio + ' entregó: ' + d.items.map(i => i.n.toLowerCase()).join(', ') + '.'));
  s.append(el('p', R.estado === true ? 'Nadie cambió este recibo desde que se selló.' : R.estado === false ? 'Este recibo cambió después de sellarse.' : R.sello ? 'Sellado. Pulsa Verificar para comprobarlo.' : 'Todavía no está sellado.', 'muted'));
  kv($('vDet'), [['Tipo', d.tipo], ['Negocio', d.negocio], ['Fecha', d.fecha]].concat(d.items.map(i => [i.n, i.c + (deli ? ' × ' + usd(i.p) : '')]), [['Total', usd(d.total)], ['Huella', R.sello ? R.sello.slice(0, 16) + '…' : '—'], ['Estado', c.textContent]]));
  $('rJson').textContent = JSON.stringify(d, null, 2);
  $('rHash').textContent = R.sello ? 'sellado:   ' + R.sello + (R.recalc ? '\nrecalculado: ' + R.recalc : '') : '—';
  $('rVerify').disabled = $('rTamper').disabled = !R.sello;
  window.phenomLimpia.recibo = { estado: R.estado, sello: R.sello };
}
function vista(v) { R.vista = v; document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.v === v)); $('vSimple').hidden = v !== 'simple'; $('vDet').hidden = v !== 'detallado'; $('vBruto').hidden = v !== 'bruto'; }
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => vista(b.dataset.v)));
$('rSeal').addEventListener('click', async () => { R.doc = EJ[R.kind](); R.sello = await sha(canon(R.doc)); R.recalc = null; R.estado = null; rDraw(); toast('Recibo sellado'); });
$('rVerify').addEventListener('click', async () => { R.recalc = await sha(canon(R.doc)); R.estado = R.recalc === R.sello; rDraw(); });
$('rTamper').addEventListener('click', () => { if (R.doc.tipo === 'venta-deli') R.doc.total -= 100; else R.doc.items[2].c = 8; R.estado = null; R.recalc = null; rDraw(); toast('Dato cambiado (prueba). Pulsa Verificar.'); });
$('rTipo').addEventListener('click', () => { R.kind = R.kind === 'deli' ? 'obra' : 'deli'; R.doc = EJ[R.kind](); R.sello = R.estado = R.recalc = null; rDraw(); });
$('aObra').addEventListener('click', () => { R.kind = 'obra'; R.doc = EJ.obra(); R.sello = R.estado = R.recalc = null; });

/* Split Run (misma raíz que v1.5: sha de las huellas unidas) */
const SR = { parts: [], hs: [], root: '', got: [] };
const srSt = (t, cls) => { $('srSt').textContent = t; $('srSt').className = 'chip ' + (cls || ''); };
const srDraw = () => kv($('srPieces'), SR.parts.map((p, i) => ['Pieza ' + (i + 1), SR.got[i] === null ? '— perdida' : '"' + SR.got[i] + '" #' + SR.hs[i].slice(0, 8)]));
const srBtns = on => ['srDrop', 'srAlter', 'srResend', 'srVerify'].forEach(id => $(id).disabled = !on);
$('srSplit').addEventListener('click', async () => { const m = $('srMsg').value || ' ', L = Math.ceil(m.length / 4); SR.parts = [0, 1, 2, 3].map(i => m.slice(i * L, (i + 1) * L)); SR.hs = await Promise.all(SR.parts.map(sha)); SR.root = await sha(SR.hs.join('')); SR.got = SR.parts.slice(); srDraw(); srBtns(true); srSt('Raíz ' + SR.root.slice(0, 12) + '…'); });
$('srDrop').addEventListener('click', () => { const i = SR.got.findIndex(g => g !== null); if (i < 0) return; SR.got[i] = null; srDraw(); srSt('Se perdió la pieza ' + (i + 1), 'bad'); });
$('srAlter').addEventListener('click', () => { const i = SR.got.findIndex(g => g !== null); if (i < 0) return; SR.got[i] += '!'; srDraw(); srSt('Pieza ' + (i + 1) + ' alterada (prueba)', 'bad'); });
$('srResend').addEventListener('click', async () => { const fix = []; for (let i = 0; i < 4; i++) if (SR.got[i] === null || await sha(SR.got[i]) !== SR.hs[i]) { SR.got[i] = SR.parts[i]; fix.push(i + 1); } srDraw(); srSt(fix.length ? 'Reenviadas solo: ' + fix.join(', ') : 'No faltaba nada'); });
$('srVerify').addEventListener('click', async () => { if (SR.got.some(g => g === null)) { srSt('Falta una pieza', 'bad'); window.phenomLimpia.split = 'falta'; return; } const r = await sha((await Promise.all(SR.got.map(sha))).join('')), ok = r === SR.root; srSt(ok ? 'Íntegro ✓' : 'Alterado ✗', ok ? 'ok' : 'bad'); window.phenomLimpia.split = ok ? 'ok' : 'alterado'; });

/* eventos */
$('menuBtn').addEventListener('click', () => menu($('nav').hidden));
addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
$('btnDemo').addEventListener('click', () => { if (!get(KP)) set(KP, DEMO); set(KS, { modo: 'demo', t: Date.now() }); location.hash = '#inicio'; render(); });
$('btnSalir').addEventListener('click', () => { localStorage.removeItem(KS); location.hash = '#ingreso'; render(); });
$('fPerfil').addEventListener('submit', e => { e.preventDefault(); const p = {}; for (const k in F) p[k] = $(F[k]).value.trim(); if (perfil().fuente !== 'google-sin-verificar') p.fuente = 'local'; guardarPerfil(p); $('perfilMsg').textContent = 'Guardado ✓'; });
$('btnBorrar').addEventListener('click', () => { if (!confirm('¿Borrar tu perfil y salir? Solo afecta a este teléfono.')) return; localStorage.removeItem(KP); localStorage.removeItem(KS); location.hash = '#ingreso'; render(); });
$('fPedido').addEventListener('submit', e => { e.preventDefault(); const num = String(C.WHATSAPP || '').replace(/\D/g, ''); if (!num) return; const t = [$('pTema').value + ' (app limpia, prueba)', 'Nombre: ' + $('pName').value, 'Negocio: ' + $('pOrg').value, 'Barrio: ' + $('pBarrio').value, 'Tel: ' + $('pTel').value, 'Detalle: ' + $('pDet').value].join('\n'); const w = window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(t), '_blank'); if (w) w.opener = null; });
addEventListener('hashchange', render); addEventListener('online', render); addEventListener('offline', render);
window.phenomLimpia = { onGoogleCredential, sha };
initGoogle(); render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
