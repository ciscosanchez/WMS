"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCartonType, getCartonType, updateCartonType } from "@/modules/cartonization/actions";
import {
  cartonTypeSchema,
  type CartonTypeFormData,
  DIMENSION_UNIT_OPTIONS,
  WEIGHT_UNIT_OPTIONS,
} from "@/modules/cartonization/schemas";

type CartonTypeFormProps = {
  mode: "create" | "edit";
};

export function CartonTypeForm({ mode }: CartonTypeFormProps) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const t = useTranslations("tenant.cartonization");
  const tv = useTranslations("validation");
  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);

  const {
    register,
    reset,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CartonTypeFormData>({
    resolver: zodResolver(cartonTypeSchema(tv)),
    defaultValues: {
      name: "",
      code: "",
      length: 12,
      width: 10,
      height: 6,
      dimUnit: "in",
      maxWeight: 30,
      weightUnit: "lb",
      tareWeight: 0,
      cost: null,
    },
  });

  const dimUnit = watch("dimUnit") ?? "in";
  const weightUnit = watch("weightUnit") ?? "lb";

  useEffect(() => {
    if (mode !== "edit") return;

    async function load() {
      try {
        const carton = await getCartonType(params.id);
        if (!carton) {
          setNotFound(true);
          return;
        }
        reset({
          name: carton.name,
          code: carton.code,
          length: Number(carton.length),
          width: Number(carton.width),
          height: Number(carton.height),
          dimUnit: carton.dimUnit,
          maxWeight: Number(carton.maxWeight),
          weightUnit: carton.weightUnit,
          tareWeight: Number(carton.tareWeight),
          cost: carton.cost == null ? null : Number(carton.cost),
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [mode, params.id, reset]);

  async function onSubmit(data: CartonTypeFormData) {
    const action = mode === "edit" ? updateCartonType(params.id, data) : createCartonType(data);
    const result = await action;

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "edit" ? t("cartonTypeUpdated") : t("cartonTypeCreated"));
    router.push("/shipping/carton-types");
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{t("loading")}</div>;
  }

  if (notFound) {
    return <div className="py-10 text-center text-muted-foreground">{t("cartonTypeNotFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "edit" ? t("editCartonType") : t("newCartonType")}
        description={mode === "edit" ? t("editCartonTypeDesc") : t("newCartonTypeDesc")}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("cartonDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">{t("code")}</Label>
              <Input id="code" {...register("code")} placeholder="SMALL_BOX" />
              {errors.code ? (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" {...register("name")} placeholder="Small Box" />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dimensions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="length">{t("length")}</Label>
              <Input id="length" type="number" step="0.01" min="0" {...register("length")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="width">{t("width")}</Label>
              <Input id="width" type="number" step="0.01" min="0" {...register("width")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">{t("height")}</Label>
              <Input id="height" type="number" step="0.01" min="0" {...register("height")} />
            </div>
            <div className="space-y-2">
              <Label>{t("dimUnit")}</Label>
              <Select
                value={dimUnit}
                onValueChange={(value) =>
                  setValue("dimUnit", value as CartonTypeFormData["dimUnit"], {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {DIMENSION_UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errors.length ? (
              <p className="text-xs text-destructive sm:col-span-2 lg:col-span-4">
                {errors.length.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("weightAndCost")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="maxWeight">{t("maxWeight")}</Label>
              <Input id="maxWeight" type="number" step="0.01" min="0" {...register("maxWeight")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tareWeight">{t("tareWeight")}</Label>
              <Input
                id="tareWeight"
                type="number"
                step="0.01"
                min="0"
                {...register("tareWeight")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("weightUnit")}</Label>
              <Select
                value={weightUnit}
                onValueChange={(value) =>
                  setValue("weightUnit", value as CartonTypeFormData["weightUnit"], {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {WEIGHT_UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">{t("cost")}</Label>
              <Input id="cost" type="number" step="0.01" min="0" {...register("cost")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "edit"
                ? t("saving")
                : t("creating")
              : mode === "edit"
                ? t("saveChanges")
                : t("createCartonType")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
