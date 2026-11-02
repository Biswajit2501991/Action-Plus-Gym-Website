/** Public-site seasonal skin. Member portal and admin do not use this. */

export const DURGA_PUJA_THEME = "durga_puja";
export const DIWALI_THEME = "diwali";
export const CHHATH_PUJA_THEME = "chhath_puja";
export const NEW_YEAR_2027_THEME = "new_year_2027";
export const HOLI_2027_THEME = "holi_2027";
export const FESTIVAL_THEMES = [
  DURGA_PUJA_THEME,
  DIWALI_THEME,
  CHHATH_PUJA_THEME,
  NEW_YEAR_2027_THEME,
  HOLI_2027_THEME,
] as const;
export type FestivalThemeId = (typeof FESTIVAL_THEMES)[number];
export type FestivalSurface = "website" | "gym_manager";

const IST_OFFSET = "+05:30";
const FESTIVAL_ATTR = "data-festival";

export const FESTIVAL_THEME_META: Record<
  FestivalThemeId,
  { label: string; attr: string }
> = {
  durga_puja: { label: "Durga Puja Theme", attr: "durga-puja" },
  diwali: { label: "Diwali Theme", attr: "diwali" },
  chhath_puja: { label: "Chhath Puja Theme", attr: "chhath-puja" },
  new_year_2027: { label: "New Year 2027", attr: "new-year-2027" },
  holi_2027: { label: "Holi Colour Blast 2027", attr: "holi-2027" },
};

export type FestivalThemeConfig = {
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  apply_website: boolean;
  apply_gym_manager: boolean;
};

export type FestivalCatalog = Record<FestivalThemeId, FestivalThemeConfig>;

export type FestivalSettings = {
  festival_enabled?: boolean | null;
  festival_theme?: string | null;
  festival_starts_at?: string | null;
  festival_ends_at?: string | null;
  festival_catalog?: FestivalCatalog | Record<string, unknown> | null;
};

function emptyTheme(): FestivalThemeConfig {
  return {
    enabled: false,
    starts_at: null,
    ends_at: null,
    apply_website: true,
    apply_gym_manager: false,
  };
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseTheme(raw: unknown): FestivalThemeConfig {
  const base = emptyTheme();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    starts_at: asIso(o.starts_at),
    ends_at: asIso(o.ends_at),
    apply_website: o.apply_website !== false,
    apply_gym_manager: Boolean(o.apply_gym_manager),
  };
}

export function emptyFestivalCatalog(): FestivalCatalog {
  return {
    durga_puja: emptyTheme(),
    diwali: emptyTheme(),
    chhath_puja: emptyTheme(),
    new_year_2027: emptyTheme(),
    holi_2027: emptyTheme(),
  };
}

/** Merge JSON catalog with legacy festival_* columns so older rows still work. */
export function hydrateFestivalCatalog(settings: FestivalSettings): FestivalCatalog {
  const catalog = emptyFestivalCatalog();
  const raw = settings.festival_catalog;
  if (raw && typeof raw === "object") {
    catalog.durga_puja = parseTheme((raw as Record<string, unknown>).durga_puja);
    catalog.diwali = parseTheme((raw as Record<string, unknown>).diwali);
    catalog.chhath_puja = parseTheme((raw as Record<string, unknown>).chhath_puja);
    catalog.new_year_2027 = parseTheme((raw as Record<string, unknown>).new_year_2027);
    catalog.holi_2027 = parseTheme((raw as Record<string, unknown>).holi_2027);
  }
  const catalogMissing =
    !raw ||
    typeof raw !== "object" ||
    Object.keys(raw as object).length === 0;
  if (catalogMissing) {
    const theme = String(settings.festival_theme || "");
    catalog.durga_puja = {
      enabled: Boolean(settings.festival_enabled) && (theme === DURGA_PUJA_THEME || theme === ""),
      starts_at: asIso(settings.festival_starts_at),
      ends_at: asIso(settings.festival_ends_at),
      apply_website: true,
      apply_gym_manager: false,
    };
    if (theme === DIWALI_THEME) {
      catalog.durga_puja.enabled = false;
      catalog.diwali = {
        enabled: Boolean(settings.festival_enabled),
        starts_at: asIso(settings.festival_starts_at),
        ends_at: asIso(settings.festival_ends_at),
        apply_website: true,
        apply_gym_manager: false,
      };
    }
    if (theme === CHHATH_PUJA_THEME) {
      catalog.durga_puja.enabled = false;
      catalog.chhath_puja = {
        enabled: Boolean(settings.festival_enabled),
        starts_at: asIso(settings.festival_starts_at),
        ends_at: asIso(settings.festival_ends_at),
        apply_website: true,
        apply_gym_manager: false,
      };
    }
    if (theme === NEW_YEAR_2027_THEME) {
      catalog.durga_puja.enabled = false;
      catalog.new_year_2027 = {
        enabled: Boolean(settings.festival_enabled),
        starts_at: asIso(settings.festival_starts_at),
        ends_at: asIso(settings.festival_ends_at),
        apply_website: true,
        apply_gym_manager: false,
      };
    }
    if (theme === HOLI_2027_THEME) {
      catalog.durga_puja.enabled = false;
      catalog.holi_2027 = {
        enabled: Boolean(settings.festival_enabled),
        starts_at: asIso(settings.festival_starts_at),
        ends_at: asIso(settings.festival_ends_at),
        apply_website: true,
        apply_gym_manager: false,
      };
    }
  }
  return catalog;
}

export function windowsOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  const aS = aStart ? new Date(aStart).getTime() : NaN;
  const aE = aEnd ? new Date(aEnd).getTime() : NaN;
  const bS = bStart ? new Date(bStart).getTime() : NaN;
  const bE = bEnd ? new Date(bEnd).getTime() : NaN;
  if (![aS, aE, bS, bE].every(Number.isFinite)) return false;
  return aS < bE && bS < aE;
}

