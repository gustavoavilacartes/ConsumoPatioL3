// ============================================================================
// views/recursos.js — CRUD de Tractores, Columnas, Líneas y Productos.
// Cada tab permite ver como Tarjetas o como Tabla, y editar en línea.
// Nota: los tractores NO tienen capacidad propia — la carga la determina
// el Producto elegido (su M3SSC), no un límite fijo del tractor.
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, toast, el } from '../utils.js';

let activeTab = 'tractores';
const editState = { tractores: null, columnas: null, lineas: null, productos: null };
const viewMode = { tractores: 'cards', columnas: 'cards', lineas: 'cards', productos: 'cards' };

export async function renderRecursos(root) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, 'Recursos Maestros'),
    el('p', { class: 'view-sub' }, 'Flota de tractores, columnas de cancha, líneas de destino y productos. Todo editable — agrega, corrige o quita recursos según cambie la operación.'),
  ]));

  const tabs = el('div', { class: 'tabs' }, [tabBtn('tractores', 'Tractores'), tabBtn('columnas', 'Columnas'), tabBtn('lineas', 'Líneas'), tabBtn('productos', 'Productos')]);
  root.appendChild(tabs);
  const body = el('div', { id: 'recursos-body' });
  root.appendChild(body);

  tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderRecursos(root); }));

  if (activeTab === 'tractores') await renderTractores(body);
  if (activeTab === 'columnas') await renderColumnas(body);
  if (activeTab === 'lineas') await renderLineas(body);
  if (activeTab === 'productos') await renderProductos(body);
}

function tabBtn(id, label) { return el('button', { class: `tab-btn ${activeTab === id ? 'active' : ''}`, 'data-tab': id }, label); }

function viewToggle(tab, body, renderFn) {
  return el('div', { class: 'view-toggle' }, [
    el('button', { class: `view-toggle-btn ${viewMode[tab] === 'cards' ? 'active' : ''}`, type: 'button', onclick: () => { viewMode[tab] = 'cards'; renderFn(body); } }, 'Tarjetas'),
    el('button', { class: `view-toggle-btn ${viewMode[tab] === 'table' ? 'active' : ''}`, type: 'button', onclick: () => { viewMode[tab] = 'table'; renderFn(body); } }, 'Tabla'),
  ]);
}

// ---- Tractores ----------------------------------------------------------------

async function renderTractores(body) {
  const tractores = await DB.getAll(DB.STORES.TRACTORES);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  form.appendChild(field('trac-nombre', 'text', 'Nombre'));
  form.appendChild(field('trac-patente', 'text', 'Patente'));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary' }, 'Agregar tractor'));
  body.appendChild(form);

  body.appendChild(viewToggle('tractores', body, renderTractores));

  if (viewMode.tractores === 'table') {
    body.appendChild(tractoresTable(tractores, body));
  } else {
    const grid = el('div', { class: 'card-grid' });
    tractores.forEach(t => grid.appendChild(editState.tractores === t.id ? tractorEditCard(t, body) : tractorViewCard(t, body)));
    body.appendChild(grid);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('trac-nombre').value;
    const patente = document.getElementById('trac-patente').value;
    if (!nombre || !patente) return;
    await DB.add(DB.STORES.TRACTORES, { nombre, patente, estado: 'disponible' });
    toast('Tractor agregado', 'success');
    renderTractores(body);
  });
}

function tractorViewCard(t, body) {
  return el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, `${t.nombre} · ${t.patente}`),
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
  return el('div', { class: 'card card-recurso card-editing' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Nombre'), nombreI]),
    el('div', { class: 'field' }, [el('label', {}, 'Patente'), patenteI]),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveTractor(t, nombreI.value, patenteI.value, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.tractores = null; renderTractores(body); } }, 'Cancelar'),
    ]),
  ]);
}

function tractoresTable(tractores, body) {
  const table = el('table', { class: 'report-table resource-table' });
  table.appendChild(el('thead', {}, el('tr', {}, ['Nombre', 'Patente', 'Estado', 'Acciones'].map(h => el('th', {}, h)))));
  const tbody = el('tbody');
  tractores.forEach(t => tbody.appendChild(editState.tractores === t.id ? tractorEditRow(t, body) : tractorViewRow(t, body)));
  table.appendChild(tbody);
  return table;
}

