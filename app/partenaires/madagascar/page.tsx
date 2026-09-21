import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Partenaires à Madagascar" };
export default function MadagascarPartnersPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Partenaires · Madagascar</span>
          <h1>Construire une relation documentée, régulière et capable d’évoluer.</h1>
          <p className="lead">
            AVANA souhaite identifier des partenaires autour de la qualité, de la documentation et de la
            traçabilité — sans publier de prix d’achat ni de relation non confirmée.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell">
          <div className="article-grid">
            {[
              ["Qualité", "Des caractéristiques explicites et des échantillons comparables."],
              ["Régularité", "Une capacité et des délais compris avant toute montée en volume."],
              ["Documentation", "Des informations d’origine et documents faciles à relier au lot."],
              ["Progression", "Une relation qui peut évoluer après validation du marché canadien."],
            ].map(([title, copy]) => (
              <article className="article-card" key={title}>
                <span className="demo-badge">Critère AVANA</span>
                <div>
                  <h2>{title}</h2>
                  <p className="muted">{copy}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="button-row" style={{ marginTop: "2rem" }}>
            <Link className="button button-dark" href="/contact">
              Présenter votre entreprise <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
