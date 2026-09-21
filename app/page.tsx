import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FlaskConical,
  MapPin,
  PackageCheck,
  ScanLine,
  Sprout,
  UsersRound,
} from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Newsletter } from "@/components/newsletter";
import { PresentationMode } from "@/components/presentation-mode";
import { TraceSearchForm } from "@/components/trace-search-form";
import { getCatalogSnapshot } from "@/lib/server/catalog";
import { getLotSnapshot } from "@/lib/server/lots";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [catalog, lotSnapshot] = await Promise.all([getCatalogSnapshot(), getLotSnapshot()]);
  const publicLot = lotSnapshot.lots.find((lot) => lot.publicTraceabilityEnabled);
  const documentedSteps = publicLot?.events.filter((event) => event.status !== "upcoming").length || 0;
  return (
    <>
      <section className="hero">
        <div className="hero-media">
          <Image
            src="/images/avana-hero.png"
            alt="Gousses de vanille sur une pierre claire et du lin naturel"
            fill
            fetchPriority="high"
            loading="eager"
            sizes="100vw"
          />
        </div>
        <div className="section-shell hero-content">
          <span className="hero-kicker">Madagascar → Québec</span>
          <h1>
            Madagascar. Québec.
            <br />
            Une vanille traçable.
          </h1>
          <p className="lead">
            AVANA développe au Québec une nouvelle façon de valoriser la vanille de Madagascar, autour de la
            qualité, de l’origine et de la traçabilité.
          </p>
          <div className="button-row">
            <Link className="button button-light" href="/boutique">
              Découvrir la vanille <ArrowRight size={17} />
            </Link>
            <Link className="button button-outline" href="/notre-histoire">
              Découvrir AVANA
            </Link>
            <PresentationMode />
          </div>
        </div>
        <a className="hero-note" href="#origine">
          <span /> Suivre l’origine <ArrowDown size={15} />
        </a>
      </section>

      <section className="trust-strip" aria-label="Repères AVANA">
        <div className="section-shell trust-grid">
          <div className="trust-item">
            <MapPin size={23} />
            <div>
              <strong>Origine ciblée</strong>
              <span>Madagascar · région SAVA</span>
            </div>
          </div>
          <div className="trust-item">
            <PackageCheck size={23} />
            <div>
              <strong>Sélection documentée</strong>
              <span>Critères configurables par lot</span>
            </div>
          </div>
          <div className="trust-item">
            <ScanLine size={23} />
            <div>
              <strong>Traçabilité numérique</strong>
              <span>Identifiant unique et QR</span>
            </div>
          </div>
          <div className="trust-item">
            <CheckCircle2 size={23} />
            <div>
              <strong>Transparence</strong>
              <span>Données réelles, hypothèses ou démo</span>
            </div>
          </div>
        </div>
      </section>

      <section className="signature-section">
        <div className="section-shell signature-grid">
          <div className="signature-media">
            <Image
              src="/images/avana-still-life-v2.webp"
              alt="Composition éditoriale de gousses, poudre et emballages sobres"
              fill
              sizes="(max-width: 760px) 100vw, 58vw"
            />
          </div>
          <div className="signature-copy">
            <span className="eyebrow">L’objet AVANA</span>
            <h2>Sobre dans la forme. Précis dans l’information.</h2>
            <p className="lead">
              Une expérience pensée pour laisser parler la matière, puis rendre visibles les données qui
              comptent vraiment.
            </p>
            <Link className="text-link" href="/notre-approche">
              Voir notre méthode <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section origin-story" id="origine">
        <div className="section-shell story-layout">
          <div className="story-sticky">
            <span className="eyebrow">Le parcours</span>
            <h2>De l’origine à l’usage.</h2>
            <p className="lead">
              Une chaîne de valeur progressive, pensée pour documenter davantage à chaque étape sans prétendre
              que tout est déjà en place.
            </p>
            <div className="route-line">
              <span>Madagascar</span>
              <span>→</span>
              <span>SAVA</span>
              <span>→</span>
              <span>Canada</span>
              <span>→</span>
              <span>Québec</span>
              <span>→</span>
              <span>AVANA</span>
            </div>
            <figure className="story-image">
              <Image
                src="/images/vanilla-cultivation-v2.webp"
                alt="Inspection attentive de gousses vertes sur une liane de vanille"
                fill
                sizes="(max-width: 1050px) 100vw, 40vw"
              />
              <figcaption>Image éditoriale illustrative · relation fournisseur à confirmer</figcaption>
            </figure>
          </div>
          <div className="story-list">
            <div className="story-step">
              <span className="story-number">01</span>
              <div>
                <h3>À l’origine : Madagascar</h3>
                <p>La matière première et son territoire d’origine sont au cœur du projet AVANA.</p>
              </div>
            </div>
            <div className="story-step">
              <span className="story-number">02</span>
              <div>
                <h3>Sélection</h3>
                <p>Des critères de contrôle permettent de mieux documenter les lots étudiés.</p>
              </div>
            </div>
            <div className="story-step">
              <span className="story-number">03</span>
              <div>
                <h3>Canada</h3>
                <p>
                  Une stratégie opérationnelle légère privilégie d’abord des partenaires conformes et
                  expérimentés.
                </p>
              </div>
            </div>
            <div className="story-step">
              <span className="story-number">04</span>
              <div>
                <h3>Québec</h3>
                <p>La marque, la technologie et les futurs développements produits sont construits ici.</p>
              </div>
            </div>
            <div className="story-step">
              <span className="story-number">05</span>
              <div>
                <h3>Traçabilité</h3>
                <p>Un identifiant relie le lot, les produits et, à terme, les commandes concernées.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Le MVP commercial</span>
              <h2>Deux formats. Une même origine.</h2>
            </div>
            <p>
              {catalog.mode === "live"
                ? "Des formats sélectionnés avec prix et disponibilités vérifiés directement au paiement."
                : "Des produits de démonstration conçus pour tester les usages, les formats et l’intérêt du marché avant un lancement confirmé."}
            </p>
          </div>
          <div className="product-grid">
            {catalog.products.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
          <div className="button-row" style={{ marginTop: "2.5rem" }}>
            <Link className="button button-dark" href="/boutique">
              Voir toute la boutique <ArrowRight size={17} />
            </Link>
            <Link className="text-link" href="/quiz">
              Quel produit me convient ?
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section pillar-section">
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Pourquoi AVANA ?</span>
              <h2>
                L’origine compte.
                <br />
                La preuve aussi.
              </h2>
            </div>
            <p>
              AVANA combine matière, méthode et technologie dans un modèle conçu pour apprendre du marché.
            </p>
          </div>
          <div className="pillar-grid">
            <div className="pillar">
              <div className="pillar-icon">
                <Sprout size={20} />
              </div>
              <h3>Origine</h3>
              <p>Madagascar et la région SAVA comme repères centraux, documentés lot par lot.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <FlaskConical size={20} />
              </div>
              <h3>Sélection</h3>
              <p>Une approche structurée de la qualité, sans promesse qui dépasse les données disponibles.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <Database size={20} />
              </div>
              <h3>Technologie</h3>
              <p>Des données utiles pour relier la traçabilité, l’inventaire et l’expérience client.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon">
                <BarChart3 size={20} />
              </div>
              <h3>Progression</h3>
              <p>Prouver la demande, maîtriser l’opération, puis croître avec discipline.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="trace-teaser">
        <div className="trace-visual">
          <div>
            <span className="eyebrow" style={{ color: "#d8c6a7" }}>
              Une donnée concrète
            </span>
            <h2>Chaque lot a une histoire.</h2>
          </div>
          <div className="trace-card-demo">
            <div className="trace-card-demo-top">
              <div>
                <span className="small muted" style={{ color: "#bfb2a9" }}>
                  Lot public
                </span>
                <div className="trace-code">{publicLot?.code || "LOT À PUBLIER"}</div>
              </div>
              <span className="status-badge">Documenté</span>
            </div>
            <div className="trace-progress">
              {Array.from({ length: Math.max(8, publicLot?.events.length || 0) }).map((_, index) => (
                <span className={index < documentedSteps ? "active" : ""} key={index} />
              ))}
            </div>
            <p className="small" style={{ margin: ".7rem 0 0", color: "#cfc3bb" }}>
              {publicLot
                ? `${documentedSteps} étape${documentedSteps > 1 ? "s" : ""} documentée${documentedSteps > 1 ? "s" : ""} · ${publicLot.dataStatus}`
                : "Aucun lot public pour le moment"}
            </p>
          </div>
        </div>
        <div className="trace-content">
          <span className="eyebrow">Traçabilité publique</span>
          <h2>Comprendre ce que l’on achète.</h2>
          <p className="lead">
            Entrez un numéro de lot pour retrouver son origine déclarée, ses étapes logistiques et les
            produits qui lui sont associés.
          </p>
          <TraceSearchForm compact demo={lotSnapshot.mode === "demo"} />
          {lotSnapshot.mode === "demo" && (
            <p className="small muted" style={{ marginTop: ".8rem" }}>
              Essayez le lot de démonstration : DEMO-MG-SAVA-001
            </p>
          )}
        </div>
      </section>

      <section className="page-section">
        <div className="section-shell b2b-banner">
          <div className="b2b-copy">
            <span className="eyebrow" style={{ color: "white" }}>
              Pour les professionnels
            </span>
            <h2>La vanille AVANA pour vos créations.</h2>
            <p>
              Pâtisseries, chocolateries, restaurants, glaciers et cafés : échangeons sur vos usages, vos
              formats et vos volumes.
            </p>
            <Link className="button button-light" href="/professionnels">
              Parler avec AVANA <ArrowRight size={17} />
            </Link>
          </div>
          <div className="b2b-stats">
            <div className="b2b-stat">
              <UsersRound size={22} />
              <strong>10</strong>
              <span>entrevues B2B visées</span>
            </div>
            <div className="b2b-stat">
              <PackageCheck size={22} />
              <strong>2</strong>
              <span>formats MVP à tester</span>
            </div>
            <div className="b2b-stat">
              <FlaskConical size={22} />
              <strong>1</strong>
              <span>programme d’échantillons</span>
            </div>
            <div className="b2b-stat">
              <Database size={22} />
              <strong>8</strong>
              <span>étapes du pipeline</span>
            </div>
          </div>
        </div>
      </section>
      <Newsletter />
    </>
  );
}
