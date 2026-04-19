import type { Metadata } from "next";
import "@fontsource-variable/alegreya";
import "@fontsource-variable/alegreya/wght-italic.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { FloatingNav } from "@/components/nav/FloatingNav";
import { ThemeScript } from "@/components/nav/theme-script";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Senou Kounouho",
    template: "%s — Senou Kounouho",
  },
  description: "Writing, resume, and places by Senou Kounouho.",
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
