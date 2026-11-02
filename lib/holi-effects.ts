export type HoliPalette = "festival" | "neon" | "sunset";
export type HoliBlastMode = "open" | "short" | "grand";

export const HOLI_BLAST_EVENT = "apg-holi-blast";
export const HOLI_PAUSE_EVENT = "apg-holi-pause";
export const HOLI_PALETTE_EVENT = "apg-holi-palette";

export const HOLI_PALETTES: Record<HoliPalette, string[]> = {
  festival: ["#FF1A92", "#18E5F1", "#FFE252", "#8B46FF", "#FF8A1F"],
  neon: ["#DFFF4E", "#18E5F1", "#8B46FF", "#FF1A92"],
  sunset: ["#FF8A1F", "#FFE252", "#FF1A92", "#FF4DC4"],
};

export function launchHoliBlast(mode: HoliBlastMode = "short") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HOLI_BLAST_EVENT, { detail: { mode } }));
}

export function setHoliEffectsPaused(paused: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HOLI_PAUSE_EVENT, { detail: { paused } }));
}

export function setHoliPalette(palette: HoliPalette) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HOLI_PALETTE_EVENT, { detail: { palette } }));
}
