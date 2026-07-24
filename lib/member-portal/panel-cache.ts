/**
 * Client-only instant cache for member portal panels.
 * Mirrors chat sessionStorage pattern — never blocks or replaces server truth.
 * Cookies are too small for these payloads; storage is used instead.
 */

const TRAINING_PREFIX = "apg_portal_training_v1_";
const ATTENDANCE_PREFIX = "apg_portal_attendance_v1_";
const PAYMENTS_PREFIX = "apg_portal_payments_v1_";
const PERKS_PREFIX = "apg_portal_perks_v1_";

type Envelope<T> = { savedAt: number; data: T };

function safeParse<T>(raw: string | null): Envelope<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed !== "object" || parsed.data == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readStore<T>(key: string): Envelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = safeParse<T>(sessionStorage.getItem(key));
    if (fromSession) return fromSession;
    return safeParse<T>(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStore<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ savedAt: Date.now(), data } satisfies Envelope<T>);
  try {
    sessionStorage.setItem(key, payload);
  } catch {
    /* quota */
  }
  try {
    localStorage.setItem(key, payload);
  } catch {
    /* quota */
  }
}

/** Max age to paint from cache (still revalidates from API in the background). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Skip network revalidation when cache is newer than this (ms).
 * Keeps panels snappy across liveTick / tab focus without stale-forever data.
 */
export const TRAINING_SOFT_TTL_MS = 45_000;
export const PANEL_SOFT_TTL_MS = TRAINING_SOFT_TTL_MS;

function isFresh(savedAt: number) {
  return Number.isFinite(savedAt) && Date.now() - savedAt < MAX_AGE_MS;
}

function peekKeyedCache<T>(
  prefix: string,
  memberUuid: string,
): { data: T; savedAt: number; ageMs: number } | null {
  const id = String(memberUuid || "").trim();
  if (!id) return null;
  const env = readStore<T>(`${prefix}${id}`);
  if (!env || !isFresh(env.savedAt)) return null;
  return {
    data: env.data,
    savedAt: env.savedAt,
    ageMs: Math.max(0, Date.now() - env.savedAt),
  };
}

function writeKeyedCache<T>(prefix: string, memberUuid: string, data: T) {
  const id = String(memberUuid || "").trim();
  if (!id || data == null) return;
  writeStore(`${prefix}${id}`, data);
}

export function peekTrainingCache<T>(
  memberUuid: string,
): { data: T; savedAt: number; ageMs: number } | null {
  return peekKeyedCache<T>(TRAINING_PREFIX, memberUuid);
}

export function readTrainingCache<T>(memberUuid: string): T | null {
  return peekTrainingCache<T>(memberUuid)?.data ?? null;
}

export function writeTrainingCache<T>(memberUuid: string, data: T) {
  writeKeyedCache(TRAINING_PREFIX, memberUuid, data);
}

export function readAttendanceCache<T>(memberUuid: string, month: string): T | null {
  const id = String(memberUuid || "").trim();
  const m = String(month || "").trim();
  if (!id || !m) return null;
  const env = readStore<T>(`${ATTENDANCE_PREFIX}${id}_${m}`);
  if (!env || !isFresh(env.savedAt)) return null;
  return env.data;
}

export function writeAttendanceCache<T>(memberUuid: string, month: string, data: T) {
  const id = String(memberUuid || "").trim();
  const m = String(month || "").trim();
  if (!id || !m || data == null) return;
  writeStore(`${ATTENDANCE_PREFIX}${id}_${m}`, data);
}

export function peekPaymentsCache<T>(
  memberUuid: string,
): { data: T; savedAt: number; ageMs: number } | null {
  return peekKeyedCache<T>(PAYMENTS_PREFIX, memberUuid);
}

export function readPaymentsCache<T>(memberUuid: string): T | null {
  return peekPaymentsCache<T>(memberUuid)?.data ?? null;
}

export function writePaymentsCache<T>(memberUuid: string, data: T) {
  writeKeyedCache(PAYMENTS_PREFIX, memberUuid, data);
}

export function peekPerksCache<T>(
  memberUuid: string,
): { data: T; savedAt: number; ageMs: number } | null {
  return peekKeyedCache<T>(PERKS_PREFIX, memberUuid);
}

export function readPerksCache<T>(memberUuid: string): T | null {
  return peekPerksCache<T>(memberUuid)?.data ?? null;
}

export function writePerksCache<T>(memberUuid: string, data: T) {
  writeKeyedCache(PERKS_PREFIX, memberUuid, data);
}
