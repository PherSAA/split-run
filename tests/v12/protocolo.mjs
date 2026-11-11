// node --test tests/v12/protocolo.mjs (Node 22+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis;
await import('../../comprobante-respaldo/sello.js');
const { revision, review, drywall, total, subtotal, pack, unpack, union, heads, validateGraph, validateQuote } =
  await import('../../comprobante-respaldo/presupuestos/modelo.js');
const a = await Sello.nuevaLlave(), b = await Sello.nuevaLlave(), id = crypto.randomUUID();
const first = await revision(id, [], drywall(), a);
function quote(laborPrice) {
  const q = drywall(); q.lines[2].price = laborPrice; return q;
}
const v700 = await revision(id, [first], quote(45000), a);
const v680 = await revision(id, [first], quote(43000), b);
const accepted = await review(first, 'aceptado', b);
const rejected = await review(v680, 'rechazado', a);
const branchA = [first, accepted, v700], branchB = [first, v680, rejected];
const json = await pack(id, branchA, a);
test('Drywall $650, edición $700 y redondeo de una partida fraccionaria', () => {
  assert.equal(total(first.body.quote), 65000);
  assert.equal(total(v700.body.quote), 70000);
  assert.equal(subtotal({ qty: 125, price: 102 }), 128);
  assert.throws(() => validateQuote(quote(-1)));
});
test('La Llave verifica el formato compartido y conserva privada la clave', async () => {
  assert.equal(await Sello.firmaOk(a.jwk, first.firma, first.hash), true);
  assert.equal(await Sello.firmaOk(b.jwk, first.firma, first.hash), false);
  await assert.rejects(crypto.subtle.exportKey('jwk', a.kp.privateKey));
  assert.equal(json.includes('"d":'), false);
});
test('Ida y vuelta por archivo con otro sello, sin duplicar', async () => {
  const remote = await unpack(json);
  assert.deepEqual(remote.records, branchA);
  assert.deepEqual((await unpack(await pack(id, remote.records, b))).records, branchA);
  assert.deepEqual(union(id, remote.records, branchA), branchA);
});
test('La aceptación y el rechazo pertenecen a huellas distintas', async () => {
  assert.equal(accepted.body.target, first.hash);
  assert.equal(rejected.body.target, v680.hash);
  assert.notEqual(accepted.body.target, v700.hash);
  assert.equal(await Sello.firmaOk(b.jwk, accepted.firma, accepted.hash), true);
});
test('Dos propuestas concurrentes, unión conmutativa sin pérdidas', () => {
  for (const [x, y] of [[branchA, branchB], [branchB, branchA]]) {
    const both = union(id, x, y);
    assert.equal(both.length, 5);
    assert.deepEqual(heads(both).map(r => total(r.body.quote)).sort(), [68000, 70000]);
  }
});
test('Resolver y restaurar crea nuevas versiones, conserva todas las firmas', async () => {
  const both = union(id, branchA, branchB);
  const resolution = await revision(id, heads(both), quote(44000), b);
  const restored = await revision(id, [resolution], first.body.quote, a);
  const all = union(id, both, [resolution, restored]);
  assert.equal(resolution.body.version, 3);
  assert.deepEqual(resolution.body.parents, [v680.hash, v700.hash].sort());
  assert.equal(restored.body.version, 4);
  assert.equal(total(restored.body.quote), 65000);
  assert.deepEqual(heads(all), [restored]);
  assert.equal(all.filter(r => r.body.target === restored.hash).length, 0);
  assert.deepEqual((await unpack(await pack(id, all, a))).records, all);
});
const otherRoot = await revision(id, [], drywall(), b);
test('Rechaza historiales con dos raíces, padres ausentes o números incompatibles', () => {
  assert.throws(() => union(id, [first], [otherRoot]));
  assert.throws(() => validateGraph(id, [first, rejected]));
  assert.throws(() => validateGraph(id, [v700]));
  const bad = structuredClone(v700); bad.body.version = 20;
  assert.throws(() => validateGraph(id, [first, bad]));
});
const mutations = [
  p => { p.records[0].body.quote.lines[0].price++; },
  p => { p.records[1].body.target = v700.hash; },
  p => { p.records[1].firma = '00'.repeat(64); },
  p => { p.manifest.body.key = b.jwk; },
  p => { p.records.pop(); },
  p => { p.records.pop(); p.manifest.body.entries.pop(); },
  p => { p.records[1].body.key.d = 'dato-extra'; },
];
for (const [i, change] of mutations.entries()) test('Rechaza archivo alterado ' + (i + 1), async () => {
  const packet = JSON.parse(json); change(packet);
  await assert.rejects(unpack(JSON.stringify(packet)));
});
test('Rechaza JSON inválido y registros de otro formato', async () => {
  for (const value of ['{', 'null', '[]', '{"v":11}']) await assert.rejects(unpack(value));
});
