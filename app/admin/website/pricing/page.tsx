import { getSiteContent } from "@/lib/cms/get-site-content";
import { JsonCollectionEditor } from "@/components/admin/JsonCollectionEditor";

export default async function WebsitePricingPage() {
  const content = await getSiteContent();
  return (
    <JsonCollectionEditor
      title="Pricing"
      description="Membership plans. features should be an array of strings."
      initialData={content.pricing}
      table="website_pricing_plans"
    />
  );
}
