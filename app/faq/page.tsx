import type { Metadata } from "next";
import Link from "next/link";
import { faqs } from "@/data/demo";
import { COMMERCE_ENABLED } from "@/lib/site";

export const metadata: Metadata = { title: "Questions fréquentes" };
export default function FaqPage() {
  const displayedFaqs = COMMERCE_ENABLED
    ? [
        {
          q: "Les produits sont-ils disponibles à la vente ?",
          a: "Les produits marqués disponibles peuvent être commandés. Le stock final est revérifié avant l’ouverture du paiement Stripe.",
        },
        ...faqs.slice(1),
      ]
    : faqs;
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Questions fréquentes</span>
          <h1>Des réponses claires, sans promesse floue.</h1>
          <p className="lead">Produits, disponibilité, origine, conservation, livraison et traçabilité.</p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell faq-list">
          {displayedFaqs.map((faq, index) => (
            <details className="faq-item" key={faq.q} open={index === 0}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
        <div className="section-shell" style={{ textAlign: "center", marginTop: "3rem" }}>
          <p>Une autre question ?</p>
          <Link className="button button-dark" href="/contact">
            Contacter AVANA
          </Link>
        </div>
      </section>
    </>
  );
}
