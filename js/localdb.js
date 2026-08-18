// ============================================================================
// localdb.js — Persistencia local (IndexedDB)
//
// Dos tipos de almacenamiento local:
//   1. "Espejo" (mirror): una copia local de tractores/columnas/lineas/viajes.
//      Todas las lecturas de la app (getAll, getById, etc.) vienen de acá, no
//      de la red — por eso la app puede abrirse y mostrar datos sin señal.
//   2. "Buzón de salida" (outbox): cola de cambios (crear/editar/borrar) que
//      todavía no se confirmaron contra Supabase. Se procesa en cuanto hay
//      conexión (ver sync.js).
// ============================================================================

const DB_NAME = 'PatioARAUCO_local';
const DB_VERSION = 1;
const TABLES = ['tractores', 'columnas', 'lineas', 'viajes'];

let _db = null;

function openLocalDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      TABLES.forEach((t) => {
        if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
      });
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'opId', autoIncrement: true });
      }
    };
  });
}

function tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}

async function mirrorGetAll(table) {
  await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = tx(table).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function mirrorGetById(table, id) {
  await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = tx(table).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function mirrorPut(table, obj) {
  await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = tx(table, 'readwrite').put(obj);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function mirrorDelete(table, id) {
  await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = tx(table, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Reemplaza el espejo completo de una tabla con datos frescos del servidor,
// pero conservando encima cualquier cambio local que aún esté pendiente de
// sincronizar (para no "pisar" algo que el usuario acaba de hacer sin señal).
async function mirrorReplaceAll(table, remoteRows, pendingOpsForTable) {
  await openLocalDB();
  const merged = new Map(remoteRows.map((r) => [r.id, r]));
  pendingOpsForTable.forEach((op) => {
    if (op.type === 'delete') merged.delete(op.id);
    else merged.set(op.id, op.payload);
  });

  return new Promise((resolve, reject) => {
    const store = tx(table, 'readwrite');
    store.clear();
    merged.forEach((row) => store.put(row));
    const t = store.transaction;
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---- Outbox -------------------------------------------------------------------

async function outboxEnqueue(op) {
  await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = tx('outbox', 'readwrite').add({ ...op, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function outboxGetAll() {
  await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = tx('outbox').getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.opId - b.opId));
    req.onerror = () => reject(req.error);
  });
}

async function outboxRemove(opId) {
  await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = tx('outbox', 'readwrite').delete(opId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const LocalDB = {
  TABLES,
  openLocalDB,
  mirrorGetAll,
  mirrorGetById,
  mirrorPut,
  mirrorDelete,
  mirrorReplaceAll,
  outboxEnqueue,
  outboxGetAll,
  outboxRemove,
};
