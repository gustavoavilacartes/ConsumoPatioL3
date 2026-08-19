// ============================================================================
// views/recursos.js — CRUD de Tractores, Columnas y Líneas de destino.
// Cada ficha permite Editar (en línea, sin borrar) o Eliminar.
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, toast, el } from '../utils.js';

let activeTab = 'tractores';
// Guarda qué ficha está en modo edición por pestaña (id o null).
const editState = { tractores: null, columnas: null, lineas: null };

export async function renderRecursos(root) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, 'Recursos Maestros'),
    el('p', { class: 'view-sub' }, 'Flota de tractores, columnas de cancha y líneas de destino. Todo editable — agrega, corrige o quita recursos según cambie la operación.'),
  ]));

  const tabs = el('div', { class: 'tabs' }, [tabBtn('tractores', 'Tractores'), tabBtn('columnas', 'Columnas'), tabBtn('lineas', 'Líneas')]);
  root.appendChild(tabs);
  const body = el('div', { id: 'recursos-body' });
  root.appendChild(body);

  tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderRecursos(root); }));

  if (activeTab === 'tractores') await renderTractores(body);
  if (activeTab === 'columnas') await renderColumnas(body);
  if (activeTab === 'lineas') await renderLineas(body);
}

function tabBtn(id, label) { return el('button', { class: `tab-btn ${activeTab === id ? 'active' : ''}`, 'data-tab': id }, label); }

// ---- Tractores ----------------------------------------------------------------

async function renderTractores(body) {
  const tractores = await DB.getAll(DB.STORES.TRACTORES);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  form.appendChild(field('trac-nombre', 'text', 'Nombre'));
  form.appendChild(field('trac-patente', 'text', 'Patente'));
  form.appendChild(field('trac-capacidad', 'number', 'Capacidad (m³)', '0.1'));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary' }, 'Agregar tractor'));
  body.appendChild(form);

  const grid = el('div', { class: 'card-grid' });
  tractores.forEach(t => grid.appendChild(
    editState.tractores === t.id ? tractorEditCard(t, body) : tractorViewCard(t, body)
  ));
  body.appendChild(grid);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('trac-nombre').value;
    const patente = document.getElementById('trac-patente').value;
    const capacidad = parseFloat(document.getElementById('trac-capacidad').value);
    if (!nombre || !capacidad) return;
    await DB.add(DB.STORES.TRACTORES, { nombre, patente, capacidad, estado: 'disponible' });
    toast('Tractor agregado', 'success');
    renderTractores(body);
  });
}

function tractorViewCard(t, body) {
  return el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, `${t.nombre} · ${t.patente}`),
    el('div', { class: 'card-meta' }, `Capacidad ${fmtM3(t.capacidad)}`),
    el('span', { class: `badge badge-${t.estado === 'disponible' ? 'cargado' : 'transito'}` }, t.estado === 'disponible' ? 'Disponible' : 'Ocupado'),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.tractores = t.id; renderTractores(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.TRACTORES, t.id); renderTractores(body); } }, 'Eliminar'),
    ]),
  ]);
}

function tractorEditCard(t, body) {
  const nombreI = el('input', { value: t.nombre });
  const patenteI = el('input', { value: t.patente });
  const capI = el('input', { type: 'number', step: '0.1', value: t.capacidad });
  return el('div', { class: 'card card-recurso card-editing' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Nombre'), nombreI]),
    el('div', { class: 'field' }, [el('label', {}, 'Patente'), patenteI]),
    el('div', { class: 'field' }, [el('label', {}, 'Capacidad (m³)'), capI]),
    el('div', { class: 'card-action' }, [
      el('button', {
        class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
          const capacidad = parseFloat(capI.value);
          if (!nombreI.value || !patenteI.value || !capacidad) { toast('Completa todos los campos', 'error'); return; }
          await DB.put(DB.STORES.TRACTORES, { ...t, nombre: nombreI.value, patente: patenteI.value, capacidad });
          editState.tractores = null;
          toast('Tractor actualizado', 'success');
          renderTractores(body);
        },
      }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.tractores = null; renderTractores(body); } }, 'Cancelar'),
    ]),
  ]);
}

// ---- Columnas -------------------------------------------------------------------

async function renderColumnas(body) {
  const columnas = await DB.getAll(DB.STORES.COLUMNAS);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  form.appendChild(field('col-nombre', 'text', 'Nombre / ID'));
  form.appendChild(field('col-tipo', 'text', 'Tipo de madera'));
  form.appendChild(field('col-volumen', 'number', 'Volumen total (m³)', '0.1'));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary' }, 'Agregar columna'));
  body.appendChild(form);

  const grid = el('div', { class: 'card-grid' });
  columnas.forEach(c => grid.appendChild(
    editState.columnas === c.id ? columnaEditCard(c, body) : columnaViewCard(c, body)
  ));
  body.appendChild(grid);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('col-nombre').value;
    const tipo = document.getElementById('col-tipo').value;
    const volumen = parseFloat(document.getElementById('col-volumen').value);
    if (!nombre || !tipo || !volumen) return;
    await DB.add(DB.STORES.COLUMNAS, { nombre, tipoMadera: tipo, volumenTotal: volumen, volumenDisponible: volumen });
    toast('Columna agregada', 'success');
    renderColumnas(body);
  });
}

