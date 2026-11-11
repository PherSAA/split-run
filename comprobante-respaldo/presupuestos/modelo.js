// Protocolo V12. Importes en centavos y cantidades en centésimas.
const { canon, sha, firmar, firmaOk } = window.Sello;
export const FORMAT = 'phersaa/comprobantes/presupuesto/v12';
export const MAX_BYTES = 8 * 1024 * 1024;
const MAX_RECORDS = 240;
const hashPattern = /^[0-9a-f]{64}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const validHash = x => typeof x === 'string' && hashPattern.test(x);
export function check(condition, message = 'Archivo de presupuesto inválido.') {
  if (!condition) throw new Error(message);
}
function keys(value, expected) {
  const fields = expected.split(' ');
  check(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)));
}
function integer(n, min, max) {
  return Number.isSafeInteger(n) && n >= min && n <= max;
}
function label(s, max) {
  return typeof s === 'string' && s.length <= max && s.trim().length > 0;
}
export function validateQuote(q) {
  keys(q, 'title lines');
  check(label(q.title, 100), 'Escribe un título de hasta 100 caracteres.');
  check(Array.isArray(q.lines) && integer(q.lines.length, 1, 32), 'Incluye entre 1 y 32 partidas.');
  for (const line of q.lines) {
    keys(line, 'kind name qty price');
    check(['material', 'labor'].includes(line.kind) && label(line.name, 96), 'Revisa el concepto de cada partida.');
    check(integer(line.qty, 1, 1000000) && integer(line.price, 0, 100000000),
      'Cada cantidad debe estar entre 0.01 y 10000 y el precio entre $0 y $1000000.');
  }
}
export const subtotal = line => Math.floor((line.qty * line.price + 50) / 100);
export const total = quote => quote.lines.reduce((sum, line) => sum + subtotal(line), 0);
export const drywall = () => ({ title: 'Instalación de drywall', lines: [
  { kind: 'material', name: 'Paneles de drywall', qty: 1000, price: 2000 },
  { kind: 'material', name: 'Tornillos y compuesto', qty: 100, price: 5000 },
  { kind: 'labor', name: 'Instalación y acabado', qty: 100, price: 40000 }
] });
function publicKey(jwk) {
  keys(jwk, 'kty crv x y');
  const coordinate = s => typeof s === 'string' && /^[A-Za-z0-9_-]{43}$/.test(s);
  check(jwk.kty === 'EC' && jwk.crv === 'P-256' && coordinate(jwk.x) && coordinate(jwk.y));
}
async function verifySeal(record) {
  keys(record, 'body hash firma');
  publicKey(record.body.key);
  check(validHash(record.hash) && typeof record.firma === 'string' && /^[0-9a-f]{128}$/.test(record.firma));
  check(await sha(canon(record.body)) === record.hash &&
    await firmaOk(record.body.key, record.firma, record.hash), 'La huella o la firma del archivo cambió.');
}
async function signed(fields, key) {
  const body = { format: FORMAT, ...fields, key: key.jwk };
  return { body, ...await firmar(body, key) };
}
export async function revision(id, parents, quote, key) {
  validateQuote(quote);
  return signed({ type: 'revision', id, nonce: crypto.randomUUID(), date: new Date().toISOString(),
    version: 1 + Math.max(0, ...parents.map(p => p.body.version)),
    parents: parents.map(p => p.hash).sort(), quote }, key);
}
export function review(target, decision, key) {
  check(['aceptado', 'rechazado'].includes(decision));
  return signed({ type: 'review', id: target.body.id, nonce: crypto.randomUUID(), date: new Date().toISOString(),
    target: target.hash, decision }, key);
}
function shape(record, id) {
  const b = record.body;
  const common = 'format type id nonce date key ';
  if (b.type === 'revision') {
    keys(b, common + 'version parents quote');
    check(integer(b.version, 1, MAX_RECORDS) && Array.isArray(b.parents) && b.parents.length <= MAX_RECORDS);
    check(b.parents.every((h, i) => validHash(h) && (i === 0 || h > b.parents[i - 1])));
    validateQuote(b.quote);
  } else {
    keys(b, common + 'target decision');
    check(b.type === 'review' && validHash(b.target) && ['aceptado', 'rechazado'].includes(b.decision));
  }
  check(b.format === FORMAT && b.id === id && typeof b.nonce === 'string' && uuid.test(b.nonce));
  check(typeof b.date === 'string' && b.date.length === 24 && !isNaN(Date.parse(b.date)) &&
    new Date(b.date).toISOString() === b.date);
}
export const revisions = records => records.filter(r => r.body.type === 'revision');
export function heads(records) {
  const versions = revisions(records);
  const parents = new Set(versions.flatMap(r => r.body.parents));
  return versions.filter(r => !parents.has(r.hash));
}
export function validateGraph(id, records) {
  check(typeof id === 'string' && uuid.test(id));
  check(Array.isArray(records) && integer(records.length, 1, MAX_RECORDS), 'El historial debe tener entre 1 y 240 registros.');
  const map = new Map(records.map(r => [r.hash, r]));
  check(map.size === records.length);
  let roots = 0;
  for (const rec of records) {
    shape(rec, id);
    const b = rec.body;
    if (b.type === 'review') {
      check(map.get(b.target)?.body.type === 'revision', 'Falta la versión revisada.');
      continue;
    }
    if (!b.parents.length) roots++;
    const versions = b.parents.map(h => {
      const parent = map.get(h);
      check(parent?.body.type === 'revision', 'Falta una versión anterior.');
      return parent.body.version;
    });
    check(b.version === 1 + Math.max(0, ...versions), 'La numeración del historial es inválida.');
  }
  check(roots === 1, 'El presupuesto debe tener un único origen.');
}
export function union(id, existing, incoming) {
  const map = new Map(existing.map(r => [r.hash, r]));
  for (const item of incoming) if (!map.has(item.hash)) map.set(item.hash, item);
  const records = [...map.values()];
  validateGraph(id, records);
  return records;
}
export async function pack(id, records, key) {
  validateGraph(id, records);
  const manifest = await signed({ type: 'file', id, entries: records.map(r => r.hash) }, key);
  const json = JSON.stringify({ manifest, records });
  check(new Blob([json]).size <= MAX_BYTES, 'El archivo supera 8 MiB.');
  return json;
}
export async function unpack(text) {
  check(typeof text === 'string' && new Blob([text]).size <= MAX_BYTES, 'El archivo supera 8 MiB.');
  const packet = JSON.parse(text);
  keys(packet, 'manifest records');
  const { manifest, records } = packet;
  keys(manifest.body, 'format type id entries key');
  const { format, type, id, entries } = manifest.body;
  check(format === FORMAT && type === 'file');
  validateGraph(id, records);
  check(Array.isArray(entries) && entries.length === records.length && entries.every((h, i) => h === records[i].hash),
    'El índice firmado no coincide con el historial.');
  await verifySeal(manifest);
  for (const record of records) await verifySeal(record);
  return { id, records };
}
