// ============================================================================
// utils.js — Helpers compartidos
// ============================================================================

export function fmtM3(n) { return `${Number(n || 0).toFixed(2)} m³`; }
export function fmtHora(iso) { return iso ? new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'; }
export function hoyISO() { return new Date().toISOString().split('T')[0]; }
export function nowISO() { return new Date().toISOString(); }

let toastTimer = null;
export function toast(msg, tipo = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.tipo = tipo;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
