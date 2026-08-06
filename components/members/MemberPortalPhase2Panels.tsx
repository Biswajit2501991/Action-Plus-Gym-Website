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
  CHAT_SOFT_TTL_MS,
  markChatSeen,
  peekCachedMessages,
  readCachedMessages,
  writeCachedMessages,
} from "@/lib/member-portal/chat-client";
import {
  PANEL_SOFT_TTL_MS,
  peekAttendanceCache,
  peekBookingsCache,
  peekPaymentsCache,
  peekPerksCache,
  peekTrainingCache,
  peekWeightCache,
  readAttendanceCache,
  readBookingsCache,
  readPaymentsCache,
  readPerksCache,
  readTrainingCache,
  readWeightCache,
  TRAINING_SOFT_TTL_MS,
  writeAttendanceCache,
  writeBookingsCache,
  writePaymentsCache,
  writePerksCache,
  writeTrainingCache,
  writeWeightCache,
} from "@/lib/member-portal/panel-cache";
import { detectWebPushSupport, detectExistingBillingPushSubscription } from "@/lib/member-portal/web-push-support";
import {
  deriveBillingAlert,
  type BillingAlert,
} from "@/lib/member-portal/billing-alerts";
import { isWithinNewBadgeWindow, toBadgeStartMs } from "@/lib/member-portal/new-badge";
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

function isCredentialManagerError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const name = "name" in err ? String((err as DOMException).name || "") : "";
  const message = String(err.message || "");
  return (
    name === "NotReadableError" ||
    name === "UnknownError" ||
    /credential manager/i.test(message)
  );
}

