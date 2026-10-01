"use client";

import { useEffect, useState } from "react";
import { PortalBackButton } from "@/components/members/PortalBackButton";
import { readTshirtCache, writeTshirtCache } from "@/lib/member-portal/panel-cache";
import {
  TSHIRT_SIZE_SAVE_LIMIT,
  TSHIRT_SIZES,
  tshirtSizeChoiceLabel,
} from "@/lib/member-portal/tshirt-size";
import { fetchTshirtState, type TshirtPanelState } from "@/lib/member-portal/tshirt-size-client";

export function TshirtSizePanel({
  memberUuid,
  onBack,
}: {
  memberUuid: string;
  onBack: () => void;
}) {
  const cached = readTshirtCache<TshirtPanelState>(memberUuid);
  const [state, setState] = useState<TshirtPanelState | null>(cached);
  const [choice, setChoice] = useState(cached?.size || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchTshirtState(memberUuid);
      if (cancelled) return;
      if (!next) {
        if (!readTshirtCache(memberUuid)) {
          setMessage("T-shirt size is not available yet. Try again in a moment.");
        }
        return;
      }
      setState(next);
      setChoice((prev) => prev || next.size || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [memberUuid]);

  const remaining = state ? Math.max(0, TSHIRT_SIZE_SAVE_LIMIT - state.updates) : TSHIRT_SIZE_SAVE_LIMIT;

  async function save() {
    if (!state || state.locked || !choice) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/member/tshirt-size", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: choice }),
      });
      const data = (await res.json().catch(() => null)) as
        | (TshirtPanelState & { ok?: boolean; error?: string })
        | null;
      if (res.status === 409 || data?.error === "locked") {
        const locked = {
          size: data?.size ?? state.size,
          updates: TSHIRT_SIZE_SAVE_LIMIT,
          locked: true,
        };
        setState(locked);
        writeTshirtCache(memberUuid, locked);
        setMessage("This size is locked. Ask the gym if it needs to be changed.");
        return;
      }
      if (!res.ok || !data || data.ok === false) {
        setMessage("Could not save that size. Try again.");
        return;
      }
      const next = { size: data.size, updates: data.updates, locked: data.locked };
      setState(next);
      writeTshirtCache(memberUuid, next);
      setChoice(data.size || choice);
      setMessage(
        data.locked
          ? "Saved. Your T-shirt size is now locked."
          : `Saved. You can change it ${Math.max(0, TSHIRT_SIZE_SAVE_LIMIT - data.updates)} more time.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-charcoal/50 p-5">
      <PortalBackButton onClick={onBack} />
      <h2 className="mt-4 font-display text-2xl text-white">Update T-shirt size</h2>
      <p className="mt-2 text-sm text-muted">
        Choose your size. You can save it twice, then it locks.
        {state?.size ? ` Current size: ${tshirtSizeChoiceLabel(state.size)}.` : ""}
      </p>
      <label className="mt-5 block text-xs uppercase tracking-wide text-gold">
        Size
        <select
          className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white"
          value={choice}
          disabled={!state || state.locked || busy}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">Select a size</option>
          {TSHIRT_SIZES.map((size) => (
            <option key={size.id} value={size.id}>
              {size.label} {size.chest}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-xs text-muted">
        {!state
          ? "Loading your size…"
          : state.locked
            ? "Locked. Ask the gym if this size needs to change."
            : `${remaining} change${remaining === 1 ? "" : "s"} left.`}
      </p>
      <button
        type="button"
        className="gold-gradient mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        disabled={!state || state.locked || busy || !choice || choice === state.size}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save size"}
      </button>
      {message ? <p className="mt-3 text-sm text-white/80">{message}</p> : null}
    </section>
  );
}
