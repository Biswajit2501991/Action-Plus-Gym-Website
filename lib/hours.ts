import type { OpeningHour } from "@/lib/types";

function parseTimeToMinutes(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function getOpenStatus(
  hours: OpeningHour[],
  timezone = "Asia/Kolkata",
) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = map[weekday] ?? now.getDay();
  const current = hour * 60 + minute;
  const today = hours.find((h) => h.day_of_week === day && !h.is_hidden);

  if (!today || today.is_closed || !today.open_time || !today.close_time) {
    return { isOpen: false, label: "Closed Now" };
  }

  const open = parseTimeToMinutes(today.open_time);
  const close = parseTimeToMinutes(today.close_time);
  const isOpen = current >= open && current < close;
  return { isOpen, label: isOpen ? "Open Now" : "Closed Now" };
}
