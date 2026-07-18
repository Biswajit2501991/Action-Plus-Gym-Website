import { getSiteContent } from "@/lib/cms/get-site-content";
import { SectionToggle } from "@/components/admin/SectionToggle";

export default async function WebsiteSectionsPage() {
  const content = await getSiteContent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Show / Hide Sections</h1>
        <p className="mt-1 text-sm text-muted">
          Use the switches to show or hide each homepage block. No coding needed.
        </p>
      </div>
      <div className="space-y-3">
        {Object.entries(content.sections).map(([key, enabled]) => (
          <SectionToggle key={key} sectionKey={key} enabled={enabled} />
        ))}
      </div>
    </div>
  );
}
