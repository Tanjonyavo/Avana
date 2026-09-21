import type { Metadata } from "next";
import { ShopCatalog } from "@/components/shop-catalog";
import { getCatalogSnapshot } from "@/lib/server/catalog";
import { COMMERCE_ENABLED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Boutique",
  description: COMMERCE_ENABLED
    ? "Découvrez les gousses et la poudre de vanille de Madagascar proposées par AVANA au Canada."
    : "Découvrez les gousses et la poudre de vanille de Madagascar proposées dans la boutique de démonstration AVANA.",
  robots: COMMERCE_ENABLED ? undefined : { index: false, follow: true },
};

export default async function ShopPage() {
  const catalog = await getCatalogSnapshot();
  return (
    <>
      <section className="page-hero">
        <div className="section-shell page-hero-row">
          <div>
            <span className="eyebrow">
              {catalog.mode === "live" ? "Boutique AVANA" : "Boutique de démonstration"}
            </span>
            <h1>La vanille, dans sa forme la plus utile.</h1>
            <p className="lead">
              Gousses entières, poudre fine et formats de découverte : un catalogue volontairement concentré,
              avec disponibilité vérifiée au paiement.
            </p>
          </div>
          <aside className="page-hero-aside">
            <span className="demo-badge">
              {catalog.mode === "live" ? "Catalogue en direct" : "Données démo"}
            </span>
            <strong>{catalog.mode === "live" ? "Prix en dollars canadiens" : "Prix configurables"}</strong>
            <p className="small muted">
              {catalog.message ||
                (catalog.mode === "live"
                  ? "Paiement sécurisé et stocks confirmés côté serveur."
                  : "Aucun paiement réel n’est traité sur cette version.")}
            </p>
          </aside>
        </div>
      </section>
      <ShopCatalog products={catalog.products} mode={catalog.mode} />
    </>
  );
}
