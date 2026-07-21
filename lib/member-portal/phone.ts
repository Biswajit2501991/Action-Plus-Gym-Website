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

/** Match DB mobile variants against a normalized 10-digit number. */
export function mobileMatchVariants(normalized: string): string[] {
  const n = normalizeMobile(normalized);
  return [...new Set([n, `+91${n}`, `91${n}`, `0${n}`])];
}