function tractorViewRow(t, body) {
  return el('tr', {}, [
    el('td', {}, t.nombre),
    el('td', {}, t.patente),
    el('td', {}, el('span', { class: `badge badge-${t.estado === 'disponible' ? 'cargado' : 'transito'}` }, t.estado === 'disponible' ? 'Disponible' : 'Ocupado')),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.tractores = t.id; renderTractores(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.TRACTORES, t.id); renderTractores(body); } }, 'Eliminar'),
    ]),
  ]);
}

function tractorEditRow(t, body) {
  const nombreI = el('input', { value: t.nombre });
  const patenteI = el('input', { value: t.patente });
  return el('tr', { class: 'row-editing' }, [
    el('td', {}, nombreI),
    el('td', {}, patenteI),
    el('td', {}, t.estado === 'disponible' ? 'Disponible' : 'Ocupado'),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveTractor(t, nombreI.value, patenteI.value, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.tractores = null; renderTractores(body); } }, 'Cancelar'),
    ]),
  ]);
}

async function saveTractor(t, nombre, patente, body) {
  if (!nombre || !patente) { toast('Completa todos los campos', 'error'); return; }
  await DB.put(DB.STORES.TRACTORES, { ...t, nombre, patente });
  editState.tractores = null;
  toast('Tractor actualizado', 'success');
  renderTractores(body);
}

// ---- Columnas -------------------------------------------------------------------

async function renderColumnas(body) {
  const [columnas, productos] = await Promise.all([DB.getAll(DB.STORES.COLUMNAS), DB.getAll(DB.STORES.PRODUCTOS)]);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  form.appendChild(field('col-nombre', 'text', 'Nombre / ID'));
  form.appendChild(field('col-tipo', 'text', 'Tipo de madera'));
  form.appendChild(field('col-volumen', 'number', 'Volumen total (m³)', '0.1'));
  const productoSel = el('select', { id: 'col-producto', required: 'true' }, [
    el('option', { value: '' }, productos.length ? '-- Selecciona producto --' : 'Sin productos (crea uno en la pestaña Productos)'),
    ...productos.map(p => el('option', { value: p.id }, `${p.nombre} · M3SSC ${fmtM3(p.m3ssc)}`)),
  ]);
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Producto de esta columna'), productoSel]));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary', disabled: productos.length ? null : 'true' }, 'Agregar columna'));
  body.appendChild(form);

  body.appendChild(viewToggle('columnas', body, renderColumnas));

  if (viewMode.columnas === 'table') {
    body.appendChild(columnasTable(columnas, productos, body));
  } else {
    const grid = el('div', { class: 'card-grid' });
    columnas.forEach(c => grid.appendChild(editState.columnas === c.id ? columnaEditCard(c, productos, body) : columnaViewCard(c, body)));
    body.appendChild(grid);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('col-nombre').value;
    const tipo = document.getElementById('col-tipo').value;
    const volumen = parseFloat(document.getElementById('col-volumen').value);
    const productoId = productoSel.value;
    if (!nombre || !tipo || !volumen || !productoId) return;
    const producto = productos.find(p => p.id === productoId);
    await DB.add(DB.STORES.COLUMNAS, { nombre, tipoMadera: tipo, volumenTotal: volumen, volumenDisponible: volumen, productoId, productoNombre: producto.nombre });
    toast('Columna agregada', 'success');
    renderColumnas(body);
  });
}

function columnaViewCard(c, body) {
  return el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, c.nombre),
    el('div', { class: 'card-meta' }, `${c.productoNombre || 'Sin producto'} · disp. ${fmtM3(c.volumenDisponible)} / ${fmtM3(c.volumenTotal)}`),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.columnas = c.id; renderColumnas(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.COLUMNAS, c.id); renderColumnas(body); } }, 'Eliminar'),
    ]),
  ]);
}

