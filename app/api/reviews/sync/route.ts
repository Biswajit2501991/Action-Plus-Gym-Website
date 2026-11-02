import { NextResponse } from "next/server";
import { createAnonServerClient } from "@/lib/supabase/server";
import { GYM_ID } from "@/lib/config";
import { getAdminSession, isOwnerRole } from "@/lib/auth/session";
import { isProductionRuntime } from "@/lib/member-portal/config";
import { safeEqualHex } from "@/lib/member-portal/crypto";
import { syncGoogleReviewsCache } from "@/lib/reviews/sync";
import type { ReviewCache } from "@/lib/types";

export const dynamic = "force-dynamic";

const MIN_REVIEWS_SECRET_LEN = 16;

export async function POST(request: Request) {
  const secret = String(process.env.REVIEWS_SYNC_SECRET || "").trim();
  if (isProductionRuntime() && secret.length < MIN_REVIEWS_SECRET_LEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "REVIEWS_SYNC_SECRET must be set (16+ characters) in production.",
      },
      { status: 503 },
    );
  }

  const header = String(request.headers.get("x-reviews-sync-secret") || "").trim();
  const headerOk = Boolean(secret && header && safeEqualHex(secret, header));
  const admin = await getAdminSession();
  const ownerOk = Boolean(admin && isOwnerRole(admin.staff_role));
  if (!headerOk && !ownerOk) {
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
