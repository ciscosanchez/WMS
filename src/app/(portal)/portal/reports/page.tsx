import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Package, Activity, Receipt, Truck } from "lucide-react";

const reports = [
  {
    title: "Inventory Snapshot",
    description:
      "Current on-hand, allocated, and available quantities for all your products. Includes location details.",
    icon: Package,
  },
  {
    title: "Activity Summary",
    description:
      "Summary of all warehouse activity including receipts, shipments, and adjustments for a selected period.",
    icon: Activity,
  },
  {
    title: "Billing Detail",
    description:
      "Itemized breakdown of storage, handling, and accessorial charges by period.",
    icon: Receipt,
  },
  {
    title: "Shipment History",
    description:
      "Complete history of all shipments with carrier, tracking, and delivery status information.",
    icon: Truck,
  },
];

export default function PortalReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download reports for your account"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>{report.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription>{report.description}</CardDescription>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
