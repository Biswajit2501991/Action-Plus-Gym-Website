"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  markChatSeen,
  readCachedMessages,
  writeCachedMessages,
} from "@/lib/member-portal/chat-client";
import {
  peekTrainingCache,
  readAttendanceCache,
  readTrainingCache,
  TRAINING_SOFT_TTL_MS,
  writeAttendanceCache,
  writeTrainingCache,
} from "@/lib/member-portal/panel-cache";
import { detectWebPushSupport } from "@/lib/member-portal/web-push-support";
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
  memberUuid = "",
  liveTick = 0,
}: {
  onBack: () => void;
  deviceId: string;
  memberUuid?: string;
  liveTick?: number;
}) {
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [items, setItems] = useState<Attendance[]>(() => {
    const cached = readAttendanceCache<Attendance[]>(memberUuid, month);
    return Array.isArray(cached) ? cached : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ ok: true; items: Attendance[] }>(
        `/api/member/attendance?month=${encodeURIComponent(month)}`,
      );
      const next = data.items || [];
      setItems(next);
      writeAttendanceCache(memberUuid, month, next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [month, memberUuid]);

  useEffect(() => {
    const cached = readAttendanceCache<Attendance[]>(memberUuid, month);
    if (cached) setItems(cached);
    void load();
  }, [load, liveTick, memberUuid, month]);

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
        {!items.length ? (
          <li className="text-sm text-muted">No check-ins yet.</li>
        ) : null}
      </ul>
    </section>
  );
}

