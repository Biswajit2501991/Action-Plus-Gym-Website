import { FestivalTheme } from "@/components/site/FestivalTheme";
import {
  festivalBootScript,
  liveFestivalTheme,
  type FestivalSettings,
  type FestivalThemeId,
} from "@/lib/festival";

export function FestivalShell({
  settings,
  previewTheme,
  children,
}: {
  settings: FestivalSettings;
  previewTheme?: FestivalThemeId | null;
  children: React.ReactNode;
}) {
  const theme = previewTheme || liveFestivalTheme(settings, "website");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: festivalBootScript(theme) }} />
      <FestivalTheme settings={settings} initialPreview={previewTheme ?? null} />
      {children}
    </>
  );
}
