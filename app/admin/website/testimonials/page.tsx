import { getSiteContent } from "@/lib/cms/get-site-content";
import { ItemListEditor } from "@/components/admin/ItemListEditor";

export default async function WebsiteTestimonialsPage() {
  const content = await getSiteContent();
  return (
    <ItemListEditor
      title="Testimonials"
      description="Member quotes shown on the website. Keep them short and genuine."
      table="website_testimonials"
      itemLabel="Testimonial"
      initialRows={content.testimonials}
      createEmpty={() => ({
        name: "",
        quote: "",
        rating: 5,
        photo_url: "",
        video_url: "",
        sort_order: 0,
        is_active: true,
      })}
      fields={[
        { key: "name", label: "Member name", type: "text" },
        {
          key: "rating",
          label: "Star rating",
          type: "number",
          hint: "1 to 5",
        },
        {
          key: "quote",
          label: "Quote",
          type: "textarea",
          fullWidth: true,
        },
        {
          key: "photo_url",
          label: "Photo URL (optional)",
          type: "url",
          fullWidth: true,
        },
        {
          key: "video_url",
          label: "Video URL (optional)",
          type: "url",
          fullWidth: true,
        },
        { key: "is_active", label: "Show on website", type: "toggle" },
      ]}
    />
  );
}
