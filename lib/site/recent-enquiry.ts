import { GYM_ID } from "@/lib/config";
import { normalizeMobile } from "@/lib/member-portal/phone";
import { createServerClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;

function sameText(a: string, b: string) {
  const left = a.trim().toLowerCase().replace(/\s+/g, " ");
  const right = b.trim().toLowerCase().replace(/\s+/g, " ");
  return left.length >= 20 && left === right;
}

/**
 * True when this mobile, or this same message, was already saved in the last 24 hours.
 * Read only. A lookup failure does not block a genuine enquiry.
 */
export async function hasRecentEnquiry(mobile: string, message: string): Promise<boolean> {
  const wanted = normalizeMobile(mobile);
  const note = message.trim();
  const since = new Date(Date.now() - DAY_MS).toISOString();
  try {
    const supabase = createServerClient();
    const [visitors, threads, messages] = await Promise.all([
      supabase
        .from("visitors")
        .select("mobile, notes, added_at")
        .eq("gym_id", GYM_ID)
        .gte("added_at", since)
        .limit(200),
      supabase
        .from("website_bot_threads")
        .select("mobile, created_at")
        .eq("gym_id", GYM_ID)
        .gte("created_at", since)
        .limit(200),
      supabase
        .from("website_bot_messages")
        .select("body, created_at, sender")
        .eq("gym_id", GYM_ID)
        .eq("sender", "customer")
        .gte("created_at", since)
        .limit(200),
    ]);
    if (visitors.error && threads.error && messages.error) return false;

    for (const row of visitors.data || []) {
      if (wanted && normalizeMobile(String(row.mobile || "")) === wanted) return true;
      if (sameText(note, String(row.notes || ""))) return true;
    }
    for (const row of threads.data || []) {
      if (wanted && normalizeMobile(String(row.mobile || "")) === wanted) return true;
    }
    for (const row of messages.data || []) {
      if (sameText(note, String(row.body || ""))) return true;
    }
    return false;
  } catch (err) {
    console.error("recent enquiry check", err);
    return false;
  }
}
