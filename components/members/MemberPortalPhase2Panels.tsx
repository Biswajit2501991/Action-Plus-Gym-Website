"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import {
  buildPtMonthCalendarCells,
  parsePtDateKey,
  PT_MONTH_LABELS,
  PT_WEEKDAYS,
} from "@/lib/member-portal/pt-calendar";
import { PortalBackButton } from "@/components/members/PortalBackButton";

type Payment = {
  id: string;
  paidAt: string | null;
  amount: number;
  method: string | null;
  paidMonth: string | null;
};

type Attendance = {
  id: string;
  checked_in_at: string;
  source: string;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
    ok?: boolean;
  };
  if (!res.ok || (data as { ok?: boolean }).ok === false) {
    const msg =
      (data as { message?: string }).message ||
      (data as { error?: string }).error ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function webAuthnErrorMessage(err: unknown) {
  if (!(err instanceof Error)) return "Biometric failed";
  const name = "name" in err ? String((err as DOMException).name || "") : "";
  if (name === "NotAllowedError") {
    return "Biometric was cancelled or not available. Unlock with Face ID / fingerprint and try again.";
  }
  if (name === "InvalidStateError") {
    return "This device already has a passkey. Try Login with biometric.";
  }
  if (name === "NotSupportedError") {
    return "This browser does not support Face ID / fingerprint. Use Chrome or Safari on a phone with biometrics.";
  }
  if (name === "SecurityError") {
    return "Biometric blocked for this site. Open https://actionplusgym.com and try again.";
  }
  return err.message || "Biometric failed";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PaymentsPanel({
  onBack,
  liveTick = 0,
}: {
  onBack: () => void;
  liveTick?: number;
}) {
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ ok: true; items: Payment[] }>("/api/member/payments");
        if (!cancelled) {
          setItems(data.items || []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load payments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveTick]);

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Recent payments</h2>
      <p className="mt-1 text-sm text-muted">Last 3 payments from the gym ledger.</p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-muted">Loading…</p> : null}
      <ul className="mt-4 space-y-3">
        {items.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3"
          >
            <div>
              <p className="text-white">₹{Number(p.amount || 0).toFixed(0)}</p>
              <p className="text-xs text-muted">
                {formatDate(p.paidAt)} · {p.method || "—"} · {p.paidMonth || "—"}
              </p>
            </div>
            <a
              href={`/api/member/payments/${encodeURIComponent(p.id)}/receipt`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-gold hover:underline"
            >
              Receipt
            </a>
          </li>
        ))}
        {!loading && !items.length ? (
          <li className="text-sm text-muted">No payments yet.</li>
        ) : null}
      </ul>
    </section>
  );
}

export function AttendancePanel({
  onBack,
  deviceId,
  liveTick = 0,
}: {
  onBack: () => void;
  deviceId: string;
  liveTick?: number;
}) {
  const [items, setItems] = useState<Attendance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const load = useCallback(async () => {
    const data = await api<{ ok: true; items: Attendance[] }>(
      `/api/member/attendance?month=${encodeURIComponent(month)}`,
    );
    setItems(data.items || []);
  }, [month]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [load, liveTick]);

  async function checkIn() {
    setBusy(true);
    setError(null);
    try {
      const presenceTicket = token.trim();
      if (!presenceTicket) throw new Error("Paste the gym QR claim token or code");
      await api("/api/member/attendance", {
        method: "POST",
        body: JSON.stringify({ presenceTicket, deviceId }),
      });
      setToken("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  const days = new Set(
    items.map((i) => new Date(i.checked_in_at).toISOString().slice(0, 10)),
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Attendance</h2>
      <p className="mt-1 text-sm text-muted">
        Scan the gym QR (or paste claim token) to check in. Staff can also scan your member QR.
      </p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 space-y-2">
        <input
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
          placeholder="Paste gym QR token / claim code"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void checkIn()}
          className="w-full rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Checking in…" : "Check in with gym QR"}
        </button>
      </div>
      <p className="mt-5 text-xs uppercase tracking-wide text-muted">This month · {days.size} days</p>
      <ul className="mt-2 max-h-64 space-y-2 overflow-auto">
        {items.map((i) => (
          <li key={i.id} className="text-sm text-white/85">
            {new Date(i.checked_in_at).toLocaleString("en-IN")} · {i.source}
          </li>
        ))}
        {!items.length ? <li className="text-sm text-muted">No check-ins yet.</li> : null}
      </ul>
    </section>
  );
}

