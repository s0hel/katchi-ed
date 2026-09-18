import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: "Katchi — practice that adapts",
    template: "%s · Katchi",
  },
  description:
    "Adaptive practice and assessments for K-8 math and language arts, with a lesson video on every skill.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2029" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
