import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PackageOpen, Boxes, MapPin } from "lucide-react";

const reports = [
  {
    title: "Receiving Summary",
    description: "Shipments received by date, client, and status",
    icon: PackageOpen,
  },
  {
    title: "Inventory Valuation",
    description: "Current stock levels by product and location",
    icon: Boxes,
  },
  {
    title: "Storage Utilization",
    description: "Bin occupancy rates across warehouse zones",
    icon: MapPin,
  },
  {
    title: "Movement History",
    description: "All inventory transactions over time",
    icon: BarChart3,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Warehouse analytics and reporting" />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.title} className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <report.icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{report.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
