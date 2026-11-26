/**
 * Pure utility — no "use server", safe to import from both client and server.
 */

export interface BulkImportRow {
  line: number;
  url: string;
  name?: string;
  healthCheckPath?: string;
}

export const MAX_IMPORT_ROWS = 50;
export const MAX_CSV_BYTES = 10 * 1024; // 10 KB

/**
 * Parse a CSV / plain-text blob into import rows.
 * Tracks original 1-based line numbers (comments and blank lines keep their
 * position so error messages point at the right line).
 */
export function parseBulkImportText(raw: string): BulkImportRow[] {
  if (raw.length > MAX_CSV_BYTES) {
    throw new Error(`Input exceeds the ${MAX_CSV_BYTES / 1024} KB size limit.`);
  }

  const rawLines = raw.split(/\r?\n/);
  const rows: BulkImportRow[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    if (rows.length >= MAX_IMPORT_ROWS) break;

    const line = rawLines[i].trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const parts = line.includes(",")
      ? line.split(",").map((p) => p.trim())
      : [line];

    const url = parts[0] || "";
    const name = parts[1] || undefined;
    const healthCheckPath = parts[2] || undefined;

    if (url) {
      rows.push({ line: i + 1, url, name, healthCheckPath });
    }
  }

  return rows;
}
