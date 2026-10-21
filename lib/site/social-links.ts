export type SocialQrTarget = {
  id: "instagram" | "facebook";
  label: string;
  url: string;
};

/** A real profile link. A bare instagram.com or facebook.com home page is not a profile. */
export function usableProfileUrl(raw: string | undefined, host: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== host && hostname !== `m.${host}`) return null;
  const path = url.pathname.replace(/\/+$/, "");
  const hasProfile = (path.length > 0 && path !== "/") || url.search.length > 1;
  if (!hasProfile) return null;
  return url.toString();
}

export function socialQrTargets(
  socials: Record<string, string> | null | undefined,
): SocialQrTarget[] {
  const instagram = usableProfileUrl(socials?.instagram, "instagram.com");
  const facebook = usableProfileUrl(socials?.facebook, "facebook.com");
  return [
    instagram ? { id: "instagram" as const, label: "Instagram", url: instagram } : null,
    facebook ? { id: "facebook" as const, label: "Facebook", url: facebook } : null,
  ].filter((item): item is SocialQrTarget => Boolean(item));
}
