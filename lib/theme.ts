export type ThemePreference = "day" | "night" | "auto";
export type ResolvedTheme = "day" | "night";
export type ThemeScope = "site" | "admin";

export const THEME_STORAGE = {
  site: "apg-theme-site",
  admin: "apg-theme-admin",
} as const;

export function themeStorageKey(scope: ThemeScope) {
  return THEME_STORAGE[scope];
}

export function scopeFromPathname(pathname: string): ThemeScope {
  return pathname.startsWith("/admin") ? "admin" : "site";
}

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (value === "day" || value === "night" || value === "auto") return value;
  return "auto";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "day") return "day";
  if (preference === "night") return "night";
  return systemPrefersDark ? "night" : "day";
}

/** Inline boot script — apply theme before paint to avoid flash. */
export const THEME_BOOT_SCRIPT = `(() => {
  try {
    var path = location.pathname || "";
    var key = path.indexOf("/admin") === 0 ? "apg-theme-admin" : "apg-theme-site";
    var pref = localStorage.getItem(key) || "auto";
    if (pref !== "day" && pref !== "night" && pref !== "auto") pref = "auto";
    var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = pref === "day" ? "day" : pref === "night" ? "night" : dark ? "night" : "day";
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-pref", pref);
    root.style.colorScheme = resolved === "day" ? "light" : "dark";
  } catch (e) {}
})();`;
