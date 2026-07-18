import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteVideosPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Videos"
      description="YouTube or MP4 videos with title and thumbnail_url."
      initialData={content.videos}
      table="website_videos"
    />
  );
}
