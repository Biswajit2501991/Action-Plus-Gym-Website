import { GYM_ID } from "@/lib/config";
import { createAnonServerClient } from "@/lib/supabase/server";
import { fallbackContent } from "@/lib/cms/fallback";
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
  VideoItem,
  WebsiteSettings,
  GalleryAlbum,
} from "@/lib/types";

export async function getSiteContent(): Promise<SiteContent> {
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
      hoursRes,
      reviewsRes,
    ] = await Promise.all([
      supabase.from("website_settings").select("*").eq("gym_id", gymId).maybeSingle(),
      supabase
        .from("website_sections")
        .select("section_key, enabled")
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

    return {
      settings: settingsRes.data as WebsiteSettings,
      sections,
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
      hours: (hoursRes.data as OpeningHour[]) ?? [],
      reviews,
    };
  } catch (error) {
    console.error("getSiteContent failed", error);
    return fallbackContent;
  }
}
