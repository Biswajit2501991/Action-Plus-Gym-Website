/** Homepage blocks an owner can reorder. Hero, popup, and footer stay fixed. */
export const MOVABLE_SECTIONS = [
  { key: "stats", label: "Statistics" },
  { key: "transformations", label: "Transformation Journey" },
  { key: "pricing", label: "Pricing" },
  { key: "trainers", label: "Trainers" },
  { key: "services", label: "Services" },
  { key: "gallery", label: "Gallery" },
  { key: "videos", label: "Videos" },
  { key: "testimonials", label: "Testimonials" },
  { key: "hours", label: "Opening Hours" },
  { key: "reviews", label: "Google Reviews" },
  { key: "contact", label: "Contact form" },
] as const;

export const DEFAULT_SECTION_ORDER = MOVABLE_SECTIONS.map((section) => section.key);

const MOVABLE = new Set<string>(DEFAULT_SECTION_ORDER);

export const SECTION_NAV: Record<string, { href: string; label: string }> = {
  services: { href: "#services", label: "Services" },
  pricing: { href: "#pricing", label: "Pricing" },
  trainers: { href: "#trainers", label: "Trainers" },
  transformations: { href: "#transformations", label: "Transformations" },
  gallery: { href: "#gallery", label: "Gallery" },
  reviews: { href: "#reviews", label: "Reviews" },
};

export function sectionLabel(key: string) {
  return MOVABLE_SECTIONS.find((section) => section.key === key)?.label ?? key;
}

export function buildSectionOrder(
  rows: { section_key: string; sort_order?: number | null }[] | null | undefined,
) {
  const ranked = [...(rows ?? [])]
    .filter((row) => MOVABLE.has(row.section_key))
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.section_key.localeCompare(b.section_key),
    );

  const order: string[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.section_key)) continue;
    seen.add(row.section_key);
    order.push(row.section_key);
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) order.push(key);
  }
  return order;
}
