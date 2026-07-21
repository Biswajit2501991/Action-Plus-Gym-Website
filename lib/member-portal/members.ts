import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  ALLOWED_MEMBER_STATUSES,
  portalGymId,
} from "@/lib/member-portal/config";
import { mobileMatchVariants, normalizeMobile } from "@/lib/member-portal/phone";
import type { MemberRow } from "@/lib/member-portal/session";
import { randomToken } from "@/lib/member-portal/crypto";

const MEMBER_SELECT =
  "id, gym_id, member_uuid, member_code, full_name, mobile, email, dob, status, plan_name, amount, joining_date, billing_date, next_payment_date, payment_by, assigned_gym_code_id, photo_url, photo_path, parent_guardian_name, medical_answers_json, portal_enabled, portal_status, qr_token, pin_hash, portal_activated_at, last_portal_login_at, deleted_at";

export async function findMemberByMobile(
  mobileInput: string,
): Promise<
  | { ok: true; member: MemberRow }
  | { ok: false; error: string; status: number }
> {
  const mobile = normalizeMobile(mobileInput);
  const svc = createServiceRoleClient();
  if (!svc.ok) return { ok: false, error: svc.error, status: 500 };

  const variants = mobileMatchVariants(mobile);
  const { data, error } = await svc.client
    .from("members")
    .select(MEMBER_SELECT)
    .eq("gym_id", portalGymId())
    .is("deleted_at", null)
    .in("mobile", variants)
    .limit(5);

  if (error) {
    console.error(error);
    return { ok: false, error: "Lookup failed", status: 500 };
  }

  // Also try suffix match if mobiles stored with spaces/formatting
  let member = (data || [])[0] as MemberRow | undefined;
  if (!member) {
    const { data: all } = await svc.client
      .from("members")
      .select(MEMBER_SELECT)
      .eq("gym_id", portalGymId())
      .is("deleted_at", null)
      .ilike("mobile", `%${mobile.slice(-10)}%`)
      .limit(20);
    member = (all || []).find(
      (m) => normalizeMobile(m.mobile) === mobile,
    ) as MemberRow | undefined;
  }

  if (!member) {
    return { ok: false, error: "No membership found for this number", status: 404 };
  }

  // Ensure portal columns exist on older rows
  if (!member.member_uuid) {
    return { ok: false, error: "Member portal not ready. Contact the gym.", status: 503 };
  }
  if (!member.qr_token) {
    await svc.client
      .from("members")
      .update({ qr_token: randomToken(32) })
      .eq("id", member.id);
    member.qr_token = "pending";
  }

  return { ok: true, member };
}

export function assertPortalEligible(
  member: MemberRow,
): { ok: true } | { ok: false; error: string; status: number } {
  if (member.portal_status === "disabled" || member.portal_enabled === false) {
    return {
      ok: false,
      error: "Portal access is disabled for this membership. Contact the gym.",
      status: 403,
    };
  }
  const status = String(member.status || "").trim().toLowerCase();
  if (!ALLOWED_MEMBER_STATUSES.has(status)) {
    return {
      ok: false,
      error: "This membership status cannot use the portal. Contact the gym.",
      status: 403,
    };
  }
  return { ok: true };
}

export function remainingDays(fromDate: string | null | undefined): number | null {
  if (!fromDate) return null;
  const end = new Date(fromDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export async function branchLabel(
  gymCodeId: string | null,
): Promise<string | null> {
  if (!gymCodeId) return null;
  const svc = createServiceRoleClient();
  if (!svc.ok) return null;
  const { data } = await svc.client
    .from("gym_codes")
    .select("code, name, display_name")
    .eq("id", gymCodeId)
    .maybeSingle();
  if (!data) return null;
  const code = data.code || "";
  const name = data.display_name || data.name || "";
  if (code && name) return `${code} / ${name}`;
  return name || code || null;
}

export function safeMemberPayload(
  member: MemberRow,
  branch: string | null,
  photoUrl: string | null,
) {
  const endDate = member.payment_by || member.next_payment_date || null;
  const medical = member.medical_answers_json || {};
  return {
    memberUuid: member.member_uuid,
    memberCode: member.member_code,
    fullName: member.full_name,
    mobile: member.mobile,
    email: member.email,
    dob: member.dob,
    status: member.status,
    planName: member.plan_name,
    amount: member.amount != null ? Number(member.amount) : null,
    joiningDate: member.joining_date,
    billingDate: member.billing_date,
    nextPaymentDate: member.next_payment_date,
    paymentBy: member.payment_by,
    remainingDays: remainingDays(endDate),
    branch,
    photoUrl,
    emergencyContact: member.parent_guardian_name || null,
    bloodGroup:
      typeof medical.bloodGroup === "string" ? medical.bloodGroup : null,
    hasPin: Boolean(member.pin_hash),
    portalStatus: member.portal_status,
  };
}
