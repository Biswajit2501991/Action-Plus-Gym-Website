/** Parse a UPI VPA from a stored field or from a QR display name. */
export function extractUpiId(upiId?: string | null, qrName?: string | null) {
  const direct = String(upiId || "").trim();
  if (direct) return direct.slice(0, 120);
  const name = String(qrName || "");
  const labeled = name.match(/upi\s*id\s*:?\s*([^\s,]+)/i);
  if (labeled?.[1]) return labeled[1].trim().slice(0, 120);
  const at = name.match(/([a-zA-Z0-9._\-]{2,}@[a-zA-Z0-9.\-]{2,})/);
  return at?.[1] ? at[1].slice(0, 120) : "";
}

export function isMissingPaymentQrPortalColumn(error: {
  message?: string;
  details?: string;
  hint?: string;
} | null) {
  const msg = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return (
    /show_in_member_portal|upi_id/i.test(msg) &&
    /column|schema cache|does not exist/i.test(msg)
  );
}
