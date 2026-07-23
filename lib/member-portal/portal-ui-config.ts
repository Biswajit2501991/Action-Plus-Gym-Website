/** Defaults for Member Portal Basic workout chips + section visibility. */

export type BasicWorkoutOption = { label: string; visible: boolean };

export type PortalSections = {
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

export const DEFAULT_PORTAL_SECTIONS: PortalSections = {
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
    .map((o) => o.label);
}
