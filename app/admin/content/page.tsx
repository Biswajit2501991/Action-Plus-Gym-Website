import { redirect } from "next/navigation";

export default function LegacyContentRedirect() {
  redirect("/admin/website");
}
