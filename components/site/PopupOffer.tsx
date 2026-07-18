"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PopupOffer as PopupType } from "@/lib/types";
import { Button } from "@/components/ui/Button";

const KEY = "apg_popup_dismissed";

export function PopupOffer({ popup }: { popup: PopupType | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!popup?.enabled) return;
    if (popup.expires_at && new Date(popup.expires_at) < new Date()) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY)) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [popup]);

  function dismiss() {
    sessionStorage.setItem(KEY, "1");
    setOpen(false);
  }

  if (!popup) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-gold/30 shadow-2xl"
            style={{ background: popup.bg_color, color: popup.text_color }}
          >
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-2"
              aria-label="Close offer"
            >
              <X className="h-4 w-4" />
            </button>
            {popup.image_url ? (
              <div className="relative h-44 w-full">
                <Image
                  src={popup.image_url}
                  alt={popup.title}
                  fill
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="p-6 md:p-8">
              <p
                className="text-xs font-semibold uppercase tracking-[0.25em]"
                style={{ color: popup.accent_color }}
              >
                Limited Offer
              </p>
              <h3 className="mt-2 font-display text-3xl">{popup.title}</h3>
              <p className="mt-3 text-sm opacity-85">{popup.body}</p>
              <div className="mt-6" onClick={dismiss}>
                <Button href={popup.button_href || "#join"}>
                  {popup.button_text || "Claim Offer"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
