import { FestivalTheme } from "@/components/site/FestivalTheme";
import { festivalBootScript, liveFestivalTheme, type FestivalSettings } from "@/lib/festival";

export function FestivalShell({
  settings,
  children,
}: {
  settings: FestivalSettings;
  children: React.ReactNode;
}) {
  const theme = liveFestivalTheme(settings, "website");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: festivalBootScript(theme) }} />
      <FestivalTheme settings={settings} />
      {children}
    </>
  );
}
