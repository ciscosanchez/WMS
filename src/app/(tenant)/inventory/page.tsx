import { PageHeader } from "@/components/shared/page-header";
import { InventoryTable } from "@/components/inventory/inventory-table";

const mockInventory = [
  {
    id: "1",
    onHand: 150,
    allocated: 20,
    available: 130,
    lotNumber: null,
    serialNumber: null,
    uom: "EA",
    product: { sku: "WIDGET-001", name: "Standard Widget", client: { code: "ACME" } },
    bin: {
      barcode: "WH1-A-01-01-01-01",
      shelf: { rack: { aisle: { zone: { code: "A", warehouse: { code: "WH1" } } } } },
    },
  },
  {
    id: "2",
    onHand: 75,
    allocated: 0,
    available: 75,
    lotNumber: "LOT-2026-001",
    serialNumber: null,
    uom: "EA",
    product: { sku: "GADGET-001", name: "Premium Gadget", client: { code: "ACME" } },
    bin: {
      barcode: "WH1-A-01-01-01-03",
      shelf: { rack: { aisle: { zone: { code: "A", warehouse: { code: "WH1" } } } } },
    },
  },
  {
    id: "3",
    onHand: 500,
    allocated: 100,
    available: 400,
    lotNumber: "LOT-2026-003",
    serialNumber: null,
    uom: "EA",
    product: { sku: "BOLT-M8X40", name: "M8x40 Hex Bolt", client: { code: "GLOBEX" } },
    bin: {
      barcode: "WH1-B-02-01-01-05",
      shelf: { rack: { aisle: { zone: { code: "B", warehouse: { code: "WH1" } } } } },
    },
  },
  {
    id: "4",
    onHand: 30,
    allocated: 5,
    available: 25,
    lotNumber: null,
    serialNumber: "SN-00234",
    uom: "EA",
    product: { sku: "VALVE-BV2", name: "2in Ball Valve", client: { code: "INITECH" } },
    bin: {
      barcode: "WH1-A-01-02-01-02",
      shelf: { rack: { aisle: { zone: { code: "A", warehouse: { code: "WH1" } } } } },
    },
  },
  {
    id: "5",
    onHand: 200,
    allocated: 0,
    available: 200,
    lotNumber: "LOT-2026-005",
    serialNumber: null,
    uom: "FT",
    product: { sku: "PIPE-SCH40", name: "Schedule 40 Steel Pipe 2in", client: { code: "GLOBEX" } },
    bin: {
      barcode: "WH1-B-02-02-01-01",
      shelf: { rack: { aisle: { zone: { code: "B", warehouse: { code: "WH1" } } } } },
    },
  },
  {
    id: "6",
    onHand: 0,
    allocated: 0,
    available: 0,
    lotNumber: null,
    serialNumber: null,
    uom: "EA",
    product: { sku: "MOTOR-3HP", name: "3HP Electric Motor", client: { code: "STARK" } },
    bin: {
      barcode: "WH2-C-01-01-01-01",
      shelf: { rack: { aisle: { zone: { code: "C", warehouse: { code: "WH2" } } } } },
    },
  },
];

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stock Browser" description="Current inventory across all locations" />

      <InventoryTable data={mockInventory} />
    </div>
  );
}