export function NotificationsPanel({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Web Push is not supported in this browser.");
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notification permission denied.");

      const reg = await navigator.serviceWorker.register("/sw-member-portal.js");
      await navigator.serviceWorker.ready;

      const vapid = await api<{ ok: true; publicKey: string }>("/api/member/push/vapid");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const json = sub.toJSON();
      await api("/api/member/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      setStatus("Billing-day reminders enabled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable push");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Billing reminders</h2>
      <p className="mt-1 text-sm text-muted">
        Allow browser notifications once. On your billing day the gym app can remind you automatically.
      </p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {status ? <p className="mt-3 text-sm text-gold">{status}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void enable()}
        className="mt-4 w-full rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? "Enabling…" : "Enable billing-day push"}
      </button>
    </section>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function ChatPanel({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<
    Array<{ id: string; sender: string; body: string; staff_name?: string; created_at: string }>
  >([]);
  const [retentionDays, setRetentionDays] = useState(7);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{
      ok: true;
      messages: Array<{
        id: string;
        sender: string;
        body: string;
        staff_name?: string;
        created_at: string;
      }>;
      retentionDays?: number;
    }>("/api/member/chat");
    setMessages(data.messages || []);
    if (typeof data.retentionDays === "number" && data.retentionDays > 0) {
      setRetentionDays(data.retentionDays);
    }
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    const id = window.setInterval(() => void load().catch(() => null), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/member/chat", {
        method: "POST",
        body: JSON.stringify({ body: text.trim() }),
      });
      setText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Chat with gym</h2>
      <p className="mt-2 text-xs text-amber-200/90">
        Chat will be erased after {retentionDays} day{retentionDays === 1 ? "" : "s"}.
      </p>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 max-h-72 space-y-2 overflow-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl px-3 py-2 text-sm ${
              m.sender === "member" ? "bg-gold/15 text-white ml-6" : "bg-white/5 text-white/90 mr-6"
            }`}
          >
            <p>{m.body}</p>
            <p className="mt-1 text-[10px] text-muted">
              {m.sender === "staff" ? m.staff_name || "Staff" : "You"} ·{" "}
              {new Date(m.created_at).toLocaleString("en-IN")}
            </p>
          </div>
        ))}
        {!messages.length ? <p className="text-sm text-muted">Say hello to the gym team.</p> : null}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="rounded-full gold-gradient px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
}

export function TrainingPanel({
  onBack,
  liveTick = 0,
}: {
  onBack: () => void;
  liveTick?: number;
}) {
  const [data, setData] = useState<{
    pt: Array<Record<string, unknown>>;
    workouts: Array<Record<string, unknown>>;
    diets: Array<Record<string, unknown>>;
    measurements: Array<Record<string, unknown>>;
    focusByDate?: Record<string, string>;
    today?: string;
    ptWorkoutNotes?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const todayParts = useMemo(() => {
    const key = data?.today || new Date().toISOString().slice(0, 10);
    return parsePtDateKey(key) || {
      year: new Date().getFullYear(),
      monthIndex: new Date().getMonth(),
      day: new Date().getDate(),
    };
  }, [data?.today]);

  const [viewYear, setViewYear] = useState(todayParts.year);
  const [viewMonthIndex, setViewMonthIndex] = useState(todayParts.monthIndex);

  useEffect(() => {
    let cancelled = false;
    api<{
      ok: true;
      pt: Array<Record<string, unknown>>;
      workouts: Array<Record<string, unknown>>;
      diets: Array<Record<string, unknown>>;
      measurements: Array<Record<string, unknown>>;
      focusByDate?: Record<string, string>;
      today?: string;
      ptWorkoutNotes?: string;
    }>("/api/member/training")
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const parts = parsePtDateKey(res.today);
        if (parts) {
          setViewYear(parts.year);
          setViewMonthIndex(parts.monthIndex);
          setSelectedDayKey((prev) => prev || res.today || null);
        }
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [liveTick]);

  const focusByDate = useMemo(
    () => data?.focusByDate || {},
    [data?.focusByDate],
  );
  const monthCells = useMemo(
    () => buildPtMonthCalendarCells(viewYear, viewMonthIndex, focusByDate),
    [viewYear, viewMonthIndex, focusByDate],
  );
  const ptDaysThisMonth = monthCells.filter(
    (c) => c.kind === "day" && !c.isSunday && c.hasFocus,
  ).length;
  const selectedFocus =
    selectedDayKey && focusByDate[selectedDayKey]
      ? String(focusByDate[selectedDayKey])
      : "";

  function shiftMonth(delta: number) {
    const dt = new Date(viewYear, viewMonthIndex + delta, 1);
    setViewYear(dt.getFullYear());
    setViewMonthIndex(dt.getMonth());
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5 space-y-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="font-display text-2xl text-white">Training</h2>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Block title="PT" empty="No PT assignment yet.">
        {(data?.pt || []).map((p) => {
          const trainer = String(p.trainer_name || "Trainer");
          const plan = p.plan_name ? String(p.plan_name) : "";
          const used = Number(p.sessions_used);
          const total = Number(p.sessions_total);
          const hasPackage =
            Number.isFinite(used) && Number.isFinite(total) && total > 0;
          const scheduled = Number(p.scheduled_days);
          return (
            <div key={String(p.id)} className="space-y-1 text-sm text-white/85">
              <p>
                <span className="text-muted">Trainer</span> · {trainer}
                {plan ? (
                  <>
                    {" "}
                    · <span className="text-muted">Plan</span> · {plan}
                  </>
                ) : null}
              </p>
              {hasPackage ? (
                <p className="text-xs text-muted">
                  Package sessions: {used}/{total}
                </p>
              ) : null}
              {Number.isFinite(scheduled) && scheduled > 0 ? (
                <p className="text-xs text-muted">
                  {scheduled} workout day{scheduled === 1 ? "" : "s"} scheduled
                </p>
              ) : null}
            </div>
          );
        })}
      </Block>
      <Block title="Workouts" empty="No workout plan assigned.">
        {(data?.workouts || []).map((w) => (
          <p key={String(w.id)} className="text-sm text-white/85 whitespace-pre-wrap">
            {String(w.title)}
          </p>
        ))}
      </Block>
      <Block title="Diet" empty="No diet plan assigned.">
        {(data?.diets || []).map((d) => (
          <p key={String(d.id)} className="text-sm text-white/85 whitespace-pre-wrap">
            {String(d.title)}
          </p>
        ))}
      </Block>
      <Block title="Measurements" empty="No measurements yet.">
        {(data?.measurements || []).map((m) => (
          <p key={String(m.id)} className="text-sm text-white/85">
            {formatDate(String(m.measured_at))} ·{" "}
            {m.weight_kg != null ? `${m.weight_kg} kg` : "—"}
            {m.body_fat_pct != null ? ` · ${m.body_fat_pct}% bf` : ""}
          </p>
        ))}
      </Block>

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3">
        <button
          type="button"
          onClick={() => setCalendarOpen((v) => !v)}
          className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
          aria-expanded={calendarOpen}
        >
          <div>
            <p className="text-sm font-semibold text-white">Workout Scheduler & Calendar</p>
            {!calendarOpen ? (
              <p className="mt-0.5 text-xs text-emerald-200/80">
                Expand for read-only view of your PT workout days
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>
              Total PT days this month:{" "}
              <span className="font-semibold text-white">{ptDaysThisMonth}</span>
            </span>
            <span className="font-semibold text-gold">{calendarOpen ? "Hide" : "Show"}</span>
          </div>
        </button>

        {calendarOpen ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/85"
                >
                  ← Prev month
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/85"
                >
                  Next month →
                </button>
              </div>
              <p className="text-sm font-semibold text-white">
                {PT_MONTH_LABELS[viewMonthIndex]} {viewYear}
              </p>
            </div>
            <p className="text-[11px] text-muted">
              View only — your trainer sets the schedule in Gym Manager. Green = scheduled · Rose =
              open. Tap a day to see the focus.
            </p>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted sm:gap-2 sm:text-xs">
              {PT_WEEKDAYS.map((d) => (
                <div key={d} className="font-semibold">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {monthCells.map((entry) =>
                entry.kind === "pad" ? (
                  <div
                    key={entry.key}
                    className="min-h-11 rounded-lg border border-transparent px-1 py-1.5 sm:min-h-12"
                    aria-hidden
                  />
                ) : (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setSelectedDayKey(entry.key)}
                    className={[
                      "min-h-11 rounded-lg border px-1 py-1.5 text-[10px] sm:min-h-12 sm:text-xs",
                      entry.isSunday
                        ? "border-white/10 bg-white/5 text-muted"
                        : entry.hasFocus
                          ? "border-emerald-400/50 bg-emerald-950/40 text-emerald-200"
                          : "border-rose-400/40 bg-rose-950/35 text-rose-200",
                      selectedDayKey === entry.key ? "ring-2 ring-sky-400" : "",
                    ].join(" ")}
                    title={
                      entry.focus
                        ? `${entry.key}: ${entry.focus}`
                        : `${entry.key}: No focus assigned`
                    }
                  >
                    <div className="font-semibold">{entry.day}</div>
                    <div className="mt-0.5 truncate">
                      {entry.focus || (entry.isSunday ? "Sun" : "—")}
                    </div>
                  </button>
                ),
              )}
            </div>
            {selectedDayKey ? (
              <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85">
                <span className="text-muted">{selectedDayKey}</span>
                {" · "}
                {selectedFocus || "No workout focus assigned"}
              </p>
            ) : null}
            {data?.ptWorkoutNotes ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">PT Workout Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/85">
                  {data.ptWorkoutNotes}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Block({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const list = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-2 space-y-1">
        {list.length ? list : <p className="text-sm text-muted">{empty}</p>}
      </div>
    </div>
  );
}

export function BookingsPanel({
  onBack,
  liveTick = 0,
}: {
  onBack: () => void;
  liveTick?: number;
}) {
  const [slots, setSlots] = useState<
    Array<{ id: string; title: string; starts_at: string; capacity: number }>
  >([]);
  const [mine, setMine] = useState<Array<{ slot_id: string; status: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<{
      ok: true;
      slots: Array<{ id: string; title: string; starts_at: string; capacity: number }>;
      myBookings: Array<{ slot_id: string; status: string }>;
    }>("/api/member/bookings");
    setSlots(data.slots || []);
    setMine(data.myBookings || []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [load, liveTick]);

  async function book(slotId: string) {
    setBusy(slotId);
    setError(null);
    try {
      await api("/api/member/bookings", {
        method: "POST",
        body: JSON.stringify({ slotId }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(null);
    }
  }

  const booked = new Set(mine.map((m) => m.slot_id));

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Bookings</h2>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {slots.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3"
          >
            <div>
              <p className="text-white">{s.title}</p>
              <p className="text-xs text-muted">
                {new Date(s.starts_at).toLocaleString("en-IN")} · cap {s.capacity}
              </p>
            </div>
            <button
              type="button"
              disabled={busy === s.id || booked.has(s.id)}
              onClick={() => void book(s.id)}
              className="rounded-full border border-gold/40 px-3 py-1.5 text-xs text-gold disabled:opacity-40"
            >
              {booked.has(s.id) ? "Booked" : busy === s.id ? "…" : "Book"}
            </button>
          </li>
        ))}
        {!slots.length ? (
          <li className="text-sm text-muted">No upcoming classes yet. Ask the gym to publish slots.</li>
        ) : null}
      </ul>
    </section>
  );
}

export function PerksPanel({
  onBack,
  liveTick = 0,
}: {
  onBack: () => void;
  liveTick?: number;
}) {
  const [data, setData] = useState<{
    locker: { locker_code: string; status: string } | null;
    referral: { code: string; points: number } | null;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{
      ok: true;
      locker: { locker_code: string; status: string } | null;
      referral: { code: string; points: number } | null;
    }>("/api/member/perks")
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [liveTick]);

  async function requestLocker() {
    try {
      const res = await api<{ ok: true; message?: string }>("/api/member/perks", {
        method: "POST",
        body: JSON.stringify({ note: "Please assign a locker" }),
      });
      setMsg(res.message || "Request sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5 space-y-4">
      <PortalBackButton onClick={onBack} />
      <h2 className="font-display text-2xl text-white">Lockers & referrals</h2>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {msg ? <p className="text-sm text-gold">{msg}</p> : null}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Locker</p>
        {data?.locker ? (
          <p className="mt-1 text-white">
            {data.locker.locker_code} · {data.locker.status}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void requestLocker()}
            className="mt-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold"
          >
            Request locker
          </button>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Your referral code</p>
        <p className="mt-1 font-mono text-lg text-gold">{data?.referral?.code || "—"}</p>
        <p className="text-sm text-muted">{data?.referral?.points ?? 0} points</p>
      </div>
    </section>
  );
}

export function BiometricPanel({
  onBack,
  mobile,
  deviceId,
  onLoggedIn,
}: {
  onBack: () => void;
  mobile: string;
  deviceId: string;
  onLoggedIn: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function registerPasskey() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error(
          "This browser does not support Face ID / fingerprint. On Android use Chrome; on iPhone use Safari.",
        );
      }
      if (
        typeof window !== "undefined" &&
        window.PublicKeyCredential &&
        "isUserVerifyingPlatformAuthenticatorAvailable" in PublicKeyCredential
      ) {
        const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!ok) {
          throw new Error(
            "No Face ID / fingerprint sensor available on this device, or biometrics are turned off in phone settings.",
          );
        }
      }
      const opt = await api<{ ok: true; options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>(
        "/api/member/auth/webauthn/register",
      );
      const att = await startRegistration({ optionsJSON: opt.options });
      await api("/api/member/auth/webauthn/register", {
        method: "POST",
        body: JSON.stringify(att),
      });
      setStatus("Face ID / fingerprint saved for this device.");
    } catch (e) {
      setError(webAuthnErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function loginPasskey() {
    setBusy(true);
    setError(null);
    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error(
          "This browser does not support Face ID / fingerprint. On Android use Chrome; on iPhone use Safari.",
        );
      }
      const opt = await api<{
        ok: true;
        options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
      }>("/api/member/auth/webauthn/login", {
        method: "POST",
        body: JSON.stringify({ action: "options", mobile, deviceId }),
      });
      const assertion = await startAuthentication({ optionsJSON: opt.options });
      await api("/api/member/auth/webauthn/login", {
        method: "POST",
        body: JSON.stringify({
          action: "verify",
          assertion,
          mobile,
          deviceId,
        }),
      });
      onLoggedIn();
    } catch (e) {
      setError(webAuthnErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5 space-y-3">
      <PortalBackButton onClick={onBack} />
      <h2 className="font-display text-2xl text-white">Face ID / fingerprint</h2>
      <p className="text-sm text-muted">
        Works on iPhone (Safari) and Android (Chrome) with screen lock biometrics.
        Register while signed in, then use Login with biometric next time.
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {status ? <p className="text-sm text-gold">{status}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void registerPasskey()}
        className="w-full rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        Register biometric
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void loginPasskey()}
        className="w-full rounded-full border border-white/15 px-5 py-3 text-sm text-white disabled:opacity-50"
      >
        Login with biometric
      </button>
    </section>
  );
}