export function NotificationsPanel({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState<ReturnType<typeof detectWebPushSupport> | null>(null);

  useEffect(() => {
    setSupport(detectWebPushSupport());
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    setHint(null);
    setStatus(null);
    try {
      const check = detectWebPushSupport();
      setSupport(check);
      if (!check.ok) {
        setError(check.message);
        if (check.hint) setHint(check.hint);
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        throw new Error("Notification permission denied. Allow notifications for this site in Settings, then try again.");
      }

      const reg = await navigator.serviceWorker.register("/sw-member-portal.js", {
        scope: "/members",
      });
      await navigator.serviceWorker.ready;

      const vapid = await api<{ ok: true; publicKey: string; message?: string }>(
        "/api/member/push/vapid",
      );
      if (!vapid?.publicKey) {
        throw new Error(
          (vapid as { message?: string })?.message ||
            "Push is not configured on the server yet. Ask the gym to enable WEB_PUSH_VAPID keys.",
        );
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys) {
        throw new Error("Could not create a push subscription. Try again from the Home Screen app.");
      }
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
      const msg = e instanceof Error ? e.message : "Could not enable push";
      setError(msg);
      if (/not supported|PushManager|service worker/i.test(msg)) {
        setHint(
          "On iPhone: Safari → Share → Add to Home Screen, then open Action Plus from the icon and tap Enable again. On Android: use Chrome (not WhatsApp’s in-app browser).",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const needsHomeScreen = support && !support.ok && support.reason === "ios_needs_home_screen";

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Billing reminders</h2>
      <p className="mt-1 text-sm text-muted">
        Allow notifications once. On your billing day the gym can remind you automatically.
      </p>

      {needsHomeScreen ? (
        <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
          <p className="font-semibold text-gold">Install on your Home Screen first</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-white/80">
            <li>Tap Share in Safari (or Chrome menu → Share)</li>
            <li>Choose Add to Home Screen</li>
            <li>Open Action Plus from the new icon</li>
            <li>Return here and tap Enable billing-day push</li>
          </ol>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
      {status ? <p className="mt-3 text-sm text-gold">{status}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void enable()}
        className="mt-4 min-h-12 w-full touch-manipulation rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? "Enabling…" : "Enable billing-day push"}
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Android Chrome can enable push in the browser. iPhone/iPad require the Home Screen app (iOS
        16.4+).
      </p>
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

export function ChatPanel({
  onBack,
  memberUuid,
  onSeen,
}: {
  onBack: () => void;
  memberUuid?: string;
  onSeen?: () => void;
}) {
  const [messages, setMessages] = useState<
    Array<{ id: string; sender: string; body: string; staff_name?: string; created_at: string }>
  >(() => (memberUuid ? readCachedMessages(memberUuid) || [] : []));
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
      memberUuid?: string;
    }>("/api/member/chat");
    const next = data.messages || [];
    setMessages(next);
    const uuid = data.memberUuid || memberUuid;
    if (uuid) {
      writeCachedMessages(uuid, next);
      const latestStaff = [...next].reverse().find((m) => m.sender === "staff");
      const latestAny = next.length ? next[next.length - 1] : null;
      const watermarkMs = Math.max(
        Date.now(),
        latestAny ? Date.parse(String(latestAny.created_at).replace(" ", "T")) || 0 : 0,
        latestStaff
          ? Date.parse(String(latestStaff.created_at).replace(" ", "T")) || 0
          : 0,
      );
      markChatSeen(uuid, watermarkMs, latestStaff?.id || null);
      onSeen?.();
    }
    if (typeof data.retentionDays === "number" && data.retentionDays > 0) {
      setRetentionDays(data.retentionDays);
    }
  }, [memberUuid, onSeen]);

  useEffect(() => {
    if (memberUuid) {
      const cached = readCachedMessages(memberUuid);
      if (cached?.length) setMessages(cached);
    }
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void load().catch(() => null);
    };
    const id = window.setInterval(tick, 8000);
    return () => window.clearInterval(id);
  }, [load, memberUuid]);

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

type TrainingData = {
  pt: Array<Record<string, unknown>>;
  workouts: Array<Record<string, unknown>>;
  diets: Array<Record<string, unknown>>;
  measurements: Array<Record<string, unknown>>;
  focusByDate?: Record<string, string>;
  today?: string;
  ptWorkoutNotes?: string;
  dailyByDate?: Record<string, { exercises: string[]; notes: string }>;
  exerciseTypes?: string[];
  onPtPlan?: boolean;
  canEditWorkouts?: boolean;
  canEditNotes?: boolean;
  canEditPtNotes?: boolean;
  showMeasurements?: boolean;
  showPtSchedule?: boolean;
  showPtWorkoutDetails?: boolean;
  planName?: string | null;
};

export function TrainingPanel({
  onBack,
  memberUuid = "",
  liveTick: _liveTick = 0,
}: {
  onBack: () => void;
  memberUuid?: string;
  /** Kept for call-site compat; Training uses cache + soft TTL instead of liveTick polling. */
  liveTick?: number;
}) {
  const [data, setData] = useState<TrainingData | null>(() =>
    readTrainingCache<TrainingData>(memberUuid),
  );
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [logDate, setLogDate] = useState("");
  const [logExercises, setLogExercises] = useState<string[]>([]);
  const [logNotes, setLogNotes] = useState("");
  const [logBusy, setLogBusy] = useState(false);
  const [logMsg, setLogMsg] = useState<string | null>(null);
  const [ptNotes, setPtNotes] = useState("");
  const [ptNotesBusy, setPtNotesBusy] = useState(false);
  const [ptNotesMsg, setPtNotesMsg] = useState<string | null>(null);
  const [exercisesExpanded, setExercisesExpanded] = useState(false);
  const [initialLoad, setInitialLoad] = useState(() => !readTrainingCache(memberUuid));
  const formHydratedDateRef = useRef<string | null>(null);
  const ptHydratedDayRef = useRef<string | null>(null);

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

  const canEditWorkouts = data?.canEditWorkouts === true;
  const canEditNotes = data?.canEditNotes !== false;
  const onPtPlan = data?.onPtPlan === true;
  const canEditPtNotes = data?.canEditPtNotes === true;
  const showMeasurements = data?.showMeasurements !== false;
  const showPtSchedule = data?.showPtSchedule !== false;
  const showPtWorkoutDetails = data?.showPtWorkoutDetails === true;

  const applyTraining = useCallback(
    (res: TrainingData) => {
      setData(res);
      writeTrainingCache(memberUuid, res);
      setSelectedDayKey((prev) => prev || res.today || null);
      setLogDate((prev) => prev || res.today || "");
      setError(null);
      setInitialLoad(false);
    },
    [memberUuid],
  );

  const reload = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      if (!force) {
        const peek = peekTrainingCache<TrainingData>(memberUuid);
        if (peek && peek.ageMs < TRAINING_SOFT_TTL_MS) {
          // Keep UI on cache; skip redundant network while soft TTL holds.
          return peek.data;
        }
      }
      const res = await api<TrainingData & { ok: true }>("/api/member/training");
      applyTraining(res);
      return res;
    },
    [applyTraining, memberUuid],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readTrainingCache<TrainingData>(memberUuid);
    if (cached) applyTraining(cached);

    const pull = (force: boolean) => {
      void reload({ force }).catch((e) => {
        if (!cancelled && !readTrainingCache(memberUuid)) {
          setError(e instanceof Error ? e.message : "Load failed");
          setInitialLoad(false);
        }
      });
    };

    // Always revalidate once when opening Training (cache paints instantly first).
    pull(true);

    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // liveTick intentionally omitted — soft TTL + visibility covers freshness without UI flicker.
  }, [reload, memberUuid, applyTraining]);

  // Hydrate Basic form only when the selected date changes (not on silent background refresh).
  useEffect(() => {
    if (!logDate || !data?.dailyByDate) return;
    if (formHydratedDateRef.current === logDate) return;
    formHydratedDateRef.current = logDate;
    const row = data.dailyByDate[logDate];
    setLogExercises(row?.exercises ? [...row.exercises] : []);
    setLogNotes(row?.notes || "");
  }, [logDate, data?.dailyByDate]);

  // Hydrate PT notes only when the selected day changes.
  useEffect(() => {
    if (!selectedDayKey || !data?.dailyByDate) {
      if (!selectedDayKey) {
        setPtNotes("");
        ptHydratedDayRef.current = null;
      }
      return;
    }
    if (ptHydratedDayRef.current === selectedDayKey) return;
    ptHydratedDayRef.current = selectedDayKey;
    setPtNotes(data.dailyByDate[selectedDayKey]?.notes || "");
    setPtNotesMsg(null);
  }, [selectedDayKey, data?.dailyByDate]);

  const focusByDate = useMemo(
    () => data?.focusByDate || {},
    [data?.focusByDate],
  );
  const dailyFocusMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(data?.dailyByDate || {})) {
      if (v.exercises?.length) map[k] = v.exercises.join(", ");
      else if (v.notes?.trim()) map[k] = "notes";
    }
    return map;
  }, [data?.dailyByDate]);

  const monthCells = useMemo(
    () => buildPtMonthCalendarCells(viewYear, viewMonthIndex, focusByDate),
    [viewYear, viewMonthIndex, focusByDate],
  );
  const dailyMonthCells = useMemo(
    () => buildPtMonthCalendarCells(viewYear, viewMonthIndex, dailyFocusMap),
    [viewYear, viewMonthIndex, dailyFocusMap],
  );
  const ptDaysThisMonth = monthCells.filter(
    (c) => c.kind === "day" && !c.isSunday && c.hasFocus,
  ).length;
  const selectedIsScheduled =
    selectedDayKey && focusByDate[selectedDayKey]
      ? Boolean(String(focusByDate[selectedDayKey]).trim())
      : false;
  const selectedFocus =
    showPtWorkoutDetails && selectedDayKey && focusByDate[selectedDayKey]
      ? String(focusByDate[selectedDayKey])
      : "";

  const exerciseOptions = data?.exerciseTypes?.length
    ? data.exerciseTypes
    : [
        "Back",
        "Chest",
        "Leg",
        "Shoulder",
        "Full Body",
        "Cardio",
        "Biceps",
        "Triceps",
      ];

  const PREVIEW_EXERCISE_COUNT = 8;
  const visibleExercises = useMemo(() => {
    if (exercisesExpanded || exerciseOptions.length <= PREVIEW_EXERCISE_COUNT) {
      return exerciseOptions;
    }
    const preview = exerciseOptions.slice(0, PREVIEW_EXERCISE_COUNT);
    const selectedOutside = logExercises.filter((x) => !preview.includes(x));
    return [...preview, ...selectedOutside];
  }, [exercisesExpanded, exerciseOptions, logExercises]);
  const hasMoreExercises = exerciseOptions.length > PREVIEW_EXERCISE_COUNT;

  function shiftMonth(delta: number) {
    const dt = new Date(viewYear, viewMonthIndex + delta, 1);
    setViewYear(dt.getFullYear());
    setViewMonthIndex(dt.getMonth());
  }

  async function saveDailyLog() {
    if (!logDate || (!canEditWorkouts && !canEditNotes)) return;
    setLogBusy(true);
    setLogMsg(null);
    try {
      await api("/api/member/training", {
        method: "POST",
        body: JSON.stringify({
          workoutDate: logDate,
          exercises: canEditWorkouts ? logExercises : [],
          notes: canEditNotes ? logNotes : "",
        }),
      });
      setLogMsg(
        logExercises.length || logNotes.trim()
          ? "Workout saved for this day."
          : "Workout cleared for this day.",
      );
      formHydratedDateRef.current = null;
      await reload({ force: true });
    } catch (e) {
      setLogMsg(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLogBusy(false);
    }
  }

  async function savePtDayNotes() {
    if (!selectedDayKey || !canEditPtNotes || !selectedIsScheduled) return;
    setPtNotesBusy(true);
    setPtNotesMsg(null);
    try {
      await api("/api/member/training", {
        method: "POST",
        body: JSON.stringify({
          workoutDate: selectedDayKey,
          exercises: [],
          notes: ptNotes,
        }),
      });
      setPtNotesMsg(
        ptNotes.trim() ? "Notes saved for this day." : "Notes cleared for this day.",
      );
      ptHydratedDayRef.current = null;
      await reload({ force: true });
    } catch (e) {
      setPtNotesMsg(e instanceof Error ? e.message : "Could not save notes");
    } finally {
      setPtNotesBusy(false);
    }
  }

  const showBasicLogger = canEditWorkouts || (canEditNotes && !onPtPlan);
  const showPtAssignment = onPtPlan && (data?.pt || []).length > 0;
  const showPtWorkouts =
    onPtPlan && showPtWorkoutDetails && (data?.workouts || []).length > 0;
  const showPtDiet = onPtPlan && (data?.diets || []).length > 0;

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden rounded-3xl border border-white/10 bg-charcoal/50 p-4 space-y-5 sm:p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="font-display text-2xl text-white">Training</h2>
      {data?.planName ? (
        <p className="text-xs text-muted">
          Plan · <span className="text-white/85">{data.planName}</span>
          {onPtPlan
            ? " · Your PT schedule days"
            : " · Log your own workouts"}
        </p>
      ) : null}
      {initialLoad && !data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {showBasicLogger ? (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-3.5 space-y-5 sm:p-5">
        <div>
          <p className="font-display text-lg tracking-wide text-white">My daily workouts</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Choose a day
            {canEditWorkouts ? ", pick what you trained" : ""}
            {canEditNotes ? ", add a note if you like" : ""}. History stays until the gym
            removes it.
          </p>
        </div>

        <div className="w-full min-w-0 max-w-full space-y-2 overflow-x-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
            Date
          </p>
          <div className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-xl border border-white/12 bg-black/50 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm text-white">
              {logDate
                ? (() => {
                    const parts = parsePtDateKey(logDate);
                    if (!parts) return logDate;
                    return `${parts.day} ${PT_MONTH_LABELS[parts.monthIndex]?.slice(0, 3) || ""} ${parts.year}`;
                  })()
                : "Pick a date"}
            </p>
            <div className="relative h-11 w-[4.75rem] shrink-0 overflow-hidden rounded-full">
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 z-0 inline-flex items-center justify-center rounded-full border border-white/20 text-[11px] font-medium tracking-wide text-gold/90 ${
                  logBusy ? "opacity-50" : ""
                }`}
              >
                Change
              </span>
              <input
                type="date"
                aria-label="Change workout date"
                disabled={logBusy}
                className="absolute inset-0 z-10 m-0 h-full w-full max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0 disabled:cursor-not-allowed"
                style={{ fontSize: 16, minWidth: 0, maxWidth: "100%" }}
                value={logDate}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next) setLogDate(next);
                }}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted">Or tap a day on the calendar below.</p>
        </div>

        {canEditWorkouts ? (
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-end justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
              Workout
            </p>
            {logExercises.length ? (
              <p className="text-[10px] text-muted">{logExercises.length} selected</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleExercises.map((label) => {
              const on = logExercises.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={logBusy}
                  onClick={() =>
                    setLogExercises((prev) =>
                      prev.includes(label)
                        ? prev.filter((x) => x !== label)
                        : [...prev, label],
                    )
                  }
                  className={`min-h-9 touch-manipulation rounded-full border px-3 py-2 text-[11px] tracking-wide transition ${
                    on
                      ? "border-gold/70 bg-gold/15 text-gold"
                      : "border-white/12 bg-white/[0.03] text-white/75 hover:border-white/25"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {hasMoreExercises ? (
            <button
              type="button"
              onClick={() => setExercisesExpanded((v) => !v)}
              className="min-h-9 touch-manipulation text-[11px] font-medium tracking-wide text-gold/90 underline-offset-2 hover:underline"
            >
              {exercisesExpanded
                ? "Show less"
                : `See all (${exerciseOptions.length})`}
            </button>
          ) : null}
        </div>
        ) : null}

        {canEditNotes ? (
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
            + Notes
          </p>
          <textarea
            rows={2}
            className="box-border block w-full min-w-0 max-w-full resize-none rounded-xl border border-white/12 bg-black/50 px-3 py-3 text-base leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-gold/40 sm:text-sm"
            value={logNotes}
            onChange={(e) => setLogNotes(e.target.value)}
            placeholder="Sets, reps, how it felt…"
            disabled={logBusy}
          />
        </div>
        ) : null}

        <button
          type="button"
          disabled={logBusy || !logDate}
          onClick={() => void saveDailyLog()}
          className="min-h-12 w-full touch-manipulation rounded-full gold-gradient px-5 py-3 text-sm font-semibold tracking-wide text-black disabled:opacity-50"
        >
          {logBusy
            ? "Saving…"
            : logExercises.length || logNotes.trim()
              ? "Save workout"
              : "Clear this day"}
        </button>
        {logMsg ? <p className="text-xs text-amber-200/90">{logMsg}</p> : null}

        <div className="min-w-0 space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Your log calendar
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="min-h-9 touch-manipulation rounded-full border border-white/15 px-3 py-1.5 text-[10px] tracking-wide text-white/70"
                onClick={() => shiftMonth(-1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="min-h-9 touch-manipulation rounded-full border border-white/15 px-3 py-1.5 text-[10px] tracking-wide text-white/70"
                onClick={() => shiftMonth(1)}
              >
                Next
              </button>
            </div>
          </div>
          <p className="text-center text-xs font-medium text-white/80">
            {PT_MONTH_LABELS[viewMonthIndex]} {viewYear}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {dailyMonthCells.map((cell) => {
              if (cell.kind === "pad") return <div key={cell.key} className="min-h-11" />;
              const active = cell.key === logDate;
              return (
                <button
                  key={cell.key}
                  type="button"
                  title={cell.focus || undefined}
                  onClick={() => setLogDate(cell.key)}
                  className={`min-h-11 touch-manipulation rounded-lg text-[11px] transition ${
                    cell.hasFocus
                      ? "bg-gold/20 text-gold"
                      : "bg-white/[0.04] text-white/65"
                  } ${active ? "ring-1 ring-gold/80" : ""}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      ) : null}

      {showPtAssignment ? (
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
      ) : null}
      {showPtWorkouts ? (
      <Block title="Workouts" empty="No workout plan assigned.">
        {(data?.workouts || []).map((w) => (
          <p key={String(w.id)} className="text-sm text-white/85 whitespace-pre-wrap">
            {String(w.title)}
          </p>
        ))}
      </Block>
      ) : null}
      {showPtDiet ? (
      <Block title="Diet" empty="No diet plan assigned.">
        {(data?.diets || []).map((d) => (
          <p key={String(d.id)} className="text-sm text-white/85 whitespace-pre-wrap">
            {String(d.title)}
          </p>
        ))}
      </Block>
      ) : null}

      {showMeasurements ? (
      <Block title="Measurements" empty="No measurements yet.">
        {(data?.measurements || []).map((m) => (
          <p key={String(m.id)} className="text-sm text-white/85">
            {formatDate(String(m.measured_at))} ·{" "}
            {m.weight_kg != null ? `${m.weight_kg} kg` : "—"}
            {m.body_fat_pct != null ? ` · ${m.body_fat_pct}% bf` : ""}
          </p>
        ))}
      </Block>
      ) : null}

      {onPtPlan && showPtSchedule ? (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3">
        <button
          type="button"
          onClick={() => setCalendarOpen((v) => !v)}
          className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
          aria-expanded={calendarOpen}
        >
          <div>
            <p className="text-sm font-semibold text-white">Your PT days</p>
            {!calendarOpen ? (
              <p className="mt-0.5 text-xs text-emerald-200/80">
                Expand to see days scheduled with your trainer
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
              Green = day with your PT · Rose = open.
              {canEditPtNotes
                ? " Tap a scheduled day to add + Notes."
                : " Tap a day to select it."}
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
                      "min-h-11 touch-manipulation rounded-lg border px-1 py-1.5 text-[10px] sm:min-h-12 sm:text-xs",
                      entry.isSunday
                        ? "border-white/10 bg-white/5 text-muted"
                        : entry.hasFocus
                          ? "border-emerald-400/50 bg-emerald-950/40 text-emerald-200"
                          : "border-rose-400/40 bg-rose-950/35 text-rose-200",
                      selectedDayKey === entry.key ? "ring-2 ring-sky-400" : "",
                    ].join(" ")}
                    title={
                      entry.hasFocus
                        ? showPtWorkoutDetails && entry.focus && entry.focus !== "scheduled"
                          ? `${entry.key}: ${entry.focus}`
                          : `${entry.key}: PT day`
                        : `${entry.key}: Open`
                    }
                  >
                    <div className="font-semibold">{entry.day}</div>
                    {showPtWorkoutDetails ? (
                      <div className="mt-0.5 truncate">
                        {entry.focus && entry.focus !== "scheduled"
                          ? entry.focus
                          : entry.isSunday
                            ? "Sun"
                            : entry.hasFocus
                              ? "PT"
                              : "—"}
                      </div>
                    ) : (
                      <div className="mt-0.5 truncate">
                        {entry.hasFocus ? "PT" : entry.isSunday ? "Sun" : "—"}
                      </div>
                    )}
                  </button>
                ),
              )}
            </div>
            {selectedDayKey ? (
              <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-sm text-white/85">
                  <span className="text-muted">{selectedDayKey}</span>
                  {" · "}
                  {selectedIsScheduled
                    ? showPtWorkoutDetails && selectedFocus && selectedFocus !== "scheduled"
                      ? selectedFocus
                      : "Scheduled with your PT"
                    : "No PT session this day"}
                </p>
                {canEditPtNotes && selectedIsScheduled ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
                      + Notes
                    </p>
                    <textarea
                      rows={2}
                      className="box-border block w-full min-w-0 max-w-full resize-none rounded-xl border border-white/12 bg-black/50 px-3 py-3 text-base leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-gold/40 sm:text-sm"
                      value={ptNotes}
                      onChange={(e) => setPtNotes(e.target.value)}
                      placeholder="Your notes for this PT day…"
                      disabled={ptNotesBusy}
                    />
                    <button
                      type="button"
                      disabled={ptNotesBusy}
                      onClick={() => void savePtDayNotes()}
                      className="min-h-11 w-full touch-manipulation rounded-full gold-gradient px-5 py-2.5 text-sm font-semibold tracking-wide text-black disabled:opacity-50"
                    >
                      {ptNotesBusy
                        ? "Saving…"
                        : ptNotes.trim()
                          ? "Save notes"
                          : "Clear notes"}
                    </button>
                    {ptNotesMsg ? (
                      <p className="text-xs text-amber-200/90">{ptNotesMsg}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {showPtWorkoutDetails && data?.ptWorkoutNotes ? (
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
      ) : null}
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
    referral: {
      code: string;
      points: number;
      lifetimePoints?: number;
      pendingCreditInr?: number;
    } | null;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{
      ok: true;
      locker: { locker_code: string; status: string } | null;
      referral: {
        code: string;
        points: number;
        lifetimePoints?: number;
        pendingCreditInr?: number;
      } | null;
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

  function shareReferralOnWhatsApp() {
    const code = String(data?.referral?.code || "").trim();
    if (!code) {
      setError("Referral code is not ready yet. Try again in a moment.");
      return;
    }
    const text = [
      "Join Action Plus Gym with my referral code:",
      code,
      "",
      "Show this code at the gym when you register — I earn referral points when you join.",
    ].join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Popup blocked — navigate in same tab as fallback.
      window.location.href = url;
    }
  }

  async function copyReferralCode() {
    const code = String(data?.referral?.code || "").trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMsg("Referral code copied.");
      setError(null);
    } catch {
      setError("Could not copy. Long-press the code to copy.");
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
        <p className="text-sm text-muted">{data?.referral?.points ?? 0} available points</p>
        {data?.referral?.code ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={shareReferralOnWhatsApp}
              className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white"
            >
              Share on WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void copyReferralCode()}
              className="rounded-full border border-gold/40 px-4 py-2 text-sm text-gold"
            >
              Copy code
            </button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          Friends show this code when joining. Available points match your pending referral
          credit and go to 0 after it is used on billing.
        </p>
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

type WeightLog = {
  id: string;
  date: string;
  weightKg: number | null;
  notes?: string;
  recordedBy?: string;
};

function formatWeightDate(iso: string) {
  const key = String(iso || "").slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key || "—";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Basic-member Weight Tracker — logs to member_measurements (shared with Gym Manager). */
export function WeightTrackerPanel({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");
  const [currentKg, setCurrentKg] = useState<number | null>(null);
  const [changeKg, setChangeKg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<null | { kind: "loss" | "gain" | "same"; delta: number }>(
    null,
  );

  const reload = useCallback(async () => {
    const data = await api<{
      ok: true;
      canEdit: boolean;
      logs: WeightLog[];
      currentKg: number | null;
      changeKg: number | null;
      today: string;
    }>("/api/member/weight");
    setCanEdit(Boolean(data.canEdit));
    setLogs(Array.isArray(data.logs) ? data.logs : []);
    setCurrentKg(data.currentKg);
    setChangeKg(data.changeKg);
    setDate((prev) => prev || data.today || "");
  }, []);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load weight"))
      .finally(() => setLoading(false));
  }, [reload]);

  async function addWeight() {
    if (!canEdit || busy) return;
    const kg = Number(String(weight).trim());
    if (!Number.isFinite(kg) || kg <= 0) {
      setError("Enter a valid weight in kg.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        ok: true;
        currentKg: number;
        previousKg: number | null;
        changeKg: number | null;
      }>("/api/member/weight", {
        method: "POST",
        body: JSON.stringify({ date, weightKg: kg }),
      });
      setWeight("");
      await reload();
      const delta = res.changeKg;
      if (delta != null && delta !== 0) {
        setFeedback({
          kind: delta < 0 ? "loss" : "gain",
          delta,
        });
      } else if (delta === 0) {
        setFeedback({ kind: "same", delta: 0 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save weight");
    } finally {
      setBusy(false);
    }
  }

  const changeLabel =
    changeKg == null
      ? "NA"
      : changeKg === 0
        ? "0 kg"
        : `${changeKg > 0 ? "+" : ""}${changeKg} kg`;

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden rounded-3xl border border-white/10 bg-charcoal/50 p-4 space-y-5 sm:p-5">
      <PortalBackButton onClick={onBack} />
      <div>
        <h2 className="font-display text-2xl text-white">Weight Tracker</h2>
        <p className="mt-1 text-sm text-muted">
          Log your weight. Staff can see your progress in Gym Manager → Workout.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!canEdit ? (
        <p className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
          Weight Tracker is for Basic members. On a PT plan, your trainer tracks weight in Gym
          Manager.
        </p>
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-3.5 sm:p-5">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
              Date
            </p>
            <input
              type="date"
              className="box-border w-full min-w-0 rounded-xl border border-white/12 bg-black/50 px-3 py-3 text-base text-white outline-none focus:border-gold/40 sm:text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
              Weight (kg)
            </p>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              max="400"
              placeholder="e.g. 72.5"
              className="box-border w-full min-w-0 rounded-xl border border-white/12 bg-black/50 px-3 py-3 text-base text-white outline-none focus:border-gold/40 sm:text-sm"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              disabled={busy}
            />
          </div>
          <button
            type="button"
            disabled={busy || !weight.trim()}
            onClick={() => void addWeight()}
            className="min-h-12 w-full touch-manipulation rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add Weight"}
          </button>
          <p className="text-sm text-white/85">
            Current:{" "}
            <span className="text-gold">{currentKg != null ? `${currentKg} kg` : "NA"}</span>
            {" · "}
            Change: <span className="text-gold">{changeLabel}</span>
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
          History
        </p>
        {!logs.length ? (
          <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">
            No weight logs yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"
              >
                <span className="text-muted">{formatWeightDate(log.date)}</span>
                <span className="font-medium text-white">
                  {log.weightKg != null ? `${log.weightKg} kg` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {feedback ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          role="dialog"
          aria-modal="true"
          onClick={() => setFeedback(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-gold/40 bg-charcoal p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {feedback.kind === "loss" ? (
              <>
                <div className="weight-celebrate text-5xl" aria-hidden>
                  🎉
                </div>
                <p className="mt-3 font-display text-2xl text-gold">Great progress!</p>
                <p className="mt-2 text-sm text-white/85">
                  You lost <strong className="text-gold">{Math.abs(feedback.delta)} kg</strong>. Keep
                  going — the gym is proud of you.
                </p>
                <div className="weight-confetti mt-4" aria-hidden />
              </>
            ) : feedback.kind === "gain" ? (
              <>
                <div className="text-5xl" aria-hidden>
                  💪
                </div>
                <p className="mt-3 font-display text-2xl text-gold">Stay consistent</p>
                <p className="mt-2 text-sm text-white/85">
                  Up <strong className="text-gold">{feedback.delta} kg</strong> since last log.
                  Small steps — train, hydrate, and check in again soon. You’ve got this.
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl text-gold">Steady</p>
                <p className="mt-2 text-sm text-white/85">
                  Same as last time. Consistency beats extremes — keep logging.
                </p>
              </>
            )}
            <button
              type="button"
              className="mt-5 w-full rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
              onClick={() => setFeedback(null)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
