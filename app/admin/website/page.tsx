import { WebsiteSectionSearch } from "@/components/admin/WebsiteSectionSearch";

export default function WebsiteHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Website</h1>
        <p className="mt-1 text-sm text-muted">
          Search or choose a section to edit what visitors see on actionplusgym.com.
        </p>
      </div>
      <WebsiteSectionSearch variant="cards" />
    </div>
  );
}
