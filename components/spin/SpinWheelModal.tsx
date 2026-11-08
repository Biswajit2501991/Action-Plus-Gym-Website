"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { rotationForSegment, SpinWheel, type SpinSlice } from "@/components/spin/SpinWheel";
import { SpinResult } from "@/components/spin/SpinResult";

export type SpinPrize = {
  segmentIndex: number;
  discount: number;
  couponCode: string | null;
  expiresAt: string | null;
  alreadyUsed?: boolean;
};

export function SpinWheelModal({
  open,
  title,
  subtitle,
  buttonLabel,
  segments,
  closeOverlay,
  onClose,
  onSpin,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  buttonLabel: string;
  segments: SpinSlice[];
  closeOverlay: boolean;
  onClose: () => void;
  onSpin: () => Promise<SpinPrize>;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<SpinPrize | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const spinGen = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    spinGen.current += 1;
    busyRef.current = false;
    setRotation(0);
    setSpinning(false);
    setPrize(null);
    setError("");
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function spin() {
    if (busyRef.current || prize) return;
    busyRef.current = true;
    setError("");
    const gen = spinGen.current;
    try {
      const next = await onSpin();
      const target = rotationForSegment(next.segmentIndex, segments.length, reduced ? 0 : 5);
      if (reduced) {
        setRotation(target);
        setPrize(next);
        return;
      }
      setSpinning(true);
      window.setTimeout(() => {
        if (gen !== spinGen.current) return;
        setRotation(target);
      }, 40);
      window.setTimeout(() => {
        if (gen !== spinGen.current) return;
        setSpinning(false);
        setPrize(next);
      }, 5340);
    } catch {
      busyRef.current = false;
      setSpinning(false);
      setError("The wheel could not finish. Nothing was saved. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        aria-label="Close spin offer"
        className="absolute inset-0 bg-black/75"
        onClick={() => {
          if (closeOverlay && !spinning) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-spin-title"
        className="relative z-10 max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#eab308]/40 bg-[#161616] p-5 text-white shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          disabled={spinning}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/20"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
        <p id="site-spin-title" className="pr-10 font-display text-2xl text-[#eab308]">
          {title}
        </p>
        <p className="mt-1 text-sm text-white/75">{subtitle}</p>
        <div className="mt-4">
          <SpinWheel
            segments={segments}
            rotation={rotation}
            spinning={spinning}
            buttonLabel={buttonLabel || "SPIN"}
            disabled={spinning || Boolean(prize)}
            onSpin={() => {
              void spin();
            }}
          />
        </div>
        {error ? <p className="mt-3 text-center text-sm text-rose-300">{error}</p> : null}
        {prize ? (
          <div className="mt-3">
            <SpinResult
              discount={prize.discount}
              couponCode={prize.couponCode}
              expiresAt={prize.expiresAt}
              alreadyUsed={prize.alreadyUsed}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
