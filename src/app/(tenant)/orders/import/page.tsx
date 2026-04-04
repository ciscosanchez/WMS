"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { validateImportPreview, importOrders } from "@/modules/orders/import-actions";
import type { ImportPreview, ParsedOrder, ImportError } from "@/modules/orders/import-actions";

export default function BulkOrderImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    errors: ImportError[];
  } | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isImporting, startImport] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPreview(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  }

  function handlePreview() {
    if (!csvContent) {
      toast.error("Please select a CSV file first");
      return;
    }

    startPreview(async () => {
      try {
        const result = await validateImportPreview(csvContent);
        setPreview(result);
        setImportResult(null);
        if (result.errors.length > 0) {
          toast.warning(
            `Preview complete: ${result.orders.length} orders, ${result.errors.length} errors`
          );
        } else {
          toast.success(`Preview complete: ${result.orders.length} orders ready`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Preview failed");
      }
    });
  }

  function handleImport() {
    if (!preview || preview.orders.length === 0) {
      toast.error("No valid orders to import");
      return;
    }

    startImport(async () => {
      try {
        const result = await importOrders("", preview.orders);
        setImportResult(result);
        if (result.errors.length === 0) {
          toast.success(`Successfully imported ${result.created} orders`);
        } else {
          toast.warning(`Imported ${result.created} orders with ${result.errors.length} errors`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  function handleReset() {
    setCsvContent("");
    setFileName("");
    setPreview(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Order Import"
        description="Upload a CSV file to create multiple orders at once"
      />

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
            {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={!csvContent || isPreviewing}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {isPreviewing ? "Previewing..." : "Preview"}
            </Button>
            {preview && (
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>

          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium">Expected CSV columns:</p>
            <p>clientCode, shipToName, shipToAddress1, shipToCity, shipToZip, sku, quantity</p>
            <p className="mt-1">
              Optional: shipToState, shipToCountry, shipToEmail, shipToPhone, priority, lotNumber,
              uom, notes
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Import Result Summary */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 text-sm">
              <div className="rounded-md bg-green-50 px-4 py-3 dark:bg-green-900/20">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {importResult.created}
                </p>
                <p className="text-green-600 dark:text-green-500">Orders Created</p>
              </div>
              <div className="rounded-md bg-red-50 px-4 py-3 dark:bg-red-900/20">
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {importResult.errors.length}
                </p>
                <p className="text-red-600 dark:text-red-500">Errors</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="mt-4 space-y-1">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-600">
                    Order #{err.row}: {err.message}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Section */}
      {preview && !importResult && (
        <>
          {/* Validation Errors */}
          {preview.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Validation Errors ({preview.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {preview.errors.map((err, i) => (
                    <p key={i} className="text-sm text-red-600">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orders Preview Table */}
          {preview.orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Preview: {preview.orders.length} Orders from {preview.totalRows} Rows
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Ship To</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Lines</TableHead>
                        <TableHead>Total Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.orders.map((order: ParsedOrder, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell>{order.clientCode}</TableCell>
                          <TableCell>{order.shipToName}</TableCell>
                          <TableCell>
                            {order.shipToCity}
                            {order.shipToState ? `, ${order.shipToState}` : ""}
                          </TableCell>
                          <TableCell>{order.priority}</TableCell>
                          <TableCell>{order.lines.length}</TableCell>
                          <TableCell className="font-medium">
                            {order.lines.reduce((sum, l) => sum + l.quantity, 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Button onClick={handleImport} disabled={isImporting} className="w-full">
                  {isImporting ? "Importing..." : `Import ${preview.orders.length} Orders`}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
