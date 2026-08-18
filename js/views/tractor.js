// ============================================================================
// views/tractor.js — Módulo 2: TRACTOR (elige línea entre las 4 fijas y parte)
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, fmtHora, toast, el } from '../utils.js';

export async function renderTractor(root) {
  const [pendientes, enTransito, tractores, lineas] = await Promise.all([
    DB.getByIndex(DB.STORES.VIAJES, 'estado', 'cargado'),
    DB.getByIndex(DB.STORES.VIAJES, 'estado', 'en_transito'),
    DB.getAll(DB.STORES.TRACTORES),
    DB.getAll(DB.STORES.LINEAS),
  ]);
  pendientes.sort((a, b) => new Date(a.horaCarga) - new Date(b.horaCarga));
  enTransito.sort((a, b) => new Date(b.horaTransito) - new Date(a.horaTransito));

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, '02 · Tractor — Transporte a Línea'),
    el('p', { class: 'view-sub' }, 'Cada tractor cargado elige una de las 4 líneas de destino y parte en ruta.'),
  ]));

  root.appendChild(el('div', { class: 'fleet-strip' }, tractores.map(t => el('span', { class: `pill pill-${t.estado}` }, `${t.nombre} · ${t.estado === 'disponible' ? 'Disponible' : 'Ocupado'}`))));

  root.appendChild(el('h3', { class: 'section-title' }, `Tractores cargados, listos para partir (${pendientes.length})`));
  const listPend = el('div', { class: 'card-grid' });
  if (pendientes.length === 0) listPend.appendChild(el('p', { class: 'empty' }, 'No hay tractores esperando destino.'));
  else pendientes.forEach(v => listPend.appendChild(despacharCard(v, lineas)));
  root.appendChild(listPend);

  root.appendChild(el('h3', { class: 'section-title' }, `En tránsito (${enTransito.length})`));
  const listTrans = el('div', { class: 'card-grid' });
  if (enTransito.length === 0) listTrans.appendChild(el('p', { class: 'empty' }, 'No hay tractores en ruta actualmente.'));
  else enTransito.forEach(v => listTrans.appendChild(transitoCard(v)));
  root.appendChild(listTrans);

  root.querySelectorAll('[data-despachar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const viajeId = btn.dataset.despachar;
      const lineaId = btn.dataset.linea;
      const [viaje, linea] = await Promise.all([
        DB.getById(DB.STORES.VIAJES, viajeId),
        DB.getById(DB.STORES.LINEAS, lineaId),
      ]);

      viaje.lineaId = linea.id;
      viaje.lineaNombre = linea.nombre;
      viaje.estado = 'en_transito';
      viaje.horaTransito = new Date().toISOString();
      await DB.put(DB.STORES.VIAJES, viaje);

      toast(`${viaje.tractorNombre} en ruta a ${linea.nombre}`, 'success');
      renderTractor(root);
    });
  });
}

function despacharCard(v, lineas) {
  const lineBtns = el('div', { class: 'line-btns' }, lineas.map(l =>
    el('button', { class: 'line-btn', type: 'button', 'data-despachar': v.id, 'data-linea': l.id }, l.nombre)
  ));
  return el('div', { class: 'card card-cargado' }, [
    el('div', { class: 'card-folio' }, v.folio),
    el('div', { class: 'card-main' }, `${v.tractorNombre} · ${v.columnaNombre}`),
    el('div', { class: 'card-meta' }, `${fmtM3(v.volumenCarga)} · cargado ${fmtHora(v.horaCarga)}`),
    el('div', { class: 'card-meta' }, 'Elegir línea destino:'),
    lineBtns,
  ]);
}

function transitoCard(v) {
  return el('div', { class: 'card card-transito' }, [
    el('div', { class: 'card-folio' }, v.folio),
    el('div', { class: 'card-main' }, `${v.tractorNombre} → ${v.lineaNombre}`),
    el('div', { class: 'card-meta' }, `${fmtM3(v.volumenCarga)} · en ruta desde ${fmtHora(v.horaTransito)}`),
    el('div', { class: 'badge badge-transito' }, 'En tránsito'),
  ]);
}
