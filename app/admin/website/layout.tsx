import { requireOwnerAdmin } from "@/lib/auth/require-admin";
import { WebsiteSubnav } from "@/components/admin/WebsiteSubnav";

export default async function WebsiteAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwnerAdmin();

  return (
    <div>
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          Website
        </p>
        <p className="mt-1 text-sm text-muted">
          Configure every part of the public website without code.
        </p>
      </div>
      <WebsiteSubnav />
      {children}
    </div>
  );
}
