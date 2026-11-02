import { createServiceRoleClient } from "@/lib/supabase/service";

const localHits = new Map<string, number>();

function localBlocked(key: string, windowMs: number) {
  const last = localHits.get(key) ?? 0;
  return Date.now() - last < windowMs;
}

async function remoteLastHit(key: string): Promise<number> {
  const svc = createServiceRoleClient();
  if (!svc.ok) return 0;
  try {
    const { data, error } = await svc.client
      .from("website_rate_hits")
      .select("last_hit_at")
      .eq("rate_key", key)
      .maybeSingle();
    if (error || !data?.last_hit_at) return 0;
    const t = Date.parse(String(data.last_hit_at));
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

async function persistHit(key: string, at: number) {
  localHits.set(key, at);
  const svc = createServiceRoleClient();
  if (!svc.ok) return;
  try {
    await svc.client.from("website_rate_hits").upsert(
      { rate_key: key, last_hit_at: new Date(at).toISOString() },
      { onConflict: "rate_key" },
    );
  } catch {
    /* local map still throttles this replica */
  }
}

/** True when this key may proceed. Does not record a hit. */
export async function isRateLimited(key: string, windowMs: number) {
  if (localBlocked(key, windowMs)) return true;
  const remote = await remoteLastHit(key);
  if (remote && Date.now() - remote < windowMs) {
    localHits.set(key, remote);
    return true;
  }
  return false;
}

/** Record a successful consume (after a save, or at check time for leads). */
export async function markRateLimited(key: string) {
  await persistHit(key, Date.now());
}

/**
 * Lead-style: if the window is open, record now and allow; otherwise block.
 * Keeps the in-memory map as the first line so one replica still throttles.
 */
export async function consumeRateLimit(key: string, windowMs = 60_000) {
  if (await isRateLimited(key, windowMs)) return false;
  await markRateLimited(key);
  return true;
}
