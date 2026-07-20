"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import {
  parseThemePreference,
  resolveTheme,
  scopeFromPathname,
  themeStorageKey,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeScope,
} from "@/lib/theme";

type ThemeContextValue = {
  scope: ThemeScope;
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeSystemTheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSystemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDomTheme(preference: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-pref", preference);
  root.style.colorScheme = resolved === "day" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const scope = scopeFromPathname(pathname);
  const systemPrefersDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemPrefersDark,
    () => true,
  );

  const [preference, setPreferenceState] = useState<ThemePreference>("auto");

  // Load preference for current scope (site vs admin stored separately).
  useEffect(() => {
    try {
      const stored = parseThemePreference(
        localStorage.getItem(themeStorageKey(scope)),
      );
      setPreferenceState(stored);
    } catch {
      setPreferenceState("auto");
    }
  }, [scope]);

  const resolved = useMemo(
    () => resolveTheme(preference, systemPrefersDark),
    [preference, systemPrefersDark],
  );

  useEffect(() => {
    applyDomTheme(preference, resolved);
  }, [preference, resolved]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      try {
        localStorage.setItem(themeStorageKey(scope), next);
      } catch {
        /* ignore */
      }
      applyDomTheme(next, resolveTheme(next, getSystemPrefersDark()));
    },
    [scope],
  );

  const value = useMemo(
    () => ({ scope, preference, resolved, setPreference }),
    [scope, preference, resolved, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