function columnaEditCard(c, productos, body) {
  const nombreI = el('input', { value: c.nombre });
  const tipoI = el('input', { value: c.tipoMadera });
  const totalI = el('input', { type: 'number', step: '0.1', value: c.volumenTotal });
  const dispI = el('input', { type: 'number', step: '0.1', value: c.volumenDisponible });
  const productoSel = el('select', {}, productos.map(p => el('option', { value: p.id, selected: p.id === c.productoId ? 'true' : null }, `${p.nombre} · M3SSC ${fmtM3(p.m3ssc)}`)));
  return el('div', { class: 'card card-recurso card-editing' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Nombre / ID'), nombreI]),
    el('div', { class: 'field' }, [el('label', {}, 'Tipo de madera'), tipoI]),
    el('div', { class: 'field' }, [el('label', {}, 'Volumen total (m³)'), totalI]),
    el('div', { class: 'field' }, [el('label', {}, 'Volumen disponible (m³)'), dispI]),
    el('div', { class: 'field' }, [el('label', {}, 'Producto de esta columna'), productoSel]),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveColumna(c, nombreI.value, tipoI.value, totalI.value, dispI.value, productoSel.value, productos, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.columnas = null; renderColumnas(body); } }, 'Cancelar'),
    ]),
  ]);
}

function columnasTable(columnas, productos, body) {
  const table = el('table', { class: 'report-table resource-table' });
  table.appendChild(el('thead', {}, el('tr', {}, ['Nombre', 'Producto', 'Disponible', 'Total', 'Acciones'].map(h => el('th', {}, h)))));
  const tbody = el('tbody');
  columnas.forEach(c => tbody.appendChild(editState.columnas === c.id ? columnaEditRow(c, productos, body) : columnaViewRow(c, body)));
  table.appendChild(tbody);
  return table;
}

function columnaViewRow(c, body) {
  return el('tr', {}, [
    el('td', {}, c.nombre),
    el('td', {}, c.productoNombre || 'Sin producto'),
    el('td', {}, fmtM3(c.volumenDisponible)),
    el('td', {}, fmtM3(c.volumenTotal)),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.columnas = c.id; renderColumnas(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.COLUMNAS, c.id); renderColumnas(body); } }, 'Eliminar'),
    ]),
  ]);
}

function columnaEditRow(c, productos, body) {
  const nombreI = el('input', { value: c.nombre });
  const tipoI = el('input', { value: c.tipoMadera });
  const totalI = el('input', { type: 'number', step: '0.1', value: c.volumenTotal });
  const dispI = el('input', { type: 'number', step: '0.1', value: c.volumenDisponible });
  const productoSel = el('select', {}, productos.map(p => el('option', { value: p.id, selected: p.id === c.productoId ? 'true' : null }, p.nombre)));
  return el('tr', { class: 'row-editing' }, [
    el('td', {}, nombreI),
    el('td', {}, productoSel),
    el('td', {}, dispI),
    el('td', {}, totalI),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveColumna(c, nombreI.value, tipoI.value, totalI.value, dispI.value, productoSel.value, productos, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.columnas = null; renderColumnas(body); } }, 'Cancelar'),
    ]),
  ]);
}

async function saveColumna(c, nombre, tipo, totalStr, dispStr, productoId, productos, body) {
  const volumenTotal = parseFloat(totalStr);
  const volumenDisponible = parseFloat(dispStr);
  if (!nombre || !tipo || !volumenTotal || volumenDisponible < 0 || !productoId) { toast('Revisa los campos', 'error'); return; }
  const producto = productos.find(p => p.id === productoId);
  await DB.put(DB.STORES.COLUMNAS, { ...c, nombre, tipoMadera: tipo, volumenTotal, volumenDisponible, productoId, productoNombre: producto.nombre });
  editState.columnas = null;
  toast('Columna actualizada', 'success');
  renderColumnas(body);
}

// ---- Líneas -------------------------------------------------------------------

async function renderLineas(body) {
  const lineas = await DB.getAll(DB.STORES.LINEAS);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  form.appendChild(field('linea-nombre', 'text', 'Nombre de línea'));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary' }, 'Agregar línea'));
  body.appendChild(form);

  body.appendChild(viewToggle('lineas', body, renderLineas));

  if (viewMode.lineas === 'table') {
    body.appendChild(lineasTable(lineas, body));
  } else {
    const grid = el('div', { class: 'card-grid' });
    lineas.forEach(l => grid.appendChild(editState.lineas === l.id ? lineaEditCard(l, body) : lineaViewCard(l, body)));
    body.appendChild(grid);
  }

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
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveLinea(l, nombreI.value, consumoI.value, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.lineas = null; renderLineas(body); } }, 'Cancelar'),
    ]),
  ]);
}

