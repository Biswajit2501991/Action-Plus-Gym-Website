import { Navbar } from "@/components/site/Navbar";
import { getSiteContent } from "@/lib/cms/get-site-content";

export default async function PrivacyPage() {
  const { settings } = await getSiteContent();
  return (
    <>
      <Navbar brand={settings.site_name} />
      <main className="container-site prose prose-invert max-w-3xl px-5 py-28 md:px-8">
        <h1>Privacy Policy</h1>
        <p>
          Action Plus Gym collects contact details submitted through this website
          (name, mobile, email and enquiry notes) to respond to membership and
          trial requests. Data is stored securely and accessed only by authorised
          staff. Contact us to request updates or deletion of your information.
        </p>
      </main>
    </>
  );
}
