/** Client-side Web Push capability helpers for Member Portal billing reminders. */

export type WebPushSupport =
  | { ok: true; standalone: boolean }
  | {
      ok: false;
      reason: "insecure" | "ios_needs_home_screen" | "no_service_worker" | "no_push" | "no_notification";
      message: string;
      hint?: string;
    };

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPhone/iPad/iPod, plus iPadOS desktop UA with touch
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** True when running as an installed Home Screen / standalone web app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return Boolean(mq || iosStandalone);
}

export function detectWebPushSupport(): WebPushSupport {
  if (typeof window === "undefined") {
    return {
      ok: false,
      reason: "no_push",
      message: "Web Push is not available.",
    };
  }

  if (!window.isSecureContext) {
    return {
      ok: false,
      reason: "insecure",
      message: "Notifications need a secure (HTTPS) connection.",
    };
  }

  const hasSW = "serviceWorker" in navigator;
  const hasPush = "PushManager" in window;
  const hasNotification = "Notification" in window;
  const standalone = isStandaloneDisplay();
  const ios = isIosLike();

  // iOS/iPadOS: PushManager is only exposed after Add to Home Screen (standalone).
  if (ios && (!hasPush || !standalone)) {
    return {
      ok: false,
      reason: "ios_needs_home_screen",
      message: "On iPhone/iPad, open this portal from your Home Screen to enable push.",
      hint: "In Safari: Share → Add to Home Screen → open Action Plus Gym → Alerts → Enable billing-day push.",
    };
  }

  if (!hasSW) {
    return {
      ok: false,
      reason: "no_service_worker",
      message: "This browser blocks service workers (try Chrome/Safari outside a private or in-app browser).",
    };
  }

  if (!hasPush) {
    return {
      ok: false,
      reason: "no_push",
      message: "Web Push is not available in this browser.",
      hint: ios
        ? "Add the portal to your Home Screen, then open it from the icon."
        : "Try Chrome or Safari on this device (not an in-app browser like WhatsApp).",
    };
  }

  if (!hasNotification) {
    return {
      ok: false,
      reason: "no_notification",
      message: "Notification permission API is not available in this browser.",
    };
  }

  return { ok: true, standalone };
}
