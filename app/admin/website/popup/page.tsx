import { getSiteContent } from "@/lib/cms/get-site-content";
import { PopupEditor } from "@/components/admin/PopupEditor";

export default async function WebsitePopupPage() {
  const content = await getSiteContent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Popup Offer</h1>
        <p className="mt-1 text-sm text-muted">
          Configure the welcome offer visitors see on arrival.
        </p>
      </div>
      <PopupEditor popup={content.popup} />
    </div>
  );
}
