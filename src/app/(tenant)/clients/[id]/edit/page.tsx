"use client";

import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientFormData } from "@/modules/clients/schemas";
import { getClient, updateClient, deleteClient } from "@/modules/clients/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function EditClientPage() {
  const router = useRouter();
  const tv = useTranslations("validation");
  const params = useParams<{ id: string }>();
  const t = useTranslations("tenant.clients");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema(tv)),
  });

  useEffect(() => {
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
          country: client.country ?? "",
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
    load();
  }, [params.id, reset]);

  async function onSubmit(data: ClientFormData) {
    try {
      await updateClient(params.id, data);
      toast.success(t("clientUpdated"));
      router.push("/clients");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("failedUpdate"));
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deleteClient(params.id);
      toast.success(t("clientDeleted"));
      router.push("/clients");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("failedDelete"));
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
      <PageHeader title={t("editClient")} description={t("editClientDesc")} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("generalInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">{t("code") + " *"}</Label>
              <Input id="code" {...register("code")} placeholder="ACME" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("name") + " *"}</Label>
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
              <Input id="contactPhone" {...register("contactPhone")} />
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
              <Label htmlFor="state">{t("state")}</Label>
              <Input id="state" {...register("state")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("country")}</Label>
              <Input id="country" {...register("country")} />
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
            {isSubmitting ? t("saving") : t("saveChanges")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button type="button" variant="destructive" disabled={deleting} />}
              >
                {deleting ? "Deleting..." : t("delete")}
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
        </div>
      </form>
    </div>
  );
}
