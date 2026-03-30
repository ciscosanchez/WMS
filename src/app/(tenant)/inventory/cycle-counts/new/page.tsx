"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createCycleCountPlan } from "@/modules/inventory/cycle-count-actions";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  method: z.enum(["abc", "zone", "full", "random"]),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  configJson: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const methodOptions = [
  { value: "abc", label: "ABC Classification" },
  { value: "zone", label: "Zone-Based" },
  { value: "full", label: "Full Inventory" },
  { value: "random", label: "Random Sample" },
];

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

export default function NewCycleCountPlanPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      method: "abc",
      frequency: "weekly",
      configJson: "{}",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      let config = {};
      if (values.configJson) {
        try {
          config = JSON.parse(values.configJson);
        } catch {
          toast.error("Invalid JSON in config field");
          setSubmitting(false);
          return;
        }
      }

      await createCycleCountPlan({
        name: values.name,
        method: values.method,
        frequency: values.frequency,
        config,
      });

      toast.success("Cycle count plan created");
      router.push("/inventory/cycle-counts");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create plan"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Cycle Count Plan"
        description="Configure a recurring cycle count schedule"
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 max-w-2xl"
      >
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Weekly ABC Count"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <select
                id="method"
                {...register("method")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {methodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.method && (
                <p className="text-sm text-destructive">
                  {errors.method.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <select
                id="frequency"
                {...register("frequency")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.frequency && (
                <p className="text-sm text-destructive">
                  {errors.frequency.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="configJson">
                Config (JSON)
              </Label>
              <Textarea
                id="configJson"
                rows={4}
                placeholder='{"zoneCodes": ["A", "B"], "randomCount": 50}'
                {...register("configJson")}
              />
              <p className="text-xs text-muted-foreground">
                Optional. For zone method: {`{"zoneCodes": [...]}`}. For
                random: {`{"randomCount": 50}`}.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Plan"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
