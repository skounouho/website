import type { Metadata } from "next";
import "@fontsource-variable/alegreya";
import "@fontsource-variable/alegreya/wght-italic.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Senou Kounouho",
  description: "Personal site.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
