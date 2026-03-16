import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ProductsTable } from "@/components/products/products-table";

const mockProducts = [
  {
    id: "1",
    sku: "WIDGET-001",
    name: "Standard Widget",
    baseUom: "EA",
    trackLot: false,
    trackSerial: false,
    isActive: true,
    client: { code: "ACME", name: "Acme Corporation" },
  },
  {
    id: "2",
    sku: "GADGET-001",
    name: "Premium Gadget",
    baseUom: "EA",
    trackLot: true,
    trackSerial: false,
    isActive: true,
    client: { code: "ACME", name: "Acme Corporation" },
  },
  {
    id: "3",
    sku: "PART-A100",
    name: "Component Part A-100",
    baseUom: "EA",
    trackLot: false,
    trackSerial: true,
    isActive: true,
    client: { code: "ACME", name: "Acme Corporation" },
  },
  {
    id: "4",
    sku: "BOLT-M8X40",
    name: "M8x40 Hex Bolt",
    baseUom: "EA",
    trackLot: true,
    trackSerial: false,
    isActive: true,
    client: { code: "GLOBEX", name: "Globex Industries" },
  },
  {
    id: "5",
    sku: "PIPE-SCH40",
    name: "Schedule 40 Steel Pipe 2in",
    baseUom: "FT",
    trackLot: true,
    trackSerial: false,
    isActive: true,
    client: { code: "GLOBEX", name: "Globex Industries" },
  },
  {
    id: "6",
    sku: "VALVE-BV2",
    name: "2in Ball Valve",
    baseUom: "EA",
    trackLot: false,
    trackSerial: true,
    isActive: true,
    client: { code: "INITECH", name: "Initech Logistics" },
  },
  {
    id: "7",
    sku: "MOTOR-3HP",
    name: "3HP Electric Motor",
    baseUom: "EA",
    trackLot: false,
    trackSerial: true,
    isActive: false,
    client: { code: "STARK", name: "Stark Shipping" },
  },
];

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Manage SKUs and inventory items">
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </PageHeader>

      <ProductsTable data={mockProducts} />
    </div>
  );
}
