/** Defaults for Member Portal Basic workout chips + section visibility. */

export type BasicWorkoutOption = { label: string; visible: boolean };

export type PortalSections = {
  // Home tiles
  homeProfile: boolean;
  homeQrCard: boolean;
  homeDevices: boolean;
  homePayments: boolean;
  homeAttendance: boolean;
  homeAlerts: boolean;
  homeChat: boolean;
  homeTraining: boolean;
  homeWeightTracker: boolean;
  homeBook: boolean;
  homePerks: boolean;
  homeBiometric: boolean;
  // Training internals
  basicDailyWorkouts: boolean;
  basicNotes: boolean;
  measurements: boolean;
  ptSchedule: boolean;
  ptMemberNotes: boolean;
  ptAssignment: boolean;
  ptDiet: boolean;
  ptWorkoutDetails: boolean;
};

export const DEFAULT_BASIC_WORKOUT_OPTIONS: BasicWorkoutOption[] = [
  { label: "Back", visible: true },
  { label: "Chest", visible: true },
  { label: "Leg", visible: true },
  { label: "Shoulder", visible: true },
  { label: "Full Body", visible: true },
  { label: "Cardio", visible: true },
  { label: "Biceps", visible: true },
  { label: "Triceps", visible: true },
];

/** Missing keys default on — existing DB rows stay fully visible until staff toggles. */
export const DEFAULT_PORTAL_SECTIONS: PortalSections = {
  homeProfile: true,
  homeQrCard: true,
  homeDevices: true,
  homePayments: true,
  homeAttendance: true,
  homeAlerts: true,
  homeChat: true,
  homeTraining: true,
  homeWeightTracker: true,
  homeBook: true,
  homePerks: true,
  homeBiometric: true,
  basicDailyWorkouts: true,
  basicNotes: true,
  measurements: true,
  ptSchedule: true,
  ptMemberNotes: true,
  ptAssignment: true,
  ptDiet: false,
  ptWorkoutDetails: false,
};

export function normalizeBasicWorkoutOptions(
  input: unknown,
): BasicWorkoutOption[] {
  const source = Array.isArray(input) ? input : DEFAULT_BASIC_WORKOUT_OPTIONS;
  const out: BasicWorkoutOption[] = [];
  const seen = new Set<string>();
  for (const raw of source) {
    const label = String(
      raw && typeof raw === "object"
        ? ((raw as { label?: string; value?: string }).label ??
            (raw as { value?: string }).value ??
            "")
        : raw || "",
    )
      .trim()
      .slice(0, 80);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const visible =
      raw && typeof raw === "object" && "visible" in (raw as object)
        ? Boolean((raw as { visible?: boolean }).visible)
        : true;
    out.push({ label, visible });
    if (out.length >= 40) break;
  }
  return out.length
    ? out
    : DEFAULT_BASIC_WORKOUT_OPTIONS.map((o) => ({ ...o }));
}

export function normalizePortalSections(input: unknown): PortalSections {
  const src =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const out = { ...DEFAULT_PORTAL_SECTIONS };
  for (const key of Object.keys(DEFAULT_PORTAL_SECTIONS) as (keyof PortalSections)[]) {
    if (key in src) out[key] = Boolean(src[key]);
  }
  return out;
}

export function visibleBasicWorkoutLabels(options: unknown): string[] {
  return normalizeBasicWorkoutOptions(options)
    .filter((o) => o.visible)
    .filter((o) => !String(o.label).startsWith("__tile__:"))
    .map((o) => o.label);
}

const HOME_TILE_OPTION_PREFIX = "__tile__:";
const HOME_TILE_KEYS: (keyof PortalSections)[] = [
  "homeProfile",
  "homeQrCard",
  "homeDevices",
  "homePayments",
  "homeAttendance",
  "homeAlerts",
  "homeChat",
  "homeTraining",
  "homeWeightTracker",
  "homeBook",
  "homePerks",
  "homeBiometric",
];

/** Decode `__pht__:v1:<bits>` markers stored in settings_lookup_values.exerciseTypes. */
export function homeTilesFromExerciseTypeMarkers(
  exerciseTypes: unknown,
): Partial<PortalSections> {
  const list = Array.isArray(exerciseTypes) ? exerciseTypes.map(String) : [];
  const token = list.find((v) => v.startsWith("__pht__:v1:"));
  if (!token) return {};
  const bits = token.slice("__pht__:v1:".length);
  const out: Partial<PortalSections> = {};
  HOME_TILE_KEYS.forEach((key, i) => {
    if (bits[i] === "0") out[key] = false;
    else if (bits[i] === "1") out[key] = true;
  });
  return out;
}

/**
 * Merge portal_sections with durable fallbacks:
 * 1) `__pht__:` markers in exerciseTypes (works on current prod without new Express)
 * 2) `__tile__:` sentinels in basic_workout_options
 * 3) portal_sections jsonb (when backend persists full keys)
 */
export function portalSectionsFromSettings(input: {
  portal_sections?: unknown;
  basic_workout_options?: unknown;
  exerciseTypes?: unknown;
}): PortalSections {
  const homeFromOptions: Partial<PortalSections> = {};
  for (const row of normalizeBasicWorkoutOptions(input.basic_workout_options)) {
    if (!String(row.label).startsWith(HOME_TILE_OPTION_PREFIX)) continue;
    const key = row.label.slice(HOME_TILE_OPTION_PREFIX.length) as keyof PortalSections;
    if (HOME_TILE_KEYS.includes(key)) homeFromOptions[key] = row.visible;
  }
  const fromMarkers = homeTilesFromExerciseTypeMarkers(input.exerciseTypes);
  // Markers first, then tile sentinels, then explicit portal_sections (highest priority).
  const base = {
    ...DEFAULT_PORTAL_SECTIONS,
    ...fromMarkers,
    ...homeFromOptions,
  };
  return normalizePortalSections({
    ...base,
    ...(input.portal_sections && typeof input.portal_sections === "object"
      ? input.portal_sections
      : {}),
  });
}

/** Map portal step → home tile section flag. */
export function homeTileKeyForStep(
  step: string,
): keyof PortalSections | null {
  switch (step) {
    case "profile":
      return "homeProfile";
    case "card":
      return "homeQrCard";
    case "devices":
      return "homeDevices";
    case "payments":
      return "homePayments";
    case "attendance":
      return "homeAttendance";
    case "notifications":
      return "homeAlerts";
    case "chat":
      return "homeChat";
    case "training":
      return "homeTraining";
    case "weight":
      return "homeWeightTracker";
    case "bookings":
      return "homeBook";
    case "perks":
      return "homePerks";
    case "biometric":
      return "homeBiometric";
    default:
      return null;
  }
}
