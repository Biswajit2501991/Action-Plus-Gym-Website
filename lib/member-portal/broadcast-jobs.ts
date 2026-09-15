/**
 * Scheduled owner Web Push broadcast jobs.
 * Additive — does not touch billing-cron or members write paths.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clampBroadcastBody,
  clampBroadcastTitle,
  listBroadcastRecipientUuids,
  recentOwnerBroadcastAt,
  runOwnerBroadcast,
  OWNER_BROADCAST_COOLDOWN_MS,
} from "@/lib/member-portal/owner-broadcast";

export const BROADCAST_JOBS_TABLE = "member_portal_push_broadcast_jobs";
export const BROADCAST_DUE_BATCH = 5;

export type BroadcastJobRow = {
  id: string;
  gym_id: string;
  title: string;
  body: string;
  url: string;
  scheduled_at: string;
  status: string;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  recipients_at_send: number | null;
  result_json: Record<string, unknown> | null;
  error: string | null;
};

export function jobToApi(row: BroadcastJobRow) {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    body: String(row.body || ""),
    url: String(row.url || "/members"),
    scheduledAt: row.scheduled_at,
    status: String(row.status || ""),
    createdBy: row.created_by,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    recipientsAtSend: row.recipients_at_send,
    result: row.result_json,
    error: row.error,
  };
}

export async function listBroadcastJobs(
  svc: SupabaseClient,
  gymId: string,
  limit = 40,
): Promise<ReturnType<typeof jobToApi>[]> {
  const take = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const { data, error } = await svc
    .from(BROADCAST_JOBS_TABLE)
    .select("*")
    .eq("gym_id", gymId)
    .order("scheduled_at", { ascending: true })
    .limit(take);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => jobToApi(r as BroadcastJobRow));
}

export async function createBroadcastJob(
  svc: SupabaseClient,
  opts: {
    gymId: string;
    title: string;
    body: string;
    url?: string;
    scheduledAt: string;
    createdBy?: string | null;
  },
): Promise<ReturnType<typeof jobToApi>> {
  const title = clampBroadcastTitle(opts.title);
  const body = clampBroadcastBody(opts.body);
  if (!title || !body) {
    throw Object.assign(new Error("title-and-body-required"), {
      status: 400,
      code: "title-and-body-required",
    });
  }
  const scheduled = new Date(opts.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) {
    throw Object.assign(new Error("Invalid schedule date/time."), {
      status: 400,
      code: "invalid-scheduled-at",
    });
  }
  if (scheduled.getTime() <= Date.now() + 30_000) {
    throw Object.assign(new Error("Schedule time must be at least 30 seconds in the future."), {
      status: 400,
      code: "scheduled-at-not-future",
    });
  }

  const insert = {
    gym_id: opts.gymId,
    title,
    body,
    url: String(opts.url || "/members").trim().slice(0, 200) || "/members",
    scheduled_at: scheduled.toISOString(),
    status: "pending",
    created_by: opts.createdBy ? String(opts.createdBy).slice(0, 120) : null,
  };

  const { data, error } = await svc
    .from(BROADCAST_JOBS_TABLE)
    .insert(insert)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("job-create-failed");
  return jobToApi(data as BroadcastJobRow);
}

export async function cancelBroadcastJob(
  svc: SupabaseClient,
  gymId: string,
  jobId: string,
): Promise<ReturnType<typeof jobToApi>> {
  const id = String(jobId || "").trim();
  if (!id) {
    throw Object.assign(new Error("job-id-required"), { status: 400, code: "job-id-required" });
  }

  const { data: existing, error: findErr } = await svc
    .from(BROADCAST_JOBS_TABLE)
    .select("*")
    .eq("gym_id", gymId)
    .eq("id", id)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!existing) {
    throw Object.assign(new Error("Job not found."), { status: 404, code: "job-not-found" });
  }
  if (String((existing as BroadcastJobRow).status) !== "pending") {
    throw Object.assign(new Error("Only pending jobs can be cancelled."), {
      status: 409,
      code: "job-not-pending",
    });
  }

  const now = new Date().toISOString();
  const { data, error } = await svc
    .from(BROADCAST_JOBS_TABLE)
    .update({ status: "cancelled", finished_at: now })
    .eq("gym_id", gymId)
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw Object.assign(new Error("Job was already claimed or cancelled."), {
      status: 409,
      code: "job-race",
    });
  }
  return jobToApi(data as BroadcastJobRow);
}

/**
 * Claim and send due jobs for one gym. Cooldown → requeue as pending.
 */
