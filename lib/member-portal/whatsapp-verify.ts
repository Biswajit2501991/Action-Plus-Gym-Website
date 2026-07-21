/** Gym WhatsApp for staff-assisted portal verification (digits only, country code included). */
export function gymPortalWhatsAppDigits() {
  const raw = String(
    process.env.GYM_PORTAL_WHATSAPP || "917047157510",
  ).replace(/\D/g, "");
  return raw || "917047157510";
}

export function buildGymVerifyWhatsAppUrl(input: {
  memberName: string;
  memberMobile: string;
  memberCode: string;
  otp: string;
}) {
  const digits = gymPortalWhatsAppDigits();
  const text = [
    "Action Plus Gym — Member Portal verification",
    `Name: ${input.memberName}`,
    `Member ID: ${input.memberCode}`,
    `Mobile: ${input.memberMobile}`,
    `OTP (for staff): ${input.otp}`,
    "",
    "Approve in Gym Manager → WhatsApp Verification.",
  ].join("\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
