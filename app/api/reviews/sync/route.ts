import { NextResponse } from "next/server";
import { createAnonServerClient } from "@/lib/supabase/server";
import { GYM_ID } from "@/lib/config";
import { getAdminSession } from "@/lib/auth/session";
import { syncGoogleReviewsCache } from "@/lib/reviews/sync";
import type { ReviewCache } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.REVIEWS_SYNC_SECRET?.trim();
  const header = request.headers.get("x-reviews-sync-secret");
  const admin = await getAdminSession();
  const authorized = Boolean(admin) || (secret && header === secret);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GOOGLE_PLACES_API_KEY is not set. Add it in Railway to enable live Google sync.",
      },
      { status: 400 },
    );
  }

  const supabase = createAnonServerClient();
  const { data } = await supabase
    .from("website_reviews_cache")
    .select("*")
    .eq("gym_id", GYM_ID)
    .maybeSingle();

  const synced = await syncGoogleReviewsCache(
    (data as (ReviewCache & { updated_at?: string }) | null) ?? null,
  );

  if (!synced) {
    return NextResponse.json(
      { ok: false, error: "Could not fetch Google reviews. Check Place ID / API key." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, reviews: synced });
}
