import { requireAdmin } from "@/lib/auth/require-admin";
import { listLeadsAction } from "@/lib/actions/admin";
import { LeadRow } from "@/components/admin/LeadRow";

export default async function LeadsPage() {
  await requireAdmin();
  const data = await listLeadsAction();
  const leads = (data?.leads ?? []) as Array<{
    id: number;
    full_name: string;
    email: string;
    mobile: string;
    status: string;
    intake_source: string;
    notes: string | null;
    interest_plan: string | null;
    created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-white">Leads & Enquiries</h1>
        <p className="mt-1 text-sm text-muted">
          Website submissions synced to Gym Manager visitors.
        </p>
      </div>
      <div className="space-y-3">
        {leads.length === 0 ? (
          <p className="text-sm text-muted">No website leads yet.</p>
        ) : (
          leads.map((lead) => <LeadRow key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
