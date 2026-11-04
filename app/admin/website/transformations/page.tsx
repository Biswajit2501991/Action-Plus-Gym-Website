import { ItemListEditor } from "@/components/admin/ItemListEditor";
import { GYM_ID } from "@/lib/config";
import { createAnonServerClient } from "@/lib/supabase/server";
import type { Transformation } from "@/lib/types";

export default async function WebsiteTransformationsPage() {
  const supabase = createAnonServerClient();
  const { data } = await supabase
    .from("website_transformations")
    .select(
      "id, member_name, before_photo_url, after_photo_url, photo_message, message, trained_under, sort_order, is_active",
    )
    .eq("gym_id", GYM_ID)
    .order("sort_order");

  return (
    <ItemListEditor
      title="Transformation Journey"
      description="Add a member’s pictures, a short photo message, their story, and who trained them. Visitors only see this block after you turn Transformation Journey on under Show / Hide Sections."
      table="website_transformations"
      itemLabel="Journey"
      initialRows={(data as Transformation[] | null) ?? []}
      emptyItem={{
        member_name: "",
        before_photo_url: "",
        after_photo_url: "",
        photo_message: "",
        message: "",
        trained_under: "",
        sort_order: 0,
        is_active: true,
      }}
      fields={[
        { key: "member_name", label: "Member name", type: "text" },
        { key: "trained_under", label: "Trained under", type: "text" },
        {
          key: "before_photo_url",
          label: "Before photo",
          type: "url",
          fullWidth: true,
          mediaKind: "image",
        },
        {
          key: "after_photo_url",
          label: "After photo",
          type: "url",
          fullWidth: true,
          mediaKind: "image",
        },
        {
          key: "photo_message",
          label: "Photo message",
          type: "text",
          fullWidth: true,
          hint: "Short line shown with the pictures",
        },
        {
          key: "message",
          label: "Message",
          type: "textarea",
          fullWidth: true,
          hint: "Their story, in their words",
        },
        { key: "is_active", label: "Show on website", type: "toggle" },
      ]}
    />
  );
}
