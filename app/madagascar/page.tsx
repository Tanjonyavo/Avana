import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Madagascar et la vanille",
  description: "Comprendre l’origine ciblée par AVANA : Madagascar, la région SAVA et Vanilla planifolia.",
};
export default function MadagascarPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Origine</span>
          <h1>Madagascar, au cœur du projet.</h1>
          <p className="lead">
            AVANA vise à mieux documenter la vanille de Madagascar au Canada, sans réduire son origine à une
            simple image de marque.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell editorial-grid">
          <div>
            <span className="eyebrow">Repère botanique</span>
            <h2>
              <em>Vanilla planifolia</em>
            </h2>
            <p className="lead">
              L’espèce ciblée pour les produits AVANA. Chaque fiche lot permet d’enregistrer l’espèce déclarée
              et les données propres à l’approvisionnement.
            </p>
            <p className="muted">
              Les contenus pédagogiques de cette démonstration restent volontairement sobres. Une version de
              production ajoutera des références institutionnelles et scientifiques vérifiées.
            </p>
            <Link className="button button-dark" href="/journal/vanilla-planifolia">
              Lire le guide <ArrowRight size={17} />
            </Link>
          </div>
          <figure className="editorial-visual origin-visual">
            <Image
              src="/images/vanilla-cultivation-v2.webp"
              alt="Gousses vertes de Vanilla planifolia inspectées sur leur liane"
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <figcaption>Image éditoriale illustrative · aucun fournisseur n’est identifié</figcaption>
          </figure>
        </div>
      </section>
      <section className="page-section" style={{ background: "var(--cream-100)" }}>
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Région cible</span>
              <h2>SAVA, comme donnée d’origine à documenter.</h2>
            </div>
            <p>
              Le système AVANA prévoit des champs pour le pays, la région et les documents liés. Il n’affiche
              aucune exploitation précise ni relation fournisseur sans confirmation.
            </p>
          </div>
          <div className="lot-facts" style={{ marginTop: 0 }}>
            <div className="lot-fact">
              <span>Pays ciblé</span>
              <strong>Madagascar</strong>
            </div>
            <div className="lot-fact">
              <span>Région ciblée</span>
              <strong>SAVA</strong>
            </div>
            <div className="lot-fact">
              <span>Espèce</span>
              <strong>
                <em>Vanilla planifolia</em>
              </strong>
            </div>
            <div className="lot-fact">
              <span>Précision fournisseur</span>
              <strong>Confidentielle / à confirmer</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
