import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteHeroPage() {
  const content = await getSiteContent();

  return (
    <div className="space-y-10">
      <JsonCollectionEditor
        title="Hero Slides"
        description="Fullscreen hero images. Each item needs image_url, title, sort_order, is_active."
        initialData={content.heroSlides}
        table="website_hero_slides"
      />
      <JsonCollectionEditor
        title="Statistics"
        description="Animated stats under the hero (Members, Trainers, Years, Rating)."
        initialData={content.stats}
        table="website_stats"
      />
    </div>
  );
}
