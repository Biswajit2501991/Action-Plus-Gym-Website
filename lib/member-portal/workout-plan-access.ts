import {
  canonicalMemberStatus,
  type PortalAccessStatusKey,
} from "@/lib/member-portal/portal-access-by-status";

const IST = "Asia/Kolkata";
const YMD = /^(\d{4}-\d{2}-\d{2})$/;

export type WorkoutPlanByStatus = Record<PortalAccessStatusKey, boolean>;

/** Legacy QA list — no longer used for tile visibility (kept for settings API compat). */
export const DEFAULT_WORKOUT_PLAN_TESTER_NAMES = ["Bis Test"];

export const DEFAULT_WORKOUT_PLAN_BY_STATUS: WorkoutPlanByStatus = {
  Active: true,
  Hold: false,
  Deactivated: false,
  Cancelled: false,
};

export function isPtPlanName(planName: string | null | undefined) {
  return /\bpt\b/i.test(String(planName || "").trim());
}

export function normalizeWorkoutPlanByStatus(input: unknown): WorkoutPlanByStatus {
  const src =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const out: WorkoutPlanByStatus = { ...DEFAULT_WORKOUT_PLAN_BY_STATUS };
  for (const key of Object.keys(DEFAULT_WORKOUT_PLAN_BY_STATUS) as PortalAccessStatusKey[]) {
    const lower = key.toLowerCase();
    if (key in src) out[key] = Boolean(src[key]);
    else if (lower in src) out[key] = Boolean(src[lower]);
  }
  return out;
}

/** Legacy — stored in settings but not used for visibility gating. */
export function normalizeWorkoutPlanTesterNames(input: unknown): string[] {
  if (input == null) return [...DEFAULT_WORKOUT_PLAN_TESTER_NAMES];
  if (!Array.isArray(input)) {
    const one = String(input || "").trim();
    return one ? [one] : [...DEFAULT_WORKOUT_PLAN_TESTER_NAMES];
  }
  return input
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .slice(0, 40);
}

function foldIdentity(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Legacy helper — not used by evaluateWorkoutPlanVisibility. */
export function memberMatchesWorkoutPlanTesters(
  member: { fullName?: string | null; memberCode?: string | null },
  testerNames: string[],
) {
  if (!testerNames.length) return true;
  const name = foldIdentity(member.fullName);
  const code = foldIdentity(member.memberCode);
  return testerNames.some((raw) => {
    const t = foldIdentity(raw);
    return Boolean(t) && (t === name || t === code);
  });
}

export function normalizePortalWorkoutPlanDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const m = YMD.exec(raw.slice(0, 10));
  return m ? m[1] : null;
}

export function formatIstYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Optional per-member date window — both null means no schedule constraint. */
export function evaluateWorkoutPlanScheduleWindow(input: {
  enabledFrom?: string | null;
  enabledUntil?: string | null;
  todayYmd?: string;
}): { ok: boolean; reason: string | null } {
  const from = normalizePortalWorkoutPlanDate(input.enabledFrom);
  const until = normalizePortalWorkoutPlanDate(input.enabledUntil);
  if (!from && !until) return { ok: true, reason: null };

  const today =
    normalizePortalWorkoutPlanDate(input.todayYmd) || formatIstYmd(new Date());
  if (from && today < from) return { ok: false, reason: "date_not_started" };
  if (until && today > until) return { ok: false, reason: "date_expired" };
  return { ok: true, reason: null };
}

function applyScheduleGate(
  result: { visible: boolean; reason: string | null },
  schedule: {
    enabledFrom?: string | null;
    enabledUntil?: string | null;
    todayYmd?: string;
  },
): { visible: boolean; reason: string | null } {
  if (!result.visible) return result;
  const win = evaluateWorkoutPlanScheduleWindow(schedule);
  if (!win.ok) return { visible: false, reason: win.reason };
  return result;
}

/**
 * Home tiles → Workout Plan controls rollout mode:
 * - OFF (manual): show only when staff set portal_workout_plan_enabled = true (and not hidden).
 * - ON (auto): show by Workout Plan by status unless portal_workout_plan_hidden = true.
 * PT plans stay hidden by default; staff can opt a PT member in via portal_workout_plan_enabled.
 * Optional enabledFrom / enabledUntil (IST calendar days) auto-hide outside the window.
 */
export function evaluateWorkoutPlanVisibility(input: {
  /** Settings → Home tiles → Workout Plan (true = auto by status). */
  autoRolloutOn: boolean;
  byStatus: WorkoutPlanByStatus;
  memberSwitchOn: boolean;
  /** Staff explicitly hid this member (overrides auto rollout). */
  memberHidden: boolean;
  status: unknown;
  planName: string | null | undefined;
  enabledFrom?: string | null;
  enabledUntil?: string | null;
  todayYmd?: string;
}): { visible: boolean; reason: string | null } {
  const schedule = {
    enabledFrom: input.enabledFrom,
    enabledUntil: input.enabledUntil,
    todayYmd: input.todayYmd,
  };

  if (input.memberHidden) {
    return { visible: false, reason: "member_off" };
  }
  const statusKey = canonicalMemberStatus(input.status);
  if (!statusKey || input.byStatus[statusKey] !== true) {
    return { visible: false, reason: "status" };
  }
  // PT: default off. Explicit per-member ON opts them into Workout Plan (Training unchanged).
  if (isPtPlanName(input.planName) && input.memberSwitchOn !== true) {
    return { visible: false, reason: "pt_plan" };
  }

  if (input.autoRolloutOn) {
    return applyScheduleGate({ visible: true, reason: null }, schedule);
  }

  if (input.memberSwitchOn !== true) {
    return { visible: false, reason: "member_off" };
  }
  return applyScheduleGate({ visible: true, reason: null }, schedule);
}
