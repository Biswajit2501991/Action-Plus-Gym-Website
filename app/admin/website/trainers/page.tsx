import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteTrainersPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Trainers"
      description="Coach profiles with photo_url, experience, specialization and bio."
      initialData={content.trainers}
      table="website_trainers"
    />
  );
}
