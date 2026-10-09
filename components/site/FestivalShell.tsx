import { FestivalTheme } from "@/components/site/FestivalTheme";
import { festivalBootScript, festivalIsLive, type FestivalSettings } from "@/lib/festival";

export function FestivalShell({
  settings,
  children,
}: {
  settings: FestivalSettings;
  children: React.ReactNode;
}) {
  const live = festivalIsLive(settings);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: festivalBootScript(live) }} />
      <FestivalTheme settings={settings} />
      {children}
    </>
  );
}
