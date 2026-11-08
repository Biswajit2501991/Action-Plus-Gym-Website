import type { Metadata } from "next";
import { getSiteContent } from "@/lib/cms/get-site-content";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { HomeSection } from "@/components/site/HomeSection";
import { Footer } from "@/components/site/Footer";
import { FloatingActions } from "@/components/site/FloatingActions";
import { ClientErrorBoundary } from "@/components/site/ClientErrorBoundary";
import { SpinOfferHost } from "@/components/spin/SpinOfferHost";
import { FestivalShell } from "@/components/site/FestivalShell";
import { NewYearHero } from "@/components/site/NewYearHero";
import { NewYearStory } from "@/components/site/NewYearStory";
import { HoliHero } from "@/components/site/HoliHero";
import { HoliStory } from "@/components/site/HoliStory";
import { SITE_URL } from "@/lib/config";
import { SECTION_NAV } from "@/lib/cms/section-order";
import {
  HOLI_2027_THEME,
  NEW_YEAR_2027_THEME,
  liveFestivalTheme,
  parsePreviewTheme,
} from "@/lib/festival";

/** Public homepage uses the 60s CMS cache; owner saves revalidate it. */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: content.settings.seo_title,
    description: content.settings.seo_description,
    openGraph: {
      title: content.settings.seo_title,
      description: content.settings.seo_description,
      url: SITE_URL,
      siteName: content.settings.site_name,
      images: content.settings.seo_og_image
        ? [{ url: content.settings.seo_og_image }]
        : undefined,
      type: "website",
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const content = await getSiteContent();
  const { settings, sections } = content;
  const sp = searchParams ? await searchParams : {};
  const previewRaw = typeof sp.preview_festival === "string" ? sp.preview_festival : "";
  const previewTheme = parsePreviewTheme(previewRaw);
  const liveTheme = previewTheme || liveFestivalTheme(settings);
  const newYearLive = liveTheme === NEW_YEAR_2027_THEME;
  const holiLive = liveTheme === HOLI_2027_THEME;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthClub",
    name: settings.site_name,
    description: settings.seo_description,
    telephone: settings.phone,
    email: settings.email,
    address: settings.address,
    url: SITE_URL,
    image: settings.seo_og_image || content.heroSlides[0]?.image_url,
  };

  return (
    <FestivalShell settings={settings} previewTheme={previewTheme}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar
        brand={settings.site_name}
        darkHero
        returningMessage={settings.returning_bar_text}
        menuLinks={content.sectionOrder.flatMap((key) => {
          const link = SECTION_NAV[key];
          if (!link) return [];
          if (key === "transformations") {
            return sections.transformations === true && content.transformations.length > 0
              ? [link]
              : [];
          }
          return sections[key] !== false ? [link] : [];
        })}
      />
      {sections.hero !== false ? (
        newYearLive ? (
          <NewYearHero popup={sections.popup === false ? null : content.popup} />
        ) : holiLive ? (
          <HoliHero popup={sections.popup === false ? null : content.popup} />
        ) : (
          <Hero
            settings={settings}
            slides={content.heroSlides}
            rating={content.reviews?.overall_rating}
            reviewCount={content.reviews?.total_reviews}
            popup={sections.popup === false ? null : content.popup}
          />
        )
      ) : null}
      {newYearLive ? <NewYearStory /> : null}
      {holiLive ? <HoliStory /> : null}
      {content.sectionOrder.map((key) => (
        <HomeSection key={key} sectionKey={key} content={content} />
      ))}
      {sections.footer !== false ? (
        <Footer settings={settings} hours={content.hours} />
      ) : null}
      <ClientErrorBoundary>
        <FloatingActions phone={settings.phone} whatsapp={settings.whatsapp} />
        <SpinOfferHost surface="website" />
      </ClientErrorBoundary>
    </FestivalShell>
  );
}
