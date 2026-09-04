/** Shared Member Portal billing-day Web Push enable flow (Alerts + login reminder). */

import {
  detectWebPushSupport,
  type WebPushSupport,
} from "@/lib/member-portal/web-push-support";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function portalFetch<T>(url: string, init?: RequestInit): Promise<T> {
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
  };
  if (!res.ok) {
    throw new Error(
      String(data?.message || data?.error || `Request failed (${res.status})`),
    );
  }
  return data;
}

export type EnableBillingPushResult =
  | { ok: true; support: WebPushSupport }
  | {
      ok: false;
      error: string;
      hint?: string;
      support: WebPushSupport;
    };

const DEVICE_HINT =
  "On iPhone: Safari → Share → Add to Home Screen, then open Action Plus from the icon and tap Enable again. On Android: use Chrome (not WhatsApp’s in-app browser).";

/**
 * Request permission, register SW, subscribe, and POST to /api/member/push/subscribe.
 * Same path used by Alerts panel — do not invent a second subscribe flow.
 */
export async function enableBillingPush(): Promise<EnableBillingPushResult> {
  const support = detectWebPushSupport();
  if (!support.ok) {
    return {
      ok: false,
      error: support.message,
      hint: support.hint,
      support,
    };
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return {
        ok: false,
        error:
          "Notification permission denied. Allow notifications for this site in Settings, then try again.",
        support,
      };
    }

    const reg = await navigator.serviceWorker.register("/sw-member-portal.js", {
      scope: "/members",
    });
    await navigator.serviceWorker.ready;

    const vapid = await portalFetch<{
      ok: true;
      publicKey: string;
      message?: string;
    }>("/api/member/push/vapid");
    if (!vapid?.publicKey) {
      return {
        ok: false,
        error:
          vapid?.message ||
          "Push is not configured on the server yet. Ask the gym to enable WEB_PUSH_VAPID keys.",
        support,
      };
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
      return {
        ok: false,
        error:
          "Could not create a push subscription. Try again from the Home Screen app.",
        support,
      };
    }

    await portalFetch("/api/member/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
        confirm: true,
      }),
    });

    return { ok: true, support };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not enable push";
    return {
      ok: false,
      error: msg,
      hint: /not supported|PushManager|service worker/i.test(msg)
        ? DEVICE_HINT
        : undefined,
      support,
    };
  }
}
