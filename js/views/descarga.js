// ============================================================================
// views/descarga.js — Módulo 3: DESCARGA (confirma en línea, libera tractor)
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, fmtHora, toast, el } from '../utils.js';

export async function renderDescarga(root) {
  const enTransito = (await DB.getByIndex(DB.STORES.VIAJES, 'estado', 'en_transito'))
    .sort((a, b) => new Date(a.horaTransito) - new Date(b.horaTransito));

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, '03 · Descarga — Alimentación de Línea'),
    el('p', { class: 'view-sub' }, 'Confirma el volumen descargado en línea. El viaje se cierra y el tractor vuelve a estar disponible para un nuevo viaje.'),
  ]));

  root.appendChild(el('h3', { class: 'section-title' }, `Tractores en tránsito (${enTransito.length})`));
  const list = el('div', { class: 'card-grid' });
  if (enTransito.length === 0) list.appendChild(el('p', { class: 'empty' }, 'No hay tractores en tránsito para descargar.'));
  else enTransito.forEach(v => list.appendChild(descargaCard(v)));
  root.appendChild(list);

  root.querySelectorAll('[data-descargar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const viajeId = btn.dataset.descargar;
      const volInput = document.getElementById(`vol-desc-${viajeId}`);
      const volumen = parseFloat(volInput.value);
      if (!volumen || volumen <= 0) { toast('Ingresa el volumen descargado', 'error'); return; }

      const viaje = await DB.getById(DB.STORES.VIAJES, viajeId);
      const [linea, tractor] = await Promise.all([
        DB.getById(DB.STORES.LINEAS, viaje.lineaId),
        DB.getById(DB.STORES.TRACTORES, viaje.tractorId),
      ]);

      viaje.volumenDescarga = volumen;
      viaje.estado = 'completado';
      viaje.horaDescarga = new Date().toISOString();
      await DB.put(DB.STORES.VIAJES, viaje);

      linea.consumoAcumulado = Number((linea.consumoAcumulado + volumen).toFixed(2));
      await DB.put(DB.STORES.LINEAS, linea);

      tractor.estado = 'disponible';
      await DB.put(DB.STORES.TRACTORES, tractor);

      toast(`${viaje.folio} completado en ${linea.nombre}. ${tractor.nombre} liberado.`, 'success');
      renderDescarga(root);
    });
  });
}

function descargaCard(v) {
  const volInput = el('input', { id: `vol-desc-${v.id}`, type: 'number', step: '0.01', min: '0.01', value: v.volumenCarga, class: 'input-inline' });
  return el('div', { class: 'card card-transito' }, [
    el('div', { class: 'card-folio' }, v.folio),
    el('div', { class: 'card-main' }, `${v.tractorNombre} → ${v.lineaNombre}`),
    el('div', { class: 'card-meta' }, `Cargado ${fmtM3(v.volumenCarga)} · en ruta desde ${fmtHora(v.horaTransito)}`),
    el('div', { class: 'card-action' }, [volInput, el('button', { class: 'btn btn-primary', 'data-descargar': v.id }, 'Confirmar descarga')]),
  ]);
}
