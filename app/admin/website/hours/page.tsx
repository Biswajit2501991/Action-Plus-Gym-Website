import { getSiteContent } from "@/lib/cms/get-site-content";
import { HoursEditor } from "@/components/admin/HoursEditor";

export default async function WebsiteHoursPage() {
  const content = await getSiteContent();
  return <HoursEditor hours={content.hours} />;
}
