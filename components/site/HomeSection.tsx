import { Stats } from "@/components/site/Stats";
import { Services } from "@/components/site/Services";
import { Pricing } from "@/components/site/Pricing";
import { Trainers } from "@/components/site/Trainers";
import { Transformations } from "@/components/site/Transformations";
import { Gallery } from "@/components/site/Gallery";
import { Videos } from "@/components/site/Videos";
import { Testimonials } from "@/components/site/Testimonials";
import { Hours } from "@/components/site/Hours";
import { Reviews } from "@/components/site/Reviews";
import { LeadForm } from "@/components/site/LeadForm";
import type { SiteContent } from "@/lib/types";

export function HomeSection({
  sectionKey,
  content,
}: {
  sectionKey: string;
  content: SiteContent;
}) {
  const { sections, settings } = content;

  switch (sectionKey) {
    case "stats":
      return sections.stats !== false ? <Stats stats={content.stats} /> : null;
    case "transformations":
      return sections.transformations === true && content.transformations.length > 0 ? (
        <Transformations items={content.transformations} />
      ) : null;
    case "pricing":
      return sections.pricing !== false ? <Pricing plans={content.pricing} /> : null;
    case "trainers":
      return sections.trainers !== false ? <Trainers trainers={content.trainers} /> : null;
    case "services":
      return sections.services !== false ? <Services services={content.services} /> : null;
    case "gallery":
      return sections.gallery !== false ? <Gallery images={content.gallery} /> : null;
    case "videos":
      return sections.videos !== false ? <Videos videos={content.videos} /> : null;
    case "testimonials":
      return sections.testimonials !== false ? (
        <Testimonials items={content.testimonials} />
      ) : null;
    case "hours":
      return sections.hours !== false ? (
        <Hours hours={content.hours} timezone={settings.timezone} />
      ) : null;
    case "reviews":
      return sections.reviews !== false && content.reviews ? (
        <Reviews reviews={content.reviews} />
      ) : null;
    case "contact":
      return sections.contact !== false ? (
        <LeadForm
          contactPhone={settings.phone}
          contactEmail={settings.email}
          contactWhatsapp={settings.whatsapp}
        />
      ) : null;
    default:
      return null;
  }
}
