import { SectionOrderEditor } from "@/components/admin/SectionOrderEditor";
import { getSiteContent } from "@/lib/cms/get-site-content";

export default async function WebsiteSectionOrderPage() {
  const content = await getSiteContent();
  return (
    <SectionOrderEditor initialOrder={content.sectionOrder} enabled={content.sections} />
  );
}
