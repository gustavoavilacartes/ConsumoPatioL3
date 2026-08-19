
// ============================================================================
// views/carga.js — Módulo 1: CARGA (grúa carga tractor en columna con un producto)
// El volumen ya no se escribe a mano: se elige el Producto, y el volumen
// cargado es su M3SSC (MR × FACTOR), definido en Recursos → Productos.
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, fmtHora, toast, el } from '../utils.js';

export async function renderCarga(root) {
  const [columnas, tractores, productos] = await Promise.all([
    DB.getAll(DB.STORES.COLUMNAS),
    DB.getAll(DB.STORES.TRACTORES),
    DB.getAll(DB.STORES.PRODUCTOS),
  ]);
  const tractoresDisp = tractores.filter(t => t.estado === 'disponible');
  const pendientes = (await DB.getByIndex(DB.STORES.VIAJES, 'estado', 'cargado'))
    .sort((a, b) => new Date(b.horaCarga) - new Date(a.horaCarga));

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, '01 · Carga — Grúa carga Tractor en Columna'),
    el('p', { class: 'view-sub' }, 'La grúa de cancha carga un tractor disponible con un producto de una columna. El volumen cargado sale del M3SSC del producto elegido.'),
  ]));

  const form = el('form', { class: 'panel form-grid', id: 'form-carga' });
  const tractorSel = el('select', { id: 'carga-tractor', required: 'true' }, [
    el('option', { value: '' }, tractoresDisp.length ? '-- Selecciona tractor disponible --' : 'Sin tractores disponibles'),
    ...tractoresDisp.map(t => el('option', { value: t.id }, `${t.nombre} · ${t.patente}`)),
  ]);
  const columnaSel = el('select', { id: 'carga-columna', required: 'true' }, [
    el('option', { value: '' }, '-- Selecciona columna --'),
    ...columnas.map(c => el('option', { value: c.id }, `${c.nombre} · ${c.tipoMadera} · disp. ${fmtM3(c.volumenDisponible)}`)),
  ]);
  const productoSel = el('select', { id: 'carga-producto', required: 'true' }, [
    el('option', { value: '' }, productos.length ? '-- Selecciona producto --' : 'Sin productos definidos (ve a Recursos → Productos)'),
    ...productos.map(p => el('option', { value: p.id }, `${p.nombre} · M3SSC ${fmtM3(p.m3ssc)}`)),
  ]);

  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Tractor'), tractorSel]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Columna origen'), columnaSel]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Producto'), productoSel]));
  form.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Observaciones'), el('input', { type: 'text', id: 'carga-obs', placeholder: 'Opcional' })]));
  form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary', disabled: (tractoresDisp.length && productos.length) ? null : 'true' }, 'Registrar carga'));
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
    const productoId = productoSel.value;
    const obs = document.getElementById('carga-obs').value;
    if (!tractorId || !columnaId || !productoId) return;

    const [tractor, columna, producto] = await Promise.all([
      DB.getById(DB.STORES.TRACTORES, tractorId),
      DB.getById(DB.STORES.COLUMNAS, columnaId),
      DB.getById(DB.STORES.PRODUCTOS, productoId),
    ]);

    const volumen = producto.m3ssc;

    if (volumen > columna.volumenDisponible) {
      toast(`El M3SSC de ${producto.nombre} (${fmtM3(volumen)}) supera el disponible en ${columna.nombre} (${fmtM3(columna.volumenDisponible)})`, 'error');
      return;
    }
    

    const folio = await DB.nextFolio();
    const iso = new Date().toISOString();
    await DB.add(DB.STORES.VIAJES, {
      folio, tractorId: tractor.id, tractorNombre: tractor.nombre,
      columnaId: columna.id, columnaNombre: columna.nombre, tipoMadera: columna.tipoMadera,
      productoId: producto.id, productoNombre: producto.nombre, mr: producto.mr, factor: producto.factor,
      volumenCarga: volumen, lineaId: null, lineaNombre: null, volumenDescarga: null,
      estado: 'cargado', fechaCarga: iso.split('T')[0], horaCarga: iso,
      horaTransito: null, horaDescarga: null, observaciones: obs || '',
    });

    columna.volumenDisponible = Number((columna.volumenDisponible - volumen).toFixed(3));
    await DB.put(DB.STORES.COLUMNAS, columna);
    tractor.estado = 'en_viaje';
    await DB.put(DB.STORES.TRACTORES, tractor);

    toast(`${folio}: ${tractor.nombre} cargado con ${producto.nombre} (${fmtM3(volumen)}) desde ${columna.nombre}`, 'success');
    renderCarga(root);
  });
}

function cargaCard(v) {
  return el('div', { class: 'card card-cargado' }, [
    el('div', { class: 'card-folio' }, v.folio),
    el('div', { class: 'card-main' }, `${v.tractorNombre} · ${v.columnaNombre}`),
    el('div', { class: 'card-meta' }, `${v.productoNombre || v.tipoMadera} · ${fmtM3(v.volumenCarga)} · ${fmtHora(v.horaCarga)}`),
    el('div', { class: 'badge badge-cargado' }, 'Esperando destino'),
  ]);
}
