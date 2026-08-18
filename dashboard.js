// ============================================================================
// views/dashboard.js — Tablero Kanban: visualiza los 3 estados del viaje
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, fmtHora, el } from '../utils.js';

export async function renderDashboard(root) {
  const [viajes, lineas] = await Promise.all([DB.getAll(DB.STORES.VIAJES), DB.getAll(DB.STORES.LINEAS)]);
  const hoy = new Date().toISOString().split('T')[0];
  const viajesHoy = viajes.filter(v => v.fechaCarga === hoy);

  const cargados = viajes.filter(v => v.estado === 'cargado').sort((a, b) => new Date(b.horaCarga) - new Date(a.horaCarga));
  const transito = viajes.filter(v => v.estado === 'en_transito').sort((a, b) => new Date(b.horaTransito) - new Date(a.horaTransito));
  const completadosHoy = viajesHoy.filter(v => v.estado === 'completado').sort((a, b) => new Date(b.horaDescarga) - new Date(a.horaDescarga));
  const volumenHoy = viajesHoy.filter(v => v.estado === 'completado').reduce((s, v) => s + (v.volumenDescarga || 0), 0);

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, 'Panel de Control'),
    el('p', { class: 'view-sub' }, 'Estado en tiempo real del flujo grúa → tractor → línea.'),
  ]));

  root.appendChild(el('div', { class: 'kpi-row' }, [
    kpi('Viajes hoy', viajesHoy.length),
    kpi('Tractores cargados', cargados.length),
    kpi('En tránsito', transito.length),
    kpi('m³ entregados hoy', volumenHoy.toFixed(2)),
  ]));

  root.appendChild(el('div', { class: 'lineas-row' }, lineas.map(l => el('div', { class: 'linea-box' }, [
    el('h4', {}, l.nombre),
    el('div', { class: 'val' }, fmtM3(l.consumoAcumulado)),
  ]))));

  const board = el('div', { class: 'kanban' });
  board.appendChild(kanbanColumn('01 · Cargado en tractor', cargados, 'cargado'));
  board.appendChild(kanbanColumn('02 · En tránsito', transito, 'transito'));
  board.appendChild(kanbanColumn('03 · Completado hoy', completadosHoy, 'completado'));
  root.appendChild(board);
}

function kpi(label, value) {
  return el('div', { class: 'kpi' }, [el('div', { class: 'kpi-value' }, String(value)), el('div', { class: 'kpi-label' }, label)]);
}

function kanbanColumn(title, items, variant) {
  const col = el('div', { class: `kanban-col kanban-${variant}` });
  col.appendChild(el('div', { class: 'kanban-col-header' }, [el('span', {}, title), el('span', { class: 'kanban-count' }, String(items.length))]));
  const body = el('div', { class: 'kanban-col-body' });
  if (items.length === 0) body.appendChild(el('p', { class: 'empty' }, 'Sin viajes.'));
  else items.forEach(v => body.appendChild(kanbanCard(v, variant)));
  col.appendChild(body);
  return col;
}

function kanbanCard(v, variant) {
  const linea2 = variant === 'cargado' ? `${v.tractorNombre} · ${v.columnaNombre}`
    : variant === 'transito' ? `${v.tractorNombre} → ${v.lineaNombre}`
      : `${v.tractorNombre} · ${v.lineaNombre}`;
  const hora = variant === 'cargado' ? v.horaCarga : variant === 'transito' ? v.horaTransito : v.horaDescarga;
  return el('div', { class: 'kcard' }, [
    el('div', { class: 'kcard-folio' }, v.folio),
    el('div', { class: 'kcard-line' }, linea2),
    el('div', { class: 'kcard-time' }, `${fmtM3(v.volumenCarga)} · ${fmtHora(hora)}`),
  ]);
}
