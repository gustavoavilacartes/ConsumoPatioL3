// ============================================================================
// views/reportes.js — Reporte diario de viajes completados + export Excel
// ============================================================================
import { DB } from '../db.js';
import { fmtM3, fmtHora, hoyISO, toast, el } from '../utils.js';

export async function renderReportes(root) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'view-header' }, [
    el('h2', {}, 'Reportes'),
    el('p', { class: 'view-sub' }, 'Viajes completados por fecha, con totales de volumen entregado.'),
  ]));

  const fechaInput = el('input', { type: 'date', id: 'rep-fecha', value: hoyISO() });
  const filterRow = el('div', { class: 'panel filter-row' });
  filterRow.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Fecha'), fechaInput]));
  filterRow.appendChild(el('button', { class: 'btn btn-secondary', id: 'btn-generar' }, 'Generar'));
  filterRow.appendChild(el('button', { class: 'btn btn-secondary', id: 'btn-excel' }, 'Exportar Excel'));
  root.appendChild(filterRow);

  const content = el('div', { id: 'reporte-content' });
  root.appendChild(content);

  async function draw() {
    const fecha = fechaInput.value;
    const viajes = (await DB.getAll(DB.STORES.VIAJES))
      .filter(v => v.estado === 'completado' && v.fechaCarga === fecha)
      .sort((a, b) => new Date(a.horaDescarga) - new Date(b.horaDescarga));

    content.innerHTML = '';
    if (viajes.length === 0) { content.appendChild(el('p', { class: 'empty' }, `No hay viajes completados para ${fecha}.`)); return; }

    const table = el('table', { class: 'report-table' });
    table.appendChild(el('thead', {}, el('tr', {}, ['Folio', 'Tractor', 'Columna', 'Producto', 'Línea', 'Vol. carga', 'Hora carga', 'Vol. descarga', 'Hora descarga'].map(h => el('th', {}, h)))));
    const tbody = el('tbody');
    let totalCarga = 0, totalDescarga = 0;
    viajes.forEach(v => {
      totalCarga += v.volumenCarga;
      totalDescarga += v.volumenDescarga || 0;
             tbody.appendChild(el('tr', {}, [v.folio, v.tractorNombre, v.columnaNombre, v.productoNombre || v.tipoMadera, v.lineaNombre, fmtM3(v.volumenCarga), fmtHora(v.horaCarga), fmtM3(v.volumenDescarga), fmtHora(v.horaDescarga)].map(t => el('td', {}, t))));
    });
    tbody.appendChild(el('tr', { class: 'report-total' }, [el('td', { colspan: '5' }, 'TOTAL'), el('td', {}, fmtM3(totalCarga)), el('td', {}, ''), el('td', {}, fmtM3(totalDescarga)), el('td', {}, '')]));
    table.appendChild(tbody);
    content.appendChild(table);
  }

  filterRow.querySelector('#btn-generar').addEventListener('click', draw);
  filterRow.querySelector('#btn-excel').addEventListener('click', async () => {
    const fecha = fechaInput.value;
    const viajes = (await DB.getAll(DB.STORES.VIAJES)).filter(v => v.estado === 'completado' && v.fechaCarga === fecha);
    if (viajes.length === 0) { toast('No hay datos para exportar', 'error'); return; }
    if (typeof XLSX === 'undefined') { toast('Librería Excel no disponible (requiere conexión)', 'error'); return; }

    const rows = viajes.map(v => ({
      Folio: v.folio, Tractor: v.tractorNombre, Columna: v.columnaNombre, Tipo: v.tipoMadera,
      Linea: v.lineaNombre, VolumenCarga: v.volumenCarga, VolumenDescarga: v.volumenDescarga,
      HoraCarga: v.horaCarga, HoraTransito: v.horaTransito, HoraDescarga: v.horaDescarga,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `reporte-patio-${fecha}.xlsx`);
  });

  draw();
}