function webAuthnErrorMessage(err: unknown) {
  if (!(err instanceof Error)) return "Biometric failed";
  const name = "name" in err ? String((err as DOMException).name || "") : "";
  const message = String(err.message || "");
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
  if (isCredentialManagerError(err)) {
    return "Fingerprint setup failed on this Android phone. Open actionplusgym.com in Chrome (not WhatsApp), unlock screen lock + fingerprint, then try Register biometric again.";
  }
  return message || "Biometric failed";
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

type ReceiptData = {
  receiptId: string;
  memberName: string;
  memberCode: string;
  planName: string;
  branchName: string;
  paidAt: string;
  method: string;
  billingMonth: string;
  periodLabel: string;
  note: string;
  amount: string;
  amountDisplay: string;
  fingerprint?: string;
  qrDataUrl?: string;
  shareText: string;
  shareUrl?: string;
  gym?: {
    siteName: string;
    phoneDisplay: string;
    whatsappDisplay: string;
    address: string;
    email: string;
  };
};

function receiptShareBody(receipt: ReceiptData, pageUrl: string) {
  return `${receipt.shareText}\n\n${pageUrl}`;
}

/** In-app receipt so home-screen members never leave the portal. */
function ReceiptView({
  paymentId,
  onBack,
}: {
  paymentId: string;
  onBack: () => void;
}) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const jsonUrl = `/api/member/payments/${encodeURIComponent(paymentId)}/receipt?format=json`;

  useEffect(() => {
    let cancelled = false;
    setReceipt(null);
    setError(null);
    setHint(null);
    void api<{ ok: true; receipt: ReceiptData }>(jsonUrl)
      .then((data) => {
        if (!cancelled) setReceipt(data.receipt);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load receipt");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jsonUrl]);

  function shareLink() {
    if (!receipt) return "";
    if (receipt.shareUrl) return receipt.shareUrl;
    if (typeof window === "undefined") {
      return `/api/member/payments/${encodeURIComponent(paymentId)}/receipt`;
    }
    return new URL(
      `/api/member/payments/${encodeURIComponent(paymentId)}/receipt`,
      window.location.origin,
    ).toString();
  }

  function printUrl() {
    // Prefer public share link so Print opens without session issues in a new tab.
    return shareLink() || `/api/member/payments/${encodeURIComponent(paymentId)}/receipt`;
  }

  function shareOnWhatsApp() {
    if (!receipt) return;
    const text = receiptShareBody(receipt, shareLink());
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function shareNative() {
    if (!receipt) return;
    setHint(null);
    const url = shareLink();
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Action Plus Gym receipt",
          text: receipt.shareText,
          url,
        });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard?.writeText(receiptShareBody(receipt, url));
      setHint("Receipt details copied.");
    } catch {
      setHint("Use Share on WhatsApp to send this receipt.");
    }
  }

  const rows: Array<[string, string]> = receipt
    ? [
        ...(receipt.fingerprint
          ? [["Verify code", receipt.fingerprint] as [string, string]]
          : []),
        ["Receipt", receipt.receiptId],
        ["Member", receipt.memberName],
        ["Member ID", receipt.memberCode],
        ["Plan", receipt.planName],
        ["Covered period", receipt.periodLabel || receipt.billingMonth],
        ["Branch", receipt.branchName],
        ["Paid at", receipt.paidAt],
        ["Method", receipt.method],
        ["Note", receipt.note],
      ]
    : [];

  const gym = receipt?.gym;
  const watermarkLabel = `${gym?.siteName || "Action Plus Gym"} · verify via QR · not a tax invoice`;

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Payment receipt</h2>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {!receipt && !error ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : null}

      {receipt ? (
        <>
          <div className="relative mt-4 overflow-hidden rounded-3xl border border-gold/25 bg-black/35">
            <div
              className="pointer-events-none absolute inset-[-20%] z-0 flex flex-wrap content-center justify-center gap-x-9 gap-y-7 text-[10px] font-bold uppercase tracking-wide text-white/[0.07]"
              style={{ transform: "rotate(-28deg)" }}
              aria-hidden
            >
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="whitespace-nowrap">
                  {watermarkLabel}
                </span>
              ))}
            </div>

            <div className="relative z-[1]">
            <div className="border-b border-white/10 px-5 py-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl gold-gradient text-sm font-extrabold text-black">
                AP
              </div>
              <p className="mt-3 font-display text-xl text-gold">
                {gym?.siteName || "Action Plus Gym"}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-muted">
                Payment receipt
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Paid
              </span>
            </div>

            <div className="px-5 pb-2 pt-6 text-center">
              <p className="text-[11px] uppercase tracking-widest text-muted">
                Amount paid
              </p>
              <p className="mt-2 font-display text-[2.75rem] leading-none tracking-tight text-gold tabular-nums">
                <span className="mr-1 align-[0.18em] text-[0.55em] font-semibold opacity-90">
                  ₹
                </span>
                {receipt.amountDisplay}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {receipt.periodLabel || "Membership payment"}
              </p>
              <p className="mt-2 text-[11px] leading-snug text-muted">
                Verify authenticity via QR. Gym records are final.
              </p>
            </div>

            {(receipt.qrDataUrl || receipt.fingerprint) ? (
              <div className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                {receipt.qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={receipt.qrDataUrl}
                    alt="Verification QR"
                    width={96}
                    height={96}
                    className="h-24 w-24 shrink-0 rounded-xl bg-white"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-muted">
                    Verify authenticity
                  </p>
                  {receipt.fingerprint ? (
                    <p className="mt-1 font-display text-lg tracking-wider text-gold">
                      {receipt.fingerprint}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    Scan QR for the live official receipt. Screenshots without this
                    code/QR are incomplete.
                  </p>
                </div>
              </div>
            ) : null}

            <dl className="px-5 pb-3 pt-3">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-white/10 py-2.5 text-sm last:border-b-0"
                >
                  <dt className="shrink-0 text-muted">{label}</dt>
                  <dd className="break-words text-right text-white/90">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="shrink-0 text-muted">Amount</dt>
                <dd className="text-right text-base font-semibold tabular-nums text-gold">
                  ₹{receipt.amountDisplay}
                </dd>
              </div>
            </dl>

            {gym && (gym.address || gym.phoneDisplay || gym.whatsappDisplay || gym.email) ? (
              <div className="mx-5 mb-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-xs leading-relaxed text-muted">
                <p className="mb-1.5 text-sm font-semibold text-white">
                  {gym.siteName || "Action Plus Gym"}
                </p>
                {gym.address ? <p>{gym.address}</p> : null}
                {gym.phoneDisplay ? <p>Phone: {gym.phoneDisplay}</p> : null}
                {gym.whatsappDisplay ? <p>WhatsApp: {gym.whatsappDisplay}</p> : null}
                {gym.email ? <p>Email: {gym.email}</p> : null}
              </div>
            ) : null}

            <p className="mx-5 mb-5 text-left text-[11px] leading-relaxed text-muted">
              This receipt is an automated copy of a payment recorded in{" "}
              {gym?.siteName || "Action Plus Gym"}’s system. It does not create any
              extra rights beyond the payment shown. Any altered, incomplete, or
              falsely claimed use of this receipt is unauthorised.{" "}
              {gym?.siteName || "Action Plus Gym"} accepts no liability for disputes
              arising from misuse of a shared or downloaded copy. Only the gym’s
              official payment records shall be relied upon.
              {receipt.fingerprint
                ? ` Accept only receipts that verify via QR or verify code ${receipt.fingerprint}.`
                : ""}
            </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={shareOnWhatsApp}
              className="w-full rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black"
            >
              Share on WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void shareNative()}
              className="w-full rounded-full border border-white/15 px-5 py-3 text-sm text-white"
            >
              Share
            </button>
            <a
              href={printUrl()}
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-full border border-white/15 px-5 py-3 text-center text-sm text-white"
            >
              Print / Save PDF
            </a>
            {hint ? (
              <p className="pt-1 text-center text-xs text-muted">{hint}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function PaymentsPanel({
  onBack,
  memberUuid = "",
  liveTick: _liveTick = 0,
}: {
  onBack: () => void;
  memberUuid?: string;
  /** Kept for call-site compat; Payments uses cache + soft TTL instead of liveTick polling. */
  liveTick?: number;
}) {
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [items, setItems] = useState<Payment[]>(() => {
    const cached = readPaymentsCache<Payment[]>(memberUuid);
    return Array.isArray(cached) ? cached : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(
    () => !readPaymentsCache<Payment[]>(memberUuid),
  );

  const applyPayments = useCallback(
    (next: Payment[]) => {
      setItems(next);
      writePaymentsCache(memberUuid, next);
      setError(null);
      setInitialLoad(false);
    },
    [memberUuid],
  );

  const reload = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      if (!force) {
        const peek = peekPaymentsCache<Payment[]>(memberUuid);
        if (peek && peek.ageMs < PANEL_SOFT_TTL_MS) return peek.data;
      }
      const data = await api<{ ok: true; items: Payment[] }>("/api/member/payments");
      const next = data.items || [];
      applyPayments(next);
      return next;
    },
    [applyPayments, memberUuid],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readPaymentsCache<Payment[]>(memberUuid);
    if (cached) applyPayments(cached);

    const pull = (force: boolean) => {
      void reload({ force }).catch((e) => {
        if (!cancelled && !readPaymentsCache(memberUuid)) {
          setError(e instanceof Error ? e.message : "Could not load payments");
          setInitialLoad(false);
        }
      });
    };

    pull(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, memberUuid, applyPayments]);

  if (receiptId) {
    return <ReceiptView paymentId={receiptId} onBack={() => setReceiptId(null)} />;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-3 font-display text-2xl text-white">Recent payments</h2>
      <p className="mt-1 text-sm text-muted">Last 3 payments from the gym ledger.</p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {initialLoad && !items.length ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {items.map((p, idx) => {
          const isLatestNew =
            idx === 0 && isWithinNewBadgeWindow(toBadgeStartMs(p.paidAt));
          return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white">₹{Number(p.amount || 0).toFixed(0)}</p>
                {isLatestNew ? (
                  <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
                    New
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted">
                {formatDate(p.paidAt)} · {p.method || "—"} · {p.paidMonth || "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReceiptId(p.id)}
              className="shrink-0 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold"
            >
              Receipt
            </button>
          </li>
          );
        })}
        {!initialLoad && !items.length ? (
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
  liveTick: _liveTick = 0,
}: {
  onBack: () => void;
  deviceId: string;
  memberUuid?: string;
  /** Kept for call-site compat; uses cache + soft TTL instead of liveTick polling. */
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
  const [initialLoad, setInitialLoad] = useState(
    () => !readAttendanceCache(memberUuid, month),
  );

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      if (!force) {
        const peek = peekAttendanceCache<Attendance[]>(memberUuid, month);
        if (peek && peek.ageMs < PANEL_SOFT_TTL_MS) return peek.data;
      }
      const data = await api<{ ok: true; items: Attendance[] }>(
        `/api/member/attendance?month=${encodeURIComponent(month)}`,
      );
      const next = data.items || [];
      setItems(next);
      writeAttendanceCache(memberUuid, month, next);
      setError(null);
      setInitialLoad(false);
      return next;
    },
    [month, memberUuid],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readAttendanceCache<Attendance[]>(memberUuid, month);
    if (cached) {
      setItems(cached);
      setInitialLoad(false);
    }

    const pull = (force: boolean) => {
      void load({ force }).catch((e) => {
        if (!cancelled && !readAttendanceCache(memberUuid, month)) {
          setError(e instanceof Error ? e.message : "Load failed");
          setInitialLoad(false);
        }
      });
    };

    pull(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, memberUuid, month]);

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
      await load({ force: true });
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
      {initialLoad && !items.length ? (
        <p className="mt-2 text-sm text-muted">Loading…</p>
      ) : (
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
      )}
    </section>
  );
}

type AlertsMember = {
  memberUuid?: string;
  status?: string | null;
  billingDate?: string | null;
  paymentBy?: string | null;
  nextPaymentDate?: string | null;
  amount?: number | null;
};

export function NotificationsPanel({
  onBack,
  member,
}: {
  onBack: () => void;
  member?: AlertsMember | null;
  onSeen?: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState<ReturnType<typeof detectWebPushSupport> | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushChecked, setPushChecked] = useState(false);

  const billingAlert = useMemo(
    () =>
      deriveBillingAlert({
        status: member?.status,
        billingDate: member?.billingDate,
        paymentBy: member?.paymentBy,
        nextPaymentDate: member?.nextPaymentDate,
        amount: member?.amount,
      }),
    [
      member?.status,
      member?.billingDate,
      member?.paymentBy,
      member?.nextPaymentDate,
      member?.amount,
    ],
  );

  useEffect(() => {
    setSupport(detectWebPushSupport());
    let cancelled = false;
    void (async () => {
      try {
        const enabled = await detectExistingBillingPushSubscription();
        if (!cancelled) setPushEnabled(enabled);
      } catch {
        if (!cancelled) setPushEnabled(false);
      } finally {
        if (!cancelled) setPushChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
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

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
        }));
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
          confirm: true,
        }),
      });
      setPushEnabled(true);
      setStatus(
        "Billing-day reminders are on. A confirmation notification was sent — close the app and check your lock screen if you want to verify.",
      );
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
      <h2 className="mt-3 font-display text-2xl text-white">Alerts</h2>
      <p className="mt-1 text-sm text-muted">
        Billing and payment notices for your membership. Optional phone push is below.
      </p>

      <div className="mt-5 space-y-3">
        {billingAlert ? (
          <BillingAlertCard alert={billingAlert} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-muted">
            No billing alerts right now. You&apos;ll see a notice here from your billing date through
            the payment-due window.
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <h3 className="text-sm font-semibold text-white">Optional phone reminders</h3>
        <p className="mt-1 text-sm text-muted">
          Allow notifications once. On your billing day (India time) the gym can remind you on this
          phone even when Member Portal is closed. iPhone needs the Home Screen app (iOS 16.4+).
        </p>

        {needsHomeScreen && !pushEnabled ? (
          <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            <p className="font-semibold text-gold">Install on your Home Screen first</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-white/80">
              <li>Tap Share in Safari</li>
              <li>Choose Add to Home Screen</li>
              <li>Open Action Plus from the new icon (not the Safari tab)</li>
              <li>Return here and tap Enable billing-day push</li>
            </ol>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
        {status ? <p className="mt-3 text-sm text-gold">{status}</p> : null}

        {!pushChecked ? (
          <p className="mt-4 text-sm text-muted">Checking reminder status…</p>
        ) : pushEnabled ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/30 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-200">Billing-day reminders are on</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                You&apos;ll get a phone notification on your billing date and when Payment By is
                overdue — even if this app is closed. In-app Alerts above still work if browser
                notifications are off.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void enable()}
              className="min-h-11 w-full touch-manipulation rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send test notification"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void enable()}
            className="mt-4 min-h-12 w-full touch-manipulation rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Enabling…" : "Enable billing-day push"}
          </button>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Safari on iPhone only delivers push from the Home Screen app, not a normal Safari tab.
          Android Chrome can enable push in the browser. Use Send test notification, then close the
          app to confirm lock-screen delivery.
        </p>
      </div>
    </section>
  );
}

function BillingAlertCard({ alert }: { alert: BillingAlert }) {
  const overdue = alert.kind === "overdue";
  return (
    <article
      className={
        overdue
          ? "portal-alert-card portal-alert-card--overdue rounded-2xl px-4 py-4"
          : "rounded-2xl border border-gold/35 bg-gold/10 px-4 py-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={
            overdue
              ? "text-sm font-semibold text-[#ff8c8c]"
              : "text-sm font-semibold text-gold"
          }
        >
          {alert.title}
        </p>
        <span
          className={
            overdue
              ? "shrink-0 rounded-full bg-[#ff2b2b]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ffb3b3]"
              : "shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold"
          }
        >
          {overdue ? "Overdue" : "Billing"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/90">{alert.body}</p>
      <dl className="mt-3 grid gap-1.5 text-xs text-white/70">
        <div className="flex justify-between gap-3">
          <dt>Billing date</dt>
          <dd className="text-white">{alert.billingDateLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Payment by</dt>
          <dd className="text-white">{alert.paymentByLabel}</dd>
        </div>
      </dl>
    </article>
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
  const [initialLoad, setInitialLoad] = useState(
    () => !(memberUuid && readCachedMessages(memberUuid)?.length),
  );

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      const uuid = String(memberUuid || "").trim();
      if (!force && uuid) {
        const peek = peekCachedMessages(uuid);
        if (peek && peek.ageMs < CHAT_SOFT_TTL_MS) {
          setMessages(peek.messages);
          setInitialLoad(false);
          return peek.messages;
        }
      }
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
      setInitialLoad(false);
      setError(null);
      const resolvedUuid = data.memberUuid || memberUuid;
      if (resolvedUuid) {
        writeCachedMessages(resolvedUuid, next);
        const latestStaff = [...next].reverse().find((m) => m.sender === "staff");
        const latestAny = next.length ? next[next.length - 1] : null;
        const watermarkMs = Math.max(
          Date.now(),
          latestAny ? Date.parse(String(latestAny.created_at).replace(" ", "T")) || 0 : 0,
          latestStaff
            ? Date.parse(String(latestStaff.created_at).replace(" ", "T")) || 0
            : 0,
        );
        markChatSeen(resolvedUuid, watermarkMs, latestStaff?.id || null);
        onSeen?.();
      }
      if (typeof data.retentionDays === "number" && data.retentionDays > 0) {
        setRetentionDays(data.retentionDays);
      }
      return next;
    },
    [memberUuid, onSeen],
  );

  useEffect(() => {
    let cancelled = false;
    if (memberUuid) {
      const cached = readCachedMessages(memberUuid);
      if (cached?.length) {
        setMessages(cached);
        setInitialLoad(false);
      }
    }

    const pull = (force: boolean) => {
      void load({ force }).catch((e) => {
        if (!cancelled && !(memberUuid && readCachedMessages(memberUuid)?.length)) {
          setError(e instanceof Error ? e.message : "Load failed");
          setInitialLoad(false);
        }
      });
    };

    pull(true);
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      pull(false);
    };
    const id = window.setInterval(tick, CHAT_SOFT_TTL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
      await load({ force: true });
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
              {m.sender === "staff" ? "Action Plus Gym" : "You"} ·{" "}
              {new Date(m.created_at).toLocaleString("en-IN")}
            </p>
          </div>
        ))}
        {initialLoad && !messages.length ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : null}
        {!initialLoad && !messages.length ? (
          <p className="text-sm text-muted">Say hello to the gym team.</p>
        ) : null}
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

type DietImage = {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  uploadedAt?: string | null;
};

type TrainingData = {
  pt: Array<Record<string, unknown>>;
  workouts: Array<Record<string, unknown>>;
  diets: Array<Record<string, unknown>>;
  dietImages?: DietImage[];
  dietUpdatedAt?: string | null;
  latestTrainerChatAt?: string | null;
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

/** Training shows only first + latest weights; full history lives in Weight Tracker. */
function firstAndLatestMeasurements(
  list: Array<Record<string, unknown>>,
): Array<{ label: string; m: Record<string, unknown> }> {
  const timeOf = (m: Record<string, unknown>) => {
    const ms = Date.parse(String(m.measured_at || ""));
    return Number.isFinite(ms) ? ms : 0;
  };
  const sorted = [...list].sort((a, b) => timeOf(a) - timeOf(b));
  if (!sorted.length) return [];
  if (sorted.length === 1) return [{ label: "Latest", m: sorted[0] }];
  return [
    { label: "Latest", m: sorted[sorted.length - 1] },
    { label: "First", m: sorted[0] },
  ];
}

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
  const [dietTextOpen, setDietTextOpen] = useState(false);
  const [dietImageOpen, setDietImageOpen] = useState(false);
  const [dietImageIndex, setDietImageIndex] = useState(0);
  const [ptChatOpen, setPtChatOpen] = useState(false);
  const [ptChatMessages, setPtChatMessages] = useState<
    Array<{ id: string; by?: string; text: string; ts?: string; from?: string }>
  >([]);
  const [ptChatText, setPtChatText] = useState("");
  const [ptChatBusy, setPtChatBusy] = useState(false);
  const [ptChatError, setPtChatError] = useState<string | null>(null);
  const [ptChatLoading, setPtChatLoading] = useState(false);
  const ptChatScrollRef = useRef<HTMLDivElement | null>(null);
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

  const loadPtChat = useCallback(async () => {
    if (!onPtPlan) {
      setPtChatMessages([]);
      return;
    }
    setPtChatLoading(true);
    setPtChatError(null);
    try {
      const res = await api<{
        ok: true;
        messages: Array<{ id: string; by?: string; text: string; ts?: string; from?: string }>;
      }>("/api/member/pt-chat");
      setPtChatMessages(res.messages || []);
    } catch (e) {
      setPtChatError(e instanceof Error ? e.message : "Could not load trainer chat");
    } finally {
      setPtChatLoading(false);
    }
  }, [onPtPlan]);

  useEffect(() => {
    if (!onPtPlan) {
      setPtChatMessages([]);
      setPtChatOpen(false);
      return;
    }
    if (!ptChatOpen) return;
    void loadPtChat();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadPtChat();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [onPtPlan, ptChatOpen, loadPtChat]);

  useEffect(() => {
    if (!ptChatOpen) return;
    const el = ptChatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [ptChatOpen, ptChatMessages.length]);

  useEffect(() => {
    if (!ptChatOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPtChatOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ptChatOpen]);

  async function sendPtChat() {
    const text = ptChatText.trim();
    if (!text || ptChatBusy || !onPtPlan) return;
    setPtChatBusy(true);
    setPtChatError(null);
    try {
      const res = await api<{
        ok: true;
        messages: Array<{ id: string; by?: string; text: string; ts?: string; from?: string }>;
      }>("/api/member/pt-chat", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setPtChatMessages(res.messages || []);
      setPtChatText("");
    } catch (e) {
      setPtChatError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setPtChatBusy(false);
    }
  }

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

  const notesByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(data?.dailyByDate || {})) {
      const note = String(v?.notes || "").trim();
      if (note) map[k] = note;
    }
    return map;
  }, [data?.dailyByDate]);

  const monthCells = useMemo(
    () => buildPtMonthCalendarCells(viewYear, viewMonthIndex, focusByDate, notesByDate),
    [viewYear, viewMonthIndex, focusByDate, notesByDate],
  );
  const dailyMonthCells = useMemo(
    () => buildPtMonthCalendarCells(viewYear, viewMonthIndex, dailyFocusMap, notesByDate),
    [viewYear, viewMonthIndex, dailyFocusMap, notesByDate],
  );
  const ptDaysThisMonth = monthCells.filter(
    (c) => c.kind === "day" && !c.isSunday && c.hasFocus,
  ).length;
  const selectedIsScheduled =
    selectedDayKey && focusByDate[selectedDayKey]
      ? Boolean(String(focusByDate[selectedDayKey]).trim())
      : false;
  const selectedHasNoteOnly =
    Boolean(selectedDayKey) &&
    !selectedIsScheduled &&
    Boolean(String(notesByDate[selectedDayKey || ""] || "").trim());
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
    if (!selectedDayKey || !canEditPtNotes) return;
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
  const dietImages = data?.dietImages || [];
  const showPtDiet =
    onPtPlan && ((data?.diets || []).length > 0 || dietImages.length > 0);
  const primaryDiet = (data?.diets || [])[0] || null;
  const dietPlanText = (() => {
    const plan = String(primaryDiet?.dietPlan || "").trim();
    if (plan) return plan;
    const title = String(primaryDiet?.title || "").trim();
    if (!title || title === "Diet plan from your trainer") return "";
    // Legacy/stub rows may only have title — strip trailing macro summary if present.
    return title.replace(/\s*\([^)]*(kcal|protein|water)[^)]*\)\s*$/i, "").trim() || title;
  })();
  const dietMacros = primaryDiet
    ? [
        primaryDiet.calories ? `${String(primaryDiet.calories)} kcal` : "",
        primaryDiet.protein ? `${String(primaryDiet.protein)} protein` : "",
        primaryDiet.water ? `${String(primaryDiet.water)} water` : "",
      ].filter(Boolean)
    : [];
  const activeDietImage = dietImages[dietImageIndex] || null;
  const dietIsNew = isWithinNewBadgeWindow(toBadgeStartMs(data?.dietUpdatedAt));
  const trainerChatIsNew = isWithinNewBadgeWindow(
    toBadgeStartMs(data?.latestTrainerChatAt),
  );

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden rounded-3xl border border-white/10 bg-charcoal/50 p-4 space-y-5 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <PortalBackButton onClick={onBack} />
        {onPtPlan ? (
          <button
            type="button"
            onClick={() => {
              setPtChatOpen(true);
              void loadPtChat();
            }}
            className="relative shrink-0 touch-manipulation rounded-full border border-gold/45 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold"
          >
            Chat
            {trainerChatIsNew ? (
              <span className="ml-1.5 inline-flex rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">
                New
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
      <div>
        <h2 className="font-display text-2xl text-white">Training</h2>
        {data?.planName ? (
          <p className="mt-1 text-xs text-muted">
            Plan · <span className="text-white/85">{data.planName}</span>
            {onPtPlan
              ? " · Your PT schedule days"
              : " · Log your own workouts"}
          </p>
        ) : null}
      </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-white/75">
            View the diet plan and photos your trainer added under Diet Plan Documents.
          </p>
          {dietIsNew ? (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
              New
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dietPlanText}
            onClick={() => setDietTextOpen(true)}
            className="min-h-11 flex-1 touch-manipulation rounded-full gold-gradient px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40 sm:flex-none"
          >
            View your Diet
          </button>
          <button
            type="button"
            disabled={!dietImages.length}
            onClick={() => {
              setDietImageIndex(0);
              setDietImageOpen(true);
            }}
            className="relative min-h-11 flex-1 touch-manipulation rounded-full border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold disabled:opacity-40 sm:flex-none"
          >
            Diet Image{dietImages.length > 1 ? ` (${dietImages.length})` : ""}
            {dietIsNew && dietImages.length ? (
              <span className="ml-1 inline-flex rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">
                New
              </span>
            ) : null}
          </button>
        </div>
        {!dietPlanText && !dietImages.length ? (
          <p className="mt-2 text-xs text-muted">No diet plan assigned yet.</p>
        ) : null}
        {!dietPlanText && dietImages.length ? (
          <p className="mt-2 text-xs text-muted">Diet text not set — open Diet Image for photos.</p>
        ) : null}
        {dietPlanText && !dietImages.length ? (
          <p className="mt-2 text-xs text-muted">No diet photos attached yet.</p>
        ) : null}
      </Block>
      ) : null}

      {onPtPlan && ptChatOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pt-chat-title"
          onClick={() => setPtChatOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gold/35 bg-charcoal shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  Trainer
                </p>
                <h3 id="pt-chat-title" className="font-display text-xl text-white">
                  Chat
                </h3>
                <p className="mt-0.5 text-[11px] text-muted">
                  Messages sync with Gym Manager → Chat Trainer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPtChatOpen(false)}
                className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80"
              >
                Close
              </button>
            </div>
            <div
              ref={ptChatScrollRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3"
            >
              {ptChatLoading && !ptChatMessages.length ? (
                <p className="text-xs text-muted">Loading chat…</p>
              ) : null}
              {ptChatMessages.map((m) => {
                const fromMember = m.from === "member";
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      fromMember
                        ? "ml-6 bg-gold/15 text-white"
                        : "mr-6 border border-white/10 bg-white/[0.04] text-white/90"
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {fromMember ? "You" : m.by || "Trainer"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap">{m.text}</p>
                    {m.ts ? (
                      <p className="mt-1 text-[10px] text-muted">
                        {new Date(String(m.ts).replace(" ", "T")).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {!ptChatLoading && !ptChatMessages.length ? (
                <p className="text-xs text-muted">No messages yet — say hello to your trainer.</p>
              ) : null}
            </div>
            <div className="border-t border-white/10 px-4 py-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={ptChatText}
                  onChange={(e) => setPtChatText(e.target.value)}
                  placeholder="Write to your trainer…"
                  disabled={ptChatBusy}
                  className="min-h-11 flex-1 rounded-xl border border-white/12 bg-black/50 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendPtChat();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={ptChatBusy || !ptChatText.trim()}
                  onClick={() => void sendPtChat()}
                  className="min-h-11 shrink-0 rounded-full gold-gradient px-4 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {ptChatBusy ? "…" : "Send"}
                </button>
              </div>
              {ptChatError ? <p className="text-xs text-red-300">{ptChatError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {dietTextOpen && dietPlanText ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="diet-text-title"
          onClick={() => setDietTextOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gold/35 bg-charcoal p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                  Diet plan
                </p>
                <h3 id="diet-text-title" className="mt-1 font-display text-2xl text-white">
                  Your diet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDietTextOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            {dietMacros.length ? (
              <p className="mt-3 text-xs text-gold/90">{dietMacros.join(" · ")}</p>
            ) : null}
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/90 select-none">
              {dietPlanText}
            </p>
          </div>
        </div>
      ) : null}

      {dietImageOpen && activeDietImage ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Diet images"
          onClick={() => setDietImageOpen(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {activeDietImage.name || "Diet image"}
              </p>
              <p className="text-[11px] text-muted">
                {dietImageIndex + 1} / {dietImages.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDietImageOpen(false)}
              className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/85"
            >
              Close
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- inline trainer data URLs */}
            <img
              src={activeDietImage.dataUrl}
              alt={activeDietImage.name || "Diet plan document"}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="max-h-full max-w-full select-none object-contain"
              style={{ WebkitUserSelect: "none", userSelect: "none" }}
            />
          </div>
          <div
            className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={dietImages.length < 2}
              onClick={() =>
                setDietImageIndex((i) =>
                  dietImages.length ? (i - 1 + dietImages.length) % dietImages.length : 0,
                )
              }
              className="min-h-11 flex-1 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={dietImages.length < 2}
              onClick={() =>
                setDietImageIndex((i) =>
                  dietImages.length ? (i + 1) % dietImages.length : 0,
                )
              }
              className="min-h-11 flex-1 rounded-full gold-gradient px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <p className="px-4 pb-4 text-center text-[10px] leading-relaxed text-white/45">
            Screenshots cannot be fully blocked on phones. Please keep your diet plan private.
          </p>
        </div>
      ) : null}

      {showMeasurements ? (
      <Block title="Measurements" empty="No measurements yet.">
        {firstAndLatestMeasurements(data?.measurements || []).map(({ label, m }) => (
          <p key={String(m.id)} className="text-sm text-white/85">
            <span className="text-muted">{label}: </span>
            {formatDate(String(m.measured_at))} ·{" "}
            {m.weight_kg != null ? `${m.weight_kg} kg` : "—"}
            {m.body_fat_pct != null ? ` · ${m.body_fat_pct}% bf` : ""}
          </p>
        ))}
        {(data?.measurements || []).length > 2 ? (
          <p className="text-xs text-muted">
            Full history is in the Weight Tracker.
          </p>
        ) : null}
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
              Green = PT · Amber = NT (notes, no PT) · Rose = open.
              {canEditPtNotes
                ? " Tap any day to add + Notes."
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
                      entry.isSunday && entry.mark == null
                        ? "border-white/10 bg-white/5 text-muted"
                        : entry.mark === "pt"
                          ? "border-emerald-400/50 bg-emerald-950/40 text-emerald-200"
                          : entry.mark === "nt"
                            ? "border-amber-400/50 bg-amber-950/40 text-amber-100"
                            : "border-rose-400/40 bg-rose-950/35 text-rose-200",
                      selectedDayKey === entry.key ? "ring-2 ring-sky-400" : "",
                    ].join(" ")}
                    title={
                      entry.mark === "pt"
                        ? showPtWorkoutDetails && entry.focus && entry.focus !== "scheduled"
                          ? `${entry.key}: ${entry.focus}`
                          : `${entry.key}: PT day`
                        : entry.mark === "nt"
                          ? `${entry.key}: Notes (no PT)`
                          : `${entry.key}: Open`
                    }
                  >
                    <div className="font-semibold">{entry.day}</div>
                    {showPtWorkoutDetails ? (
                      <div className="mt-0.5 truncate">
                        {entry.mark === "pt" && entry.focus && entry.focus !== "scheduled"
                          ? entry.focus
                          : entry.mark === "pt"
                            ? "PT"
                            : entry.mark === "nt"
                              ? "NT"
                              : entry.isSunday
                                ? "Sun"
                                : "—"}
                      </div>
                    ) : (
                      <div className="mt-0.5 truncate">
                        {entry.mark === "pt"
                          ? "PT"
                          : entry.mark === "nt"
                            ? "NT"
                            : entry.isSunday
                              ? "Sun"
                              : "—"}
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
                    : selectedHasNoteOnly
                      ? "Notes day (no PT)"
                      : "No PT session this day"}
                </p>
                {canEditPtNotes ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
                      + Notes
                    </p>
                    <textarea
                      rows={2}
                      className="box-border block w-full min-w-0 max-w-full resize-none rounded-xl border border-white/12 bg-black/50 px-3 py-3 text-base leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-gold/40 sm:text-sm"
                      value={ptNotes}
                      onChange={(e) => setPtNotes(e.target.value)}
                      placeholder={
                        selectedIsScheduled
                          ? "Your notes for this PT day…"
                          : "Add a note for this day (shows as NT if no PT)…"
                      }
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
  memberUuid = "",
  liveTick: _liveTick = 0,
}: {
  onBack: () => void;
  memberUuid?: string;
  liveTick?: number;
}) {
  type BookingsData = {
    slots: Array<{ id: string; title: string; starts_at: string; capacity: number }>;
    mine: Array<{ slot_id: string; status: string }>;
  };

  const [slots, setSlots] = useState<BookingsData["slots"]>(() => {
    const cached = readBookingsCache<BookingsData>(memberUuid);
    return cached?.slots || [];
  });
  const [mine, setMine] = useState<BookingsData["mine"]>(() => {
    const cached = readBookingsCache<BookingsData>(memberUuid);
    return cached?.mine || [];
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(
    () => !readBookingsCache(memberUuid),
  );

  const applyBookings = useCallback(
    (next: BookingsData) => {
      setSlots(next.slots || []);
      setMine(next.mine || []);
      writeBookingsCache(memberUuid, next);
      setError(null);
      setInitialLoad(false);
    },
    [memberUuid],
  );

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      if (!force) {
        const peek = peekBookingsCache<BookingsData>(memberUuid);
        if (peek && peek.ageMs < PANEL_SOFT_TTL_MS) return peek.data;
      }
      const data = await api<{
        ok: true;
        slots: BookingsData["slots"];
        myBookings: BookingsData["mine"];
      }>("/api/member/bookings");
      const next = {
        slots: data.slots || [],
        mine: data.myBookings || [],
      };
      applyBookings(next);
      return next;
    },
    [applyBookings, memberUuid],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readBookingsCache<BookingsData>(memberUuid);
    if (cached) applyBookings(cached);

    const pull = (force: boolean) => {
      void load({ force }).catch((e) => {
        if (!cancelled && !readBookingsCache(memberUuid)) {
          setError(e instanceof Error ? e.message : "Load failed");
          setInitialLoad(false);
        }
      });
    };

    pull(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, memberUuid, applyBookings]);

  async function book(slotId: string) {
    setBusy(slotId);
    setError(null);
    try {
      await api("/api/member/bookings", {
        method: "POST",
        body: JSON.stringify({ slotId }),
      });
      await load({ force: true });
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
      {initialLoad && !slots.length ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : (
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
            <li className="text-sm text-muted">
              No upcoming classes yet. Ask the gym to publish slots.
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

type PerksData = {
  locker: { locker_code: string; status: string } | null;
  referral: {
    code: string;
    points: number;
    lifetimePoints?: number;
    pendingCreditInr?: number;
  } | null;
};

export function PerksPanel({
  onBack,
  memberUuid = "",
  liveTick: _liveTick = 0,
  requestLockerEnabled = true,
}: {
  onBack: () => void;
  memberUuid?: string;
  /** Kept for call-site compat; Perks uses cache + soft TTL instead of liveTick polling. */
  liveTick?: number;
  /** From Settings → Member Portal → Home tiles → Request locker. */
  requestLockerEnabled?: boolean;
}) {
  const [data, setData] = useState<PerksData | null>(() =>
    readPerksCache<PerksData>(memberUuid),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(() => !readPerksCache(memberUuid));

  const applyPerks = useCallback(
    (res: PerksData) => {
      setData(res);
      writePerksCache(memberUuid, res);
      setError(null);
      setInitialLoad(false);
    },
    [memberUuid],
  );

  const reload = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;
      if (!force) {
        const peek = peekPerksCache<PerksData>(memberUuid);
        if (peek && peek.ageMs < PANEL_SOFT_TTL_MS) return peek.data;
      }
      const res = await api<PerksData & { ok: true }>("/api/member/perks");
      applyPerks({
        locker: res.locker || null,
        referral: res.referral || null,
      });
      return res;
    },
    [applyPerks, memberUuid],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readPerksCache<PerksData>(memberUuid);
    if (cached) applyPerks(cached);

    const pull = (force: boolean) => {
      void reload({ force }).catch((e) => {
        if (!cancelled && !readPerksCache(memberUuid)) {
          setError(e instanceof Error ? e.message : "Load failed");
          setInitialLoad(false);
        }
      });
    };

    pull(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, memberUuid, applyPerks]);

  async function requestLocker() {
    if (!requestLockerEnabled) {
      setError("Locker requests are currently disabled.");
      return;
    }
    try {
      const res = await api<{ ok: true; message?: string }>("/api/member/perks", {
        method: "POST",
        body: JSON.stringify({ note: "Please assign a locker" }),
      });
      setMsg(res.message || "Request sent.");
      await reload({ force: true });
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
      {initialLoad && !data ? <p className="text-sm text-muted">Loading…</p> : null}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Locker</p>
        {data?.locker ? (
          <p className="mt-1 text-white">
            {data.locker.locker_code} · {data.locker.status}
          </p>
        ) : !initialLoad && requestLockerEnabled ? (
          <button
            type="button"
            onClick={() => void requestLocker()}
            className="mt-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold"
          >
            Request locker
          </button>
        ) : !initialLoad && !requestLockerEnabled ? (
          <p className="mt-1 text-sm text-muted">Locker requests are currently unavailable.</p>
        ) : null}
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
      // mode=local uses device fingerprint via GMS FIDO2 (not Android Credential Manager).
      const opt = await api<{
        ok: true;
        options: Parameters<typeof startRegistration>[0]["optionsJSON"];
      }>("/api/member/auth/webauthn/register?mode=local");
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
        On Android use Chrome (not WhatsApp/Instagram). Register while signed in, then
        use Login with biometric next time.
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

type WeightTrend = "down" | "up" | "same" | "first";

function formatWeightDate(iso: string) {
  const key = String(iso || "").slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key || "—";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Latest weight per YYYY-MM-DD (logs are newest-first). */
function weightByDateMap(logs: WeightLog[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const log of logs) {
    const key = String(log.date || "").slice(0, 10);
    if (!key || log.weightKg == null || !Number.isFinite(log.weightKg)) continue;
    if (!(key in out)) out[key] = Number(log.weightKg);
  }
  return out;
}

/** Compare each date to the previous logged date (ascending). */
function weightTrendByDate(byDate: Record<string, number>): Record<string, WeightTrend> {
  const keys = Object.keys(byDate).sort();
  const out: Record<string, WeightTrend> = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (i === 0) {
      out[key] = "first";
      continue;
    }
    const prev = byDate[keys[i - 1]];
    const cur = byDate[key];
    if (cur < prev) out[key] = "down";
    else if (cur > prev) out[key] = "up";
    else out[key] = "same";
  }
  return out;
}

type WeightCachePayload = {
  canEdit: boolean;
  logs: WeightLog[];
  currentKg: number | null;
  changeKg: number | null;
  today: string;
};

/** Member Weight Tracker — shared with Gym Manager (Basic + PT). */
export function WeightTrackerPanel({
  onBack,
  memberUuid = "",
}: {
  onBack: () => void;
  memberUuid?: string;
}) {
  const cached0 = readWeightCache<WeightCachePayload>(memberUuid);
  const [logs, setLogs] = useState<WeightLog[]>(() => cached0?.logs || []);
  const [canEdit, setCanEdit] = useState(() => cached0?.canEdit !== false);
  const [date, setDate] = useState(() => cached0?.today || "");
  const [weight, setWeight] = useState("");
  const [currentKg, setCurrentKg] = useState<number | null>(() => cached0?.currentKg ?? null);
  const [changeKg, setChangeKg] = useState<number | null>(() => cached0?.changeKg ?? null);
  const [busy, setBusy] = useState(false);
  const [initialLoad, setInitialLoad] = useState(() => !cached0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<null | { kind: "loss" | "gain" | "same"; delta: number }>(
    null,
  );
  const initialParts = parsePtDateKey(cached0?.today) || {
    year: new Date().getFullYear(),
    monthIndex: new Date().getMonth(),
    day: new Date().getDate(),
  };
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonthIndex, setViewMonthIndex] = useState(initialParts.monthIndex);

  const byDate = useMemo(() => weightByDateMap(logs), [logs]);
  const trendByDate = useMemo(() => weightTrendByDate(byDate), [byDate]);
  const calendarCells = useMemo(() => {
    const focus: Record<string, string> = {};
    for (const [k, v] of Object.entries(byDate)) focus[k] = String(v);
    return buildPtMonthCalendarCells(viewYear, viewMonthIndex, focus, {});
  }, [viewYear, viewMonthIndex, byDate]);

  const selectedWeight = date && byDate[date] != null ? byDate[date] : null;
  const selectedTrend = date ? trendByDate[date] : null;

  const applyWeight = useCallback(
    (data: WeightCachePayload, opts?: { keepSelectedDate?: boolean }) => {
      setCanEdit(Boolean(data.canEdit));
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setCurrentKg(data.currentKg);
      setChangeKg(data.changeKg);
      const today = data.today || "";
      if (!opts?.keepSelectedDate) {
        setDate((prev) => prev || today);
      }
      const parts = parsePtDateKey(today);
      if (parts) {
        setViewYear((y) => y || parts.year);
        setViewMonthIndex((m) => (Number.isFinite(m) ? m : parts.monthIndex));
      }
      writeWeightCache(memberUuid, data);
      setError(null);
      setInitialLoad(false);
    },
    [memberUuid],
  );

  const reload = useCallback(
    async (opts?: { force?: boolean; keepSelectedDate?: boolean }) => {
      const force = opts?.force === true;
      if (!force) {
        const peek = peekWeightCache<WeightCachePayload>(memberUuid);
        if (peek && peek.ageMs < PANEL_SOFT_TTL_MS) return peek.data;
      }
      const data = await api<{
        ok: true;
        canEdit: boolean;
        logs: WeightLog[];
        currentKg: number | null;
        changeKg: number | null;
        today: string;
      }>("/api/member/weight");
      const payload: WeightCachePayload = {
        canEdit: Boolean(data.canEdit),
        logs: Array.isArray(data.logs) ? data.logs : [],
        currentKg: data.currentKg,
        changeKg: data.changeKg,
        today: data.today || "",
      };
      applyWeight(payload, { keepSelectedDate: opts?.keepSelectedDate });
      return payload;
    },
    [applyWeight, memberUuid],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readWeightCache<WeightCachePayload>(memberUuid);
    if (cached) applyWeight(cached);

    const pull = (force: boolean) => {
      void reload({ force, keepSelectedDate: true }).catch((e) => {
        if (!cancelled && !readWeightCache(memberUuid)) {
          setError(e instanceof Error ? e.message : "Could not load weight");
          setInitialLoad(false);
        }
      });
    };

    pull(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, memberUuid, applyWeight]);

  function shiftMonth(delta: number) {
    const dt = new Date(viewYear, viewMonthIndex + delta, 1);
    setViewYear(dt.getFullYear());
    setViewMonthIndex(dt.getMonth());
  }

  async function addWeight() {
    if (!canEdit || busy) return;
    const kg = Number(String(weight).trim());
    if (!Number.isFinite(kg) || kg <= 0) {
      setError("Enter a valid weight in kg.");
      return;
    }
    if (!date) {
      setError("Pick a date on the calendar.");
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
      await reload({ force: true, keepSelectedDate: true });
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
          Tap a calendar day to log weight. Green = down from last log, red = up.
        </p>
      </div>

      {initialLoad && !logs.length ? <p className="text-sm text-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {canEdit ? (
        <>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80"
              >
                Prev
              </button>
              <p className="text-sm font-semibold text-white">
                {PT_MONTH_LABELS[viewMonthIndex]} {viewYear}
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80"
              >
                Next
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted">
              {PT_WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell) => {
                if (cell.kind === "pad") {
                  return <div key={cell.key} className="aspect-square" />;
                }
                const kg = byDate[cell.key];
                const trend = trendByDate[cell.key];
                const selected = date === cell.key;
                const tone =
                  trend === "down"
                    ? "border-emerald-400/50 bg-emerald-500/25 text-emerald-100"
                    : trend === "up"
                      ? "border-rose-400/50 bg-rose-500/25 text-rose-100"
                      : kg != null
                        ? "border-gold/35 bg-gold/15 text-white"
                        : "border-white/10 bg-black/40 text-white/70";
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => {
                      setDate(cell.key);
                      if (kg != null) setWeight(String(kg));
                      else setWeight("");
                    }}
                    className={`aspect-square rounded-xl border text-[11px] font-medium leading-tight touch-manipulation ${tone} ${
                      selected ? "ring-2 ring-gold" : ""
                    }`}
                    title={kg != null ? `${kg} kg` : "Add weight"}
                  >
                    <span className="block">{cell.day}</span>
                    {kg != null ? (
                      <span className="mt-0.5 block text-[9px] opacity-90">{kg}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] leading-relaxed text-muted">
              <span className="text-emerald-300">Green</span> = weight down ·{" "}
              <span className="text-rose-300">Red</span> = weight up · Gold = first / same
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-3.5 sm:p-5">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90">
                Selected day
              </p>
              <p className="text-sm text-white">
                {date ? formatWeightDate(date) : "—"}
                {selectedWeight != null ? (
                  <span className="text-muted">
                    {" "}
                    · logged {selectedWeight} kg
                    {selectedTrend === "down"
                      ? " (↓)"
                      : selectedTrend === "up"
                        ? " (↑)"
                        : ""}
                  </span>
                ) : (
                  <span className="text-muted"> · no log yet</span>
                )}
              </p>
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
                disabled={busy || !date}
              />
            </div>
            <button
              type="button"
              disabled={busy || !weight.trim() || !date}
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
        </>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-muted">
          Weight logging is temporarily unavailable. Pull to refresh or try again shortly.
        </p>
      )}

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
