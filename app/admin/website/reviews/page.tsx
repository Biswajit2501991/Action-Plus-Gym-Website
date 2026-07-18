import { getSiteContent } from "@/lib/cms/get-site-content";
import { ReviewsEditor } from "@/components/admin/ReviewsEditor";

export default async function WebsiteReviewsPage() {
  const content = await getSiteContent();
  return <ReviewsEditor reviews={content.reviews} />;
}
