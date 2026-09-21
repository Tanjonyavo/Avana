import "server-only";

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue) {
  const raw = String(value ?? "");
  const safe = typeof value === "string" && /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvDocument(rows: CsvValue[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
