import {
  getWorkoutProgram,
  type WorkoutExercise,
  type WorkoutLevel,
  type WorkoutProgram,
} from "@/lib/member-portal/workout-programs";

/** Closed goal list. Members may pick more than one. */
export const WORKOUT_GOAL_OPTIONS = [
  { id: "fat_loss", label: "Fat Loss" },
  { id: "strength", label: "Strength Training" },
  { id: "body_building", label: "Body Building" },
  { id: "general_fitness", label: "General Fitness" },
  { id: "staying_active", label: "Staying Active" },
] as const;

export type WorkoutGoalId = (typeof WORKOUT_GOAL_OPTIONS)[number]["id"];

const GOAL_IDS = new Set<string>(WORKOUT_GOAL_OPTIONS.map((g) => g.id));

/** Same-role moves already written in the three programs. Compounds are listed first. */
const ROLE_POOLS: string[][] = [
  ["back_squat", "front_squat", "goblet_squat", "hack_squat", "leg_press", "split_squat", "bulgarian_split_squat"],
  ["deadlift_or_trap_bar", "romanian_deadlift", "dumbbell_rdl", "hip_thrust"],
  ["barbell_bench_press", "incline_barbell_press", "incline_bench_press", "machine_chest_press", "incline_dumbbell_press", "cable_fly", "pec_deck"],
  ["weighted_pull_up", "pull_up_or_lat_pulldown", "lat_pulldown", "assisted_pull_up", "neutral_grip_pulldown", "straight_arm_pulldown"],
  ["barbell_row", "chest_supported_row", "seated_cable_row", "dumbbell_row", "one_arm_dumbbell_row"],
  ["overhead_press", "seated_shoulder_press", "dumbbell_shoulder_press", "arnold_press"],
  ["dumbbell_lateral_raise", "cable_lateral_raise", "rear_delt_fly", "face_pull"],
  ["ez_bar_curl", "dumbbell_curl", "hammer_curl", "cable_curl", "preacher_curl"],
  ["rope_triceps_pushdown", "overhead_triceps_extension", "overhead_cable_extension", "dips_assisted"],
  ["leg_curl", "seated_leg_curl", "leg_extension"],
  ["standing_calf_raise", "seated_calf_raise"],
  ["cable_crunch", "hanging_leg_raise", "hanging_knee_raise", "plank", "dead_bug"],
];

export const WORKOUT_VARIANT_COUNT = 4;

const ROLE_BY_KEY = new Map<string, number>();
for (let i = 0; i < ROLE_POOLS.length; i++) {
  for (const key of ROLE_POOLS[i]) ROLE_BY_KEY.set(key, i);
}

export function parseWorkoutGoals(input: unknown): WorkoutGoalId[] {
  const raw = Array.isArray(input) ? input : [];
  const out: WorkoutGoalId[] = [];
  for (const item of raw) {
    const id = String(item || "").trim().toLowerCase();
    if (!GOAL_IDS.has(id)) continue;
    if (out.includes(id as WorkoutGoalId)) continue;
    out.push(id as WorkoutGoalId);
  }
  return out;
}

export function workoutGoalLabels(goals: WorkoutGoalId[]): string[] {
  return goals.map((id) => WORKOUT_GOAL_OPTIONS.find((g) => g.id === id)?.label || id);
}

export function workoutGoalNote(goals: WorkoutGoalId[]): string {
  const notes: string[] = [];
  if (goals.includes("fat_loss")) {
    notes.push("Lifting days stay. Conditioning from this level is kept in the plan.");
  }
  if (goals.includes("strength")) {
    notes.push("Main lifts stay first, with the heavier rep ranges already written for this level.");
  }
  if (goals.includes("body_building")) {
    notes.push("Accessory moves already in this level are used more often.");
  }
  if (goals.includes("general_fitness")) {
    notes.push("A balanced mix from this level.");
  }
  if (goals.includes("staying_active")) {
    notes.push("The first lifts stay, with a lighter mix of the other moves in this level.");
  }
  return notes.join(" ");
}

export function workoutVariantId(level: WorkoutLevel, goals: WorkoutGoalId[], index: number) {
  const safe = Math.max(0, Math.min(WORKOUT_VARIANT_COUNT - 1, index));
  return `${level}:${[...goals].sort().join("+")}:v${safe}`;
}

