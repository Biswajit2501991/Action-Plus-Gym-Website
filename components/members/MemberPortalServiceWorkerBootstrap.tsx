"use client";

import { useEffect } from "react";

/**
 * Keep the Member Portal service worker registered so iOS/Safari can deliver
 * billing push while the Home Screen app is closed. Display-only side effect.
 */
export function MemberPortalServiceWorkerBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw-member-portal.js", {
          scope: "/members",
        });
        if (cancelled) return;
        // Pull updated SW without interrupting an active page.
        void reg.update();
      } catch {
        /* Push remains optional — ignore register failures. */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