function lineasTable(lineas, body) {
  const table = el('table', { class: 'report-table resource-table' });
  table.appendChild(el('thead', {}, el('tr', {}, ['Línea', 'Consumo acumulado', 'Acciones'].map(h => el('th', {}, h)))));
  const tbody = el('tbody');
  lineas.forEach(l => tbody.appendChild(editState.lineas === l.id ? lineaEditRow(l, body) : lineaViewRow(l, body)));
  table.appendChild(tbody);
  return table;
}

function lineaViewRow(l, body) {
  return el('tr', {}, [
    el('td', {}, l.nombre),
    el('td', {}, fmtM3(l.consumoAcumulado)),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.lineas = l.id; renderLineas(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.LINEAS, l.id); renderLineas(body); } }, 'Eliminar'),
    ]),
  ]);
}

function lineaEditRow(l, body) {
  const nombreI = el('input', { value: l.nombre });
  const consumoI = el('input', { type: 'number', step: '0.01', value: l.consumoAcumulado });
  return el('tr', { class: 'row-editing' }, [
    el('td', {}, nombreI),
    el('td', {}, consumoI),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveLinea(l, nombreI.value, consumoI.value, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.lineas = null; renderLineas(body); } }, 'Cancelar'),
    ]),
  ]);
}

async function saveLinea(l, nombre, consumoStr, body) {
  const consumoAcumulado = parseFloat(consumoStr);
  if (!nombre || isNaN(consumoAcumulado) || consumoAcumulado < 0) { toast('Revisa los campos', 'error'); return; }
  await DB.put(DB.STORES.LINEAS, { ...l, nombre, consumoAcumulado });
  editState.lineas = null;
  toast('Línea actualizada', 'success');
  renderLineas(body);
}

// ---- Productos -------------------------------------------------------------------
// M3SSC se calcula solo (MR × FACTOR) — nunca se ingresa a mano.

function calcM3SSC(mr, factor) {
  return Number((mr * factor).toFixed(3));
}

async function renderProductos(body) {
  const productos = await DB.getAll(DB.STORES.PRODUCTOS);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  const nombreI = el('input', { id: 'prod-nombre', required: 'true' });
  const mrI = el('input', { id: 'prod-mr', type: 'number', step: '0.001', required: 'true' });
  const factorI = el('input', { id: 'prod-factor', type: 'number', step: '0.001', required: 'true' });
  const previewEl = el('div', { class: 'field' }, [el('label', {}, 'M3SSC (calculado)'), el('div', { class: 'm3ssc-preview', id: 'prod-preview' }, '—')]);
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Producto'), nombreI]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'MR'), mrI]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Factor'), factorI]));
  form.appendChild(previewEl);
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary' }, 'Agregar producto'));
  body.appendChild(form);

  const updatePreview = () => {
    const mr = parseFloat(mrI.value), factor = parseFloat(factorI.value);
    previewEl.querySelector('.m3ssc-preview').textContent = (mr && factor) ? fmtM3(calcM3SSC(mr, factor)) : '—';
  };
  mrI.addEventListener('input', updatePreview);
  factorI.addEventListener('input', updatePreview);

  body.appendChild(viewToggle('productos', body, renderProductos));

  if (viewMode.productos === 'table') {
    body.appendChild(productosTable(productos, body));
  } else {
    const grid = el('div', { class: 'card-grid' });
    productos.forEach(p => grid.appendChild(editState.productos === p.id ? productoEditCard(p, body) : productoViewCard(p, body)));
    body.appendChild(grid);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = nombreI.value;
    const mr = parseFloat(mrI.value);
    const factor = parseFloat(factorI.value);
    if (!nombre || !mr || !factor) return;
    await DB.add(DB.STORES.PRODUCTOS, { nombre, mr, factor, m3ssc: calcM3SSC(mr, factor) });
    toast('Producto agregado', 'success');
    renderProductos(body);
  });
}

function productoViewCard(p, body) {
  return el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, p.nombre),
    el('div', { class: 'card-meta' }, `MR ${p.mr.toFixed(3)} · Factor ${p.factor.toFixed(3)} · M3SSC ${fmtM3(p.m3ssc)}`),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.productos = p.id; renderProductos(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.PRODUCTOS, p.id); renderProductos(body); } }, 'Eliminar'),
    ]),
  ]);
}

