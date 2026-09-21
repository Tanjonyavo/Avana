"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useApp } from "@/components/app-providers";
import { getDetailedCart } from "@/lib/catalog";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { formatCurrency } from "@/lib/utils";

export function CartDrawer() {
  const { cart, catalog, catalogMode, setCartOpen, updateQuantity, removeFromCart } = useApp();
  const detailed = getDetailedCart(cart, catalog);
  const subtotal = detailed.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, () => setCartOpen(false));

  return (
    <div className="cart-drawer">
      <div className="drawer-overlay" aria-hidden="true" onClick={() => setCartOpen(false)} />
      <div
        className="drawer-panel"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        tabIndex={-1}
      >
        <div className="drawer-header">
          <h2 id="cart-title">Votre panier</h2>
          <button className="nav-icon" onClick={() => setCartOpen(false)} aria-label="Fermer le panier">
            <X />
          </button>
        </div>
        <div className="drawer-content">
          {detailed.length === 0 ? (
            <div className="empty-state">
              <div>
                <ShoppingBag size={34} />
                <h3>Votre panier est vide.</h3>
                <p>Votre première découverte AVANA apparaîtra ici.</p>
                <Link
                  href="/boutique"
                  className="button button-outline button-sm"
                  onClick={() => setCartOpen(false)}
                >
                  Découvrir la boutique
                </Link>
              </div>
            </div>
          ) : (
            detailed.map((item) => (
              <div className="cart-item" key={`${item.productId}-${item.variantId}`}>
                <Image src={item.product.image} alt="" width={120} height={140} />
                <div>
                  <h3>{item.product.name}</h3>
                  <p>
                    {item.variant.label} · {item.variant.weight}
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
                      aria-label={`Retirer ${item.product.name}`}
                      onClick={() => removeFromCart(item.productId, item.variantId)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <strong>{formatCurrency(item.variant.price * item.quantity)}</strong>
              </div>
            ))
          )}
        </div>
        {detailed.length > 0 && (
          <div className="drawer-footer">
            <div className="subtotal-row">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <p className="small muted">
              Livraison et taxes calculées à l’étape suivante.
              {catalogMode === "demo" ? " Démonstration seulement." : ""}
            </p>
            <Link href="/checkout" className="button button-dark" onClick={() => setCartOpen(false)}>
              Passer à la caisse
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
