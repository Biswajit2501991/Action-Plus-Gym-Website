import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteGalleryPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Gallery"
      description="Photo URLs for the gallery. Include image_url, alt_text, sort_order."
      initialData={content.gallery}
      table="website_gallery_images"
    />
  );
}
