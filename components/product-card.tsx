"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useApp } from "@/components/app-providers";

export function ProductCard({ product }: { product: Product }) {
  const { favorites, toggleFavorite } = useApp();
  const favorite = favorites.includes(product.id);
  const startingPrice = Math.min(...product.variants.map((variant) => variant.price));
  return (
    <article className="product-card">
      <div className="product-image">
        <Link href={`/boutique/${product.slug}`} aria-label={`Voir ${product.name}`}>
          <Image
            src={product.image}
            alt={product.name}
            width={900}
            height={1000}
            sizes="(max-width: 760px) 100vw, 33vw"
          />
        </Link>
        <div className="product-flags">
          <span className="demo-badge">{product.dataStatus}</span>
          {product.status === "waitlist" && <span className="status-badge warning">Liste d’attente</span>}
        </div>
        <button
          className={`favorite-button ${favorite ? "active" : ""}`}
          aria-pressed={favorite}
          onClick={() => toggleFavorite(product.id)}
          aria-label={
            favorite ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`
          }
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <Link className="product-info" href={`/boutique/${product.slug}`}>
        <h3>{product.name}</h3>
        <p>{product.eyebrow}</p>
        <span className="product-price">Dès {formatCurrency(startingPrice)}</span>
      </Link>
    </article>
  );
}
