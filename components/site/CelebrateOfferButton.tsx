"use client";

import { useState } from "react";
import { PopupOffer } from "@/components/site/PopupOffer";
import { CelebrateFireworks } from "@/components/site/CelebrateFireworks";
import { isOfferLive } from "@/lib/celebrate-offer";
import type { PopupOffer as PopupType } from "@/lib/types";

export type CelebrateFallback = {
  title: string;
  body: string;
};

export function CelebrateOfferButton({
  popup,
  fallback,
}: {
  popup: PopupType | null;
  fallback?: CelebrateFallback;
}) {
  const [playId, setPlayId] = useState(0);
  const [modal, setModal] = useState(false);

  function celebrate() {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setModal(true);
    if (!reduce) setPlayId((n) => n + 1);
  }

  const live = isOfferLive(popup);
  const fallbackPopup: PopupType | null =
    !live && fallback
      ? {
          id: 0,
          enabled: true,
          title: fallback.title,
          body: fallback.body,
          image_url: "",
          button_text: "Join Now",
          button_href: "#join",
          bg_color: "#0A0A0A",
          accent_color: "#C9A227",
          text_color: "#FFFFFF",
          expires_at: null,
        }
      : null;

  return (
    <>
      <button type="button" className="apg-celebrate-btn" onClick={celebrate}>
        Let&apos;s celebrate ↗
      </button>
      <CelebrateFireworks playId={playId} />
      <PopupOffer
        popup={live ? popup : fallbackPopup}
        open={modal}
        onClose={() => setModal(false)}
      />
    </>
  );
}
