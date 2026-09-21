import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Notre histoire",
  description: "De Madagascar au Québec : découvrez la vision progressive d’AVANA.",
};

export default function StoryPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Notre histoire</span>
          <h1>De Madagascar au Québec.</h1>
          <p className="lead">
            AVANA est née de la volonté de créer une chaîne de valeur moderne autour d’un produit emblématique
            de Madagascar.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell editorial-grid">
          <div className="editorial-visual quote">
            <Image
              src="/images/avana-hero.png"
              alt="Gousses de vanille sur une surface naturelle"
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <blockquote>Commencer simplement. Documenter sérieusement. Évoluer avec la demande.</blockquote>
          </div>
          <div>
            <span className="eyebrow">Deux expertises complémentaires</span>
            <h2>La matière et la donnée.</h2>
            <p className="lead">
              Le projet associe sciences des aliments et technologies numériques afin de travailler
              simultanément sur la qualité, le développement produit, la traçabilité et l’expérience client.
            </p>
            <div className="content-list">
              <div className="content-list-row">
                <span>01</span>
                <div>
                  <strong>Sciences des aliments</strong>
                  <p>
                    Formulation, sécurité, stabilité, contrôle qualité, procédés, tests sensoriels et
                    développement produit.
                  </p>
                </div>
              </div>
              <div className="content-list-row">
                <span>02</span>
                <div>
                  <strong>Informatique</strong>
                  <p>
                    Systèmes d’information, bases de données, QR, e-commerce, automatisation, tableaux de bord
                    et analyse.
                  </p>
                </div>
              </div>
              <div className="content-list-row">
                <span>03</span>
                <div>
                  <strong>Une méthode commune</strong>
                  <p>
                    Transformer chaque apprentissage opérationnel en information utile pour mieux décider.
                  </p>
                </div>
              </div>
            </div>
            <Link className="button button-dark" href="/notre-approche" style={{ marginTop: "2rem" }}>
              Voir notre approche <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
      <section className="page-section" style={{ background: "var(--cream-100)" }}>
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">La stratégie</span>
              <h2>Preuve de marché → rentabilité → maîtrise → croissance.</h2>
            </div>
            <p>
              AVANA ne cherche pas à surdimensionner sa chaîne dès le départ. Le modèle vise des étapes
              testables, mesurables et réversibles.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
