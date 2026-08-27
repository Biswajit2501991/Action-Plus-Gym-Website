import {
  canonicalMemberStatus,
  type PortalAccessStatusKey,
} from "@/lib/member-portal/portal-access-by-status";

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

/**
 * Home tiles → Workout Plan controls rollout mode:
 * - OFF (manual): default hidden; staff enable member-by-member via portal_workout_plan_enabled.
 * - ON (auto): show for members whose status is ON in Workout Plan by status (non-PT).
 */
export function evaluateWorkoutPlanVisibility(input: {
  /** Settings → Home tiles → Workout Plan (true = auto by status). */
  autoRolloutOn: boolean;
  byStatus: WorkoutPlanByStatus;
  memberSwitchOn: boolean;
  status: unknown;
  planName: string | null | undefined;
}): { visible: boolean; reason: string | null } {
  const statusKey = canonicalMemberStatus(input.status);
  if (!statusKey || input.byStatus[statusKey] !== true) {
    return { visible: false, reason: "status" };
  }
  if (isPtPlanName(input.planName)) {
    return { visible: false, reason: "pt_plan" };
  }

  if (input.autoRolloutOn) {
    return { visible: true, reason: null };
  }

  if (input.memberSwitchOn !== true) {
    return { visible: false, reason: "member_off" };
  }
  return { visible: true, reason: null };
}
