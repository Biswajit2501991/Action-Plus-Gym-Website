/** Reject promo copy and instant script posts. Does not read or write visitor rows. */

const PROMO_RE =
  /\b(seo|s\.e\.o|backlink|backlinks|guest\s*post|link\s*building|digital\s+marketing|search\s+engine|crypto|bitcoin|forex|casino|payday|rank\s+your|google\s+rank|first\s+page|loan)\b/i;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const LINK_RE =
  /(https?:\/\/|www\.)|\b[a-z0-9-]+\.(com|net|org|io|xyz|info|biz|in)\b/i;

const MIN_FILL_MS = 3_000;
const MAX_FILL_MS = 6 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5_000;
const MAX_NOTE_CHARS = 600;

export const LEAD_SPAM_ERROR =
  "Promotional messages are not accepted. Please tell us about joining the gym.";

export const LEAD_TOO_FAST_ERROR =
  "Please take a moment to check your details, then submit.";

export const LEAD_FILL_AGAIN_ERROR = "Please fill in the form and try again.";

export const LEAD_DUPLICATE_ERROR =
  "We already have your details from today. Please call the gym if you need to add something.";

export function leadSpamError(parts: Array<string | null | undefined>): string | null {
  const text = parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n");
  if (!text) return null;
  if (text.length > MAX_NOTE_CHARS) {
    return "Please keep your message short.";
  }
  const withoutEmails = text.replace(EMAIL_RE, " ");
  if (PROMO_RE.test(text) || LINK_RE.test(withoutEmails)) return LEAD_SPAM_ERROR;
  return null;
}

/** Hidden form timer. Missing or instant submits are rejected. */
export function leadFillError(startedAt: unknown, now = Date.now()): string | null {
  const started = Number(startedAt);
  if (!Number.isFinite(started) || started <= 0) return LEAD_FILL_AGAIN_ERROR;
  const age = now - started;
  if (age < -FUTURE_SKEW_MS || age > MAX_FILL_MS) return LEAD_FILL_AGAIN_ERROR;
  if (age < MIN_FILL_MS) return LEAD_TOO_FAST_ERROR;
  return null;
}
