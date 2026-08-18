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

async function pullAll() {
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
    for
