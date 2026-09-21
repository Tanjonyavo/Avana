import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, FlaskConical, Sprout, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Pourquoi AVANA ?" };
export default function WhyPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Pourquoi AVANA ?</span>
          <h1>Une vanille pensée comme un produit, un lot et une histoire.</h1>
          <p className="lead">
            Quatre piliers structurent l’expérience AVANA dès la phase de précommercialisation.
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
              <p>Madagascar et la région SAVA comme repères documentés.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <FlaskConical size={20} />
              </div>
              <h3>Sélection</h3>
              <p>Une approche structurée de la qualité, sans garantie inventée.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <Database size={20} />
              </div>
              <h3>Technologie</h3>
              <p>Traçabilité et données pour mieux relier la chaîne.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <TrendingUp size={20} />
              </div>
              <h3>Progression</h3>
              <p>Un modèle qui évolue avec la demande réelle.</p>
            </div>
          </div>
          <Link className="button button-light" href="/notre-approche" style={{ marginTop: "3rem" }}>
            Découvrir la méthode <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
