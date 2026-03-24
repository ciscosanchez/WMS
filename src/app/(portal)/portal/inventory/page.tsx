import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPortalInventory } from "@/modules/portal/actions";
import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function PortalInventoryPage() {
  const t = await getTranslations("portal.inventory");
  const inventory = await getPortalInventory();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {inventory.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("noInventory")}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map(
                (item: {
                  id: string;
                  sku: string;
                  name: string;
                  uom: string;
                  onHand: number;
                  allocated: number;
                  available: number;
                  location: string;
                }) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell className="text-right font-medium">
                      {item.onHand.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          item.allocated > 0
                            ? "text-orange-600 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {item.allocated.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          item.available > 0
                            ? "text-green-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {item.available.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.location}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
