import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const session = await getAdminSession();
    if (session) redirect("/admin");
  } catch {
    // Never block the login screen if session lookup fails
  }

  return <>{children}</>;
}
