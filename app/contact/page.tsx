import type { Metadata } from "next";
import { getSiteContent } from "@/lib/cms/get-site-content";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { LeadForm } from "@/components/site/LeadForm";
import { FloatingActions } from "@/components/site/FloatingActions";
import { ClientErrorBoundary } from "@/components/site/ClientErrorBoundary";
import { isGoogleMapsEmbedUrl, normalizeGoogleMapsEmbedUrl } from "@/lib/maps";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        <section className="container-site px-5 pb-14 md:px-8">
          {/*
            Mobile: stacked Contact block first, then Join.
            Desktop: two equal columns side by side.
          */}
          <div className="flex flex-col gap-10 md:grid md:grid-cols-2 md:items-stretch md:gap-8">
            <div className="order-1 flex min-h-0 flex-col">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">
                Contact
              </p>
              <h1 className="mt-3 font-display text-3xl text-white md:text-5xl">
                Let&apos;s talk training
              </h1>
              <p className="mt-3 min-h-[2.5rem] text-sm text-muted">
                Visit us in Adra, call, or message — we&apos;re here to help you start.
              </p>
              <div className="mt-6 flex min-h-[28rem] flex-1 flex-col space-y-4 rounded-3xl border border-white/10 bg-charcoal/50 p-6 text-sm text-white/80 md:min-h-[34rem]">
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
                    className="inline-flex w-fit rounded-full bg-[#25D366] px-5 py-3 font-semibold text-white"
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp Us
                  </a>
                ) : null}
                <div className="mt-auto h-56 w-full overflow-hidden rounded-2xl border border-white/10 md:h-72">
                  {isGoogleMapsEmbedUrl(settings.map_embed_url) ? (
                    <iframe
                      title="Map"
                      src={normalizeGoogleMapsEmbedUrl(settings.map_embed_url)}
                      className="h-full w-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 bg-black/40 px-4 text-center text-sm text-muted">
                      <p>Map needs a Google Maps embed link (not a search or reviews page).</p>
                      <p className="text-xs">
                        Admin → Contact &amp; Brand → Google Maps embed URL
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div id="join" className="order-2 flex min-h-0 flex-col">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">
                Join
              </p>
              <h2 className="mt-3 font-display text-3xl text-white md:text-5xl">
                Send an enquiry
              </h2>
              <p className="mt-3 min-h-[2.5rem] text-sm text-muted">
                We respond quickly during opening hours.
              </p>
              <div className="mt-6 flex min-h-[28rem] flex-1 flex-col rounded-3xl border border-white/10 bg-charcoal/50 p-6 md:min-h-[34rem] md:p-8">
                <LeadForm
                  embedded
                  defaultSource="website_contact"
                  title="Send an enquiry"
                  subtitle="We respond quickly during opening hours."
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer settings={settings} hours={content.hours} />
      <ClientErrorBoundary>
        <FloatingActions phone={settings.phone} whatsapp={settings.whatsapp} />
      </ClientErrorBoundary>
    </>
  );
}
