"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-providers";
import { getDetailedCart } from "@/lib/catalog";
import { formatCurrency } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics-client";
import { useEffect, useRef } from "react";

export function CartPageContent() {
  const { cart, catalog, catalogMode, updateQuantity, removeFromCart } = useApp();
  const detailed = getDetailedCart(cart, catalog);
  const subtotal = detailed.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const itemCount = detailed.reduce((sum, item) => sum + item.quantity, 0);
  const tracked = useRef(false);
  useEffect(() => {
    if (itemCount && !tracked.current) {
      tracked.current = true;
      trackEvent("view_cart", { itemCount });
    }
  }, [itemCount]);
  if (!detailed.length)
    return (
      <section className="empty-page section-shell">
        <ShoppingBag size={42} />
        <h1>Votre panier est prêt à être rempli.</h1>
        <p>Explorez les deux formats du MVP AVANA.</p>
        <Link className="button button-dark" href="/boutique">
          Découvrir la boutique
        </Link>
      </section>
    );
  return (
    <section className="page-section">
      <div className="section-shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Panier</span>
            <h1 className="section-title">Votre sélection.</h1>
          </div>
          <p>
            {catalogMode === "live"
              ? "Les taxes et frais de livraison finaux sont confirmés au paiement."
              : "Les prix, taxes et frais de livraison sont simulés pour la démonstration."}
          </p>
        </div>
        <div className="checkout-grid">
          <div className="checkout-panel">
            {detailed.map((item) => (
              <div className="cart-item" key={`${item.productId}-${item.variantId}`}>
                <Image src={item.product.image} alt="" width={120} height={140} />
                <div>
                  <h3>{item.product.name}</h3>
                  <p>
                    {item.variant.label} · {item.variant.sku}
                  </p>
                  <div className="cart-item-actions">
                    <div className="mini-quantity">
                      <button
                        aria-label={`Réduire ${item.product.name}`}
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                      >
                        <Minus size={13} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        aria-label={`Augmenter ${item.product.name}`}
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <button
                      className="remove-button"
                      onClick={() => removeFromCart(item.productId, item.variantId)}
                      aria-label={`Retirer ${item.product.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <strong>{formatCurrency(item.variant.price * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <aside className="checkout-panel checkout-summary">
            <h2 className="checkout-summary-title">Résumé</h2>
            <div className="summary-line">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary-line">
              <span>Livraison</span>
              <span>Calculée au checkout</span>
            </div>
            <div className="summary-line total">
              <span>Total provisoire</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <Link
              className="button button-dark"
              href="/checkout"
              style={{ width: "100%", marginTop: "1rem" }}
            >
              Continuer vers le checkout
            </Link>
            <p className="small muted" style={{ margin: "1rem 0 0" }}>
              {catalogMode === "live"
                ? "Le paiement sera traité sur la page sécurisée de Stripe."
                : "Aucun paiement réel ne sera effectué."}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
