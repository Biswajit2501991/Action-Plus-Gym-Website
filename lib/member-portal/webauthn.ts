/**
 * WebAuthn RP settings for Action Plus Gym member portal.
 * Use apex rpId so both actionplusgym.com and www.actionplusgym.com work
 * (including Android Chrome).
 */

export function webauthnRpID() {
  const fromEnv = String(process.env.MEMBER_PORTAL_WEBAUTHN_RP_ID || "")
    .trim()
    .toLowerCase();
  if (fromEnv) return fromEnv.replace(/^www\./, "");

  const host = String(process.env.NEXT_PUBLIC_SITE_URL || "https://actionplusgym.com")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase();
  // Apex registrable domain — works on apex + www.
  return (host || "actionplusgym.com").replace(/^www\./, "") || "actionplusgym.com";
}

export function webauthnExpectedOrigins(): string | string[] {
  const extras = String(process.env.MEMBER_PORTAL_WEBAUTHN_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const site = String(process.env.NEXT_PUBLIC_SITE_URL || "https://actionplusgym.com")
    .trim()
    .replace(/\/$/, "");

  const set = new Set<string>([
    "https://actionplusgym.com",
    "https://www.actionplusgym.com",
    site,
    ...extras,
  ]);

  if (process.env.NODE_ENV !== "production") {
    set.add("http://localhost:3000");
    set.add("http://localhost:3001");
    set.add("http://127.0.0.1:3000");
    set.add("http://127.0.0.1:3001");
  }

  const list = [...set].filter(Boolean);
  return list.length === 1 ? list[0]! : list;
}

export function webauthnCookieSecure() {
  return process.env.NODE_ENV === "production";
}
