/** Display-only week helpers for Workout Plan (IST Monday–Sunday). */

const IST = "Asia/Kolkata";

export type WeekCompletionRow = {
  dayId: string;
  exercisesDone: string[];
  dayComplete: boolean;
};

export type WeekCompletions = Record<string, WeekCompletionRow>;

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Calendar date string in IST for an absolute instant. */
export function formatIstYmd(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Add days to a YYYY-MM-DD using noon UTC to avoid DST edge noise (IST has none). */
export function addDaysYmd(ymd: string, days: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + days, 12, 0, 0));
  return formatIstYmd(dt);
}

/** Monday (YYYY-MM-DD) of the IST week containing `todayYmd`. */
export function mondayOfIstWeek(todayYmd: string): string {
  const p = parseYmd(todayYmd);
  if (!p) return todayYmd;
  // Use a Date that formats as today in IST, then get weekday in IST.
  const probe = new Date(`${todayYmd}T12:00:00+05:30`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    weekday: "short",
  }).format(probe);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[weekday] ?? 0;
  return addDaysYmd(todayYmd, -offset);
}

export function listYmdRange(startYmd: string, endYmdInclusive: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  for (let i = 0; i < 14; i += 1) {
    out.push(cur);
    if (cur === endYmdInclusive) break;
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

export function weekWindows(todayYmd: string) {
  const thisMon = mondayOfIstWeek(todayYmd);
  const thisSun = addDaysYmd(thisMon, 6);
  const lastMon = addDaysYmd(thisMon, -7);
  const lastSun = addDaysYmd(thisMon, -1);
  return {
    thisWeek: listYmdRange(thisMon, thisSun),
    lastWeek: listYmdRange(lastMon, lastSun),
    thisMon,
    lastMon,
  };
}

/** Day IDs with dayComplete true anywhere in the given week dates. */
export function completedDayIdsInWeek(
  completions: WeekCompletions | null | undefined,
  weekDates: string[],
): Set<string> {
  const out = new Set<string>();
  if (!completions) return out;
  for (const date of weekDates) {
    const row = completions[date];
    if (row?.dayComplete && row.dayId) out.add(row.dayId);
  }
  return out;
}

/** Best completion row for a program day in the current week (prefer today). */
export function weekRowForDay(
  completions: WeekCompletions | null | undefined,
  dayId: string,
  weekDates: string[],
  todayYmd: string,
): WeekCompletionRow | null {
  if (!completions) return null;
  const todayRow = completions[todayYmd];
  if (todayRow?.dayId === dayId) return todayRow;
  for (const date of weekDates) {
    const row = completions[date];
    if (row?.dayId === dayId && row.dayComplete) return row;
  }
  for (const date of weekDates) {
    const row = completions[date];
    if (row?.dayId === dayId) return row;
  }
  return null;
}

export function lastWeekMotivationMessage(input: {
  plannedWorkDays: number;
  completedLastWeek: number;
  /** True if any completion row exists in last week's date range. */
  hadActivityLastWeek: boolean;
}): string | null {
  const planned = Math.max(0, Number(input.plannedWorkDays) || 0);
  if (planned <= 0) return null;
  const done = Math.max(0, Math.min(planned, Number(input.completedLastWeek) || 0));
  const missed = planned - done;

  if (!input.hadActivityLastWeek) {
    return `This week: aim for all ${planned} training day${planned === 1 ? "" : "s"}.`;
  }
  if (missed <= 0) {
    return "All training days done last week — great work. Keep the streak.";
  }
  if (missed === 1) {
    return "You missed 1 day last week — push hard this week.";
  }
  return `You missed ${missed} days last week — push hard this week.`;
}
