"use client";

import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle, Phone } from "lucide-react";
import { AskMeBot } from "@/components/site/AskMeBot";

const fabClass =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg";

export function FloatingActions({
  phone,
  whatsapp,
}: {
  phone: string;
  whatsapp: string;
}) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tel = phone.replace(/[^\d+]/g, "");
  const wa = whatsapp.replace(/[^\d]/g, "");

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      <AskMeBot />
      {wa ? (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          className={`${fabClass} bg-[#25D366] text-white`}
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-5 w-5" />
        </a>
      ) : null}
      {tel ? (
        <a
          href={`tel:${tel}`}
          className={`${fabClass} gold-gradient text-black`}
          aria-label="Call"
        >
          <Phone className="h-5 w-5" />
        </a>
      ) : null}
      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className={`${fabClass} border border-white/20 bg-black/70 text-white`}
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
