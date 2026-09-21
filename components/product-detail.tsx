"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Heart,
  Maximize2,
  Minus,
  Plus,
  ScanLine,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Product } from "@/types";
import { useApp } from "@/components/app-providers";
import { commerceConfig } from "@/data/config";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { postSubmission } from "@/lib/submissions-client";
import { formatCurrency } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics-client";

export function ProductDetail({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const [waitlistPending, setWaitlistPending] = useState(false);
  const { addToCart, favorites, toggleFavorite, catalogMode } = useApp();
  const live = catalogMode === "live";
  const variant = product.variants.find((item) => item.id === variantId) || product.variants[0];
  const waitlist = product.status === "waitlist" || variant.stock === 0;
  const favorite = favorites.includes(product.id);
  const maxQuantity = Math.max(1, Math.min(commerceConfig.maxCartQuantity, variant.stock));
  const lightboxRef = useDialogFocus<HTMLDivElement>(lightboxIndex !== null, () => setLightboxIndex(null));

  useEffect(() => {
    trackEvent("view_item", { productId: product.id, category: product.category });
  }, [product.category, product.id]);

  const chooseVariant = (id: string) => {
    setVariantId(id);
    setQuantity(1);
    setWaitlistMessage("");
  };

  const joinWaitlist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWaitlistPending(true);
    try {
      const result = await postSubmission({
        kind: "waitlist",
        email: waitlistEmail,
        productId: product.id,
        variantId: variant.id,
        _gotcha: "",
      });
      setWaitlistEmail("");
      setWaitlistMessage(
        result.mode === "live"
          ? "Merci, votre intérêt a été transmis."
          : "Mode démo : aucune donnée n’a été conservée.",
      );
    } catch (caught) {
      setWaitlistMessage(caught instanceof Error ? caught.message : "Inscription impossible.");
    } finally {
      setWaitlistPending(false);
    }
  };

  return (
    <div className="section-shell product-page">
      <nav className="breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link> / <Link href="/boutique">Boutique</Link> /{" "}
        <span aria-current="page">{product.category}</span>
      </nav>
      <div className="product-layout">
        <div className="product-gallery">
          {product.gallery.map((image, index) => (
            <button
              className="gallery-item"
              key={`${image}-${index}`}
              aria-label={`Agrandir la photo ${index + 1} de ${product.name}`}
              onClick={() => setLightboxIndex(index)}
            >
              <Image
                src={image}
                alt={index === 0 ? product.name : `Détail de ${product.name}`}
                width={1100}
                height={950}
                fetchPriority={index === 0 ? "high" : "auto"}
                loading={index === 0 ? "eager" : "lazy"}
                sizes="(max-width: 760px) 100vw, 60vw"
                style={{ width: "100%", height: "auto" }}
              />
              <span className="gallery-zoom">
                <Maximize2 size={16} /> Agrandir
              </span>
            </button>
          ))}
        </div>
        <div className="product-detail">
          <div className="button-row product-meta-row">
            <span className="demo-badge">{product.dataStatus}</span>
            <button
              className="button button-ghost button-sm"
              aria-pressed={favorite}
              onClick={() => toggleFavorite(product.id)}
            >
              <Heart size={17} fill={favorite ? "currentColor" : "none"} />{" "}
              {favorite ? "Enregistré" : "Favori"}
            </button>
          </div>
          <h1>{product.name}</h1>
          <div className="product-rating">
            <span className="status-dot" /> <span>Nouveau · aucun avis publié</span>
          </div>
          <p className="lead">{product.shortDescription}</p>
          <div className="price-large">
            {formatCurrency(variant.price)}{" "}
            <span className="small muted">
              CAD · {live ? "taxes calculées au paiement" : "prix de démonstration"}
            </span>
          </div>
          <div className="option-label">
            <span>Choisir un format</span>
            <span>
              {variant.stock > 0
                ? `${variant.stock} unité${variant.stock > 1 ? "s" : ""} ${live ? "disponible(s)" : "démo"}`
                : "Liste d’attente"}
            </span>
          </div>
          <div className="variant-grid" role="group" aria-label="Formats disponibles">
            {product.variants.map((item) => (
              <button
                className={`variant-option ${item.id === variant.id ? "active" : ""}`}
                aria-pressed={item.id === variant.id}
                key={item.id}
                onClick={() => chooseVariant(item.id)}
              >
                <strong>{item.label}</strong>
                <span>
                  {item.weight} · {formatCurrency(item.price)}
                </span>
              </button>
            ))}
          </div>

          {waitlist ? (
            <form className="waitlist-form" id="liste-attente" onSubmit={joinWaitlist}>
              <label htmlFor="waitlist-email">Être prévenu pour ce format</label>
              <div>
                <input
                  id="waitlist-email"
                  type="email"
                  required
                  value={waitlistEmail}
                  onChange={(event) => setWaitlistEmail(event.target.value)}
                  placeholder="votre@courriel.ca"
                />
                <button className="button button-dark" disabled={waitlistPending} type="submit">
                  {waitlistPending ? "Inscription…" : "Rejoindre la liste"}
                </button>
              </div>
              {waitlistMessage && <p aria-live="polite">{waitlistMessage}</p>}
            </form>
          ) : (
            <div className="purchase-row">
              <div className="quantity-picker">
                <button
                  aria-label="Réduire la quantité"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus size={16} />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  aria-label="Augmenter la quantité"
                  disabled={quantity >= maxQuantity}
                  onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                className="button button-dark"
                onClick={() => addToCart(product.id, variant.id, quantity)}
              >
                Ajouter — {formatCurrency(variant.price * quantity)}
              </button>
            </div>
          )}

          <div className="purchase-note">
            <Check size={15} />{" "}
            {live ? "Paiement sécurisé à l’étape suivante" : "Parcours simulé · aucune carte ne sera débitée"}
          </div>
          {product.audience.includes("Professionnels") && (
            <Link className="professional-product-link" href="/professionnels#demande">
              <span>Besoin d’un format professionnel ?</span>
              <strong>
                Discuter volumes et échantillons <ArrowRight size={15} />
              </strong>
            </Link>
          )}
          <Link className="lot-link" href={`/tracabilite/${product.lotCode}`}>
            <div>
              <span>Lot associé</span>
              <strong>{product.lotCode}</strong>
            </div>
            <ScanLine size={25} />
          </Link>
          <div className="detail-accordions">
            <details open>
              <summary>À propos</summary>
              <p>{product.description}</p>
            </details>
            <details>
              <summary>Composition et origine</summary>
              <p>
                {product.composition} Origine ciblée : {product.origin}, région {product.region}. Espèce :{" "}
                <em>{product.species}</em>.
              </p>
            </details>
            <details>
              <summary>Utilisation</summary>
              <p>
                {product.category === "Gousses"
                  ? "Fendre la gousse dans le sens de la longueur, récupérer les graines avec le dos d’un couteau, puis utiliser graines et enveloppe. La gousse peut être infusée selon la recette."
                  : "Commencer par une petite quantité, mélanger uniformément, puis ajuster selon la recette et l’intensité recherchée. Le dosage reste indicatif."}
              </p>
            </details>
            <details>
              <summary>Conservation</summary>
              <p>{product.storage}</p>
            </details>
            <details>
              <summary>Livraison et retours</summary>
              <p>
                <Truck size={15} />{" "}
                {live
                  ? "Livraison au Canada. Les frais, délais estimés et taxes sont confirmés avant le paiement sécurisé."
                  : "La livraison au Canada n’est pas encore active. Les paramètres affichés servent à la démonstration."}
              </p>
            </details>
            <details>
              <summary>Qualité et transparence</summary>
              <p>
                <ShieldCheck size={15} /> AVANA n’affiche aucune certification ni résultat d’analyse sans
                donnée confirmée. Les caractéristiques du lot restent configurables.
              </p>
            </details>
          </div>
        </div>
      </div>

      <div className="mobile-sticky-cart">
        <div>
          <strong>{formatCurrency(variant.price)}</strong>
          <span className="small muted">{variant.label}</span>
        </div>
        {waitlist ? (
          <a className="button button-dark" href="#liste-attente">
            Liste d’attente
          </a>
        ) : (
          <button className="button button-dark" onClick={() => addToCart(product.id, variant.id, quantity)}>
            Ajouter au panier
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <div
          className="image-lightbox"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxIndex(null);
          }}
        >
          <div
            className="image-lightbox-dialog"
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${lightboxIndex + 1} de ${product.name}`}
            tabIndex={-1}
          >
            <button
              className="lightbox-close"
              onClick={() => setLightboxIndex(null)}
              aria-label="Fermer l’image"
            >
              <X size={20} />
            </button>
            <Image
              src={product.gallery[lightboxIndex]}
              alt={`Vue agrandie de ${product.name}`}
              width={1536}
              height={1280}
              sizes="95vw"
            />
          </div>
        </div>
      )}
    </div>
  );
}
