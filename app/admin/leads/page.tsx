import { requireAdmin } from "@/lib/auth/require-admin";
import { listLeadsAction } from "@/lib/actions/admin";
import { LeadsBoard, type LeadItem } from "@/components/admin/LeadsBoard";

export default async function LeadsPage() {
  await requireAdmin();
  const data = await listLeadsAction();
  const leads = (data?.leads ?? []) as LeadItem[];

  return <LeadsBoard leads={leads} />;
}
