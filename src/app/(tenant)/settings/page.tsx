import { getTenantSettings } from "@/modules/settings/actions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const settings = await getTenantSettings();
  return <SettingsClient initialSettings={settings} />;
}
