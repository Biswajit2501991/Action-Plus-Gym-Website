import { getSiteContent } from "@/lib/cms/get-site-content";
import { SettingsEditor } from "@/components/admin/SettingsEditor";

export default async function WebsiteContactDetailsPage() {
  const content = await getSiteContent();
  return <SettingsEditor settings={content.settings} />;
}
