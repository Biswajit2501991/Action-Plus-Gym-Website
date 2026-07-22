"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, QrCode, Smartphone, User } from "lucide-react";
import {
  AttendancePanel,
  BiometricPanel,
  BookingsPanel,
  ChatPanel,
  NotificationsPanel,
  PaymentsPanel,
  PerksPanel,
  TrainingPanel,
} from "@/components/members/MemberPortalPhase2Panels";
import { PortalBackButton } from "@/components/members/PortalBackButton";
import { hasUnreadStaffChat } from "@/lib/member-portal/chat-client";

const IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours

type MemberMe = {
  memberUuid: string;
  memberCode: string;
  fullName: string;
  mobile: string;
  email: string | null;
  dob: string | null;
  status: string;
  planName: string | null;
  amount: number | null;
  joiningDate: string | null;
  billingDate: string | null;
  nextPaymentDate: string | null;
  paymentBy: string | null;
  remainingDays: number | null;
  branch: string | null;
  photoUrl: string | null;
  emergencyContact: string | null;
  bloodGroup: string | null;
  hasPin: boolean;
  portalStatus: string;
};

type QrCard = {
  memberCode: string;
  fullName: string;
  status: string;
  planName: string | null;
  branch: string | null;
  paymentBy: string | null;
  nextPaymentDate: string | null;
  photoUrl: string | null;
  qrPayload: string;
};

type Device = {
  id: string;
  deviceId: string;
  label: string | null;
  lastSeenAt: string;
  current: boolean;
};

type Step =
  | "mobile"
  | "waiting"
  | "setPin"
  | "pinLogin"
  | "home"
  | "profile"
  | "card"
  | "devices"
  | "payments"
  | "attendance"
  | "notifications"
  | "chat"
  | "training"
  | "bookings"
  | "perks"
  | "biometric";

function deviceStorageKey() {
  return "apg_member_device_id";
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(deviceStorageKey());
  if (!id) {
    id =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    localStorage.setItem(deviceStorageKey(), id);
  }
  return id;
}

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
    throw new Error(
      (data as { message?: string }).message ||
        (data as { error?: string }).error ||
        `Request failed (${res.status})`,
    );
  }
  return data;
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

