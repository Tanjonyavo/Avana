"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-providers";
import { faqs, journalArticles } from "@/data/demo";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

export function SearchModal() {
  const { catalog, setSearchOpen } = useApp();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("fr");
  const hasQuery = normalized.length >= 2;
  const productResults = hasQuery
    ? catalog
        .filter((product) =>
          `${product.name} ${product.category} ${product.shortDescription}`
            .toLocaleLowerCase("fr")
            .includes(normalized),
        )
        .slice(0, 3)
    : [];
  const articleResults = hasQuery
    ? journalArticles
        .filter((article) =>
          `${article.title} ${article.excerpt}`.toLocaleLowerCase("fr").includes(normalized),
        )
        .slice(0, 2)
    : [];
  const faqResults = hasQuery
    ? faqs.filter((faq) => `${faq.q} ${faq.a}`.toLocaleLowerCase("fr").includes(normalized)).slice(0, 2)
    : [];
  const resultCount = productResults.length + articleResults.length + faqResults.length;
  const dialogRef = useDialogFocus<HTMLDivElement>(true, () => setSearchOpen(false));

  return (
    <div className="search-modal">
      <div className="drawer-overlay" aria-hidden="true" onClick={() => setSearchOpen(false)} />
      <div
        className="search-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
        tabIndex={-1}
      >
        <h2 className="sr-only" id="search-title">
          Recherche AVANA
        </h2>
        <div className="search-input-wrap">
          <Search size={21} />
          <input
            data-autofocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Produit, article, question…"
            aria-label="Rechercher"
          />
          <button className="nav-icon" onClick={() => setSearchOpen(false)} aria-label="Fermer la recherche">
            <X size={20} />
          </button>
        </div>
        <div className="search-results" aria-live="polite">
          {!hasQuery && (
            <div className="empty-state">
              <div>
                <p>Saisissez au moins deux caractères.</p>
                <span className="small">Raccourci clavier : Ctrl + K</span>
              </div>
            </div>
          )}
          {hasQuery && resultCount === 0 && (
            <div className="empty-state">
              <p>Aucun résultat pour « {query.trim()} ».</p>
            </div>
          )}
          {hasQuery && (
            <span className="sr-only">
              {resultCount} résultat{resultCount > 1 ? "s" : ""}
            </span>
          )}
          {productResults.map((product) => (
            <Link
              className="search-result"
              href={`/boutique/${product.slug}`}
              key={product.id}
              onClick={() => setSearchOpen(false)}
            >
              <Image src={product.image} alt="" width={60} height={60} />
              <div>
                <strong>{product.name}</strong>
                <span>Produit · {product.category}</span>
              </div>
            </Link>
          ))}
          {articleResults.map((article) => (
            <Link
              className="search-result"
              href={`/journal/${article.slug}`}
              key={article.slug}
              onClick={() => setSearchOpen(false)}
            >
              <div>
                <strong>{article.title}</strong>
                <span>Journal · {article.category}</span>
              </div>
            </Link>
          ))}
          {faqResults.map((faq) => (
            <Link className="search-result" href="/faq" key={faq.q} onClick={() => setSearchOpen(false)}>
              <div>
                <strong>{faq.q}</strong>
                <span>FAQ</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
