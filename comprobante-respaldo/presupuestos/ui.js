import { MAX_BYTES, check, drywall, subtotal, total, revision, review, heads, revisions, pack, unpack } from './modelo.js';
import { append, listIds, load } from './archivo.js';

const $ = id => document.getElementById(id);
const money = cents => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const short = h => h.slice(0, 12);
let fingerprints = new Map();
let key, active, records = [], draft, busy = false, fileUrl;
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function tell(text, error = false) {
  $('notice').textContent = text;
  $('notice').className = error ? 'error' : '';
}
async function action(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } catch (err) { tell(err.message || 'No se pudo completar la operación.', true); }
  finally { busy = false; }
}
function button(label, fn) {
  const b = el('button', label);
  b.type = 'button';
  b.onclick = () => action(fn);
  return b;
}
function group(...children) {
  const g = el('div', undefined, 'actions');
  g.append(...children);
  return g;
}
function quoteView(q) {
  const block = el('div');
  for (const line of q.lines) {
    const row = el('div', undefined, 'item');
    const name = el('span', line.name);
    name.append(el('small', (line.kind === 'labor' ? 'Mano de obra' : 'Material') + ' · ' + line.qty / 100 + ' × ' + money(line.price)));
    row.append(name, el('b', money(subtotal(line))));
    block.append(row);
  }
  const sum = el('div', undefined, 'sum');
  sum.append(el('span', 'Total USD'), el('strong', money(total(q))));
  block.append(sum);
  return block;
}
function evidence(record) {
  const detail = el('details');
  detail.append(el('summary', 'Ver huella y sello'), el('p', 'SHA-256'), el('code', record.hash),
    el('p', 'Sello · ' + fingerprints.get(window.Sello.canon(record.body.key))),
    el('code', JSON.stringify(record.body.key)));
  for (const h of record.body.parents || []) detail.append(el('p', 'Versión anterior'), el('code', h));
  return detail;
}
function versionCard(record, current, showActions) {
  const b = record.body, section = el('article', undefined, 'card');
  section.append(el('p', 'V' + b.version + ' · ' + short(record.hash), 'over'), el('h3', b.quote.title),
    el('small', new Date(b.date).toLocaleString('es')), quoteView(b.quote));
  const decisions = records.filter(r => r.body.type === 'review' && r.body.target === record.hash);
  section.append(el('p', decisions.length ? 'Revisiones firmadas de esta versión' : 'Sin revisiones para esta versión.'));
  for (const r of decisions) {
    const d = el('details');
    d.append(el('summary', (r.body.decision === 'aceptado' ? 'Aceptado' : 'Rechazado') + ' · ' + new Date(r.body.date).toLocaleString('es')),
      el('p', 'Huella exacta revisada'), el('code', r.body.target), evidence(r));
    section.append(d);
  }
  section.append(evidence(record));
  if (!showActions) return section;
  if (current.length > 1) {
    section.append(button('Resolver con esta propuesta', () => start(b.quote, current, 'Resolver conflicto')));
  } else {
    section.append(group(button('Proponer cambios', () => start(b.quote, [record], 'Proponer cambios')),
      ...['aceptado','rechazado'].map((decision, i) => button(i ? 'Rechazar versión' : 'Aceptar versión', async () => {
        await append(active, [await review(record, decision, key)]);
        await show(active);
        tell('Revisión guardada para V' + b.version + ' · ' + short(record.hash) + '.');
      }))));
  }
  return section;
}
async function show(id) {
  const ids = await listIds(), select = $('documents');
  // Al recargar, cada pestaña recupera el documento que estaba consultando.
  const remembered = location.hash.slice(1);
  active = id || (ids.includes(remembered) ? remembered : ids[0]); records = active ? await load(active) : [];
  select.replaceChildren();
  for (const k of ids) {
    const data = k === active ? records : await load(k);
    select.add(new Option(heads(data)[0].body.quote.title + ' · ' + k.slice(0, 8), k));
  }
  if (active) select.value = active;
  $('chooser').hidden = !ids.length;
  $('tools').hidden = false; $('editor').hidden = true; draft = null;
  const sheet = $('sheet');
  sheet.hidden = !records.length; sheet.replaceChildren();
  if (fileUrl) { URL.revokeObjectURL(fileUrl); fileUrl = null; }
  if (!records.length) return;
  window.history.replaceState(null, '', '#' + active);
  const keys = new Map(records.map(r => [window.Sello.canon(r.body.key), r.body.key]));
  fingerprints = new Map(await Promise.all(Array.from(keys, async ([encoded, jwk]) =>
    [encoded, await window.Sello.huella(jwk)])));
  const current = heads(records), versions = revisions(records);
  sheet.append(el('p', 'Presupuesto · USD', 'over'), el('h2', current.length > 1 ? 'Propuestas en conflicto' : current[0].body.quote.title),
    el('small', 'ID ' + active, 'hash'));
  if (current.length > 1) sheet.append(el('p', 'Hay ' + current.length + ' propuestas vigentes. Compara las partidas y elige una como base. Al firmar se conservarán todas como versiones anteriores.', 'warning'));
  for (const r of current) sheet.append(versionCard(r, current, true));
  const download = el('a', 'Exportar archivo', 'button primary');
  fileUrl = URL.createObjectURL(new Blob([await pack(active, records, key)], { type: 'application/json' }));
  download.href = fileUrl; download.download = 'PHERSAA-' + active + '.json';
  sheet.append(group(download));
  const history = el('details');
  history.id = 'history';
  history.append(el('summary', 'Historial de versiones (' + versions.length + ')'));
  for (const r of versions.slice().sort((a, b) => b.body.version - a.body.version || a.hash.localeCompare(b.hash))) {
    const card = versionCard(r, current, false);
    if (current.length === 1 && r.hash !== current[0].hash)
      card.append(button('Recuperar como nueva versión', () => start(r.body.quote, current, 'Recuperar V' + r.body.version)));
    history.append(card);
  }
  sheet.append(history);
}
function input(labelText, value, options) {
  const label = el('label', labelText), field = el('input');
  Object.assign(field, options, { value, required: true });
  label.append(field);
  return label;
}
function addLine(line) {
  const row = el('fieldset');
  row.append(el('legend', 'Partida'));
  const kindLabel = el('label', 'Tipo'), kind = el('select');
  kind.add(new Option('Material', 'material')); kind.add(new Option('Mano de obra', 'labor'));
  kind.value = line.kind; kindLabel.append(kind);
  const pair = el('div', undefined, 'pair');
  const options = { type: 'number', inputMode: 'decimal', step: '0.01' };
  pair.append(input('Cantidad', line.qty / 100, { ...options, min: '0.01', max: '10000', className: 'qty' }),
    input('Precio unitario USD', line.price / 100, { ...options, min: '0', max: '1000000', className: 'price' }));
  const sub = el('p', '', 'lineTotal');
  row.append(kindLabel, input('Concepto', line.name, { maxLength: 96, className: 'concept' }), pair, sub,
    button('Quitar partida', () => { row.remove(); updateTotal(); }));
  $('lines').append(row); updateTotal();
}
function readLines() {
  return Array.from($('lines').children, r => ({
    kind: r.querySelector('select').value, name: r.querySelector('.concept').value.trim(),
    qty: Math.round(r.querySelector('.qty').valueAsNumber * 100),
    price: Math.round(r.querySelector('.price').valueAsNumber * 100)
  }));
}
function updateTotal() {
  const lines = readLines();
  Array.from($('lines').children).forEach((r, i) => {
    const sum = subtotal(lines[i]);
    r.querySelector('.lineTotal').textContent = 'Subtotal · ' + (Number.isFinite(sum) ? money(sum) : '—');
  });
  const sum = total({ lines });
  $('editTotal').textContent = Number.isFinite(sum) ? money(sum) : '—';
}
const blankLine = () => ({ kind: 'material', name: '', qty: 100, price: 0 });
function start(q, parents, mode) {
  draft = { id: parents.length ? parents[0].body.id : crypto.randomUUID(), parents };
  $('tools').hidden = true; $('sheet').hidden = true; $('editor').hidden = false;
  $('editTitle').textContent = mode;
  $('editMode').textContent = parents.length ? 'Base · ' + parents.map(p => 'V' + p.body.version + ' / ' + short(p.hash)).join(' + ') : 'Primera versión';
  $('title').value = q.title; $('lines').replaceChildren(); q.lines.forEach(addLine); tell('');
  $('editor').scrollIntoView();
}
$('editor').oninput = updateTotal;
$('add').onclick = () => { if ($('lines').children.length < 32) addLine(blankLine()); else tell('Máximo 32 partidas.', true); };
$('create').onclick = () => action(() => start({ title: '', lines: [blankLine()] }, [], 'Nuevo presupuesto'));
$('demo').onclick = () => action(() => start(drywall(), [], 'Ejemplo de drywall'));
$('cancel').onclick = () => action(() => show(active));
$('documents').onchange = e => action(() => show(e.target.value));
$('editor').onsubmit = e => {
  e.preventDefault();
  action(async () => {
    const { id, parents } = draft;
    const quote = { title: $('title').value.trim(), lines: readLines() };
    const next = await revision(id, parents, quote, key);
    await append(id, [next]); await show(id);
    tell('V' + next.body.version + ' firmada y guardada en este teléfono.');
  });
};
$('importBtn').onclick = () => $('file').click();
$('file').onchange = e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  action(async () => {
    check(file.size <= MAX_BYTES, 'El archivo supera 8 MiB.');
    let packet;
    try { packet = await unpack(await file.text()); }
    catch (err) { throw new Error('Archivo rechazado. ' + (err instanceof SyntaxError ? 'JSON inválido.' : err.message)); }
    await append(packet.id, packet.records); await show(packet.id);
    tell('Archivo verificado. Historial incorporado.');
  });
};
async function prepareOffline() {
  try {
    const reg = await navigator.serviceWorker.register('../sw.js');
    if (!reg.active && reg.installing) {
      const worker = reg.installing;
      await new Promise((ok, fail) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') ok();
          if (worker.state === 'redundant') fail(new Error());
        });
      });
    }
    await navigator.serviceWorker.ready;
    $('offline').textContent = 'Disponible sin internet en este navegador';
  } catch { $('offline').textContent = 'La recarga sin internet está pendiente. Vuelve a abrir con conexión.'; }
}
action(async () => {
  check(window.isSecureContext && window.crypto?.subtle, 'Abre la prueba mediante HTTPS o localhost para usar La Llave.');
  key = await window.Sello.llavePersistente('comp-respaldo-yo');
  $('seal').textContent = 'Sello de este navegador · ' + key.fp;
  await show(); prepareOffline();
});
