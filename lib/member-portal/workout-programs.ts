export type WorkoutLevel = "beginner" | "intermediate" | "advanced";

export type WorkoutExercise = {
  exerciseKey: string;
  name: string;
  muscle: string;
  setsReps: string;
  rest: string;
};

export type WorkoutDay = {
  dayId: string;
  dayNumber: number;
  label: string;
  restDay?: boolean;
  exercises: WorkoutExercise[];
};

export type ProgressionWeek = {
  week: number;
  focus: string;
  setsReps: string;
  rpe: string;
  load: string;
  cardio: string;
};

export type WorkoutProgram = {
  level: WorkoutLevel;
  title: string;
  subtitle: string;
  version: string;
  daysPerWeek: string;
  days: WorkoutDay[];
};

function e(
  exerciseKey: string,
  name: string,
  muscle: string,
  setsReps: string,
  rest: string,
): WorkoutExercise {
  return { exerciseKey, name, muscle, setsReps, rest };
}

export const SHARED_PROGRESSION: ProgressionWeek[] = [
  { week: 1, focus: "Technique", setsReps: "Base prescription", rpe: "6", load: "Choose a comfortable starting load", cardio: "2×15–20 min" },
  { week: 2, focus: "Consistency", setsReps: "Same as W1", rpe: "6–7", load: "Add 1 rep where possible", cardio: "2×20 min" },
  { week: 3, focus: "Volume", setsReps: "Add reps within range", rpe: "7", load: "Small load increase if all reps achieved", cardio: "2×20 min" },
  { week: 4, focus: "Base test", setsReps: "Top of rep range", rpe: "7", load: "Record working weights", cardio: "2×20–25 min" },
  { week: 5, focus: "Overload", setsReps: "Add set where listed", rpe: "7–8", load: "Increase 2.5–5% when ready", cardio: "2×20 min" },
  { week: 6, focus: "Overload", setsReps: "Progress reps", rpe: "7–8", load: "Beat prior week by 1 rep or small load", cardio: "2×20–25 min" },
  { week: 7, focus: "Strength-hypertrophy", setsReps: "Lower rep end", rpe: "8", load: "Small load increase", cardio: "2×20 min" },
  { week: 8, focus: "Volume checkpoint", setsReps: "Top of range", rpe: "8", load: "Record best controlled loads", cardio: "2×25 min" },
  { week: 9, focus: "Intensity", setsReps: "Higher effort", rpe: "8", load: "Add load only with clean form", cardio: "2×20 min" },
  { week: 10, focus: "Intensity", setsReps: "Maintain volume", rpe: "8–9", load: "Progress one variable", cardio: "2×20 min" },
  { week: 11, focus: "Peak week", setsReps: "Hard but controlled", rpe: "8–9", load: "No failed reps", cardio: "2×15–20 min" },
  { week: 12, focus: "Deload", setsReps: "2–3 sets × 8–10", rpe: "6", load: "Reduce load 10–20%", cardio: "2×15–20 min" },
];

export const TRAINER_NOTE =
  "Trainer note: Prioritize technique, appropriate loading and individual modifications. Stop and assess any exercise that causes sharp pain, dizziness or other concerning symptoms.";

