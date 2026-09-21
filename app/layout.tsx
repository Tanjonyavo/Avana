import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { RouteChrome } from "@/components/route-chrome";
import { absoluteUrl } from "@/lib/site";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { getCatalogSnapshot } from "@/lib/server/catalog";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { connection } from "next/server";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  title: {
    default: "AVANA — Vanille de Madagascar, développée au Québec",
    template: "%s — AVANA",
  },
  description:
    "AVANA développe au Québec une nouvelle façon de valoriser la vanille de Madagascar autour de la qualité, de l’origine et de la traçabilité.",
  openGraph: {
    title: "AVANA — Madagascar → Québec",
    description: "Une vanille mieux documentée.",
    type: "website",
    locale: "fr_CA",
    siteName: "AVANA",
    images: [
      { url: "/images/avana-still-life-v2.webp", width: 1536, height: 1024, alt: "Univers produit AVANA" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AVANA — Madagascar → Québec",
    description: "Une vanille mieux documentée.",
    images: ["/images/avana-still-life-v2.webp"],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const catalog = await getCatalogSnapshot();
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <AppProviders catalog={catalog.products} catalogMode={catalog.mode}>
          <RouteChrome>{children}</RouteChrome>
          <AnalyticsTracker />
          <ServiceWorkerRegistration />
        </AppProviders>
      </body>
    </html>
  );
}
