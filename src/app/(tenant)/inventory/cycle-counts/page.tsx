"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Calendar, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const mockPlans = [
  {
    id: "1",
    name: "Weekly Zone A",
    method: "zone",
    frequency: "weekly",
    isActive: true,
    config: { zones: ["A"] },
    lastRunAt: new Date("2026-03-09"),
    nextRunAt: new Date("2026-03-16"),
    bins: 80,
  },
  {
    id: "2",
    name: "Monthly Full Count",
    method: "full",
    frequency: "monthly",
    isActive: true,
    config: {},
    lastRunAt: new Date("2026-02-15"),
    nextRunAt: new Date("2026-03-15"),
    bins: 184,
  },
  {
    id: "3",
    name: "ABC High Value",
    method: "abc",
    frequency: "daily",
    isActive: true,
    config: { categories: ["A"] },
    lastRunAt: new Date("2026-03-15"),
    nextRunAt: new Date("2026-03-16"),
    bins: 25,
  },
  {
    id: "4",
    name: "Quarterly Audit",
    method: "full",
    frequency: "quarterly",
    isActive: false,
    config: {},
    lastRunAt: new Date("2025-12-31"),
    nextRunAt: new Date("2026-03-31"),
    bins: 184,
  },
];

const methodLabels: Record<string, string> = {
  abc: "ABC Analysis",
  zone: "Zone",
  full: "Full Count",
  random: "Random Sample",
};

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export default function CycleCountsPage() {
  const [creating, setCreating] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planMethod, setPlanMethod] = useState("zone");
  const [planFrequency, setPlanFrequency] = useState("weekly");

  return (
    <div className="space-y-6">
      <PageHeader title="Cycle Counts" description="Schedule and execute inventory counts">
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Count Plan
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Plans</span>
            </div>
            <p className="mt-1 text-2xl font-bold">3</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Due Today</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-orange-600">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">Bins Counted (MTD)</span>
            <p className="mt-1 text-2xl font-bold">342</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">Accuracy Rate</span>
            <p className="mt-1 text-2xl font-bold text-green-600">99.2%</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans table */}
      <Card>
        <CardHeader>
          <CardTitle>Count Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Bins</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{methodLabels[plan.method]}</Badge>
                  </TableCell>
                  <TableCell>{frequencyLabels[plan.frequency]}</TableCell>
                  <TableCell>{plan.bins}</TableCell>
                  <TableCell>{format(plan.lastRunAt, "MMM d")}</TableCell>
                  <TableCell>
                    <span
                      className={plan.nextRunAt <= new Date() ? "text-orange-600 font-medium" : ""}
                    >
                      {format(plan.nextRunAt, "MMM d")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={plan.isActive ? "active" : "suspended"} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={plan.nextRunAt <= new Date() ? "default" : "outline"}
                      onClick={() => toast.success(`Starting count: ${plan.name}`)}
                    >
                      {plan.nextRunAt <= new Date() ? "Start Count" : "Run Now"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create plan dialog */}
      {creating && (
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Cycle Count Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Weekly Zone A Count"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <select
                    value={planMethod}
                    onChange={(e) => setPlanMethod(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="abc">ABC Analysis</option>
                    <option value="zone">Zone</option>
                    <option value="full">Full Count</option>
                    <option value="random">Random Sample</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <select
                    value={planFrequency}
                    onChange={(e) => setPlanFrequency(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    toast.success("Count plan created");
                    setCreating(false);
                  }}
                >
                  Create Plan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
