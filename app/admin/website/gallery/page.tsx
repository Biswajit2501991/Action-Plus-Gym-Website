import { getSiteContent } from "@/lib/cms/get-site-content";
import { ItemListEditor } from "@/components/admin/ItemListEditor";

export default async function WebsiteGalleryPage() {
  const content = await getSiteContent();
  return (
    <ItemListEditor
      title="Gallery"
      description="Photos for the website gallery. Paste image links and a short alt text."
      table="website_gallery_images"
      itemLabel="Photo"
      initialRows={content.gallery}
      emptyItem={{
        album_id: null,
        image_url: "",
        alt_text: "",
        sort_order: 0,
        is_active: true,
      }}
      fields={[
        {
          key: "image_url",
          label: "Image",
          type: "url",
          fullWidth: true,
          placeholder: "Upload or paste image link",
          mediaKind: "image",
        },
        {
          key: "alt_text",
          label: "Photo description",
          type: "text",
          fullWidth: true,
          placeholder: "Gym floor",
        },
        { key: "is_active", label: "Show on website", type: "toggle" },
      ]}
    />
  );
}
