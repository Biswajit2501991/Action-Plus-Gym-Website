import type { Metadata } from "next";
import { getSiteContent } from "@/lib/cms/get-site-content";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { LeadForm } from "@/components/site/LeadForm";
import { FloatingActions } from "@/components/site/FloatingActions";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Action Plus Gym for memberships, trials, and enquiries.",
};

export default async function ContactPage() {
  const content = await getSiteContent();
  const { settings } = content;

  return (
    <>
      <Navbar brand={settings.site_name} />
      <main className="pt-28">
        <section className="container-site px-5 pb-10 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">
            Contact
          </p>
          <h1 className="mt-3 font-display text-4xl text-white md:text-6xl">
            Let&apos;s talk training
          </h1>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="space-y-4 rounded-3xl border border-white/10 bg-charcoal/50 p-6 text-sm text-white/80">
              <p>
                <span className="text-muted">Address</span>
                <br />
                {settings.address}
              </p>
              <p>
                <span className="text-muted">Phone</span>
                <br />
                <a href={`tel:${settings.phone}`} className="text-gold">
                  {settings.phone}
                </a>
              </p>
              <p>
                <span className="text-muted">Email</span>
                <br />
                <a href={`mailto:${settings.email}`} className="text-gold">
                  {settings.email}
                </a>
              </p>
              {settings.whatsapp ? (
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, "")}`}
                  className="inline-flex rounded-full bg-[#25D366] px-5 py-3 font-semibold text-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp Us
                </a>
              ) : null}
              {settings.map_embed_url ? (
                <iframe
                  title="Map"
                  src={settings.map_embed_url}
                  className="mt-4 h-64 w-full rounded-2xl border-0"
                  loading="lazy"
                />
              ) : (
                <div className="mt-4 flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-muted">
                  Add a Google Maps embed URL in admin settings.
                </div>
              )}
            </div>
            <div className="-mt-16 md:mt-0">
              <LeadForm
                defaultSource="website_contact"
                title="Send an enquiry"
                subtitle="We respond quickly during opening hours."
              />
            </div>
          </div>
        </section>
      </main>
      <Footer settings={settings} hours={content.hours} />
      <FloatingActions phone={settings.phone} whatsapp={settings.whatsapp} />
    </>
  );
}
