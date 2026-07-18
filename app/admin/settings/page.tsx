import { redirect } from "next/navigation";

export default function LegacySettingsRedirect() {
  redirect("/admin/website/contact-details");
}
