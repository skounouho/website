import type { Metadata } from "next";
import "@fontsource-variable/alegreya";
import "@fontsource-variable/alegreya/wght-italic.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { FloatingNav } from "@/components/nav/FloatingNav";
import { ThemeScript } from "@/components/nav/theme-script";
import { SITE_URL } from "@/lib/site-url";

const SITE_TITLE = "Senou Kounouho";
const SITE_DESCRIPTION = "Writing, resume, and places by Senou Kounouho.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen pb-20 md:pb-0">
        <FloatingNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
