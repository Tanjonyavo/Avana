import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Box, ExternalLink, FileCheck2, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { LotQr } from "@/components/lot-qr";
import { ProductCard } from "@/components/product-card";
import { lots as demoLots } from "@/data/demo";
import { getCatalogSnapshot } from "@/lib/server/catalog";
import { getPublicLotByCode } from "@/lib/server/lots";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return demoLots.filter((lot) => lot.publicTraceabilityEnabled).map((lot) => ({ code: lot.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const lot = await getPublicLotByCode(code).catch(() => null);
  return {
    title: lot ? `Lot ${lot.code}` : "Lot introuvable",
    description:
      lot?.publicSummary || (lot ? `Fiche publique de traçabilité du lot ${lot.code}.` : undefined),
    robots: !lot || lot.dataStatus !== "Réel" ? { index: false, follow: true } : undefined,
  };
}

export default async function LotPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [lot, catalog] = await Promise.all([
    getPublicLotByCode(code).catch(() => null),
    getCatalogSnapshot(),
  ]);
  if (!lot) notFound();
  const linkedProducts = catalog.products.filter((product) => product.lotCode === lot.code).slice(0, 3);
  const isDemo = lot.dataStatus !== "Réel";
  const measurements = [
    lot.humidityPercent === null || lot.humidityPercent === undefined
      ? null
      : ["Humidité documentée", `${lot.humidityPercent} %`],
    lot.averageLengthMm === null || lot.averageLengthMm === undefined
      ? null
      : ["Longueur moyenne", `${lot.averageLengthMm} mm`],
  ].filter((item): item is string[] => Boolean(item));

  return (
    <>
      <section className="lot-hero">
        <div className="section-shell">
          <div className="lot-nav">
            <Link className="text-link" href="/tracabilite">
              <ArrowLeft size={16} /> Nouvelle recherche
            </Link>
            <span className="demo-badge">{lot.dataStatus}</span>
          </div>
          <div className="lot-hero-grid">
            <div>
              <span className="eyebrow" style={{ color: "#b9cbbf" }}>
                Fiche publique du lot
              </span>
              <h1>{lot.code}</h1>
              <p className="lead">
                {lot.publicSummary || `Origine déclarée et parcours documenté de ce lot de ${lot.species}.`}
              </p>
            </div>
            <div className="qr-card">
              <LotQr code={lot.code} />
              <span>Scanner pour ouvrir cette fiche</span>
            </div>
          </div>
        </div>
      </section>

      <div className="section-shell lot-facts">
        <div className="lot-fact">
          <span>Origine</span>
          <strong>{lot.country}</strong>
        </div>
        <div className="lot-fact">
          <span>Région</span>
          <strong>{lot.region}</strong>
        </div>
        <div className="lot-fact">
          <span>Espèce</span>
          <strong>
            <em>{lot.species}</em>
          </strong>
        </div>
        <div className="lot-fact">
          <span>État du lot</span>
          <strong>{lot.status}</strong>
        </div>
      </div>

      <section className="page-section">
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Timeline logistique</span>
              <h2>Le parcours documenté.</h2>
            </div>
            <p>
              {isDemo
                ? "Ces événements illustrent le système et ne décrivent pas un approvisionnement commercial réel."
                : "Les informations publiées proviennent du dossier interne associé à ce lot."}
            </p>
          </div>
          {lot.events.length ? (
            <div className="timeline">
              {lot.events.map((event, index) => (
                <div className={`timeline-item ${event.status}`} key={`${event.label}-${index}`}>
                  <div className="timeline-date">
                    {event.date === "À venir" ? event.date : formatDate(event.date)}
                  </div>
                  <div className="timeline-track">
                    <div className="timeline-dot" />
                    {index < lot.events.length - 1 && <div className="timeline-line" />}
                  </div>
                  <div className="timeline-copy">
                    <h3>{event.label}</h3>
                    <strong>{event.location}</strong>
                    <p>{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <FileCheck2 size={34} />
                <h3>Parcours en documentation.</h3>
                <p>Les étapes publiques seront ajoutées après vérification.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="page-section" style={{ background: "var(--cream-100)" }}>
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Caractéristiques publiques</span>
              <h2>Des données publiées avec mesure.</h2>
            </div>
            <p>
              Les champs absents ne sont pas extrapolés. AVANA ne publie ni certification ni résultat
              d’analyse non confirmé.
            </p>
          </div>
          <div className="lot-facts" style={{ marginTop: 0 }}>
            <div className="lot-fact">
              <span>Grade</span>
              <strong>{lot.grade}</strong>
            </div>
            <div className="lot-fact">
              <span>Récolte</span>
              <strong>{lot.harvestYear}</strong>
            </div>
            {measurements.map(([label, value]) => (
              <div className="lot-fact" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div className="lot-fact">
              <span>Dernière réception</span>
              <strong>{lot.receptionDate ? formatDate(lot.receptionDate) : "Non publiée"}</strong>
            </div>
          </div>
          {lot.publicDocuments?.length ? (
            <div className="public-documents">
              {lot.publicDocuments.map((document) => (
                <a
                  className="public-document"
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  key={`${document.label}-${document.url}`}
                >
                  <FileText size={18} />
                  <span>
                    <strong>{document.label}</strong>
                    {document.date && <small>{formatDate(document.date)}</small>}
                  </span>
                  <ExternalLink size={15} />
                </a>
              ))}
            </div>
          ) : (
            <details className="technical-sheet">
              <summary className="button button-outline">
                <FileText size={17} /> Documents publics
              </summary>
              <div>
                <strong>Aucun document publié.</strong>
                <p>Les analyses et fiches techniques apparaîtront uniquement après validation.</p>
              </div>
            </details>
          )}
          <Link className="button button-outline" href="/notre-approche" style={{ marginTop: "1.5rem" }}>
            Notre méthode <ExternalLink size={16} />
          </Link>
        </div>
      </section>

      <section className="page-section">
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Traçabilité bidirectionnelle</span>
              <h2>Produits issus de ce lot.</h2>
            </div>
            <p>Chaque format actif relié à ce code apparaît automatiquement.</p>
          </div>
          {linkedProducts.length ? (
            <div className="product-grid">
              {linkedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <Box size={34} />
                <h3>Aucun produit actif associé.</h3>
                <p>Les formats reliés apparaîtront ici.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
