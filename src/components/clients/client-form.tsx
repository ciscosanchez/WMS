"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient, deleteClient, getClient, updateClient } from "@/modules/clients/actions";
import { COUNTRY_OPTIONS, getRegionOptions } from "@/modules/clients/reference-data";
import { clientSchema, type ClientFormData } from "@/modules/clients/schemas";

type ClientFormProps = {
  mode: "create" | "edit";
};

export function ClientForm({ mode }: ClientFormProps) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const t = useTranslations("tenant.clients");
  const tv = useTranslations("validation");
  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema(tv)),
    defaultValues: {
      code: "",
      name: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      taxId: "",
      address: "",
      city: "",
      state: "",
      country: "US",
      zipCode: "",
      notes: "",
      isActive: true,
    },
  });

  const countryValue = watch("country");
  const country = typeof countryValue === "string" && countryValue.length > 0 ? countryValue : "US";
  const regionOptions = useMemo(() => getRegionOptions(country), [country]);

  useEffect(() => {
    if (mode !== "edit") return;

    async function load() {
      try {
        const client = await getClient(params.id);
        if (!client) {
          setNotFound(true);
          return;
        }
        reset({
          code: client.code,
          name: client.name,
          contactName: client.contactName ?? "",
          contactEmail: client.contactEmail ?? "",
          contactPhone: client.contactPhone ?? "",
          taxId: client.taxId ?? "",
          address: client.address ?? "",
          city: client.city ?? "",
          state: client.state ?? "",
          country: client.country ?? "US",
          zipCode: client.zipCode ?? "",
          notes: client.notes ?? "",
          isActive: client.isActive,
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [mode, params.id, reset]);

  useEffect(() => {
    if (regionOptions.length === 0) return;
    const nextStateValue = watch("state");
    const currentState = typeof nextStateValue === "string" ? nextStateValue : "";
    if (currentState && regionOptions.some((option) => option.code === currentState)) return;
    setValue("state", "", { shouldDirty: true, shouldValidate: true });
  }, [regionOptions, setValue, watch]);

  async function onSubmit(data: ClientFormData) {
    try {
      if (mode === "edit") {
        await updateClient(params.id, data);
        toast.success(t("clientUpdated"));
      } else {
        await createClient(data);
        toast.success(t("clientCreated"));
      }
      router.push("/clients");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? t("failedUpdate")
            : t("failedCreate")
      );
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deleteClient(params.id);
      toast.success(t("clientDeleted"));
      router.push("/clients");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("failedDelete"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{t("loading")}</div>;
  }

  if (notFound) {
    return <div className="py-10 text-center text-muted-foreground">{t("clientNotFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "edit" ? t("editClient") : t("newClient")}
        description={mode === "edit" ? t("editClientDesc") : t("newClientDesc")}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("generalInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">{t("code")} *</Label>
              <Input id="code" {...register("code")} placeholder="ACME" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input id="name" {...register("name")} placeholder="Acme Corporation" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">{t("contactName")}</Label>
              <Input id="contactName" {...register("contactName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
              <Input id="contactEmail" type="email" {...register("contactEmail")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">{t("contactPhone")}</Label>
              <Input id="contactPhone" inputMode="tel" {...register("contactPhone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">{t("taxId")}</Label>
              <Input id="taxId" {...register("taxId")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("address")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">{t("address")}</Label>
              <Input id="address" {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t("city")}</Label>
              <Input id="city" {...register("city")} />
            </div>
            <div className="space-y-2">
              <Label>{t("country")}</Label>
              <Select
                value={country ?? "US"}
                onValueChange={(value) =>
                  setValue("country", value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {COUNTRY_OPTIONS.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && (
                <p className="text-xs text-destructive">{errors.country.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("state")}</Label>
              {regionOptions.length > 0 ? (
                <Select
                  value={watch("state") ?? ""}
                  onValueChange={(value) =>
                    setValue("state", value, { shouldDirty: true, shouldValidate: true })
                  }
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder={t("selectState")} />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {regionOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.code} - {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="state" {...register("state")} />
              )}
              {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">{t("zipCode")}</Label>
              <Input id="zipCode" {...register("zipCode")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...register("notes")} placeholder={t("notesPlaceholder")} rows={4} />
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
                : t("createClient")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
          {mode === "edit" ? (
            <div className="ml-auto">
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button type="button" variant="destructive" disabled={deleting} />}
                >
                  {deleting ? t("deleting") : t("delete")}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteClient")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>{t("delete")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
