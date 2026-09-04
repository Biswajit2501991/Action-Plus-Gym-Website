"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { enableBillingPush } from "@/lib/member-portal/enable-billing-push";
import {
  detectExistingBillingPushSubscription,
  detectWebPushSupport,
} from "@/lib/member-portal/web-push-support";

type Props = {
  open: boolean;
  onClose: () => void;
  onEnabled?: () => void;
};

/**
 * Soft login reminder when billing push is not enabled.
 * Next time / X dismiss for this login only; next login re-checks.
 */
export function PushEnableReminderModal({ open, onClose, onEnabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [supportReason, setSupportReason] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setHint(null);
    setBusy(false);
    const support = detectWebPushSupport();
    setSupportReason(support.ok ? null : support.reason);
    if (!support.ok && support.hint) setHint(support.hint);
    setPermissionDenied(
      typeof Notification !== "undefined" && Notification.permission === "denied",
    );
    let cancelled = false;
    void (async () => {
      try {
        const enabled = await detectExistingBillingPushSubscription();
        if (!cancelled && enabled) onClose();
      } catch {
        /* keep modal open */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, onClose]);

  if (!open) return null;

  const needsHomeScreen = supportReason === "ios_needs_home_screen";
  const canEnable = !needsHomeScreen && !permissionDenied && supportReason !== "insecure";

  async function onEnable() {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const result = await enableBillingPush();
      if (!result.ok) {
        setError(result.error);
        if (result.hint) setHint(result.hint);
        if (!result.support.ok) setSupportReason(result.support.reason);
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "denied"
        ) {
          setPermissionDenied(true);
        }
        return;
      }
      onEnabled?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-enable-reminder-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-gold/35 bg-charcoal p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full gold-gradient text-black">
          <Bell className="h-5 w-5" strokeWidth={2.25} />
        </div>

        <h2
          id="push-enable-reminder-title"
          className="mt-4 text-center font-display text-xl text-gold"
        >
          Stay on track with payments
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-white/85">
          You don&apos;t need to remember any date — we&apos;ll take care of it.
          Just enable notifications.
        </p>

        {needsHomeScreen ? (
          <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 px-3 py-3 text-xs leading-relaxed text-white/85">
            On iPhone/iPad, add Member Portal to your Home Screen first, then open
            it from the icon to enable push reminders.
          </div>
        ) : null}

        {permissionDenied ? (
          <div className="mt-4 rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-xs leading-relaxed text-white/80">
            Notifications are blocked for this site. Open your device Settings →
            allow notifications for Action Plus Gym, then try again from Alerts.
          </div>
        ) : null}

        {error ? <p className="mt-3 text-center text-sm text-red-300">{error}</p> : null}
        {hint ? (
          <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">{hint}</p>
        ) : null}

        <div className="mt-5 space-y-2">
          {canEnable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onEnable()}
              className="min-h-12 w-full touch-manipulation rounded-full gold-gradient px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Enabling…" : "Enable notifications"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 w-full touch-manipulation rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/90 disabled:opacity-50"
          >
            Next time
          </button>
        </div>
      </div>
    </div>
  );
}
