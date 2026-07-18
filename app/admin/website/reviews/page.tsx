import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";
import { SyncGoogleReviewsButton } from "@/components/admin/SyncGoogleReviewsButton";

export default async function WebsiteReviewsPage() {
  const content = await getSiteContent();
  return (
    <div>
      <SyncGoogleReviewsButton />
      <JsonCollectionEditor
        title="Google Reviews"
        description="Top reviews shown in the homepage slider (max 10). After the 10th slide, visitors see Check Google Reviews. Set google_url to your Google listing. Live sync needs GOOGLE_PLACES_API_KEY."
        initialData={content.reviews}
        mode="reviews"
      />
    </div>
  );
}
