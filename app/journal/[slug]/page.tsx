import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { journalArticles } from "@/data/demo";

const content: Record<string, Array<{ title: string; text: string }>> = {
  "utiliser-gousse-vanille": [
    {
      title: "1. Assouplir et fendre",
      text: "Posez la gousse à plat. Avec la pointe d’un couteau, ouvrez-la délicatement dans le sens de la longueur sans nécessairement séparer les deux moitiés.",
    },
    {
      title: "2. Récupérer les graines",
      text: "Passez le dos de la lame le long de la gousse pour recueillir les graines. Incorporez-les ensuite à votre préparation.",
    },
    {
      title: "3. Valoriser l’enveloppe",
      text: "L’enveloppe peut être infusée dans un liquide adapté à la recette. Retirez-la avant le service si nécessaire.",
    },
    {
      title: "4. Conserver avec soin",
      text: "Gardez les gousses restantes dans un contenant hermétique, à l’abri de la chaleur, de la lumière et de l’humidité excessive.",
    },
  ],
  "vanilla-planifolia": [
    {
      title: "Un repère d’espèce",
      text: "Vanilla planifolia est l’espèce ciblée par AVANA pour son MVP. L’espèce déclarée est enregistrée dans chaque fiche lot.",
    },
    {
      title: "Une donnée, pas une allégation",
      text: "Le nom botanique n’indique pas à lui seul la qualité, le grade ou les caractéristiques chimiques d’un produit. Ces éléments doivent provenir de données propres au lot.",
    },
    {
      title: "Une architecture documentée",
      text: "Le système prévoit le pays, la région, l’espèce, les dates et les documents associés pour rendre l’information plus facile à retrouver.",
    },
  ],
  "tracabilite-alimentaire": [
    {
      title: "Relier les objets",
      text: "Un lot peut être relié aux produits conditionnés et aux commandes, tandis qu’un produit permet de remonter vers son lot d’origine.",
    },
    {
      title: "Séparer public et privé",
      text: "L’origine déclarée et les étapes générales peuvent être publiques. Les prix d’achat, contacts fournisseurs et documents confidentiels restent internes.",
    },
    {
      title: "Ne pas confondre présence et conformité",
      text: "Le fait de documenter une vérification ne constitue pas une certification. AVANA OS aide à suivre le travail, sans remplacer une validation réglementaire.",
    },
  ],
};

export function generateStaticParams() {
  return journalArticles.map((article) => ({ slug: article.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = journalArticles.find((item) => item.slug === slug);
  return article ? { title: article.title, description: article.excerpt } : {};
}
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = journalArticles.find((item) => item.slug === slug);
  if (!article) notFound();
  return (
    <>
      <section className="page-hero">
        <div className="section-shell" style={{ maxWidth: 900 }}>
          <Link className="text-link small" href="/journal">
            <ArrowLeft size={15} /> Retour au journal
          </Link>
          <div style={{ marginTop: "3rem" }}>
            <span className="eyebrow">
              {article.category} · {article.readTime}
            </span>
            <h1>{article.title}</h1>
            <p className="lead">{article.excerpt}</p>
          </div>
        </div>
      </section>
      <article className="page-section">
        <div className="section-shell" style={{ maxWidth: 780 }}>
          <div className="payment-demo">
            Contenu pédagogique de démonstration. Les affirmations techniques et réglementaires devront être
            relues et sourcées avant publication commerciale.
          </div>
          {content[slug]?.map((section) => (
            <section key={section.title} style={{ margin: "3rem 0" }}>
              <h2 style={{ fontSize: "2.25rem" }}>{section.title}</h2>
              <p className="lead">{section.text}</p>
            </section>
          ))}
        </div>
      </article>
    </>
  );
}
