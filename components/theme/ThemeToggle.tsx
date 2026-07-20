"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "day", label: "Day", icon: Sun },
  { value: "night", label: "Night", icon: Moon },
  { value: "auto", label: "Auto", icon: Monitor },
];

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-white/15 bg-black/30 p-0.5",
        "theme-toggle",
        className,
      )}
      data-theme-toggle=""
      role="group"
      aria-label="Color theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            aria-pressed={active}
            title={`${label}${value === "auto" ? " (system)" : ""}`}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition",
              active
                ? "bg-gold text-black shadow-sm"
                : "text-white/70 hover:text-white",
              compact && "px-2",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {compact ? null : <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