export async function processDueBroadcastJobs(
  svc: SupabaseClient,
  gymId: string,
  limit = BROADCAST_DUE_BATCH,
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  deferredCooldown: number;
  jobs: Array<ReturnType<typeof jobToApi>>;
}> {
  const take = Math.min(Math.max(Number(limit) || BROADCAST_DUE_BATCH, 1), 10);
  const nowIso = new Date().toISOString();

  const { data: due, error: dueErr } = await svc
    .from(BROADCAST_JOBS_TABLE)
    .select("*")
    .eq("gym_id", gymId)
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(take);
  if (dueErr) throw new Error(dueErr.message);

  let sent = 0;
  let failed = 0;
  let deferredCooldown = 0;
  const out: Array<ReturnType<typeof jobToApi>> = [];

  for (const raw of due || []) {
    const row = raw as BroadcastJobRow;

    // Idempotent claim
    const { data: claimed, error: claimErr } = await svc
      .from(BROADCAST_JOBS_TABLE)
      .update({ status: "running", started_at: nowIso, error: null })
      .eq("gym_id", gymId)
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) continue; // another worker took it

    // Refresh count before send (same rules as Refresh count)
    let recipientsAtSend = 0;
    try {
      const recipients = await listBroadcastRecipientUuids(svc, gymId);
      recipientsAtSend = recipients.length;
    } catch {
      recipientsAtSend = 0;
    }

    // Cooldown: put back to pending for next tick
    const recent = await recentOwnerBroadcastAt(svc, gymId);
    if (recent) {
      deferredCooldown += 1;
      const { data: deferred } = await svc
        .from(BROADCAST_JOBS_TABLE)
        .update({
          status: "pending",
          started_at: null,
          recipients_at_send: recipientsAtSend,
          error: `Deferred: wait ${Math.ceil(
            Math.max(0, OWNER_BROADCAST_COOLDOWN_MS - (Date.now() - recent.getTime())) / 1000,
          )}s cooldown`,
        })
        .eq("id", row.id)
        .eq("status", "running")
        .select("*")
        .maybeSingle();
      if (deferred) out.push(jobToApi(deferred as BroadcastJobRow));
      continue;
    }

    try {
      const result = await runOwnerBroadcast(svc, {
        gymId,
        title: row.title,
        body: row.body,
        url: row.url || "/members",
      });
      const finished = new Date().toISOString();
      const { data: done } = await svc
        .from(BROADCAST_JOBS_TABLE)
        .update({
          status: "sent",
          finished_at: finished,
          recipients_at_send: result.recipients,
          result_json: result,
          error: null,
        })
        .eq("id", row.id)
        .eq("status", "running")
        .select("*")
        .maybeSingle();
      sent += 1;
      if (done) out.push(jobToApi(done as BroadcastJobRow));
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code || "")
          : "";
      if (code === "broadcast-cooldown") {
        deferredCooldown += 1;
        const { data: deferred } = await svc
          .from(BROADCAST_JOBS_TABLE)
          .update({
            status: "pending",
            started_at: null,
            recipients_at_send: recipientsAtSend,
            error: err instanceof Error ? err.message : "cooldown",
          })
          .eq("id", row.id)
          .eq("status", "running")
          .select("*")
          .maybeSingle();
        if (deferred) out.push(jobToApi(deferred as BroadcastJobRow));
        continue;
      }
      failed += 1;
      const { data: failedRow } = await svc
        .from(BROADCAST_JOBS_TABLE)
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          recipients_at_send: recipientsAtSend,
          error: err instanceof Error ? err.message : "send-failed",
        })
        .eq("id", row.id)
        .eq("status", "running")
        .select("*")
        .maybeSingle();
      if (failedRow) out.push(jobToApi(failedRow as BroadcastJobRow));
    }
  }

  return {
    processed: out.length,
    sent,
    failed,
    deferredCooldown,
    jobs: out,
  };
}
