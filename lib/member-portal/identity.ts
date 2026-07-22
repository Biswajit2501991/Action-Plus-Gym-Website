/**
 * Normalize member identity fields for comparison only.
 * Never write these transformed values back to the database.
 */

/** Lowercase + strip all whitespace (and common separators) for name matching. */
export function normalizeNameForCompare(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[\s._'-]+/g, "")
    .trim();
}

/** Email: trim + lowercase. */
export function normalizeEmailForCompare(input: string): string {
  return String(input || "").trim().toLowerCase();
}

/**
 * DOB → DDMMYYYY digits only.
 * Accepts: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD (DB date), or already DDMMYYYY.
 */
export function normalizeDobForCompare(input: string | Date | null | undefined): string | null {
  if (input == null) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    const dd = String(input.getUTCDate()).padStart(2, "0");
    const mm = String(input.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(input.getUTCFullYear());
    return `${dd}${mm}${yyyy}`;
  }

  const raw = String(input).trim();
  if (!raw) return null;

  // Already 8 digits DDMMYYYY
  if (/^\d{8}$/.test(raw)) return raw;

  // ISO date YYYY-MM-DD (Postgres date / JSON)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[3]}${iso[2]}${iso[1]}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${dd}${mm}${yyyy}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return digits;
  return null;
}

export function isValidDobInput(input: string): boolean {
  return Boolean(normalizeDobForCompare(input));
}

export type IdentityMatchInput = {
  fullName: string;
  dob?: string;
  email?: string;
};

export type IdentityMemberFields = {
  full_name?: string | null;
  dob?: string | Date | null;
  email?: string | null;
};

/** Compare submitted identity to a member row (comparison-only normalization). */
export function memberMatchesIdentity(
  member: IdentityMemberFields,
  input: IdentityMatchInput,
): boolean {
  const nameOk =
    normalizeNameForCompare(input.fullName) ===
    normalizeNameForCompare(String(member.full_name || ""));
  if (!nameOk) return false;

  const hasDob = Boolean(String(input.dob || "").trim());
  const hasEmail = Boolean(String(input.email || "").trim());
  if (hasDob === hasEmail) return false; // exactly one of DOB or email

  if (hasDob) {
    const a = normalizeDobForCompare(input.dob);
    const b = normalizeDobForCompare(member.dob);
    return Boolean(a && b && a === b);
  }

  return (
    normalizeEmailForCompare(String(input.email)) ===
    normalizeEmailForCompare(String(member.email || ""))
  );
}
