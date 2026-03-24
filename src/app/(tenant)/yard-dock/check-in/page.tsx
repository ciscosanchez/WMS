import { PageHeader } from "@/components/shared/page-header";
import { getTranslations } from "next-intl/server";
import { CheckInForm } from "./check-in-form";

export default async function CheckInPage() {
  const t = await getTranslations("tenant.yardDock");

  return (
    <div className="space-y-6">
      <PageHeader title={t("checkIn")} description={t("checkInSubtitle")} />

      <CheckInForm
        labels={{
          appointmentNumber: t("appointmentNumber"),
          driverName: t("driverName"),
          driverLicense: t("driverLicense"),
          driverPhone: t("driverPhone"),
          trailerNumber: t("trailerNumber"),
          checkInButton: t("checkInButton"),
          success: t("checkInSuccess"),
          successDesc: t("checkInSuccessDesc"),
          errorTitle: t("checkInError"),
          newCheckIn: t("newCheckIn"),
        }}
      />
    </div>
  );
}
