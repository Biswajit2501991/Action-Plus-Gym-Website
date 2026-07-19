import { getSiteContent } from "@/lib/cms/get-site-content";
import { ItemListEditor } from "@/components/admin/ItemListEditor";

export default async function WebsiteTrainersPage() {
  const content = await getSiteContent();
  return (
    <ItemListEditor
      title="Trainers"
      description="Coach profiles shown on the website. Add a photo link, experience, and short bio."
      table="website_trainers"
      itemLabel="Trainer"
      initialRows={content.trainers}
      emptyItem={{
        name: "",
        photo_url: "",
        experience: "",
        specialization: "",
        bio: "",
        socials: {},
        sort_order: 0,
        is_active: true,
      }}
      fields={[
        { key: "name", label: "Trainer name", type: "text" },
        {
          key: "specialization",
          label: "Specialization",
          type: "text",
          placeholder: "Strength & Conditioning",
        },
        {
          key: "experience",
          label: "Experience",
          type: "text",
          placeholder: "8 years",
        },
        {
          key: "photo_url",
          label: "Photo URL",
          type: "url",
          fullWidth: true,
          placeholder: "https://...",
        },
        {
          key: "bio",
          label: "Short bio",
          type: "textarea",
          fullWidth: true,
        },
        { key: "is_active", label: "Show on website", type: "toggle" },
      ]}
    />
  );
}
