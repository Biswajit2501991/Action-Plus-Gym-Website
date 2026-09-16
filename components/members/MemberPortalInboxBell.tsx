"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronLeft, X } from "lucide-react";

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

/**
 * Top-right gym broadcast inbox (separate from billing Alerts tile).
 */
export function MemberPortalInboxBell({ memberUuid }: { memberUuid: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PortalInboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState<PortalInboxItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);
  openRef.current = open;

  const refresh = useCallback(async () => {
    if (!memberUuid) return;
    try {
      const data = await inboxFetch<ListResponse>("/api/member/notifications/inbox");
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Math.max(0, Number(data.unreadCount) || 0));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications");
    }
  }, [memberUuid]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!memberUuid) return;
    if (shouldOpenInboxFromUrl()) {
      setOpen(true);
      clearInboxQueryParam();
      void refresh();
    }
  }, [memberUuid, refresh]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (!data || data.type !== "apg-open-inbox") return;
      setOpen(true);
      setSelected(null);
      clearInboxQueryParam();
      void refresh();
    };
    navigator.serviceWorker?.addEventListener?.("message", onMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener?.("message", onMessage);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = panelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
        setSelected(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSelected(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPanel = () => {
    setOpen(true);
    setSelected(null);
    void refresh();
  };

  const openItem = async (item: PortalInboxItem) => {
    setSelected(item);
    if (item.readAt) return;
    try {
      await inboxFetch("/api/member/notifications/inbox/read", {
        method: "POST",
        body: JSON.stringify({ id: item.id }),
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, readAt: row.readAt || new Date().toISOString() }
            : row,
        ),
      );
      setUnreadCount((n) => Math.max(0, n - 1));
      setSelected((cur) =>
        cur && cur.id === item.id
          ? { ...cur, readAt: cur.readAt || new Date().toISOString() }
          : cur,
      );
    } catch {
      /* keep unread; list still usable */
    }
  };

  const clearAll = async () => {
    if (!items.length) return;
    if (!confirm("Clear all notifications from your inbox?")) return;
    setBusy(true);
    try {
      await inboxFetch("/api/member/notifications/inbox/clear", { method: "POST" });
      setItems([]);
      setUnreadCount(0);
      setSelected(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  };

  const badgeLabel =
    unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : "";

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => (openRef.current ? (setOpen(false), setSelected(null)) : openPanel())}
        className="relative rounded-full border border-white/15 p-2.5 text-white/70 hover:border-gold/40 hover:text-gold"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
      >
        <Bell size={18} />
        {badgeLabel ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-black">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-white/15 bg-[#121212]/95 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
            {selected ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-gold"
                onClick={() => setSelected(null)}
              >
                <ChevronLeft size={14} />
                Back
              </button>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                Notifications
              </p>
            )}
            <div className="flex items-center gap-2">
              {!selected && items.length > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void clearAll()}
                  className="text-[11px] text-white/55 hover:text-gold disabled:opacity-50"
                >
                  Clear all
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full p-1 text-white/50 hover:text-white"
                aria-label="Close notifications"
                onClick={() => {
                  setOpen(false);
                  setSelected(null);
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {error ? (
            <p className="px-3 py-2 text-xs text-red-300/90">{error}</p>
          ) : null}

          {selected ? (
            <div className="max-h-[min(70vh,24rem)] space-y-3 overflow-y-auto px-3 py-3">
              <p className="font-display text-lg text-white">{selected.title}</p>
              <p className="text-[11px] text-muted">{formatWhen(selected.createdAt)}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                {selected.body}
              </p>
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No gym notifications yet.
            </p>
          ) : (
            <ul className="max-h-[min(70vh,24rem)] divide-y divide-white/10 overflow-y-auto">
              {items.map((item) => {
                const unread = !item.readAt;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openItem(item)}
                      className="flex w-full flex-col gap-0.5 px-3 py-3 text-left hover:bg-white/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={
                            unread
                              ? "text-sm font-medium text-white"
                              : "text-sm text-white/75"
                          }
                        >
                          {item.title}
                        </span>
                        {unread ? (
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <span className="line-clamp-2 text-xs text-white/55">{item.body}</span>
                      <span className="text-[10px] text-muted">
                        {formatWhen(item.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-white/10 px-3 py-2 text-[10px] text-muted">
            Messages auto-remove after 7 days.
          </p>
        </div>
      ) : null}
    </div>
  );
}
