/** Client-only helpers for portal chat unread + instant cache (no DB writes). */

export type CachedChatMessage = {
  id: string;
  sender: string;
  body: string;
  staff_name?: string;
  created_at: string;
};

function seenKey(memberUuid: string) {
  return `apg_portal_chat_seen_ms_${memberUuid}`;
}

function seenStaffIdKey(memberUuid: string) {
  return `apg_portal_chat_seen_staff_${memberUuid}`;
}

function cacheKey(memberUuid: string) {
  return `apg_portal_chat_cache_${memberUuid}`;
}

function toMs(input: string | number | null | undefined): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const raw = String(input).trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  // Normalize "2026-07-22 11:47:06+00" → ISO so Date.parse is reliable
  const normalized = raw.includes("T")
    ? raw
    : raw.replace(" ", "T").replace(/\+00$/, "Z").replace(/(\.\d+)?\+00:00$/, "Z");
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

export function readChatSeenMs(memberUuid: string): number | null {
  if (typeof window === "undefined" || !memberUuid) return null;
  try {
    const fromLs = localStorage.getItem(seenKey(memberUuid));
    if (fromLs) return toMs(fromLs);
    // Legacy key (ISO / postgres string)
    const legacy = localStorage.getItem(`apg_portal_chat_seen_${memberUuid}`);
    if (legacy) return toMs(legacy);
    const safeId = memberUuid.replace(/[^a-zA-Z0-9_-]/g, "");
    const match = document.cookie.match(
      new RegExp(`(?:^|; )apg_chat_seen_${safeId}=([^;]*)`),
    );
    if (match) return toMs(decodeURIComponent(match[1]));
  } catch {
    /* ignore */
  }
  return null;
}

export function readSeenStaffMessageId(memberUuid: string): string | null {
  if (typeof window === "undefined" || !memberUuid) return null;
  try {
    return localStorage.getItem(seenStaffIdKey(memberUuid));
  } catch {
    return null;
  }
}

/** Mark chat as read. Prefer epoch ms for reliable compare across DB/ISO formats. */
export function markChatSeen(
  memberUuid: string,
  isoOrMs?: string | number,
  latestStaffId?: string | null,
) {
  if (typeof window === "undefined" || !memberUuid) return;
  const ms = toMs(isoOrMs ?? Date.now()) ?? Date.now();
  const value = String(ms);
  try {
    localStorage.setItem(seenKey(memberUuid), value);
    if (latestStaffId) {
      localStorage.setItem(seenStaffIdKey(memberUuid), latestStaffId);
    }
  } catch {
    /* ignore quota */
  }
  try {
    const safeId = memberUuid.replace(/[^a-zA-Z0-9_-]/g, "");
    const maxAge = 60 * 60 * 24 * 180;
    document.cookie = `apg_chat_seen_${safeId}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function hasUnreadStaffChat(
  memberUuid: string,
  latestStaffAt: string | null | undefined,
  latestStaffId?: string | null,
): boolean {
  if (!latestStaffAt && !latestStaffId) return false;

  if (latestStaffId) {
    const seenId = readSeenStaffMessageId(memberUuid);
    if (seenId && seenId === latestStaffId) return false;
  }

  const latestMs = toMs(latestStaffAt);
  if (latestMs == null) {
    // Staff message id present but not yet marked seen
    return Boolean(latestStaffId);
  }

  const seenMs = readChatSeenMs(memberUuid);
  if (seenMs == null) return true;
  return latestMs > seenMs;
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
