// ============================================================================
// app.js — Orquestador principal / router de vistas
// ============================================================================
import { DB } from './db.js';
import { initSync, onStatusChange } from './sync.js';
import { ensureAuthenticated, logout } from './auth.js';
import { toast } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCarga } from './views/carga.js';
import { renderTractor } from './views/tractor.js';
import { renderDescarga } from './views/descarga.js';
import { renderRecursos } from './views/recursos.js';
import { renderReportes } from './views/reportes.js';

const VIEWS = {
  dashboard: renderDashboard,
  carga: renderCarga,
  tractor: renderTractor,
  descarga: renderDescarga,
  recursos: renderRecursos,
  reportes: renderReportes,
};

const root = document.getElementById('view-root');
let currentView = 'dashboard';

async function navigate(viewId) {
  currentView = viewId;
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === viewId));
  document.getElementById('nav-menu').classList.remove('open');
  window.location.hash = viewId;
  root.classList.add('fade');
  await VIEWS[viewId](root);
  requestAnimationFrame(() => root.classList.remove('fade'));
}

function initNav() {
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.dataset.view); });
  });
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('nav-menu').classList.toggle('open');
  });
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

function initSyncBadge() {
  const badge = document.getElementById('sync-status');
  if (!badge) return;
  onStatusChange((status) => {
    badge.classList.remove('sync-ok', 'sync-offline', 'sync-pending');
    if (!status.online) {
      badge.textContent = status.pending > 0
        ? `Sin conexión · ${status.pending} cambio${status.pending === 1 ? '' : 's'} pendiente${status.pending === 1 ? '' : 's'}`
        : 'Sin conexión · trabajando local';
      badge.classList.add('sync-offline');
    } else if (status.syncing || status.pending > 0) {
      badge.textContent = `Sincronizando · ${status.pending} pendiente${status.pending === 1 ? '' : 's'}`;
      badge.classList.add('sync-pending');
    } else {
      badge.textContent = 'Sincronizado · Supabase';
      badge.classList.add('sync-ok');
    }
  });
}

async function boot() {
  await ensureAuthenticated();

  try {
    await DB.seedIfEmpty();
  } catch (err) {
    toast('No se pudo preparar los datos locales.', 'error');
    console.error(err);
  }

  initNav();
  initSyncBadge();

  const initial = (window.location.hash || '#dashboard').replace('#', '');
  navigate(VIEWS[initial] ? initial : 'dashboard');

  // Motor de sincronización: pull inicial si hay señal, cola de reintentos,
  // y Realtime para reflejar cambios de otros dispositivos.
  initSync();

  // Cada vez que el espejo local cambia (por sync o por Realtime), refresca
  // la vista actual para que se vea al instante.
  DB.subscribeRealtime(() => {
    if (VIEWS[currentView]) VIEWS[currentView](root);
  });

  if ('serviceWorker' in navigator) {
    const swUrl = new URL('sw.js', window.location.href);
    navigator.serviceWorker.register(swUrl).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
