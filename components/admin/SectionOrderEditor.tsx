"use client";

import { useState, useTransition } from "react";
import { saveSectionOrderAction } from "@/lib/actions/admin";
import { sectionLabel } from "@/lib/cms/section-order";
import { AdminPageHeader, SaveBar } from "@/components/admin/form-ui";

export function SectionOrderEditor({
  initialOrder,
  enabled,
}: {
  initialOrder: string[];
  enabled: Record<string, boolean>;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "error">("ok");

  function move(index: number, dir: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const result = await saveSectionOrderAction(order);
          if (result && typeof result === "object" && "ok" in result && result.ok === false) {
            setTone("error");
            setMsg(
              "error" in result && typeof result.error === "string"
                ? result.error
                : "Could not save section order.",
            );
            return;
          }
          setTone("ok");
          setMsg("Section order saved.");
        });
      }}
    >
      <AdminPageHeader
        title="Section Order"
        description="Move blocks up or down, then save. The banner stays at the top and the footer stays at the bottom. Turning a block on or off is still done in Show / Hide Sections."
      />
      <ol className="space-y-3">
        {order.map((key, index) => {
          const on = enabled[key] !== false;
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-charcoal/40 px-4 py-3"
            >
              <div>
                <p className="text-white">
                  <span className="mr-2 text-xs text-muted">{index + 1}</span>
                  {sectionLabel(key)}
                </p>
                <p className="text-xs text-muted">{on ? "Showing on the website" : "Hidden"}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 disabled:opacity-30"
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 disabled:opacity-30"
                >
                  Down
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <SaveBar pending={pending} message={msg} tone={tone} />
    </form>
  );
}
