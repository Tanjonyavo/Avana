import type { Metadata } from "next";
import Link from "next/link";
import { B2BForm } from "@/components/b2b-form";

export const metadata: Metadata = {
  title: "Professionnels",
  description:
    "Gousses et poudre de vanille de Madagascar pour pâtisseries, restaurants, chocolateries et artisans.",
};

export default function ProfessionalsPage() {
  const segments = [
    ["Pâtisseries", "/professionnels/patisseries"],
    ["Chocolateries", "/professionnels/chocolatiers"],
    ["Restaurants", "/professionnels/restaurants"],
    ["Boulangeries", "#demande"],
    ["Glaciers", "#demande"],
    ["Cafés", "#demande"],
    ["Traiteurs", "#demande"],
    ["Fabricants", "#demande"],
  ];
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">AVANA pour les professionnels</span>
          <h1>Une vanille mieux documentée pour vos créations.</h1>
          <p className="lead">
            Nous échangeons avec les professionnels pour comprendre les usages, formats, volumes et critères
            qui comptent vraiment.
          </p>
          <a className="button button-dark" href="#demande">
            Parler de vos besoins
          </a>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell professional-layout">
          <div className="professional-copy">
            <span className="eyebrow">Validation B2B</span>
            <h2>Construire l’offre avec le terrain.</h2>
            <p className="lead">
              Le programme professionnel est en phase de validation. Votre demande nous aide à concevoir une
              offre utile, réaliste et adaptée au marché québécois.
            </p>
            <div className="segment-list">
              {segments.map(([label, href]) => (
                <Link href={href} key={label}>
                  {label}
                </Link>
              ))}
            </div>
            <div className="content-list">
              <div className="content-list-row">
                <span>01</span>
                <div>
                  <strong>Comprendre l’usage</strong>
                  <p>Recettes, fréquence, rendement recherché et contraintes de production.</p>
                </div>
              </div>
              <div className="content-list-row">
                <span>02</span>
                <div>
                  <strong>Tester le bon format</strong>
                  <p>Gousses, poudre, conditionnements et quantités réalistes.</p>
                </div>
              </div>
              <div className="content-list-row">
                <span>03</span>
                <div>
                  <strong>Documenter la qualité</strong>
                  <p>Informations lot, traçabilité et critères utiles à vos équipes.</p>
                </div>
              </div>
            </div>
          </div>
          <B2BForm />
        </div>
      </section>
    </>
  );
}
