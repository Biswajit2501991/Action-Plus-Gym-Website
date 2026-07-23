import type { Metadata, Viewport } from "next";

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
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/manifest-member-portal.webmanifest",
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
  return children;
}
