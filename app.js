// ============================================================================
// app.js — Orquestador principal / router de vistas
// ============================================================================
import { DB } from './db.js';
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

async function boot() {
  await ensureAuthenticated();

  try {
    await DB.seedIfEmpty();
  } catch (err) {
    toast('No se pudo conectar a Supabase. Revisa js/supabaseConfig.js', 'error');
    console.error(err);
  }

  initNav();

  const initial = (window.location.hash || '#dashboard').replace('#', '');
  navigate(VIEWS[initial] ? initial : 'dashboard');

  // Sincronización en vivo: si otro dispositivo carga/despacha/descarga un
  // viaje, o edita tractores/columnas/líneas, esta vista se refresca sola.
  DB.subscribeRealtime(() => {
    if (VIEWS[currentView]) VIEWS[currentView](root);
  });

  if ('serviceWorker' in navigator) {
    const swUrl = new URL('sw.js', window.location.href);
    navigator.serviceWorker.register(swUrl).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
