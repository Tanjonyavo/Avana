import type { MetadataRoute } from "next";
import { COMMERCE_ENABLED } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AVANA — Vanille de Madagascar",
    short_name: "AVANA",
    description: COMMERCE_ENABLED
      ? "Boutique québécoise de vanille de Madagascar et traçabilité AVANA"
      : "Plateforme québécoise de précommercialisation et de traçabilité AVANA",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fbf8f1",
    theme_color: "#17352d",
    lang: "fr-CA",
    categories: ["food", "shopping", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Rechercher un lot", short_name: "Traçabilité", url: "/tracabilite" },
      { name: "Découvrir AVANA", short_name: "Notre histoire", url: "/notre-histoire" },
    ],
  };
}
