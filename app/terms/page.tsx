import { Navbar } from "@/components/site/Navbar";
import { getSiteContent } from "@/lib/cms/get-site-content";

export default async function TermsPage() {
  const { settings } = await getSiteContent();
  return (
    <>
      <Navbar brand={settings.site_name} />
      <main className="container-site prose prose-invert max-w-3xl px-5 py-28 md:px-8">
        <h1>Terms of Use</h1>
        <p>
          Website content is provided for general information about Action Plus
          Gym. Membership terms, pricing and offers are confirmed at the club.
          Promotional offers may expire or change without notice when configured
          in the website admin.
        </p>
      </main>
    </>
  );
}
