(() => {
'use strict';
const C = window.PHENOM_APP_CONFIG || {};
const KP = 'phenom_app_perfil_v1', KS = 'phenom_app_sesion_v1';
const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = t => { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 2200); };

/* ---------- perfil ---------- */
const DEMO = { name: 'Usuario Demo', email: 'demo@ejemplo.test', org: 'Bodega de ejemplo', tipo: 'bodega', barrio: 'Washington Heights', tel: '', idioma: 'es', fuente: 'demo' };
const perfil = () => get(KP) || {};
function guardarPerfil(p) { set(KP, Object.assign(perfil(), p)); }

/* ---------- Google (solo si hay CLIENT ID) ---------- */
function b64uJson(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
// Decodifica el token SOLO para mostrar/rellenar. NO verifica la firma: eso lo debe hacer un servidor.
function onGoogleCredential(resp) {
  let d; try { d = b64uJson(String(resp.credential).split('.')[1]); } catch (e) { toast('No se pudo leer la respuesta de Google'); return; }
  guardarPerfil({ name: d.name || '', email: d.email || '', picture: d.picture || '', fuente: 'google-sin-verificar' });
  set(KS, { modo: 'google', t: Date.now() });
  toast('Datos de Google cargados (sin verificar en servidor)');
  location.hash = '#inicio'; render();
}
function initGoogle() {
  const id = String(C.GOOGLE_CLIENT_ID || '').trim(), b = $('btnGoogle');
  if (!id) return; // sin ID: nada se carga de Google
  b.disabled = true; $('btnGoogleTxt').textContent = 'Cargando Google…';
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => {
    try {
      google.accounts.id.initialize({ client_id: id, callback: onGoogleCredential });
      b.hidden = true;
      google.accounts.id.renderButton($('gsiSlot'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es', width: 300 });
      $('authNote').textContent = 'Aviso honesto: la app solo lee tu nombre, correo y foto para mostrarlos y rellenar formularios. No es un ingreso seguro todavía; un servidor tiene que verificar el token.';
    } catch (e) { $('btnGoogleTxt').textContent = 'Google no disponible ahora'; }
  };
  s.onerror = () => { $('btnGoogleTxt').textContent = 'Google no disponible (¿sin internet?)'; };
  document.head.appendChild(s);
}

/* ---------- datos reales de v1.16 (mismo sitio) ---------- */
function recibos() {
  let tickets = 0, dias = 0; const audit = get('phenom_deli_audit_v112'), stripe = localStorage.getItem('phenom_stripe_api_v115');
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('phenom_deli_tickets_')) { const n = parseInt(localStorage.getItem(k) || '0', 10); if (n > 0) { tickets += n; dias++; } } }
  return { tickets, dias, audit: Array.isArray(audit) ? audit : null, stripe: !!stripe, stock: !!localStorage.getItem('phenom_deli_stock_v111') };
}
// Revisa solo los ENLACES de la cadena guardada (cada registro apunta al hash del anterior). Las firmas se revisan en v1.16.
function enlacesCadena(L) { if (!L || !L.length) return null; let prev = '0'.repeat(64); for (const r of L) { if (!r || r.prev !== prev || typeof r.hash !== 'string') return false; prev = r.hash; } return true; }

/* ---------- pantallas ---------- */
const SCREENS = ['ingreso', 'inicio', 'cotizar', 'plan', 'perfil'];
function render() {
  const ses = get(KS); let h = (location.hash || '').slice(1);
  if (!ses) h = 'ingreso'; else if (!SCREENS.includes(h) || h === 'ingreso') h = 'inicio';
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.dataset.screen !== h);
  $('tabs').hidden = h === 'ingreso';
  document.querySelectorAll('.tabs a').forEach(a => { if (a.dataset.t === h) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (h === 'inicio') renderInicio(); if (h === 'perfil') renderPerfil(); if (h === 'plan') renderPlan(); if (h === 'cotizar') renderCotizar();
  window.scrollTo(0, 0);
}
function chip(t, cls) { const e = document.createElement('span'); e.className = 'chip ' + (cls || ''); e.textContent = t; return e; }
function renderInicio() {
  const p = perfil(), n = (p.name || '').trim();
  $('hola').textContent = 'Hola, ' + (n ? n.split(/\s+/)[0] : 'bienvenido');
  const av = $('avatar');
  if (p.picture && /^https:\/\//.test(p.picture)) { av.style.backgroundImage = 'url("' + p.picture.replace(/"/g, '') + '")'; av.textContent = ''; }
  else { av.style.backgroundImage = ''; av.textContent = (n[0] || 'P').toUpperCase(); }
  const r = recibos(), st = $('strip'); st.textContent = '';
  st.append(chip('Modo prueba', 'warn'));
  st.append(chip(navigator.onLine ? 'En línea' : 'Sin internet', navigator.onLine ? 'ok' : 'bad'));
  st.append(chip(p.fuente === 'demo' ? 'Perfil demo' : p.fuente === 'google-sin-verificar' ? 'Google (sin verificar)' : 'Perfil local'));
  const ok = enlacesCadena(r.audit);
  st.append(ok === null ? chip('Cadena: sin datos') : chip(ok ? 'Cadena enlazada ✓ (' + r.audit.length + ')' : 'Cadena rota ✗', ok ? 'ok' : 'bad'));
  const parts = [];
  if (r.tickets) parts.push(r.tickets + ' ticket' + (r.tickets === 1 ? '' : 's') + ' en ' + r.dias + ' día' + (r.dias === 1 ? '' : 's'));
  if (r.audit && r.audit.length) parts.push(r.audit.length + ' registro' + (r.audit.length === 1 ? '' : 's') + ' de auditoría');
  if (r.stripe) parts.push('Stripe prueba configurado');
  $('recibos').textContent = parts.length ? parts.join(' · ') + ' (en este teléfono)' : 'sin datos todavía';
  const items = [
    [!!String(C.WHATSAPP || '').trim(), 'Número de WhatsApp', 'Poner el número en config.js para activar los botones'],
    [!!String(C.DOMINIO || '').trim(), 'Dominio propio', 'Hoy vive en phersaa.github.io'],
    [C.REVISION_LEGAL === true, 'Revisión legal', 'Un abogado revisa términos, privacidad y reembolsos'],
    [!!String(C.STRIPE_TEST_BACKEND || '').trim() || r.stripe, 'Stripe en modo prueba', 'Desplegar el backend de prueba (sin cobros reales)'],
    [!!String(C.GOOGLE_CLIENT_ID || '').trim(), 'Google Client ID', 'Crear el ID en Google Cloud (ver README)']
  ];
  const ul = $('sigue'); ul.textContent = '';
  items.forEach(([d, t, s]) => { const li = document.createElement('li'); li.className = d ? 'done' : ''; const i = document.createElement('i'); i.textContent = d ? '✓' : ''; const sp = document.createElement('span'); sp.textContent = t; const sm = document.createElement('small'); sm.textContent = d ? 'Listo' : s; sp.append(sm); li.append(i, sp); ul.append(li); });
}
const F = { name: 'fName', email: 'fEmail', org: 'fOrg', tipo: 'fTipo', barrio: 'fBarrio', tel: 'fTel', idioma: 'fIdioma' };
function renderPerfil() {
  const p = perfil(); for (const k in F) $(F[k]).value = p[k] || (k === 'idioma' ? 'es' : '');
  $('fuente').textContent = 'Origen del perfil: ' + (p.fuente === 'demo' ? 'perfil demo de ejemplo' : p.fuente === 'google-sin-verificar' ? 'Google (nombre/correo/foto, sin verificar en servidor)' : 'escrito por ti');
}
const PLAN = {
  hecho: [['v1.1–v1.3', 'Primeras demos y Envío verificado: cada archivo lleva una huella; si alguien lo cambia, se nota.'],
    ['v1.4–v1.6', 'Verificadores 2 de 3 y Split Run: el trabajo se reparte en piezas y cada una se comprueba.'],
    ['v1.7–v1.9', 'Teleport P2P de teléfono a teléfono e invitaciones firmadas por el administrador.'],
    ['v1.10–v1.13', 'Phenom Deli: caja de demo, inventario, auditoría encadenada y tickets.'],
    ['v1.14–v1.15', 'Vistas más claras y botón de pago Stripe en modo prueba.'],
    ['v1.16', 'Se quitó el Diario y se agregaron las ofertas Deli y Construcción.']],
  prueba: ['Stripe en modo prueba (sin cobros reales)', 'Sitio de prueba con términos, privacidad y reembolsos (borradores)', 'Ofertas: Phenom Deli e informes de obra', 'Esta app de prueba'],
  falta: ['LLC y EIN', 'Dominio propio', 'Revisión legal', 'Pagos reales', 'Pruebas en teléfonos reales con clientes']
};
function renderPlan() {
  const h = $('hecho'); if (h.childElementCount) return;
  PLAN.hecho.forEach(([v, t]) => { const li = document.createElement('li'), b = document.createElement('b'); b.textContent = v + ' · '; li.append(b, t); h.append(li); });
  PLAN.prueba.forEach(t => { const li = document.createElement('li'); li.textContent = t; $('prueba').append(li); });
  PLAN.falta.forEach(t => { const li = document.createElement('li'); li.textContent = t; $('falta').append(li); });
}
const FORMS = {
  gotera: ['Cotizar gotera', 'Describe la gotera y tu barrio. Te respondemos por WhatsApp con una cotización (precio por definir).'],
  piloto: ['Piloto Phenom', 'Inscríbete al piloto de prueba. Sin costo durante la prueba; condiciones por definir.'],
  deli: ['Phenom Deli', 'Caja con recibos sellados para tu bodega. Precio por definir.'],
  obra: ['Informes de obra', 'Informes verificados para subcontratistas de construcción. Precio por definir.']
};
let tipoForm = 'gotera';
function renderCotizar() {
  const p = perfil(), m = { pName: p.name, pOrg: p.org, pTel: p.tel, pBarrio: p.barrio };
  for (const id in m) { const e = $(id); if (!e.value && m[id]) { e.value = m[id]; e.classList.add('filled'); } }
  $('fDesc').textContent = FORMS[tipoForm][1];
  const num = String(C.WHATSAPP || '').replace(/\D/g, ''), b = $('btnWs');
  b.disabled = !num; b.textContent = num ? 'Enviar por WhatsApp' : 'WhatsApp · número pendiente';
}

/* ---------- eventos ---------- */
$('btnDemo').addEventListener('click', () => { if (!get(KP)) set(KP, DEMO); set(KS, { modo: 'demo', t: Date.now() }); toast('Modo demo: perfil de ejemplo'); location.hash = '#inicio'; render(); });
$('fPerfil').addEventListener('submit', e => { e.preventDefault(); const p = {}; for (const k in F) p[k] = $(F[k]).value.trim(); if (perfil().fuente !== 'google-sin-verificar') p.fuente = 'local'; guardarPerfil(p); $('perfilMsg').textContent = 'Guardado en este teléfono ✓'; toast('Perfil guardado'); });
$('btnBorrar').addEventListener('click', () => { if (!confirm('¿Borrar tu perfil y salir? Solo afecta a este teléfono.')) return; localStorage.removeItem(KP); localStorage.removeItem(KS); toast('Datos borrados'); location.hash = '#ingreso'; render(); });
$('btnSalir').addEventListener('click', () => { localStorage.removeItem(KS); location.hash = '#ingreso'; render(); });
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { tipoForm = b.dataset.f; document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', x === b)); renderCotizar(); }));
$('fPedido').addEventListener('submit', e => {
  e.preventDefault(); const num = String(C.WHATSAPP || '').replace(/\D/g, ''); if (!num) return;
  const t = [FORMS[tipoForm][0] + ' (desde la app de prueba)', 'Nombre: ' + $('pName').value, 'Negocio: ' + $('pOrg').value, 'Barrio: ' + $('pBarrio').value, 'Tel: ' + $('pTel').value, 'Detalle: ' + $('pDet').value].join('\n');
  const w = window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(t), '_blank'); if (w) w.opener = null;
});
$('cRecibos').addEventListener('click', () => toast($('recibos').textContent));
addEventListener('hashchange', render);
addEventListener('online', render); addEventListener('offline', render);
if (!RM) document.querySelectorAll('.tilt').forEach(c => {
  c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = 'perspective(600px) rotateX(' + (-y * 8) + 'deg) rotateY(' + (x * 8) + 'deg) translateY(-3px)'; });
  c.addEventListener('pointerleave', () => { c.style.transform = ''; });
});
window.phenomApp = { onGoogleCredential, recibos, enlacesCadena, reducedMotion: RM };
initGoogle(); render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