export const BEGINNER_PROGRAM: WorkoutProgram = {
  level: "beginner",
  title: "Beginner",
  subtitle: "12 weeks · Full body · 3 days/week",
  version: "beginner-12w.v1",
  daysPerWeek: "3",
  days: [
    {
      dayId: "beginner_d1_full_body_a",
      dayNumber: 1,
      label: "Full Body A",
      exercises: [
        e("goblet_squat", "Goblet Squat", "Quads, glutes", "3×10–12", "60–90s"),
        e("machine_chest_press", "Machine Chest Press", "Chest, triceps", "3×10–12", "60–90s"),
        e("lat_pulldown", "Lat Pulldown", "Lats, biceps", "3×10–12", "60–90s"),
        e("dumbbell_rdl", "Dumbbell Romanian Deadlift", "Hamstrings, glutes", "3×10–12", "90s"),
        e("dumbbell_lateral_raise", "Dumbbell Lateral Raise", "Side delts", "2×12–15", "60s"),
        e("plank", "Plank", "Core", "3×20–40 sec", "45–60s"),
      ],
    },
    {
      dayId: "beginner_d2_full_body_b",
      dayNumber: 2,
      label: "Full Body B",
      exercises: [
        e("leg_press", "Leg Press", "Quads, glutes", "3×10–12", "90s"),
        e("incline_dumbbell_press", "Incline Dumbbell Press", "Upper chest, triceps", "3×10–12", "60–90s"),
        e("seated_cable_row", "Seated Cable Row", "Back, biceps", "3×10–12", "60–90s"),
        e("leg_curl", "Leg Curl", "Hamstrings", "3×12–15", "60–90s"),
        e("dumbbell_curl", "Dumbbell Curl", "Biceps", "2×10–15", "60s"),
        e("dead_bug", "Dead Bug", "Core", "3×8–12/side", "45–60s"),
      ],
    },
    {
      dayId: "beginner_d3_full_body_c",
      dayNumber: 3,
      label: "Full Body C",
      exercises: [
        e("split_squat", "Split Squat", "Quads, glutes", "3×8–12/leg", "90s"),
        e("dumbbell_shoulder_press", "Dumbbell Shoulder Press", "Shoulders, triceps", "3×10–12", "60–90s"),
        e("assisted_pull_up", "Assisted Pull-Up", "Lats, biceps", "3×8–12", "90s"),
        e("hip_thrust", "Hip Thrust", "Glutes", "3×10–12", "90s"),
        e("rope_triceps_pushdown", "Rope Triceps Pushdown", "Triceps", "2×10–15", "60s"),
        e("cable_crunch", "Cable Crunch", "Abs", "3×12–15", "45–60s"),
      ],
    },
  ],
};

export const INTERMEDIATE_PROGRAM: WorkoutProgram = {
  level: "intermediate",
  title: "Intermediate",
  subtitle: "12 weeks · Split · 5 days/week",
  version: "intermediate-12w.v1",
  daysPerWeek: "5",
  days: [
    {
      dayId: "intermediate_d1_chest_triceps",
      dayNumber: 1,
      label: "Chest + Triceps",
      exercises: [
        e("barbell_bench_press", "Barbell Bench Press", "Chest, triceps", "4×6–10", "120s"),
        e("incline_dumbbell_press", "Incline Dumbbell Press", "Upper chest", "3×8–12", "90s"),
        e("cable_fly", "Cable Fly", "Chest", "3×12–15", "60s"),
        e("dips_assisted", "Dips/Assisted Dips", "Chest, triceps", "3×8–12", "90s"),
        e("rope_triceps_pushdown", "Rope Pushdown", "Triceps", "3×10–15", "60s"),
        e("overhead_cable_extension", "Overhead Cable Extension", "Triceps", "2×12–15", "60s"),
      ],
    },
    {
      dayId: "intermediate_d2_back_biceps",
      dayNumber: 2,
      label: "Back + Biceps",
      exercises: [
        e("lat_pulldown", "Lat Pulldown", "Lats, biceps", "4×8–12", "90s"),
        e("barbell_row", "Barbell Row", "Back, lats", "4×6–10", "120s"),
        e("seated_cable_row", "Seated Cable Row", "Mid-back", "3×8–12", "90s"),
        e("straight_arm_pulldown", "Straight-Arm Pulldown", "Lats", "3×12–15", "60s"),
        e("ez_bar_curl", "EZ-Bar Curl", "Biceps", "3×8–12", "60–90s"),
        e("hammer_curl", "Hammer Curl", "Brachialis, biceps", "3×10–12", "60s"),
      ],
    },
    {
      dayId: "intermediate_d3_legs",
      dayNumber: 3,
      label: "Legs",
      exercises: [
        e("back_squat", "Back Squat", "Quads, glutes", "4×6–10", "120–150s"),
        e("romanian_deadlift", "Romanian Deadlift", "Hamstrings, glutes", "3×8–10", "120s"),
        e("leg_press", "Leg Press", "Quads, glutes", "3×10–12", "90s"),
        e("leg_curl", "Leg Curl", "Hamstrings", "3×10–15", "75s"),
        e("leg_extension", "Leg Extension", "Quads", "3×12–15", "60s"),
        e("standing_calf_raise", "Standing Calf Raise", "Calves", "4×12–20", "60s"),
      ],
    },
    {
      dayId: "intermediate_d4_rest",
      dayNumber: 4,
      label: "Rest",
      restDay: true,
      exercises: [],
    },
    {
      dayId: "intermediate_d5_shoulders_abs",
      dayNumber: 5,
      label: "Shoulders + Abs",
      exercises: [
        e("overhead_press", "Overhead Press", "Shoulders, triceps", "4×6–10", "120s"),
        e("dumbbell_lateral_raise", "Lateral Raise", "Side delts", "4×12–15", "60s"),
        e("rear_delt_fly", "Rear Delt Fly", "Rear delts", "3×12–15", "60s"),
        e("face_pull", "Face Pull", "Rear delts, upper back", "3×12–15", "60s"),
        e("cable_crunch", "Cable Crunch", "Abs", "3×12–15", "60s"),
        e("hanging_knee_raise", "Hanging Knee Raise", "Lower abs", "3×10–15", "60s"),
      ],
    },
    {
      dayId: "intermediate_d6_upper",
      dayNumber: 6,
      label: "Upper Body",
      exercises: [
        e("incline_bench_press", "Incline Bench Press", "Upper chest", "3×8–10", "90s"),
        e("pull_up_or_lat_pulldown", "Pull-Up/Lat Pulldown", "Lats", "3×8–12", "90s"),
        e("dumbbell_row", "Dumbbell Row", "Back", "3×8–12", "90s"),
        e("machine_chest_press", "Machine Chest Press", "Chest", "3×10–12", "75s"),
        e("cable_curl", "Cable Curl", "Biceps", "2×10–15", "60s"),
        e("rope_triceps_pushdown", "Triceps Pushdown", "Triceps", "2×10–15", "60s"),
      ],
    },
  ],
};

