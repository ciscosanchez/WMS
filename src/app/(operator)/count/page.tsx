"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Check, ChevronRight } from "lucide-react";

const mockCountTasks = [
  { id: "1", plan: "Weekly Zone A", bins: 20, counted: 8, status: "in_progress" },
  { id: "2", plan: "Monthly Full Count", bins: 184, counted: 0, status: "pending" },
];

export default function OperatorCountPage() {
  const [scanInput, setScanInput] = useState("");
  const [countQty, setCountQty] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Cycle Count</h1>
        <p className="text-sm text-muted-foreground">Count inventory at bin locations</p>
      </div>

      {/* Active count — scan bin, enter qty */}
      <Card className="border-primary">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Weekly Zone A</p>
              <p className="text-sm text-muted-foreground">8 of 20 bins counted</p>
            </div>
            <Badge className="bg-orange-100 text-orange-700">8/20</Badge>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs font-medium text-muted-foreground">NEXT BIN</p>
            <p className="text-xl font-bold mt-1">WH1-A-01-01-02-03</p>
            <p className="text-sm text-muted-foreground mt-1">
              Expected: WIDGET-001 (Standard Widget)
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">SCAN BIN TO START</label>
            <div className="relative mt-1">
              <ScanLine className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Scan bin barcode..."
                className="h-12 pl-10 text-lg"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">COUNTED QUANTITY</label>
            <Input
              type="number"
              placeholder="Enter count..."
              className="mt-1 h-12 text-2xl text-center font-bold"
              value={countQty}
              onChange={(e) => setCountQty(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 h-12" size="lg">
              <Check className="mr-2 h-5 w-5" />
              Submit Count
            </Button>
            <Button variant="outline" className="h-12">
              Empty
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available count tasks */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">COUNT TASKS</h2>
        <div className="space-y-3">
          {mockCountTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{task.plan}</p>
                  <p className="text-sm text-muted-foreground">
                    {task.counted}/{task.bins} bins
                  </p>
                </div>
                <Button variant={task.status === "in_progress" ? "default" : "outline"}>
                  {task.status === "in_progress" ? "Continue" : "Start"}
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
