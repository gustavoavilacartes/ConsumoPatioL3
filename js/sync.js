// ============================================================================
// sync.js — Motor de sincronización offline-first
//
// Ciclo de vida:
//   1. Al abrir la app: intenta traer todo de Supabase al espejo local
//      (pullAll). Si no hay señal, usa lo que ya había quedado guardado en
//      el celular de la última vez.
//   2. Cada cambio del usuario (carga, despacho, descarga...) escribe primero
//      en el espejo local (la pantalla se actualiza al instante, sin esperar
//      red) y encola la operación en el "outbox".
//   3. En cuanto hay conexión (evento 'online', o cada cierto tiempo por si
//      el evento no se dispara), se vacía el outbox contra Supabase en
//      orden. Al terminar, se vuelve a sincronizar el espejo completo.
//   4. Mientras hay conexión, Supabase Realtime avisa de cambios hechos
//      desde OTROS dispositivos y los va mezclando en el espejo local.
// ============================================================================
import { supabase } from './db.js';
import { LocalDB } from './localdb.js';

const RETRY_INTERVAL_MS = 20000;

let statusListeners = [];
let changeListeners = [];
let syncing = false;
let realtimeChannel = null;

const status = {
  online: navigator.onLine,
  pending: 0,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
};

function notifyStatus() {
  statusListeners.forEach((fn) => fn({ ...status }));
}

function notifyChange() {
  changeListeners.forEach((fn) => fn());
}

async function refreshPendingCount() {
  const outbox = await LocalDB.outboxGetAll();
  status.pending = outbox.length;
  notifyStatus();
}

// ---- Pull: trae los 4 conjuntos de datos desde Supabase ----------------------

export async function pullAll() {
  if (!navigator.onLine) return false;
  try {
    const outbox = await LocalDB.outboxGetAll();
    for (const table of LocalDB.TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      const pendingForTable = outbox.filter((op) => op.table === table);
      await LocalDB.mirrorReplaceAll(table, data.map(fromDbRow), pendingForTable);
    }
    status.lastSyncAt = Date.now();
    status.lastError = null;
    notifyChange();
    return true;
  } catch (err) {
    console.error('pullAll error:', err);
    status.lastError = err.message || 'Error al sincronizar';
    notifyStatus();
    return false;
  }
}

// ---- Push: vacía el outbox contra Supabase, en orden --------------------------

async function flushOutbox() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  status.syncing = true;
  notifyStatus();

  try {
    let ops = await LocalDB.outboxGetAll();
    for (const op of ops) {
      const ok = await applyOp(op);
      if (!ok.retry) {
        await LocalDB.outboxRemove(op.opId);
        await refreshPendingCount();
      } else {
        // Error de red: paramos acá, se reintenta más tarde.
        break;
      }
    }
  } finally {
    syncing = false;
    status.syncing = false;
    notifyStatus();
  }
}

async function applyOp(op) {
  try {
    const row = toDbRow(op.payload);
    if (op.type === 'insert' || op.type === 'update') {
      const { error } = await supabase.from(op.table).upsert(row, { onConflict: 'id' });
      if (error) throw error;
    } else if (op.type === 'delete') {
      const { error } = await supabase.from(op.table).delete().eq('id', op.id);
      if (error) throw error;
    }
    return { retry: false };
  } catch (err) {
    // Sin conexión / timeout → reintentar más tarde. Error de validación del
    // servidor (RLS, constraint) → no tiene sentido reintentar indefinidamente;
    // lo dejamos registrado y descartamos para no bloquear el resto de la cola.
    const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine;
    if (isNetworkError) return { retry: true };
    console.error(`Sync: operación descartada tras error del servidor (${op.table}/${op.type}):`, err.message);
    status.lastError = `${op.table}: ${err.message}`;
    return { retry: false };
  }
}

// ---- Mapeo camelCase <-> snake_case (igual que antes) -------------------------