export const ADVANCED_PROGRAM: WorkoutProgram = {
  level: "advanced",
  title: "Advanced",
  subtitle: "12 weeks · Push / Pull / Legs · 6 days/week",
  version: "advanced-12w.v1",
  daysPerWeek: "6",
  days: [
    {
      dayId: "advanced_d1_push",
      dayNumber: 1,
      label: "Push",
      exercises: [
        e("barbell_bench_press", "Barbell Bench Press", "Chest, triceps", "4×5–8", "150s"),
        e("incline_dumbbell_press", "Incline Dumbbell Press", "Upper chest", "3×8–10", "120s"),
        e("seated_shoulder_press", "Seated Shoulder Press", "Delts, triceps", "3×6–10", "120s"),
        e("cable_fly", "Cable Fly", "Chest", "3×12–15", "60s"),
        e("dumbbell_lateral_raise", "Lateral Raise", "Side delts", "4×12–20", "60s"),
        e("overhead_triceps_extension", "Overhead Triceps Extension", "Triceps", "3×10–15", "60s"),
      ],
    },
    {
      dayId: "advanced_d2_pull",
      dayNumber: 2,
      label: "Pull",
      exercises: [
        e("weighted_pull_up", "Weighted Pull-Up", "Lats, biceps", "4×5–8", "150s"),
        e("barbell_row", "Barbell Row", "Back", "4×6–10", "150s"),
        e("chest_supported_row", "Chest-Supported Row", "Mid-back", "3×8–12", "90s"),
        e("lat_pulldown", "Lat Pulldown", "Lats", "3×10–12", "90s"),
        e("ez_bar_curl", "EZ-Bar Curl", "Biceps", "3×8–12", "75s"),
        e("hammer_curl", "Hammer Curl", "Brachialis", "3×10–15", "60s"),
      ],
    },
    {
      dayId: "advanced_d3_legs",
      dayNumber: 3,
      label: "Legs",
      exercises: [
        e("back_squat", "Back Squat", "Quads, glutes", "4×5–8", "150–180s"),
        e("romanian_deadlift", "Romanian Deadlift", "Hamstrings, glutes", "4×6–10", "150s"),
        e("hack_squat", "Hack Squat", "Quads", "3×8–12", "120s"),
        e("leg_curl", "Leg Curl", "Hamstrings", "3×10–15", "75s"),
        e("leg_extension", "Leg Extension", "Quads", "3×12–15", "60s"),
        e("standing_calf_raise", "Calf Raise", "Calves", "4×12–20", "60s"),
      ],
    },
    {
      dayId: "advanced_d4_push",
      dayNumber: 4,
      label: "Push",
      exercises: [
        e("incline_barbell_press", "Incline Barbell Press", "Upper chest", "4×6–10", "120s"),
        e("machine_chest_press", "Machine Chest Press", "Chest", "3×8–12", "90s"),
        e("arnold_press", "Arnold Press", "Delts", "3×8–12", "90s"),
        e("cable_lateral_raise", "Cable Lateral Raise", "Side delts", "4×12–20", "60s"),
        e("pec_deck", "Pec Deck", "Chest", "3×12–15", "60s"),
        e("rope_triceps_pushdown", "Rope Pushdown", "Triceps", "3×10–15", "60s"),
      ],
    },
    {
      dayId: "advanced_d5_pull",
      dayNumber: 5,
      label: "Pull",
      exercises: [
        e("deadlift_or_trap_bar", "Deadlift/Trap-Bar Deadlift", "Posterior chain", "3×4–6", "180s"),
        e("one_arm_dumbbell_row", "One-Arm Dumbbell Row", "Back", "3×8–12", "90s"),
        e("neutral_grip_pulldown", "Neutral-Grip Pulldown", "Lats", "3×8–12", "90s"),
        e("rear_delt_fly", "Rear Delt Fly", "Rear delts", "3×12–20", "60s"),
        e("preacher_curl", "Preacher Curl", "Biceps", "3×8–12", "75s"),
        e("cable_curl", "Cable Curl", "Biceps", "2×12–15", "60s"),
      ],
    },
    {
      dayId: "advanced_d6_legs_core",
      dayNumber: 6,
      label: "Legs + Core",
      exercises: [
        e("front_squat", "Front Squat", "Quads, core", "3×6–10", "150s"),
        e("hip_thrust", "Hip Thrust", "Glutes", "4×8–12", "120s"),
        e("bulgarian_split_squat", "Bulgarian Split Squat", "Quads, glutes", "3×8–12/leg", "120s"),
        e("seated_leg_curl", "Seated Leg Curl", "Hamstrings", "3×10–15", "75s"),
        e("seated_calf_raise", "Seated Calf Raise", "Calves", "4×12–20", "60s"),
        e("hanging_leg_raise", "Hanging Leg Raise", "Abs", "3×10–15", "60s"),
        e("cable_crunch", "Cable Crunch", "Abs", "3×12–15", "60s"),
      ],
    },
  ],
};

const PROGRAMS: Record<WorkoutLevel, WorkoutProgram> = {
  beginner: BEGINNER_PROGRAM,
  intermediate: INTERMEDIATE_PROGRAM,
  advanced: ADVANCED_PROGRAM,
};

export function getWorkoutProgram(level: string | null | undefined): WorkoutProgram | null {
  const key = String(level || "").trim().toLowerCase();
  if (key === "beginner" || key === "intermediate" || key === "advanced") {
    return PROGRAMS[key];
  }
  return null;
}

export const WORKOUT_LEVELS: Array<{ id: WorkoutLevel; title: string; subtitle: string }> = [
  { id: "beginner", title: BEGINNER_PROGRAM.title, subtitle: BEGINNER_PROGRAM.subtitle },
  { id: "intermediate", title: INTERMEDIATE_PROGRAM.title, subtitle: INTERMEDIATE_PROGRAM.subtitle },
  { id: "advanced", title: ADVANCED_PROGRAM.title, subtitle: ADVANCED_PROGRAM.subtitle },
];

export function restSecondsFromLabel(rest: string) {
  const nums = String(rest || "").match(/\d+/g);
  if (!nums?.length) return 60;
  return Math.max(15, Math.min(300, Number(nums[nums.length - 1])));
}
