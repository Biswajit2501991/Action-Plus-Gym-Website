export type WebsiteSettings = {
  gym_id: string;
  site_name: string;
  tagline: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  map_embed_url: string;
  google_reviews_url: string;
  timezone: string;
  socials: Record<string, string>;
  seo_title: string;
  seo_description: string;
  seo_og_image: string;
  hero_headline: string;
  hero_subheadline: string;
};

export type WebsiteSection = {
  id: number;
  section_key: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

export type PopupOffer = {
  id: number;
  enabled: boolean;
  title: string;
  body: string;
  image_url: string;
  button_text: string;
  button_href: string;
  bg_color: string;
  accent_color: string;
  text_color: string;
  expires_at: string | null;
};

export type HeroSlide = {
  id: number;
  title: string;
  image_url: string;
  video_url: string;
  sort_order: number;
  is_active: boolean;
};

export type StatItem = {
  id: number;
  label: string;
  value: string;
  sort_order: number;
};

export type ServiceItem = {
  id: number;
  title: string;
  description: string;
  icon: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
};

export type PricingPlan = {
  id: number;
  name: string;
  period: string;
  price: string;
  description: string;
  features: string[];
  is_featured: boolean;
  badge: string;
  cta_text: string;
  sort_order: number;
  is_active: boolean;
};

export type Trainer = {
  id: number;
  name: string;
  photo_url: string;
  experience: string;
  specialization: string;
  bio: string;
  socials: Record<string, string>;
  sort_order: number;
  is_active: boolean;
};

export type GalleryImage = {
  id: number;
  album_id: number | null;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_active: boolean;
};

export type GalleryAlbum = {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

export type VideoItem = {
  id: number;
  title: string;
  youtube_url: string;
  mp4_url: string;
  thumbnail_url: string;
  sort_order: number;
  is_active: boolean;
};

export type Testimonial = {
  id: number;
  name: string;
  quote: string;
  rating: number;
  photo_url: string;
  video_url: string;
  sort_order: number;
  is_active: boolean;
};

export type OpeningHour = {
  id: number;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  is_hidden: boolean;
};

export type ReviewCache = {
  overall_rating: number;
  total_reviews: number;
  google_url: string;
  reviews: Array<{
    author: string;
    rating: number;
    text: string;
    relative_time?: string;
  }>;
};

export type WebsiteMedia = {
  id: number;
  gym_id: string;
  file_name: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  file_size: number;
  kind: "image" | "video";
  section_tag: string;
  alt_text: string;
  uploaded_by: string;
  created_at: string;
};

export type SiteContent = {
  settings: WebsiteSettings;
  sections: Record<string, boolean>;
  popup: PopupOffer | null;
  heroSlides: HeroSlide[];
  stats: StatItem[];
  services: ServiceItem[];
  pricing: PricingPlan[];
  trainers: Trainer[];
  albums: GalleryAlbum[];
  gallery: GalleryImage[];
  videos: VideoItem[];
  testimonials: Testimonial[];
  hours: OpeningHour[];
  reviews: ReviewCache | null;
};

export type StaffSession = {
  id: number;
  full_name: string | null;
  staff_login_id: string;
  staff_role: string;
  role_label?: string | null;
  gym_id: string;
  token: string;
};
