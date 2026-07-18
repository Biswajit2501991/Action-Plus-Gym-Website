import { getSiteContent } from "@/lib/cms/get-site-content";
import { ItemListEditor } from "@/components/admin/ItemListEditor";

export default async function WebsitePricingPage() {
  const content = await getSiteContent();
  return (
    <ItemListEditor
      title="Pricing"
      description="Membership plans in Indian Rupees. Example price: Rs 1,499 or ₹1,499."
      table="website_pricing_plans"
      itemLabel="Plan"
      initialRows={content.pricing}
      createEmpty={() => ({
        name: "",
        period: "monthly",
        price: "₹",
        description: "",
        features: [],
        is_featured: false,
        badge: "",
        cta_text: "Join Now",
        sort_order: 0,
        is_active: true,
      })}
      fields={[
        { key: "name", label: "Plan name", type: "text", placeholder: "Monthly" },
        {
          key: "period",
          label: "Billing period",
          type: "select",
          options: [
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "yearly", label: "Yearly" },
            { value: "custom", label: "Custom" },
          ],
        },
        {
          key: "price",
          label: "Price",
          type: "text",
          placeholder: "₹1,499",
          hint: "Include Rs or ₹",
        },
        {
          key: "badge",
          label: "Badge (optional)",
          type: "text",
          placeholder: "Most Popular",
        },
        {
          key: "description",
          label: "Short description",
          type: "textarea",
          fullWidth: true,
        },
        {
          key: "features",
          label: "What's included",
          type: "features",
          fullWidth: true,
          hint: "One benefit per line",
        },
        {
          key: "cta_text",
          label: "Button text",
          type: "text",
          placeholder: "Join Now",
        },
        {
          key: "is_featured",
          label: "Highlight as featured plan",
          type: "toggle",
        },
        { key: "is_active", label: "Show on website", type: "toggle" },
      ]}
    />
  );
}
