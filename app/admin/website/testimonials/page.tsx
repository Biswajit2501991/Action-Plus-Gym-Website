import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteTestimonialsPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Testimonials"
      description="Member quotes with rating and optional photo_url."
      initialData={content.testimonials}
      table="website_testimonials"
    />
  );
}
