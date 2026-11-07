/**
 * One thank-you after a saved member payment.
 * Reads the payment row itself. Does not write payments, members, or billing reminders.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { configureWebPush, sendPushToMemberSubscriptions } from "@/lib/member-portal/billing-push";
import { insertBroadcastInboxRows } from "@/lib/member-portal/notification-inbox";
import {
  PAYMENT_RECEIVED_KIND,
  PAYMENT_RECEIVED_TITLE,
  formatPaymentReceivedAmount,
  formatPaymentReceivedDate,
  isPaymentReceivedId,
  paymentReceivedBody,
  paymentReceivedLogKind,
  paymentReceivedPortalPath,
} from "@/lib/member-portal/payment-received-link";

type MemberRow = { id: string | number };
type PaymentRow = { amount?: unknown; paid_at?: string | null };

async function loadSavedPayment(
  svc: SupabaseClient,
  gymId: string,
  memberUuid: string,
  paymentId: string,
): Promise<{ memberId: string | number; amount: string; dateLabel: string } | null> {
  const { data: member, error: memberErr } = await svc
    .from("members")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (memberErr) throw new Error(memberErr.message);
  const memberRow = member as MemberRow | null;
  if (!memberRow || memberRow.id == null || String(memberRow.id).trim() === "") return null;

  const readPayment = async () => {
    const { data, error } = await svc
      .from("member_payment_history")
      .select("amount, paid_at")
      .eq("gym_id", gymId)
      .eq("member_id", memberRow.id)
      .eq("external_payment_id", paymentId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as PaymentRow | null;
  };

  let payment = await readPayment();
  if (!payment) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    payment = await readPayment();
  }
  if (!payment) return null;

  const amount = formatPaymentReceivedAmount(payment.amount);
  const dateLabel = formatPaymentReceivedDate(payment.paid_at);
  if (!amount || !dateLabel) return null;
  return { memberId: memberRow.id, amount, dateLabel };
}

async function alreadySent(
  svc: SupabaseClient,
  gymId: string,
  memberUuid: string,
  paymentId: string,
): Promise<boolean> {
  const { data, error } = await svc
    .from("member_portal_push_send_log")
    .select("id")
    .eq("gym_id", gymId)
    .eq("member_uuid", memberUuid)
    .eq("kind", paymentReceivedLogKind(paymentId))
    .eq("success", true)
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data && data.length);
}

export async function notifySavedPayment(
  svc: SupabaseClient,
  opts: { gymId: string; memberUuid: string; paymentId: string },
): Promise<
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; sent: number; failed: number; inbox: number }
  | { ok: false; error: string }
> {
  const memberUuid = String(opts.memberUuid || "").trim();
  const paymentId = String(opts.paymentId || "").trim();
  if (!memberUuid || !isPaymentReceivedId(paymentId)) {
    return { ok: false, error: "payment-target-invalid" };
  }

  const saved = await loadSavedPayment(svc, opts.gymId, memberUuid, paymentId);
  if (!saved) return { ok: false, error: "payment-not-found" };

  if (await alreadySent(svc, opts.gymId, memberUuid, paymentId)) {
    return { ok: true, skipped: true };
  }

  const title = PAYMENT_RECEIVED_TITLE;
  const body = paymentReceivedBody(saved.amount, saved.dateLabel);
  const url = paymentReceivedPortalPath(paymentId);
  const kind = paymentReceivedLogKind(paymentId);

  const { error: claimErr } = await svc.from("member_portal_push_send_log").insert({
    gym_id: opts.gymId,
    member_uuid: memberUuid,
    kind,
    title,
    body,
    success: true,
  });
  if (claimErr) throw new Error(claimErr.message);

  const inbox = await insertBroadcastInboxRows(svc, {
    gymId: opts.gymId,
    memberUuids: [memberUuid],
    title,
    body,
    url,
    kind: PAYMENT_RECEIVED_KIND,
  });

  let sent = 0;
  let failed = 0;
  const vapid = configureWebPush();
  if (vapid.ok) {
    const result = await sendPushToMemberSubscriptions(svc, {
      gymId: opts.gymId,
      memberUuid,
      title,
      body,
      url,
      kind,
      tag: kind,
      log: false,
    });
    sent = result.sent;
    failed = result.failed;
  }

  return { ok: true, skipped: false, sent, failed, inbox };
}
