/** Client-only helpers for portal chat unread + instant cache (no DB writes). */

export type CachedChatMessage = {
  id: string;
  sender: string;
  body: string;
  staff_name?: string;
  created_at: string;
};

function seenKey(memberUuid: string) {
  return `apg_portal_chat_seen_${memberUuid}`;
}

function cacheKey(memberUuid: string) {
  return `apg_portal_chat_cache_${memberUuid}`;
}

export function readChatSeenAt(memberUuid: string): string | null {
  if (typeof window === "undefined" || !memberUuid) return null;
  try {
    const fromLs = localStorage.getItem(seenKey(memberUuid));
    if (fromLs) return fromLs;
    const match = document.cookie.match(
      new RegExp(`(?:^|; )apg_chat_seen_${memberUuid.replace(/[^a-zA-Z0-9_-]/g, "")}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** Mark chat as read up to `iso` (usually latest message created_at). */
export function markChatSeen(memberUuid: string, iso?: string) {
  if (typeof window === "undefined" || !memberUuid) return;
  const value = iso || new Date().toISOString();
  try {
    localStorage.setItem(seenKey(memberUuid), value);
  } catch {
    /* ignore quota */
  }
  try {
    const safeId = memberUuid.replace(/[^a-zA-Z0-9_-]/g, "");
    const maxAge = 60 * 60 * 24 * 180; // 180 days
    document.cookie = `apg_chat_seen_${safeId}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function hasUnreadStaffChat(
  memberUuid: string,
  latestStaffAt: string | null | undefined,
): boolean {
  if (!latestStaffAt) return false;
  const seen = readChatSeenAt(memberUuid);
  if (!seen) return true;
  return String(latestStaffAt) > String(seen);
}

export function readCachedMessages(memberUuid: string): CachedChatMessage[] | null {
  if (typeof window === "undefined" || !memberUuid) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(memberUuid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { messages?: CachedChatMessage[] };
    return Array.isArray(parsed.messages) ? parsed.messages : null;
  } catch {
    return null;
  }
}

export function writeCachedMessages(memberUuid: string, messages: CachedChatMessage[]) {
  if (typeof window === "undefined" || !memberUuid) return;
  try {
    sessionStorage.setItem(
      cacheKey(memberUuid),
      JSON.stringify({ messages, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}
