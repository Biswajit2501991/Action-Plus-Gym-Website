import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans, Syne } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://actionplusgym.com",
  ),
  title: {
    default: "Action Plus Gym | Premium Fitness Club",
    template: "%s | Action Plus Gym",
  },
  description:
    "Premium gym training, personal coaching, and world-class facilities at Action Plus Gym.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-IN"
      className={`${syne.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <Script id="apg-theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
