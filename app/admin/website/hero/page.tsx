import { getSiteContent } from "@/lib/cms/get-site-content";
import { ItemListEditor } from "@/components/admin/ItemListEditor";

export default async function WebsiteHeroPage() {
  const content = await getSiteContent();

  return (
    <div className="space-y-12">
      <ItemListEditor
        title="Hero Slides"
        description="Fullscreen background images at the top of the homepage. Add a clear photo URL for each slide."
        table="website_hero_slides"
        itemLabel="Slide"
        initialRows={content.heroSlides}
        emptyItem={{
          title: "",
          image_url: "",
          video_url: "",
          sort_order: 0,
          is_active: true,
        }}
        fields={[
          { key: "title", label: "Slide title", type: "text", placeholder: "Strength" },
          {
            key: "image_url",
            label: "Image URL",
            type: "url",
            placeholder: "https://...",
            fullWidth: true,
            hint: "Paste a direct image link",
          },
          {
            key: "video_url",
            label: "Video URL (optional)",
            type: "url",
            fullWidth: true,
          },
          {
            key: "is_active",
            label: "Show this slide",
            type: "toggle",
          },
        ]}
      />

      <ItemListEditor
        title="Statistics"
        description="Numbers shown under the hero (members, trainers, years, rating)."
        table="website_stats"
        itemLabel="Stat"
        initialRows={content.stats}
        emptyItem={{
          label: "",
          value: "",
          sort_order: 0,
        }}
        fields={[
          { key: "label", label: "Label", type: "text", placeholder: "Members" },
          { key: "value", label: "Value", type: "text", placeholder: "2,500+" },
        ]}
      />
    </div>
  );
}
