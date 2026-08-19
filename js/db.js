// ============================================================================
// db.js — Interfaz pública de datos (offline-first)
// Patio Madera ARAUCO
//
// Las vistas (carga.js, tractor.js, descarga.js, etc.) NO hablan directo con
// Supabase. Hablan con esta interfaz, que:
//   - LEE siempre del espejo local (IndexedDB) → funciona sin señal.
//   - ESCRIBE primero al espejo local (la UI se actualiza al instante) y
//     encola el cambio en el outbox para mandarlo a Supabase apenas haya
//     conexión (ver sync.js).
//
// Los IDs se generan en el celular (UUID) al crear un registro, así que un
// tractor cargado sin señal ya tiene su ID definitivo desde el primer
// instante — no hace falta "renumerar" nada cuando vuelve la conexión.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js';
import { LocalDB } from './localdb.js';
import { kick, onDataChange } from './sync.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORES = {
  VIAJES: 'viajes',
  COLUMNAS: 'columnas',
  TRACTORES: 'tractores',
  LINEAS: 'lineas',
  PRODUCTOS: 'productos',
};

function uuid() {
  return crypto.randomUUID();
}

// ---- Lecturas: siempre desde el espejo local -----------------------------------

function sortKey(row) {
  if (row.createdAt) return new Date(row.createdAt).getTime();
  if (row.createdAtLocal) return row.createdAtLocal;
  return 0;
}

async function getAll(storeName) {
  const rows = await LocalDB.mirrorGetAll(storeName);
  return rows.sort((a, b) => sortKey(a) - sortKey(b));
}

async function getById(storeName, id) {
  return LocalDB.mirrorGetById(storeName, id);
}

async function getByIndex(storeName, field, value) {
  const rows = await LocalDB.mirrorGetAll(storeName);
  return rows.filter((r) => r[field] === value);
}

// ---- Escrituras: local primero (optimista), luego se encola para sync ---------

async function add(storeName, obj) {
  const row = { ...obj, id: obj.id || uuid(), createdAtLocal: Date.now() };
  await LocalDB.mirrorPut(storeName, row);
  await LocalDB.outboxEnqueue({ type: 'insert', table: storeName, id: row.id, payload: row });
  kick();
  return row.id;
}

async function put(storeName, obj) {
  await LocalDB.mirrorPut(storeName, obj);
  await LocalDB.outboxEnqueue({ type: 'update', table: storeName, id: obj.id, payload: obj });
  kick();
  return obj.id;
}

async function remove(storeName, id) {
  await LocalDB.mirrorDelete(storeName, id);
  await LocalDB.outboxEnqueue({ type: 'delete', table: storeName, id });
  kick();
}

// ---- Seed: siembra cada colección por separado (para que dispositivos que ya
//      tenían datos reciban igual las tablas nuevas, como Productos) ------------

async function seedIfEmpty() {
  const [tractores, columnas, lineas, productos] = await Promise.all([
    LocalDB.mirrorGetAll(STORES.TRACTORES),
    LocalDB.mirrorGetAll(STORES.COLUMNAS),
    LocalDB.mirrorGetAll(STORES.LINEAS),
    LocalDB.mirrorGetAll(STORES.PRODUCTOS),
  ]);

  if (tractores.length === 0) {
    const seedTractores = [
      { nombre: 'Tractor 07', patente: 'TR-07', capacidad: 35, estado: 'disponible' },
      { nombre: 'Tractor 12', patente: 'TR-12', capacidad: 40, estado: 'disponible' },
      { nombre: 'Tractor 03', patente: 'TR-03', capacidad: 30, estado: 'disponible' },
      { nombre: 'Tractor 21', patente: 'TR-21', capacidad: 38, estado: 'disponible' },
    ];
    for (const t of seedTractores) await add(STORES.TRACTORES, t);
  }

  if (columnas.length === 0) {
    const seedColumnas = [
      { nombre: 'COL-01', tipoMadera: 'Pino Radiata', volumenTotal: 800, volumenDisponible: 620 },
      { nombre: 'COL-02', tipoMadera: 'Eucalipto', volumenTotal: 650, volumenDisponible: 410 },
      { nombre: 'COL-03', tipoMadera: 'Pino Radiata', volumenTotal: 900, volumenDisponible: 900 },
    ];
    for (const c of seedColumnas) await add(STORES.COLUMNAS, c);
  }

  if (lineas.length === 0) {
    const seedLineas = [
      { nombre: 'Línea 1 · Descortezado', consumoAcumulado: 0 },
      { nombre: 'Línea 2 · Astillado', consumoAcumulado: 0 },
      { nombre: 'Línea 3 · Aserradero', consumoAcumulado: 0 },
      { nombre: 'Línea 4 · Biomasa', consumoAcumulado: 0 },
    ];
    for (const l of seedLineas) await add(STORES.LINEAS, l);
  }

  if (productos.length === 0) {
    const seedProductos = [
      { nombre: 'Pino Trozo Aserrable', mr: 1.000, factor: 0.700, m3ssc: 0.700 },
      { nombre: 'Eucalipto Pulpable', mr: 1.000, factor: 0.650, m3ssc: 0.650 },
    ];
    for (const p of seedProductos) await add(STORES.PRODUCTOS, p);
  }
}

// Folio 100% local — no depende de consultar al servidor (funciona sin señal).
async function nextFolio() {
  const fecha = new Date();
  const y = fecha.getFullYear();
  const compact = fecha.toISOString().slice(5, 16).replace(/[-:T]/g, '');
  return `V-${y}-${compact}`;
}

function subscribeRealtime(onChange) {
  // El motor de sync ya escucha Realtime + cambios locales; solo reenviamos
  // el aviso a quien llamó (app.js) para que refresque la vista actual.
  return onDataChange(onChange);
}

export const DB = { STORES, getAll, getById, getByIndex, add, put, remove, seedIfEmpty, nextFolio, subscribeRealtime };
