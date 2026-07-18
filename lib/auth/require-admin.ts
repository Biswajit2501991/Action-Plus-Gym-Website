import { redirect } from "next/navigation";
import { getAdminSession, isOwnerRole } from "@/lib/auth/session";

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function requireOwnerAdmin() {
  const session = await requireAdmin();
  if (!isOwnerRole(session.staff_role)) redirect("/admin");
  return session;
}
