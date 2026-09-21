import type { Metadata } from "next";
import { Beaker, FlaskConical, LockKeyhole } from "lucide-react";

export const metadata: Metadata = { title: "Laboratoire AVANA" };
export default function LabPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Laboratoire AVANA</span>
          <h1>Explorer les produits de demain, sans les présenter comme disponibles aujourd’hui.</h1>
          <p className="lead">
            Un espace de R&D pour structurer les essais, la formulation, la stabilité et les exigences
            techniques futures.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="demo-badge">Produits en développement — non disponibles à la vente</span>
              <h2 style={{ marginTop: "1rem" }}>Une vision, pas une promesse commerciale.</h2>
            </div>
            <p>
              Chaque piste devra franchir des étapes techniques, réglementaires et économiques avant toute
              mise en marché.
            </p>
          </div>
          <div className="article-grid">
            {[
              ["Pâte de vanille", "R&D futur", Beaker],
              ["Extrait de vanille", "Évaluation réglementaire et technique", FlaskConical],
              ["Sucre et sirop", "Hors MVP commercial", LockKeyhole],
            ].map(([title, copy, Icon]) => {
              const IconComponent = Icon as typeof Beaker;
              return (
                <article className="article-card" key={String(title)}>
                  <IconComponent size={28} />
                  <div>
                    <h2>{String(title)}</h2>
                    <p className="muted">{String(copy)}</p>
                  </div>
                  <span className="status-badge warning">Non disponible</span>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