function productoEditCard(p, body) {
  const nombreI = el('input', { value: p.nombre });
  const mrI = el('input', { type: 'number', step: '0.001', value: p.mr });
  const factorI = el('input', { type: 'number', step: '0.001', value: p.factor });
  const previewEl = el('div', { class: 'm3ssc-preview' }, fmtM3(p.m3ssc));
  const updatePreview = () => {
    const mr = parseFloat(mrI.value), factor = parseFloat(factorI.value);
    previewEl.textContent = (mr && factor) ? fmtM3(calcM3SSC(mr, factor)) : '—';
  };
  mrI.addEventListener('input', updatePreview);
  factorI.addEventListener('input', updatePreview);

  return el('div', { class: 'card card-recurso card-editing' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Producto'), nombreI]),
    el('div', { class: 'field' }, [el('label', {}, 'MR'), mrI]),
    el('div', { class: 'field' }, [el('label', {}, 'Factor'), factorI]),
    el('div', { class: 'field' }, [el('label', {}, 'M3SSC (calculado)'), previewEl]),
    el('div', { class: 'card-action' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveProducto(p, nombreI.value, mrI.value, factorI.value, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.productos = null; renderProductos(body); } }, 'Cancelar'),
    ]),
  ]);
}

function productosTable(productos, body) {
  const table = el('table', { class: 'report-table resource-table' });
  table.appendChild(el('thead', {}, el('tr', {}, ['Producto', 'MR', 'Factor', 'M3SSC', 'Acciones'].map(h => el('th', {}, h)))));
  const tbody = el('tbody');
  productos.forEach(p => tbody.appendChild(editState.productos === p.id ? productoEditRow(p, body) : productoViewRow(p, body)));
  table.appendChild(tbody);
  return table;
}

function productoViewRow(p, body) {
  return el('tr', {}, [
    el('td', {}, p.nombre),
    el('td', {}, p.mr.toFixed(3)),
    el('td', {}, p.factor.toFixed(3)),
    el('td', {}, fmtM3(p.m3ssc)),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.productos = p.id; renderProductos(body); } }, 'Editar'),
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await DB.remove(DB.STORES.PRODUCTOS, p.id); renderProductos(body); } }, 'Eliminar'),
    ]),
  ]);
}

function productoEditRow(p, body) {
  const nombreI = el('input', { value: p.nombre });
  const mrI = el('input', { type: 'number', step: '0.001', value: p.mr });
  const factorI = el('input', { type: 'number', step: '0.001', value: p.factor });
  const previewEl = el('span', { class: 'm3ssc-preview' }, fmtM3(p.m3ssc));
  const updatePreview = () => {
    const mr = parseFloat(mrI.value), factor = parseFloat(factorI.value);
    previewEl.textContent = (mr && factor) ? fmtM3(calcM3SSC(mr, factor)) : '—';
  };
  mrI.addEventListener('input', updatePreview);
  factorI.addEventListener('input', updatePreview);

  return el('tr', { class: 'row-editing' }, [
    el('td', {}, nombreI),
    el('td', {}, mrI),
    el('td', {}, factorI),
    el('td', {}, previewEl),
    el('td', { class: 'table-actions' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await saveProducto(p, nombreI.value, mrI.value, factorI.value, body); } }, 'Guardar'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { editState.productos = null; renderProductos(body); } }, 'Cancelar'),
    ]),
  ]);
}

async function saveProducto(p, nombre, mrStr, factorStr, body) {
  const mr = parseFloat(mrStr);
  const factor = parseFloat(factorStr);
  if (!nombre || !mr || !factor) { toast('Revisa los campos', 'error'); return; }
  await DB.put(DB.STORES.PRODUCTOS, { ...p, nombre, mr, factor, m3ssc: calcM3SSC(mr, factor) });
  editState.productos = null;
  toast('Producto actualizado', 'success');
  renderProductos(body);
}

function field(id, type, label, step) {
  const attrs = { id, type, required: 'true' };
  if (step) attrs.step = step;
  return el('div', { class: 'field' }, [el('label', {}, label), el('input', attrs)]);
}
