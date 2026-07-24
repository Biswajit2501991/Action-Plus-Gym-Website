export type PtDayMark = "pt" | "nt" | null;

export type PtCalendarCell =
  | { kind: "pad"; key: string }
  | {
      kind: "day";
      day: number;
      key: string;
      isSunday: boolean;
      hasFocus: boolean;
      /** Note-only day (no PT schedule / logged workout). */
      hasNote: boolean;
      /** Display mark: PT takes precedence over NT. */
      mark: PtDayMark;
      focus: string;
    };

/** Parse YYYY-MM-DD into calendar parts (matches Gym Manager focusByDate keys). */
export function parsePtDateKey(dateKey: string | Date | null | undefined): {
  year: number;
  monthIndex: number;
  day: number;
} | null {
  if (!dateKey) return null;
  if (typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateKey)) {
    const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return { year: y, monthIndex: m - 1, day: d };
  }
  const dt = dateKey instanceof Date ? dateKey : new Date(dateKey);
  if (Number.isNaN(dt.getTime())) return null;
  return { year: dt.getFullYear(), monthIndex: dt.getMonth(), day: dt.getDate() };
}

export function ptDateKeyFromParts(year: number, monthIndex: number, day: number) {
  const dt = new Date(year, monthIndex, day);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Sun-first month grid for member portal PT calendar.
 * @param focusByDate PT / logged workout days
 * @param notesByDate days with member/staff notes (NT when not also PT)
 */
export function buildPtMonthCalendarCells(
  year: number,
  monthIndex: number,
  focusByDate: Record<string, string> = {},
  notesByDate: Record<string, string | boolean> = {},
): PtCalendarCell[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingPad = new Date(year, monthIndex, 1).getDay();
  const cells: PtCalendarCell[] = [];

  for (let i = 0; i < leadingPad; i += 1) {
    cells.push({ kind: "pad", key: `pad-start-${year}-${monthIndex}-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = ptDateKeyFromParts(year, monthIndex, day);
    const isSunday = new Date(year, monthIndex, day).getDay() === 0;
    const focus = String(focusByDate[key] || "").trim();
    const hasFocus = Boolean(focus);
    const noteRaw = notesByDate[key];
    const hasNoteText =
      typeof noteRaw === "string"
        ? Boolean(noteRaw.trim())
        : Boolean(noteRaw);
    const hasNote = hasNoteText && !hasFocus;
    const mark: PtDayMark = hasFocus ? "pt" : hasNote ? "nt" : null;
    cells.push({
      kind: "day",
      day,
      key,
      isSunday,
      hasFocus,
      hasNote,
      mark,
      focus,
    });
  }

  return cells;
}

export const PT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const PT_MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
