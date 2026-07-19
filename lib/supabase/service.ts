import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function cleanEnv(value: string | undefined) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/\s+/g, "");
}

/** Supabase legacy JWT keys have 3 dot-separated parts; new secret keys start with sb_secret_. */
export function getServiceRoleKey() {
  return cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function validateServiceRoleKey(key: string): string | null {
  if (!key) {
    return "Missing SUPABASE_SERVICE_ROLE_KEY in Railway Variables.";
  }
  if (key.startsWith("sb_publishable_") || key.includes('"role":"anon"')) {
    return "You pasted the anon/publishable key. Use the service_role (secret) key instead.";
  }
  if (key.startsWith("sb_secret_")) return null;
  const parts = key.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) {
    return "SUPABASE_SERVICE_ROLE_KEY is invalid (Invalid Compact JWS). Copy the full service_role key from Supabase → Project Settings → API — not the JWT Secret.";
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { role?: string };
    if (payload.role && payload.role !== "service_role") {
      return `Wrong key role (${payload.role}). Use the service_role key.`;
    }
  } catch {
    return "SUPABASE_SERVICE_ROLE_KEY could not be read. Copy it again from Supabase → API.";
  }
  return null;
}

export function createServiceRoleClient():
  | { ok: true; client: SupabaseClient }
  | { ok: false; error: string } {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = getServiceRoleKey();
  const keyError = validateServiceRoleKey(key);
  if (!url) {
    return { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL." };
  }
  if (keyError) {
    return { ok: false, error: keyError };
  }

  return {
    ok: true,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
