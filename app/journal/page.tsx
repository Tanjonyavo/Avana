import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { journalArticles } from "@/data/demo";

export const metadata: Metadata = {
  title: "Journal",
  description: "Guides AVANA sur la vanille, son usage, son origine et sa traçabilité.",
};
export default function JournalPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Journal AVANA</span>
          <h1>Mieux comprendre la vanille.</h1>
          <p className="lead">
            Des guides sobres sur les gestes, l’origine et la traçabilité — avec une architecture prête à
            accueillir des sources vérifiées.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell article-grid">
          {journalArticles.map((article) => (
            <Link className="article-card" href={`/journal/${article.slug}`} key={article.slug}>
              <div className="article-meta">
                <span>{article.category}</span>
                <span>{article.readTime}</span>
              </div>
              <div>
                <h2>{article.title}</h2>
                <p className="muted">{article.excerpt}</p>
              </div>
              <span className="text-link">
                Lire le guide <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
