import type { PopupOffer } from "@/lib/types";

export function isOfferLive(popup: PopupOffer | null | undefined): boolean {
  if (!popup?.enabled) return false;
  // Click-to-open: do not hide a saved offer just because an old auto-popup expiry passed.
  return Boolean(String(popup.title || "").trim() || String(popup.body || "").trim());
}
