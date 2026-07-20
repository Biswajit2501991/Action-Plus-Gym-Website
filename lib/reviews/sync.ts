import { GYM_ID } from "@/lib/config";
import { createServerClient } from "@/lib/supabase/server";
import type { ReviewCache } from "@/lib/types";
import {
  DEFAULT_GOOGLE_REVIEWS_URL,
  fetchGooglePlaceReviews,
  mergeTopReviews,
} from "@/lib/reviews/google-places";

const STALE_MS = Number(process.env.GOOGLE_REVIEWS_CACHE_MS || 6 * 60 * 60 * 1000);

type ReviewsRow = ReviewCache & {
  updated_at?: string | null;
};

function isStale(updatedAt?: string | null) {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > STALE_MS;
}

export async function syncGoogleReviewsCache(
  existing?: ReviewsRow | null,
): Promise<ReviewCache | null> {
  const live = await fetchGooglePlaceReviews();
  if (!live) return existing ?? null;

  const merged: ReviewCache = {
    overall_rating: live.overall_rating || existing?.overall_rating || 0,
    total_reviews: live.total_reviews || existing?.total_reviews || 0,
    google_url:
      live.google_url ||
      existing?.google_url ||
      DEFAULT_GOOGLE_REVIEWS_URL,
    reviews: mergeTopReviews(live.reviews, existing?.reviews || [], 10),
  };

  try {
    const supabase = createServerClient();
    await supabase.from("website_reviews_cache").upsert(
      {
        gym_id: GYM_ID,
        overall_rating: merged.overall_rating,
        total_reviews: merged.total_reviews,
        google_url: merged.google_url,
        reviews: merged.reviews,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gym_id" },
    );

    await supabase
      .from("website_settings")
      .update({ google_reviews_url: merged.google_url })
      .eq("gym_id", GYM_ID);
  } catch (error) {
    console.error("Failed to persist Google reviews cache", error);
  }

  return merged;
}

/**
 * Serve cached reviews immediately. Never block the page on Google Places —
 * a slow/failed Places call was timing out SSR and showing error.tsx.
 */
export async function ensureFreshReviews(
  existing?: ReviewsRow | null,
): Promise<ReviewCache | null> {
  try {
    if (!process.env.GOOGLE_PLACES_API_KEY?.trim()) {
      return existing ?? null;
    }
    if (existing && !isStale(existing.updated_at)) {
      return existing;
    }
    // Background refresh only — homepage must not wait on Google.
    void syncGoogleReviewsCache(existing).catch((error) => {
      console.error("background Google reviews sync failed", error);
    });
    return existing ?? null;
  } catch (error) {
    console.error("ensureFreshReviews failed", error);
    return existing ?? null;
  }
}