export function festivalWindowError(enabled: boolean, startsAt: string, endsAt: string): string | null {
  if (!enabled) return null;
  if (!startsAt || !endsAt) {
    return "Set a start and an end in IST. The end must be after the start.";
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    return "Set a start and an end in IST. The end must be after the start.";
  }
  return null;
}

export function overlappingFestivalError(
  catalog: FestivalCatalog,
  theme: FestivalThemeId,
  next: FestivalThemeConfig,
): string | null {
  if (!next.enabled) return null;
  for (const other of FESTIVAL_THEMES) {
    if (other === theme) continue;
    const cfg = catalog[other];
    if (!cfg.enabled) continue;
    if (windowsOverlap(next.starts_at, next.ends_at, cfg.starts_at, cfg.ends_at)) {
      return "This schedule overlaps another festival theme. Change the dates or turn the other theme off.";
    }
  }
  return null;
}

export function themeIsInWindow(cfg: FestivalThemeConfig, now = Date.now()): boolean {
  if (!cfg.enabled) return false;
  const start = cfg.starts_at ? new Date(cfg.starts_at).getTime() : NaN;
  const end = cfg.ends_at ? new Date(cfg.ends_at).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return now >= start && now < end;
}

export function resolveLiveFestivalTheme(
  catalog: FestivalCatalog,
  surface: FestivalSurface,
  now = Date.now(),
): FestivalThemeId | null {
  const live: FestivalThemeId[] = [];
  for (const theme of FESTIVAL_THEMES) {
    const cfg = catalog[theme];
    if (surface === "website" && !cfg.apply_website) continue;
    if (surface === "gym_manager" && !cfg.apply_gym_manager) continue;
    if (themeIsInWindow(cfg, now)) live.push(theme);
  }
  if (live.length === 1) return live[0];
  return null;
}

export function festivalAttrValue(theme: FestivalThemeId | null): string {
  if (!theme) return "";
  return FESTIVAL_THEME_META[theme].attr;
}

export function istDatetimeLocalToIso(localValue: string): string {
  const v = String(localValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return "";
  const d = new Date(`${v}:00${IST_OFFSET}`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function isoToIstDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export function formatIst(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Live only inside the saved IST window. Missing dates stay off. */
export function festivalIsLive(settings: FestivalSettings, now = Date.now()): boolean {
  const catalog = hydrateFestivalCatalog(settings);
  return resolveLiveFestivalTheme(catalog, "website", now) != null;
}

export function liveFestivalTheme(
  settings: FestivalSettings,
  surface: FestivalSurface = "website",
  now = Date.now(),
): FestivalThemeId | null {
  return resolveLiveFestivalTheme(hydrateFestivalCatalog(settings), surface, now);
}

export function festivalBootScript(theme: FestivalThemeId | null | boolean) {
  const id =
    theme === true
      ? DURGA_PUJA_THEME
      : theme === false || theme == null
        ? null
        : theme;
  const value = festivalAttrValue(id);
  return value
    ? `document.documentElement.setAttribute("${FESTIVAL_ATTR}","${value}");`
    : `document.documentElement.removeAttribute("${FESTIVAL_ATTR}");`;
}

export type FestivalStatusKind = "disabled" | "scheduled" | "active" | "expired";

export function festivalStatus(
  cfg: FestivalThemeConfig,
  now = Date.now(),
): { kind: FestivalStatusKind; label: string } {
  if (!cfg.enabled) {
    return { kind: "disabled", label: "Disabled. The normal theme is showing for this festival." };
  }
  const start = cfg.starts_at ? new Date(cfg.starts_at).getTime() : NaN;
  const end = cfg.ends_at ? new Date(cfg.ends_at).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return {
      kind: "disabled",
      label: "On, but it needs a start and an end in IST before it can show.",
    };
  }
  if (now < start) {
    return { kind: "scheduled", label: `Scheduled. Starts ${formatIst(cfg.starts_at)} IST.` };
  }
  if (now >= end) {
    return {
      kind: "expired",
      label: `Expired ${formatIst(cfg.ends_at)} IST. The normal theme is back.`,
    };
  }
  return { kind: "active", label: `Active until ${formatIst(cfg.ends_at)} IST.` };
}

export function festivalStatusLabel(settings: FestivalSettings, now = Date.now()): string {
  const catalog = hydrateFestivalCatalog(settings);
  const live = resolveLiveFestivalTheme(catalog, "website", now);
  if (live) return festivalStatus(catalog[live], now).label;
  if (!settings.festival_enabled) return "Off. The normal theme is showing.";
  const theme = (settings.festival_theme || DURGA_PUJA_THEME) as FestivalThemeId;
  const cfg = catalog[theme] || catalog.durga_puja;
  return festivalStatus(cfg, now).label;
}

export const PREVIEW_STORAGE_KEY = "apg-festival-preview";
export const PREVIEW_QUERY = "preview_festival";

export function parsePreviewTheme(value: string | null | undefined): FestivalThemeId | null {
  const v = String(value || "").trim();
  if (v === DURGA_PUJA_THEME || v === "durga-puja") return DURGA_PUJA_THEME;
  if (v === DIWALI_THEME || v === "diwali") return DIWALI_THEME;
  if (v === CHHATH_PUJA_THEME || v === "chhath-puja" || v === "chhath") return CHHATH_PUJA_THEME;
  if (v === NEW_YEAR_2027_THEME || v === "new-year-2027" || v === "new_year") return NEW_YEAR_2027_THEME;
  if (v === HOLI_2027_THEME || v === "holi-2027" || v === "holi") return HOLI_2027_THEME;
  return null;
}
