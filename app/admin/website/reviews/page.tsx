import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsiteReviewsPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Google Reviews"
      description="Cached rating, total reviews, google_url and reviews array."
      initialData={content.reviews}
      mode="reviews"
    />
  );
}
