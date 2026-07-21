/** Gym WhatsApp for staff-assisted portal verification (digits only, country code included). */
export function gymPortalWhatsAppDigits() {
  const raw = String(
    process.env.GYM_PORTAL_WHATSAPP || "917047157510",
  ).replace(/\D/g, "");
  return raw || "917047157510";
}

export function buildGymVerifyWhatsAppMessage(input: {
  memberName: string;
  memberMobile: string;
  memberCode: string;
  otp: string;
}) {
  return [
    "Action Plus Gym — Member Portal verification",
    `Name: ${input.memberName}`,
    `Member ID: ${input.memberCode}`,
    `Mobile: ${input.memberMobile}`,
    `OTP (for staff): ${input.otp}`,
    "",
    "Approve in Gym Manager → WhatsApp Verification.",
  ].join("\n");
}

/**
 * Prefer api.whatsapp.com — some networks break wa.me TLS (ERR_CERT_AUTHORITY_INVALID).
 * Also expose a native whatsapp:// link for phones with the app installed.
 */
export function buildGymVerifyWhatsAppLinks(input: {
  memberName: string;
  memberMobile: string;
  memberCode: string;
  otp: string;
}) {
  const digits = gymPortalWhatsAppDigits();
  const text = buildGymVerifyWhatsAppMessage(input);
  const encoded = encodeURIComponent(text);
  return {
    message: text,
    /** Primary — usually more reliable than wa.me behind SSL filters */
    whatsappUrl: `https://api.whatsapp.com/send?phone=${digits}&text=${encoded}`,
    /** Fallback deep link (mobile apps) */
    whatsappAppUrl: `whatsapp://send?phone=${digits}&text=${encoded}`,
    /** Legacy short link (often blocked by local SSL inspection) */
    waMeUrl: `https://wa.me/${digits}?text=${encoded}`,
  };
}
