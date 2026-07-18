import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteServicesPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Services"
      description="Service cards on the homepage."
      initialData={content.services}
      table="website_services"
    />
  );
}
