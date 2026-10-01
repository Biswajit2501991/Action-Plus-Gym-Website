"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { PortalBackButton } from "@/components/members/PortalBackButton";

export type PortalInboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  readAt: string | null;
  createdAt: string;
  expiresAt: string;
};

type ListResponse = {
  ok?: boolean;
  items?: PortalInboxItem[];
  unreadCount?: number;
  error?: string;
};

const INBOX_CHANGED = "apg-inbox-changed";

function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function inboxFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
    message?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return data;
}

function shouldOpenInboxFromUrl() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("inbox") === "1";
  } catch {
    return false;
  }
}

function clearInboxQueryParam() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("inbox")) return;
    url.searchParams.delete("inbox");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    /* ignore */
  }
}

function notifyInboxChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INBOX_CHANGED));
}

/**
 * Header bell. Opens the full Notifications screen. Separate from the Alerts tile.
 */
export function MemberPortalInboxBell({
  memberUuid,
  onOpen,
}: {
  memberUuid: string;
  onOpen: () => void;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!memberUuid) return;
    try {
      const data = await inboxFetch<ListResponse>("/api/member/notifications/inbox");
      setUnreadCount(Math.max(0, Number(data.unreadCount) || 0));
    } catch {
      /* badge can stay; the screen shows the load error */
    }
  }, [memberUuid]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20_000);
    const onChange = () => void refresh();
    window.addEventListener(INBOX_CHANGED, onChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(INBOX_CHANGED, onChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (!memberUuid) return;
    if (shouldOpenInboxFromUrl()) {
      clearInboxQueryParam();
      onOpen();
    }
  }, [memberUuid, onOpen]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (!data || data.type !== "apg-open-inbox") return;
      clearInboxQueryParam();
      onOpen();
    };
    navigator.serviceWorker?.addEventListener?.("message", onMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener?.("message", onMessage);
    };
  }, [onOpen]);

  const badgeLabel =
    unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative rounded-full border border-white/15 p-2.5 text-white/70 hover:border-gold/40 hover:text-gold"
      aria-label={
        unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
      }
    >
      <Bell size={18} />
      {badgeLabel ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-black">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Full-screen gym message list, then the same message view as before.
 */
export function MemberPortalInboxScreen({
  memberUuid,
  onBack,
}: {
  memberUuid: string;
  onBack: () => void;
}) {
  const [items, setItems] = useState<PortalInboxItem[]>([]);
  const [selected, setSelected] = useState<PortalInboxItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!memberUuid) return;
    try {
      const data = await inboxFetch<ListResponse>("/api/member/notifications/inbox");
      const next = Array.isArray(data.items) ? data.items : [];
      setItems(next);
      setSelected((cur) => (cur ? next.find((row) => row.id === cur.id) || null : null));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, [memberUuid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openItem = async (item: PortalInboxItem) => {
    setSelected(item);
    if (item.readAt) return;
    try {
      await inboxFetch("/api/member/notifications/inbox/read", {
        method: "POST",
        body: JSON.stringify({ id: item.id }),
      });
      const readAt = new Date().toISOString();
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, readAt: row.readAt || readAt } : row)),
      );
      setSelected((cur) =>
        cur && cur.id === item.id ? { ...cur, readAt: cur.readAt || readAt } : cur,
      );
      notifyInboxChanged();
    } catch {
      /* keep unread; the message is still open */
    }
  };

  const clearAll = async () => {
    if (!items.length) return;
    if (!confirm("Clear all notifications from your inbox?")) return;
    setBusy(true);
    try {
      await inboxFetch("/api/member/notifications/inbox/clear", { method: "POST" });
      setItems([]);
      setSelected(null);
      setError(null);
      notifyInboxChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  };

  if (selected) {
    return (
      <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
        <PortalBackButton onClick={() => setSelected(null)} />
        <h2 className="mt-3 font-display text-2xl text-white">{selected.title}</h2>
        <p className="mt-1 text-sm text-muted">{formatWhen(selected.createdAt)}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
          {selected.body}
        </p>
        <p className="mt-6 text-xs text-muted">Messages auto-remove after 7 days.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <div className="flex items-center justify-between gap-2">
        <PortalBackButton onClick={onBack} />
        {items.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clearAll()}
            className="text-sm text-white/55 hover:text-gold disabled:opacity-50"
          >
            Clear all
          </button>
        ) : null}
      </div>
      <h2 className="mt-3 font-display text-2xl text-white">Notifications</h2>
      <p className="mt-1 text-sm text-muted">Messages from the gym.</p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {loading && !items.length ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : null}
      {!loading && !items.length && !error ? (
        <p className="mt-6 text-center text-sm text-muted">No gym notifications yet.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-4 divide-y divide-white/10">
          {items.map((item) => {
            const unread = !item.readAt;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openItem(item)}
                  className="flex w-full flex-col gap-1 py-3.5 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={
                        unread ? "text-base font-medium text-white" : "text-base text-white/75"
                      }
                    >
                      {item.title}
                    </span>
                    {unread ? (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden />
                    ) : null}
                  </div>
                  <span className="line-clamp-2 text-sm text-white/55">{item.body}</span>
                  <span className="text-xs text-muted">{formatWhen(item.createdAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-muted">Messages auto-remove after 7 days.</p>
    </section>
  );
}
