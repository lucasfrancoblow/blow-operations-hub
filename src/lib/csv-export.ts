// Exportar CSV client-side — sem round-trip pro servidor, sem lib externa.
// Usado nas páginas de dados (Radar de Leads, Funil de MKT, Daily Expansão,
// Ligações) que até então só deixavam o time copiar linha por linha pra fora
// do hub.

function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const UTF8_BOM = "\uFEFF";

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(",")),
  ];
  // BOM na frente: sem isso o Excel abre acento errado num CSV UTF-8.
  const blob = new Blob([UTF8_BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
