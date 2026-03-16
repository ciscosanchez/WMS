"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { exportToCsv } from "@/lib/export/csv";
import { exportTableToPdf } from "@/lib/export/pdf";

interface ExportButtonsProps {
  title: string;
  headers: string[];
  rows: string[][];
}

export function ExportButtons({ title, headers, rows }: ExportButtonsProps) {
  const csvFilename = title.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => exportToCsv(csvFilename, headers, rows)}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportTableToPdf(title, headers, rows)}>
        <Printer className="mr-2 h-4 w-4" />
        Print PDF
      </Button>
    </div>
  );
}
