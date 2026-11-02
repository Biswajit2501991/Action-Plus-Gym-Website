export const NY_FIREWORKS_EVENT = "apg-ny-fireworks";
export const NY_PAUSE_EVENT = "apg-ny-pause";

export type NyFireworksMode = "open" | "short" | "grand";

export function launchNyFireworks(mode: NyFireworksMode = "short") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NY_FIREWORKS_EVENT, { detail: { mode } }));
}

export function setNyFireworksPaused(paused: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NY_PAUSE_EVENT, { detail: { paused } }));
}
