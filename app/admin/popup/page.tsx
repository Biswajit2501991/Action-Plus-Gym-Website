import { redirect } from "next/navigation";

export default function LegacyPopupRedirect() {
  redirect("/admin/website/popup");
}
