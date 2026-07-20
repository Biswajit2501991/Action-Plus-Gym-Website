import type { Metadata } from "next";
import { getSiteContent } from "@/lib/cms/get-site-content";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { Stats } from "@/components/site/Stats";
import { Services } from "@/components/site/Services";
import { Pricing } from "@/components/site/Pricing";
import { Trainers } from "@/components/site/Trainers";
import { Gallery } from "@/components/site/Gallery";
import { Videos } from "@/components/site/Videos";
import { Testimonials } from "@/components/site/Testimonials";
import { Hours } from "@/components/site/Hours";
import { Reviews } from "@/components/site/Reviews";
import { LeadForm } from "@/components/site/LeadForm";
import { Footer } from "@/components/site/Footer";
import { PopupOffer } from "@/components/site/PopupOffer";
import { FloatingActions } from "@/components/site/FloatingActions";
import { ClientErrorBoundary } from "@/components/site/ClientErrorBoundary";
import { SITE_URL } from "@/lib/config";

/** CMS-driven homepage — always fetch latest content from Supabase. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function HomePage() {
  const content = await getSiteContent();
  const { settings, sections } = content;

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar brand={settings.site_name} darkHero />
      {sections.hero !== false ? (
        <Hero settings={settings} slides={content.heroSlides} />
      ) : null}
      {sections.stats !== false ? <Stats stats={content.stats} /> : null}
      {sections.services !== false ? (
        <Services services={content.services} />
      ) : null}
      {sections.pricing !== false ? <Pricing plans={content.pricing} /> : null}
      {sections.trainers !== false ? (
        <Trainers trainers={content.trainers} />
      ) : null}
      {sections.gallery !== false ? (
        <Gallery images={content.gallery} />
      ) : null}
      {sections.videos !== false ? <Videos videos={content.videos} /> : null}
      {sections.testimonials !== false ? (
        <Testimonials items={content.testimonials} />
      ) : null}
      {sections.hours !== false ? (
        <Hours hours={content.hours} timezone={settings.timezone} />
      ) : null}
      {sections.reviews !== false && content.reviews ? (
        <Reviews reviews={content.reviews} />
      ) : null}
      {sections.contact !== false ? <LeadForm /> : null}
      {sections.footer !== false ? (
        <Footer settings={settings} hours={content.hours} />
      ) : null}
      {sections.popup !== false ? <PopupOffer popup={content.popup} /> : null}
      <ClientErrorBoundary>
        <FloatingActions phone={settings.phone} whatsapp={settings.whatsapp} />
      </ClientErrorBoundary>
    </>
  );
}
