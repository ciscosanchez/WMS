"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBin, updateBin } from "@/modules/warehouse/actions";

type ShelfOption = {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  zoneCode: string;
  aisleCode: string;
  rackCode: string;
  shelfCode: string;
};

type BinFormValues = {
  shelfId: string;
  code: string;
  barcode: string;
  type: "standard" | "bulk" | "pick";
  status: "available" | "full" | "reserved" | "blocked";
  capacity: string;
};

const DEFAULT_VALUES: BinFormValues = {
  shelfId: "",
  code: "",
  barcode: "",
  type: "standard",
  status: "available",
  capacity: "",
};

interface BinFormProps {
  mode: "create" | "edit";
  shelves: ShelfOption[];
  binId?: string;
  initialValues?: Partial<BinFormValues>;
}

function buildBarcode(shelf: ShelfOption | undefined, code: string) {
  if (!shelf || !code.trim()) return "";
  return [
    shelf.warehouseCode,
    shelf.zoneCode,
    shelf.aisleCode,
    shelf.rackCode,
    shelf.shelfCode,
    code.trim(),
  ].join("-");
}

export function BinForm({ mode, shelves, binId, initialValues }: BinFormProps) {
  const t = useTranslations("tenant.warehouse");
  const router = useRouter();
  const [form, setForm] = useState<BinFormValues>({ ...DEFAULT_VALUES, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeEdited, setBarcodeEdited] = useState(Boolean(initialValues?.barcode));

  const selectedShelf = useMemo(
    () => shelves.find((shelf) => shelf.id === form.shelfId),
    [form.shelfId, shelves]
  );
  const autoBarcode = useMemo(
    () => buildBarcode(selectedShelf, form.code),
    [selectedShelf, form.code]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      shelfId: form.shelfId,
      code: form.code,
      barcode: barcodeEdited ? form.barcode : autoBarcode,
      type: form.type,
      status: form.status,
      capacity: form.capacity ? Number.parseInt(form.capacity, 10) : null,
    };

    try {
      if (mode === "create") {
        await createBin(payload);
        toast.success(t("binCreated"));
      } else if (binId) {
        await updateBin(binId, payload);
        toast.success(t("binUpdated"));
      }
      router.push("/warehouse");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("failedSaveBin");
      setError(message);
      toast.error(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? t("newBin") : t("editBin")}
        description={mode === "create" ? t("newBinDesc") : t("editBinDesc")}
      />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("binDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shelfId">{t("parentShelf")}</Label>
              <select
                id="shelfId"
                value={form.shelfId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, shelfId: event.target.value }))
                }
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t("selectShelf")}</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.warehouseCode} / {shelf.zoneCode} / {shelf.aisleCode} / {shelf.rackCode}{" "}
                    / {shelf.shelfCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">{t("code")}</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">{t("barcode")}</Label>
              <Input
                id="barcode"
                value={barcodeEdited ? form.barcode : autoBarcode}
                onChange={(event) => {
                  setBarcodeEdited(true);
                  setForm((current) => ({ ...current, barcode: event.target.value }));
                }}
                placeholder="WH1-A-01-01-01-01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{t("binType")}</Label>
              <select
                id="type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as BinFormValues["type"],
                  }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="standard">{t("standard")}</option>
                <option value="bulk">{t("bulk")}</option>
                <option value="pick">{t("pick")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{t("status")}</Label>
              <select
                id="status"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as BinFormValues["status"],
                  }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="available">{t("available")}</option>
                <option value="full">{t("full")}</option>
                <option value="reserved">{t("reserved")}</option>
                <option value="blocked">{t("blocked")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">{t("capacity")}</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, capacity: event.target.value }))
                }
                placeholder="100"
              />
            </div>
            {selectedShelf ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm sm:col-span-2">
                <p className="font-medium">{t("selectedShelf")}</p>
                <p className="text-muted-foreground">
                  {selectedShelf.warehouseName} ({selectedShelf.warehouseCode}) /{" "}
                  {selectedShelf.zoneCode} / {selectedShelf.aisleCode} / {selectedShelf.rackCode} /{" "}
                  {selectedShelf.shelfCode}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? mode === "create"
                ? t("creating")
                : t("saving")
              : mode === "create"
                ? t("createBin")
                : t("saveChanges")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/warehouse")}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
