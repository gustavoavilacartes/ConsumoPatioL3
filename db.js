// ============================================================================
// db.js — Capa de persistencia (Supabase / Postgres)
// Patio Madera ARAUCO
//
// Reemplaza la versión anterior basada en IndexedDB local por Supabase, para
// que todos los dispositivos lean y escriban la misma base en la nube.
// Mantiene la MISMA interfaz pública (STORES, getAll, getById, getByIndex,
// add, put, remove, seedIfEmpty, nextFolio) para que las vistas no requieran
// cambios.
//
// Modelo de dominio (sin cambios):
//   Viaje: nace cuando una GRÚA carga un TRACTOR en una COLUMNA de cancha.
//   Atraviesa 3 estados: 'cargado' -> 'en_transito' -> 'completado'.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORES = {
  VIAJES: 'viajes',
  COLUMNAS: 'columnas',
  TRACTORES: 'tractores',
  LINEAS: 'lineas',
};

// ---- Mapeo camelCase (JS) <-> snake_case (Postgres) -------------------------

const FIELD_MAPS = {
  tractores: { nombre: 'nombre', patente: 'patente', capacidad: 'capacidad', estado: 'estado' },
  columnas: { nombre: 'nombre', tipoMadera: 'tipo_madera', volumenTotal: 'volumen_total', volumenDisponible: 'volumen_disponible' },
  lineas: { nombre: 'nombre', consumoAcumulado: 'consumo_acumulado' },
  viajes: {
    folio: 'folio', tractorId: 'tractor_id', tractorNombre: 'tractor_nombre',
    columnaId: 'columna_id', columnaNombre: 'columna_nombre', tipoMadera: 'tipo_madera',
    volumenCarga: 'volumen_carga', lineaId: 'linea_id', lineaNombre: 'linea_nombre',
    volumenDescarga: 'volumen_descarga', estado: 'estado', fechaCarga: 'fecha_carga',
    horaCarga: 'hora_carga', horaTransito: 'hora_transito', horaDescarga: 'hora_descarga',
    observaciones: 'observaciones',
  },
};

function toDb(storeName, obj) {
  const map = FIELD_MAPS[storeName];
  const row = {};
  for (const [jsKey, dbKey] of Object.entries(map)) {
    if (obj[jsKey] !== undefined) row[dbKey] = obj[jsKey];
  }
  return row;
}

function fromDb(storeName, row) {
  if (!row) return row;
  const map = FIELD_MAPS[storeName];
  const obj = { id: row.id };
  for (const [jsKey, dbKey] of Object.entries(map)) {
    obj[jsKey] = row[dbKey];
  }
  return obj;
}

function checkError(error) {
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message || 'Error de conexión con Supabase');
  }
}

// ---- CRUD genérico ------------------------------------------------------------

async function getAll(storeName) {
  const { data, error } = await supabase.from(storeName).select('*').order('id', { ascending: true });
  checkError(error);
  return data.map((row) => fromDb(storeName, row));
}

async function getById(storeName, id) {
  const { data, error } = await supabase.from(storeName).select('*').eq('id', id).maybeSingle();
  checkError(error);
  return fromDb(storeName, data);
}

async function getByIndex(storeName, indexName, value) {
  const { data, error } = await supabase.from(storeName).select('*').eq(indexName, value).order('id', { ascending: true });
  checkError(error);
  return data.map((row) => fromDb(storeName, row));
}

async function add(storeName, obj) {
  const payload = toDb(storeName, obj);
  const { data, error } = await supabase.from(storeName).insert(payload).select().single();
  checkError(error);
  return data.id;
}

async function put(storeName, obj) {
  const { id, ...rest } = obj;
  const payload = toDb(storeName, rest);
  const { error } = await supabase.from(storeName).update(payload).eq('id', id);
  checkError(error);
  return id;
}

async function remove(storeName, id) {
  const { error } = await supabase.from(storeName).delete().eq('id', id);
  checkError(error);
}

// ---- Seed (solo corre si las tablas están vacías; normalmente ya se sembraron
//      desde sql/schema.sql, esto es un respaldo por si el proyecto está limpio) ---

async function seedIfEmpty() {
  const tractores = await getAll(STORES.TRACTORES);
  if (tractores.length > 0) return;

  const seedTractores = [
    { nombre: 'Tractor 07', patente: 'TR-07', capacidad: 35, estado: 'disponible' },
    { nombre: 'Tractor 12', patente: 'TR-12', capacidad: 40, estado: 'disponible' },
    { nombre: 'Tractor 03', patente: 'TR-03', capacidad: 30, estado: 'disponible' },
    { nombre: 'Tractor 21', patente: 'TR-21', capacidad: 38, estado: 'disponible' },
  ];
  const seedColumnas = [
    { nombre: 'COL-01', tipoMadera: 'Pino Radiata', volumenTotal: 800, volumenDisponible: 620 },
    { nombre: 'COL-02', tipoMadera: 'Eucalipto', volumenTotal: 650, volumenDisponible: 410 },
    { nombre: 'COL-03', tipoMadera: 'Pino Radiata', volumenTotal: 900, volumenDisponible: 900 },
  ];
  const seedLineas = [
    { nombre: 'Línea 1 · Descortezado', consumoAcumulado: 0 },
    { nombre: 'Línea 2 · Astillado', consumoAcumulado: 0 },
    { nombre: 'Línea 3 · Aserradero', consumoAcumulado: 0 },
    { nombre: 'Línea 4 · Biomasa', consumoAcumulado: 0 },
  ];

  for (const t of seedTractores) await add(STORES.TRACTORES, t);
  for (const c of seedColumnas) await add(STORES.COLUMNAS, c);
  for (const l of seedLineas) await add(STORES.LINEAS, l);
}

async function nextFolio() {
  const { count, error } = await supabase.from(STORES.VIAJES).select('*', { count: 'exact', head: true });
  checkError(error);
  const year = new Date().getFullYear();
  return `V-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
}

// ---- Realtime -------------------------------------------------------------------
// Suscribe a cambios en las 4 tablas y ejecuta `onChange` cada vez que otro
// dispositivo inserta/actualiza/elimina algo. Así todos ven los mismos datos
// sin recargar la página.

function subscribeRealtime(onChange) {
  const channel = supabase.channel('patio-realtime-changes');
  [STORES.VIAJES, STORES.TRACTORES, STORES.COLUMNAS, STORES.LINEAS].forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  });
  channel.subscribe();
  return () => supabase.removeChannel(channel);
}

export const DB = { STORES, getAll, getById, getByIndex, add, put, remove, seedIfEmpty, nextFolio, subscribeRealtime };
