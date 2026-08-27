import {
  canonicalMemberStatus,
  type PortalAccessStatusKey,
} from "@/lib/member-portal/portal-access-by-status";

export type WorkoutPlanByStatus = Record<PortalAccessStatusKey, boolean>;

/** While this list is non-empty, only these members see Workout Plan. Empty array = all eligible members. */
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

/**
 * null/undefined → tester-only default (Bis Test).
 * [] → rollout to every member who passes the other gates.
 * ["Name"] → only matching names/codes.
 */
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

export function evaluateWorkoutPlanVisibility(input: {
  gymTileOn: boolean;
  byStatus: WorkoutPlanByStatus;
  testerNames: string[];
  memberSwitchOn: boolean;
  status: unknown;
  planName: string | null | undefined;
  fullName?: string | null;
  memberCode?: string | null;
}): { visible: boolean; reason: string | null } {
  if (!input.gymTileOn) return { visible: false, reason: "gym_off" };
  const statusKey = canonicalMemberStatus(input.status);
  if (!statusKey || input.byStatus[statusKey] !== true) {
    return { visible: false, reason: "status" };
  }

  const testerOk = memberMatchesWorkoutPlanTesters(
    { fullName: input.fullName, memberCode: input.memberCode },
    input.testerNames,
  );

  // Non-empty tester list = QA rollout. Matching testers (e.g. Bis Test) see the tile
  // even when the per-member switch is still OFF.
  if (input.testerNames.length > 0) {
    if (!testerOk) return { visible: false, reason: "tester_only" };
    return { visible: true, reason: null };
  }

  // Full rollout: require explicit per-member ON (default is OFF).
  if (input.memberSwitchOn !== true) return { visible: false, reason: "member_off" };
  if (isPtPlanName(input.planName)) return { visible: false, reason: "pt_plan" };
  return { visible: true, reason: null };
}