export function workoutVariantIndex(variantId: string | null | undefined): number {
  const match = /:v(\d+)$/.exec(String(variantId || ""));
  const n = match ? Number(match[1]) : 0;
  if (!Number.isFinite(n) || n < 0 || n >= WORKOUT_VARIANT_COUNT) return 0;
  return n;
}

export function candidateWorkoutVariantIds(level: WorkoutLevel, goals: WorkoutGoalId[]) {
  return Array.from({ length: WORKOUT_VARIANT_COUNT }, (_, i) => workoutVariantId(level, goals, i));
}

/** Lowest count wins. Ties keep the earlier variant so assignment stays stable. */
export function pickLeastUsedWorkoutVariant(
  level: WorkoutLevel,
  goals: WorkoutGoalId[],
  counts: Record<string, number>,
) {
  const ids = candidateWorkoutVariantIds(level, goals);
  let best = ids[0];
  let bestCount = counts[best] ?? 0;
  for (const id of ids.slice(1)) {
    const count = counts[id] ?? 0;
    if (count < bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

function levelExerciseMap(program: WorkoutProgram) {
  const map = new Map<string, WorkoutExercise>();
  for (const day of program.days) {
    for (const ex of day.exercises) {
      if (!map.has(ex.exerciseKey)) map.set(ex.exerciseKey, ex);
    }
  }
  return map;
}

function poolFor(program: WorkoutProgram, exerciseKey: string): string[] {
  const role = ROLE_BY_KEY.get(exerciseKey);
  if (role == null) return [exerciseKey];
  const known = levelExerciseMap(program);
  const pool = ROLE_POOLS[role].filter((key) => known.has(key));
  return pool.length ? pool : [exerciseKey];
}

function rotate<T>(list: T[], by: number): T[] {
  if (list.length < 2) return list;
  const n = ((by % list.length) + list.length) % list.length;
  return list.slice(n).concat(list.slice(0, n));
}

function replacementKey(
  current: string,
  pool: string[],
  slot: number,
  variantIndex: number,
  goals: WorkoutGoalId[],
  used: Set<string>,
) {
  if (pool.length < 2) return current;
  const set = new Set(goals);
  const strength = set.has("strength");
  const body = set.has("body_building");
  const fat = set.has("fat_loss");
  const activeOnly = set.has("staying_active") && !strength && !body && !fat;
  const generalOnly = set.size === 1 && set.has("general_fitness");

  if (strength && slot === 0) return current;
  if (activeOnly && slot < 2) return current;
  if (generalOnly && (variantIndex === 0 || slot % WORKOUT_VARIANT_COUNT !== variantIndex)) {
    return current;
  }

  let ordered = pool;
  if (body && !strength) ordered = [...pool].reverse();
  else if (fat && !strength) ordered = rotate(pool, 1 + variantIndex);

  const start = (variantIndex + slot) % ordered.length;
  for (let i = 0; i < ordered.length; i++) {
    const key = ordered[(start + i) % ordered.length];
    if (!used.has(key)) return key;
  }
  return current;
}

/**
 * Same week shape and day ids. Only swaps a move for another move already in this level,
 * so videos, labels, and staff day extras still line up.
 */
export function personalizeWorkoutProgram(
  program: WorkoutProgram,
  goals: WorkoutGoalId[],
  variantIndex: number,
): WorkoutProgram {
  if (!goals.length) return program;
  const known = levelExerciseMap(program);
  const index = workoutVariantIndex(workoutVariantId(program.level, goals, variantIndex));
  return {
    ...program,
    days: program.days.map((day) => {
      if (day.restDay || day.exercises.length === 0) return day;
      const used = new Set<string>();
      const exercises = day.exercises.map((ex, slot) => {
        const pool = poolFor(program, ex.exerciseKey);
        const nextKey = replacementKey(ex.exerciseKey, pool, slot, index, goals, used);
        used.add(nextKey);
        if (nextKey === ex.exerciseKey) return ex;
        const src = known.get(nextKey);
        return src ? { ...src } : ex;
      });
      return { ...day, exercises };
    }),
  };
}

export function standardWorkoutProgram(level: WorkoutLevel) {
  return getWorkoutProgram(level);
}
