import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Partenaires au Canada" };
export default function CanadaPartnersPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Partenaires · Canada</span>
          <h1>Une chaîne d’arrivée légère, conforme et mesurable.</h1>
          <p className="lead">
            AVANA recherche des expertises canadiennes capables de réduire la complexité du lancement et de
            rendre chaque coût plus lisible.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell">
          <div className="article-grid">
            {[
              ["Importateurs", "Accompagnement des premiers volumes et responsabilités clairement définies."],
              [
                "Courtiers et logisticiens",
                "Documents, transport, assurance et statut douanier centralisés.",
              ],
              ["Conditionneurs", "Formats, étiquetage, contrôle et traçabilité des unités vendables."],
              [
                "Distributeurs",
                "Déploiement possible seulement après preuve de marché et capacité opérationnelle.",
              ],
            ].map(([title, copy]) => (
              <article className="article-card" key={title}>
                <span className="demo-badge">Partenaire recherché</span>
                <div>
                  <h2>{title}</h2>
                  <p className="muted">{copy}</p>
                </div>
              </article>
            ))}
          </div>
          <Link className="button button-dark" href="/contact" style={{ marginTop: "2rem" }}>
            Échanger avec AVANA <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
