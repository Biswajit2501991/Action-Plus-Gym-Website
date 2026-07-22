/**
 * Client-only instant cache for member portal panels (Training / Attendance).
 * Mirrors chat sessionStorage pattern — never blocks or replaces server truth.
 * Cookies are too small for these payloads; storage is used instead.
 */

const TRAINING_PREFIX = "apg_portal_training_v1_";
const ATTENDANCE_PREFIX = "apg_portal_attendance_v1_";

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

/** Max age to paint from cache (still always revalidates from API). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isFresh(savedAt: number) {
  return Number.isFinite(savedAt) && Date.now() - savedAt < MAX_AGE_MS;
}

export function readTrainingCache<T>(memberUuid: string): T | null {
  const id = String(memberUuid || "").trim();
  if (!id) return null;
  const env = readStore<T>(`${TRAINING_PREFIX}${id}`);
  if (!env || !isFresh(env.savedAt)) return null;
  return env.data;
}

export function writeTrainingCache<T>(memberUuid: string, data: T) {
  const id = String(memberUuid || "").trim();
  if (!id || data == null) return;
  writeStore(`${TRAINING_PREFIX}${id}`, data);
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
