// ============================================================================
// views/carga.js — Módulo 1: CARGA (grúa carga tractor en columna)
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, fmtHora, toast, el } from '../utils.js';

export async function renderCarga(root) {
  const [columnas, tractores] = await Promise.all([
    DB.getAll(DB.STORES.COLUMNAS),
    DB.getAll(DB.STORES.TRACTORES),
  ]);
  const tractoresDisp = tractores.filter(t => t.estado === 'disponible');
  const pendientes = (await DB.getByIndex(DB.STORES.VIAJES, 'estado', 'cargado'))
    .sort((a, b) => new Date(b.horaCarga) - new Date(a.horaCarga));

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, '01 · Carga — Grúa carga Tractor en Columna'),
    el('p', { class: 'view-sub' }, 'La grúa de cancha carga un tractor disponible con madera de una columna. El tractor queda ocupado hasta ser descargado en línea.'),
  ]));

  const form = el('form', { class: 'panel form-grid', id: 'form-carga' });
  const tractorSel = el('select', { id: 'carga-tractor', required: 'true' }, [
    el('option', { value: '' }, tractoresDisp.length ? '-- Selecciona tractor disponible --' : 'Sin tractores disponibles'),
    ...tractoresDisp.map(t => el('option', { value: t.id }, `${t.nombre} · cap. ${t.capacidad} m³`)),
  ]);
  const columnaSel = el('select', { id: 'carga-columna', required: 'true' }, [
    el('option', { value: '' }, '-- Selecciona columna --'),
    ...columnas.map(c => el('option', { value: c.id }, `${c.nombre} · ${c.tipoMadera} · disp. ${fmtM3(c.volumenDisponible)}`)),
  ]);

  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Tractor'), tractorSel]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Columna origen'), columnaSel]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Volumen a cargar (m³)'), el('input', { type: 'number', id: 'carga-volumen', step: '0.01', min: '0.01', required: 'true' })]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Observaciones'), el('input', { type: 'text', id: 'carga-obs', placeholder: 'Opcional' })]));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary', disabled: tractoresDisp.length ? null : 'true' }, 'Registrar carga'));
  root.appendChild(form);

  root.appendChild(el('h3', { class: 'section-title' }, `Tractores cargados, esperando destino (${pendientes.length})`));
  const list = el('div', { class: 'card-grid' });
  if (pendientes.length === 0) list.appendChild(el('p', { class: 'empty' }, 'No hay tractores cargados en este momento.'));
  else pendientes.forEach(v => list.appendChild(cargaCard(v)));
  root.appendChild(list);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tractorId = tractorSel.value;
    const columnaId = columnaSel.value;
    const volumen = parseFloat(document.getElementById('carga-volumen').value);
    const obs = document.getElementById('carga-obs').value;
    if (!tractorId || !columnaId || !volumen || volumen <= 0) return;

    const [tractor, columna] = await Promise.all([
      DB.getById(DB.STORES.TRACTORES, tractorId),
      DB.getById(DB.STORES.COLUMNAS, columnaId),
    ]);

    if (volumen > columna.volumenDisponible) {
      toast(`Volumen supera el disponible en ${columna.nombre} (${fmtM3(columna.volumenDisponible)})`, 'error');
      return;
    }
    if (volumen > tractor.capacidad) {
      toast(`Volumen supera la capacidad de ${tractor.nombre} (${fmtM3(tractor.capacidad)})`, 'error');
      return;
    }

    const folio = await DB.nextFolio();
    const iso = new Date().toISOString();
    await DB.add(DB.STORES.VIAJES, {
      folio, tractorId: tractor.id, tractorNombre: tractor.nombre,
      columnaId: columna.id, columnaNombre: columna.nombre, tipoMadera: columna.tipoMadera,
      volumenCarga: volumen, lineaId: null, lineaNombre: null, volumenDescarga: null,
      estado: 'cargado', fechaCarga: iso.split('T')[0], horaCarga: iso,
      horaTransito: null, horaDescarga: null, observaciones: obs || '',
    });

    columna.volumenDisponible = Number((columna.volumenDisponible - volumen).toFixed(2));
    await DB.put(DB.STORES.COLUMNAS, columna);
    tractor.estado = 'en_viaje';
    await DB.put(DB.STORES.TRACTORES, tractor);

    toast(`${folio}: ${tractor.nombre} cargado con ${fmtM3(volumen)} desde ${columna.nombre}`, 'success');
    renderCarga(root);
  });
}

function cargaCard(v) {
  return el('div', { class: 'card card-cargado' }, [
    el('div', { class: 'card-folio' }, v.folio),
    el('div', { class: 'card-main' }, `${v.tractorNombre} · ${v.columnaNombre}`),
    el('div', { class: 'card-meta' }, `${v.tipoMadera} · ${fmtM3(v.volumenCarga)} · ${fmtHora(v.horaCarga)}`),
    el('div', { class: 'badge badge-cargado' }, 'Esperando destino'),
  ]);
}
