/** Normalize Indian mobile numbers to 10 digits when possible. */
export function normalizeMobile(input: string): string {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

export function isValidIndianMobile(normalized: string): boolean {
  return /^[6-9]\d{9}$/.test(normalized);
}

/** Join / trial / contact: 10-digit Indian mobile, not a repeated-digit placeholder. */
export function leadMobileError(raw: string): string | null {
  const mobile = normalizeMobile(raw);
  if (!isValidIndianMobile(mobile)) {
    return "Enter a 10-digit mobile number starting with 6, 7, 8, or 9.";
  }
  if (/^(\d)\1{9}$/.test(mobile)) {
    return "Enter the mobile number you use on WhatsApp.";
  }
  return null;
}

/** Match DB mobile variants against a normalized 10-digit number. */
export function mobileMatchVariants(normalized: string): string[] {
  const n = normalizeMobile(normalized);
  return [...new Set([n, `+91${n}`, `91${n}`, `0${n}`])];
}
