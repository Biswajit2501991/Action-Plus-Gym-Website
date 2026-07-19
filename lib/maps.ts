/** Only Google Maps *embed* URLs can load in an iframe. Search/reviews pages will fail. */
export function isGoogleMapsEmbedUrl(url: string | null | undefined) {
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes("google.") && host !== "maps.google.com") return false;
    if (u.pathname.includes("/maps/embed")) return true;
    if (u.searchParams.get("output") === "embed") return true;
    if (u.pathname.startsWith("/maps/embed")) return true;
    return false;
  } catch {
    return false;
  }
}
