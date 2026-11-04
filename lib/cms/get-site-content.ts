import { cache } from "react";
import { unstable_cache } from "next/cache";
import { GYM_ID } from "@/lib/config";
import { createAnonServerClient } from "@/lib/supabase/server";
import { fallbackContent } from "@/lib/cms/fallback";
import { buildSectionOrder } from "@/lib/cms/section-order";
import { ensureFreshReviews } from "@/lib/reviews/sync";
import type {
  GalleryImage,
  HeroSlide,
  OpeningHour,
  PopupOffer,
  PricingPlan,
  ReviewCache,
  ServiceItem,
  SiteContent,
  StatItem,
  Testimonial,
  Trainer,
  Transformation,
  VideoItem,
  WebsiteSettings,
  GalleryAlbum,
} from "@/lib/types";

export const SITE_CONTENT_CACHE_TAG = "site-content";

function safeHttpsUrl(value: unknown) {
  const url = String(value ?? "").trim();
  if (url.length > 2000 || !/^https:\/\/\S+$/i.test(url)) return "";
  return url;
}

function mapTransformations(rows: unknown): Transformation[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Transformation;
    const before = safeHttpsUrl(item.before_photo_url);
    const after = safeHttpsUrl(item.after_photo_url);
    const name = String(item.member_name ?? "").trim().slice(0, 80);
    if (!name || (!before && !after)) return [];
    return [
      {
        ...item,
        member_name: name,
        before_photo_url: before,
        after_photo_url: after,
        photo_message: String(item.photo_message ?? "").trim().slice(0, 200),
        message: String(item.message ?? "").trim().slice(0, 1000),
        trained_under: String(item.trained_under ?? "").trim().slice(0, 80),
      },
    ];
  });
}

async function loadSiteContentFromDb(): Promise<SiteContent> {
  try {
    const supabase = createAnonServerClient();
    const gymId = GYM_ID;

    const [
      settingsRes,
      sectionsRes,
      popupRes,
      slidesRes,
      statsRes,
      servicesRes,
      pricingRes,
      trainersRes,
      albumsRes,
      galleryRes,
      videosRes,
      testimonialsRes,
      transformationsRes,
      hoursRes,
      reviewsRes,
    ] = await Promise.all([
      supabase.from("website_settings").select("*").eq("gym_id", gymId).maybeSingle(),
      supabase
        .from("website_sections")
        .select("section_key, enabled, sort_order")
        .eq("gym_id", gymId),
      supabase
        .from("website_popup_offers")
        .select("*")
        .eq("gym_id", gymId)
        .maybeSingle(),
      supabase
        .from("website_hero_slides")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_stats")
        .select("*")
        .eq("gym_id", gymId)
        .order("sort_order"),
      supabase
        .from("website_services")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_pricing_plans")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_trainers")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_gallery_albums")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_gallery_images")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_videos")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_testimonials")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_transformations")
        .select(
          "id, member_name, before_photo_url, after_photo_url, photo_message, message, trained_under, sort_order, is_active",
        )
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("website_opening_hours")
        .select("*")
        .eq("gym_id", gymId)
        .order("day_of_week"),
      supabase
        .from("website_reviews_cache")
        .select("*")
        .eq("gym_id", gymId)
        .maybeSingle(),
    ]);

    if (settingsRes.error || !settingsRes.data) {
      return fallbackContent;
    }

    const sections: Record<string, boolean> = {
      ...fallbackContent.sections,
    };
    for (const row of sectionsRes.data ?? []) {
      sections[row.section_key] = row.enabled;
    }
    const sectionOrder = sectionsRes.error
      ? fallbackContent.sectionOrder
      : buildSectionOrder(sectionsRes.data);

    const pricing = (pricingRes.data ?? []).map((p) => {
      let features: string[] = [];
      try {
        features = Array.isArray(p.features)
          ? p.features.map(String)
          : typeof p.features === "string"
            ? (JSON.parse(p.features) as unknown[]).map(String)
            : [];
      } catch {
        features = [];
      }
      return { ...p, features };
    }) as PricingPlan[];

    let reviews: ReviewCache | null = null;
    try {
      reviews = await ensureFreshReviews(
        (reviewsRes.data as (ReviewCache & { updated_at?: string }) | null) ??
          null,
      );
    } catch (error) {
      console.error("ensureFreshReviews failed", error);
      reviews =
        (reviewsRes.data as ReviewCache | null) ?? fallbackContent.reviews;
    }

    if (reviews) {
      reviews = {
        overall_rating: Number(reviews.overall_rating) || 0,
        total_reviews: Number(reviews.total_reviews) || 0,
        google_url: reviews.google_url || "",
        reviews: Array.isArray(reviews.reviews) ? reviews.reviews : [],
      };
    }

    if (transformationsRes.error) {
      console.error("website_transformations", transformationsRes.error.message);
    }

    return {
      settings: settingsRes.data as WebsiteSettings,
      sections,
      sectionOrder,
      popup: (popupRes.data as PopupOffer) ?? null,
      heroSlides: ((slidesRes.data as HeroSlide[]) ?? []).filter(
        (s) => Boolean(s?.image_url),
      ),
      stats: (statsRes.data as StatItem[]) ?? [],
      services: (servicesRes.data as ServiceItem[]) ?? [],
      pricing,
      trainers: (trainersRes.data as Trainer[]) ?? [],
      albums: (albumsRes.data as GalleryAlbum[]) ?? [],
      gallery: ((galleryRes.data as GalleryImage[]) ?? []).filter((g) =>
        Boolean(g?.image_url),
      ),
      videos: (videosRes.data as VideoItem[]) ?? [],
      testimonials: (testimonialsRes.data as Testimonial[]) ?? [],
      transformations: transformationsRes.error
        ? []
        : mapTransformations(transformationsRes.data),
      hours: (hoursRes.data as OpeningHour[]) ?? [],
      reviews,
    };
  } catch (error) {
    console.error("getSiteContent failed", error);
    return fallbackContent;
  }
}

const loadSiteContentCached = unstable_cache(loadSiteContentFromDb, ["site-content", GYM_ID], {
  revalidate: 60,
  tags: [SITE_CONTENT_CACHE_TAG],
});

/** One CMS fetch per request; 60s shared cache. Owner saves revalidate the tag. */
export const getSiteContent = cache(() => loadSiteContentCached());
