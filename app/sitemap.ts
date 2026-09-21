import type { MetadataRoute } from "next";
import { journalArticles } from "@/data/demo";
import { COMMERCE_ENABLED, SITE_URL } from "@/lib/site";
import { getCatalogSnapshot } from "@/lib/server/catalog";
import { getLotSnapshot } from "@/lib/server/lots";

const editorialRoutes = [
  "",
  "/tracabilite",
  "/professionnels",
  "/professionnels/patisseries",
  "/professionnels/chocolatiers",
  "/professionnels/restaurants",
  "/notre-histoire",
  "/notre-approche",
  "/pourquoi-avana",
  "/madagascar",
  "/laboratoire",
  "/journal",
  "/quiz",
  "/faq",
  "/contact",
  "/partenaires/canada",
  "/partenaires/madagascar",
  "/politiques/confidentialite",
  "/politiques/livraison",
  "/politiques/retours",
  "/politiques/conditions",
  "/politiques/cookies",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, lotSnapshot] = await Promise.all([getCatalogSnapshot(), getLotSnapshot()]);
  const routes = [
    ...editorialRoutes,
    ...journalArticles.map((article) => `/journal/${article.slug}`),
    ...(COMMERCE_ENABLED
      ? ["/boutique", ...catalog.products.map((product) => `/boutique/${product.slug}`)]
      : []),
    ...lotSnapshot.lots
      .filter((lot) => lot.publicTraceabilityEnabled && lot.dataStatus === "Réel")
      .map((lot) => `/tracabilite/${lot.code}`),
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.startsWith("/journal/") ? 0.65 : 0.8,
  }));
}
