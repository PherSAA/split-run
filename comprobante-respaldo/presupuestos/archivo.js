import { union } from './modelo.js';

const opened = new Promise((resolve, reject) => {
  const r = indexedDB.open('phersaa-presupuestos-v12', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('presupuestos');
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
export async function listIds() {
  const db = await opened;
  return new Promise((ok, fail) => {
    const r = db.transaction('presupuestos').objectStore('presupuestos').getAllKeys();
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
export async function load(id) {
  const db = await opened;
  return new Promise((ok, fail) => {
    const r = db.transaction('presupuestos').objectStore('presupuestos').get(id);
    r.onsuccess = () => ok(r.result || []);
    r.onerror = () => fail(r.error);
  });
}
// Leer, unir y escribir dentro de la misma transacción serializa pestañas del mismo origen.
export async function append(id, incoming) {
  const db = await opened;
  return new Promise((ok, fail) => {
    const tx = db.transaction('presupuestos', 'readwrite');
    const store = tx.objectStore('presupuestos');
    const previous = store.get(id);
    let records, error;
    previous.onsuccess = () => {
      try {
        records = union(id, previous.result || [], incoming);
        store.put(records, id);
      } catch (cause) {
        error = cause;
        tx.abort();
      }
    };
    tx.oncomplete = () => ok(records);
    tx.onabort = () => fail(error || tx.error || new Error('No se pudo guardar en este dispositivo.'));
  });
}
