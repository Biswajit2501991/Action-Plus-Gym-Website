import type { Metadata, Viewport } from "next";
import { MemberPortalServiceWorkerBootstrap } from "@/components/members/MemberPortalServiceWorkerBootstrap";

/** Bump when home-screen icons change — iOS caches apple-touch-icon by URL path. */
const ICON_V = "v3";

export const metadata: Metadata = {
  title: "Member Portal | Action Plus Gym",
  description: "Secure member portal — membership card, billing reminders, and training.",
  applicationName: "Action Plus Gym",
  appleWebApp: {
    capable: true,
    title: "Action Plus",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: `/apg-touch-${ICON_V}-180.png`, sizes: "180x180", type: "image/png" }],
    icon: [
      { url: `/apg-icon-${ICON_V}-192.png`, sizes: "192x192", type: "image/png" },
      { url: `/apg-icon-${ICON_V}-512.png`, sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: `/manifest-member-portal.webmanifest?${ICON_V}`,
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#f2f0eb" },
  ],
};

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MemberPortalServiceWorkerBootstrap />
      {children}
    </>
  );
}
