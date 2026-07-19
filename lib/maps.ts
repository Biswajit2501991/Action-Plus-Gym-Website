/**
 * Pull a Google Maps embed URL out of a raw paste:
 * - plain embed URL
 * - src="https://www.google.com/maps/embed?..."
 * - full <iframe>...</iframe> HTML
 */
export function normalizeGoogleMapsEmbedUrl(input: string | null | undefined): string {
  let value = String(input || "").trim();
  if (!value) return "";

  const iframeSrc = value.match(
    /src\s*=\s*["'](https?:\/\/[^"']+)["']/i,
  );
  if (iframeSrc?.[1]) {
    value = iframeSrc[1].trim();
  } else {
    // Pasted: src="https://..." width="400" ... (no surrounding iframe tag)
    const loose = value.match(
      /(?:^|\s)(?:src\s*=\s*)?["']?(https?:\/\/www\.google\.com\/maps\/embed\?[^"'>\s]+)["']?/i,
    );
    if (loose?.[1]) value = loose[1].trim();
  }

  // Strip accidental wrapping quotes
  value = value.replace(/^["']+|["']+$/g, "").trim();

  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes("google.") && host !== "maps.google.com") return "";
    if (u.pathname.includes("/maps/embed") || u.searchParams.get("output") === "embed") {
      return u.toString();
    }
    return "";
  } catch {
    return "";
  }
}

/** Only Google Maps *embed* URLs can load in an iframe. Search/reviews pages will fail. */
export function isGoogleMapsEmbedUrl(url: string | null | undefined) {
  return Boolean(normalizeGoogleMapsEmbedUrl(url));
}
