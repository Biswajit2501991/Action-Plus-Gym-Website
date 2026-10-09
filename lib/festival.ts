/** Public-site seasonal skin. Member portal and admin do not use this. */

export const DURGA_PUJA_THEME = "durga_puja";
const IST_OFFSET = "+05:30";

export type FestivalSettings = {
  festival_enabled?: boolean | null;
  festival_theme?: string | null;
  festival_starts_at?: string | null;
  festival_ends_at?: string | null;
};

export function istDatetimeLocalToIso(localValue: string): string {
  const v = String(localValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return "";
  const d = new Date(`${v}:00${IST_OFFSET}`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function isoToIstDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export function formatIst(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Live only inside the saved IST window. Missing dates stay off. */
export function festivalIsLive(settings: FestivalSettings, now = Date.now()): boolean {
  if (!settings.festival_enabled) return false;
  if (settings.festival_theme !== DURGA_PUJA_THEME) return false;
  const start = settings.festival_starts_at
    ? new Date(settings.festival_starts_at).getTime()
    : NaN;
  const end = settings.festival_ends_at ? new Date(settings.festival_ends_at).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return now >= start && now < end;
}

const FESTIVAL_ATTR = "data-festival";
const FESTIVAL_VALUE = "durga-puja";

/** Inline script for the public pages. Safe to call from a server component. */
export function festivalBootScript(live: boolean) {
  return live
    ? `document.documentElement.setAttribute("${FESTIVAL_ATTR}","${FESTIVAL_VALUE}");`
    : `document.documentElement.removeAttribute("${FESTIVAL_ATTR}");`;
}

export function festivalStatusLabel(settings: FestivalSettings, now = Date.now()): string {
  if (!settings.festival_enabled) return "Off. The normal theme is showing.";
  const start = settings.festival_starts_at
    ? new Date(settings.festival_starts_at).getTime()
    : NaN;
  const end = settings.festival_ends_at ? new Date(settings.festival_ends_at).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return "On, but it needs a start and an end in IST before it can show.";
  }
  if (now < start) return `Scheduled. Starts ${formatIst(settings.festival_starts_at)} IST.`;
  if (now >= end) return `Ended ${formatIst(settings.festival_ends_at)} IST. The normal theme is back.`;
  return `Showing until ${formatIst(settings.festival_ends_at)} IST.`;
}
