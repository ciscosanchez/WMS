/**
 * Open a styled HTML table in a new window and invoke the browser
 * print dialog so the user can save as PDF or send to a printer.
 */
const APP_NAME =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_NAME) || "Ramola WMS";
export function exportTableToPdf(title: string, headers: string[], rows: string[][]) {
  const headerCells = headers
    .map(
      (h) =>
        `<th style="border:1px solid #cbd5e1;padding:8px 12px;background:#f1f5f9;text-align:left;font-weight:600;">${escapeHtml(h)}</th>`
    )
    .join("");

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="border:1px solid #cbd5e1;padding:8px 12px;">${escapeHtml(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} - ${APP_NAME}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; }
    .header { margin-bottom: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
    .brand { font-size: 20px; font-weight: 700; color: #0f172a; }
    .title { font-size: 16px; color: #475569; margin-top: 4px; }
    .meta { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">${APP_NAME}</div>
    <div class="title">${escapeHtml(title)}</div>
    <div class="meta">Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  // Small delay so styles render before the print dialog opens
  setTimeout(() => printWindow.print(), 250);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
