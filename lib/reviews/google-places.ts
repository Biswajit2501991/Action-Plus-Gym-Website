import type { ReviewCache } from "@/lib/types";

export type GoogleReviewItem = ReviewCache["reviews"][number];

const DEFAULT_QUERY =
  process.env.GOOGLE_PLACE_QUERY ||
  "Action Plus Gym and Fitness Club Adra West Bengal";

export const DEFAULT_GOOGLE_REVIEWS_URL =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL ||
  "https://www.google.com/search?q=Action+Plus+Gym+and+Fitness+Club+Reviews";

type PlacesReview = {
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string };
  relativePublishTimeDescription?: string;
};

type PlaceDetails = {
  id?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesReview[];
};

function normalizeReviews(reviews: PlacesReview[] | undefined): GoogleReviewItem[] {
  return (reviews || [])
    .map((r) => ({
      author: r.authorAttribution?.displayName?.trim() || "Google reviewer",
      rating: Math.max(1, Math.min(5, Math.round(r.rating || 5))),
      text: (r.text?.text || "").trim(),
      relative_time: r.relativePublishTimeDescription || "",
    }))
    .filter((r) => r.text.length > 0);
}

export function mergeTopReviews(
  live: GoogleReviewItem[],
  cached: GoogleReviewItem[],
  max = 10,
): GoogleReviewItem[] {
  const seen = new Set<string>();
  const out: GoogleReviewItem[] = [];
  for (const review of [...live, ...cached]) {
    const key = `${review.author.toLowerCase()}::${review.text.slice(0, 48).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(review);
    if (out.length >= max) break;
  }
  return out;
}

async function resolvePlaceId(apiKey: string): Promise<string | null> {
  const configured = process.env.GOOGLE_PLACE_ID?.trim();
  if (configured) return configured;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: DEFAULT_QUERY,
      maxResultCount: 1,
      languageCode: "en",
      regionCode: "IN",
    }),
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { places?: Array<{ id?: string }> };
  return data.places?.[0]?.id || null;
}

export async function fetchGooglePlaceReviews(): Promise<ReviewCache | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return null;

  const placeId = await resolvePlaceId(apiKey);
  if (!placeId) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,rating,userRatingCount,googleMapsUri,reviews,displayName",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error("Google Places details failed", res.status, await res.text());
    return null;
  }

  const place = (await res.json()) as PlaceDetails;
  const reviews = normalizeReviews(place.reviews);

  return {
    overall_rating: Number(place.rating?.toFixed?.(1) ?? place.rating ?? 0),
    total_reviews: place.userRatingCount || reviews.length,
    google_url: place.googleMapsUri || DEFAULT_GOOGLE_REVIEWS_URL,
    reviews,
  };
}
