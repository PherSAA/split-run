// Comprobantes · Prototipo (NO MUEVE DINERO). ECDSA P-256 no exportable, recibos firmados, verificación local.
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const { enc, hex, sha, canon, SIG, huella, nuevaLlave, llavePersistente, firmar, firmaOk } = window.Sello;
const dec = new TextDecoder();
const LS = {
  ops: 'comp_respaldo_ops_v1',
  conf: 'comp_respaldo_conf_v1',
  nombre: 'comp_respaldo_nombre_v1'
};
const lget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? (d === undefined ? [] : d) : v; } catch { return d === undefined ? [] : d; } };
const lset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 1800); };
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const money = n => Number(n).toLocaleString('es-PY') + ' PYG';
const BASE = location.origin + location.pathname.replace(/\/?$/, '/');

const b64u = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function codificar(obj) {
  const j = enc.encode(JSON.stringify(obj));
  if (window.CompressionStream) {
    try {
      const cs = new Blob([j]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return 'z' + b64u(new Uint8Array(await new Response(cs).arrayBuffer()));
    } catch {}
  }
  return 'j' + b64u(j);
}
async function decodificar(code) {
  const raw = unb64u(code.slice(1));
  if (code[0] === 'z') {
    const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(ds).text());
  }
  if (code[0] === 'j') return JSON.parse(dec.decode(raw));
  throw new Error('formato');
}
function extraer(t) {
  t = String(t || '').trim().replace(/\s+/g, '');
  const m = t.match(/(?:^|#)c=([A-Za-z0-9_-]+)$/);
  if (m) return m[1];
  if (/^[zj][A-Za-z0-9_-]+$/.test(t)) return t;
  return null;
}

// Conserva el modo efímero de los comprobantes clásicos si falla IndexedDB.
const cargarLlave = dbn => llavePersistente(dbn).catch(nuevaLlave);

const TAM = 160;
async function crearPiezas(paq, llave) {
  const b = enc.encode(JSON.stringify(paq)), piezas = [], hashes = [];
  for (let i = 0; i < b.length; i += TAM) {
    const p = b.slice(i, i + TAM);
    piezas.push(btoa(String.fromCharCode(...p)));
    hashes.push(await sha(p));
  }
  const raiz = await sha(hashes.join(''));
  const firma_raiz = hex(await crypto.subtle.sign(SIG, llave.kp.privateKey, enc.encode(raiz)));
  return { k: 'comp', v: 1, id: hex(crypto.getRandomValues(new Uint8Array(8))), n: piezas.length, raiz, hashes, piezas, firma_raiz };
}

let YO = null, EMISOR_DEMO = null, ULT_LINK = '', ULT_ID = '', ULT_RES = null, TIPO = null, ONLINE = navigator.onLine;

async function copiar(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado'); return true; }
  catch {
    const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    a.remove(); toast(ok ? 'Copiado' : 'Copia el texto a mano'); return ok;
  }
}
function descargar(nombreArch, texto) {
  const u = URL.createObjectURL(new Blob([texto], { type: 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = u; a.download = nombreArch; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
async function compartir(titulo, link, archivo) {
  if (archivo && navigator.canShare) {
    const f = new File([link], archivo, { type: 'text/plain' });
    if (navigator.canShare({ files: [f] })) {
      try { await navigator.share({ title: titulo, files: [f] }); return 'archivo'; }
      catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
    }
  }
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: titulo, url: link }); return 'enlace'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
  }
  await copiar(link); return 'copiado';
}

function pintarNet() {
  ONLINE = navigator.onLine;
  $$('.net').forEach(el => {
    el.className = 'net ' + (ONLINE ? 'on' : 'off');
    const txt = el.querySelector('.net-txt');
    const label = ONLINE ? 'Con internet' : 'Sin internet · los datos siguen en este teléfono';
    if (txt) txt.textContent = label; else el.textContent = label;
  });
  const btn = $('#bSync');
  if (btn) btn.disabled = !ONLINE;
}

function ver(s) {
  $$('[data-s]').forEach(x => { x.hidden = x.dataset.s !== s; });
  $('#atras').hidden = s === 'inicio';
  scrollTo(0, 0);
  if (s === 'ayuda' && YO) $('#aFp').textContent = YO.fp;
  if (s === 'lista') pintarLista();
  pintarNet();
}
$('#atras').onclick = () => ver('inicio');
$('#bCrear').onclick = () => ver('crear-tipo');
$('#bOffline').onclick = () => ver('offline');
$('#bVerificar').onclick = () => ver('verificar');
$('#bLista').onclick = () => ver('lista');
$('#bAyuda').onclick = () => ver('ayuda');
$('#rInicio').onclick = () => ver('inicio');
$('#cOtro').onclick = () => ver('crear-tipo');
$('#offLista').onclick = () => ver('lista');
$('#offOtra').onclick = () => ver('offline');

$('#bTipoReembolso').onclick = () => {
  TIPO = 'reembolso';
  $('#crearTitulo').textContent = 'Reembolso o saldo (demo)';
  $('#crearAviso').textContent = 'Demo: lo sella una identidad de «entidad», distinta a la tuya. Un ahorrista no puede autoemitirse una prueba oficial. No acredita dinero real ni está conectado a ningún banco.';
  $('#camposReembolso').hidden = false;
  $('#camposVenta').hidden = true;
  ver('crear-form');
};
$('#bTipoVenta').onclick = () => {
  TIPO = 'venta';
  $('#crearTitulo').textContent = 'Venta de comercio';
  $('#crearAviso').textContent = 'El comercio sella este comprobante. Es prueba de la venta registrada aquí, no un cobro bancario ni un pago confirmado.';
  $('#camposReembolso').hidden = true;
  $('#camposVenta').hidden = false;
  ver('crear-form');
};

async function sellarComprobante(datos, llave, rol) {
  const env = {
    app: 'comprobante-respaldo',
    prototipo: true,
    mueve_dinero: false,
    datos,
    emisor: { rol, fp: llave.fp, jwk: llave.jwk, n: datos.emisor_nombre || datos.comercio || 'Emisor' },
    nonce: hex(crypto.getRandomValues(new Uint8Array(16))),
    ts: new Date().toISOString()
  };
  const f = await firmar(env, llave);
  const paq = { env, hash: f.hash, firma: f.firma };
  const piezas = await crearPiezas(paq, llave);
  const code = await codificar(piezas);
  const link = BASE + '#c=' + code;
  return { paq, piezas, link, id: piezas.id };
}

$('#fCrear').onsubmit = async e => {
  e.preventDefault();
  await LISTO;
  let datos, llave, rol, titulo;
  if (TIPO === 'reembolso') {
    datos = {
      tipo: 'reembolso_saldo',
      concepto: $('#cConcepto').value,
      ahorrista: $('#cAhorrista').value.trim().slice(0, 40),
      referencia: $('#cRef').value.trim().slice(0, 40),
      monto: Number($('#cMontoR').value),
      moneda: 'PYG',
      emisor_nombre: $('#cEmisor').value.trim().slice(0, 40),
      estado_pago: 'NO_COBRADO_NO_ACREDITADO',
      aviso: 'Prototipo: no acredita saldo ni reembolso real'
    };
    llave = EMISOR_DEMO;
    rol = 'entidad_demo';
    titulo = 'Comprobante demo (no mueve dinero)';
  } else {
    datos = {
      tipo: 'venta',
      comercio: $('#cComercio').value.trim().slice(0, 40),
      descripcion: $('#cDesc').value.trim().slice(0, 80),
      monto: Number($('#cMontoV').value),
      moneda: 'PYG',
      cliente: $('#cCliente').value.trim().slice(0, 40) || null,
      estado_pago: 'REGISTRADO_NO_COBRADO',
      aviso: 'Prototipo: no es cobro bancario'
    };
    llave = YO;
    rol = 'comercio';
    titulo = 'Comprobante de venta (prototipo)';
  }
  if (!datos.monto || datos.monto < 1) return toast('Indica un monto');
  const out = await sellarComprobante(datos, llave, rol);
  ULT_LINK = out.link; ULT_ID = out.id;
  window.compRespaldo.ultimoLink = ULT_LINK;
  window.compRespaldo.ultimoId = ULT_ID;
  $('#creadoMsg').textContent = TIPO === 'reembolso'
    ? 'Sellado por la entidad demo. Compártelo para que otra persona lo verifique. No acredita dinero.'
    : 'Sellado por este teléfono (comercio). Compártelo para verificarlo. No es un cobro.';
  $('#creadoEstado').textContent = TIPO === 'reembolso' ? 'NO ACREDITADO · DEMO' : 'REGISTRADO · NO COBRADO';
  $('#creadoEstado').className = 'badge-pend';
  $('#creadoDetalle').textContent = (datos.ahorrista || datos.comercio) + ' · ' + money(datos.monto) + ' · ' + new Date().toLocaleString('es');
  ver('creado');
};

$('#cCompartir').onclick = async () => {
  const m = await compartir('Comprobante (prototipo, no mueve dinero)', ULT_LINK, 'comprobante-' + ULT_ID + '.phenom');
  toast(m === 'cancelado' ? 'No se compartió' : m === 'copiado' ? 'Código copiado' : 'Compartido');
};
$('#cCopiar').onclick = () => copiar(ULT_LINK);
$('#cArchivo').onclick = () => descargar('comprobante-' + ULT_ID + '.phenom', ULT_LINK);

$('#fOffline').onsubmit = async e => {
  e.preventDefault();
  await LISTO;
  const op = {
    id: hex(crypto.getRandomValues(new Uint8Array(6))),
    comercio: $('#oComercio').value.trim().slice(0, 40),
    descripcion: $('#oDesc').value.trim().slice(0, 80),
    monto: Number($('#oMonto').value),
    moneda: 'PYG',
    cliente: $('#oCliente').value.trim().slice(0, 40) || null,
    estado: 'PENDIENTE_NO_COBRADO',
    sincronizado: false,
    ts: new Date().toISOString(),
    online_al_crear: navigator.onLine
  };
  if (!op.monto || op.monto < 1) return toast('Indica un monto');
  // Firma local del registro pendiente (no es pago)
  const env = {
    app: 'comprobante-respaldo',
    tipo: 'operacion_offline',
    prototipo: true,
    mueve_dinero: false,
    op,
    emisor: { rol: 'comercio_local', fp: YO.fp, jwk: YO.jwk },
    nonce: hex(crypto.getRandomValues(new Uint8Array(12))),
    ts: op.ts
  };
  const f = await firmar(env, YO);
  op.sello = { hash: f.hash, firma: f.firma, fp: YO.fp };
  const list = lget(LS.ops);
  list.unshift(op);
  lset(LS.ops, list.slice(0, 200));
  window.compRespaldo.ops = () => lget(LS.ops);
  $('#offMsg').textContent = op.comercio + ' · ' + money(op.monto) + '. Quedó guardada en este teléfono.';
  ver('offline-ok');
};

function pintarLista() {
  const list = lget(LS.ops);
  const ul = $('#listaOps');
  $('#listaVacia').hidden = list.length > 0;
  ul.innerHTML = list.map(op => {
    const est = op.estado === 'CONFIRMADO_DEMO'
      ? '<span class="est conf">Confirmado (demo)</span>'
      : op.sincronizado
        ? '<span class="est sync">Sincronizado · NO COBRADO</span>'
        : '<span class="est pend">PENDIENTE · NO COBRADO</span>';
    return `<li data-id="${esc(op.id)}">
      <div class="op-main"><b>${esc(op.comercio)}</b><div class="op-amt">${esc(money(op.monto))}</div>
      <span class="muted">${esc(op.descripcion)} · ${esc(new Date(op.ts).toLocaleString('es'))}</span></div>
      <div class="op-side">${est}
      <button class="del-btn" data-del="${esc(op.id)}">Eliminar</button></div></li>`;
  }).join('');
  $$('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('¿Eliminar esta operación pendiente? No se puede deshacer.')) return;
    lset(LS.ops, lget(LS.ops).filter(x => x.id !== b.dataset.del));
    pintarLista();
    toast('Eliminada');
  });
  $('#bSync').disabled = !navigator.onLine || !list.some(x => !x.sincronizado && x.estado === 'PENDIENTE_NO_COBRADO');
}

$('#bSync').onclick = () => {
  if (!navigator.onLine) return toast('Sin internet: no se puede sincronizar');
  const list = lget(LS.ops);
  let n = 0;
  for (const op of list) {
    if (!op.sincronizado && op.estado === 'PENDIENTE_NO_COBRADO') {
      op.sincronizado = true;
      op.sync_ts = new Date().toISOString();
      // IMPORTANTE: NUNCA cambia a pagado
      op.estado = 'PENDIENTE_NO_COBRADO';
      op.nota_sync = 'Sincronizado localmente. Sigue NO COBRADO. Una entidad externa debe confirmar cualquier pago o reembolso.';
      n++;
    }
  }
  lset(LS.ops, list);
  window.compRespaldo.ops = () => lget(LS.ops);
  pintarLista();
  toast(n ? (n + ' sincronizada' + (n > 1 ? 's' : '') + ' · siguen NO COBRADAS') : 'Nada pendiente de sincronizar');
};

async function abrirTexto(t) {
  await LISTO;
  ver('res');
  $('#rDemoConfirm').hidden = true;
  ULT_RES = null;
  const code = extraer(t);
  if (!code) {
    return mostrar({ ok: false, big: 'No se reconoce', msg: 'Esto no parece un comprobante de este prototipo, o llegó incompleto.' });
  }
  let s;
  try { s = await decodificar(code); } catch {
    return mostrar({ ok: false, big: 'Llegó cortado ✗', msg: 'El código llegó incompleto. Pide que te lo envíen como archivo.' });
  }
  if (s.k !== 'comp') return mostrar({ ok: false, big: 'No se reconoce', msg: 'Formato desconocido.' });
  return abrirComp(s);
}

async function abrirComp(s) {
  const r = { pasos: [], ok: false, big: 'Cambió ✗', s };
  const paso = (n, ok, d) => { r.pasos.push({ n, ok, d }); return ok; };
  const fin = m => { r.msg = m; return terminar(r); };

  if (!paso('Lista de partes', await sha((s.hashes || []).join('')) === s.raiz && (s.hashes || []).length === s.n, (s.n || 0) + ' partes'))
    return fin('La lista de partes fue alterada.');
  const malas = [];
  for (let i = 0; i < s.n; i++) {
    const d = (s.piezas || [])[i];
    let h = '';
    try { h = d ? await sha(b64(d)) : ''; } catch {}
    if (h !== s.hashes[i]) { malas.push(i + 1); paso('Parte ' + (i + 1), false, d ? 'cambió' : 'falta'); }
  }
  if (malas.length) { r.malas = malas; return fin('Alguna parte cambió o falta después de emitirse.'); }
  paso('Partes', true, s.n + ' de ' + s.n);

  let paq;
  try {
    paq = JSON.parse(dec.decode(new Uint8Array(s.piezas.map(b64).reduce((a, b) => (a.push(...b), a), []))));
  } catch { return fin('Las partes no forman un comprobante.'); }
  r.paq = paq;
  const env = paq.env;
  if (!paso('Contenido', await sha(canon(env)) === paq.hash, '')) return fin('El contenido cambió después de sellarse.');
  if (!paso('Firma', await firmaOk(env.emisor.jwk, paq.firma, paq.hash) && await firmaOk(env.emisor.jwk, s.firma_raiz, s.raiz), ''))
    return fin('El sello no es válido.');
  const fp = await huella(env.emisor.jwk);
  if (!paso('Código del sello', fp === env.emisor.fp, fp)) return fin('El sello no corresponde a quien dice emitirlo.');

  r.ok = true;
  r.big = 'Verificado ✓';
  const d = env.datos || {};
  const estado = d.estado_pago || 'desconocido';
  return fin(
    'Llegó completo, sin cambios y sellado por «' + (env.emisor.n || 'emisor') + '». ' +
    'Estado declarado: ' + estado.replace(/_/g, ' ') + '. ' +
    'Esto no prueba que el dinero exista ni que se haya pagado.'
  );
}

function terminar(r) {
  ULT_RES = r;
  mostrar(r);
  window.compRespaldo.ultimo = { ok: r.ok, big: r.big, msg: r.msg, malas: r.malas || [] };
  const d = r.paq && r.paq.env && r.paq.env.datos;
  if (r.ok && d && d.tipo === 'reembolso_saldo') {
    $('#rDemoConfirm').hidden = false;
  }
  return r;
}

function mostrar(r) {
  $('#rBig').textContent = r.big;
  $('#rBig').className = 'verdict ' + (r.ok ? 'ok' : 'bad');
  $('#rMsg').textContent = r.msg || '';
  window.compRespaldo.ultimo = { ok: !!r.ok, big: r.big, msg: r.msg || '', malas: r.malas || [] };
  const d = r.paq && r.paq.env && r.paq.env.datos;
  const env = r.paq && r.paq.env;
  let html = '';
  if (d) {
    html = '<dl class="kv">';
    const rows = [
      ['Tipo', d.tipo === 'venta' ? 'Venta de comercio' : 'Reembolso / saldo (demo)', ''],
      ['Monto', money(d.monto), 'amt'],
      d.ahorrista ? ['Ahorrista', d.ahorrista, ''] : null,
      d.referencia ? ['Referencia', d.referencia, ''] : null,
      d.comercio ? ['Comercio', d.comercio, ''] : null,
      d.descripcion ? ['Descripción', d.descripcion, ''] : null,
      d.cliente ? ['Cliente', d.cliente, ''] : null,
      d.emisor_nombre ? ['Emisor', d.emisor_nombre, ''] : null,
      ['Estado', (d.estado_pago || '').replace(/_/g, ' '), ''],
      env && env.emisor ? ['Sello', env.emisor.fp, ''] : null,
      env ? ['Fecha', new Date(env.ts).toLocaleString('es'), ''] : null,
      ['Aviso', d.aviso || 'Prototipo', '']
    ].filter(Boolean);
    html += rows.map(([k, v, cls]) => `<dt>${esc(k)}</dt><dd class="${cls}">${esc(v)}</dd>`).join('') + '</dl>';
  } else if (r.pasos && r.pasos.length) {
    html = '<dl class="kv">' + r.pasos.map(p => `<dt>${p.ok ? '✓' : '✗'} ${esc(p.n)}</dt><dd>${esc(p.d || '')}</dd>`).join('') + '</dl>';
  }
  $('#rDetalle').innerHTML = html;
}

$('#vAbrir').onclick = () => abrirTexto($('#vTexto').value);
$('#vArchivo').onchange = async () => {
  const f = $('#vArchivo').files[0];
  if (!f) return;
  if (f.size > 2e6) return toast('Archivo demasiado grande');
  const t = await f.text();
  $('#vArchivo').value = '';
  abrirTexto(t);
};

// Demo: confirmación por identidad distinta (EMISOR_DEMO). Nunca automática por conectividad.
$('#bDemoConfirmar').onclick = async () => {
  await LISTO;
  if (!ULT_RES || !ULT_RES.ok || !ULT_RES.paq) return;
  const original = ULT_RES.paq;
  const conf = {
    app: 'comprobante-respaldo',
    tipo: 'confirmacion_demo',
    prototipo: true,
    mueve_dinero: false,
    aviso: 'DEMO: confirmación simulada por entidad. No mueve ni acredita dinero.',
    original_hash: original.hash,
    original_emisor_fp: original.env.emisor.fp,
    datos_ref: original.env.datos,
    emisor: { rol: 'entidad_demo_confirmacion', fp: EMISOR_DEMO.fp, jwk: EMISOR_DEMO.jwk, n: 'Entidad demo (confirmación)' },
    nonce: hex(crypto.getRandomValues(new Uint8Array(12))),
    ts: new Date().toISOString()
  };
  const f = await firmar(conf, EMISOR_DEMO);
  const paq = { env: { ...conf, datos: { tipo: 'confirmacion_demo', monto: original.env.datos.monto, moneda: 'PYG', estado_pago: 'CONFIRMADO_DEMO_NO_REAL', aviso: conf.aviso, emisor_nombre: conf.emisor.n } }, hash: f.hash, firma: f.firma };
  // Reutilizar estructura de piezas
  const piezas = await crearPiezas(paq, EMISOR_DEMO);
  const link = BASE + '#c=' + await codificar(piezas);
  window.compRespaldo.confirmacionDemo = link;
  ULT_LINK = link; ULT_ID = piezas.id;
  $('#creadoMsg').textContent = 'Confirmación DEMO creada por una identidad de emisor distinta. Sigue sin mover dinero.';
  $('#creadoEstado').textContent = 'CONFIRMADO (DEMO) · NO REAL';
  $('#creadoEstado').className = 'badge-pend';
  $('#creadoDetalle').textContent = 'Referencia al comprobante anterior · ' + money(original.env.datos.monto);
  ver('creado');
  toast('Confirmación demo lista · no es un pago real');
};

addEventListener('online', pintarNet);
addEventListener('offline', pintarNet);

window.compRespaldo = {
  sha, canon, codificar, decodificar, firmar, firmaOk,
  ultimo: null, ultimoLink: '', ultimoId: '',
  ops: () => lget(LS.ops),
  yo: () => YO && YO.fp,
  emisorDemo: () => EMISOR_DEMO && EMISOR_DEMO.fp,
  setOnline(v) { // solo para pruebas Playwright
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !!v });
    pintarNet();
  },
  sync() { $('#bSync').click(); },
  ver
};

const LISTO = (async () => {
  YO = await cargarLlave('comp-respaldo-yo');
  EMISOR_DEMO = await cargarLlave('comp-respaldo-emisor-demo');
  window.compRespaldo.listo = true;
})();
window.compRespaldo.ready = LISTO;

function ir() {
  const raw = location.hash;
  if (/^#c=/.test(raw)) {
    history.replaceState(null, '', BASE);
    abrirTexto(raw);
    return;
  }
  ver('inicio');
}
addEventListener('hashchange', ir);

LISTO.then(() => { pintarNet(); ir(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
