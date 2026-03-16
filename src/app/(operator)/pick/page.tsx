"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { ScanLine, MapPin, Check, Clock, ChevronRight } from "lucide-react";

const mockMyTasks = [
  {
    id: "1",
    number: "PICK-2026-0012",
    order: "ORD-2026-0002",
    items: 1,
    status: "in_progress",
    currentStep: "Bin WH1-A-01-02-01-02 → VALVE-BV2 × 1",
    progress: "0/1",
  },
];

const mockAvailableTasks = [
  { id: "2", number: "PICK-2026-0013", order: "ORD-2026-0003", items: 12, priority: "standard" },
  { id: "3", number: "PICK-2026-0014", order: "ORD-2026-0004", items: 2, priority: "rush" },
];

export default function OperatorPickPage() {
  const [scanInput, setScanInput] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pick</h1>
        <p className="text-sm text-muted-foreground">Your active and available pick tasks</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="My Active" value={1} icon={ScanLine} />
        <KpiCard title="Available" value={2} icon={Clock} />
      </div>

      {/* Active task — prominent */}
      {mockMyTasks.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">MY ACTIVE TASK</h2>
          {mockMyTasks.map((task) => (
            <Card key={task.id} className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{task.number}</p>
                    <p className="text-sm text-muted-foreground">{task.order}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700">{task.progress}</Badge>
                </div>

                {/* Current pick instruction — big and scannable */}
                <div className="mt-4 rounded-lg bg-muted p-4">
                  <p className="text-xs font-medium text-muted-foreground">NEXT PICK</p>
                  <div className="mt-2 flex items-center gap-3">
                    <MapPin className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-lg font-bold">WH1-A-01-02-01-02</p>
                      <p className="text-sm">VALVE-BV2 &mdash; 2in Ball Valve</p>
                      <p className="text-2xl font-bold text-primary">Qty: 1</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 relative">
                  <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Scan bin to confirm..."
                    className="h-12 pl-10 text-lg"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  <Button className="flex-1 h-12" size="lg">
                    <Check className="mr-2 h-5 w-5" />
                    Confirm Pick
                  </Button>
                  <Button variant="outline" className="h-12">
                    Short
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Available tasks */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">AVAILABLE TASKS</h2>
        <div className="space-y-3">
          {mockAvailableTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{task.number}</p>
                    {task.priority === "rush" && (
                      <Badge className="bg-orange-100 text-orange-700">Rush</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {task.order} &middot; {task.items} items
                  </p>
                </div>
                <Button>
                  Claim
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
