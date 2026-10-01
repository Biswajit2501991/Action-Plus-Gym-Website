import { PANEL_SOFT_TTL_MS, peekTshirtCache, writeTshirtCache } from "@/lib/member-portal/panel-cache";
import type { TshirtSizeId } from "@/lib/member-portal/tshirt-size";

export type TshirtPanelState = {
  size: TshirtSizeId | null;
  updates: number;
  locked: boolean;
};

let inflight: Promise<TshirtPanelState | null> | null = null;
let inflightFor = "";

/** Paint from the last result, then refresh. Repeat opens stay instant. */
export function fetchTshirtState(memberUuid: string, force = false): Promise<TshirtPanelState | null> {
  const id = String(memberUuid || "").trim();
  if (!id) return Promise.resolve(null);
  const hit = peekTshirtCache<TshirtPanelState>(id);
  if (!force && hit && hit.ageMs < PANEL_SOFT_TTL_MS) return Promise.resolve(hit.data);
  if (!force && inflight && inflightFor === id) return inflight;
  inflightFor = id;
  inflight = (async () => {
    const res = await fetch("/api/member/tshirt-size", { credentials: "same-origin" });
    const data = (await res.json().catch(() => null)) as
      | (TshirtPanelState & { ok?: boolean })
      | null;
    if (!res.ok || !data?.ok) return hit?.data ?? null;
    const next: TshirtPanelState = {
      size: data.size,
      updates: data.updates,
      locked: data.locked,
    };
    writeTshirtCache(id, next);
    return next;
  })().finally(() => {
    if (inflightFor === id) inflight = null;
  });
  return inflight;
}
