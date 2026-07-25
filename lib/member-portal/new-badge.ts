/** Shared 24-hour “New” badge window for portal tiles (client-only). */

export const NEW_BADGE_MS = 24 * 60 * 60 * 1000;

export function isWithinNewBadgeWindow(
  startedAtMs: number | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (startedAtMs == null || !Number.isFinite(startedAtMs)) return false;
  const elapsed = nowMs - startedAtMs;
  return elapsed >= 0 && elapsed < NEW_BADGE_MS;
}

/** Parse ISO / date / epoch into ms. Date-only → local midnight. */
export function toBadgeStartMs(input: string | number | null | undefined): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const raw = String(input).trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const dayOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dayOnly && raw.length <= 10) {
    const y = Number(dayOnly[1]);
    const m = Number(dayOnly[2]);
    const d = Number(dayOnly[3]);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d).getTime();
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}
