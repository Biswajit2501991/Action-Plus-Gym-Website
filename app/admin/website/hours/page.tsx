import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteHoursPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Opening Hours"
      description="day_of_week: 0=Sunday … 6=Saturday. Times as HH:MM:SS. Use is_hidden to hide a day."
      initialData={content.hours}
      table="website_opening_hours"
    />
  );
}
