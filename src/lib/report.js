// =============================================================
//  RELATÓRIOS — exportação CSV (compatível com Excel pt-BR)
//  Uso: downloadCSV('chamados', [{ Coluna: valor, ... }, ...])
// =============================================================

function esc(v) {
  const s = v == null ? '' : String(v);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(esc).join(';'),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(';')),
  ];
  return lines.join('\r\n');
}

export function downloadCSV(name, rows) {
  if (!rows.length) {
    alert('Nada para exportar.');
    return;
  }
  // BOM p/ o Excel reconhecer UTF-8; separador ";" p/ locale pt-BR
  const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${name}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '';
}
