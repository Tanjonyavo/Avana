import type { Metadata } from "next";
import { Database, Eye, Link2, LockKeyhole } from "lucide-react";
import { TraceSearchForm } from "@/components/trace-search-form";
import { getLotSnapshot } from "@/lib/server/lots";

export const metadata: Metadata = {
  title: "Traçabilité",
  description: "Consultez le parcours documenté d’un lot de vanille AVANA.",
};

export const dynamic = "force-dynamic";

export default async function TraceabilityPage() {
  const snapshot = await getLotSnapshot();
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Traçabilité AVANA</span>
          <h1>Un lot. Un identifiant. Une histoire plus lisible.</h1>
          <p className="lead">
            Le système relie l’origine déclarée, les étapes logistiques et les produits, tout en séparant
            clairement les données publiques des informations internes.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell trace-page-grid">
          <div>
            <span className="eyebrow">Comment ça fonctionne</span>
            <h2>Comprendre ce que l’on achète.</h2>
            <p className="lead">
              Scannez le QR de l’emballage ou saisissez le lot pour consulter sa fiche publique.
            </p>
            <div className="feature-list">
              <div className="feature-list-item">
                <div className="feature-list-icon">
                  <Link2 size={19} />
                </div>
                <div>
                  <h3>Une chaîne reliée</h3>
                  <p>Le produit, son lot et les événements de parcours partagent le même identifiant.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="feature-list-icon">
                  <Eye size={19} />
                </div>
                <div>
                  <h3>Des données explicites</h3>
                  <p>Chaque donnée non confirmée est identifiée comme hypothèse ou démonstration.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="feature-list-icon">
                  <LockKeyhole size={19} />
                </div>
                <div>
                  <h3>Une confidentialité maîtrisée</h3>
                  <p>Les fournisseurs, coûts et documents sensibles restent dans AVANA OS.</p>
                </div>
              </div>
              <div className="feature-list-item">
                <div className="feature-list-icon">
                  <Database size={19} />
                </div>
                <div>
                  <h3>Une base évolutive</h3>
                  <p>
                    L’architecture peut intégrer analyses, documents et contrôles lorsque ceux-ci existent.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <TraceSearchForm demo={snapshot.mode === "demo"} />
            {snapshot.message && (
              <p className="form-feedback" role="status">
                {snapshot.message}
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
