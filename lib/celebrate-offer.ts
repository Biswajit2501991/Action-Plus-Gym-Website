import type { PopupOffer } from "@/lib/types";

export function isOfferLive(popup: PopupOffer | null | undefined): boolean {
  if (!popup?.enabled) return false;
  if (popup.expires_at && new Date(popup.expires_at) < new Date()) return false;
  return Boolean(String(popup.title || "").trim() || String(popup.body || "").trim());
}
