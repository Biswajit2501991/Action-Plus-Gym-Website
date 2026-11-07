/**
 * Copy and links for a payment-received notice.
 * Date only. The amount and date are formatted from the saved payment row.
 */

export const PAYMENT_RECEIVED_TITLE = "Payment received";
export const PAYMENT_RECEIVED_KIND = "payment_received";

export function isPaymentReceivedId(raw: unknown): boolean {
  const id = String(raw || "").trim();
  if (!id || id.length > 180) return false;
  return !/[\u0000-\u001f\u007f]/.test(id) && !/\s/.test(id);
}

export function paymentReceivedLogKind(paymentId: string): string {
  return `${PAYMENT_RECEIVED_KIND}:${paymentId}`;
}

/** Calendar date in India, with no clock time. */
export function formatPaymentReceivedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dt);
}

export function formatPaymentReceivedAmount(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function paymentReceivedBody(amountDisplay: string, dateLabel: string): string {
  return `Thank you for your payment of ₹${amountDisplay} on ${dateLabel}. You can open your receipt in the Member Portal.`;
}

export function paymentReceivedPortalPath(paymentId: string): string {
  return `/members?payment=${encodeURIComponent(paymentId)}`;
}

export function paymentIdFromPortalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, "https://www.actionplusgym.com");
    const id = String(url.searchParams.get("payment") || "").trim();
    return isPaymentReceivedId(id) ? id : null;
  } catch {
    return null;
  }
}
