"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PopupOffer as PopupType } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export function PopupOffer({
  popup,
  open,
  onClose,
  onCelebrateAgain,
}: {
  popup: PopupType | null;
  open: boolean;
  onClose: () => void;
  onCelebrateAgain?: () => void;
}) {
  if (!popup) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="apg-offer-title"
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
              onClick={onClose}
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
              <h3 id="apg-offer-title" className="mt-2 font-display text-3xl">
                {popup.title}
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm opacity-85">{popup.body}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {onCelebrateAgain ? (
                  <button
                    type="button"
                    className="apg-celebrate-btn apg-celebrate-btn-sm"
                    onClick={onCelebrateAgain}
                  >
                    Celebrate again
                  </button>
                ) : null}
                <div onClick={onClose}>
                  <Button href={popup.button_href || "#join"}>
                    {popup.button_text || "Claim Offer"}
                  </Button>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-5 py-3 text-sm text-white/80"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
