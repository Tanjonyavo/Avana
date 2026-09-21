import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, FlaskConical, Scale, Sprout } from "lucide-react";

export const metadata: Metadata = {
  title: "Notre approche",
  description: "Une approche progressive de la qualité, de l’origine et de la traçabilité.",
};
export default function ApproachPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Notre approche</span>
          <h1>Dire ce que l’on sait. Montrer ce qui reste à construire.</h1>
          <p className="lead">
            La transparence d’AVANA commence par une distinction simple : donnée réelle, hypothèse ou
            démonstration.
          </p>
        </div>
      </section>
      <section className="page-section pillar-section">
        <div className="section-shell">
          <div className="pillar-grid">
            <div className="pillar">
              <div className="pillar-icon">
                <Sprout size={20} />
              </div>
              <h3>Origine</h3>
              <p>
                Documenter le pays, la région, l’espèce et le parcours de chaque lot avec le niveau de
                précision disponible.
              </p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <FlaskConical size={20} />
              </div>
              <h3>Qualité</h3>
              <p>Définir des critères, consigner les contrôles et ne publier aucun résultat non vérifié.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <Database size={20} />
              </div>
              <h3>Traçabilité</h3>
              <p>Relier lots, produits, stocks et commandes dans une architecture commune.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <Scale size={20} />
              </div>
              <h3>Progression</h3>
              <p>Privilégier une importation légère avant d’envisager davantage de contrôle opérationnel.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell editorial-grid">
          <div>
            <span className="eyebrow">Phase 1</span>
            <h2>Valider sans surdimensionner.</h2>
            <p className="lead">
              Le modèle étudié privilégie un importateur canadien conforme, des partenaires logistiques et des
              volumes limités pour apprendre rapidement.
            </p>
            <p className="muted">
              Ces choix restent des hypothèses opérationnelles et ne constituent pas l’annonce d’un dispositif
              déjà actif.
            </p>
          </div>
          <div className="content-list">
            <div className="content-list-row">
              <span>01</span>
              <div>
                <strong>Fournisseurs et échantillons</strong>
                <p>Comparer la qualité, la régularité et la documentation disponible.</p>
              </div>
            </div>
            <div className="content-list-row">
              <span>02</span>
              <div>
                <strong>Importation et conformité</strong>
                <p>Valider les responsabilités, les documents et le coût rendu Québec.</p>
              </div>
            </div>
            <div className="content-list-row">
              <span>03</span>
              <div>
                <strong>Marché B2C et B2B</strong>
                <p>Tester l’intérêt, le prix acceptable, les usages et le réachat.</p>
              </div>
            </div>
            <div className="content-list-row">
              <span>04</span>
              <div>
                <strong>Phase 2 potentielle</strong>
                <p>
                  Envisager import direct, volumes supérieurs et produits transformés seulement après
                  validation.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="button-row" style={{ marginTop: "3rem" }}>
          <Link className="button button-dark" href="/tracabilite">
            Explorer la traçabilité <ArrowRight size={17} />
          </Link>
          <Link className="button button-outline" href="/laboratoire">
            Laboratoire AVANA
          </Link>
        </div>
      </section>
    </>
  );
}
