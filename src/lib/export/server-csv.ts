/**
 * Server-side CSV export utility.
 * Used by API routes and scheduled report jobs.
 */

export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: unknown) => string;
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a CSV string from rows and column definitions.
 */
export function generateCsv(rows: Record<string, unknown>[], columns: ExportColumn[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key];
        const formatted = col.format ? col.format(val) : String(val ?? "");
        return escapeCell(formatted);
      })
      .join(",")
  );
  return [header, ...dataRows].join("\r\n");
}

/**
 * Create a Response object for CSV download.
 */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
