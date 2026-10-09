import { getSiteContent } from "@/lib/cms/get-site-content";
import { FestivalEditor } from "@/components/admin/FestivalEditor";

export default async function WebsiteFestivalPage() {
  const content = await getSiteContent();
  return <FestivalEditor settings={content.settings} />;
}