function columnaViewCard(c, body) {
  return el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, c.nombre),
    el('div', { class: 'card-meta' }, `${c.tipoMadera} · disp. ${fmtM3(c.volumenDisponible)} / ${fmtM3(c.volumenTotal)}`),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.columnas = c.id; renderColumnas(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.COLUMNAS, c.id); renderColumnas(body); } }, 'Eliminar'),
    ]),
  ]);
}

function columnaEditCard(c, body) {
  const nombreI = el('input', { value: c.nombre });
  const tipoI = el('input', { value: c.tipoMadera });
  const totalI = el('input', { type: 'number', step: '0.1', value: c.volumenTotal });
  const dispI = el('input', { type: 'number', step: '0.1', value: c.volumenDisponible });
  return el('div', { class: 'card card-recurso card-editing' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Nombre / ID'), nombreI]),
    el('div', { class: 'field' }, [el('label', {}, 'Tipo de madera'), tipoI]),
    el('div', { class: 'field' }, [el('label', {}, 'Volumen total (m³)'), totalI]),
    el('div', { class: 'field' }, [el('label', {}, 'Volumen disponible (m³)'), dispI]),
    el('div', { class: 'card-action' }, [
      el('button', {
        class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
          const volumenTotal = parseFloat(totalI.value);
          const volumenDisponible = parseFloat(dispI.value);
          if (!nombreI.value || !tipoI.value || !volumenTotal || volumenDisponible < 0) { toast('Revisa los campos', 'error'); return; }
          await DB.put(DB.STORES.COLUMNAS, { ...c, nombre: nombreI.value, tipoMadera: tipoI.value, volumenTotal, volumenDisponible });
          editState.columnas = null;
          toast('Columna actualizada', 'success');
          renderColumnas(body);
        },
      }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.columnas = null; renderColumnas(body); } }, 'Cancelar'),
    ]),
  ]);
}

// ---- Líneas -------------------------------------------------------------------

async function renderLineas(body) {
  const lineas = await DB.getAll(DB.STORES.LINEAS);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  form.appendChild(field('linea-nombre', 'text', 'Nombre de línea'));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary' }, 'Agregar línea'));
  body.appendChild(form);

  const grid = el('div', { class: 'card-grid' });
  lineas.forEach(l => grid.appendChild(
    editState.lineas === l.id ? lineaEditCard(l, body) : lineaViewCard(l, body)
  ));
  body.appendChild(grid);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('linea-nombre').value;
    if (!nombre) return;
    await DB.add(DB.STORES.LINEAS, { nombre, consumoAcumulado: 0 });
    toast('Línea agregada', 'success');
    renderLineas(body);
  });
}

function lineaViewCard(l, body) {
  return el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, l.nombre),
    el('div', { class: 'card-meta' }, `Consumo acumulado: ${fmtM3(l.consumoAcumulado)}`),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.lineas = l.id; renderLineas(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.LINEAS, l.id); renderLineas(body); } }, 'Eliminar'),
    ]),
  ]);
}

function lineaEditCard(l, body) {
  const nombreI = el('input', { value: l.nombre });
  const consumoI = el('input', { type: 'number', step: '0.01', value: l.consumoAcumulado });
  return el('div', { class: 'card card-recurso card-editing' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Nombre de línea'), nombreI]),
    el('div', { class: 'field' }, [el('label', {}, 'Consumo acumulado (m³)'), consumoI]),
    el('div', { class: 'card-action' }, [
      el('button', {
        class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
          const consumoAcumulado = parseFloat(consumoI.value);
          if (!nombreI.value || isNaN(consumoAcumulado) || consumoAcumulado < 0) { toast('Revisa los campos', 'error'); return; }
          await DB.put(DB.STORES.LINEAS, { ...l, nombre: nombreI.value, consumoAcumulado });
          editState.lineas = null;
          toast('Línea actualizada', 'success');
          renderLineas(body);
        },
      }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.lineas = null; renderLineas(body); } }, 'Cancelar'),
    ]),
  ]);
}

function field(id, type, label, step) {
  const attrs = { id, type, required: 'true' };
  if (step) attrs.step = step;
  return el('div', { class: 'field' }, [el('label', {}, label), el('input', attrs)]);
}
