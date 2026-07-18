import { getSiteContent } from "@/lib/cms/get-site-content";
import { PopupEditor } from "@/components/admin/PopupEditor";

export default async function WebsitePopupPage() {
  const content = await getSiteContent();
  return <PopupEditor popup={content.popup} />;
}
