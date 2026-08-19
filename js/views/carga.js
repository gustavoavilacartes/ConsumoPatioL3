// ============================================================================
// views/carga.js — Módulo 1: CARGA (grúa carga tractor en columna)
//
// Flujo en 3 pasos con fichas táctiles (pensado para digitar en terreno
// desde celular/tablet, sin listas desplegables):
//   Paso 1: tocar el tractor disponible
//   Paso 2: tocar la columna de origen — su producto (M3SSC) ya viene fijo,
//           no se elige por separado
//   Paso 3: confirmar (con observación opcional) y registrar
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, fmtHora, toast, el } from '../utils.js';

// Estado del wizard (persiste mientras la app sigue abierta; se resetea al
// completar una carga o al usar los botones "Cambiar").
const wizard = { step: 'tractor', tractor: null, columna: null, producto: null };

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
    el('p', { class: 'view-sub' }, 'Toca el tractor, luego la columna de origen. El producto y el volumen se completan solos.'),
  ]));

  const wrap = el('div', { class: 'panel wizard' });
  if (wizard.step === 'columna') wrap.appendChild(stepColumna(columnas, productos, root));
  else if (wizard.step === 'confirm') wrap.appendChild(stepConfirm(root));
  else wrap.appendChild(stepTractor(tractoresDisp, root));
  root.appendChild(wrap);

  root.appendChild(el('h3', { class: 'section-title' }, `Tractores cargados, esperando destino (${pendientes.length})`));
  const list = el('div', { class: 'card-grid' });
  if (pendientes.length === 0) list.appendChild(el('p', { class: 'empty' }, 'No hay tractores cargados en este momento.'));
  else pendientes.forEach(v => list.appendChild(cargaCard(v)));
  root.appendChild(list);
}

// ---- Paso 1: elegir tractor -----------------------------------------------------

function stepTractor(tractoresDisp, root) {
  const wrap = el('div', {});
  wrap.appendChild(el('h3', { class: 'wizard-step-title' }, 'Paso 1 · Toca el tractor'));

  if (tractoresDisp.length === 0) {
    wrap.appendChild(el('p', { class: 'empty' }, 'No hay tractores disponibles en este momento.'));
    return wrap;
  }

  const grid = el('div', { class: 'tile-grid' });
  tractoresDisp.forEach(t => {
    grid.appendChild(el('button', {
      type: 'button', class: 'tile',
      onclick: () => { wizard.tractor = t; wizard.step = 'columna'; renderCarga(root); },
    }, [
      el('div', { class: 'tile-title' }, t.nombre),
      el('div', { class: 'tile-sub' }, t.patente),
    ]));
  });
  wrap.appendChild(grid);
  return wrap;
}

// ---- Paso 2: elegir columna (trae el producto fijo) ------------------------------

function stepColumna(columnas, productos, root) {
  const wrap = el('div', {});
  wrap.appendChild(el('div', { class: 'wizard-selected' }, `Tractor: ${wizard.tractor.nombre} · ${wizard.tractor.patente}`));
  wrap.appendChild(el('button', {
    type: 'button', class: 'btn btn-secondary btn-sm',
    onclick: () => { wizard.step = 'tractor'; wizard.tractor = null; renderCarga(root); },
  }, '← Cambiar tractor'));
  wrap.appendChild(el('h3', { class: 'wizard-step-title' }, 'Paso 2 · Toca la columna de origen'));

  if (columnas.length === 0) {
    wrap.appendChild(el('p', { class: 'empty' }, 'No hay columnas registradas. Créalas en Recursos → Columnas.'));
    return wrap;
  }

  const grid = el('div', { class: 'tile-grid' });
  columnas.forEach(c => {
    const producto = c.productoId ? productos.find(p => p.id === c.productoId) : null;
    const sinProducto = !producto;
    const insuficiente = producto && producto.m3ssc > c.volumenDisponible;
    const disabled = sinProducto || insuficiente;

    grid.appendChild(el('button', {
      type: 'button', class: `tile ${disabled ? 'tile-disabled' : ''}`,
      disabled: disabled ? 'true' : null,
      onclick: disabled ? null : () => { wizard.columna = c; wizard.producto = producto; wizard.step = 'confirm'; renderCarga(root); },
    }, [
      el('div', { class: 'tile-title' }, c.nombre),
      el('div', { class: 'tile-sub' }, sinProducto ? 'Sin producto asignado' : producto.nombre),
      el('div', { class: 'tile-meta' }, `Disp. ${fmtM3(c.volumenDisponible)}`),
      insuficiente ? el('div', { class: 'tile-warn' }, `Necesita ${fmtM3(producto.m3ssc)}`) : null,
    ]));
  });
  wrap.appendChild(grid);
  return wrap;
}

// ---- Paso 3: confirmar ------------------------------------------------------------

function stepConfirm(root) {
  const { tractor, columna, producto } = wizard;
  const wrap = el('div', {});
  wrap.appendChild(el('div', { class: 'wizard-selected' }, `Tractor: ${tractor.nombre} · ${tractor.patente}`));
  wrap.appendChild(el('div', { class: 'wizard-selected' }, `Columna: ${columna.nombre} · ${producto.nombre}`));
  wrap.appendChild(el('button', {
    type: 'button', class: 'btn btn-secondary btn-sm',
    onclick: () => { wizard.step = 'columna'; wizard.columna = null; wizard.producto = null; renderCarga(root); },
  }, '← Cambiar columna'));
  wrap.appendChild(el('h3', { class: 'wizard-step-title' }, `Paso 3 · Confirmar carga — ${fmtM3(producto.m3ssc)}`));

  const obsInput = el('input', { type: 'text', id: 'carga-obs', placeholder: 'Opcional' });
  wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Observaciones'), obsInput]));

  const btn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Registrar carga');
  btn.addEventListener('click', () => confirmarCarga(obsInput.value, root));
  wrap.appendChild(btn);
  return wrap;
}

async function confirmarCarga(obs, root) {
  const { tractor, columna, producto } = wizard;
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

  const columnaFresh = await DB.getById(DB.STORES.COLUMNAS, columna.id);
  columnaFresh.volumenDisponible = Number((columnaFresh.volumenDisponible - volumen).toFixed(3));
  await DB.put(DB.STORES.COLUMNAS, columnaFresh);

  const tractorFresh = await DB.getById(DB.STORES.TRACTORES, tractor.id);
  tractorFresh.estado = 'en_viaje';
  await DB.put(DB.STORES.TRACTORES, tractorFresh);

  toast(`${folio}: ${tractor.nombre} cargado con ${producto.nombre} (${fmtM3(volumen)}) desde ${columna.nombre}`, 'success');

  wizard.step = 'tractor';
  wizard.tractor = null;
  wizard.columna = null;
  wizard.producto = null;
  renderCarga(root);
}

function cargaCard(v) {
  return el('div', { class: 'card card-cargado' }, [
    el('div', { class: 'card-folio' }, v.folio),
    el('div', { class: 'card-main' }, `${v.tractorNombre} · ${v.columnaNombre}`),
    el('div', { class: 'card-meta' }, `${v.productoNombre || v.tipoMadera} · ${fmtM3(v.volumenCarga)} · ${fmtHora(v.horaCarga)}`),
    el('div', { class: 'badge badge-cargado' }, 'Esperando destino'),
  ]);
}
