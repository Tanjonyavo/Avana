import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

const segments: Record<string, { name: string; headline: string; needs: string[]; recommendation: string }> =
  {
    patisseries: {
      name: "Pâtisseries",
      headline: "La vanille AVANA pour les pâtisseries.",
      needs: [
        "Régularité des approvisionnements",
        "Formats adaptés à la production",
        "Traçabilité du lot",
        "Échantillons pour essais",
      ],
      recommendation: "Gousses et poudre selon les appareils, infusions et productions en volume.",
    },
    restaurants: {
      name: "Restaurants",
      headline: "Une vanille lisible pour les cuisines créatives.",
      needs: [
        "Polyvalence en cuisine et dessert",
        "Formats simples à stocker",
        "Information d’origine",
        "Accompagnement à l’usage",
      ],
      recommendation: "Gousses pour l’infusion et poudre pour l’intégration rapide.",
    },
    chocolatiers: {
      name: "Chocolateries",
      headline: "La vanille AVANA au service du cacao.",
      needs: ["Profil produit documenté", "Dosage reproductible", "Formats professionnels", "Suivi par lot"],
      recommendation: "Formats à tester directement dans vos ganaches, pralinés et préparations.",
    },
  };

export function generateStaticParams() {
  return Object.keys(segments).map((segment) => ({ segment }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ segment: string }>;
}): Promise<Metadata> {
  const { segment } = await params;
  const item = segments[segment];
  return item ? { title: `Vanille pour ${item.name.toLowerCase()}`, description: item.headline } : {};
}
export default async function ProfessionalSegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  const item = segments[segment];
  if (!item) notFound();
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Professionnels · {item.name}</span>
          <h1>{item.headline}</h1>
          <p className="lead">
            AVANA construit son offre professionnelle avec les artisans, en partant des usages et contraintes
            réels.
          </p>
          <div className="button-row" style={{ marginTop: "2rem" }}>
            <Link className="button button-dark" href="/professionnels#demande">
              Parler de vos besoins <ArrowRight size={17} />
            </Link>
            <Link className="button button-outline" href="/boutique">
              Voir les formats
            </Link>
          </div>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell editorial-grid">
          <div>
            <span className="eyebrow">Ce que nous voulons comprendre</span>
            <h2>Une offre construite depuis votre laboratoire.</h2>
            <p className="lead">{item.recommendation}</p>
          </div>
          <div className="content-list">
            {item.needs.map((need, index) => (
              <div className="content-list-row" key={need}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{need}</strong>
                  <p>À documenter lors d’une entrevue ou d’un essai de démonstration.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
