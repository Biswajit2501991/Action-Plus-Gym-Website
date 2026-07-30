/** In-app billing Alerts for Member Portal (client-derived; no DB writes). */

import { isWithinNewBadgeWindow } from "@/lib/member-portal/new-badge";

export type BillingAlertKind = "billing" | "overdue";

export type BillingAlert = {
  kind: BillingAlertKind;
  /** Stable id for this billing cycle. */
  cycleKey: string;
  /** When this alert stage started (local midnight ms) — New badge lasts 24h from here. */
  startedAtMs: number;
  title: string;
  body: string;
  billingDateLabel: string;
  paymentByLabel: string;
};

const FINE_AMOUNT_INR = 100;

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  // Prefer YYYY-MM-DD calendar date (avoid UTC shift from full ISO timestamps)
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || !mo || !d) return null;
    return new Date(y, mo - 1, d);
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatIn(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Resolve Payment By: stored paymentBy, else billingDate + 7 days
 * (matches Gym Manager billing.ts).
 */
export function resolvePaymentByDate(input: {
  billingDate?: string | null;
  paymentBy?: string | null;
  nextPaymentDate?: string | null;
}): Date | null {
  const fromStored = parseDateOnly(input.paymentBy);
  if (fromStored) return fromStored;
  const billing = parseDateOnly(input.billingDate || input.nextPaymentDate);
  if (!billing) return null;
  return addDays(billing, 7);
}

export function resolveBillingDate(input: {
  billingDate?: string | null;
  nextPaymentDate?: string | null;
}): Date | null {
  return parseDateOnly(input.billingDate) || parseDateOnly(input.nextPaymentDate);
}

/** True when Bill Date is today — display cue for Active members only. */
export function isNextPaymentDateToday(input: {
  billingDate?: string | null;
  nextPaymentDate?: string | null;
  paymentBy?: string | null;
  status?: string | null;
}): boolean {
  const status = String(input.status || "").trim().toLowerCase();
  if (status && status !== "active") return false;
  const source = input.billingDate || input.nextPaymentDate || input.paymentBy;
  const d = parseDateOnly(source);
  if (!d) return false;
  return dateKey(d) === dateKey(todayLocal());
}

/**
 * Active members only:
 * - billing: today from billing date through payment-by (inclusive)
 * - overdue: today after payment-by → fine-style message
 */
export function deriveBillingAlert(input: {
  status?: string | null;
  billingDate?: string | null;
  paymentBy?: string | null;
  nextPaymentDate?: string | null;
  amount?: number | null;
}): BillingAlert | null {
  const status = String(input.status || "").trim().toLowerCase();
  if (status && status !== "active") return null;

  const billing = resolveBillingDate(input);
  const paymentBy = resolvePaymentByDate(input);
  if (!billing || !paymentBy) return null;

  const today = todayLocal();
  if (today < billing) return null;

  const billingLabel = formatIn(billing);
  const paymentByLabel = formatIn(paymentBy);
  const cycleKey = `billing:${dateKey(billing)}`;

  if (today <= paymentBy) {
    const onBillingDay = dateKey(today) === dateKey(billing);
    const intro = onBillingDay
      ? `Today is your billing date (${billingLabel}).`
      : `Your billing date was ${billingLabel}.`;
    return {
      kind: "billing",
      cycleKey,
      startedAtMs: billing.getTime(),
      title: "Billing date reminder",
      body: `${intro} Please clear your payment by ${paymentByLabel} (within 1 week of billing date) to keep your account active.`,
      billingDateLabel: billingLabel,
      paymentByLabel,
    };
  }

  const overdueStart = addDays(paymentBy, 1);
  return {
    kind: "overdue",
    cycleKey: `overdue:${dateKey(billing)}`,
    startedAtMs: overdueStart.getTime(),
    title: "Late payment notice",
    body: `Your payment was due on ${paymentByLabel}. A late payment amount of ₹${FINE_AMOUNT_INR} may have been added to your account. Please clear your payment within the next 1 week to keep your account active, or reach out to the gym if there is any unwilling circumstance or issue.`,
    billingDateLabel: billingLabel,
    paymentByLabel,
  };
}

/** New badge stays for 24 hours from when this alert stage started (not cleared on open). */
export function hasUnreadBillingAlert(
  _memberUuid: string,
  alert: BillingAlert | null,
  nowMs: number = Date.now(),
): boolean {
  if (!alert) return false;
  return isWithinNewBadgeWindow(alert.startedAtMs, nowMs);
}
