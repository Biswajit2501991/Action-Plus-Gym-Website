import { getSiteContent } from "@/lib/cms/get-site-content";
import { SettingsEditor } from "@/components/admin/SettingsEditor";

export default async function WebsiteContactDetailsPage() {
  const content = await getSiteContent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Contact & Brand</h1>
        <p className="mt-1 text-sm text-muted">
          Phone, address, WhatsApp, map embed, SEO and hero copy.
        </p>
      </div>
      <SettingsEditor settings={content.settings} />
    </div>
  );
}