const FIELD_MAPS = {
  tractores: { id: 'id', nombre: 'nombre', patente: 'patente', capacidad: 'capacidad', estado: 'estado', createdAt: 'created_at' },
  columnas: { id: 'id', nombre: 'nombre', tipoMadera: 'tipo_madera', volumenTotal: 'volumen_total', volumenDisponible: 'volumen_disponible', createdAt: 'created_at' },
  lineas: { id: 'id', nombre: 'nombre', consumoAcumulado: 'consumo_acumulado', createdAt: 'created_at' },
  viajes: {
    id: 'id', folio: 'folio', tractorId: 'tractor_id', tractorNombre: 'tractor_nombre',
    columnaId: 'columna_id', columnaNombre: 'columna_nombre', tipoMadera: 'tipo_madera',
    volumenCarga: 'volumen_carga', lineaId: 'linea_id', lineaNombre: 'linea_nombre',
    volumenDescarga: 'volumen_descarga', estado: 'estado', fechaCarga: 'fecha_carga',
    horaCarga: 'hora_carga', horaTransito: 'hora_transito', horaDescarga: 'hora_descarga',
    observaciones: 'observaciones', createdAt: 'created_at',
  },
};

function toDbRow(obj) {
  const table = obj.__table;
  const map = FIELD_MAPS[table] || guessTable(obj);
  const row = {};
  for (const [jsKey, dbKey] of Object.entries(map)) {
    if (obj[jsKey] !== undefined) row[dbKey] = obj[jsKey];
  }
  return row;
}

function guessTable(obj) {
  if ('folio' in obj) return FIELD_MAPS.viajes;
  if ('capacidad' in obj) return FIELD_MAPS.tractores;
  if ('volumenTotal' in obj) return FIELD_MAPS.columnas;
  return FIELD_MAPS.lineas;
}

function fromDbRow(row) {
  // Detecta la tabla por columnas presentes y devuelve el objeto en camelCase.
  let map;
  if ('folio' in row) map = FIELD_MAPS.viajes;
  else if ('capacidad' in row) map = FIELD_MAPS.tractores;
  else if ('volumen_total' in row) map = FIELD_MAPS.columnas;
  else map = FIELD_MAPS.lineas;

  const obj = {};
  for (const [jsKey, dbKey] of Object.entries(map)) obj[jsKey] = row[dbKey];
  return obj;
}

// ---- Realtime -------------------------------------------------------------------

function startRealtime() {
  if (realtimeChannel) return;
  realtimeChannel = supabase.channel('patio-realtime-changes');
  LocalDB.TABLES.forEach((table) => {
    realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table }, async (payload) => {
      if (payload.eventType === 'DELETE') {
        await LocalDB.mirrorDelete(table, payload.old.id);
      } else {
        await LocalDB.mirrorPut(table, fromDbRow(payload.new));
      }
      notifyChange();
    });
  });
  realtimeChannel.subscribe();
}

// ---- Ciclo de conexión ---------------------------------------------------------

function setOnline(isOnline) {
  const wasOnline = status.online;
  status.online = isOnline;
  notifyStatus();
  if (isOnline && !wasOnline) {
    flushOutbox().then(pullAll).then(startRealtime);
  }
}

export function initSync() {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));

  refreshPendingCount();

  if (navigator.onLine) {
    flushOutbox().then(pullAll).then(startRealtime);
  }

  setInterval(() => {
    if (navigator.onLine) flushOutbox();
  }, RETRY_INTERVAL_MS);
}

export function onStatusChange(fn) {
  statusListeners.push(fn);
  fn({ ...status });
  return () => { statusListeners = statusListeners.filter((f) => f !== fn); };
}

export function onDataChange(fn) {
  changeListeners.push(fn);
  return () => { changeListeners = changeListeners.filter((f) => f !== fn); };
}

// Llamado por db.js cada vez que se encola un cambio nuevo, para intentar
// mandarlo de inmediato si hay señal (y para que el badge de pendientes
// se actualice al toque).
export function kick() {
  refreshPendingCount();
  if (navigator.onLine) flushOutbox();
}

export function getStatus() {
  return { ...status };
}
