import { getSiteContent } from "@/lib/cms/get-site-content";
import { ItemListEditor } from "@/components/admin/ItemListEditor";

export default async function WebsiteServicesPage() {
  const content = await getSiteContent();
  return (
    <ItemListEditor
      title="Services"
      description="Training services shown on the website. Keep titles short and descriptions clear."
      table="website_services"
      itemLabel="Service"
      initialRows={content.services}
      emptyItem={{
        title: "",
        description: "",
        icon: "dumbbell",
        image_url: "",
        sort_order: 0,
        is_active: true,
      }}
      fields={[
        { key: "title", label: "Service name", type: "text", placeholder: "Personal Training" },
        {
          key: "icon",
          label: "Icon",
          type: "select",
          options: [
            { value: "dumbbell", label: "Dumbbell" },
            { value: "users", label: "Group" },
            { value: "zap", label: "Energy" },
            { value: "trending-down", label: "Weight loss" },
            { value: "heart", label: "Cardio" },
            { value: "activity", label: "Functional" },
            { value: "flame", label: "CrossFit" },
            { value: "apple", label: "Nutrition" },
            { value: "trophy", label: "Bodybuilding" },
            { value: "sparkles", label: "Ladies" },
          ],
        },
        {
          key: "description",
          label: "Short description",
          type: "textarea",
          fullWidth: true,
        },
        {
          key: "image_url",
          label: "Image (optional)",
          type: "url",
          fullWidth: true,
          mediaKind: "image",
        },
        { key: "is_active", label: "Show on website", type: "toggle" },
      ]}
    />
  );
}