export function MemberPortalApp() {
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [whatsappAppUrl, setWhatsappAppUrl] = useState("");
  const [messageText, setMessageText] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<MemberMe | null>(null);
  const [card, setCard] = useState<QrCard | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [booting, setBooting] = useState(true);
  const [waitNote, setWaitNote] = useState("Waiting for gym staff to approve…");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [authMethod, setAuthMethod] = useState<"whatsapp_staff" | "auto_identity">(
    "whatsapp_staff",
  );
  const [fullName, setFullName] = useState("");
  const [identityFactor, setIdentityFactor] = useState<"dob" | "email">("dob");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [chatUnread, setChatUnread] = useState(false);

  const [liveTick, setLiveTick] = useState(0);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ ok: true; authMethod: "whatsapp_staff" | "auto_identity" }>(
      "/api/member/auth/method",
    )
      .then((data) => {
        if (!cancelled && data.authMethod === "auto_identity") {
          setAuthMethod("auto_identity");
        }
      })
      .catch(() => {
        /* keep default WhatsApp */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshChatUnread = useCallback(async () => {
    if (!member?.memberUuid) {
      setChatUnread(false);
      return;
    }
    try {
      const data = await api<{
        ok: true;
        latestStaffAt: string | null;
        latestStaffId?: string | null;
        latestStaffAtMs?: number | null;
        memberUuid: string;
      }>("/api/member/chat/unread");
      const uuid = data.memberUuid || member.memberUuid;
      const unread = hasUnreadStaffChat(
        uuid,
        data.latestStaffAtMs != null
          ? String(data.latestStaffAtMs)
          : data.latestStaffAt,
        data.latestStaffId,
      );
      setChatUnread(unread);
    } catch {
      /* ignore badge errors */
    }
  }, [member?.memberUuid]);

  useEffect(() => {
    if (!member?.memberUuid || step === "chat") {
      if (step === "chat") setChatUnread(false);
      return;
    }
    void refreshChatUnread();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshChatUnread();
    }, 8_000);
    return () => window.clearInterval(id);
  }, [member?.memberUuid, step, refreshChatUnread, liveTick]);

  /** Soft refresh — updates member data without forcing navigation to home. */
  const refreshMember = useCallback(async () => {
    const data = await api<{ ok: true; member: MemberMe }>("/api/member/me");
    setMember((prev) => {
      const next = data.member;
      if (prev && JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });
    setLiveTick((t) => t + 1);
    return data.member;
  }, []);

  const loadMe = useCallback(async () => {
    await refreshMember();
    setStep("home");
  }, [refreshMember]);

  const signOutIdle = useCallback(async () => {
    try {
      await api("/api/member/auth/logout", { method: "POST", body: "{}" });
    } catch {
      /* ignore */
    }
    setMember(null);
    setCard(null);
    setDevices([]);
    setStep("mobile");
    setError("Signed out after 2 hours of inactivity. Please sign in again.");
  }, []);

  // Track activity and auto-logout after 2 hours idle while signed in.
  useEffect(() => {
    if (!member) return;
    let last = Date.now();
    const mark = () => {
      last = Date.now();
    };
    const windowEvents = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    for (const ev of windowEvents) window.addEventListener(ev, mark, { passive: true });
    document.addEventListener("visibilitychange", mark);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - last >= IDLE_MS) void signOutIdle();
    }, 30_000);
    return () => {
      for (const ev of windowEvents) window.removeEventListener(ev, mark);
      document.removeEventListener("visibilitychange", mark);
      window.clearInterval(timer);
    };
  }, [member, signOutIdle]);

  // Live sync: poll while signed in + refresh when app returns to foreground.
  useEffect(() => {
    if (!member) return;
    let cancelled = false;
    const pull = async () => {
      try {
        await refreshMember();
        if (cancelled) return;
        if (step === "card") {
          const data = await api<{ ok: true; card: QrCard }>("/api/member/qr");
          if (!cancelled) setCard(data.card);
        }
        if (step === "devices") {
          const data = await api<{ ok: true; devices: Device[] }>("/api/member/devices");
          if (!cancelled) setDevices(data.devices || []);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/revoked|expired|Unauthorized|Session|inactivity/i.test(msg)) {
          setMember(null);
          setStep("mobile");
          setError(msg || "Session expired. Please sign in again.");
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void pull();
    }, 15_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [member, refreshMember, step]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadMe();
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "";
          if (/revoked|expired|Unauthorized|Session|inactivity/i.test(msg)) {
            setNeedsReauth(true);
            setError(
              /revoked/i.test(msg)
                ? "Access was revoked by the gym. Verify via WhatsApp again."
                : /inactivity/i.test(msg)
                  ? msg
                  : null,
            );
          }
          setStep("mobile");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  function openWhatsAppLinks(webUrl: string, appUrl?: string) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const target = isMobile && appUrl ? appUrl : webUrl;
    if (!target) return;
    // Direct open — primary goal is WhatsApp handoff after Verify click.
    const opened = window.open(target, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(target);
    }
  }

  // Poll staff approval while waiting
  useEffect(() => {
    if (step !== "waiting" || !challengeId || !mobile) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api<{
          ok: true;
          status: string;
          hasPin: boolean;
        }>(
          `/api/member/auth/otp/status?challengeId=${encodeURIComponent(challengeId)}&mobile=${encodeURIComponent(mobile)}`,
        );
        if (cancelled) return;
        if (data.status === "approved") {
          setWaitNote("Approved — signing you in…");
          const done = await api<{ ok: true; needsPin: boolean }>(
            "/api/member/auth/otp/complete",
            {
              method: "POST",
              body: JSON.stringify({ mobile, challengeId, deviceId }),
            },
          );
          if (done.needsPin) setStep("setPin");
          else await loadMe();
          return;
        }
        if (data.status === "rejected") {
          setError("Verification was declined. Contact the gym or try again.");
          setStep("mobile");
          return;
        }
        if (data.status === "expired") {
          setError("Verification expired. Please request again.");
          setStep("mobile");
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, challengeId, mobile, deviceId, loadMe]);

  const greeting = useMemo(() => {
    const name = member?.fullName?.split(" ")[0] || "Member";
    return `Hello ${name}`;
  }, [member]);

  async function requestVerify() {
    setError(null);
    setBusy(true);
    try {
      const data = await api<{
        ok: true;
        challengeId: string;
        deviceId: string;
        whatsappUrl: string;
        whatsappAppUrl?: string;
        messageText?: string;
        hasPin: boolean;
      }>("/api/member/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ mobile, deviceId }),
      });
      setChallengeId(data.challengeId);
      setDeviceId(data.deviceId || deviceId);
      setWhatsappUrl(data.whatsappUrl || "");
      setWhatsappAppUrl(data.whatsappAppUrl || "");
      setMessageText(data.messageText || "");
      setCopied(false);
      setNeedsReauth(false);
      setWaitNote("Waiting for gym staff to approve…");
      setStep("waiting");
      openWhatsAppLinks(data.whatsappUrl || "", data.whatsappAppUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start verification");
    } finally {
      setBusy(false);
    }
  }

  async function requestAutoVerify() {
    setError(null);
    const name = fullName.trim();
    if (name.length < 2) {
      setError("Enter your name as registered at the gym.");
      return;
    }
    if (identityFactor === "dob" && !dob.trim()) {
      setError("Enter date of birth as DD/MM/YYYY.");
      return;
    }
    if (identityFactor === "email" && !email.trim()) {
      setError("Enter your registered Gmail / email.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{
        ok: true;
        challengeId: string;
        deviceId: string;
        hasPin: boolean;
        needsPin: boolean;
      }>("/api/member/auth/auto/verify", {
        method: "POST",
        body: JSON.stringify({
          mobile,
          fullName: name,
          dob: identityFactor === "dob" ? dob.trim() : undefined,
          email: identityFactor === "email" ? email.trim() : undefined,
          deviceId,
        }),
      });
      setChallengeId(data.challengeId);
      setDeviceId(data.deviceId || deviceId);
      setNeedsReauth(false);
      setPin("");
      setConfirmPin("");
      if (data.needsPin || !data.hasPin) {
        setStep("setPin");
      } else {
        setStep("pinLogin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify details");
    } finally {
      setBusy(false);
    }
  }

  async function setPinSubmit() {
    setError(null);
    if (pin.length !== 6) {
      setError("Enter a 6-digit PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PIN and Confirm PIN do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/member/auth/pin/set", {
        method: "POST",
        body: JSON.stringify({ mobile, pin, challengeId, deviceId }),
      });
      setConfirmPin("");
      await loadMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set PIN");
    } finally {
      setBusy(false);
    }
  }

  async function pinLogin() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/member/auth/pin/login", {
        method: "POST",
        body: JSON.stringify({ mobile, pin, deviceId }),
      });
      await loadMe();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PIN login failed";
      setError(msg);
      if (/revoked|Verify via WhatsApp|PIN not set/i.test(msg)) {
        setNeedsReauth(true);
        setStep("mobile");
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await api("/api/member/auth/logout", { method: "POST", body: "{}" });
    } catch {
      /* ignore */
    }
    setMember(null);
    setCard(null);
    setPin("");
    setStep("mobile");
    setBusy(false);
  }

  async function openCard() {
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ ok: true; card: QrCard }>("/api/member/qr");
      setCard(data.card);
      setStep("card");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load card");
    } finally {
      setBusy(false);
    }
  }

  async function openDevices() {
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ ok: true; devices: Device[] }>("/api/member/devices");
      setDevices(data.devices);
      setStep("devices");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load devices");
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/member/devices?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await openDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove device");
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">
        Loading member portal…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 pb-16 pt-8">
      {error ? (
        <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {step === "mobile" ||
      step === "waiting" ||
      step === "setPin" ||
      step === "pinLogin" ? (
        <div className="rounded-3xl border border-white/10 bg-charcoal/60 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Member Portal
          </p>
          <h1 className="mt-2 font-display text-3xl text-white">Sign in securely</h1>
          <p className="mt-2 text-sm text-muted">
            {authMethod === "auto_identity"
              ? "Enter your registered mobile, name, and DOB or Gmail. Then set a 6-digit PIN for next visits."
              : "First time: gym staff verifies your number on WhatsApp. Then you set a 6-digit PIN for next visits."}
          </p>
          {needsReauth ? (
            <p className="mt-3 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
              Your portal access was revoked.{" "}
              {authMethod === "auto_identity" ? (
                <>Verify your details again to re-authenticate.</>
              ) : (
                <>
                  Tap <strong>Verify via gym WhatsApp</strong> to re-authenticate.
                </>
              )}
            </p>
          ) : null}

          {(step === "mobile" || step === "pinLogin") && (
            <label className="mt-6 block text-sm text-white/80">
              Mobile number
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-gold/50"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit registered mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </label>
          )}

          {step === "mobile" && authMethod === "auto_identity" ? (
            <div className="mt-4 space-y-4">
              <label className="block text-sm text-white/80">
                Name (as given in gym)
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 lowercase text-white outline-none focus:border-gold/50"
                  autoComplete="name"
                  placeholder="Full name as registered"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value.toLowerCase())}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIdentityFactor("dob")}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-medium ${
                    identityFactor === "dob"
                      ? "bg-gold/20 text-gold border border-gold/40"
                      : "border border-white/15 text-white/70"
                  }`}
                >
                  Date of birth
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityFactor("email")}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-medium ${
                    identityFactor === "email"
                      ? "bg-gold/20 text-gold border border-gold/40"
                      : "border border-white/15 text-white/70"
                  }`}
                >
                  Gmail
                </button>
              </div>
              {identityFactor === "dob" ? (
                <label className="block text-sm text-white/80">
                  DOB (DD/MM/YYYY)
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-gold/50"
                    inputMode="numeric"
                    placeholder="25/01/1991"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </label>
              ) : (
                <label className="block text-sm text-white/80">
                  Gmail
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 lowercase text-white outline-none focus:border-gold/50"
                    type="email"
                    autoComplete="email"
                    placeholder="name@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  />
                </label>
              )}
            </div>
          ) : null}

          {step === "mobile" ? (
            <div className="mt-6 flex flex-col gap-3">
              {authMethod === "auto_identity" ? (
                <button
                  type="button"
                  disabled={
                    busy ||
                    mobile.replace(/\D/g, "").length < 10 ||
                    fullName.trim().length < 2 ||
                    (identityFactor === "dob" ? !dob.trim() : !email.trim())
                  }
                  onClick={() => void requestAutoVerify()}
                  className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {busy
                    ? "Verifying…"
                    : needsReauth
                      ? "Re-verify & continue"
                      : "Verify & continue"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || mobile.replace(/\D/g, "").length < 10}
                  onClick={requestVerify}
                  className="rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {busy
                    ? "Opening WhatsApp…"
                    : needsReauth
                      ? "Re-verify via WhatsApp"
                      : "Verify via gym WhatsApp"}
                </button>
              )}
              <button
                type="button"
                disabled={busy || mobile.replace(/\D/g, "").length < 10}
                onClick={() => {
                  setError(null);
                  setStep("biometric");
                }}
                className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/85 hover:border-gold/40"
              >
                Face ID / fingerprint
              </button>
              <button
                type="button"
                disabled={busy || mobile.replace(/\D/g, "").length < 10}
                onClick={() => {
                  setError(null);
                  setStep("pinLogin");
                }}
                className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/85 hover:border-gold/40"
              >
                Login with PIN
              </button>
            </div>
          ) : null}

          {step === "waiting" ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-white/85">{waitNote}</p>
              <p className="text-sm text-muted">
                WhatsApp should open with a pre-filled message to the gym. If it did not,
                use the button below. Staff can also approve in Gym Manager →{" "}
                <strong className="text-white/80">WhatsApp Verification</strong>.
              </p>
              <p className="text-xs text-muted">
                Gym WhatsApp: +91 70471 57510
              </p>
              <div className="flex flex-col gap-2">
                {whatsappUrl ? (
                  <button
                    type="button"
                    onClick={() => openWhatsAppLinks(whatsappUrl, whatsappAppUrl)}
                    className="block w-full rounded-full border border-gold/40 px-5 py-3 text-center text-sm text-gold hover:bg-gold/10"
                  >
                    Open WhatsApp message
                  </button>
                ) : null}
                {messageText ? (
                  <button
                    type="button"
                    className="w-full rounded-full border border-white/15 px-5 py-3 text-sm text-white/85 hover:border-gold/40"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(messageText);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 2000);
                      } catch {
                        setError("Could not copy — select the message manually below.");
                      }
                    }}
                  >
                    {copied ? "Copied!" : "Copy message for WhatsApp"}
                  </button>
                ) : null}
              </div>
              {messageText ? (
                <pre className="max-h-36 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap">
                  {messageText}
                </pre>
              ) : null}
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
                Checking approval…
              </div>
              <button
                type="button"
                className="w-full text-sm text-muted hover:text-gold"
                onClick={() => setStep("mobile")}
              >
                Cancel / change number
              </button>
            </div>
          ) : null}

          {step === "setPin" ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted">
                {authMethod === "auto_identity"
                  ? "Identity verified. Create a 6-digit PIN for faster next login."
                  : "Gym approved your number. Create a 6-digit PIN for faster next login."}
              </p>
              <label className="block text-sm text-white/80">
                PIN
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-gold/50"
                  inputMode="numeric"
                  maxLength={6}
                  type="password"
                  autoComplete="new-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>
              <label className="block text-sm text-white/80">
                Confirm PIN
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-gold/50"
                  inputMode="numeric"
                  maxLength={6}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </label>
              {confirmPin.length === 6 && pin !== confirmPin ? (
                <p className="text-center text-xs text-red-300">PINs do not match</p>
              ) : null}
              <button
                type="button"
                disabled={busy || pin.length !== 6 || confirmPin.length !== 6 || pin !== confirmPin}
                onClick={setPinSubmit}
                className="w-full rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save PIN & continue"}
              </button>
            </div>
          ) : null}

          {step === "pinLogin" ? (
            <div className="mt-6 space-y-4">
              <label className="block text-sm text-white/80">
                6-digit PIN
                <input
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-gold/50"
                  inputMode="numeric"
                  maxLength={6}
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>
              <button
                type="button"
                disabled={busy || pin.length !== 6}
                onClick={pinLogin}
                className="w-full rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                className="w-full text-sm text-muted hover:text-gold"
                onClick={() => setStep("mobile")}
              >
                {authMethod === "auto_identity"
                  ? "Verify with details instead"
                  : "Verify via gym WhatsApp instead"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!member && step === "biometric" ? (
        <BiometricPanel
          onBack={() => setStep("mobile")}
          mobile={mobile}
          deviceId={deviceId}
          onLoggedIn={() => void loadMe()}
        />
      ) : null}

      {member &&
      (step === "home" ||
        step === "profile" ||
        step === "card" ||
        step === "devices" ||
        step === "payments" ||
        step === "attendance" ||
        step === "notifications" ||
        step === "chat" ||
        step === "training" ||
        step === "bookings" ||
        step === "perks" ||
        step === "biometric") ? (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Action Plus Gym
              </p>
              <h1 className="mt-1 font-display text-3xl text-white">{greeting}</h1>
              <p className="mt-1 text-sm text-muted">{member.memberCode}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-white/15 p-2.5 text-white/70 hover:border-gold/40 hover:text-gold"
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>

          {step === "home" ? (
            <>
              <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
                <div className="flex items-start gap-4">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photoUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-gold/40"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-gold ring-1 ring-white/10">
                      <User size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">
                      Today&apos;s status
                    </p>
                    <p className="mt-1 font-display text-2xl text-gold">{member.status}</p>
                    <p className="mt-0.5 truncate text-sm text-white/70">{member.fullName}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted">Plan</p>
                    <p className="text-white">{member.planName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted">Remaining</p>
                    <p className="text-white">
                      {member.remainingDays == null
                        ? "—"
                        : member.remainingDays >= 0
                          ? `${member.remainingDays} days`
                          : `${Math.abs(member.remainingDays)} days overdue`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">Next Payment Date</p>
                    <p className="text-white">
                      {formatDate(member.nextPaymentDate || member.billingDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">Branch</p>
                    <p className="text-white">{member.branch || "—"}</p>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-3 gap-2">
                <NavTile icon={<User size={18} />} label="Profile" onClick={() => setStep("profile")} />
                <NavTile icon={<QrCode size={18} />} label="QR Card" onClick={openCard} />
                <NavTile icon={<Smartphone size={18} />} label="Devices" onClick={openDevices} />
                <NavTile label="Payments" onClick={() => setStep("payments")} />
                <NavTile label="Attendance" onClick={() => setStep("attendance")} />
                <NavTile label="Alerts" onClick={() => setStep("notifications")} />
                <NavTile
                  label="Chat"
                  badge={chatUnread}
                  onClick={() => {
                    setChatUnread(false);
                    setStep("chat");
                  }}
                />
                <NavTile label="Training" onClick={() => setStep("training")} />
                <NavTile label="Book" onClick={() => setStep("bookings")} />
                <NavTile label="Perks" onClick={() => setStep("perks")} />
                <NavTile label="Biometric" onClick={() => setStep("biometric")} />
              </div>

              <p className="text-center text-xs text-muted">
                Membership details are managed by the gym.{" "}
                <Link href="/contact" className="text-gold hover:underline">
                  Contact us
                </Link>{" "}
                to update anything.
              </p>
            </>
          ) : null}

          {step === "profile" ? (
            <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
              <PortalBackButton onClick={() => setStep("home")} />
              <div className="mt-4 flex items-center gap-4">
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photoUrl}
                    alt=""
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-gold">
                    <User size={28} />
                  </div>
                )}
                <div>
                  <p className="font-display text-2xl text-white">{member.fullName}</p>
                  <p className="text-sm text-muted">{member.memberCode}</p>
                </div>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <Row label="Mobile" value={member.mobile} />
                <Row label="Email" value={member.email || "—"} />
                <Row label="DOB" value={formatDate(member.dob)} />
                <Row label="Branch" value={member.branch || "—"} />
                <Row label="Blood group" value={member.bloodGroup || "—"} />
                <Row label="Emergency" value={member.emergencyContact || "—"} />
                <Row label="Joined" value={formatDate(member.joiningDate)} />
                <Row label="Next Payment Date" value={formatDate(member.nextPaymentDate)} />
              </dl>
            </section>
          ) : null}

          {step === "card" && card ? (
            <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-charcoal to-black p-5">
              <PortalBackButton onClick={() => setStep("home")} />
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-gold">Membership card</p>
              <div className="mt-4 flex items-center gap-4">
                {card.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : null}
                <div>
                  <p className="font-display text-xl text-white">{card.fullName}</p>
                  <p className="text-sm text-muted">{card.memberCode}</p>
                  <p className="text-sm text-gold">{card.status}</p>
                </div>
              </div>
              <div className="mt-5 flex justify-center rounded-2xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(card.qrPayload)}`}
                  alt="Membership QR"
                  width={220}
                  height={220}
                  className="h-[220px] w-[220px]"
                />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Plan" value={card.planName || "—"} />
                <Row label="Branch" value={card.branch || "—"} />
                <Row label="Next Payment Date" value={formatDate(card.nextPaymentDate || card.paymentBy)} />
              </dl>
            </section>
          ) : null}

          {step === "devices" ? (
            <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
              <PortalBackButton onClick={() => setStep("home")} />
              <p className="mt-4 text-sm text-muted">Up to 3 trusted devices. Remove unused ones anytime.</p>
              <ul className="mt-4 space-y-3">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white">
                        {d.label || "Device"}
                        {d.current ? (
                          <span className="ml-2 text-xs text-gold">(this device)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">
                        Last seen {formatDate(d.lastSeenAt)}
                      </p>
                    </div>
                    {!d.current ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeDevice(d.id)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {step === "payments" ? (
            <PaymentsPanel onBack={() => setStep("home")} liveTick={liveTick} />
          ) : null}
          {step === "attendance" ? (
            <AttendancePanel
              onBack={() => setStep("home")}
              deviceId={deviceId}
              memberUuid={member.memberUuid}
              liveTick={liveTick}
            />
          ) : null}
          {step === "notifications" ? (
            <NotificationsPanel onBack={() => setStep("home")} />
          ) : null}
          {step === "chat" ? (
            <ChatPanel
              onBack={() => setStep("home")}
              memberUuid={member.memberUuid}
              onSeen={() => setChatUnread(false)}
            />
          ) : null}
          {step === "training" ? (
            <TrainingPanel
              onBack={() => setStep("home")}
              memberUuid={member.memberUuid}
              liveTick={liveTick}
            />
          ) : null}
          {step === "bookings" ? (
            <BookingsPanel onBack={() => setStep("home")} liveTick={liveTick} />
          ) : null}
          {step === "perks" ? (
            <PerksPanel onBack={() => setStep("home")} liveTick={liveTick} />
          ) : null}
          {step === "biometric" ? (
            <BiometricPanel
              onBack={() => setStep("home")}
              mobile={mobile || member.mobile}
              deviceId={deviceId}
              onLoggedIn={() => void loadMe()}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NavTile({
  icon,
  label,
  onClick,
  badge,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-charcoal/40 px-3 py-4 text-xs text-white/85 hover:border-gold/40 hover:text-gold"
    >
      {badge ? (
        <span
          className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black shadow-[0_0_10px_rgba(212,175,55,0.85)]"
          aria-label="New chat message from gym"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/70" />
          New
        </span>
      ) : null}
      {icon}
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-white">{value}</dd>
    </div>
  );
}
