
// ============================================================================
// views/recursos.js — CRUD de Tractores, Columnas y Líneas de destino.
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, toast, el } from '../utils.js';

let activeTab = 'tractores';

export async function renderRecursos(root) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, 'Recursos Maestros'),
    el('p', { class: 'view-sub' }, 'Flota de tractores, columnas de cancha y líneas de destino. Todo editable — puedes agregar o quitar recursos según cambie la operación.'),
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
  tractores.forEach(t => grid.appendChild(el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, `${t.nombre} · ${t.patente}`),
    el('div', { class: 'card-meta' }, `Capacidad ${fmtM3(t.capacidad)}`),
    el('span', { class: `badge badge-${t.estado === 'disponible' ? 'cargado' : 'transito'}` }, t.estado === 'disponible' ? 'Disponible' : 'Ocupado'),
    el('button', { class: 'btn btn-danger btn-sm', onclick: async () => { await DB.remove(DB.STORES.TRACTORES, t.id); renderTractores(body); } }, 'Eliminar'),
  ])));
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
  columnas.forEach(c => grid.appendChild(el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, c.nombre),
    el('div', { class: 'card-meta' }, `${c.tipoMadera} · disp. ${fmtM3(c.volumenDisponible)} / ${fmtM3(c.volumenTotal)}`),
    el('button', { class: 'btn btn-danger btn-sm', onclick: async () => { await DB.remove(DB.STORES.COLUMNAS, c.id); renderColumnas(body); } }, 'Eliminar'),
  ])));
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

async function renderLineas(body) {
  const lineas = await DB.getAll(DB.STORES.LINEAS);
  body.innerHTML = '';
  const form = el('form', { class: 'panel form-grid' });
  form.appendChild(field('linea-nombre', 'text', 'Nombre de línea'));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary' }, 'Agregar línea'));
  body.appendChild(form);

  const grid = el('div', { class: 'card-grid' });
  lineas.forEach(l => grid.appendChild(el('div', { class: 'card card-recurso' }, [
    el('div', { class: 'card-main' }, l.nombre),
    el('div', { class: 'card-meta' }, `Consumo acumulado: ${fmtM3(l.consumoAcumulado)}`),
    el('button', { class: 'btn btn-danger btn-sm', onclick: async () => { await DB.remove(DB.STORES.LINEAS, l.id); renderLineas(body); } }, 'Eliminar'),
  ])));
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

function field(id, type, label, step) {
  const attrs = { id, type, required: 'true' };
  if (step) attrs.step = step;
  return el('div', { class: 'field' }, [el('label', {}, label), el('input', attrs)]);
}
